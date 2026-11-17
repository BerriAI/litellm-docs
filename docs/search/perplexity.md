---
title: "Perplexity Search API with LiteLLM: Setup"
sidebar_label: "Perplexity AI Search"
description: "Add Perplexity web search to LiteLLM: call search() in the Python SDK or /v1/search on the AI Gateway, with PERPLEXITYAI_API_KEY and max_results."
---
# Perplexity AI Search

The [Perplexity Search API](https://docs.perplexity.ai/api-reference/search-post) returns ranked web results from Perplexity's search index; LiteLLM exposes it through one `search()` call in the Python SDK and the `/v1/search` endpoint on the AI Gateway.

**Get API Key:** [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)

## LiteLLM Python SDK

```python showLineNumbers title="Perplexity Search"
import os
from litellm import search

os.environ["PERPLEXITYAI_API_KEY"] = "pplx-..."

response = search(
    query="latest AI developments",
    search_provider="perplexity",
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
  - search_tool_name: perplexity-search
    litellm_params:
      search_provider: perplexity
      api_key: os.environ/PERPLEXITYAI_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/perplexity-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

