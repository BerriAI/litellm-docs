# MCP Server Usage

> Setup guides for connecting popular third-party MCP servers through the LiteLLM MCP Gateway.

Each guide covers the server's endpoint, the auth LiteLLM needs, how to register it, and how to reach its tools from an agent. The gateway treats every server the same regardless of vendor: one endpoint for all clients, permissions by key, team, and organization, cost tracking per tool call, and a single audit trail.

## Servers

| Server | Endpoint | Auth | Covers |
|---|---|---|---|
| [Slack](./slack.md) | `https://mcp.slack.com/mcp` | OAuth 2.1, your own Slack app | Search, channel and thread reads, messaging, canvases |
| [Atlassian](./atlassian.md) | `https://mcp.atlassian.com/v1/mcp/authv2` | OAuth 2.1, dynamic registration | Jira, Confluence, Compass, Jira Service Management, Bitbucket |
| [Linear](./linear.md) | `https://mcp.linear.app/mcp` | OAuth 2.1, dynamic registration | Issues, projects, cycles, documents, comments |

Any other remote MCP server follows the same shape: point `url` at its endpoint and pick the matching `auth_type` from the auth table in [MCP Overview](../mcp.md).

## What these guides assume

All three servers are hosted by their vendor and speak Streamable HTTP, so there is nothing to install or run yourself. All three authenticate per user with interactive OAuth, meaning each caller signs in once through their browser and tool calls carry that person's own permissions rather than a shared service identity. Storing MCP servers requires `store_model_in_db: true` on the proxy, covered in [Prerequisites](../mcp.md#prerequisites).

```yaml title="config.yaml" showLineNumbers
general_settings:
  store_model_in_db: true
```

:::warning Put the LiteLLM key in `x-litellm-api-key`
Interactive OAuth needs the `Authorization` header free for the upstream token. If a client sends the LiteLLM API key as `Authorization: Bearer sk-...`, the OAuth flow never runs and the proxy forwards your LiteLLM key to Slack, Atlassian, or Linear, which rejects it. This is the most common failure on all three servers. See [Debugging OAuth](../mcp_oauth.md#debugging-oauth).
:::

## Related pages

Client-side patterns are in [Using your MCP](../mcp_usage.md), access control by key and team in [MCP Permission Management](../mcp_control.md), the OAuth flows in [MCP OAuth](../mcp_oauth.md), per-tool spend in [MCP Cost Tracking](../mcp_cost.md), and connectivity failures in the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).
