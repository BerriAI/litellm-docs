import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# WaveSpeed AI

WaveSpeed AI serves image, video, and LLM inference from one platform, including Seedream, Seedance, FLUX, WAN, Kling, and Z-Image.

## Overview

| Property | Details |
|----------|---------|
| Description | WaveSpeed AI runs image and video models behind an asynchronous prediction API, plus an OpenAI-compatible chat endpoint. |
| Provider Route on LiteLLM | `wavespeed/` |
| Provider Doc | [WaveSpeed AI Documentation ↗](https://wavespeed.ai/docs) |
| Supported Operations | [`/images/generations`](#image-generation), [`/videos`](#video-generation), [`/chat/completions`](#chat-completions) |

## Setup

### API Key

```python showLineNumbers
import os

os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"
```

Get your API key from the [WaveSpeed dashboard](https://wavespeed.ai/).

### Environment Variables

| Variable | Description |
|----------|-------------|
| `WAVESPEED_API_KEY` | Your WaveSpeed API key. Required for every operation |
| `WAVESPEED_API_BASE` | Overrides the base URL. Defaults to `https://api.wavespeed.ai` for image and video, and `https://llm.wavespeed.ai/v1` for chat. Because one variable covers both surfaces, prefer setting `api_base` per model in `config.yaml` when you use chat and media together |

### How predictions work

Image and video calls are asynchronous on WaveSpeed. LiteLLM submits the task to `POST /api/v3/{model}`, then reads `GET /api/v3/predictions/{id}/result` until the task reaches a terminal status.

For image generation LiteLLM does that polling for you, so `image_generation` returns only once the image is ready. For video generation the OpenAI video contract already exposes the task lifecycle, so `video_generation` returns immediately with an id and you poll with `video_status` before calling `video_content`.

The submit request is sent exactly once and is never retried, since every submission is a billable task. Only the read-only result requests are retried, and a run of 5 consecutive transport failures gives up.

## Supported Models

Any WaveSpeed model id works by prefixing it with `wavespeed/`. Browse the full catalog at [wavespeed.ai/models](https://wavespeed.ai/models). Some common ones:

| Model Name | Type | Description |
|------------|------|-------------|
| `wavespeed/wavespeed-ai/z-image/turbo` | Image | Z-Image Turbo, fast and inexpensive, good for a first call |
| `wavespeed/bytedance/seedream-v5.0-pro` | Image | Seedream 5.0 Pro, high-fidelity text-to-image |
| `wavespeed/bytedance/seedance-2.5/text-to-video` | Video | Seedance 2.5, text-to-video |
| `wavespeed/bytedance/seedance-2.5/image-to-video` | Video | Seedance 2.5, image-to-video |
| `wavespeed/anthropic/claude-opus-4.8` | Chat | Served through the OpenAI-compatible chat endpoint |

Model ids on WaveSpeed already contain slashes, and LiteLLM strips only the leading `wavespeed/` routing prefix, so the rest of the id is forwarded untouched.

## Image Generation

### Usage - LiteLLM Python SDK

<Tabs>
<TabItem value="basic" label="Basic Usage">

```python showLineNumbers title="Basic Image Generation"
import litellm
import os

os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"

response = litellm.image_generation(
    model="wavespeed/wavespeed-ai/z-image/turbo",
    prompt="A red panda skateboarding through a neon-lit alley"
)

print(response.data[0].url)
```

</TabItem>

<TabItem value="size" label="Size and Seed">

```python showLineNumbers title="Seedream with an explicit size"
import litellm
import os

os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"

response = litellm.image_generation(
    model="wavespeed/bytedance/seedream-v5.0-pro",
    prompt="A serene Japanese garden with cherry blossoms",
    size="1024x1536",
    seed=42
)

print(response.data[0].url)
```

`size` is given in the usual OpenAI `WIDTHxHEIGHT` form and LiteLLM converts it to WaveSpeed's `WIDTH*HEIGHT`.

</TabItem>

<TabItem value="async" label="Async Usage">

```python showLineNumbers title="Async Image Generation"
import litellm
import asyncio
import os

async def generate_image():
    os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"

    response = await litellm.aimage_generation(
        model="wavespeed/wavespeed-ai/z-image/turbo",
        prompt="A cyberpunk cityscape with neon lights"
    )

    print(response.data[0].url)
    return response

asyncio.run(generate_image())
```

</TabItem>

<TabItem value="batch" label="Multiple Images">

```python showLineNumbers title="Request more than one image"
import litellm
import os

os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"

response = litellm.image_generation(
    model="wavespeed/bytedance/seedream-v5.0-pro",
    prompt="A lighthouse in a storm",
    n=4
)

for image in response.data:
    print(image.url)
```

`n` maps to WaveSpeed's `num_images`. Models that do not batch will return a single image.

</TabItem>
</Tabs>

### Usage - LiteLLM Proxy Server

#### 1. Configure your config.yaml

```yaml showLineNumbers title="WaveSpeed Image Generation Configuration"
model_list:
  - model_name: z-image-turbo
    litellm_params:
      model: wavespeed/wavespeed-ai/z-image/turbo
      api_key: os.environ/WAVESPEED_API_KEY
    model_info:
      mode: image_generation

  - model_name: seedream-pro
    litellm_params:
      model: wavespeed/bytedance/seedream-v5.0-pro
      api_key: os.environ/WAVESPEED_API_KEY
    model_info:
      mode: image_generation

general_settings:
  master_key: sk-1234
```

#### 2. Start LiteLLM Proxy Server

```bash showLineNumbers title="Start Proxy Server"
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

#### 3. Make requests

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Generate via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-1234"
)

response = client.images.generate(
    model="z-image-turbo",
    prompt="A beautiful sunset over the ocean",
    size="1024x1024"
)

print(response.data[0].url)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Generate via Proxy - cURL"
curl --location 'http://localhost:4000/v1/images/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer sk-1234' \
--data '{
    "model": "z-image-turbo",
    "prompt": "A red panda skateboarding",
    "size": "1024x1024"
}'
```

</TabItem>
</Tabs>

### Supported Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `prompt` | string | Text description of the desired image | Required |
| `model` | string | WaveSpeed model to use | Required |
| `n` | integer | Number of images, mapped to `num_images` | `1` |
| `size` | string | `WIDTHxHEIGHT`, converted to WaveSpeed's `WIDTH*HEIGHT` | Model default |
| `response_format` | string | Only `url` is supported, since WaveSpeed returns hosted URLs | `url` |
| `api_key` | string | Your WaveSpeed API key | `WAVESPEED_API_KEY` |

Anything else you pass is forwarded to WaveSpeed untouched, so model-specific fields such as `guidance_scale`, `aspect_ratio`, `image`, or `mask_image` work without LiteLLM needing to know about them.

```python showLineNumbers title="Pass Model-Specific Parameters"
import litellm

response = litellm.image_generation(
    model="wavespeed/bytedance/seedream-v5.0-pro",
    prompt="A beautiful sunset",
    aspect_ratio="16:9",
    guidance_scale=3.5,
    enable_base64_output=False
)
```

## Video Generation

### Usage - LiteLLM Python SDK

```python showLineNumbers title="Complete Video Generation Workflow"
from litellm import video_generation, video_status, video_content
import os
import time

os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"

response = video_generation(
    model="wavespeed/bytedance/seedance-2.5/text-to-video",
    prompt="A red panda skateboarding through a neon-lit alley",
    seconds="5",
    size="1280x720"
)

video_id = response.id
print(f"Video generation started: {video_id}, status {response.status}")

while True:
    status_response = video_status(video_id=video_id)
    print(f"Status: {status_response.status}")

    if status_response.status == "completed":
        break
    if status_response.status == "failed":
        raise RuntimeError(status_response.error)

    time.sleep(5)

video_bytes = video_content(video_id=video_id)

with open("generated_video.mp4", "wb") as f:
    f.write(video_bytes)
```

### Image to video

```python showLineNumbers title="Image to Video"
from litellm import video_generation
import os

os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"

response = video_generation(
    model="wavespeed/bytedance/seedance-2.5/image-to-video",
    prompt="The camera pulls back slowly",
    input_reference="https://example.com/first-frame.png",
    seconds="5"
)

print(response.id)
```

### Async Usage

```python showLineNumbers title="Async Video Generation"
from litellm import avideo_generation, avideo_status, avideo_content
import asyncio
import os

os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"

async def generate_video():
    response = await avideo_generation(
        model="wavespeed/bytedance/seedance-2.5/text-to-video",
        prompt="A serene lake with mountains in the background",
        seconds="5"
    )

    while True:
        status_response = await avideo_status(video_id=response.id)
        if status_response.status == "completed":
            break
        if status_response.status == "failed":
            raise RuntimeError(status_response.error)
        await asyncio.sleep(5)

    return await avideo_content(video_id=response.id)

asyncio.run(generate_video())
```

### Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="WaveSpeed Video Generation Configuration"
model_list:
  - model_name: seedance-t2v
    litellm_params:
      model: wavespeed/bytedance/seedance-2.5/text-to-video
      api_key: os.environ/WAVESPEED_API_KEY
    model_info:
      mode: video_generation

general_settings:
  master_key: sk-1234
```

```bash showLineNumbers title="Generate via Proxy - cURL"
curl --location 'http://localhost:4000/v1/videos' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer sk-1234' \
--data '{
    "model": "seedance-t2v",
    "prompt": "A red panda skateboarding",
    "seconds": "5"
}'
```

### Supported Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | Text description for the video. Required |
| `model` | string | WaveSpeed video model. Required |
| `input_reference` | string | URL or data URI of a reference image, mapped to WaveSpeed's `image` |
| `seconds` | string/int | Video duration, mapped to `duration` |
| `size` | string | `WIDTHxHEIGHT`, converted to WaveSpeed's `WIDTH*HEIGHT` |

Model-specific fields are forwarded untouched, the same as for image generation.

Video remix, listing, deletion, editing, and extension are not supported by the WaveSpeed prediction API and raise `NotImplementedError`.

## Chat Completions

WaveSpeed also runs an OpenAI-compatible chat endpoint at `https://llm.wavespeed.ai/v1`. WaveSpeed chat model ids already carry their upstream provider prefix, so the route reads `wavespeed/{upstream_provider}/{model}`.

```python showLineNumbers title="Chat Completion"
import litellm
import os

os.environ["WAVESPEED_API_KEY"] = "your-wavespeed-api-key"

response = litellm.completion(
    model="wavespeed/anthropic/claude-opus-4.8",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)
```

```yaml showLineNumbers title="Proxy Configuration"
model_list:
  - model_name: claude-opus
    litellm_params:
      model: wavespeed/anthropic/claude-opus-4.8
      api_key: os.environ/WAVESPEED_API_KEY
```

The chat catalog is published at [llm.wavespeed.ai/v1/models](https://llm.wavespeed.ai/v1/models).

## Getting Started

1. Sign up at [wavespeed.ai](https://wavespeed.ai/)
2. Create an API key in the dashboard
3. Set `WAVESPEED_API_KEY`
4. Pick a model from [wavespeed.ai/models](https://wavespeed.ai/models)
5. Call it with the `wavespeed/` prefix

## Additional Resources

- [WaveSpeed Documentation](https://wavespeed.ai/docs)
- [Model Catalog](https://wavespeed.ai/models)
- [LLM Models](https://wavespeed.ai/llm)
