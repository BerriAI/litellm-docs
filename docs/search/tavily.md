# Tavily Search

**Get API Key:** [https://tavily.com](https://tavily.com)

## LiteLLM Python SDK

```python showLineNumbers title="Tavily Search"
import os
from litellm import search

os.environ["TAVILY_API_KEY"] = "tvly-..."

response = search(
    query="latest AI developments",
    search_provider="tavily",
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
  - search_tool_name: tavily-search
    litellm_params:
      search_provider: tavily
      api_key: os.environ/TAVILY_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/tavily-search \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Provider-specific Parameters

```python showLineNumbers title="Tavily Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["TAVILY_API_KEY"] = "tvly-..."

response = search(
    query="latest tech news",
    search_provider="tavily",
    max_results=5,
    # Tavily-specific parameters
    topic="news",                    # 'general', 'news', 'finance'
    search_depth="advanced",         # 'basic', 'advanced'
    include_answer=True,             # Include AI-generated answer
    include_raw_content="markdown",  # Full page content, also accepts True or "text"
    include_images=True,
    include_favicon=True
)
```

## Response

Tavily responses keep the standard `title`, `url` and `snippet` fields. `snippet` remains Tavily's `content`, while `raw_content` contains the full page content requested with `include_raw_content`. Result fields `raw_content`, `score` and `favicon` are included when Tavily returns them.

```json title="Tavily search response"
{
  "object": "search",
  "results": [
    {
      "title": "Example article",
      "url": "https://example.com/article",
      "snippet": "A short excerpt from the article.",
      "date": null,
      "last_updated": null,
      "raw_content": "# Example article\n\nFull page content.",
      "score": 0.95,
      "favicon": "https://example.com/favicon.ico"
    }
  ],
  "provider_metadata": {
    "query": "latest tech news",
    "answer": "An answer based on the search results.",
    "images": ["https://example.com/image.png"],
    "request_id": "example-request-id",
    "response_time": 0.8
  }
}
```

`provider_metadata` preserves every top-level Tavily field except `results`. Depending on the request and Tavily's response, this includes `answer`, `images`, `request_id`, `response_time` and `usage`. Request `include_answer`, `include_images` or `include_favicon` to ask Tavily for those optional values. The same response mapping applies to the Python SDK and gateway search endpoints.

## Cost

LiteLLM prices each Tavily search from the [model cost map](/docs/proxy/model_cost_map). A search sent with `search_depth: "advanced"` is billed at the `tavily/search-advanced` entry, which matches the 2 credits Tavily charges for it, and a search with any other depth, or none, is billed at `tavily/search`. This applies to the SDK, every `/search` route on the proxy, and web searches the proxy runs for [web search interception](/docs/integrations/websearch_interception).

To bill your own rate for every depth, set `input_cost_per_query` on the search tool, as described in [Custom Per-Query Pricing](/docs/search#custom-per-query-pricing). A price you register for `tavily/search` with `litellm.register_model` keeps applying to advanced searches until you also register `tavily/search-advanced`.
