import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ScaleDown

LiteLLM supports [ScaleDown ↗](https://scaledown.xyz), which serves calibrated
classification, structured extraction, abstractive summarization, and prompt
compression. ScaleDown bills on input tokens and charges nothing for output
tokens.

| Property | Details |
|----------|---------|
| Description | Calibrated decisions, extraction, summarization, and prompt compression |
| Provider Route | `scaledown/` |
| Supported Endpoints | `/chat/completions` |
| API Reference | [ScaleDown docs ↗](https://docs.scaledown.xyz) |

## API Key

```python
import os

os.environ["SCALEDOWN_API_KEY"] = "your-scaledown-api-key"
```

ScaleDown authenticates with the `x-api-key` header rather than a bearer token;
LiteLLM handles that for you. Set `SCALEDOWN_API_BASE` if you point at a host
other than `https://api.scaledown.xyz/v1`.

## Supported Models

| Model | Description |
|-------|-------------|
| `scaledown/classify` | Typed decisions over a shared state object |
| `scaledown/decisions` | The same endpoint under its own name |
| `scaledown/extract` | Structured field extraction |
| `scaledown/summarize` | Abstractive summarization |
| `scaledown/compress` | Prompt and context compression |

Every model returns its result as a JSON string on
`choices[0].message.content`, so parse that to get the structured object.

## Decisions: `classify` and `decisions`

These two models implement the Jev Decisions API. Instead of a prompt, you send
the text to decide on plus a map of questions, and you get one typed answer per
question. Questions are answered concurrently, and each one is a separate
calibrated model call, so a request with three questions bills for three.

`questions` has no OpenAI-native field, so pass it as an extra parameter; the
Python SDK forwards unknown keyword arguments, and the OpenAI client takes them
through `extra_body`. The text comes from the last user message, or from an
explicit `state` object if you pass one.

There are three question types. A `choice` question picks exactly one option
from a `criteria` map of option key to description. A `noul` question answers an
independent yes/no question as a probability. A `score` question rates against
an ordered `criteria` list of 2 to 10 levels, lowest to highest, and answers
with a probability-weighted position on that scale, so a value like `1.43` means
the model leans toward level 2 without being decided between levels 1 and 2.

```python
import json
from litellm import completion

response = completion(
    model="scaledown/classify",
    messages=[{"role": "user", "content": "I was charged twice for my subscription this month."}],
    questions={
        "category": {
            "type": "choice",
            "instructions": "Which single category best describes the post?",
            "criteria": {
                "billing": "About a charge, invoice, refund, or payment problem.",
                "technical": "About a bug or something not working.",
                "account": "About login, access, or account settings.",
            },
        },
        "is_churn_risk": {
            "type": "noul",
            "instructions": "Does this text signal the customer may cancel or leave?",
        },
        "severity": {
            "type": "score",
            "instructions": "How severe is the reported issue?",
            "criteria": [
                "Cosmetic; no impact to functionality",
                "Broken or degraded feature, but workaround exists",
                "Blocking issue; no workaround exists",
            ],
        },
    },
)

answers = json.loads(response.choices[0].message.content)
print(answers["category"]["choice"], answers["category"]["confidence"])
print(answers["is_churn_risk"]["noul"])
print(answers["severity"]["score"])
```

A `choice` answer carries the chosen key, a probability per option, and the
chosen option's own probability as `confidence`. A `score` answer adds a
`legend` echoing your criteria back by level index. Because ScaleDown bills per
question, LiteLLM reports the cost ScaleDown returns rather than estimating it
from token counts.

To classify an image or a PDF instead of text, pass a `state` object with a
base64 `document` and its `document_mime_type`.

```python
response = completion(
    model="scaledown/classify",
    messages=[],
    state={"document": base64_pdf, "document_mime_type": "application/pdf"},
    questions={"is_invoice": {"type": "noul", "instructions": "Is this an invoice?"}},
)
```

## Extraction

`extract` takes its field definitions from the standard `response_format` JSON
schema. Each property name becomes a field and its `description` is the
extraction hint.

```python
response = completion(
    model="scaledown/extract",
    messages=[{"role": "user", "content": "Acme Corp invoiced $500 on 2024-01-05."}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "invoice",
            "schema": {
                "type": "object",
                "properties": {
                    "vendor": {"type": "string", "description": "company name"},
                    "amount": {"type": "string", "description": "dollar amount"},
                    "date": {"type": "string", "description": "invoice date"},
                },
            },
        },
    },
)
```

## Summarization

`summarize` is plain chat. The system message carries optional instructions, the
last user message carries the text, and `max_tokens` works as usual.

```python
response = completion(
    model="scaledown/summarize",
    messages=[
        {"role": "system", "content": "Be terse; one paragraph."},
        {"role": "user", "content": long_document},
    ],
    max_tokens=256,
)
```

## Usage with LiteLLM Proxy

### 1. Set ScaleDown models in config.yaml

```yaml
model_list:
  - model_name: scaledown-classify
    litellm_params:
      model: scaledown/classify
      api_key: "os.environ/SCALEDOWN_API_KEY" # ensure you have `SCALEDOWN_API_KEY` in your .env
  - model_name: scaledown-summarize
    litellm_params:
      model: scaledown/summarize
      api_key: "os.environ/SCALEDOWN_API_KEY"
```

### 2. Start proxy

```bash
litellm --config config.yaml
```

### 3. Query proxy

Assuming the proxy is running on [http://localhost:4000](http://localhost:4000):

```bash
curl http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LITELLM_MASTER_KEY" \
  -d '{
    "model": "scaledown-classify",
    "messages": [
      {
        "role": "user",
        "content": "I was charged twice for my subscription this month."
      }
    ],
    "questions": {
      "category": {
        "type": "choice",
        "criteria": {
          "billing": "About a charge, invoice, refund, or payment problem.",
          "technical": "About a bug or something not working."
        }
      }
    }
  }'
```

`-H "Authorization: Bearer YOUR_LITELLM_MASTER_KEY"` is only required if you have
set a LiteLLM master key

## Supported features

| Feature | Supported |
|---------|-----------|
| Cost tracking | Yes |
| Logging | Yes |
| Vision (documents on the decisions models) | Yes |
| Streaming | No |
| Function calling | No |

The decisions models take no sampling parameters, since everything they need
arrives through `state` and `questions`. Pass `litellm.drop_params = True` if
your caller sends parameters like `temperature` that ScaleDown does not accept.
