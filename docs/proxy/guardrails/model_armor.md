import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Google Cloud Model Armor

LiteLLM supports Google Cloud Model Armor guardrails via the [Model Armor API](https://cloud.google.com/security-command-center/docs/model-armor-overview). 


## Supported Guardrails

- [Model Armor Templates](https://cloud.google.com/security-command-center/docs/manage-model-armor-templates) - Content sanitization and blocking based on configured templates

## Quick Start
### 1. Define Guardrails on your LiteLLM config.yaml 

Define your guardrails under the `guardrails` section

```yaml
model_list:
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: openai/gpt-3.5-turbo
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: model-armor-shield
    litellm_params:
      guardrail: model_armor
      mode: [pre_call, during_call, post_call]  # Run on input, parallel, and output
      template_id: "your-template-id"  # Required: Your Model Armor template ID
      project_id: "your-project-id"    # Your GCP project ID
      location: "us-central1"          # GCP location (default: us-central1)
      credentials: "path/to/credentials.json"  # Path to service account key
      mask_request_content: true       # Enable request content masking
      mask_response_content: true      # Enable response content masking
      fail_on_error: true             # Fail request if Model Armor errors (default: true)
      default_on: true                # Run by default for all requests
```

#### Supported values for `mode`

- `pre_call` Run **before** LLM call, on **input**
- `during_call` Run **in parallel** with LLM call, on **input**
- `post_call` Run **after** LLM call, on **output**

### 2. Start LiteLLM Gateway 


```shell
litellm --config config.yaml --detailed_debug
```

### 3. Test request 

**[Langchain, OpenAI SDK Usage Examples](../proxy/user_keys#request-format)**

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-npnwjPQciVRok5yNZgKmFQ" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hi, my email is test@example.com"}
    ],
    "guardrails": ["model-armor-shield"]
  }'
```

## Document and File Scanning

As of v1.92.0, Model Armor scans inline document attachments in addition to message text. On `pre_call` and `during_call`, LiteLLM resolves each attachment in the request messages to bytes and submits it to Model Armor's [byte API](https://cloud.google.com/security-command-center/docs/sanitize-prompts-responses) before the request reaches the LLM.

LiteLLM recognizes OpenAI `type: file` content blocks with inline `file_data` (a base64 data URI or raw base64) and Anthropic `type: document` blocks with an inline base64 `source`. The attachment's MIME type, declared `format`, or filename extension is mapped to a Model Armor `byteDataType`; PDF, Word, Excel, PowerPoint, CSV, and plain text documents are scanned. Inline content of types the byte API does not support, such as images, is not scanned and passes through.

```json
{
  "role": "user",
  "content": [
    {"type": "text", "text": "Summarize this document"},
    {"type": "file", "file": {"file_data": "data:application/pdf;base64,JVBERi0x...", "filename": "report.pdf"}}
  ]
}
```

A Model Armor finding on a document always blocks the request with an HTTP 400:

```json
{"error": "Content blocked by Model Armor", "model_armor_response": {"sanitizationResult": {"filterMatchState": "MATCH_FOUND"}}}
```

Masking never applies to documents. Model Armor returns findings for a document rather than a sanitized copy, so a match blocks even when `mask_request_content` is enabled.

### Attachments That Cannot Be Scanned

An attachment LiteLLM recognizes as a document but cannot submit for scanning fails closed: the request is blocked with an HTTP 400 unless you set `fail_on_error: false`.

| Case | Default (`fail_on_error: true`) | With `fail_on_error: false` |
|------|--------------------------------|------------------------------|
| `file_id` or remote URL reference (`http://`, `https://`, `gs://`) with no inline bytes | Blocked | Passes through unscanned |
| Document larger than Model Armor's 4 MB limit | Blocked | Passes through unscanned |
| More than 10 attachments in one request | Blocked | First 10 scanned, rest pass through unscanned |
| Inline base64 that fails to decode | Blocked | Passes through unscanned |
| Model Armor API error while scanning an attachment | Blocked | Attachment skipped, remaining attachments still scanned |

Blocked requests return the reason:

```json
{"error": "Model Armor could not scan an attachment and blocked the request: attachment of 5242880 bytes exceeds Model Armor's 4194304 byte scan limit"}
```

## Supported Params 

### Common Params

- `api_key` - str - Google Cloud service account credentials (optional if using ADC)
- `api_base` - str - Custom Model Armor API endpoint (optional)
- `default_on` - bool - Whether to run the guardrail by default. Default is `false`.
- `mode` - Union[str, list[str]] - Mode to run the guardrail. Supported values: `pre_call`, `during_call`, `post_call`. Default is `pre_call`.

### Model Armor Specific

- `template_id` - str - The ID of your Model Armor template (required)
- `project_id` - str - Google Cloud project ID (defaults to credentials project)
- `location` - str - Google Cloud location/region. Default is `us-central1`
- `credentials` - Union[str, dict] - Path to service account JSON file or credentials dictionary
- `api_endpoint` - str - Custom API endpoint for Model Armor (optional)
- `fail_on_error` - bool - Whether to fail requests if Model Armor encounters errors, including attachments it cannot scan (see [Document and File Scanning](#document-and-file-scanning)). Default is `true`
- `mask_request_content` - bool - Enable masking of sensitive content in requests. Default is `false`
- `mask_response_content` - bool - Enable masking of sensitive content in responses. Default is `false`


## Further Reading

- [Control Guardrails per API Key](./quick_start#-control-guardrails-per-api-key)
