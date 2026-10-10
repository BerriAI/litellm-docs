# Documentation search and Ask AI

Search runs locally in the browser over public documentation from the current site build. Ask AI retrieves matching passages, answers LiteLLM questions, and links to those passages. It declines unrelated requests such as solving Two Sum, writing stories, and revealing server credentials

## Try locally

Use Node 24 or later. From the repository root, install dependencies and build the site:

```bash
npm ci
npm run test:search
npm run build
npm run check:search
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

Open [localhost:3333/docs](http://localhost:3333/docs), select **Search for anything...**, then **Ask AI**. On mobile, open the navigation menu to find search at the top of the sidebar. Ask “How do I enable Redis caching in LiteLLM?” and check that the answer cites documentation. Ask “Solve Two Sum in Python” and check that it declines. `npm run check:search-ai` runs the live answer and scope regression cases using your key and incurs model charges

The server reads `.env.local`; the build and browser do not read the AI credential. Keep it out of `docusaurus.config.js`, public environment variables, and committed files. Plain `npm start` does not build the search index or run the API; use the built preview above

## Deploy on Vercel

The PR includes the same-origin function `/api/docs/ask` and bundles `build/search-index.json` and `build/search-documents.json` with it. Keep the existing Docusaurus build and `build` output directory. No separate API service or retrieval database is needed

In the docs project's **Settings > Environment Variables**, add `DOCS_AI_API_KEY` as a server secret and set `DOCS_AI_PUBLIC_ENABLED=true` for the intended environment, then redeploy. The production origin defaults to `https://docs.litellm.ai`. For a preview or another domain, set `DOCS_ORIGIN` to that exact origin too. Without the public enable flag, Ask AI returns 503 while document search still works

Before enabling public access, use a dedicated virtual key restricted to the three aliases above, with a budget and RPM/TPM limits enforced by the gateway. Set shared per-client limits on `/api/docs/ask` in the Vercel Firewall as well. The service limits 10 questions per socket IP per minute, 60 total per minute, and four concurrent questions per instance. These process-local limits reset on restart and do not cap spending across serverless instances. It deliberately ignores caller-provided forwarded IP headers. Origin checks are browser protections, not authentication; direct HTTP clients can call a public endpoint

After deploying, repeat the two local example questions through the public UI. If Ask AI returns 503, check the secret, enable flag, and bundled index. A 403 indicates an origin mismatch. A 502 indicates a gateway failure or an invalid model response; check gateway logs without exposing those details in browser errors. A 429 means a request or concurrency limit was reached

For another host, run `npm run search:serve` with `HOST=0.0.0.0`, `PORT`, `DOCS_ORIGIN`, and the same server secrets behind HTTPS. Route `/api/docs/ask` to it on the docs origin, and deploy the site and index together

## Model routing and caching

Every model call requests Haiku 5.5 with LiteLLM's native ordered fallbacks to GPT-6 Luna and GPT-6.1 Sol. The backend fixes the aliases and fallback parameters. Luna uses `reasoning_effort=none`; Sol uses `low` and receives an additional 1,024-token reasoning allowance. Per-provider timeouts leave room for the two fallbacks within the request deadline. The service does not retry scope refusals. An in-scope answer with an unsupported claim gets at most one revision and must pass verification again

Provider prompt-prefix caching reuses the processed instructions and documentation, while every request still generates and validates a fresh answer. Stable instructions and retrieved passages come before the question, history, and candidate answer. Anthropic ephemeral cache breakpoints mark the stable prefix. GPT fallbacks use OpenAI's automatic prefix caching

The service has no answer cache and explicitly disables LiteLLM response-cache reads and writes. API responses use `Cache-Control: no-store`. Provider caching still requires an exact matching prefix that meets the provider's minimum token count; short classifier prompts may be too small. Verify real prompt-cache use through provider usage fields such as `cache_creation_input_tokens` and `prompt_tokens_details.cached_tokens`, not by comparing answers or response times

## Scope and security boundaries

A scope classifier runs before retrieval and returns only a bounded search plan or rejection. Retrieval uses only the built public `/docs/` corpus. A separate verification call checks that the candidate answer is exclusively LiteLLM help and supported by the cited passages before anything is shown. Failed or malformed checks reject the response. Citation URLs come from the index; the renderer disables HTML and images and permits only the returned citation links

The API accepts only a question of up to 500 characters and up to four previous questions of the same size. It rejects extra fields, roles, assistant answers, model settings, fallback overrides, tools, URLs as configuration, and caller-supplied documents. The body limit is 16 KiB. Prior questions, retrieved docs, and generated answers are untrusted inputs to the model checks. The model never receives the API key or access to environment variables, tools, arbitrary network requests, or private files

Each question makes at most five gateway calls (three normally, plus two for a revision), with up to three provider attempts per call through native fallbacks. Context is bounded to four guides, 32 passages, and 22,000 text characters. Model response bodies, output tokens, input time, execution time, and concurrent work are bounded. Redirects are disabled, errors are generic, and client disconnects cancel upstream requests. Static serving denies dotfiles, traversal, and symlinks outside the build directory

These controls reduce prompt-injection and off-topic use; probabilistic model checks cannot prove that every possible attack will be rejected. A public endpoint can also be used to consume its budget. Model restrictions, gateway spending limits, shared ingress rate limits, and monitoring remain necessary. The service does not store or log questions or answers. Gateway retention follows its own configuration

## Validation

`npm run test:search` checks extraction, ranking, citations, scope and answer gates, request validation, cancellation, cache behavior, limits, and secret boundaries. `npm run check:search` checks the built index against curated retrieval queries. `npm run check:search-ai` exercises real answers and adversarial requests with the configured gateway. These cases are regression checks, not a guarantee against all attacks or factual errors
