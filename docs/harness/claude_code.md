---
title: Claude Code
sidebar_label: Claude Code
---

# Claude Code

`Harness.CLAUDE_CODE` runs Anthropic's Claude Code CLI in headless mode (`claude -p --output-format stream-json`) inside your sandbox and turns its stream-json output into events.

## Install

```bash
pip install litellm starlette uvicorn
npm install -g @anthropic-ai/claude-code   # inside the sandbox
```

The `claude` binary must already be on the sandbox's `PATH`. If it isn't, the call raises `HarnessInstallFailed`.

## Usage

```python
import litellm
from litellm import Harness, ClaudeCodeOptions, sandbox

with litellm.agent_session(
    Harness.CLAUDE_CODE,
    sandbox=sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"}),
    model="litellm_proxy/claude",
    permissions="edit",
    options=ClaudeCodeOptions(max_turns=30, small_model="claude-haiku"),
) as s:
    for event in s.stream("Check the test failures and fix the production code."):
        print(event)
```

## Use with LiteLLM AI Gateway

Claude Code works best on a Claude model group. Bedrock and Vertex Claude deployments behave the same as Anthropic direct, so you can load-balance across them in one group. Add a Haiku group for Claude Code's background calls.

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
  - model_name: claude-haiku
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

Create a virtual key scoped to those groups.

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"models": ["claude", "claude-haiku"], "key_alias": "claude-code"}'
```

Then run with the `litellm_proxy/` prefix. Set the gateway in the environment, or pass it on the call.

```python
import litellm
from litellm import Harness, ClaudeCodeOptions, sandbox

result = litellm.agent(
    Harness.CLAUDE_CODE,
    "Find why tests/test_router.py is flaky and fix it.",
    sandbox=sandbox.local("./repo"),
    model="litellm_proxy/claude",
    api_base="http://localhost:4000",  # or LITELLM_PROXY_API_BASE
    api_key="sk-...",                  # or LITELLM_PROXY_API_KEY
    options=ClaudeCodeOptions(small_model="claude-haiku"),
    metadata={"ticket": "ENG-412"},
)
```

Claude Code calls `/v1/messages`, the Anthropic Messages route. The gateway sees each request with `model` set to `claude`, the header `x-litellm-tags: harness,claude_code`, and your `metadata` as `x-litellm-spend-logs-metadata`, so the spend log row carries both.

Claude Code makes background calls for titles and summaries on a separate small model. By default that is the same group as `model`, which bills Sonnet prices for trivial work. Set `small_model` to a cheaper group on the gateway, like `claude-haiku` above, and include that group in the virtual key's `models` list.

## Options

```python
@dataclass(frozen=True)
class ClaudeCodeOptions:
    max_turns: int | None = None      # passed to --max-turns
    small_model: str | None = None    # background model for titles and summaries; defaults to model
    env: Mapping[str, str] = field(default_factory=dict)
```

## Models

Claude Code speaks Anthropic Messages. It gets `ANTHROPIC_BASE_URL` pointing at the session's local endpoint and `ANTHROPIC_AUTH_TOKEN` set to the session token. With a `litellm_proxy/` model the endpoint forwards `/v1/messages` to the gateway with your virtual key and the `harness,claude_code` tags. Without a gateway it calls `litellm.anthropic.messages.acreate`, so Bedrock and Vertex Claude models work without translation loss. Other models work too, though Claude Code's prompts are written for Claude.

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
