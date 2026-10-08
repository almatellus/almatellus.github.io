import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import worker, { CedRoom, JOB_MARKER, verifySignature } from "../src/index.js";

globalThis.WebSocketRequestResponsePair = class {};
function harness(){
  const values=new Map(), messages=[];
  const storage={get:async key=>values.get(key),put:async(key,value)=>values.set(key,value)};
  storage.transaction=async callback=>callback(storage);
  const socket={send:m=>messages.push(JSON.parse(m)),close:()=>{}};
  const state={storage,setWebSocketAutoResponse:()=>{},getWebSockets:()=>[socket]};
  const room=new CedRoom(state);
  const env={GITHUB_WEBHOOK_SECRET:"test-only-secret",CED_ROOM:{idFromName:x=>x,get:()=>room}};
  return {env,room,state,messages,values};
}
const job=(id,time)=>({id,createdAt:time,request:"Che anno è? È una prova.",code:'       IDENTIFICATION DIVISION.\n       PROGRAM-ID. PROVA.\n       PROCEDURE DIVISION.\n           DISPLAY "2026".\n           STOP RUN.'});
function pushRequest(env, payload, {event="push",sign=true}={}){
  const body=JSON.stringify(payload);
  const headers={"Content-Type":"application/json","X-GitHub-Event":event};
  if(sign)headers["X-Hub-Signature-256"]="sha256="+createHmac("sha256",env.GITHUB_WEBHOOK_SECRET).update(body).digest("hex");
  return new Request("https://relay.example/github",{method:"POST",headers,body});
}
const payload=j=>({repository:{full_name:"almatellus/almatellus.github.io"},ref:"refs/heads/ced-live",head_commit:{message:JOB_MARKER+JSON.stringify(j)}});
test("official GitHub HMAC vector and UTF-8 tampering protection",async()=>{
  assert.equal(await verifySignature("It's a Secret to Everybody","sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17","Hello, World!"),true);
  const s="sha256="+createHmac("sha256","secret").update("È già pronto").digest("hex");
  assert.equal(await verifySignature("secret",s,"È già pronto"),true);
  assert.equal(await verifySignature("secret",s,"È già pronto!"),false);
  assert.equal(await verifySignature("secret","sha256=xx","È già pronto"),false);
});
test("signed GitHub push reaches viewers and persists the latest job",async()=>{
  const h=harness(), j=job("a",1000);
  const response=await worker.fetch(pushRequest(h.env,payload(j)),h.env);
  assert.equal(response.status,200);
  assert.equal(h.messages.length,1);
  assert.equal(h.messages[0].id,"a");
  assert.equal(h.messages[0].sequence,1);
  const latest=await (await new CedRoom(h.state).fetch(new Request("https://room.internal/latest"))).json();
  assert.equal(latest.code,j.code);
});
test("unsigned, tampered and unconfigured webhook cannot publish",async()=>{
  const h=harness(), body=payload(job("a",1000));
  assert.equal((await worker.fetch(pushRequest(h.env,body,{sign:false}),h.env)).status,401);
  assert.equal((await worker.fetch(pushRequest({...h.env,GITHUB_WEBHOOK_SECRET:"wrong"},body),h.env)).status,401);
  assert.equal((await worker.fetch(pushRequest(h.env,body),{...h.env,GITHUB_WEBHOOK_SECRET:""})).status,503);
  assert.equal(h.messages.length,0);
});
test("other repositories, main branch and unrelated commits never publish",async()=>{
  const h=harness();
  for(const change of [{repository:{full_name:"other/repo"}},{ref:"refs/heads/main"},{deleted:true},{head_commit:{message:"Ordinary change"}}]){
    assert.equal((await worker.fetch(pushRequest(h.env,{...payload(job("a",1000)),...change}),h.env)).status,202);
  }
  assert.equal(h.messages.length,0);
});
test("duplicates and delayed jobs do not replay; changed duplicate is rejected",async()=>{
  const h=harness(), a=job("a",1000), b=job("b",2000);
  for(const j of [a,a,b,a])await worker.fetch(pushRequest(h.env,payload(j)),h.env);
  assert.deepEqual(h.messages.map(x=>x.id),["a","b"]);
  assert.equal((await worker.fetch(pushRequest(h.env,payload({...b,code:"modified"})),h.env)).status,409);
  assert.equal((await (await h.room.fetch(new Request("https://room.internal/latest"))).json()).id,"b");
});
test("reader origin checks and read-only sockets",async()=>{
  const h=harness();
  assert.equal((await worker.fetch(new Request("https://relay.example/ws",{headers:{Upgrade:"websocket",Origin:"https://evil.example"}}),h.env)).status,403);
  const latest=await worker.fetch(new Request("https://relay.example/latest",{headers:{Origin:"https://www.almatellus.it"}}),h.env);
  assert.equal(latest.headers.get("access-control-allow-origin"),"https://www.almatellus.it");
  assert.equal(latest.headers.get("cache-control"),"no-store");
  h.room.webSocketMessage({send:()=>assert.fail("Viewer published")},JSON.stringify(job("viewer",3000)));
  assert.equal(h.values.has("latest"),false);
});
test("page keeps newest job without rewriting on duplicate or legacy fallback",async()=>{
  const html=await readFile(new URL("../../ced/index.html",import.meta.url),"utf8");
  const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace("start();","globalThis.cedTest={receive};");
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:"",disabled:false,addEventListener:()=>{}});return elements.get(id)};
  const context=vm.createContext({document:{getElementById:element},setTimeout:f=>{f();return 1},clearTimeout:()=>{},Set,TextDecoder,AbortSignal});
  vm.runInContext(source,context);
  context.cedTest.receive({...job("old",1000),sequence:1},true);
  context.cedTest.receive({...job("new",2000),sequence:2,code:job("new",2000).code.replace("2026","2027")},true);
  await new Promise(setImmediate);
  assert.match(element("editor").textContent,/2027/);
  assert.doesNotMatch(element("editor").textContent,/2026/);
  assert.equal(element("status").textContent,"SORGENTE PRONTO");
  const visible=element("editor").textContent;
  context.cedTest.receive({...job("new",2000),sequence:2},true);
  context.cedTest.receive({...job("old",1000),sequence:1},true);
  context.cedTest.receive(job("legacy",3000),false);
  await new Promise(setImmediate);
  assert.equal(element("editor").textContent,visible);
});
