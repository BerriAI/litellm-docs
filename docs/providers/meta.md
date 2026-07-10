import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Meta Model API
https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/

Meta's Model API is an OpenAI-compatible endpoint (`https://api.meta.ai/v1`) serving `muse-spark-1.1`, Meta Superintelligence Labs' multimodal reasoning model for agentic and coding workloads. It exposes both the Chat Completions and Responses endpoints, so you can use it with LiteLLM by setting `meta/` as the model prefix.

This is a distinct provider from `meta_llama` (the Llama API); use `meta/` for the Meta Model API.

## API Key
```python
import os
os.environ['META_API_KEY'] = ""       # your Meta Model API key from https://dev.meta.ai
# optional: override the base url
os.environ['META_API_BASE'] = ""      # defaults to https://api.meta.ai/v1
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['META_API_KEY'] = ""
response = completion(
    model="meta/muse-spark-1.1",
    messages=[{"role": "user", "content": "hello from litellm"}],
)
print(response)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['META_API_KEY'] = ""
response = completion(
    model="meta/muse-spark-1.1",
    messages=[{"role": "user", "content": "hello from litellm"}],
    stream=True,
)
for chunk in response:
    print(chunk)
```

## Supported Models

| Model Name | Function Call |
|------------|---------------|
| muse-spark-1.1 | `completion(model="meta/muse-spark-1.1", messages)` |

`muse-spark-1.1` has a 1M-token context window and supports multimodal input (image, video, PDF), tool calling and parallel tool calling, structured output, prompt caching, and web search grounding via the Responses API.

## Reasoning

`muse-spark-1.1` is a reasoning model. Control how much it thinks with `reasoning_effort`, which accepts `minimal`, `moderate`, `high`, and `xhigh`. The thinking tokens are returned as `usage.completion_tokens_details.reasoning_tokens` and are billed at the output rate, so matching effort to the task is the main lever on cost.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ['META_API_KEY'] = ""
resp = completion(
    model="meta/muse-spark-1.1",
    messages=[{"role": "user", "content": "Diagnose this failing test and propose a fix."}],
    reasoning_effort="high",
)
print(resp.choices[0].message.content)
print(resp.usage.completion_tokens_details.reasoning_tokens)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
  - model_name: muse-spark-1.1
    litellm_params:
        model: meta/muse-spark-1.1
        api_key: os.environ/META_API_KEY
```

2. Run proxy

```bash
litellm --config config.yaml
```

3. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
    "model": "muse-spark-1.1",
    "messages": [{"role": "user", "content": "Say hello in exactly 3 words."}],
    "reasoning_effort": "minimal"
}'
```

</TabItem>
</Tabs>
