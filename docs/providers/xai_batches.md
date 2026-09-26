# xAI Batch API

LiteLLM routes the OpenAI-compatible `/v1/files` and `/v1/batches` endpoints to xAI's [Files](https://docs.x.ai/developers/files/managing-files) and [Batch](https://docs.x.ai/developers/advanced-api-usage/batch-api) APIs. xAI bills batch requests at a reduced rate, they do not count towards rate limits, and most batches finish within 24 hours on a best-effort basis. Not every xAI model accepts batch requests, so check xAI's model list before picking one

| Feature | Supported |
|---------|-----------|
| Upload, retrieve, list, delete files | ✅ |
| Download batch results | ✅ |
| Create, retrieve, list, cancel batches | ✅ |
| Cost tracking | ✅ per line, see [Cost tracking](#cost-tracking) |
| Python SDK | ✅ `custom_llm_provider="xai"` |

## 1. Add xAI to config.yaml

`files_settings` holds the credentials for `/v1/files` and `/v1/batches`. The `model_list` entry is what the lines inside the batch run on and what the spend is priced against:

```yaml
model_list:
  - model_name: grok-4.3
    litellm_params:
      model: xai/grok-4.3
      api_key: os.environ/XAI_API_KEY

files_settings:
  - custom_llm_provider: xai
    api_key: os.environ/XAI_API_KEY
```

## 2. Upload the batch input file

Each line is an OpenAI batch request. The file goes to xAI as is, so `model` inside `body` is the xAI model name, and the `url` picks the xAI endpoint for that line, so one file can mix chat completions, responses, image, and video requests:

```json
{"custom_id": "req-1", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "grok-4.3", "messages": [{"role": "user", "content": "What is the capital of France?"}], "max_tokens": 40}}
{"custom_id": "req-2", "method": "POST", "url": "/v1/chat/completions", "body": {"model": "grok-4.3", "messages": [{"role": "user", "content": "How many legs does a spider have?"}], "max_tokens": 40}}
```

A plain upload carries nothing to route on, so name the provider on the request:

```bash
curl "http://0.0.0.0:4000/v1/files?provider=xai" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -F purpose="batch" \
  -F file="@batch_input.jsonl"
```

xAI does not store a purpose, so every xAI file reads back with `purpose: batch`

## 3. Create the batch

```bash
curl "http://0.0.0.0:4000/v1/batches?provider=xai" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "<file id from step 2>",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'
```

xAI routes each line by its own `url`, so `endpoint` is echoed back rather than sent, and `completion_window` always reads `24h`

## 4. Poll the batch and download the results

```bash
curl "http://0.0.0.0:4000/v1/batches/<batch id>?provider=xai" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

xAI reports request counters instead of a status, so LiteLLM derives one: `validating` while xAI has not counted any requests yet, `in_progress` while some are still pending, `completed` once none are, `cancelled` when you cancelled it, and `failed` when xAI cancelled it (an input file that fails validation lands here, with xAI's message under `errors`). `created_at`, `expires_at`, and `cancelled_at` come back at day resolution, because xAI stores those dates without a time of day

xAI has no output file: results are read from the batch itself, so `output_file_id` is the batch id. Download them through the file content route:

```bash
curl "http://0.0.0.0:4000/v1/files/<batch id>/content?provider=xai" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

The response is OpenAI batch output JSONL, one line per request, with the result under `response.body` or the failure under `error`. xAI serves results in pages of 1000, which LiteLLM walks and joins before responding, so a large batch is held in memory while it downloads. Image and video results carry media URLs that xAI expires after one hour, so fetch those right away

## Listing, cancelling, and deleting

```bash
curl "http://0.0.0.0:4000/v1/files?provider=xai" \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl "http://0.0.0.0:4000/v1/batches" \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl -X POST "http://0.0.0.0:4000/v1/batches/<batch id>/cancel?provider=xai" \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl -X DELETE "http://0.0.0.0:4000/v1/files/<file id>?provider=xai" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

The file list walks every page xAI returns, and the batch list picks the provider up from `files_settings`. A deleted or expired file reads back as a 404

## Python SDK

`XAI_API_KEY` in the environment is enough:

```python
import litellm

with open("batch_input.jsonl", "rb") as fh:
    uploaded = litellm.create_file(file=fh, purpose="batch", custom_llm_provider="xai")

batch = litellm.create_batch(
    input_file_id=uploaded.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
    custom_llm_provider="xai",
)

batch = litellm.retrieve_batch(batch_id=batch.id, custom_llm_provider="xai")
if batch.status == "completed":
    results = litellm.file_content(file_id=batch.output_file_id, custom_llm_provider="xai")
    print(results.text)
```

`litellm.list_batches(custom_llm_provider="xai")` and `litellm.cancel_batch(batch_id=..., custom_llm_provider="xai")` cover the rest

## Cost tracking

When a completed xAI batch is retrieved, LiteLLM reads the usage on every result line, folds xAI's reasoning tokens into the completion tokens the way it does for synchronous xAI calls, and bills each line at the model's batch rates from the [model cost map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json): `input_cost_per_token_batches`, `output_cost_per_token_batches`, and `cache_read_input_token_cost_batches`, plus their `_above_200k_tokens` variants on the models whose price steps up past 200k tokens of context. xAI also reports `cost_in_usd_ticks` on every line (ten billion ticks to the dollar), which is a handy cross-check against the spend LiteLLM records

The spend is recorded the first time a completed batch is retrieved, on the key that created it, under the batch id with a `_batch_cost` suffix, and shows up on the `/spend/logs` routes and the Admin UI Logs page
