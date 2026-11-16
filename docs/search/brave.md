---
title: "Brave Search API with LiteLLM: Python and Gateway"
sidebar_label: "Brave Search"
description: "Add Brave web search to LiteLLM: set BRAVE_API_KEY, call search() in the Python SDK or /v1/search on the AI Gateway, and register it in config.yaml."
---
# Brave Search

The [Brave Search API](https://brave.com/search/api/) returns web results from Brave's own independent search index; LiteLLM exposes it through one `search()` call in the Python SDK and the `/v1/search` endpoint on the AI Gateway.

Get started by creating a free API key via https://brave.com/search/api/.

For documentation on other parameters supported by the Brave Search API, visit https://api-dashboard.search.brave.com/api-reference/web/search/post.

## LiteLLM Python SDK

```python showLineNumbers title="Brave Search"
import os
from litellm import search

os.environ["BRAVE_API_KEY"] = "BSATzx..."

response = search(
    query="Brave browser features",
    search_provider="brave",
    max_results=5
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: {{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

search_tools:
  - search_tool_name: brave-search
    litellm_params:
      search_provider: brave
      api_key: os.environ/BRAVE_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/brave-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "query": "Brave browser features", "max_results": 5 }'
```
