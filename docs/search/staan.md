# Staan Search

LiteLLM supports [Staan's](https://staan.ai) Web Search API and Web Search for
AI. Set `STAAN_API_KEY` in the environment, then use `search_provider="staan"`.

`STAAN_API_BASE` optionally overrides the API URL. Set `market` or `country` in
`litellm_params` to configure each search tool's market independently.

## LiteLLM Python SDK

```python
import litellm

results = await litellm.asearch(
    query="vector database comparison",
    search_provider="staan",
    extra_snippets=True,
    max_snippets=5,
    min_score=0.2,
)
```

## LiteLLM AI Gateway

Set provider defaults in `search_tools`. Individual requests can override these
defaults.

```yaml
search_tools:
  - search_tool_name: search
    litellm_params:
      search_provider: staan
      api_key: os.environ/STAAN_API_KEY
      market: de-de
      extra_snippets: true
      max_snippets: 5
      min_score: 0.2
```

Supported options include `market` (`fr-fr`, `en-us`, or `de-de`), `country`
(`FR`, `DE`, or `US`), `offset`, `include_domains`, `exclude_domains`,
`extra_snippets`, `max_snippets`, `min_score`, and `full_content`.
`search_domain_filter` maps to Staan's `include_domains`. Domain array filters
use POST, and include and exclude filters are mutually exclusive. Staan returns
ten results per request; LiteLLM applies `max_results` locally.

Each result retains Staan's scored `extra_snippets`, `full_content`, publication
date, and other provider fields. Extra chunk text is also joined into the
standard `snippet`. To consume scores or full page text, read the additional
result fields.

Set `full_content` to `markdown` or `html` only when needed, since full page
content can make responses much larger. Enrichment fetches pages and reranks
results; Staan recommends allowing 8 to 10 seconds for these requests.
