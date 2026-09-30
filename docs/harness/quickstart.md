---
title: Quickstart
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quickstart

## 1. Install

`litellm.harness` is part of the regular `litellm` package and adds no dependencies to it. Install what your harness needs:

| Harness | Python packages | Runtime on the sandbox's `PATH` |
|---|---|---|
| Claude Code | `pip install litellm starlette uvicorn` | `npm install -g @anthropic-ai/claude-code` |
| Codex | `pip install litellm starlette uvicorn` | `npm install -g @openai/codex` |
| OpenCode | `pip install litellm starlette uvicorn` | `npm install -g opencode-ai` |
| Deep Agents | `pip install litellm deepagents langchain-litellm` (Python 3.11+) | nothing |

`starlette` and `uvicorn` run the small per-session model endpoint the CLI harnesses call. If something is missing, the call raises `HarnessInstallFailed` with the exact install command.

## 2. Point at your gateway

Use a virtual key from your [LiteLLM AI Gateway](./gateway.md). It stays on your host.

```bash
export LITELLM_PROXY_API_BASE=https://litellm.example.com
export LITELLM_PROXY_API_KEY=sk-...
```

To skip the gateway, leave these unset and export a provider key such as `ANTHROPIC_API_KEY` instead, then use a full model string like `anthropic/claude-sonnet-4-5` below.

## 3. Run one turn

<Tabs>
<TabItem value="sync" label="Sync">

```python title="fix_flaky.py"
import litellm
from litellm import sandbox
from litellm.harness import Harness

result = litellm.harness.run(
    Harness.CLAUDE_CODE,
    "Find why tests/test_router.py is flaky and fix it.",
    sandbox=sandbox.local("./repo"),
    model="coder",
)

print(result.text)
print(f"${result.cost:.4f}")
```

</TabItem>
<TabItem value="async" label="Async">

```python title="fix_flaky.py"
import asyncio
import litellm
from litellm import sandbox
from litellm.harness import Harness

async def main():
    result = await litellm.harness.arun(
        Harness.CLAUDE_CODE,
        "Find why tests/test_router.py is flaky and fix it.",
        sandbox=sandbox.local("./repo"),
        model="coder",
    )
    print(result.text)

asyncio.run(main())
```

</TabItem>
</Tabs>

Permissions default to `"full"`, because the sandbox is the boundary. Use `permissions="read-only"` for reviews, or a Docker sandbox for code you don't trust.

## 4. Stream events

```python
from litellm.harness import Harness, Text, FileChange, Done

for event in litellm.harness.stream(
    Harness.CODEX,
    "Add type hints to utils.py",
    sandbox=sandbox.local("./repo"),
    model="coder",
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

## 5. Compare harnesses

Every harness takes the same call, so comparing them is a loop.

```python
box = sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"})

for harness in (Harness.CLAUDE_CODE, Harness.CODEX, Harness.OPENCODE, Harness.DEEPAGENTS):
    r = litellm.harness.run(harness, task, sandbox=box, model="coder")
    print(harness.name, r.stop_reason, f"${r.cost:.2f}", len(r.files))
```

On the gateway, each run shows up under its own harness tag.
