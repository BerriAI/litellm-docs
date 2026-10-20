# Volcano Engine (Volcengine)
https://www.volcengine.com/docs/82379/1263482

:::tip

**We support ALL Volcengine models including Chat and Embeddings, just set `model=volcengine/<any-model-on-volcengine>` as a prefix when sending litellm requests**

:::

## API Key
```python
# env variable
os.environ['VOLCENGINE_API_KEY']
# or
os.environ['ARK_API_KEY']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['VOLCENGINE_API_KEY'] = ""
response = completion(
    model="volcengine/<OUR_ENDPOINT_ID>",
    messages=[
        {
            "role": "user",
            "content": "What's the weather like in Boston today in Fahrenheit?",
        }
    ],
    temperature=0.2,        # optional
    top_p=0.9,              # optional
    frequency_penalty=0.1,  # optional
    presence_penalty=0.1,   # optional
    max_tokens=10,          # optional
    stop=["\n\n"],          # optional
)
print(response)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['VOLCENGINE_API_KEY'] = ""
response = completion(
    model="volcengine/<OUR_ENDPOINT_ID>",
    messages=[
        {
            "role": "user",
            "content": "What's the weather like in Boston today in Fahrenheit?",
        }
    ],
    stream=True,
    temperature=0.2,        # optional
    top_p=0.9,              # optional
    frequency_penalty=0.1,  # optional
    presence_penalty=0.1,   # optional
    max_tokens=10,          # optional
    stop=["\n\n"],          # optional
)

for chunk in response:
    print(chunk)
```

## Sample Usage - Embedding
```python
from litellm import embedding
import os

os.environ['VOLCENGINE_API_KEY'] = ""
response = embedding(
    model="volcengine/doubao-embedding-text-240715",
    input=["hello world", "good morning"]
)
print(response)
```

### Supported Embedding Models
- `doubao-embedding-large` (2048 dimensions)
- `doubao-embedding-large-text-250515` (2048 dimensions)
- `doubao-embedding-large-text-240915` (4096 dimensions)
- `doubao-embedding` (2560 dimensions) 
- `doubao-embedding-text-240715` (2560 dimensions)

### Embedding Parameters
```python
from litellm import embedding

response = embedding(
    model="volcengine/doubao-embedding-text-240715",
    input=["sample text"],
    encoding_format="float",  # optional: "float" (default), "base64"
    user="user-123",          # optional: user identifier for tracking
)
```

## Supported Models - ALL Volcengine Models Supported!
We support ALL `volcengine` models for both chat completions and embeddings:
- **Chat Models**: Set `volcengine/<OUR_ENDPOINT_ID>` as a prefix when sending completion requests
- **Embedding Models**: Use the specific model names listed above (e.g., `volcengine/doubao-embedding-text-240715`)

## Sample Usage - LiteLLM Proxy

### Config.yaml setting

```yaml
model_list:
  # Chat model
  - model_name: volcengine-model
    litellm_params:
      model: volcengine/<OUR_ENDPOINT_ID>
      api_key: os.environ/VOLCENGINE_API_KEY
  # Embedding model
  - model_name: volcengine-embedding
    litellm_params:
      model: volcengine/doubao-embedding-text-240715
      api_key: os.environ/VOLCENGINE_API_KEY
```

### Send Request

#### Chat Completion
```shell
curl --location 'http://localhost:4000/chat/completions' \
    --header "Authorization: Bearer $LITELLM_API_KEY" \
    --header 'Content-Type: application/json' \
    --data '{
    "model": "volcengine-model",
    "messages": [
        {
        "role": "user",
        "content": "here is my api key. openai_api_key=sk-<your-api-key>"
        }
    ]
}'
```

#### Embedding
```shell
curl --location 'http://localhost:4000/embeddings' \
    --header "Authorization: Bearer $LITELLM_API_KEY" \
    --header 'Content-Type: application/json' \
    --data '{
    "model": "volcengine-embedding",
    "input": ["hello world", "good morning"]
}'
```

## Video Generation

Available from v1.108.0.

Doubao-Seedance models run as async tasks on Ark's content generation API. `video_generation` returns a queued video id right away, `video_status` reports `queued`, `in_progress`, `completed`, `failed` or `cancelled`, and `video_content` downloads the mp4 from the signed URL Ark returns once the task succeeds. Downloading before then answers 400.

```python showLineNumbers title="Volcengine Video Generation"
import os
import time
from litellm import video_content, video_generation, video_status

os.environ["ARK_API_KEY"] = "your-api-key"

video = video_generation(
    model="volcengine/doubao-seedance-2-5-260628",
    prompt="A red fox running through fresh snow",
    seconds="4",
    size="854x480",
)

while video.status not in ("completed", "failed", "cancelled"):
    time.sleep(20)
    video = video_status(video_id=video.id)

if video.status == "completed":
    with open("video.mp4", "wb") as f:
        f.write(video_content(video_id=video.id))
```

These four models carry a price per resolution tier:

| Model | Resolution tiers |
|-------|------------------|
| `volcengine/doubao-seedance-2-5-260628` | 480p, 720p, 1080p |
| `volcengine/doubao-seedance-2-0-260128` | 480p, 720p, 1080p, 4k |
| `volcengine/doubao-seedance-2-0-fast-260128` | 480p, 720p |
| `volcengine/doubao-seedance-2-0-mini-260615` | 480p, 720p |

Ark renders a fixed frame per resolution tier and ratio rather than the pixels you ask for, so `size` picks the tier whose 16:9 frame has the closest pixel count, where 960x960 and 1280x720 are both 720p, and the closest of `16:9`, `9:16`, `4:3`, `3:4`, `1:1` and `21:9`, where 854x480 is 16:9. A priced model with neither `size` nor `resolution` runs at 720p, and a `resolution` the model has no price for, such as 1080p on the fast tier, answers 400 unless `drop_params` is on. The poll reports the frame Ark will render for the tier asked for.

Ark bills a task when it finishes while LiteLLM bills the video when the task is created, so every create carries a length and a tier whose cost is known up front. `seconds` sets the length, an omitted `seconds` is sent as OpenAI's default of 4 seconds rather than Ark's own default of picking the length for you, and `seconds="-1"`, that Ark-picked length, answers 400. Spend is logged at create time from the model's per-second rate at the tier sent.

`input_reference` takes the first frame as a URL, or as a `Path`, an open file, bytes or a `(filename, file, content_type)` tuple, which LiteLLM reads and inlines as a base64 data URL, and OpenAI's `{"image_url": "..."}` object. A plain string is always sent to Ark as a URL it fetches itself, even when it looks like a local path. References Ark keeps for the whole clip go in `content` instead, one item per asset with the Ark role it plays, and a caller-supplied `content` array wins over `input_reference`. An `ep-` endpoint id has no price of its own, so it keeps whichever `resolution` you send, and takes a model's tiers when the deployment sets `model_info.base_model`.

These requests answer 400 instead of reaching Ark:

- a text item in `content`, since `prompt` is the only text the input guardrails scan. Move the text into `prompt`, or pass `drop_params` to send it as written
- a video input, which covers an edit, an extension, a remix and a `reference_video` item in `content`, since Ark bills a task with a video input at a lower rate per token that is not known at create time
- `frames`, since Ark counts frames off the length
- `characters`, `image`, or any other field LiteLLM does not send to Ark, unless `drop_params` is on

`user` is sent as Ark's `safety_identifier`. Video calls read `VOLCENGINE_API_BASE` or `ARK_API_BASE` and strip the other surfaces' paths off them, so one base serves chat, embedding and video. Point `api_base` at `https://ark.ap-southeast.bytepluses.com/api/v3` to run the `dreamina-*` ids on BytePlus ModelArk. Those ids have no price in the cost map, so they bill $0 and skip budgets until the deployment sets its own price or a `base_model` in `model_info`.

To serve these models on the proxy, add a deployment and call `/v1/videos`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: seedance
    litellm_params:
      model: volcengine/doubao-seedance-2-5-260628
      api_key: os.environ/ARK_API_KEY
```

```bash showLineNumbers title="Video generation via Proxy - cURL"
curl http://localhost:4000/v1/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "seedance",
    "prompt": "A red fox running through fresh snow",
    "seconds": "4",
    "size": "854x480"
  }'

curl http://localhost:4000/v1/videos/$VIDEO_ID \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl http://localhost:4000/v1/videos/$VIDEO_ID/content \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -o video.mp4
```

The cost map marks these models as `video_generation`, so a proxy health check on a deployment creates a real 4 second video, which Ark bills. With `background_health_checks` on, set `disable_background_health_check: true` in the deployment's `model_info`.

To list the account's tasks, call `litellm.video_list(custom_llm_provider="volcengine")`. Ark pages by number rather than by cursor, so later pages come from `extra_query={"page_num": N}` and `has_more` is always `false`. The list covers every task on the Ark account, and on the proxy `GET /v1/videos?custom_llm_provider=volcengine` serves the first page only.
