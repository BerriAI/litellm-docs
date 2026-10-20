# /v1/extraction

Extraction models read a text, and optionally images, and fill in the typed fields you name: a piece of text, a date, a number with a unit, a list, or an estimate with percentiles. Answers come with confidence scores or percentiles, and an answer's `value` is null when the input does not determine it. LiteLLM serves them on `POST /v1/extraction`, with `/extraction` as an alias

Ships in the next build after [BerriAI/litellm#47473](https://github.com/BerriAI/litellm/pull/47473) merges

| Feature | Supported | Notes |
|---------|-----------|-------|
| Cost tracking | Yes | Returned in the `x-litellm-response-cost` header and written to spend logs |
| Logging | Yes | The proxy logs the call with call type `aextraction` |
| Virtual keys | Yes | Normal proxy key auth, model access and key spend |
| Load balancing, fallbacks | Yes | Goes through the router like `/v1/decisions` |
| Guardrails | Yes | See [Guardrails](#guardrails) |
| Image input | Yes | Up to 4 images, see [Images](#images) |
| Streaming | No | `stream: true` answers 400, or is dropped under `drop_params` |

## Supported providers

| Provider | Model | Credentials | Images |
|----------|-------|-------------|--------|
| [Cloudflare Clairic](https://developers.cloudflare.com/workers-ai/models/clairic/) | `cloudflare/@cf/cloudflare/clairic` or `cloudflare/clairic` | `CLOUDFLARE_API_KEY` and `CLOUDFLARE_ACCOUNT_ID`, or `api_base` | Yes |

Both model names call the `@cf/cloudflare/clairic` run URL on Cloudflare. The key comes from `api_key` or `CLOUDFLARE_API_KEY`. The API base comes from `api_base`, then `CLOUDFLARE_API_BASE`, then `https://api.cloudflare.com/client/v4/accounts/<CLOUDFLARE_ACCOUNT_ID>/ai/run`. An `api_base` can be the account URL `https://api.cloudflare.com/client/v4/accounts/<account_id>`, with or without `/ai/run` or `/ai/v1` on the end. Without a key, or without an account ID or `api_base`, LiteLLM answers 400 before calling Cloudflare

## Proxy setup

1. Add Clairic to `config.yaml`

```yaml showLineNumbers
model_list:
  - model_name: clairic
    litellm_params:
      model: cloudflare/@cf/cloudflare/clairic
      api_key: os.environ/CLOUDFLARE_API_KEY
```

Set `CLOUDFLARE_ACCOUNT_ID` in the proxy environment, or add `api_base` to `litellm_params`. `model: cloudflare/clairic` is the short form and calls the same model

2. Start the proxy

```bash showLineNumbers
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

## Request

Pull five typed fields out of an invoice

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/extraction' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "clairic",
  "state": "Invoice #4471 from Example Hardware Co., dated March 3 2026. 12 hammers at $14.50 each, total $174.00. Payment due in 30 days.",
  "fields": {
    "vendor": {"type": "text", "instructions": "Who sent the invoice?"},
    "invoice_date": {"type": "date"},
    "total": {"type": "number", "decimals": 2, "unit": "USD"},
    "items": {"type": "list", "items": "text", "instructions": "What was bought?"},
    "days_to_pay": {"type": "estimate", "min": 0, "max": 90, "step": 1}
  }
}'
```

Response, with `x-litellm-response-cost: 4.34e-05`

```json
{
  "model": "clairic",
  "answers": {
    "vendor": {
      "type": "text",
      "value": "Example Hardware Co.",
      "guess": "Example Hardware Co.",
      "p_null": 0.0023696497082710266,
      "confidence": 0.9999986886978149,
      "span": [19, 39]
    },
    "invoice_date": {
      "type": "date",
      "value": "2026-03-03",
      "guess": "2026-03-03",
      "p_null": 5.612911877506122e-7,
      "confidence": 0.999993443524893
    },
    "total": {
      "type": "number",
      "value": 174,
      "guess": 174,
      "p_null": 1.6802375739644049e-6,
      "confidence": 0.9999543443624127
    },
    "items": {
      "type": "list",
      "value": ["12", "hammers"],
      "confidence": 0.35724303594103385,
      "spans": [[61, 63], [64, 71]]
    },
    "days_to_pay": {
      "type": "estimate",
      "value": 31,
      "mean": 30.776606032245052,
      "median": 30,
      "p10": 30,
      "p90": 34,
      "p_below": 1.2175848951301305e-6,
      "p_above": 1.0790414535222226e-6
    }
  },
  "truncated": false,
  "usage": {
    "input_tokens": 434,
    "output_tokens": 0,
    "state_tokens": 52,
    "image_tokens": 0,
    "schema_tokens": 330,
    "passes": 2
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | A proxy model name, or `<provider>/<model>` in the SDK |
| `state` | string | The text to read. Text answers are spans of it. It can be empty only when images are sent |
| `fields` | object | At least one named field. Each key becomes a key in `answers` |
| `images` | array, optional | Up to 4 images, see [Images](#images) |
| `reference_date` | string, optional | An ISO date that anchors dates written without a year |
| `options` | object, optional | `include_quantiles: true` adds 99 percentiles to estimates. `return_state_text: true` returns the text that spans index into |

A field name is 1 to 64 letters, digits, `_`, `.` or `-`, and starts with a letter or `_`. Every field has a `type` and takes an optional `instructions` saying what it should contain, and `null_threshold` sets the probability of null above which `value` is null

| `type` | Settings | Answer fields |
|--------|----------|---------------|
| `text` | None | `value`, `guess`, `p_null`, `confidence`, `span` |
| `date` | None | `value` and `guess` as ISO dates, `p_null`, `confidence` |
| `number` | `decimals` from 0 to 6, `unit`, `integer` | `value`, `guess`, `p_null`, `confidence` |
| `list` | `items` set to `text`, `number` or `date`, required | `value` as a list, `confidence`, `spans` |
| `estimate` | `min` and `max`, optional `step` and `scale` (`linear` or `log`) | `value`, `mean`, `median`, `p10`, `p90`, `p_below`, `p_above`, and `quantiles` with `include_quantiles` |

`span` is the start and end character offset of the answer in `state`, and `spans` holds one per list item. When `p_null` is above `null_threshold`, which defaults to 0.5, `value` is null and `guess` still holds the model's answer. LiteLLM also accepts the `time`, `datetime`, `duration` and `forecast` types and sends them to Cloudflare unchanged, see the [Clairic reference](https://developers.cloudflare.com/workers-ai/models/clairic/) for their settings

## Response

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | The model name you called |
| `answers` | object | One answer per field, keyed by field name, with the answer fields above |
| `truncated` | boolean | Clairic's truncation flag |
| `state_text` | string, optional | The text that spans index into, returned with `return_state_text` |
| `usage` | object | `input_tokens` and `output_tokens`, plus Clairic's `state_tokens`, `image_tokens`, `schema_tokens` and `passes` |

## Images

`images` takes up to 4 images, each a data URL or a `{"content_type": "image/png", "base64": "<BASE64_PNG>"}` object. Clairic does not take remote URLs, so LiteLLM answers 400 for an image URL that is not a data URL. Clairic reads PNG, JPEG and WebP images of up to 4 MiB each and 8 MiB in total, and Cloudflare checks those limits itself

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/extraction' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "clairic",
  "state": "See the attached receipt photo.",
  "images": ["data:image/png;base64,<BASE64_PNG>"],
  "fields": {
    "merchant": {"type": "text"},
    "total_due": {"type": "number", "unit": "USD"}
  }
}'
```

The answers come back in the same shape as for text, and `usage.image_tokens` counts the image

## Errors

LiteLLM checks the parts of the body it knows before calling Cloudflare

| Request | Status | From |
|---------|--------|------|
| Unknown field `type` | 400 | LiteLLM |
| Field name that breaks the naming rule | 400 | LiteLLM |
| `list` field without `items` | 400 | LiteLLM |
| No `fields`, or an empty `fields` | 400 | LiteLLM |
| Remote image URL | 400 | LiteLLM |
| More than 4 images | 400 | LiteLLM |
| `stream: true` without `drop_params` | 400 | LiteLLM |
| Missing key or account ID | 400 | LiteLLM |
| Key Clairic does not define | Cloudflare's status | Cloudflare |
| Estimate with `min` above `max` | Cloudflare's status | Cloudflare |
| Empty `state` and no images | Cloudflare's status | Cloudflare |

A `list` field without `items` gets

```json
{
  "error": {
    "message": "litellm.BadRequestError: Invalid Extraction request: 1 validation error for ExtractionRequestBody\nfields.items\n  Value error, list fields need items set to text, number or date [type=value_error, input_value={'type': 'list'}, input_type=dict]\n    For further information visit https://errors.pydantic.dev/2.13/v/value_error",
    "type": "invalid_request_error",
    "param": null,
    "code": "400"
  }
}
```

Everything else goes to Cloudflare as you sent it, with only `model` set to `clairic`. So a new Clairic option works without a LiteLLM release, and a rule only Cloudflare knows comes back with Cloudflare's status and message. An estimate with `min` 90 and `max` 0 gets

```json
{
  "error": {
    "message": "litellm.BadRequestError: CloudflareException - {\"errors\":[{\"message\":\"AiError: AiError: estimate days_to_pay needs finite min < max, got 90 and 0 (dda314d7-9961-487a-b138-0049bc36deae)\",\"code\":3030}],\"success\":false,\"result\":{},\"messages\":[]}\n\nLiteLLM: model group 'clairic' failed with the error above. No fallback was attempted.",
    "type": "invalid_request_error",
    "param": null,
    "code": "422"
  }
}
```

Clairic does not stream, so `stream: true` answers 400. With `drop_params: true` in the request, on the deployment or in `litellm_settings`, LiteLLM drops `stream` and the call is logged and billed like any other

## Guardrails

[Guardrails](./proxy/guardrails/quick_start.md) work on `/v1/extraction` and are set up the same way as on `/chat/completions`. On the way in they see `state` and each field's `instructions`. On the way out they see every answer `value` and `guess` that is a string or a list of strings, which covers text and date answers and text and date list items, plus `state_text`. Numeric answers are left alone

## Pricing

Clairic costs $0.10 per 1M input tokens, with no charge for output. LiteLLM bills `usage.input_tokens`, so the invoice request above read 434 input tokens and cost $0.0000434. Spend logs record `prompt_tokens` as the input tokens and `completion_tokens` as `output_tokens`, which Clairic reports as 0

## SDK usage

```python showLineNumbers
import os
import litellm

os.environ["CLOUDFLARE_API_KEY"] = ""
os.environ["CLOUDFLARE_ACCOUNT_ID"] = ""

response = litellm.extraction(
    model="cloudflare/@cf/cloudflare/clairic",
    state="Invoice #4471 from Example Hardware Co., dated March 3 2026. Total $174.00. Payment due in 30 days.",
    fields={"vendor": {"type": "text"}, "total": {"type": "number", "unit": "USD"}},
)
print("vendor:", response.answers["vendor"].value)
print("total:", response.answers["total"].value)
print("input_tokens:", response.usage.input_tokens)
print("response_cost:", response._hidden_params["response_cost"])
```

Output

```
vendor: Example Hardware Co.
total: 174
input_tokens: 300
response_cost: 2.9999999999999997e-05
```

The async version is `litellm.aextraction` and takes the same arguments

```python showLineNumbers
import asyncio
import os
import litellm

os.environ["CLOUDFLARE_API_KEY"] = ""
os.environ["CLOUDFLARE_ACCOUNT_ID"] = ""

async def main():
    response = await litellm.aextraction(
        model="cloudflare/clairic",
        state="Invoice #4471 from Example Hardware Co., dated March 3 2026. Total $174.00. Payment due in 30 days.",
        fields={"vendor": {"type": "text"}, "total": {"type": "number", "unit": "USD"}},
    )
    print(response.answers["vendor"].value)

asyncio.run(main())
```

Both functions take `model`, `fields`, `state`, `images`, `reference_date`, `options`, `api_key`, `api_base`, `timeout`, `custom_llm_provider` and `extra_headers`, and send any other keyword argument LiteLLM does not know to Cloudflare as it is. A model whose provider has no extraction support raises a `BadRequestError` that lists the supported providers. Through the Router, use `router.extraction` and `router.aextraction`
