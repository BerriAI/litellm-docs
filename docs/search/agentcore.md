# Amazon Bedrock AgentCore Web Search

[Web Search on Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/built-in-tools-web-search.html) is an AWS-managed web index exposed as an MCP tool on an AgentCore Gateway, so search traffic stays inside AWS and is billed by AWS instead of a third-party search API

Unlike the other search providers, there is no API key to sign up for. You create a gateway with a `web-search` connector target, then point LiteLLM at its MCP endpoint

| | |
|---|---|
| Provider ID | `agentcore` |
| Gateway URL | `AGENTCORE_GATEWAY_URL`, or `api_base` |
| Auth (AWS_IAM gateway) | SigV4, from explicit keys or the standard AWS credential chain |
| Auth (CUSTOM_JWT gateway) | `AGENTCORE_GATEWAY_TOKEN`, or `api_key` |
| Tool name override | `AGENTCORE_SEARCH_TOOL_NAME`, or `tool_name` |
| MCP protocol version override | `AGENTCORE_MCP_PROTOCOL_VERSION` |

The gateway URL looks like `https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp`

## LiteLLM Python SDK

```python showLineNumbers title="AgentCore Web Search"
import os
from litellm import search

os.environ["AGENTCORE_GATEWAY_URL"] = "https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp"
os.environ["AWS_ACCESS_KEY_ID"] = "your-access-key"
os.environ["AWS_SECRET_ACCESS_KEY"] = "your-secret-key"

response = search(
    query="latest AI developments",
    search_provider="agentcore",
    max_results=5
)

for result in response.results:
    print(f"{result.title}: {result.url}")
    print(f"Snippet: {result.snippet}\n")
```

Omit the AWS keys to use the standard credential chain (environment, shared profile, IRSA, instance role), or pass them per call as `aws_access_key_id`, `aws_secret_access_key`, `aws_session_token` and `aws_region_name`

For a CUSTOM_JWT gateway, pass the OAuth2 bearer token instead and no AWS credentials are used:

```python showLineNumbers title="AgentCore Web Search with a CUSTOM_JWT gateway"
response = search(
    query="latest AI developments",
    search_provider="agentcore",
    api_key=os.environ["AGENTCORE_GATEWAY_TOKEN"]
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
search_tools:
  - search_tool_name: agentcore-search
    litellm_params:
      search_provider: agentcore
      api_base: https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/agentcore-search \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Web search interception for Bedrock

Because the provider needs no third-party key, it is a natural backend for [web search interception](../completion/web_search), which serves an Anthropic-native `web_search` tool (as used by Claude Code) from a search provider:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/us.anthropic.{{anthropic}}
      aws_region_name: us-east-1

search_tools:
  - search_tool_name: agentcore-search
    litellm_params:
      search_provider: agentcore
      api_base: https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp

litellm_settings:
  callbacks: ["websearch_interception"]
  websearch_interception_params:
    enabled_providers: ["bedrock"]
    search_tool_name: agentcore-search
```

## Unified Parameters

| Unified spec parameter | Mapped to AgentCore parameter |
|---|---|
| `max_results` | `maxResults` |
| `search_domain_filter` | _ignored (no equivalent)_ |
| `country` | _ignored (no equivalent)_ |
| `max_tokens_per_page` | _ignored (no equivalent)_ |

AgentCore caps queries at 200 characters, so longer queries are truncated

## Provider-specific Parameters

| Parameter | Type | Description |
|---|---|---|
| `tool_name` | string | Gateway tool to call. Defaults to `web-search-tool___WebSearch`, matching the target name used in the AWS setup docs. Set this only if your connector target has a different name. Must end in `___WebSearch` |

## Notes

The gateway is billed by AWS directly, so LiteLLM tracks `agentcore/search` at zero cost

The SigV4 signing region comes from the gateway hostname. If you front the gateway with a custom hostname, set `aws_region_name` (or `AWS_REGION`, or a profile region) to the gateway's region

`AGENTCORE_GATEWAY_TOKEN` is only sent when the request targets the gateway configured in `AGENTCORE_GATEWAY_URL`, so a caller-supplied `api_base` cannot exfiltrate it. Credentials also only ride https: a plain `http://` gateway URL is refused unless the host is localhost

LiteLLM sends `MCP-Protocol-Version: 2025-03-26` on every request, the version a gateway with a default `protocolConfiguration` accepts. If your gateway pins `supportedVersions` to something else, set `AGENTCORE_MCP_PROTOCOL_VERSION` to match, e.g. `2025-06-18`
