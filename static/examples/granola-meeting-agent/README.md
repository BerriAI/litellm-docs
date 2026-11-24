# Meeting Agent: Granola through LiteLLM MCP Gateway

This reference app is the full example for the blog post "How to Let Customers Connect Their Apps to Your Agent". Customers create an account, connect their own Granola account with OAuth, and ask an agent about their meetings. The backend keeps one LiteLLM virtual key for the whole app and sends each customer's Granola access token with every MCP request, so LiteLLM never stores customer OAuth tokens.

`src/server.ts` has the routes: sign up, sign in, `GET /connect/granola` (starts OAuth), `GET /oauth/callback` (validates the state against the signed-in session, exchanges the code, then verifies the account), and the `/api/check` and `/api/ask` endpoints. `src/connections.ts` runs MCP OAuth discovery, dynamic client registration and the PKCE code exchange with the MCP TypeScript SDK, stores tokens and client information encrypted per tenant, user and server, and refreshes expired tokens before tool calls. `src/mcp.ts` connects to `<gateway>/granola/mcp` with `x-litellm-api-key` and the customer's bearer token. `src/agent.ts` gives the model the tools from `listTools()`, runs its calls with `callTool()` and returns the answer.

## Run it

You need Node.js 22.13 or later, a LiteLLM gateway (v1.110.2 or later) with PostgreSQL, Granola registered with `auth_type: "oauth_delegate"` and `dcr_bridge: false` as the blog post shows, and a virtual key whose MCP settings allow `granola`. The key also needs access to the model you set in `LITELLM_MODEL`, since the agent calls `/v1/chat/completions` with it.

```bash
cp .env.example .env   # fill in the gateway URL, the application key and a random APP_SECRET
npm install
node --env-file=.env --import tsx src/server.ts
```

Open `APP_BASE_URL`, create an account, click Connect Granola and approve access. The page shows Connected only after `get_account_info` succeeds through the gateway. Run `npm test` for the session binding, isolation and refresh tests, and `npm run typecheck` for the types.

`APP_BASE_URL` must match the URL customers open, because the OAuth callback is `${APP_BASE_URL}/oauth/callback`. Use an HTTPS URL when you deploy. `APP_SECRET` encrypts stored connections; changing it makes every saved connection unreadable, so customers would have to reconnect.

The SQLite store in `data/app.db` suits a single-process demo. A hosted app needs a database that survives deployments and that every instance can reach, and the encryption key belongs in a secrets manager.
