---
title: Deep Agents
sidebar_label: Deep Agents
---

# Deep Agents

`Harness.DEEPAGENTS` runs LangChain's [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview) in your Python process. It's the only harness here that's a Python library rather than a CLI, so there's no process to launch and nothing to install in the sandbox.

## Install

```bash
pip install litellm deepagents langchain-litellm
```

Deep Agents needs Python 3.11 or newer and doesn't need `starlette` or `uvicorn`. If `deepagents` or `langchain-litellm` is missing, the call raises `HarnessInstallFailed` with the install command. {/* keep-python-version */}

## Usage

```python
import litellm
from litellm import Harness, DeepAgentsOptions, sandbox

def lookup_owner(path: str) -> str:
    """Return the CODEOWNERS entry for a file path."""
    return codeowners.match(path)

result = litellm.agent(
    Harness.DEEPAGENTS,
    "Find the three flakiest tests, write NOTES.md, and name an owner for each.",
    sandbox=sandbox.docker("python:{{python_version}}", mounts={"./repo": "/workspace"}),
    model="litellm_proxy/claude",
    tools=[lookup_owner],
    permissions="edit",
    options=DeepAgentsOptions(recursion_limit=100),
)
```

## Use with LiteLLM AI Gateway

Deep Agents works with any model group that supports tool calling. A strong model pays off for the planning step, so a Claude or GPT group is a good default, with a cheaper group for subagents.

```yaml title="config.yaml"
model_list:
  - model_name: claude
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: gpt-mini
    litellm_params:
      model: openai/gpt-5-mini
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

Create a virtual key scoped to those groups.

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"models": ["claude", "gpt-mini"], "key_alias": "deepagents"}'
```

Then run with the `litellm_proxy/` prefix. Set the gateway in the environment, or pass it on the call.

```python
import litellm
from litellm import Harness, sandbox

result = litellm.agent(
    Harness.DEEPAGENTS,
    "Triage the failing test and file a ticket.",
    sandbox=sandbox.local("./repo"),
    model="litellm_proxy/claude",
    api_base="http://localhost:4000",  # or LITELLM_PROXY_API_BASE
    api_key="sk-...",                  # or LITELLM_PROXY_API_KEY
    tools=[lookup_owner, open_ticket],
    metadata={"ticket": "ENG-412"},
)
```

Deep Agents calls `/v1/chat/completions` through a `ChatLiteLLM` model with `model="litellm_proxy/claude"`. The gateway sees each request with `model` set to `claude`, the header `x-litellm-tags: harness,deepagents`, and your `metadata` as `x-litellm-spend-logs-metadata`, the same attribution the CLI harnesses get.

Unlike the other harnesses, Deep Agents runs in your Python process and calls the gateway itself. There is no local endpoint and no session token, so the virtual key lives in your process, and your process needs network access to the gateway. Its packages, `pip install deepagents langchain-litellm`, go on the machine running your code rather than in the sandbox.

## Options

```python
@dataclass(frozen=True)
class DeepAgentsOptions:
    subagents: Sequence[SubAgent] = ()   # deepagents SubAgent dicts, passed through
    recursion_limit: int | None = None   # LangGraph recursion limit per turn
```

## How it maps

The adapter calls `create_deep_agent()` once per session.

| `litellm.agent()` | `create_deep_agent` |
|---|---|
| `model="litellm_proxy/claude"` | `model=ChatLiteLLM(model="litellm_proxy/claude", api_base=..., api_key=...)` |
| `model="provider/model"` | `model=ChatLiteLLM(model="provider/model")` |
| `instructions=` | `system_prompt=` |
| `tools=` | `tools=` |
| `output=` | `response_format=` |
| `sandbox=` | `backend=`, which runs file and shell tools through the sandbox |
| sessions | `checkpointer=InMemorySaver()` with one thread per session |

## Models

The model is a `ChatLiteLLM` chat model. With a `litellm_proxy/` model, calls go straight to the gateway with your virtual key and don't need the local endpoint. Cost and tokens come from LangChain's `usage_metadata`.

## Sandbox

The agent loop runs in your process, but its file tools and its `execute` shell tool run against your sandbox. With `sandbox.local(path)`, file access is limited to `path`.

## Built-in tools

`read_file`, `write_file`, `edit_file`, `ls`, `glob`, `grep` and `execute` appear as `read`, `write`, `edit`, `ls`, `glob`, `grep` and `bash`. `write_todos` and `task` keep their native names. `disable_tools=` removes tools by their normalized name.

## Permissions

`"read-only"`, `"edit"` and `"full"` (the default) are supported. `"read-only"` removes the write, edit and execute tools, and `"edit"` removes `execute`.

## Sessions and history

Deep Agents is the only harness with custom Python tools and history in this release. A session keeps a LangGraph checkpointer and a thread id, and `s.history()` returns the thread's messages in OpenAI format.

```python
with litellm.agent_session(Harness.DEEPAGENTS, sandbox=box, model="litellm_proxy/claude") as s:
    s.run("Read the README and list the setup steps.")
    s.run("Now check whether step 3 still works.")
    for m in s.history():
        print(m["role"], m["content"][:80])
```
