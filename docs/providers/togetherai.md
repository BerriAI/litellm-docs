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

completion(model="together_ai/togethercomputer/Llama-2-7B-32K-Instruct", messages=messages)
```

## Together AI Models
liteLLM supports `non-streaming` and `streaming` requests to all models on https://api.together.xyz/

Example TogetherAI Usage - Note: liteLLM supports all models deployed on TogetherAI


### Llama LLMs - Chat
| Model Name                        | Function Call                                                           | Required OS Variables              |
|-----------------------------------|-------------------------------------------------------------------------|------------------------------------|
| togethercomputer/llama-2-70b-chat | `completion('together_ai/togethercomputer/llama-2-70b-chat', messages)` | `os.environ['TOGETHERAI_API_KEY']` |

### Llama LLMs - Language / Instruct
| Model Name                               | Function Call                                                                  | Required OS Variables              |
|------------------------------------------|--------------------------------------------------------------------------------|------------------------------------|
| togethercomputer/llama-2-70b             | `completion('together_ai/togethercomputer/llama-2-70b', messages)`             | `os.environ['TOGETHERAI_API_KEY']` |
| togethercomputer/LLaMA-2-7B-32K          | `completion('together_ai/togethercomputer/LLaMA-2-7B-32K', messages)`          | `os.environ['TOGETHERAI_API_KEY']` |
| togethercomputer/Llama-2-7B-32K-Instruct | `completion('together_ai/togethercomputer/Llama-2-7B-32K-Instruct', messages)` | `os.environ['TOGETHERAI_API_KEY']` |
| togethercomputer/llama-2-7b              | `completion('together_ai/togethercomputer/llama-2-7b', messages)`              | `os.environ['TOGETHERAI_API_KEY']` |

### Falcon LLMs
| Model Name                           | Function Call                                                              | Required OS Variables              |
|--------------------------------------|----------------------------------------------------------------------------|------------------------------------|
| togethercomputer/falcon-40b-instruct | `completion('together_ai/togethercomputer/falcon-40b-instruct', messages)` | `os.environ['TOGETHERAI_API_KEY']` |
| togethercomputer/falcon-7b-instruct  | `completion('together_ai/togethercomputer/falcon-7b-instruct', messages)`  | `os.environ['TOGETHERAI_API_KEY']` |

### Alpaca LLMs
| Model Name                 | Function Call                                                    | Required OS Variables              |
|----------------------------|------------------------------------------------------------------|------------------------------------|
| togethercomputer/alpaca-7b | `completion('together_ai/togethercomputer/alpaca-7b', messages)` | `os.environ['TOGETHERAI_API_KEY']` |

### Other Chat LLMs
| Model Name                   | Function Call                                                      | Required OS Variables              |
|------------------------------|--------------------------------------------------------------------|------------------------------------|
| HuggingFaceH4/starchat-alpha | `completion('together_ai/HuggingFaceH4/starchat-alpha', messages)` | `os.environ['TOGETHERAI_API_KEY']` |

### Code LLMs
| Model Name                              | Function Call                                                                 | Required OS Variables              |
|-----------------------------------------|-------------------------------------------------------------------------------|------------------------------------|
| togethercomputer/CodeLlama-34b          | `completion('together_ai/togethercomputer/CodeLlama-34b', messages)`          | `os.environ['TOGETHERAI_API_KEY']` |
| togethercomputer/CodeLlama-34b-Instruct | `completion('together_ai/togethercomputer/CodeLlama-34b-Instruct', messages)` | `os.environ['TOGETHERAI_API_KEY']` |
| togethercomputer/CodeLlama-34b-Python   | `completion('together_ai/togethercomputer/CodeLlama-34b-Python', messages)`   | `os.environ['TOGETHERAI_API_KEY']` |
| defog/sqlcoder                          | `completion('together_ai/defog/sqlcoder', messages)`                          | `os.environ['TOGETHERAI_API_KEY']` |
| NumbersStation/nsql-llama-2-7B          | `completion('together_ai/NumbersStation/nsql-llama-2-7B', messages)`          | `os.environ['TOGETHERAI_API_KEY']` |
| WizardLM/WizardCoder-15B-V1.0           | `completion('together_ai/WizardLM/WizardCoder-15B-V1.0', messages)`           | `os.environ['TOGETHERAI_API_KEY']` |
| WizardLM/WizardCoder-Python-34B-V1.0    | `completion('together_ai/WizardLM/WizardCoder-Python-34B-V1.0', messages)`    | `os.environ['TOGETHERAI_API_KEY']` |

### Language LLMs
| Model Name                          | Function Call                                                             | Required OS Variables              |
|-------------------------------------|---------------------------------------------------------------------------|------------------------------------|
| NousResearch/Nous-Hermes-Llama2-13b | `completion('together_ai/NousResearch/Nous-Hermes-Llama2-13b', messages)` | `os.environ['TOGETHERAI_API_KEY']` |
| Austism/chronos-hermes-13b          | `completion('together_ai/Austism/chronos-hermes-13b', messages)`          | `os.environ['TOGETHERAI_API_KEY']` |
| upstage/SOLAR-0-70b-16bit           | `completion('together_ai/upstage/SOLAR-0-70b-16bit', messages)`           | `os.environ['TOGETHERAI_API_KEY']` |
| WizardLM/WizardLM-70B-V1.0          | `completion('together_ai/WizardLM/WizardLM-70B-V1.0', messages)`          | `os.environ['TOGETHERAI_API_KEY']` |


## Prompt Templates

Using a chat model on Together AI with it's own prompt format?

### Using Llama2 Instruct models
If you're using Together AI's Llama2 variants( `model=togethercomputer/llama-2..-instruct`), LiteLLM can automatically translate between the OpenAI prompt format and the TogetherAI Llama2 one (`[INST]..[/INST]`). 

```python
from litellm import completion 

# set env variable 
os.environ["TOGETHERAI_API_KEY"] = ""

messages = [{"role": "user", "content": "Write me a poem about the blue sky"}]

completion(model="together_ai/togethercomputer/Llama-2-7B-32K-Instruct", messages=messages)
```

### Using another model

You can create a custom prompt template on LiteLLM (and we [welcome PRs](https://github.com/BerriAI/litellm) to add them to the main repo 🤗)

Let's make one for `OpenAssistant/llama2-70b-oasst-sft-v10`!

The accepted template format is: [Reference](https://huggingface.co/OpenAssistant/llama2-70b-oasst-sft-v10-)
```
"""
<|im_start|>system
{system_message}<|im_end|>
<|im_start|>user
{prompt}<|im_end|>
<|im_start|>assistant
"""
```

Let's register our custom prompt template: [Implementation Code](https://github.com/BerriAI/litellm/blob/64f3d3c56ef02ac5544983efc78293de31c1c201/litellm/llms/prompt_templates/factory.py#L77)
```python
import litellm 

litellm.register_prompt_template(
	    model="OpenAssistant/llama2-70b-oasst-sft-v10",
	    roles={
            "system": {
                "pre_message": "[<|im_start|>system",
                "post_message": "\n"
            },
            "user": {
                "pre_message": "<|im_start|>user",
                "post_message": "\n"
            }, 
            "assistant": {
                "pre_message": "<|im_start|>assistant",
                "post_message": "\n"
            }
        }
    )
```

Let's use it! 

```python
from litellm import completion 

# set env variable 
os.environ["TOGETHERAI_API_KEY"] = ""

messages=[{"role":"user", "content": "Write me a poem about the blue sky"}]

completion(model="together_ai/OpenAssistant/llama2-70b-oasst-sft-v10", messages=messages)
```

**Complete Code**

```python
import litellm 
from litellm import completion

# set env variable 
os.environ["TOGETHERAI_API_KEY"] = ""

litellm.register_prompt_template(
	    model="OpenAssistant/llama2-70b-oasst-sft-v10",
	    roles={
            "system": {
                "pre_message": "[<|im_start|>system",
                "post_message": "\n"
            },
            "user": {
                "pre_message": "<|im_start|>user",
                "post_message": "\n"
            }, 
            "assistant": {
                "pre_message": "<|im_start|>assistant",
                "post_message": "\n"
            }
        }
    )

messages=[{"role":"user", "content": "Write me a poem about the blue sky"}]

response = completion(model="together_ai/OpenAssistant/llama2-70b-oasst-sft-v10", messages=messages)

print(response)
```

**Output**
```json
{
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "content": ".\n\nThe sky is a canvas of blue,\nWith clouds that drift and move,",
        "role": "assistant",
        "logprobs": null
      }
    }
  ],
  "created": 1693941410.482018,
  "model": "OpenAssistant/llama2-70b-oasst-sft-v10",
  "usage": {
    "prompt_tokens": 7,
    "completion_tokens": 16,
    "total_tokens": 23
  },
  "litellm_call_id": "f21315db-afd6-4c1e-b43a-0b5682de4b06"
}
```


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