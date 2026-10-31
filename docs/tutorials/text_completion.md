# Using Text Completion Format - with Completion()

If your prefer interfacing with the OpenAI Text Completion format this tutorial covers how to use LiteLLM in this format
```python keep-model-ids
from openai import OpenAI

client = OpenAI()
response = client.completions.create(
    model="gpt-5.4-mini",
    prompt='Write a tagline for a traditional bavarian tavern',
    temperature=0,
    max_tokens=100)
```

## Using LiteLLM in the Text Completion format
### With gpt-5.4-mini
```python keep-model-ids
from litellm import text_completion
response = text_completion(
    model="gpt-5.4-mini",
    prompt='Write a tagline for a traditional bavarian tavern',
    temperature=0,
    max_tokens=100)
```

### With the OpenAI completions endpoint
```python keep-model-ids
response = text_completion(
    model="text-completion-openai/gpt-5.4-mini",
    prompt='Write a tagline for a traditional bavarian tavern',
    temperature=0,
    max_tokens=100)
```

### With llama2
```python
response = text_completion(
    model="together_ai/togethercomputer/llama-2-70b-chat",
    prompt='Write a tagline for a traditional bavarian tavern',
    temperature=0,
    max_tokens=100)
```