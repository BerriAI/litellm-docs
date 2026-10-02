---
title: Supported harnesses
sidebar_label: Supported harnesses
---

# Supported harnesses

This release supports four runtimes. Each one is driven through its own programmatic interface, never by scraping a terminal.

```python
from enum import Enum

class Harness(Enum):
    CLAUDE_CODE = "claude_code"
    CODEX = "codex"
    OPENCODE = "opencode"
    DEEPAGENTS = "deepagents"
```

`Harness` is a plain `Enum`. A `StrEnum` member would compare equal to its string and let `"codex"` through, so `litellm.agent()` and the other entry points check `isinstance(harness, Harness)` and raise `TypeError` otherwise.

## Capabilities

| Capability | Claude Code | Codex | OpenCode | Deep Agents |
|---|:-:|:-:|:-:|:-:|
| Any gateway model group | yes | yes | yes | yes |
| Cost tracking | yes | yes | yes | yes |
| Skills | yes | yes | yes | yes |
| Structured output | yes | yes | yes | yes |
| Detach and resume | yes | yes | yes | yes |
| Built-in tool filtering (`disable_tools=`) | yes | no | yes | yes |
| Custom Python tools (`tools=`) | no | no | no | yes |
| History (`s.history()`) | no | no | no | yes |
| Permission modes | `read-only`, `edit`, `full` | `read-only`, `full` | `read-only`, `edit`, `full` | `read-only`, `edit`, `full` |

`permissions="ask"` with interactive approval isn't available on the CLI harnesses in this release. Asking a harness for something it doesn't support raises `CapabilityUnsupported` before the runtime starts, and it never falls back to a looser mode. You can read the same table in code.

```python
caps = litellm.agent_capabilities(Harness.CODEX)
caps.tool_filtering     # False
caps.permission_modes   # frozenset({'read-only', 'full'})
```

## How each one is driven

| Harness | Driven through | Speaks to its model | Runs in | Needs in sandbox |
|---|---|---|---|---|
| `CLAUDE_CODE` | `claude -p --output-format stream-json` | Anthropic Messages | sandbox | `claude` |
| `CODEX` | `codex exec --json` | OpenAI Responses | sandbox | `codex` |
| `OPENCODE` | `opencode run --format json` | OpenAI Chat Completions | sandbox | `opencode` |
| `DEEPAGENTS` | `deepagents` Python API | LangChain chat model | your process | nothing |

The runtime binaries aren't installed for you in this release. Put them in your sandbox image, or on your `PATH` for `sandbox.local`. If the binary is missing, the call raises `HarnessInstallFailed` naming it.

Every harness takes a typed options class for settings that only make sense for that runtime. Passing another harness's options raises `OptionsMismatch`.

```python
from litellm import Harness, CodexOptions

litellm.agent(
    Harness.CODEX, task, sandbox=box,
    options=CodexOptions(reasoning_effort="high"),
)
```
