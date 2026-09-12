# xAI Live Search (x_search)

xAI's [Live Search](https://docs.x.ai/docs/guides/live-search) runs search over X/Twitter through the `x_search` tool inside a [Responses API](https://docs.x.ai/docs/api-reference#create-new-response) turn: the model plans its own queries, calls `x_search` itself, and returns a synthesized answer with inline citations. LiteLLM builds that Responses API turn for you and turns the citations into a normal search response

| | |
|---|---|
| Provider ID | `xai` |
| Auth | `XAI_API_KEY`, or `api_key` |
| API base | `api_base`, or `XAI_API_BASE`, defaulting to `https://api.x.ai/v1` |
| Model | `model` (optional), defaulting to `grok-4-fast` |

## LiteLLM Python SDK

```python showLineNumbers title="xAI Live Search"
import os
from litellm import search

os.environ["XAI_API_KEY"] = "xai-..."

response = search(
    query="what happened at the latest SpaceX launch",
    search_provider="xai",
    max_results=5
)

for result in response.results:
    print(f"{result.title}: {result.url}")
    print(f"Snippet: {result.snippet}\n")
```

### x_search filters

Pass any of xAI's `x_search` filters as extra keyword arguments; they're forwarded into the tool call and dropped (not coerced) if the type doesn't match:

```python showLineNumbers title="xAI Live Search with filters"
response = search(
    query="what is the latest news about xAI Grok models",
    search_provider="xai",
    allowed_x_handles=["xai", "grok"],
    from_date="2026-01-01",
    to_date="2026-02-01"
)
```

| Filter | Type |
|---|---|
| `allowed_x_handles` | array of strings, max 10 |
| `excluded_x_handles` | array of strings, max 10 |
| `from_date` | string, ISO 8601 (`YYYY-MM-DD`) |
| `to_date` | string, ISO 8601 (`YYYY-MM-DD`) |
| `enable_image_understanding` | boolean |
| `enable_video_understanding` | boolean |

### Choosing a model

`x_search` runs on any xAI model that supports it. Override the default with `model`:

```python showLineNumbers title="xAI Live Search with a specific model"
response = search(
    query="latest AI developments",
    search_provider="xai",
    model="grok-4"
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
search_tools:
  - search_tool_name: xai-search
    litellm_params:
      search_provider: xai
```

Set `XAI_API_KEY` in the proxy's environment.

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/xai-search \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "what happened at the latest SpaceX launch",
    "max_results": 5
  }'
```

## Web search interception

xAI Live Search is a backend for [web search interception](../completion/web_search), which serves a model's native `web_search` tool from a search provider. Point the interception at the configured tool:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

search_tools:
  - search_tool_name: xai-search
    litellm_params:
      search_provider: xai

litellm_settings:
  callbacks: ["websearch_interception"]
  websearch_interception_params:
    enabled_providers: ["anthropic"]
    search_tool_name: xai-search
```

## Unified Parameters

| Unified spec parameter | Behavior |
|---|---|
| `max_results` | caps the returned citations after the fact (`x_search` has no request-side result-count knob) |
| `search_domain_filter` | _ignored (no equivalent)_ |
| `country` | _ignored (no equivalent)_ |
| `max_tokens_per_page` | _ignored (no equivalent)_ |

## Response format

Each cited X/Twitter URL becomes one result, deduped by URL in first-appearance order. `x_search`'s citation spans are reportedly always empty in practice, so there's no reliable per-citation excerpt to slice; the full synthesized answer is shared as `snippet` across every result instead:

```json showLineNumbers title="xAI Live Search Response"
{
  "object": "search",
  "results": [
    {
      "title": "SpaceX on X",
      "url": "https://x.com/SpaceX/status/1234567890",
      "snippet": "SpaceX's latest Starship flight reached orbit and completed a controlled reentry, according to the official SpaceX account and independent orbital trackers."
    }
  ]
}
```

## Notes

Cost is tracked from xAI's own reported cost on the response when present. If xAI doesn't report a cost, LiteLLM estimates it from the model's token price plus a $0.025-per-distinct-citation proxy for sources consulted; the surcharge is billed on the true number of distinct citations even when `max_results` caps how many are returned

A caller-supplied `api_key` is honored directly. A caller-supplied `api_base` pointing at a host other than the configured `XAI_API_BASE` (or the default `https://api.x.ai/v1`) is refused when falling back to the server-managed `XAI_API_KEY`, so an untrusted `api_base` cannot exfiltrate it

If the search turn comes back `failed`, or `incomplete` with no citations, LiteLLM raises an error rather than returning an empty success, so a failed search is not logged as a normal zero-result hit
