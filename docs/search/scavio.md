# Scavio Search

**Get API Key:** [https://dashboard.scavio.dev/sign-up](https://dashboard.scavio.dev/sign-up)

Scavio returns Google web search results for any query. It covers the whole web, so it works as a replacement for a `google_pse` engine set to "Search the entire web", which Google discontinues on January 1, 2027.

## LiteLLM Python SDK

```python showLineNumbers title="Scavio Search"
import os
from litellm import search

os.environ["SCAVIO_API_KEY"] = "..."

response = search(
    query="latest AI developments",
    search_provider="scavio",
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
  - search_tool_name: scavio-search
    litellm_params:
      search_provider: scavio
      api_key: os.environ/SCAVIO_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/scavio-search \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## How the unified parameters map

`country` becomes Google's `gl` (lower-cased). `search_domain_filter` is folded into the query as `site:` operators, and a `-` prefix turns an entry into a `-site:` exclusion. Scavio returns one page of Google results per call, about ten organic results, so `max_results` caps the returned list rather than fetching more. `max_tokens_per_page` has no Scavio equivalent and is dropped.

## Provider-specific Parameters

```python showLineNumbers title="Scavio Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["SCAVIO_API_KEY"] = "..."

response = search(
    query="best coffee shops",
    search_provider="scavio",
    max_results=5,
    # Scavio-specific parameters
    hl="fr",                            # interface language
    location="Paris,Ile-de-France,France",  # canonical location name
    device="mobile",                    # 'desktop' or 'mobile'
    time_period="last_week",            # 'last_hour', 'last_day', 'last_week', 'last_month', 'last_year'
    start=10                            # result offset: 10 is page 2
)
```

`resolve_ai_overview` defaults to `false` here, since only organic results are returned and resolving an AI Overview adds a second request. See the [Scavio Google Search API reference](https://scavio.dev/docs/search-api) for the full parameter set, including `google_domain`, `uule`, `lr`, `cr`, `safe`, `nfpr` and `filter`.

To point at a different endpoint, set `api_base` in the tool's `litellm_params`. The default is `https://api.scavio.dev`.
