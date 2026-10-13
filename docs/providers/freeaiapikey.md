import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# FreeAIapikey

| Property | Details |
|-------|-------|
| Description | FreeAIapikey is an OpenAI-compatible API gateway offering GPT-5.5, GPT-5.6 Sol, GPT-6 Sol, GPT-6 Astra, Claude Opus 4.7/4.8/5/5.5 and Claude Sonnet 5, at roughly 60-80% below official list pricing. $2 free credit on signup, no card required. |
| Provider Route on LiteLLM | `openai/` (custom base URL) |
| Provider Doc | [FreeAIapikey Docs](https://freeaiapikey.com/docs) |
| API Endpoint for Provider | https://api.freeaiapikey.com/v1 |
| Model list endpoint | `GET https://api.freeaiapikey.com/v1/models` (live catalog, queryable at runtime) |

<br />

## API Keys

Get your API key from the [FreeAIapikey dashboard](https://freeaiapikey.com/dashboard)

```python
import os
os.environ["FREEAIKEY_API_KEY"] = "your-api-key"
```

## Supported Models

Model IDs below are taken from the live catalog at `GET https://api.freeaiapikey.com/v1/models` (retrieved October 2026):

| Model ID | Base model |
|---|---|
| `openai/gpt-5.5` | GPT-5.5 |
| `openai/gpt-5.6-sol` | GPT-5.6 Sol |
| `openai/gpt-6-sol` | GPT-6 Sol |
| `openai/gpt-6-Astra` | GPT-6 Astra |
| `anthropic/claude-opus-4.7` | Claude Opus 4.7 |
| `anthropic/claude-opus-4.8` | Claude Opus 4.8 |
| `anthropic/claude-opus-5` | Claude Opus 5 |
| `anthropic/claude-opus-5.5` | Claude Opus 5.5 |
| `anthropic/claude-sonnet-5` | Claude Sonnet 5 |

## Sample Usage

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import os
from litellm import completion

os.environ["FREEAIKEY_API_KEY"] = ""

response = completion(
    model="openai/gpt-6-sol",
    messages=[{"role": "user", "content": "hello from litellm"}],
    base_url="https://api.freeaiapikey.com/v1",
    api_key=os.environ["FREEAIKEY_API_KEY"],
)
```

</TabItem>
<TabItem value="proxy" label="Proxy (config.yaml)">

```yaml
model_list:
  - model_name: gpt-6-sol
    litellm_params:
      model: openai/gpt-6-sol
      api_base: https://api.freeaiapikey.com/v1
      api_key: os.environ/FREEAIKEY_API_KEY
```

</TabItem>
</Tabs>

## Just testing it works

```bash
curl https://api.freeaiapikey.com/v1/chat/completions   -H "Authorization: Bearer $FREEAIKEY_API_KEY"   -H "Content-Type: application/json"   -d '{"model": "openai/gpt-6-sol", "messages": [{"role": "user", "content": "hi"}]}'
```
