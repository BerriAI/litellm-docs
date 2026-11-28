---
title: "AssetFeed OCR and Embeddings API with LiteLLM"
sidebar_label: "AssetFeed"
description: "Use AssetFeed OCR and text embedding models through LiteLLM's Python SDK or Gateway: read text from up to 8 images and get 1024, 512 or 256-dim vectors."
---

# AssetFeed

[AssetFeed](https://assetfeed.com) has an OpenAI-compatible API with two models. `assetfeed/assetfeed-ocr-v1` reads text from images through chat completions, and `assetfeed/assetfeed-embed-v1` returns text embeddings.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `assetfeed/` |
| API key environment variable | `ASSETFEED_API_KEY` |
| Default API base | `https://api.assetfeed.com/api/v1/models` |
| Optional API base override | `ASSETFEED_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions`, `/embeddings` |

## Model names

AssetFeed model IDs already contain a slash, and the API expects the full ID, for example `assetfeed/assetfeed-embed-v1`. LiteLLM removes only the first `assetfeed/` before it sends the request, so put the provider prefix in front of the full ID.

| Model | LiteLLM `model` value | Model sent to AssetFeed |
|-------|-----------------------|-------------------------|
| OCR | `assetfeed/assetfeed/assetfeed-ocr-v1` | `assetfeed/assetfeed-ocr-v1` |
| Embeddings | `assetfeed/assetfeed/assetfeed-embed-v1` | `assetfeed/assetfeed-embed-v1` |

Keep the double prefix when you also pass `custom_llm_provider="assetfeed"`. With a single prefix LiteLLM sends `assetfeed-embed-v1` instead of the full ID.

## Setup

```bash
export ASSETFEED_API_KEY="your-assetfeed-api-key"
```

## OCR

The OCR model returns the text it finds in the images and ignores the text parts of the prompt. Send up to 8 images per request, each as an `image_url` with an image URL or a base64 data URL.

```python
from litellm import completion

response = completion(
    model="assetfeed/assetfeed/assetfeed-ocr-v1",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": "https://example.com/chart.png"}},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgo..."}},
            ],
        }
    ],
)

print(response.choices[0].message.content)
```

## Embeddings

The embedding model takes 1 to 64 inputs per request and returns 1024-dimensional vectors by default. Pass `dimensions=512` or `dimensions=256` for shorter vectors.

```python
from litellm import embedding

response = embedding(
    model="assetfeed/assetfeed/assetfeed-embed-v1",
    input=["bitcoin etf inflows"],
    dimensions=512,
)

print(len(response.data[0]["embedding"]))
```

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: assetfeed-ocr
    litellm_params:
      model: assetfeed/assetfeed/assetfeed-ocr-v1
      api_key: os.environ/ASSETFEED_API_KEY
  - model_name: assetfeed-embed
    litellm_params:
      model: assetfeed/assetfeed/assetfeed-embed-v1
      api_key: os.environ/ASSETFEED_API_KEY
```

Start the proxy with the API key exported in its environment:

```bash
litellm --config config.yaml
```

Send requests using the configured model aliases:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "assetfeed-ocr",
    "messages": [{"role": "user", "content": [{"type": "image_url", "image_url": {"url": "https://example.com/chart.png"}}]}]
  }'

curl http://localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "assetfeed-embed", "input": ["bitcoin etf inflows"], "dimensions": 512}'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your AssetFeed API key.
