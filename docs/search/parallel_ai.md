# Parallel AI Search

**Get API Key:** [https://www.parallel.ai](https://www.parallel.ai)

## LiteLLM Python SDK

```python showLineNumbers title="Parallel AI Search"
import os
from litellm import search

os.environ["PARALLEL_AI_API_KEY"] = "..."

response = search(
    query="latest AI developments",
    search_provider="parallel_ai",
    max_results=5
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4
    litellm_params:
      model: gpt-4
      api_key: os.environ/OPENAI_API_KEY

search_tools:
  - search_tool_name: parallel-search
    litellm_params:
      search_provider: parallel_ai
      api_key: os.environ/PARALLEL_AI_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/parallel-search \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Provider-specific Parameters

Every parameter of Parallel's [v1 Search API](https://docs.parallel.ai/api-reference/search/search) can be passed. Flat parameters are mapped into the nested v1 request shape; anything else passes through to the request body as-is.

```python showLineNumbers title="Parallel AI Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["PARALLEL_AI_API_KEY"] = "..."  # PARALLEL_API_KEY works as a fallback

response = search(
    query="latest developments in quantum computing",
    search_provider="parallel_ai",
    max_results=5,
    mode="advanced",                       # 'turbo', 'basic' (default), or 'advanced'
    objective="find peer-reviewed research",  # natural-language search goal
    include_domains=["arxiv.org"],         # restrict results to these domains
    exclude_domains=["reddit.com"],        # drop results from these domains
    after_date="2026-01-01",               # only content published on/after this date
    location="us",                         # ISO 3166-1 alpha-2 geo-targeting
    max_chars_per_result=500,              # max excerpt characters per result
    max_chars_total=4000,                  # max excerpt characters across all results
    fetch_policy={"max_age_seconds": 600}, # cached vs live-fetch behavior
    session_id="session-123",              # ties related search/extract calls together
)
```

The legacy `processor` parameter still works: `'base'` maps to `mode='basic'` and `'pro'` to `mode='advanced'`.

## Response

Results follow LiteLLM's unified search format. Parallel's raw metadata is preserved on top: the response carries `search_id`, `session_id`, `parallel_usage` (billing SKUs), and `warnings`, and each result keeps its raw `excerpts` array alongside the joined `snippet`.

