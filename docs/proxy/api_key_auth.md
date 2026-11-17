# Use a Virtual Key

{/* keep-version-note */}

Send a LiteLLM Virtual Key as the bearer token when you call the gateway.

## How it works

LiteLLM looks up the Virtual Key in each request's `Authorization` header to identify the caller. Use the key issued for this gateway; model-provider credentials are configured on the gateway separately.

## Prerequisites

Get a Virtual Key, the gateway URL, and an available model name from your administrator. Administrators can [create and manage Virtual Keys](./virtual_keys.md) and configure their permissions in [Access Management](./access_management/overview.md).

## Setup

Set the gateway URL and your Virtual Key in your client environment:

```bash
export LITELLM_PROXY_URL="https://litellm.example.com"
export LITELLM_API_KEY="<your-virtual-key>"
```

## Test authentication {#send-the-virtual-key-in-a-request}

Call a model available to the key. Replace `my-model` with its configured model name:

```bash
curl "$LITELLM_PROXY_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

The request should return a model response. If authentication fails, confirm the key and gateway URL came from the same administrator.

## Troubleshooting

Check that the key is active, has not expired, and is sent as `Authorization: Bearer <key>`. For a model-access denial, ask your administrator to check the key's [model permissions](./access_management/llm.md).

## Related guides

<a id="use-the-openai-sdk"></a>

Use the [OpenAI SDK examples](./user_keys.md#chatcompletions) or [Client Setup](./client_setup/overview.md) to configure your application. To send your identity provider's token directly, see [identity provider setup](./token_auth.md) or [OAuth 2.0 provider setup](./oauth2.md).
