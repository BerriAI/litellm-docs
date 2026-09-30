---
title: Tools and skills
sidebar_label: Tools and skills
---

# Tools and skills

## Turning off built-in tools

```python
litellm.agent(Harness.CLAUDE_CODE, task, sandbox=box, model="litellm_proxy/coder", disable_tools=["web_search", "bash"])
```

Use the normalized names from [Events](./events.md#tool-names). Codex can't filter its built-in tools, so this raises `CapabilityUnsupported` there.

## Custom tools

Custom Python tools are supported on Deep Agents in this release. They're plain functions that run in your process.

```python
from typing import Literal

def lookup_owner(path: str) -> str:
    """Return the CODEOWNERS entry for a file path."""
    return codeowners.match(path)

async def open_ticket(title: str, body: str, severity: Literal["low", "high"]) -> str:
    """File a ticket in the tracker. Returns the ticket URL."""
    return await tracker.create(title=title, body=body, severity=severity)

litellm.agent(
    Harness.DEEPAGENTS,
    "Triage the failing test and file a ticket.",
    tools=[lookup_owner, open_ticket],
    sandbox=box,
    model="litellm_proxy/coder",
)
```

The type hints and docstring become the tool's schema. Passing `tools=` to Claude Code, Codex or OpenCode raises `CapabilityUnsupported`.

## Skills

A skill is a local folder containing a `SKILL.md` and any files it needs. Pass folder paths, and the adapter copies each one into the sandbox where the runtime looks for skills.

```python
litellm.agent(Harness.CLAUDE_CODE, "Ship the fix.", sandbox=box, model="litellm_proxy/coder", skills=["./skills/release-checklist"])
```

| Harness | Installed to |
|---|---|
| `CLAUDE_CODE` | `.claude/skills/<name>/` in the working directory |
| `CODEX` | `$CODEX_HOME/skills/<name>/` |
| `OPENCODE` | `.opencode/skill/<name>/` in the working directory |
| `DEEPAGENTS` | passed to the agent |

Skills are copied once when the session starts.
