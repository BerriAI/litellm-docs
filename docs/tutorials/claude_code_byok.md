# Claude Code with Bring Your Own Key (BYOK)

Use Claude Code with your own Anthropic credentials through the LiteLLM proxy. Claude Code authenticates to Anthropic one of two ways: `/login` sends an OAuth token as `Authorization: Bearer <token>` (tied to your Claude.ai Free, Pro, Max, or Enterprise seat), while a configured Anthropic API key is sent as `x-api-key`. LiteLLM forwards either credential to Anthropic instead of using proxy-configured keys, so you pay Anthropic directly while still benefiting from LiteLLM's routing, logging, and guardrails.

## How It Works

1. **Claude Code authentication**: with `/login`, Claude Code sends your Anthropic OAuth token as `Authorization: Bearer <token>`; with a configured API key, it sends `x-api-key` instead.
2. **LiteLLM authentication**: you pass your LiteLLM proxy key via `ANTHROPIC_CUSTOM_HEADERS` (e.g. `x-litellm-api-key`) so the proxy can authenticate and track your usage without touching the Anthropic credential headers above.
3. **Key forwarding**: LiteLLM forwards the OAuth `Authorization` header to Anthropic automatically. The `x-api-key` path additionally needs `forward_llm_provider_auth_headers: true`, since LiteLLM strips `x-api-key` by default.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) installed
- Anthropic API key (from [console.anthropic.com](https://console.anthropic.com))
- LiteLLM proxy with a virtual key for authentication

## Step 1: Configure LiteLLM Proxy

If you're authenticating with an Anthropic API key rather than `/login`, enable forwarding of LLM provider auth headers so your key takes precedence:

```yaml title="config.yaml"
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      # No api_key needed — client's key will be used

litellm_settings:
  forward_llm_provider_auth_headers: true  # Required for the x-api-key path; not needed for /login
```

:::info Why `forward_llm_provider_auth_headers`?

By default, LiteLLM strips `x-api-key` from client requests for security. Setting this to `true` allows a client-provided Anthropic API key to be forwarded to Anthropic, overriding any proxy-configured key. This setting only governs `x-api-key` and similar provider-key headers; it has no effect on `/login`, which authenticates via an `Authorization: Bearer` OAuth token that LiteLLM forwards regardless of this setting, provided you authenticate to the proxy with a different header (such as `x-litellm-api-key`) rather than `Authorization`.

:::

:::tip Configure via UI instead of config.yaml

You can also complete this setup from the LiteLLM admin UI:

- Add the model via **Models → Add Model**, leaving the **API Key** field blank.
- Enable the toggle at **Settings → UI Settings → "Forward LLM provider auth headers"**.

Both UI actions write to the database and override `config.yaml` at runtime.

:::

## Step 2: Create a LiteLLM Virtual Key

Create a virtual key in the LiteLLM UI or via API. 
```bash
# Example: Create key via API
curl -X POST "http://localhost:4000/key/generate" \
  -H "Authorization: Bearer sk-your-master-key" \
  -H "Content-Type: application/json" \
  -d '{"key_alias": "claude-code-byok", "models": ["{{anthropic}}"]}'
```

## Step 3: Configure Claude Code

Set environment variables so Claude Code uses LiteLLM and sends your LiteLLM key for proxy auth:

```bash
# Point Claude Code to your LiteLLM proxy
export ANTHROPIC_BASE_URL="http://localhost:4000"

# Model name from your config
export ANTHROPIC_MODEL="{{anthropic}}"

# LiteLLM proxy auth: this is added to every request
# Use x-litellm-api-key so the proxy authenticates you; your Anthropic credential goes
# via Authorization (from /login) or x-api-key (if you configured a key directly)
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-api-key: sk-12345"
```

Replace `sk-12345` with your actual LiteLLM virtual key.

:::tip Multiple headers

For multiple headers, use newline-separated values:

```bash
export ANTHROPIC_CUSTOM_HEADERS="x-litellm-api-key: sk-12345
x-litellm-user-id: my-user-id"
```

:::

## Step 4: Sign In with Claude Code

1. Launch Claude Code:

   ```bash
   claude
   ```

2. Use **`/login`** and sign in with your Anthropic account (or use your API key directly).

3. Claude Code sends `x-litellm-api-key` (your LiteLLM key, from `ANTHROPIC_CUSTOM_HEADERS`) plus one of the following, depending on how you authenticated in step 2:
   - `Authorization: Bearer <oauth-token>`, if you used `/login`
   - `x-api-key`, if you configured an Anthropic API key directly

4. LiteLLM authenticates you via `x-litellm-api-key`. It forwards the OAuth `Authorization` header to Anthropic automatically; forwarding `x-api-key` additionally requires `forward_llm_provider_auth_headers: true`. Either way, your Anthropic credential takes precedence over any proxy-configured key.

## Summary

| Header | Source | Purpose | Needs `forward_llm_provider_auth_headers`? |
|--------|--------|---------|---------|
| `Authorization: Bearer <token>` | Claude Code `/login` (OAuth) | Sent to Anthropic for API calls | No, forwarded by default |
| `x-api-key` | Configured Anthropic API key | Sent to Anthropic for API calls | Yes |
| `x-litellm-api-key` | `ANTHROPIC_CUSTOM_HEADERS` | Proxy authentication, tracking, rate limits | N/A |

## Troubleshooting

### Requests fail with "invalid x-api-key"

This applies to the configured-API-key path, not `/login`.

- Ensure `forward_llm_provider_auth_headers: true` is set in `litellm_settings` (or `general_settings`).
- Restart the LiteLLM proxy after changing the config.
- Verify your Anthropic API key is configured correctly on the client.

### Proxy returns 401

- Check that `ANTHROPIC_CUSTOM_HEADERS` includes `x-litellm-api-key: <your-key>`.
- Ensure the LiteLLM key is valid and has access to the model.

### Proxy key is used instead of my Anthropic key

This applies to the `x-api-key` path; the OAuth `Authorization` header from `/login` is forwarded regardless of this setting.

- Confirm `forward_llm_provider_auth_headers: true` is in your config.
- The setting can be in `litellm_settings` or `general_settings` depending on your config structure.
- Enable debug logging: `LITELLM_LOG=DEBUG` to see which key is being forwarded.

## Related

- [Forward Client Headers](./../proxy/forward_client_headers.md) — Full BYOK and header forwarding docs
- [Claude Code Max Subscription](./claude_code_max_subscription.md) — Using Claude Code with OAuth/Max subscription through LiteLLM
