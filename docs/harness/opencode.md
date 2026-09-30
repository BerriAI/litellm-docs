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
from litellm import sandbox
from litellm.harness import Harness, OpenCodeOptions

result = litellm.harness.run(
    Harness.OPENCODE,
    "Add a /health endpoint with a test.",
    sandbox=sandbox.docker("my-agents:latest", mounts={"./api": "/workspace"}),
    model="coder",
    permissions="edit",
    options=OpenCodeOptions(agent="build"),
)
```

## Options

```python
@dataclass(frozen=True)
class OpenCodeOptions:
    agent: str = "build"                                     # which OpenCode agent runs the turn
    config: Mapping[str, Any] = field(default_factory=dict)  # extra opencode.json keys, merged under LiteLLM's
    env: Mapping[str, str] = field(default_factory=dict)
```

## Models

The adapter writes an `opencode.json` with one provider, `litellm`, using `@ai-sdk/openai-compatible` with its base URL set to the session's local endpoint, and points `OPENCODE_CONFIG` at it. `XDG_CONFIG_HOME` and `XDG_DATA_HOME` point at temporary directories, so your own OpenCode providers and auth are never used. OpenCode speaks OpenAI Chat Completions. In gateway mode the endpoint forwards `/v1/chat/completions` to the gateway with the `harness,opencode` tags; without a gateway it calls `litellm.acompletion`, so every LiteLLM provider works.

## Built-in tools

`read`, `write`, `edit`, `bash`, `glob` and `grep` keep their names, and `webfetch` appears as `web_search`. Other tools keep their native names. `disable_tools=` turns tools off in the generated config.

## Permissions

`"read-only"`, `"edit"` and `"full"` (the default) map to OpenCode's `permission` config. `"ask"` raises `CapabilityUnsupported` in this release, and permission keys in `config` are rejected so they can't loosen the mode you set.

## Skills, output and sessions

Skills are copied into `.opencode/skill/<name>/` in the working directory. Structured output works by instructing the model to answer with one JSON object matching your schema. Sessions resume with OpenCode's session id when it reports one.

## Limits

Custom Python `tools=` and `history()` raise `CapabilityUnsupported`.
