---
title: Claude Code
sidebar_label: Claude Code
---

# Claude Code

`Harness.CLAUDE_CODE` runs Anthropic's Claude Code CLI with `claude -p --output-format stream-json` inside your sandbox and turns its stream-json output into events.

## Install

```bash
pip install litellm starlette uvicorn
npm install -g @anthropic-ai/claude-code   # inside the sandbox
```

The `claude` binary must already be on the sandbox's `PATH`. If it isn't, the call raises `HarnessInstallFailed`.

## Usage

```python
import litellm
from litellm import Harness, sandbox

result = litellm.agent(
    Harness.CLAUDE_CODE,
    "Find why tests/test_router.py is flaky and fix it.",
    sandbox=sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"}),
    model="litellm_proxy/claude",
    permissions="edit",
)
```

## Use with LiteLLM AI Gateway

Claude Code speaks the Anthropic Messages API, so it fits best on a Claude model group, which the gateway serves on `/v1/messages` natively. Bedrock and Vertex Claude deployments behave the same as Anthropic direct, so you can load-balance across them in one group.

```yaml title="config.yaml"
model_list:
  - model_name: claude
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0
      aws_region_name: us-west-2

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

Create a virtual key scoped to that group.

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"models": ["claude"], "key_alias": "claude-code"}'
```

Then run with the `litellm_proxy/` prefix. Set the gateway in the environment, or pass it on the call.

```python
import litellm
from litellm import Harness, sandbox

result = litellm.agent(
    Harness.CLAUDE_CODE,
    "Find why tests/test_router.py is flaky and fix it.",
    sandbox=sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"}),
    model="litellm_proxy/claude",
    api_base="http://localhost:4000",  # or LITELLM_PROXY_API_BASE
    api_key="sk-...",                  # or LITELLM_PROXY_API_KEY
    permissions="edit",
    metadata={"ticket": "ENG-412"},
)
```

Claude Code calls `/v1/messages`. The gateway sees each request with `model` set to `claude`, the header `x-litellm-tags: harness,claude_code`, and your `metadata` as `x-litellm-spend-logs-metadata`, so the spend log row carries both.

Claude Code also makes small background calls, such as titles and summaries. They go to the same group as `model`, like OpenCode's, so they are billed and tagged the same way.

## Options

```python
@dataclass(frozen=True)
class ClaudeCodeOptions:
    config: Mapping[str, Any] = field(default_factory=dict)  # extra settings.json keys, passed with --settings
    env: Mapping[str, str] = field(default_factory=dict)
```

`config` passes native Claude Code settings through untyped, because those settings change often. Keys LiteLLM manages itself, such as `env`, `apiKeyHelper`, `model` and `permissions`, raise `OptionsMismatch`. Use `max_turns=` on the call to cap the tool loop, the same as every other harness.

## Models

Claude Code speaks Anthropic Messages. It gets `ANTHROPIC_BASE_URL` pointing at the session's local endpoint and `ANTHROPIC_AUTH_TOKEN` set to the session token, and `CLAUDE_CONFIG_DIR` points at a temporary directory with `--setting-sources user`, so your own Claude Code login, settings and a repo's `.claude/settings.json` are never used. With a `litellm_proxy/` model the endpoint forwards `/v1/messages` to the gateway with the `harness,claude_code` tags. Without a gateway it calls `litellm.anthropic.messages.acreate`.

`ANTHROPIC_API_KEY` is set to an empty string in the runtime, and telemetry and nonessential traffic are turned off.

## Built-in tools

Tools appear as `read`, `write`, `edit`, `bash`, `glob`, `grep` and `web_search`. Tools outside that set, such as `Task` and `TodoWrite`, keep their native names. `disable_tools=` maps to `--disallowedTools`.

## Permissions

| Mode | Claude Code |
|---|---|
| `"read-only"` | `--permission-mode plan` |
| `"edit"` | `--permission-mode acceptEdits` |
| `"full"` (default) | `--permission-mode bypassPermissions` |

`"ask"` raises `CapabilityUnsupported`.

## Skills, output and sessions

Skills are copied into `$CLAUDE_CONFIG_DIR/skills/<name>/`. Structured output works by instructing the model to answer with one JSON object matching your schema, which is then validated. Later turns in a session use `--resume` with the session id from the first turn.

## Limits

Custom Python `tools=` and `history()` raise `CapabilityUnsupported`. Subscription login (Claude Max) isn't used, because every model call goes through LiteLLM.
