---
sidebar_label: "/v1/systemone"
---

# /v1/systemone

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
| `images` | array, optional | Image URLs or data URLs. OpenAI and Cloudflare Clef only, with the rules in [Image input](./openai_format.md#image-input) |
| `assets` | object, optional | Images keyed by a name you use in `state`, each `{"type": "image", "format": "png", "jpg" or "jpeg", "data_base64": ...}`. TypeSafe only, with the [images header](./typesafe_images.md) |

Every question has a `type` and an optional `instructions` field. Extra fields on a question are forwarded to System One providers unchanged

| `type` | `criteria` | Answer fields |
|--------|------------|---------------|
| `noul` | Optional object with `true` and `false` descriptions. A noul question needs `instructions` or `criteria` | `noul`: probability that the answer is true |
| `choice` | Required object mapping 1 to 255 labels to descriptions | `choice`, `confidence`, `probabilities` per label |
| `score` | Required array of 1 to 10 levels, lowest first | `score` (0 to levels - 1), `confidence`, `legend`, `probabilities` per level |
| `box` | None. TypeSafe `jev-1.14.0` and `jev-preview` only, with the [images header](./typesafe_images.md) | `box` with `top`, `bottom`, `left` and `right`, `confidence` |

On both routes, requests that break these rules, such as no questions at all, duplicate choice values or a `score` question with 11 levels, are rejected by LiteLLM with a 400 before any provider is called
