# Completion Token Usage & Cost
By default LiteLLM returns token usage in all completion requests ([See here](https://litellm.readthedocs.io/en/latest/output/))

## Response cost

LiteLLM returns its computed cost as a USD float in `usage.cost` on every response, for both the SDK and proxy. This covers chat completions, the Responses API, and Anthropic Messages, with and without streaming. No flag or opt-in header is required. The value is the same bill as the proxy's `x-litellm-response-cost` header, when present, and the cost recorded in the spend log.

### Chat completions

```python
import litellm

response = litellm.completion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.usage.cost)
```

For streaming chat completions, request usage and read the cost from the final usage chunk.

```python
import litellm

stream = litellm.completion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if getattr(chunk, "usage", None) is not None:
        print(chunk.usage.cost)
```

### Responses API and Anthropic Messages

Responses API objects expose `response.usage.cost`. Anthropic Messages returns a dictionary, so use `response["usage"]["cost"]`.

```python
import asyncio
import litellm

async def main():
    response = await litellm.aresponses(
        model="{{openai_small}}",
        input="Hello",
    )
    print(response.usage.cost)

    message = await litellm.anthropic.messages.acreate(
        model="anthropic/claude-sonnet-5-5",
        max_tokens=64,
        messages=[{"role": "user", "content": "Hello"}],
    )
    print(message["usage"]["cost"])

asyncio.run(main())
```

With streaming, the Responses API carries the cost in `response.completed.response.usage.cost`. Anthropic Messages carries it in the final `message_delta` frame's `usage.cost`, for native and adapter-backed requests.

SDK response objects still expose `_hidden_params["response_cost"]` for compatibility, but prefer the public `usage.cost` field.

### Proxy

The JSON response body includes the same field. For a proxy with a configured `claude` model alias:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude", "messages": [{"role": "user", "content": "Reply only OK"}], "max_tokens": 64}'
```

Example response body excerpt:

```json
{
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 4,
    "total_tokens": 18,
    "cost": 0.000068
  }
}
```

## Token and cost helpers

LiteLLM also exposes some helper functions:

- `encode`: This encodes the text passed in, using the model-specific tokenizer. [**Jump to code**](#1-encode)

- `decode`: This decodes the tokens passed in, using the model-specific tokenizer. [**Jump to code**](#2-decode)

- `token_counter`: This returns the number of tokens for a given input - it uses the tokenizer based on the model, and defaults to tiktoken if no model-specific tokenizer is available. [**Jump to code**](#3-token_counter)

- `create_pretrained_tokenizer` and `create_tokenizer`: LiteLLM provides default tokenizer support for OpenAI, Cohere, Anthropic, Llama2, and Llama3 models. If you are using a different model, you can create a custom tokenizer and pass it as `custom_tokenizer` to the `encode`, `decode`, and `token_counter` methods. [**Jump to code**](#4-create_pretrained_tokenizer-and-create_tokenizer)

- `cost_per_token`: This returns the cost (in USD) for prompt (input) and completion (output) tokens. Uses the live list from `api.litellm.ai`. [**Jump to code**](#5-cost_per_token)

- `completion_cost`: This returns the overall cost (in USD) for a given LLM API Call. It combines `token_counter` and `cost_per_token` to return the cost for that query (counting both cost of input and output). [**Jump to code**](#6-completion_cost)

- `get_max_tokens`: This returns the maximum number of tokens allowed for the given model. [**Jump to code**](#7-get_max_tokens)

- `model_cost`: This returns a dictionary for all models, with their max_tokens, input_cost_per_token and output_cost_per_token. It uses the `api.litellm.ai` call shown below. [**Jump to code**](#8-model_cost)

- `register_model`: This registers new / overrides existing models (and their pricing details) in the model cost dictionary. [**Jump to code**](#9-register_model)

- `api.litellm.ai`: Live token + price count across [all supported models](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). **Jump to code**

[This is a community maintained list](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). Contributions are welcome!

## Example Usage 

### 1. `encode`
Encoding has model-specific tokenizers for anthropic, cohere, llama2 and openai. If an unsupported model is passed in, it'll default to using tiktoken (openai's tokenizer).

```python
from litellm import encode, decode

sample_text = "Hellö World, this is my input string!"
# openai encoding + decoding
openai_tokens = encode(model="{{openai_small}}", text=sample_text)
print(openai_tokens)
```

### 2. `decode`

Decoding is supported for anthropic, cohere, llama2 and openai.

```python
from litellm import encode, decode

sample_text = "Hellö World, this is my input string!"
# openai encoding + decoding
openai_tokens = encode(model="{{openai_small}}", text=sample_text)
openai_text = decode(model="{{openai_small}}", tokens=openai_tokens)
print(openai_text)
```

### 3. `token_counter`

```python
from litellm import token_counter

messages = [{"user": "role", "content": "Hey, how's it going"}]
print(token_counter(model="{{openai_small}}", messages=messages))
```

### 4. `create_pretrained_tokenizer` and `create_tokenizer`

```python
from litellm import create_pretrained_tokenizer, create_tokenizer

# get tokenizer from huggingface repo
custom_tokenizer_1 = create_pretrained_tokenizer("Xenova/llama-3-tokenizer")

# use tokenizer from json file
with open("tokenizer.json") as f:
    json_data = json.load(f)

json_str = json.dumps(json_data)

custom_tokenizer_2 = create_tokenizer(json_str)
```

### 5. `cost_per_token`

```python
from litellm import cost_per_token

prompt_tokens =  5
completion_tokens = 10
prompt_tokens_cost_usd_dollar, completion_tokens_cost_usd_dollar = cost_per_token(model="{{openai_small}}", prompt_tokens=prompt_tokens, completion_tokens=completion_tokens)

print(prompt_tokens_cost_usd_dollar, completion_tokens_cost_usd_dollar)
```

### 6. `completion_cost`

* Input: Accepts a `litellm.completion()` response **OR** prompt + completion strings
* Output: Returns a `float` of cost for the `completion` call 

**litellm.completion()**
```python
from litellm import completion, completion_cost

response = completion(
            model="bedrock/us.anthropic.{{anthropic}}",
            messages=messages,
            request_timeout=200,
        )
# pass your response from completion to completion_cost
cost = completion_cost(completion_response=response)
formatted_string = f"${float(cost):.10f}"
print(formatted_string)
```

**prompt + completion string**
```python
from litellm import completion_cost
cost = completion_cost(model="bedrock/us.anthropic.{{anthropic}}", prompt="Hey!", completion="How's it going?")
formatted_string = f"${float(cost):.10f}"
print(formatted_string)
```
### 7. `get_max_tokens`

Input: Accepts a model name - e.g., gpt-5.6-luna (to get a complete list, call litellm.model_list).
Output: Returns the maximum number of tokens allowed for the given model

```python 
from litellm import get_max_tokens 

model = "{{openai_small}}"

print(get_max_tokens(model)) # Output: 128000
```

### 8. `model_cost`

* Output: Returns a dict object containing the max_tokens, input_cost_per_token, output_cost_per_token for all models on [community-maintained list](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json)

```python 
from litellm import model_cost 

print(model_cost) # {'{{openai_small}}': {'max_tokens': 128000, 'input_cost_per_token': 2e-07, 'output_cost_per_token': 1.2e-06}, ...}
```

### 9. `register_model`

* Input: Provide EITHER a model cost dictionary or a url to a hosted json blob
* Output: Returns updated model_cost dictionary + updates litellm.model_cost with model details.  

**Dictionary**
```python
import litellm

litellm.register_model({
        "{{openai_large}}": {
        "max_tokens": 128000, 
        "input_cost_per_token": 0.000002, 
        "output_cost_per_token": 0.000012, 
        "litellm_provider": "openai", 
        "mode": "chat"
    },
})
```

**URL for json blob**
```python
import litellm

litellm.register_model(model_cost=
"https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json")
```

**Don't pull hosted model_cost_map**  
If you have firewalls, and want to just use the local copy of the model cost map, you can do so like this:
```bash
export LITELLM_LOCAL_MODEL_COST_MAP="True"
```

Note: this means you will need to upgrade to get updated pricing, and newer models. 
