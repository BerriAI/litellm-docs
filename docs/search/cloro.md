# cloro Search

**Get API Key:** [https://dashboard.cloro.dev/api-keys](https://dashboard.cloro.dev/api-keys?utm_source=litellm&utm_medium=byok)

<SinceVersion v="1.110.0" />

cloro returns live Google Search results (`POST https://api.cloro.dev/v1/monitor/google`). Each call returns one Google results page. A call costs 5 credits, and `include={"aioverview": True}` adds 2 credits. See the [cloro Google Search docs](https://cloro.dev/docs/api-reference/endpoint/monitor-google?utm_source=litellm&utm_medium=byok) for the request fields and the [credit costs](https://cloro.dev/docs/guides/providers?utm_source=litellm&utm_medium=byok).

## LiteLLM Python SDK

```python showLineNumbers title="cloro Search"
import os
from litellm import search

os.environ["CLORO_API_KEY"] = "your-api-key"

response = search(
    query="latest AI developments",
    search_provider="cloro",
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
  - search_tool_name: cloro-search
    litellm_params:
      search_provider: cloro
      api_key: os.environ/CLORO_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/cloro-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Parameter mapping

`country` is sent upper-cased as cloro's `country`. cloro requires a country, so LiteLLM sends `US` when you do not set one. `search_domain_filter` is added to the query as `site:` operators. cloro has no result count field, so LiteLLM cuts the results to `max_results` after the call. `max_tokens_per_page` has no cloro equivalent and is dropped.

Each result carries the standard `title`, `url` and `snippet`. Results whose link is empty or a Google redirect URL are left out. The other parts of the Google page are in `provider_metadata`: `peopleAlsoAsk` (the "People also ask" questions), `relatedSearches`, `ads` when Google shows them, and `aioverview` (the AI Overview text, `sources` and `citationPills`) when you send `include={"aioverview": True}` and Google shows one.

## Provider-specific Parameters

```python showLineNumbers title="cloro Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["CLORO_API_KEY"] = "your-api-key"

response = search(
    query="best rank tracker",
    search_provider="cloro",
    country="GB",
    # cloro-specific parameters
    include={"aioverview": True},           # Adds the Google AI Overview (+2 credits)
    device="mobile",                        # desktop (default), mobile, ios or android
    location="London,England,United Kingdom",  # City-level targeting
    pages=2,                                # Google results pages, 1 to 10 (+2 credits for each extra page)
)

overview = response.provider_metadata.get("aioverview")
```
