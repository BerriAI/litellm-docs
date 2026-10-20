import Image from '@theme/IdealImage';

# /v1/decisions and /v1/systemone

Decision models answer typed questions about an input and return probabilities instead of text: a yes/no probability, a pick from a fixed list, a score on a scale, or on TypeSafe Jev 1.14 a box around something in an image. LiteLLM serves them on two routes that share one provider list, so any decision model in your `model_list` works on either route

| Route | Alias | Request format | Use it when |
|-------|-------|----------------|-------------|
| `POST /v1/decisions` | `/decisions` | OpenAI Decisions: `input` plus a list of `predicate`, `choice`, `score` and `box` questions | You write against OpenAI's format |
| `POST /v1/systemone` | `/systemone` | [System One](https://docs.typesafe.ai/api): `state` plus a map of `noul`, `choice`, `score` and `box` questions | You already have TypeSafe Jev request bodies |

Available in `v1.104.2` and later on the `1.104.x` line and in `v1.105.0-rc.3` and later. `v1.106.0-dev.1` served the System One format at `/v1/decisions` and had no `/v1/systemone` route, so on that build send those bodies to `/v1/decisions`. Databricks and Microsoft Foundry landed on `main` after `v1.106.0-dev.3` and ship in the next build. Image input on Cloudflare Clef ships in `v1.107.0-rc.1` and later. TypeSafe images, `box` questions and the `TypeSafe-Danger-Zone-*` headers ship in the next build.

Extraction models such as Cloudflare Clairic, which fill in typed fields like dates, numbers and lists instead of answering questions, are served on [/v1/extraction](./extraction.md).

| Feature | Supported | Notes |
|---------|-----------|-------|
| Cost tracking | Yes | Returned in the `x-litellm-response-cost` header and written to spend logs |
| Logging | Yes | Works across all integrations |
| Virtual keys, budgets, rate limits | Yes | Normal proxy key auth |
| Load balancing, fallbacks | Yes | Goes through the router like `/chat/completions` |
| Image input | OpenAI, Cloudflare Clef and TypeSafe | TypeSafe needs the `TypeSafe-Danger-Zone-Images: true` header. Other providers return a 400, or drop the images under `drop_params` |
| Streaming | No | |

## Supported providers

| Provider | Example model | Credentials | LiteLLM endpoint | Images |
|----------|---------------|-------------|------------------|--------|
| [OpenAI](https://developers.openai.com/api/docs/guides/decisions) | `openai/gpt-6-luna` | `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` | `/v1/decisions` | Yes |
| [TypeSafe Jev](https://docs.typesafe.ai/api) | `typesafe/jev-latest` | `TYPESAFE_API_KEY`, optional `TYPESAFE_API_BASE` | `/v1/systemone` | With the [images header](#typesafe-images-box-questions-and-long-context) |
| [Fireworks AI](https://docs.fireworks.ai) (private preview) | `fireworks_ai/accounts/fireworks/routers/rune` | `FIREWORKS_AI_API_KEY` or `FIREWORKS_API_KEY`, optional `FIREWORKS_API_BASE` | `/v1/systemone` | No |
| [Perplexity](https://docs.perplexity.ai/docs/decisions/quickstart) | `perplexity/pplx-decider-v1-27b` | `PERPLEXITYAI_API_KEY` or `PERPLEXITY_API_KEY`, optional `PERPLEXITY_API_BASE` | `/v1/systemone` | No |
| [Cloudflare Clef](https://developers.cloudflare.com/workers-ai/models/clef/) | `cloudflare/clef` or `cloudflare/clef-flash` | `CLOUDFLARE_API_KEY` and `CLOUDFLARE_ACCOUNT_ID`, or `api_base` | `/v1/systemone` | Yes |
| [Databricks](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_decide) | `databricks/databricks-openjev-qwen35-4b` | `DATABRICKS_API_KEY` or `DATABRICKS_TOKEN`, `DATABRICKS_API_BASE` required | `/v1/systemone` | No |
| [Databricks `ai_decide`](./providers/databricks.md#decisions-ai_decide) | `databricks/ai_decide` | `DATABRICKS_API_KEY` or `DATABRICKS_TOKEN`, `DATABRICKS_API_BASE` required | `/v1/systemone` | No |
| [Microsoft Foundry](https://ai.azure.com/catalog/models/Microsoft-Decision-1) | `azure_ai/<deployment>` with `base_model: azure_ai/Microsoft-Decision-1` | `AZURE_AI_API_KEY`, `AZURE_AI_API_BASE` required | `/v1/systemone` | No |
| [Strands Decider](./providers/strands_decider.md) (self-hosted) | `strands_decider/strands-decider-2B-hobson-v19` | `STRANDS_DECIDER_API_BASE` required, `STRANDS_DECIDER_API_KEY` optional | `/v1/systemone` | No |
| [vLLM](https://docs.vllm.ai/en/latest/serving/online_serving/structured_decisions.html) (self-hosted) | `hosted_vllm/Qwen/Qwen3-0.6B` | `HOSTED_VLLM_API_BASE` or `api_base` required, `HOSTED_VLLM_API_KEY` optional | `/v1/systemone` | No |
| [Laya](https://github.com/NandhaKishorM/laya) (self-hosted) | `laya/english`, `laya/multilingual` or `laya/typed-decisions` | `api_base` or `LAYA_API_BASE` required, `LAYA_API_KEY` optional | `/v1/systemone` | No |
| [Bespoke Nimble](https://github.com/bespokelabsai/nimble) (self-hosted) | `bespoke/nimble` on Ollama, else `bespoke/nimble-latest` or `bespoke/bespokelabs/Bespoke-Nimble-9B` | `api_base` or `BESPOKE_API_BASE` required, `BESPOKE_API_KEY` optional | `/v1/systemone` | No |

LiteLLM translates between the two formats, so the route you call does not limit which provider you can use. OpenAI receives OpenAI-format bodies and every other provider receives System One bodies, and the answers come back in the format of the route you called. Text parts of an OpenAI `input` are joined into the System One `state`, and System One questions are named by their keys when they go to OpenAI

Cloudflare model names without an `@cf/` prefix are expanded to `@cf/cloudflare/<model>`, and the `{"result": ...}` envelope Cloudflare returns is unwrapped so the response has the same shape as the other providers. On Databricks the model is the bare serving endpoint name and `DATABRICKS_API_BASE` points at `https://<workspace-host>/serving-endpoints`, so the request goes to that endpoint's `/invocations` route. `databricks/ai_decide` instead calls the `ai_decide` AI Function at `/api/2.0/ai-functions/ai-decide` on the same workspace, which needs the `ai_decide` preview turned on and reports no token usage. On Microsoft Foundry the model is your deployment name and `AZURE_AI_API_BASE` is the resource host, `https://<resource>.services.ai.azure.com`. A project-scoped base such as `https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1` is trimmed back to the host. Azure does not let you name a deployment `Microsoft-Decision-1`, so deploy it under another name and set `base_model` so cost tracking finds the price

```yaml showLineNumbers
model_list:
  - model_name: decision-1
    litellm_params:
      model: azure_ai/decision-1
      api_base: https://<resource>.services.ai.azure.com
      api_key: os.environ/AZURE_AI_API_KEY
    model_info:
      base_model: azure_ai/Microsoft-Decision-1
```

[Strands Decider](./providers/strands_decider.md) has no default host, so set `STRANDS_DECIDER_API_BASE` or pass `api_base`. vLLM answers only `choice` questions, serves Qwen3 and Qwen3.5 models, and needs a vLLM build that includes [vllm-project/vllm#59299](https://github.com/vllm-project/vllm/pull/59299), which landed after v0.31.0

## Self-hosted Laya and Nimble

[Laya](https://github.com/NandhaKishorM/laya) and [Bespoke Nimble](https://github.com/bespokelabsai/nimble) are decision models that you host yourself. From a build containing [LiteLLM #45260](https://github.com/BerriAI/litellm/pull/45260) they are providers for `/v1/decisions` and `/v1/systemone`, and you can add them from the Admin UI under Models + Endpoints, Add Model, with Mode set to `Decisions - /v1/decisions`. Earlier builds serve them only on their own gateway routes

| Model | Gateway route | Server settings |
|-------|---------------|-----------------|
| Laya | `/laya/v1/systemone` | `LAYA_API_BASE`, optional `LAYA_API_KEY` |
| Bespoke Nimble | `/bespoke/v1/systemone` | `BESPOKE_API_BASE`, optional `BESPOKE_API_KEY` |

A `laya/*` or `bespoke/*` deployment takes only the model names in the provider table above, and any other name answers 400 before a request leaves the proxy. Ollama serves Nimble as `bespoke/nimble`. The API base must be an HTTP or HTTPS URL without credentials, a query, or a fragment. `LAYA_API_KEY` and `BESPOKE_API_KEY` go only to a deployment whose `api_base` is `LAYA_API_BASE` or `BESPOKE_API_BASE`, ignoring a trailing `/` or `/v1`, and an `api_key` set on the deployment always wins. Both are priced at $0 because you pay for the hardware, so set Custom Pricing on the deployment to track spend

Laya, Nimble and Jev can also pick the model tier for Auto Router. For request examples and the classifier setup, see [Call a native decision API](./auto_router/decision_classifiers.md#call-a-native-decision-api)

## Proxy setup

1. Add decision models to `config.yaml`

```yaml showLineNumbers keep-model-ids
model_list:
  - model_name: luna
    litellm_params:
      model: openai/gpt-6-luna
      api_key: os.environ/OPENAI_API_KEY
  - model_name: jev
    litellm_params:
      model: typesafe/jev-latest
      api_key: os.environ/TYPESAFE_API_KEY
```

2. Start the proxy

```bash showLineNumbers
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

## /v1/decisions

Ask one question of each type in the OpenAI format

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/decisions' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "luna",
  "input": [
    {
      "type": "message",
      "role": "user",
      "content": [
        {"type": "input_text", "text": "Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today."}
      ]
    }
  ],
  "questions": [
    {"type": "predicate", "name": "is_refund_request", "instructions": "Is the customer asking for a refund?"},
    {
      "type": "choice",
      "name": "needs_human",
      "instructions": "Should a human agent take over?",
      "choices": [{"value": true, "description": "billing dispute that needs a person"}, {"value": false}]
    },
    {
      "type": "score",
      "name": "frustration",
      "instructions": "How frustrated is the customer?",
      "levels": [{"label": "calm"}, {"label": "mildly annoyed"}, {"label": "angry", "description": "uses hostile language"}]
    }
  ]
}'
```

Response

```json keep-model-ids
{
  "model": "gpt-6-luna",
  "answers": [
    {"type": "predicate", "name": "is_refund_request", "probability": 1.0},
    {
      "type": "choice",
      "name": "needs_human",
      "choice": true,
      "probabilities": [{"value": true, "probability": 0.99}, {"value": false, "probability": 0.01}],
      "confidence": 0.98
    },
    {
      "type": "score",
      "name": "frustration",
      "score": 0.74,
      "probabilities": [
        {"value": 0, "label": "calm", "probability": 0.26},
        {"value": 1, "label": "mildly annoyed", "probability": 0.74},
        {"value": 2, "label": "angry", "probability": 0.0}
      ],
      "confidence": 0.61
    }
  ],
  "usage": {
    "input_tokens": 401,
    "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
    "output_tokens": 0,
    "output_tokens_details": {"reasoning_tokens": 0},
    "total_tokens": 401
  }
}
```

Changing `"model"` to `"jev"` sends the same questions to TypeSafe and returns the same shape

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | A proxy model name, or `<provider>/<model>` in the SDK |
| `input` | string or array | A string, or messages shaped like `{"type": "message", "role": "user", "content": ...}`. `content` is a string or a list of `input_text` and `input_image` parts |
| `questions` | array | 1 to 128 questions. Answers come back in the same order |
| `safety_identifier` | string, optional | A stable ID for your end user. Sent to OpenAI. Other providers return a 400, or drop it under `drop_params` |

Every question takes `instructions` and an optional `name` that is echoed in its answer

| `type` | Extra fields | Answer fields |
|--------|--------------|---------------|
| `predicate` | None | `probability` that the answer is yes |
| `choice` | `choices`: 2 to 255 entries of `{"value": string or boolean, "description": optional}` | `choice`, `probabilities` per value, `confidence` |
| `score` | `levels`: 2 to 10 entries of `{"label": ..., "description": optional}`, lowest first | `score` (the probability-weighted level index), `probabilities` per level, `confidence` |
| `box` | None. TypeSafe `jev-1.14.0` and `jev-preview` only, with the [images header](#typesafe-images-box-questions-and-long-context) | `box` with `top`, `bottom`, `left` and `right`, `confidence` |

A question the model will not answer comes back as `{"type": "refusal", "name": ...}`

### Image input

OpenAI, Cloudflare Clef and TypeSafe models take `input_image` parts, TypeSafe only with the [images header](#typesafe-images-box-questions-and-long-context). `image_url` is an image URL or a data URL, and `detail` is optional and only used by OpenAI.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/decisions' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "luna",
  "input": [
    {
      "type": "message",
      "role": "user",
      "content": [
        {"type": "input_text", "text": "Here is the swatch the customer uploaded."},
        {"type": "input_image", "image_url": "data:image/png;base64,<BASE64_PNG>", "detail": "low"}
      ]
    }
  ],
  "questions": [
    {"type": "predicate", "name": "is_red", "instructions": "Is the swatch mostly red?"},
    {
      "type": "choice",
      "name": "color",
      "instructions": "Which color dominates the swatch?",
      "choices": [{"value": "red"}, {"value": "green"}, {"value": "blue"}]
    }
  ],
  "safety_identifier": "user-1234"
}'
```

Response for a solid red square

```json keep-model-ids
{
  "model": "gpt-6-luna",
  "answers": [
    {"type": "predicate", "name": "is_red", "probability": 1.0},
    {
      "type": "choice",
      "name": "color",
      "choice": "red",
      "probabilities": [
        {"value": "red", "probability": 1.0},
        {"value": "green", "probability": 0.0},
        {"value": "blue", "probability": 0.0}
      ],
      "confidence": 1.0
    }
  ],
  "usage": {
    "input_tokens": 277,
    "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
    "output_tokens": 0,
    "output_tokens_details": {"reasoning_tokens": 0},
    "total_tokens": 277
  }
}
```

Changing `"model"` to `"clef"` sends the image to Cloudflare. Cloudflare does not take `safety_identifier`, so remove that field or turn on `drop_params`. The same swatch then returns

```json
{
  "model": "clef",
  "answers": [
    {"type": "predicate", "name": "is_red", "probability": 0.995},
    {
      "type": "choice",
      "name": "color",
      "choice": "red",
      "probabilities": [
        {"value": "red", "probability": 0.9908},
        {"value": "green", "probability": 0.0043},
        {"value": "blue", "probability": 0.0049}
      ],
      "confidence": 0.9727
    }
  ],
  "usage": {
    "input_tokens": 289,
    "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
    "output_tokens": 0,
    "output_tokens_details": {"reasoning_tokens": 0},
    "total_tokens": 289
  }
}
```

Before calling Cloudflare, LiteLLM downloads image URLs into data URLs and checks Clef's limits: at most 4 images per request, each a PNG, JPEG or WebP of at most 4 MiB, and 8 MiB in total. A request over a limit gets a 400 before Cloudflare is called. With `drop_params` on, images of another type are dropped instead, and the 4-image limit counts only the images that are left. Cloudflare receives the text parts joined into `state` and the images as a separate list, so the model does not see which text sat next to which image.

Other providers do not take images, and TypeSafe takes them only with the images header. So the same request with `"model": "jev"`, no `safety_identifier` and no images header is rejected before TypeSafe is called.

```json
{
  "error": {
    "message": "litellm.UnsupportedParamsError: typesafe does not support parameters: ['input_image'], for model=typesafe/jev-latest. To drop these, set `litellm.drop_params=True` or for proxy:\n\n`litellm_settings:\n drop_params: true`\n\n\nLiteLLM: model group 'jev' failed with the error above. No fallback was attempted.",
    "type": "invalid_request_error",
    "param": null,
    "code": "400"
  }
}
```

With `drop_params: true` in `litellm_settings` or on the deployment, LiteLLM drops the images and sends only the text. A request that has no text left after the drop still gets a 400.

## /v1/systemone

The same kind of request in the System One format

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "jev",
  "state": "Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
  "questions": {
    "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
    "urgency": {
      "type": "choice",
      "instructions": "How urgent is this?",
      "criteria": {"low": "can wait a week", "high": "needs action today"}
    },
    "frustration": {
      "type": "score",
      "instructions": "How frustrated is the customer?",
      "criteria": ["calm", "mildly annoyed", "angry"]
    }
  }
}'
```

Response

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "is_refund_request": {"type": "noul", "noul": 0.99},
    "urgency": {
      "type": "choice",
      "choice": "high",
      "confidence": 1.0,
      "probabilities": {"low": 0.0, "high": 1.0}
    },
    "frustration": {
      "type": "score",
      "score": 0.95,
      "confidence": 0.86,
      "legend": {"0": "calm", "1": "mildly annoyed", "2": "angry"},
      "probabilities": {"0": 0.07, "1": 0.91, "2": 0.02}
    }
  },
  "usage": {"input_tokens": 391, "output_tokens": 67}
}
```

Changing `"model"` to `"luna"` asks OpenAI instead and still returns System One answers keyed by question name

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | A proxy model name, or `<provider>/<model>` in the SDK |
| `state` | string, object or array | The thing being judged, such as a support ticket, a document or a chat transcript |
| `questions` | object | 1 to 128 named questions. Each key becomes a key in `answers` |
| `images` | array, optional | Image URLs or data URLs. OpenAI and Cloudflare Clef only, with the rules in [Image input](#image-input) |
| `assets` | object, optional | Images keyed by a name you use in `state`, each `{"type": "image", "format": "png", "jpg" or "jpeg", "data_base64": ...}`. TypeSafe only, with the [images header](#typesafe-images-box-questions-and-long-context) |

Every question has a `type` and an optional `instructions` field. Extra fields on a question are forwarded to System One providers unchanged

| `type` | `criteria` | Answer fields |
|--------|------------|---------------|
| `noul` | Optional object with `true` and `false` descriptions. A noul question needs `instructions` or `criteria` | `noul`: probability that the answer is true |
| `choice` | Required object mapping 1 to 255 labels to descriptions | `choice`, `confidence`, `probabilities` per label |
| `score` | Required array of 1 to 10 levels, lowest first | `score` (0 to levels - 1), `confidence`, `legend`, `probabilities` per level |
| `box` | None. TypeSafe `jev-1.14.0` and `jev-preview` only, with the [images header](#typesafe-images-box-questions-and-long-context) | `box` with `top`, `bottom`, `left` and `right`, `confidence` |

On both routes, requests that break these rules, such as no questions at all, duplicate choice values or a `score` question with 11 levels, are rejected by LiteLLM with a 400 before any provider is called

## TypeSafe images, box questions and long context

TypeSafe Jev 1.14 reads images and answers `box` questions, and TypeSafe keeps both behind opt-in request headers. The proxy forwards any client header that starts with `TypeSafe-Danger-Zone-` to TypeSafe deployments and to no other provider.

| Header | What it turns on |
|--------|------------------|
| `TypeSafe-Danger-Zone-Images: true` | Images in `assets` on `/v1/systemone`, `input_image` parts on `/v1/decisions`, and `box` questions on both |
| `TypeSafe-Danger-Zone-Long-Context: true` | Requests over TypeSafe's default limit of 64k tokens per request and 32k per question |

Name each image in `assets` and use that name in `state`, since TypeSafe rejects an asset the state never mentions. This request asks whether a photo shows a red square and where it is

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-H 'TypeSafe-Danger-Zone-Images: true' \
-d '{
  "model": "jev-1.14.0",
  "state": {"photo": "photo-7f3a9c"},
  "assets": {
    "photo-7f3a9c": {"type": "image", "format": "png", "data_base64": "<BASE64_PNG>"}
  },
  "questions": {
    "has_red_square": {"type": "noul", "instructions": "Is there a red square in `photo`?"},
    "red_square": {"type": "box", "instructions": "the red square in `photo`"}
  }
}'
```

The box edges are fractions of the image height and width, measured from the top left corner

```json
{
  "model": "jev-1.14.0",
  "answers": {
    "has_red_square": {"type": "noul", "noul": 0.99},
    "red_square": {"type": "box", "box": {"top": 0.11, "bottom": 0.51, "left": 0.49, "right": 0.83}, "confidence": 0.94}
  },
  "usage": {"input_tokens": 756, "output_tokens": 39}
}
```

On `/v1/decisions`, send the images as `input_image` parts with the same header. LiteLLM turns each PNG or JPEG into an asset, puts the asset's name where the image was in the text, and downloads image URLs first. A `box` question comes back as `{"type": "box", "name": ..., "box": {...}, "confidence": ...}` in its place in `answers`.

`box` works on `jev-1.14.0` and `jev-preview`, and only with the images header, even when the request has no image. A box question to another model, `jev-1.13.0` and `jev-latest` included, or without the header gets a 400 before the provider is called, or with `drop_params` on, LiteLLM drops the question. A dropped question comes back as `{"type": "refusal"}` on `/v1/decisions` and is left out of `answers` on `/v1/systemone`. Without the images header, `assets` and `input_image` parts get the same 400 or drop on TypeSafe that they get on providers without image input, and with `drop_params` on, LiteLLM also drops any `assets` entry it cannot read and keeps the rest.

In the SDK, pass the headers in `extra_headers`

```python showLineNumbers
import litellm

response = litellm.systemone(
    model="typesafe/jev-1.14.0",
    state={"photo": "photo-7f3a9c"},
    assets={"photo-7f3a9c": {"type": "image", "format": "png", "data_base64": "<BASE64_PNG>"}},
    questions={"red_square": {"type": "box", "instructions": "the red square in `photo`"}},
    extra_headers={"TypeSafe-Danger-Zone-Images": "true"},
)
print(response.answers["red_square"].box)
```

## SDK usage

The SDK has one function per request format. `litellm.decisions` takes the OpenAI Decisions shape (`input`, a `questions` list and an optional `safety_identifier`) and returns the OpenAI response, with `answers` as a list. `litellm.systemone` takes the System One shape (`state` and a `questions` mapping keyed by question name) and returns the System One response, with `answers` keyed by question name. Both work with every supported provider, so you pick the function by the request shape you write, not by the provider you call.

```python showLineNumbers title="OpenAI Decisions format" keep-model-ids
import os
import litellm

os.environ["OPENAI_API_KEY"] = ""

response = litellm.decisions(
    model="openai/gpt-6-luna",
    input="Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
    questions=[
        {"type": "predicate", "name": "is_refund_request", "instructions": "Is the customer asking for a refund?"},
    ],
)
print(response.answers[0].probability)
print(response.usage)
```

```python showLineNumbers title="System One format"
import os
import litellm

os.environ["TYPESAFE_API_KEY"] = ""

response = litellm.systemone(
    model="typesafe/jev-latest",
    state="Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
    questions={
        "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
    },
)
print(response.answers["is_refund_request"].noul)
```

The async versions are `litellm.adecisions` and `litellm.asystemone` and take the same arguments.

```python showLineNumbers
import asyncio
import os
import litellm

os.environ["TYPESAFE_API_KEY"] = ""

async def main():
    response = await litellm.asystemone(
        model="typesafe/jev-latest",
        state="Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
        questions={
            "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
        },
    )
    print(response.answers["is_refund_request"].noul)

asyncio.run(main())
```

All four functions also accept `safety_identifier`, `api_key`, `api_base`, `timeout`, `custom_llm_provider` and `extra_headers`. `litellm.systemone` and `litellm.asystemone` also take `images`, a list of image URLs or data URLs, and `assets`, the TypeSafe image map described in [TypeSafe images, box questions and long context](#typesafe-images-box-questions-and-long-context). Passing `images` to `litellm.decisions` raises a `BadRequestError` unless `drop_params` is on, since the OpenAI format carries images as `input_image` parts. Passing `input` to `litellm.systemone` raises a `BadRequestError` that points at `litellm.decisions`. Passing `state` to `litellm.decisions` still works for existing callers, it sends the System One format and emits a `UserWarning` that points at `litellm.systemone`. A model whose prefix is not one of the supported providers fails with a `BadRequestError` that lists the supported ones.

Through the Router the same split applies: `router.decisions` and `router.adecisions` take the OpenAI shape, `router.systemone` and `router.asystemone` take the System One shape. On the proxy, `/v1/systemone` requests are logged with call type `asystemone` and `/v1/decisions` requests with `adecisions`.

:::info Upgrading from v1.104.x
In v1.104.2 through v1.104.x, `litellm.decisions` accepted both shapes and picked the format from whether you passed `input` or `state`. Those calls keep working unchanged, with a `UserWarning`. Rename `litellm.decisions(state=...)` to `litellm.systemone(state=...)` when convenient, the arguments stay the same.
:::

## Limits

OpenAI requires `instructions` on every question and at least 2 choices or score levels. When a System One question without `instructions` goes to an OpenAI model, LiteLLM fills in a generic one such as "Which choice best fits the input?", and a noul question's `criteria` are folded into the instructions OpenAI sees. A choice with one label or a score with one level has no OpenAI equivalent, so LiteLLM rejects it with a 400 before OpenAI is called

A choice question cannot have both a boolean value and a string with the same text, such as `true` and `"true"`, because System One providers key choices by their text. LiteLLM rejects that request with a 400

## Try it in the Admin UI

### Add a decision model

Go to **Models + Endpoints**, open the **Add Model** tab and pick the provider, for example OpenAI. Pick the decision model under **LiteLLM Model Name(s)**, for example `gpt-6-luna`, and a **Decision model** note confirms the pick and links to the Decisions playground. Enter the provider credentials as you would for any other model, then click **Add Model**. The model then answers on `/v1/decisions` and `/v1/systemone` under its public model name. Providers that need an endpoint URL, such as Databricks and Microsoft Foundry, take it in the **API Base** field, matching the `api_base` in the [proxy setup](#proxy-setup) above. The optional **Mode** dropdown has an **Evaluation - /v1/decisions** entry for health checking the model over `/v1/decisions`.

<Image img={require('../img/decisions_add_model.png')} alt="Add Model with OpenAI and gpt-6-luna picked, showing the Decision model note" />

### Decisions playground

The Playground **Decisions** tab (Beta) sends requests to both routes. Open it at `LITELLM_PROXY_BASE_URL/ui/?page=llm-playground&tab=system-one`, or go to **Playground** and pick **Decisions**. The **Endpoint** selector picks `/v1/decisions` (OpenAI Decisions format) or `/v1/systemone` (System One format). The **Model** selector lists the decision models in your `model_list`, such as `jev` from the config above, and a proxy with no decision models shows an **Add a decision model** link instead. An OpenAI decision model such as `luna` is listed once its `model_info` sets `mode: evaluation`.

```yaml showLineNumbers keep-model-ids
model_list:
  - model_name: luna
    litellm_params:
      model: openai/gpt-6-luna
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      mode: evaluation
```

**API key** picks the key. **Current UI Session** uses your dashboard login, and **Virtual Key** attributes the call to a key you paste. **Load example** fills in one of four requests: **Triage a bug report**, **Route a support ticket**, **Moderate a forum comment** or **Score a sales lead**. The form starts empty, and the eraser button clears it. Type the text the model should read into **Input**, then give each question a **Name**, an **Answer type** and **Instructions**. The answer types are **Choice**, **Yes / no** and **Score** on `/v1/systemone`, and **Predicate**, **Choice** and **Score** on `/v1/decisions`, which also takes an optional **Safety identifier**. **Add question** adds a card, and the trash buttons remove questions, options and levels. The **cURL** tab shows the same request as a curl command that follows your edits, and **Copy cURL** copies it once the form has no issues. The form only takes text, so send image input on `/v1/decisions` with curl or the SDK.

Problems the form can catch, such as an empty **Input**, are listed above **Send**, which stays disabled until they are fixed. Others come back from the provider when you send, such as a `/v1/systemone` yes / no question with no instructions and no **Yes means** or **No means**. Once the call returns, each question shows its answer and probabilities, and the **Response** header shows the latency, the model name from the response and the token usage. **Raw response** opens the JSON body. An error, such as a 401 for a bad key, shows **Decisions request failed** and the error message instead of the answers.

<Image img={require('../img/decisions_playground_systemone.png')} alt="Decisions playground with /v1/systemone and the jev model picked, the bug report triage example in the Form tab and its answers" />

<Image img={require('../img/decisions_playground_openai.png')} alt="Decisions playground with /v1/decisions and the luna model picked, the bug report triage example with choice, predicate and score questions and its answers" />

The tab is in `v1.106.0` and later, and not in `v1.104.2` or `v1.105.0`. `v1.106.0` picks examples from a dropdown instead of **Load example**. The [TypeSafe page](./pass_through/typesafe.md#try-it-in-the-admin-ui) walks through the System One form, validation and answer view.

## Use a decision model as a guardrail

The [Decision Model guardrail](./proxy/guardrails/decision_model.md) asks any model on this page yes/no questions you write about each request or response, and blocks or logs the call when a probability reaches its threshold

## Decision routes vs TypeSafe pass-through

The [TypeSafe pass-through](./pass_through/typesafe.md) at `/typesafe/v1/systemone` forwards raw requests to TypeSafe only and reads the key from the proxy environment. `/v1/decisions` and `/v1/systemone` use the models in your `model_list`, so you can switch providers, load balance and set per-deployment keys without changing the request body
