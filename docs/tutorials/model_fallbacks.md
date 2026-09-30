---
description: "Implement model fallbacks (provider failover) across OpenAI, Anthropic, and Azure with LiteLLM so a failing provider fails over to a backup."
keywords: [fallbacks, failover, provider failover, model failover, OpenAI, Anthropic, Azure, reliability]
---

# Model Fallbacks (Provider Failover) w/ LiteLLM

Here's how you can implement model fallbacks (provider failover) across 3 LLM providers (OpenAI, Anthropic, Azure) using LiteLLM. 

## 1. Install LiteLLM
```bash
uv add litellm
```

## 2. Basic Fallbacks Code 
```python 
import os
import traceback
import litellm
from litellm import embedding, completion

# set ENV variables
os.environ["OPENAI_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["AZURE_API_KEY"] = ""
os.environ["AZURE_API_BASE"] = ""
os.environ["AZURE_API_VERSION"] = ""

model_fallback_list = ["{{anthropic}}", "{{openai_small}}", "chatgpt-test"]

user_message = "Hello, how are you?"
messages = [{ "content": user_message,"role": "user"}]

for model in model_fallback_list:
  try:
      response = completion(model=model, messages=messages)
  except Exception as e:
      print(f"error occurred: {traceback.format_exc()}")
```

## 3. Context Window Exceptions 
LiteLLM provides a sub-class of the InvalidRequestError class for Context Window Exceeded errors ([docs](https://docs.litellm.ai/docs/exception_mapping)).

Implement model fallbacks based on context window exceptions. 

Use `litellm.get_model_info(model)["max_input_tokens"]` to identify the context window limit that's been exceeded. `get_max_tokens()` returns the model's max output tokens, not its context window, so don't compare it against context window sizes. 

The model ids in the fallback list below are illustrative and kept for their context window sizes.

```python keep-model-ids
import os
import litellm
from litellm import completion, ContextWindowExceededError

# set ENV variables
os.environ["OPENAI_API_KEY"] = ""
os.environ["COHERE_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["AZURE_API_KEY"] = ""
os.environ["AZURE_API_BASE"] = ""
os.environ["AZURE_API_VERSION"] = ""

context_window_fallback_list = [{"model":"gpt-3.5-turbo-16k", "max_input_tokens": 16385}, {"model":"gpt-4-32k", "max_input_tokens": 32768}, {"model": "claude-instant-1", "max_input_tokens":100000}]

user_message = "Hello, how are you?"
messages = [{ "content": user_message,"role": "user"}]

initial_model = "command-nightly"

def completion_with_context_window_fallbacks(messages):
    try:
        return completion(model=initial_model, messages=messages)
    except ContextWindowExceededError:
        exceeded_limit = litellm.get_model_info(initial_model)["max_input_tokens"]
        for fallback in context_window_fallback_list:
            if exceeded_limit < fallback["max_input_tokens"]:
                try:
                    return completion(model=fallback["model"], messages=messages)
                except ContextWindowExceededError:
                    exceeded_limit = fallback["max_input_tokens"]
        raise

response = completion_with_context_window_fallbacks(messages)
print(response)
```
