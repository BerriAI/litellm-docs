# ScaleDown

Use [ScaleDown](https://scaledown.ai) to classify text, extract fields, summarize documents supplied as text, or compress prompts. LiteLLM calls ScaleDown's native APIs and returns the result through `/chat/completions`.

This integration supports text inputs. Image and file inputs are rejected because their billing is not covered by the text rate below.

## Set your API key

Get a key from the [ScaleDown dashboard](https://scaledown.ai/dashboard), then set it in the shell where you run LiteLLM:

```bash
export SCALEDOWN_API_KEY="your-scaledown-api-key"
pip install litellm
```

LiteLLM sends the key in the `x-api-key` header to `https://api.scaledown.xyz`. You can also pass `api_key` to `completion`. For a custom host, set `SCALEDOWN_API_BASE`. A per-call `api_base` requires an explicit `api_key` so the adapter does not send an environment key to an unrelated host. A trailing `/v1` on the base URL is accepted.

## Supported models

| Model | Required input | Native endpoint |
|-------|----------------|-----------------|
| `scaledown/classify` | User text and `labels` | `/classify` |
| `scaledown/extract` | User text and a non-strict `response_format` schema | `/extract` |
| `scaledown/summarize` | User text | `/summarization/abstractive` |
| `scaledown/decisions` | User text and `questions` | `/v1/scaledown` |
| `scaledown/compress` | User prompt and earlier context messages | `/compress/raw/` |

Each model returns a JSON string in `choices[0].message.content`. Parse it with `json.loads`. Classification, summarization, and compression return their native response objects. Extraction returns the requested fields. Decisions returns the `answers` object. The Python SDK also preserves the full upstream payload in `response._hidden_params["scaledown_response"]`.

## Classification

Pass a list of labels, each with a `name` and a `rubric`. The adapter sends the last user message as the text to classify.

```python
import json
from litellm import completion

response = completion(
    model="scaledown/classify",
    messages=[{"role": "user", "content": "My server has been down for three hours."}],
    labels=[
        {"name": "urgent", "rubric": "Service is unavailable."},
        {"name": "routine", "rubric": "A question or cosmetic issue."},
    ],
)

result = json.loads(response.choices[0].message.content)
print(result["top_label"])
print(result["scores"])
```

Expect `urgent` as the top label for this example. Use `scaledown/decisions` if you need the separate question-based API described below.

## Extraction

Describe the fields to extract with a JSON schema. Property names become entity names, and descriptions become extraction hints. Nested objects, arrays of objects, and local `$ref` definitions are supported.

Nullable fields can use `anyOf` or `oneOf` with one schema and one `null` branch. Keep each field's type, properties, and items inside the non-null branch or referenced definition. LiteLLM returns HTTP 400 for sibling schema definitions, `allOf`, and unions with multiple non-null branches.

```python
import json
from litellm import completion

response = completion(
    model="scaledown/extract",
    messages=[{"role": "user", "content": "Invoice from Northwind. Total: $500."}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "invoice",
            "strict": False,
            "schema": {
                "type": "object",
                "properties": {
                    "vendor": {"type": "string", "description": "company name"},
                    "amount": {"type": "string", "description": "total invoice amount"},
                },
            },
        },
    },
)

fields = json.loads(response.choices[0].message.content)
print(fields)
```

The content includes fields such as `vendor` and `amount`. For a scalar field with multiple matches, LiteLLM uses ScaleDown's first match, which the provider orders by confidence. Fields with no match may be absent. The adapter removes provider-added span anchors and value wrappers. The full payload retains the matches, confidences, and spans.

**The schema describes what to extract. It does not guarantee JSON Schema validation.** ScaleDown may return a number for a field described as a string, omit a required field, or return a value outside an enum. Validate the result in your application. LiteLLM rejects `strict: true`, including strict schemas generated from Pydantic models, before making an upstream call.

You can pass `threshold` and `top_n` as extra parameters. Put extraction instructions in property descriptions. System messages are not supported for extraction.

## Summarization

The last user message contains the source text. A system message can supply summary instructions. Use `max_tokens` or `max_completion_tokens` to limit the summary length.

```python
import json
from litellm import completion

response = completion(
    model="scaledown/summarize",
    messages=[
        {"role": "system", "content": "Summarize in one sentence."},
        {
            "role": "user",
            "content": "The team shipped the billing fix on Monday. Error rates fell. A follow-up review is scheduled for Friday.",
        },
    ],
    max_tokens=64,
)

print(json.loads(response.choices[0].message.content)["summary"])
```

## Use the LiteLLM proxy

Install the proxy dependencies and save this as `config.yaml`:

```bash
pip install 'litellm[proxy]'
```

```yaml
model_list:
  - model_name: scaledown-classify
    litellm_params:
      model: scaledown/classify
      api_key: os.environ/SCALEDOWN_API_KEY
  - model_name: scaledown-extract
    litellm_params:
      model: scaledown/extract
      api_key: os.environ/SCALEDOWN_API_KEY
  - model_name: scaledown-summarize
    litellm_params:
      model: scaledown/summarize
      api_key: os.environ/SCALEDOWN_API_KEY
```

Start the proxy in the shell where you set `SCALEDOWN_API_KEY`:

```bash
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
printf 'Local proxy key: %s\n' "$LITELLM_MASTER_KEY"
litellm --config config.yaml --host 127.0.0.1 --port 4000
```

In another terminal, set `LITELLM_API_KEY` to the key generated above and send a classification request:

```bash
curl http://127.0.0.1:4000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "scaledown-classify",
    "messages": [{"role": "user", "content": "My server has been down for three hours."}],
    "labels": [
      {"name": "urgent", "rubric": "Service is unavailable."},
      {"name": "routine", "rubric": "A question or cosmetic issue."}
    ]
  }'
```

Expect HTTP 200 and a JSON string containing `top_label` and `scores` in `choices[0].message.content`. For an existing proxy, use a LiteLLM key authorized for this model. The ScaleDown key belongs on the proxy.

When using the OpenAI Python client, pass `labels` through `extra_body={"labels": [...]}`. The same applies to `questions`, `threshold`, `top_n`, and `compression_rate`. Text belongs in `messages`; native `text`, `state`, and document overrides are rejected.

## Decisions

`scaledown/decisions` calls ScaleDown's Decisions API with the upstream model `classify-1`. Supply the text in the last user message and a `questions` map. A `choice` question selects a key from a criteria map. A `noul` question returns a yes/no probability. A `score` question uses an ordered list of two to ten criteria, lowest to highest.

```python
import json
from litellm import completion

response = completion(
    model="scaledown/decisions",
    messages=[{"role": "user", "content": "I was charged twice for my subscription this month."}],
    questions={
        "category": {
            "type": "choice",
            "criteria": {"billing": "A charge or refund.", "technical": "A bug."},
        }
    },
)

print(json.loads(response.choices[0].message.content)["category"]["choice"])
```

Expect `billing` for this example. Put question instructions inside `questions`; classification and Decisions do not support system messages. Decisions reports input usage across the questions in the request.

## Compression

`scaledown/compress` sends earlier messages as `context` and the last user message as `prompt`. Pass `compression_rate` as `"auto"` or a number between zero and one.

```python
import json
from litellm import completion

response = completion(
    model="scaledown/compress",
    messages=[
        {"role": "system", "content": "The team shipped a billing fix. Error rates fell after the release."},
        {"role": "user", "content": "What changed after the release?"},
    ],
    compression_rate="auto",
)

print(json.loads(response.choices[0].message.content)["results"]["compressed_prompt"])
```

## Cost and supported features

The registered text rate is **$0.05 per million input tokens**, with no charge for output. LiteLLM calculates cost from reported input usage and its model price map. The Decisions API's `usage.cost` is not used as a billing override. A request with 232 input tokens costs $0.0000116 at this rate.

Classification, extraction, summarization, and compression report input token counts but no output token count. LiteLLM returns `completion_tokens: 0` for those operations because output usage is unmeasured. Decisions reports output tokens, which LiteLLM preserves.

| Feature | Support |
|---------|---------|
| Sync and async calls | Yes |
| Cost tracking and logging | Yes |
| Text content arrays | Yes |
| Streaming | Simulated after the upstream response completes |
| Images and files | No |
| Strict JSON schemas | No |
| Function calling | No |

For streaming usage, send `stream_options={"include_usage": True}`. The adapter rejects unsupported sampling parameters such as `temperature`; use `drop_params=True` if your caller needs LiteLLM to discard them. Missing labels, questions, or extraction field definitions return a request error before the adapter contacts ScaleDown.
