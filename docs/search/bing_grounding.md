# Grounding with Bing Search (Microsoft Foundry)

[Grounding with Bing Search](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools/bing-grounding) runs a web search through a model deployment in a [Microsoft Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/) project, using the project's Responses API. The model performs the search and returns cited results, so search traffic stays inside your Foundry project and is billed by Azure

There are two modes, chosen by whether you set a Grounding with Bing connection:

- **Web search mode** (default): the model's built-in `web_search` tool. It needs no Bing resource and pays no per-search Bing fee, so LiteLLM tracks it at zero cost
- **Connection mode**: the paid Grounding with Bing (G1) connection, selected with `BING_GROUNDING_CONNECTION_ID`. LiteLLM tracks it at the `bing_grounding/search` map price

Both modes call the same model deployment, whose token usage is billed by Azure on your Foundry account

| | |
|---|---|
| Provider ID | `bing_grounding` |
| Project endpoint | `BING_GROUNDING_PROJECT_ENDPOINT`, or `api_base` |
| Model deployment | `BING_GROUNDING_MODEL` (required) |
| Auth (Azure API key) | `api_key`, sent as the `api-key` header |
| Auth (Entra token) | `BING_GROUNDING_TOKEN`, sent as `Authorization: Bearer` |
| Auth (azure-identity) | any `DefaultAzureCredential` source, for scope `https://ai.azure.com/.default` |
| Grounding with Bing connection | `BING_GROUNDING_CONNECTION_ID` (optional, switches to connection mode) |

The project endpoint looks like `https://<account>.services.ai.azure.com/api/projects/<project>`

## LiteLLM Python SDK

```python showLineNumbers title="Grounding with Bing Search"
import os
from litellm import search

os.environ["BING_GROUNDING_PROJECT_ENDPOINT"] = "https://<account>.services.ai.azure.com/api/projects/<project>"
os.environ["BING_GROUNDING_MODEL"] = "{{openai_large}}"
os.environ["BING_GROUNDING_TOKEN"] = "<entra bearer token>"

response = search(
    query="latest AI developments",
    search_provider="bing_grounding",
    max_results=5
)

for result in response.results:
    print(f"{result.title}: {result.url}")
    print(f"Snippet: {result.snippet}\n")
```

### Authentication

Pass an Azure API key per call, and it rides the `api-key` header:

```python showLineNumbers title="Grounding with Bing Search with an Azure API key"
response = search(
    query="latest AI developments",
    search_provider="bing_grounding",
    api_key=os.environ["AZURE_AI_API_KEY"]
)
```

Or omit `BING_GROUNDING_TOKEN` and `api_key` to mint an Entra token from the standard [azure-identity](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme) chain (`AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID`, a shared profile, managed identity, or any other `DefaultAzureCredential` source) for scope `https://ai.azure.com/.default`

### Connection mode (paid Grounding with Bing)

Set `BING_GROUNDING_CONNECTION_ID` to the project connection for a Grounding with Bing (G1) resource. The model then searches through that paid connection instead of the built-in tool, and LiteLLM tracks the `bing_grounding/search` cost:

```python showLineNumbers title="Grounding with Bing Search in connection mode"
os.environ["BING_GROUNDING_CONNECTION_ID"] = (
    "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices"
    "/accounts/<account>/projects/<project>/connections/<bing-connection>"
)

response = search(
    query="latest AI developments",
    search_provider="bing_grounding",
    max_results=5
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
search_tools:
  - search_tool_name: bing-grounding-search
    litellm_params:
      search_provider: bing_grounding
```

Set `BING_GROUNDING_PROJECT_ENDPOINT`, `BING_GROUNDING_MODEL`, and one of the auth options in the proxy's environment. `BING_GROUNDING_CONNECTION_ID` is optional and switches to connection mode

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/bing-grounding-search \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Web search interception

Grounding with Bing Search is a natural backend for [web search interception](../completion/web_search), which serves a model's native `web_search` tool from a search provider. Point the interception at the configured tool:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

search_tools:
  - search_tool_name: bing-grounding-search
    litellm_params:
      search_provider: bing_grounding

litellm_settings:
  callbacks: ["websearch_interception"]
  websearch_interception_params:
    enabled_providers: ["openai"]
    search_tool_name: bing-grounding-search
```

## Unified Parameters

| Unified spec parameter | Web search mode | Connection mode |
|---|---|---|
| `max_results` | caps the returned results after the fact (the built-in tool has no count knob) | maps to the search configuration's `count` |
| `country` | maps to the approximate `user_location` | _ignored (the connection's `market` wants a full locale, which a bare country code cannot fill)_ |
| `search_domain_filter` | _ignored (no equivalent)_ | _ignored (no equivalent)_ |
| `max_tokens_per_page` | _ignored (no equivalent)_ | _ignored (no equivalent)_ |

## Notes

Web search mode is tracked at zero cost because the built-in `web_search` tool pays no per-search Bing fee. Connection mode is tracked at the `bing_grounding/search` map price, the Grounding with Bing (G1) per-search fee. The model deployment's token usage is billed separately by Azure on your Foundry account

The Entra token (`BING_GROUNDING_TOKEN` or one minted via azure-identity) is only sent to the endpoint configured in `BING_GROUNDING_PROJECT_ENDPOINT`, so a caller-supplied `api_base` cannot exfiltrate it. A caller-supplied `api_key` is treated as an Azure API key and sent in the `api-key` header instead

LiteLLM posts to `<project-endpoint>/openai/v1/responses`, appending the path automatically if the endpoint does not already end in it

If the grounded search comes back `failed` or `incomplete` with no results, LiteLLM raises an error rather than returning an empty success, so a failed search is not logged as a normal zero-result hit
