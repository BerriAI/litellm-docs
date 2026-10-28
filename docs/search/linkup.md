# Linkup Search

**Get API Key:** [https://linkup.so](https://linkup.so)

## LiteLLM Python SDK

```python showLineNumbers title="Linkup Search"
import os
from litellm import search

os.environ["LINKUP_API_KEY"] = "..."

response = search(
    query="latest AI developments",
    search_provider="linkup",
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
  - search_tool_name: linkup-search
    litellm_params:
      search_provider: linkup
      api_key: os.environ/LINKUP_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/linkup-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Provider-specific Parameters

```python showLineNumbers title="Linkup Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["LINKUP_API_KEY"] = "..."

response = search(
    query="machine learning research",
    search_provider="linkup",
    max_results=10,
    # Linkup-specific parameters
    depth="deep",                      # "standard" (faster) or "deep" (more comprehensive)
    outputType="searchResults",        # "searchResults", "sourcedAnswer", or "structured"
    includeSources=True,               # Include sources in response
    includeImages=True,                # Include images in results
    fromDate="2024-01-01",             # Start date filter (YYYY-MM-DD)
    toDate="2024-12-31",               # End date filter (YYYY-MM-DD)
    includeDomains=["arxiv.org", "nature.com"],  # Domains to search (max 100)
    excludeDomains=["wikipedia.com"],  # Domains to exclude
    includeInlineCitations=True,       # Include inline citations in sourcedAnswer
)
```

## Features

Linkup provides powerful web search with context retrieval capabilities:

### Search Depth
Control the precision and speed of your search:
- `standard` - Returns results faster
- `deep` - Takes longer but returns more thorough results

### Output Types
Choose how results are formatted:
- `searchResults` - Returns a list of search results with URLs and content
- `sourcedAnswer` - Returns an AI-generated answer with sources
- `structured` - Returns results in a custom JSON schema format

### Date Filtering
Filter results by date range:
```python
response = search(
    query="AI developments",
    search_provider="linkup",
    fromDate="2024-06-01",
    toDate="2024-12-31"
)
```

### Domain Filtering
Include or exclude specific domains:
```python
response = search(
    query="research papers",
    search_provider="linkup",
    includeDomains=["arxiv.org", "nature.com", "ieee.org"],
    excludeDomains=["wikipedia.com"]
)
```

### Structured Output
Get results in a custom JSON schema format:
```python
response = search(
    query="Microsoft 2024 revenue",
    search_provider="linkup",
    outputType="structured",
    structuredOutputSchema='{"type": "object", "properties": {"revenue": {"type": "string"}, "year": {"type": "string"}}}'
)
```

## Cost

LiteLLM prices each Linkup search from the [model cost map](/docs/proxy/model_cost_map). A search sent with `depth: "deep"` is billed at the `linkup/search-deep` entry, and a `standard` search, or one without `depth`, is billed at `linkup/search`. This applies to the SDK, every `/search` route on the proxy, and web searches the proxy runs for [web search interception](/docs/integrations/websearch_interception).

To bill your own rate for both depths, set `input_cost_per_query` on the search tool, as described in [Custom Per-Query Pricing](/docs/search#custom-per-query-pricing). A price you register for `linkup/search` with `litellm.register_model` keeps applying to deep searches until you also register `linkup/search-deep`.

## Response Format

Linkup returns results in the following format:

```json
{
  "results": [
    {
      "type": "text",
      "name": "Microsoft 2024 Annual Report",
      "url": "https://www.microsoft.com/investor/reports/ar24/index.html",
      "content": "Highlights from fiscal year 2024..."
    }
  ]
}
```

LiteLLM transforms this to the standard `SearchResponse` format:
- `results[].name` → `SearchResult.title`
- `results[].url` → `SearchResult.url`
- `results[].content` → `SearchResult.snippet`

