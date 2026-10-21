# Exa AI Search

**Get API Key:** [https://exa.ai](https://exa.ai)

## LiteLLM Python SDK

```python showLineNumbers title="Exa AI Search"
import os
from litellm import search

os.environ["EXA_API_KEY"] = "exa-..."

response = search(
    query="latest AI developments",
    search_provider="exa_ai",
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
  - search_tool_name: exa-search
    litellm_params:
      search_provider: exa_ai
      api_key: os.environ/EXA_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/exa-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Provider-specific Parameters

```python showLineNumbers title="Exa AI Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["EXA_API_KEY"] = "exa-..."

response = search(
    query="AI research papers",
    search_provider="exa_ai",
    max_results=10,
    search_domain_filter=["arxiv.org"],
    # Exa-specific parameters
    type="neural",                   # 'neural', 'keyword', or 'auto'
    contents={"text": True},         # Request text content
    use_autoprompt=True              # Enable Exa's autoprompt
)
```

## Exa Response Fields

Exa results carry the same `title`, `url`, `snippet` and `date` fields as every other search provider. On top of those, each result keeps Exa's `highlights`, `highlight_scores` and `score` whenever Exa returned them, and the response keeps every top-level field Exa sent except `results` (such as `requestId`, `searchTime` and `costDollars`) under `provider_metadata`. A result Exa sent without these fields keeps the plain shape.

| Field | Where | Present when |
|-------|-------|--------------|
| `results[].highlights` | each result | you request `contents.highlights` |
| `results[].highlight_scores` | each result | Exa scores the highlights |
| `results[].score` | each result | you use `type="neural"` |
| `provider_metadata` | the response | every Exa response |

`highlights` are the sentences Exa picked from the page as the best match for your query. When you ask for highlights without text, `snippet` is those highlights joined together. `provider_metadata.costDollars` is what Exa charged for the call, so you can reconcile it with the cost LiteLLM tracked in `x-litellm-response-cost` and the spend logs.

```python showLineNumbers title="Exa AI Search with highlights"
import os
from litellm import search

os.environ["EXA_API_KEY"] = "exa-..."

response = search(
    query="regional bank net interest margin outlook",
    search_provider="exa_ai",
    max_results=2,
    type="neural",
    contents={"highlights": {"numSentences": 1}},
)

for result in response.results:
    print(result.score, result.highlights)

print(response.provider_metadata["costDollars"])
```

```bash showLineNumbers title="Same request through the AI Gateway"
curl http://0.0.0.0:4000/v1/search/exa-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "regional bank net interest margin outlook",
    "max_results": 2,
    "type": "neural",
    "contents": {"highlights": {"numSentences": 1}}
  }'
```

```json title="Response"
{
  "object": "search",
  "results": [
    {
      "title": "Q2 earnings: net interest margin up 1 basis point",
      "url": "https://example.com/q2-earnings",
      "snippet": "Net interest income grew $9.3 million linked quarter.",
      "date": "2026-08-31T15:00:25.000Z",
      "last_updated": null,
      "highlights": ["Net interest income grew $9.3 million linked quarter."],
      "score": 0.42
    }
  ],
  "provider_metadata": {
    "requestId": "1c8916cb62f8d5a7d6ea19515a26d5dc",
    "resolvedSearchType": "neural",
    "searchTime": 6.5,
    "costDollars": {"total": 0.004, "search": {"neural": 0.004}}
  }
}
```

Web search interception passes only each result's title, URL and snippet to the model, so these extra fields never reach the model's context.

