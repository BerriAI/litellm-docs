import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TrustedRouter

TrustedRouter exposes an OpenAI-compatible API. In LiteLLM, call it with the `openai/` provider prefix and set `api_base` to `https://api.trustedrouter.com/v1`.

| Property | Details |
|-------|-------|
| Provider Route on LiteLLM | `openai/` with `api_base` |
| API Endpoint for Provider | `https://api.trustedrouter.com/v1` |
| Provider Docs | [TrustedRouter Docs ↗](https://trustedrouter.com/docs) |
| Supported OpenAI Endpoints | `/chat/completions`, `/responses` |

## API Keys

Create an API key in the [TrustedRouter console](https://trustedrouter.com/console/api-keys).

```python
import os
os.environ["TRUSTEDROUTER_API_KEY"] = "your-api-key"
```

## Sample Usage

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import os
from litellm import completion

response = completion(
    model="openai/trustedrouter/auto",
    api_base="https://api.trustedrouter.com/v1",
    api_key=os.environ["TRUSTEDROUTER_API_KEY"],
    messages=[{"role": "user", "content": "Write a short haiku about routing."}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Add a model to `config.yaml`.

```yaml
model_list:
  - model_name: trustedrouter-auto
    litellm_params:
      model: openai/trustedrouter/auto
      api_base: https://api.trustedrouter.com/v1
      api_key: os.environ/TRUSTEDROUTER_API_KEY
```

2. Start the proxy.

```bash
litellm --config /path/to/config.yaml
```

3. Send a request to the proxy.

```bash
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-litellm-proxy-key' \
  -d '{
    "model": "trustedrouter-auto",
    "messages": [
      {"role": "user", "content": "Write a short haiku about routing."}
    ]
  }'
```

</TabItem>
</Tabs>

## Model IDs

Use TrustedRouter model IDs after the `openai/` prefix. Common router aliases include:

- `openai/trustedrouter/auto`
- `openai/trustedrouter/zdr`
- `openai/trustedrouter/e2e`
- `openai/trustedrouter/synth`

For the current model catalog and routing options, see [TrustedRouter models](https://trustedrouter.com/models).
