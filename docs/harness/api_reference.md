---
title: API reference
---

# API reference

The entry points live on the top-level `litellm` module, next to `litellm.completion`. Each one has an async version with an `a` prefix.

```python
import litellm
from litellm import Harness, ClaudeCodeOptions, CodexOptions, OpenCodeOptions, DeepAgentsOptions, sandbox
from litellm.harness import Text, ToolCall, FileChange, Done, Result, State
```

## Functions

| Function | Async | Returns |
|---|---|---|
| `litellm.agent(harness, prompt, *, sandbox, **options)` | `aagent` | `Result` |
| `litellm.agent(harness, prompt, *, sandbox, stream=True, **options)` | `aagent(..., stream=True)` | `EventStream` |
| `litellm.agent_session(harness, *, sandbox, **options)` | `aagent_session` | `Session` |
| `litellm.agent_resume(state, *, sandbox)` | `aagent_resume` | `Session` |
| `litellm.agent_capabilities(harness)` | | `Capabilities` |

## Options

All options are keyword-only, and only `sandbox` is required.

```python
def agent(
    harness: Harness,
    prompt: str,
    *,
    sandbox: Sandbox,
    model: str | None = None,                # "litellm_proxy/<group>" for the gateway, else any LiteLLM model
    api_key: str | None = None,              # gateway virtual key, or provider key in SDK mode
    api_base: str | None = None,             # gateway root without /v1, or provider base in SDK mode
    stream: bool = False,
    instructions: str | None = None,
    tools: Sequence[Callable[..., Any]] = (),
    skills: Sequence[str | os.PathLike] = (),
    disable_tools: Sequence[str] = (),
    permissions: Literal["read-only", "ask", "edit", "full"] = "full",
    on_approval: Callable[[Approval], bool | Awaitable[bool]] | None = None,
    output: type[BaseModel] | None = None,
    max_turns: int | None = None,
    timeout: float | None = None,
    metadata: Mapping[str, Any] | None = None,   # sent as x-litellm-spend-logs-metadata
    options: ClaudeCodeOptions | CodexOptions | OpenCodeOptions | DeepAgentsOptions | None = None,
    install: bool = False,                   # runtimes must already be in the sandbox
) -> Result | EventStream: ...
```

## `Result`

```python
@dataclass(frozen=True)
class Result:
    text: str
    output: BaseModel | None
    files: list[FileChange]
    events: list[Event]
    usage: Usage            # input_tokens, output_tokens, calls, total_tokens
    cost: float
    stop_reason: Literal["done", "max_turns", "timeout", "cancelled", "runtime_error"]
    session_id: str
```

## `Session`

| Member | Description |
|---|---|
| `cost: float` | running total across turns |
| `run(prompt)` / `arun(prompt)` | one turn, returns `Result` |
| `stream(prompt)` / `astream(prompt)` | one turn, returns `EventStream` |
| `history()` | the runtime's transcript as OpenAI-format messages (Deep Agents only) |
| `detach()` | parks the runtime and keeps the sandbox; returns `State` |
| `stop()` | stops the runtime but stays resumable; returns `State` |
| `close()` / `aclose()` | stops everything the session owns |

## `EventStream`

An iterator of `Event` (an async iterator from `aagent(..., stream=True)`). After it's exhausted, `.result` holds the `Result`.

## `State`

`state.dumps()` returns `bytes`, `State.loads(data)` returns a `State`, and `state.harness` tells you which harness it belongs to. It contains no credentials.

## `Capabilities`

```python
@dataclass(frozen=True)
class Capabilities:
    structured_output: bool
    tool_approval: bool
    tool_filtering: bool
    history: bool
    custom_tools: bool
    skills: bool
    resume: bool
    permission_modes: frozenset[str]
```
