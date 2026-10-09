import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GitHub Copilot

Use [GitHub Copilot](https://docs.github.com/en/copilot) models through LiteLLM Proxy or the Python SDK. LiteLLM supports Chat Completions, Responses, Embeddings, and Anthropic Messages.

Your GitHub Copilot plan determines which models you can use. Each model supports specific endpoints. See [supported endpoints and models](#supported-endpoints-and-models).

## Set up LiteLLM Proxy

Use **Per-user GitHub OAuth** to let each person connect their own GitHub account. An admin adds the model once, then each user connects before sending requests.

To use one GitHub account for all requests, see [shared device login](#shared-device-login). For direct Python calls, see [the SDK examples](#usage-with-the-litellm-python-sdk).

### 1. Admin: add the model and credential

Open **Models + Endpoints** in the LiteLLM dashboard and click **Add Model**. Select **GitHub Copilot** as the provider and `github_copilot/claude-sonnet-5.5` under **LiteLLM Model Name(s)**. Under **Model Mappings**, set **Public Model Name** to `claude-copilot`.

Set **Auth Type** to **Per-user GitHub OAuth** and click **Create credential**. Enter `copilot-per-user` as the **Credential Name**, then click **Add Credential**. The form selects the new credential. Click **Add Model** to save the model.

Use `claude-copilot` as the model name in requests, including requests from Claude Code or Claude Desktop.

<details>
<summary>Use config.yaml to add the model</summary>

If you manage models in `config.yaml`, create the credential in the dashboard and add this model configuration instead of saving the model in the dashboard:

```yaml showLineNumbers keep-model-ids title="config.yaml"
model_list:
  - model_name: claude-copilot
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
      litellm_credential_name: copilot-per-user
```

Restart the proxy to apply the configuration.

</details>

### 2. User: connect your GitHub account

Open **LLM Credentials** in the LiteLLM dashboard. Under **Your connections**, find `copilot-per-user` and click **Connect**.

Open the GitHub verification URL that appears, enter the code, and approve the connection. Return to LiteLLM and wait for **Connected as @your-username**. You do not need GitHub CLI.

LiteLLM uses the GitHub connection saved for the user making the request. If LiteLLM asks you to reconnect, repeat this step.

### 3. User: send a request

Use a LiteLLM API key that belongs to the same LiteLLM user who connected GitHub. Replace `your-proxy-api-key` with that key and `http://localhost:4000` with your proxy URL.

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Send a chat request"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key="your-proxy-api-key",
)

response = client.chat.completions.create(
    model="claude-copilot",
    messages=[{"role": "user", "content": "Write a Python hello world"}],
)
print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Send a chat request"
import litellm

response = litellm.completion(
    model="litellm_proxy/claude-copilot",
    messages=[{"role": "user", "content": "Write a Python hello world"}],
    api_base="http://localhost:4000/v1",
    api_key="your-proxy-api-key",
)
print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Send a chat request"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "claude-copilot",
    "messages": [{"role": "user", "content": "Write a Python hello world"}]
  }'
```

</TabItem>
</Tabs>

## Supported endpoints and models

Use the `github_copilot/` prefix when configuring a provider model. Use the model's `model_name` in proxy requests.

| Endpoint | Example provider model |
|-------|-------|
| `/v1/chat/completions` | `github_copilot/claude-sonnet-5.5` |
| `/v1/messages` | `github_copilot/claude-sonnet-5.5` |
| `/v1/responses` | `github_copilot/gpt-5.3-codex` or `github_copilot/gpt-5.5` |
| `/v1/embeddings` | `github_copilot/text-embedding-3-small` |

These examples match LiteLLM's model catalog. GitHub controls model access for each account.

### Use other endpoints through the proxy

The `claude-copilot` model above also supports Anthropic Messages:

```bash showLineNumbers title="Send an Anthropic Messages request"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-copilot",
    "max_tokens": 500,
    "messages": [{"role": "user", "content": "Write a Python hello world"}]
  }'
```

For Responses or Embeddings, add a model for that endpoint and use the same credential:

```yaml showLineNumbers keep-model-ids title="Add to model_list in config.yaml"
  - model_name: copilot-responses
    litellm_params:
      model: github_copilot/gpt-5.3-codex
      litellm_credential_name: copilot-per-user
  - model_name: copilot-embeddings
    litellm_params:
      model: github_copilot/text-embedding-3-small
      litellm_credential_name: copilot-per-user
```

For example, send a Responses request with `copilot-responses`:

```bash showLineNumbers title="Send a Responses request"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "copilot-responses",
    "input": "Write a Python hello world"
  }'
```

## Shared device login

Shared device login uses one GitHub account for all requests. Use it for a shared proxy credential or direct Python SDK calls.

### 1. Sign in from a terminal

Run this command in a terminal and complete the GitHub sign-in prompt:

```bash showLineNumbers title="Sign in to GitHub Copilot"
python -c "from litellm.llms.github_copilot.authenticator import Authenticator; Authenticator().get_access_token()"
```

LiteLLM saves the GitHub access token to `~/.config/litellm/github_copilot/access-token` by default.

For a proxy, make the token file available at the configured path. LiteLLM also writes its Copilot API token to `api-key.json` in the same directory, so the directory must be writable. In Kubernetes, copy the token from a Secret into a writable volume.

Entering a GitHub token in the credential's **API Key** field does not replace this file-based sign-in.

### 2. Configure and start the proxy

Skip this step for direct SDK calls.

```yaml showLineNumbers keep-model-ids title="config.yaml"
model_list:
  - model_name: claude-copilot
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
  - model_name: copilot-responses
    litellm_params:
      model: github_copilot/gpt-5.3-codex
  - model_name: copilot-embeddings
    litellm_params:
      model: github_copilot/text-embedding-3-small
```

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml
```

Send a request with the [proxy examples above](#3-user-send-a-request).

## Usage with the LiteLLM Python SDK

Complete [shared device login](#shared-device-login) first, or provide an existing access-token file. Direct SDK calls use the provider model name, including the `github_copilot/` prefix.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```python showLineNumbers keep-model-ids title="Chat Completions"
from litellm import completion

response = completion(
    model="github_copilot/claude-sonnet-5.5",
    messages=[{"role": "user", "content": "Write a Python hello world"}],
)
print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="streaming" label="Streaming">

```python showLineNumbers keep-model-ids title="Stream a chat response"
from litellm import completion

stream = completion(
    model="github_copilot/claude-sonnet-5.5",
    messages=[{"role": "user", "content": "Write a Python hello world"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>
<TabItem value="responses" label="Responses">

```python showLineNumbers keep-model-ids title="Responses"
import asyncio

import litellm


async def main():
    response = await litellm.aresponses(
        model="github_copilot/gpt-5.3-codex",
        input="Write a Python hello world",
        max_output_tokens=500,
    )
    print(response)


asyncio.run(main())
```

</TabItem>
<TabItem value="messages" label="Anthropic Messages">

```python showLineNumbers keep-model-ids title="Anthropic Messages"
import asyncio

import litellm


async def main():
    response = await litellm.anthropic.messages.acreate(
        model="github_copilot/claude-sonnet-5.5",
        messages=[{"role": "user", "content": "Write a Python hello world"}],
        max_tokens=500,
    )
    print(response)


asyncio.run(main())
```

</TabItem>
<TabItem value="embeddings" label="Embeddings">

```python showLineNumbers title="Embeddings"
import litellm

response = litellm.embedding(
    model="github_copilot/text-embedding-3-small",
    input=["good morning from LiteLLM"],
)
print(response)
```

</TabItem>
</Tabs>

## Environment variables

These settings apply to shared device login unless the table says otherwise. Use an absolute path for `GITHUB_COPILOT_TOKEN_DIR`.

| Variable | Default | Purpose |
|-------|-------|-------|
| `GITHUB_COPILOT_TOKEN_DIR` | `~/.config/litellm/github_copilot` | Directory for the shared access token and Copilot API token cache |
| `GITHUB_COPILOT_ACCESS_TOKEN_FILE` | `access-token` | Access-token file name in the token directory |
| `GITHUB_COPILOT_API_KEY_FILE` | `api-key.json` | Copilot API token cache file name in the token directory |
| `GITHUB_COPILOT_CLIENT_ID` | `Iv1.b507a08c87ecfe98` | OAuth client ID for shared and per-user sign-in |
| `GITHUB_COPILOT_DEVICE_CODE_URL` | `https://github.com/login/device/code` | Device-code endpoint for shared and per-user sign-in |
| `GITHUB_COPILOT_ACCESS_TOKEN_URL` | `https://github.com/login/oauth/access_token` | Access-token endpoint for shared and per-user sign-in |
| `GITHUB_COPILOT_API_KEY_URL` | `https://api.github.com/copilot_internal/v2/token` | Endpoint that exchanges the shared GitHub token for a Copilot API token |
| `GITHUB_COPILOT_API_BASE` | `https://api.githubcopilot.com` | Fallback API base for shared Chat Completions, Responses, and Embeddings |

## Authentication details

<details>
<summary>Token storage and caching</summary>

For per-user OAuth, LiteLLM encrypts each user's GitHub access token and stores it in the database. It does not store a refresh token. Disconnecting removes the stored connection.

With Redis, LiteLLM caches the encrypted credential or a record of no connection for 60 seconds. Without Redis, requests read the database.

Each worker caches the short-lived Copilot token in memory until 60 seconds before its expiry. If GitHub returns 401, 403, or 404 during token exchange, LiteLLM clears the cached session and asks the user to reconnect.

Shared device login reads the GitHub access token from disk and exchanges it for a Copilot API token.

</details>

<details>
<summary>API base URL</summary>

For per-user OAuth, LiteLLM uses the API host from GitHub's token response if it uses HTTPS and the host is `githubcopilot.com` or a subdomain. Otherwise, it uses `https://api.githubcopilot.com`. The per-user flow does not use `GITHUB_COPILOT_API_BASE`.

For shared Chat Completions, Responses, and Embeddings, LiteLLM checks these values in order: the credential or deployment's `api_base`, `endpoints.api` in the token response, `GITHUB_COPILOT_API_BASE`, then `https://api.githubcopilot.com`.

Anthropic Messages uses the authenticated Copilot endpoint. It ignores a caller-supplied `api_base` and `GITHUB_COPILOT_API_BASE`.

</details>

<details>
<summary>Request headers</summary>

LiteLLM adds these headers for Chat Completions, Responses, and Embeddings:

| Header | Default |
|-------|-------|
| `Authorization` | Bearer token from the authenticated Copilot session |
| `content-type` | `application/json` |
| `copilot-integration-id` | `vscode-chat` |
| `editor-version` | `vscode/1.95.0` |
| `editor-plugin-version` | `copilot-chat/0.26.7` |
| `user-agent` | `GitHubCopilotChat/0.26.7` |
| `openai-intent` | `conversation-panel` |
| `x-github-api-version` | `2025-04-01` |
| `x-request-id` | A new UUID for each request |
| `x-vscode-user-agent-library-version` | `electron-fetch` |

You can pass `extra_headers` to merge headers with these defaults. Per-user OAuth always uses the connected user's Copilot token for `Authorization`.

Chat Completions and Responses set `X-Initiator` to `user` or `agent` based on message roles. They also add a vision-request header with value `true` when the request includes images.

Anthropic Messages sets `openai-intent: messages-proxy`, `x-interaction-type: messages-proxy`, and `x-github-api-version: 2026-06-01`. It sets `anthropic-version: 2023-06-01` if the request does not provide one.

</details>
