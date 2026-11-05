# Use a Virtual Key

{/* keep-version-note */}

Send a LiteLLM Virtual Key as the bearer token when you call the gateway. Get a Virtual Key and the gateway URL from your administrator. Administrators can [create and manage Virtual Keys](./virtual_keys.md) and configure their permissions in [Access Management](./access_management/overview.md).

## Send the Virtual Key in a request

Set the gateway URL and your Virtual Key, then call a model available to it. Replace `my-model` with its configured model name.

```bash
export LITELLM_PROXY_URL="https://litellm.example.com"
export LITELLM_API_KEY="<your-virtual-key>"

curl "$LITELLM_PROXY_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Use the Virtual Key issued for this gateway. Model-provider credentials are configured on the gateway separately.

## Use the OpenAI SDK

Point the SDK at the gateway's `/v1` base URL and supply the same Virtual Key.

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url=f"{os.environ['LITELLM_PROXY_URL'].rstrip('/')}/v1",
    api_key=os.environ["LITELLM_API_KEY"],
)

response = client.chat.completions.create(
    model="my-model",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)
```

For other clients, see [Client Setup](./client_setup/overview.md). To send your identity provider's token directly, see [identity provider setup](./token_auth.md) or [provider-side token validation](./oauth2.md).
