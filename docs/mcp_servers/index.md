# MCP Server Usage

Setup guides for connecting popular third-party MCP servers through the LiteLLM MCP Gateway. Each guide covers the server's endpoint, the auth LiteLLM needs, how to register it, and how to reach its tools from an agent.

The gateway treats every server the same regardless of vendor: one endpoint for all clients, permissions by key, team, and organization, cost tracking per tool call, and a single audit trail. See [MCP Overview](../mcp.md) for the gateway itself and [Using your MCP](../mcp_usage.md) for the client-side patterns these guides build on.

## Supported servers

| Server | Endpoint | Auth | Covers |
|--------|----------|------|--------|
| [Slack](./slack.md) | `https://mcp.slack.com/mcp` | OAuth 2.1, your own Slack app | Search, channel and thread reads, messaging, canvases |
| [Atlassian](./atlassian.md) | `https://mcp.atlassian.com/v1/mcp` | OAuth 2.1, dynamic registration | Jira issues, Confluence pages, Compass components |
| [Linear](./linear.md) | `https://mcp.linear.app/mcp` | OAuth 2.1, dynamic registration | Issues, projects, cycles, documents, comments |

Any other remote MCP server follows the same shape. Point `url` at its endpoint and pick the matching `auth_type`; the full list is in [MCP Overview](../mcp.md).

## What these guides assume

All three servers are hosted by their vendor and speak Streamable HTTP, so there is nothing to install or run yourself. All three authenticate per user with interactive OAuth, meaning each caller signs in once through their browser and the resulting tool calls carry that person's own permissions rather than a shared service identity.

Storing MCP servers requires database storage on the proxy, covered in [Prerequisites](../mcp.md#prerequisites):

```yaml title="config.yaml" showLineNumbers
general_settings:
  store_model_in_db: true
```

:::info Put the LiteLLM key in `x-litellm-api-key`
Interactive OAuth needs the `Authorization` header free for the upstream token. A client that sends the LiteLLM API key as `Authorization: Bearer sk-...` blocks the OAuth flow entirely and forwards that key to Slack, Atlassian, or Linear, which rejects it. See [Debugging OAuth](../mcp_oauth.md#debugging-oauth).
:::

## Related pages

Access control by key and team lives in [MCP Permission Management](../mcp_control.md), the OAuth flows are documented in [MCP OAuth](../mcp_oauth.md), per-tool spend is in [MCP Cost Tracking](../mcp_cost.md), and connectivity failures are diagnosed in the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).
