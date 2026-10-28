# eu/jev

:::info
Available from v1.109.0.
:::

Pass-through endpoint for the [eu/jev](https://eu-jev.com/docs) decision API. eu/jev is hosted in the EU and runs System One inference on its server in Germany, where prompts and responses are processed and not stored, so the data you send stays in Germany. It returns typed decisions (a choice, a score, or a yes/no probability) instead of text, and it takes the same System One request body as [TypeSafe](./typesafe.md).

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ✅ | Priced from the response `usage` and the model registry |
| Logging | ✅ | works across all integrations |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ❌ | Not offered by the eu/jev API |

Just replace `https://eu-jev.com` with `LITELLM_PROXY_BASE_URL/eu_jev`. Only `POST /eu_jev/v1/systemone` is forwarded, and other eu/jev paths answer 404.

LiteLLM adds the eu/jev API key from the proxy environment, so clients only need a LiteLLM virtual key. With no eu/jev key configured, the route answers 503. The pass-through `custom_body` field is rejected with a 400, so eu/jev always receives the body the virtual key was checked against.

## Quick Start

1. Set the eu/jev API key in the proxy environment.

```bash showLineNumbers
export EU_JEV_API_KEY=""
# optional, defaults to https://eu-jev.com
export EU_JEV_API_BASE="https://eu-jev.com"
```

2. Start the proxy.

```bash showLineNumbers
litellm

# RUNNING on http://0.0.0.0:4000
```

3. Ask eu/jev a question through the proxy.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/eu_jev/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "eu-jeff-latest",
  "state": "I was charged twice. Can I get a refund?",
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": {
        "billing": "Payments, invoices, and refunds",
        "support": "Technical issues and bugs"
      }
    }
  }
}'
```

The response is eu/jev's own, unchanged:

```json
{
  "model": "eu-jeff-1.0.0",
  "answers": {
    "team": {
      "type": "choice",
      "choice": "billing",
      "confidence": 0.9,
      "probabilities": {"billing": 0.95, "support": 0.05}
    }
  },
  "usage": {"input_tokens": 64, "output_tokens": 0},
  "meta": {
    "request_id": "8febf2e9-1643-4446-a7cf-7fc3bcf2b391",
    "mode": "live",
    "latency_ms": 180,
    "cost_eur": "0.000002368"
  }
}
```

A request carries a `state`, either a string of up to 100,000 characters or a JSON object or array, and one to eight named `questions`. Each question is a `choice` between 2 and 64 options, a `noul` that returns the probability the answer is yes, or a `score` on an ordered scale of 2 to 10 levels. `eu-jeff-latest` follows the current release and `eu-jeff-1.0.0` pins it. [See the eu/jev API reference](https://eu-jev.com/docs).

## Virtual Keys and Rate Limits

A virtual key needs access to `eu_jev/<model>`, for example `eu_jev/eu-jeff-latest` or `eu_jev/*`. A request without `model`, and the older names `jeff-latest` and `jeff-1.0.0`, count as `eu_jev/eu-jeff-latest`. A `model_rpm_limit` on the key applies to that same name.

A key that only lists a proxy model name or an access group gets a 403 on `/eu_jev/v1/systemone`. Give it `eu_jev/eu-jeff-latest` as well, or call the proxy model through `/v1/systemone` as shown below.

## Config and Admin UI Models

eu/jev is also a [decisions](../decisions.md) provider, so a model from the config or from the Admin UI's Add Model tab answers on `POST /v1/systemone` and, in the OpenAI format, on `POST /v1/decisions`.

```yaml showLineNumbers
model_list:
  - model_name: eu-jev
    litellm_params:
      model: eu_jev/eu-jeff-latest
      api_key: os.environ/EU_JEV_API_KEY
```

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "eu-jev",
  "state": "I was charged twice. Can I get a refund?",
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": {
        "billing": "Payments, invoices, and refunds",
        "support": "Technical issues and bugs"
      }
    }
  }
}'
```

When that model also sets `use_in_pass_through: true`, `/eu_jev/v1/systemone` uses its `api_key`, and its `api_base` when set, instead of `EU_JEV_API_KEY` and `EU_JEV_API_BASE`.

## Cost Tracking

Spend uses `usage.input_tokens` and `usage.output_tokens` from the response and the `eu_jev/<model>` entry in LiteLLM's model registry (`eu-jeff-1.0.0`, `eu-jeff-latest`). eu/jev only bills input tokens, so output tokens are free. The request is logged under the versioned model eu/jev reports, for example `eu_jev/eu-jeff-1.0.0`, even when the request used the `eu-jeff-latest` alias.

LiteLLM books spend from the registry price. `meta.cost_eur` in the response is eu/jev's own charge in euros and is passed through unchanged.
