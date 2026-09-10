import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Amazon Bedrock Mantle

[Amazon Bedrock Mantle](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html) is Amazon Bedrock's distributed inference engine (Project Mantle) that exposes an **OpenAI-compatible API** for Bedrock-hosted models.

Use this provider to call Bedrock Mantle models with accurate **AWS Bedrock pricing** instead of OpenAI pricing.

:::tip

**We support ALL Bedrock Mantle models, just set `model=bedrock_mantle/<model-id>` as a prefix when sending litellm requests**

:::

## Claude Mythos

[Claude Mythos](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-mythos-preview.html) (`anthropic.claude-mythos-preview`) is available on Bedrock Mantle with **1M token input context**, 128K output, and support for reasoning, vision, and tool use.

Use the `bedrock_mantle/` route prefix with standard AWS credentials.

### /messages

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import asyncio
import litellm
import os

os.environ['AWS_ACCESS_KEY_ID'] = "your-aws-access-key"
os.environ['AWS_SECRET_ACCESS_KEY'] = "your-aws-secret-key"
os.environ['AWS_REGION_NAME'] = "us-east-1"

async def main():
    response = await litellm.anthropic_messages(
        model="bedrock_mantle/anthropic.claude-mythos-preview",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Explain quantum entanglement simply."}],
    )
    print(response)

asyncio.run(main())
```

</TabItem>
<TabItem value="ai-gateway" label="AI Gateway">

**1. Add to config.yaml**

```yaml
model_list:
  - model_name: claude-mythos
    litellm_params:
      model: bedrock_mantle/anthropic.claude-mythos-preview
      aws_region_name: us-east-1
```

**2. Start LiteLLM AI Gateway**

```shell
litellm --config /path/to/config.yaml
```

**3. Call `/v1/messages` via curl**

```bash
curl -X POST http://0.0.0.0:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "claude-mythos",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Explain quantum entanglement simply."}
    ]
  }'
```

</TabItem>
</Tabs>

### /chat/completions

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ['AWS_ACCESS_KEY_ID'] = "your-aws-access-key"
os.environ['AWS_SECRET_ACCESS_KEY'] = "your-aws-secret-key"
os.environ['AWS_REGION_NAME'] = "us-east-1"

response = completion(
    model="bedrock_mantle/anthropic.claude-mythos-preview",
    messages=[{"role": "user", "content": "Explain quantum entanglement simply."}],
)
print(response)
```

</TabItem>
<TabItem value="ai-gateway-chat" label="AI Gateway">

**1. Add to config.yaml**

```yaml
model_list:
  - model_name: claude-mythos
    litellm_params:
      model: bedrock_mantle/anthropic.claude-mythos-preview
      aws_region_name: us-east-1
```

**2. Start LiteLLM AI Gateway**

```shell
litellm --config /path/to/config.yaml
```

**3. Call `/v1/chat/completions` via curl**

```bash
curl -X POST http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "claude-mythos",
    "messages": [
      {"role": "user", "content": "Explain quantum entanglement simply."}
    ]
  }'
```

</TabItem>
</Tabs>

## OpenAI Models (GPT-5.4 / GPT-5.5)

### /responses

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import litellm
import os

os.environ['BEDROCK_MANTLE_API_KEY'] = "your-bedrock-api-key"
os.environ['BEDROCK_MANTLE_REGION'] = "us-east-2"

response = litellm.responses(
    model="bedrock_mantle/openai.{{openai_large}}",
    input="Hello! How can you help me today?",
)
print(response)
```

#### Streaming

```python
import litellm
import os

os.environ['BEDROCK_MANTLE_API_KEY'] = "your-bedrock-api-key"

response = litellm.responses(
    model="bedrock_mantle/openai.{{openai_large}}",
    input="Tell me a three sentence bedtime story about a unicorn.",
    stream=True,
)

for event in response:
    print(event)
```

</TabItem>
<TabItem value="ai-gateway" label="AI Gateway">

**1. Add to config.yaml**

```yaml
model_list:
  - model_name: gpt-5.5-mantle
    litellm_params:
      model: bedrock_mantle/openai.{{openai_large}}
      api_key: os.environ/BEDROCK_MANTLE_API_KEY
      api_base: https://bedrock-mantle.us-east-2.api.aws/v1
```

**2. Start LiteLLM AI Gateway**

```shell
litellm --config /path/to/config.yaml
```

**3. Call `/v1/responses` via curl**

```bash
curl -X POST http://0.0.0.0:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "gpt-5.5-mantle",
    "input": "Hello! How can you help me today?"
  }'
```

**4. Or use the OpenAI SDK**

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-1234",
    base_url="http://0.0.0.0:4000",
)

response = client.responses.create(
    model="gpt-5.5-mantle",
    input="Hello! How can you help me today?",
)
print(response)
```

</TabItem>
</Tabs>

## API Key

```python
# env variable
os.environ['BEDROCK_MANTLE_API_KEY'] = "your-aws-bedrock-api-key"

# optional: override region (defaults to us-east-1)
os.environ['BEDROCK_MANTLE_REGION'] = "us-east-1"  # or use AWS_REGION
```

## Supported Models

| Model | Endpoint | Context Window | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------|---------------|----------------------|------------------------|
| `openai.gpt-5.5` | `/responses` | 1.05M | $5.50 | $33.00 |
| `openai.gpt-5.4` | `/responses` | 1.05M | $2.75 | $16.50 |
| `openai.gpt-oss-120b` | `/chat/completions` | 131K | $0.15 | $0.60 |
| `openai.gpt-oss-20b` | `/chat/completions` | 131K | $0.07 | $0.30 |
| `openai.gpt-oss-safeguard-120b` | `/chat/completions` | 131K | $0.15 | $0.60 |
| `openai.gpt-oss-safeguard-20b` | `/chat/completions` | 131K | $0.07 | $0.20 |

## Sample Usage

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

os.environ['BEDROCK_MANTLE_API_KEY'] = "your-bedrock-api-key"

response = completion(
    model="bedrock_mantle/openai.gpt-oss-120b",
    messages=[{"role": "user", "content": "hello from litellm"}],
)
print(response)
```

</TabItem>
<TabItem value="streaming" label="Streaming">

```python
from litellm import completion
import os

os.environ['BEDROCK_MANTLE_API_KEY'] = "your-bedrock-api-key"

response = completion(
    model="bedrock_mantle/openai.gpt-oss-120b",
    messages=[{"role": "user", "content": "hello from litellm"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

</TabItem>
<TabItem value="async" label="Async">

```python
import asyncio
from litellm import acompletion
import os

os.environ['BEDROCK_MANTLE_API_KEY'] = "your-bedrock-api-key"

async def main():
    response = await acompletion(
        model="bedrock_mantle/openai.gpt-oss-120b",
        messages=[{"role": "user", "content": "hello from litellm"}],
    )
    print(response)

asyncio.run(main())
```

</TabItem>
</Tabs>

## Region Configuration

The API base URL is `https://bedrock-mantle.{region}.api.aws/v1`. Region is resolved in this order:

1. `aws_region_name` on the deployment (or passed as a kwarg)
2. A region prefix in the model name, e.g. `bedrock_mantle/us-gov-west-1/xai.grok-4.3`
3. `BEDROCK_MANTLE_REGION` env var
4. `AWS_REGION_NAME` env var, then `AWS_REGION`
5. Default: `us-east-1`

An explicit `api_base` (or `BEDROCK_MANTLE_API_BASE`) replaces the derived URL entirely. The model-name prefix is stripped before the request is sent, so `bedrock_mantle/us-gov-west-1/xai.grok-4.3` calls `xai.grok-4.3` in `us-gov-west-1`; it is recognized for the regions LiteLLM knows for Bedrock, and `aws_region_name` works for every region

**Supported regions:** `us-east-1`, `us-east-2`, `us-west-2`, `eu-west-1`, `eu-west-2`, `eu-central-1`, `eu-south-1`, `eu-north-1`, `ap-northeast-1`, `ap-south-1`, `ap-southeast-3`, `sa-east-1`, and `us-gov-west-1` (AWS GovCloud)

```python
import os
os.environ['BEDROCK_MANTLE_REGION'] = "eu-west-1"

# or pass api_base directly
response = completion(
    model="bedrock_mantle/openai.gpt-oss-120b",
    messages=[{"role": "user", "content": "hello"}],
    api_base="https://bedrock-mantle.eu-west-1.api.aws/v1",
)
```

### GovCloud pricing

Cost tracking uses the served region. When the price map has a row for `bedrock_mantle/{region}/{model}` (today the `us-gov-west-1` rows), that row prices the call instead of the commercial one, whether the region came from `aws_region_name` or from the model prefix. Both of these deployments bill `xai.grok-4.3` at the GovCloud rate:

```yaml
model_list:
  - model_name: grok-4.3-gov
    litellm_params:
      model: bedrock_mantle/xai.grok-4.3
      aws_region_name: us-gov-west-1
      aws_access_key_id: os.environ/AWS_GOV_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_GOV_SECRET_ACCESS_KEY
  - model_name: grok-4.3-gov-prefixed
    litellm_params:
      model: bedrock_mantle/us-gov-west-1/xai.grok-4.3
      aws_access_key_id: os.environ/AWS_GOV_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_GOV_SECRET_ACCESS_KEY
```

A deployment that sets `base_model` or its own `input_cost_per_token` / `output_cost_per_token` is priced from that row alone; the served region is not applied on top of it

## Usage with LiteLLM Proxy

### 1. Set Bedrock Mantle models on config.yaml

```yaml
model_list:
  - model_name: gpt-5.5-mantle
    litellm_params:
      model: bedrock_mantle/openai.{{openai_large}}
      api_key: os.environ/BEDROCK_MANTLE_API_KEY
      api_base: "https://bedrock-mantle.us-east-2.api.aws/v1"

  - model_name: gpt-oss-120b
    litellm_params:
      model: bedrock_mantle/openai.gpt-oss-120b
      api_key: os.environ/BEDROCK_MANTLE_API_KEY
      # optional region override:
      api_base: "https://bedrock-mantle.us-east-1.api.aws/v1"

  - model_name: gpt-oss-20b
    litellm_params:
      model: bedrock_mantle/openai.gpt-oss-20b
      api_key: os.environ/BEDROCK_MANTLE_API_KEY
```

### 2. Start the proxy

```shell
litellm --config /path/to/config.yaml
```

### 3. Send a request

```python
import openai

client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000",
)

response = client.chat.completions.create(
    model="gpt-oss-120b",
    messages=[{"role": "user", "content": "hello from litellm"}],
)
print(response)
```
