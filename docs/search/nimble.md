# Nimble Search

**Get API Key:** [https://online.nimbleway.com/settings/api-keys](https://online.nimbleway.com/settings/api-keys)

:::info

Supported from LiteLLM v1.98.0+
:::

## LiteLLM Python SDK

```python showLineNumbers title="Nimble Search"
import os
from litellm import search

os.environ["NIMBLE_API_KEY"] = "..."

response = search(
    query="latest AI developments",
    search_provider="nimble",
    max_results=5
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-5.6
    litellm_params:
      model: gpt-5.6
      api_key: os.environ/OPENAI_API_KEY

search_tools:
  - search_tool_name: nimble-search
    litellm_params:
      search_provider: nimble
      api_key: os.environ/NIMBLE_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/nimble-search \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Provider-specific Parameters

```python showLineNumbers title="Nimble Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["NIMBLE_API_KEY"] = "..."

response = search(
    query="latest tech news",
    search_provider="nimble",
    max_results=5,
    # Nimble-specific parameters
    focus="news",                    # 'serp', 'general', 'news', 'location', 'coding',
                                     # 'academic', 'geo', 'shopping', 'social'
    search_depth="deep",             # 'lite', 'fast', 'deep' ('fast' needs focus='general')
    time_range="week",               # 'hour', 'day', 'week', 'month', 'year'
    output_format="markdown"         # 'plain_text', 'markdown', 'simplified_html'
)
```

Domains can be restricted either through the unified `search_domain_filter`, where a `-` prefix excludes a host, or through Nimble's own `include_domains` and `exclude_domains`, which win when both are given. See the [Nimble Search API reference](https://docs.nimbleway.com/api-reference/search/search) for the full parameter set, including `content_type`, `start_date` and `end_date`.

Set `NIMBLE_API_BASE` to override the default `https://sdk.nimbleway.com/v2` endpoint.
