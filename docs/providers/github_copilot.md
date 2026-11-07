import Image from '@theme/IdealImage';
import ThemedVideo from '@site/src/components/ThemedVideo';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GitHub Copilot

Use [GitHub Copilot](https://docs.github.com/en/copilot) models via the LiteLLM gateway or the Python SDK. LiteLLM supports Chat Completions, Responses, Embeddings and Anthropic Messages.

On the gateway each user connects their own GitHub account and their requests will use their own Copilot plan. Your GitHub Copilot plan determines which models you can use and each model supports a specific set of endpoints. See [supported endpoints and models](#supported-endpoints-and-models)

:::tip

LiteLLM can also make use of Claude and ChatGPT (Codex) subscriptions. For a comparison of the three subscriptions see [Claude, Codex and Copilot subscriptions](/docs/subscriptions).

:::

## Set up the gateway

An admin adds the model and a **Per-user GitHub OAuth** credential once. Each user then connects their GitHub account from the dashboard prior to making requests.

### 1. Admin: create the credential

Open **Models + Endpoints** > **LLM Credentials** in the LiteLLM dashboard and click **Add Credential**. Select **GitHub Copilot** as the provider and enter `github-copilot` as the **Credential Name**. **Auth Type** is set to **Per-user GitHub OAuth** (this is the only auth type that the gateway supports for GitHub Copilot). Click **Add Credential**.

Leave **GitHub host** blank if your users are signing in on github.com. If you're using GitHub Enterprise Cloud with data residency then enter your `SUBDOMAIN.ghe.com` host (e.g. `octocorp.ghe.com`). LiteLLM will then send the sign in to `https://SUBDOMAIN.ghe.com`, the user lookup to `https://api.SUBDOMAIN.ghe.com` and the model requests only to `https://copilot-api.SUBDOMAIN.ghe.com`. Each credential has its own host so one gateway can serve a github.com credential and a GHE.com credential side by side. GitHub Enterprise Server hosts are not accepted as Copilot isn't available on GitHub Enterprise Server. Changing the host of a credential will drop all the user connections on it and the users will have to reconnect on the new host.

<div className="docs-screenshot">
  <Image img={require('../../img/github_copilot_credential.png')} dark={require('../../img/github_copilot_credential_dark.png')} alt="Create a per-user GitHub OAuth credential in LiteLLM" width={656} height={585} />
</div>

### 2. Admin: add the model

Open **Add Model**, select **GitHub Copilot** as the provider and pick a model from **LiteLLM Model Name(s)** (e.g. `github_copilot/claude-sonnet-5.5`). Under **Model Mappings** set **Public Model Name** to the name that the user will be requesting (e.g. `claude-copilot`). Under **Existing Credentials** select `github-copilot` then click **Add Model**.

<div className="docs-screenshot">
  <Image img={require('../../img/github_copilot_add_model.png')} dark={require('../../img/github_copilot_add_model_dark.png')} alt="Add a GitHub Copilot model with the saved credential in LiteLLM" width={1096} height={935} />
</div>

:::note

Claude Code and Claude Desktop will only accept model names that start with `claude-` or `anth-` so if you're using a model from those apps give it a public name that starts with `claude-copilot`. Other apps can use any name they like.

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

LiteLLM has a GitHub verification code. Open the link that it shows (https://github.com/login/device for github.com or https://SUBDOMAIN.ghe.com/login/device for a GHE.com credential), enter the code and then approve the request with the GitHub account that has your Copilot plan.

<div className="docs-screenshot">
  <Image img={require('../../img/github_copilot_connect.png')} dark={require('../../img/github_copilot_connect_dark.png')} alt="GitHub verification code and sign-in link in LiteLLM" width={504} height={338} />
</div>

When GitHub approves the request the status changes to **Connected** with your GitHub username. All requests you make to the model via this credential will now be using your own Copilot access. If you haven't connected yet or if GitHub later rejects your saved connection then the requests will return a 401 which will prompt you to connect again from this page.

This recording goes through steps 1 to 3 in the dashboard, from the creation of the credential right through to the GitHub verification code.

<ThemedVideo
  src={require('../../img/github_copilot_setup_flow.mp4')}
  dark={require('../../img/github_copilot_setup_flow_dark.mp4')}
  poster={require('../../img/github_copilot_setup_flow_poster.png')}
  darkPoster={require('../../img/github_copilot_setup_flow_poster_dark.png')}
  title="Walkthrough: create the GitHub Copilot credential, add the model, connect a GitHub account"
/>

### 4. User: send requests

Point your app at the gateway and sign in the way your organisation has configured it. The requests have to come from the same LiteLLM user that connected to GitHub. For Claude Code set `ANTHROPIC_BASE_URL` to the gateway URL and `ANTHROPIC_MODEL` to `claude-copilot`. For any app that's using the OpenAI API set the base URL to `https://litellm.example.com/v1` (i.e. the address of your gateway) and the model to `claude-copilot`.

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

These examples are from LiteLLM's model catalog. GitHub is what controls which models each account can use. A model that's outside of your plan will return an error from GitHub even if the gateway has it configured.

To serve up Responses or Embeddings, simply add a model for that endpoint using the same `github-copilot` credential (e.g. `github_copilot/gpt-5.3-codex` or `github_copilot/text-embedding-3-small`).

## Usage with the LiteLLM Python SDK

Direct SDK calls run in your own process (outside the gateway) and sign in with a single GitHub account. The first call will initiate GitHub's device flow in your terminal. LiteLLM will store the GitHub access token in `~/.config/litellm/github_copilot/access-token` and then reuse it on subsequent calls. On the gateway side, only a model that has no **Per-user GitHub OAuth** credential will use this shared sign in (the credential is read from the gateway host). Direct SDK calls use the full model name (including the `github_copilot/` prefix).

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

### Shared sign-in on GitHub Enterprise Cloud (GHE.com)

If your Copilot plan comes from a GitHub Enterprise Cloud tenant with data residency then point the shared sign-in at that tenant. Set both variables prior to the first call and leave them set afterwards as LiteLLM will read the tenant from `GITHUB_COPILOT_ACCESS_TOKEN_URL` on every call.

```bash
export GITHUB_COPILOT_DEVICE_CODE_URL="https://SUBDOMAIN.ghe.com/login/device/code"
export GITHUB_COPILOT_ACCESS_TOKEN_URL="https://SUBDOMAIN.ghe.com/login/oauth/access_token"
```

LiteLLM then logs in on `https://SUBDOMAIN.ghe.com`, looks up your Copilot API on `https://api.SUBDOMAIN.ghe.com/copilot_internal/user` and only sends the model requests to `https://copilot-api.SUBDOMAIN.ghe.com`. The older setup which would have set `GITHUB_COPILOT_API_KEY_URL` to `https://api.SUBDOMAIN.ghe.com/copilot_internal/v2/token` would have picked the same tenant, although LiteLLM no longer calls that URL.

To use this sign in on the gateway you need to sign in once outside of it with the variables above as the gateway itself can't run the device flow.

```bash
python -c "from litellm.llms.github_copilot.authenticator import Authenticator; Authenticator().get_access_token()"
```

Now start the gateway with the same two variables: `GITHUB_COPILOT_TOKEN_DIR` pointing at the directory that contains the saved `access-token` file and a model with no credential.

```yaml showLineNumbers keep-model-ids title="config.yaml"
model_list:
  - model_name: claude-copilot
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
```

A request for `claude-copilot` then returns the model's reply from `https://copilot-api.SUBDOMAIN.ghe.com`.

## Environment variables

The token-file settings and `GITHUB_COPILOT_API_BASE` are only applicable to the shared sign in (used by direct Python SDK calls and by gateway models which don't have a **Per-user GitHub OAuth** credential). Per-user credentials will ignore them. An absolute path must be used for `GITHUB_COPILOT_TOKEN_DIR`. On the gateway `GITHUB_COPILOT_DEVICE_CODE_URL` and `GITHUB_COPILOT_ACCESS_TOKEN_URL` are only applicable to credentials which don't have a **GitHub host** or which have a `github.com`. A credential with a GHE.com host will always use the URLs derived from that host.

LiteLLM just sends the GitHub OAuth token over to the Copilot API as a Bearer token. Set `GITHUB_COPILOT_CLIENT_ID` to the client ID of your own GitHub App where appropriate. You'll need to enable device flow for that app.

| Variable | Default | Purpose |
|-------|-------|-------|
| `GITHUB_COPILOT_TOKEN_DIR` | `~/.config/litellm/github_copilot` | Shared sign-in only. Directory for the GitHub access token |
| `GITHUB_COPILOT_ACCESS_TOKEN_FILE` | `access-token` | Shared sign-in only. Access-token file name in the token directory |
| `GITHUB_COPILOT_CLIENT_ID` | `Iv1.b507a08c87ecfe98` | OAuth client ID for gateway and SDK sign-in. Your own GitHub App must have device flow enabled. |
| `GITHUB_COPILOT_DEVICE_CODE_URL` | `https://github.com/login/device/code` | Device-code endpoint for gateway and SDK sign-in |
| `GITHUB_COPILOT_ACCESS_TOKEN_URL` | `https://github.com/login/oauth/access_token` | Access-token endpoint for gateway and SDK sign-in |
| `GITHUB_COPILOT_API_BASE` | `https://api.githubcopilot.com` | Shared sign-in only. Fallback API base for Chat Completions, Responses, and Embeddings |

## Authentication details

<details>
<summary>Token storage and caching</summary>

On the gateway LiteLLM encrypts each user's GitHub access token and stores it in the database. It doesn't store a refresh token at all. A disconnection just removes the stored connection.

With Redis LiteLLM will cache the encrypted credential (or a record of no connection) for 60 seconds. Without Redis the requests will read the DB.

Each worker will cache the user's GitHub token and their validated Copilot API base for 30 minutes. On connection LiteLLM will check access to the Copilot `/models` endpoint. If GitHub returns a 401, 403 or 404 then LiteLLM will clear the cached session and ask the user to reconnect.

The SDK is making direct calls which read the GitHub access token off disk and pass that as a bearer token to the Copilot API. LiteLLM doesn't in any way swap that out for a separate Copilot API token.

</details>

<details>
<summary>API base URL</summary>

For a **Per-user GitHub OAuth** credential LiteLLM will use `endpoints.api` from the GitHub Copilot user lookup if it's using HTTPS and the host is `githubcopilot.com` or a subdomain, or `copilot-api.SUBDOMAIN.ghe.com` in the case of a GHE.com credential. Otherwise it will use `https://api.githubcopilot.com` or `https://copilot-api.SUBDOMAIN.ghe.com` in the case of a GHE.com credential. Per-user credentials don't use `GITHUB_COPILOT_API_BASE`.

For shared sign-in Chat Completions, Responses and Embeddings, LiteLLM checks these values in order: the credential or deployment's `api_base`, `endpoints.api` from the Copilot user lookup on the sign-in's GitHub host (if that host matches), `GITHUB_COPILOT_API_BASE` and then `https://api.githubcopilot.com`.

Anthropic Messages uses the authenticated Copilot endpoint. It will ignore any `api_base` and `GITHUB_COPILOT_API_BASE` that the caller supplies.

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

You can pass `extra_headers` to merge headers with the defaults. On the gateway `Authorization` will always use the connected user's Copilot token.

Chat Completions and Responses set `X-Initiator` to `user` or `agent` depending on the message role. They also add a vision-request header with value `true` if the request contains images.

Anthropic Messages sets `openai-intent: messages-proxy`, `x-interaction-type: messages-proxy` and `x-github-api-version: 2026-06-01`. It sets `anthropic-version: 2023-06-01` if the request doesn't provide one.

</details>
