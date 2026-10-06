---
title: Tool Loop (run_tool_loop)
sidebar_label: Tool Loop
---

# Tool Loop

`litellm.run_tool_loop()` and `litellm.arun_tool_loop()` run the standard client-side tool-calling loop for you. They call `litellm.completion()` (or `litellm.acompletion()`), hand every tool call the model requests to your executor, append the assistant turn and the tool results to the conversation, and call the model again until it answers without requesting a tool. The return value is the final assistant message content

You keep the tool schemas and the code that runs them. LiteLLM only owns the loop, so the same helper works for any model that supports [function calling](./function_call.md)

## Quick Start

`execute_tool` receives one `ChatCompletionMessageToolCall` and returns one tool message. Anything your tool needs beyond the model's arguments, such as a repository path or a revision, is bound by you with `functools.partial` or a closure

```python
import functools
import json
import subprocess

import litellm
from litellm.types.llms.openai import ChatCompletionToolMessage
from litellm.types.utils import ChatCompletionMessageToolCall

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file from the repository at the pinned revision",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"],
            },
        },
    }
]


def read_file(
    tool_call: ChatCompletionMessageToolCall, *, repository_root: str, revision: str
) -> ChatCompletionToolMessage:
    args = json.loads(tool_call.function.arguments)
    result = subprocess.run(
        ["git", "-C", repository_root, "show", f"{revision}:{args['path']}"],
        capture_output=True,
        text=True,
    )
    return {
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": result.stdout or result.stderr,
    }


messages = [{"role": "user", "content": "What package name does pyproject.toml declare?"}]

try:
    answer = litellm.run_tool_loop(
        model="anthropic/{{anthropic}}",
        messages=messages,
        tools=TOOLS,
        execute_tool=functools.partial(read_file, repository_root="/path/to/repo", revision="main"),
        max_rounds=10,
    )
    print(answer)
except litellm.ToolLoopMaxRoundsExceeded as error:
    print(f"gave up after {error.max_rounds} rounds")
```

The `messages` list you pass in is never modified. Each round builds a new history, so you can reuse the same starting messages for another run

## Async

`arun_tool_loop()` takes the same arguments with an async executor. Tool calls from one model turn are awaited one at a time, in the order the model returned them

```python
import asyncio


async def aread_file(
    tool_call: ChatCompletionMessageToolCall, *, repository_root: str, revision: str
) -> ChatCompletionToolMessage:
    return await asyncio.to_thread(read_file, tool_call, repository_root=repository_root, revision=revision)


answer = asyncio.run(
    litellm.arun_tool_loop(
        model="anthropic/{{anthropic}}",
        messages=messages,
        tools=TOOLS,
        execute_tool=functools.partial(aread_file, repository_root="/path/to/repo", revision="main"),
    )
)
```

## Completion arguments

Any other keyword argument is passed unchanged to every `litellm.completion()` call in the loop, so `response_format`, `temperature`, `api_key`, `api_base`, `reasoning_effort`, and the rest of the [input params](./input.md) work as usual. With `response_format` set, the final answer is the structured JSON string the model returns

```python
answer = litellm.run_tool_loop(
    model="anthropic/{{anthropic}}",
    messages=messages,
    tools=TOOLS,
    execute_tool=functools.partial(read_file, repository_root="/path/to/repo", revision="main"),
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "package_info",
            "schema": {
                "type": "object",
                "properties": {"package_name": {"type": "string"}},
                "required": ["package_name"],
            },
        },
    },
)
```

`stream=True` is rejected with a `ValueError`, because the loop needs each complete response to read its tool calls

## Use with LiteLLM AI Gateway

Prefix a gateway model group with `litellm_proxy/` and pass the gateway URL and a virtual key. Every round of the loop is a normal `/chat/completions` request, so spend, logging, and guardrails apply per round

```python
answer = litellm.run_tool_loop(
    model="litellm_proxy/my-model-group",
    api_base="http://localhost:4000",
    api_key="sk-1234",
    messages=messages,
    tools=TOOLS,
    execute_tool=functools.partial(read_file, repository_root="/path/to/repo", revision="main"),
)
```

## Round limit and errors

`max_rounds` caps how many completion calls the loop makes and defaults to 20. If the model is still requesting tools on the last allowed call, the loop raises `litellm.ToolLoopMaxRoundsExceeded` without running those final tool calls; the limit is on its `max_rounds` attribute. A `max_rounds` below 1 raises `ValueError` before any request is sent

The executor only handles function tool calls. If the model returns a custom tool call, the loop raises `TypeError` with the call id before your executor runs. Exceptions raised by your executor are not caught, so return an error string in the tool message when you want the model to see the failure and recover

Reasoning state is carried between rounds. When a response includes `thinking_blocks` or Responses API `reasoning_items`, they are sent back with the assistant turn on the next call, which keeps extended thinking and encrypted reasoning working across tool calls

## When to use Harness.TOOL_LOOP instead

[`Harness.TOOL_LOOP`](../harness/tool_loop.md) runs a similar loop through `litellm.agent()`. It builds tool schemas from Python type hints, validates arguments, returns tool exceptions to the model, and adds structured output through Pydantic models, tool approval, and session history. Use it when you want those agent features. Use `run_tool_loop()` when you already have OpenAI-format tool schemas and want one executor function with no agent or sandbox API around it
