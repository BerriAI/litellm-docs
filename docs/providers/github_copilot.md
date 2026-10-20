import Image from '@theme/IdealImage';
import ThemedVideo from '@site/src/components/ThemedVideo';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GitHub Copilot

Use [GitHub Copilot](https://docs.github.com/en/copilot) models through the LiteLLM gateway or the Python SDK. LiteLLM supports Chat Completions, Responses, Embeddings, and Anthropic Messages

On the gateway, each person connects their own GitHub account and their requests use their own Copilot plan. Your GitHub Copilot plan determines which models you can use, and each model supports specific endpoints. See [supported endpoints and models](#supported-endpoints-and-models)

## Set up the gateway

An admin adds the model and a **Per-user GitHub OAuth** credential once. Each user then connects their GitHub account from the dashboard before sending requests.

### 1. Admin: create the credential

Open **Models + Endpoints** > **LLM Credentials** in the LiteLLM dashboard and click **Add Credential**. Select **GitHub Copilot** as the provider and enter `github-copilot` as the **Credential Name**. **Auth Type** is set to **Per-user GitHub OAuth**, which is the only auth type the gateway supports for GitHub Copilot. Click **Add Credential**

<div className="docs-screenshot">
  <Image img={require('../../img/github_copilot_credential.png')} dark={require('../../img/github_copilot_credential_dark.png')} alt="Create a per-user GitHub OAuth credential in LiteLLM" width={656} height={585} />
</div>

### 2. Admin: add the model

Open **Add Model**, select **GitHub Copilot** as the provider, and pick a model under **LiteLLM Model Name(s)**, for example `github_copilot/claude-sonnet-5.5`. Under **Model Mappings**, set **Public Model Name** to the name users will request, such as `claude-copilot`. Under **Existing Credentials**, select `github-copilot`, then click **Add Model**

<div className="docs-screenshot">
  <Image img={require('../../img/github_copilot_add_model.png')} dark={require('../../img/github_copilot_add_model_dark.png')} alt="Add a GitHub Copilot model with the saved credential in LiteLLM" width={1096} height={935} />
</div>

:::note

Claude Code and Claude Desktop only accept model names that start with `claude-` or `anth-`, so give models used from those apps a public name like `claude-copilot`. Other apps can use any name.

:::

<details>
<summary>Use config.yaml to add the model</summary>

If you manage models in `config.yaml`, create the credential in the dashboard and reference it from the model:

```yaml showLineNumbers keep-model-ids title="config.yaml"
model_list:
  - model_name: claude-copilot
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
      litellm_credential_name: github-copilot
```

</details>

### 3. User: connect your GitHub account

Sign in to the LiteLLM dashboard and open **Models + Endpoints** > **LLM Credentials**. Under **Your connections**, find `github-copilot` and click **Connect**

<div className="docs-screenshot">
  <Image img={require('../../img/github_copilot_llm_credentials.png')} dark={require('../../img/github_copilot_llm_credentials_dark.png')} alt="Connect a GitHub account from Your connections in LiteLLM" width={1096} height={418} />
</div>

LiteLLM shows a GitHub verification code. Open https://github.com/login/device, enter the code, and approve the request with the GitHub account that has your Copilot plan

<div className="docs-screenshot">
  <Image img={require('../../img/github_copilot_connect.png')} dark={require('../../img/github_copilot_connect_dark.png')} alt="GitHub verification code and sign-in link in LiteLLM" width={504} height={338} />
</div>

When GitHub approves the request, the status changes to **Connected** with your GitHub username. Every request you send to a model on this credential now uses your own Copilot access. If you have not connected, or GitHub later rejects your saved connection, requests return a 401 that asks you to connect again from this page

This recording runs through steps 1 to 3 in the dashboard, from creating the credential to the GitHub verification code.

<ThemedVideo
  src={require('../../img/github_copilot_setup_flow.mp4')}
  dark={require('../../img/github_copilot_setup_flow_dark.mp4')}
  poster={require('../../img/github_copilot_setup_flow_poster.png')}
  darkPoster={require('../../img/github_copilot_setup_flow_poster_dark.png')}
  title="Walkthrough: create the GitHub Copilot credential, add the model, connect a GitHub account"
/>

### 4. User: send requests

Point your app at the gateway and sign in the way your organization has set it up. Requests must come from the same LiteLLM user who connected GitHub. For Claude Code, set `ANTHROPIC_BASE_URL` to the gateway URL and `ANTHROPIC_MODEL` to `claude-copilot`. For apps that use the OpenAI API, set the base URL to `https://litellm.example.com/v1`, using your gateway's address, and the model to `claude-copilot`

```python showLineNumbers title="Send a chat request"
from openai import OpenAI

client = OpenAI(
    base_url="https://litellm.example.com/v1",
    api_key="<your LiteLLM sign-in token>",
)

response = client.chat.completions.create(
    model="claude-copilot",
    messages=[{"role": "user", "content": "Write a Python hello world"}],
)
print(response.choices[0].message.content)
```

## Supported endpoints and models

Use the `github_copilot/` prefix when configuring a model. Requests to the gateway use the public model name

| Endpoint | Example model |
|-------|-------|
| `/v1/chat/completions` | `github_copilot/claude-sonnet-5.5` |
| `/v1/messages` | `github_copilot/claude-sonnet-5.5` |
| `/v1/responses` | `github_copilot/gpt-5.3-codex` or `github_copilot/gpt-5.5` |
| `/v1/embeddings` | `github_copilot/text-embedding-3-small` |

These examples match LiteLLM's model catalog. GitHub controls which models each account can use, so a model outside your plan returns an error from GitHub even when the gateway has it configured

To serve Responses or Embeddings, add a model for that endpoint with the same `github-copilot` credential, such as `github_copilot/gpt-5.3-codex` or `github_copilot/text-embedding-3-small`

## Usage with the LiteLLM Python SDK

Direct SDK calls run in your own process, outside the gateway, and sign in with one GitHub account. The first call starts GitHub's device flow in your terminal. LiteLLM saves the GitHub access token to `~/.config/litellm/github_copilot/access-token` and reuses it on later calls. The gateway never uses this sign-in. Direct SDK calls use the full model name, including the `github_copilot/` prefix

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

The token-file settings apply only to direct Python SDK calls. Use an absolute path for `GITHUB_COPILOT_TOKEN_DIR`.

| Variable | Default | Purpose |
|-------|-------|-------|
| `GITHUB_COPILOT_TOKEN_DIR` | `~/.config/litellm/github_copilot` | SDK only. Directory for the GitHub access token |
| `GITHUB_COPILOT_ACCESS_TOKEN_FILE` | `access-token` | SDK only. Access-token file name in the token directory |
| `GITHUB_COPILOT_CLIENT_ID` | `Iv1.b507a08c87ecfe98` | OAuth client ID for gateway and SDK sign-in |
| `GITHUB_COPILOT_DEVICE_CODE_URL` | `https://github.com/login/device/code` | Device-code endpoint for gateway and SDK sign-in |
| `GITHUB_COPILOT_ACCESS_TOKEN_URL` | `https://github.com/login/oauth/access_token` | Access-token endpoint for gateway and SDK sign-in |
| `GITHUB_COPILOT_API_BASE` | Your plan's Copilot host | Copilot API base for the gateway and the SDK. A model's `api_base` takes precedence |
| `GITHUB_COPILOT_INTEGRATION_ID` | `vscode-chat` | `copilot-integration-id` header |
| `GITHUB_COPILOT_EDITOR_VERSION` | `vscode/1.115.0` | `editor-version` header |
| `GITHUB_COPILOT_EDITOR_PLUGIN_VERSION` | `copilot-chat/0.26.7` | `editor-plugin-version` header |
| `GITHUB_COPILOT_USER_AGENT` | `GitHubCopilotChat/0.26.7` | `user-agent` header |
| `GITHUB_COPILOT_ACCEPT` | `application/json` | `accept` header |
| `GITHUB_COPILOT_CONTENT_TYPE` | `application/json` | `content-type` header |
| `GITHUB_COPILOT_API_VERSION` | `2025-04-01` | `x-github-api-version` header on model requests |
| `GITHUB_COPILOT_OPENAI_INTENT` | `conversation-panel` | `openai-intent` header on model requests |
| `GITHUB_COPILOT_USER_AGENT_LIBRARY_VERSION` | `electron-fetch` | `x-vscode-user-agent-library-version` header on model requests |

Set a header variable to an empty string to omit that header. Sign-in requests use the accept, content type, integration, editor, plugin, and user-agent values. On the gateway, put these variables in the `environment_variables` block of `config.yaml`.

`GITHUB_COPILOT_API_KEY_URL` and `GITHUB_COPILOT_API_KEY_FILE` were removed. LiteLLM no longer exchanges the GitHub token for a Copilot API token, so GitHub Enterprise users set `GITHUB_COPILOT_API_BASE` to their Copilot API host, along with the device-code and access-token URLs. If `GITHUB_COPILOT_API_KEY_URL` still points to a host other than `api.github.com` and `GITHUB_COPILOT_API_BASE` is not set, LiteLLM logs a warning, because requests then go to `https://api.githubcopilot.com`.

```bash showLineNumbers title="GitHub Enterprise"
export GITHUB_COPILOT_API_BASE="https://copilot-api.company.ghe.com"
export GITHUB_COPILOT_DEVICE_CODE_URL="https://company.ghe.com/login/device/code"
export GITHUB_COPILOT_ACCESS_TOKEN_URL="https://company.ghe.com/login/oauth/access_token"
```

Per-user **Connect** on the gateway reads the GitHub username from `https://api.github.com`, so it works only with github.com accounts. Accounts on GitHub Enterprise Cloud with data residency (`ghe.com`) can sign in through the [Python SDK](#usage-with-the-litellm-python-sdk) instead.

### Use your own OAuth app

Any GitHub OAuth app can sign users in, and it can send its own client identity. For example, these values match OpenCode's OAuth behavior.

```yaml showLineNumbers title="config.yaml"
environment_variables:
  GITHUB_COPILOT_CLIENT_ID: "Ov23li8tweQw6odWQebz"
  GITHUB_COPILOT_USER_AGENT: "opencode/<installed-version>"
  GITHUB_COPILOT_INTEGRATION_ID: ""
  GITHUB_COPILOT_EDITOR_VERSION: ""
  GITHUB_COPILOT_EDITOR_PLUGIN_VERSION: ""
  GITHUB_COPILOT_API_VERSION: "2026-06-01"
  GITHUB_COPILOT_OPENAI_INTENT: "conversation-edits"
```

## Authentication details

<details>
<summary>Token storage and caching</summary>

On the gateway, LiteLLM encrypts each user's GitHub access token and stores it in the database. It does not store a refresh token. Disconnecting removes the stored connection.

With Redis, LiteLLM caches the encrypted credential or a record of no connection for 60 seconds. Without Redis, requests read the database.

LiteLLM sends the GitHub access token to the Copilot API directly. If a user revokes the token on GitHub, their requests fail with a 401 that asks them to reconnect from the dashboard.

Direct SDK calls read the GitHub access token from disk. Existing `access-token` files keep working without a new sign-in, and `api-key.json` is no longer read or written.

</details>

<details>
<summary>API base URL</summary>

LiteLLM sends requests to the model's `api_base`, then `GITHUB_COPILOT_API_BASE`, then the Copilot API host that GitHub reports for your plan, then `https://api.githubcopilot.com`. This order is the same for Chat Completions, Responses, Embeddings, and Anthropic Messages.

The base must be an `https` URL with no credentials, query, or fragment. An `http` base works only for a loopback host such as `localhost`, for local testing. LiteLLM returns an error for an invalid base and does not fall back to another one.

On the gateway, LiteLLM ignores an `api_base` or `base_url` sent in a request to a GitHub Copilot model, so requests go only to the base that the admin configured.

When no base is configured, LiteLLM asks `https://api.github.com/copilot_internal/user` which Copilot API host serves the GitHub token, such as `https://api.business.githubcopilot.com` for Copilot Business, and caches the answer for an hour. LiteLLM uses the answer only when it is an `https` host under `githubcopilot.com`. If the lookup fails, requests go to `https://api.githubcopilot.com` and LiteLLM asks again after a minute.

</details>

<details>
<summary>Request headers</summary>

LiteLLM adds these headers for Chat Completions, Responses, and Embeddings:

| Header | Default |
|-------|-------|
| `Authorization` | Bearer GitHub access token |
| `accept` | `application/json` |
| `content-type` | `application/json` |
| `copilot-integration-id` | `vscode-chat` |
| `editor-version` | `vscode/1.115.0` |
| `editor-plugin-version` | `copilot-chat/0.26.7` |
| `user-agent` | `GitHubCopilotChat/0.26.7` |
| `openai-intent` | `conversation-panel` |
| `x-github-api-version` | `2025-04-01` |
| `x-request-id` | A new UUID for each request |
| `x-vscode-user-agent-library-version` | `electron-fetch` |

The [environment variables](#environment-variables) change these defaults. You can pass `extra_headers` to merge headers with them for one request. On the gateway, `Authorization` always uses the connected user's GitHub token.

Chat Completions and Responses set `X-Initiator` to `user` or `agent` based on message roles. They also add a vision-request header with value `true` when the request includes images.

Anthropic Messages sets `openai-intent: messages-proxy`, `x-interaction-type: messages-proxy`, and `x-github-api-version: 2026-06-01`. It sets `anthropic-version: 2023-06-01` if the request does not provide one.

</details>
