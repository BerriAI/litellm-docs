---
title: "Microsoft Web IQ Search API with LiteLLM: Python and Gateway"
sidebar_label: "Microsoft Web IQ Search"
description: "Add Microsoft Web IQ web search to LiteLLM: call search() in the Python SDK or /v1/search on the AI Gateway, with domain filters and cost tracking."
---
# Microsoft Web IQ Search

<SinceVersion v="1.111.0" />

Use `search_provider="webiq"` with a Microsoft Web IQ API key. This integration calls the [Web Search v3 REST API](https://learn.microsoft.com/en-us/web-iq/reference/web-search), which is separate from Grounding with Bing

Set `WEBIQ_API_KEY` in the process environment or pass `api_key` explicitly. The provider sends it in the `x-apikey` header. This initial integration uses API-key authentication; it does not acquire or refresh Entra ID tokens

## Python SDK

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

Set `LITELLM_PROXY_URL` to your existing LiteLLM deployment URL, without a trailing slash, and `LITELLM_API_KEY` to your LiteLLM gateway key. The gateway key authenticates your application to LiteLLM; `WEBIQ_API_KEY` authenticates the gateway to `https://api.microsoft.ai/v3/search/web`

```bash
curl "$LITELLM_PROXY_URL/v1/search/webiq-search" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"retrieval augmented generation research","max_results":5}'
```

You can also send `POST /v1/search` or `POST /search` with `search_tool_name` in the request body:

```json
{
  "search_tool_name": "webiq-search",
  "query": "retrieval augmented generation research",
  "max_results": 5
}
```

Search calls follow the gateway's [search tool access rules](./index.md#restrict-search-tool-access). If your deployment restricts search tools, grant the caller access to `webiq-search`; the same rules apply to web-search interception

## Dashboard

With a database configured for the proxy, sign in as a proxy administrator and open **Search Tools**. Click **Add New Search Tool**, enter `webiq-search` as the **Search Tool Name**, select **Microsoft Web IQ** as the **Search Provider**, and enter your Web IQ key in **API Key**. Leave **Cost per Query (USD, Optional)** empty to use LiteLLM's catalog price, or set your negotiated rate

Click **Test Connection**, close the test results, and click **Add Search Tool** to save. Open the saved tool, enter a query, and click **Search** to inspect the returned titles, URLs, and passages. Use the saved tool's name in the gateway requests above; a dashboard-created tool does not also need an entry in `config.yaml`

## Router

For SDK applications that manage named search tools, configure Web IQ on a `Router` and call `router.asearch` with the tool name:

```python
import asyncio
import os
from litellm import Router

router = Router(
    model_list=[],
    search_tools=[
        {
            "search_tool_name": "webiq-search",
            "litellm_params": {
                "search_provider": "webiq",
                "api_key": os.environ["WEBIQ_API_KEY"],
            },
        }
    ],
)

async def main():
    result = await router.asearch(
        search_tool_name="webiq-search",
        query="retrieval augmented generation research",
        max_results=5,
    )
    print(result.model_dump())

asyncio.run(main())
```

## Web-search interception

To select Web IQ for [web-search interception](../integrations/websearch_interception.md), merge these settings into the proxy configuration alongside the `webiq-search` tool. Set `enabled_providers` to the model providers used by your application; this example selects Bedrock

```yaml
litellm_settings:
  callbacks:
    - websearch_interception
  websearch_interception_params:
    search_tool_name: webiq-search
    enabled_providers: ["bedrock"]
```

Send a model request with a supported web-search tool, as shown in the [interception usage examples](../integrations/websearch_interception.md#usage-examples). Enabling the callback alone does not add web search to every model request. LiteLLM routes intercepted searches to `webiq-search` and uses its existing tool conversion, streaming, and model continuation behavior

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
