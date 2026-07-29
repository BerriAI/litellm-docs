# Web Search on Amazon Bedrock (AgentCore)

Use [Amazon Bedrock AgentCore Web Search](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html) as a search provider. Search runs against an AWS-managed web index — no third-party search API key required; access is controlled with your AWS credentials.

**Prerequisites:** an AgentCore Gateway with a **web-search connector target** ([setup guide](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html))

## Setup

1. Create an AgentCore Gateway in your AWS account (Amazon Bedrock AgentCore console, or CLI/boto3)
2. Add a **web-search** connector target to the gateway
3. Copy the gateway's MCP endpoint URL, e.g. `https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp`
4. Grant the identity running LiteLLM permission to invoke the gateway (IAM), or configure the gateway with a JWT authorizer — see [Authentication](#authentication)

## LiteLLM Python SDK

```python showLineNumbers title="AgentCore Web Search"
import os
from litellm import search

os.environ["AGENTCORE_GATEWAY_URL"] = "https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp"
# Uses the standard AWS credential chain (env / profile / IRSA / instance role)

response = search(
    query="latest AI developments",
    search_provider="agentcore",
    max_results=10
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0
      aws_region_name: us-east-1

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
    "max_results": 10
  }'
```

## Authentication

**AWS_IAM gateways (default):** requests are SigV4-signed. Omit credentials to use the standard AWS credential chain (env vars / shared config profile / IRSA / instance role), or set them explicitly:

```yaml showLineNumbers title="config.yaml — explicit AWS credentials"
search_tools:
  - search_tool_name: agentcore-search
    litellm_params:
      search_provider: agentcore
      api_base: https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
```

**CUSTOM_JWT gateways:** pass an OAuth2 bearer token as `api_key` (or set `AGENTCORE_GATEWAY_TOKEN`) instead — no AWS credentials involved:

```yaml showLineNumbers title="config.yaml — JWT bearer token"
search_tools:
  - search_tool_name: agentcore-search
    litellm_params:
      search_provider: agentcore
      api_base: https://<gateway-id>.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp
      api_key: os.environ/AGENTCORE_GATEWAY_TOKEN
```

Note: tokens issued via OAuth2 `client_credentials` (e.g. Amazon Cognito) expire — typically after 1 hour. Refreshing the token is your responsibility (e.g. a sidecar that rotates the env var / secret).

## Use with Claude Code (web search interception)

Anthropic's native `web_search_20250305` tool is not supported by Amazon Bedrock, so Claude Code pointed at a LiteLLM → Bedrock deployment fails on web search. Combine this provider with [web search interception](https://docs.litellm.ai/docs/integrations/websearch_interception) to serve those searches from AgentCore — no client-side changes needed (see also the [Claude Code web search tutorial](https://docs.litellm.ai/docs/tutorials/claude_code_websearch)):

```yaml showLineNumbers title="config.yaml — Claude Code on Bedrock with AgentCore web search"
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0
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

## Provider-specific Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `api_base` | string | `AGENTCORE_GATEWAY_URL` env | Gateway MCP endpoint URL |
| `api_key` | string | `AGENTCORE_GATEWAY_TOKEN` env | OAuth2 bearer token, for CUSTOM_JWT gateways only |
| `tool_name` | string | `web-search-tool___WebSearch` | MCP tool name exposed by the gateway (see below) |
| `max_results` | int | 10 | Maximum number of results (1–25) |

### Tool name

The gateway exposes the connector as `<target-name>___WebSearch`, where `<target-name>` is the name you chose when creating the target. The default (`web-search-tool___WebSearch`) matches the target name used in the AWS documentation's boto3/CLI examples. If your target has a different name, set `tool_name` (or the `AGENTCORE_SEARCH_TOOL_NAME` env var):

```yaml
      tool_name: MyWebSearchTarget___WebSearch
```

A mismatch surfaces as an MCP "tool not found" error. Tool names are not auto-discovered: a gateway may legitimately expose several `*___WebSearch` targets (e.g. with different domain-filter policies), so picking one automatically would be ambiguous.

### Limits

- Queries longer than **200 characters** are truncated (AgentCore Web Search limit)
- The gateway region is inferred from the endpoint URL; for custom domains, configure the region explicitly via AWS env vars or shared config
