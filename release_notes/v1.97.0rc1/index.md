---
title: "v1.97.0rc1 - Tool-Result Guardrails, Deployment Affinity & Viewer Parity"
slug: "v1-97-0-rc-1"
date: 2026-08-08T14:24:04
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Yuneng Jiang
    title: Senior Full Stack Engineer, LiteLLM
    url: https://www.linkedin.com/in/yuneng-david-jiang-455676139/
    image_url: https://avatars.githubusercontent.com/u/171294688?v=4
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Deploy this version

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.97.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.97.0rc1
```

</TabItem>
</Tabs>

:::danger Breaking Changes

**Request-parameter checks now apply to path and form inputs, not only the request body.** A request that supplies a deployment name through the URL path, or metadata through bracket-notation form fields, is now subject to the same destination check the body already went through, so calls that previously slipped past it will start being rejected. Configured credentials also stay with the endpoint they belong to, so a connection test can no longer borrow another model's credentials. Three admin opt-outs are preserved for legitimate overrides. See [PR #36011](https://github.com/BerriAI/litellm/pull/36011).

**Auto-router `deployment_affinity` now defaults to on.** An auto-router whose callers send a session id will pin that session to one deployment inside the routed model group instead of spreading its turns across every deployment. Set `deployment_affinity: false` on the auto-router config to restore the previous behavior. See [PR #36146](https://github.com/BerriAI/litellm/pull/36146).

:::

## Key Highlights

`v1.97.0rc1` is the current release candidate for 1.97.0.

- **Guardrails can be pointed at tool results alone** - a new per-guardrail `scan_only_tool_results` flag scans and masks tool output while system, user, and assistant content pass through untouched, so an agent platform can keep injection detection on untrusted tool results without its own harness prompts tripping the filter. Works on both `/v1/messages` and `/v1/chat/completions`
- **The auto-router now sticks to a deployment, not just a model group** - `deployment_affinity` is on by default, so a conversation returning to a model group lands on the deployment it used there before and the provider prompt cache stays warm, while every turn is still classified on its own merits. `session_affinity` implies it, and session pins are now scoped by the caller's hashed API key
- **Successful and failed request counts come from the gateway, not the spend logs** - a new `LiteLLM_DailyGatewayRequests` table written by the ASGI request-metrics middleware backs the Usage tiles, so the number no longer drops to zero when spend logging is off or the database is unavailable, and a by-endpoint breakdown chart the SpendLogs path could never produce comes with it
- **Proxy admin viewers can finally see the proxy** - about fifteen read endpoints that compared against `PROXY_ADMIN` exactly now use the viewer-inclusive check, and the UI presents a viewer as an admin for gating purposes while the server still rejects every write
- **Keys, users, teams, and organizations can pull their own spend report** - four new caller-scoped `spend/report` endpoints auto-scope a non-admin caller to their own identity, return 403 on a mismatched scope override, and cap date ranges at 366 days
- **Managed files and batches get a correctness sweep** - unified output file ids are now derived deterministically so concurrent registrations converge, are returned from `GET /batches`, from unscoped file listing, and on cancel, and unparseable rows no longer take down a listing
- **Admins can broadcast a banner to the dashboard** - `GET /get/user_banner` and `PATCH /update/user_banner` back a dismissible markdown banner rendered on every page, published from Admin Settings with a live preview and stored in the existing `LiteLLM_UISettings` table with no migration

## New Models / Updated Models

#### New Model Support (2 new models)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| Google Gemini | `gemini/gemini-robotics-er-2-preview` | 131K | $2.00 | $10.00 | Reasoning, vision, audio input, video input, PDF input, function calling, tool choice, prompt caching, response schema, web search, URL context |
| Google Gemini | `gemini/gemini-robotics-er-1.6-preview` | 131K | $1.00 | $5.00 | Reasoning, vision, audio input, video input, PDF input, function calling, tool choice, prompt caching, response schema, web search, URL context |

Beyond the new entries, this release carries OpenAI's GPT-5.6 price cut onto the Azure cost map: `azure/gpt-5.6-terra` falls from $2.50 / $15.00 to $2.00 / $12.00 per 1M and `azure/gpt-5.6-luna` from $1.00 / $6.00 to $0.20 / $1.20 per 1M, with the same reductions applied to the regional `azure/us/*` and `azure/eu/*` variants and to every cache, flex, priority, and above-272K tier. Flex and priority tier keys are added to the dated OpenAI snapshot variants that were missing them (`gpt-4.1-2025-04-14`, `gpt-4.1-mini-2025-04-14`, `gpt-4.1-nano-2025-04-14`, `gpt-4o-2024-08-06`, `gpt-4o-2024-11-20`, `gpt-4o-mini-2024-07-18`, `gpt-5-nano-2025-08-07`, `o3-2025-04-16`, `o4-mini-2025-04-16`). The Groq `gpt-oss` models gain a web search context price of $0.005 per query, the Bedrock `claude-sonnet-5` entries are marked as not supporting Converse strict tools, and a mangled `replicateopenai/gpt-oss-20b` key is corrected to `replicate/openai/gpt-oss-20b`. No pricing entries were removed.

#### Features

- **[Google Gemini](../../docs/providers/gemini)**
    - Add `gemini-robotics-er-2-preview` and `gemini-robotics-er-1.6-preview` to the model cost map - [PR #35555](https://github.com/BerriAI/litellm/pull/35555)

### Bug Fixes

- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Include the batch and S3 fields plus the model in deployment credentials - [PR #24548](https://github.com/BerriAI/litellm/pull/24548)
    - Grant `bedrock:CountTokens` in the OIDC session policy - [PR #33145](https://github.com/BerriAI/litellm/pull/33145)
    - Pass the SSE-KMS key through to the batch input-file S3 upload - [PR #35148](https://github.com/BerriAI/litellm/pull/35148)
    - Normalize `/v1/completions` and `/v1/responses` batch records - [PR #35675](https://github.com/BerriAI/litellm/pull/35675)
    - Stop forwarding a no-op `toolSpec.strict` to Converse - [PR #35688](https://github.com/BerriAI/litellm/pull/35688)
    - Drop a conflicting `tool_choice.type` when `toolConfig.toolChoice` is already set - [PR #35738](https://github.com/BerriAI/litellm/pull/35738)
    - Sign managed-file S3 requests with `S3SigV4Auth` - [PR #35983](https://github.com/BerriAI/litellm/pull/35983)
- **[Anthropic](../../docs/providers/anthropic)**
    - Stop indexing `choices[0]` on choiceless streaming chunks in the adapter - [PR #35314](https://github.com/BerriAI/litellm/pull/35314)
    - Coerce an explicit `additionalProperties` to false in the `output_format` schema - [PR #35811](https://github.com/BerriAI/litellm/pull/35811)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Surface the real error and status on batch create instead of an `IndexError` 500 - [PR #35141](https://github.com/BerriAI/litellm/pull/35141)
- **[OpenAI](../../docs/providers/openai)**
    - Apply OpenAI's `gpt-5.6` terra and luna price cut to the Azure cost map - [PR #35481](https://github.com/BerriAI/litellm/pull/35481)
- **[Groq](../../docs/providers/groq)**
    - Translate `web_search_options` to the `browser_search` tool - [PR #34971](https://github.com/BerriAI/litellm/pull/34971)
- **[Replicate](../../docs/providers/replicate)**
    - Correct the mangled `gpt-oss-20b` model key - [PR #34800](https://github.com/BerriAI/litellm/pull/34800)
- **[AI21](../../docs/providers/ai21)**
    - Resolve the documented `AI21_API_KEY` instead of a misspelled name - [PR #35985](https://github.com/BerriAI/litellm/pull/35985)
- **[Jina AI](../../docs/providers/jina_ai)**
    - Resolve the documented `JINA_API_KEY` as a fallback - [PR #35992](https://github.com/BerriAI/litellm/pull/35992)
- **General**
    - Rebuild `models_by_provider` in `add_known_models` so cost map reloads reach wildcard expansion - [PR #36010](https://github.com/BerriAI/litellm/pull/36010)

## LLM API Endpoints

#### Features

- **[Anthropic `/v1/messages`](../../docs/anthropic_unified)**
    - Send keepalive pings on SSE streams during upstream silence - [PR #36024](https://github.com/BerriAI/litellm/pull/36024)
- **Cursor**
    - Make `/cursor/chat/completions` work with Cursor agent mode - [PR #34029](https://github.com/BerriAI/litellm/pull/34029)
    - Resolve Cursor thinking and fast model-name suffixes - [PR #35554](https://github.com/BerriAI/litellm/pull/35554)
- **[Claude Code](../../docs/claude_code_compatibility)**
    - Create-only skill registration with a `PUT` update route - [PR #31752](https://github.com/BerriAI/litellm/pull/31752)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - Forward client headers to the provider on `/v1/responses` - [PR #34531](https://github.com/BerriAI/litellm/pull/34531)
    - Forward `allowed_openai_params` through the chat completions bridge - [PR #35885](https://github.com/BerriAI/litellm/pull/35885)
- **[Batches](../../docs/batches)**
    - Register managed batch output files on terminal retrieve - [PR #34092](https://github.com/BerriAI/litellm/pull/34092)
    - Account for Responses API usage - [PR #35367](https://github.com/BerriAI/litellm/pull/35367)
    - Prevent managed file fallbacks across providers - [PR #35371](https://github.com/BerriAI/litellm/pull/35371)
    - Register managed output files on batch cancel, and persist managed file ids for cancelled, failed, and expired batches - [PR #36034](https://github.com/BerriAI/litellm/pull/36034), [PR #36048](https://github.com/BerriAI/litellm/pull/36048)
- **[Managed files](../../docs/files_endpoints)**
    - Skip rows without file objects, and skip unparseable rows when listing - [PR #35365](https://github.com/BerriAI/litellm/pull/35365), [PR #36021](https://github.com/BerriAI/litellm/pull/36021)
    - Enforce `require_managed_files` on every route that accepts a raw provider id - [PR #35551](https://github.com/BerriAI/litellm/pull/35551)
    - Derive unified output file ids deterministically so concurrent registrations converge - [PR #36019](https://github.com/BerriAI/litellm/pull/36019)
    - Return unified ids from unscoped file listing and unified output file ids from `GET /batches` - [PR #36031](https://github.com/BerriAI/litellm/pull/36031), [PR #36049](https://github.com/BerriAI/litellm/pull/36049)
- **[Passthrough](../../docs/pass_through/vertex_ai)**
    - Resolve pass-through credentials live from router deployments - [PR #35916](https://github.com/BerriAI/litellm/pull/35916)
- **Web search**
    - Restore snippet text in native `web_search_tool_result` blocks - [PR #36228](https://github.com/BerriAI/litellm/pull/36228)
- **General**
    - Map a generic `error` finish reason to `stop` - [PR #33972](https://github.com/BerriAI/litellm/pull/33972)

## Management Endpoints / UI

#### Features

- **Spend reports**
    - Caller-scoped key, user, team, and organization `spend/report` endpoints - [PR #35725](https://github.com/BerriAI/litellm/pull/35725)
- **Teams & Users**
    - Custom metadata validation hook for team create and update - [PR #33353](https://github.com/BerriAI/litellm/pull/33353)
    - Apply the default organization to new teams from default team settings - [PR #35540](https://github.com/BerriAI/litellm/pull/35540)
- **Dashboard**
    - Admin-configurable, dismissible markdown user banner - [PR #35729](https://github.com/BerriAI/litellm/pull/35729)
    - Role capability gating, with the Tool Policies route migrated onto it - [PR #35812](https://github.com/BerriAI/litellm/pull/35812)
    - Non-streaming response toggle in the playground - [PR #35560](https://github.com/BerriAI/litellm/pull/35560)
    - Show the user email or alias in the usage data export - [PR #36232](https://github.com/BerriAI/litellm/pull/36232)
- **Auto-router screens**
    - Show auto-router savings and add an auto-router usage tab on the cost-optimization dashboard - [PR #35522](https://github.com/BerriAI/litellm/pull/35522), [PR #35995](https://github.com/BerriAI/litellm/pull/35995)
    - Reorder Add Auto Router into name plus template with a collapsible detailed config - [PR #35746](https://github.com/BerriAI/litellm/pull/35746)
    - Add Test Routing to the auto router create form - [PR #35859](https://github.com/BerriAI/litellm/pull/35859)
    - Match preset models against deployments' underlying model IDs - [PR #35972](https://github.com/BerriAI/litellm/pull/35972)

#### Bugs

- **Auth & roles**
    - Give `proxy_admin_viewer` read parity with `proxy_admin` across roughly fifteen read endpoints and the UI gating that shadowed them - [PR #35851](https://github.com/BerriAI/litellm/pull/35851)
    - Apply request-parameter checks consistently across body, path, and form inputs - [PR #36011](https://github.com/BerriAI/litellm/pull/36011)
    - Propagate `user_email` and bind `api_key` on JWT auth attribution paths, and backfill null `user_email` on existing users - [PR #34331](https://github.com/BerriAI/litellm/pull/34331), [PR #34588](https://github.com/BerriAI/litellm/pull/34588)
    - Name `enable_jwt_auth` when a JWT-shaped key is rejected - [PR #35831](https://github.com/BerriAI/litellm/pull/35831)
    - Return 403 from the OAuth2 enterprise gate - [PR #35838](https://github.com/BerriAI/litellm/pull/35838)
    - Re-assert the authenticated identity on passthrough requests - [PR #36121](https://github.com/BerriAI/litellm/pull/36121)
    - Stop resolving the UI session sentinel team on `/search_tools/list` - [PR #36061](https://github.com/BerriAI/litellm/pull/36061)
    - Let non-admins reach `/user/daily/activity/aggregated` - [PR #36062](https://github.com/BerriAI/litellm/pull/36062)
- **Keys & credentials**
    - Apply `key_alias` and `key_hash` filters to all `/key/list` visibility branches - [PR #35840](https://github.com/BerriAI/litellm/pull/35840)
    - Return the real status code when a credential update is rejected - [PR #36166](https://github.com/BerriAI/litellm/pull/36166)
- **Agents & access groups**
    - Derive config agent ids from `agent_name` so grants survive secret rotation - [PR #36020](https://github.com/BerriAI/litellm/pull/36020)
    - Deny agent access when key and team grants resolve to nothing - [PR #36221](https://github.com/BerriAI/litellm/pull/36221)
    - Resolve entity access groups in the model listing endpoints - [PR #36230](https://github.com/BerriAI/litellm/pull/36230)
- **Config & projects**
    - Apply key and team `router_settings.model_group_alias` - [PR #35486](https://github.com/BerriAI/litellm/pull/35486)
    - Let a YAML `store_prompts_in_spend_logs` take precedence over the DB cached value - [PR #35769](https://github.com/BerriAI/litellm/pull/35769)
    - Persist the periodic reload schedule so status survives restarts and fires without `store_model_in_db` - [PR #35165](https://github.com/BerriAI/litellm/pull/35165)
    - Invalidate the cached project object on project update and delete - [PR #36028](https://github.com/BerriAI/litellm/pull/36028)
- **Dashboard**
    - Hide guardrail review buttons from non-admin users, and block the Playground page for viewer roles on direct URL access - [PR #27535](https://github.com/BerriAI/litellm/pull/27535), [PR #35676](https://github.com/BerriAI/litellm/pull/35676)
    - Render the Responses API request and response in the logs drawer - [PR #35718](https://github.com/BerriAI/litellm/pull/35718)
    - Push `?project=` when opening a project, link project keys to their virtual key detail, and sync the projects list page index to `?page=` - [PR #36001](https://github.com/BerriAI/litellm/pull/36001), [PR #36002](https://github.com/BerriAI/litellm/pull/36002), [PR #36003](https://github.com/BerriAI/litellm/pull/36003)
    - Allow clearing a key's budget reset from the Edit Key form - [PR #36140](https://github.com/BerriAI/litellm/pull/36140)
    - Let access groups be a team's only model source, with hover provenance - [PR #36234](https://github.com/BerriAI/litellm/pull/36234)
    - Show team BYOK models in team fallback settings - [PR #36241](https://github.com/BerriAI/litellm/pull/36241)
    - Reject an auto-router keyword rule left empty instead of dropping it - [PR #35705](https://github.com/BerriAI/litellm/pull/35705)
    - Match auto-router preset models against wildcard-expanded model groups - [PR #36111](https://github.com/BerriAI/litellm/pull/36111)
    - Correct the expired-miss share to run over all measured turns, and fix the cost-optimization tab labels - [PR #36037](https://github.com/BerriAI/litellm/pull/36037)
    - Update the Anthropic model presets - [PR #35896](https://github.com/BerriAI/litellm/pull/35896)
    - Note Google's Agent Platform rename in the vector store setup copy - [PR #28076](https://github.com/BerriAI/litellm/pull/28076)
- **Dashboard internals**
    - Replace hand-rolled query-param routing with `nuqs` - [PR #35871](https://github.com/BerriAI/litellm/pull/35871)
    - Inject the fetch client's base url instead of reading it at import - [PR #35802](https://github.com/BerriAI/litellm/pull/35802)
    - Route MCP session tokens through the shared storage helper - [PR #35835](https://github.com/BerriAI/litellm/pull/35835)
    - Extract the MCP create form's logic and field groups, and rename the create MCP server component to PascalCase - [PR #35694](https://github.com/BerriAI/litellm/pull/35694), [PR #35686](https://github.com/BerriAI/litellm/pull/35686)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Mark v2 server spans as failed for pre-call errors - [PR #34546](https://github.com/BerriAI/litellm/pull/34546)
    - Stamp service tier attributes on inference spans - [PR #35679](https://github.com/BerriAI/litellm/pull/35679)
    - Name the RPC system and upstream on MCP tool-call spans - [PR #35857](https://github.com/BerriAI/litellm/pull/35857)
- **Arize Phoenix**
    - Lowercase the OTLP/gRPC auth metadata key - [PR #34883](https://github.com/BerriAI/litellm/pull/34883)
- **[DataDog](../../docs/proxy/logging#datadog)**
    - Read team callback `dd_*` params from kwargs instead of blocked dynamic params - [PR #35687](https://github.com/BerriAI/litellm/pull/35687)
- **[Langfuse](../../docs/proxy/logging#langfuse)**
    - Stop a collected httpx handler from closing a shared client - [PR #35981](https://github.com/BerriAI/litellm/pull/35981)
- **[s3](../../docs/proxy/logging#s3-buckets)**
    - Sign S3 object URLs with `S3SigV4Auth` so encoded paths verify - [PR #35726](https://github.com/BerriAI/litellm/pull/35726)
- **Azure Storage**
    - Honor `AZURE_STORAGE_ENDPOINT_SUFFIX` for sovereign clouds - [PR #35806](https://github.com/BerriAI/litellm/pull/35806)
- **[Azure Sentinel](../../docs/observability/azure_sentinel)**
    - Respect `AZURE_AUTHORITY_HOST` for the Entra token and derive the Azure Monitor audience per cloud, with `AZURE_SENTINEL_AUTHORITY_HOST` as a scoped override - [PR #36137](https://github.com/BerriAI/litellm/pull/36137), [PR #36165](https://github.com/BerriAI/litellm/pull/36165)
- **General**
    - Actually stop logging when a team callback calls `disable_logging` - [PR #35520](https://github.com/BerriAI/litellm/pull/35520)
    - Redact credential headers from request logging copies, and extend secret redaction to records litellm does not emit directly - [PR #35678](https://github.com/BerriAI/litellm/pull/35678), [PR #35977](https://github.com/BerriAI/litellm/pull/35977)
    - Promote caller metadata trace fields into `litellm_metadata`, and fall back to `litellm_metadata` when `metadata` is empty - [PR #35866](https://github.com/BerriAI/litellm/pull/35866), [PR #36105](https://github.com/BerriAI/litellm/pull/36105)

### Guardrails

- **[General](../../docs/proxy/guardrails/quick_start)**
    - New `scan_only_tool_results` flag scopes a unified guardrail to tool results - [PR #36014](https://github.com/BerriAI/litellm/pull/36014)
    - Scan `/v1/messages` tool traffic - [PR #35999](https://github.com/BerriAI/litellm/pull/35999)
    - Scan model output on the `/openai/v1/responses` alias - [PR #35818](https://github.com/BerriAI/litellm/pull/35818)
    - Let `litellm_content_filter` run on `post_mcp_call` - [PR #35980](https://github.com/BerriAI/litellm/pull/35980)
- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock)**
    - Chunk oversized `ApplyGuardrail` requests instead of failing - [PR #36119](https://github.com/BerriAI/litellm/pull/36119)
- **Rubrik**
    - Prompt moderation, response-text blocking, a streaming buffer, and failure logging - [PR #35722](https://github.com/BerriAI/litellm/pull/35722)
    - Attribute blocked requests to the caller that made them - [PR #35734](https://github.com/BerriAI/litellm/pull/35734)
- **Zscaler AI Guard**
    - Honor the configured timeout - [PR #36110](https://github.com/BerriAI/litellm/pull/36110)
    - Return the right HTTP code when input is blocked - [PR #31948](https://github.com/BerriAI/litellm/pull/31948)
- **Compresr / Headroom**
    - Improve the `/v1/compress` HTTP 404 diagnostics - [PR #35952](https://github.com/BerriAI/litellm/pull/35952)

## Spend Tracking, Budgets and Rate Limiting

- **Gateway request accounting**
    - Make the gateway middleware the source of truth for successful requests, with a new by-endpoint breakdown - [PR #35717](https://github.com/BerriAI/litellm/pull/35717)
- **Reporting**
    - Caller-scoped key, user, team, and organization spend report endpoints - [PR #35725](https://github.com/BerriAI/litellm/pull/35725)
    - Include today's UTC bucket when a daily activity range ends at the caller's current day - [PR #36051](https://github.com/BerriAI/litellm/pull/36051)
- **Auto-router savings**
    - Add net auto-router savings to the cost-optimization dashboard and derive a default baseline from the hardest tier - [PR #35521](https://github.com/BerriAI/litellm/pull/35521), [PR #35907](https://github.com/BerriAI/litellm/pull/35907)
    - Rebuild the auto-router benchmarks backend as a per-session rollup, and track turns per complexity tier - [PR #35910](https://github.com/BerriAI/litellm/pull/35910), [PR #36209](https://github.com/BerriAI/litellm/pull/36209)
    - Report the LLM classifier cost per request via `routing_decision` and an `x-litellm-classifier-cost` header - [PR #36015](https://github.com/BerriAI/litellm/pull/36015)
- **Budgets**
    - New opt-in `apply_user_budget_to_team_keys`, default off, reaching all three personal-budget gates - [PR #36102](https://github.com/BerriAI/litellm/pull/36102)
    - Enforce per-model budgets against resolved Cursor model variants - [PR #35834](https://github.com/BerriAI/litellm/pull/35834)
    - Warn at startup when `max_budget` is set but no database is connected - [PR #36041](https://github.com/BerriAI/litellm/pull/36041)
- **[Cost tracking](../../docs/proxy/cost_tracking)**
    - Read what a request cost from the record instead of pricing it again - [PR #35736](https://github.com/BerriAI/litellm/pull/35736)
    - Bill `gpt-5.6` prompt cache reads at the cache read rate, and keep OpenAI prompt cache token details through usage reassembly - [PR #34957](https://github.com/BerriAI/litellm/pull/34957), [PR #34812](https://github.com/BerriAI/litellm/pull/34812)
    - Bill reasoning tokens at the service tier output rate, and sync flex and priority tier keys to dated OpenAI snapshot variants - [PR #35925](https://github.com/BerriAI/litellm/pull/35925), [PR #35923](https://github.com/BerriAI/litellm/pull/35923)
    - Bill intercepted web searches to the calling key - [PR #35708](https://github.com/BerriAI/litellm/pull/35708)
    - Stop token-pricing the placeholder input on file content calls - [PR #35140](https://github.com/BerriAI/litellm/pull/35140)
    - Track cost for managed batches with no attributable key or user - [PR #35468](https://github.com/BerriAI/litellm/pull/35468)
    - Fetch background responses through the router in `CheckResponsesCost` - [PR #35137](https://github.com/BerriAI/litellm/pull/35137)

## Performance / Loadbalancing / Reliability improvements

- **Router & auto-router**
    - Independent, default-on `deployment_affinity` for the auto-router - [PR #36146](https://github.com/BerriAI/litellm/pull/36146)
    - Let operators replace the LLM classifier's system prompt and rename the four complexity tiers - [PR #35855](https://github.com/BerriAI/litellm/pull/35855), [PR #35893](https://github.com/BerriAI/litellm/pull/35893)
    - Default session affinity off and expose it in the UI - [PR #35714](https://github.com/BerriAI/litellm/pull/35714)
    - Make the reminder marker pair configurable, and accept every pair a harness emits - [PR #35874](https://github.com/BerriAI/litellm/pull/35874), [PR #36029](https://github.com/BerriAI/litellm/pull/36029)
    - Match CJK `keyword_tier_rules` that regex word boundaries miss - [PR #35984](https://github.com/BerriAI/litellm/pull/35984)
    - Stop the embedding model's context window from failing long requests - [PR #35956](https://github.com/BerriAI/litellm/pull/35956)
    - Bound fallback-walk work and error-log volume - [PR #36148](https://github.com/BerriAI/litellm/pull/36148)
    - Redact fallback tracebacks at the call site and cover the sync deferred stream - [PR #35843](https://github.com/BerriAI/litellm/pull/35843)
    - Eagerly fetch the Vertex AI deferred stream so HTTP errors surface in the `_acompletion` fallback path - [PR #34627](https://github.com/BerriAI/litellm/pull/34627)
    - Keep custom `model_info` across a price data reload - [PR #35491](https://github.com/BerriAI/litellm/pull/35491)
- **Connections & caching**
    - Self-heal handler clients closed after cache eviction, then re-land closing of evicted LLM clients on top of it - [PR #35862](https://github.com/BerriAI/litellm/pull/35862), [PR #35870](https://github.com/BerriAI/litellm/pull/35870)
    - Stop pooled clients persisting cookies on the aiohttp jar - [PR #36149](https://github.com/BerriAI/litellm/pull/36149)
    - Stop writing per-caller state onto the shared cached A2A httpx client - [PR #35978](https://github.com/BerriAI/litellm/pull/35978)
    - Install hiredis so redis-py parses replies with its C parser - [PR #35709](https://github.com/BerriAI/litellm/pull/35709)
- **Throughput**
    - Build log messages lazily so filtered-out log records cost nothing - [PR #35703](https://github.com/BerriAI/litellm/pull/35703)
    - Assemble streamed tool-call arguments in linear time - [PR #35826](https://github.com/BerriAI/litellm/pull/35826)
- **Database & startup**
    - Only treat a recoverable database outage as grounds to serve without one, and keep the connected DB client when a startup health check fails - [PR #35864](https://github.com/BerriAI/litellm/pull/35864), [PR #35837](https://github.com/BerriAI/litellm/pull/35837)
    - Stop alerting on health probes that lose the planned engine-restart race - [PR #36141](https://github.com/BerriAI/litellm/pull/36141)
    - Retry the model cost map fetch with Retry-After-aware backoff, keep the current map on reload failure, and log that failure lazily - [PR #35739](https://github.com/BerriAI/litellm/pull/35739), [PR #35750](https://github.com/BerriAI/litellm/pull/35750)
- **Migrations & images**
    - Recover from an interrupted Prisma toolchain install, and keep the heal from raising on an unreadable nodeenv cache - [PR #35832](https://github.com/BerriAI/litellm/pull/35832), [PR #35986](https://github.com/BerriAI/litellm/pull/35986)
    - Bake the prisma engines at a world-readable path in the pip image and at `/opt/prisma` in the componentized images so any uid can start - [PR #35976](https://github.com/BerriAI/litellm/pull/35976), [PR #35989](https://github.com/BerriAI/litellm/pull/35989)
- **Dependencies & maintenance**
    - Upgrade cryptography to 50.0.0 - [PR #35803](https://github.com/BerriAI/litellm/pull/35803)
    - Bump gitpython to 3.1.58, h2 to 4.4.1, js-yaml to 4.3.1, nanoid to 3.3.17, brace-expansion, and postcss - [PR #36212](https://github.com/BerriAI/litellm/pull/36212), [PR #36147](https://github.com/BerriAI/litellm/pull/36147), [PR #36227](https://github.com/BerriAI/litellm/pull/36227), [PR #35692](https://github.com/BerriAI/litellm/pull/35692)
    - Move the Admin UI toolchain to Node 24 - [PR #35801](https://github.com/BerriAI/litellm/pull/35801)
    - Sync the Terraform provider 0.3.0 from the mirror and cut 0.4.0 - [PR #36098](https://github.com/BerriAI/litellm/pull/36098)

## Documentation Updates

- Document the `/key/info` fields and clarify that `budget_reset_at` is the next reset - [PR #36127](https://github.com/BerriAI/litellm/pull/36127)
- Replace the classic Helm chart's 128Mi resource example with the documented 4Gi sizing - [PR #35830](https://github.com/BerriAI/litellm/pull/35830)
- Add a User Flow section with authoring instructions to the PR template - [PR #36162](https://github.com/BerriAI/litellm/pull/36162)
- Cap all GitHub comments at 15-25 words and curb semicolon splices in the contributor guide - [PR #36059](https://github.com/BerriAI/litellm/pull/36059)
- Prefer commas over semicolons when replacing em dashes, and clarify guideline priority ordering - [PR #35825](https://github.com/BerriAI/litellm/pull/35825), [PR #36296](https://github.com/BerriAI/litellm/pull/36296)

### PR roll-up by ownership area

PRs by ownership area (total: 252)

- Other (CI / chore / tests / build / version bumps): 86
- Performance: 30
- UI: 28
- Auth & Management: 20
- LLM API Endpoints: 20
- Spend / Budgets / Rate Limits: 20
- Models & Providers: 17
- Logging: 15
- Guardrails: 10
- Docs: 6

## End-to-End Testing

We are investing heavily in end-to-end testing to cut regressions and make LiteLLM more stable release over release. Every version is exercised by a live suite that runs against a real deployed proxy and hits real provider endpoints, not mocks, so the behavior we validate is the behavior you get in production.

This window added 18 test-only PRs, 11 of them touching the live e2e suite. New and repaired coverage lands on the legacy text `/completions` endpoint, control-plane writes settled across every replica rather than just one, provider-transient statuses retried at the transport with bounded backoff, and the UI suite self-seeding its own password-login users in global setup. Load and performance testing moved out of the main suite so a slow lane no longer gates correctness, and the vendor API strategy coverage added mid-window was reverted after it proved unstable. View-backed global spend probes are parked behind LIT-5211 rather than left flaking.

## New Contributors

- @hMED22 made their first contribution in [PR #34971](https://github.com/BerriAI/litellm/pull/34971)
- @AkashNaickar made their first contribution in [PR #34800](https://github.com/BerriAI/litellm/pull/34800)
- @Souravrajvi0 made their first contribution in [PR #34092](https://github.com/BerriAI/litellm/pull/34092)
- @rimysore made their first contribution in [PR #35367](https://github.com/BerriAI/litellm/pull/35367)
- @elinacse made their first contribution in [PR #35468](https://github.com/BerriAI/litellm/pull/35468)
- @aayush598 made their first contribution in [PR #35952](https://github.com/BerriAI/litellm/pull/35952)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.96.0-rc.1...v1.97.0-rc.1
