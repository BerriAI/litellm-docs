import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Sandbox / Code Execution

Run model-generated code inside an isolated sandbox and get its output back. The API is provider-agnostic; e2b and opensandbox are supported backends, talked to directly over HTTPS with no extra SDK dependency.

| Feature | Supported |
|---------|-----------|
| Supported Providers | `e2b`, `opensandbox` |
| Cost Tracking | Passthrough (sandbox billing stays with the provider) |
| Logging | Via the standard `@client` logging path used by `litellm.asearch` |
| Proxy Endpoint | Via the code interpreter interceptor on `/v1/responses` and `/v1/chat/completions` (see below); no standalone `/v1/sandbox` yet |

:::tip

`code` is an executable string. There is no language knob and no invented result schema; the [`CodeExecutionResult`](#response-codeexecutionresult) is a passthrough of the sandbox's own output (stdout, stderr, results such as base64 charts, error name/value/traceback, execution count).

:::

## Code interpreter interceptor

Route OpenAI's `code_interpreter` tool to your sandbox instead of OpenAI's container. Works on both `/v1/responses` and `/v1/chat/completions`; client requests stay plain OpenAI shape. On the chat path the native `{"type": "code_interpreter"}` tool is rewritten into a `litellm_code_execution` function tool, LiteLLM runs the generated code in your sandbox, appends the result as a `role: tool` message, and continues the loop until a final answer.

### SDK

Register the sandbox tool, install the interceptor as a callback, call `litellm.aresponses` (or `litellm.acompletion`) with the `code_interpreter` tool unchanged.

<Tabs>
<TabItem value="responses" label="Responses API">

```python showLineNumbers title="sandbox_interceptor.py"
import os, litellm
from litellm.sandbox.sandbox_tools import register_sandbox_tools
from litellm.integrations.code_interpreter_interception.handler import (
    CodeInterpreterInterceptionLogger,
)

os.environ["E2B_API_KEY"] = "e2b_..."
os.environ["OPENAI_API_KEY"] = "sk-..."

register_sandbox_tools([
    {
        "sandbox_tool_name": "my-e2b",
        "litellm_params": {
            "sandbox_provider": "e2b",
            "api_key": "os.environ/E2B_API_KEY",
        },
    }
])

litellm.callbacks = [
    CodeInterpreterInterceptionLogger(
        sandbox_tool_name="my-e2b",
    )
]

response = await litellm.aresponses(
    model="openai/gpt-5",
    tools=[{"type": "code_interpreter", "container": {"type": "auto"}}],
    input="Product of first 6 primes. Just the number.",
)
print(response.output_text)
```

</TabItem>
<TabItem value="chat" label="Chat Completions">

```python showLineNumbers title="sandbox_interceptor_chat.py"
import os, litellm
from litellm.sandbox.sandbox_tools import register_sandbox_tools
from litellm.integrations.code_interpreter_interception.handler import (
    CodeInterpreterInterceptionLogger,
)

os.environ["E2B_API_KEY"] = "e2b_..."
os.environ["OPENAI_API_KEY"] = "sk-..."

register_sandbox_tools([
    {
        "sandbox_tool_name": "my-e2b",
        "litellm_params": {
            "sandbox_provider": "e2b",
            "api_key": "os.environ/E2B_API_KEY",
        },
    }
])

litellm.callbacks = [
    CodeInterpreterInterceptionLogger(
        sandbox_tool_name="my-e2b",
    )
]

response = await litellm.acompletion(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Product of first 6 primes. Just the number."}],
    tools=[{"type": "code_interpreter", "container": {"type": "auto"}}],
    max_agentic_loops=4,
)
print(response.choices[0].message.content)
```

`max_agentic_loops` caps how many sandbox round-trips LiteLLM will run before returning whatever the model has produced; the loop also short-circuits on repeated tool-call fingerprints. Defaults are conservative, raise it if your task needs deeper chained execution.

</TabItem>
</Tabs>

### Proxy setup

#### 1. Set keys

```bash
export E2B_API_KEY="e2b_..."
export OPENAI_API_KEY="sk-..."
```

#### 2. Write `config.yaml`

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-5
    litellm_params:
      model: openai/gpt-5
      api_key: os.environ/OPENAI_API_KEY

sandbox_tools:
  - sandbox_tool_name: my-e2b
    litellm_params:
      sandbox_provider: e2b
      api_key: os.environ/E2B_API_KEY

litellm_settings:
  callbacks: ["code_interpreter_interception"]
  code_interpreter_interception_params:
    sandbox_tool_name: my-e2b
```

#### 3. Start the proxy

```bash
litellm --config /path/to/config.yaml
```

#### 4. Call the proxy

<Tabs>
<TabItem value="responses-curl" label="Responses (curl)">

```bash
curl -s "http://localhost:4000/v1/responses" \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "tools": [{"type": "code_interpreter", "container": {"type": "auto"}}],
    "input": "Product of first 6 primes. Just the number."
  }'
```

</TabItem>
<TabItem value="responses-openai" label="Responses (OpenAI SDK)">

```python
from openai import OpenAI

client = OpenAI(api_key="sk-1234", base_url="http://localhost:4000/v1")

response = client.responses.create(
    model="gpt-5",
    tools=[{"type": "code_interpreter", "container": {"type": "auto"}}],
    input="Product of first 6 primes. Just the number.",
)
print(response.output_text)
```

</TabItem>
<TabItem value="chat-curl" label="Chat Completions (curl)">

```bash
curl -s "http://localhost:4000/v1/chat/completions" \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Product of first 6 primes. Just the number."}
    ],
    "tools": [{"type": "code_interpreter", "container": {"type": "auto"}}]
  }'
```

</TabItem>
<TabItem value="chat-openai" label="Chat Completions (OpenAI SDK)">

```python
from openai import OpenAI

client = OpenAI(api_key="sk-1234", base_url="http://localhost:4000/v1")

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Product of first 6 primes. Just the number."}],
    tools=[{"type": "code_interpreter", "container": {"type": "auto"}}],
)
print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

On the Responses path the result contains a `code_interpreter_call` item with a `cntr_*` `container_id` wrapping the sandbox id. On the Chat Completions path the tool call shows up as a `litellm_code_execution` function call with the executed code, followed by a `role: tool` message holding the stdout; the model's final answer arrives in the next assistant message.

To run against OpenSandbox instead of e2b, swap the `sandbox_tools` entry:

```yaml
sandbox_tools:
  - sandbox_tool_name: my-opensandbox
    litellm_params:
      sandbox_provider: opensandbox
      api_base: os.environ/OPEN_SANDBOX_API_BASE
      api_key: os.environ/OPEN_SANDBOX_API_KEY
```

### Sticky sessions

By default each request spins up a fresh sandbox that gets deleted when the agentic loop ends. Pass `metadata.session_id` to reuse the same sandbox across sequential requests so variables, imports, and files defined in one turn stay live for the next.

<Tabs>
<TabItem value="sticky-curl" label="curl">

```bash
# First request: define x
curl -s "http://localhost:4000/v1/responses" \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "tools": [{"type": "code_interpreter", "container": {"type": "auto"}}],
    "input": "Set x = 42 and confirm.",
    "metadata": {"session_id": "chat-abc-123"}
  }'

# Second request: same session_id, x is still there
curl -s "http://localhost:4000/v1/responses" \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "tools": [{"type": "code_interpreter", "container": {"type": "auto"}}],
    "input": "Print x + 1.",
    "metadata": {"session_id": "chat-abc-123"}
  }'
```

</TabItem>
<TabItem value="sticky-openai" label="OpenAI SDK">

```python
from openai import OpenAI

client = OpenAI(api_key="sk-1234", base_url="http://localhost:4000/v1")

client.responses.create(
    model="gpt-5",
    tools=[{"type": "code_interpreter", "container": {"type": "auto"}}],
    input="Set x = 42 and confirm.",
    extra_body={"metadata": {"session_id": "chat-abc-123"}},
)

# Same session_id reuses the same e2b container, so x is still defined
followup = client.responses.create(
    model="gpt-5",
    tools=[{"type": "code_interpreter", "container": {"type": "auto"}}],
    input="Print x + 1.",
    extra_body={"metadata": {"session_id": "chat-abc-123"}},
)
print(followup.output_text)
```

</TabItem>
</Tabs>

Cross-tenant isolation is enforced by combining the client-supplied `session_id` with the proxy-minted `user_api_key_hash` to form the cache key (`{hash}:{session_id}`), so two API keys sending the same `session_id` never share a sandbox. Each API key is capped at 10 live session-scoped sandboxes; when a new session would exceed the cap, the least-recently-used session for that key is evicted and its sandbox deleted. Active sessions do not expire mid-conversation because the TTL resets on every access. Omitting `session_id` keeps the original ephemeral per-request behavior.

### Notes

Response shape matches OpenAI's native `code_interpreter_call`. `stream: true` works. Forced `tool_choice: {"type":"code_interpreter"}` is rewritten automatically. Sandboxes are ephemeral per request by default, or sticky when `metadata.session_id` is set (see above); concurrent requests are isolated by a server-minted cache key. Removing a tool from `sandbox_tools` clears its credentials on reload. v0 does not support file upload or download yet.

## Direct sandbox SDK

If you want to drive the sandbox yourself, without a model in the loop, the same providers are exposed as plain Python helpers.

### Quick start (ephemeral)

The fastest path is `acode_interpreter_tool`. It creates a sandbox, runs the code, then deletes the sandbox in a `finally` block so a raised exception still cleans up.

```python showLineNumbers title="Ephemeral code execution"
import asyncio, os, litellm

os.environ["E2B_API_KEY"] = "e2b_..."

async def main():
    result = await litellm.acode_interpreter_tool(
        provider="e2b",
        code="print(sum(range(10)))",
    )
    print(result.stdout)   # '45\n'
    print(result.error)    # None

asyncio.run(main())
```

If the code raises inside the sandbox, the error surfaces in `result.error` rather than as a Python exception, so a sandbox-level `ZeroDivisionError` does not crash the caller:

```python
result = await litellm.acode_interpreter_tool(provider="e2b", code="1/0")
result.error["name"]       # 'ZeroDivisionError'
result.error["value"]      # 'division by zero'
result.error["traceback"]  # full traceback string
```

### Low-level lifecycle

When you want to reuse a sandbox across multiple `arun_code` calls, drive the lifecycle yourself with `acreate_sandbox`, `arun_code`, and `adelete_sandbox`. The low-level names are sandbox-scoped on purpose so they do not collide with the existing OpenAI Containers API (`litellm.create_container`), which is unrelated and stays untouched.

```python showLineNumbers title="Manual sandbox lifecycle"
import asyncio, os, litellm

os.environ["E2B_API_KEY"] = "e2b_..."

async def main():
    container = await litellm.acreate_sandbox(provider="e2b")
    try:
        first = await litellm.arun_code(
            provider="e2b", container=container, code="x = 6 * 7\nprint(x)",
        )
        print(first.stdout)   # '42\n'

        second = await litellm.arun_code(
            provider="e2b", container=container, code="print(x + 1)",
        )
        print(second.stdout)  # '43\n' (state persists inside the container)
    finally:
        await litellm.adelete_sandbox(provider="e2b", container=container)

asyncio.run(main())
```

`arun_code` and `adelete_sandbox` accept either the `ContainerHandle` returned by `acreate_sandbox` or a bare sandbox id string, so you can persist the id between processes and pick the sandbox back up later.

## Parameters

### `acode_interpreter_tool`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `provider` | string | Yes | Sandbox provider slug. One of `"e2b"`, `"opensandbox"`. |
| `code` | string | Yes | Executable string passed straight to the sandbox. |
| `template` | string | No | Provider template id. Defaults to e2b's `code-interpreter-v1`. |
| `timeout` | int | No | Sandbox lifetime in seconds. Defaults to 300. |
| `api_key` | string | No | Overrides the env var lookup. |
| `api_base` | string | No | Overrides the provider's default host. Use this to point a self-hosted sandbox at a cluster URL. |

### `acreate_sandbox`

Same shape as above without `code`, plus `allow_internet_access: bool = True` for backends that gate egress.

### `arun_code` and `adelete_sandbox`

`provider`, `container` (a `ContainerHandle` or sandbox id string), and optional `api_key` / `api_base`. `arun_code` also takes `code`.

## Response: `CodeExecutionResult`

The return shape is a thin pydantic model that preserves whatever the sandbox emitted.

| Field | Type | Description |
|-------|------|-------------|
| `stdout` | string | Captured stdout. Empty string if nothing was printed. |
| `stderr` | string | Captured stderr. |
| `results` | list[dict] | Rich outputs such as base64 PNG charts; passed through unchanged. |
| `error` | dict \| None | `{name, value, traceback}` when the sandboxed code raised, else `None`. |
| `execution_count` | int \| None | Jupyter-style cell counter for the run. |
| `object` | string | Always `"code_execution"`. |

## Provider setup

### e2b

Set `E2B_API_KEY` (or pass `api_key=...` per call). Defaults: template `code-interpreter-v1`, sandbox timeout 300s, internet access on. Override `template` to use any custom e2b template you have published.

```python
result = await litellm.acode_interpreter_tool(
    provider="e2b",
    code="...",
    template="my-org/custom-template",
    timeout=120,
)
```

Behind the scenes the call goes directly to e2b's REST API: `POST api.e2b.app/sandboxes` to create, a streamed NDJSON `POST` to the per-sandbox host on port 49999 to execute, and `DELETE api.e2b.app/sandboxes/{id}` to tear down.

### opensandbox

Use [OpenSandbox](https://github.com/opensandboxai/opensandbox) for self-hosted code execution. Set `OPEN_SANDBOX_API_BASE` (or pass `api_base=...` per call) to point at your server; there is no localhost fallback. `OPEN_SANDBOX_API_KEY` is optional, leave it empty for a local no-auth server. Sandboxes are created with egress denied by default; pass `allow_internet_access=True` or an explicit `network_policy` to open it up.

```python
import os, litellm

os.environ["OPEN_SANDBOX_API_BASE"] = "http://127.0.0.1:8080/v1"
os.environ["OPEN_SANDBOX_API_KEY"] = ""  # optional for local no-auth servers

result = await litellm.acode_interpreter_tool(
    provider="opensandbox",
    code="print(sum(range(10)))",
)
print(result.stdout)  # '45\n'
```

The provider drives OpenSandbox's REST lifecycle directly: `POST /v1/sandboxes` to create, resolves the per-sandbox execd endpoint, streams `/code` SSE into a `CodeExecutionResult`, then `DELETE /v1/sandboxes/{id}` to tear down. Other defaults (template, entrypoint, language, polling interval, execd port, default network policy, output cap) live as literals in `litellm/constants.py`.
