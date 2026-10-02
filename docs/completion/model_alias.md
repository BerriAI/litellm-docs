# Model Alias

The model name you show an end-user might be different from the one you pass to LiteLLM - e.g. Displaying `GPT-5.6` while calling `{{openai_small}}` on the backend. 

LiteLLM simplifies this by letting you pass in a model alias mapping. 

## expected format

```python
litellm.model_alias_map = {
    # a dictionary containing a mapping of the alias string to the actual litellm model name string
    "model_alias": "litellm_model_name"
}
```

## usage 

### Relevant Code
```python
model_alias_map = {
    "GPT-5.6": "{{openai_small}}",
    "llama2": "replicate/llama-2-70b-chat:2796ee9483c3fd7aa2e171d38f4ca12251a30609463dcfd4cd76703f22e96cdf"
}

litellm.model_alias_map = model_alias_map
```

### Complete Code
```python
import litellm 
from litellm import completion 


## set ENV variables
os.environ["OPENAI_API_KEY"] = "openai key"
os.environ["REPLICATE_API_KEY"] = "cohere key"

## set model alias map
model_alias_map = {
    "GPT-5.6": "{{openai_small}}",
    "llama2": "replicate/llama-2-70b-chat:2796ee9483c3fd7aa2e171d38f4ca12251a30609463dcfd4cd76703f22e96cdf"
}

litellm.model_alias_map = model_alias_map

messages = [{ "content": "Hello, how are you?","role": "user"}]

# call "{{openai_small}}"
response = completion(model="GPT-5.6", messages=messages)

# call replicate/llama-2-70b-chat:2796ee9483c3fd7aa2e171d38f4ca1...
response = completion("llama2", messages)
```
