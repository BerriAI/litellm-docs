---
title: "v1.94.0 - Router Plugins, MCP Client-Held Credentials & Shared DataTable UI"
slug: "v1-94-0"
date: 2026-07-28T00:00:00
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
docker.litellm.ai/berriai/litellm:1.94.0
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.94.0
```

</TabItem>
</Tabs>

:::danger Known issue - fixed in v1.94.1

**A user's personal `max_budget` was enforced on their team keys, which could lock them out of the Admin UI.** Upgrade to [`v1.94.1`](/release_notes/v1.94.1/v1-94-1).

Once a user's personal spend crossed their own budget, their team keys returned `429 ExceededBudget` even with team budget remaining. The check also runs on management routes, and the Admin UI session token is team-scoped, so the dashboard rendered empty for affected users.

`v1.94.1` reverts this and removes the `general_settings.skip_user_budget_on_team_key` opt-out; remove it from your config if you set it.

:::

:::danger Breaking Changes

**`timeout`, `stream_timeout`, and `request_timeout` in `litellm_params` are now enforced on `/v1/messages` traffic.** Earlier versions silently ignored these values for Anthropic Messages API calls, which always ran with the 600s client default. They now apply, and for streaming requests `stream_timeout` caps the wait between any two chunks of the stream, not only the first token. A low value that previously had no effect, such as `stream_timeout: 30`, will now fail long-running Claude streams mid-response with `ReadTimeout: Timeout on reading data from socket`. Review these values on your Anthropic and Bedrock Claude deployments before upgrading. See [PR #33418](https://github.com/BerriAI/litellm/pull/33418).

:::

## Key Highlights

- **Router plugin pipeline and Auto-Router v2** - a new `Router(plugins=[...])` extension point, resolvable from proxy YAML config, plus soft-floor adaptive mode, opt-in (now default) session affinity, multi-model tier random-pick, and user-triggered escalation keywords for the complexity router.
- **MCP client-held credentials mature** - interactive SSO sign-in for `dcr_bridge` `oauth_delegate` DCR clients, client-held refresh envelopes, gateway-bound envelopes minted at the token endpoint, issuer-anchored OAuth discovery (RFC 8414 §3.3) to close the authorization-server mix-up, and ID-JAG support for MCP egress.
- **Cost Optimization page (beta)** - a new dashboard surface with Usage, Prompt Compression, Autorouter, and Prompt Caching tabs, savings broken out by driver, spend by tool, and a cache leakage card that estimates what your uncached input would have saved under prompt caching.
- **Shared DataTable dashboard migration** - Virtual Keys, Teams, Guardrails, Tags, Vector Stores, Prompts, Skills, AI Hub, MCP Toolsets, and Policy Attachments all move onto the shared composable DataTable.
- **Python 3.14 support** - the `requires-python` cap moves to `<3.15`, pyo3 rises to 0.29 so the native Rust bridge compiles, and redisvl / pypdf / openapi-core are unblocked on 3.14.
- **Per-model prompt cache minimums** - `prompt_cache_min_tokens` is now recorded across the Anthropic and Bedrock Claude cost map entries, and the router resolves the real per-model minimum instead of a flat 1024.

## New Models / Updated Models

#### New Model Support (5 new pricing entries)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| Google AI Studio | `gemini/gemini-omni-flash-preview` | 1.05M | $1.50 | $9.00 (video output $17.50) | Reasoning, vision, audio input, video input/output |
| Google Vertex AI | `gemini-omni-flash-preview` | 1.05M | $1.50 | $9.00 (video output $17.50) | Reasoning, vision, audio input, video input/output |
| Amazon Bedrock (Mantle) | `bedrock_mantle/openai.gpt-5.6-sol` | 272K | $5.50 | $33.00 | Reasoning, vision, function calling, prompt caching, Responses API |
| Amazon Bedrock (Mantle) | `bedrock_mantle/openai.gpt-5.6-terra` | 272K | $2.75 | $16.50 | Reasoning, vision, function calling, prompt caching, Responses API |
| Amazon Bedrock (Mantle) | `bedrock_mantle/openai.gpt-5.6-luna` | 272K | $1.10 | $6.60 | Reasoning, vision, function calling, prompt caching, Responses API |

Beyond the new entries, this release records `prompt_cache_min_tokens` on the Anthropic and Bedrock Claude families (512-4096 depending on the model), marks the `gpt-realtime` family as `mode: realtime` rather than `chat`, flags Gemini image-generation models as non-reasoning, and corrects the Fireworks `glm-5p2` prompt-cache read price.

#### Features

- **[Anthropic](../../docs/providers/anthropic)**
    - Add `enable_anthropic_prompt_caching` for automatic `cache_control` injection - [PR #33573](https://github.com/BerriAI/litellm/pull/33573)
    - Use the native output capability when the model advertises it - [PR #33235](https://github.com/BerriAI/litellm/pull/33235)
- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Add GPT-5.6 `sol` / `terra` / `luna` to the Bedrock Mantle cost map - [PR #33412](https://github.com/BerriAI/litellm/pull/33412)
    - Route `xai.grok-4.3` through the `/openai/v1` frontier path on Bedrock Mantle - [PR #33027](https://github.com/BerriAI/litellm/pull/33027)
    - Forward `bedrock_tags` to `CreateModelInvocationJob` for batch jobs - [PR #33733](https://github.com/BerriAI/litellm/pull/33733)
- **[Google AI Studio / Vertex AI](../../docs/providers/vertex)**
    - Add `gemini-omni-flash-preview` with video output token pricing - [PR #33274](https://github.com/BerriAI/litellm/pull/33274)
- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Map the LiteLLM session id to the `x-session-affinity` header for prompt caching - [PR #33717](https://github.com/BerriAI/litellm/pull/33717)

### Bug Fixes

- **[Anthropic](../../docs/providers/anthropic)**
    - Emit `message_start` exactly once in the Responses stream adapter - [PR #32667](https://github.com/BerriAI/litellm/pull/32667)
    - Translate raw adaptive thinking for pre-4.6 models on Chat Completions and Bedrock Converse - [PR #32944](https://github.com/BerriAI/litellm/pull/32944)
    - Drop the incompatible `temperature` param when downgrading adaptive thinking for pre-4.6 models on pass-through - [PR #33244](https://github.com/BerriAI/litellm/pull/33244)
    - Stop a 500 on a combined thinking-plus-signature streaming chunk - [PR #33505](https://github.com/BerriAI/litellm/pull/33505)
    - Self-heal on missing thinking-signature errors from Bedrock and Vertex - [PR #33719](https://github.com/BerriAI/litellm/pull/33719)
    - Drop empty `content_block_delta` events in the Anthropic adapter - [PR #33315](https://github.com/BerriAI/litellm/pull/33315)
    - Honor the messages request timeout - [PR #33418](https://github.com/BerriAI/litellm/pull/33418)
    - Unblock `lite autoroute` proxy deps, adaptive thinking, and thinking-plus-signature streaming in the CLI - [PR #33507](https://github.com/BerriAI/litellm/pull/33507)
- **[Google Vertex AI](../../docs/providers/vertex)**
    - Surface Gemini grounding `toolUsePromptTokenCount` in `Usage` - [PR #33533](https://github.com/BerriAI/litellm/pull/33533)
    - Exclude Google Search grounding tokens from input token billing - [PR #33742](https://github.com/BerriAI/litellm/pull/33742)
    - Mark Gemini image generation models with `supports_reasoning: false` - [PR #32836](https://github.com/BerriAI/litellm/pull/32836)
- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Forward AWS credential kwargs into `litellm_params` so the responses bridge keeps WIF auth - [PR #32956](https://github.com/BerriAI/litellm/pull/32956)
- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Bill prompt-cache hits at the `cache_read` rate - [PR #33714](https://github.com/BerriAI/litellm/pull/33714)
    - Correct the `glm-5p2` prompt-cache read price to $0.14/1M - [PR #33796](https://github.com/BerriAI/litellm/pull/33796)
    - Restore the `Content-Type: application/json` request header so calls stop failing with a 415 - [PR #33929](https://github.com/BerriAI/litellm/pull/33929)
- **[OpenAI](../../docs/providers/openai)**
    - Mark realtime-only `gpt-realtime` models as `mode: realtime` - [PR #33728](https://github.com/BerriAI/litellm/pull/33728)

## LLM API Endpoints

#### Features

- **General**
    - Add an `x-litellm-model-name` response header carrying the deployment model string - [PR #33698](https://github.com/BerriAI/litellm/pull/33698)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - Continue MCP gateway tool turns from the final response and surface failures - [PR #33025](https://github.com/BerriAI/litellm/pull/33025)
    - Clamp `max_output_tokens` below the API minimum - [PR #33098](https://github.com/BerriAI/litellm/pull/33098)
    - Intercept web search on the Responses API - [PR #33129](https://github.com/BerriAI/litellm/pull/33129)
- **[Pass-through](/docs/pass_through/intro)**
    - Stop classifying plain `predict` / `search` paths as Vertex - [PR #33658](https://github.com/BerriAI/litellm/pull/33658)
    - Stop treating an upstream `model` body field as a LiteLLM model on auth-enforced pass-through routes - [PR #33710](https://github.com/BerriAI/litellm/pull/33710)
- **General**
    - Surface upstream connection resets instead of an empty 200 stream - [PR #33222](https://github.com/BerriAI/litellm/pull/33222)
    - Source `/v1/models` token limits from the cost map instead of `Router.get_model_group_info` - [PR #33721](https://github.com/BerriAI/litellm/pull/33721)
    - Treat malformed configured token limits as absent on `/v1/models` - [PR #33864](https://github.com/BerriAI/litellm/pull/33864)

## Management Endpoints / UI

#### Features

- **UI (shared DataTable migration)**
    - Rebuild the Virtual Keys and Teams tables on the shared DataTable - [PR #32991](https://github.com/BerriAI/litellm/pull/32991), [PR #33128](https://github.com/BerriAI/litellm/pull/33128)
    - Migrate the guardrails, tags, and policy attachments tables onto the shared DataTable - [PR #33303](https://github.com/BerriAI/litellm/pull/33303), [PR #33314](https://github.com/BerriAI/litellm/pull/33314), [PR #33827](https://github.com/BerriAI/litellm/pull/33827)
    - Migrate the vector stores, prompts, and skills tables, plus five more simple tables - [PR #33343](https://github.com/BerriAI/litellm/pull/33343), [PR #33548](https://github.com/BerriAI/litellm/pull/33548)
    - Migrate the AI Hub, public hub, and MCP Toolsets tables - [PR #33629](https://github.com/BerriAI/litellm/pull/33629)
- **UI (Cost Optimization)**
    - Add spend-by-tool and cache leakage views to the Cost Optimization page - [PR #33978](https://github.com/BerriAI/litellm/pull/33978)
    - Add Usage, Prompt Compression, Autorouter, and Prompt Caching configuration tabs - [PR #33899](https://github.com/BerriAI/litellm/pull/33899)
    - Mark Cost Optimization as beta in the left nav - [PR #34984](https://github.com/BerriAI/litellm/pull/34984)
- **UI**
    - Convert the endpoint usage charts to shadcn/recharts - [PR #32723](https://github.com/BerriAI/litellm/pull/32723)
    - Adopt `openapi-react-query` (`$api`) and convert `useCustomers` - [PR #32949](https://github.com/BerriAI/litellm/pull/32949)
    - Working Test Connection for the complexity auto router, and adaptive routing settings in Auto-Router v2 - [PR #32950](https://github.com/BerriAI/litellm/pull/32950), [PR #33146](https://github.com/BerriAI/litellm/pull/33146)
    - Require an embedding model for the semantic auto router - [PR #33313](https://github.com/BerriAI/litellm/pull/33313)
    - Configure Anthropic automatic prompt caching from the Admin UI - [PR #33581](https://github.com/BerriAI/litellm/pull/33581)
    - Show the exact license expiration date in the usage cards - [PR #33478](https://github.com/BerriAI/litellm/pull/33478)
    - Move Caching out of Experimental into Developer Tools - [PR #33432](https://github.com/BerriAI/litellm/pull/33432)
    - Add a reusable `BetaBadge` and use it for the Projects sidebar item - [PR #33449](https://github.com/BerriAI/litellm/pull/33449)
    - Add a personal Logs view scoped to the current user in the chat UI - [PR #33829](https://github.com/BerriAI/litellm/pull/33829)
    - Left-anchor the Create Key and Create Team CTAs - [PR #33248](https://github.com/BerriAI/litellm/pull/33248)
    - Consolidate the Add/Edit credential modals into one `CredentialModal` - [PR #32572](https://github.com/BerriAI/litellm/pull/32572)
    - Colocate the mcp-servers view while keeping the shared `mcp_tools` surface - [PR #32968](https://github.com/BerriAI/litellm/pull/32968)
    - Standardize debounce waits behind a shared `DEBOUNCE_WAIT_MS` constant and migrate value and callback debounces to react-pacer - [PR #33040](https://github.com/BerriAI/litellm/pull/33040), [PR #33042](https://github.com/BerriAI/litellm/pull/33042), [PR #33043](https://github.com/BerriAI/litellm/pull/33043), [PR #33041](https://github.com/BerriAI/litellm/pull/33041)
    - Remove the unmounted `UsageIndicator` and the Hide Usage Indicator flag - [PR #33482](https://github.com/BerriAI/litellm/pull/33482)
- **Auth & Management**
    - Ingest and round-trip SCIM entitlements and roles user attributes - [PR #33587](https://github.com/BerriAI/litellm/pull/33587)
    - Add a `disable_auto_add_proxy_admin_to_teams` flag - [PR #33563](https://github.com/BerriAI/litellm/pull/33563)
    - Add `lite up` / `lite down` to ambiently route Claude Code through the proxy - [PR #33231](https://github.com/BerriAI/litellm/pull/33231)

#### Bugs

- **UI (Cost Optimization)**
    - Keep the cache leakage time range picker inline at narrow widths - [PR #34439](https://github.com/BerriAI/litellm/pull/34439), [PR #34885](https://github.com/BerriAI/litellm/pull/34885)
    - Anchor the savings chart at a $0 range start and move the savings methodology into per-card info popovers - [PR #34994](https://github.com/BerriAI/litellm/pull/34994)
    - Add the missing page description - [PR #34967](https://github.com/BerriAI/litellm/pull/34967)
- **UI**
    - Address Virtual Keys redesign review nits - [PR #33112](https://github.com/BerriAI/litellm/pull/33112)
    - Drop `w-full` from page-content wrappers to remove 32px horizontal overflow - [PR #33118](https://github.com/BerriAI/litellm/pull/33118)
    - Render the sidebar scrollbar with the shadcn `ScrollArea` - [PR #33124](https://github.com/BerriAI/litellm/pull/33124)
    - Show and allow editing team model aliases after team creation - [PR #33047](https://github.com/BerriAI/litellm/pull/33047)
    - Respect `litellm_key_header_name` in BYOK credential save and workflow-run fetches - [PR #33103](https://github.com/BerriAI/litellm/pull/33103)
    - Stop credential edit from persisting the masked API key - [PR #33797](https://github.com/BerriAI/litellm/pull/33797)
    - Resolve chat routes at render time so navigation works under `server_root_path` - [PR #33446](https://github.com/BerriAI/litellm/pull/33446)
    - Navigate to `/ui/login/` with a trailing slash via hard navigation - [PR #33561](https://github.com/BerriAI/litellm/pull/33561)
    - Show all teams in the policy attachment form for admins - [PR #33628](https://github.com/BerriAI/litellm/pull/33628)
    - Remove the Chat item from the dashboard left nav - [PR #33647](https://github.com/BerriAI/litellm/pull/33647)
    - Migrate tag deletion to the shared `DeleteResourceModal` - [PR #33795](https://github.com/BerriAI/litellm/pull/33795)
    - Stop sending the complexity-router pseudo-model to `/health/test_connection` - [PR #33498](https://github.com/BerriAI/litellm/pull/33498)
    - Filter embedding models out of the complexity tab dropdowns, require all tiers, and validate inline - [PR #32978](https://github.com/BerriAI/litellm/pull/32978)
- **Auth & Management**
    - Route the master key to team-scoped models - [PR #32926](https://github.com/BerriAI/litellm/pull/32926)
    - Stop unrecognized model namespaces slipping through provider wildcard keys - [PR #32979](https://github.com/BerriAI/litellm/pull/32979)
    - Persist `key_type` so the UI shows the correct key scope instead of "All Proxy Models" - [PR #33115](https://github.com/BerriAI/litellm/pull/33115)
    - Enforce a minimum custom key length and mask short keys in `key_name` - [PR #33462](https://github.com/BerriAI/litellm/pull/33462)
    - Paginate through all pages when fetching SSO service principal group assignments - [PR #33149](https://github.com/BerriAI/litellm/pull/33149)
    - Scope the JWT enterprise gate to actual JWTs - [PR #33296](https://github.com/BerriAI/litellm/pull/33296)
    - Stop enforcing the UI session budget on CLI login tokens - [PR #33312](https://github.com/BerriAI/litellm/pull/33312)
    - Surface actionable CLI SSO errors when the CLI and proxy versions skew - [PR #33309](https://github.com/BerriAI/litellm/pull/33309)
    - Resolve team wildcard credentials for vector store files - [PR #33649](https://github.com/BerriAI/litellm/pull/33649)
    - Make CLI output ASCII-only so it does not crash legacy Windows consoles - [PR #33465](https://github.com/BerriAI/litellm/pull/33465)
    - Share CLI SSO login sessions across workers without `enable_redis_auth_cache` - [PR #33261](https://github.com/BerriAI/litellm/pull/33261)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Push-based OTLP billable-request metering for enterprise deployments - [PR #31592](https://github.com/BerriAI/litellm/pull/31592)
    - Restore proxy-level `error.*` attributes on v2 failure spans - [PR #33664](https://github.com/BerriAI/litellm/pull/33664)
- **[Langfuse](../../docs/observability/langfuse_integration)**
    - Build a per-request OTLP exporter from key- and team-level dynamic Langfuse credentials - [PR #32437](https://github.com/BerriAI/litellm/pull/32437)
- **[Prometheus](../../docs/proxy/prometheus)**
    - Expose video duration and image count consumption metrics - [PR #33138](https://github.com/BerriAI/litellm/pull/33138)
    - Read v3 rate limiter remaining values for the per-key model gauges - [PR #33119](https://github.com/BerriAI/litellm/pull/33119)
- **[S3](../../docs/proxy/logging#s3-buckets)**
    - Sanitize slashes in the response-id-derived object key file name - [PR #33271](https://github.com/BerriAI/litellm/pull/33271)
- **General**
    - Add user- and team-level spend and budget to `StandardLoggingPayload` metadata - [PR #33459](https://github.com/BerriAI/litellm/pull/33459)
    - Add structured budget fields to budget rejection failure logs - [PR #33460](https://github.com/BerriAI/litellm/pull/33460)
    - Preserve callback order in `get_combined_callback_list` - [PR #33005](https://github.com/BerriAI/litellm/pull/33005)
    - Classify async `anthropic_messages` and `generate_content` as async - [PR #33589](https://github.com/BerriAI/litellm/pull/33589)
    - Redact the async complete streaming response for custom callbacks - [PR #33106](https://github.com/BerriAI/litellm/pull/33106)
    - Redact assistant tool call arguments in spend logs - [PR #33111](https://github.com/BerriAI/litellm/pull/33111)
    - Never log raw virtual keys in key insertion debug output - [PR #33268](https://github.com/BerriAI/litellm/pull/33268)

### Guardrails

- **[Straiker](/docs/proxy/guardrails/quick_start)**
    - Add the Straiker guardrail integration - [PR #33781](https://github.com/BerriAI/litellm/pull/33781)
- **[Compresr](/docs/proxy/guardrails/quick_start)**
    - Add the Compresr guardrail for query-aware context compression - [PR #33295](https://github.com/BerriAI/litellm/pull/33295)
- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock)**
    - Add a resource-less `InvokeGuardrailChecks` detect-only mode - [PR #33299](https://github.com/BerriAI/litellm/pull/33299)
- **[Model Armor](../../docs/proxy/guardrails/model_armor)**
    - Restore reference attachments via `skip_unscannable_attachments` and remove the attachment count cap - [PR #33554](https://github.com/BerriAI/litellm/pull/33554)
    - Handle `None` metadata in `post_call` response processing - [PR #34405](https://github.com/BerriAI/litellm/pull/34405)
- **[Lasso](/docs/proxy/guardrails/quick_start)**
    - Send `source.type` for Used By attribution - [PR #33090](https://github.com/BerriAI/litellm/pull/33090)
- **[LLM Guard](/docs/proxy/guardrails/quick_start)**
    - Apply the sanitized prompt returned by the moderation API to the request - [PR #33331](https://github.com/BerriAI/litellm/pull/33331)
- **General**
    - Streaming text transformation in `generic_guardrail_api` - [PR #33110](https://github.com/BerriAI/litellm/pull/33110)
    - Forward optional metadata on `POST /guardrails/apply_guardrail` - [PR #33067](https://github.com/BerriAI/litellm/pull/33067)
    - Run `apply_guardrail`-style model-level `pre_call` guardrails at the deployment hook - [PR #33136](https://github.com/BerriAI/litellm/pull/33136)
    - Show YAML-defined guardrails in the Guardrail Monitor - [PR #32853](https://github.com/BerriAI/litellm/pull/32853)
    - Walk `custom_tool_call_output` items in the shared content helpers - [PR #32969](https://github.com/BerriAI/litellm/pull/32969)
    - Use `StandardLoggingGuardrailInformation` in the xecguard logging hook, and sanitize the scan result before recording it - [PR #32911](https://github.com/BerriAI/litellm/pull/32911), [PR #32935](https://github.com/BerriAI/litellm/pull/32935)
    - Remove the stray docstring from the singulr module for consistency - [PR #33800](https://github.com/BerriAI/litellm/pull/33800)

## Spend Tracking, Budgets and Rate Limiting

- **Budgets**
    - Enforce user budget on team keys at read time and on reservation, with a UI opt-out - [PR #32005](https://github.com/BerriAI/litellm/pull/32005)
    - Coerce `default_internal_user_params.max_budget` to a float on config load - [PR #32434](https://github.com/BerriAI/litellm/pull/32434)
    - Apply `temp_budget_increase` for cache-hit keys, handle a tz-aware `temp_budget_expiry`, and derive the increase without mutating the token - [PR #33841](https://github.com/BerriAI/litellm/pull/33841), [PR #33840](https://github.com/BerriAI/litellm/pull/33840), [PR #34121](https://github.com/BerriAI/litellm/pull/34121)
- **Rate Limiting**
    - Enforce `max_parallel_requests` as a per-slot concurrency gauge - [PR #32441](https://github.com/BerriAI/litellm/pull/32441)
- **Cost Tracking**
    - Use the provider-reported usage cost for OpenRouter streams - [PR #32255](https://github.com/BerriAI/litellm/pull/32255)
    - Track cost for unmanaged Bedrock batches and generalize the flag - [PR #32315](https://github.com/BerriAI/litellm/pull/32315)
    - Track unauthenticated pass-through requests in spend logs - [PR #32410](https://github.com/BerriAI/litellm/pull/32410)
    - Track LLM completion usage and spend for `/v1/rag/query` - [PR #32438](https://github.com/BerriAI/litellm/pull/32438)
    - Bill partial streamed spend when the client disconnects mid-stream - [PR #33736](https://github.com/BerriAI/litellm/pull/33736)
    - Remove the dead user-cache lookup with a `None` key in the spend-update path - [PR #33555](https://github.com/BerriAI/litellm/pull/33555)
    - Roll tool spend up daily instead of scanning `SpendLogs`, and cap the `/v1/tool/spend` window at 30 days with every `SpendLogs` read bounded - [PR #34675](https://github.com/BerriAI/litellm/pull/34675), [PR #34582](https://github.com/BerriAI/litellm/pull/34582)
    - Track prompt compression saved tokens in the daily spend aggregates - [PR #33810](https://github.com/BerriAI/litellm/pull/33810)
    - Attribute org spend for team-linked credentials minted without an `org_id` - [PR #34577](https://github.com/BerriAI/litellm/pull/34577)

## MCP Gateway

- **Client-Forwarded Credentials (`dcr_bridge` / `oauth_delegate`)**
    - Interactive SSO sign-in for `dcr_bridge` `oauth_delegate` DCR clients - [PR #32946](https://github.com/BerriAI/litellm/pull/32946)
    - Mint a gateway-bound envelope at the token endpoint, and add a client-held refresh envelope for the flow - [PR #32828](https://github.com/BerriAI/litellm/pull/32828), [PR #32980](https://github.com/BerriAI/litellm/pull/32980)
    - Extract the `dcr_bridge` token flow into `bridge_token_flow.py` - [PR #33141](https://github.com/BerriAI/litellm/pull/33141)
    - Persist `config.yaml` DCR clients in a server-scoped store so refresh survives token expiry - [PR #33768](https://github.com/BerriAI/litellm/pull/33768)
    - Surface rejected delegate-auth upstream tokens as a connect-time 401, and relay upstream OAuth token and DCR rejections instead of a generic 500 - [PR #32741](https://github.com/BerriAI/litellm/pull/32741), [PR #33113](https://github.com/BerriAI/litellm/pull/33113)
    - Make the preemptive-401 OAuth challenge decision mode-aware - [PR #33586](https://github.com/BerriAI/litellm/pull/33586)
- **OAuth & Identity**
    - Issuer-anchored OAuth discovery (RFC 8414 §3.3) to close the authorization-server mix-up - [PR #33450](https://github.com/BerriAI/litellm/pull/33450)
    - Add ID-JAG (identity assertion authorization grant) support for MCP egress - [PR #31516](https://github.com/BerriAI/litellm/pull/31516)
    - Persist discovered OAuth endpoints and keep the last known good set on a failed re-discovery - [PR #33286](https://github.com/BerriAI/litellm/pull/33286)
    - Discover missing OAuth scopes and `token_url` when `authorization_url` is set manually - [PR #33317](https://github.com/BerriAI/litellm/pull/33317)
    - Cap the per-user OAuth token cache TTL at the token's own lifetime - [PR #33346](https://github.com/BerriAI/litellm/pull/33346)
- **Tools & Permissions**
    - Per-server outcomes for aggregate `tools/list` and truthful single-server REST statuses - [PR #33153](https://github.com/BerriAI/litellm/pull/33153)
    - Expand toolset grants in the shared permission primitives so `tools/call` honors them - [PR #33612](https://github.com/BerriAI/litellm/pull/33612)
    - Index authed request-time tools missing from the semantic filter startup index - [PR #33318](https://github.com/BerriAI/litellm/pull/33318)
    - Keep the MCP reference intact when the semantic filter narrows tools - [PR #33584](https://github.com/BerriAI/litellm/pull/33584)

## Performance / Loadbalancing / Reliability improvements

- **Routing**
    - Add a `Router(plugins=[...])` routing-plugin pipeline, resolve auto-router routing plugins from proxy YAML config, and resolve `router_settings.plugins` dotted paths from installed packages - [PR #32972](https://github.com/BerriAI/litellm/pull/32972), [PR #33251](https://github.com/BerriAI/litellm/pull/33251), [PR #33644](https://github.com/BerriAI/litellm/pull/33644)
    - Soft-floor adaptive mode and random-pick multi-model tiers for the complexity router - [PR #32947](https://github.com/BerriAI/litellm/pull/32947), [PR #32967](https://github.com/BerriAI/litellm/pull/32967)
    - Opt-in session affinity for the complexity router, then enabled by default, with the session id derived from Anthropic `metadata.user_id` - [PR #33126](https://github.com/BerriAI/litellm/pull/33126), [PR #33500](https://github.com/BerriAI/litellm/pull/33500), [PR #33723](https://github.com/BerriAI/litellm/pull/33723)
    - User-triggered escalation keywords, and per-tier semantic keyword prompts in the configure wizard - [PR #33656](https://github.com/BerriAI/litellm/pull/33656), [PR #33508](https://github.com/BerriAI/litellm/pull/33508)
    - Honor a per-request `routing_strategy` from key/team `router_settings`, and apply team/key `enable_tag_filtering` to tag routing - [PR #33429](https://github.com/BerriAI/litellm/pull/33429), [PR #33436](https://github.com/BerriAI/litellm/pull/33436)
    - Tag-aware pre-routing strategy selection for a shared `model_name` - [PR #33691](https://github.com/BerriAI/litellm/pull/33691)
    - Resolve the prompt cache minimum per model instead of a flat 1024 - [PR #33637](https://github.com/BerriAI/litellm/pull/33637)
    - Enforce context-window pre-call checks for Responses API input - [PR #33706](https://github.com/BerriAI/litellm/pull/33706)
    - Correct the Responses API `tool_choice` shape and propagate alias `litellm_params` in the auto router - [PR #32974](https://github.com/BerriAI/litellm/pull/32974)
    - Return an empty dict from `_classifier_call_metadata` when metadata is absent - [PR #33452](https://github.com/BerriAI/litellm/pull/33452)
    - Cast `model_info` cost values to float in `_set_model_group_info` - [PR #33556](https://github.com/BerriAI/litellm/pull/33556)
- **Reliability**
    - Route Azure Anthropic `/messages` through Rust behind `rust:true` - [PR #33616](https://github.com/BerriAI/litellm/pull/33616)
    - Stop pinning large request payloads past request end - [PR #33455](https://github.com/BerriAI/litellm/pull/33455)
    - Stop a stale auth cache re-publish to Redis so key updates propagate across replicas - [PR #33565](https://github.com/BerriAI/litellm/pull/33565)
    - Honor the `ssl` value instead of key presence when building the async Redis connection pool - [PR #32590](https://github.com/BerriAI/litellm/pull/32590)
    - Reap orphaned Prisma query-engine processes when a worker dies - [PR #33424](https://github.com/BerriAI/litellm/pull/33424)
- **Deployment**
    - Add per-component `PodDisruptionBudget` and `topologySpreadConstraints` to the componentized Helm chart - [PR #33430](https://github.com/BerriAI/litellm/pull/33430)
    - Bake the Prisma CLI and engines at a fixed path so fresh-DB migrations work for any uid offline - [PR #33853](https://github.com/BerriAI/litellm/pull/33853)
    - Restore the `litellm-proxy-extras` source dir in the runtime images - [PR #33592](https://github.com/BerriAI/litellm/pull/33592)
    - Refresh flagged dependencies: pypdf, pyasn1, gitpython, and the dashboard's next, postcss, sharp, js-yaml, and brace-expansion - [PR #34640](https://github.com/BerriAI/litellm/pull/34640)

## Documentation Updates

- Add a QA runbook section to the PR template - [PR #32965](https://github.com/BerriAI/litellm/pull/32965)
- Add a router plugin reference catalog - [PR #33746](https://github.com/BerriAI/litellm/pull/33746)
- Align the e2e skip-vs-fail docs with the hard-fail contract and scope the no-unit-tests rule - [PR #33755](https://github.com/BerriAI/litellm/pull/33755)
- Add provider coding standards and provider abstraction standards for litellm-rust, and require the official Rust Style Guide in the agent rules - [PR #33833](https://github.com/BerriAI/litellm/pull/33833), [PR #33865](https://github.com/BerriAI/litellm/pull/33865), [PR #33867](https://github.com/BerriAI/litellm/pull/33867)

### PR roll-up by ownership area

PRs by ownership area (total: 263)

- Other (CI / chore / tests / build / version bumps): 76
- UI: 48
- Performance / Routing / Reliability: 26
- Models & Providers: 23
- MCP: 17
- Spend / Budgets / Rate Limits: 16
- Guardrails: 15
- Auth & Management: 14
- Logging: 13
- LLM API Endpoints: 9
- Docs: 6

## End-to-End Testing

We are investing heavily in end-to-end testing to cut regressions and make LiteLLM more stable release over release. Every version is now exercised by a live suite that runs against a real deployed proxy and hits real provider endpoints, not mocks, so the behavior we validate is the behavior you get in production. Our goal is to reach 95% coverage this week and hold that bar going forward, so that fewer regressions ever reach a release.

This run, executed against the v1.94.0 release candidate, ran 264 tests over roughly 58 minutes against a live gateway spanning Anthropic, Azure, Azure OpenAI, Amazon Bedrock (Converse and Invoke), Google Vertex AI, and OpenAI.

| Result | Count |
| --- | --- |
| Passed | 263 |
| Failed | 1 |

Coverage spans access control, batches, the Claude Code surface (streaming and non-streaming messaging, tool use, vision, thinking, prompt caching, structured outputs, PDF input, and web search), the Realtime API, embeddings, rerank, image generation, OCR, the Responses API and `/v1/messages`, logging into Datadog, OpenTelemetry, and Prometheus, key/team/user/organization management, the MCP gateway, budgets, rate limits, spend tracking, and routing. Against our internal coverage registry the suite currently exercises 43.0% of tracked cells (168/391), with quota management already at 95.0% and core LLM endpoints at 72.4%.

The one failure, `test_sustains_throughput_slo_under_load`, is a load-generation scenario that intentionally pushes the proxy past its configured throughput ceiling. It is unrelated to functional correctness and is expected to trip under that traffic.

The full run is attached here: [v1.94.0rc1 e2e report](pathname:///e2e-reports/v1-94-0-rc-1-e2e-report.log).

## New Contributors

- @Napuh made their first contribution in [PR #32667](https://github.com/BerriAI/litellm/pull/32667)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.93.0...v1.94.0
