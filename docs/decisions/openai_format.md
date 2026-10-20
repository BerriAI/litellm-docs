---
sidebar_label: "/v1/decisions"
---

# /v1/decisions

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
| `box` | None. TypeSafe `jev-1.14.0` and `jev-preview` only, with the [images header](./typesafe_images.md) | `box` with `top`, `bottom`, `left` and `right`, `confidence` |

A question the model will not answer comes back as `{"type": "refusal", "name": ...}`

## Image input

OpenAI, Cloudflare Clef and TypeSafe models take `input_image` parts, TypeSafe only with the [images header](./typesafe_images.md). `image_url` is an image URL or a data URL, and `detail` is optional and only used by OpenAI.

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
