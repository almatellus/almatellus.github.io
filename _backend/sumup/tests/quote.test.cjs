const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const path=require('node:path');
const base=path.join(__dirname,'..');
const codePath=process.env.ALMA_CURRENT_CODE;
if(!codePath) throw Error('Set ALMA_CURRENT_CODE to the patched current Apps Script export.');
const current=fs.readFileSync(codePath,'utf8');
class Sheet {
  constructor(name,rows=[]){this.name=name;this.rows=rows;this.max=100;}
  getName(){return this.name;} getLastRow(){return this.rows.length;} getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
  getMaxColumns(){return this.max;} insertColumnAfter(){this.max++;} setFrozenRows(){}
  getRange(r,c,n=1,m=1){const sheet=this;const values=()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>sheet.rows[r-1+i]?.[c-1+j]??''));
    return {getValues:values,getDisplayValues:()=>values().map(row=>row.map(String)),getDisplayValue:()=>String(values()[0][0]),
      setValue:v=>{while(sheet.rows.length<r)sheet.rows.push([]);sheet.rows[r-1][c-1]=v;},
      clearContent:()=>{sheet.rows[r-1][c-1]='';},setValues:rows=>{rows.forEach((row,i)=>{while(sheet.rows.length<r+i)sheet.rows.push([]);row.forEach((v,j)=>sheet.rows[r-1+i][c-1+j]=v);});}};
  }
}
function app(){
  const sheets=new Map(),calls=[],mails=[],checkouts=new Map(),tx=new Map();let now=Date.parse('2026-10-08T12:00:00Z'),email='associazione.almatellus@gmail.com',lock=false;
  const props=new Map([['SUMUP_API_KEY','fixture-local-secret'],['SUMUP_MERCHANT_CODE','MTEST'],['SUMUP_LINK_PERMANENTI_READY','1']]);
  let losePost=false;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const ctx=vm.createContext({Date:Clock,console:{log(){},warn(){}},Session:{getActiveUser:()=>({getEmail:()=>email})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)??null,setProperty:(k,v)=>props.set(k,v)})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest()),formatDate:(d)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet(n);sheets.set(n,s);return s;}}),flush(){}},
    LockService:{getScriptLock:()=>({waitLock:()=>{if(lock)throw Error('nested lock');lock=true;},releaseLock:()=>{lock=false;}})},
    GmailApp:{sendEmail:(...args)=>mails.push(args)},
    HtmlService:{createHtmlOutput:()=>({setTitle(){return this;},setXFrameOptionsMode(){return this;}}),XFrameOptionsMode:{ALLOWALL:1}},
    UrlFetchApp:{fetch:(url,options)=>{
      calls.push({url,options});const u=new URL(url);let body;
      if(options.method==='post'){
        const payload=JSON.parse(options.payload);assert.equal(u.pathname,'/v0.1/checkouts');
        assert.equal(payload.hosted_checkout.enabled,true);assert.equal(payload.currency,'EUR');assert.equal(payload.merchant_code,'MTEST');
        assert(!payload.customer_id);assert(!payload.card);
        body={...payload,id:crypto.randomUUID(),status:'PENDING',transactions:[]};body.hosted_checkout_url='https://checkout.sumup.com/pay/c-'+body.id;
        checkouts.set(body.id,body);
        if(losePost){losePost=false;throw Error('Lost response includes fixture-local-secret');}
      }else if(u.pathname==='/v0.1/checkouts'){body=[...checkouts.values()].filter(c=>c.checkout_reference===u.searchParams.get('checkout_reference'));}
      else if(u.pathname.startsWith('/v0.1/checkouts/')){body=checkouts.get(u.pathname.split('/').pop());}
      else if(u.pathname==='/v2.1/merchants/MTEST/transactions'){body=tx.get(u.searchParams.get('id'));}
      else throw Error('Unexpected endpoint '+url);
      return {getResponseCode:()=>body?200:404,getContentText:()=>JSON.stringify(body||{})};
    }}
  });
  vm.runInContext(current+'\n'+fs.readFileSync(path.join(base,'SumUp.gs'),'utf8')+'\n'+fs.readFileSync(path.join(base,'SumUpQuote.gs'),'utf8'),ctx);
  const requestHeaders=Array.from(vm.runInContext('HEADERS_RICHIESTE',ctx));
  const memberHeaders=Array.from(vm.runInContext('HEADERS_LIBRO_SOCI',ctx));memberHeaders.push('ID richiesta origine');
  const requests=new Sheet('Richieste adesione',[requestHeaders]);const members=new Sheet('Libro soci',[memberHeaders]);sheets.set(requests.name,requests);sheets.set(members.name,members);
  function row(headers,data){return headers.map(h=>data[h]??'');}
  function add(id,amount=15,accepted=true){requests.rows.push(row(requestHeaders,{'ID richiesta':id,'Stato domanda':accepted?'Accolta':'Ricevuta','Nome':'Persona','Cognome':'Test '+id,'Email':'test@example.invalid','Codice fiscale':'TESTFISCALE'+id}));
    if(accepted)members.rows.push(row(memberHeaders,{'Numero socio':String(members.rows.length),'ID richiesta origine':id,'Quota prevista':amount,'Stato socio':'Da pagare','Nome':'Persona','Cognome':'Test '+id,'Codice fiscale':'TESTFISCALE'+id}));
  }
  function prepare(id,amount=15){const result=ctx.sumupQuotaPrepara_(id,amount);return {link:result.url,token:result.url.split('#')[1],amount:result.amount};}
  function markPaid(checkout,patch={}){checkout.status='PAID';const id=crypto.randomUUID();checkout.transactions=[{id}];const raw={id,merchant_code:'MTEST',amount:checkout.amount,currency:'EUR',timestamp:'2026-10-08T08:59:00Z',simple_status:'SUCCESSFUL',transaction_code:'T-'+id,refunded_amount:0,...patch};tx.set(id,raw);return raw;}
  return {ctx,sheets,calls,mails,checkouts,tx,props,requests,members,add,prepare,markPaid,memberHeaders,
    postCount:()=>calls.filter(c=>c.options.method==='post').length,advance:ms=>now+=ms,setEmail:v=>email=v,loseNextPost:()=>losePost=true,
    value:(i,name)=>members.rows[i][memberHeaders.indexOf(name)]};
}
test('accetta socio invia una sola mail con link personale e conserva il controllo prima delle scritture',()=>{
  const a=app();a.add('new',15,false);const result=a.ctx.registraDecisioneSociWeb({id:'new',decision:'Accolta',date:'2026-10-08',quotaVersata:'15'});
  assert.equal(result.ok,true);assert.equal(a.mails.length,1);assert.match(a.mails[0][3].htmlBody,/https:\/\/almatellus\.it\/paga\.html#[a-f0-9]{64}/);assert(!a.mails[0][3].htmlBody.includes('pay.sumup.com'));
  assert.equal(a.value(1,'Stato socio'),'Da pagare');assert.equal(a.value(1,'Quota versata'),'');assert.equal(a.postCount(),0);
  a.ctx.registraDecisioneSociWeb({id:'new',decision:'Accolta',date:'2026-10-08',quotaVersata:'15'});assert.equal(a.mails.length,1);
  const b=app();b.add('new',15,false);b.props.delete('SUMUP_LINK_PERMANENTI_READY');
  assert.throws(()=>b.ctx.registraDecisioneSociWeb({id:'new',decision:'Accolta',date:'2026-10-08',quotaVersata:'15'}),/non ancora attivi/);assert.equal(b.members.rows.length,1);assert.equal(b.requests.rows[1][2],'Ricevuta');assert.equal(b.mails.length,0);
});
test('link stabile, diversi soci hanno token distinti; importi 5 e 15 euro sono supportati',()=>{
  const a=app();a.add('one',5);a.add('two',15);const one=a.prepare('one',5),two=a.prepare('two',15);
  assert.equal(a.prepare('one',5).link,one.link);assert.notEqual(one.token,two.token);assert.match(one.token,/^[a-f0-9]{64}$/);assert.equal(a.postCount(),0);
  assert(!one.link.includes('one'));assert.equal(a.mails.length,0);
});
test('token alterati e amministratori non autorizzati non ottengono dati o chiamate API',()=>{
  const a=app();a.add('one');const p=a.prepare('one');const before=a.calls.length;
  assert.throws(()=>a.ctx.sumupQuotaAvvia('0'.repeat(64)),/non valido/);assert.throws(()=>a.ctx.sumupQuotaStato('bad'),/non valido/);assert.equal(a.calls.length,before);
  a.setEmail('visitor@example.invalid');assert.throws(()=>a.ctx.leggiElencoSociWeb(),/Accesso riservato/);assert.throws(()=>a.ctx.setup(),/Accesso riservato/);assert.throws(()=>a.ctx.testMailContatti(),/Accesso riservato/);assert.equal(a.mails.length,0);
  // Un possessore del link può soltanto aprire la propria quota: non serve Google login.
  a.setEmail('');assert.equal(a.ctx.sumupQuotaAvvia(p.token).amount,15);
});
test('riaperture usano lo stesso checkout; dopo la scadenza cambia la sessione ma non il link',()=>{
  const a=app();a.add('one');const p=a.prepare('one');const first=a.ctx.sumupQuotaAvvia(p.token),same=a.ctx.sumupQuotaAvvia(p.token);
  assert.equal(first.url,same.url);assert.equal(a.postCount(),1);assert.equal(a.prepare('one').link,p.link);
  a.advance(31*60000);for(const c of a.checkouts.values())c.status='EXPIRED';
  const next=a.ctx.sumupQuotaAvvia(p.token);assert.notEqual(next.url,first.url);assert.equal(a.postCount(),2);assert.equal(a.prepare('one').link,p.link);
});
test('una risposta POST persa si recupera per riferimento senza creare un secondo pagamento',()=>{
  const a=app();a.add('one');const p=a.prepare('one');a.loseNextPost();
  assert.throws(()=>a.ctx.sumupQuotaAvvia(p.token),e=>/fra poco/.test(e.message)&&!e.message.includes('fixture-local-secret'));
  assert.equal(a.postCount(),1);const result=a.ctx.sumupQuotaAvvia(p.token);assert(result.url);assert.equal(a.postCount(),1);
});
test('transazione verificata aggiorna solo il socio associato, data reale e scadenza annuale',()=>{
  const a=app();a.add('one');a.add('two',5);const p=a.prepare('one');a.ctx.sumupQuotaAvvia(p.token);const raw=a.markPaid([...a.checkouts.values()][0]);
  const result=a.ctx.sumupQuotaStato(p.token);assert.equal(result.paid,true);assert.equal(a.value(1,'Stato socio'),'Pagato');assert.equal(a.value(1,'Quota versata'),15);
  assert.equal(a.value(1,'Data pagamento quota').getDate(),8);assert.equal(a.value(1,'Scadenza tessera').getFullYear(),2027);assert.equal(a.value(2,'Stato socio'),'Da pagare');
  assert.equal(a.ctx.sumupQuotaAvvia(p.token).paid,true);assert.equal(a.postCount(),1);
  const items=[{code:raw.transaction_code},{code:'unknown'}];a.ctx.sumupQuotaAssociaIncassi_(items);assert.equal(items[0].memberName,'Persona Test one');assert.equal(items[1].memberName,undefined);
});
test('PAID dichiarato con importo o commerciante sbagliato e rimborsi non registra quote',()=>{
  for(const patch of [{amount:5},{merchant_code:'OTHER'},{currency:'USD'},{refunded_amount:1},{simple_status:'PENDING'}]){
    const a=app();a.add('one');const p=a.prepare('one');a.ctx.sumupQuotaAvvia(p.token);a.markPaid([...a.checkouts.values()][0],patch);
    assert.throws(()=>a.ctx.sumupQuotaStato(p.token),/in verifica/);assert.equal(a.value(1,'Stato socio'),'Da pagare');assert.equal(a.value(1,'Quota versata'),'');
  }
});
test('un checkout con riferimento manomesso non è accettato',()=>{
  const a=app();a.add('one');const p=a.prepare('one');a.ctx.sumupQuotaAvvia(p.token);const checkout=[...a.checkouts.values()][0];checkout.checkout_reference='wrong';a.markPaid(checkout);
  assert.throws(()=>a.ctx.sumupQuotaStato(p.token),/Riferimento/);assert.equal(a.value(1,'Stato socio'),'Da pagare');
});
test('il webhook controlla SumUp e ignora un esito inviato dal chiamante',()=>{
  const a=app();a.add('one');const p=a.prepare('one');a.ctx.sumupQuotaAvvia(p.token);const checkout=[...a.checkouts.values()][0];
  const e={postData:{contents:JSON.stringify({event_type:'CHECKOUT_STATUS_CHANGED',id:checkout.id,status:'PAID'})}};
  a.ctx.sumupQuotaCallback_(e);assert.equal(a.value(1,'Stato socio'),'Da pagare');
  a.markPaid(checkout);a.ctx.sumupQuotaCallback_(e);assert.equal(a.value(1,'Stato socio'),'Pagato');a.ctx.sumupQuotaCallback_(e);assert.equal(a.postCount(),1);
});
test('quote già registrate manualmente non generano un altro pagamento',()=>{
  const a=app();a.add('one');const p=a.prepare('one');a.members.rows[1][a.memberHeaders.indexOf('Stato socio')]='Pagato';a.members.rows[1][a.memberHeaders.indexOf('Quota versata')]=15;
  assert.equal(a.ctx.sumupQuotaAvvia(p.token).paid,true);assert.equal(a.calls.length,0);
});
test('una transazione non può saldare due quote',()=>{
  const a=app();a.add('one');a.add('two');const one=a.prepare('one'),two=a.prepare('two');a.ctx.sumupQuotaAvvia(one.token);a.ctx.sumupQuotaAvvia(two.token);
  const checkouts=[...a.checkouts.values()];a.markPaid(checkouts[0],{transaction_code:'UNIQUE'});a.ctx.sumupQuotaStato(one.token);a.markPaid(checkouts[1],{transaction_code:'UNIQUE'});
  assert.throws(()=>a.ctx.sumupQuotaStato(two.token),/altra quota/);assert.equal(a.value(2,'Stato socio'),'Da pagare');
});
