import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GitHub Copilot

[GitHub Copilot](https://docs.github.com/en/copilot)

| Property | Details |
|-------|-------|
| Description | LiteLLM maps requests to GitHub Copilot's chat, Responses, embedding, and Anthropic Messages APIs |
| Provider route | `github_copilot/` |
| Supported endpoints | `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, `/v1/messages` |
| API reference | [GitHub Copilot documentation](https://docs.github.com/en/copilot) |

Model access depends on the GitHub Copilot plan of the account used for the request. LiteLLM's model catalog lists model names and supported endpoints, while GitHub controls which models each account can use

## Supported endpoints and models

The model catalog currently lists these model and endpoint combinations:

| Endpoint | Example model |
|-------|-------|
| `/v1/chat/completions` | `github_copilot/claude-sonnet-5.5` |
| `/v1/messages` | `github_copilot/claude-sonnet-5.5` |
| `/v1/responses` | `github_copilot/gpt-5.3-codex` or `github_copilot/gpt-5.5` |
| `/v1/embeddings` | `github_copilot/text-embedding-3-small` |

Endpoint support is model-specific. For example, the catalog lists `gpt-5.3-codex` and `gpt-5.5` for Responses, while `claude-sonnet-5.5` is listed for Chat Completions and Anthropic Messages

## Authentication for LiteLLM Proxy

### Per-user GitHub OAuth

For a proxy used by multiple people, per-user OAuth lets each LiteLLM user connect their own GitHub account. In the dashboard, create a GitHub Copilot model and credential, then set **Auth Type** to **Per-user GitHub OAuth**

Add a model deployment that references the saved credential:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-copilot
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
      litellm_credential_name: copilot-per-user
```

Each user opens **LLM Credentials**, finds the credential under **Your connections**, and clicks **Connect**. The dashboard starts GitHub's device flow, shows a verification URL and code, and polls until the user approves the connection. The flow uses LiteLLM's HTTP endpoints and does not require GitHub CLI

Requests use the connection stored for the LiteLLM user making the request. The GitHub access token is encrypted before it is stored in LiteLLM's database, and LiteLLM does not persist a refresh token. When Redis is configured, it caches the encrypted credential or a not-connected marker for 60 seconds. Without Redis, the request path reads the database

The exchanged short-lived Copilot token is cached in memory by each worker process until `expires_at` minus a 60-second safety margin. Disconnecting removes the stored connection. If GitHub rejects the token exchange with status 401, 403, or 404, LiteLLM clears the cached session and returns an error asking the user to reconnect

Per-user requests use the API host returned by GitHub only when it is an HTTPS `githubcopilot.com` host or subdomain; otherwise LiteLLM uses `https://api.githubcopilot.com`. Give the deployment a public model alias such as `claude-copilot`

### Shared device login

Shared device login uses one GitHub account and token file for every caller of a model on that credential. This option is available for a single shared proxy credential and for direct LiteLLM Python SDK calls

When no access-token file is present, the shared `Authenticator` can start an interactive device flow only on the main thread when no event loop is running. Run this command from a terminal and complete the prompt before using asynchronous SDK code or a proxy:

```bash showLineNumbers title="Sign in for shared device login"
python -c "from litellm.llms.github_copilot.authenticator import Authenticator; Authenticator().get_access_token()"
```

The GitHub access token is saved as `~/.config/litellm/github_copilot/access-token` by default. For a shared proxy, make that file available at the configured token path before sending requests. The token directory must be writable because LiteLLM stores the exchanged Copilot API token in `api-key.json` alongside the access token. In Kubernetes, copy the file from a Secret into a writable volume

The shared provider code reads the GitHub access token from this file and exchanges it for a Copilot API token. Supplying a GitHub token in the shared credential's **API Key** field does not replace the file-based login. A credential or deployment `api_base` can set the API endpoint for Chat Completions, Responses, and Embeddings. For those endpoints, LiteLLM resolves the base from the configured `api_base`, the shared token response's `endpoints.api`, `GITHUB_COPILOT_API_BASE`, and then the default, in that order. The Anthropic Messages path uses the authenticated Copilot endpoint and ignores a caller-supplied `api_base`

## Usage with the LiteLLM Python SDK

Direct SDK examples use shared device login. For async examples, complete the terminal sign-in above first or provide an existing shared access-token file

### Chat Completions

```python showLineNumbers title="GitHub Copilot Chat Completion"
from litellm import completion

response = completion(
    model="github_copilot/claude-sonnet-5.5",
    messages=[
        {"role": "system", "content": "You are a helpful coding assistant"},
        {"role": "user", "content": "Write a Python function to calculate Fibonacci numbers"},
    ],
)
print(response)
```

```python showLineNumbers title="GitHub Copilot Chat Completion, streaming"
from litellm import completion

stream = completion(
    model="github_copilot/claude-sonnet-5.5",
    messages=[{"role": "user", "content": "Explain async and await in Python"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### Responses

```python showLineNumbers title="GitHub Copilot Responses"
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

### Anthropic Messages

Claude models can also be called through GitHub Copilot's Anthropic Messages endpoint

```python showLineNumbers title="GitHub Copilot Anthropic Messages"
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

### Embeddings

```python showLineNumbers title="GitHub Copilot Embedding"
import litellm

response = litellm.embedding(
    model="github_copilot/text-embedding-3-small",
    input=["good morning from LiteLLM"],
)
print(response)
```

## Usage through LiteLLM Proxy

The following shared-auth configuration exposes the models listed above:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: copilot-chat
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
  - model_name: copilot-responses
    litellm_params:
      model: github_copilot/gpt-5.3-codex
  - model_name: copilot-embeddings
    litellm_params:
      model: github_copilot/text-embedding-3-small
```

Start the proxy with the configuration:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml
```

Use the deployment alias with an OpenAI-compatible client. Replace the model with `claude-copilot` when using the per-user deployment shown above

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="GitHub Copilot through the Proxy"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key="your-proxy-api-key",
)

response = client.chat.completions.create(
    model="copilot-chat",
    messages=[{"role": "user", "content": "How do I optimize this SQL query?"}],
)
print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="GitHub Copilot through the Proxy with LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/copilot-chat",
    messages=[{"role": "user", "content": "Review this code for bugs"}],
    api_base="http://localhost:4000/v1",
    api_key="your-proxy-api-key",
)
print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="GitHub Copilot through the Proxy with cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "copilot-chat",
    "messages": [{"role": "user", "content": "Explain this error message"}]
  }'
```

</TabItem>
</Tabs>

Use the Responses and Anthropic Messages endpoints with the corresponding proxy model alias:

```bash showLineNumbers title="GitHub Copilot Responses and Messages through the Proxy"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "copilot-responses",
    "input": "Write a Python hello world"
  }'

curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "copilot-chat",
    "max_tokens": 500,
    "messages": [{"role": "user", "content": "Write a Python hello world"}]
  }'
```

## Environment variables

These variables configure shared device login unless noted. Set an absolute path when overriding the token directory

| Variable | Default | Purpose |
|-------|-------|-------|
| `GITHUB_COPILOT_TOKEN_DIR` | `~/.config/litellm/github_copilot` | Directory for the shared access token and Copilot API token cache |
| `GITHUB_COPILOT_ACCESS_TOKEN_FILE` | `access-token` | GitHub access-token file name under the token directory |
| `GITHUB_COPILOT_API_KEY_FILE` | `api-key.json` | Copilot API-token cache file name under the token directory |
| `GITHUB_COPILOT_CLIENT_ID` | `Iv1.b507a08c87ecfe98` | OAuth device-flow client ID; read by shared and per-user flows |
| `GITHUB_COPILOT_DEVICE_CODE_URL` | `https://github.com/login/device/code` | Device-code endpoint; read by shared and per-user flows |
| `GITHUB_COPILOT_ACCESS_TOKEN_URL` | `https://github.com/login/oauth/access_token` | Device-flow token endpoint; read by shared and per-user flows |
| `GITHUB_COPILOT_API_KEY_URL` | `https://api.github.com/copilot_internal/v2/token` | Shared-flow endpoint that exchanges the GitHub token for a Copilot API token |
| `GITHUB_COPILOT_API_BASE` | `https://api.githubcopilot.com` | Fallback API base for shared Chat Completions, Responses, and Embeddings; not used by per-user auth or the Anthropic Messages path |

The per-user flow uses the client ID and device-flow URL variables above. Its Copilot API host comes from the token-exchange response after LiteLLM validates it, rather than from `GITHUB_COPILOT_API_BASE`

## Headers

LiteLLM adds provider headers automatically. Chat Completions, Responses, and Embeddings use these common defaults:

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
| `x-request-id` | A UUID generated for each request |
| `x-vscode-user-agent-library-version` | `electron-fetch` |

Chat Completions, Responses, and Embeddings merge caller-supplied `extra_headers` with these defaults. Per-user authentication pins `Authorization` to the connected user's Copilot token. Chat and Responses derive `X-Initiator` as `user` or `agent` from the request roles, and add a vision-request header with value `true` when image content is present

The Anthropic Messages route sets `openai-intent: messages-proxy`, `x-interaction-type: messages-proxy`, and `x-github-api-version: 2026-06-01`. It also sets `anthropic-version: 2023-06-01` when the request does not provide one
