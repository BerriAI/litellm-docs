---
title: OpenCode
sidebar_label: OpenCode
---

# OpenCode

`Harness.OPENCODE` runs the OpenCode CLI with `opencode run --format json` inside your sandbox and turns its JSON events into events.

## Install

```bash
pip install litellm starlette uvicorn
npm install -g opencode-ai   # inside the sandbox
```

The `opencode` binary must already be on the sandbox's `PATH`. If it isn't, the call raises `HarnessInstallFailed`.

## Usage

```python
import litellm
from litellm import Harness, OpenCodeOptions, sandbox

result = litellm.agent(
    Harness.OPENCODE,
    "Add a /health endpoint with a test.",
    sandbox=sandbox.docker("my-agents:latest", mounts={"./api": "/workspace"}),
    model="litellm_proxy/gemini",
    permissions="edit",
    options=OpenCodeOptions(agent="build"),
)
```

## Use with LiteLLM AI Gateway

OpenCode speaks plain Chat Completions, so any model group works: Gemini, Claude, GPT, or a self-hosted model. This makes it the natural harness for models the other CLIs aren't built for.

```yaml title="config.yaml"
model_list:
  - model_name: gemini
    litellm_params:
      model: gemini/gemini-2.5-pro
      api_key: os.environ/GEMINI_API_KEY
  - model_name: qwen-coder
    litellm_params:
      model: hosted_vllm/Qwen/Qwen3-Coder-30B-A3B-Instruct
      api_base: http://gpu-01:8000/v1

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

Create a virtual key scoped to those groups.

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"models": ["gemini", "qwen-coder"], "key_alias": "opencode"}'
```

Then run with the `litellm_proxy/` prefix. Set the gateway in the environment, or pass it on the call.

```python
import litellm
from litellm import Harness, sandbox

result = litellm.agent(
    Harness.OPENCODE,
    "Add a /health endpoint with a test.",
    sandbox=sandbox.docker("my-agents:latest", mounts={"./api": "/workspace"}),
    model="litellm_proxy/qwen-coder",
    api_base="http://localhost:4000",  # or LITELLM_PROXY_API_BASE
    api_key="sk-...",                  # or LITELLM_PROXY_API_KEY
    permissions="edit",
    metadata={"ticket": "ENG-412"},
)
```

OpenCode calls `/v1/chat/completions` with `stream: true`. The gateway sees each request with `model` set to your group, the header `x-litellm-tags: harness,opencode`, and your `metadata` as `x-litellm-spend-logs-metadata`, so the spend log row carries both.

Because every response is streamed, `result.cost` and token counts come from the usage chunk at the end of each stream. Hosted providers send one. For a self-hosted group, check that the server returns usage when asked with `stream_options: {"include_usage": true}`; otherwise tokens and cost for that group read as zero. OpenCode also sends its small background calls (titles, summaries) to the same group, since LiteLLM sets its `small_model` to `model`.

## Options

```python
@dataclass(frozen=True)
class OpenCodeOptions:
    agent: str = "build"                                     # which OpenCode agent runs the turn
    config: Mapping[str, Any] = field(default_factory=dict)  # extra opencode.json keys, merged under LiteLLM's
    env: Mapping[str, str] = field(default_factory=dict)
```

## Models

The adapter writes an `opencode.json` with one provider, `litellm`, using `@ai-sdk/openai-compatible` with its base URL set to the session's local endpoint, and points `OPENCODE_CONFIG` at it. `XDG_CONFIG_HOME` and `XDG_DATA_HOME` point at temporary directories, so your own OpenCode providers and auth are never used. OpenCode speaks OpenAI Chat Completions. With a `litellm_proxy/` model the endpoint forwards `/v1/chat/completions` to the gateway with the `harness,opencode` tags; without a gateway it calls `litellm.acompletion`, so every LiteLLM provider works.

## Built-in tools

`read`, `write`, `edit`, `bash`, `glob` and `grep` keep their names, and `webfetch` appears as `web_search`. Other tools keep their native names. `disable_tools=` turns tools off in the generated config.

## Permissions

`"read-only"`, `"edit"` and `"full"` (the default) map to OpenCode's `permission` config. `"ask"` raises `CapabilityUnsupported` in this release, and permission keys in `config` are rejected so they can't loosen the mode you set.

## Skills, output and sessions

Skills are copied into `.opencode/skill/<name>/` in the working directory. Structured output works by instructing the model to answer with one JSON object matching your schema. Sessions resume with OpenCode's session id when it reports one.

## Limits

Custom Python `tools=` and `history()` raise `CapabilityUnsupported`.
