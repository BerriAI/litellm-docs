# Documentation search and Ask AI

The Docusaurus build indexes rendered public `/docs/` pages, including their actual heading anchors. It excludes redirects, noindex pages, navigation, blog posts, and release notes. MiniSearch supplies local full-text retrieval; our ranking favors exact page titles and headings, groups results by page, and uses prefixes and typos only when exact retrieval has no results. The index is fetched lazily and searched in a worker so it does not block typing. Every docs deployment publishes its matching index, without a crawler refresh delay.

Ask AI uses the same retrieval code on the server and a single bounded model call through LiteLLM. Short matching guides are included in document order so setup answers retain prerequisites; long pages use the highest-ranked passages. Context is capped at 18,000 characters and 24 passages. It has no tools, arbitrary URL fetching, database, or private corpus. Answers without valid source numbers fall back to an insufficient-evidence response. Citation URLs always come from our index. Markdown rendering disables HTML and images and allows only citation URLs from that index. Citation presence does not prove factual correctness; the UI asks readers to check sources.

## Local preview

Run `npm install`, `npm run test:search`, `npm run build`, and `npm run check:search`. Put server settings in the ignored `.env.local` file:

```dotenv
DOCS_AI_BASE_URL=https://your-gateway.example.com/v1
DOCS_AI_API_KEY=your-restricted-virtual-key
DOCS_AI_MODEL=your-model-alias
DOCS_ORIGIN=http://localhost:3333
```

Run `npm run search:serve` and open `http://localhost:3333/docs/proxy/lens`. This serves the built site and `/api/docs/ask` on the same origin. Plain `docusaurus start` does not generate the rendered search index; use a production build for search previews. Search works without AI credentials; Ask AI shows an unavailable message. The gateway URL must use HTTPS. Credentials are read only by the server, never by the Docusaurus configuration or browser code.

## Production

Keep the docs on their static host and route `/api/docs/ask` to this Node service behind the same HTTPS origin, or serve both from the Node service. Set `HOST=0.0.0.0`, `PORT`, `DOCS_ORIGIN=https://docs.litellm.ai`, and the AI settings in server secrets. The API runtime needs only Node, `minisearch`, and `dotenv`; the Docusaurus toolchain is needed at build time. Deploy the service with `search/`, those runtime dependencies, and the same build's `search-index.json` and `search-documents.json`. Publish the site and index together. These JSON files contain only already-public documentation.

Before exposing Ask AI publicly, provision a dedicated LiteLLM virtual key restricted to the selected model with a hard budget and request/token limits. The local preview credential is not a production credential. Configure shared rate limits at the ingress: the service's in-memory limits (10 requests per IP per minute, 60 total per minute, four concurrent requests) are per process, reset on restart, and are not a durable spending cap. Behind a reverse proxy, the service deliberately uses the socket IP instead of trusting `X-Forwarded-For`; enforce per-client limits at the trusted ingress. CORS/origin checks prevent browser cross-origin calls but do not authenticate a public API or stop direct HTTP clients.

Requests accept only a question, capped at 500 characters and a 4KB body. Upstream calls time out after 30 seconds, disable redirects, cap output at 1,200 tokens, and return generic errors without gateway details. Questions are not logged by this service; gateway logging/retention follows its configuration. No follow-up conversation history is stored or sent. Natural-language retrieval is lexical; semantic retrieval can be added if measured relevance requires it.

Run `npm run test:search` for ranking, extraction, citation, validation, and abuse-limit tests. Run `npm run check:search` after building to check actual Lens, caching, fallback, and virtual-key pages. Add real failing queries there before changing ranking. Evaluate answer accuracy separately from citation validity before rollout.
