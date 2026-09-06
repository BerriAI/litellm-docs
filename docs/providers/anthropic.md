import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Anthropic
LiteLLM supports all anthropic models.

- `claude-sonnet-5`
- `claude-opus-5`
- `claude-opus-4-6` (`claude-opus-4-6-20260205`)
- `claude-sonnet-4-6`
- `claude-sonnet-4-5-20250929`
- `claude-opus-4-5-20251101`
- `claude-opus-4-1-20250805`
- `claude-4` (`claude-opus-4-20250514`, `claude-sonnet-4-20250514`)
- `claude-3.7` (`claude-3-7-sonnet-20250219`)
- `claude-3.5` (`claude-3-5-sonnet-20240620`)
- `claude-3` (`claude-3-haiku-20240307`, `claude-3-opus-20240229`, `claude-3-sonnet-20240229`)
- `claude-2`
- `claude-2.1`
- `claude-instant-1.2`


| Property | Details |
|-------|-------|
| Description | Claude is a highly performant, trustworthy, and intelligent AI platform built by Anthropic. Claude excels at tasks involving language, reasoning, analysis, coding, and more. Also available via Azure Foundry. |
| Provider Route on LiteLLM | `anthropic/` (add this prefix to the model name, to route any requests to Anthropic - e.g. `anthropic/claude-3-5-sonnet-20240620`). For Azure Foundry deployments, use `azure/claude-*` (see [Azure Anthropic documentation](../providers/azure/azure_anthropic)) |
| Provider Doc | [Anthropic ↗](https://docs.anthropic.com/en/docs/build-with-claude/overview), [Azure Foundry Claude ↗](https://learn.microsoft.com/en-us/azure/ai-services/foundry-models/claude) |
| API Endpoint for Provider | https://api.anthropic.com (or Azure Foundry endpoint: `https://<resource-name>.services.ai.azure.com/anthropic`) |
| Supported Endpoints | `/chat/completions`, `/v1/messages` (passthrough) |


## Supported OpenAI Parameters

Check this in code, [here](../completion/input.md#translated-openai-params)

```
"stream",
"stop",
"temperature",
"top_p",
"max_tokens",
"max_completion_tokens",
"tools",
"tool_choice",
"extra_headers",
"parallel_tool_calls",
"response_format",
"user",
"reasoning_effort",
```

:::info

**Notes:**
- Anthropic API fails requests when `max_tokens` are not passed. Due to this litellm passes `max_tokens=4096` when no `max_tokens` are passed.
- `response_format` is fully supported for Claude Sonnet 4.5 and Opus 4.1 models (see [Structured Outputs](#structured-outputs) section)
- `reasoning_effort` is automatically mapped to `output_config={"effort": ...}` for Claude 4.6 and Opus 4.5 models (see [Effort Parameter](./anthropic_effort.md))

:::

## **Structured Outputs**

LiteLLM supports Anthropic's [structured outputs feature](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) for Claude Sonnet 4.5 and Opus 4.1 models. When you use `response_format` with these models, LiteLLM automatically:
- Adds the required `structured-outputs-2025-11-13` beta header
- Transforms OpenAI's `response_format` to Anthropic's `output_format` format

### Supported Models
- `sonnet-4-5` or `sonnet-4.5` (all Sonnet 4.5 variants)
- `opus-4-1` or `opus-4.1` (all Opus 4.1 variants)
  - `opus-4-5` or `opus-4.5` (all Opus 4.5 variants)
  
### Example Usage

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

```python
from litellm import completion

response = completion(
    model="{{anthropic}}",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "capital_response",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "country": {"type": "string"},
                    "capital": {"type": "string"}
                },
                "required": ["country", "capital"],
                "additionalProperties": False
            }
        }
    }
)

print(response.choices[0].message.content)
# Output: {"country": "France", "capital": "Paris"}
```

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

1. Setup config.yaml

```yaml
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it!

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "response_format": {
        "type": "json_schema",
        "json_schema": {
            "name": "capital_response",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "country": {"type": "string"},
                    "capital": {"type": "string"}
                },
                "required": ["country", "capital"],
                "additionalProperties": false
            }
        }
    }
  }'
```

</TabItem>
</Tabs>

:::info
When using structured outputs with supported models, LiteLLM automatically:
- Converts OpenAI's `response_format` to Anthropic's `output_schema`
- Adds the `anthropic-beta: structured-outputs-2025-11-13` header
- Creates a tool with the schema and forces the model to use it
:::

## API Keys

```python
import os

os.environ["ANTHROPIC_API_KEY"] = "your-api-key"
# os.environ["ANTHROPIC_API_BASE"] = "" # [OPTIONAL] or 'ANTHROPIC_BASE_URL'
# os.environ["LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX"] = "true" # [OPTIONAL] Disable automatic URL suffix appending
```

:::tip Azure Foundry Support

Claude models are also available via Microsoft Azure Foundry. Use the `azure/` prefix instead of `anthropic/` and configure Azure authentication. See the [Azure Anthropic documentation](../providers/azure/azure_anthropic) for details.

Example:
```python
response = completion(
    model="azure/{{anthropic}}",
    api_base="https://<resource-name>.services.ai.azure.com/anthropic",
    api_key="your-azure-api-key",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

:::

### Custom API Base

When using a custom API base for Anthropic (e.g., a proxy or custom endpoint), LiteLLM automatically appends the appropriate suffix (`/v1/messages` or `/v1/complete`) to your base URL.

If your custom endpoint already includes the full path or doesn't follow Anthropic's standard URL structure, you can disable this automatic suffix appending:

```python
import os

os.environ["ANTHROPIC_API_BASE"] = "https://my-custom-endpoint.com/custom/path"
os.environ["LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX"] = "true"  # Prevents automatic suffix
```

Without `LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX`:
- Base URL `https://my-proxy.com` → `https://my-proxy.com/v1/messages`
- Base URL `https://my-proxy.com/api` → `https://my-proxy.com/api/v1/messages`

With `LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX=true`:
- Base URL `https://my-proxy.com/custom/path` → `https://my-proxy.com/custom/path` (unchanged)

### Azure AI Foundry (Alternative Method)

:::tip Recommended Method
For full Azure support including Azure AD authentication, use the dedicated [Azure Anthropic provider](./azure/azure_anthropic) with `azure_ai/` prefix.
:::

As an alternative, you can use the `anthropic/` provider directly with your Azure endpoint since Azure exposes Claude using Anthropic's native API.

```python
from litellm import completion

response = completion(
    model="anthropic/{{anthropic}}",
    api_base="https://<your-resource>.services.ai.azure.com/anthropic",
    api_key="<your-azure-api-key>",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response)
```

:::info
**Finding your Azure endpoint:** Go to Azure AI Foundry → Your deployment → Overview. Your base URL will be `https://<resource-name>.services.ai.azure.com/anthropic`
:::

## Workload Identity Federation

Anthropic supports workload identity federation, so a proxy can exchange an OIDC identity token it already holds for a short-lived `sk-ant-oat01` access token instead of storing a long-lived `sk-ant-` key. This is the Anthropic equivalent of what Vertex AI and Azure already do, and it suits deployments with a no-static-secrets policy.

LiteLLM mints and caches the access token for you. Configure the federation identifiers plus one identity source, and every route that reaches Anthropic uses the minted token: chat completions, `/v1/messages`, files, batches, skills, passthrough, token counting and model discovery.

### Federation identifiers

These come from the federation rule you create in the Anthropic Console, and they are the same whichever identity source you pick:

| Field | Description |
| --- | --- |
| `anthropic_federation_rule_id` | The `fdrl_...` id of the federation rule |
| `anthropic_organization_id` | Your Anthropic organization UUID |
| `anthropic_service_account_id` | The `svac_...` service account the rule maps to |
| `anthropic_federation_workspace_id` | Required when the rule is enabled in more than one workspace; scopes the minted token to that workspace |

Anthropic's own reference calls the last one `workspace_id`, but federation reads it from `ANTHROPIC_FEDERATION_WORKSPACE_ID`, not `ANTHROPIC_WORKSPACE_ID`. The shorter name already belongs to the Bedrock Claude platform provider, where it picks the workspace a Bedrock call is billed to, so federation takes the longer one and leaves that behavior alone. Setting `ANTHROPIC_WORKSPACE_ID` does nothing for federation

### Static keys take precedence

A static credential outranks federation everywhere in the Anthropic provider. If `ANTHROPIC_API_KEY` is set, every Anthropic route uses it and nothing is federated; `ANTHROPIC_AUTH_TOKEN` comes next, and federation is the last tier. This matches the Anthropic SDK's own ordering, and it applies to files, batches and model discovery as well as to chat.

So a deployment that is meant to be federated must not carry a static key. If one is set anyway, LiteLLM logs a warning naming the model whose federation is being shadowed. A blank or whitespace-only value counts as unset and falls through to federation

### Configuring by environment instead

Every field below can come from the environment rather than the deployment, which is what you want
when the same values apply proxy-wide. A value set on the deployment wins over the environment.

| Field | Environment variable |
| --- | --- |
| `anthropic_federation_rule_id` | `ANTHROPIC_FEDERATION_RULE_ID` |
| `anthropic_organization_id` | `ANTHROPIC_ORGANIZATION_ID` |
| `anthropic_service_account_id` | `ANTHROPIC_SERVICE_ACCOUNT_ID` |
| `anthropic_federation_workspace_id` | `ANTHROPIC_FEDERATION_WORKSPACE_ID` |
| `anthropic_identity_source` | `ANTHROPIC_IDENTITY_SOURCE` |
| `anthropic_identity_token_file` | `ANTHROPIC_IDENTITY_TOKEN_FILE` |
| `anthropic_identity_token` | `ANTHROPIC_IDENTITY_TOKEN` |

### Identity sources

There are four ways to supply the OIDC assertion. Two need no `anthropic_identity_source` at all, and two are selected with it.

#### Token file (default)

Reads an assertion a platform already projects onto disk, which is how Kubernetes service account tokens and most CI runners work. Set `anthropic_identity_token_file` and leave `anthropic_identity_source` unset. The path must sit under LiteLLM's OIDC file allowlist, which you extend with `LITELLM_OIDC_ALLOWED_CREDENTIAL_DIRS`. The file is re-read on each mint, so a rotated token is picked up without a restart.

```yaml
model_list:
  - model_name: claude-sonnet-4-5
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      anthropic_identity_token_file: /var/run/secrets/anthropic.com/token
      anthropic_federation_rule_id: os.environ/ANTHROPIC_FEDERATION_RULE_ID
      anthropic_organization_id: os.environ/ANTHROPIC_ORGANIZATION_ID
      anthropic_service_account_id: os.environ/ANTHROPIC_SERVICE_ACCOUNT_ID
```

#### Secret reference (default)

`anthropic_identity_token` takes an `oidc/` reference, not a raw token. Accepted forms are `oidc/env/VAR_NAME`, `oidc/file//absolute/path`, `oidc/github/<audience>`, and `oidc/google/<audience>`. Pasting a bare JWT is rejected, so export it and reference the variable instead.

```yaml
      anthropic_identity_token: oidc/env/MY_WORKLOAD_TOKEN
```

#### LiteLLM as the issuer

For deployments with no external IdP, LiteLLM signs the assertion itself with an ES256 (P-256) key. Set `anthropic_identity_source: internal_issuer` and point `anthropic_issuer_signing_key_ref` at the key rather than pasting it inline, so custody stays with your secret manager. `anthropic_issuer_ttl_seconds` defaults to 300 and cannot exceed 3600.

```yaml
credential_list:
  - credential_name: anthropic_wif
    credential_values:
      anthropic_identity_source: internal_issuer
      anthropic_issuer_url: https://litellm.example.com
      anthropic_issuer_subject: litellm-proxy
      anthropic_issuer_audience: https://api.anthropic.com
      anthropic_issuer_signing_key_ref: os.environ/ANTHROPIC_WIF_SIGNING_KEY
      anthropic_issuer_ttl_seconds: 300
      anthropic_federation_rule_id: os.environ/ANTHROPIC_FEDERATION_RULE_ID
      anthropic_organization_id: os.environ/ANTHROPIC_ORGANIZATION_ID
      anthropic_service_account_id: os.environ/ANTHROPIC_SERVICE_ACCOUNT_ID
    credential_info:
      custom_llm_provider: anthropic

model_list:
  - model_name: claude-sonnet-4-5
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      litellm_credential_name: anthropic_wif
```

Anthropic needs the matching public key to verify what LiteLLM signs. Export it from the proxy and register it as the **inline** issuer JWKS on your federation rule:

```shell
curl -s http://localhost:4000/credentials/anthropic_wif/jwks \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

The endpoint is proxy-admin only and never exposes the private key, so paste the JSON it returns into the Anthropic Console rather than pointing Anthropic at the URL. A freshly registered JWKS takes about a minute before Anthropic accepts assertions signed by it.

#### Keycloak

For shops that already run Keycloak as the workload IdP, LiteLLM fetches the assertion with an OAuth client credentials grant. Set `anthropic_identity_source: keycloak` plus:

```yaml
      anthropic_keycloak_token_url: https://keycloak.example.com/realms/prod/protocol/openid-connect/token
      anthropic_keycloak_client_id: litellm-proxy
      anthropic_keycloak_auth_method: client_secret_basic  # or client_secret_post
      anthropic_keycloak_client_secret_ref: os.environ/KEYCLOAK_CLIENT_SECRET
      anthropic_keycloak_scope: anthropic-federation
```

Mixing fields across variants is rejected rather than silently ignored, so a config that names `internal_issuer` while carrying Keycloak fields fails at startup instead of quietly falling back.

### Setting it up in the UI

The Admin UI does not offer these fields yet, so configure federation through the proxy config or the environment as shown above. A follow-up adds them to the LLM Credentials flow.

### Token lifetime and refresh

LiteLLM caches the minted access token per deployment and refreshes it in the background before it expires, so a request rarely waits on an exchange. Refresh is two-tier: an advisory refresh at half the token's lifetime that happens in the background while the old token keeps serving, and a mandatory one at an eighth of the lifetime that blocks. Concurrent requests for the same deployment share a single in-flight exchange rather than each minting their own, so the number of exchanges does not scale with traffic.

Workers on the same host share the minted token through a small on-disk cache under the temp directory, readable only by the proxy's user, so a proxy running several uvicorn workers exchanges each assertion once rather than once per worker. `LITELLM_TOKEN_EXCHANGE_CACHE_DIR` moves that cache, and setting it to an empty string turns it off so every process mints on its own. Replicas on different hosts always mint their own token.

Anthropic accepts each assertion once: a second exchange of the same JWT is denied with the opaque 401 and shows up as `jti_reused` in the rule's authentication history. That is fine for the internal issuer and Keycloak sources, which mint a fresh assertion for every exchange, but a token file or `oidc/env/` value has to rotate faster than the rule's `token_lifetime_seconds`, or the first refresh after the minted token expires fails until a new assertion shows up. Kubernetes rotates a projected service account token once 80% of its `expirationSeconds` has passed, so keep the rule's token lifetime at or above that rotation period; the defaults (a one hour projected token and a one hour rule lifetime) line up.

### Who can configure it

Only a proxy admin can create or change a deployment that uses workload identity federation. A team admin who otherwise manages a team-scoped deployment gets a 403, and that holds however the change is expressed: setting a federation field directly, attaching a credential that carries one by name, or changing `api_base` on a deployment that is already federated. The last one matters because `api_base` decides where the signed assertion is sent and where the minted token is presented, so it is part of the federation configuration even though it is not a federation field.

The same rule covers the stored fallback lists on a key or team. A fallback target cannot carry a federation field, since those are merged over the deployment's own configuration when a failover happens.

Teams keep normal access to a federated deployment. Only editing it moves to the proxy admin.

### Restricting where assertions are sent

The exchange only talks to `api.anthropic.com`. If you front Anthropic with a gateway, list its hostname in `LITELLM_ANTHROPIC_WIF_ALLOWED_HOSTS` (comma separated) so the signed assertion is allowed to reach it.

```shell
export LITELLM_ANTHROPIC_WIF_ALLOWED_HOSTS="anthropic.gateway.internal"
```

An entry may name a port, in which case only that port is trusted and another process on the same host is not. An entry without a port trusts every port on that host.

```shell
export LITELLM_ANTHROPIC_WIF_ALLOWED_HOSTS="anthropic.gateway.internal:8443"
```

The list is read from the environment only. It is never taken from a model or credential API, because `api_base` decides both where the assertion is sent and where the minted token is presented

### Monitoring

Token health is emitted through the standard service-logging path: `prometheus_system` sends it to Prometheus and `otel` sends it to OpenTelemetry, using the exporter settings from the [OpenTelemetry docs](../observability/opentelemetry_integration). The services are `anthropic_wif` for the exchange itself and `anthropic_wif_cache` for cache hits and misses, giving you mint counts, mint latency, and failures broken out by cause. Enable them with:

```yaml
litellm_settings:
  service_callback: ["prometheus_system", "otel"]
```

## Usage

```python
import os
from litellm import completion

# set env - [OPTIONAL] replace with your anthropic key
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

messages = [{"role": "user", "content": "Hey! how's it going?"}]
response = completion(model="{{anthropic_large}}", messages=messages)
print(response)
```


## Usage - Streaming
Just set `stream=True` when calling completion.

```python
import os
from litellm import completion

# set env
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

messages = [{"role": "user", "content": "Hey! how's it going?"}]
response = completion(model="{{anthropic_large}}", messages=messages, stream=True)
for chunk in response:
    print(chunk["choices"][0]["delta"]["content"])  # same as openai format
```

## Usage with LiteLLM Proxy 

Here's how to call Anthropic with the LiteLLM Proxy Server

### 1. Save key in your environment

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

### 2. Start the proxy 

<Tabs>
<TabItem value="config" label="config.yaml">

```yaml
model_list:
  - model_name: claude-4 ### RECEIVED MODEL NAME ###
    litellm_params: # all params accepted by litellm.completion() - https://docs.litellm.ai/docs/completion/input
      model: {{anthropic_large}} ### MODEL NAME sent to `litellm.completion()` ###
      api_key: "os.environ/ANTHROPIC_API_KEY" # does os.getenv("ANTHROPIC_API_KEY")
```

```bash
litellm --config /path/to/config.yaml
```
</TabItem>
<TabItem value="config-all" label="config - default all Anthropic Model">

Use this if you want to make requests to `{{anthropic}}`,`{{anthropic_large}}` without defining them on the config.yaml

#### Required env variables
```
ANTHROPIC_API_KEY=sk-ant****
```

```yaml
model_list:
  - model_name: "*" 
    litellm_params:
      model: "*"
```

```bash
litellm --config /path/to/config.yaml
```

Example Request for this config.yaml

**Ensure you use `anthropic/` prefix to route the request to Anthropic API**

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data ' {
      "model": "anthropic/{{anthropic}}",
      "messages": [
        {
          "role": "user",
          "content": "what llm are you"
        }
      ]
    }
'
```


</TabItem>
<TabItem value="cli" label="cli">

```bash
$ litellm --model {{anthropic_large}}

# Server running on http://0.0.0.0:4000
```
</TabItem>
</Tabs>

### 3. Test it


<Tabs>
<TabItem value="Curl" label="Curl Request">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--data ' {
      "model": "anthropic/{{anthropic}}",
      "messages": [
        {
          "role": "user",
          "content": "what llm are you"
        }
      ]
    }
'
```
</TabItem>
<TabItem value="openai" label="OpenAI v1.0.0+">

```python
import openai
client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000"
)

# request sent to model set on litellm proxy, `litellm --model`
response = client.chat.completions.create(model="anthropic/{{anthropic}}", messages = [
    {
        "role": "user",
        "content": "this is a test request, write a short poem"
    }
])

print(response)

```
</TabItem>
<TabItem value="langchain" label="Langchain">

```python
from langchain.chat_models import ChatOpenAI
from langchain.prompts.chat import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from langchain.schema import HumanMessage, SystemMessage

chat = ChatOpenAI(
    openai_api_base="http://0.0.0.0:4000", # set openai_api_base to the LiteLLM Proxy
    model = "anthropic/{{anthropic}}",
    temperature=0.1
)

messages = [
    SystemMessage(
        content="You are a helpful assistant that im using to make a test request to."
    ),
    HumanMessage(
        content="test from litellm. tell me why it's amazing in 1 sentence"
    ),
]
response = chat(messages)

print(response)
```
</TabItem>
</Tabs>

## Supported Models

`Model Name` 👉 Human-friendly name.  
`Function Call` 👉 How to call the model in LiteLLM.

| Model Name       | Function Call                              |
|------------------|--------------------------------------------|
| claude-opus-4-6  | `completion('claude-opus-4-6-20260205', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-sonnet-4-5  | `completion('claude-sonnet-4-5-20250929', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-opus-4-5  | `completion('claude-opus-4-5-20251101', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-opus-4-1  | `completion('claude-opus-4-1-20250805', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-opus-4  | `completion('claude-opus-4-20250514', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-sonnet-4  | `completion('claude-sonnet-4-20250514', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-3.7  | `completion('claude-3-7-sonnet-20250219', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-3-5-sonnet  | `completion('claude-3-5-sonnet-20240620', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-3-haiku  | `completion('claude-3-haiku-20240307', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-3-opus  | `completion('claude-3-opus-20240229', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-3-5-sonnet-20240620  | `completion('claude-3-5-sonnet-20240620', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-3-sonnet  | `completion('claude-3-sonnet-20240229', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-2.1  | `completion('claude-2.1', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-2  | `completion('claude-2', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-instant-1.2  | `completion('claude-instant-1.2', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |
| claude-instant-1  | `completion('claude-instant-1', messages)` | `os.environ['ANTHROPIC_API_KEY']`       |

## **Prompt Caching**

Use Anthropic Prompt Caching


[Relevant Anthropic API Docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)

:::note

Here's what a sample Raw Request from LiteLLM for Anthropic Context Caching looks like: 

```bash
POST Request Sent from LiteLLM:
curl -X POST \
https://api.anthropic.com/v1/messages \
-H 'accept: application/json' -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' -H 'x-api-key: sk-...' \
-d '{'model': '{{anthropic}}', [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "What are the key terms and conditions in this agreement?",
          "cache_control": {
            "type": "ephemeral"
          }
        }
      ]
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "Certainly! The key terms and conditions are the following: the contract is 1 year long for $10/mo"
        }
      ]
    }
  ],
  "temperature": 0.2,
  "max_tokens": 10
}'
```

**Note:** Anthropic no longer requires the `anthropic-beta: prompt-caching-2024-07-31` header. Prompt caching now works automatically when you use `cache_control` in your messages.
::: 

### Caching - Large Context Caching 


This example demonstrates basic Prompt Caching usage, caching the full text of the legal agreement as a prefix while keeping the user instruction uncached.


<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

```python 
response = await litellm.acompletion(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are an AI assistant tasked with analyzing legal documents.",
                },
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement",
                    "cache_control": {"type": "ephemeral"},
                },
            ],
        },
        {
            "role": "user",
            "content": "what are the key terms and conditions in this agreement?",
        },
    ]
)

```
</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

:::info

LiteLLM Proxy is OpenAI compatible

This is an example using the OpenAI Python SDK sending a request to LiteLLM Proxy

Assuming you have a model=`anthropic/{{anthropic}}` on the [litellm proxy config.yaml](#usage-with-litellm-proxy)

:::

```python 
import openai
client = openai.AsyncOpenAI(
    api_key="anything",            # litellm proxy api key
    base_url="http://0.0.0.0:4000" # litellm proxy base url
)


response = await client.chat.completions.create(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "You are an AI assistant tasked with analyzing legal documents.",
                },
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement",
                    "cache_control": {"type": "ephemeral"},
                },
            ],
        },
        {
            "role": "user",
            "content": "what are the key terms and conditions in this agreement?",
        },
    ]
)

```

</TabItem>
</Tabs>

### Caching - Tools definitions

In this example, we demonstrate caching tool definitions.

The cache_control parameter is placed on the final tool

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

```python 
import litellm

response = await litellm.acompletion(
    model="anthropic/{{anthropic}}",
    messages = [{"role": "user", "content": "What's the weather like in Boston today?"}],
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g. San Francisco, CA",
                        },
                        "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                    },
                    "required": ["location"],
                },
                "cache_control": {"type": "ephemeral"}
            },
        }
    ]
)
```
</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

:::info

LiteLLM Proxy is OpenAI compatible

This is an example using the OpenAI Python SDK sending a request to LiteLLM Proxy

Assuming you have a model=`anthropic/{{anthropic}}` on the [litellm proxy config.yaml](#usage-with-litellm-proxy)

:::

```python 
import openai
client = openai.AsyncOpenAI(
    api_key="anything",            # litellm proxy api key
    base_url="http://0.0.0.0:4000" # litellm proxy base url
)

response = await client.chat.completions.create(
    model="anthropic/{{anthropic}}",
    messages = [{"role": "user", "content": "What's the weather like in Boston today?"}],
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g. San Francisco, CA",
                        },
                        "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                    },
                    "required": ["location"],
                },
                "cache_control": {"type": "ephemeral"}
            },
        }
    ]
)
```

</TabItem>
</Tabs>


### Caching - Continuing Multi-Turn Convo

In this example, we demonstrate how to use Prompt Caching in a multi-turn conversation.

The cache_control parameter is placed on the system message to designate it as part of the static prefix.

The conversation history (previous messages) is included in the messages array. The final turn is marked with cache-control, for continuing in followups. The second-to-last user message is marked for caching with the cache_control parameter, so that this checkpoint can read from the previous cache.

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

```python 
import litellm

response = await litellm.acompletion(
    model="anthropic/{{anthropic}}",
    messages=[
        # System Message
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement"
                    * 400,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        # marked for caching with the cache_control parameter, so that this checkpoint can read from the previous cache.
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the key terms and conditions in this agreement?",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        {
            "role": "assistant",
            "content": "Certainly! the key terms and conditions are the following: the contract is 1 year long for $10/mo",
        },
        # The final turn is marked with cache-control, for continuing in followups.
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the key terms and conditions in this agreement?",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
    ]
)
```
</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

:::info

LiteLLM Proxy is OpenAI compatible

This is an example using the OpenAI Python SDK sending a request to LiteLLM Proxy

Assuming you have a model=`anthropic/{{anthropic}}` on the [litellm proxy config.yaml](#usage-with-litellm-proxy)

:::

```python 
import openai
client = openai.AsyncOpenAI(
    api_key="anything",            # litellm proxy api key
    base_url="http://0.0.0.0:4000" # litellm proxy base url
)

response = await client.chat.completions.create(
    model="anthropic/{{anthropic}}",
    messages=[
        # System Message
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "Here is the full text of a complex legal agreement"
                    * 400,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        # marked for caching with the cache_control parameter, so that this checkpoint can read from the previous cache.
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the key terms and conditions in this agreement?",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        {
            "role": "assistant",
            "content": "Certainly! the key terms and conditions are the following: the contract is 1 year long for $10/mo",
        },
        # The final turn is marked with cache-control, for continuing in followups.
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the key terms and conditions in this agreement?",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
    ]
)
```

</TabItem>
</Tabs>

## **Function/Tool Calling**

```python
from litellm import completion

# set env
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        },
    }
]
messages = [{"role": "user", "content": "What's the weather like in Boston today?"}]

response = completion(
    model="anthropic/{{anthropic}}",
    messages=messages,
    tools=tools,
    tool_choice="auto",
)
# Add any assertions, here to check response args
print(response)
assert isinstance(response.choices[0].message.tool_calls[0].function.name, str)
assert isinstance(
    response.choices[0].message.tool_calls[0].function.arguments, str
)

```


### Forcing Anthropic Tool Use

If you want Claude to use a specific tool to answer the user’s question

You can do this by specifying the tool in the `tool_choice` field like so:
```python
response = completion(
    model="anthropic/{{anthropic}}",
    messages=messages,
    tools=tools,
    tool_choice={"type": "tool", "name": "get_weather"},
)
```

### Disable Tool Calling

You can disable tool calling by setting the `tool_choice` to `"none"`.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

response = completion(
    model="anthropic/{{anthropic}}",
    messages=messages,
    tools=tools,
    tool_choice="none",
)

```
</TabItem>
<TabItem value="proxy" label="Proxy">

1. Setup config.yaml

```yaml
model_list:
  - model_name: anthropic-claude-model
    litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

Replace `anything` with your LiteLLM Proxy Virtual Key, if [setup](../proxy/virtual_keys).

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer anything" \
  -d '{
    "model": "anthropic-claude-model",
    "messages": [{"role": "user", "content": "Who won the World Cup in 2022?"}],
    "tools": [{"type": "mcp", "server_label": "deepwiki", "server_url": "https://mcp.deepwiki.com/mcp", "require_approval": "never"}],
    "tool_choice": "none"
  }'
```
</TabItem>
</Tabs>



### MCP Tool Calling 

Here's how to use MCP tool calling with Anthropic:

<Tabs>
<TabItem value="sdk" label="LiteLLM SDK">

LiteLLM supports MCP tool calling with Anthropic in the OpenAI Responses API format.

<Tabs>
<TabItem value="openai_format" label="OpenAI Format">


```python
import os 
from litellm import completion

os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

tools=[
    {
        "type": "mcp",
        "server_label": "deepwiki",
        "server_url": "https://mcp.deepwiki.com/mcp",
        "require_approval": "never",
    },
]

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Who won the World Cup in 2022?"}],
    tools=tools
)
```

</TabItem>
<TabItem value="anthropic_format" label="Anthropic Format">

```python
import os 
from litellm import completion

os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

tools = [
    {
        "type": "url",
        "url": "https://mcp.deepwiki.com/mcp",
        "name": "deepwiki-mcp",
    }
]
response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Who won the World Cup in 2022?"}],
    tools=tools
)

print(response)
```
</TabItem>

</Tabs>

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

1. Setup config.yaml

```yaml
model_list:
  - model_name: claude-4-sonnet
    litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

<Tabs>
<TabItem value="openai" label="OpenAI Format">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "claude-4-sonnet",
    "messages": [{"role": "user", "content": "Who won the World Cup in 2022?"}],
    "tools": [{"type": "mcp", "server_label": "deepwiki", "server_url": "https://mcp.deepwiki.com/mcp", "require_approval": "never"}]
  }'
```

</TabItem>
<TabItem value="anthropic" label="Anthropic Format">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "claude-4-sonnet",
    "messages": [{"role": "user", "content": "Who won the World Cup in 2022?"}],
    "tools": [
        {
            "type": "url",
            "url": "https://mcp.deepwiki.com/mcp",
            "name": "deepwiki-mcp",
        }
    ]
  }'
```

</TabItem>
</Tabs>
</TabItem>
</Tabs>

### Parallel Function Calling 

Here's how to pass the result of a function call back to an anthropic model: 

```python
from litellm import completion
import os 

os.environ["ANTHROPIC_API_KEY"] = "sk-ant.."


litellm.set_verbose = True

### 1ST FUNCTION CALL ###
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                },
                "required": ["location"],
            },
        },
    }
]
messages = [
    {
        "role": "user",
        "content": "What's the weather like in Boston today in Fahrenheit?",
    }
]
try:
    # test without max tokens
    response = completion(
        model="anthropic/{{anthropic}}",
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )
    # Add any assertions, here to check response args
    print(response)
    assert isinstance(response.choices[0].message.tool_calls[0].function.name, str)
    assert isinstance(
        response.choices[0].message.tool_calls[0].function.arguments, str
    )

    messages.append(
        response.choices[0].message.model_dump()
    )  # Add assistant tool invokes
    tool_result = (
        '{"location": "Boston", "temperature": "72", "unit": "fahrenheit"}'
    )
    # Add user submitted tool results in the OpenAI format
    messages.append(
        {
            "tool_call_id": response.choices[0].message.tool_calls[0].id,
            "role": "tool",
            "name": response.choices[0].message.tool_calls[0].function.name,
            "content": tool_result,
        }
    )
    ### 2ND FUNCTION CALL ###
    # In the second response, Claude should deduce answer from tool results
    second_response = completion(
        model="anthropic/{{anthropic}}",
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )
    print(second_response)
except Exception as e:
    print(f"An error occurred - {str(e)}")
```

s/o @[Shekhar Patnaik](https://www.linkedin.com/in/patnaikshekhar) for requesting this!

### Context Management (Beta)

Anthropic’s [context editing](https://docs.claude.com/en/docs/build-with-claude/context-editing) API lets you automatically clear older tool results or thinking blocks. LiteLLM now forwards the native `context_management` payload when you call Anthropic models, and automatically attaches the required `context-management-2025-06-27` beta header.

```python
from litellm import completion

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Summarize the latest tool results"}],
    context_management={
        "edits": [
            {
                "type": "clear_tool_uses_20250919",
                "trigger": {"type": "input_tokens", "value": 30000},
                "keep": {"type": "tool_uses", "value": 3},
                "clear_at_least": {"type": "input_tokens", "value": 5000},
                "exclude_tools": ["web_search"],
            }
        ]
    },
)
```

### Anthropic Hosted Tools (Computer, Text Editor, Web Search, Memory)


<Tabs>
<TabItem value="computer" label="Computer">

```python keep-model-ids
from litellm import completion

tools = [
    {
        "type": "computer_20241022",
        "function": {
            "name": "computer",
            "parameters": {
                "display_height_px": 100,
                "display_width_px": 100,
                "display_number": 1,
            },
        },
    }
]
model = "claude-3-5-sonnet-20241022"
messages = [{"role": "user", "content": "Save a picture of a cat to my desktop."}]

resp = completion(
    model=model,
    messages=messages,
    tools=tools,
    # headers={"anthropic-beta": "computer-use-2024-10-22"},
)

print(resp)
```

</TabItem>
<TabItem value="text_editor" label="Text Editor">

<Tabs>
<TabItem value="sdk" label="SDK">

```python keep-model-ids
from litellm import completion

tools = [{
    "type": "text_editor_20250124",
    "name": "str_replace_editor"
}]
model = "claude-3-5-sonnet-20241022"
messages = [{"role": "user", "content": "There's a syntax error in my primes.py file. Can you help me fix it?"}]

resp = completion(
    model=model,
    messages=messages,
    tools=tools,
)

print(resp)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml keep-model-ids
- model_name: claude-3-5-sonnet-latest
  litellm_params:
    model: anthropic/claude-3-5-sonnet-latest
    api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash keep-model-ids
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "claude-3-5-sonnet-latest",
    "messages": [{"role": "user", "content": "There's a syntax error in my primes.py file. Can you help me fix it?"}],
    "tools": [{"type": "text_editor_20250124", "name": "str_replace_editor"}]
  }'
```
</TabItem>
</Tabs>

</TabItem>
<TabItem value="web_search" label="Web Search">

:::info
Live from v1.70.1+
:::

LiteLLM maps OpenAI's `search_context_size` param to Anthropic's `max_uses` param.

| OpenAI | Anthropic |
| --- | --- |
| Low | 1 | 
| Medium | 5 | 
| High | 10 | 


<Tabs>
<TabItem value="sdk" label="SDK">


<Tabs>
<TabItem value="openai" label="OpenAI Format">

```python
from litellm import completion

model = "{{anthropic}}"
messages = [{"role": "user", "content": "What's the weather like today?"}]

resp = completion(
    model=model,
    messages=messages,
    web_search_options={
        "search_context_size": "medium",
        "user_location": {
            "type": "approximate",
            "approximate": {
                "city": "San Francisco",
            },
        }
    }
)

print(resp)
```
</TabItem>
<TabItem value="anthropic" label="Anthropic Format">

```python
from litellm import completion

tools = [{
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 5
}]
model = "{{anthropic}}"
messages = [{"role": "user", "content": "There's a syntax error in my primes.py file. Can you help me fix it?"}]

resp = completion(
    model=model,
    messages=messages,
    tools=tools,
)

print(resp)
```
</TabItem>

</Tabs>
</TabItem>

<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
- model_name: {{anthropic}}
  litellm_params:
    model: anthropic/{{anthropic}}
    api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

<Tabs>
<TabItem value="openai" label="OpenAI Format">


```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What's the weather like today?"}],
    "web_search_options": {
        "search_context_size": "medium",
        "user_location": {
            "type": "approximate",
            "approximate": {
                "city": "San Francisco",
            },
        }
    }
  }'
```
</TabItem>
<TabItem value="anthropic" label="Anthropic Format">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What's the weather like today?"}],
    "tools": [{
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": 5
    }]
  }'
```

</TabItem>
</Tabs>
</TabItem>
</Tabs>

</TabItem>

<TabItem value="memory" label="Memory">

:::info
The Anthropic Memory tool is currently in beta.
:::

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

tools = [{
    "type": "memory_20250818",
    "name": "memory"
}]

model = "{{anthropic}}" 
messages = [{"role": "user", "content": "Please remember that my favorite color is blue."}]

response = completion(
    model=model,
    messages=messages,
    tools=tools,
)

print(response)
```

</TabItem>
<TabItem value="proxy" label="Proxy">

1. Setup config.yaml

```yaml
model_list:
    - model_name: claude-memory-model
      litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LITELLM_KEY" \
    -d '{
    "model": "claude-memory-model",
    "messages": [{"role": "user", "content": "Please remember that my favorite color is blue."}],
    "tools": [{"type": "memory_20250818", "name": "memory"}]
    }'
```
</TabItem>
</Tabs>

</TabItem>

</Tabs>



## Usage - Vision 

```python
from litellm import completion

# set env
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

def encode_image(image_path):
    import base64

    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


image_path = "../proxy/cached_logo.jpg"
# Getting the base64 string
base64_image = encode_image(image_path)
resp = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Whats in this image?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:image/jpeg;base64," + base64_image
                    },
                },
            ],
        }
    ],
)
print(f"\nResponse: {resp}")
```

## Usage - Thinking / `reasoning_content`

LiteLLM translates OpenAI's `reasoning_effort` to Anthropic's `thinking` parameter. [Code](https://github.com/BerriAI/litellm/blob/23051d89dd3611a81617d84277059cd88b2df511/litellm/llms/anthropic/chat/transformation.py#L298)

| reasoning_effort | thinking |
| ---------------- | -------- |
| "low"            | "budget_tokens": 1024 |
| "medium"         | "budget_tokens": 2048 |
| "high"           | "budget_tokens": 4096 |

:::note
`reasoning_effort` maps to Anthropic's [adaptive thinking](https: //docs.claude.com/en/docs/build-with-claude/extended-thinking/adaptive-thinking) plus the `output_config.effort` parameter on Claude 4.6 and 4.7 models (including `claude-opus-4-6`, `claude-opus-4-7`, `claude-sonnet-4-6`, etc. ), **not** `budget_tokens`. In particular, LiteLLM will inject the following into the underlying Anthropic request on the OpenAI-compatible `/chat/completions` route:

```json
{
  "thinking": {"type": "adaptive"},
  "output_config": {"effort": "<low|medium|high|xhigh|max>"}
}
```

This means **any value other than `"none"` for `reasoning_effort` will automatically turn thinking on for these models**, even though the OpenAI-compatible request body does not have a separate `thinking` field. This is intended to match Anthropic's own recommended usage: budget_tokens has been deprecated on 4.6 models and rejected entirely on Opus 4.7, where only adaptive is a supported thinking mode.

You can disable thinking either by omitting `reasoning_effort` entirely or setting it to `"none"`. LiteLLM will not send a `thinking` field in that case. You can still pass the native `thinking` parameter directly if you wish to explicitly control thinking with a fixed budget on prior models:

```python keep-model-ids
from litellm import completion

# Disable thinking on Claude 4.6/4.7
resp = completion(
    model="anthropic/claude-opus-4-7",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    reasoning_effort="none",  # no thinking field sent
)

# Explicit budget (pre-4.6 models; deprecated on 4.6, rejected on Opus 4.7)
resp = completion(
    model="anthropic/claude-sonnet-4-5-20250929",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    thinking={"type": "enabled", "budget_tokens": 1024},
)
```

The Anthropic `/v1/messages` passthrough route is unaffected by this reasoning effort mapping. `thinking` is passed through unchanged.
:::

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

resp = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    reasoning_effort="low",
)

```

</TabItem>

<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
- model_name: {{anthropic}}
  litellm_params:
    model: anthropic/{{anthropic}}
    api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start proxy

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR-LITELLM-KEY>" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "reasoning_effort": "low"
  }'
```

</TabItem>
</Tabs>


**Expected Response**

```python
ModelResponse(
    id='chatcmpl-c542d76d-f675-4e87-8e5f-05855f5d0f5e',
    created=1740470510,
    model='{{anthropic}}',
    object='chat.completion',
    system_fingerprint=None,
    choices=[
        Choices(
            finish_reason='stop',
            index=0,
            message=Message(
                content="The capital of France is Paris.",
                role='assistant',
                tool_calls=None,
                function_call=None,
                provider_specific_fields={
                    'citations': None,
                    'thinking_blocks': [
                        {
                            'type': 'thinking',
                            'thinking': 'The capital of France is Paris. This is a very straightforward factual question.',
                            'signature': 'EuYBCkQYAiJAy6...'
                        }
                    ]
                }
            ),
            thinking_blocks=[
                {
                    'type': 'thinking',
                    'thinking': 'The capital of France is Paris. This is a very straightforward factual question.',
                    'signature': 'EuYBCkQYAiJAy6AGB...'
                }
            ],
            reasoning_content='The capital of France is Paris. This is a very straightforward factual question.'
        )
    ],
    usage=Usage(
        completion_tokens=68,
        prompt_tokens=42,
        total_tokens=110,
        completion_tokens_details=None,
        prompt_tokens_details=PromptTokensDetailsWrapper(
            audio_tokens=None,
            cached_tokens=0,
            text_tokens=None,
            image_tokens=None
        ),
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0
    )
)
```

### Pass `thinking` to Anthropic models

You can also pass the `thinking` parameter to Anthropic models.


You can also pass the `thinking` parameter to Anthropic models.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = litellm.completion(
  model="anthropic/{{anthropic}}",
  messages=[{"role": "user", "content": "What is the capital of France?"}],
  thinking={"type": "enabled", "budget_tokens": 1024},
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "anthropic/{{anthropic}}",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "thinking": {"type": "enabled", "budget_tokens": 1024}
  }'
```

</TabItem>
</Tabs>

#### Adaptive Thinking (Claude Opus 4.6)

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = litellm.completion(
  model="anthropic/{{anthropic_large}}",
  messages=[{"role": "user", "content": "What is the optimal strategy for solving this problem?"}],
  thinking={"type": "adaptive"},
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "anthropic/{{anthropic_large}}",
    "messages": [{"role": "user", "content": "What is the optimal strategy for solving this problem?"}],
    "thinking": {"type": "adaptive"}
  }'
```

</TabItem>
</Tabs>

#### Enabled Thinking with Budget

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = litellm.completion(
  model="anthropic/{{anthropic_large}}",
  messages=[{"role": "user", "content": "What is the capital of France?"}],
  thinking={"type": "enabled", "budget_tokens": 5000},
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "anthropic/{{anthropic_large}}",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "thinking": {"type": "enabled", "budget_tokens": 5000}
  }'
```

</TabItem>
</Tabs>

## **Passing Extra Headers to Anthropic API**

Pass `extra_headers: dict` to `litellm.completion`

```python keep-model-ids
from litellm import completion
messages = [{"role": "user", "content": "What is Anthropic?"}]
response = completion(
    model="claude-3-5-sonnet-20240620", 
    messages=messages, 
    extra_headers={"anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"}
)
```

## Usage - "Assistant Pre-fill"

You can "put words in Claude's mouth" by including an `assistant` role message as the last item in the `messages` array.

:::info

The returned completion will _not_ include your "pre-fill" text, since it is part of the prompt itself. Make sure to prefix Claude's completion with your pre-fill.

:::

```python keep-model-ids
import os
from litellm import completion

# set env - [OPTIONAL] replace with your anthropic key
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

messages = [
    {"role": "user", "content": "How do you say 'Hello' in German? Return your answer as a JSON object, like this:\n\n{ \"Hello\": \"Hallo\" }"},
    {"role": "assistant", "content": "{"},
]
response = completion(model="claude-2.1", messages=messages)
print(response)
```

#### Example prompt sent to Claude

```

Human: How do you say 'Hello' in German? Return your answer as a JSON object, like this:

{ "Hello": "Hallo" }

Assistant: {
```

## Usage - "System" messages
If you're using Anthropic's Claude 2.1, `system` role messages are properly formatted for you.

```python keep-model-ids
import os
from litellm import completion

# set env - [OPTIONAL] replace with your anthropic key
os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

messages = [
    {"role": "system", "content": "You are a snarky assistant."},
    {"role": "user", "content": "How do I boil water?"},
]
response = completion(model="claude-2.1", messages=messages)
```

#### Example prompt sent to Claude

```
You are a snarky assistant.

Human: How do I boil water?

Assistant:
```


## Usage - PDF

Pass base64 encoded PDF files to Anthropic models using the `file` content type with a `file_data` field.

<Tabs>
<TabItem value="sdk" label="SDK">

### **using base64**
```python
from litellm import completion, supports_pdf_input
import base64
import requests

# URL of the file
url = "https://storage.googleapis.com/cloud-samples-data/generative-ai/pdf/2403.05530.pdf"

# Download the file
response = requests.get(url)
file_data = response.content

encoded_file = base64.b64encode(file_data).decode("utf-8")

## check if model supports pdf input
supports_pdf_input("anthropic/{{anthropic}}") # True

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "You are a very professional document summarization specialist. Please summarize the given document."},
                {
                    "type": "file",
                    "file": {
                       "file_data": f"data:application/pdf;base64,{encoded_file}", # 👈 PDF
                    }
                },
            ],
        }
    ],
    max_tokens=300,
)

print(response.choices[0])
```
</TabItem>
<TabItem value="proxy" label="PROXY">

1. Add model to config 

```yaml
- model_name: {{anthropic}}
  litellm_params:
    model: anthropic/{{anthropic}}
    api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start Proxy

```
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR-LITELLM-KEY>" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "You are a very professional document summarization specialist. Please summarize the given document"
          },
          {
                "type": "file",
                "file": {
                    "file_data": f"data:application/pdf;base64,{encoded_file}", # 👈 PDF
                }
            }
          }
        ]
      }
    ],
    "max_tokens": 300
  }'

```
</TabItem>
</Tabs>

## [BETA] Citations API 

Pass `citations: {"enabled": true}` to Anthropic, to get citations on your document responses. 

Note: This interface is in BETA. If you have feedback on how citations should be returned, please [tell us here](https://github.com/BerriAI/litellm/issues/7970#issuecomment-2644437943)

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

resp = completion(
    model="{{anthropic}}",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "text",
                        "media_type": "text/plain",
                        "data": "The grass is green. The sky is blue.",
                    },
                    "title": "My Document",
                    "context": "This is a trustworthy document.",
                    "citations": {"enabled": True},
                },
                {
                    "type": "text",
                    "text": "What color is the grass and sky?",
                },
            ],
        }
    ],
)

citations = resp.choices[0].message.provider_specific_fields["citations"]

assert citations is not None
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
    - model_name: anthropic-claude
      litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start proxy 

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

3. Test it! 

```bash
curl -L -X POST 'http://0.0.0.0:4000/v1/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-1234' \
-d '{
  "model": "anthropic-claude",
  "messages": [
    {
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "text",
                    "media_type": "text/plain",
                    "data": "The grass is green. The sky is blue.",
                },
                "title": "My Document",
                "context": "This is a trustworthy document.",
                "citations": {"enabled": True},
            },
            {
                "type": "text",
                "text": "What color is the grass and sky?",
            },
        ],
    }
  ]
}'
```

</TabItem>
</Tabs>

## Files API

Upload files once and reference them by `file_id` in multiple requests, with no need to re-upload content each time.

:::info
The `file_id` obtained from Anthropic only works with Anthropic Claude models. You cannot use it with other providers (OpenAI, Bedrock, etc.).
:::

- **Max file size:** 500 MB | **Total storage:** 100 GB per org
- **Pricing:** File API operations are free. File content used in Messages requests is priced as input tokens.

**Supported models by file type:**
- **Images:** All Claude 3+ models
- **PDFs:** All Claude 3.5+ models
- **Other file types** (for code execution): Claude 3.5 Haiku + all Claude 3.7+ models

### Quick Start

```python
import litellm
import os

os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

# 1. Upload a file once
file = litellm.create_file(
    file=open("document.pdf", "rb"),
    purpose="messages",
    custom_llm_provider="anthropic",
)

# 2. Use file_id in messages (no re-upload needed)
response = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Summarize this document"},
            {"type": "file", "file": {"file_id": file.id, "format": "application/pdf"}}
        ]
    }]
)
```

### File Operations

| Operation | Function |
|-----------|----------|
| Upload | `litellm.create_file(file, purpose="messages", custom_llm_provider="anthropic")` |
| List | `litellm.file_list(custom_llm_provider="anthropic")` |
| Retrieve | `litellm.file_retrieve(file_id, custom_llm_provider="anthropic")` |
| Delete | `litellm.file_delete(file_id, custom_llm_provider="anthropic")` |
| Download | `litellm.file_content(file_id, custom_llm_provider="anthropic")` |

:::note
Download only works for files created by the [code execution tool](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/code-execution-tool), not uploaded files.
:::

### Supported Formats

| File Type | Format Value |
|-----------|-------------|
| PDF | `application/pdf` |
| Plain text | `text/plain` |
| JPEG | `image/jpeg` |
| PNG | `image/png` |
| GIF | `image/gif` |
| WebP | `image/webp` |

### Using Images

```python
# Upload image
image = litellm.create_file(
    file=open("photo.jpg", "rb"),
    purpose="messages",
    custom_llm_provider="anthropic",
)

# Use in message
response = litellm.completion(
    model="anthropic/{{anthropic}}",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "file", "file": {"file_id": image.id, "format": "image/jpeg"}}
        ]
    }]
)
```

## Usage - passing 'user_id' to Anthropic

LiteLLM translates the OpenAI `user` param to Anthropic's `metadata[user_id]` param.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = completion(
    model="{{anthropic}}",
    messages=messages,
    user="user_123",
)
```
</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
    - model_name: {{anthropic}}
      litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start Proxy

```
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR-LITELLM-KEY>" \
  -d '{
    "model": "{{anthropic}}",
    "messages": [{"role": "user", "content": "What is Anthropic?"}],
    "user": "user_123"
  }'
```

</TabItem>
</Tabs>


## Usage - Agent Skills

LiteLLM supports using Agent Skills with the API

<Tabs>
<TabItem value="sdk" label="SDK">

```python
response = completion(
    model="{{anthropic}}",
    messages=messages,
    tools= [
        {
            "type": "code_execution_20250825",
            "name": "code_execution"
        }
    ],
    container= {
        "skills": [
            {
                "type": "anthropic",
                "skill_id": "pptx",
                "version": "latest"
            }
        ]
    }
)
```
</TabItem>
<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
model_list:
    - model_name: {{anthropic}}
      litellm_params:
        model: anthropic/{{anthropic}}
        api_key: os.environ/ANTHROPIC_API_KEY
```

2. Start Proxy

```
litellm --config /path/to/config.yaml
```

3. Test it! 

```bash
curl --location 'http://localhost:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <YOUR-LITELLM-KEY>' \
--data '{
    "model": "{{anthropic}}",
    "messages": [
        {
            "role": "user",
            "content": "Hi"
        }
    ],
    "tools": [
        {
            "type": "code_execution_20250825",
            "name": "code_execution"
        }
    ],
    "container": {
        "skills": [
            {
                "type": "anthropic",
                "skill_id": "pptx",
                "version": "latest"
            }
        ]
    }
}'
```

</TabItem>
</Tabs>

The container and its "id" will be present in "provider_specific_fields" in streaming/non-streaming response
