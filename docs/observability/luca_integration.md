---
title: "Luca Accounting for LiteLLM AI Gateway"
sidebar_label: "Luca"
description: "Send LiteLLM AI Gateway cost, team and customer data to Luca for cost of revenue by customer, month-end accruals, invoice matching and ERP entries."
---

# Luca

[Luca](https://luca.network) does the accounting for LLM spend. It takes the cost, team and customer of each call from the LiteLLM proxy and gives the finance team cost of revenue by customer, month-end accruals for usage not yet invoiced, matching against each provider's invoice, and journal entries for the ERP.

Luca keeps only the cost fields of each call. Turn off message logging so prompts and responses aren't sent at all.

## Quick start

1. In Luca, add a **LiteLLM AI gateway** connection. Luca shows the connection's webhook URL. Give the connection an ingest token, for example from `openssl rand -hex 32`.

2. Set two environment variables on the proxy:

```shell
LUCA_LITELLM_URL="https://<your Luca address>/v1/hooks/litellm/<connection id>"
LUCA_LITELLM_TOKEN="<the ingest token>"
```

3. Add Luca to the proxy's `config.yaml`:

```yaml
litellm_settings:
  callbacks: ["luca"]
  turn_off_message_logging: true
```

4. Start the proxy and send a request:

```shell
litellm --config config.yaml

curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-5.5", "messages": [{"role": "user", "content": "hi"}], "user": "customer_42"}'
```

Luca receives successful calls in batches. Each call's customer comes from the request's `user` field or from the key or team the call was made with.

## SDK

```python
import os
import asyncio
import litellm
from litellm.integrations.generic_api.generic_api_callback import GenericAPILogger

os.environ["LUCA_LITELLM_URL"] = "https://<your Luca address>/v1/hooks/litellm/<connection id>"
os.environ["LUCA_LITELLM_TOKEN"] = "<the ingest token>"
litellm.turn_off_message_logging = True

async def main():
    litellm.callbacks = [GenericAPILogger(callback_name="luca")]
    await litellm.acompletion(
        model="gpt-5.5",
        messages=[{"role": "user", "content": "hi"}],
        metadata={"user_api_key_end_user_id": "customer_42"},
    )

asyncio.run(main())
```

In the SDK, set the customer with `user_api_key_end_user_id` in `metadata`.

## What Luca reads

The time, provider, model, cost and token counts of each call, with the team, key, user, project, customer, tags and MCP server LiteLLM records with it. Luca keeps calls for 45 days and turns each finished day into accounting entries.

## Without sending prompts at all

For a proxy where message logging has to stay on for another tool, the `luca-litellm` package on PyPI drops the prompt, response and tool arguments before anything is sent:

```shell
pip install luca-litellm
```

```yaml
litellm_settings:
  callbacks: ["luca_litellm.handler"]
```

It uses the same two environment variables.
