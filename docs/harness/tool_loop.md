---
title: Tool Loop
sidebar_label: Tool Loop
---

# Tool Loop

`Harness.TOOL_LOOP` runs a minimal tool-calling loop in your Python process. It calls `litellm.acompletion()`, validates tool arguments against your Python function signatures, runs the functions, and sends their results back to the model until it returns a final answer

## Install

Tool Loop needs only the regular `litellm` package. There are no additional packages or runtime binaries to install

## Use your own Python tools

Pass synchronous or asynchronous Python functions in `tools=`. Type hints and docstrings define each tool's schema. Tool Loop runs synchronous functions in a worker thread and awaits asynchronous functions

```python
from typing import Literal

import litellm
from pydantic import BaseModel

from litellm import Harness, sandbox

def search_code(query: str, path: str = ".") -> list[str]:
    """Find matching lines in the repository."""
    ...

def read_file(path: str) -> str:
    """Read a text file from the repository."""
    ...

class Review(BaseModel):
    summary: str
    verdict: Literal["approve", "request_changes"]
    findings: list[str]

result = litellm.agent(
    Harness.TOOL_LOOP,
    "Review the changes in this repository. Search for relevant code, read files as needed, and return your findings.",
    sandbox=sandbox.local("./repo"),
    model="litellm_proxy/coder",
    tools=[search_code, read_file],
    output=Review,
)

print(result.output)
```

The loop returns tool exceptions, unknown tool names, and invalid arguments to the model as tool errors, so the model can recover or explain the problem. Tool calls are run sequentially

Your functions execute in the Python process running LiteLLM, not inside the sandbox. Pass a sandbox because it is part of the common agent API, and have your tools enforce any file or network boundaries they need

## Use with LiteLLM AI Gateway

Prefix a gateway model group with `litellm_proxy/`. Requests go through LiteLLM's Chat Completions API and carry the `harness,tool_loop` tags. The virtual key is used by the Python process running Tool Loop

```python
result = litellm.agent(
    Harness.TOOL_LOOP,
    "Find the owner of the authentication module and summarize their recent changes.",
    sandbox=sandbox.local("./repo"),
    model="litellm_proxy/coder",
    tools=[search_code, read_file],
    metadata={"task": "code-review"},
)
```

Without the prefix, Tool Loop calls the provider through the LiteLLM SDK. Pass provider credentials with `api_key=` and `api_base=`, or use the standard provider environment variables

## Completion options

Use `ToolLoopOptions` to pass additional keyword arguments to every `litellm.acompletion()` call. Model and routing values managed by the harness take precedence over values in `completion_kwargs`

```python
import litellm
from litellm import Harness, ToolLoopOptions, sandbox

result = litellm.agent(
    Harness.TOOL_LOOP,
    "Summarize the latest changes.",
    sandbox=sandbox.local("./repo"),
    model="litellm_proxy/coder",
    tools=[search_code, read_file],
    options=ToolLoopOptions(
        completion_kwargs={"temperature": 0.2, "reasoning_effort": "high"}
    ),
)
```

`ToolLoopOptions` is frozen and defaults to an empty mapping. The loop supports structured output with a Pydantic model passed through `output=`, approval with `permissions="ask"`, and OpenAI-format conversation history through `session.history()`

## Permissions and limitations

Tool Loop supports `permissions="full"` and `permissions="ask"`. In ask mode, each call to a custom tool requires approval through `on_approval` or an `Approval` event in a stream

Tool Loop does not provide built-in file or shell tools, skills, session resume, or `disable_tools=`. Add the Python functions your task needs in `tools=`

To run the same kind of loop with your own OpenAI-format tool schemas and a single executor function, without `litellm.agent()` or a sandbox, use [`litellm.run_tool_loop()`](../completion/tool_loop.md)
