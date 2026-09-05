import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Custom Code Guardrail

Write custom guardrail logic using Python-like code that runs in a sandboxed environment.

## Quick Start

### 1. Define the guardrail in config

```yaml
model_list:
    - model_name: {{openai_large}}
      litellm_params:
        model: {{openai_large}}
        api_key: os.environ/OPENAI_API_KEY

guardrails:
    - guardrail_name: block-ssn
      litellm_params:
        guardrail: custom_code
        mode: pre_call
        custom_code: |
            def apply_guardrail(inputs, request_data, input_type):
                for text in inputs["texts"]:
                    if regex_match(text, r"\d{3}-\d{2}-\d{4}"):
                        return block("SSN detected")
                return allow()
```

### 2. Start proxy

```bash
litellm --config config.yaml
```

### 3. Test

```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "My SSN is 123-45-6789"}],
    "guardrails": ["block-ssn"]
  }'
```

## Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `guardrail` | string | ✅ | Must be `custom_code` |
| `mode` | string | ✅ | When to run: `pre_call`, `post_call`, `during_call` |
| `custom_code` | string | ✅ | Python-like code with `apply_guardrail` function |
| `default_on` | bool | ❌ | Run on all requests (default: `false`) |

## Writing Custom Code

### Function Signature

Your code must define an `apply_guardrail` function. It can be either sync or async:

```python
# Sync version
def apply_guardrail(inputs, request_data, input_type):
    # inputs: see table below
    # request_data: {"model": "...", "user_id": "...", "team_id": "...", "metadata": {...}}
    # input_type: "request" or "response"
    
    return allow()  # or block(), flag() or modify()

# Async version (recommended when using HTTP primitives)
async def apply_guardrail(inputs, request_data, input_type):
    response = await http_post("https://api.example.com/check", body={"text": inputs["texts"][0]})
    if response["success"] and response["body"].get("flagged"):
        return block("Content flagged")
    return allow()
```

### `inputs` Parameter

| Field | Type | Description |
|-------|------|-------------|
| `texts` | `List[str]` | Extracted text from the request/response |
| `images` | `List[str]` | Extracted images (for image guardrails) |
| `tools` | `List[dict]` | Tools sent to the LLM |
| `tool_calls` | `List[dict]` | Tool calls returned from the LLM |
| `structured_messages` | `List[dict]` | Full messages with role info (system/user/assistant) |
| `model` | `str` | The model being used |

### `request_data` Parameter

| Field | Type | Description |
|-------|------|-------------|
| `model` | `str` | Model name |
| `user_id` | `str` | User ID from API key |
| `team_id` | `str` | Team ID from API key |
| `end_user_id` | `str` | End user ID |
| `metadata` | `dict` | Request metadata |

### Return Values

| Function | Description |
|----------|-------------|
| `allow()` | Let request/response through |
| `block(reason)` | Reject with message |
| `flag(reason, metadata={})` | Let request/response through unchanged, but record a non-blocking violation |
| `modify(texts=[], images=[], tool_calls=[])` | Transform content |

### Flagging without blocking

`flag(reason, metadata={...})` is for audit-only or monitor-mode guardrails. The request or response continues exactly as it would have with `allow()`, and the guardrail records a `guardrail_flagged` entry in the request's guardrail information with the guardrail name, the configured `mode`, the `input_type` it evaluated (`request` or `response`), the `reason`, and your structured `metadata`. It works the same way for streaming and non-streaming requests.

In the Guardrails Monitor a flagged request counts as flagged rather than passed or blocked, and in Request Logs the guardrail row shows `flagged` (when a guardrail runs on both `pre_call` and `post_call`, the row shows the most severe of the two outcomes). The request-level `guardrail_status` becomes `guardrail_flagged` unless another guardrail on the same request blocked or failed, in which case that status wins.

```yaml
guardrails:
  - guardrail_name: audit-competitor-mentions
    litellm_params:
      guardrail: custom_code
      mode: [pre_call, post_call]
      default_on: true
      custom_code: |
        def apply_guardrail(inputs, request_data, input_type):
            for text in inputs["texts"]:
                if contains_any(lower(text), ["acme", "globex"]):
                    return flag(
                        "competitor mentioned",
                        metadata={"category": "competitor", "phase": input_type},
                    )
            return allow()
```

The recorded entry looks like this in `standard_logging_guardrail_information`:

```json
{
  "guardrail_name": "audit-competitor-mentions",
  "guardrail_mode": ["pre_call", "post_call"],
  "guardrail_status": "guardrail_flagged",
  "guardrail_response": {
    "action": "flag",
    "reason": "competitor mentioned",
    "input_type": "request",
    "metadata": {"category": "competitor", "phase": "request"}
  }
}
```

## Built-in Primitives

### Regex

| Function | Description |
|----------|-------------|
| `regex_match(text, pattern)` | Returns `True` if pattern found |
| `regex_replace(text, pattern, replacement)` | Replace all matches |
| `regex_find_all(text, pattern)` | Return list of matches |

### JSON

| Function | Description |
|----------|-------------|
| `json_parse(text)` | Parse JSON string, returns `None` on error |
| `json_stringify(obj)` | Convert to JSON string |
| `json_schema_valid(obj, schema)` | Validate against JSON schema |

### URL

| Function | Description |
|----------|-------------|
| `extract_urls(text)` | Extract all URLs from text |
| `is_valid_url(url)` | Check if URL is valid |
| `all_urls_valid(text)` | Check all URLs in text are valid |

### Code Detection

| Function | Description |
|----------|-------------|
| `detect_code(text)` | Returns `True` if code detected |
| `detect_code_languages(text)` | Returns list of detected languages |
| `contains_code_language(text, ["sql", "python"])` | Check for specific languages |

### Text Utilities

| Function | Description |
|----------|-------------|
| `contains(text, substring)` | Check if substring exists |
| `contains_any(text, [substr1, substr2])` | Check if any substring exists |
| `word_count(text)` | Count words |
| `char_count(text)` | Count characters |
| `lower(text)` / `upper(text)` / `trim(text)` | String transforms |

### HTTP Requests (Async)

Make async HTTP requests to external APIs for additional validation or content moderation.

| Function | Description |
|----------|-------------|
| `await http_request(url, method, headers, body, timeout)` | General async HTTP request |
| `await http_get(url, headers, timeout)` | Async GET request |
| `await http_post(url, body, headers, timeout)` | Async POST request |

**Response format:**
```python
{
    "status_code": 200,        # HTTP status code
    "body": {...},             # Response body (parsed JSON or string)
    "headers": {...},          # Response headers
    "success": True,           # True if status code is 2xx
    "error": None              # Error message if request failed
}
```

**Note:** When using HTTP primitives, define your function as `async def apply_guardrail(...)` for non-blocking execution.

## Examples

### Block PII (SSN)

```python
def apply_guardrail(inputs, request_data, input_type):
    for text in inputs["texts"]:
        if regex_match(text, r"\d{3}-\d{2}-\d{4}"):
            return block("SSN detected")
    return allow()
```

### Redact Email Addresses

```python
def apply_guardrail(inputs, request_data, input_type):
    pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    modified = []
    for text in inputs["texts"]:
        modified.append(regex_replace(text, pattern, "[EMAIL REDACTED]"))
    return modify(texts=modified)
```

### Block SQL Injection

```python
def apply_guardrail(inputs, request_data, input_type):
    if input_type != "request":
        return allow()
    for text in inputs["texts"]:
        if contains_code_language(text, ["sql"]):
            return block("SQL code not allowed")
    return allow()
```

### Validate JSON Response

```python
def apply_guardrail(inputs, request_data, input_type):
    if input_type != "response":
        return allow()
    
    schema = {
        "type": "object",
        "required": ["name", "value"]
    }
    
    for text in inputs["texts"]:
        obj = json_parse(text)
        if obj is None:
            return block("Invalid JSON response")
        if not json_schema_valid(obj, schema):
            return block("Response missing required fields")
    return allow()
```

### Check URLs in Response

```python
def apply_guardrail(inputs, request_data, input_type):
    if input_type != "response":
        return allow()
    for text in inputs["texts"]:
        if not all_urls_valid(text):
            return block("Response contains invalid URLs")
    return allow()
```

### Call External Moderation API (Async)

```python
async def apply_guardrail(inputs, request_data, input_type):
    # Call an external moderation API
    for text in inputs["texts"]:
        response = await http_post(
            "https://api.example.com/moderate",
            body={"text": text, "user_id": request_data["user_id"]},
            headers={"Authorization": "Bearer YOUR_API_KEY"},
            timeout=10
        )
        
        if not response["success"]:
            # API call failed - decide whether to allow or block
            return allow()
        
        if response["body"].get("flagged"):
            return block(response["body"].get("reason", "Content flagged"))
    
    return allow()
```

### Combine Multiple Checks

```python
def apply_guardrail(inputs, request_data, input_type):
    modified = []
    
    for text in inputs["texts"]:
        # Redact SSN
        text = regex_replace(text, r"\d{3}-\d{2}-\d{4}", "[SSN]")
        # Redact credit cards
        text = regex_replace(text, r"\d{16}", "[CARD]")
        modified.append(text)
    
    # Block SQL in requests
    if input_type == "request":
        for text in inputs["texts"]:
            if contains_code_language(text, ["sql"]):
                return block("SQL injection blocked")
    
    return modify(texts=modified)
```

## Sandbox Restrictions

Custom code runs in a restricted environment:

- ❌ No `import` statements
- ❌ No file I/O
- ❌ No `exec()` or `eval()`
- ✅ HTTP requests via built-in `http_request`, `http_get`, `http_post` primitives
- ✅ Only LiteLLM-provided primitives available

## Per-Request Usage

Enable guardrail per request:

```bash
curl -X POST http://localhost:4000/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hello"}],
    "guardrails": ["block-ssn"]
  }'
```

## Default On

Run guardrail on all requests:

```yaml
litellm_settings:
  guardrails:
    - guardrail_name: block-ssn
      litellm_params:
        guardrail: custom_code
        mode: pre_call
        default_on: true
        custom_code: |
          def apply_guardrail(inputs, request_data, input_type):
              ...
```
