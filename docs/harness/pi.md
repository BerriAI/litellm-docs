---
title: Pi agents in the LiteLLM SDK
sidebar_label: Pi
description: Run the Pi coding agent with litellm.agent(), route calls through your gateway, and use streaming, sessions, skills and structured output.
---

# Pi

<SinceVersion v="1.109.0" />

`Harness.PI` runs the [Pi coding agent](https://github.com/earendil-works/pi) in your sandbox. Use the same `litellm.agent()` API for model routing, events, file changes, token usage and cost.

## Install and run

Install the SDK dependencies on the host and the Pi CLI where the agent runs. For a local sandbox, run both commands on your machine.

```bash
pip install -U litellm starlette uvicorn
npm install -g @earendil-works/pi-coding-agent
pi --version
```

The `pi` binary must be on the sandbox's `PATH`. For `sandbox.docker()`, install it in the container image. A missing binary raises `HarnessInstallFailed`.

Set `LITELLM_PROXY_API_BASE` to your [gateway's base URL](./gateway.md) and `LITELLM_PROXY_API_KEY` to a virtual key. The example uses a gateway model group named `coder`; replace it with a group your key can access that supports Chat Completions and tool calling.

```bash
export LITELLM_PROXY_API_BASE=https://litellm.example.com
export LITELLM_PROXY_API_KEY=sk-your-virtual-key
mkdir -p pi-workspace
```

```python title="run_pi.py"
from pathlib import Path

import litellm
from litellm import Harness, sandbox

result = litellm.agent(
    Harness.PI,
    "Create hello.txt containing exactly hello from Pi.",
    sandbox=sandbox.local("./pi-workspace"),
    model="litellm_proxy/coder",
    permissions="edit",
)

print(result.text)
print(result.usage)
print(result.cost)
assert result.stop_reason == "done"
assert Path("pi-workspace/hello.txt").read_text().strip() == "hello from Pi"
```

Run `python run_pi.py`. The assertion verifies the file the agent created. `result.files` reports the workspace changes. A local sandbox runs with your user's filesystem access; use a [Docker sandbox](./sandboxes.md) when you need container isolation.

## Shared agent APIs

Pass `stream=True` to receive typed events, or use `await litellm.aagent(...)` for an async result. For multi-turn tasks, use `agent_session()` and `session.run()`. Pi also supports `detach()` and `agent_resume()` on a saved `State`. The Pi session cache must remain available in the sandbox environment; serialized state does not contain the full native session history.

Use `output=YourPydanticModel` for validated structured output. Pi receives instructions to return JSON, and LiteLLM validates the response. Invalid output raises `OutputInvalid`. Pass `skills=["./skills/review"]` to load a directory containing `SKILL.md`.

The [session guide](./sessions.md), [event reference](./events.md) and [structured output guide](./structured_output.md) use the same API with `Harness.PI`. For evaluations, pass `EvalTarget(Harness.PI, model="litellm_proxy/coder")` to the [evaluation API](./evaluation.md), subject to that API's SDK version requirements.

## Permissions and tools

| Mode | Pi built-in tools |
|---|---|
| `read-only` | `read`, `grep`, `find`, `ls` |
| `edit` | Read-only tools plus `edit`, `write` |
| `full` (default) | Edit tools plus `bash` |

Use `disable_tools=("bash", "write")` to remove tools from the selected mode. Normalized event names match the [shared tool names](./events.md#tool-names), including `find` as `glob` and `powershell` as `bash`.

Custom Python `tools=`, `session.history()` and `permissions="ask"` are unsupported and raise `CapabilityUnsupported`. For Python functions or interactive tool approval, use [Tool Loop](./tool_loop.md) or compare the [capability table](./supported.md).

## Pi options

```python
from litellm import PiOptions

options = PiOptions(
    thinking="medium",
    config={"compaction": {"enabled": True}},
)
```

Pass this object as `options=` on your agent or session call.

| Field | Use |
|---|---|
| `thinking` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh` or `max`; the selected model must support the requested level |
| `config` | Extra Pi settings; `mcpServers` configures native Pi MCP servers |
| `env` | Extra environment variables for the Pi process |

LiteLLM manages model selection, provider credentials, permission tools, skills and session paths. Settings that override these controls or load packages and extensions are rejected. Use the matching `agent()` argument instead. Pi runs with private configuration and does not load your personal Pi setup or project-local extensions.

Configured MCP servers remain available in every permission mode. Their tools can have effects beyond reading files, so use `disable_tools=` to filter them when needed. MCP configuration belongs in `PiOptions.config["mcpServers"]`, rather than Python `tools=`.

## Routing and accounting

Pi sends streamed requests to `/v1/chat/completions`. With `model="litellm_proxy/<group>"`, LiteLLM forwards them to the gateway with the `harness,pi` tags and your `metadata`. Your gateway key stays on the host; Pi receives a session-scoped token.

Usage and cost come from the model responses. A self-hosted group must return stream usage for complete token accounting. For SDK routing without a gateway, see [Models and routing](./models.md#sdk-mode).
