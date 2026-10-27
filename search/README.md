# Documentation search and Ask AI

Search retrieves matches through the same-origin `/api/docs/search` endpoint over current docs, integration guides, API operations, individual blog posts, and release notes from the site build. Each input change starts retrieval immediately, without a typing delay or a Jev request. The server loads the index once per instance and computes fresh results for every query. The browser downloads only the results, so it does not need the full search index. Ask AI retrieves from the same content and links to its sources. Short topics such as “codex subscription” work without adding “LiteLLM” to the question. The assistant can also help with general questions; there is no topic-rejection gate.

## Try Jev reranking locally

Run `npm run search:lab` and open [localhost:3347](http://localhost:3347/?q=entra) to compare **Jev ranking** and **Current ranking**. This experiment is local only and does not change the production search box. It reuses the search engine to retrieve up to 100 candidates, shows 25 initially, and offers **Show 25 more**. Each Jev result shows its previous rank and estimated first-result suitability. The toolbar shows server latency and gateway-reported model cost; these scores are not measured percentages of users.

Use Node 24 or later and the existing dependencies. Put `DOCS_AI_API_KEY` in `.env.local`, with access to `typesafe/jev-latest` on the existing `DOCS_AI_BASE_URL` gateway. To reuse an existing environment file, set `DOCS_AI_ENV_FILE` to its path when launching. Credentials stay on the server. Download a matching snapshot of the public search corpus once:

```bash
mkdir -p .cache-loader/jev-search
curl -fsSL https://docs.litellm.ai/search-index.json -o .cache-loader/jev-search/search-index.json
curl -fsSL https://docs.litellm.ai/search-documents.json -o .cache-loader/jev-search/search-documents.json
node search/page-structure.js
npm run search:lab
```

Alternatively, run `DOCS_SEARCH_CORPUS=build npm run search:lab` after building the site. The build generates all three corpus files, including `search-structure.json`, directly from rendered pages. Search waits for a 250 ms typing pause, and Jev starts after 450 ms. Enter searches immediately. Typing or changing filters cancels outdated requests. Successful rankings are cached in memory for 15 minutes, so repeat searches make no model calls. The server binds only to `127.0.0.1` and rejects other origins.

The structure precomputation fetches public pages once; no individual page fetches happen during a search. Jev receives the title, description, keywords, breadcrumbs, heading hierarchy, tab labels, link text and destinations, table headers, image descriptions and filenames, code example labels, callout titles, and table of contents. It also receives the full indexed page when its text is at most 12,000 characters. For longer pages, it receives the introduction, the original matched passage, and up to four query-relevant indexed passages, without further truncating those passages. A conservative UTF-8 byte budget keeps individual questions within the provider context window, preserving structural fields before body passages and recording any omissions.

Independent questions run in parallel batches of ten. If Jev rejects a batch with `max_tokens_exceeded`, reranking removes its last candidate and retries until the remaining prefix fits. Results stop at that cutoff in the original retrieval order, and Jev sorts only the retained candidates. Later batches already in flight may finish and incur cost, but their results are omitted and they do not retry after an earlier cutoff is known. If even the first candidate cannot fit, search uses the local results.

The gateway currently routes `typesafe/jev-latest` to Jev 1.13; it has no healthy `typesafe/jev-1.14.0` deployment. The UI reports the actual model returned. A failed or incomplete ranking leaves the original search results available. Candidate retrieval is still lexical: Jev cannot promote a page that was never retrieved. The prompt and evidence selection live in `search/rerank.js`; restart the server and refresh the page after changing them to clear both caches.

Verify with `node --no-experimental-require-module --test search/rerank.test.js`, then try a broad term and a qualified term, switch rankings, and repeat a query to check the cached cost of $0. Latency shown in the toolbar includes server retrieval and Jev requests but excludes the typing pause and browser network/rendering time. Model cost is summed from the gateway's response headers and excludes hosting.


## Try locally

Use Node 24 or later. From the repository root, install dependencies and build the site:

```bash
npm ci
npm run build
cp .env.example .env.local
```

Document search works without a model credential. To try Ask AI, set `DOCS_AI_API_KEY` in `.env.local` to a LiteLLM virtual key that can call these gateway aliases:

```text
anthropic/claude-haiku-5-5
openai/gpt-6-luna
openai/gpt-6.1-sol
```

The default gateway is `https://gateway.litellm-sandbox.ai`. Set `DOCS_AI_BASE_URL` only when using another HTTPS gateway. Start the local server:

```bash
npm run search:serve
```

Open [localhost:3333/docs](http://localhost:3333/docs), select the navbar search icon or press **Cmd+K** on Mac or **Ctrl+K** on Windows/Linux. Search for “entra” and “end user”, then add a qualifier such as “entra group sync”. The dialog shows 25 matches initially; **Show 25 more** reveals the rest. Results appear as soon as the search API responds. Closing the dialog or switching to Ask AI cancels pending searches.

Search is available on docs, blogs, release notes, and other pages using the site navbar. Docs also keep the sidebar search button; mobile keeps it in the expanded navigation menu. Plain **K** does not open search. Select **Ask AI** and ask “How do I enable Redis caching in LiteLLM?” to check that the answer cites documentation. Ask “codex subscription” and check that it explains the ChatGPT subscription integration with a source link.

The server reads `.env.local`; the build and browser do not read the AI credential. Keep it out of `docusaurus.config.js`, public environment variables, and committed files. Plain `npm start` does not build the search index or run the API; use the built preview above

## Deploy on Vercel

The same-origin `/api/docs/search` function bundles only `build/search-index.json` and loads it once per function instance. `/api/docs/ask` bundles `build/search-*.json` for its research tools. Vercel uses `npm run build` and the `build` output directory. No separate API service or retrieval database is needed.

In the docs project's **Settings > Environment Variables**, add `DOCS_AI_API_KEY` as a server secret and set `DOCS_AI_PUBLIC_ENABLED=true` for the intended environment, then redeploy. The production origin defaults to `https://docs.litellm.ai`. For a preview or another domain, set `DOCS_ORIGIN` to that exact origin too. Without the public enable flag, Ask AI returns 503 while document search still works

Keyword search is available without model credentials or an enable flag. `POST /api/docs/search` accepts `{query, type}`, with a query of 1 to 500 characters and an optional `all`, `docs`, `blog`, or `release` filter. It returns up to 100 results, uses `Cache-Control: no-store`, and makes no model calls. The existing engine preserves ranking, snippets, filters, typo handling, and chronological browsing. The endpoint limits request bodies to 16 KB and four concurrent requests per instance. The old Jev request-rate allowance does not apply to keyword searches. The Jev comparison remains available only through `npm run search:lab`.

Verify that typing produces a 200 response from `/api/docs/search` and no browser request for `search-index.json`. A 503 indicates an unavailable index or search handler; 429 means all concurrency slots are busy. Search now requires the API connection for each query. A failed request shows an error with a retry action instead of downloading the index as a fallback.

Before enabling public Ask AI access, use a dedicated virtual key restricted to the needed aliases above, with a budget and RPM/TPM limits enforced by the gateway. Set shared per-client limits on `/api/docs/ask` in the Vercel Firewall as well. The service limits 10 questions per socket IP per minute, 60 total per minute, and four concurrent questions per instance. These process-local limits reset on restart and do not cap spending across serverless instances. It deliberately ignores caller-provided forwarded IP headers. Origin checks are browser protections, not authentication; direct HTTP clients can call a public endpoint

After deploying, repeat the two local example questions through the public UI. If Ask AI returns 503, check the secret, enable flag, and bundled index. A 403 indicates an origin mismatch. A 502 indicates a gateway failure or an invalid model response; check gateway logs without exposing those details in browser errors. A 429 means a request or concurrency limit was reached

For another host, run `npm run search:serve` with `HOST=0.0.0.0`, `PORT`, `DOCS_ORIGIN`, and the same server secrets and enable flags behind HTTPS. Route `/api/docs/ask` and `/api/docs/search` to it on the docs origin, and deploy the site and index together.

## Record Ask AI traces in Lens

To connect an existing Lens installation, copy a dedicated key from **Lens Home → Tracing key** into this project's ignored `.env.local`. Add the tracing endpoint shown by Lens and its UI address:

```dotenv
LITELLM_TRACING_KEY=your-dedicated-lens-tracing-key
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://your-lens.example.com/v1/traces
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
LENS_UI_URL=https://your-lens.example.com/ui/
```

The exporter constructs `Authorization: Bearer ...` from `LITELLM_TRACING_KEY`. Keep `DOCS_AI_API_KEY` and the model gateway configuration unchanged; model and Lens admin keys cannot replace the tracing key. Lens and ClickHouse are sufficient for trace storage, with no analysis provider or gateway tracing integration required

Restart `npm run search:serve`, then ask a question. Lens records the agent as `litellm-docs-search`. Follow-up questions share the conversation's trace, with each question's searches, passage reads, and answer nested beneath it. Select **Clear** to start a new conversation and trace. The browser carries a signed trace reference between requests, so follow-ups stay together across Vercel instances. It contains no credentials and is never passed to the model

Traces contain questions, prompt context, retrieved document references, answers, model names, timing, and token usage. Rejected completions retain their request ID, finish reason, reasoning usage, and a safe error description. A `GatewayResponseTruncated` span means the provider stopped at its completion limit. The exporter excludes request headers and redacts the configured model and tracing credentials. Tracing is optional and exporter failures do not fail the answer

To run a real conversation and verify storage of all its exported spans in one trace:

```bash
npm run search:verify-trace -- "How do I use my Codex subscription with LiteLLM?" "How do I log in?"
```

This uses the existing model credentials and makes the normal research and answer calls for each quoted question. It flushes the exporter, requires one shared trace, records actual exported trace and span IDs in `.cache-loader/docs-trace-receipt.json`, and checks Lens's receipt endpoint with the same tracing key. Only `received: true` confirms delivery. Authentication errors stop verification; other receipt checks are bounded to 30 attempts and 60 seconds. Open the printed trace URL after confirmation

For Vercel, add the same tracing environment variables as server secrets and redeploy. OpenTelemetry runs only in the API function. Each question flushes its spans before the function returns, with a bounded export timeout

## Ask AI conversation API

`POST /api/docs/ask` accepts a non-empty `question` and an optional `history` array in chronological order. Each history entry contains a non-empty `question` and an optional non-empty `answer`. Question-only callers remain supported. The browser sends every completed question and answer, and the trace verification command uses the same history format.

```json
{
  "question": "Can I reset just that team member's spend?",
  "history": [
    {
      "question": "Why was a team member blocked after I added a budget?",
      "answer": "Existing cycle spend counts against a budget added later."
    }
  ]
}
```

Ask AI adds no question-length, history-length, or request-body byte cap and does not silently shorten the conversation. Prior answers are untrusted context for understanding follow-ups; the agent reads documentation again to verify product facts and produce fresh citations. Callers cannot supply system roles, tools, model settings, or documentation evidence.

The hosting platform's request-size limit and the model's context window still apply. A recognized provider context-window rejection returns HTTP 422 with a request to start a new conversation or send less context; after streaming starts, it sends the same explanation as an `error` event. The browser keeps the failed question for editing or retry, and **Clear** starts a new conversation. Request rate and concurrency controls, the five-second body-read timeout, and the 50-second answer deadline remain in place; the deployed Vercel function allows 60 seconds overall. These operational controls do not trim questions or history. The separate keyword-search endpoint retains its existing query validation.

## Model routing and caching

Every model call requests GPT-6.1 Sol with `reasoning_effort=low` and LiteLLM's native ordered fallbacks to Haiku 5.5 and GPT-6 Luna, both with `reasoning_effort=none`. The backend fixes the aliases and fallback parameters for both the website and Slack. The configured LiteLLM gateway supports Sol tool calls through its Chat Completions endpoint; verify this translation when changing gateways, since [direct OpenAI Sol tool calls require Responses](https://developers.openai.com/api/docs/models/gpt-6.1-sol). Sol can use the available model-call deadline. Fallbacks handle provider failures when time remains; the call and hosting deadlines still bound the entire operation. The agent chooses when to search, read, or finish research. `search_docs` accepts one to three queries and returns results grouped by query, with each page title first. `read_docs` returns every indexed passage and first-party link from the selected pages without truncation, with requested passages first. This retains prerequisites and request examples that may appear under other headings. Tool results stay private; the final answer receives all the evidence read, then streams once.

Ask AI does not set `max_tokens` or `max_completion_tokens` for research, answering, or fallback models, and does not cap answer characters or response bytes. The gateway and provider use their configured defaults and model limits. `reasoning_effort=none` does not guarantee zero reasoning tokens on every provider. An interrupted or provider-truncated stream reports an error and does not save a partial answer. Finish reason and usage are retained in the trace.

Provider prompt-prefix caching reuses the processed instructions and documentation, while every request still searches and generates a fresh answer. Research keeps questions and tool results in conversation order. The final answer receives read passages before the question and history. Anthropic ephemeral cache breakpoints mark the stable instructions and final evidence. GPT models use OpenAI's automatic prefix caching

The service has no answer cache and explicitly disables LiteLLM response-cache reads and writes. API responses use `Cache-Control: no-store`. Provider caching still requires an exact matching prefix that meets the provider's minimum token count; short prompts may be too small. Verify real prompt-cache use through provider usage fields such as `cache_creation_input_tokens` and `prompt_tokens_details.cached_tokens`, not by comparing answers or response times

## Search behavior and security boundaries

Search defaults to **All**, with **Docs**, **Blog**, and **Releases** filters. Each result and AI source identifies its content type; dated sources also show their publication date and release version. Integration guides belong to Docs. Archive, tag, listing, draft, unlisted, redirect, and noindex pages are excluded using Docusaurus article metadata and rendered HTML.

The Docs collection also includes every operation in the API reference's `static/openapi.json`. Each operation links to its Swagger section and includes its description, parameters, request and response schemas, authentication definitions, and all referenced definitions. Recursive schemas retain references with each definition included once per operation. Website search, Ask AI, and the Slack bot share this build-generated corpus. `read_docs` reads a complete operation and its definitions without expanding unrelated endpoints. Updating the spec and rebuilding updates all three surfaces; the build fails on missing or unsupported references instead of silently omitting API evidence.

Ordinary feature and setup searches favor current docs. When a query names a specific topic, generic “gateway” and “AI Gateway” wording does not become a required match. Visual Studio Code, VS Code, and vscode resolve to the same editor name. Generic docs/page wording does not hide a named topic. Partial matches are discounted, and fuzzy title corrections cannot replace a query that already matches a passage. Benchmark and comparison queries can surface relevant articles, explicit blog queries search articles, and exact release versions match without fuzzy version substitution. “Latest stable release” lists the newest indexed stable notes; “latest blog posts” lists articles by publication date. This reflects the current site build, not an independent check of published packages. Separate search collections keep archive growth from changing the docs' term statistics. Titles, section headings, keywords, and paths all contribute to ranking.

Search shows translucent placeholder cards while a query is pending, with a reduced-motion alternative. Each input or filter change sends a keyword-search request without a debounce timer. The dialog publishes the returned results directly. Stale replies are ignored and pending requests are aborted on query/filter changes, closing the dialog, or switching modes. Enter opens the selected result, initially the first one, and does not navigate an outdated match while a new query or filter is pending. Select **Ask AI** to start a conversation.

In the separate lab, Jev estimates which page best serves the likely task. Bare product concepts favor their canonical documentation; broad external integrations favor direct setup guides; specific qualifiers take precedence. Scores are model judgments, not click analytics or measured user percentages. The candidate pool comes from lexical search, so reranking cannot recover a missing candidate. Explicit chronological browsing, such as “latest blog posts”, keeps its existing date/version ordering.

## Search analytics in PostHog

The search dialog sends events to the existing docs PostHog project when its SDK is available. No additional key is needed. Events include `schema_version`, `environment` (`production`, `preview`, or `local`), `surface: dialog`, the current page path, and a `search_session_id` for each dialog opening. Query events also share a `search_id`, normalized query, and content filter. Each non-empty query starts a request event immediately. Common email, API-token, and Bearer-token patterns are redacted from query text. These events do not include Ask AI questions or answers.

| Event | What it records |
| --- | --- |
| `docs_search_opened`, `docs_search_closed` | Opening method, initial mode, closing reason, and dialog duration |
| `docs_search_requested` | A keyword-search request starts for a non-empty query |
| `docs_search_results_shown` | The final result set, candidate/result counts, the first visible batch's URLs, displayed and original ranks, and model suitability scores |
| `docs_search_results_expanded` | Each additional batch of visible results after selecting Show 25 more |
| `docs_search_result_selected` | Selected URL, displayed/original rank, rank change, mouse/keyboard/middle-click method, and time to selection |
| `docs_search_finished` | Whether a result was selected or shown before a query/filter change, dialog close, page exit, or switch to Ask AI |
| `docs_search_failed` | Failure status and timing when the API cannot return search results |
| `docs_search_mode_changed` | Switching between Search and Ask AI |

The docs dialog records `ranking: lexical`, `ranking_version: lexical-v4`, and `cache_source: none`. Each query computes fresh results against the server's loaded index. `debounce_ms` is zero. `request_ms` includes the network round trip and response parsing; `corpus_load_ms` records function-instance initialization from the `Server-Timing` header, and `retrieval_ms` records the engine's search time. `time_to_results_ms` runs from the latest query/filter change to the next animation frame after results are committed; `render_ms` measures the final rendering step. These measurements overlap, so do not add them together. Existing model and reranking fields remain in the event schema for historical comparisons, with no model or gateway cost for keyword search.

When opening PostHog, filter these events to `environment = production` and `surface = dialog`. Use unique `search_id` counts to compare results shown with result selections, and break selections down by displayed rank, query, and ranking version. Plot p50/p95 `time_to_results_ms`, `request_ms`, `retrieval_ms`, and `render_ms`; track zero-result and failure rates separately. For query refinement and searches closed without a selection, use `docs_search_finished`, its `reason`, and `results_shown` flag to distinguish pending requests from searches people actually saw.

Events are best effort and may be missing when analytics are blocked or the page exits abruptly. A click is an engagement signal, not proof that the page solved the task. The current instrumentation does not assign randomized control groups, so rank changes and click rates alone cannot establish that Jev improves outcomes over the original ranking.

Ask AI receives source types, dates, and versions. It is instructed to use current docs for setup, attribute blog benchmarks to their measured conditions, and use release notes for version-specific changes. It must distinguish stable releases from prereleases and cannot infer first availability from a feature's mention in a release note.

Ask AI uses matching public docs to interpret short topics and follow-ups, then generates an answer with citations. It has no scope classifier or output-verdict gate. General questions can receive an answer without sources; LiteLLM-specific guidance is instructed to use retrieved evidence. Citation numbers and URLs are validated against read passages and their indexed first-party links. Source numbers stay stable during streaming and completion; an invalid citation reports an error without regenerating the answer. The renderer disables HTML and images and permits only the returned citation links

The API accepts a non-empty question, previous turns as `{question, answer?}` objects, and an optional signed trace reference. It does not impose application limits on question length, history length, or request body size. It rejects extra fields, caller-controlled roles, model settings, fallback overrides, tools, URLs as configuration, and caller-supplied documents. Prior questions, answers and retrieved docs are untrusted reference material. The model never receives the API key or access to environment variables, arbitrary network requests, or private files. Its tools only search and read the public corpus

Each question permits up to eight research rounds and one final answer call, with up to three provider attempts per call through native fallbacks. The prompt does not require a particular number of searches. Reads have no character, passage, or linked-destination cap. Provider context limits still apply; exceeding them fails the request instead of silently dropping page content. Hosting payload limits and execution deadlines still apply. The public endpoint also bounds request rates and concurrent work. Redirects are disabled, errors are generic, and client disconnects cancel upstream requests. Static serving denies dotfiles, traversal, and symlinks outside the build directory

The model has no privileged actions or access to secrets, but its answers can still be wrong or influenced by malicious text. Topic restrictions are not a security boundary. A public endpoint can also be used to consume its budget. Model restrictions, gateway spending limits, shared ingress rate limits, and monitoring remain necessary. When Lens tracing is enabled, questions and answers are exported to Lens; otherwise the service does not store or log them. Gateway retention follows its own configuration

## Streaming

The browser requests `Accept: text/event-stream`. The API sends brief progress statuses during research, source metadata before the answer, and `answer-delta` events only for the final generation. It never sends raw tool results to the browser. A terminal `done` event contains the same answer text and its cited sources. An `error` event or a connection ending without `done` offers Retry. There is no automatic answer rewrite or stream reset.

Stop or New chat cancels upstream work. Closing the Ask AI panel lets the current answer finish. The panel saves all completed turns in IndexedDB and restores them after a reload, with no turn-count cap. Session storage holds only the tab's conversation ID. Existing session-storage conversations migrate automatically; browsers without IndexedDB fall back to session storage.

Clients without the streaming Accept header retain the JSON response contract. After streaming headers are sent, failures are SSE error events with HTTP 200; consumers must check the terminal event. Proxies must allow streaming and respect `Cache-Control: no-transform`.

## Validation

`npm run test:search` checks extraction, ranking, grouped queries, repeated search/read cycles, citation validation, stable streaming, cancellation, request validation, caching, rate limits, and credential boundaries. To assess answer quality, use the local UI with questions from your workflow and follow the citations. The automated checks do not grade model answers


## Slack bot service route

`POST /api/docs/bot-ask` runs the same Ask AI engine, corpus, full-page research tools, models, fallbacks, answer generation, citations, streaming protocol and trace propagation as `/api/docs/ask`. It is intended for the [LiteLLM Docs Slack worker](https://github.com/BerriAI/litellm-docs-bot).

Website Ask AI and Slack final answers use a say-it style: one short, plain-English explanation, the smallest useful code example when relevant, and supporting documentation citations. They expand when the user asks or essential permissions, prerequisites, or caveats require it. This is a writing instruction, not an output-token limit. Research and evidence remain complete. Callers cannot supply a prompt or style override.

Configure `DOCS_BOT_SERVICE_TOKEN` with a random service secret and `DOCS_BOT_AI_API_KEY` with a dedicated LiteLLM virtual key, then redeploy the docs service. The virtual key uses the existing `DOCS_AI_BASE_URL`; permit the same fixed model aliases and set the team's spending budget and capacity allocation on that key. The worker sends `Authorization: Bearer <DOCS_BOT_SERVICE_TOKEN>` and the existing `{question, history?, traceContext?}` request body. Keep both secrets server-side. The model key is never sent to the worker and never falls back to `DOCS_AI_API_KEY`.

The bot route does not require `DOCS_AI_PUBLIC_ENABLED` and has no public per-IP, per-minute or four-request concurrency restriction. Authentication is mandatory, including on localhost. It retains body-read and answer deadlines, origin checks, client-disconnect cancellation, generic failures, the provider context-window error, and `Cache-Control: no-store`. The worker queues work and controls concurrency; its dedicated gateway key and hosting platform enforce the deployed capacity and budget.

Both Vercel and `npm run search:serve` expose the route. Vercel bundles the same build-generated index and documents into its function; a warm function instance reuses that corpus across requests. The Slack worker never loads an index. Missing either bot secret returns 503; an incorrect bearer credential returns 401. An authenticated empty JSON object returns 400 without calling a model, which the worker uses as a configuration preflight.

To record bot requests with a dedicated Lens ingestion key, set `DOCS_BOT_TRACING_KEY` in the docs hosting environment and redeploy. It overrides `LITELLM_TRACING_KEY` only for the authenticated bot route and uses the existing `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and HTTP/protobuf exporter. Without the override, the bot retains the existing docs tracing configuration. The agent name remains `litellm-docs-search`; bot root spans include `docs.search.surface=slack`. Search, full-page reads, model calls, usage and complete answers use the existing instrumentation. The worker saves the signed trace reference per conversation so follow-ups join the same trace. No tracing SDK or Lens ingestion key is needed in the Slack worker.
