# DeepSeek Search

**Get API Key:** [https://platform.deepseek.com](https://platform.deepseek.com)

DeepSeek's Search API (`POST https://api.deepseek.com/v1/tools/search`) uses the same `DEEPSEEK_API_KEY` as DeepSeek chat models. See the [DeepSeek Search docs](https://api-docs.deepseek.com/guides/search/) for pricing and limits.

## LiteLLM Python SDK

```python showLineNumbers title="DeepSeek Search"
import os
from litellm import search

os.environ["DEEPSEEK_API_KEY"] = "sk-..."

response = search(
    query="latest AI developments",
    search_provider="deepseek",
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
  - search_tool_name: deepseek-search
    litellm_params:
      search_provider: deepseek
      api_key: os.environ/DEEPSEEK_API_KEY
```

### 2. Start the proxy

```bash
litellm --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 3. Test the search endpoint

```bash showLineNumbers title="Test Request"
curl http://0.0.0.0:4000/v1/search/deepseek-search \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments",
    "max_results": 5
  }'
```

## Parameter mapping

`max_results` maps to DeepSeek's `count` and is clamped to its 1 to 50 range. `search_domain_filter` is added to the query as `site:` operators (`site:github.com OR site:huggingface.co`). `country` and `max_tokens_per_page` have no DeepSeek equivalent and are dropped.

Each result carries the standard `title`, `url`, `snippet` and `date`, plus DeepSeek's `summary`, `content`, `rerank_score`, `site_name`, `site_icon` and `authority` fields as returned.

## Provider-specific Parameters

```python showLineNumbers title="DeepSeek Search with Provider-specific Parameters"
import os
from litellm import search

os.environ["DEEPSEEK_API_KEY"] = "sk-..."

response = search(
    query="DeepSeek V4 release",
    search_provider="deepseek",
    max_results=5,
    # DeepSeek-specific parameters
    need_content=True,                       # Fill result.content with the page text
    ori_question="When was DeepSeek V4 released?",  # Original user question, used for reranking
    localization="en-US"                     # Preferred result language and region
)
```
