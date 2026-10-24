import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Z.AI (Zhipu AI)
https://z.ai/

**We support Z.AI GLM text/chat models, just set `zai/` as a prefix when sending completion requests**

## API Key
```python
# env variable
os.environ['ZAI_API_KEY']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['ZAI_API_KEY'] = ""
response = completion(
    model="zai/glm-5.1",
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
)
print(response)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['ZAI_API_KEY'] = ""
response = completion(
    model="zai/glm-5.1",
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    stream=True
)

for chunk in response:
    print(chunk)
```

## Supported Models

LiteLLM's Z.AI provider forwards chat completion requests to Z.AI's API without a model allowlist. Prefix a model available through that API with `zai/`, for example [`zai/glm-5.1`](https://models.litellm.ai/models/glm-5.1).

Browse the [Z.AI model catalog](https://models.litellm.ai/providers/zai) for current model names, context windows, and capabilities. The catalog uses LiteLLM's model price file and includes newer models as their metadata is added.

## Model Pricing

See the [Z.AI model catalog](https://models.litellm.ai/providers/zai) and individual model pages for current input, output, and cache pricing. These prices come from the same [model price file](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) that LiteLLM uses for cost tracking.

## Using with LiteLLM Proxy

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ['ZAI_API_KEY'] = ""
response = completion(
    model="zai/glm-5.1",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
  - model_name: glm-5.1
    litellm_params:
        model: zai/glm-5.1
        api_key: os.environ/ZAI_API_KEY
  - model_name: glm-4.5-flash  # Free tier
    litellm_params:
        model: zai/glm-4.5-flash
        api_key: os.environ/ZAI_API_KEY
```

2. Run proxy

```bash
litellm --config config.yaml
```

3. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "glm-5.1",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
}'
```

</TabItem>
</Tabs>
