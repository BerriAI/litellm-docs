import Image from '@theme/IdealImage';

# /v1/decisions and /v1/systemone

Decision models answer typed questions about an input and return probabilities instead of text: a yes/no probability, a pick from a fixed list, or a score on a scale. LiteLLM serves them on two routes that share one provider list, so any decision model in your `model_list` works on either route

| Route | Alias | Request format | Use it when |
|-------|-------|----------------|-------------|
| `POST /v1/decisions` | `/decisions` | OpenAI Decisions: `input` plus a list of `predicate`, `choice` and `score` questions | You write against OpenAI's format or need image input |
| `POST /v1/systemone` | `/systemone` | [System One](https://docs.typesafe.ai/api): `state` plus a map of `noul`, `choice` and `score` questions | You already have TypeSafe Jev request bodies |

Available in `v1.104.2` and later on the `1.104.x` line and in `v1.105.0-rc.3` and later. `v1.106.0-dev.1` served the System One format at `/v1/decisions`, so on that build send those bodies to `/v1/systemone`. Databricks and Microsoft Foundry landed on `main` after `v1.106.0-dev.3` and ship in the next build

| Feature | Supported | Notes |
|---------|-----------|-------|
| Cost tracking | Yes | Returned in the `x-litellm-response-cost` header and written to spend logs |
| Logging | Yes | Works across all integrations |
| Virtual keys, budgets, rate limits | Yes | Normal proxy key auth |
| Load balancing, fallbacks | Yes | Goes through the router like `/chat/completions` |
| Image input | OpenAI only | Other providers return a 400 |
| Streaming | No | |

## Supported providers

| Provider | Example model | Credentials | Upstream path | Images |
|----------|---------------|-------------|---------------|--------|
| [OpenAI](https://developers.openai.com/api/docs/guides/decisions) | `openai/gpt-6-luna` | `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` | `/v1/decisions` | Yes |
| [TypeSafe Jev](https://docs.typesafe.ai/api) | `typesafe/jev-latest` | `TYPESAFE_API_KEY`, optional `TYPESAFE_API_BASE` | `/v1/systemone` | No |
| [Perplexity](https://docs.perplexity.ai/docs/decisions/quickstart) | `perplexity/pplx-decider-v1-27b` | `PERPLEXITYAI_API_KEY` or `PERPLEXITY_API_KEY`, optional `PERPLEXITY_API_BASE` | `/v1/decisions` | No |
| [OpenRouter](https://openrouter.ai/docs/guides/community/jev) | `openrouter/typesafe/jev-1.13` | `OPENROUTER_API_KEY`, optional `OPENROUTER_API_BASE` | `/api/alpha/decisions` | No |
| [Cloudflare Clef](https://developers.cloudflare.com/workers-ai/models/clef/) | `cloudflare/clef` or `cloudflare/clef-flash` | `CLOUDFLARE_API_KEY` and `CLOUDFLARE_ACCOUNT_ID`, or `api_base` | `/ai/run/@cf/cloudflare/<model>` | No |
| [Databricks](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_decide) | `databricks/databricks-openjev-qwen35-4b` | `DATABRICKS_API_KEY` or `DATABRICKS_TOKEN`, `DATABRICKS_API_BASE` required | `/serving-endpoints/<endpoint>/invocations` | No |
| [Microsoft Foundry](https://ai.azure.com/catalog/models/Microsoft-Decision-1) | `azure_ai/<deployment>` with `base_model: azure_ai/Microsoft-Decision-1` | `AZURE_AI_API_KEY`, `AZURE_AI_API_BASE` required | `/providers/microsoft/v1/systemone` | No |
| [Strands Decider](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) (self-hosted) | `strands_decider/strands-decider-2B-hobson-v19` | `STRANDS_DECIDER_API_BASE` required, `STRANDS_DECIDER_API_KEY` optional | `/v1/systemone` | No |
| [vLLM](https://docs.vllm.ai/en/latest/serving/online_serving/structured_decisions.html) (self-hosted) | `hosted_vllm/Qwen/Qwen3-0.6B` | `HOSTED_VLLM_API_BASE` or `api_base` required, `HOSTED_VLLM_API_KEY` optional | `/v1/systemone` | No |

LiteLLM translates between the two formats, so the route you call does not limit which provider you can use. OpenAI receives OpenAI-format bodies and every other provider receives System One bodies, and the answers come back in the format of the route you called. Text parts of an OpenAI `input` are joined into the System One `state`, and System One questions are named by their keys when they go to OpenAI

Cloudflare model names without an `@cf/` prefix are expanded to `@cf/cloudflare/<model>`, and the `{"result": ...}` envelope Cloudflare returns is unwrapped so the response has the same shape as the other providers. On Databricks the model is the bare serving endpoint name and `DATABRICKS_API_BASE` points at `https://<workspace-host>/serving-endpoints`, so the request goes to that endpoint's `/invocations` route. On Microsoft Foundry the model is your deployment name and `AZURE_AI_API_BASE` is the resource host, `https://<resource>.services.ai.azure.com`. A project-scoped base such as `https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1` is trimmed back to the host. Azure does not let you name a deployment `Microsoft-Decision-1`, so deploy it under another name and set `base_model` so cost tracking finds the price

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

Strands Decider has no default host, so set `STRANDS_DECIDER_API_BASE` or pass `api_base`. vLLM answers only `choice` questions, serves Qwen3 and Qwen3.5 models, and needs a vLLM build that includes [vllm-project/vllm#59299](https://github.com/vllm-project/vllm/pull/59299), which landed after v0.31.0

## Self-hosted Laya and Nimble

[Laya](https://github.com/NandhaKishorM/laya) and [Bespoke Nimble](https://github.com/bespokelabsai/nimble) are decision models that you host yourself. They are not providers for `/v1/decisions` or `/v1/systemone`. Send System One requests to them on their own gateway routes

| Model | Gateway route | Server settings |
|-------|---------------|-----------------|
| Laya | `/laya/v1/systemone` | `LAYA_API_BASE`, optional `LAYA_API_KEY` |
| Bespoke Nimble | `/bespoke/v1/systemone` | `BESPOKE_API_BASE`, optional `BESPOKE_API_KEY` |

Laya, Nimble and Jev can also pick the model tier for Auto Router. For request examples and the classifier setup, see [Call a native decision API](./auto_router/decision_classifiers.md#call-a-native-decision-api)

## Proxy setup

1. Add decision models to `config.yaml`

```yaml showLineNumbers
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

```json
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
| `safety_identifier` | string, optional | A stable ID for your end user. Sent to OpenAI and dropped for other providers |

Every question takes `instructions` and an optional `name` that is echoed in its answer

| `type` | Extra fields | Answer fields |
|--------|--------------|---------------|
| `predicate` | None | `probability` that the answer is yes |
| `choice` | `choices`: 2 to 255 entries of `{"value": string or boolean, "description": optional}` | `choice`, `probabilities` per value, `confidence` |
| `score` | `levels`: 2 to 10 entries of `{"label": ..., "description": optional}`, lowest first | `score` (the probability-weighted level index), `probabilities` per level, `confidence` |

A question the model will not answer comes back as `{"type": "refusal", "name": ...}`

### Image input

`input_image` parts only work on OpenAI models. `detail` is optional

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

```json
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

System One providers accept text only, so the same request with `"model": "jev"` is rejected before TypeSafe is called

```json
{
  "error": {
    "message": "litellm.BadRequestError: Decisions provider 'typesafe' cannot serve this request: input_image content parts are not supported because System One providers accept text input only\n\nLiteLLM: model group 'jev' failed with the error above. No fallback was attempted.",
    "type": "invalid_request_error",
    "param": null,
    "code": "400"
  }
}
```

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

Every question has a `type` and an optional `instructions` field. Extra fields on a question are forwarded to System One providers unchanged

| `type` | `criteria` | Answer fields |
|--------|------------|---------------|
| `noul` | Optional object with `true` and `false` descriptions. A noul question needs `instructions` or `criteria` | `noul`: probability that the answer is true |
| `choice` | Required object mapping 1 to 255 labels to descriptions | `choice`, `confidence`, `probabilities` per label |
| `score` | Required array of 1 to 10 levels, lowest first | `score` (0 to levels - 1), `confidence`, `legend`, `probabilities` per level |

On both routes, requests that break these rules, such as no questions at all, duplicate choice values or a `score` question with 11 levels, are rejected by LiteLLM with a 400 before any provider is called

## SDK usage

`litellm.decisions` takes `input` for the OpenAI format or `state` for the System One format, and returns the matching response type. Passing both raises a `BadRequestError`

```python showLineNumbers
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

The async version is `litellm.adecisions` and takes the same arguments

```python showLineNumbers
import asyncio
import os
import litellm

os.environ["TYPESAFE_API_KEY"] = ""

async def main():
    response = await litellm.adecisions(
        model="typesafe/jev-latest",
        state="Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
        questions={
            "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
        },
    )
    print(response.answers["is_refund_request"].noul)

asyncio.run(main())
```

Both functions also accept `safety_identifier`, `api_key`, `api_base`, `timeout`, `custom_llm_provider` and `extra_headers`. A model whose prefix is not one of the supported providers fails with a `BadRequestError` that lists the supported ones

## Limits

OpenAI requires `instructions` on every question and at least 2 choices or score levels. When a System One question without `instructions` goes to an OpenAI model, LiteLLM fills in a generic one such as "Which choice best fits the input?", and a noul question's `criteria` are folded into the instructions OpenAI sees. A choice with one label or a score with one level has no OpenAI equivalent, so LiteLLM rejects it with a 400 before OpenAI is called

A choice question cannot have both a boolean value and a string with the same text, such as `true` and `"true"`, because System One providers key choices by their text. LiteLLM rejects that request with a 400

## Try it in the Admin UI

### Add a decision model

Go to **Models + Endpoints**, open the **Add Model** tab and pick the provider. Providers with decision models show them under the provider name in the picker, for example "Decision models: gpt-6-luna" under OpenAI. Pick the decision model under **LiteLLM Model Name(s)**, and a **Decision model** note confirms the pick and links to the Decisions playground. Enter the provider credentials as you would for any other model, then click **Add Model**. The model then answers on `/v1/decisions` and `/v1/systemone` under its public model name. Providers that need an endpoint URL, such as Databricks and Microsoft Foundry, take it in the **API Base** field, matching the `api_base` in the [proxy setup](#proxy-setup) above.

<Image img={require('../img/decisions_add_model.png')} alt="Add Model with OpenAI and gpt-6-luna picked, showing the Decision model note" />

### Decisions playground

The Playground **Decisions** tab has an **Endpoint** selector. Pick **Decisions · /v1/systemone** to send the request through your `model_list`, with `model` set to a proxy model name such as `jev` or `luna` from the config above. Open it at `LITELLM_PROXY_BASE_URL/ui/?page=llm-playground&tab=system-one`. The tab only sends the System One format and is not in `v1.104.2` or `v1.105.0`, so use curl or the SDK for `/v1/decisions`, image input and those versions. In `v1.106.0` and earlier the tab is labelled **System One**. The [TypeSafe page](./pass_through/typesafe.md#try-it-in-the-admin-ui) describes the editor, validation and answer view

## Decision routes vs TypeSafe pass-through

The [TypeSafe pass-through](./pass_through/typesafe.md) at `/typesafe/v1/systemone` forwards raw requests to TypeSafe only and reads the key from the proxy environment. `/v1/decisions` and `/v1/systemone` use the models in your `model_list`, so you can switch providers, load balance and set per-deployment keys without changing the request body
