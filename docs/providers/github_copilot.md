import Image from '@theme/IdealImage';
import ThemedVideo from '@site/src/components/ThemedVideo';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GitHub Copilot

Use [GitHub Copilot](https://docs.github.com/en/copilot) models through the LiteLLM gateway or the Python SDK. LiteLLM supports Chat Completions, Responses, Embeddings, and Anthropic Messages

Choose per-user GitHub OAuth for individual Copilot plans, or [GitHub App authentication](#github-app-authentication) for backend services billed to an organization. Your GitHub Copilot plan determines which models you can use, and each model supports specific endpoints. See [supported endpoints and models](#supported-endpoints-and-models)

:::tip

LiteLLM can also use Claude and ChatGPT (Codex) subscriptions. To compare the three subscriptions, refer to [Claude, Codex, and Copilot subscriptions](/docs/subscriptions).

:::

## Set up the gateway

An admin adds the model and a **Per-user GitHub OAuth** credential once. Each user then connects their GitHub account from the dashboard before sending requests.

### 1. Admin: create the credential

Open **Models + Endpoints** > **LLM Credentials** in the LiteLLM dashboard and click **Add Credential**. Select **GitHub Copilot** as the provider and enter `github-copilot` as the **Credential Name**. Select **Per-user GitHub OAuth** under **Auth Type** for this dashboard flow. For service applications, select [GitHub App](#github-app-authentication) instead. Click **Add Credential**

Leave **GitHub host** empty if your users sign in on github.com. If your enterprise uses GitHub Enterprise Cloud with data residency, enter your `SUBDOMAIN.ghe.com` host, for example `octocorp.ghe.com`. LiteLLM then sends sign-in to `https://SUBDOMAIN.ghe.com`, the token exchange and user lookup to `https://api.SUBDOMAIN.ghe.com`, and model requests only to `https://copilot-api.SUBDOMAIN.ghe.com`. Each credential keeps its own host, so one gateway can serve a github.com credential and a GHE.com credential side by side. GitHub Enterprise Server hosts are rejected because GitHub does not offer Copilot on GitHub Enterprise Server. Changing the host of a credential removes every user connection on it, so users connect again on the new host.

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

LiteLLM shows a GitHub verification code. Open the link LiteLLM shows, which is https://github.com/login/device for github.com or https://SUBDOMAIN.ghe.com/login/device for a GHE.com credential, enter the code, and approve the request with the GitHub account that has your Copilot plan

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

## GitHub App authentication

Set `github_copilot_auth_type: github_app` to authenticate a backend service with a GitHub App installation. LiteLLM creates and refreshes installation tokens without a user login. This works with Chat Completions, Responses, Embeddings, and the async Anthropic Messages API, subject to each model's endpoint support.

Create an App with the **Copilot Requests** organization permission set to **Read-only**, and install it in the organization that will pay for usage. The organization must allow Copilot requests from App installations. See [GitHub's server-to-server setup](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/server-to-server-tokens#other-services-and-ci-systems) for eligibility and policy requirements.

### Dashboard setup

Open **Models + Endpoints** > **LLM Credentials** > **Add Credential**. Select **Github Copilot**, choose **GitHub App** under **Auth Type**, and enter a credential name, the App client ID, and installation ID. Leave **GitHub host** empty for github.com.

Under **Private key (PEM)**, click **Click to Upload** and choose the PEM downloaded from your GitHub App's **Credentials** > **Key pairs** settings. Click **Add Credential**. The information icon beside each field explains where its value comes from.

<div className="docs-screenshot">
  <Image img={require('../../img/github-copilot-app-after.jpg')} alt="Upload a GitHub App PEM in the existing LiteLLM credential form" width={1280} height={842} />
</div>

This uses the same file-upload and encrypted credential storage flow as Vertex AI service-account credentials. It requires a configured LiteLLM database, with no PEM mount or Enterprise secret-manager integration. Use HTTPS for the dashboard and credential API. The browser reads the selected file for submission, and LiteLLM encrypts the PEM before storing it. Credential readback is masked. The form shows a supplied-key status and does not show the saved PEM.

The existing proxy encryption key protects stored credentials. Keep `LITELLM_SALT_KEY` stable, high-entropy, shared across workers, and separate from the database and backups. LiteLLM falls back to its master key when no salt key is configured. Follow your deployment's credential-encryption and backup procedures. Encryption at rest does not protect against a compromised running proxy, which must use the private key to sign JWTs.

Open **Add Model**, select **Github Copilot**, and choose an available model. Set its public model name and select the saved App credential under **Existing Credentials**. Click **Add Model**. Applications call this alias with their LiteLLM virtual keys. No personal GitHub connection is required.

Create a separate named credential for each App, then attach each application's model deployment to the appropriate credential. To rotate a key, edit the credential and upload its replacement before revoking the old key in GitHub. Leaving the uploaded-key field unchanged preserves the saved key.

For a database credential created through the API, the form shows the GitHub Copilot name and logo. You can edit its settings without uploading another PEM. The saved key or secret reference stays in place. A PEM upload replaces any existing private-key secret reference. The dashboard only offers file upload, not a secret-reference field.

<div className="docs-screenshot">
  <Image img={require('../../img/github-copilot-app-edit.jpg')} alt="Edit a GitHub App credential while preserving its saved key and offering PEM upload for replacement" />
</div>

### Credential API

Administrators can use `POST /credentials` with `github_copilot_app_private_key` containing the PEM. The endpoint validates an unencrypted RSA private key of at least 2048 bits, up to 16 KiB, before saving it through LiteLLM's credential encryption. The private key is accepted in a named credential, not in inference request bodies.

```python title="Create an encrypted App credential"
import os
from pathlib import Path
import httpx

response = httpx.post(
    os.environ["LITELLM_URL"] + "/credentials",
    headers={"Authorization": "Bearer " + os.environ["LITELLM_MASTER_KEY"]},
    json={
        "credential_name": "copilot-service-a",
        "credential_values": {
            "github_copilot_auth_type": "github_app",
            "github_copilot_app_id": os.environ["COPILOT_SERVICE_A_CLIENT_ID"],
            "github_copilot_app_installation_id": os.environ["COPILOT_SERVICE_A_INSTALLATION_ID"],
            "github_copilot_app_private_key": Path(os.environ["COPILOT_PEM_FILE"]).read_text(),
        },
        "credential_info": {"custom_llm_provider": "github_copilot"},
    },
    timeout=30,
)
response.raise_for_status()
```

`COPILOT_PEM_FILE` is read by this administrator's script, not by the proxy. Attach `litellm_credential_name: copilot-service-a` to a deployment through `POST /model/new` or YAML. Use `PATCH /credentials/copilot-service-a` with a replacement `github_copilot_app_private_key` in `credential_values` and `credential_info: {}` to rotate it. Do not log the request body.

If the credential uses a private-key secret reference, also send `credential_values_to_delete: ["github_copilot_app_private_key_ref"]` in the PATCH body. The dashboard handles this replacement automatically.

### Server-managed configuration and SDK secrets

For deployments managed entirely through YAML or the SDK, secret references remain available. The dashboard uses PEM upload only. Store the App's RSA PEM private key in a secret manager or mount it read-only into the proxy container. The example uses a mounted secret at `/run/secrets/copilot-service-a.pem`. Only the proxy service account should be able to read it. Keep PEM contents out of YAML and inference requests. Store uploaded keys through the credential API so they are encrypted.

```yaml showLineNumbers keep-model-ids title="config.yaml"
credential_list:
  - credential_name: copilot-service-a
    credential_values:
      github_copilot_auth_type: github_app
      github_copilot_app_id: os.environ/COPILOT_SERVICE_A_CLIENT_ID
      github_copilot_app_installation_id: os.environ/COPILOT_SERVICE_A_INSTALLATION_ID
      github_copilot_app_private_key_ref: oidc/file//run/secrets/copilot-service-a.pem
    credential_info:
      custom_llm_provider: github_copilot
  - credential_name: copilot-service-b
    credential_values:
      github_copilot_auth_type: github_app
      github_copilot_app_id: os.environ/COPILOT_SERVICE_B_CLIENT_ID
      github_copilot_app_installation_id: os.environ/COPILOT_SERVICE_B_INSTALLATION_ID
      github_copilot_app_private_key_ref: oidc/file//run/secrets/copilot-service-b.pem
    credential_info:
      custom_llm_provider: github_copilot

model_list:
  - model_name: service-a-copilot
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
      litellm_credential_name: copilot-service-a
      rpm: 30
      tpm: 30000
  - model_name: service-b-copilot
    litellm_params:
      model: github_copilot/claude-sonnet-5.5
      litellm_credential_name: copilot-service-b
      rpm: 10
      tpm: 10000

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

`github_copilot_app_id` accepts the App's client ID, which GitHub recommends for JWTs, or the numeric App ID as a quoted string. Use the installation ID for the target organization, not an organization ID. Set these values in the environment before starting the proxy.

`github_copilot_app_private_key_ref` is a secret reference. It accepts `oidc/file/` paths within `LITELLM_OIDC_ALLOWED_CREDENTIAL_DIRS` (standard container secret directories, including `/run/secrets`, are allowed by default), `os.environ/VARIABLE_NAME`, or a secret name in your configured LiteLLM secret manager. The reference stays a reference until authentication runs. This reference field never accepts inline PEM. For this reference-based configuration, provision the secret on each worker and keep private keys out of client applications. Built-in external secret-manager integrations follow their existing Enterprise licensing.

Call the public alias with a LiteLLM virtual key. Restrict each application's key to its own model alias, and assign separate team or key budgets for usage tracking. The App IDs and private-key references belong in administrator-owned configuration. Request bodies cannot select or replace those values, and App deployments reject client API key and endpoint overrides.

Each deployment retains LiteLLM's rate-limit cooldown and monitoring behavior. Configure shared Redis when running multiple proxy workers so routing counters are shared. `rpm` and `tpm` above are example gateway limits, not GitHub quotas. Separate Apps isolate credentials, but do not guarantee separate organization-level Copilot quotas. GitHub attributes billing to the installation's organization. Use GitHub billing reports as the billing authority and LiteLLM usage records to attribute requests to your applications.

### Python SDK

Install the JWT signing dependencies alongside LiteLLM when using the SDK without proxy extras.

```bash
pip install litellm PyJWT cryptography
```

```python showLineNumbers keep-model-ids
import os
from litellm import completion

response = completion(
    model="github_copilot/claude-sonnet-5.5",
    messages=[{"role": "user", "content": "Reply with OK"}],
    github_copilot_auth_type="github_app",
    github_copilot_app_id=os.environ["COPILOT_SERVICE_A_CLIENT_ID"],
    github_copilot_app_installation_id=os.environ["COPILOT_SERVICE_A_INSTALLATION_ID"],
    github_copilot_app_private_key_ref="oidc/file//run/secrets/copilot-service-a.pem",
)
print(response.choices[0].message.content)
```

Pass the same authentication fields to `acompletion`, `responses`, `aresponses`, `embedding`, `aembedding`, or `anthropic.messages.acreate`. There are no process-wide App credential defaults, so a service can pass different App configurations concurrently.

### Token lifecycle and rotation

LiteLLM signs short-lived RS256 JWTs and requests only `organization_copilot_requests: read` when creating installation tokens. GitHub's token endpoint and Copilot endpoint come from the validated GitHub host. Authentication requests verify TLS and do not follow redirects. The provider pins the installation bearer token and the Copilot SDK integration ID on outbound model requests.

Each worker keeps a bounded in-memory token cache and coordinates concurrent refreshes within that worker. Tokens are refreshed on the next request when less than two minutes remain. Both wall-clock expiry and elapsed time are checked. Refresh failures return sanitized errors and never fall back to stored user credentials or expired tokens. Short failure cooldowns limit repeated mint attempts, and GitHub rate-limit responses produce retryable rate-limit errors.

The cache separates hosts, Apps, installations, secret references, and key contents. Updating a mounted key changes the cache identity on the next request. Secret-manager caching can delay visibility of a rotated value, so follow your backend's cache settings or restart workers. Roll out the replacement key before revoking the old key. To terminate existing installation tokens immediately, use GitHub's revocation controls and restart workers, rather than relying on deleting a private key alone.

Uploaded private keys are encrypted in the credential database and held in process memory when loaded. Secret references use their existing backend. Installation tokens are not written to LiteLLM's disk token store, database, or Redis by this authentication flow. Shared model-response caching is disabled for these requests. Keep production debug logging disabled and restrict access to process memory, mounted secrets, and any third-party logging callbacks you configure.

The default host is `github.com`. `github_copilot_host` also accepts the provider's existing `SUBDOMAIN.ghe.com` host format. GitHub Enterprise Server and arbitrary token or model URLs are rejected. Live validation for this feature used github.com. Confirm availability of App-authenticated Copilot in your data-residency deployment before rollout.

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

## Latest model aliases

<SinceVersion v="1.109.0" />

`github_copilot/<family>-latest` names follow a model family as LiteLLM moves them to newer models, so your application keeps one model string. Use them like any other GitHub Copilot model name. LiteLLM sends GitHub Copilot the current target model and bills at that model's price. See [Latest model aliases](../model_latest_aliases.md) for how aliases work and the full list across providers.

| Alias | Model family |
| --- | --- |
| `github_copilot/gpt-luna-latest` | GPT Luna |
| `github_copilot/gpt-sol-latest` | GPT Sol |
| `github_copilot/gpt-terra-latest` | GPT Terra |
| `github_copilot/gpt-astra-latest` | GPT Astra |
| `github_copilot/claude-opus-latest` | Claude Opus |
| `github_copilot/claude-sonnet-latest` | Claude Sonnet |
| `github_copilot/claude-haiku-latest` | Claude Haiku |
| `github_copilot/claude-fable-latest` | Claude Fable |
| `github_copilot/grok-latest` | Grok |
| `github_copilot/kimi-latest` | Kimi |

## Usage with the LiteLLM Python SDK

By default, direct SDK calls run in your own process and sign in with one GitHub account. For a backend service, use the GitHub App configuration below. The first call starts GitHub's device flow in your terminal. LiteLLM saves the GitHub access token to `~/.config/litellm/github_copilot/access-token` and reuses it on later calls. The gateway never uses this sign-in. Direct SDK calls use the full model name, including the `github_copilot/` prefix

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

The token-file settings and `GITHUB_COPILOT_API_BASE` apply only to direct Python SDK calls. The gateway ignores them. Use an absolute path for `GITHUB_COPILOT_TOKEN_DIR`. On the gateway, `GITHUB_COPILOT_DEVICE_CODE_URL`, `GITHUB_COPILOT_ACCESS_TOKEN_URL`, and `GITHUB_COPILOT_API_KEY_URL` apply only to credentials without a **GitHub host** or with `github.com`. A credential with a GHE.com host always uses the URLs derived from that host

| Variable | Default | Purpose |
|-------|-------|-------|
| `GITHUB_COPILOT_TOKEN_DIR` | `~/.config/litellm/github_copilot` | SDK only. Directory for the GitHub access token and Copilot API token cache |
| `GITHUB_COPILOT_ACCESS_TOKEN_FILE` | `access-token` | SDK only. Access-token file name in the token directory |
| `GITHUB_COPILOT_API_KEY_FILE` | `api-key.json` | SDK only. Copilot API token cache file name in the token directory |
| `GITHUB_COPILOT_CLIENT_ID` | `Iv1.b507a08c87ecfe98` | OAuth client ID for gateway and SDK sign-in |
| `GITHUB_COPILOT_DEVICE_CODE_URL` | `https://github.com/login/device/code` | Device-code endpoint for gateway and SDK sign-in |
| `GITHUB_COPILOT_ACCESS_TOKEN_URL` | `https://github.com/login/oauth/access_token` | Access-token endpoint for gateway and SDK sign-in |
| `GITHUB_COPILOT_API_KEY_URL` | `https://api.github.com/copilot_internal/v2/token` | Endpoint that exchanges a GitHub token for a Copilot API token |
| `GITHUB_COPILOT_API_BASE` | `https://api.githubcopilot.com` | SDK only. Fallback API base for Chat Completions, Responses, and Embeddings |

## Authentication details

<details>
<summary>Token storage and caching</summary>

On the gateway, LiteLLM encrypts each user's GitHub access token and stores it in the database. It does not store a refresh token. Disconnecting removes the stored connection.

With Redis, LiteLLM caches the encrypted credential or a record of no connection for 60 seconds. Without Redis, requests read the database.

Each worker caches the short-lived Copilot token in memory until 60 seconds before its expiry. If GitHub returns 401, 403, or 404 during token exchange, LiteLLM clears the cached session and asks the user to reconnect.

Direct SDK calls read the GitHub access token from disk and exchange it for a Copilot API token, cached in `api-key.json` until it expires

</details>

<details>
<summary>API base URL</summary>

On the gateway, LiteLLM uses the API host from GitHub's token response if it uses HTTPS and the host is `githubcopilot.com` or a subdomain. Otherwise, it uses `https://api.githubcopilot.com`. The gateway does not use `GITHUB_COPILOT_API_BASE`

For direct SDK Chat Completions, Responses, and Embeddings, LiteLLM checks these values in order: the credential or deployment's `api_base`, `endpoints.api` in the token response, `GITHUB_COPILOT_API_BASE`, then `https://api.githubcopilot.com`.

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

You can pass `extra_headers` to merge headers with these defaults. On the gateway, `Authorization` always uses the connected user's Copilot token

Chat Completions and Responses set `X-Initiator` to `user` or `agent` based on message roles. They also add a vision-request header with value `true` when the request includes images.

Anthropic Messages sets `openai-intent: messages-proxy`, `x-interaction-type: messages-proxy`, and `x-github-api-version: 2026-06-01`. It sets `anthropic-version: 2023-06-01` if the request does not provide one.

</details>
