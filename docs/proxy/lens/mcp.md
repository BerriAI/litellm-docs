---
title: "Lens MCP server"
description: "Connect a coding agent to the read-only Lens MCP endpoint to list traces, open a run with its steps and cost, and read its turns."
slug: "/proxy/lens/mcp"
---

# Lens MCP server

{/* keep-version-note: The MCP endpoint ships with the Lens server, independent of a LiteLLM release. */}

Lens serves a read-only [MCP](https://modelcontextprotocol.io) endpoint at `/lens/mcp`, so a coding agent can look up its own runs: list traces, open one with its steps and cost, and read its turns. It is part of the Lens server, so there is nothing to install and it always matches your Lens version.

## Add it to Claude Code

For standalone Lens, use the Lens address and `LENS_ADMIN_TOKEN`:

```bash
claude mcp add --transport http lens http://localhost:4318/lens/mcp \
  --header "Authorization: Bearer <LENS_ADMIN_TOKEN>"
```

For Lens connected to LiteLLM, use your gateway address and a LiteLLM key instead. The gateway forwards the request to Lens signed in as that key's user:

```bash
claude mcp add --transport http lens https://<your-litellm-proxy>/lens/mcp \
  --header "Authorization: Bearer <your LiteLLM key>"
```

Run `claude mcp list` and check that `lens` shows as connected. Then ask something that needs trace data, such as "Use Lens to find my most recent trace and tell me what it cost".

Any MCP client that speaks Streamable HTTP works the same way: send JSON-RPC with `POST` to `/lens/mcp` and the same `Authorization` header.

## Credentials

The endpoint takes the same credentials as the trace read API. `LENS_ADMIN_TOKEN` reads every trace, and whoever runs the Lens deployment holds it. Through the gateway, a LiteLLM key returns only the traces [its user and their teams may see](./api.md#access). A tracing key can only send traces, so it is rejected here with `401`.

## Tools

| Tool | What it returns |
| --- | --- |
| `list_agents` | The agents that sent traces, with run and failure counts |
| `list_traces` | Recent traces, newest first, with input preview, status, models, token counts, and cost. Filter with `agent`, widen the window with `hours` (24 by default), and page with `cursor` |
| `get_trace` | One trace: its summary with total cost, its agents, and its spans in order. Page with `cursor` and `page_size` |
| `get_trace_conversation` | The earlier turns of the session a trace belongs to: each previous user input with the agent's answer, oldest first. The trace's own input and output are in `get_trace` and `get_span` |
| `get_span` | One span with its full input, output, and attributes. Its cost is on the span in `get_trace` |

Cost is the `spend` field in USD. It is filled when the calls went through a LiteLLM gateway, which is where the price is known.

Every tool is read only. The endpoint answers each request, or each batch of up to 16 requests, with one JSON response. It keeps no session between requests and does not open an event stream, so `GET /lens/mcp` returns `405`.
