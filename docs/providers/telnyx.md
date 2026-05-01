import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Telnyx

Telnyx provides an OpenAI-compatible Inference API for hosted LLMs and audio transcription.

:::tip

**We support Telnyx models via the `telnyx/<model>` prefix in LiteLLM**

:::

## Overview

| Property | Details |
|-------|--------|
| Provider ID | `telnyx` |
| API Base | `https://api.telnyx.com/v2/ai` |
| API Key Env | `TELNYX_API_KEY` |
| OpenAI Compatible | Yes |
| LiteLLM Supported Endpoints | Chat Completions, Audio Transcriptions |
| Website | [telnyx.com](https://telnyx.com) |
| API Docs | [developers.telnyx.com/docs/inference](https://developers.telnyx.com/docs/inference/getting-started) |
| Sign Up | [telnyx.com/sign-up](https://telnyx.com/sign-up) |

## API Key

```python
import os
os.environ["TELNYX_API_KEY"] = "your-api-key"
```

## Sample Usage

```python
import litellm
import os

os.environ["TELNYX_API_KEY"] = "your-api-key"

response = litellm.completion(
    model="telnyx/moonshotai/Kimi-K2.6",
    messages=[{"role": "user", "content": "Hello!"}],
)

print(response.choices[0].message.content)
```

## Sample Usage - Streaming

```python
import litellm
import os

os.environ["TELNYX_API_KEY"] = "your-api-key"

response = litellm.completion(
    model="telnyx/moonshotai/Kimi-K2.6",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Audio Transcription

```python
import litellm
import os

os.environ["TELNYX_API_KEY"] = "your-api-key"

audio_file = open("sample.wav", "rb")
transcript = litellm.transcription(
    model="telnyx/distil-whisper/distil-large-v2",
    file=audio_file,
)
audio_file.close()

print(transcript.text)
```

## Usage with LiteLLM Proxy Server

Here's how to call a Telnyx model with the LiteLLM Proxy Server.

1. Modify the config.yaml

```yaml
model_list:
  - model_name: kimi-k2.6
    litellm_params:
      model: telnyx/moonshotai/Kimi-K2.6
      api_key: os.environ/TELNYX_API_KEY
```

2. Start the proxy

```bash
litellm --config /path/to/config.yaml
```

3. Send request to LiteLLM Proxy Server

<Tabs>

<TabItem value="openai" label="OpenAI Python v1.0.0+">

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-1234",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="kimi-k2.6",
    messages=[
        {"role": "user", "content": "what llm are you"}
    ],
)

print(response)
```

</TabItem>

<TabItem value="curl" label="curl">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
  --header 'Authorization: Bearer sk-1234' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "kimi-k2.6",
    "messages": [
      {
        "role": "user",
        "content": "what llm are you"
      }
    ]
  }'
```

</TabItem>

</Tabs>

## Using Telnyx Directly with the OpenAI SDK

If you want to call Telnyx directly, outside LiteLLM:

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ["TELNYX_API_KEY"],
    base_url="https://api.telnyx.com/v2/ai/openai",
)

response = client.chat.completions.create(
    model="moonshotai/Kimi-K2.6",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

## Supported Models

LiteLLM supports Telnyx models using the `telnyx/<model>` pattern.

Examples:

| Model Name | Usage |
|------------|-------|
| Kimi K2.6 | `completion(model="telnyx/moonshotai/Kimi-K2.6", messages=...)` |
| distil-whisper/distil-large-v2 | `transcription(model="telnyx/distil-whisper/distil-large-v2", file=...)` |

See [Telnyx Available Models](https://developers.telnyx.com/docs/inference/models) for the latest catalog.

## Getting an API Key

1. Sign up at [telnyx.com/sign-up](https://telnyx.com/sign-up)
2. Navigate to the [Telnyx Portal](https://portal.telnyx.com/)
3. Create an API key under **Auth > API Keys**
