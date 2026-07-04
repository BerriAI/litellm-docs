import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Budget Fallbacks

:::info

Available on `v1.92.x` and later.

:::

Reroute requests to a fallback model when a key's [`model_max_budget`](./users#-virtual-key-model-specific) is exceeded, instead of returning a `budget_exceeded` error.

By default `model_max_budget` blocks requests once a key's spend on a model crosses its cap. `budget_fallbacks` lets you configure a per-model fallback chain on the key itself, so the request is silently rerouted to the first fallback that still has budget remaining. Spend is attributed to the fallback model, not the exhausted one.

This is a virtual key setting; it does not require any changes to `config.yaml` or router-level fallbacks.

## When it triggers

The fallback is applied when all of the following hold:

The key has `model_max_budget` configured for the requested model, and the accumulated spend on that model has crossed its `budget_limit`. The key also has an entry in `budget_fallbacks` for the requested model. The first fallback in the chain that is itself within budget (either because it has no `model_max_budget` entry, or its cap has not been reached) is chosen; if every fallback is over budget, the original `BudgetExceededError` is raised.

Router-level fallbacks (`fallbacks: [{model: [...]}]` in `config.yaml`) are unaffected and continue to run on downstream provider errors. `budget_fallbacks` only applies to the per-key `model_max_budget` check inside the auth layer.

## Quick Start

### 1. Generate a key with a per-model budget and a fallback chain

```bash
curl 'http://0.0.0.0:4000/key/generate' \
  --header 'Authorization: Bearer sk-1234' \
  --header 'Content-Type: application/json' \
  --data '{
    "model_max_budget": {
      "anthropic-haiku-4-5": {"budget_limit": 0.01, "time_period": "1d"}
    },
    "budget_fallbacks": {
      "anthropic-haiku-4-5": ["gpt-5.5"]
    }
  }'
```

`budget_fallbacks` is a `Dict[str, List[str]]` keyed by the primary model name. The value is the ordered fallback chain for that model.

### 2. Send a request

Point the client at the primary model as usual:

```bash
curl 'http://0.0.0.0:4000/v1/chat/completions' \
  --header 'Authorization: Bearer <sk-generated-key>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "anthropic-haiku-4-5",
    "messages": [{"role": "user", "content": "hello"}]
  }'
```

While the key is under its `anthropic-haiku-4-5` cap the request runs on `anthropic-haiku-4-5`. Once the cap is crossed subsequent requests are transparently served by `gpt-5.5` without any `budget_exceeded` error surfacing to the caller.

### 3. Confirm the reroute

`/spend/logs?api_key=<sk-generated-key>` will attribute the post-fallback usage to `gpt-5.5` (both the deployment and the `model_group`), so cost tracking, tagging, and per-model budgets remain accurate.

## Chained fallbacks

Each list entry is tried in order; the first fallback still within its own `model_max_budget` wins. This means you can define a tiered chain that steps down through progressively cheaper or higher-limit models:

```bash
curl 'http://0.0.0.0:4000/key/generate' \
  --header 'Authorization: Bearer sk-1234' \
  --header 'Content-Type: application/json' \
  --data '{
    "model_max_budget": {
      "gpt-5":         {"budget_limit": 5.0,  "time_period": "1d"},
      "gpt-5-mini":    {"budget_limit": 2.0,  "time_period": "1d"},
      "gpt-5-nano":    {"budget_limit": 1.0,  "time_period": "1d"}
    },
    "budget_fallbacks": {
      "gpt-5": ["gpt-5-mini", "gpt-5-nano"]
    }
  }'
```

A request for `gpt-5` stays on `gpt-5` until it exhausts $5/day, then rolls to `gpt-5-mini` until that key hits $2/day, then rolls to `gpt-5-nano`. If `gpt-5-nano` is also over its $1/day cap the request finally returns `budget_exceeded`.

Fallbacks that are not present in `model_max_budget` are treated as unlimited from the budget check's point of view and will always be selected if reached.

## Updating an existing key

Use `/key/update` to change the fallback chain without regenerating the key:

```bash
curl 'http://0.0.0.0:4000/key/update' \
  --header 'Authorization: Bearer sk-1234' \
  --header 'Content-Type: application/json' \
  --data '{
    "key": "sk-generated-key",
    "budget_fallbacks": {"anthropic-haiku-4-5": ["gpt-5.5", "gpt-5-nano"]}
  }'
```

## Related

[Virtual Key model_max_budget](./users#-virtual-key-model-specific), [Fallback Management endpoints](./fallback_management), [Reliability and fallbacks](./reliability).
