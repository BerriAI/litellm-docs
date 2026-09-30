# Inferrail

[Inferrail](https://github.com/domondi1/inferrail) is an open-source, self-hosted OpenAI-compatible gateway that gives each agent run or job its own dollar budget. It can sit in front of a LiteLLM proxy you already run: your application talks to Inferrail, and Inferrail forwards to LiteLLM with your LiteLLM key.

Every call of a run carries the run's id and budget as headers. Each call reserves its estimated cost before it's forwarded; once the run's budget can't cover a call, that call gets HTTP 402 and never reaches LiteLLM. `inferrail work <run id>` prints the run's cost afterwards. No key or budget object has to be created per run.

`inferrail.yaml`:

```yaml
providers:
  litellm:
    type: openai_compatible
    base_url: http://localhost:4000/v1
    api_key_env: LITELLM_API_KEY   # a LiteLLM virtual key
    price_as: openai               # you assert these models bill at OpenAI list prices
    request_stream_usage: true     # ask LiteLLM for usage on streamed calls
routes:
  default: {provider: litellm, model: gpt-4o-mini}
default_provider: litellm
receipts: {sink: sqlite, path: ./receipts.db}
budgets: {enabled: true, path: ./budgets.db}
```

```bash
pip install inferrail
export LITELLM_API_KEY="sk-..."
inferrail serve --config inferrail.yaml   # http://127.0.0.1:8000/v1
```

In your application:

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="http://127.0.0.1:8000/v1",
    api_key="unused",  # the LiteLLM key stays in the gateway
    default_headers={
        "X-Inferrail-Attribute-Work-Id": "run-42",  # every call of this run
        "X-Inferrail-Budget-Usd": "0.50",           # the run's budget, created on first use
    },
)
```

```bash
inferrail work run-42 --config inferrail.yaml
```

If LiteLLM itself refuses a call because of its own budget, Inferrail returns `INFERRAIL_E014` (HTTP 402, not retried). Tested with LiteLLM 1.103.0. See the [per-run budget recipe](https://github.com/domondi1/inferrail/blob/main/docs/recipes/agent-run-budget.md?ref=litellm-docs) for the exact limits (reservations are estimates; set `max_tokens`).
