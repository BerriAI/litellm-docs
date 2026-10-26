import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Azure AI Image Editing

Azure AI provides powerful image editing capabilities using FLUX models from Black Forest Labs to modify existing images based on text descriptions.

## Overview

| Property | Details |
|----------|---------|
| Description | Azure AI Image Editing uses FLUX models to modify existing images based on text prompts. |
| Provider Route on LiteLLM | `azure_ai/` |
| Provider Doc | [Azure AI FLUX Models ↗](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/black-forest-labs-flux-1-kontext-pro-and-flux1-1-pro-now-available-in-azure-ai-f/4434659) |
| Supported Operations | [`/images/edits`](#image-editing) |

## Setup

### API Key & Base URL & API Version

```python showLineNumbers
# Set your Azure AI API credentials
import os
os.environ["AZURE_AI_API_KEY"] = "your-api-key-here"
os.environ["AZURE_AI_API_BASE"] = "your-azure-ai-endpoint"  # e.g., https://your-endpoint.eastus2.inference.ai.azure.com/
os.environ["AZURE_AI_API_VERSION"] = "2025-04-01-preview"  # Example API version
```

Get your API key and endpoint from [Azure AI Studio](https://ai.azure.com/).

## Supported Models

| Model Name | Description | Cost per Image |
|------------|-------------|----------------|
| `azure_ai/FLUX.1-Kontext-pro` | FLUX 1 Kontext Pro model with enhanced context understanding for editing | $0.04 |
| `azure_ai/flux.2-pro` | FLUX 2 Pro, up to 8 reference images per edit | $0.04 |
| `azure_ai/FLUX.2-flex` | FLUX 2 Flex, up to 10 reference images per edit, adjustable `guidance` and `steps` | $0.05 per megapixel ($0.052 at 1024x1024) |

FLUX 2 edits go to the same model-specific Black Forest Labs route as FLUX 2 generation (`/providers/blackforestlabs/v1/flux-2-pro` or `/providers/blackforestlabs/v1/flux-2-flex`), with the reference images sent as base64 in the JSON body instead of multipart form data. Pass a list of files as `image` to edit against several references at once. The model name is matched case-insensitively, so `azure_ai/flux.2-flex` works too

## Image Editing

### Usage - LiteLLM Python SDK

<Tabs>
<TabItem value="basic-edit" label="Basic Usage">

```python showLineNumbers title="Basic Image Editing"
import os
import base64
from pathlib import Path

import litellm

# Set your API credentials
os.environ["AZURE_AI_API_KEY"] = "your-api-key-here"
os.environ["AZURE_AI_API_BASE"] = "your-azure-ai-endpoint"
os.environ["AZURE_AI_API_VERSION"] = "2025-04-01-preview"

# Edit an image with a prompt
response = litellm.image_edit(
    model="azure_ai/FLUX.1-Kontext-pro",
    image=open("path/to/your/image.png", "rb"),
    prompt="Add a winter theme with snow and cold colors",
    api_base=os.environ["AZURE_AI_API_BASE"],
    api_key=os.environ["AZURE_AI_API_KEY"],
    api_version=os.environ["AZURE_AI_API_VERSION"]
)

img_base64 = response.data[0].get("b64_json")
img_bytes = base64.b64decode(img_base64)
path = Path("edited_image.png")
path.write_bytes(img_bytes)
```

</TabItem>

<TabItem value="async-edit" label="Async Usage">

```python showLineNumbers title="Async Image Editing"
import os
import base64
from pathlib import Path

import litellm
import asyncio

# Set your API credentials
os.environ["AZURE_AI_API_KEY"] = "your-api-key-here"
os.environ["AZURE_AI_API_BASE"] = "your-azure-ai-endpoint"
os.environ["AZURE_AI_API_VERSION"] = "2025-04-01-preview"

async def edit_image():
    # Edit image asynchronously
    response = await litellm.aimage_edit(
        model="azure_ai/FLUX.1-Kontext-pro",
        image=open("path/to/your/image.png", "rb"),
        prompt="Make this image look like a watercolor painting",
        api_base=os.environ["AZURE_AI_API_BASE"],
        api_key=os.environ["AZURE_AI_API_KEY"],
        api_version=os.environ["AZURE_AI_API_VERSION"]
    )
    img_base64 = response.data[0].get("b64_json")
    img_bytes = base64.b64decode(img_base64)
    path = Path("async_edited_image.png")
    path.write_bytes(img_bytes)

# Run the async function
asyncio.run(edit_image())
```

</TabItem>

<TabItem value="advanced-edit" label="Advanced Parameters">

```python showLineNumbers title="Advanced Image Editing with Parameters"
import os
import base64
from pathlib import Path

import litellm

# Set your API credentials
os.environ["AZURE_AI_API_KEY"] = "your-api-key-here"
os.environ["AZURE_AI_API_BASE"] = "your-azure-ai-endpoint"
os.environ["AZURE_AI_API_VERSION"] = "2025-04-01-preview"

# Edit image with additional parameters
response = litellm.image_edit(
    model="azure_ai/FLUX.1-Kontext-pro",
    image=open("path/to/your/image.png", "rb"),
    prompt="Add magical elements like floating crystals and mystical lighting",
    api_base=os.environ["AZURE_AI_API_BASE"],
    api_key=os.environ["AZURE_AI_API_KEY"],
    api_version=os.environ["AZURE_AI_API_VERSION"],
    n=1
)
img_base64 = response.data[0].get("b64_json")
img_bytes = base64.b64decode(img_base64)
path = Path("advanced_edited_image.png")
path.write_bytes(img_bytes)
```

</TabItem>

<TabItem value="flux2-multi-edit" label="FLUX 2 Multi-Reference">

```python showLineNumbers title="FLUX 2 Flex Edit with Several Reference Images"
import os
import base64
from pathlib import Path

import litellm

os.environ["AZURE_AI_API_KEY"] = "your-api-key-here"
os.environ["AZURE_AI_API_BASE"] = "your-azure-ai-endpoint"  # e.g., https://your-resource.services.ai.azure.com

# FLUX 2 Flex accepts up to 10 reference images, FLUX 2 Pro up to 8
response = litellm.image_edit(
    model="azure_ai/FLUX.2-flex",
    image=[open("subject.png", "rb"), open("style.png", "rb")],
    prompt="Render the subject from the first image in the style of the second",
    api_base=os.environ["AZURE_AI_API_BASE"],
    api_key=os.environ["AZURE_AI_API_KEY"],
    api_version="preview",
    size="1024x1024",
    guidance=4.5,
    steps=32,
)
img_bytes = base64.b64decode(response.data[0].get("b64_json"))
Path("flux2_edited_image.png").write_bytes(img_bytes)
```

</TabItem>
</Tabs>

### Usage - LiteLLM Proxy Server

#### 1. Configure your config.yaml

```yaml showLineNumbers title="Azure AI Image Editing Configuration"
model_list:
  - model_name: azure-flux-kontext-edit
    litellm_params:
      model: azure_ai/FLUX.1-Kontext-pro
      api_key: os.environ/AZURE_AI_API_KEY
      api_base: os.environ/AZURE_AI_API_BASE
      api_version: os.environ/AZURE_AI_API_VERSION
    model_info:
      mode: image_edit

  - model_name: azure-flux-2-flex-edit
    litellm_params:
      model: azure_ai/FLUX.2-flex
      api_key: os.environ/AZURE_AI_API_KEY
      api_base: os.environ/AZURE_AI_API_BASE
      api_version: preview
    model_info:
      mode: image_edit

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

#### 2. Start LiteLLM Proxy Server

```bash showLineNumbers title="Start LiteLLM Proxy Server"
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

#### 3. Make image editing requests with OpenAI Python SDK

<Tabs>
<TabItem value="openai-edit-sdk" label="OpenAI SDK">

```python showLineNumbers title="Azure AI Image Editing via Proxy - OpenAI SDK"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="sk-<your-litellm-api-key>"                  # Your proxy API key
)

# Edit image with FLUX Kontext Pro
response = client.images.edit(
    model="azure-flux-kontext-edit",
    image=open("path/to/your/image.png", "rb"),
    prompt="Transform this image into a beautiful oil painting style",
)

img_base64 = response.data[0].b64_json
img_bytes = base64.b64decode(img_base64)
path = Path("proxy_edited_image.png")
path.write_bytes(img_bytes)
```

</TabItem>

<TabItem value="litellm-edit-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Azure AI Image Editing via Proxy - LiteLLM SDK"
import litellm

# Edit image through proxy
response = litellm.image_edit(
    model="litellm_proxy/azure-flux-kontext-edit",
    image=open("path/to/your/image.png", "rb"),
    prompt="Add a mystical forest background with magical creatures",
    api_base="http://localhost:4000",
    api_key="sk-<your-litellm-api-key>"
)

img_base64 = response.data[0].b64_json
img_bytes = base64.b64decode(img_base64)
path = Path("proxy_edited_image.png")
path.write_bytes(img_bytes)
```

</TabItem>

<TabItem value="curl-edit" label="cURL">

```bash showLineNumbers title="Azure AI Image Editing via Proxy - cURL"
curl --location 'http://localhost:4000/v1/images/edits' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--form 'model="azure-flux-kontext-edit"' \
--form 'prompt="Convert this image to a vintage sepia tone with old-fashioned effects"' \
--form 'image=@"path/to/your/image.png"'
```

</TabItem>
</Tabs>

## Supported Parameters

Azure AI Image Editing supports the following OpenAI-compatible parameters:

| Parameter | Type | Description | Default | Example |
|-----------|------|-------------|---------|---------|
| `image` | file | The image file to edit | Required | File object or binary data |
| `prompt` | string | Text description of the desired changes | Required | `"Add snow and winter elements"` |
| `model` | string | The FLUX model to use for editing | Required | `"azure_ai/FLUX.1-Kontext-pro"` |
| `n` | integer | Number of edited images to generate (You can specify only 1) | `1` | `1` |
| `api_base` | string | Your Azure AI endpoint URL | Required | `"https://your-endpoint.eastus2.inference.ai.azure.com/"` |
| `api_key` | string | Your Azure AI API key | Required | Environment variable or direct value |
| `api_version` | string | API version for Azure AI | Required | `"2025-04-01-preview"` |

FLUX 2 Pro and FLUX 2 Flex edits take the same parameters as [FLUX 2 generation](./azure_ai_img#flux-2-parameters): `size` (or `width` and `height`), `output_format`, `seed`, `safety_tolerance`, `aspect_ratio`, and for Flex `guidance` and `steps`. The OpenAI-only fields `user`, `quality`, `background`, `moderation`, and `output_compression` are accepted and dropped, so an OpenAI SDK client that sets them keeps working

## Getting Started

1. Create an account at [Azure AI Studio](https://ai.azure.com/)
2. Deploy a FLUX model in your Azure AI Studio workspace
3. Get your API key and endpoint from the deployment details
4. Set your `AZURE_AI_API_KEY`, `AZURE_AI_API_BASE` and `AZURE_AI_API_VERSION` environment variables
5. Prepare your source image
6. Use `litellm.image_edit()` to modify your images with text instructions

## Additional Resources

- [Azure AI Studio Documentation](https://docs.microsoft.com/en-us/azure/ai-services/)
- [FLUX Models Announcement](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/black-forest-labs-flux-1-kontext-pro-and-flux1-1-pro-now-available-in-azure-ai-f/4434659)