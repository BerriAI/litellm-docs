---
title: "v1.86.0rc1 - Weighted-Routing Failover, Native Web-Search Citations & OTel-Standard Tracing"
slug: "v1-86-0-rc-1"
date: 2026-05-16T00:00:00
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

{/*
REVIEWER NOTE — remove this block before publishing.
v1.86.0rc1 is NOT cut yet. These notes describe the current tip of
litellm_internal_staging (1b9acecb), the predecessor is v1.85.0-rc.2
(about to be promoted to 1.85.0 stable). Variant comparison: rc → rc.
- Full Changelog link uses ...litellm_internal_staging; once the tag is
  cut it becomes v1.85.0-rc.2...v1.86.0rc1.
- Docker tag below uses the documented PEP 440 form (1.86.0rc1). Recent
  RCs (v1.85.0-rc.2, v1.84.0-rc.1) were still cut in the legacy
  X.Y.Z-rc.N form, so re-verify the published tag on GHCR at cut time.
*/}

## Deploy this version

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="docker" label="Docker">

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.86.0rc1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.86.0rc1
```

</TabItem>
</Tabs>

## Key Highlights

- **Weighted-Routing Failover** — on a deployment failure, the router now retries the same model group on a *different* deployment (e.g. another Azure region) while the initial pick still respects configured weights, behind a router-level flag.
- **Native web-search citations for Anthropic clients** — LiteLLM now emits native `web_search_tool_result` blocks so Claude Desktop / Cowork render web-search citations correctly.
- **OTel-standard server-span attributes** — the proxy SERVER span now carries `http.response.status_code`, `http.route`, `url.path`, and `litellm.preprocessing.duration_ms`, plus an opt-in for the experimental OTEL GenAI semantic conventions.
- **Componentized deployment** — additive scaffold + Helm chart to split the monolithic proxy into independently scalable `gateway`, `backend`, and `ui` services.
- **Critical rate-limit regression fixed** — the v3 limiter was leaking internal reservation keys into the upstream provider body, breaking *every* virtual key with a `tpm_limit` / `rpm_limit` set.

## Stability for Claude Code & MCP

The proxy's busiest interactive surfaces — Claude Code (`/v1/messages` + `/v1/chat/completions`) and MCP — picked up a batch of stability fixes this release, plus a new safety net that catches future regressions before they ship.

**Claude Code × LiteLLM compatibility matrix, regenerated daily.** A new docs page renders a live pass/fail grid for every supported Claude Code feature against every provider (Anthropic, Bedrock Invoke, Bedrock Converse, Vertex AI, Azure Foundry). It's populated by a daily cron (`tests/claude_code/cron_vm/run_daily.sh`) that exercises each cell end-to-end and opens an auto-PR with the refreshed JSON; failure cells expose the upstream error on hover so you can see *why* a combination is red the same day it regresses. ([docs PR #97](https://github.com/BerriAI/litellm-docs/pull/97))

**Reasoning-effort grid e2e suite.** A new regression suite drives every reasoning-effort level (`minimal` / `low` / `medium` / `high` / `xhigh` / `max`) against every provider that exposes one — Anthropic, Bedrock Converse, Vertex Anthropic, Azure AI Anthropic, Databricks. Status is classified by exception `status_code`, not class name, so the suite distinguishes a real provider 400 from a flaky 429 and catches drift between provider request shapes and the `output_config.effort` plumbing before customers do. ([PR #28036](https://github.com/BerriAI/litellm/pull/28036))

**Full reasoning_effort coverage on `/v1/chat/completions` ↔ Claude (incl. 4.5 backports).** `output_config.effort` is now forwarded end-to-end across Anthropic, Bedrock, Vertex Anthropic, Azure AI Anthropic, and Databricks; garbage values fail fast with a 400 instead of being silently dropped. `xhigh` / `max` are backported to the Claude 4.5 family and older snapshots so customers on pre-4.6 deployments get the full effort range through both `/v1/chat/completions` and `/v1/messages`. ([PR #27074](https://github.com/BerriAI/litellm/pull/27074))

**Bedrock Converse — empty thinking-block content.** Claude Code with extended thinking replays prior assistant turns containing an empty thinking block (`thinking=""`, `signature=""`) alongside `tool_use`. The unsigned-reasoning fallback was emitting `BedrockContentBlock(text="")`, which Converse rejects with *"The text field in the ContentBlock object … is blank."* The fallback now drops the empty block instead of stringifying it, so multi-turn tool-use replays through Bedrock Converse stop 400'ing. ([PR #27850](https://github.com/BerriAI/litellm/pull/27850))

**MCP OAuth — `PROXY_BASE_URL` escape hatch for `{"detail":"invalid_request"}`.** When the proxy sits behind a reverse proxy or load balancer that rewrites the request scheme or host, the OAuth callback's `redirect_uri` validation can fail with an opaque `{"detail":"invalid_request"}`. A new `PROXY_BASE_URL` env var pins the canonical external URL used for redirect comparison, and diagnostic logging now records the exact mismatch so the next failure is debuggable from logs alone. ([PR #28086](https://github.com/BerriAI/litellm/pull/28086))

**v3 rate limiter — stop leaking internal stash to provider body.** The atomic TPM reservation flow introduced in PR #27001 was stashing `_litellm_rate_limit_descriptors` / `_litellm_tpm_reserved_*` on the top level of the request data dict, where they were forwarded to the upstream provider. OpenAI rejected them as `Unknown parameter` (mapped back to a misleading 429); Anthropic as `Extra inputs are not permitted`. Any virtual key with a `tpm_limit` / `rpm_limit` set was 400'ing on the success path. The stash is now strictly metadata, and the pre-call hook strips any stash key that surfaces at the top level — which also closes a TPM-refund abuse vector where an authenticated caller could inject reservation values to refund counters against another tenant's scope. ([PR #27913](https://github.com/BerriAI/litellm/pull/27913))

## New Models / Updated Models

#### New Model Support

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| Bedrock | `jp.anthropic.claude-sonnet-4-6` | 1,000,000 | $3.30 | $16.50 | Prompt caching, reasoning, vision, function calling, PDF input, computer use |
| Azure AI | `azure_ai/gpt-5.4` | 1,050,000 | $2.50 | $15.00 | Reasoning, vision, web search, function calling, prompt caching, service tier |
| Azure AI | `azure_ai/gpt-5.4-pro` | 1,050,000 | $30.00 | $180.00 | Responses-mode, reasoning, vision, web search, prompt caching |
| Azure AI | `azure_ai/gpt-5.4-mini` | 400,000 | $0.75 | $4.50 | Reasoning, vision, web search, function calling, prompt caching |
| Azure AI | `azure_ai/gpt-5.4-nano` | 400,000 | $0.20 | $1.25 | Reasoning, vision, web search, function calling, prompt caching |

Each Azure AI GPT-5.4 model also ships a dated snapshot alias (`gpt-5.4-2026-03-05`, `gpt-5.4-pro-2026-03-05`, `gpt-5.4-mini-2026-03-17`, `gpt-5.4-nano-2026-03-17`) — 9 catalog entries total. All GPT-5.4 entries include tiered (`>272k`) and priority pricing.

#### Features

- **[Azure AI](https://docs.litellm.ai/docs/providers/azure_ai)**
    - Add Azure AI Foundry GPT-5.4 model metadata (gpt-5.4 / pro / mini / nano + dated aliases) - [PR #28030](https://github.com/BerriAI/litellm/pull/28030)
- **[Bedrock](https://docs.litellm.ai/docs/providers/bedrock)**
    - Add `jp.` cross-region inference profile for `claude-sonnet-4-6` - [PR #27831](https://github.com/BerriAI/litellm/pull/27831)

#### Bug Fixes

- **[Bedrock](https://docs.litellm.ai/docs/providers/bedrock)**
    - bedrock-mantle: use `/anthropic/v1/messages` path for Mantle (Claude Mythos Preview) endpoint — `/v1/messages` was 404ing every Mantle request - [PR #27943](https://github.com/BerriAI/litellm/pull/27943)

## LLM API Endpoints

#### Features

- **Anthropic Messages API (`/v1/messages`)**
    - Emit native `web_search_tool_result` blocks for Anthropic clients (Claude Desktop / Cowork citations) - [PR #27886](https://github.com/BerriAI/litellm/pull/27886)
- **[Vector Stores](https://docs.litellm.ai/docs/vector_stores)**
    - Fix vector store retrieve/list/update/delete when no completion model is set; merge URL query params into request data on those routes - [PR #27929](https://github.com/BerriAI/litellm/pull/27929)

#### Bugs

- **Anthropic Messages API (`/v1/messages`)**
    - Sanitize empty/whitespace-only `{"type":"text"}` content blocks before dispatch (prevents 400s on tool-use histories) - [PR #27832](https://github.com/BerriAI/litellm/pull/27832)
- **[Batch API](https://docs.litellm.ai/docs/batches)**
    - Managed batches: convert raw provider `output_file_id` to managed ID in the `CheckBatchCost` poller so `GET /files/{id}/content` resolves routing - [PR #27984](https://github.com/BerriAI/litellm/pull/27984)

## Management Endpoints / UI

#### Bugs

- **Auth / OAuth**
    - Allow allowlisted redirect URIs in OAuth setup - [PR #27761](https://github.com/BerriAI/litellm/pull/27761)
- **Config**
    - Make `/config/update` env-var encryption idempotent (fixes double-encryption on repeated updates) + endpoint-level regression test - [PR #28022](https://github.com/BerriAI/litellm/pull/28022)

## AI Integrations

#### Logging

- **[OpenTelemetry](https://docs.litellm.ai/docs/proxy/logging#opentelemetry)**
    - OTel-standard attributes on the proxy SERVER span: `http.response.status_code`, `http.route`, `url.path`, `litellm.preprocessing.duration_ms` - [PR #28040](https://github.com/BerriAI/litellm/pull/28040)
    - Opt-in support for the experimental OTEL GenAI semantic conventions (`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`); default behavior unchanged - [PR #27418](https://github.com/BerriAI/litellm/pull/27418)

#### Guardrails

- **[Lasso](https://docs.litellm.ai/docs/proxy/guardrails/quick_start)**
    - Add tool-calling support to LassoGuardrail (expands `tool_calls` / `role=tool` into Lasso `tool_use` / `tool_result` blocks; maps tool definitions) - [PR #27648](https://github.com/BerriAI/litellm/pull/27648)
- **[CrowdStrike AIDR](https://docs.litellm.ai/docs/proxy/guardrails/quick_start)**
    - Improve CrowdStrike AIDR input handling - [PR #26658](https://github.com/BerriAI/litellm/pull/26658)

#### Secret Managers

- **General**
    - Import `get_secret` at runtime to avoid an import-time ordering bug - [PR #28014](https://github.com/BerriAI/litellm/pull/28014)

## Spend Tracking, Budgets and Rate Limiting

- **Rate Limiting** — Stop the v3 limiter from leaking internal reservation keys (`_litellm_rate_limit_descriptors`, `_litellm_tpm_reserved_*`) into the upstream provider body; this regression broke **every** virtual key with a `tpm_limit`/`rpm_limit` - [PR #27913](https://github.com/BerriAI/litellm/pull/27913)
- **Budgets** — Tighten budget field validation and add missing authorization checks on user self-update / key-generation paths - [PR #27897](https://github.com/BerriAI/litellm/pull/27897)
- **Cost Tracking** — Fix zero cost/usage on completed Vertex AI batch jobs (file content is now OpenAI-shaped post-#25627; old code read stale `usageMetadata.*`) - [PR #27912](https://github.com/BerriAI/litellm/pull/27912)

## MCP Gateway

- Delegate-auth PKCE bypass for **internal** (`available_on_public_internet: false`) oauth2 interactive MCP servers — same anonymous PKCE path as public servers; `client_credentials` exclusion unchanged - [PR #27977](https://github.com/BerriAI/litellm/pull/27977)
- Expose `delegate_auth_to_upstream` in the `GET /v1/mcp/server` list API (`_build_mcp_server_table` was dropping it, so the dashboard always showed `false`) - [PR #27936](https://github.com/BerriAI/litellm/pull/27936)

## Performance / Loadbalancing / Reliability improvements

- **Weighted-Routing Failover** — on failure, retry the same model group on a different deployment while the initial pick respects configured weights; behind a router-level flag - [PR #27980](https://github.com/BerriAI/litellm/pull/27980)
- **Chat-completions fast path** — cache callback capabilities once instead of re-scanning `litellm.callbacks` per request; skip streaming-iterator wrapping when no callback needs it - [PR #27858](https://github.com/BerriAI/litellm/pull/27858)
- **Componentized deployment** — additive `gateway/`, `backend/`, `ui/` Dockerfiles + Helm chart (per-component Deployment/Service/HPA, no edits to existing modules) - [PR #27557](https://github.com/BerriAI/litellm/pull/27557)

## General Proxy Improvements

Testing, CI & build hardening:

- VCR cache observability: classify cache verdicts, detect live calls, surface cost leaks, aggregate xdist worker stats; Bedrock hostname / RFC1918 fixes - [PR #27795](https://github.com/BerriAI/litellm/pull/27795)
- Reasoning-effort grid e2e regression suite (status classified by exception `status_code`); Fireworks / Gemini tests mocked instead of live - [PR #28036](https://github.com/BerriAI/litellm/pull/28036)
- Modernize model references in CI tests and configs - [PR #27856](https://github.com/BerriAI/litellm/pull/27856)
- Codecov: flag uploads, enable carryforward, close coverage gaps; `--cov=./litellm` path resolution - [PR #28028](https://github.com/BerriAI/litellm/pull/28028), [PR #27960](https://github.com/BerriAI/litellm/pull/27960)
- mutmut: enable `mutate_only_covered_lines` to fit CI budget - [PR #27910](https://github.com/BerriAI/litellm/pull/27910)
- Remove unused GitHub Actions workflows and orphan files - [PR #27957](https://github.com/BerriAI/litellm/pull/27957)
- Preserve global Button/Tooltip mocks in per-file `@tremor/react` `vi.mock` (UI tests) - [PR #27958](https://github.com/BerriAI/litellm/pull/27958)
- Isolate `run_server` CLI tests from the Prisma DB-setup path - [PR #28029](https://github.com/BerriAI/litellm/pull/28029)
- Validate response fields against the Interaction schema - [PR #28037](https://github.com/BerriAI/litellm/pull/28037)
- De-flake `test_gemini_image_size_limit_exceeded` - [PR #28039](https://github.com/BerriAI/litellm/pull/28039)
- Pin `openai==2.33.0` in `uv.lock` - [PR #28088](https://github.com/BerriAI/litellm/pull/28088)
- Add one-line docstring to `_disable_debugging` - [PR #27894](https://github.com/BerriAI/litellm/pull/27894)

## New Contributors

- @vladpolevoi made their first contribution in [#27648](https://github.com/BerriAI/litellm/pull/27648)
- @Cyberfilo made their first contribution in [#27831](https://github.com/BerriAI/litellm/pull/27831)
- @jpv-costa made their first contribution in [#27943](https://github.com/BerriAI/litellm/pull/27943)

**Full Changelog**: https://github.com/BerriAI/litellm/compare/v1.85.0-rc.2...litellm_internal_staging

---

## 05/16/2026 (`v1.86.0rc1`)

* New Models / Updated Models: 3
* LLM API Endpoints: 4
* Management Endpoints / UI: 2
* AI Integrations (Logging / Guardrails / Secret Managers): 5
* Spend Tracking, Budgets and Rate Limiting: 3
* MCP Gateway: 2
* Performance / Loadbalancing / Reliability improvements: 3
* General Proxy Improvements (testing / CI / build): 13
* Documentation Updates: 0

Total: 35 PRs
