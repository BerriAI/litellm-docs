---
title: Permissions
---

# Permissions

`permissions=` takes a mode, and each harness sets up its permission behavior to match. The default is `"full"`. The sandbox only limits operations that run inside it; Python tools for Deep Agents and Tool Loop run in your process. Pass trusted functions and enforce any additional access rules they need

| Mode | Read files | Edit files | Shell and network |
|---|:-:|:-:|:-:|
| `"read-only"` | yes | no | no |
| `"edit"` | yes | yes | no |
| `"full"` (default) | yes | yes | yes |

## Harness support

If you ask for a mode the harness can't enforce, the call raises `CapabilityUnsupported` before the runtime starts. It never falls back to a looser mode.

| Harness | `read-only` | `edit` | `full` |
|---|:-:|:-:|:-:|
| `CLAUDE_CODE` | yes | yes | yes |
| `CODEX` | yes | no | yes |
| `OPENCODE` | yes | yes | yes |
| `DEEPAGENTS` | yes | yes | yes |
| `TOOL_LOOP` | no | no | yes |

## Approvals

The API also accepts `permissions="ask"` with an `on_approval` callback, or `Approval` events in a stream. The CLI harnesses don't support it in this release and raise `CapabilityUnsupported`. Deep Agents and Tool Loop support ask mode for custom Python tools. Check `litellm.agent_capabilities(harness).tool_approval` before depending on it

```python
from litellm.harness import Approval

def approve(a: Approval) -> bool:
    return a.tool == "bash" and a.input["command"].startswith("pytest")
```

A request nobody answers is denied, and so is one whose callback raises.
