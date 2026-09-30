---
title: Quickstart
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quickstart

## 1. Install

`litellm.agent()` is part of the regular `litellm` package and adds no dependencies to it. Install what your harness needs:

| Harness | Python packages | Runtime on the sandbox's `PATH` |
|---|---|---|
| Claude Code | `pip install litellm starlette uvicorn` | `npm install -g @anthropic-ai/claude-code` |
| Codex | `pip install litellm starlette uvicorn` | `npm install -g @openai/codex` |
| OpenCode | `pip install litellm starlette uvicorn` | `npm install -g opencode-ai` |
| Deep Agents | `pip install litellm deepagents langchain-litellm` (Python 3.11+) {/* keep-python-version */} | nothing |

`starlette` and `uvicorn` run the small per-session model endpoint the CLI harnesses call. If something is missing, the call raises `HarnessInstallFailed` with the exact install command.

## 2. Point at your gateway

Use a virtual key from your [LiteLLM AI Gateway](./gateway.md). It stays on your host. Models prefixed with `litellm_proxy/` are sent to this gateway.

```bash
export LITELLM_PROXY_API_BASE=https://litellm.example.com
export LITELLM_PROXY_API_KEY=sk-...
```

To skip the gateway, export a provider key such as `ANTHROPIC_API_KEY` instead and use a model string without the prefix, like `anthropic/claude-sonnet-4-5`.

## 3. Run one turn

<Tabs>
<TabItem value="sync" label="Sync">

```python title="fix_flaky.py"
import litellm
from litellm import Harness, sandbox

result = litellm.agent(
    Harness.CLAUDE_CODE,
    "Find why tests/test_router.py is flaky and fix it.",
    sandbox=sandbox.local("./repo"),
    model="litellm_proxy/coder",
)

print(result.text)
print(f"${result.cost:.4f}")
```

</TabItem>
<TabItem value="async" label="Async">

```python title="fix_flaky.py"
import asyncio
import litellm
from litellm import Harness, sandbox

async def main():
    result = await litellm.aagent(
        Harness.CLAUDE_CODE,
        "Find why tests/test_router.py is flaky and fix it.",
        sandbox=sandbox.local("./repo"),
        model="litellm_proxy/coder",
    )
    print(result.text)

asyncio.run(main())
```

</TabItem>
</Tabs>

Permissions default to `"full"`, because the sandbox is the boundary. Use `permissions="read-only"` for reviews, or a Docker sandbox for code you don't trust.

## 4. Stream events

```python
import litellm
from litellm import Harness, sandbox
from litellm.harness import Text, FileChange, Done

for event in litellm.agent(
    Harness.CODEX,
    "Add type hints to utils.py",
    sandbox=sandbox.local("./repo"),
    model="litellm_proxy/coder",
    stream=True,
):
    match event:
        case Text(delta=delta):
            print(delta, end="", flush=True)
        case FileChange(path=path):
            print(f"\n  changed {path}")
        case Done(cost=cost):
            print(f"\n${cost:.4f}")
        case _:
            pass
```

## 5. Pick a harness

Every harness takes the same call, but each suits different work and a different kind of model group. [Choosing a harness](./gateway.md#4-choosing-a-harness) covers when to use which, and the gateway tags every request with the harness that made it, so you can compare their spend.
