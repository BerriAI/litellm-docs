import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Bineric

## Overview

| Property | Details |
|-------|-------|
| Description | Bineric trains its own European models, Zuse, a decision model trained on European languages, and Lynx, a European general model. Bineric also makes NorskGPT, a Norwegian AI assistant. The same EU-hosted API, with one key, also serves Borealis 2 from the National Library of Norway, Claude through Amazon Bedrock, GPT through Azure, and open models. |
| Provider Route on LiteLLM | `bineric/` |
| Link to Provider Doc | [Bineric API documentation ↗](https://bineric.com/platform/docs) |
| Base URL | `https://api.bineric.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/v1/systemone`](#zuse-decision-models) for Zuse |

<br />

The `bineric` provider needs a LiteLLM build that contains [LiteLLM #51621](https://github.com/BerriAI/litellm/pull/51621).

## EU hosting

Most Bineric models run in EU data centres, and some run in the US, such as the Gemini models. `GET https://api.bineric.com/v1/models` lists every model with a `hosting` field of `EU` or `US`, along with its context length and price per million tokens. It needs no key, so check it when your data has to stay in the EU.

## Available models (selection)

Every model in Bineric's catalogue works with the `bineric/` prefix. Bineric's own models come first, then a few of the others:

| Model | Description | Hosting | Context window |
|-------|-------------|---------|----------------|
| `bineric/zuse-27b` | Zuse, Bineric's European decision model, larger and more accurate | EU | 8,192 tokens |
| `bineric/zuse-9b` | Zuse, Bineric's European decision model, faster and cheaper | EU | 64K tokens |
| `bineric/lynx-30b` | Lynx, Bineric's European general model | EU | 262K tokens |
| `bineric/borealis-2` | Norwegian model from the National Library of Norway, strong in Bokmål and Nynorsk | EU | 16K tokens |
| `bineric/claude-sonnet-5.5` | Anthropic Claude Sonnet 5.5 through Amazon Bedrock | EU | 1M tokens |
| `bineric/claude-haiku-5.5` | Anthropic Claude Haiku 5.5 through Amazon Bedrock | EU | 100K tokens |
| `bineric/gpt-5.4` | OpenAI GPT 5.4 through Azure | EU | 272K tokens |
| `bineric/qwen-3-235b` | Qwen 3 235B | EU | 262K tokens |

Zuse models answer typed questions instead of generating text, so they use `/v1/systemone`, as shown in [Zuse decision models](#zuse-decision-models).

## Required variables

```python showLineNumbers title="Environment Variables"
os.environ["BINERIC_API_KEY"] = ""  # your Bineric API key
```

Get an API key from [platform.bineric.com](https://platform.bineric.com). Set `BINERIC_API_BASE` only if you route through your own gateway. The chat models and Zuse read the same two variables.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Bineric Non-streaming Completion"
import os
from litellm import completion

os.environ["BINERIC_API_KEY"] = ""  # your Bineric API key

response = completion(
    model="bineric/lynx-30b",
    messages=[{"role": "user", "content": "Hva er hovedstaden i Norge?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Bineric Streaming Completion"
import os
from litellm import completion

os.environ["BINERIC_API_KEY"] = ""  # your Bineric API key

response = completion(
    model="bineric/claude-haiku-5.5",
    messages=[{"role": "user", "content": "Say hello in Norwegian."}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Usage - LiteLLM Proxy

Add Bineric models to your proxy config. Zuse and the chat models go in the same `model_list`.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: zuse-27b
    litellm_params:
      model: bineric/zuse-27b
      api_key: os.environ/BINERIC_API_KEY

  - model_name: lynx-30b
    litellm_params:
      model: bineric/lynx-30b
      api_key: os.environ/BINERIC_API_KEY

  - model_name: borealis-2
    litellm_params:
      model: bineric/borealis-2
      api_key: os.environ/BINERIC_API_KEY

  - model_name: claude-haiku-5.5
    litellm_params:
      model: bineric/claude-haiku-5.5
      api_key: os.environ/BINERIC_API_KEY
```

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Bineric via Proxy"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",  # your proxy URL
    api_key="your-proxy-api-key",      # your proxy API key
)

response = client.chat.completions.create(
    model="lynx-30b",
    messages=[{"role": "user", "content": "Hva er hovedstaden i Norge?"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Bineric via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "lynx-30b",
    "messages": [{"role": "user", "content": "Hva er hovedstaden i Norge?"}]
  }'
```

</TabItem>
</Tabs>

## Zuse decision models

Zuse is Bineric's own European decision model. It reads a text and answers typed questions about it with probabilities instead of generated text, such as a yes/no probability or a pick from a fixed list. It is trained on European languages and hosted in the EU. Zuse takes the Jev request format, so LiteLLM serves it on [`/v1/systemone`](../decisions.md) like the other decision providers. `zuse-27b` reads documents up to 8,192 tokens and `zuse-9b` up to 65,536. Both are priced per input token, with no output tokens.

<Tabs>
<TabItem value="sdk" label="SDK">

```python showLineNumbers title="Zuse with the LiteLLM SDK"
import os
import litellm

os.environ["BINERIC_API_KEY"] = ""  # your Bineric API key

response = litellm.systemone(
    model="bineric/zuse-27b",
    state="Hei, jeg ble belastet to ganger for ordre 4411 og vil ha pengene tilbake i dag.",
    questions={
        "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
        "urgency": {
            "type": "choice",
            "instructions": "How urgent is this?",
            "criteria": {"low": "can wait a week", "high": "needs an answer today"},
        },
    },
)

print(response.answers)
```

</TabItem>
<TabItem value="proxy" label="Proxy">

```bash showLineNumbers title="Zuse via Proxy - cURL"
curl http://localhost:4000/v1/systemone \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "zuse-27b",
    "state": "Hei, jeg ble belastet to ganger for ordre 4411 og vil ha pengene tilbake i dag.",
    "questions": {
      "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
      "urgency": {
        "type": "choice",
        "instructions": "How urgent is this?",
        "criteria": {"low": "can wait a week", "high": "needs an answer today"}
      }
    }
  }'
```

</TabItem>
</Tabs>

The answer has one entry per question, with the probability for a yes/no question and the chosen option with its confidence for a choice question:

```json
{
  "model": "zuse-27b",
  "answers": {
    "is_refund_request": {"type": "noul", "noul": 0.9452},
    "urgency": {"type": "choice", "choice": "high", "confidence": 0.9985, "probabilities": {"low": 0.0008, "high": 0.9992}}
  }
}
```

See [Decisions](../decisions.md) for every question type and for the OpenAI-format `/v1/decisions` route, which also reaches Zuse.

## Cost tracking

LiteLLM's cost map has Bineric's per-token prices, so chat and Zuse calls report their cost in the `x-litellm-response-cost` header. When a Bineric response carries `usage.cost`, LiteLLM bills that figure instead. Three models are priced per request instead of per token, `speech-to-text`, `stability-ai` and `deep-research`. They have no cost map row, so their cost shows as unknown unless the response reports `usage.cost`.
