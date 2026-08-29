import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Azure AI Studio

LiteLLM supports all models on Azure AI Studio


## Usage

<Tabs>
<TabItem value="sdk" label="SDK">

### ENV VAR
```python
import os 
os.environ["AZURE_AI_API_KEY"] = ""
os.environ["AZURE_AI_API_BASE"] = ""
```

### Example Call

```python
from litellm import completion
import os
## set ENV variables
os.environ["AZURE_AI_API_KEY"] = "azure ai key"
os.environ["AZURE_AI_API_BASE"] = "azure ai base url" # e.g.: https://Mistral-large-dfgfj-serverless.eastus2.inference.ai.azure.com/

# predibase llama-3 call
response = completion(
    model="azure_ai/command-r-plus", 
    messages = [{ "content": "Hello, how are you?","role": "user"}]
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

1. Add models to your config.yaml

  ```yaml
  model_list:
    - model_name: command-r-plus
      litellm_params:
        model: azure_ai/command-r-plus
        api_key: os.environ/AZURE_AI_API_KEY
        api_base: os.environ/AZURE_AI_API_BASE
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
      model="command-r-plus",
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
      "model": "command-r-plus",
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

## Entra ID / OAuth authentication

Every `azure_ai` route accepts Microsoft Entra ID (formerly Azure AD) credentials instead of an API key, so you don't have to mint and rotate a key per Foundry project. When no API key is configured, LiteLLM acquires an access token and sends it as `Authorization: Bearer <token>`; when a key is configured, the key wins and no token is requested.

This works for chat and completions, embeddings, rerank, OCR (including Azure Document Intelligence), image generation and image edits (FLUX and MAI), and agents.

### Credential types

Pass any one of the following in `litellm_params` (proxy) or as kwargs to the SDK call. Each one also has an environment variable fallback, so a proxy-wide setup can rely on the environment alone.

| Credential | Params | Environment variables |
|---|---|---|
| Service principal | `tenant_id`, `client_id`, `client_secret` | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` |
| Pre-fetched access token | `azure_ad_token` | `AZURE_AD_TOKEN` |
| OIDC federated token | `azure_ad_token` set to `oidc/<token>`, plus `tenant_id` and `client_id` | `AZURE_AD_TOKEN`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` |
| Username and password | `azure_username`, `azure_password`, `client_id` | `AZURE_USERNAME`, `AZURE_PASSWORD`, `AZURE_CLIENT_ID` |
| Managed identity or `DefaultAzureCredential` | none; set `litellm.enable_azure_ad_token_refresh = True` (`litellm_settings.enable_azure_ad_token_refresh: true` on the proxy) | `AZURE_CREDENTIAL` to pin a credential type |
| Custom provider | `azure_ad_token_provider`, a callable returning a token (SDK only) | n/a |

The token is requested for `https://cognitiveservices.azure.com/.default` by default. Override it with `azure_scope` (or `AZURE_SCOPE`) when your resource expects a different audience, for example `https://ai.azure.com/.default` for Foundry agents.

Token providers are cached per tenant, client and scope, and the underlying credential caches the access token until it nears expiry, so a busy deployment does one token acquisition per token lifetime rather than one per request.

<Tabs>
<TabItem value="proxy" label="PROXY">

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: command-r-plus
    litellm_params:
      model: azure_ai/command-r-plus
      api_base: os.environ/AZURE_AI_API_BASE
      tenant_id: os.environ/AZURE_TENANT_ID
      client_id: os.environ/AZURE_CLIENT_ID
      client_secret: os.environ/AZURE_CLIENT_SECRET

  - model_name: cohere-embed
    litellm_params:
      model: azure_ai/cohere-embed-v3-english
      api_base: os.environ/AZURE_AI_API_BASE
      tenant_id: os.environ/AZURE_TENANT_ID
      client_id: os.environ/AZURE_CLIENT_ID
      client_secret: os.environ/AZURE_CLIENT_SECRET

  - model_name: doc-intelligence
    litellm_params:
      model: azure_ai/doc-intelligence/prebuilt-layout
      api_base: os.environ/AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
      tenant_id: os.environ/AZURE_TENANT_ID
      client_id: os.environ/AZURE_CLIENT_ID
      client_secret: os.environ/AZURE_CLIENT_SECRET
```

To use a managed identity on the host instead of a service principal, drop the credential params and enable token refresh:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: command-r-plus
    litellm_params:
      model: azure_ai/command-r-plus
      api_base: os.environ/AZURE_AI_API_BASE

litellm_settings:
  enable_azure_ad_token_refresh: true
```

</TabItem>
<TabItem value="sdk" label="SDK">

```python showLineNumbers title="Service principal"
import os
from litellm import completion, embedding

os.environ["AZURE_AI_API_BASE"] = "https://your-resource.services.ai.azure.com"

response = completion(
    model="azure_ai/command-r-plus",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    tenant_id=os.environ["AZURE_TENANT_ID"],
    client_id=os.environ["AZURE_CLIENT_ID"],
    client_secret=os.environ["AZURE_CLIENT_SECRET"],
)

embeddings = embedding(
    model="azure_ai/cohere-embed-v3-english",
    input=["good morning from litellm"],
    tenant_id=os.environ["AZURE_TENANT_ID"],
    client_id=os.environ["AZURE_CLIENT_ID"],
    client_secret=os.environ["AZURE_CLIENT_SECRET"],
)
```

```python showLineNumbers title="Managed identity / DefaultAzureCredential"
import litellm

litellm.enable_azure_ad_token_refresh = True

response = litellm.completion(
    model="azure_ai/command-r-plus",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)
```

```python showLineNumbers title="Your own token provider"
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

response = litellm.completion(
    model="azure_ai/command-r-plus",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    azure_ad_token_provider=token_provider,
)
```

</TabItem>
</Tabs>

## Passing additional params - max_tokens, temperature 
See all litellm.completion supported params [here](../completion/input.md#translated-openai-params)

```python
# !uv add litellm
from litellm import completion
import os
## set ENV variables
os.environ["AZURE_AI_API_KEY"] = "azure ai api key"
os.environ["AZURE_AI_API_BASE"] = "azure ai api base"

# command r plus call
response = completion(
    model="azure_ai/command-r-plus", 
    messages = [{ "content": "Hello, how are you?","role": "user"}],
    max_tokens=20,
    temperature=0.5
)
```

**proxy**

```yaml
  model_list:
    - model_name: command-r-plus
      litellm_params:
        model: azure_ai/command-r-plus
        api_key: os.environ/AZURE_AI_API_KEY
        api_base: os.environ/AZURE_AI_API_BASE
        max_tokens: 20
        temperature: 0.5
```



2. Start the proxy 

  ```bash
  $ litellm --config /path/to/config.yaml
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
      model="mistral",
      messages = [
          {
              "role": "user",
              "content": "what llm are you"
          }
      ],
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
      "model": "mistral",
      "messages": [
          {
          "role": "user",
          "content": "what llm are you"
          }
      ],
  }'
  ```
  </TabItem>

  </Tabs>

## Function Calling 

<Tabs>
<TabItem value="sdk" label="SDK">

```python
from litellm import completion

# set env
os.environ["AZURE_AI_API_KEY"] = "your-api-key"
os.environ["AZURE_AI_API_BASE"] = "your-api-base"

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
    model="azure_ai/mistral-large-latest",
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

</TabItem>

<TabItem value="proxy" label="PROXY">

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $YOUR_API_KEY" \
-d '{
  "model": "mistral",
  "messages": [
    {
      "role": "user",
      "content": "What'\''s the weather like in Boston today?"
    }
  ],
  "tools": [
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
              "description": "The city and state, e.g. San Francisco, CA"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"]
            }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}'

```

</TabItem>
</Tabs>

## Supported Models

LiteLLM supports **ALL** azure ai models. Here's a few examples:

| Model Name               | Function Call                                                                                                                                                      |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Cohere command-r-plus | `completion(model="azure_ai/command-r-plus", messages)` | 
| Cohere command-r | `completion(model="azure_ai/command-r", messages)` | 
| mistral-large-latest | `completion(model="azure_ai/mistral-large-latest", messages)` | 
| AI21-Jamba-Instruct | `completion(model="azure_ai/ai21-jamba-instruct", messages)` | 

## Usage - Azure Anthropic (Azure Foundry Claude)

LiteLLM funnels Azure Claude deployments through the `azure_ai/` provider so Claude Opus models on Azure Foundry keep working with Tool Search, Effort, streaming, and the rest of the advanced feature set. Point `AZURE_AI_API_BASE` to `https://<resource>.services.ai.azure.com/anthropic` (LiteLLM appends `/v1/messages` automatically) and authenticate with `AZURE_AI_API_KEY` or an Azure AD token.

<Tabs>
<TabItem value="sdk" label="LiteLLM Python SDK">

```python
import os
from litellm import completion

# Configure Azure credentials
os.environ["AZURE_AI_API_KEY"] = "your-azure-ai-api-key"
os.environ["AZURE_AI_API_BASE"] = "https://my-resource.services.ai.azure.com/anthropic"

response = completion(
    model="azure_ai/claude-opus-4-1",
    messages=[{"role": "user", "content": "Explain how Azure Anthropic hosts Claude Opus differently from the public Anthropic API."}],
    max_tokens=1200,
    temperature=0.7,
    stream=True,
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Set environment variables**

```bash
export AZURE_AI_API_KEY="your-azure-ai-api-key"
export AZURE_AI_API_BASE="https://my-resource.services.ai.azure.com/anthropic"
```

**2. Configure the proxy**

```yaml
model_list:
  - model_name: claude-4-azure
    litellm_params:
      model: azure_ai/claude-opus-4-1
      api_key: os.environ/AZURE_AI_API_KEY
      api_base: os.environ/AZURE_AI_API_BASE
```

**3. Start LiteLLM**

```bash
litellm --config /path/to/config.yaml
```

**4. Test the Azure Claude route**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer $LITELLM_KEY' \
  --data '{
    "model": "claude-4-azure",
    "messages": [
      {
        "role": "user",
        "content": "How do I use Claude Opus 4 via Azure Anthropic in LiteLLM?"
      }
    ],
    "max_tokens": 1024
  }'
```

</TabItem>
</Tabs>



## Rerank Endpoint

### Usage



<Tabs>
<TabItem value="sdk" label="LiteLLM SDK Usage">

```python
from litellm import rerank
import os

os.environ["AZURE_AI_API_KEY"] = "sk-.."
os.environ["AZURE_AI_API_BASE"] = "https://.."

query = "What is the capital of the United States?"
documents = [
    "Carson City is the capital city of the American state of Nevada.",
    "The Commonwealth of the Northern Mariana Islands is a group of islands in the Pacific Ocean. Its capital is Saipan.",
    "Washington, D.C. is the capital of the United States.",
    "Capital punishment has existed in the United States since before it was a country.",
]

response = rerank(
    model="azure_ai/cohere-rerank-v3.5",
    query=query,
    documents=documents,
    top_n=3,
)
print(response)
```
</TabItem>

<TabItem value="proxy" label="LiteLLM Proxy Usage">

LiteLLM provides an cohere api compatible `/rerank` endpoint for Rerank calls.

**Setup**

Add this to your litellm proxy config.yaml

```yaml
model_list:
  - model_name: Salesforce/Llama-Rank-V1
    litellm_params:
      model: together_ai/Salesforce/Llama-Rank-V1
      api_key: os.environ/TOGETHERAI_API_KEY
  - model_name: cohere-rerank-v3.5
    litellm_params:
      model: azure_ai/cohere-rerank-v3.5
      api_key: os.environ/AZURE_AI_API_KEY
      api_base: os.environ/AZURE_AI_API_BASE
```

Start litellm

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

Test request

```bash
curl http://0.0.0.0:4000/rerank \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cohere-rerank-v3.5",
    "query": "What is the capital of the United States?",
    "documents": [
        "Carson City is the capital city of the American state of Nevada.",
        "The Commonwealth of the Northern Mariana Islands is a group of islands in the Pacific Ocean. Its capital is Saipan.",
        "Washington, D.C. is the capital of the United States.",
        "Capital punishment has existed in the United States since before it was a country."
    ],
    "top_n": 3
  }'
```

</TabItem>
</Tabs>

