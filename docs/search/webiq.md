# Microsoft Web IQ search

:::note Availability

This integration is proposed in [LiteLLM PR #50883](https://github.com/BerriAI/litellm/pull/50883). Use a build containing that change; it is not available in released versions yet

:::

Use `search_provider="webiq"` with a Microsoft Web IQ API key. This integration calls the [Web Search v3 REST API](https://learn.microsoft.com/en-us/web-iq/reference/web-search), which is separate from Grounding with Bing

Set `WEBIQ_API_KEY` in the process environment or pass `api_key` explicitly. The provider sends it in the `x-apikey` header. This initial integration uses API-key authentication; it does not acquire or refresh Entra ID tokens

```python
import asyncio
from litellm import asearch, search

result = search(
    query="retrieval augmented generation research",
    search_provider="webiq",
    max_results=5,
    country="US",
)
print(result.model_dump())

async def main():
    result = await asearch(query="retrieval augmented generation research", search_provider="webiq")
    print(result.model_dump())

asyncio.run(main())
```

The provider requests `contentFormat="passage"` and `maxLength=5000` by default. `content` becomes the standard result's `snippet`, while `lastUpdatedAt` supplies `date` and `last_updated` when available. Crawl timestamps are preserved as `crawledAt`, not presented as publication dates. Other response metadata, including `traceId` and instrumentation fields, is preserved unless its key conflicts with a standard LiteLLM response field; the integration does not send instrumentation pings

## Gateway

Add this search tool to your existing proxy configuration:

```yaml
search_tools:
  - search_tool_name: webiq-search
    litellm_params:
      search_provider: webiq
      api_key: os.environ/WEBIQ_API_KEY
```

Set `LITELLM_PROXY_URL` to your existing LiteLLM deployment URL, without a trailing slash. This is the gateway URL your application calls; the provider itself calls `https://api.microsoft.ai/v3/search/web`

```bash
curl "$LITELLM_PROXY_URL/v1/search/webiq-search" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"retrieval augmented generation research","max_results":5}'
```

To select Web IQ for existing web-search interception, merge these settings into the proxy configuration. Set `enabled_providers` to the model providers used by your application; this example selects Bedrock

```yaml
litellm_settings:
  callbacks:
    - websearch_interception
  websearch_interception_params:
    search_tool_name: webiq-search
    enabled_providers: ["bedrock"]
```

The existing interception implementation controls supported client endpoints, tool conversion, streaming, and model continuation. Selecting Web IQ does not add a separate agentic loop

## Parameters

| LiteLLM parameter | Web IQ request |
| --- | --- |
| `query` | `query`; a list of queries is joined with spaces |
| `max_results` | `maxResults` |
| `country` | `region`, uppercased |
| `search_domain_filter` | `site:` query operators, with `-domain` entries mapped to `-site:` exclusions |
| `max_tokens_per_page` | Not forwarded; Web IQ's `maxLength` measures characters, not tokens |

Pass native options such as `language`, `region`, `location`, `contentFormat`, `maxLength`, `maxResults`, and `safeSearch` as keyword arguments. Explicit native values override mapped values and integration defaults. Web IQ validates its own parameter limits

Domain filters narrow search relevance. Microsoft also notes that `site:` queries can return adult content regardless of `safeSearch`; see the API reference before relying on domain filtering in a restricted-content application

The default API base is `https://api.microsoft.ai/v3`. Set `api_base` in the SDK call or proxy search configuration to select a different base, with `/search/web` appended once. HTTPS is required for every endpoint, including custom endpoints with an explicit key. HTTP endpoints are rejected before credentials are resolved or a request is sent. A caller-selected host cannot receive a server-managed API key unless the host matches the default; pass an explicit `api_key` with a custom endpoint

LiteLLM registers `webiq/search` at $0.007 per query. [Microsoft's published pricing](https://learn.microsoft.com/en-us/web-iq/resources/pricing) lists `/web` at $7 per 1,000 API calls, effective October 16, 2026. Live Web IQ validation requires an enabled account and a valid API key

This integration currently supports `/web`. The `/video`, `/news`, `/images`, and `/browse` endpoints are outside its current scope
