---
title: Codex
sidebar_label: Codex
---

# Codex

`Harness.CODEX` runs OpenAI's Codex CLI with `codex exec --json` inside your sandbox and turns its JSONL events into events.

## Install

```bash
pip install "litellm[harness]"
npm install -g @openai/codex   # inside the sandbox
```

The `codex` binary must already be on the sandbox's `PATH`. If it isn't, the call raises `HarnessInstallFailed`.

## Usage

```python
import litellm
from litellm import sandbox
from litellm.harness import Harness, CodexOptions

result = litellm.harness.run(
    Harness.CODEX,
    "Upgrade pydantic to v2 and make the tests pass.",
    sandbox=sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"}),
    model="coder",
    options=CodexOptions(reasoning_effort="high"),
)
```

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

Codex speaks the OpenAI Responses API. The adapter registers a `litellm` model provider with `wire_api="responses"` pointing at the session's local endpoint, and sets `CODEX_HOME` to a temporary directory so your own Codex config and login are never used. In gateway mode the endpoint forwards `/v1/responses` to the gateway with the `harness,codex` tags, and the gateway translates for non-OpenAI model groups. Without a gateway it calls `litellm.aresponses`.

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
