# [BETA] Generic Guardrail API - Integrate Without a PR

## The Problem

As a guardrail provider, integrating with LiteLLM traditionally requires:
- Making a PR to the LiteLLM repository
- Waiting for review and merge
- Maintaining provider-specific code in LiteLLM's codebase
- Updating the integration for changes to your API

## The Solution

The **Generic Guardrail API** lets you integrate with LiteLLM **instantly** by implementing a simple API endpoint. No PR required.

### Key Benefits

1. **No PR Needed** - Deploy and integrate immediately
2. **Universal Support** - Works across ALL LiteLLM endpoints (chat, embeddings, image generation, etc.)
3. **Simple Contract** - One endpoint, three response types
4. **Multi-Modal Support** - Handle both text and images in requests/responses
5. **Custom Parameters** - Pass provider-specific params via config
6. **Full Control** - You own and maintain your guardrail API

## Supported Endpoints

The Generic Guardrail API works with the following LiteLLM endpoints:

- `/v1/chat/completions` - OpenAI Chat Completions
- `/v1/completions` - OpenAI Text Completions
- `/v1/responses` - OpenAI Responses API
- `/v1/images/generations` - OpenAI Image Generation
- `/v1/audio/transcriptions` - OpenAI Audio Transcriptions
- `/v1/audio/speech` - OpenAI Text-to-Speech
- `/v1/messages` - Anthropic Messages
- `/v1/rerank` - Cohere Rerank
- Pass-through endpoints

## How It Works

1. LiteLLM extracts text and images from any request (chat messages, embeddings, image prompts, etc.)
2. Sends extracted content + metadata to your API endpoint
3. Your API responds with: `BLOCKED`, `NONE`, or `GUARDRAIL_INTERVENED`
4. LiteLLM enforces the decision and applies any modifications

## API Contract

### Endpoint

Implement `POST /beta/litellm_basic_guardrail_api`

### Request Format

```json
{
  "texts": ["extracted text from the request"],  // array of text strings
  "images": ["base64_encoded_image_data"],  // optional array of images
  "tools": [  // tool calls sent to the LLM (in the OpenAI Chat Completions spec)
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the current weather",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          }
        }
      }
    }
  ],
  "tool_calls": [  // tool calls received from the LLM (in the OpenAI Chat Completions spec)
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"San Francisco\"}"
      }
    }
  ],
  "structured_messages": [  // optional, full messages in OpenAI format (for chat endpoints)
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello"}
  ],
  "request_data": {
    "user_api_key_hash": "hash of the litellm virtual key used",
    "user_api_key_alias": "alias of the litellm virtual key used",
    "user_api_key_user_id": "user id associated with the litellm virtual key used",
    "user_api_key_user_email": "user email associated with the litellm virtual key used",
    "user_api_key_team_id": "team id associated with the litellm virtual key used",
    "user_api_key_team_alias": "team alias associated with the litellm virtual key used",
    "user_api_key_end_user_id": "end user id associated with the litellm virtual key used",
    "user_api_key_org_id": "org id associated with the litellm virtual key used"
  },
  "request_headers": {  // optional: inbound request headers (allowlist). Allowed headers show their value; all others show "[present]" to indicate the header existed.
    "User-Agent": "OpenAI/Python 2.17.0",
    "Content-Type": "application/json",
    "X-Request-Id": "[present]"
  },
  "litellm_version": "1.x.y",  // optional: LiteLLM library version running this proxy
  "input_type": "request",  // "request" or "response"
  "litellm_call_id": "unique_call_id",  // the call id of the individual LLM call
  "litellm_trace_id": "trace_id",  // the trace id of the LLM call - useful if there are multiple LLM calls for the same conversation
  "additional_provider_specific_params": {
    // your custom params from config
  }
}
```

With `send_images: false` or `exclude_payload_fields` set, the withheld fields are absent from this payload. See [Controlling what is sent to the guardrail](#controlling-what-is-sent-to-the-guardrail).

### Response Format

```json nolint
{
  "action": "BLOCKED" | "NONE" | "GUARDRAIL_INTERVENED",
  "blocked_reason": "why content was blocked",  // required if action=BLOCKED
  "texts": ["modified text"],  // optional array of modified text strings
  "images": ["modified_base64_image"],  // optional array of modified images
  "structured_messages": [{"role": "user", "content": "modified message"}]  // optional array of rewritten chat messages
}
```

**Actions:**
- `BLOCKED` - LiteLLM raises error and blocks request
- `NONE` - Request proceeds unchanged  
- `GUARDRAIL_INTERVENED` - Request proceeds with modified texts/images (provide `texts` and/or `images` fields)

**Rewriting per message:** `texts` must line up one to one with the `texts` array LiteLLM sent. When your endpoint rewrites the request per chat message instead, return the rewritten rows as `structured_messages` (see [Returning rewritten messages](#returning-rewritten-messages)). On `/v1/responses` a `texts` array that counts one entry per message does not match what LiteLLM extracted, so the request is rejected with a 500 naming the guardrail rather than sent unrewritten

## Parameters

### `tools` Parameter

The `tools` parameter provides information about available function/tool definitions in the request.

**Format:** OpenAI `ChatCompletionToolParam` format (see [OpenAI API reference](https://platform.openai.com/docs/api-reference/chat/create#chat-create-tools))

Built-in tools that carry only a `type` and no `function` block, such as `{"type": "code_interpreter"}` or `{"type": "file_search", "vector_store_ids": [...]}`, are also accepted and forwarded to your endpoint intact (including their tool-specific config). Your endpoint should treat `function` as optional and branch on `type`.

**Example:**
```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get the current weather in a location",
    "parameters": {
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "City and state, e.g. San Francisco, CA"
        },
        "unit": {
          "type": "string",
          "enum": ["celsius", "fahrenheit"]
        }
      },
      "required": ["location"]
    }
  }
}
```

**Availability:**
- **Input only:** Tools are only passed for `input_type="request"` (pre-call guardrails). Output/response guardrails do not currently receive tool definitions.
- **Supported endpoints:** The `tools` parameter is supported on: `/v1/chat/completions`, `/v1/responses`, and `/v1/messages`. Other endpoints do not have tool support.

**Use cases:**
- Enforce tool permission policies (e.g., only allow certain users/teams to access specific tools)
- Validate tool schemas before sending to LLM
- Log tool usage for audit purposes
- Block sensitive tools based on user context

### `tool_calls` Parameter

The `tool_calls` parameter contains actual function/tool invocations being made in the request or response.

**Format:** OpenAI `ChatCompletionMessageToolCall` format (see [OpenAI API reference](https://platform.openai.com/docs/api-reference/chat/object#chat/object-tool_calls))

**Example:**
```json
{
  "id": "call_abc123",
  "type": "function",
  "function": {
    "name": "get_weather",
    "arguments": "{\"location\": \"San Francisco\", \"unit\": \"celsius\"}"
  }
}
```

**Key Difference from `tools`:**
- **`tools`** = Tool definitions/schemas (what tools are *available*)
- **`tool_calls`** = Tool invocations/executions (what tools are *being called* with what arguments)

**Availability:**
- **Both input and output:** Tool calls can be present in both `input_type="request"` (assistant messages requesting tool calls) and `input_type="response"` (LLM responses with tool calls).
- **Supported endpoints:** The `tool_calls` parameter is supported on: `/v1/chat/completions`, `/v1/responses`, and `/v1/messages`.

**Use cases:**
- Validate tool call arguments before execution
- Redact sensitive data from tool call arguments (e.g., PII)
- Log tool invocations for audit/debugging
- Block tool calls with dangerous parameters
- Modify tool call arguments (e.g., enforce constraints, sanitize inputs)
- Monitor tool usage patterns across users/teams

### `structured_messages` Parameter

The `structured_messages` parameter provides the full input in OpenAI chat completion spec format, useful for distinguishing between system and user messages.

**Format:** Array of OpenAI chat completion messages (see [OpenAI API reference](https://platform.openai.com/docs/api-reference/chat/create#chat-create-messages))

**Example:**
```json
[
  {"role": "system", "content": "You are a helpful assistant"},
  {"role": "user", "content": "Hello"}
]
```

**Availability:**
- **Supported endpoints:** `/v1/chat/completions`, `/v1/messages`, `/v1/responses`
- **Input only:** Only passed for `input_type="request"` (pre-call guardrails)

**Use cases:**
- Apply different policies for system vs user messages
- Enforce role-based content restrictions
- Log structured conversation context

#### Returning rewritten messages

To rewrite the request per message, return `structured_messages` in the response with one row per row you received, in the same order, keeping each row's `role` and shape and changing only the content you want rewritten. LiteLLM writes the rows back onto the original request on every supported endpoint, including `/v1/responses` turns that carry `instructions` or tool items, where a per-message `texts` array cannot be placed. A row you return exactly as you received it counts as unchanged, so you can echo the rows you did not touch; when every row comes back unchanged, LiteLLM applies `texts` instead. A returned array whose length differs from the one you received replaces the conversation as a whole

**Example:**
```json
{
  "action": "GUARDRAIL_INTERVENED",
  "structured_messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "My SSN is <US_SSN>"}
  ]
}
```

## LiteLLM Configuration

Add to `config.yaml`:

```yaml
litellm_settings:
  guardrails:
    - guardrail_name: "my-guardrail"
      litellm_params:
        guardrail: generic_guardrail_api
        mode: pre_call  # or post_call, during_call
        api_base: https://your-guardrail-api.com
        api_key: os.environ/YOUR_GUARDRAIL_API_KEY  # optional
        unreachable_fallback: fail_closed  # default: fail_closed. Set to fail_open to proceed if the guardrail endpoint is unreachable (network errors, or HTTP 502/503/504 from an upstream proxy/LB).
        fail_on_error: true  # default: true (fail closed). Set to false to proceed on ANY guardrail error. See "Error handling" below before changing this.
        send_images: true  # default: true. Set to false to keep image data away from the guardrail. See "Controlling what is sent to the guardrail" below.
        exclude_payload_fields: ["request_headers"]  # optional. Request fields left out of the payload sent to the guardrail.
        max_messages: 20  # optional. Only the last 20 messages are sent. See "Shrinking what a block-only guardrail scans" below.
        max_text_chars: 4000  # optional. Every text is cut to this many characters before it is sent.
        strip_patterns: ["<ts>\\d+</ts>"]  # optional. Regex matches removed from every text before it is sent.
        additional_provider_specific_params:
          # your custom parameters
          threshold: 0.8
          language: "en"
```

### Error handling: `unreachable_fallback` and `fail_on_error`

Two settings control what LiteLLM does when the guardrail itself fails, rather than returning a verdict. They sit on a spectrum from strict to permissive, and they compose:

- `unreachable_fallback` (default `fail_closed`) only reacts to the guardrail endpoint being **unreachable**: network errors, timeouts, or an HTTP 502/503/504 from an upstream proxy/load balancer. Set it to `fail_open` to let requests proceed in just those cases.
- `fail_on_error` (default `true`) is the broader control. It governs **any** guardrail error, not only unreachability.

| `fail_on_error` | Behavior on a guardrail error |
| --- | --- |
| `true` (default) | **Fail closed.** Any error blocks the request: a non-2xx response, a malformed or unparseable body, a network failure, or an internal serialization/validation error. This preserves LiteLLM's existing behavior |
| `false` | **Fail open (complete).** Any guardrail error is downgraded to a critical-level log line and the request proceeds as if the guardrail were not configured |

Only a valid guardrail response can act. With `fail_on_error: false`, a parsed `BLOCKED` decision still blocks; everything that is not a valid response (errors, malformed bodies, unreachable endpoints) is bypassed. This applies to both the request hook (`pre_call`) and the response hook (`post_call`); on the response path, a fail-open returns the already-generated model output, while fail-closed turns a successful generation into an error.

:::danger

`fail_on_error: false` is a complete bypass on failure. It means that **any** failure in the guardrail or its endpoint, for any reason, will cause the guardrail to be skipped for that request rather than block it. Enable it only if you have understood and accepted that tradeoff: choose it when your availability and operational constraints are stronger than your security constraints. If the guardrail is a hard security boundary, leave it at the default `true` (fail closed).

:::

The default is fail closed precisely because a guardrail is usually a security control. Every fail-open bypass is logged at critical level (`Generic Guardrail API error (fail-open) ...`) with the call id and trace id, so you can alert on it and audit how often it happens.

### Controlling what is sent to the guardrail

Two options shrink the payload LiteLLM posts to your endpoint:

- `send_images: false` drops the top-level `images` field and replaces the URL of every `image_url` part in `structured_messages` with `[omitted]`, so each part keeps its place. That covers inline data URLs and remote URLs alike, and on `/v1/messages` Anthropic documents (PDFs) too, since LiteLLM turns them into image parts.
- `exclude_payload_fields` lists request fields to leave out, such as `request_headers`, `tools` or `structured_messages`. `input_type` and `litellm_call_id` are always sent, because your endpoint needs them to read the payload. An unknown field name is ignored with a warning.

:::warning

Content LiteLLM does not send is never scanned. With `send_images: false` your guardrail cannot see text written inside an image, and an excluded field is not checked at all. Use these options only for content your guardrail does not need to inspect.

:::

Your endpoint can only rewrite what it was sent. A rewrite to a field LiteLLM did not send is ignored with a warning, and when the only real change in a `GUARDRAIL_INTERVENED` answer goes to such a field, the call is rejected rather than sent without the rewrite. Returned `images` are never written back to the request. In `structured_messages`, a part you return still holding `[omitted]` gets the caller's original image back, while a row that gains an `[omitted]` placeholder it was not sent with is rejected.

`exclude_payload_fields` is set in `config.yaml` or through the guardrails API, and the Admin UI form does not show it. An invalid value for either option, such as `send_images: "maybe"` or a single string instead of a list, is ignored with a warning and the default is kept.

### Shrinking what a block-only guardrail scans

Three options cut down the text LiteLLM sends, for guardrails that only block or only observe. Each one keeps part of the conversation away from your endpoint:

- `max_messages` sends only the last N `structured_messages` and rebuilds `texts` from the text of those messages. Text an endpoint sends from outside message content, such as `/v1/responses` `input_file` text, is not sent even for the turns that are kept. Calls without `structured_messages`, such as embeddings, rerank or an LLM response, are not affected.
- `max_text_chars` cuts every text in `texts` and in `structured_messages` content to N characters. It applies to LLM responses too.
- `strip_patterns` removes regex matches from every text, for volatile boilerplate your guardrail does not need. Roles, ids, tool calls, tools and metadata are never touched. Each pattern removes at most 64 matches per text. Per guardrail call, only the first 100,000 characters of distinct text are stripped and stripping stops after 0.1 seconds, and a text past either limit is sent unstripped in full with a warning.

:::warning

Text LiteLLM does not send is never scanned. A caller can put content past the first `max_text_chars` characters, in a turn that falls out of the `max_messages` window, or inside something a `strip_patterns` entry matches, and your guardrail will not see it. On the response side, model output past the first `max_text_chars` characters is not scanned either. Use these options only when that is acceptable for your guardrail.

:::

Because your endpoint sees only part of the content, it cannot rewrite it. When any of these options changed what was sent, a `BLOCKED` answer still blocks and an echo of what was sent passes the caller's content through unchanged, but any other returned change fails the call. A failed request or response is rejected with an error naming the request or the response, and a failed stream is cut off after the chunks already sent.

Stripping runs on the proxy worker's event loop, so a slow pattern holds up that worker for up to 0.1 seconds per guardrail call. Keep patterns linear-time: avoid nested quantifiers such as `(a+)+` and lazy matches up to a closing delimiter such as `<!--.*?-->`. Also avoid large counted repeats such as `a{100000}`: the regex engine expands them in memory when the guardrail loads, so a short pattern can take gigabytes at startup. Use `+` or a range such as `{1,n}` instead, which are not expanded.

`strip_patterns` is set in `config.yaml` or through the guardrails API, and the Admin UI form does not show it. `max_messages` and `max_text_chars` appear in the form as number fields. An invalid value, such as `max_messages: 0`, `max_text_chars: 10.5` or a pattern that is not a valid regex, is ignored with a warning and the default is kept. The other patterns still apply.

### Static and dynamic headers

You can send two kinds of headers to your guardrail endpoint:

- **Static headers** (`headers`): A key/value map sent with **every** request to your guardrail. Use this for fixed values (e.g. API keys, `X-Service-Name`). Configure in `litellm_params`:

  ```yaml
  litellm_params:
    guardrail: generic_guardrail_api
    api_base: https://your-guardrail-api.com
    headers:
      X-Service-Name: "my-app"
      X-API-Key: "secret"
  ```

- **Dynamic headers** (`extra_headers`): A list of **header names** that are forwarded from the **client request** to your guardrail. Only headers in this list (plus a small default allowlist such as `x-litellm-*`) have their values sent; others are sent as `[present]`. Use this to pass through client-provided headers (e.g. `x-request-id`, `x-correlation-id`). Configure in `litellm_params`:

  ```yaml
  litellm_params:
    guardrail: generic_guardrail_api
    api_base: https://your-guardrail-api.com
    extra_headers:
      - x-request-id
      - x-correlation-id
      - x-custom-auth
  ```

This mirrors the [MCP static and extra headers](/docs/mcp#forwarding-custom-headers-to-mcp-servers) behavior.

### Example: Pillar Security

[Pillar Security](https://pillar.security) uses the Generic Guardrail API to provide AI security scanning, including prompt injection protection, PII/PCI detection, secret detection, and content moderation.

```yaml
guardrails:
  - guardrail_name: "pillar-security"
    litellm_params:
      guardrail: generic_guardrail_api
      mode: [pre_call, post_call]
      api_base: https://api.pillar.security/api/v1/integrations/litellm
      api_key: os.environ/PILLAR_API_KEY
      default_on: true
      additional_provider_specific_params:
        plr_mask: true      # Enable automatic masking of sensitive data
        plr_evidence: true  # Include detection evidence in response
        plr_scanners: true  # Include scanner details in response
```

See the [Pillar Security documentation](../proxy/guardrails/pillar_security.md) for full configuration options.

## Usage

Users apply your guardrail by name:

```python
response = client.chat.completions.create(
    model="{{openai_large}}",
    messages=[{"role": "user", "content": "hello"}],
    guardrails=["my-guardrail"]
)
```

Or with dynamic parameters:

```python
response = client.chat.completions.create(
    model="{{openai_large}}",
    messages=[{"role": "user", "content": "hello"}],
    guardrails=[{
        "my-guardrail": {
            "extra_body": {
                "custom_threshold": 0.9
            }
        }
    }]
)
```

## Implementation Example

See [mock_bedrock_guardrail_server.py](https://github.com/BerriAI/litellm/blob/main/cookbook/mock_guardrail_server/mock_bedrock_guardrail_server.py) for a complete reference implementation.

**Minimal FastAPI example:**

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

app = FastAPI()

class GuardrailRequest(BaseModel):
    texts: List[str]
    images: Optional[List[str]] = None
    tools: Optional[List[Dict[str, Any]]] = None  # OpenAI ChatCompletionToolParam format (tool definitions)
    tool_calls: Optional[List[Dict[str, Any]]] = None  # OpenAI ChatCompletionMessageToolCall format (tool invocations)
    structured_messages: Optional[List[Dict[str, Any]]] = None  # OpenAI messages format (for chat endpoints)
    request_data: Dict[str, Any]
    input_type: str  # "request" or "response"
    litellm_call_id: Optional[str] = None
    litellm_trace_id: Optional[str] = None
    additional_provider_specific_params: Dict[str, Any]

class GuardrailResponse(BaseModel):
    action: str  # BLOCKED, NONE, or GUARDRAIL_INTERVENED
    blocked_reason: Optional[str] = None
    texts: Optional[List[str]] = None
    images: Optional[List[str]] = None
    structured_messages: Optional[List[Dict[str, Any]]] = None  # rewritten OpenAI messages, one per row received

@app.post("/beta/litellm_basic_guardrail_api")
async def apply_guardrail(request: GuardrailRequest):
    # Your guardrail logic here
    
    # Example: Check text content
    for text in request.texts:
        if "badword" in text.lower():
            return GuardrailResponse(
                action="BLOCKED",
                blocked_reason="Content contains prohibited terms"
            )
    
    # Example: Check tool definitions (if present in request)
    if request.tools:
        for tool in request.tools:
            if tool.get("type") == "function":
                function_name = tool.get("function", {}).get("name", "")
                # Block sensitive tool definitions
                if function_name in ["delete_data", "access_admin_panel"]:
                    return GuardrailResponse(
                        action="BLOCKED",
                        blocked_reason=f"Tool '{function_name}' is not allowed"
                    )
    
    # Example: Check tool calls (if present in request or response)
    if request.tool_calls:
        for tool_call in request.tool_calls:
            if tool_call.get("type") == "function":
                function_name = tool_call.get("function", {}).get("name", "")
                arguments_str = tool_call.get("function", {}).get("arguments", "{}")
                
                # Parse arguments and validate
                import json
                try:
                    arguments = json.loads(arguments_str)
                    # Block dangerous arguments
                    if "file_path" in arguments and ".." in str(arguments["file_path"]):
                        return GuardrailResponse(
                            action="BLOCKED",
                            blocked_reason="Tool call contains path traversal attempt"
                        )
                except json.JSONDecodeError:
                    pass
    
    # Example: Check structured messages (if present in request)
    if request.structured_messages:
        for message in request.structured_messages:
            if message.get("role") == "system":
                # Apply stricter policies to system messages
                if "admin" in message.get("content", "").lower():
                    return GuardrailResponse(
                        action="BLOCKED",
                        blocked_reason="System message contains restricted terms"
                    )
    
    return GuardrailResponse(action="NONE")
```

## When to Use This

✅ **Use Generic Guardrail API when:**
- You want instant integration without waiting for PRs
- You maintain your own guardrail service
- You need full control over updates and features
- You want to support all LiteLLM endpoints automatically

❌ **Make a PR when:**
- You want deeper integration with LiteLLM internals
- Your guardrail requires complex LiteLLM-specific logic
- You want to be featured as a built-in provider

## Questions?

This is a **beta API**. We're actively improving it based on feedback. Open an issue or PR if you need additional capabilities.

