import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DaoXE
https://daoxe.com

:::tip

**LiteLLM supports DaoXE OpenAI-compatible models via `model=daoxe/<account-model-id>`.**

DaoXE is a multi-model multi-protocol API gateway (OpenAI Chat Completions / Responses, Anthropic Messages for other clients). Model IDs are account-scoped — copy an exact ID from your DaoXE catalog or authenticated `GET /v1/models`. DaoXE is not available in mainland China.

:::

## API Key
```python
import os
os.environ['DAOXE_API_KEY']
# optional override:
# os.environ['DAOXE_API_BASE']  # defaults to https://daoxe.com/v1
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['DAOXE_API_KEY'] = ""
response = completion(
    model="daoxe/YOUR_ACCOUNT_MODEL_ID",
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    max_tokens=8,
)
print(response)
```

## Sample Usage - Streaming
```python
from litellm import completion
import os

os.environ['DAOXE_API_KEY'] = ""
response = completion(
    model="daoxe/YOUR_ACCOUNT_MODEL_ID",
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    stream=True,
    max_tokens=8,
)

for chunk in response:
    print(chunk)
```

## Sample Usage - Responses API
```python
from litellm import responses
import os

os.environ['DAOXE_API_KEY'] = ""
response = responses(
    model="daoxe/YOUR_ACCOUNT_MODEL_ID",
    input="Reply with OK",
)
print(response)
```

## Usage with LiteLLM Proxy

### 1. Set DaoXE on config.yaml

```yaml
model_list:
  - model_name: daoxe
    litellm_params:
      model: daoxe/YOUR_ACCOUNT_MODEL_ID
      api_key: "os.environ/DAOXE_API_KEY"
```

### 2. Start Proxy

```
litellm --config config.yaml
```

### 3. Test it

<Tabs>
<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data ' {
      "model": "daoxe",
      "messages": [
        {
          "role": "user",
          "content": "what llm are you"
        }
      ],
      "max_tokens": 8
    }
'
```
</TabItem>
<TabItem value="openai" label="OpenAI v1.0.0+">

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="daoxe",
    messages=[{"role": "user", "content": "this is a test request"}],
    max_tokens=8,
)
print(response)
```
</TabItem>
</Tabs>

## Notes

- Prefer live model discovery over hardcoded lists
- Disclosure: this page was contributed by someone affiliated with DaoXE
- Public client examples: https://github.com/seven7763/DaoXE-AI
