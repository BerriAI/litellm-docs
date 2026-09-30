---
title: Sessions
---

# Sessions

A session keeps the runtime's working directory and native history alive between turns. `run()` and `stream()` create a session for one turn and close it afterwards. Use `session()` when you need more than one turn.

## Multi-turn

```python
with litellm.harness.session(Harness.CODEX, sandbox=box, model="coder") as s:
    s.run("Install dev deps.")
    s.run("Run the router unit tests and summarize failures.")
    r = s.run("Fix the first failure. Keep the diff small.")
    print(s.cost)  # running total across all turns
```

Options you pass to `session()` apply to every turn.

## Ending a session

| Method | Runtime | Sandbox | Resumable |
|---|---|---|---|
| `s.close()` | stopped | closed if the session created it | no |
| `s.detach()` returns `State` | parked | left running | yes |
| `s.stop()` returns `State` | stopped | closed if the session created it | yes |

Leaving a `with` block calls `close()` unless you already called `detach()` or `stop()`. If you passed in the sandbox, it belongs to you.

## Across processes

`State` holds the harness, the runtime's own session id, the working directory and the model. It never holds credentials. `state.dumps()` gives you bytes to store anywhere.

```python title="app.py"
from litellm.harness import Harness, State

@app.post("/chat/{chat_id}")
async def chat(chat_id: str, msg: str):
    raw = await redis.get(f"harness:{chat_id}")
    box = sandbox.docker("my-agents:latest", name=f"chat-{chat_id}")

    if raw:
        s = await litellm.harness.aresume(State.loads(raw), sandbox=box)
    else:
        s = await litellm.harness.asession(Harness.CLAUDE_CODE, sandbox=box, model="coder")

    async with s:
        r = await s.arun(msg)
        await redis.set(f"harness:{chat_id}", (await s.adetach()).dumps())
    return {"text": r.text, "cost": r.cost}
```

`resume()` raises `StateIncompatible` when the state came from a different harness or can't be read.

## History

```python
messages = s.history()  # OpenAI-format messages
```

Only Deep Agents supports history in this release. On the other harnesses `history()` raises `CapabilityUnsupported`.
