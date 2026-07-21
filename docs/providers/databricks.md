import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Databricks

LiteLLM supports all models on Databricks

:::tip

**We support ALL Databricks models, just set `model=databricks/<any-model-on-databricks>` as a prefix when sending litellm requests**

:::

## Authentication

LiteLLM supports multiple authentication methods for Databricks. When more than one
is configured, they are resolved in this order of precedence:

1. **OAuth M2M** (`DATABRICKS_CLIENT_ID` + `DATABRICKS_CLIENT_SECRET`)
2. **Personal Access Token** (`DATABRICKS_API_KEY`)
3. **Named CLI profile** (`databricks_profile` param or `DATABRICKS_CONFIG_PROFILE`)
4. **Databricks SDK unified auth** (automatic fallback)

### OAuth M2M (Recommended for Production)

OAuth Machine-to-Machine authentication using Service Principal credentials is the **recommended method for production** deployments per Databricks Partner requirements.

```python
import os
from litellm import completion

# Set OAuth credentials (Service Principal)
os.environ["DATABRICKS_CLIENT_ID"] = "your-service-principal-application-id"
os.environ["DATABRICKS_CLIENT_SECRET"] = "your-service-principal-secret"
os.environ["DATABRICKS_API_BASE"] = "https://adb-xxx.azuredatabricks.net/serving-endpoints"

response = completion(
    model="databricks/databricks-dbrx-instruct",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

### Personal Access Token (PAT)

PAT authentication is supported for development and testing scenarios.

```python
import os
from litellm import completion

os.environ["DATABRICKS_API_KEY"] = "dapi..."  # Your Personal Access Token
os.environ["DATABRICKS_API_BASE"] = "https://adb-xxx.azuredatabricks.net/serving-endpoints"

response = completion(
    model="databricks/databricks-dbrx-instruct",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

### Named CLI Profile

If you already authenticate with the Databricks CLI, you can point LiteLLM at a named
profile from `~/.databrickscfg` instead of passing raw credentials. This uses the
Databricks SDK's unified auth under the hood (so cached `databricks auth login` tokens,
OAuth U2M, etc. all work).

```python
import os
from litellm import completion

# Option 1: per-request parameter
response = completion(
    model="databricks/databricks-dbrx-instruct",
    messages=[{"role": "user", "content": "Hello!"}],
    databricks_profile="my-workspace",  # profile name in ~/.databrickscfg
)

# Option 2: environment variable
os.environ["DATABRICKS_CONFIG_PROFILE"] = "my-workspace"
response = completion(
    model="databricks/databricks-dbrx-instruct",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

:::info

Profile auth requires the Databricks SDK: `uv add databricks-sdk`. The `databricks_profile`
parameter takes precedence over the `DATABRICKS_CONFIG_PROFILE` environment variable.

:::

### Databricks SDK Authentication (Automatic)

If no credentials are provided, LiteLLM will use the Databricks SDK for automatic authentication. This supports OAuth, Azure AD, and other unified auth methods configured in your environment.

```python
from litellm import completion

# No environment variables needed - uses Databricks SDK unified auth
# Requires: uv add databricks-sdk
response = completion(
    model="databricks/databricks-dbrx-instruct",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

## Unity AI Gateway

[Unity AI Gateway](https://docs.databricks.com/aws/en/ai-gateway/) (Mosaic AI Gateway)
is Databricks' governed inference front door. It exposes both the unified
OpenAI-compatible surface and **provider-native** API surfaces (Anthropic, Gemini,
OpenAI Responses), plus centralized usage logging and request tagging — all under
`https://<workspace-host>/ai-gateway/...`.

LiteLLM reaches these surfaces through the same `databricks/<model>` interface you
already use. No new provider prefix and no change to existing `/serving-endpoints`
configurations.

### Routing (surface selection)

The connector decides between the AI Gateway and the legacy `/serving-endpoints`
surface using this precedence:

1. **Explicit `api_base`** — a base ending in `/serving-endpoints` or `/ai-gateway`
   is honored verbatim (never rewritten). A custom endpoint path is also used as-is.
2. **`databricks_use_ai_gateway`** param or **`DATABRICKS_USE_AI_GATEWAY`** env var
   (tri-state): `true`/`force` → gateway, `false` → serving-endpoints.
3. **Auto (default)** — optimistic **gateway-first**. The connector targets the
   gateway with no preflight network probe; if a workspace doesn't serve the gateway,
   that is learned reactively from the response and the call transparently falls back
   to `/serving-endpoints` (cached per host).

**Escape hatch:** force the legacy surface any time with
`databricks_use_ai_gateway=False` (param) or `DATABRICKS_USE_AI_GATEWAY=false` (env).

### Provider-native APIs (by model family)

On the gateway, the connector automatically picks the best API surface for a model
based on its name:

| Model family | API surface | Gateway path |
|--------------|-------------|--------------|
| `*claude*` | Anthropic Messages | `/ai-gateway/anthropic/v1/messages` |
| `*gemini*` | Gemini `generateContent` | `/ai-gateway/gemini/v1beta/models/<endpoint>:generateContent` |
| `gpt-<n>` (e.g. `gpt-5`) | OpenAI Responses | `/ai-gateway/openai/v1/responses` |
| everything else (Llama, Qwen, gpt-oss, Gemma, DBRX, …) | Unified MLflow chat | `/ai-gateway/mlflow/v1/chat/completions` |

```python
import os
from litellm import completion

os.environ["DATABRICKS_API_KEY"] = "dapi..."
os.environ["DATABRICKS_API_BASE"] = "https://adb-xxx.azuredatabricks.net"  # bare host → gateway by default

# Routed natively via the AI Gateway based on the model family
completion(model="databricks/databricks-claude-3-7-sonnet", messages=[{"role": "user", "content": "Hi"}])
completion(model="databricks/databricks-gemini-2-5-pro", messages=[{"role": "user", "content": "Hi"}])
```

### `responses()` support

Databricks serves the Responses API across multiple surfaces, and no single surface
covers every model. LiteLLM tries a per-family ordered chain and, if every responses
surface rejects the model, falls back to chat-completions emulation:

| Model family | Responses surface order |
|--------------|-------------------------|
| `gpt-<n>` | native OpenAI Responses → Supervisor (`/ai-gateway/mlflow/v1/responses`) |
| `*claude*` | Supervisor → Open Responses |
| `*gemini*` | Open Responses (`/serving-endpoints/open-responses`) |
| others (gpt-oss, qwen, llama, …) | Open Responses → Supervisor |

```python
from litellm import responses

resp = responses(
    model="databricks/databricks-gpt-5",
    input="Write a haiku about governed inference.",
)
```

### Usage tagging

The AI Gateway can log per-request tags to `system.ai_gateway.usage`. Emit them via
the `databricks_ai_gateway_request_tags` param and/or litellm's standard `tags` list;
LiteLLM serializes them into the `Databricks-Ai-Gateway-Request-Tags` header (tag
params are stripped from the request body).

```python
from litellm import completion, embedding

completion(
    model="databricks/databricks-dbrx-instruct",
    messages=[{"role": "user", "content": "Hello!"}],
    databricks_ai_gateway_request_tags={"team": "fe", "env": "prod"},
    tags=["experiment:a"],
)

embedding(
    model="databricks/databricks-bge-large-en",
    input=["good morning from litellm"],
    tags=["team:fe", "env:prod"],
)
```

### Backward compatibility

Existing configurations are unaffected. An explicit
`api_base=".../serving-endpoints"` resolves to the exact same URL as before via a
pure in-memory lookup — no probe, no retry, and no added latency. Embeddings continue
to use `<base>/embeddings` with no gateway routing.

## Custom User-Agent for Partner Attribution

If you're building a product on top of LiteLLM that integrates with Databricks, you can pass your own partner identifier for proper attribution in Databricks telemetry.

The partner name will be prefixed to the LiteLLM user agent:

```python
# Via parameter
response = completion(
    model="databricks/databricks-dbrx-instruct",
    messages=[{"role": "user", "content": "Hello!"}],
    user_agent="mycompany/1.0.0",
)
# Resulting User-Agent: mycompany_litellm/1.79.1

# Via environment variable
os.environ["DATABRICKS_USER_AGENT"] = "mycompany/1.0.0"
# Resulting User-Agent: mycompany_litellm/1.79.1
```

| Input | Resulting User-Agent |
|-------|---------------------|
| (none) | `litellm/1.79.1` |
| `mycompany/1.0.0` | `mycompany_litellm/1.79.1` |
| `partner_product/2.5.0` | `partner_product_litellm/1.79.1` |
| `acme` | `acme_litellm/1.79.1` |

**Note:** The version from your custom user agent is ignored; LiteLLM's version is always used.

## Security

LiteLLM automatically redacts sensitive information (tokens, secrets, API keys) from all debug logs to prevent credential leakage. This includes:

- Authorization headers
- API keys and tokens
- Client secrets
- Personal access tokens (PATs)

## Usage

<Tabs>
<TabItem value="sdk" label="SDK">

### ENV VAR
```python
import os 
os.environ["DATABRICKS_API_KEY"] = ""
os.environ["DATABRICKS_API_BASE"] = ""
```

### Example Call

```python
from litellm import completion
import os
## set ENV variables
os.environ["DATABRICKS_API_KEY"] = "databricks key"
os.environ["DATABRICKS_API_BASE"] = "databricks base url" # e.g.: https://adb-3064715882934586.6.azuredatabricks.net/serving-endpoints

# Databricks dbrx-instruct call
response = completion(
    model="databricks/databricks-dbrx-instruct", 
    messages = [{ "content": "Hello, how are you?","role": "user"}]
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Add models to your config.yaml

  ```yaml
  model_list:
    - model_name: dbrx-instruct
      litellm_params:
        model: databricks/databricks-dbrx-instruct
        api_key: os.environ/DATABRICKS_API_KEY
        api_base: os.environ/DATABRICKS_API_BASE
        user_agent: "mycompany/1.0.0"  # Optional: for partner attribution
  ```



2. Start the proxy 

  ```bash
  $ litellm --config /path/to/config.yaml --debug
  ```

3. Send Request to LiteLLM Proxy Server

  <Tabs>

  <TabItem value="openai" label="OpenAI Python v1.0.0+">

  ```python
  import openai
  client = openai.OpenAI(
      api_key="sk-1234",             # pass litellm proxy key, if you're using virtual keys
      base_url="http://0.0.0.0:4000" # litellm-proxy-base url
  )

  response = client.chat.completions.create(
      model="dbrx-instruct",
      messages = [
        {
            "role": "system",
            "content": "Be a good human!"
        },
        {
            "role": "user",
            "content": "What do you know about earth?"
        }
    ]
  )

  print(response)
  ```

  </TabItem>

  <TabItem value="curl" label="curl">

  ```shell
  curl --location 'http://0.0.0.0:4000/chat/completions' \
      --header 'Authorization: Bearer sk-1234' \
      --header 'Content-Type: application/json' \
      --data '{
      "model": "dbrx-instruct",
      "messages": [
        {
            "role": "system",
            "content": "Be a good human!"
        },
        {
            "role": "user",
            "content": "What do you know about earth?"
        }
        ],
  }'
  ```
  </TabItem>

  </Tabs>


</TabItem>

</Tabs>

## Passing additional params - max_tokens, temperature 
See all litellm.completion supported params [here](../completion/input.md#translated-openai-params)

```python
# !uv add litellm
from litellm import completion
import os
## set ENV variables
os.environ["DATABRICKS_API_KEY"] = "databricks key"
os.environ["DATABRICKS_API_BASE"] = "databricks api base"

# databricks dbrx call
response = completion(
    model="databricks/databricks-dbrx-instruct", 
    messages = [{ "content": "Hello, how are you?","role": "user"}],
    max_tokens=20,
    temperature=0.5
)
```

**proxy**

```yaml
  model_list:
    - model_name: llama-3
      litellm_params:
        model: databricks/databricks-meta-llama-3-70b-instruct
        api_key: os.environ/DATABRICKS_API_KEY
        max_tokens: 20
        temperature: 0.5
```


## Usage - Thinking / `reasoning_content`

LiteLLM translates OpenAI's `reasoning_effort` to Anthropic's `thinking` parameter. [Code](https://github.com/BerriAI/litellm/blob/23051d89dd3611a81617d84277059cd88b2df511/litellm/llms/anthropic/chat/transformation.py#L298)

| reasoning_effort | thinking |
| ---------------- | -------- |
| "low"            | "budget_tokens": 1024 |
| "medium"         | "budget_tokens": 2048 |
| "high"           | "budget_tokens": 4096 |


Known Limitations:
- Support for passing thinking blocks back to Claude [Issue](https://github.com/BerriAI/litellm/issues/9790)
 

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

# set ENV variables (can also be passed in to .completion() - e.g. `api_base`, `api_key`)
os.environ["DATABRICKS_API_KEY"] = "databricks key"
os.environ["DATABRICKS_API_BASE"] = "databricks base url"

resp = completion(
    model="databricks/databricks-claude-3-7-sonnet",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    reasoning_effort="low",
)

```

</TabItem>

<TabItem value="proxy" label="PROXY">

1. Setup config.yaml

```yaml
- model_name: claude-3-7-sonnet
  litellm_params:
    model: databricks/databricks-claude-3-7-sonnet
    api_key: os.environ/DATABRICKS_API_KEY
    api_base: os.environ/DATABRICKS_API_BASE
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
    "model": "claude-3-7-sonnet",
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
    model='claude-3-7-sonnet-20250219',
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

### Citations

Anthropic models served through Databricks can return citation metadata. LiteLLM
exposes these via `response.choices[0].message.provider_specific_fields["citations"]`.

### Pass `thinking` to Anthropic models

You can also pass the `thinking` parameter to Anthropic models.


You can also pass the `thinking` parameter to Anthropic models.

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion
import os

# set ENV variables (can also be passed in to .completion() - e.g. `api_base`, `api_key`)
os.environ["DATABRICKS_API_KEY"] = "databricks key"
os.environ["DATABRICKS_API_BASE"] = "databricks base url"

response = litellm.completion(
  model="databricks/databricks-claude-3-7-sonnet",
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
    "model": "databricks/databricks-claude-3-7-sonnet",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "thinking": {"type": "enabled", "budget_tokens": 1024}
  }'
```

</TabItem>
</Tabs>





## Supported Databricks Chat Completion Models 

:::tip

**We support ALL Databricks models, just set `model=databricks/<any-model-on-databricks>` as a prefix when sending litellm requests**

:::


| Model Name                 | Command                                                          |
|----------------------------|------------------------------------------------------------------|
| databricks/databricks-claude-3-7-sonnet    | `completion(model='databricks/databricks/databricks-claude-3-7-sonnet', messages=messages)`   | 
| databricks-meta-llama-3-1-70b-instruct    | `completion(model='databricks/databricks-meta-llama-3-1-70b-instruct', messages=messages)`   | 
| databricks-meta-llama-3-1-405b-instruct    | `completion(model='databricks/databricks-meta-llama-3-1-405b-instruct', messages=messages)`   | 
| databricks-dbrx-instruct    | `completion(model='databricks/databricks-dbrx-instruct', messages=messages)`   | 
| databricks-meta-llama-3-70b-instruct    | `completion(model='databricks/databricks-meta-llama-3-70b-instruct', messages=messages)`   | 
| databricks-llama-2-70b-chat    | `completion(model='databricks/databricks-llama-2-70b-chat', messages=messages)`   | 
| databricks-mixtral-8x7b-instruct    | `completion(model='databricks/databricks-mixtral-8x7b-instruct', messages=messages)`   | 
| databricks-mpt-30b-instruct    | `completion(model='databricks/databricks-mpt-30b-instruct', messages=messages)`   | 
| databricks-mpt-7b-instruct    | `completion(model='databricks/databricks-mpt-7b-instruct', messages=messages)`   | 


## Embedding Models

### Passing Databricks specific params - 'instruction'

For embedding models, databricks lets you pass in an additional param 'instruction'. [Full Spec](https://github.com/BerriAI/litellm/blob/43353c28b341df0d9992b45c6ce464222ebd7984/litellm/llms/databricks.py#L164)


```python
# !uv add litellm
from litellm import embedding
import os
## set ENV variables
os.environ["DATABRICKS_API_KEY"] = "databricks key"
os.environ["DATABRICKS_API_BASE"] = "databricks url"

# Databricks bge-large-en call
response = litellm.embedding(
      model="databricks/databricks-bge-large-en",
      input=["good morning from litellm"],
      instruction="Represent this sentence for searching relevant passages:",
  )
```

**proxy**

```yaml
  model_list:
    - model_name: bge-large
      litellm_params:
        model: databricks/databricks-bge-large-en
        api_key: os.environ/DATABRICKS_API_KEY
        api_base: os.environ/DATABRICKS_API_BASE
        instruction: "Represent this sentence for searching relevant passages:"
```

## Supported Databricks Embedding Models 

:::tip

**We support ALL Databricks models, just set `model=databricks/<any-model-on-databricks>` as a prefix when sending litellm requests**

:::


| Model Name                 | Command                                                          |
|----------------------------|------------------------------------------------------------------|
| databricks-bge-large-en    | `embedding(model='databricks/databricks-bge-large-en', messages=messages)`   |
| databricks-gte-large-en    | `embedding(model='databricks/databricks-gte-large-en', messages=messages)`   |
