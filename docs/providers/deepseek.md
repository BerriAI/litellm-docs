import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Deepseek
https://deepseek.com/

**We support ALL Deepseek models, just set `deepseek/` as a prefix when sending completion requests**

## API Key
```python
# env variable
os.environ['DEEPSEEK_API_KEY']
```

## Sample Usage
```python
from litellm import completion
import os

os.environ['DEEPSEEK_API_KEY'] = ""
response = completion(
    model="deepseek/deepseek-chat", 
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

os.environ['DEEPSEEK_API_KEY'] = ""
response = completion(
    model="deepseek/deepseek-chat", 
    messages=[
       {"role": "user", "content": "hello from litellm"}
   ],
    stream=True
)

for chunk in response:
    print(chunk)
```


## Supported Models - ALL Deepseek Models Supported!
We support ALL Deepseek models, just set `deepseek/` as a prefix when sending completion requests

| Model Name               | Function Call                                                                                                                                                      |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| deepseek-chat | `completion(model="deepseek/deepseek-chat", messages)` | 
| deepseek-coder | `completion(model="deepseek/deepseek-coder", messages)` | 
| deepseek-flash | `completion(model="deepseek/deepseek-flash", messages)` | 
| deepseek-v4-pro | `completion(model="deepseek/deepseek-v4-pro", messages)` | 


## Reasoning Models
| Model Name               | Function Call                                                                                                                                                      |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| deepseek-reasoner | `completion(model="deepseek/deepseek-reasoner", messages)` |

### Thinking / Reasoning Mode

Enable thinking mode for DeepSeek reasoner models using `thinking` or `reasoning_effort` parameters:

<Tabs>
<TabItem value="thinking" label="thinking param">

```python
from litellm import completion
import os

os.environ['DEEPSEEK_API_KEY'] = ""

resp = completion(
    model="deepseek/deepseek-reasoner",
    messages=[{"role": "user", "content": "What is 2+2?"}],
    thinking={"type": "enabled"},
)
print(resp.choices[0].message.reasoning_content)  # Model's reasoning
print(resp.choices[0].message.content)  # Final answer
```

</TabItem>
<TabItem value="reasoning_effort" label="reasoning_effort param">

```python
from litellm import completion
import os

os.environ['DEEPSEEK_API_KEY'] = ""

resp = completion(
    model="deepseek/deepseek-reasoner",
    messages=[{"role": "user", "content": "What is 2+2?"}],
    reasoning_effort="medium",  # low, medium, high all map to thinking enabled
)
print(resp.choices[0].message.reasoning_content)  # Model's reasoning
print(resp.choices[0].message.content)  # Final answer
```

</TabItem>
</Tabs>

:::note
DeepSeek only supports `{"type": "enabled"}` - unlike Anthropic, it doesn't support `budget_tokens`. Any `reasoning_effort` value other than `"none"` enables thinking mode.
:::

### Basic Usage

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ['DEEPSEEK_API_KEY'] = ""
resp = completion(
    model="deepseek/deepseek-reasoner",
    messages=[{"role": "user", "content": "Tell me a joke."}],
)

print(
    resp.choices[0].message.reasoning_content
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
  - model_name: deepseek-reasoner
    litellm_params:
        model: deepseek/deepseek-reasoner
        api_key: os.environ/DEEPSEEK_API_KEY
```

2. Run proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it!

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
    "model": "deepseek-reasoner",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Hi, how are you ?"
          }
        ]
      }
    ]
}'
```

</TabItem>

</Tabs>

## Off-Peak Pricing

DeepSeek bills half its listed rate outside its peak hours. Peak hours are 01:00-04:00 and 06:00-10:00 UTC, Monday through Friday, excluding Chinese public holidays. Every other hour is off-peak, including weekends and Chinese public holidays in full. The rates below are USD per 1M tokens, from the [DeepSeek pricing page](https://api-docs.deepseek.com/quick_start/pricing), for `deepseek-flash` (DeepSeek-V4.1-Flash) and `deepseek-v4-pro` (DeepSeek-V4-Pro-0813)

| Model | Rate | Input | Output | Cache hit |
|-------|------|-------|--------|-----------|
| deepseek-flash | Peak | $0.30 | $1.20 | $0.006 |
| deepseek-flash | Off-peak | $0.15 | $0.60 | $0.003 |
| deepseek-v4-pro | Peak | $1.32 | $3.96 | $0.044 |
| deepseek-v4-pro | Off-peak | $0.66 | $1.98 | $0.022 |

LiteLLM's cost tracking applies the off-peak rate automatically. The built-in cost map entries for these models carry the schedule above, and each request is priced from the UTC time and weekday it completes at, so tracked spend matches the DeepSeek invoice with no extra configuration. The 2026 Chinese public holidays and make-up workdays are modeled through `override_dates` on the off-peak windows, see [Off-Peak Pricing](../proxy/off_peak_pricing#date-overrides). The legacy `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` names are served by DeepSeek-V4.1-Flash and billed at the Flash rate, off-peak included. To change the schedule or rates, or to set one on another deployment, see [Off-Peak Pricing](../proxy/off_peak_pricing)
