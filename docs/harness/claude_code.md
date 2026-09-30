---
title: Claude Code
sidebar_label: Claude Code
---

# Claude Code

`Harness.CLAUDE_CODE` runs Anthropic's Claude Code CLI in headless mode (`claude -p --output-format stream-json`) inside your sandbox and turns its stream-json output into events.

## Install

```bash
pip install "litellm[harness]"
npm install -g @anthropic-ai/claude-code   # inside the sandbox
```

The `claude` binary must already be on the sandbox's `PATH`. If it isn't, the call raises `HarnessInstallFailed`.

## Usage

```python
import litellm
from litellm import sandbox
from litellm.harness import Harness, ClaudeCodeOptions

with litellm.harness.session(
    Harness.CLAUDE_CODE,
    sandbox=sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"}),
    model="coder",
    permissions="edit",
    options=ClaudeCodeOptions(max_turns=30, small_model="coder-small"),
) as s:
    for event in s.stream("Check the test failures and fix the production code."):
        print(event)
```

With `LITELLM_PROXY_API_BASE` and `LITELLM_PROXY_API_KEY` set, `model="coder"` is a model group on your [gateway](./gateway.md).

## Options

```python
@dataclass(frozen=True)
class ClaudeCodeOptions:
    max_turns: int | None = None      # passed to --max-turns
    small_model: str | None = None    # background model for titles and summaries; defaults to model
    env: Mapping[str, str] = field(default_factory=dict)
```

## Models

Claude Code speaks Anthropic Messages. It gets `ANTHROPIC_BASE_URL` pointing at the session's local endpoint and `ANTHROPIC_AUTH_TOKEN` set to the session token. In gateway mode the endpoint forwards `/v1/messages` to the gateway with your virtual key and the `harness,claude_code` tags. Without a gateway it calls `litellm.anthropic.messages.acreate`, so Bedrock and Vertex Claude models work without translation loss. Other models work too, though Claude Code's prompts are written for Claude.

`ANTHROPIC_API_KEY` is set to an empty string in the runtime, and telemetry and nonessential traffic are turned off.

## Built-in tools

Claude Code's tools appear in events under normalized names: `read`, `write`, `edit`, `bash`, `glob`, `grep` and `web_search`. Tools outside that set, such as `Task` and `TodoWrite`, keep their native names. `disable_tools=["web_search", "bash"]` maps to `--disallowedTools`.

## Permissions

| Mode | Claude Code `--permission-mode` |
|---|---|
| `"read-only"` | `plan` |
| `"edit"` | `acceptEdits` |
| `"full"` (default) | `bypassPermissions` |

`"ask"` raises `CapabilityUnsupported` in this release.

## Skills, output and sessions

Skills are copied into `.claude/skills/<name>/` in the working directory. Structured output works by instructing the model to answer with one JSON object matching your schema, which is then validated. Later turns in a session use `--resume` with the session id from Claude Code's init event, and `detach()` returns a `State` you can resume from.

## Limits

Custom Python `tools=` and `history()` raise `CapabilityUnsupported`. Subscription login (Claude Max) isn't used, because every model call goes through LiteLLM.
