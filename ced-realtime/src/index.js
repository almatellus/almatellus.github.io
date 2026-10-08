// Cloudflare Worker + Durable Object for Alma Tellus CED.
// Deploy separately. Set PUBLISH_TOKEN as a secret, never in site JavaScript.
export class CedRoom {
  constructor(state) {
    this.state = state;
    this.sockets = new Set();
  }
  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0], server = pair[1];
      server.accept();
      this.sockets.add(server);
      server.addEventListener("close", () => this.sockets.delete(server));
      server.addEventListener("error", () => this.sockets.delete(server));
      const latest = await this.state.storage.get("latest");
      if (latest) server.send(JSON.stringify(latest));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === "POST") {
      const job = await request.json();
      await this.state.storage.put("latest", job);
      const message = JSON.stringify(job);
      for (const ws of this.sockets) {
        try { ws.send(message); } catch (_) { this.sockets.delete(ws); }
      }
      return Response.json({ ok: true, id: job.id });
    }
    return new Response("Not found", { status: 404 });
  }
}

const cors = {
  "Access-Control-Allow-Origin": "https://almatellus.it",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const stub = env.CED_ROOM.get(env.CED_ROOM.idFromName("main"));
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const origin = request.headers.get("Origin");
      if (origin !== "https://almatellus.it" && origin !== "https://www.almatellus.it") {
        return new Response("Invalid origin", { status: 403 });
      }
      return stub.fetch(new Request(request, { headers: request.headers }));
    }
    if (url.pathname === "/publish" && request.method === "POST") {
      const token = request.headers.get("Authorization");
      if (!env.PUBLISH_TOKEN || token !== "Bearer " + env.PUBLISH_TOKEN) {
        return new Response("Unauthorized", { status: 401, headers: cors });
      }
      let job;
      try { job = await request.json(); } catch (_) { return new Response("Invalid JSON", {status:400,headers:cors}); }
      if (!job || typeof job.id !== "string" || typeof job.request !== "string" ||
          typeof job.code !== "string" || job.code.length > 30000) {
        return new Response("Invalid payload", { status: 400, headers: cors });
      }
      const response = await stub.fetch(new Request("https://room.internal", {method:"POST",body:JSON.stringify(job)}));
      return new Response(response.body, {status:response.status,headers:{...cors,"Content-Type":"application/json"}});
    }
    return new Response("CED relay ready", {status:200});
  }
};
