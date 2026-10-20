---
sidebar_label: "TypeSafe images and box questions"
---

# TypeSafe images, box questions and long context

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
