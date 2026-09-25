import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# MCP Guardrails

LiteLLM supports applying guardrails to MCP tool calls to ensure security and compliance. You can configure guardrails to run before, during, or after MCP calls to validate tool inputs and tool results and block or mask sensitive information.

### Supported MCP Guardrail Modes

MCP guardrails support the following modes:

- `pre_mcp_call`: Run **before** MCP call, on **input**. Use this mode when you want to apply validation/masking/blocking for MCP requests
- `during_mcp_call`: Run **during** MCP call execution. Use this mode for real-time monitoring and intervention
- `post_mcp_call`: Run **after** the MCP server returns, on the **tool result**, before the model sees it. Use this mode to block or mask PII, prompt injections, or other unsafe content coming back from a tool

### Configuration Examples

Configure guardrails to run before MCP tool calls to validate and sanitize inputs:

```yaml title="config.yaml" showLineNumbers
guardrails:
  - guardrail_name: "mcp-input-validation"
    litellm_params:
      guardrail: presidio  # or other supported guardrails
      mode: "pre_mcp_call" # or during_mcp_call
      pii_entities_config:
        CREDIT_CARD: "BLOCK"  # Will block requests containing credit card numbers
        EMAIL_ADDRESS: "MASK"  # Will mask email addresses
        PHONE_NUMBER: "MASK"   # Will mask phone numbers
      default_on: true
```

#### Scanning MCP tool results

A `post_mcp_call` guardrail receives the `CallToolResult` the MCP server returned. Every text content block and every string value inside `structuredContent` is scanned as response-side output. A block verdict rejects the tool call; a mask verdict rewrites the matching text in place. A masking hit on a `structuredContent` key or a non-string value cannot be rewritten and is treated as a block. This runs for tool calls on the MCP gateway (`/mcp`) and for MCP tools the Responses API executes on the model's behalf.

MCP sub-calls do not inherit the parent request's `guardrails` selection, so set `default_on: true` on the guardrail.

```yaml title="config.yaml" showLineNumbers
guardrails:
  - guardrail_name: "mcp-output-scan"
    litellm_params:
      guardrail: panw_prisma_airs  # or presidio, or any guardrail that implements apply_guardrail
      mode: "post_mcp_call"
      api_key: os.environ/PANW_PRISMA_AIRS_API_KEY
      profile_name: os.environ/PANW_PRISMA_AIRS_PROFILE_NAME
      mask_response_content: true
      default_on: true
```

Custom guardrails get this for free: implement `apply_guardrail` on your `CustomGuardrail` subclass and LiteLLM calls it with `input_type="response"` and the tool result's text values. If you override `get_supported_event_hooks`, include `post_mcp_call` in the list or the proxy rejects `mode: post_mcp_call` at startup.

### Usage Examples

#### Testing Pre-MCP Call Guardrails

Test your MCP guardrails with a request that includes sensitive information:

```bash title="Test MCP Guardrail" showLineNumbers
curl http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "{{openai_small}}",
    "messages": [
      {"role": "user", "content": "My credit card is 4111-1111-1111-1111 and my email is john@example.com"}
    ],
    "guardrails": ["mcp-input-validation"]
  }'
```

The request will be processed as follows:
1. Credit card number will be blocked (request rejected)
2. Email address will be masked (e.g., replaced with `<EMAIL_ADDRESS>`)

#### Using with MCP Tools

When using MCP tools, guardrails will be applied to the tool inputs:

```python title="Python Example with MCP Guardrails" showLineNumbers
import openai

client = openai.OpenAI(
    api_key="your-api-key",
    base_url="http://localhost:4000"
)

# This request will trigger MCP guardrails
response = client.chat.completions.create(
    model="{{openai_small}}",
    messages=[
        {"role": "user", "content": "Send an email to 555-123-4567 with my SSN 123-45-6789"}
    ],
    tools=[{"type": "mcp", "server_label": "litellm", "server_url": "litellm_proxy"}],
    extra_body={"guardrails": ["mcp-input-validation"]},
)
```

### Supported Guardrail Providers

MCP guardrails work with all LiteLLM-supported guardrail providers:

- **Presidio**: PII detection and masking
- **Bedrock**: AWS Bedrock guardrails
- **Lakera**: Content moderation
- **Aporia**: Custom guardrails
- **Noma**: Noma Security
- **PANW Prisma AIRS**: Prisma AIRS guardrails
- **Custom**: Your own guardrail implementations