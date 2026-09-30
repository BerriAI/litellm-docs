---
title: Structured output
---

# Structured output

Pass a Pydantic model as `output=`. The runtime does its normal work, and its final answer is validated into `result.output`.

```python
from typing import Literal
from pydantic import BaseModel

class Review(BaseModel):
    verdict: Literal["approve", "request_changes"]
    issues: list[str]

r = litellm.agent(
    Harness.CLAUDE_CODE,
    "Review the staged diff.",
    output=Review,
    permissions="read-only",
    sandbox=box,
    model="litellm_proxy/coder",
)
r.output.verdict  # "request_changes"
```

| Harness | How the schema is enforced |
|---|---|
| `CLAUDE_CODE` | instruction to answer with one JSON object matching the schema, then validated |
| `CODEX` | Codex's native `--output-schema` |
| `OPENCODE` | instruction to answer with one JSON object matching the schema, then validated |
| `DEEPAGENTS` | `create_deep_agent(response_format=Review)` |

If validation fails, the call raises `OutputInvalid`. The exception carries `.raw` with the model's text and `.result` with the rest of the turn, so the work isn't lost.
