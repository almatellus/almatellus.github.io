# CED realtime relay

This is an optional, separate Cloudflare Worker for the CED page.

1. Deploy with Cloudflare Wrangler in a Cloudflare account (Durable Objects support required).
2. Set secret: `wrangler secret put PUBLISH_TOKEN`.
3. Copy the public Worker URL for the CED client WebSocket connection at `/ws`.
4. Only the authorized publisher may POST JSON `{"id":"...","request":"...","code":"..."}` to `/publish`.
5. Do not put PUBLISH_TOKEN in a public site or repository. Publishing from ChatGPT requires an authorized connector/backend capable of authenticated HTTP POST; the current GitHub-only connector cannot invoke Worker HTTP endpoints directly.
6. Until an endpoint and a publishing path have both been confirmed, leave the existing GitHub-polling CED page untouched.

This service broadcasts jobs but does not compile COBOL. Execution remains the existing browser demo.
