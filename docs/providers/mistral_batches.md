# Mistral AI Batch API

LiteLLM routes the OpenAI-compatible `/v1/files` and `/v1/batches` endpoints to Mistral's [Files](https://docs.mistral.ai/api/#tag/files) and [Batch](https://docs.mistral.ai/api/#tag/batch) APIs. A Mistral batch job runs one model for every line of the input file, so the model is picked once, on the file upload or the batch request, instead of per line. The job can target `/v1/chat/completions` or `/v1/ocr`, and OCR pages inside a batch are billed at Mistral's batch rate.

| Feature | Supported |
|---------|-----------|
| Upload, retrieve, list, delete files | ✅ |
| Download file content | ✅ |
| Create and retrieve batches | ✅ |
| List and cancel batches | Not yet |
| Cost tracking for batch OCR | ✅ per page, see [Batch OCR cost tracking](#batch-ocr-cost-tracking) |

## 1. Add a Mistral model to config.yaml

```yaml
model_list:
  - model_name: mistral-ocr
    litellm_params:
      model: mistral/mistral-ocr-latest
      api_key: os.environ/MISTRAL_API_KEY
```

## 2. Upload the batch input file

Each line is an OpenAI batch request. For OCR the `url` is `/v1/ocr` and the `body` is a Mistral OCR request:

```json
{"custom_id": "doc-0", "method": "POST", "url": "/v1/ocr", "body": {"document": {"type": "document_url", "document_url": "https://arxiv.org/pdf/2201.04234"}}}
{"custom_id": "doc-1", "method": "POST", "url": "/v1/ocr", "body": {"document": {"type": "document_url", "document_url": "https://arxiv.org/pdf/2201.04234"}}}
```

Pass `model` with the upload so LiteLLM sends the file with that deployment's credentials and encodes the model into the returned file id. Every later call that carries the id reuses it.

```bash
curl http://0.0.0.0:4000/v1/files \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -F purpose="batch" \
  -F model="mistral-ocr" \
  -F file="@ocr_batch_input.jsonl"
```

Mistral accepts the `batch`, `fine-tune`, and `ocr` purposes. LiteLLM maps `user_data` onto `ocr`, and any other purpose (`assistants`, `vision`, `evals`) is rejected with a 400 because Mistral has no equivalent.

## 3. Create the batch

`endpoint` is `/v1/ocr` for OCR jobs or `/v1/chat/completions` for chat jobs. The `model` is read from the encoded file id, so sending it again is optional.

```bash
curl http://0.0.0.0:4000/v1/batches \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-bGl0ZWxsbTo1YTJm...",
    "endpoint": "/v1/ocr",
    "completion_window": "24h",
    "model": "mistral-ocr"
  }'
```

Mistral has no `completion_window`; the value is accepted and echoed back as `24h`.

## 4. Poll the batch and download the output

```bash
curl http://0.0.0.0:4000/v1/batches/batch_bGl0ZWxsbTo1YzU4... \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Mistral's job statuses map onto the OpenAI ones: `QUEUED` -> `validating`, `RUNNING` -> `in_progress`, `SUCCESS` -> `completed`, `FAILED` -> `failed`, `TIMEOUT_EXCEEDED` -> `expired`, `CANCELLATION_REQUESTED` -> `cancelling`, `CANCELLED` -> `cancelled`. Once the status is `completed`, download `output_file_id`:

```bash
curl http://0.0.0.0:4000/v1/files/file-bGl0ZWxsbToyNjE0.../content \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Each output line carries the OCR response under `response.body`, including `usage_info.pages_processed`.

## Listing files

A file id that LiteLLM encoded carries its own routing, but a plain list has no id to route on, so name the provider on the request:

```bash
curl "http://0.0.0.0:4000/v1/files?provider=mistral&purpose=batch" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

OCR files read back with `purpose=user_data`, and files created by other Mistral products with a purpose the upload endpoint does not accept (`playground`, `audio`, and similar) also read back as `user_data`, so an unfiltered list never fails on them.

## Batch OCR cost tracking

When a batch that targets `/v1/ocr` completes, LiteLLM reads `usage_info.pages_processed` and `usage_info.pages_processed_annotation` from every line of the output file and bills each page at the model's batch rate. The rates come from the [model cost map](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json):

| Key | Used for |
|-----|----------|
| `ocr_cost_per_page_batches` | OCR pages inside a batch |
| `annotation_cost_per_page_batches` | Annotation pages inside a batch |
| `ocr_cost_per_page` | Synchronous `/v1/ocr` calls, and the fallback when no batch rate is set |
| `annotation_cost_per_page` | Synchronous annotation pages, and the fallback when no batch rate is set |

The batch rates for `mistral/mistral-ocr-latest` are half the synchronous per-page rates, matching Mistral's 50% batch discount. To bill at a different rate, set the keys on the deployment's `model_info`, which wins over the cost map for that deployment:

```yaml
model_list:
  - model_name: mistral-ocr
    litellm_params:
      model: mistral/mistral-ocr-latest
      api_key: os.environ/MISTRAL_API_KEY
    model_info:
      ocr_cost_per_page_batches: 0.002
      annotation_cost_per_page_batches: 0.0025
```

The spend is recorded the first time a completed batch is retrieved, on the key that created it, under the batch id with a `_batch_cost` suffix, and shows up on the `/spend/logs` routes and the Admin UI Logs page.
