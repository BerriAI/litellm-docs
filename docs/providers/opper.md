import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Opper
https://opper.ai

**We support ALL Opper models, just set `opper/` as a prefix when sending completion requests**

Opper is an EU-hosted LLM gateway with an OpenAI-compatible API, giving you access to 300+ models (Anthropic, OpenAI, Google, Mistral, open-weight models on EU infrastructure, and more) through a single API key. Model IDs follow the `provider/model` convention, e.g. `anthropic/claude-haiku-4-5`.

Opper reports the actual request cost (USD) in `usage.cost` on every response; LiteLLM records it as the provider-reported response cost, so spend tracking reflects real gateway numbers instead of static price-map estimates.

## API Key
```python
# env variable
os.environ['OPPER_API_KEY']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['OPPER_API_KEY'] = ""
response = completion(
    model="opper/anthropic/claude-haiku-4-5",
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

os.environ['OPPER_API_KEY'] = ""
response = completion(
    model="opper/anthropic/claude-haiku-4-5",
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Custom API Base
For self-hosted or regional deployments, override the API base via the environment:
```python
# env variable
os.environ['OPPER_API_BASE']  # defaults to https://api.opper.ai/v3/compat
```

## Usage with LiteLLM Proxy

```yaml
model_list:
  - model_name: claude-haiku
    litellm_params:
      model: opper/anthropic/claude-haiku-4-5
      api_key: os.environ/OPPER_API_KEY
```

Opper also accepts up to 8 usage-attribution tags per request via the `X-Opper-Tags` header (e.g. to split spend per downstream tenant in Opper's own analytics):

```yaml
model_list:
  - model_name: claude-haiku
    litellm_params:
      model: opper/anthropic/claude-haiku-4-5
      api_key: os.environ/OPPER_API_KEY
      extra_headers: {"X-Opper-Tags": "tenant:acme"}
```

## Discovering models

Opper's model list (with per-token pricing and compliance metadata) is available at `GET https://api.opper.ai/v3/compat/models`; the list is filtered to the models your key is permitted to use.
