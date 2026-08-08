# TinyFish Search

**Get API Key:** [https://tinyfish.ai](https://tinyfish.ai)

**API Docs:** [https://docs.tinyfish.ai/search-api](https://docs.tinyfish.ai/search-api)

## LiteLLM Python SDK

```python showLineNumbers title="TinyFish Search"
import os
from litellm import search

os.environ["TINYFISH_API_KEY"] = "your-api-key"

response = search(
    query="latest AI developments",
    search_provider="tinyfish",
    max_results=5
)
```

## LiteLLM AI Gateway

### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-5
    litellm_params:
      model: gpt-5
      api_key: os.environ/OPENAI_API_KEY

search_tools:
  - search_tool_name: tinyfish-search
    litellm_params:
      search_provider: tinyfish
      api_key: os.environ/TINYFISH_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/tinyfish-search \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Provider-specific Parameters

```python showLineNumbers title="TinyFish Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["TINYFISH_API_KEY"] = "your-api-key"

response = search(
    query="latest tech news",
    search_provider="tinyfish",
    max_results=5,                # Capped at 10, enforced client-side
    country="us",                 # Mapped to TinyFish's location parameter
    search_domain_filter=["techcrunch.com", "theverge.com"],
    # TinyFish-specific parameters
    language="en",                # Language code
    page=2,                       # Page number
    recency_minutes=1440          # Only results from the last N minutes
)
```

Set `TINYFISH_API_BASE` to override the default API endpoint (`https://api.search.tinyfish.ai`).
