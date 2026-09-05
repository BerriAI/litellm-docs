import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Together AI 
LiteLLM supports all models on Together AI. 

## API Keys

```python 
import os 
os.environ["TOGETHERAI_API_KEY"] = "your-api-key"
```
## Sample Usage

```python
from litellm import completion 

os.environ["TOGETHERAI_API_KEY"] = "your-api-key"

messages = [{"role": "user", "content": "Write me a poem about the blue sky"}]

completion(model="together_ai/zai-org/GLM-5.3-Flash", messages=messages)
```

## Together AI Models

Use `together_ai/<model-id>` for streaming and non-streaming chat requests. These are representative models; check the [Together AI catalog](https://docs.together.ai/docs/serverless-models) for availability and deployment requirements.

| Model | LiteLLM model ID |
|-------|------------------|
| GLM-5.3-Flash | `together_ai/zai-org/GLM-5.3-Flash` |
| Kimi K3 | `together_ai/moonshotai/Kimi-K3` |
| GPT OSS 120B | `together_ai/openai/gpt-oss-120b` |


## Prompt Templates

Chat models accept OpenAI-style messages. For a deployment that requires a custom text prompt, see [prompt formatting](../completion/prompt_formatting.md#format-prompt-yourself).


## Reasoning controls via `chat_template_kwargs`

Together steers its reasoning models through a request-level `chat_template_kwargs` object ([Together docs](https://docs.together.ai/docs/deepseek-v3-1#hybrid-reasoning-model)). LiteLLM passes it through untouched on the SDK and on every proxy endpoint (`/v1/chat/completions`, `/v1/messages`, `/v1/responses`), streaming included, so any key Together documents for your model works as is. Together validates the keys server-side and silently ignores ones a model does not support.

### Toggling thinking on hybrid models

Hybrid reasoning models (e.g. `Qwen/Qwen3.5-9B`) think by default; `{"thinking": false}` turns it off.

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK Usage">

```python
from litellm import completion
import os

os.environ["TOGETHERAI_API_KEY"] = "your-api-key"

response = completion(
    model="together_ai/Qwen/Qwen3.5-9B",
    messages=[{"role": "user", "content": "What is 17*23? Answer with just the number."}],
    chat_template_kwargs={"thinking": False},
)
print(response.choices[0].message.content)  # direct answer, no reasoning_content
```
</TabItem>

<TabItem value="proxy" label="LiteLLM Proxy Usage">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3.5-9B",
    "messages": [{"role": "user", "content": "What is 17*23? Answer with just the number."}],
    "chat_template_kwargs": {"thinking": false}
  }'
```

</TabItem>
</Tabs>

### Preserved thinking across turns

Models like `zai-org/GLM-5.2` clear prior-turn reasoning from the prompt by default. Sending `{"clear_thinking": false}` keeps it, provided you replay each assistant turn's `reasoning_content` unmodified alongside its `content`. LiteLLM forwards the replayed `reasoning_content` to Together and strips its own bookkeeping fields (`thinking_blocks`, `provider_specific_fields`) from the outbound request, so replaying a LiteLLM response object verbatim is safe.

```python
from litellm import completion
import os

os.environ["TOGETHERAI_API_KEY"] = "your-api-key"

first = completion(
    model="together_ai/zai-org/GLM-5.2",
    messages=[{"role": "user", "content": "Pick a secret two-digit number. Reply with only the sum of its digits."}],
)

followup = completion(
    model="together_ai/zai-org/GLM-5.2",
    messages=[
        {"role": "user", "content": "Pick a secret two-digit number. Reply with only the sum of its digits."},
        {
            "role": "assistant",
            "content": first.choices[0].message.content,
            "reasoning_content": first.choices[0].message.reasoning_content,
        },
        {"role": "user", "content": "What was the secret number? Reply with only the number."},
    ],
    chat_template_kwargs={"clear_thinking": False},
)
print(followup.choices[0].message.content)  # recalls the number from the replayed reasoning
```

Anthropic-SDK clients pointed at the proxy's `/v1/messages` endpoint get the same behavior by replaying the assistant `thinking` blocks and passing `chat_template_kwargs: {"clear_thinking": false}` at the top level of the request.

## Rerank 

### Usage



<Tabs>
<TabItem value="sdk" label="LiteLLM SDK Usage">

```python
from litellm import rerank
import os

os.environ["TOGETHERAI_API_KEY"] = "sk-.."

query = "What is the capital of the United States?"
documents = [
    "Carson City is the capital city of the American state of Nevada.",
    "The Commonwealth of the Northern Mariana Islands is a group of islands in the Pacific Ocean. Its capital is Saipan.",
    "Washington, D.C. is the capital of the United States.",
    "Capital punishment has existed in the United States since before it was a country.",
]

response = rerank(
    model="together_ai/rerank-english-v3.0",
    query=query,
    documents=documents,
    top_n=3,
)
print(response)
```
</TabItem>

<TabItem value="proxy" label="LiteLLM Proxy Usage">

LiteLLM provides an cohere api compatible `/rerank` endpoint for Rerank calls.

**Setup**

Add this to your litellm proxy config.yaml

```yaml
model_list:
  - model_name: Salesforce/Llama-Rank-V1
    litellm_params:
      model: together_ai/Salesforce/Llama-Rank-V1
      api_key: os.environ/TOGETHERAI_API_KEY
```

Start litellm

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

Test request

```bash
curl http://0.0.0.0:4000/rerank \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Salesforce/Llama-Rank-V1",
    "query": "What is the capital of the United States?",
    "documents": [
        "Carson City is the capital city of the American state of Nevada.",
        "The Commonwealth of the Northern Mariana Islands is a group of islands in the Pacific Ocean. Its capital is Saipan.",
        "Washington, D.C. is the capital of the United States.",
        "Capital punishment has existed in the United States since before it was a country."
    ],
    "top_n": 3
  }'
```

</TabItem>
</Tabs>
