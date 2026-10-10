# Documentation search and Ask AI

Search runs locally in the browser over public documentation from the current site build. Ask AI retrieves matching passages, answers LiteLLM questions, and links to those passages. Short topics such as “codex subscription” work without adding “LiteLLM” to the question. The assistant can also help with general questions; there is no topic-rejection gate

## Try locally

Use Node 24 or later. From the repository root, install dependencies and build the site:

```bash
npm ci
npm run test:search
npm run build
cp .env.example .env.local
```

Set `DOCS_AI_API_KEY` in `.env.local` to a LiteLLM virtual key that can call these gateway aliases:

```text
anthropic/claude-haiku-5-5
openai/gpt-6-luna
openai/gpt-6.1-sol
```

The default gateway is `https://gateway.litellm-sandbox.ai`. Set `DOCS_AI_BASE_URL` only when using another HTTPS gateway. Start the local server:

```bash
npm run search:serve
```

Open [localhost:3333/docs](http://localhost:3333/docs), select **Search for anything...**, then **Ask AI**. On mobile, open the navigation menu to find search at the top of the sidebar. Ask “How do I enable Redis caching in LiteLLM?” and check that the answer cites documentation. Ask “codex subscription” and check that it explains the ChatGPT subscription integration with a source link.

The server reads `.env.local`; the build and browser do not read the AI credential. Keep it out of `docusaurus.config.js`, public environment variables, and committed files. Plain `npm start` does not build the search index or run the API; use the built preview above

## Deploy on Vercel

The PR includes the same-origin function `/api/docs/ask` and bundles `build/search-index.json` and `build/search-documents.json` with it. Keep the existing Docusaurus build and `build` output directory. No separate API service or retrieval database is needed

In the docs project's **Settings > Environment Variables**, add `DOCS_AI_API_KEY` as a server secret and set `DOCS_AI_PUBLIC_ENABLED=true` for the intended environment, then redeploy. The production origin defaults to `https://docs.litellm.ai`. For a preview or another domain, set `DOCS_ORIGIN` to that exact origin too. Without the public enable flag, Ask AI returns 503 while document search still works

Before enabling public access, use a dedicated virtual key restricted to the three aliases above, with a budget and RPM/TPM limits enforced by the gateway. Set shared per-client limits on `/api/docs/ask` in the Vercel Firewall as well. The service limits 10 questions per socket IP per minute, 60 total per minute, and four concurrent questions per instance. These process-local limits reset on restart and do not cap spending across serverless instances. It deliberately ignores caller-provided forwarded IP headers. Origin checks are browser protections, not authentication; direct HTTP clients can call a public endpoint

After deploying, repeat the two local example questions through the public UI. If Ask AI returns 503, check the secret, enable flag, and bundled index. A 403 indicates an origin mismatch. A 502 indicates a gateway failure or an invalid model response; check gateway logs without exposing those details in browser errors. A 429 means a request or concurrency limit was reached

For another host, run `npm run search:serve` with `HOST=0.0.0.0`, `PORT`, `DOCS_ORIGIN`, and the same server secrets behind HTTPS. Route `/api/docs/ask` to it on the docs origin, and deploy the site and index together

## Model routing and caching

Every model call requests Haiku 5.5 with LiteLLM's native ordered fallbacks to GPT-6 Luna and GPT-6.1 Sol. The backend fixes the aliases and fallback parameters. Luna uses `reasoning_effort=none`; Sol uses `low` and receives an additional 1,024-token reasoning allowance. Per-provider timeouts leave room for the two fallbacks within the request deadline. A search planner rewrites the question, retrieves matching guides, and passes those guides to the answer model. Malformed search plans fall back to the original question

Provider prompt-prefix caching reuses the processed instructions and documentation, while every request still searches and generates a fresh answer. Stable instructions and retrieved passages come before the question and history. Anthropic ephemeral cache breakpoints mark the stable prefix. GPT fallbacks use OpenAI's automatic prefix caching

The service has no answer cache and explicitly disables LiteLLM response-cache reads and writes. API responses use `Cache-Control: no-store`. Provider caching still requires an exact matching prefix that meets the provider's minimum token count; short search-planning prompts may be too small. Verify real prompt-cache use through provider usage fields such as `cache_creation_input_tokens` and `prompt_tokens_details.cached_tokens`, not by comparing answers or response times

## Search behavior and security boundaries

Document search waits for a 250ms pause in typing and keeps the previous matches visible until new ones arrive. Stale worker results are ignored, and Enter does not navigate an outdated match while a new query is pending

Ask AI uses matching public docs to interpret short topics and follow-ups, then generates an answer with citations. It has no scope classifier or output-verdict gate. General questions can receive an answer without sources; LiteLLM-specific guidance is instructed to use retrieved evidence. Citation numbers and URLs are validated against the built corpus. The renderer disables HTML and images and permits only the returned citation links

The API accepts only a question of up to 500 characters and up to four previous questions of the same size. It rejects extra fields, roles, assistant answers, model settings, fallback overrides, tools, URLs as configuration, and caller-supplied documents. The body limit is 16 KiB. Prior questions and retrieved docs are untrusted reference material. The model never receives the API key or access to environment variables, tools, arbitrary network requests, or private files

Each question makes at most two gateway calls (search planning and answering), with up to three provider attempts per call through native fallbacks. Context is bounded to four guides, 32 passages, and 22,000 text characters. Model response bodies, output tokens, input time, execution time, and concurrent work are bounded. Redirects are disabled, errors are generic, and client disconnects cancel upstream requests. Static serving denies dotfiles, traversal, and symlinks outside the build directory

The model has no privileged actions or access to secrets, but its answers can still be wrong or influenced by malicious text. Topic restrictions are not a security boundary. A public endpoint can also be used to consume its budget. Model restrictions, gateway spending limits, shared ingress rate limits, and monitoring remain necessary. The service does not store or log questions or answers. Gateway retention follows its own configuration

## Validation

`npm run test:search` checks document extraction, index serialization, citation parsing, request validation, cancellation, prompt-cache structure, rate limits, and credential boundaries. To assess answer quality, use the local UI with questions from your workflow and follow the citations. The automated checks do not grade model answers
