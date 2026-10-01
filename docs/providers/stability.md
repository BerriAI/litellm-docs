# Stability AI
https://stability.ai/

## Overview

| Property | Details |
|-------|-------|
| Description | Stability AI creates open AI models for image, video, audio, and 3D generation. Known for Stable Diffusion. |
| Provider Route on LiteLLM | `stability/` |
| Link to Provider Doc | [Stability AI API ↗](https://platform.stability.ai/docs/api-reference) |
| Supported Operations | [`/images/generations`](#image-generation), [`/images/edits`](#image-editing) |

LiteLLM supports Stability AI Image Generation calls via the Stability AI REST API (not via Bedrock).

## API Key

```python
# env variable
os.environ['STABILITY_API_KEY'] = "your-api-key"
```

Get your API key from the [Stability AI Platform](https://platform.stability.ai/).

## Image Generation

### Usage - LiteLLM Python SDK

```python showLineNumbers
from litellm import image_generation
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Stability AI image generation call
response = image_generation(
    model="stability/sd3.5-large",
    prompt="A beautiful sunset over a calm ocean",
)
print(response)
```

### Usage - LiteLLM Proxy Server

#### 1. Setup config.yaml

```yaml showLineNumbers
model_list:
  - model_name: sd3
    litellm_params:
      model: stability/sd3.5-large
      api_key: os.environ/STABILITY_API_KEY
    model_info:
      mode: image_generation

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

#### 2. Start the proxy

```bash showLineNumbers
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

#### 3. Test it

```bash showLineNumbers
curl --location 'http://0.0.0.0:4000/v1/images/generations' \
--header 'Content-Type: application/json' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--data '{
    "model": "sd3",
    "prompt": "A beautiful sunset over a calm ocean"
}'
```

### Advanced Usage - With Additional Parameters

```python showLineNumbers
from litellm import image_generation
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

response = image_generation(
    model="stability/sd3.5-large",
    prompt="A beautiful sunset over a calm ocean",
    size="1792x1024",  # Maps to aspect_ratio 16:9
    negative_prompt="blurry, low quality",  # Stability-specific
    seed=12345,  # For reproducibility
)
print(response)
```

### Supported Parameters

Stability AI supports the following OpenAI-compatible parameters:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `size` | string | Image dimensions (mapped to aspect_ratio) | `"1024x1024"` |
| `n` | integer | Number of images (note: Stability returns 1 per request) | `1` |
| `response_format` | string | Format of response (`b64_json` only for Stability) | `"b64_json"` |

### Size to Aspect Ratio Mapping

The `size` parameter is automatically mapped to Stability's `aspect_ratio`:

| OpenAI Size | Stability Aspect Ratio |
|-------------|----------------------|
| `1024x1024` | `1:1` |
| `1792x1024` | `16:9` |
| `1024x1792` | `9:16` |
| `512x512` | `1:1` |
| `256x256` | `1:1` |

### Using Stability-Specific Parameters

You can pass parameters that are specific to Stability AI directly in your request:

```python showLineNumbers
from litellm import image_generation
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

response = image_generation(
    model="stability/sd3.5-large",
    prompt="A beautiful sunset over a calm ocean",
    # Stability-specific parameters
    negative_prompt="blurry, watermark, text",
    aspect_ratio="16:9",  # Use directly instead of size
    seed=42,
    output_format="png",  # png, jpeg, or webp
)
print(response)
```

### Supported Image Generation Models

| Model Name | Function Call | Description |
|------------|---------------|-------------|
| sd3 | `image_generation(model="stability/sd3", ...)` | Stable Diffusion 3 |
| sd3-large | `image_generation(model="stability/sd3-large", ...)` | SD3 Large |
| sd3-large-turbo | `image_generation(model="stability/sd3-large-turbo", ...)` | SD3 Large Turbo (faster) |
| sd3-medium | `image_generation(model="stability/sd3-medium", ...)` | SD3 Medium |
| sd3.5-large | `image_generation(model="stability/sd3.5-large", ...)` | SD 3.5 Large (recommended) |
| sd3.5-large-turbo | `image_generation(model="stability/sd3.5-large-turbo", ...)` | SD 3.5 Large Turbo |
| sd3.5-medium | `image_generation(model="stability/sd3.5-medium", ...)` | SD 3.5 Medium |
| stable-image-ultra | `image_generation(model="stability/stable-image-ultra", ...)` | Stable Image Ultra |
| stable-image-core | `image_generation(model="stability/stable-image-core", ...)` | Stable Image Core |

For more details on available models and features, see: https://platform.stability.ai/docs/api-reference

## Response Format

Stability AI returns images in base64 format. The response is OpenAI-compatible:

```python
{
    "created": 1234567890,
    "data": [
        {
            "b64_json": "iVBORw0KGgo..."  # Base64 encoded image
        }
    ]
}
```

## Image Editing

Stability AI supports various image editing operations including inpainting, upscaling, outpainting, background removal, and more.

:::info[Optional Parameters]
**Important:** Different Stability models have different parameter requirements:
- Some models don't require a `prompt` (e.g., upscaling, background removal)
- The `outpaint` model takes numeric `left` and `right` pixel counts. LiteLLM does not forward `up` or `down`, the fields Stability uses for vertical outpainting, so only horizontal outpainting works through `stability/` today
- Style Transfer is not reachable through `stability/` today: `stability/style-transfer` resolves to the Style Guide endpoint (`/v2beta/stable-image/control/style`) and the input is always sent as `image`, while Stability's Style Transfer endpoint requires `init_image`
:::

### Usage - LiteLLM Python SDK

#### Inpainting (Edit with Mask)

```python showLineNumbers
from litellm import image_edit
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Inpainting - edit specific areas using a mask
response = image_edit(
    model="stability/inpaint",
    image=open("original_image.png", "rb"),
    mask=open("mask_image.png", "rb"), 
    prompt="Add a beautiful sunset in the masked area",
    size="1024x1024",
)
print(response)
```

#### Image Upscaling

```python showLineNumbers
from litellm import image_edit
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Conservative upscaling - preserves details
response = image_edit(
    model="stability/conservative",
    image=open("low_res_image.png", "rb"),
    prompt="Upscale this image while preserving details",
)

# Creative upscaling - adds creative details
response = image_edit(
    model="stability/creative",
    image=open("low_res_image.png", "rb"),
    prompt="Upscale and enhance with creative details",
    creativity=0.3,  # 0-0.35, higher = more creative
)

# Fast upscaling - quick upscaling (no prompt needed)
response = image_edit(
    model="stability/fast",
    image=open("low_res_image.png", "rb"),
    # No prompt required for fast upscale
)
print(response)
```

#### Image Outpainting

```python showLineNumbers
from litellm import image_edit
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Extend image beyond its borders
response = image_edit(
    model="stability/outpaint",
    image=open("original_image.png", "rb"),
    prompt="Extend this landscape with mountains",
    left=100,   # Pixels to extend on the left
    right=100,  # Pixels to extend on the right
)
print(response)
```

#### Background Removal

```python showLineNumbers
from litellm import image_edit
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Remove background from image
response = image_edit(
    model="stability/remove-background",
    image=open("portrait.png", "rb"),
    # No prompt required for fast upscale
)
print(response)
```

#### Search and Replace

```python showLineNumbers
from litellm import image_edit
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Search and replace objects in image
response = image_edit(
    model="stability/search-and-replace",
    image=open("scene.png", "rb"),
    prompt="A red sports car",
    search_prompt="blue sedan",  # What to replace
)

# Search and recolor
response = image_edit(
    model="stability/search-and-recolor",
    image=open("scene.png", "rb"),
    prompt="Make it golden yellow",
    select_prompt="the car",  # What to recolor
)
print(response)
```

#### Image Control (Sketch/Structure)

```python showLineNumbers
from litellm import image_edit
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Control with sketch
response = image_edit(
    model="stability/sketch",
    image=open("sketch.png", "rb"),
    prompt="Turn this sketch into a realistic photo",
    control_strength=0.7,  # 0-1, higher = more control
)

# Control with structure
response = image_edit(
    model="stability/structure",
    image=open("structure_reference.png", "rb"),
    prompt="Generate image following this structure",
    control_strength=0.7,
)
print(response)
```

#### Erase Objects

```python showLineNumbers
from litellm import image_edit
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Erase objects from image
response = image_edit(
    model="stability/erase",
    image=open("scene.png", "rb"),
    mask=open("object_mask.png", "rb"),  # Mask the object to erase
    # No prompt needed
)
print(response)
```
#### Style Guide

```python showLineNumbers
from litellm import image_edit
import os

os.environ['STABILITY_API_KEY'] = "your-api-key"

# Generate a new image in the style of a reference image
response = image_edit(
    model="stability/style",
    image=open("style_reference.png", "rb"),  # Style reference
    prompt="A lighthouse on a cliff at sunset",
)

print(response)
```

### Supported Image Edit Models

| Model Name | Function Call | Description |
|------------|---------------|-------------|
| inpaint | `image_edit(model="stability/inpaint", ...)` | Inpainting with mask |
| conservative | `image_edit(model="stability/conservative", ...)` | Conservative upscaling |
| creative | `image_edit(model="stability/creative", ...)` | Creative upscaling |
| fast | `image_edit(model="stability/fast", ...)` | Fast upscaling |
| outpaint | `image_edit(model="stability/outpaint", ...)` | Extend image borders |
| remove-background | `image_edit(model="stability/remove-background", ...)` | Remove background |
| search-and-replace | `image_edit(model="stability/search-and-replace", ...)` | Search and replace objects |
| search-and-recolor | `image_edit(model="stability/search-and-recolor", ...)` | Search and recolor |
| sketch | `image_edit(model="stability/sketch", ...)` | Control with sketch |
| structure | `image_edit(model="stability/structure", ...)` | Control with structure |
| erase | `image_edit(model="stability/erase", ...)` | Erase objects |
| style | `image_edit(model="stability/style", ...)` | Apply style guide |

### Usage - LiteLLM Proxy Server

#### 1. Setup config.yaml

```yaml showLineNumbers
model_list:
  - model_name: stability-inpaint
    litellm_params:
      model: stability/inpaint
      api_key: os.environ/STABILITY_API_KEY
    model_info:
      mode: image_edit

  - model_name: stability-upscale
    litellm_params:
      model: stability/conservative
      api_key: os.environ/STABILITY_API_KEY
    model_info:
      mode: image_edit

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

#### 2. Start the proxy

```bash showLineNumbers
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

#### 3. Test it

```bash showLineNumbers
curl -X POST "http://0.0.0.0:4000/v1/images/edits" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -F "model=stability-inpaint" \
  -F "image=@original_image.png" \
  -F "mask=@mask_image.png" \
  -F "prompt=Add a beautiful garden in the masked area"
```

## AWS Bedrock (Stability)

LiteLLM also supports Stability AI models via AWS Bedrock. This is useful if you're already using AWS infrastructure.

### Usage - Bedrock Stability

```python showLineNumbers
from litellm import image_edit
import os

# Set AWS credentials
os.environ["AWS_ACCESS_KEY_ID"] = "your-access-key"
os.environ["AWS_SECRET_ACCESS_KEY"] = "your-secret-key"
os.environ["AWS_REGION_NAME"] = "us-east-1"

# Bedrock Stability inpainting
response = image_edit(
    model="bedrock/us.stability.stable-image-inpaint-v1:0",
    image=open("original_image.png", "rb"),
    mask=open("mask_image.png", "rb"),
    prompt="Add flowers in the masked area",
)
print(response)

# Fast upscale without prompt
response = image_edit(
    model="bedrock/stability.stable-fast-upscale-v1:0",
    image=open("low_res_image.png", "rb"),
)

# Outpaint with numeric parameters
response = image_edit(
    model="bedrock/stability.stable-outpaint-v1:0",
    image=open("original_image.png", "rb"),
    left=100,   # Automatically converted to int
    right=100,
    up=50,
    down=50,
)

print(response)
```

### Supported Bedrock Stability Models

All Stability AI image edit models are available via Bedrock with the `bedrock/` prefix:

| Direct API Model | Bedrock Model | Description |
|------------------|---------------|-------------|
| stability/inpaint | bedrock/us.stability.stable-image-inpaint-v1:0 | Inpainting |
| stability/conservative | bedrock/stability.stable-conservative-upscale-v1:0 | Conservative upscaling |
| stability/creative | bedrock/stability.stable-creative-upscale-v1:0 | Creative upscaling |
| stability/fast | bedrock/stability.stable-fast-upscale-v1:0 | Fast upscaling |
| stability/outpaint | bedrock/stability.stable-outpaint-v1:0 | Outpainting |
| stability/remove-background | bedrock/stability.stable-image-remove-background-v1:0 | Remove background |
| stability/search-and-replace | bedrock/stability.stable-image-search-replace-v1:0 | Search and replace |
| stability/search-and-recolor | bedrock/stability.stable-image-search-recolor-v1:0 | Search and recolor |
| stability/sketch | bedrock/stability.stable-image-control-sketch-v1:0 | Control with sketch |
| stability/structure | bedrock/stability.stable-image-control-structure-v1:0 | Control with structure |
| stability/erase | bedrock/stability.stable-image-erase-object-v1:0 | Erase objects |

**Note:** Bedrock model IDs may use `us.stability.*` or `stability.*` prefix depending on the region and model.

## Comparing Routes

LiteLLM supports Stability AI models via two routes:

| Route | Provider | Use Case | Image Generation | Image Editing |
|-------|----------|----------|------------------|---------------|
| `stability/` | Stability AI Direct API | Direct access, all latest models | ✅ | ✅ |
| `bedrock/stability.*` | AWS Bedrock | AWS integration, enterprise features | ✅ | ✅ |

Use `stability/` for direct API access. Use `bedrock/stability.*` if you're already using AWS Bedrock.
