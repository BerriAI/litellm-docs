import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MachGen

MachGen provides fast text-to-image generation across a range of open and proprietary image models.

## Overview

| Property | Details |
|----------|---------|
| Description | MachGen image models for text-to-image generation |
| Provider Route on LiteLLM | `machgen/` |
| Provider Doc | [MachGen REST API ↗](https://www.machgen.ai/docs/rest_api/) |
| Supported Operations | [`/images/generations`](#image-generation) |

## Setup

```python showLineNumbers
import os

os.environ["MACHGEN_API_KEY"] = "your-api-key-here"
```

Set `MACHGEN_API_BASE` if you are pointed at something other than `https://api.machgen.ai`.

## Supported Models

| Model Name |
|------------|
| `machgen/FLUX.2-dev` |
| `machgen/HiDream-O1-Image` |
| `machgen/Nano-Banana-2` |
| `machgen/Nano-Banana-Pro` |
| `machgen/GPT-Image-2` |
| `machgen/Seedream-5.0-lite` |
| `machgen/Grok-Imagine-Image` |
| `machgen/Grok-Imagine-Image-Quality` |

Any other text-to-image model MachGen exposes works too; the model name is passed through as-is.

## Image Generation

MachGen generation is asynchronous: LiteLLM submits the task, polls it until it completes, and returns the result in the OpenAI image response shape.

### Usage - LiteLLM Python SDK

<Tabs>
<TabItem value="basic" label="Basic Usage">

```python showLineNumbers title="Basic Image Generation"
import os
import litellm

os.environ["MACHGEN_API_KEY"] = "your-api-key-here"

response = litellm.image_generation(
    model="machgen/FLUX.2-dev",
    prompt="An isometric illustration of a cozy reading nook",
    size="1024x1024",
)

print(response.data[0].url)
```

</TabItem>

<TabItem value="async" label="Async Usage">

```python showLineNumbers title="Async Image Generation"
import os
import asyncio
import litellm

os.environ["MACHGEN_API_KEY"] = "your-api-key-here"

async def generate_image():
    response = await litellm.aimage_generation(
        model="machgen/FLUX.2-dev",
        prompt="A futuristic city skyline at night",
        size="1024x1024",
    )
    print(response.data[0].url)

asyncio.run(generate_image())
```

</TabItem>

<TabItem value="b64" label="Base64 Output">

```python showLineNumbers title="Inline Image Bytes"
import base64
import os
import litellm

os.environ["MACHGEN_API_KEY"] = "your-api-key-here"

response = litellm.image_generation(
    model="machgen/FLUX.2-dev",
    prompt="A watercolor fox",
    response_format="b64_json",
)

with open("fox.png", "wb") as f:
    f.write(base64.b64decode(response.data[0].b64_json))
```

MachGen asset URLs require your MachGen API key, so use `response_format="b64_json"` when the caller of the LiteLLM response cannot present that key.

</TabItem>
</Tabs>

### Usage - LiteLLM Proxy

Add the model to your config:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: machgen-flux
    litellm_params:
      model: machgen/FLUX.2-dev
      api_key: os.environ/MACHGEN_API_KEY
```

Start the proxy and call it with the OpenAI images route:

```bash showLineNumbers
litellm --config config.yaml

curl http://localhost:4000/v1/images/generations \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "machgen-flux",
    "prompt": "An isometric illustration of a cozy reading nook",
    "size": "1024x1024"
  }'
```

## Supported Parameters

| Parameter | Notes |
|-----------|-------|
| `size` | `WIDTHxHEIGHT`, split into MachGen's `width` and `height` |
| `response_format` | `url` (default) or `b64_json` |
| `seed` | Reproducible generations |
| `aspect_ratio` | For example `"1:1"` |
| `infer_steps` | Number of inference steps |
| `guidance_scale` | List of guidance values |
| `enhance_prompt` | Let MachGen rewrite the prompt |
| `moderate` | Enable MachGen moderation |

Height defaults to 1024 when neither `size` nor `height` is given, since MachGen requires it.
