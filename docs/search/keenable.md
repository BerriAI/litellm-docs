# Keenable Search

**Get API Key (optional, for higher rate limits):** [https://app.keenable.ai/console](https://app.keenable.ai/console)

Keenable works without an API key, so there is nothing to sign up for to start:

| Mode | Endpoint | Auth | Limits |
|---|---|---|---|
| **Keyless** (default) | `https://api.keenable.ai/v1/search/public` | none | 10 requests per second and 1,000 per hour, per IP |
| **Keyed** | `https://api.keenable.ai/v1/search` | `Authorization: Bearer` | 100,000 free requests a month per organization, then $4 per 1,000 |

If neither `KEENABLE_API_KEY` nor `api_key` is set, the adapter calls the keyless endpoint. Keyless limits are counted per IP address, so a gateway that serves many users from one host should set a key

## LiteLLM Python SDK

### Keyless (zero config)

```python showLineNumbers title="Keenable Search - keyless"
from litellm import search

response = search(
    query="latest AI developments",
    search_provider="keenable",
    max_results=5
)

for result in response.results:
    print(f"{result.title}: {result.url}")
    print(f"Snippet: {result.snippet}\n")
```

### With API key (higher limits)

```python showLineNumbers title="Keenable Search - keyed"
import os
from litellm import search

os.environ["KEENABLE_API_KEY"] = "keen_..."

response = search(
    query="latest AI developments",
    search_provider="keenable",
    max_results=5
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
search_tools:
  - search_tool_name: keenable-search
    litellm_params:
      search_provider: keenable
      # api_key optional: omit it to use the keyless endpoint
      api_key: os.environ/KEENABLE_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/keenable-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Unified Parameters

```python showLineNumbers title="Keenable Search with unified parameters"
from litellm import search

response = search(
    query="asyncio tutorial",
    search_provider="keenable",
    max_results=10,                                         # -> max_results (1 to 50)
    search_domain_filter=["docs.python.org", "-medium.com"] # -> site + "-site:" clause
)
```

| Unified spec parameter | Mapped to Keenable |
|---|---|
| `max_results` | `max_results` (1 to 50) |
| `search_domain_filter` | `site` for one domain; `site:` and `-site:` clauses in the query for several domains or a `-` prefixed exclusion |
| `country` | _ignored (no equivalent)_ |
| `max_tokens_per_page` | _ignored (no equivalent)_ |

## Provider-specific Parameters

Any other keyword argument is forwarded to the request body unchanged:

```python showLineNumbers title="Keenable Search with provider-specific parameters"
from litellm import search

response = search(
    query="rust release notes",
    search_provider="keenable",
    published_after="30d",       # a date, an ISO 8601 timestamp, or a relative delta like 7d or 6mo
    published_before="2026-10-01",
    snippet_max_length=1000,     # characters of page text per result, 180 to 10000
)
```

`acquired_after` and `acquired_before` filter on when Keenable fetched the page instead of when it was published. See the [Keenable Search API reference](https://docs.keenable.ai/api-reference/search) for every parameter

## Response Notes

`snippet` is the page text Keenable extracted, falling back to `description` when it is empty. `date` is the page's publication time (`published_at`) and `last_updated` is when Keenable last fetched it (`acquired_at`), both ISO 8601 timestamps in UTC when Keenable has them
