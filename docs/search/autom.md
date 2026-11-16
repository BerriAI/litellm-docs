---
title: "Autom Google Search API with LiteLLM"
sidebar_label: "Autom Search"
description: "Add Autom Google results to LiteLLM: call search() in the Python SDK or /v1/search on the AI Gateway, with country, language, location and time filters."
---
# Autom Search

[Autom](https://autom.dev) is a SERP API that returns live Google Search results as JSON; LiteLLM exposes it through one `search()` call in the Python SDK and the `/v1/search` endpoint on the AI Gateway.

**Get API Key:** [https://app.autom.dev](https://app.autom.dev)

<SinceVersion v="1.111.0" />

LiteLLM sends `GET https://api.autom.dev/v1/google/search` with the key in the `x-api-key` header, never in the URL. Each call returns one Google results page. See the [Autom docs](https://docs.autom.dev) for the request fields.

## LiteLLM Python SDK

```python showLineNumbers title="Autom Search"
import os
from litellm import search

os.environ["AUTOM_API_KEY"] = "your-api-key"

response = search(
    query="latest AI developments",
    search_provider="autom",
    country="US",
)

for result in response.results:
    print(result.title, result.url)
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
  - search_tool_name: autom-search
    litellm_params:
      search_provider: autom
      api_key: os.environ/AUTOM_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/autom-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "country": "US"
  }'
```

## Parameter mapping

`country` is sent lower-cased as Autom's `gl`. A list `query` is joined with spaces. `search_domain_filter` is added to the query as `site:` operators: several domains are joined with `OR`, and a domain with a leading `-` becomes a `-site:` exclusion, so `["a.com", "b.com", "-c.com"]` turns `docs` into `(docs) (site:a.com OR site:b.com) -site:c.com`. `max_results` and `max_tokens_per_page` have no Autom equivalent and are not sent; the response holds every organic result on the returned page, so `max_results` does not cut the list.

Each result carries `title`, `url` and `snippet` from Autom's `organic_results`, and `date` when Autom returns one. Rows whose link is not an `http` or `https` URL are left out. The response has no `provider_metadata`.

`AUTOM_API_BASE` changes the base URL (default `https://api.autom.dev`); LiteLLM appends `/v1/google/search` unless the base already ends with it. The server's `AUTOM_API_KEY` is sent only to the default host or to `AUTOM_API_BASE`. A request that sets another `api_base` has to pass its own `api_key`.

## Provider-specific Parameters

Any other parameter is passed through to Autom's query string as is. When you set both `country` and `gl`, `country` wins.

```python showLineNumbers title="Autom Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["AUTOM_API_KEY"] = "your-api-key"

response = search(
    query="best running shoes",
    search_provider="autom",
    country="FR",
    # Autom-specific parameters
    hl="fr",                       # Interface language
    location="Paris, France",      # Human-readable location
    google_domain="google.fr",     # Google domain (default google.com)
    tbs="qdr:w",                   # Time filter: past week ('qdr:d' day, 'qdr:m' month)
    safe="active",                 # SafeSearch: 'active' or 'off'
    page=2,                        # Results page, 1 for the first
)
```

## Cost tracking

LiteLLM prices an Autom search at $0.001 per query (`autom/search` in the model cost map), the Starter plan rate of 1 credit per query. Failed requests are not billed by Autom.
