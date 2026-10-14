import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# QwenCloud and Qianwen AI Platform (Qwen models)

Alibaba unified its model platform brands (DashScope, Bailian, Model Studio) under [QwenCloud](https://www.qwencloud.com/) outside mainland China and [Qianwen AI Platform](https://www.qianwenai.com/) in mainland China. LiteLLM routes both brands through its existing DashScope implementation, and the legacy `dashscope/` prefix keeps working as an alias

## Overview

| Property | Details |
|-------|-------|
| Description | Alibaba's Qwen model platform, served over an OpenAI-compatible API |
| Provider Routes on LiteLLM | `qwencloud/` (international), `qwen_ai_platform/` (mainland China), `dashscope/` (legacy alias) |
| Link to Provider Doc | [QwenCloud Documentation](https://docs.qwencloud.com/developer-guides/getting-started/introduction), [Qianwen AI Platform Documentation](https://platform.qianwenai.com/docs/developer-guides/getting-started/first-api-call) |
| Supported Operations | `/chat/completions`, `/embeddings`, `/rerank`, `/images/generations` |

These routes support pay-as-you-go API keys. Token Plan and Coding Plan endpoints are not yet mapped in LiteLLM (tracked on [issue #36150](https://github.com/BerriAI/litellm/issues/36150))

## QwenCloud (international)

Use the `qwencloud/` prefix outside mainland China

| Setting | Value |
|-------|-------|
| Prefix | `qwencloud/` |
| Default API base | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| Rerank endpoint | `https://dashscope-intl.aliyuncs.com/compatible-api/v1/reranks` |
| Image generation endpoint | `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| Video generation host | `https://dashscope-intl.aliyuncs.com` |
| API key env var | `QWENCLOUD_API_KEY` (falls back to `DASHSCOPE_API_KEY`) |
| Base URL overrides | `QWENCLOUD_API_BASE`, `QWENCLOUD_API_BASE_RERANK`, `QWENCLOUD_API_BASE_IMAGE`, `QWENCLOUD_API_BASE_VIDEO` |

## Qianwen AI Platform (mainland China)

Use the `qwen_ai_platform/` prefix in mainland China. It hits the same paths on the mainland host

| Setting | Value |
|-------|-------|
| Prefix | `qwen_ai_platform/` |
| Default API base | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| Rerank endpoint | `https://dashscope.aliyuncs.com/compatible-api/v1/reranks` |
| Image generation endpoint | `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| Video generation host | `https://dashscope.aliyuncs.com` |
| API key env var | `QWEN_AI_PLATFORM_API_KEY` (falls back to `DASHSCOPE_API_KEY`) |
| Base URL overrides | `QWEN_AI_PLATFORM_API_BASE`, `QWEN_AI_PLATFORM_API_BASE_RERANK`, `QWEN_AI_PLATFORM_API_BASE_IMAGE`, `QWEN_AI_PLATFORM_API_BASE_VIDEO` |

## API Key

```python showLineNumbers title="Environment Variables"
import os

os.environ["QWENCLOUD_API_KEY"] = "your-api-key"
```

For mainland China set `QWEN_AI_PLATFORM_API_KEY` instead. Both prefixes also read `DASHSCOPE_API_KEY` when their own key is not set, so existing DashScope credentials work without changes

## Models

Both prefixes accept any model from the DashScope catalog, for example `qwencloud/qwen-max`, `qwencloud/qwen-flash`, `qwencloud/qwen-image-3.0`, or `qwen_ai_platform/qwen-plus`. See the [DashScope page](./dashscope) for the model list

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="QwenCloud Chat Completion"
import os
from litellm import completion

os.environ["QWENCLOUD_API_KEY"] = "your-api-key"

response = completion(
    model="qwencloud/qwen-max",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="QwenCloud Streaming Chat Completion"
import os
from litellm import completion

os.environ["QWENCLOUD_API_KEY"] = "your-api-key"

response = completion(
    model="qwencloud/qwen-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Embedding

```python showLineNumbers title="QwenCloud Embedding"
import os
from litellm import embedding

os.environ["QWENCLOUD_API_KEY"] = "your-api-key"

response = embedding(
    model="qwencloud/text-embedding-v4",
    input=["hello from litellm"],
)

print(response.data[0]["embedding"][:5])
```

### Rerank

```python showLineNumbers title="QwenCloud Rerank"
import os
from litellm import rerank

os.environ["QWENCLOUD_API_KEY"] = "your-api-key"

response = rerank(
    model="qwencloud/gte-rerank-v2",
    query="What is the capital of France?",
    documents=["Paris is the capital of France", "Berlin is the capital of Germany"],
)

print(response.results)
```

### Image Generation

```python showLineNumbers title="QwenCloud Image Generation"
import os
from litellm import image_generation

os.environ["QWENCLOUD_API_KEY"] = "your-api-key"

response = image_generation(
    model="qwencloud/qwen-image-3.0",
    prompt="A cup of coffee on a wooden table",
)

print(response.data[0].url)
```

### Video Generation

Video generation runs as an async task on the DashScope task API. `video_generation` returns a job id right away; poll `video_status` until it reports `completed`, then download the mp4 with `video_content`.

```python showLineNumbers title="QwenCloud Video Generation"
import os
import time
from litellm import video_content, video_generation, video_status

os.environ["QWENCLOUD_API_KEY"] = "your-api-key"

video = video_generation(
    model="qwencloud/wan3.0-video",
    prompt="A paper boat drifting down a rain-soaked city gutter",
    seconds="5",
    size="1280x720",
)

while video.status not in ("completed", "failed"):
    time.sleep(20)
    video = video_status(video_id=video.id)

with open("video.mp4", "wb") as f:
    f.write(video_content(video_id=video.id))
```

The supported models are `wan3.0-video`, `wan3.0-video-prime`, `wan2.7-t2v`, `wan2.7-i2v`, `wan2.7-r2v`, `happyhorse-1.1-t2v`, `happyhorse-1.1-i2v`, `happyhorse-1.1-r2v`, `happyhorse-1.0-t2v`, `happyhorse-1.0-i2v` and `happyhorse-1.0-r2v`, under any of the `qwencloud/`, `qwen_ai_platform/` and `dashscope/` prefixes. Each prefix is priced from the rate card of the region its default host serves.

`seconds` sets the duration in whole seconds. `size` picks the aspect ratio closest to it out of 16:9, 9:16, 1:1, 4:3 and 3:4, and picks the billed resolution tier from its shorter side: under 600 px is 480P, under 900 px is 720P, and anything larger is 1080P. Wan 2.7 and HappyHorse 1.0 are only offered at 720P and 1080P, so a `size` in the 480P tier is rejected on them. To get another ratio a model supports, such as 21:9 on Wan 3.0, pass `ratio` directly. Without `size` the job runs and bills at 1080P, and without `seconds` it runs for 5 seconds. litellm only maps `size` on the video models it has a price for, so on any other DashScope video model a `size` answers 400 and that model's own size fields go inside `parameters` instead. A malformed `seconds` or `size`, or a resolution the model is not offered at, answers 400 unless `drop_params` is set globally, on the deployment, or on the request, which drops the value so DashScope's default applies. Image-to-video and reference-to-video models take their image through `input_reference`, as a URL or as a file (an open file, bytes or a `pathlib.Path`).

The DashScope fields `resolution`, `ratio`, `audio`, `seed`, `negative_prompt`, `prompt_extend`, `watermark` and `media` can go at the top level of the request. Any other DashScope request field, such as `shot_type`, goes inside a `parameters` object, which is sent to DashScope as written. From the OpenAI SDK, pass it as `extra_body={"parameters": {"shot_type": "multi"}}`. A `duration`, `seed`, `audio`, `prompt_extend`, `watermark`, `resolution` or `ratio` of the wrong type, or a `seed` outside 0 to 2147483647, answers 400 unless `drop_params` is set, since DashScope would otherwise fail the task after creating and billing it. Smart duration (`duration: -1`) and video input (a `reference_video` entry in `media`) are rejected, since litellm bills the video when the task is created and their billed length is not known then. Polling a task id DashScope no longer knows (ids expire after 24 hours and only exist in the region that created them) answers 400. DashScope has no list, delete or remix endpoint.

To serve these models on the proxy, set `mode: video_generation` on the deployment and call `/v1/videos`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: wan3-video
    litellm_params:
      model: qwencloud/wan3.0-video
      api_key: os.environ/QWENCLOUD_API_KEY
    model_info:
      mode: video_generation
```

```bash showLineNumbers title="Video generation via Proxy - cURL"
curl http://localhost:4000/v1/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "wan3-video",
    "prompt": "A paper boat drifting down a rain-soaked city gutter",
    "seconds": "5",
    "size": "1280x720"
  }'

curl http://localhost:4000/v1/videos/$VIDEO_ID \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl http://localhost:4000/v1/videos/$VIDEO_ID/content \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -o video.mp4
```

## Usage - LiteLLM Proxy

Add the models to your LiteLLM Proxy configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: qwen-max
    litellm_params:
      model: qwencloud/qwen-max
      api_key: os.environ/QWENCLOUD_API_KEY
  - model_name: qwen-plus-cn
    litellm_params:
      model: qwen_ai_platform/qwen-plus
      api_key: os.environ/QWEN_AI_PLATFORM_API_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export QWENCLOUD_API_KEY="your-api-key"
litellm --config config.yaml --port 4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="QwenCloud via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="your-litellm-key",
)

response = client.chat.completions.create(
    model="qwen-max",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="QwenCloud via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "qwen-max",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

## Backward Compatibility with DashScope

The `dashscope/` prefix, `DASHSCOPE_API_KEY`, `DASHSCOPE_API_BASE`, and every existing DashScope config keep working unchanged. `qwencloud/` and `qwen_ai_platform/` are aliases over the same implementation, so no migration is needed: switch prefixes whenever it suits you, or not at all
