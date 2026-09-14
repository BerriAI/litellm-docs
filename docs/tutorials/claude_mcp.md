import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Use Claude Code with MCPs

This tutorial shows how to connect MCP servers to Claude Code via LiteLLM Proxy.

Note: LiteLLM supports OAuth for MCP servers as well. [Learn more](https://docs.litellm.ai/docs/mcp#mcp-oauth)

## Demo

<iframe width="840" height="500" src="https://www.loom.com/embed/e3721fc44e284c559dc4dca67ba7603a" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

## Connecting MCP Servers

You can connect MCP servers to Claude Code via LiteLLM Proxy.


1. Add the MCP server to your `config.yaml`

<Tabs>
<TabItem value="github" label="GitHub MCP">

In this example, we'll add the Github MCP server to our `config.yaml`

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  github_mcp:
    url: "https://api.githubcopilot.com/mcp"
    transport: "http"
    auth_type: oauth2
    oauth2_flow: authorization_code
    client_id: os.environ/GITHUB_OAUTH_CLIENT_ID
    client_secret: os.environ/GITHUB_OAUTH_CLIENT_SECRET
```

</TabItem>
<TabItem value="atlassian" label="Atlassian MCP">

In this example, we'll add the Atlassian MCP server to our `config.yaml`

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  atlassian_mcp:
    url: "https://mcp.atlassian.com/v1/mcp"
    transport: "http"
    auth_type: oauth2
    oauth2_flow: authorization_code
```

</TabItem>
</Tabs>

:::important
The server name under `mcp_servers:` (e.g. `atlassian_mcp`, `github_mcp`) **must match** the name used in the Claude Code URL path (`/<server_name>/mcp`). A mismatch will cause a 404 error during OAuth.
:::

2. Start LiteLLM Proxy

Since Claude Code needs a publicly accessible URL for the OAuth callback, expose your proxy via ngrok or a similar tool.

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

```bash
# In a separate terminal — expose proxy for OAuth callbacks
ngrok http 4000
```

3. Add the MCP server to Claude Code

<Tabs>
<TabItem value="github" label="GitHub MCP">

```bash
claude mcp add --transport http litellm-github https://your-ngrok-url.ngrok-free.dev/github_mcp/mcp \
  --header "x-litellm-api-key: Bearer sk-1234"
```

</TabItem>
<TabItem value="atlassian" label="Atlassian MCP">

```bash
claude mcp add --transport http litellm-atlassian https://your-ngrok-url.ngrok-free.dev/atlassian_mcp/mcp \
  --header "x-litellm-api-key: Bearer sk-1234"
```

</TabItem>
</Tabs>

**Parameter breakdown:**

| Parameter | Description |
|-----------|-------------|
| `--transport http` | Use HTTP transport for the MCP connection |
| `litellm-atlassian` | The name for this MCP server **on Claude Code** — can be anything you choose |
| `https://your-ngrok-url.ngrok-free.dev/atlassian_mcp/mcp` | The LiteLLM proxy URL. Format: `<PROXY_URL>/<server_name_on_litellm>/mcp`. The `atlassian_mcp` part **must match** the key under `mcp_servers:` in your LiteLLM proxy config |
| `--header "x-litellm-api-key: Bearer sk-1234"` | Your LiteLLM virtual key for authentication to the proxy |

You can also add the MCP server directly to your `~/.claude.json` file instead of using `claude mcp add`. [See Claude Code docs](https://docs.anthropic.com/en/docs/claude-code/mcp).

:::note
For MCP servers that require OAuth (such as Atlassian), use `x-litellm-api-key` instead of `Authorization` for the LiteLLM virtual key. The `Authorization` header is reserved for the OAuth flow.
:::

4. Authenticate via Claude Code

a. Start Claude Code

```bash
claude
```

b. Open the MCP menu

```bash
/mcp
```

c. Select the MCP server (e.g. `litellm-atlassian`)

d. Start the OAuth flow

```bash
> 1. Authenticate
 2. Reconnect
 3. Disable
```

e. Once completed, you should see this success message:

<img src={require('../../img/oauth_2_success.png').default} alt="OAuth 2.0 Success" style={{ width: '500px', height: 'auto' }} />

## Keep MCP tools out of the context window (tool search)

Claude Code normally keeps MCP tool schemas out of the context window and loads them on demand through its built-in tool search. That flow needs the `advanced-tool-use-2025-11-20` beta header on every request and `tool_reference` blocks to round-trip through the API, so since Claude Code 2.1.70 the client turns tool search off on its own whenever `ANTHROPIC_BASE_URL` points at anything other than a first-party Anthropic host. The decision happens on the client before any request is sent, which is why `/context` shows every MCP tool schema inlined (tens of thousands of tokens with a few hundred tools) as soon as Claude Code is routed through LiteLLM, and why no proxy-side setting can turn it back on.

LiteLLM passes the beta header, `defer_loading`, and `tool_reference` blocks through unchanged on `/v1/messages` (and translates the beta to the Bedrock and Vertex AI names), so the fix lives on the Claude Code side. Tool search is controlled by the `ENABLE_TOOL_SEARCH` **environment variable**; it must be set to `true` in Claude Code's environment. There is no top-level settings key for it, so a bare `"enableToolSearch": true` in a settings file does nothing. Tell Claude Code (2.1.72 or newer) to keep tool search on:

```bash
export ANTHROPIC_BASE_URL=http://0.0.0.0:4000
export ANTHROPIC_AUTH_TOKEN=sk-1234
export ENABLE_TOOL_SEARCH=true
claude
```

We recommend persisting it in `.claude/settings.json` under the `env` block, either the project's `.claude/settings.json` or your user-level `~/.claude/settings.json` (or a managed settings file, to cover the whole team), so every session picks it up without remembering the export:

```json
{
  "env": {
    "ENABLE_TOOL_SEARCH": "true"
  }
}
```

`/context` then lists the MCP tools as `loaded on-demand` at 0 tokens, and Claude loads a tool's schema through `ToolSearch` the first time it needs it. `ENABLE_TOOL_SEARCH=auto` (or `auto:N`) only defers once tool schemas pass N% of the context window. See the [Claude Code docs](https://code.claude.com/docs/en/mcp#configure-tool-search) for the full option list.
