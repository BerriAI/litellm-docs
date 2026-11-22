# Nace Drex

<SinceVersion v="1.109.0-dev.1" />

[Nace](https://nace.ai) serves the Drex decision models behind a hosted API at `console.nace.ai`. A Drex model does not generate text. It answers typed questions about an input, such as a yes or no question, a pick from a fixed list of options, or a level on a scale, and gives every answer a calibrated probability. Every Drex model except `drex-v2.0` also reads images. LiteLLM serves the Drex models on the [decision routes](../decisions.md), `/v1/decisions` for the OpenAI Decisions format and `/v1/systemone` for the System One format.

| Property | Details |
|----------|---------|
| Provider route on LiteLLM | `nace/` |
| Models | `nace/drex-max-v1.1` (recommended), `nace/drex-max` (retired by Nace on 2026-11-08, now forwarded to `drex-max-v1.1`), `nace/drex-v2.0`, `nace/drex-v1.5`, `nace/drex-latest` (points to `drex-max-v1.1`) |
| LiteLLM endpoints | `/v1/decisions`, `/v1/systemone` |
| Question types | `predicate` or `noul`, `choice`, `score` |
| Image input | Every Drex model except `drex-v2.0`, up to 8 PNG, JPEG or WebP images per request |
| Price in LiteLLM | $0.03 per million input tokens for every Nace model from v1.111.0-rc.1, output tokens are not billed |

The provider first ships in [v1.109.0-dev.1](https://github.com/BerriAI/litellm/releases/tag/v1.109.0-dev.1) through [PR #46523](https://github.com/BerriAI/litellm/pull/46523). Image input, the `drex-max` and `drex-max-v1.1` cost map entries and the $0.03 price for every Nace model first ship <SinceVersion v="1.111.0-rc.1" /> through [PR #48426](https://github.com/BerriAI/litellm/pull/48426). Nace documents the models, prices and limits in the [Drex Max guide](https://console.nace.ai/docs/drex/guides/drex-max) and the [models reference](https://console.nace.ai/docs/drex/reference/models).

## Environment variables

| Variable | Required | Value |
|----------|----------|-------|
| `NACE_API_KEY` | Yes | API key from the [Nace console](https://console.nace.ai) |
| `NACE_API_BASE` | No | Defaults to `https://console.nace.ai`. `NACE_BASE_URL` is read as well |

LiteLLM removes a trailing `/` or `/v1` from the base and adds `/v1/systemone`, so `https://console.nace.ai/v1` reaches the same route. Pass `api_key` and `api_base` on the deployment to override the environment.

## Proxy setup

Add the model to `config.yaml`.

```yaml showLineNumbers
model_list:
  - model_name: drex-max-v1.1
    litellm_params:
      model: nace/drex-max-v1.1
      api_key: os.environ/NACE_API_KEY
    model_info:
      mode: evaluation
```

Start the proxy.

```bash showLineNumbers
export NACE_API_KEY=<your-key>
litellm --config config.yaml
```

## /v1/decisions

Ask one question of each type in the OpenAI Decisions format.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/decisions' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "drex-max-v1.1",
  "input": "Help! My payouts have been failing for 3 days!",
  "questions": [
    {"type": "predicate", "name": "is_urgent", "instructions": "Does this convey urgency?"},
    {
      "type": "choice",
      "name": "team",
      "instructions": "Which team should handle this?",
      "choices": [
        {"value": "billing", "description": "payments, payouts and invoices"},
        {"value": "sales", "description": "new plans and upgrades"},
        {"value": "retail", "description": "in-store orders"}
      ]
    },
    {
      "type": "score",
      "name": "frustration",
      "instructions": "How frustrated is the writer?",
      "levels": [{"label": "calm"}, {"label": "frustrated"}, {"label": "angry"}]
    }
  ]
}'
```

Response, with the probabilities rounded.

```json
{
  "model": "drex-max-v1.1",
  "answers": [
    {"type": "predicate", "name": "is_urgent", "probability": 0.9814},
    {
      "type": "choice",
      "name": "team",
      "choice": "billing",
      "probabilities": [
        {"value": "billing", "probability": 0.9995},
        {"value": "sales", "probability": 0.0003},
        {"value": "retail", "probability": 0.0002}
      ],
      "confidence": 0.9992
    },
    {
      "type": "score",
      "name": "frustration",
      "score": 1.1279,
      "probabilities": [
        {"value": 0, "label": "calm", "probability": 0.0125},
        {"value": 1, "label": "frustrated", "probability": 0.847},
        {"value": 2, "label": "angry", "probability": 0.1405}
      ],
      "confidence": 0.7705
    }
  ],
  "usage": {
    "input_tokens": 281,
    "input_tokens_details": {"cached_tokens": 0, "cache_write_tokens": 0},
    "output_tokens": 309,
    "output_tokens_details": {"reasoning_tokens": 0},
    "total_tokens": 590
  }
}
```

## /v1/systemone

Ask questions in the System One format. Nace takes `noul`, `choice` and `score` questions. A `box` question is answered 422 by Nace, and `choice` criteria values must be strings or `null`.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "drex-max-v1.1",
  "state": "A customer writes: my parcel arrived crushed and the mug inside is in pieces.",
  "questions": {
    "damaged": {"type": "noul", "instructions": "Does the customer report damaged goods?"},
    "urgency": {"type": "score", "instructions": "How urgent is this?", "criteria": ["low", "medium", "high"]}
  }
}'
```

Response, with the probabilities rounded.

```json
{
  "model": "drex-max-v1.1",
  "answers": {
    "damaged": {"type": "noul", "noul": 0.9984},
    "urgency": {
      "type": "score",
      "score": 1.4303,
      "confidence": 0.2754,
      "legend": {"0": "low", "1": "medium", "2": "high"},
      "probabilities": {"0": 0.0264, "1": 0.5169, "2": 0.4567}
    }
  },
  "usage": {"input_tokens": 186, "output_tokens": 189},
  "evaluation_time_ms": 88.2,
  "request_id": "req_2f9b21c3f9f1db72219519ef11dddf1b"
}
```

Nace returns the score `legend` as an array and LiteLLM normalises it to the map the other providers return. `evaluation_time_ms` and `request_id` come from Nace and pass through on `/v1/systemone`.

## Images

<SinceVersion v="1.111.0-rc.1" />

Every Drex model except `drex-v2.0` reads up to 8 images per request. Send them in the `images` array of a System One request, or as `input_image` parts of a `/v1/decisions` message, and refer to them in the text as `Image 1`, `Image 2` and so on in array order. LiteLLM sends every image inline as a data URL and converts `{"content_type": ..., "base64": ...}` entries to that form. A remote `http(s)` image URL is rejected before Nace is called with `Nace requires inline base64 images or data URLs, not remote image URLs`, since LiteLLM does not fetch it. Inline images count toward Nace's 4 MiB request body limit. `drex-v2.0` refuses a request with images.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "drex-max-v1.1",
  "state": "Image 1 is a small colour swatch.",
  "questions": {
    "red": {"type": "noul", "instructions": "Is Image 1 mostly red?"},
    "colour": {"type": "choice", "instructions": "Which colour dominates Image 1?", "criteria": {"red": null, "green": null, "blue": null}}
  },
  "images": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGO4IycHRwzEcQDTIxGBFNCZswAAAABJRU5ErkJggg=="]
}'
```

Response for that 4 by 4 red PNG, with the probabilities rounded.

```json
{
  "model": "drex-max-v1.1",
  "answers": {
    "red": {"type": "noul", "noul": 0.9997},
    "colour": {
      "type": "choice",
      "choice": "red",
      "confidence": 0.9995,
      "probabilities": {"red": 0.9997, "green": 0.0001, "blue": 0.0002}
    }
  },
  "usage": {"input_tokens": 250, "output_tokens": 153, "image_tokens": 64},
  "evaluation_time_ms": 628.9,
  "request_id": "req_dcb8ed2d1e8cba28ef133f14b25ab3e6"
}
```

Image tokens are part of `input_tokens` and are billed at the input price.

## SDK

Call Nace from Python with `litellm.decisions` for the OpenAI Decisions format or `litellm.systemone` for the System One format. [SDK usage](../decisions.md#sdk-usage) covers the async versions and the other arguments.

```python showLineNumbers title="OpenAI Decisions format"
import os
import litellm

os.environ["NACE_API_KEY"] = "<your-key>"

response = litellm.decisions(
    model="nace/drex-max-v1.1",
    input="Help! My payouts have been failing for 3 days!",
    questions=[
        {"type": "predicate", "name": "is_urgent", "instructions": "Does this convey urgency?"},
    ],
)
print(response.answers[0].probability)
```

```python showLineNumbers title="System One format with an image"
import os
import litellm

os.environ["NACE_API_KEY"] = "<your-key>"

response = litellm.systemone(
    model="nace/drex-max-v1.1",
    state="Image 1 is a small colour swatch.",
    questions={
        "red": {"type": "noul", "instructions": "Is Image 1 mostly red?"},
    },
    images=["data:image/png;base64,<base64-png-bytes>"],
)
print(response.answers["red"].noul)
```

## Cost tracking

The LiteLLM cost map prices `nace/drex-max`, `nace/drex-max-v1.1`, `nace/drex-latest`, `nace/drex-v1.0`, `nace/drex-v1.5` and `nace/drex-v2.0` at $0.03 per million input tokens with no output price, from v1.111.0-rc.1. Earlier releases price `nace/drex-v1.0` at $0.04, `nace/drex-v1.5` at $0.05, and `nace/drex-v2.0` and `nace/drex-latest` at $0.06. The cost is returned in the `x-litellm-response-cost` header and written to spend logs. A call to an alias is priced by the model Nace reports in the response, so `drex-latest` is billed as the version it currently points to.

## Use it as the Auto Router classifier

Drex can pick the model tier for each request in LiteLLM Auto Router. Add the deployment above to `model_list` and set `deployment_name` in the router's `opensource_classifier_config` to its `model_name`, as shown in [Use a deployed decision model](../auto_router/decision_classifiers.md#use-a-deployed-decision-model). The classifier call goes through that deployment and uses its credentials and price.
