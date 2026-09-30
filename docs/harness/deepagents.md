---
title: Deep Agents
sidebar_label: Deep Agents
---

# Deep Agents

`Harness.DEEPAGENTS` runs LangChain's [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview) in your Python process. It's the only harness here that's a Python library rather than a CLI, so there's no process to launch and nothing to install in the sandbox.

## Install

```bash
pip install "litellm[harness-deepagents]"
```

This pulls in `deepagents` and `langchain-litellm`, and needs Python 3.11 or newer. Without them the call raises `HarnessInstallFailed` with the install command.

## Usage

```python
import litellm
from litellm import sandbox
from litellm.harness import Harness, DeepAgentsOptions

def lookup_owner(path: str) -> str:
    """Return the CODEOWNERS entry for a file path."""
    return codeowners.match(path)

result = litellm.harness.run(
    Harness.DEEPAGENTS,
    "Find the three flakiest tests, write NOTES.md, and name an owner for each.",
    sandbox=sandbox.docker("python:3.12", mounts={"./repo": "/workspace"}),
    model="coder",
    tools=[lookup_owner],
    permissions="edit",
    options=DeepAgentsOptions(recursion_limit=100),
)
```

## Options

```python
@dataclass(frozen=True)
class DeepAgentsOptions:
    subagents: Sequence[SubAgent] = ()   # deepagents SubAgent dicts, passed through
    recursion_limit: int | None = None   # LangGraph recursion limit per turn
```

## How it maps

The adapter calls `create_deep_agent()` once per session.

| `litellm.harness` | `create_deep_agent` |
|---|---|
| `model="coder"` with a gateway | `model=ChatLiteLLM(model="litellm_proxy/coder", api_base=..., api_key=...)` |
| `model="provider/model"` without a gateway | `model=ChatLiteLLM(model="provider/model")` |
| `instructions=` | `system_prompt=` |
| `tools=` | `tools=` |
| `output=` | `response_format=` |
| `sandbox=` | `backend=`, which runs file and shell tools through the sandbox |
| sessions | `checkpointer=InMemorySaver()` with one thread per session |

## Models

The model is a `ChatLiteLLM` chat model. In gateway mode it uses the `litellm_proxy/` prefix, so calls go straight to the gateway with your virtual key and don't need the local endpoint. Cost and tokens come from LangChain's `usage_metadata`.

## Sandbox

The agent loop runs in your process, but its file tools and its `execute` shell tool run against your sandbox. With `sandbox.local(path)`, file access is limited to `path`.

## Built-in tools

`read_file`, `write_file`, `edit_file`, `ls`, `glob`, `grep` and `execute` appear as `read`, `write`, `edit`, `ls`, `glob`, `grep` and `bash`. `write_todos` and `task` keep their native names. `disable_tools=` removes tools by their normalized name.

## Permissions

`"read-only"`, `"edit"` and `"full"` (the default) are supported. `"read-only"` removes the write, edit and execute tools, and `"edit"` removes `execute`.

## Sessions and history

Deep Agents is the only harness with custom Python tools and history in this release. A session keeps a LangGraph checkpointer and a thread id, and `s.history()` returns the thread's messages in OpenAI format.

```python
with litellm.harness.session(Harness.DEEPAGENTS, sandbox=box, model="coder") as s:
    s.run("Read the README and list the setup steps.")
    s.run("Now check whether step 3 still works.")
    for m in s.history():
        print(m["role"], m["content"][:80])
```
