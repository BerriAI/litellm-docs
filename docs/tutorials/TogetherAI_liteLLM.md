# Llama Together AI Tutorial
https://together.ai/



```bash
uv add litellm
```


```python
import os
from litellm import completion
os.environ["TOGETHERAI_API_KEY"] = "" #@param
user_message = "Hello, whats the weather in San Francisco??"
messages = [{ "content": user_message,"role": "user"}]
```

## Calling Llama on TogetherAI
https://api.together.xyz/playground/chat?model=meta-llama%2FLlama-3.3-70B-Instruct-Turbo

```python
model_name = "together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo"
response = completion(model=model_name, messages=messages)
print(response)
```


```
ModelResponse(id='p37X6YS-4YNCb4-a42452fa9a16e22a', created=1790615034, model='meta-llama/Llama-3.3-70B-Instruct-Turbo', object='chat.completion', choices=[Choices(finish_reason='stop', index=0, message=Message(content="San Francisco! The weather in San Francisco is known for being quite unique and unpredictable...", role='assistant'))], usage=Usage(completion_tokens=20, prompt_tokens=44, total_tokens=64))
```


LiteLLM sends your OpenAI-format `messages` array unchanged to Together AI's `/v1/chat/completions` endpoint, and Together AI applies the model's chat template server-side. LiteLLM does not rewrite the messages into a `[INST] ... [/INST]` prompt, and templates registered with `litellm.register_prompt_template` are not applied to `together_ai/` chat models

[Implementation Code](https://github.com/BerriAI/litellm/blob/main/litellm/llms/together_ai/chat/transformation.py)

## With Streaming


```python
response = completion(model=model_name, messages=messages, stream=True)
print(response)
for chunk in response:
  print(chunk['choices'][0]['delta']) # same as openai format
```
