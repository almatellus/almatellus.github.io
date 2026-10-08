// GitHub push -> signed webhook -> Durable Object -> CED WebSocket.
// Secrets are configured in Cloudflare and GitHub, never in the browser.
export const JOB_MARKER = "CED-LIVE/1\n";
const origins = new Set(["https://almatellus.it", "https://www.almatellus.it"]);
const encoder = new TextEncoder();
const json = (value, status = 200, headers = {}) => Response.json(value, {
  status, headers: { "Cache-Control": "no-store", ...headers },
});

export function validJob(job) {
  return job && typeof job.id === "string" && job.id.length > 0 && job.id.length <= 150 &&
    typeof job.request === "string" && job.request.length <= 1000 &&
    typeof job.code === "string" && job.code.length > 0 && job.code.length <= 30000 &&
    Number.isSafeInteger(job.createdAt) && job.createdAt > 0;
}

export async function verifySignature(secret, signature, body) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature || "")) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.slice(7).match(/../g), h => parseInt(h, 16));
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(body));
}

export class CedRoom {
  constructor(state) {
    this.state = state;
    // Idle sockets can hibernate without losing their connections.
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      this.state.acceptWebSocket(server);
      const latest = await this.state.storage.get("latest");
      if (latest) server.send(JSON.stringify(latest));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === "GET") return json(await this.state.storage.get("latest") || null);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const incoming = await request.json();
    if (!validJob(incoming)) return json({ error: "Invalid job" }, 400);
    const result = await this.state.storage.transaction(async tx => {
      const latest = await tx.get("latest");
      if (latest?.id === incoming.id) {
        if (latest.code !== incoming.code || latest.request !== incoming.request || latest.createdAt !== incoming.createdAt)
          return { conflict: true };
        return { job: latest, duplicate: true };
      }
      // Delayed/redelivered webhooks must never replace a newer program.
      if (latest && incoming.createdAt <= latest.createdAt) return { stale: true };
      const job = { id: incoming.id, request: incoming.request, code: incoming.code,
        createdAt: incoming.createdAt, sequence: (latest?.sequence || 0) + 1, publishedAt: Date.now() };
      await tx.put("latest", job);
      return { job };
    });
    if (result.conflict) return json({ error: "Job ID already used" }, 409);
    if (result.stale) return json({ ok: true, ignored: "older job" }, 202);
    if (!result.duplicate) {
      const message = JSON.stringify(result.job);
      for (const socket of this.state.getWebSockets()) {
        try { socket.send(message); } catch { try { socket.close(1011, "Reconnect"); } catch {} }
      }
    }
    return json({ ok: true, id: result.job.id, sequence: result.job.sequence,
      duplicate: Boolean(result.duplicate), publishedAt: result.job.publishedAt });
  }
  webSocketMessage(socket, message) {
    if (message === "ping") socket.send("pong");
    // Viewer sockets cannot publish programs.
  }
  webSocketClose(socket, code, reason) { socket.close(code, reason); }
  webSocketError(socket) { socket.close(1011, "Reconnect"); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = origins.has(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {};
    const room = () => env.CED_ROOM.get(env.CED_ROOM.idFromName("main"));
    if (request.method === "GET" && url.pathname === "/health")
      return json({ service: "alma-ced-relay", version: 1, configured: Boolean(env.GITHUB_WEBHOOK_SECRET) });
    if (request.method === "GET" && url.pathname === "/latest") {
      if (!origins.has(origin)) return json({ error: "Invalid origin" }, 403);
      const response = await room().fetch(new Request("https://room.internal/latest"));
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors } });
    }
    if (url.pathname === "/ws" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      if (!origins.has(origin)) return json({ error: "Invalid origin" }, 403);
      return room().fetch(request);
    }
    if (url.pathname !== "/github" || request.method !== "POST") return json({ error: "Not found" }, 404);
    if (!env.GITHUB_WEBHOOK_SECRET) return json({ error: "Webhook not configured" }, 503);
    if (Number(request.headers.get("Content-Length")) > 250000) return json({ error: "Payload too large" }, 413);
    const body = await request.text();
    if (encoder.encode(body).length > 250000) return json({ error: "Payload too large" }, 413);
    if (!await verifySignature(env.GITHUB_WEBHOOK_SECRET, request.headers.get("X-Hub-Signature-256"), body))
      return json({ error: "Invalid signature" }, 401);
    const event = request.headers.get("X-GitHub-Event");
    if (event === "ping") return json({ ok: true });
    if (event !== "push") return json({ ok: true, ignored: "event" }, 202);
    let payload;
    try { payload = JSON.parse(body); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (payload.repository?.full_name !== (env.GITHUB_REPOSITORY || "almatellus/almatellus.github.io") ||
        payload.ref !== "refs/heads/ced-live" || payload.deleted)
      return json({ ok: true, ignored: "repository or branch" }, 202);
    const message = payload.head_commit?.message;
    if (typeof message !== "string" || !message.startsWith(JOB_MARKER))
      return json({ ok: true, ignored: "commit format" }, 202);
    let job;
    try { job = JSON.parse(message.slice(JOB_MARKER.length)); } catch { return json({ error: "Invalid job JSON" }, 400); }
    if (!validJob(job)) return json({ error: "Invalid job" }, 400);
    return room().fetch(new Request("https://room.internal/publish", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job),
    }));
  },
};
