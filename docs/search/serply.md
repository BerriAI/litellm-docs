# Serply Search

**Get API Key:** [https://serply.io](https://serply.io)

:::info

Supported from LiteLLM v1.104.0+
:::

## LiteLLM Python SDK

```python showLineNumbers title="Serply Search"
import os
from litellm import search

os.environ["SERPLY_API_KEY"] = "..."

response = search(
    query="latest AI developments",
    search_provider="serply",
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
  - search_tool_name: serply-search
    litellm_params:
      search_provider: serply
      api_key: os.environ/SERPLY_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/serply-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Provider-specific Parameters

```python showLineNumbers title="Serply Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["SERPLY_API_KEY"] = "..."

response = search(
    query="latest tech news",
    search_provider="serply",
    max_results=5,
    country="US",                    # sent as Google's `gl`
    # Serply-specific parameters
    tbs="qdr:w",                     # time range: 'qdr:h', 'qdr:d', 'qdr:w', 'qdr:m', 'qdr:y'
    hl="en",                         # interface language
    start=10                         # result offset, for paging
)
```

`max_results` is sent as Serply's `num`. Serply serves one page of Google results, so asking for
more than about ten returns what the page holds rather than failing.

Domains are restricted through the unified `search_domain_filter`, where a `-` prefix excludes a
host. Both halves are expressed in Google's own syntax, so `["arxiv.org", "-spam.com"]` searches
`(your query) (site:arxiv.org) -site:spam.com`. Any parameter LiteLLM does not track is forwarded
to Serply untouched. See the [Serply docs](https://serply.io/docs) for the full parameter set.

Set `SERPLY_API_BASE` to override the default `https://api.serply.io/v1` endpoint.
