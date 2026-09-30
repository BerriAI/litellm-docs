---
title: Codex
sidebar_label: Codex
---

# Codex

`Harness.CODEX` runs OpenAI's Codex CLI with `codex exec --json` inside your sandbox and turns its JSONL events into events.

## Install

```bash
pip install litellm starlette uvicorn
npm install -g @openai/codex   # inside the sandbox
```

The `codex` binary must already be on the sandbox's `PATH`. If it isn't, the call raises `HarnessInstallFailed`.

## Usage

```python
import litellm
from litellm import Harness, CodexOptions, sandbox

result = litellm.agent(
    Harness.CODEX,
    "Upgrade pydantic to v2 and make the tests pass.",
    sandbox=sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"}),
    model="litellm_proxy/gpt",
    options=CodexOptions(reasoning_effort="high"),
)
```

## Use with LiteLLM AI Gateway

Codex speaks the OpenAI Responses API, so it fits best on an OpenAI reasoning model, which the gateway serves on `/v1/responses` natively. You can also give it a Claude or Gemini group; the gateway translates Responses requests into that provider's format, though Codex-specific features like reasoning summaries may not come through.

```yaml title="config.yaml"
model_list:
  - model_name: gpt
    litellm_params:
      model: openai/gpt-5
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt
    litellm_params:
      model: azure/gpt-5
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
      api_version: "2025-04-01-preview"

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

Create a virtual key scoped to that group.

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"models": ["gpt"], "key_alias": "codex"}'
```

Then run with the `litellm_proxy/` prefix. Set the gateway in the environment, or pass it on the call.

```python
import litellm
from litellm import Harness, CodexOptions, sandbox

result = litellm.agent(
    Harness.CODEX,
    "Upgrade pydantic to v2 and make the tests pass.",
    sandbox=sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"}),
    model="litellm_proxy/gpt",
    api_base="http://localhost:4000",  # or LITELLM_PROXY_API_BASE
    api_key="sk-...",                  # or LITELLM_PROXY_API_KEY
    options=CodexOptions(reasoning_effort="high"),
    metadata={"ticket": "ENG-412"},
)
```

Codex calls `/v1/responses`. The gateway sees each request with `model` set to `gpt`, the header `x-litellm-tags: harness,codex`, and your `metadata` as `x-litellm-spend-logs-metadata`, so the spend log row carries both.

`reasoning_effort` is sent to the model on every call and has the biggest effect on both quality and cost. `"high"` suits migrations and hard bugs; leave it unset for routine edits. It only does something on a group whose model supports reasoning effort, and a group behind translation may ignore it.

## Options

```python
@dataclass(frozen=True)
class CodexOptions:
    reasoning_effort: Literal["low", "medium", "high", "xhigh"] | None = None
    web_search: bool = False
    config: Mapping[str, Any] = field(default_factory=dict)  # extra -c config keys, passed through
    env: Mapping[str, str] = field(default_factory=dict)
```

`config` passes native keys through untyped, because Codex's config changes often. Keys LiteLLM manages itself, such as `model_provider`, `model_providers` and `approval_policy`, raise `OptionsMismatch`.

## Models

Codex speaks the OpenAI Responses API. The adapter registers a `litellm` model provider with `wire_api="responses"` pointing at the session's local endpoint, and sets `CODEX_HOME` to a temporary directory so your own Codex config and login are never used. With a `litellm_proxy/` model the endpoint forwards `/v1/responses` to the gateway with the `harness,codex` tags, and the gateway translates for non-OpenAI model groups. Without a gateway it calls `litellm.aresponses`.

`OPENAI_API_KEY` and `CODEX_API_KEY` are never forwarded into the sandbox.

## Built-in tools

Shell commands appear as `bash` and web searches as `web_search`. File edits show up as `FileChange` events from the sandbox snapshot, whether or not Codex reported them as a tool call.

## Permissions

| Mode | Codex |
|---|---|
| `"read-only"` | `--sandbox read-only` |
| `"full"` (default) | `--dangerously-bypass-approvals-and-sandbox` in `sandbox.docker`; `--sandbox workspace-write` with `approval_policy=never` in `sandbox.local` |

Codex keeps its own OS-level sandbox on in `sandbox.local`, which protects your machine. It's turned off in Docker, where the container is already the boundary and nested sandboxing often fails. `"edit"` and `"ask"` raise `CapabilityUnsupported`.

## Skills, output and sessions

Skills are copied into `$CODEX_HOME/skills/<name>/`. Structured output uses Codex's native `--output-schema`. Later turns in a session use `codex exec resume` with the thread id from the first turn.

## Limits

Codex can't filter its built-in tools, so `disable_tools=` raises `CapabilityUnsupported`. Custom Python `tools=` and `history()` aren't available.
