import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mistral - Batch + Files API

Run Mistral's Batch API through LiteLLM, including OCR batches, which Mistral bills at half the synchronous per-page price.

| Feature | Supported |
|---------|-----------|
| `/v1/files` | ✅ |
| `/v1/batches` | ✅ create, retrieve |
| `/v1/ocr` as a batch endpoint | ✅ |
| Cost Tracking | ✅ per page for OCR, per token for chat and embeddings |

| Property | Details |
|----------|---------|
| Provider Doc | [Mistral Batch Inference ↗](https://docs.mistral.ai/capabilities/batch/) |
| Batch endpoints | `/v1/ocr`, `/v1/chat/completions`, `/v1/embeddings` |

## Quick Start

### 1. Setup config.yaml

Point a deployment at the Mistral model the batch should run on. The model is set on the batch job, so every line of the input file runs on this deployment.

```yaml showLineNumbers title="litellm_config.yaml"
model_list:
  - model_name: mistral-ocr
    litellm_params:
      model: mistral/mistral-ocr-latest
      api_key: os.environ/MISTRAL_API_KEY
```

### 2. Start LiteLLM Proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Create the batch input file

Each line is one request to the batch's endpoint. For OCR, `body` is a `/v1/ocr` request and the document goes inline as a URL or a base64 data URI. There is no separate document upload step; the only file you upload is this JSONL.

`method` and `url` are required by the proxy's batch file validation. Mistral accepts and ignores them.

```json showLineNumbers title="ocr_batch.jsonl"
{"custom_id": "doc-1", "method": "POST", "url": "/v1/ocr", "body": {"document": {"type": "document_url", "document_url": "https://arxiv.org/pdf/2201.04234"}}}
{"custom_id": "doc-2", "method": "POST", "url": "/v1/ocr", "body": {"document": {"type": "document_url", "document_url": "data:application/pdf;base64,JVBERi0xLjQK..."}, "pages": [0, 1]}}
```

Do not put `model` in `body`; the job's model wins. Optional OCR parameters such as `pages`, `include_image_base64` and `table_format` go inside `body` next to `document`.

### 4. Upload the file

Pass `model` so the upload uses that deployment's credentials and the returned file id stays bound to it. Every later call with that id routes to the same deployment without repeating the model.

<Tabs>
<TabItem value="curl" label="Curl">

```bash showLineNumbers title="Upload File"
curl http://localhost:4000/v1/files \
  -H "Authorization: Bearer sk-1234" \
  -F purpose="batch" \
  -F model="mistral-ocr" \
  -F file="@ocr_batch.jsonl"
```

</TabItem>
<TabItem value="python" label="Python">

```python showLineNumbers title="mistral_batch.py"
from openai import OpenAI

client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-1234")

batch_input_file = client.files.create(
    file=open("ocr_batch.jsonl", "rb"),
    purpose="batch",
    extra_body={"model": "mistral-ocr"},
)
print(batch_input_file.id)
```

</TabItem>
</Tabs>

### 5. Create the batch

Set `endpoint` to `/v1/ocr` for OCR, or `/v1/chat/completions` and `/v1/embeddings` for those request types.

<Tabs>
<TabItem value="curl" label="Curl">

```bash showLineNumbers title="Create Batch"
curl http://localhost:4000/v1/batches \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file-bGl0ZWxsbTo...",
    "endpoint": "/v1/ocr",
    "completion_window": "24h",
    "model": "mistral-ocr"
  }'
```

</TabItem>
<TabItem value="python" label="Python">

```python showLineNumbers title="mistral_batch.py"
batch = client.batches.create(
    input_file_id=batch_input_file.id,
    endpoint="/v1/ocr",
    completion_window="24h",
    extra_body={"model": "mistral-ocr"},
)
print(batch.id, batch.status)
```

</TabItem>
</Tabs>

A freshly created batch reports `status: validating` and `request_counts.total: 0`. Mistral fills in the counts once validation finishes, so a zero total on a new batch does not mean the file was empty.

### 6. Retrieve the batch and download results

Poll until `status` is `completed`, then download `output_file_id`. The output is JSONL in the OpenAI batch shape, so the same parsing code works across providers.

<Tabs>
<TabItem value="curl" label="Curl">

```bash showLineNumbers title="Retrieve and Download"
curl http://localhost:4000/v1/batches/batch_bGl0ZWxsbTo... \
  -H "Authorization: Bearer sk-1234"

curl http://localhost:4000/v1/files/{output_file_id}/content \
  -H "Authorization: Bearer sk-1234" \
  -o ocr_output.jsonl
```

</TabItem>
<TabItem value="python" label="Python">

```python showLineNumbers title="mistral_batch.py"
import json, time

while True:
    batch = client.batches.retrieve(batch.id)
    if batch.status in ("completed", "failed", "cancelled", "expired"):
        break
    time.sleep(5)

result = client.files.content(batch.output_file_id)
for line in result.text.strip().splitlines():
    record = json.loads(line)
    body = record["response"]["body"]
    print(record["custom_id"], body["usage_info"]["pages_processed"], "pages")
    for page in body["pages"]:
        print(page["markdown"])
```

</TabItem>
</Tabs>

**Output format**

```json
{
  "id": "1-3e9bf486-...",
  "custom_id": "doc-1",
  "response": {
    "status_code": 200,
    "body": {
      "model": "mistral-ocr-latest",
      "pages": [{"index": 0, "markdown": "...", "images": [], "dimensions": {"dpi": 200, "height": 2200, "width": 1700}}],
      "usage_info": {"pages_processed": 22, "doc_size_bytes": 6984814}
    }
  },
  "error": null
}
```

## Status mapping

| Mistral status | LiteLLM / OpenAI status |
|----------------|-------------------------|
| `QUEUED` | `validating` |
| `RUNNING` | `in_progress` |
| `SUCCESS` | `completed` |
| `FAILED` | `failed` |
| `TIMEOUT_EXCEEDED` | `expired` |
| `CANCELLATION_REQUESTED` | `cancelling` |
| `CANCELLED` | `cancelled` |

## Cost tracking

When a retrieve returns a completed batch, LiteLLM reads the output file and prices every successful line. OCR lines carry `usage_info.pages_processed` instead of token usage and are billed per page at `ocr_cost_per_page_batches` from the model cost map, which is half the synchronous `ocr_cost_per_page`. Annotation pages use `annotation_cost_per_page_batches` the same way. Chat and embedding lines are priced per token at the provider's batch rates.

For example, a batch of three one-page documents on `mistral-ocr-latest` logs `$0.006` (3 pages at `$0.002`), where the same three documents through `/v1/ocr` cost `$0.012`.

The spend log row for the batch has `call_type: aretrieve_batch`, a request id of `<batch_id>_batch_cost`, and `batch_successful_requests` / `batch_failed_requests` in its metadata. Models without a `*_batches` price fall back to the synchronous per-page rate.

## Model access

The model behind a batch is read from the `model` field, the `x-litellm-model` header, or the model encoded in a file or batch id, none of which appear in a chat request body. LiteLLM checks that model against the caller's key, team, organization and project allowlists before resolving the deployment's credentials, so a key that is not granted `mistral-ocr` gets `403 key_model_access_denied` on upload, create, retrieve, content download and delete for that deployment.

## SDK usage

```python showLineNumbers title="mistral_batch_sdk.py"
import litellm

file_obj = litellm.create_file(
    file=open("ocr_batch.jsonl", "rb"),
    purpose="batch",
    custom_llm_provider="mistral",
)

batch = litellm.create_batch(
    completion_window="24h",
    endpoint="/v1/ocr",
    input_file_id=file_obj.id,
    custom_llm_provider="mistral",
    model="mistral/mistral-ocr-latest",
)

retrieved = litellm.retrieve_batch(
    batch_id=batch.id,
    custom_llm_provider="mistral",
    model="mistral/mistral-ocr-latest",
)
```

`model` is required on `create_batch` and `retrieve_batch` for Mistral, the same as Bedrock, because it selects the provider config that builds the Mistral request.

## Limitations

Listing and cancelling batches are not wired for Mistral yet; use the Mistral console or API for those. Uploads accept only the purposes Mistral has (`batch`, `fine-tune`, `ocr`); any other OpenAI purpose is rejected with a 400 rather than being rewritten to `batch`, so the proxy's batch-file validation and guardrails cannot be skipped. A file uploaded with Mistral's `ocr` purpose reads back through `/v1/files` as `purpose: user_data`, since the OpenAI purpose set has no `ocr` value. Mistral returns `402 You do not have access to this service` on batch creation until batch billing is enabled on the workspace, which is a Mistral console setting and independent of the API key.

## Further reading

- [Mistral Batch Inference](https://docs.mistral.ai/capabilities/batch/)
- [Mistral OCR](https://docs.mistral.ai/capabilities/document_ai/basic_ocr)
- [/ocr endpoint](../ocr)
- [/batches endpoint](../batches)
