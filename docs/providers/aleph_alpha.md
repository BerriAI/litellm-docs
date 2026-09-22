# Aleph Alpha

LiteLLM supports all models from [Aleph Alpha](https://www.aleph-alpha.com/). 

Like AI21 and Cohere, you can use these models without a waitlist. 

### API KEYS
```python
import os
os.environ["ALEPHALPHA_API_KEY"] = ""
```

### Aleph Alpha Models
https://www.aleph-alpha.com/

Aleph Alpha models are not in LiteLLM's model cost map, so LiteLLM cannot infer the provider from the model name alone. Pass `custom_llm_provider="aleph_alpha"` explicitly.

| Model Name       | Function Call                                  | Required OS Variables              |
|------------------|--------------------------------------------|------------------------------------|
| luminous-base       | `completion(model='luminous-base', custom_llm_provider='aleph_alpha', messages=messages)`         | `os.environ['ALEPHALPHA_API_KEY']`     |
| luminous-base-control       | `completion(model='luminous-base-control', custom_llm_provider='aleph_alpha', messages=messages)`         | `os.environ['ALEPHALPHA_API_KEY']`     |
| luminous-extended       | `completion(model='luminous-extended', custom_llm_provider='aleph_alpha', messages=messages)`         | `os.environ['ALEPHALPHA_API_KEY']`     |
| luminous-extended-control       | `completion(model='luminous-extended-control', custom_llm_provider='aleph_alpha', messages=messages)`         | `os.environ['ALEPHALPHA_API_KEY']`     |
| luminous-supreme     | `completion(model='luminous-supreme', custom_llm_provider='aleph_alpha', messages=messages)`         | `os.environ['ALEPHALPHA_API_KEY']`     |
| luminous-supreme-control     | `completion(model='luminous-supreme-control', custom_llm_provider='aleph_alpha', messages=messages)`         | `os.environ['ALEPHALPHA_API_KEY']`     |
