# Reliability - Retries, Fallbacks

LiteLLM helps prevent failed requests in 2 ways: 
- Retries
- Fallbacks: Context Window + General

## Helper utils 
LiteLLM supports the following functions for reliability:
* `litellm.longer_context_model_fallback_dict`: Dictionary which has a mapping for those models which have larger equivalents  
* `num_retries`: use tenacity retries
* `completion()` with fallbacks: switch between models/keys/api bases in case of errors. 

## Retry failed requests

Call it in completion like this `completion(..num_retries=2)`.


Here's a quick look at how you can use it: 

```python 
from litellm import completion

user_message = "Hello, whats the weather in San Francisco??"
messages = [{"content": user_message, "role": "user"}]

# normal call 
response = completion(
            model="{{openai_small}}",
            messages=messages,
            num_retries=2
        )
```

## Fallbacks (SDK)

:::info

[See how to do on PROXY](../proxy/reliability.md)

:::

### Context Window Fallbacks (SDK)

The ids below are illustrative and kept for their context window sizes: a 4k model falling back to its 16k variant.

```python keep-model-ids
from litellm import completion

fallback_dict = {"gpt-3.5-turbo": "gpt-3.5-turbo-16k"}
messages = [{"content": "how does a court case get to the Supreme Court?" * 500, "role": "user"}]

completion(model="gpt-3.5-turbo", messages=messages, context_window_fallback_dict=fallback_dict)
```

### Fallbacks - Switch Models/API Keys/API Bases (SDK)

LLM APIs can be unstable, completion() with fallbacks ensures you'll always get a response from your calls

#### Usage 
To use fallback models with `completion()`, specify a list of models in the `fallbacks` parameter. 

The `fallbacks` list holds the backup models. LiteLLM tries the primary model passed as `model` first and prepends it to the list itself, so you do not need to repeat it in `fallbacks`.

#### switch models 
```python
response = completion(model="bad-model", messages=messages, 
    fallbacks=["{{openai_small}}", "command-nightly"])
```

#### switch api keys/bases (E.g. azure deployment)
Switch between different keys for the same azure deployment, or use another deployment as well. 

```python
api_key="bad-key"
response = completion(model="azure/{{openai_large}}", messages=messages, api_key=api_key,
    fallbacks=[{"api_key": "good-key-1"}, {"api_key": "good-key-2", "api_base": "good-api-base-2"}])
```

[Check out this section for implementation details](/docs/completion/reliable_completions#fallbacks)

## Implementation Details (SDK)

### Fallbacks
#### Output from calls
```
Completion with 'bad-model': got exception Unable to map your input to a model. Check your input - {'model': 'bad-model'



completion call {{openai_small}}
{
  "id": "chatcmpl-7qTmVRuO3m3gIBg4aTmAumV1TmQhB",
  "object": "chat.completion",
  "created": 1692741891,
  "model": "{{openai_small}}",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I apologize, but as an AI, I do not have the capability to provide real-time weather updates. However, you can easily check the current weather in San Francisco by using a search engine or checking a weather website or app."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 16,
    "completion_tokens": 46,
    "total_tokens": 62
  }
}

```

#### How does fallbacks work

When you pass `fallbacks` to `completion`, LiteLLM builds the attempt list `[model] + fallbacks` and calls each entry once, in order. The first response that comes back is returned; a failing entry is logged and the next one is tried. There is no time budget, no repeated loop over the list and no cooldown: once every entry has failed, `completion` raises an exception carrying the last error, suffixed with `All fallback attempts failed`.

A fallback entry can be a model name string or a dict of completion kwargs. A dict entry is merged into the call (for example a different `api_key` or `api_base`) and uses the primary `model` unless the dict sets its own `model` key.

The successful response carries the `x-litellm-attempted-fallbacks` header with the number of fallbacks that were attempted before it.

If you need cooldowns for failing deployments or retries with backoff, use the [Router](../routing.md), which tracks deployment health and cooldown periods; see the [proxy reliability docs](../proxy/reliability.md).
