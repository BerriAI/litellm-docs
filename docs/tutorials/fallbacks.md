---
description: "Use completion() with model fallbacks (failover) so a failing provider automatically fails over to a backup model for reliable responses."
keywords: [fallbacks, failover, provider failover, model failover, reliability, backup model, completion]
---

# Using completion() with Fallbacks (Failover) for Reliability

This tutorial demonstrates how to employ the `completion()` function with model fallbacks (also called failover) to improve reliability. LLM APIs can be unstable; `completion()` with fallbacks tries backup models in order when the primary model fails, and only raises once every model has been tried

## Set Up Fallbacks for a Virtual Key

<iframe width="840" height="500" src="https://www.loom.com/embed/35539129dd104313aff40eb1cd255778" frameBorder="0" allowFullScreen></iframe>

## Usage 
To use fallback models with `completion()`, specify a list of models in the `fallbacks` parameter. 

The `fallbacks` list holds the backup models to try, in order, if the primary model passed as `model` fails to provide a response. The primary model is tried first automatically, so it does not need to be repeated in the list.

```python
response = completion(model="bad-model", fallbacks=["{{openai_small}}", "command-nightly"], messages=messages)
```

An entry in `fallbacks` can also be a dict that overrides litellm params for that attempt, for example `{"model": "{{openai_small}}", "api_key": "sk-..."}`.

## How does `completion_with_fallbacks()` work

When `fallbacks` is set (or `litellm.model_fallbacks` is configured), `completion()` hands the call to `completion_with_fallbacks()`, which runs `async_completion_with_fallbacks()`. It makes a single ordered pass over `[model] + fallbacks`, calling each model once. The first non-`None` response is returned, with an `x-litellm-attempted-fallbacks` header set to the number of fallbacks tried before the successful model (0 when the primary model succeeded). If every attempt fails, an exception is raised containing the most recent error and the message `All fallback attempts failed`. There is no time window, no retry loop and no per-model cooldown; each model is attempted exactly once.

### Output from calls
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

### Core of the implementation
```python
fallbacks = [original_model] + nested_kwargs.pop("fallbacks", [])

for attempted_fallbacks, fallback in enumerate(fallbacks):
    try:
        completion_kwargs = safe_deep_copy(base_kwargs)
        if isinstance(fallback, dict):
            fallback_config = safe_deep_copy(dict(fallback))
            model = fallback_config.pop("model", original_model)
            completion_kwargs.update(fallback_config)
        else:
            model = fallback

        response = await litellm.acompletion(**completion_kwargs, model=model, ...)
        if response is not None:
            return add_fallback_headers_to_response(
                response=response, attempted_fallbacks=attempted_fallbacks
            )
    except Exception as e:
        most_recent_exception_str = str(e)
        continue

raise Exception(f"{most_recent_exception_str}. All fallback attempts failed. ...")
```

See `litellm/litellm_core_utils/fallback_utils.py` for the full implementation.
