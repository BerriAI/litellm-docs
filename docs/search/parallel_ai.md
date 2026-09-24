# Parallel AI Search

**Get API Key:** [https://www.parallel.ai](https://www.parallel.ai)

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PARALLEL_AI_API_KEY` | API key. `PARALLEL_API_KEY` is accepted as a fallback when it is unset. |
| `PARALLEL_AI_API_BASE` | Overrides the API base. Defaults to `https://api.parallel.ai`. |

## LiteLLM Python SDK

```python showLineNumbers title="Parallel AI Search"
import os
from litellm import search

os.environ["PARALLEL_AI_API_KEY"] = "..."

response = search(
    query="latest AI developments",
    search_provider="parallel_ai",
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
  - search_tool_name: parallel-search
    litellm_params:
      search_provider: parallel_ai
      api_key: os.environ/PARALLEL_AI_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/parallel-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Provider-specific Parameters

```python showLineNumbers title="Parallel AI Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["PARALLEL_AI_API_KEY"] = "..."

response = search(
    query="latest developments in quantum computing",
    search_provider="parallel_ai",
    max_results=5,
    # Parallel AI-specific parameters
    processor="pro",                 # 'base' or 'pro'
    max_chars_per_result=500         # Max characters per result
)
```

## Web Search Interception

When a Parallel AI search tool backs [web search interception](../integrations/websearch_interception.md), the intercepted `litellm_web_search` tool's optional `objective` and `search_queries` fields are forwarded to Parallel's v1 Search API as `objective` and `search_queries`, so one tool call from the model searches several keyword angles at once. Parallel AI is the only search provider that receives this richer shape today; every other provider gets the tool call's single `query`.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

search_tools:
  - search_tool_name: parallel-search
    litellm_params:
      search_provider: parallel_ai
      api_key: os.environ/PARALLEL_AI_API_KEY
      max_results: 5

litellm_settings:
  callbacks: ["websearch_interception"]
  websearch_interception_params:
    enabled_providers: ["anthropic"]
    search_tool_name: parallel-search
```

```bash showLineNumbers title="Request"
curl http://0.0.0.0:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "What is the latest stable Node.js release and what changed in it?"}],
    "tools": [{"type": "web_search_20250305", "name": "web_search"}]
  }'
```

The model sees the [three-field schema](../integrations/websearch_interception.md#the-search-tool-the-model-sees) and typically fills all of them. LiteLLM then sends Parallel the model's `objective` and up to five of its `search_queries`; queries past the fifth are dropped before the request goes out, matching Parallel's cap.

```json title="Outbound Parallel AI request"
{
  "objective": "Find the most current stable Node.js release version and what changes were included in that release",
  "search_queries": ["latest stable Node.js release", "Node.js newest version changelog", "current Node.js LTS release"],
  "mode": "basic",
  "advanced_settings": {"max_results": 5}
}
```

When the model fills only `query`, or you call `/v1/search/parallel-search` with a single `query` string, that string is sent as both a one-item `search_queries` list and the `objective`. A list of `query` strings on a direct search call maps to `search_queries` the same way, with `objective` passed through only when you supply it. An `objective` set in the search tool's `litellm_params` is kept on every request and the model's is dropped.

