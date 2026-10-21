# OpenRouter
LiteLLM supports all the text / chat / vision / embedding models from [OpenRouter](https://openrouter.ai/docs)

<a target="_blank" href="https://colab.research.google.com/github/BerriAI/litellm/blob/main/cookbook/LiteLLM_OpenRouter.ipynb">
  <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/>
</a>

## Usage
```python
import os
from litellm import completion

os.environ["OPENROUTER_API_KEY"] = ""
os.environ["OPENROUTER_API_BASE"] = "" # [OPTIONAL] defaults to https://openrouter.ai/api/v1
os.environ["OR_SITE_URL"] = "" # [OPTIONAL]
os.environ["OR_APP_NAME"] = "" # [OPTIONAL]

response = completion(
            model="openrouter/google/palm-2-chat-bison",
            messages=messages,
        )
```

## Configuration with Environment Variables

For production environments, you can dynamically configure the base_url using environment variables:

```python
import os
from litellm import completion

# Configure with environment variables
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")

# Set environment for LiteLLM
os.environ["OPENROUTER_API_KEY"] = OPENROUTER_API_KEY
os.environ["OPENROUTER_API_BASE"] = OPENROUTER_BASE_URL

response = completion(
    model="openrouter/google/palm-2-chat-bison",
    messages=messages,
    base_url=OPENROUTER_BASE_URL  # Explicitly pass base_url for clarity
)
```

This approach provides better flexibility for managing configurations across different environments (dev, staging, production) and makes it easier to switch between self-hosted and cloud endpoints.

## OpenRouter Completion Models
LiteLLM supports ALL OpenRouter models, send `model=openrouter/<your-openrouter-model>` to send it to open router. See all openrouter models [here](https://openrouter.ai/models)

| Model Name                | Function Call                                       |
|---------------------------|-----------------------------------------------------|
| openrouter/openai/gpt-3.5-turbo | `completion('openrouter/openai/gpt-3.5-turbo', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/openai/gpt-3.5-turbo-16k | `completion('openrouter/openai/gpt-3.5-turbo-16k', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/openai/gpt-4    | `completion('openrouter/openai/gpt-4', messages)`       | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/openai/gpt-4-32k | `completion('openrouter/openai/gpt-4-32k', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/anthropic/claude-2 | `completion('openrouter/anthropic/claude-2', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/anthropic/claude-instant-v1 | `completion('openrouter/anthropic/claude-instant-v1', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/google/palm-2-chat-bison | `completion('openrouter/google/palm-2-chat-bison', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/google/palm-2-codechat-bison | `completion('openrouter/google/palm-2-codechat-bison', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/meta-llama/llama-2-13b-chat | `completion('openrouter/meta-llama/llama-2-13b-chat', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |
| openrouter/meta-llama/llama-2-70b-chat | `completion('openrouter/meta-llama/llama-2-70b-chat', messages)` | `os.environ['OR_SITE_URL']`,`os.environ['OR_APP_NAME']`,`os.environ['OPENROUTER_API_KEY']` |

## Passing OpenRouter Params - transforms, models, route
Pass `transforms`, `models`, `route`as arguments to `litellm.completion()`

```python
import os
from litellm import completion

os.environ["OPENROUTER_API_KEY"] = ""

response = completion(
            model="openrouter/google/palm-2-chat-bison",
            messages=messages,
            transforms = [""],
            route= ""
        )
```

## Embedding

```python
from litellm import embedding
import os

os.environ["OPENROUTER_API_KEY"] = "your-api-key"

response = embedding(
    model="openrouter/openai/text-embedding-3-small",
    input=["good morning from litellm", "this is another item"],
)
print(response)
```

## Image Generation

OpenRouter supports image generation through select models like Google Gemini image generation models. LiteLLM transforms standard image generation requests to OpenRouter's chat completion format.

### Supported Parameters

- `size`: Maps to OpenRouter's `aspect_ratio` format
  - `1024x1024` → `1:1` (square)
  - `1536x1024` → `3:2` (landscape)
  - `1024x1536` → `2:3` (portrait)
  - `1792x1024` → `16:9` (wide landscape)
  - `1024x1792` → `9:16` (tall portrait)

- `quality`: Maps to OpenRouter's `image_size` format (Gemini models)
  - `low` or `standard` → `1K`
  - `medium` → `2K`
  - `high` or `hd` → `4K`

- `n`: Number of images to generate

### Usage

```python
from litellm import image_generation
import os

os.environ["OPENROUTER_API_KEY"] = "your-api-key"

# Basic image generation
response = image_generation(
    model="openrouter/google/gemini-2.5-flash-image",
    prompt="A beautiful sunset over a calm ocean",
)
print(response)
```

### Advanced Usage with Parameters

```python
from litellm import image_generation
import os

os.environ["OPENROUTER_API_KEY"] = "your-api-key"

# Generate high-quality landscape image
response = image_generation(
    model="openrouter/google/gemini-2.5-flash-image",
    prompt="A serene mountain landscape with a lake",
    size="1536x1024",  # Landscape format
    quality="high",     # High quality (4K)
)

# Access the generated image
image_data = response.data[0]
if image_data.b64_json:
    # Base64 encoded image
    print(f"Generated base64 image: {image_data.b64_json[:50]}...")
elif image_data.url:
    # Image URL
    print(f"Generated image URL: {image_data.url}")
```

### Using OpenRouter-Specific Parameters

You can also pass OpenRouter-specific parameters directly using `image_config`:

```python
from litellm import image_generation
import os

os.environ["OPENROUTER_API_KEY"] = "your-api-key"

response = image_generation(
    model="openrouter/google/gemini-2.5-flash-image",
    prompt="A futuristic cityscape at night",
    image_config={
        "aspect_ratio": "16:9",  # OpenRouter native format
        "image_size": "4K"       # OpenRouter native format
    }
)
print(response)
```

### Response Format

The response follows the standard LiteLLM ImageResponse format:

```python
{
    "created": 1703658209,
    "data": [{
        "b64_json": "iVBORw0KGgoAAAANSUhEUgAA...",  # Base64 encoded image
        "url": None,
        "revised_prompt": None
    }],
    "usage": {
        "input_tokens": 10,
        "output_tokens": 1290,
        "total_tokens": 1300
    }
}
```

### Cost Tracking

OpenRouter provides cost information in the response, which LiteLLM automatically tracks:

```python
response = image_generation(
    model="openrouter/google/gemini-2.5-flash-image",
    prompt="A cute baby sea otter",
)

# Cost is available in the response metadata
print(f"Request cost: ${response._hidden_params['additional_headers']['llm_provider-x-litellm-response-cost']}")
```

## Image Edit

OpenRouter supports image editing through select models like Google Gemini image models. LiteLLM routes image edit requests to OpenRouter's chat completions endpoint with the source image sent as a base64 data URL and `modalities: ["image", "text"]`.

### Supported Models

| Model | Description |
|-------|-------------|
| `openrouter/google/gemini-2.5-flash-image` | Gemini 2.5 Flash with image editing |

See all available image models on [OpenRouter's model list](https://openrouter.ai/models?modality=image).

### Supported Parameters

| Parameter | OpenRouter Mapping | Notes |
|-----------|--------------------|-------|
| `size` | `image_config.aspect_ratio` | `1024x1024` → `1:1`, `1536x1024` → `3:2`, `1024x1536` → `2:3`, `1792x1024` → `16:9`, `1024x1792` → `9:16` |
| `quality` | `image_config.image_size` | `low`/`standard` → `1K`, `medium` → `2K`, `high`/`hd` → `4K` |
| `n` | `n` | Number of images |

:::note
`quality=high` (4K) is only supported by `google/gemini-3-pro-image-preview` and `google/gemini-3.1-flash-image-preview`. The `google/gemini-2.5-flash-image` model supports up to `medium` (2K).
:::

### Usage

```python
from litellm import image_edit
import os

os.environ["OPENROUTER_API_KEY"] = "your-api-key"

# Basic image edit
response = image_edit(
    model="openrouter/google/gemini-2.5-flash-image",
    image=open("original_image.png", "rb"),
    prompt="Make the sky a vibrant purple sunset",
)

print(response)
```

### Advanced Usage with Parameters

```python
from litellm import image_edit
import os

os.environ["OPENROUTER_API_KEY"] = "your-api-key"

# Edit with size and quality parameters
response = image_edit(
    model="openrouter/google/gemini-2.5-flash-image",
    image=open("photo.png", "rb"),
    prompt="Add northern lights to the sky",
    size="1536x1024",   # Maps to aspect_ratio 3:2
    quality="high",      # Maps to image_size 4K
)

# Access the edited image
image_data = response.data[0]
if image_data.b64_json:
    import base64
    with open("edited.png", "wb") as f:
        f.write(base64.b64decode(image_data.b64_json))
```

### Multiple Images Edit

```python
from litellm import image_edit
import os

os.environ["OPENROUTER_API_KEY"] = "your-api-key"

response = image_edit(
    model="openrouter/google/gemini-2.5-flash-image",
    image=[
        open("scene.png", "rb"),
        open("style_reference.png", "rb"),
    ],
    prompt="Blend the reference style into the scene",
)

print(response)
```

## Decisions (Jev)

OpenRouter serves TypeSafe's Jev decision models on its Decisions API, `POST https://openrouter.ai/api/alpha/decisions`, and rejects them on `/chat/completions`. The LiteLLM proxy reaches that API in two ways.

### Through `/v1/systemone` and `/v1/decisions`

Add the model to your `model_list` with the `openrouter/` prefix. The model then goes through the router like any other deployment, so it gets load balancing, fallbacks and per-deployment keys, and you can call it with a System One body on [`/v1/systemone`](../decisions/systemone_format.md) or an OpenAI Decisions body on [`/v1/decisions`](../decisions/openai_format.md).

```yaml showLineNumbers
model_list:
  - model_name: jev
    litellm_params:
      model: openrouter/typesafe/jev-1.14
      api_key: os.environ/OPENROUTER_API_KEY
```

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "jev",
  "state": "The sky is blue on a clear day.",
  "questions": {"blue": {"type": "noul", "instructions": "Is the sky described as blue?"}}
}'
```

From v1.104.3, the spend is the `usage.cost` that OpenRouter returns. LiteLLM sends it back in the `x-litellm-response-cost` header and writes it to the spend logs. Earlier releases have no price for `jev-1.14`, and `v1.105.0-rc.3` and the `v1.106.0` dev builds do not read `usage.cost` either. See [Decisions](../decisions/index.md) for the formats and the supported features.

### Through the `/openrouter` pass-through

`/openrouter/{path}` sends the request body to OpenRouter as it is. The key it sends comes from the first OpenRouter deployment in `model_list` (an `openrouter/` model or `custom_llm_provider: openrouter`) that sets `use_in_pass_through: true` and has a key, either its `api_key` or the one in its `litellm_credential_name`, or from `OPENROUTER_API_KEY` when no deployment does. The request always goes to `OPENROUTER_API_BASE`, never to that deployment's `api_base`. Use it when you already have OpenRouter Decisions request bodies and do not need routing. It is in v1.104.0 and later, and in v1.101.1 and v1.102.1 and the later patches on those two lines, but in no v1.103 release.

The path is relative to `https://openrouter.ai/api`, which is `OPENROUTER_API_BASE` without its trailing `/v1`. So the Decisions API is `/openrouter/alpha/decisions`. Do not add `/api` to the path, since `/openrouter/api/alpha/decisions` goes to `https://openrouter.ai/api/api/alpha/decisions` and OpenRouter answers it with a 404.

A virtual key with a `models` list needs `typesafe/jev-1.14`, the model name in the request body, in that list to call the pass-through. A `model_list` alias such as `jev` is not enough, and the call gets a 403.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/openrouter/alpha/decisions' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "typesafe/jev-1.14",
  "state": "The sky is blue on a clear day.",
  "questions": {"blue": {"type": "noul", "instructions": "Is the sky described as blue?"}}
}'
```

Response

```json
{
  "model": "typesafe/jev-1.14-20261014",
  "answers": {"blue": {"type": "noul", "noul": 0.99}},
  "usage": {"input_tokens": 282, "output_tokens": 20, "cost": 0.000011844},
  "id": "gen-dec-1792543634-CgEHGExRXfbzgBwKxiWf",
  "provider": "TypeSafe"
}
```

LiteLLM logs each `/alpha/decisions` call under the versioned model that OpenRouter returns, for example `openrouter/typesafe/jev-1.14-20261014`. From v1.104.3, the spend is the `usage.cost` in the response, and earlier releases have no price for `jev-1.14`. The `v1.105.0` dev builds and release candidates and the `v1.106.0` dev builds do not read `usage.cost` either. Calls to other `/openrouter` paths, such as `/openrouter/v1/chat/completions`, are forwarded but record $0 spend, so budgets do not count them.
