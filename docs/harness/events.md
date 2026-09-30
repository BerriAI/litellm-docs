---
title: Events
---

# Events

`litellm.agent(..., stream=True)` yields eight kinds of event. Each adapter translates its runtime's native events into these.

```python
from litellm.harness import (
    Text, Reasoning, ToolCall, ToolResult, FileChange, Compaction, Approval, Done,
)

for event in litellm.agent(Harness.CLAUDE_CODE, "Add type hints to utils.py", sandbox=box, model="litellm_proxy/coder", stream=True):
    match event:
        case Text(delta=d):
            print(d, end="")
        case Reasoning():
            pass
        case ToolCall(name=name, input=args):
            log.info("tool %s %s", name, args)
        case ToolResult(is_error=True, output=out):
            log.warning("tool failed: %s", out)
        case ToolResult():
            pass
        case FileChange(kind=kind, path=path):
            changed.append(path)
        case Compaction():
            pass
        case Approval() as a:
            a.allow() if a.tool == "read" else a.deny("read-only review")
        case Done(cost=cost):
            print(f"\n${cost:.4f}")
```

That `match` has no `case _`. `Event` is a closed union, so mypy and pyright both treat it as exhaustive.

| Event | Fields | Notes |
|---|---|---|
| `Text` | `delta` | Assistant text, streamed. |
| `Reasoning` | `delta` | Only when the model and the harness emit it. |
| `ToolCall` | `id`, `name`, `native_name`, `input`, `builtin` | `builtin` is `False` for your own `tools=`. |
| `ToolResult` | `id`, `output`, `is_error` | Paired with `ToolCall.id`. |
| `FileChange` | `path`, `kind`, `diff` | `kind` is `"created"`, `"modified"` or `"deleted"`. `diff` is a unified diff for text files up to 256 KB, else `None`. |
| `Compaction` | `tokens_before`, `tokens_after` | The runtime summarized its own history. |
| `Approval` | `tool`, `input`, `allow()`, `deny(reason)` | Only from harnesses with tool approval. |
| `Done` | `result`, `usage`, `cost`, `stop_reason` | Always the last event, exactly once. |

`FileChange` events come from diffing a sandbox snapshot taken before and after each turn, so edits appear even when the runtime doesn't report them as a tool call.

## Tool names

Built-in tools that do the same thing get the same `name` on every harness, so UI code doesn't need a branch per runtime. `native_name` always has the runtime's original name.

| `name` | Claude Code | Codex | OpenCode | Deep Agents |
|---|---|---|---|---|
| `read` | `Read` | | `read` | `read_file` |
| `write` | `Write` | | `write` | `write_file` |
| `edit` | `Edit` | | `edit` | `edit_file` |
| `bash` | `Bash` | command execution | `bash` | `execute` |
| `glob` | `Glob` | | `glob` | `glob` |
| `grep` | `Grep` | | `grep` | `grep` |
| `ls` | `LS` | | `list` | `ls` |
| `web_search` | `WebSearch` | web search | `webfetch` | |

Tools that aren't in this table keep their native name in `name`.

## Stream result

```python
stream = litellm.agent(Harness.OPENCODE, prompt, sandbox=box, model="litellm_proxy/coder", stream=True)
for event in stream:
    render(event)
result = stream.result  # the same Result the Done event carries
```
