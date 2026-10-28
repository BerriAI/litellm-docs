# xAI X Search

Search X posts through LiteLLM's Search API with `search_provider="xai"`. LiteLLM calls xAI's Responses API with the `x_search` tool and returns its cited URLs in the standard search response format.

Get an API key from the [xAI console](https://console.x.ai/). See the [xAI X Search documentation](https://docs.x.ai/developers/tools/x-search) for upstream tool behavior and limits.

## LiteLLM Python SDK

Set `XAI_API_KEY` in your environment, or pass `api_key` per request.

```python showLineNumbers title="Search X posts"
from litellm import search

response = search(
    query="Find recent posts from xai about Grok",
    search_provider="xai",
    max_results=3,
    allowed_x_handles=["xai"],
)

for result in response.results:
    print(result.title, result.url)
    print(result.snippet)
```

The default model is `grok-4.7`. Pass `search_model` to select another xAI model that supports `x_search`.

```python showLineNumbers title="Async search with a model override"
import asyncio
from litellm import asearch

async def main():
    response = await asearch(
        query="Find recent posts from xai about Grok",
        search_provider="xai",
        search_model="grok-4.7",
        max_results=3,
    )
    for result in response.results:
        print(result.url)

asyncio.run(main())
```

A list of queries is joined into one prompt for a single Responses API request. It does not make an independent request for each query.

## LiteLLM AI Gateway

Configure a named search tool in `config.yaml`. Model selection belongs in `search_model`, because the gateway uses `model` to route requests to the named search tool.

```yaml showLineNumbers title="config.yaml"
search_tools:
  - search_tool_name: xai-search
    litellm_params:
      search_provider: xai
      api_key: os.environ/XAI_API_KEY
      search_model: grok-4.7
```

Start the proxy with this configuration.

```bash
litellm --config /path/to/config.yaml --port 4000
```

Call the named search endpoint with a LiteLLM key authorized to use the search tool.

```bash showLineNumbers title="Search request"
curl http://localhost:4000/v1/search/xai-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Find recent posts from xai about Grok",
    "max_results": 3,
    "allowed_x_handles": ["xai"]
  }'
```

`XAI_API_BASE` or the per-call `api_base` can override the default `https://api.x.ai/v1` base URL. LiteLLM appends `/responses` when needed. A caller-provided base on another host requires an explicit `api_key` unless the operator configured that host in `XAI_API_BASE`.

## Filters and unified parameters

Pass xAI filters as top-level SDK arguments, request-body fields, or fields under the search tool's `litellm_params`.

| Parameter | Behavior |
| --- | --- |
| `allowed_x_handles` | Restrict posts to the supplied X handles, without `@`. |
| `excluded_x_handles` | Exclude posts from the supplied handles. Do not combine with `allowed_x_handles`. |
| `from_date` | Start of the search range, in `YYYY-MM-DD` format. |
| `to_date` | End of the search range, in `YYYY-MM-DD` format. |
| `enable_image_understanding` | Allow xAI to inspect images found in posts. |
| `enable_video_understanding` | Allow xAI to inspect videos found in posts. |
| `search_model` | Select the xAI model used for the search. |
| `max_results` | Limit the returned citation rows. Must be a positive integer. |

`country`, `search_domain_filter`, and `max_tokens_per_page` have no X Search equivalent and are ignored. Use xAI's handle and date filters to narrow a search.

## Results and cost tracking

xAI returns a synthesized answer with citation annotations rather than a ranked list of documents. LiteLLM converts each URL citation into one `SearchResult`. Each row contains the cited URL, its title when available, and the full answer text as its `snippet`. If a citation has no title, LiteLLM uses its URL. Dates remain unset.

`max_results` truncates the returned rows after xAI completes the request. It does not limit xAI's tool calls, token usage, or bill. A completed response with no citations returns an empty results list and can still have a cost.

LiteLLM records [xAI's reported request cost](https://docs.x.ai/developers/cost-tracking) from `usage.cost_in_usd_ticks`, divided by `10,000,000,000` to convert to USD. This value includes tokens and server-side tool usage. The proxy exposes it in `x-litellm-response-cost` and uses it for spend tracking. LiteLLM returns HTTP 502 if the response has no valid billing ticks rather than treating the request as free.

## WebSearch interception

Use the same named search tool as the backend for [WebSearch interception](../integrations/websearch_interception.md).

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chat
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

search_tools:
  - search_tool_name: xai-search
    litellm_params:
      search_provider: xai
      api_key: os.environ/XAI_API_KEY

litellm_settings:
  callbacks: ["websearch_interception"]
  websearch_interception_params:
    enabled_providers: ["openai"]
    search_tool_name: xai-search
```

When the chat model requests an intercepted web search, LiteLLM searches X through the configured xAI tool and supplies the citation results to the model.
