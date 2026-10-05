# Search1API Search

**Get API Key:** [https://app.s1.dev/api-keys](https://app.s1.dev/api-keys)

[Search1API](https://s1.dev) is a web search API for AI agents that fronts Google, Bing, DuckDuckGo, Yahoo and site-specific engines (GitHub, arXiv, Reddit, YouTube, Wikipedia and more) behind one endpoint. One search costs 1 credit.

## LiteLLM Python SDK

```python showLineNumbers title="Search1API Search"
import os
from litellm import search

os.environ["SEARCH1API_API_KEY"] = "..."

response = search(
    query="latest AI developments",
    search_provider="search1api",
    max_results=5
)

for result in response.results:
    print(f"{result.title}: {result.url}")
    print(f"Snippet: {result.snippet}\n")
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
  - search_tool_name: search1api-search
    litellm_params:
      search_provider: search1api
      api_key: os.environ/SEARCH1API_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/search1api-search \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Unified Parameters

| Unified spec parameter | Mapped to Search1API parameter |
|------------------------|-------------------------------|
| `max_results` | `max_results` (1-50; the unified default of 10 is sent when omitted) |
| `search_domain_filter` | `include_sites`; entries prefixed with `-` go to `exclude_sites` |
| `country` | *ignored (no equivalent; use `language` below)* |
| `max_tokens_per_page` | *ignored (no equivalent)* |

## Provider-specific Parameters

```python showLineNumbers title="Search1API Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["SEARCH1API_API_KEY"] = "..."

response = search(
    query="vector database benchmarks",
    search_provider="search1api",
    max_results=5,
    # Search1API-specific parameters
    search_service="github",   # google (default), bing, duckduckgo, yahoo, x, reddit,
                               # github, youtube, arxiv, wechat, bilibili, imdb, wikipedia
    time_range="month",        # day, week, month, year
    language="en",             # language code, e.g. en, zh, de
)

for result in response.results:
    print(result.title, result.url)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `search_service` | string | Engine to query. Defaults to `google` |
| `time_range` | string | `day`, `week`, `month` or `year` |
| `language` | string | Language code for the results, e.g. `en`, `zh`, `de` |
| `include_sites` | array | Only return results from these sites. Wins over `search_domain_filter` when both are given |
| `exclude_sites` | array | Drop results from these sites. Wins over `search_domain_filter` when both are given |

Search1API's `crawl_results` and `image` parameters are rejected with a `ValueError`: the unified response has no field for fetched page text or image URLs, and each fetched page would bill an extra credit that LiteLLM cost tracking cannot see. Call Search1API's `/crawl` endpoint directly when you need page content.

See the [Search1API search reference](https://s1.dev/docs/basic/search) for the full parameter set.

## Response Notes

Search1API returns `title`, `link` and `snippet` for each result, which map onto the unified `title`, `url` and `snippet` fields. There is no publication date, so `date` is always `null`.

Set `SEARCH1API_API_BASE` to override the default `https://api.search1api.com` endpoint. `SEARCH1API_KEY`, the variable Search1API's own CLI and SDKs read, is honored as a fallback when `SEARCH1API_API_KEY` is not set.
