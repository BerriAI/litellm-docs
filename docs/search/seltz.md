---
title: "Seltz Search API with LiteLLM: Python and Gateway"
sidebar_label: "Seltz Search"
description: "Add Seltz web search to LiteLLM: call search() in the Python SDK or /v1/search on the AI Gateway, with scope, tier and domain filters."
---
# Seltz Search

[Seltz](https://seltz.ai?utm_source=litellm&utm_medium=integration&utm_campaign=marketplace) is a web search API built for AI agents; LiteLLM exposes it through one `search()` call in the Python SDK and the `/v1/search` endpoint on the AI Gateway.

**Get API Key:** [https://console.seltz.ai/api-keys?utm_source=litellm&utm_medium=integration&utm_campaign=marketplace](https://console.seltz.ai/api-keys?utm_source=litellm&utm_medium=integration&utm_campaign=marketplace)

LiteLLM sends `POST https://api.seltz.ai/v1/search`. Set `SELTZ_API_KEY`, or pass `api_key`. The key goes in the `x-api-key` header. See the [Seltz Search API](https://docs.seltz.ai/api-reference/search?utm_source=litellm&utm_medium=integration&utm_campaign=marketplace).

The default host is `https://api.seltz.ai`. Set `api_base` on the SDK call or the proxy search tool, or set `SELTZ_API_BASE`, to use another host. `/v1/search` is appended once. A base that already ends in `/v1/search` is left as it is. Pass `api_key` together with a caller-selected `api_base`. The key in `SELTZ_API_KEY` is not sent to that host. `SELTZ_API_KEY` with `SELTZ_API_BASE` is used when the call omits `api_base`.

## LiteLLM Python SDK

```python showLineNumbers title="Seltz Search"
import os
from litellm import search

os.environ["SELTZ_API_KEY"] = "..."

response = search(
    query="latest AI developments",
    search_provider="seltz",
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
  - search_tool_name: seltz-search
    litellm_params:
      search_provider: seltz
      api_key: os.environ/SELTZ_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/seltz-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Parameters

| LiteLLM parameter | Seltz request |
| --- | --- |
| `query` | `query`. A list of queries is joined with spaces |
| `max_results` | `max_results` |
| `search_domain_filter` | `include_domains`. A native `include_domains` on the same call is sent in its place |
| `country` | Not forwarded |
| `max_tokens_per_page` | Not forwarded. Set content and snippet size with `fields` |

`scope`, `tier`, `exclude_domains`, `from_date`, `to_date`, `fields`, and `include_domains` pass through. `tier` is forwarded as written. Seltz matches that name without case or surrounding whitespace, and the name selects the price. See [Seltz pricing](https://docs.seltz.ai/pricing?utm_source=litellm&utm_medium=integration&utm_campaign=marketplace).

`scope` limits the corpus. The values are `web` (beta; the default when `scope` is omitted), `news`, `wikipedia`, `people`, `companies`, and `financial-reports`. A scope that does not exist, or that the key cannot reach, returns 404. `tier` is `base` or `pro`. Omitting `tier` selects `pro`. `base` returns first-stage ranking, and `pro` adds a ranking stage. Seltz rejects a tier name other than those two. `exclude_domains` drops results from those domains. `from_date` and `to_date` keep documents published on or after, and on or before, that point: a date, a UTC datetime, or an offset such as `now-7d`. `fields` selects `content`, `snippets`, and `properties`. `content` and `snippets` take `true`, `false`, or an options object. `properties` is returned unless it is `false` or an empty list.

```python showLineNumbers title="Seltz Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["SELTZ_API_KEY"] = "..."

response = search(
    query=["latest", "AI developments"],
    search_provider="seltz",
    max_results=5,
    search_domain_filter=["example.com"],
    scope="news",
    tier="base",
    exclude_domains=["spam.example"],
    from_date="now-7d",
    to_date="2025-10-28",
    fields={"snippets": True}
)
```

That call sends `query` as `"latest AI developments"` and `search_domain_filter` as `include_domains`. `tier` stays `"base"`.

## Response

Seltz documents have no title, so `title` is empty. `content` is copied to `snippet`, and also kept on the result when it is a string. When `content` is empty, `snippet` is the `snippets` text values joined with newlines. `published_date` is copied to `date`. `properties` and `snippets` stay on the result when Seltz returns them, and `request_id` stays on the response. Other document and response fields are kept. `title`, `url`, `snippet`, `date`, `object`, and `results` keep these mapped values when the payload also sends those keys. `last_updated` is null.

```json title="Seltz search response"
{
  "object": "search",
  "request_id": "req-1",
  "results": [
    {
      "title": "",
      "url": "https://example.com/filing",
      "snippet": "Revenue grew.",
      "date": "2025-10-28T00:00:00Z",
      "last_updated": null,
      "content": "Revenue grew.",
      "snippets": [{"text": "Revenue grew.", "score": 0.9}],
      "properties": {"company": {"name": "Example"}}
    }
  ]
}
```

## Cost

LiteLLM prices each Seltz search from the [model cost map](/docs/proxy/model_cost_map). [Seltz lists](https://docs.seltz.ai/pricing?utm_source=litellm&utm_medium=integration&utm_campaign=marketplace) Pro at $5 per 1,000 searches and Base at $3 per 1,000. Omitting `tier` is Pro, so that search is $0.005. `tier` `base` is $0.003.

| `tier` | Cost map entry | Price per search |
| --- | --- | --- |
| omitted | `seltz/search` | $0.005 |
| `pro` | `seltz/search-pro` | $0.005 |
| `base` | `seltz/search-base` | $0.003 |

`BASE` and ` Base ` use `seltz/search-base`. The request still sends the tier string as written. A tier name other than `base` or `pro` is priced at `seltz/search`. Seltz rejects that name. The same prices apply to the SDK, every `/search` route on the proxy, and web searches the proxy runs for [web search interception](/docs/integrations/websearch_interception).

To bill your own rate, set `input_cost_per_query` on the search tool, as described in [Custom Per-Query Pricing](/docs/search#custom-per-query-pricing). A price you register for `seltz/search` with `litellm.register_model` keeps applying to a tiered search until you also register that tier's entry, such as `seltz/search-base`.
