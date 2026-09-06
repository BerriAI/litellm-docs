---
title: "v1.101.0rc1 - Heuristic Auto Router, Semantic MCP Tool Search & Off-Peak Pricing"
slug: "v1-101-0-rc-1"
date: 2026-09-06T10:00:00
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
docker.litellm.ai/berriai/litellm:1.101.0-rc.1
```

</TabItem>
<TabItem value="pip" label="Pip">

```bash
pip install litellm==1.101.0rc1
```

</TabItem>
</Tabs>

:::danger Breaking Changes

**The OpenAI WebSocket passthrough routes are off by default.** The `/openai_passthrough/*` and `/openai/*` WebSocket relays refuse connections until `general_settings.enable_openai_websocket_passthrough: true` is set in YAML or through `POST /config/field/update`; the proxy's own `/v1/realtime` routes are unaffected. See [PR #39841](https://github.com/BerriAI/litellm/pull/39841).

**A password policy is enforced by default wherever a password is set.** `/user/update`, `/user/bulk_update`, and invite claims now require 12 characters with an uppercase letter, a lowercase letter, a number, and a special character. Relax it with `general_settings.password_policy_min_length` and the `password_policy_require_*` toggles; `disable_password_login_when_sso_enabled` stays opt-in. See [PR #39381](https://github.com/BerriAI/litellm/pull/39381).

**Non-admin agent and vector store listings return only granted resources.** `GET /v1/agents`, the dashboard agent list, MCP `agent_search`, and `/vector_store/list` now return an empty list to keys, teams, and users with no grant where they used to return everything. Grant agents on the key, team, or user, and vector stores through `object_permission.vector_stores`; direct access to a named agent or store is unchanged. See [PR #39636](https://github.com/BerriAI/litellm/pull/39636), [PR #39612](https://github.com/BerriAI/litellm/pull/39612).

**MCP token-exchange and ID-JAG servers no longer accept the LiteLLM virtual key as the upstream subject token.** A request carrying only `Authorization: Bearer sk-...` now gets a 401 challenge instead of a silent exchange of the gateway key; send the virtual key in `x-litellm-api-key` and the IdP token in `Authorization`. See [PR #39446](https://github.com/BerriAI/litellm/pull/39446).

**Multi-valued SSO role claims resolve to the highest privilege role.** Across generic OIDC, JWT access tokens, SAML, and Entra `app_roles`, a user whose provider sends several roles now gets the strongest one and is re-roled on their next login; check providers that put unrelated groups in the role claim before upgrading. See [PR #39480](https://github.com/BerriAI/litellm/pull/39480).

**SCIM `PUT /Users` with a missing or empty `groups` array no longer removes team memberships.** Clients that relied on `"groups": []` to strip a user from every team must use PATCH or PUT on `/scim/v2/Groups`; a non-empty `groups` still fully replaces memberships. See [PR #39623](https://github.com/BerriAI/litellm/pull/39623).

**`POST` and `PUT /v1/access_group` reject unknown team ids with 400.** A team id that resolves to no team used to be stored silently; automation that seeds access groups before their teams exist must create the teams first. See [PR #39218](https://github.com/BerriAI/litellm/pull/39218).

**Shadow eval renames its target column and response fields.** The `api_key_id` column becomes `target_id`, results rename `keys` to `targets`, `api_key_id` to `target_id`, and `key_alias` to `target_alias`, and the `by_key` slice list is replaced by per-target `verdicts`. During a rolling deploy, pods still on the old build pause shadow eval until they restart; inference, keys, and budgets are unaffected. See [PR #39015](https://github.com/BerriAI/litellm/pull/39015).

**Auto-router tier and classifier customization is metered against the `auto_router` license feature.** Without it a proxy holds one `heuristic_v2` router and one router with operator-defined `tier_definitions` or a custom classifier prompt; an over-limit config.yaml refuses to start and `/model/new` returns 403. The shipped prompt, rubric presets, and `tier_labels` stay free. See [PR #39468](https://github.com/BerriAI/litellm/pull/39468), [PR #39674](https://github.com/BerriAI/litellm/pull/39674).

**Azure Storage logging authenticates only with the identities a deployment carries.** The keyless credential chain no longer picks up a developer's `az login` or the LLM's `AZURE_CLIENT_SECRET`; a service principal for storage must be set through `AZURE_STORAGE_CLIENT_*`, and blank storage credentials on a developer machine now fail instead of writing. See [PR #39637](https://github.com/BerriAI/litellm/pull/39637).

**Datadog LLM Observability moves tool calls into Datadog's own fields and drops prompt-carrying metadata under redaction.** The flat `input_tool_calls.*` and `output_tool_calls.*` metadata keys are removed, and with message redaction on, tool definitions and the `routing_decision`, `requester_metadata`, `prompt_management_metadata`, `mcp_tool_call_metadata`, `vector_store_request_metadata`, and `guardrail_information` records no longer ship; repoint saved views and facets built on them. See [PR #39222](https://github.com/BerriAI/litellm/pull/39222), [PR #39402](https://github.com/BerriAI/litellm/pull/39402).

**`/v1/messages` errors use Anthropic's `{"type": "error", "error": {...}}` envelope.** Clients that parsed the old OpenAI-shaped error body on that route must adapt; status codes and messages are unchanged, official Anthropic SDKs are unaffected, and errors raised before the route runs keep the OpenAI envelope. See [PR #39037](https://github.com/BerriAI/litellm/pull/39037).

**Headroom compression calls time out after 60 seconds by default.** `litellm_settings.request_timeout` no longer bounds `/v1/compress` and `/v1/retrieve`; set `timeout` in the Headroom guardrail's `litellm_params` to keep a lower ceiling or allow a slower service. See [PR #39527](https://github.com/BerriAI/litellm/pull/39527).

**`fail_closed_budget_enforcement: true` rejects up front on the worst-case estimate.** Keys near their cap now get a 429 when input tokens plus `max_tokens` (or the 16K fallback) exceed the remaining budget, where the request used to run with a shrunken reservation. Deployments without the flag are unaffected. See [PR #39214](https://github.com/BerriAI/litellm/pull/39214).

**Database URLs with `sslmode=verify-ca`, `verify-full`, or `sslrootcert` are now verified.** Prisma silently downgraded these to `prefer`; a wrong or unreadable CA bundle now fails at boot with `P1011`, and `verify-ca` performs full chain and hostname verification. Operator-pinned `sslcert` and `sslaccept` params still win. See [PR #39563](https://github.com/BerriAI/litellm/pull/39563).

**`max_idle_connection_lifetime` defaults to 60 seconds on database URLs.** Applies to `DATABASE_URL`, `DIRECT_URL`, and the read replica so idle connections reaped by RDS or an NLB stop surfacing as `Error { kind: Closed }`; pin it on the URL or set `general_settings.database_max_idle_connection_lifetime` to restore the previous 300 seconds. See [PR #39134](https://github.com/BerriAI/litellm/pull/39134).

**Hide Secrets redacts less by default.** The base64 entropy threshold moves from 3.0 to 4.5 and the OpenAI detector only matches standalone `sk-` tokens carrying a digit, so quoted strings with entropy between 3.0 and 4.5 pass through; set `Base64HighEntropyString` back to 3.0 in `detect_secrets_config` to keep the old sensitivity. See [PR #39879](https://github.com/BerriAI/litellm/pull/39879).

**Model Armor refuses a stream it cannot assemble instead of forwarding it unscanned.** On `/v1/chat/completions` an unassemblable stream used to be released; it is now refused in the endpoint's own error shape, and `fail_on_error: false` restores the old forwarding with a warning. See [PR #39181](https://github.com/BerriAI/litellm/pull/39181).

**Streamed chat and `/v1/responses` usage carries `usage.cost` by default.** The final streamed usage object gains a `cost` field with no opt-out; zero-cost and unpriceable responses stamp nothing, and per-chunk cost injection stays behind its existing flag. See [PR #39069](https://github.com/BerriAI/litellm/pull/39069).

**xAI requests bill at the cost xAI reports.** Server-side tools such as X search are now charged, and a custom-priced Perplexity deployment bills the operator's configured price instead of the provider's total. See [PR #39441](https://github.com/BerriAI/litellm/pull/39441).

**OpenAI-compatible embeddings omit `encoding_format` when the client omits it.** Responses still return floats, but the SDK's base64 transfer compression is gone and omitted-format calls miss the embedding cache once after upgrade; send `encoding_format: base64` explicitly to keep compact transfer. See [PR #38774](https://github.com/BerriAI/litellm/pull/38774).

**`azure_ai/` deployments on `.services.ai.azure.com` hosts stay on the Foundry `/models` route.** They were silently reclassified as `azure` and sent to the Azure OpenAI deployments route with the wrong cost map; transcription, speech, and realtime keep the Azure OpenAI routes. See [PR #38975](https://github.com/BerriAI/litellm/pull/38975).

**`/v1/models` no longer lists wildcard routes such as `bedrock/*`.** Pass `return_wildcard_routes=True` to get them back. See [PR #31731](https://github.com/BerriAI/litellm/pull/31731).

**`/v1/agents` responses redact stored credentials.** Secret `litellm_params` fields come back as a fixed marker for every caller, admins included; an edit that echoes the marker keeps the stored value. See [PR #39389](https://github.com/BerriAI/litellm/pull/39389).

**Management writes validate more strictly.** `mcp_tool_permissions` keyed by a name or alias shared by several MCP servers is rejected with 400 (existing rows keep working until their tool list is edited), `/config/update` returns 400 for keys that are not router settings instead of a silent 200, `/upload/logo` requires the proxy admin role, and `/v1/files` rejects filenames containing `..`. See [PR #39947](https://github.com/BerriAI/litellm/pull/39947), [PR #39249](https://github.com/BerriAI/litellm/pull/39249), [PR #39379](https://github.com/BerriAI/litellm/pull/39379).

**`litellm[proxy-runtime]` needs pypdf 6.16.1 and tornado 6.5.8 or newer.** Environments pinning below those floors stop resolving. See [PR #39188](https://github.com/BerriAI/litellm/pull/39188).

:::

## Key Highlights

- **Heuristic and hybrid auto-router classifiers** - `classifier_type: heuristic_v2` picks a tier locally without a classifier call, `hybrid` defers to the LLM only near a tier boundary, `classification_mode: user_turn` classifies once per human ask, oversized prompts escalate to a tier whose context window fits, stalled agent tasks auto-escalate, image requests route to vision-capable tiers, and a Configure automatically action fills every tier from the models the proxy already serves
- **MCP gateway: semantic tool search and complete catalogs** - `mcp_tool_search` ranks a caller's authorized tools by embedding similarity, upstream `tools/list` pagination is followed to the last page, one `x-mcp-<access_group>-*` header covers every server in a group, ID-JAG assertions renew from the stored refresh token, and `pre_mcp_call` guardrails scan and mask tool call arguments
- **Spend controls** - time-based off-peak pricing, `usage.cost` on the final streamed usage chunk, per-model budgets enforced across replicas, per-user daily and monthly Slack spend thresholds with anomaly detection, guardrail cost rolled up per usage unit, and per-user spend within a team on `/team/spend/by_user`
- **Proxy hardening** - per-worker admission control that answers overload with an immediate 503, Prometheus `/metrics` served from its own process, a default password policy with optional SSO-only login, agent and vector store listings scoped to grants, libpq TLS parameters honored on the database URL, and the new Alice guardrail
- **411 new models** - day-0 `claude-fable-5-1` across Anthropic, Bedrock, Vertex AI, and Azure AI, `gpt-6-astra` on OpenAI and Azure, `gemini-3.8-flash` on Gemini and Vertex, Bedrock GovCloud Claude and Nova Sonic realtime, Cohere Parse OCR, 160 OpenRouter entries, and `qwencloud/` and `qwen_ai_platform/` aliases over DashScope

## New Providers and Endpoints

### New Providers (3 new providers)

| Provider | Supported LiteLLM Endpoints | Description |
| --- | --- | --- |
| [QwenCloud and Qwen AI Platform](../../docs/providers/qwencloud) | `/chat/completions`, `/embeddings`, `/rerank`, `/images/generations` | `qwencloud/` (international) and `qwen_ai_platform/` (mainland) prefixes over the DashScope implementation, with 45 priced entries each |
| [MongoDB](../../docs/completion/knowledgebase) | `/v1/vector_stores/search`, `/v1/rag/query`, chat `vector_store_ids` | Vector store provider running `$vectorSearch` on Atlas and self-managed deployments, shipped in every proxy image |
| [Alice](../../docs/proxy/guardrails/alice) | Guardrails (`pre_call`, `post_call`) | Guardrail provider (formerly ActiveFence) enforcing ALLOW, BLOCK, MASK, or DETECT verdicts with the application chosen per virtual key |

### New LLM API Endpoints (6 new endpoints)

| Endpoint | Method | Description | Documentation |
| --- | --- | --- | --- |
| `/v1/responses/input_tokens` | POST | Counts input tokens for a Responses API request through the provider's own counting API, images and files included | [Responses API](../../docs/response_api) |
| `/team/spend/by_user` | GET | Per-user spend within a team, JWT traffic included, with a CSV download on the Team Usage page | [Team Budgets](../../docs/proxy/team_budgets) |
| `/public/autorouter_presets` | GET | Serves the auto-router preset catalog at runtime so preset updates need no dashboard rebuild | [Auto Router](../../docs/proxy/auto_routing) |
| `/scim/v2/placeholders` and `/scim/v2/placeholders/{id}/merge` | GET, POST | Lists SCIM placeholder users that shadow a real account and merges one onto it | [SCIM](../../docs/tutorials/scim_litellm) |
| `/v2/organization/{organization_id}` | PATCH | Merge-patch organization update (null clears, omitted leaves untouched), now published in `/openapi.json` | [Organizations](../../docs/proxy/users) |
| `/gigachat/{endpoint}` | ANY | Native GigaChat API passthrough with spend logging | [GigaChat](../../docs/providers/gigachat) |

## New Models / Updated Models

#### New Model Support (411 new models)

| Provider | Model | Context Window | Input ($/1M tokens) | Output ($/1M tokens) | Features |
| --- | --- | --- | --- | --- | --- |
| Amazon Bedrock | `amazon.nova-2-sonic-v1:0` | - | $0.33 | $2.75 | Audio input, Audio output |
| Amazon Bedrock | `amazon.nova-sonic-v1:0` | - | $0.06 | $0.24 | Audio input, Audio output |
| Amazon Bedrock | `anthropic.claude-fable-5-1` | 1M | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-opus-4-8` | 1M | $6.00 | $30.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/anthropic.claude-sonnet-5` | 1M | $2.40 | $12.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `bedrock/us-gov-east-1/nvidia.nemotron-nano-12b-v2` | 128K | $0.24 | $0.72 | Vision |
| Amazon Bedrock | `bedrock/us-gov-east-1/nvidia.nemotron-nano-3-30b` | 262K | $0.07 | $0.29 | Function calling, Tool choice |
| Amazon Bedrock | `bedrock/us-gov-east-1/nvidia.nemotron-super-3-120b` | 256K | $0.18 | $0.78 | Reasoning, Function calling, Tool choice |
| Amazon Bedrock | `bedrock/us-gov-east-1/openai.gpt-oss-120b-1:0` | 128K | $0.18 | $0.72 | Reasoning, Function calling, Tool choice, Response schema |
| Amazon Bedrock | `bedrock/us-gov-east-1/openai.gpt-oss-20b-1:0` | 128K | $0.08 | $0.36 | Reasoning, Function calling, Tool choice, Response schema |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-opus-4-8` | 1M | $6.00 | $30.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/anthropic.claude-sonnet-5` | 1M | $2.40 | $12.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `bedrock/us-gov-west-1/nvidia.nemotron-nano-12b-v2` | 128K | $0.24 | $0.72 | Vision |
| Amazon Bedrock | `bedrock/us-gov-west-1/nvidia.nemotron-nano-3-30b` | 262K | $0.07 | $0.29 | Function calling, Tool choice |
| Amazon Bedrock | `bedrock/us-gov-west-1/nvidia.nemotron-super-3-120b` | 256K | $0.18 | $0.78 | Reasoning, Function calling, Tool choice |
| Amazon Bedrock | `bedrock/us-gov-west-1/openai.gpt-oss-120b-1:0` | 128K | $0.18 | $0.72 | Reasoning, Function calling, Tool choice, Response schema |
| Amazon Bedrock | `bedrock/us-gov-west-1/openai.gpt-oss-20b-1:0` | 128K | $0.08 | $0.36 | Reasoning, Function calling, Tool choice, Response schema |
| Amazon Bedrock | `bedrock_mantle/us-gov-east-1/openai.gpt-5.4` | 1.05M | $3.30 | $19.80 | Responses API, Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema |
| Amazon Bedrock | `bedrock_mantle/us-gov-west-1/openai.gpt-5.4` | 1.05M | $3.30 | $19.80 | Responses API, Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema |
| Amazon Bedrock | `bedrock_mantle/us-gov-west-1/openai.gpt-5.6-luna` | 1.05M | $0.26 | $1.58 | Responses API, Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema |
| Amazon Bedrock | `bedrock_mantle/us-gov-west-1/openai.gpt-5.6-terra` | 1.05M | $2.64 | $15.84 | Responses API, Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema |
| Amazon Bedrock | `bedrock_mantle/us-gov-west-1/xai.grok-4.3` | 131K | $1.50 | $3.00 | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Amazon Bedrock | `eu.anthropic.claude-fable-5-1` | 1M | $11.00 | $55.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `global.anthropic.claude-fable-5-1` | 1M | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `us-gov.anthropic.claude-opus-4-8` | 1M | $6.00 | $30.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `us-gov.anthropic.claude-sonnet-5` | 1M | $2.40 | $12.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Amazon Bedrock | `us.anthropic.claude-fable-5-1` | 1M | $11.00 | $55.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Anthropic | `claude-fable-5-1` | 1M | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Anthropic | `claude-mythos-5-1` | 1M | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Azure AI Foundry | `azure_ai/Codestral-2501` | 256K | $0.30 | $0.90 | - |
| Azure AI Foundry | `azure_ai/Cohere-parse-v5` | - | - | - | OCR |
| Azure AI Foundry | `azure_ai/DeepSeek-V4-Flash-0731` | 1M | $0.44 | $1.32 | Reasoning, Function calling, Tool choice, Prompt caching |
| Azure AI Foundry | `azure_ai/FW-Nemotron-Lightning-3.5-30B-A3B` | 262K | $0.06 | $0.22 | Reasoning, Function calling, Tool choice, Prompt caching |
| Azure AI Foundry | `azure_ai/MAI-Thinking-1` | 256K | $2.00 | $8.00 | Reasoning, Function calling, Tool choice, Prompt caching |
| Azure AI Foundry | `azure_ai/claude-fable-5-1` | 1M | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Azure AI Foundry | `azure_ai/grok-4.6` | 200K | $2.00 | $6.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search |
| Azure AI Foundry | `azure_ai/kimi-k2.7-code` | 262K | $0.95 | $4.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching |
| Azure AI Foundry | `azure_ai/mistral-ocr-4-0` | - | - | - | OCR |
| Azure OpenAI | `azure/gpt-6-astra` | 922K | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, PDF input, Computer use |
| Azure OpenAI | `azure/gpt-realtime-2` | 32K | $4.00 | $24.00 | Function calling, Tool choice, Audio input, Audio output |
| Azure OpenAI | `azure/gpt-realtime-2.1` | 32K | $4.00 | $24.00 | Function calling, Tool choice, Audio input, Audio output |
| Azure OpenAI | `azure/gpt-realtime-2.1-mini` | 32K | $0.60 | $2.40 | Function calling, Tool choice, Audio input, Audio output |
| Azure OpenAI | `azure/us-gov/gpt-5.1` | 272K | $1.72 | $13.75 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input |
| Azure OpenAI | `azure/us-gov/o3-mini` | 200K | $1.51 | $6.05 | Reasoning, Tool choice, Prompt caching, Response schema |
| Azure OpenAI | `azure/us-gov/text-embedding-3-large` | 8K | $0.16 | $0.0000 | Embeddings |
| Azure OpenAI | `azure/us-gov/text-embedding-3-small` | 8K | $0.02 | $0.0000 | Embeddings |
| Azure OpenAI | `azure/us/gpt-6-astra` | 922K | $11.00 | $55.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, PDF input, Computer use |
| Baseten | `baseten/zai-org/GLM-5.3` | 1.04858M | $1.40 | $4.40 | Vision, Function calling, Tool choice, Prompt caching, Response schema |
| Cerebras | `cerebras/gemma-4-31b` | 131K | $0.99 | $1.49 | Reasoning, Vision, Function calling, Tool choice, Response schema |
| Cloudflare Workers AI | `cloudflare/@cf/openai/whisper` | - | - | - | Transcription |
| Cloudflare Workers AI | `cloudflare/@cf/openai/whisper-large-v3-turbo` | - | - | - | Transcription |
| Cohere | `cohere/parse-v5.0` | - | - | - | OCR |
| ElevenLabs | `elevenlabs/scribe_v2` | - | - | - | Transcription |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/deepseek-v4-flash-vision-exp` | 1.04858M | $0.22 | $0.66 | Vision, Function calling, Tool choice |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/glm-5p3-flash` | 1.04858M | $0.15 | $0.50 | Vision, Function calling, Tool choice, Response schema |
| Fireworks AI | `fireworks_ai/accounts/fireworks/models/inkling` | 1.04858M | $1.00 | $4.05 | Vision, Function calling, Tool choice, Response schema |
| Fireworks AI | `fireworks_ai/deepseek-v4-flash-vision-exp` | 1.04858M | $0.22 | $0.66 | Vision, Function calling, Tool choice |
| FriendliAI | `friendliai/zai-org/GLM-5.3` | 1.04858M | $1.26 | $3.96 | Reasoning, Function calling, Tool choice, Prompt caching, Response schema |
| FriendliAI | `friendliai/zai-org/GLM-5.3-Flash` | 1.04858M | $0.15 | $0.50 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Video input |
| GigaChat | `gigachat/GigaChat-2` | 128K | $0.0000 | $0.0000 | Function calling |
| GigaChat | `gigachat/GigaEmbeddings-3B-2025-09` | 4K | $0.0000 | $0.0000 | Embeddings |
| Google Gemini | `gemini/gemini-3.8-flash` | 1.04858M | $0.75 | $3.75 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, Audio input, Video input, PDF input |
| Google Gemini | `gemini/lyria-3.5-clip-preview` | 131K | $0.0000 | $0.0000 | Audio output |
| Google Gemini | `gemini/lyria-3.5-pro-preview` | 131K | $0.0000 | $0.0000 | Audio output |
| IBM watsonx | `watsonx/bigscience/mt0-xxl` | 4K | $1.91 | $1.91 | - |
| IBM watsonx | `watsonx/meta-llama/llama-4-maverick-17b-128e-instruct-fp8` | 131K | $0.37 | $1.48 | Function calling |
| Meta Llama API | `meta/muse-spark-1.3` | 1.04858M | $1.25 | $4.25 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, PDF input |
| Meta Llama API | `meta/muse-spark-1.3-contributor` | 1.04858M | $0.10 | $0.20 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, PDF input |
| OpenAI | `gpt-6-astra` | 922K | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, PDF input, Computer use |
| OpenAI | `gpt-daybreak-blue-latest` | 1.05M | $4.00 | $20.00 | Responses API, Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, PDF input, Computer use |
| OpenAI | `gpt-daybreak-red-latest` | 400K | $12.50 | $75.00 | Responses API, Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, PDF input, Computer use |
| Parallel AI | `parallel_ai/search-fast` | - | - | - | Search |
| Parallel AI | `parallel_ai/search-turbo` | - | - | - | Search |
| Scaleway | `scaleway/deepseek-v4-flash-0731` | 256K | $0.40 | $0.80 | Reasoning, Function calling, Prompt caching |
| Scaleway | `scaleway/glm-5.2` | 256K | $1.80 | $5.50 | Reasoning, Function calling |
| Together AI | `together_ai/Qwen/Qwen3.8-Flash` | 1M | $0.15 | $0.47 | - |
| Vertex AI | `gemini-3.8-flash` | 1.04858M | $0.75 | $3.75 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, Audio input, Video input, PDF input |
| Vertex AI | `vertex_ai/claude-fable-5-1` | 1M | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Vertex AI | `vertex_ai/claude-fable-5-1@default` | 1M | $10.00 | $50.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, PDF input, Computer use |
| Vertex AI | `vertex_ai/gemini-3.8-flash` | 1.04858M | $0.75 | $3.75 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search, Audio input, Video input, PDF input |
| Voyage AI | `voyage/rerank-3` | 32K | $0.05 | $0.0000 | Rerank |
| Voyage AI | `voyage/rerank-3-lite` | 32K | $0.02 | $0.0000 | Rerank |
| Z.AI | `zai/glm-5.2` | 1M | $1.40 | $4.40 | Reasoning, Function calling, Tool choice, Prompt caching |
| xAI | `xai/grok-build-latest` | 500K | $2.00 | $6.00 | Reasoning, Vision, Function calling, Tool choice, Prompt caching, Response schema, Web search |

Beyond the table, the remaining 327 entries come from bulk registry work: 160 OpenRouter entries plus the Perplexity Agent API (29), Nebius Token Factory (27), and Databricks (21) catalogs from the verified registry audit ([PR #39388](https://github.com/BerriAI/litellm/pull/39388)), and 45 entries each under the new `qwencloud/` and `qwen_ai_platform/` prefixes mirroring the DashScope catalog ([PR #39149](https://github.com/BerriAI/litellm/pull/39149)).

One entry was removed: `gigachat/GigaChat-2-Lite` is renamed to `gigachat/GigaChat-2` to track the live GigaChat lineup, so a config still pinning the old key loses its cost-map metadata ([PR #38913](https://github.com/BerriAI/litellm/pull/38913)).

The maintenance pass touched 306 existing entries, concentrated in OpenRouter (49), OpenAI (39), Nebius (30), Azure AI (27), and Databricks (22): `source` URLs were refreshed on 155 entries, 69 output and 66 input prices corrected, 37 cache-read rates and 33 deprecation dates added or fixed, and context or output limits corrected on about 40 entries. Notable price moves: Azure AI `deepseek-v4-flash-0731` more than doubles to $0.44 / $1.32 per 1M, `gpt-realtime-2` text output rises from $16 to $24, `mistral/mistral-medium` moves to Medium 3.5 rates ($1.50 / $7.50), GPT-5.4 through 5.6 flex and priority prompts above 272k tokens bill the long-context rate, and GovCloud Claude entries bill 20% above the commercial rate ([PR #39170](https://github.com/BerriAI/litellm/pull/39170), [PR #39388](https://github.com/BerriAI/litellm/pull/39388), [PR #38990](https://github.com/BerriAI/litellm/pull/38990), [PR #38801](https://github.com/BerriAI/litellm/pull/38801)).

#### Features

- **[Anthropic](../../docs/providers/anthropic)**
    - Add day-0 pricing and metadata for `claude-fable-5-1` on Anthropic, Bedrock, Vertex AI, and Azure AI, with `reasoning_effort` accepted, cache reads priced at $0.25/MTok, and forced `tool_choice` returning a clear 400 or downgrading to `auto` under `drop_params` - [PR #39148](https://github.com/BerriAI/litellm/pull/39148)
- **[OpenAI](../../docs/providers/openai)**
    - Add day-0 pricing and metadata for `gpt-6-astra`, covering standard, flex, priority, batch, and above-272K rates plus its `low` through `max` reasoning effort levels - [PR #39622](https://github.com/BerriAI/litellm/pull/39622)
    - Support keyless OpenAI auth via workload identity federation: set `OPENAI_IDENTITY_PROVIDER_ID`, `OPENAI_SERVICE_ACCOUNT_ID`, and `OPENAI_IDENTITY_TOKEN_FILE` and the proxy exchanges the OIDC token at `auth.openai.com` for an auto-refreshing bearer across chat, embeddings, images, audio, moderations, and responses - [PR #38995](https://github.com/BerriAI/litellm/pull/38995)
- **[Azure](../../docs/providers/azure)**
    - Add `azure/gpt-6-astra` and `azure/us/gpt-6-astra` Foundry pricing with long-context and cache rates, and read the `azure/` entry for the `reasoning_effort: none` gate so `/v1/responses` with `none` plus a temperature stops 400ing - [PR #39827](https://github.com/BerriAI/litellm/pull/39827)
- **[Azure AI Foundry](../../docs/providers/azure_ai)**
    - Add day-0 pricing and metadata for `azure_ai/grok-4.6` (200k context, 128k output, `supports_tool_choice`), so spend stops logging $0 and `tool_choice` reaches Foundry - [PR #39426](https://github.com/BerriAI/litellm/pull/39426)
    - Add `azure_ai/DeepSeek-V4-Flash-0731` pricing and metadata, keyed by its Foundry catalog id so `/model/deprecations` surfaces its 2026-12-03 retirement - [PR #39023](https://github.com/BerriAI/litellm/pull/39023), [PR #39341](https://github.com/BerriAI/litellm/pull/39341)
- **[Google Gemini](../../docs/providers/gemini)**
    - Add day-0 pricing and metadata for `gemini-3.8-flash` on `gemini/` and `vertex_ai/` at $0.75 input and $3.75 output per 1M tokens, with 1M context, 64k output, thinking, caching, and batch flags - [PR #39340](https://github.com/BerriAI/litellm/pull/39340)
- **[Dashscope](../../docs/providers/dashscope)**
    - Add `qwencloud/` and `qwen_ai_platform/` as aliases over DashScope, defaulting to the international and mainland hosts respectively, with brand env vars taking precedence and `DASHSCOPE_API_KEY` still accepted - [PR #39149](https://github.com/BerriAI/litellm/pull/39149)
- **[FriendliAI](../../docs/providers/friendliai)**
    - Add day-0 pricing and metadata for `friendliai/zai-org/GLM-5.3` and `friendliai/zai-org/GLM-5.3-Flash` with 1M token caps, prompt caching rates, and `low`/`high`/`max` reasoning effort levels - [PR #38880](https://github.com/BerriAI/litellm/pull/38880), [PR #38881](https://github.com/BerriAI/litellm/pull/38881)
- **[Meta](../../docs/providers/meta)**
    - Add day-0 pricing and metadata for `meta/muse-spark-1.3` and `meta/muse-spark-1.3-contributor`, sharing the 1.2 tier's rates, context window, and capabilities - [PR #39417](https://github.com/BerriAI/litellm/pull/39417)

### Bug Fixes

- **[Amazon Bedrock](../../docs/providers/bedrock)**
    - Send `guardrailConfig`, `performanceConfig`, and `serviceTier` once on Converse requests instead of also nesting a dead copy inside `inferenceConfig` - [PR #38993](https://github.com/BerriAI/litellm/pull/38993)
    - Serve Bedrock on `AWS_BEARER_TOKEN_BEDROCK` alone: Converse no longer crashes when SigV4 credentials are absent, and the credential chain is skipped when a bearer token or `api_key` is set, so a `login_session` profile without `botocore[crt]` stops 500ing chat, embedding, image, and guardrail calls - [PR #39166](https://github.com/BerriAI/litellm/pull/39166), [PR #39411](https://github.com/BerriAI/litellm/pull/39411)
    - Forward native structured outputs (`output_config.format`) on Invoke for models that support them instead of silently inlining the schema, warn on the inline fallback, and stop Claude 5 Bedrock entries claiming native support so `json_schema` requests stop 400ing - [PR #39070](https://github.com/BerriAI/litellm/pull/39070)
    - Gate Converse `cachePoint` emission on the cost map's `supports_prompt_caching`, so Claude Code `cache_control` markers no longer 403 on non-caching models like Nemotron while caching-capable models keep caching - [PR #39210](https://github.com/BerriAI/litellm/pull/39210)
    - Drop `client_metadata` before building Converse requests, so Codex CLI turns on Claude, Nova, and Llama 4 stop failing with `client_metadata: Extra inputs are not permitted` - [PR #35967](https://github.com/BerriAI/litellm/pull/35967)
    - Surface Nova Sonic user transcripts, `speech_started`/`speech_stopped` events, and real per-response usage on `/v1/realtime`, emit `response.created` once per response, log session spend, and add Nova Sonic and Nova 2 Sonic pricing - [PR #38597](https://github.com/BerriAI/litellm/pull/38597)
    - Honor custom Mantle hosts: only the exact `bedrock-mantle.<region>.api.aws` host is rewritten to the public endpoint, and `bedrock/mantle/*` deployments fall back to `BEDROCK_MANTLE_API_BASE` on `/v1/messages` and chat URLs as `bedrock_mantle/*` already did - [PR #39361](https://github.com/BerriAI/litellm/pull/39361), [PR #39364](https://github.com/BerriAI/litellm/pull/39364)
    - Carry per-request `aws_role_name`, `aws_session_name`, and deployment-level static AWS keys into Bedrock Mantle chat completions SigV4 signing, matching what `/v1/responses` already did - [PR #39362](https://github.com/BerriAI/litellm/pull/39362)
- **[Anthropic](../../docs/providers/anthropic)**
    - Upgrade legacy `thinking: {"type": "enabled", "budget_tokens": N}` to `thinking: {"type": "adaptive"}` plus a derived `output_config.effort` on adaptive-only Claude models (Opus 4.7 and 4.8, Sonnet 5, Fable 5) for chat, Bedrock Converse, Invoke, Vertex AI, Databricks, and Azure AI Foundry - [PR #39159](https://github.com/BerriAI/litellm/pull/39159)
    - Fix `response_format` 400s for `claude-fable-5-1` on Vertex AI and Bedrock by using the JSON tool fallback without a forced `tool_choice` on models flagged `supports_forced_tool_use: false` - [PR #39184](https://github.com/BerriAI/litellm/pull/39184)
    - Never carry `cache_control` on translated thinking blocks, so replayed Claude Code turns stop failing with `content.0.thinking.cache_control: Extra inputs are not permitted` - [PR #39815](https://github.com/BerriAI/litellm/pull/39815)
- **[OpenAI](../../docs/providers/openai)**
    - Treat `gpt-6` names as the gpt-5 request family in the OpenAI and Azure configs, so `reasoning_effort`, `max_tokens`, and function tools work on `gpt-6-astra` and `temperature` is dropped on Responses and Messages - [PR #39631](https://github.com/BerriAI/litellm/pull/39631)
    - Flatten top-level `anyOf`/`oneOf`/`allOf` tool schema combinators on chat completions bound for `api.openai.com`, matching the earlier Responses fix - [PR #38839](https://github.com/BerriAI/litellm/pull/38839)
    - Drop `tool_choice` when a chat completions request carries no `tools` or `functions`, so Pi coding agent `/compact` and its fallback retries stop 400ing - [PR #39147](https://github.com/BerriAI/litellm/pull/39147)
    - Forward `reasoning_effort` for unknown `openai/` model names instead of failing closed in the SDK, so proxy aliases backed by reasoning models accept it while known OpenAI models keep client-side validation - [PR #39065](https://github.com/BerriAI/litellm/pull/39065)
    - Default streaming usage on PrivateLink (`<region>.privatelink.api.openai.com`) and regional `api.openai.com` hosts, so SDK streams there report OpenAI's own reasoning and cached tokens instead of undercounted local usage - [PR #39614](https://github.com/BerriAI/litellm/pull/39614)
    - Mint workload identity tokens for PrivateLink and regional `*.api.openai.com` hosts, not only `api.openai.com`, while plaintext `http://` and lookalike hosts still get no token - [PR #39652](https://github.com/BerriAI/litellm/pull/39652)
- **[Azure](../../docs/providers/azure)**
    - Flatten top-level `anyOf`/`oneOf`/`allOf` tool schema combinators on Azure chat completions and `/v1/messages`, while reasoning-active gpt-5.4+ requests keep the union through the Responses bridge - [PR #38870](https://github.com/BerriAI/litellm/pull/38870)
- **[Azure AI Foundry](../../docs/providers/azure_ai)**
    - Keep `azure_ai/` deployments on `.services.ai.azure.com` hosts classified as `azure_ai`, so they route to the Foundry `/models` endpoints, price from the `azure_ai/` cost map, and stop logging the spurious `base_model` warning - [PR #38975](https://github.com/BerriAI/litellm/pull/38975)
- **[Google Gemini](../../docs/providers/gemini)**
    - Return thinking content by default when `thinking: {"type": "enabled"}` omits `budget_tokens` on Gemini 3 models, mapping to `includeThoughts: true` unless `budget_tokens` is explicitly 0 - [PR #39160](https://github.com/BerriAI/litellm/pull/39160)
- **[Vertex AI](../../docs/providers/vertex)**
    - Graft the default `projects/{project}/locations/{location}/publishers/google/models/{model}` path onto an `api_base` whose path is only `/v1` or `/v1beta1`, so those bases stop 404ing - [PR #38986](https://github.com/BerriAI/litellm/pull/38986)
- **[Databricks](../../docs/providers/databricks)**
    - Strip `thinking_blocks`, `reasoning_content`, and `provider_specific_fields` from outbound messages, so second turns of a Claude Code thinking session on `databricks/databricks-claude-*` stop failing with `messages.N.thinking_blocks: Extra inputs are not permitted` - [PR #39409](https://github.com/BerriAI/litellm/pull/39409)
- **[Snowflake](../../docs/providers/snowflake)**
    - Normalize Cortex Claude request shapes: preserve system cache blocks with Cortex's fixed TTL, convert images and tool results to native Anthropic blocks, gate adaptive thinking on capability, emit tool identity once per streamed call, and return cache usage and thinking blocks - [PR #39453](https://github.com/BerriAI/litellm/pull/39453)
- **[Fireworks AI](../../docs/providers/fireworks_ai)**
    - Resolve `tool_choice` and reasoning support for short model names like `fireworks_ai/deepseek-v4-pro-0813` by checking the `accounts/fireworks/models/` cost-map key first, so opencode tool calls stop 400ing - [PR #39763](https://github.com/BerriAI/litellm/pull/39763)
- **[Ollama](../../docs/providers/ollama)**
    - Stamp `finish_reason: tool_calls` when `ollama_chat` streams tool calls before the done chunk, so `/v1/messages` ends with `stop_reason: tool_use` and Claude Code executes the tool - [PR #39010](https://github.com/BerriAI/litellm/pull/39010)

## LLM API Endpoints

#### Features

- **[Responses API](../../docs/response_api)**
    - Add `POST /v1/responses/input_tokens`, counting through the provider's own counting API (images, inline files, and multi-turn input included) and returning OpenAI's exact response and 400 shapes - [PR #38997](https://github.com/BerriAI/litellm/pull/38997)
    - Forward `/v1/responses` natively to `{api_base}/responses` on OpenAI-compatible deployments that set `model_info.supported_endpoints: ["/v1/responses"]`, so `previous_response_id` and other Responses-only fields reach the server instead of being lost in the chat completions bridge - [PR #39725](https://github.com/BerriAI/litellm/pull/39725)
- **[/v1/messages](../../docs/anthropic_unified)**
    - Fall back on Anthropic safeguard refusals: a `/v1/messages` response with `stop_reason: "refusal"` now enters the content-policy fallback chain, streaming included, so Claude Code sessions behind an auto-router recover on the configured fallback instead of dying - [PR #39157](https://github.com/BerriAI/litellm/pull/39157)
- **[Batches](../../docs/batches)**
    - Enforce team isolation on provider-format batch ids: retrieve, cancel, and output or error file reads on another team's batch now return 403, while ids with no ownership row keep passing through - [PR #33536](https://github.com/BerriAI/litellm/pull/33536)
- **[Vector Stores](../../docs/completion/knowledgebase)**
    - Add a `mongodb` vector store provider running `$vectorSearch` through pymongo on Atlas and self-managed deployments, selectable in the Admin UI, installable with `pip install 'litellm[mongodb]'` and shipped in every proxy Docker image - [PR #39811](https://github.com/BerriAI/litellm/pull/39811), [PR #39994](https://github.com/BerriAI/litellm/pull/39994)
- **OCR**
    - Add Cohere Parse on `/v1/ocr` for `cohere/parse-v5.0` and Azure AI Foundry `Cohere-parse-v5` deployments, billed at $0.0015 a page, with health checks probing each OCR deployment with a document its provider accepts - [PR #39862](https://github.com/BerriAI/litellm/pull/39862)
- **Agents and A2A**
    - Derive the AgentCore runtime session id from the A2A `message.contextId`, prefixed with a hash of the calling key, so agents keep conversation context per `contextId` and keys never share a session; ids outside 33 to 256 characters return a JSON-RPC `-32602` 400 - [PR #39371](https://github.com/BerriAI/litellm/pull/39371)

#### Bugs

- **[Responses API](../../docs/response_api)**
    - JSON-encode object `arguments` on replayed `function_call` input items in the chat completions bridge, so upstream models get valid JSON instead of a Python dict repr - [PR #35417](https://github.com/BerriAI/litellm/pull/35417)
    - Give tool calls served by a Claude fallback `fc_` and `ctc_` shaped item ids with the raw `call_id`, drop foreign item ids on requests to OpenAI, and stop emitting null-text message items, so gpt-5 to claude fallback conversations replay to either model - [PR #39144](https://github.com/BerriAI/litellm/pull/39144)
    - Encrypt the response id on every streamed event, including `response.queued`, so a background streaming response can no longer be read or cancelled by another key - [PR #39534](https://github.com/BerriAI/litellm/pull/39534)
    - Decode a JSON-string tool `parameters` schema before sending it to the provider, and reject anything that does not parse to an object with a 400 naming `tools[i].parameters` - [PR #39844](https://github.com/BerriAI/litellm/pull/39844)
    - Bridge gpt-5.4+ tool calls with unset `reasoning_effort` to `/v1/responses` on any `api.openai.com` subdomain, so PrivateLink hosts no longer get a 400 on Chat Completions - [PR #39587](https://github.com/BerriAI/litellm/pull/39587)
    - Resolve Headroom `headroom_retrieve` calls server-side on streaming `/v1/responses` and write the compressed input back into `input`, so clients get text deltas instead of a raw tool call and compression stops silently doing nothing - [PR #38808](https://github.com/BerriAI/litellm/pull/38808)
    - Stop dropping the `web_search` tool on `bedrock_mantle` `/v1/responses` requests and mark the GPT-5.4, 5.5, and 5.6 Mantle entries as web search capable, so answers come back grounded with `url_citation` annotations - [PR #35987](https://github.com/BerriAI/litellm/pull/35987)
- **[/v1/messages](../../docs/anthropic_unified)**
    - Report the requested model on streaming `message_start` instead of the upstream deployment name, matching non-streaming responses, so Claude Code sessions resume on the alias; `return_raw_model_name` still opts out - [PR #35816](https://github.com/BerriAI/litellm/pull/35816)
    - Drain the upstream stream in a detached pump when the client disconnects mid-stream, so interrupted Bedrock `/v1/messages` streams bill the output tokens AWS actually charged instead of the few chunks the client read - [PR #36008](https://github.com/BerriAI/litellm/pull/36008)
    - Return Anthropic's `{"type": "error", "error": {...}}` envelope on `/v1/messages` errors with the type mapped from the status code, instead of an OpenAI envelope carrying `"None"` strings - [PR #39037](https://github.com/BerriAI/litellm/pull/39037)
    - Drop `cache_control.ttl` on the non-Anthropic `/v1/messages` passthrough, so Claude Code with 1h prompt caching stops getting 400s from providers that reject it; upstreams that honor `ttl` opt in with `model_info.cache_control_ttl: true` - [PR #39355](https://github.com/BerriAI/litellm/pull/39355)
- **[Batches](../../docs/batches)**
    - Register ownership for batches created from a model-encoded file id, a `model` param, or `?provider=`, so they show up in `GET /v1/batches` for the key that created them - [PR #39810](https://github.com/BerriAI/litellm/pull/39810)
    - Forward `aws_external_id` in Bedrock files and batches credential loading, so roles whose trust policy requires `sts:ExternalId` no longer fail AssumeRole on `/v1/files` uploads - [PR #39066](https://github.com/BerriAI/litellm/pull/39066)
- **[Files](../../docs/files_endpoints)**
    - Add `general_settings.max_file_size_mb` and `blocked_file_extensions` checks on every `/v1/files` purpose, reject filenames carrying `..`, and require `PROXY_ADMIN` on `/upload/logo` - [PR #39379](https://github.com/BerriAI/litellm/pull/39379)
- **[Images](../../docs/image_generation)**
    - Parse numeric multipart fields such as `n` on `/v1/images/edits` back into numbers, so Bedrock Nova Canvas stops rejecting `n=2` with a string `numberOfImages` - [PR #39510](https://github.com/BerriAI/litellm/pull/39510), [PR #39780](https://github.com/BerriAI/litellm/pull/39780)
    - Forward `background`, `output_format`, `moderation`, and `output_compression` for gpt-image models on OpenAI and Azure, and keep the provider's echoed `background`, `size`, `quality`, and `output_format` in the response - [PR #39525](https://github.com/BerriAI/litellm/pull/39525)
- **[Realtime](../../docs/realtime)**
    - Rewrite `session.model` to the routed deployment on `/v1/realtime/client_secrets`, so ephemeral keys minted for aliased model groups connect on `/v1/realtime/calls` instead of failing with a model mismatch 400 - [PR #36811](https://github.com/BerriAI/litellm/pull/36811)
    - Relay an upstream websocket refusal or close to the client as an `error` event plus a close with the upstream code and reason, log it as a failure instead of a $0 success, and release the pre-call budget reservation - [PR #39851](https://github.com/BerriAI/litellm/pull/39851)
- **[Speech](../../docs/text_to_speech)**
    - Stop returning 500 when a Gemini TTS `/v1/audio/speech` request carries `response_format`; `pcm` now returns raw PCM16 as `audio/pcm`, `wav` keeps the WAV wrap, and `mp3`, `flac`, `opus`, and `aac` get a 400 naming the supported formats, on Gemini and Vertex AI - [PR #38819](https://github.com/BerriAI/litellm/pull/38819), [PR #38868](https://github.com/BerriAI/litellm/pull/38868)
- **Embeddings**
    - Omit `encoding_format` on OpenAI-compatible embedding calls when the client omits it, so chained proxies and providers that reject the param stop returning 400; explicit values, model config, and the env var still forward - [PR #38774](https://github.com/BerriAI/litellm/pull/38774)
- **[Rerank](../../docs/rerank)**
    - Map rerank errors with the resolved provider on sync and async paths, so messages read `DashscopeException - ...` instead of `None - ` and `arerank` raises litellm exceptions instead of raw provider classes - [PR #39176](https://github.com/BerriAI/litellm/pull/39176)
    - Forward `truncate_prompt_tokens`, `truncation_side`, `max_tokens_per_query`, and `max_tokens_per_doc` on `hosted_vllm` rerank requests, and reject an invalid value with a 400 naming the field - [PR #39363](https://github.com/BerriAI/litellm/pull/39363)
- **[Search](../../docs/search)**
    - Forward a search tool's configured `litellm_params` (`mode`, `max_results`, ...) through the router, nest Parallel AI filters under `advanced_settings`, keep `search_id` and `excerpts` in responses, and bill Parallel by mode tier at published rates - [PR #37883](https://github.com/BerriAI/litellm/pull/37883)
    - Reject a missing or malformed explicit `search_tool_name` before any provider is called, then revert it in the same release because SDK callers with no router failed every request; the silent fallback is unchanged from v1.100 - [PR #38113](https://github.com/BerriAI/litellm/pull/38113), [PR #39146](https://github.com/BerriAI/litellm/pull/39146)
- **[Vector Stores](../../docs/completion/knowledgebase)**
    - Thread the Router through S3 Vectors search-time embeddings so virtual model names resolve, keep the store's config on `/v1/rag/query` instead of failing with `aws_region_name is required`, and show backend search errors in the UI instead of "No results found" - [PR #34788](https://github.com/BerriAI/litellm/pull/34788)
    - Resolve vector store embedding credentials per request through the Router, so a bare Router alias as `litellm_embedding_model` works on Milvus, Valkey, and Azure AI Search searches and chat retrieval; `litellm_embedding_config` is now optional - [PR #38936](https://github.com/BerriAI/litellm/pull/38936)
    - Forward a managed store's `api_key`, `api_base`, and provider extras like Milvus `outputFields` to the `/v1/rag/query` search call, so managed Milvus stores stop failing with `MILVUS_API_KEY is not set` - [PR #39452](https://github.com/BerriAI/litellm/pull/39452)
    - Embed S3 Vectors search queries through the shared vector store executor with the caller's team and key metadata, so query embeddings show up in the team's spend logs - [PR #39474](https://github.com/BerriAI/litellm/pull/39474)
    - Keep the context from every reachable store when one `vector_store_ids` search fails in the chat completions hook, chain context across stores, and name the failing `vector_store_id` in the warning - [PR #39495](https://github.com/BerriAI/litellm/pull/39495)
    - List only vector stores the caller was granted on `/vector_store/list` for non-admin keys and dashboard sessions; unscoped stores now need an `object_permission.vector_stores` grant on the key or team - [PR #39612](https://github.com/BerriAI/litellm/pull/39612)
- **OCR**
    - Stop prepending `deepseek-ai/` twice for `vertex_ai/deepseek-ai/deepseek-ocr-maas`, so the cost-map name returns OCR output instead of a Vertex "Malformed publisher model" 400 - [PR #39194](https://github.com/BerriAI/litellm/pull/39194)
- **Containers**
    - Route container create and list through the `model_list` deployment named by `model`, so teams without a global `OPENAI_API_KEY` stop getting `Bearer None` 401s, and return managed `cntr_` ids from async create - [PR #39220](https://github.com/BerriAI/litellm/pull/39220)
    - Pass upstream error status through on container routes (a deleted container returns OpenAI's 404 instead of a 500) and forward `limit`, `order`, and `after` on `GET /v1/containers` and the files list - [PR #39464](https://github.com/BerriAI/litellm/pull/39464)
- **Agents and A2A**
    - Redact secret `litellm_params` fields such as `aws_secret_access_key` from every `/v1/agents` response, for admins too, while an edit that echoes the marker keeps the stored value - [PR #39389](https://github.com/BerriAI/litellm/pull/39389)
    - Hide agents from non-admin listings on `GET /v1/agents`, the dashboard, and MCP `agent_search` unless the key, team, or user was granted them; direct access to a named agent is unchanged - [PR #39636](https://github.com/BerriAI/litellm/pull/39636)
    - Keep previously published agents in `public_agent_groups` when publishing another, so a second `make_public` no longer returns 200 while publishing nothing - [PR #39554](https://github.com/BerriAI/litellm/pull/39554)
- **Pass-through Endpoints**
    - Add native `/gigachat/{endpoint}` passthrough routes with spend logging, so GigaChat-native tools can use the gateway; register the model in config to get token accounting - [PR #38913](https://github.com/BerriAI/litellm/pull/38913)
    - Turn the `/openai_passthrough/*` and `/openai/*` WebSocket relays off unless `general_settings.enable_openai_websocket_passthrough: true` is set, and refuse identities with a model restriction at any level once enabled - [PR #39841](https://github.com/BerriAI/litellm/pull/39841)
    - Drop `anthropic-beta` on the Vertex passthrough count-tokens route, so Claude Code in Vertex mode stops stalling on large file reads when Vertex rejects beta values on that route - [PR #39597](https://github.com/BerriAI/litellm/pull/39597)
    - Prepend `/v1` (or `/v1beta1` for `cachedContent`) to versionless `/projects/...` routes on the Vertex passthrough, so Claude Code in Vertex mode with the documented base URL stops getting 404s - [PR #39625](https://github.com/BerriAI/litellm/pull/39625)
    - Apply `default_vertex_config` project and location before building the Vertex passthrough base URL, so routes without `/projects/<project>/locations/<location>/` work, and return a 400 naming the fix when no location is available - [PR #39662](https://github.com/BerriAI/litellm/pull/39662)
- **General**
    - Emit `x-litellm-response-duration-ms` and `x-litellm-overhead-duration-ms` on `/v1/messages` and `/v1/responses`, and fill `litellm_overhead_time_ms` in SpendLogs and logging payloads for those call types - [PR #38840](https://github.com/BerriAI/litellm/pull/38840)
    - Drop wildcard routes such as `bedrock/*` from `/v1/models`, so model pickers list only callable ids; `return_wildcard_routes=True` still adds the wildcard once - [PR #31731](https://github.com/BerriAI/litellm/pull/31731)
    - Move audio transcription provider resolution, transformation, signing, and HTTP execution into the Rust gateway core crate, preserving the callback, guardrail, and logging lifecycle - [PR #39126](https://github.com/BerriAI/litellm/pull/39126)

## Management Endpoints / UI

#### Features

- **SSO and Authentication**
    - Enforce a configurable password policy (12 characters with upper, lower, number and special by default, tunable via `general_settings.password_policy_*`) wherever a password is set, and turn off username/password login once SSO is configured with `general_settings.disable_password_login_when_sso_enabled: true`, keeping master key access as the recovery path - [PR #39381](https://github.com/BerriAI/litellm/pull/39381)
- **Auto Router**
    - Serve the auto-router preset catalog at runtime from `GET /public/autorouter_presets`, resolved once per process from the published catalog on main (override with `LITELLM_AUTOROUTER_PRESETS_URL`, or set `LITELLM_LOCAL_AUTOROUTER_PRESETS=True` to use the bundled copy), so preset updates no longer need a dashboard rebuild - [PR #39412](https://github.com/BerriAI/litellm/pull/39412)
- **Access Groups**
    - Return `{id, name}` pairs for MCP servers, agents, teams and keys on access group responses (`access_mcp_servers`, `access_agents`, `assigned_teams`, `assigned_keys`), resolved server side with `name: null` when an id no longer resolves, so the detail page shows names instead of raw ids - [PR #39822](https://github.com/BerriAI/litellm/pull/39822)
- **SCIM**
    - Add `GET /scim/v2/placeholders` to list placeholder users that shadow a real account and `POST /scim/v2/placeholders/{id}/merge` to move their teams onto that account and delete them, ending the permanent "names more than one LiteLLM user" rejection on group pushes - [PR #39231](https://github.com/BerriAI/litellm/pull/39231)
    - Resolve SCIM group members with one user table read per member instead of an exact lookup plus an email `ILIKE` scan, keeping exact id precedence and ambiguity detection unchanged - [PR #39228](https://github.com/BerriAI/litellm/pull/39228)
- **Models + Endpoints**
    - Add per-model `model_info.display_name` in config.yaml, returned as `display_name` on the Anthropic-shaped `GET /v1/models` listing so Claude Code's `/model` picker shows a clean label while the model id keeps routing; the OpenAI-shaped listing is unchanged - [PR #39238](https://github.com/BerriAI/litellm/pull/39238)
- **Organizations**
    - Expose `PATCH /v2/organization/{organization_id}` in `/openapi.json` and Swagger so API users and generated clients can discover the org update route with merge-patch semantics (null clears, omitted leaves untouched) - [PR #39672](https://github.com/BerriAI/litellm/pull/39672), [PR #39794](https://github.com/BerriAI/litellm/pull/39794)
- **LiteLLM CLI (lite)**
    - Set `ENABLE_TOOL_SEARCH=true` in `lite claude` and write the same default into Claude Code settings from `lite up`, `lite login --config-claude` and `lite autoroute up`, so MCP tool schemas stay deferred instead of filling the context window; an existing value wins - [PR #38942](https://github.com/BerriAI/litellm/pull/38942)
    - Enable Claude Code gateway model discovery by default: `lite claude` exports `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` and `lite up` / `lite login --config-claude` write it into `~/.claude/settings.json`, so the `/model` picker lists the proxy's models on first launch - [PR #39445](https://github.com/BerriAI/litellm/pull/39445)
    - Add `lite debug claude`, which renders one markdown report for a Claude Code session (spend, tokens, errors, request and response bodies for failed and recent turns) and saves it under `~/.litellm/debug/`, plus `lite debug install-claude-command` for a `/debug-lite` slash command - [PR #39435](https://github.com/BerriAI/litellm/pull/39435)
    - Pre-fill the SSO verification code in the browser during `lite login` when the proxy sets `general_settings.allow_cli_sso_verification_uri_complete: true`, so the user only confirms the code instead of retyping it - [PR #39428](https://github.com/BerriAI/litellm/pull/39428)
    - Sync OpenCode's model picker from the proxy's `/v1/models` in `lite opencode` by passing a generated `litellm` provider through `OPENCODE_CONFIG_CONTENT`, so proxy models appear without a hand-maintained `opencode.json`; a failed fetch still launches OpenCode - [PR #39789](https://github.com/BerriAI/litellm/pull/39789)
- **Helm and Deployment**
    - Add `migrationJob.hooks.argocd.enabled` and `migrationJob.hooks.helm.enabled` to the componentized chart so Argo CD users can run migrations as a PreSync hook on every sync, and add `strategy` on gateway, backend and ui for `maxSurge` / `maxUnavailable` control; defaults keep today's behavior - [PR #39112](https://github.com/BerriAI/litellm/pull/39112)
    - Render `migrationJob.nodeSelector`, `migrationJob.tolerations` and `migrationJob.affinity` on the componentized chart's migrations Job so it pins to the same node pool as the Deployments instead of landing on any node - [PR #39843](https://github.com/BerriAI/litellm/pull/39843)
- **Terraform**
    - Add a dependencies-only mode to `terraform/litellm/gcp` (`create_runtime = false`) plus bring-your-own-network (`network_id`, `create_psa_connection = false`) and `redis_transit_encryption`, with new outputs that map straight into `helm/litellm` values for GKE deployments on a Shared VPC - [PR #39695](https://github.com/BerriAI/litellm/pull/39695)
- **Auto Router**
    - Add a Configure automatically action to the Add Auto Router form that fills every tier from the chat model groups the proxy already serves, preferring current OpenAI, Anthropic, Google, DeepSeek, and xAI ladders and applying the strongest reasoning effort the flagship advertises - [PR #39693](https://github.com/BerriAI/litellm/pull/39693)
    - Choose how often a complexity router classifies from one "How often to classify" radio (every request, every new user message, or once per session), writing `classification_mode` on create and edit, with once per session disabled on custom tier sets - [PR #39042](https://github.com/BerriAI/litellm/pull/39042)
    - Toggle context-window escalation and set its window-fit buffer from a new Advanced: Context Window Escalation section, storing `enable_context_window_escalation` and `context_window_escalation_buffer` on the router and leaving both out when untouched - [PR #39054](https://github.com/BerriAI/litellm/pull/39054)
    - Turn on modality routing from the create and edit forms with a "Route image requests to vision-capable models" switch that writes `modality_routing` explicitly and survives later saves - [PR #39059](https://github.com/BerriAI/litellm/pull/39059)
    - Set the session affinity idle window in seconds from Advanced: Affinity, with a blank field tracking the backend default of 3600 seconds (`session_affinity_ttl_seconds`) across create, edit, and preset flows - [PR #39679](https://github.com/BerriAI/litellm/pull/39679)
    - Send images to an LLM classifier and cap the images per request from Advanced: Classification Method, persisting the `vision` setting on `classifier_llm_config` for new and existing routers - [PR #39840](https://github.com/BerriAI/litellm/pull/39840)
    - Add a 1M Context preset that prefills Luna, Terra, Opus 5, and Opus 5 with high thinking on the Heuristic v2 classifier, and move the OpenAI Family preset to GPT-5.6 Luna, Terra, and Sol with Sol at xhigh thinking for reasoning, and route the 1M Context preset's complex tier to `gpt-5.6-sol` - [PR #39490](https://github.com/BerriAI/litellm/pull/39490), [PR #39396](https://github.com/BerriAI/litellm/pull/39396), [PR #39797](https://github.com/BerriAI/litellm/pull/39797)
- **Model Hub**
    - Page the public Model Hub table off `/public/v1/model_hub` one page at a time, sending paging, sorting, search, and the provider, mode, and feature filters as query parameters and filling the filter dropdowns from new facet routes - [PR #39691](https://github.com/BerriAI/litellm/pull/39691)
- **Agents**
    - Add a name and description search box to the Agent Hub tab and the admin Agents table, and show a "No matching" state instead of every row when a hub search matches nothing - [PR #39155](https://github.com/BerriAI/litellm/pull/39155)
- **General**
    - Find rows by a pasted ID: the Virtual Keys, Memory, Audit Logs, and Request Logs search boxes send a new `search` param that matches key hashes, memory ids, and session ids, Agents search matches the agent id, and team Virtual Keys gains a Key ID filter - [PR #39661](https://github.com/BerriAI/litellm/pull/39661)

#### Bugs

- **Teams and Keys**
    - Stop a partial `/team/update` or `PATCH /team/{team_id}` from wiping team metadata: an update that omits `metadata` now merges into the stored metadata (explicit `null` still clears it) and keeps the team member budget link, so guardrails, logging and key duration survive a limit change - [PR #36328](https://github.com/BerriAI/litellm/pull/36328)
    - Let `/team/member_delete` clear a team left on the user row after a group sync instead of answering 400 "User not found in team", removing the stale team and any keys the user held under it - [PR #38703](https://github.com/BerriAI/litellm/pull/38703)
    - Allow non-admins to switch an existing key between `key_type` presets on `/key/update` (for example "AI APIs" to "Full access") instead of a 403; widening a read-only key or clearing an admin-set custom route list still needs a proxy admin - [PR #39051](https://github.com/BerriAI/litellm/pull/39051)
    - Treat an empty `team_id` on `/key/generate` and `/key/regenerate` as no team, and have the Team dropdown emit `null` on clear, so a non-admin who picks a team then clears it still gets a personal key instead of "Team not found for team_id=" - [PR #39206](https://github.com/BerriAI/litellm/pull/39206)
    - Treat `project_id: ""` on `/key/generate` as unset and emit `null` from the Organization dropdown on clear, so clearing the Organization field no longer fails key creation with "Organization doesn't exist in db. Organization=" - [PR #39316](https://github.com/BerriAI/litellm/pull/39316)
    - Include `litellm_model_table` in `GET /v2/team/list` for active teams so a team's `model_aliases` can be read back instead of always returning `null` - [PR #39045](https://github.com/BerriAI/litellm/pull/39045)
    - Generate a UUID when Team ID is submitted blank instead of storing an empty string, so the Teams table no longer shows empty Team ID cells - [PR #39571](https://github.com/BerriAI/litellm/pull/39571)
    - Return persisted team memberships from `POST /user/new` after default teams are attached, so a new SSO user's first `lite login` mints a token on the default team and respects its model allowlist instead of `teams: []` - [PR #39545](https://github.com/BerriAI/litellm/pull/39545)
- **Access Groups**
    - Derive an access group's attached teams from the team table on GET and PUT so teams attached before the mirror column existed show up and deleted ids drop out, and return `400 Unknown team ids: ...` from POST and PUT `/v1/access_group` for ids that resolve to no team - [PR #39218](https://github.com/BerriAI/litellm/pull/39218)
    - Run the access group key sync `UPDATE` statements on the writer when `DATABASE_URL_READ_REPLICA` is set, so `/key/generate`, `/key/update`, `/key/delete` and `/key/{key}/regenerate` with access groups stop failing with "cannot execute UPDATE in a read-only transaction" - [PR #39128](https://github.com/BerriAI/litellm/pull/39128)
- **Models + Endpoints**
    - Apply a model rename to the router's in-memory deployment list so the new name is callable and survives a page refresh without a proxy restart - [PR #38479](https://github.com/BerriAI/litellm/pull/38479)
    - Return 200 with the updated model row from `POST /model/block` and `/model/unblock` instead of a 500 for a change that had already applied - [PR #38873](https://github.com/BerriAI/litellm/pull/38873)
    - Re-encrypt `litellm_params` in place on master key rotation instead of deleting and recreating every model row, so `blocked`, `created_at`, `updated_at`, `created_by` and `updated_by` survive and a blocked model stays blocked after rotation - [PR #38878](https://github.com/BerriAI/litellm/pull/38878)
    - Persist `model_name` on `POST /model/update` and rewrite `access_model_names` in every access group on model rename or delete, treat `organization_id: ""` as unset on `/key/generate` and `/key/update`, and list a conversation's distinct models via `session_models` on `/spend/logs/ui` - [PR #39436](https://github.com/BerriAI/litellm/pull/39436)
    - Keep `litellm_credential_name` typed into the LiteLLM Params JSON on Add Model when the credentials dropdown is empty, and reject `/model/new` and `/model/update` with 403 unless a proxy admin attaches a stored credential - [PR #39047](https://github.com/BerriAI/litellm/pull/39047)
    - Strip `default_api_key_rpm_limit` and `default_api_key_tpm_limit` from provider request bodies so a deployment carrying them stops failing every call with an Anthropic 400 "Extra inputs are not permitted" while the per-key limit still applies - [PR #39211](https://github.com/BerriAI/litellm/pull/39211)
    - Resolve router model aliases in `/utils/supported_openai_params` so every model `/v1/models` lists answers instead of 400 "Could not map model", and answer `github_copilot/` and `chatgpt/` names from their declared provider instead of starting an OAuth device flow that froze the proxy - [PR #39000](https://github.com/BerriAI/litellm/pull/39000)
    - Return 404 from `DELETE /credentials/{name}` when no stored credential matched instead of 200 "deleted successfully", and raise the proxy exception from `GET /credentials` and the delete so a rejection carries its own status code - [PR #36260](https://github.com/BerriAI/litellm/pull/36260)
- **SSO and Authentication**
    - Resolve a multi-valued SSO role claim to the highest privilege role across generic OIDC, JWT access tokens, SAML and Entra `app_roles`, so a user holding `proxy_admin_viewer` and `internal_user` no longer lands as whichever came first; affected users are re-roled on next login - [PR #39480](https://github.com/BerriAI/litellm/pull/39480)
    - Mark session, SSO and SAML cookies `Secure` when the public origin is HTTPS behind a TLS-terminating reverse proxy, trusting `PROXY_BASE_URL` and then `X-Forwarded-Proto` only from `general_settings.mcp_trusted_proxy_ranges`, and set `HttpOnly` / `SameSite` on the one path that never did - [PR #39391](https://github.com/BerriAI/litellm/pull/39391)
    - Invalidate the JWT key mapping cache on `/key/{key}/regenerate` and broadcast evictions from `/jwt/key/mapping` create, update and delete to every worker, so JWT calls stop returning 401 for up to five minutes after a key rotation - [PR #39808](https://github.com/BerriAI/litellm/pull/39808)
- **SCIM**
    - Join the configured default team (`default_internal_user_params.teams`) when SCIM creates a user, and treat a `PUT /scim/v2/Users` with no or empty `groups` as unspecified so an Okta profile sync no longer strips every team membership and deletes the user's keys on them - [PR #39623](https://github.com/BerriAI/litellm/pull/39623)
- **Auto Router**
    - Expose the configured `model_info.mode` for auto-router models in `GET /v1/models` so Claude Code can identify the router as chat-capable - [PR #39619](https://github.com/BerriAI/litellm/pull/39619)
    - Save only the opening instructions and calibration examples when editing a built-in auto-router classifier prompt, with the proxy deriving tier criteria, labels and guard, so a tier rename can no longer disagree with the prompt; existing whole-prompt overrides stay editable in legacy mode - [PR #39688](https://github.com/BerriAI/litellm/pull/39688)
- **Health Checks**
    - Probe Test Connect with the credential the request names instead of borrowing a key or `api_base` from an unrelated matching deployment (common with wildcard routes), so a saved credential no longer fails with an auth error for a key that was never entered - [PR #39801](https://github.com/BerriAI/litellm/pull/39801)
- **LiteLLM CLI (lite)**
    - Quote the Claude Code `apiKeyHelper` for cmd.exe on Windows in `lite up` and `lite login --config-claude` instead of POSIX single quotes, so Claude Code can run the helper and reach the proxy; POSIX output is unchanged - [PR #39174](https://github.com/BerriAI/litellm/pull/39174)
- **Helm and Deployment**
    - Reuse the generated master key Secret on `helm upgrade` instead of minting a new key every release, so clients holding the install-time key keep working; explicit `masterkey` and `masterkeySecretName` behave as before - [PR #39219](https://github.com/BerriAI/litellm/pull/39219)
    - Add `ingress.controller: alb | nginx` (default `alb`, byte-identical render) so under `nginx` dotted built-in paths render as `ImplementationSpecific` and the ALB-only `/*.txt` rule is dropped, letting `helm install` pass ingress-nginx's admission webhook on v1.12.0 to v1.13.1 - [PR #39465](https://github.com/BerriAI/litellm/pull/39465)
    - Scale the classic chart's HPA at `targetCPUUtilizationPercentage: 60` instead of the `helm create` scaffold's 80, matching the documented recommendation, and bump the chart to 1.1.3 - [PR #35975](https://github.com/BerriAI/litellm/pull/35975)
- **Docker Images**
    - Bump `wolfi-base` to glibc 2.44, pin apk `python-3.13` instead of the rolling `python3` meta package, and set `UV_PYTHON_DOWNLOADS=0` across the proxy and migrations Dockerfiles, so image builds stop failing on a silent CPython 3.14 download and `uvloop` source build - [PR #38917](https://github.com/BerriAI/litellm/pull/38917), [PR #38973](https://github.com/BerriAI/litellm/pull/38973)
    - Install the `bedrock-realtime` extra in the root, `non_root` and `database` proxy images so Bedrock Nova Sonic sessions on `/v1/realtime` stop failing with "Missing aws_sdk_bedrock_runtime" - [PR #39223](https://github.com/BerriAI/litellm/pull/39223)
    - Install the `saml` extra in the split `litellm-backend` image so `/sso/saml/*` stops returning 501 on Helm split-image deployments - [PR #39291](https://github.com/BerriAI/litellm/pull/39291)
    - Match `USE_DDTRACE` case-insensitively in the entrypoint scripts and Terraform launch commands so `USE_DDTRACE=True` runs under `ddtrace-run`, and route the `build_from_pip` image through `prod_entrypoint.sh` so it honors the variable at all - [PR #39344](https://github.com/BerriAI/litellm/pull/39344)
    - Add the public Wolfi apk repository to the runtime image so `apk add` works inside the published container without Chainguard enterprise credentials - [PR #39033](https://github.com/BerriAI/litellm/pull/39033)
    - Pin the UI image's nginx runtime to `1.31.5-alpine3.24` by digest instead of the floating `1.31-alpine` tag, so published images carry current Alpine packages and pass image scans - [PR #39561](https://github.com/BerriAI/litellm/pull/39561)
- **General**
    - Keep an explicit `blocked: false` on `/customer/update` so a blocked customer can be unblocked through that endpoint instead of the update returning 200 while the customer stays blocked - [PR #34696](https://github.com/BerriAI/litellm/pull/34696)
    - Log malformed virtual key rejections (for example `Bearer undefined`) as `WARNING` on stdout instead of `ERROR` on stderr, keeping the same 401 response, so log collectors stop counting them as proxy errors; suppress with `LITELLM_LOG=ERROR` - [PR #38838](https://github.com/BerriAI/litellm/pull/38838)
    - Skip the object permission DB lookup during auth when a request names no vector stores, removing one database round trip from every plain chat request on keys or teams with object permissions - [PR #39347](https://github.com/BerriAI/litellm/pull/39347)
- **Usage and Logs**
    - Page request logs one session per row server-side through an opt-in `group_by_session` param on `/spend/logs/ui`, with a keyset cursor on the default newest-first sort, so every page holds as many distinct sessions as the footer claims and older traces stay reachable - [PR #39257](https://github.com/BerriAI/litellm/pull/39257), [PR #38794](https://github.com/BerriAI/litellm/pull/38794)
    - Sum a session's prompt, completion, and total tokens in the logs table Tokens cell like the Cost cell, with `session_total_tokens`, `session_total_prompt_tokens`, and `session_total_completion_tokens` on `/spend/logs/ui` rows - [PR #39598](https://github.com/BerriAI/litellm/pull/39598)
    - Read the Usage page Total Requests tile from gateway successful plus failed counts so it equals the Successful and Failed tiles instead of a drifting spend-rollup figure - [PR #39963](https://github.com/BerriAI/litellm/pull/39963)
    - Render the full server page of Per User Usage through the shared DataTable server pagination footer with a 25/50/100 rows-per-page selector, so users ranked 11-50 on each page are no longer skipped - [PR #39682](https://github.com/BerriAI/litellm/pull/39682)
- **Teams and Keys**
    - Keep the Virtual Keys search, filters, sort, and page in the URL query string (for example `?key_search=`), so leaving the page and pressing Back, or pasting the link to a teammate, restores the same filtered list - [PR #39481](https://github.com/BerriAI/litellm/pull/39481)
    - Replace the browser history entry when a virtual key is rotated, so pressing Back returns to the key list instead of a "Key not found" error for the revoked hash - [PR #39471](https://github.com/BerriAI/litellm/pull/39471)
    - Stop the Create Team form blanking the Organization and Models picks when the organization list refetches, clearing models only when a different organization is chosen - [PR #39476](https://github.com/BerriAI/litellm/pull/39476)
    - Send `object_permission.agents` and `agent_access_groups` as `[]` from team settings when the last agent is removed, so the removal clears the agent instead of silently keeping it - [PR #39600](https://github.com/BerriAI/litellm/pull/39600)
    - Match a pasted user ID as well as an email in the Internal Users search box via a new `search` param on `/user/list` - [PR #39604](https://github.com/BerriAI/litellm/pull/39604)
- **Design System**
    - Make Admin UI tables honor the selected page size: All Models filters move server-side via new `access_group` and `wildcard_only` params on `/v2/model/info`, Request Logs defaults to 25 rows, Deleted Teams gets the shared footer, and 20 unbounded lists gain a size selector - [PR #39680](https://github.com/BerriAI/litellm/pull/39680)
    - Scroll Keys, Teams, Logs, and Tags rows inside the table under a pinned column header, keep the pagination footer reachable, and stop Model Hub and Tags rows painting past their fixed-height boxes - [PR #39684](https://github.com/BerriAI/litellm/pull/39684)
    - Snap server-paginated tables to the last valid page when the row count shrinks, so deleting the last rows on the final page no longer strands the user on "Page 2 of 1" - [PR #39776](https://github.com/BerriAI/litellm/pull/39776)
    - Lay out the invite-user and SSO settings checkboxes horizontally so they render as a square box beside their label instead of a full-width dark bar - [PR #39108](https://github.com/BerriAI/litellm/pull/39108)
    - Render the request logs Tools panel, the skill detail page, and the guardrail garden detail page with theme tokens instead of hardcoded light-palette colors, so they are readable in dark mode - [PR #39129](https://github.com/BerriAI/litellm/pull/39129), [PR #39130](https://github.com/BerriAI/litellm/pull/39130), [PR #39131](https://github.com/BerriAI/litellm/pull/39131)
- **Models + Endpoints**
    - Hide the Add Model tab, the Auto Router create, edit, and delete controls, and the model Delete and Update API Key buttons from view-only admin (`proxy_admin_viewer`) sessions, whose writes the API already rejects with 403 - [PR #38872](https://github.com/BerriAI/litellm/pull/38872)
    - Accept any routing group name the proxy accepts, such as `team a/fast chat`, by dropping the client-only character pattern on the Create Routing Group form while still refusing a whitespace-only name - [PR #39807](https://github.com/BerriAI/litellm/pull/39807)
- **Agents**
    - Show the complete AgentCore runtime ARN in the agent edit form instead of a value truncated after `runtime/`, so saving without edits no longer corrupts the stored ARN, and reject a malformed ARN inline before save - [PR #39382](https://github.com/BerriAI/litellm/pull/39382)
- **Auto Router**
    - Render the scoring tier list under How Classification Works with the theme's muted-foreground token so it is legible in dark mode instead of black on black - [PR #39040](https://github.com/BerriAI/litellm/pull/39040)
- **General**
    - Remove an unreachable AI Hub "See Page" dialog whose button would have navigated to `/model_hub_table?key=<session key>`, so no code path can place the admin's session key in a page URL - [PR #39968](https://github.com/BerriAI/litellm/pull/39968)
    - A dashboard change to keep `litellm_credential_name` from the LiteLLM Params JSON shipped and was reverted within this window, so nothing changes there; the fix landed on the backend in #39047 instead - [PR #39005](https://github.com/BerriAI/litellm/pull/39005), [PR #39046](https://github.com/BerriAI/litellm/pull/39046)

## AI Integrations

### Logging

- **[OpenTelemetry](../../docs/observability/opentelemetry_integration)**
    - Emit `gen_ai.usage.cache_creation.input_tokens` and `gen_ai.usage.cache_read.input_tokens` on OTel v2 LLM spans, normalizing Anthropic, OpenAI-compatible, DeepSeek and DashScope cache fields and keeping explicit zeros, so token-based cost tools stop pricing cache usage at zero - [PR #38716](https://github.com/BerriAI/litellm/pull/38716), [PR #39202](https://github.com/BerriAI/litellm/pull/39202)
    - Stamp `litellm.request.route` on the OTel v2 LLM call span, read from the root server span's `http.route`, so LLM spans can be filtered by proxy endpoint without a join to the parent span; SDK calls omit the key - [PR #39698](https://github.com/BerriAI/litellm/pull/39698)
- **[Datadog LLM Observability](../../docs/proxy/logging#datadog)**
    - Send tool calls, tool results, offered tool definitions and prompt-cache token counts in Datadog's own schema fields, so the Tools panel populates and the Metrics tab shows `cache_read_input_tokens`; the flat `input_tool_calls.*` and `output_tool_calls.*` metadata keys are removed - [PR #39222](https://github.com/BerriAI/litellm/pull/39222)
    - Add `user`, `key_alias` and `model_group` cost tags declared under `_dd.cost_tags`, flatten auto-router decisions into `router_*` fields including `router_escalated`, emit `reasoning_output_tokens`, and drop tool definitions and prompt-quoting metadata from success and failure spans under message redaction - [PR #39402](https://github.com/BerriAI/litellm/pull/39402)
    - Keep the guardrail audit record (name, mode, status, timings, `masked_entity_count`, `guardrail_cost_by_unit`) on redacted spans, replacing only the four prompt-carrying fields, so `turn_off_message_logging` or `x-litellm-enable-message-redaction` no longer blanks `guardrail_information` - [PR #39702](https://github.com/BerriAI/litellm/pull/39702), [PR #39848](https://github.com/BerriAI/litellm/pull/39848)
- **[Prometheus](../../docs/proxy/prometheus)**
    - Serve `/metrics` from a separate process with the new `--prometheus_metrics_port` flag or `PROMETHEUS_METRICS_PORT` env var, so multi-worker scrape aggregation stops competing with inference on a uvicorn worker; the main port keeps serving `/metrics` and the new port has no virtual-key auth - [PR #39889](https://github.com/BerriAI/litellm/pull/39889)
    - Add `litellm_api_key_rate_limit_allowed_metric`, `litellm_api_key_rate_limit_used_metric`, `litellm_team_rate_limit_allowed_metric` and `litellm_team_rate_limit_used_metric` gauges with a `rate_limit_type` label, read from the v3 rate limiter's own headers with no extra Redis read, so alerts can fire before a key or team hits its limit - [PR #39236](https://github.com/BerriAI/litellm/pull/39236)
    - Collapse unknown client model names on failure paths into one `requested_model="other"` series while known names, aliases, team models and wildcard matches keep their own label, so typo'd or hallucinated model names no longer grow `/metrics` and pod memory without bound - [PR #39136](https://github.com/BerriAI/litellm/pull/39136)
- **[Langfuse](../../docs/proxy/logging#langfuse)**
    - Stamp the root observation's input and output on `langfuse_otel` traces while the root span is still recording, for `/v1/chat/completions`, `/v1/responses` and `/v1/messages`, streaming or not, so the Langfuse trace list and trace view no longer show empty Input and Output - [PR #39369](https://github.com/BerriAI/litellm/pull/39369)
- **[CloudZero](../../docs/proxy/logging)**
    - Infer the daily batch and CBF schema from every row instead of the first 100, so `POST /cloudzero/export` no longer fails with a 500 Polars schema error and late `resource/tag:team_alias` and `resource/tag:entity_id` tags reach CloudZero - [PR #39871](https://github.com/BerriAI/litellm/pull/39871), [PR #39873](https://github.com/BerriAI/litellm/pull/39873)
- **[S3](../../docs/proxy/logging#s3-buckets)**
    - Shorten s3 object keys and download filenames for long Responses API ids with a readable head plus a sha256 digest, trimming the configured prefix only when it overflows, so uploads no longer fail with `KeyTooLongError` and session replay and the logs page keep the payload - [PR #39164](https://github.com/BerriAI/litellm/pull/39164)
- **Azure Storage**
    - Authenticate keyless Azure Storage logging and managed files through the `DefaultAzureCredential` chain, so Workload Identity Federation deployments work without service principal variables, with chain tokens read on a worker thread - [PR #39229](https://github.com/BerriAI/litellm/pull/39229)
    - Restrict that chain to the identities a deployment carries (workload identity, an `AZURE_STORAGE_CLIENT_*` service principal, managed identity), so a developer's `az login` or the LLM's `AZURE_CLIENT_SECRET` never writes the blobs - [PR #39637](https://github.com/BerriAI/litellm/pull/39637)
- **Spend Logs**
    - Persist `metadata.router_metadata` (requested model, selected model and provider, and a `router_correlation_id` equal to the `x-litellm-call-id` header) on spend rows for deployments flagged `model_info.internal_router_model: true`, discarding any client-supplied `router_metadata` - [PR #39001](https://github.com/BerriAI/litellm/pull/39001)
    - Retry Postgres deadlocks like transport errors and requeue the batch at the head of the queue on any other Prisma error, so spend log rows survive a DB hiccup instead of being dropped - [PR #39883](https://github.com/BerriAI/litellm/pull/39883)
    - Store the readable `litellm-internal-health-check` service-account name as `api_key` on health-check spend rows again instead of a sha256 hash, so those rows are attributable in Usage and BI exports as they were before v1.99 - [PR #39572](https://github.com/BerriAI/litellm/pull/39572)
- **General**
    - Log a mid-stream provider timeout on `/v1/messages` and pass-through routes as a failure carrying the usage and cost of the chunks already delivered, so failure callbacks fire, `litellm_deployment_failure_responses_total` moves, and the spend row reads `status: "failure"` instead of success - [PR #39589](https://github.com/BerriAI/litellm/pull/39589)
    - Fire team-level logging callbacks such as Langfuse and Datadog on the 20+ pass-through routes and websocket passthrough, failing open on a malformed team logging config, and stop those requests returning 500 `'NoneType' object has no attribute 'get'` when a pre-call guardrail runs - [PR #38979](https://github.com/BerriAI/litellm/pull/38979), [PR #39216](https://github.com/BerriAI/litellm/pull/39216)
    - Keep provider response headers, including the provider request id and Azure `apim-request-id`, on streaming `/v1/responses` logging payloads, matching what non-streaming logs already carry - [PR #38131](https://github.com/BerriAI/litellm/pull/38131)
    - Isolate each logging hook failure per callback and always run the slot-releasing limiter callback after a stream ends, so a raising logging integration no longer leaks `max_parallel_requests` slots and locks the key out with false 429s for up to an hour - [PR #39093](https://github.com/BerriAI/litellm/pull/39093)
    - Aggregate `status_fields.guardrail_status` across every guardrail entry by severity (`guardrail_intervened` over `guardrail_failed_to_respond` over `success` over `not_run`), so a request blocked by a later guardrail no longer logs as `success` and a non-string status no longer drops the whole payload - [PR #39596](https://github.com/BerriAI/litellm/pull/39596)
    - Redact credential query params from the uvicorn access log, percent-encoded keys included, so `/key/info?key=sk-...` logs as `GET /key/info?REDACTED`, and stop the budget-exceeded 429 echoing raw key material; `LITELLM_DISABLE_REDACT_SECRETS=true` turns the filter off - [PR #39293](https://github.com/BerriAI/litellm/pull/39293)
    - Redact credential-named kwargs, including ones nested in `extra_headers` and `extra_body`, from the `set_verbose` `Request to litellm:` and `Final returned optional params` lines, so a provider key no longer lands in terminals, CI job logs and log drains - [PR #39526](https://github.com/BerriAI/litellm/pull/39526), [PR #39538](https://github.com/BerriAI/litellm/pull/39538)
    - Run the base64 image scan for log truncation on a worker thread for payloads over 256 KiB, so logging a 12 MB multimodal request no longer stalls the event loop for other clients - [PR #39890](https://github.com/BerriAI/litellm/pull/39890)

### Guardrails

- **[Bedrock Guardrails](../../docs/proxy/guardrails/bedrock)**
    - Honor `streaming_buffer_until_moderated`, `streaming_end_of_stream_only`, and `streaming_sampling_rate` on Bedrock `post_call` guardrails, so an audit-mode stream reaches the client live with one OUTPUT scan on the assembled text, its verdict recorded in `guardrail_information`, and a post-flush block ending the stream as an in-stream error frame - [PR #38722](https://github.com/BerriAI/litellm/pull/38722)
    - Route streamed `/v1/responses` output through the unified guardrail so a Bedrock `post_call` guardrail no longer returns HTTP 500 `Error building chunks for logging/streaming usage calculation`; events are held until the whole response is scanned, and a violation returns the guardrail block instead of model text - [PR #38734](https://github.com/BerriAI/litellm/pull/38734)
    - Stop scanning `toolConfig` tool definitions as user content on Bedrock passthrough `converse` and `converse-stream`, so a denied term in a tool description no longer blocks a benign prompt, and close the bypass this allowed under `experimental_use_latest_role_message_only` - [PR #39281](https://github.com/BerriAI/litellm/pull/39281)
    - Mask `X-Amz-Security-Token` and `Authorization` in the Bedrock ApplyGuardrail debug log line, so `--detailed_debug` no longer prints live temporary AWS credentials - [PR #39044](https://github.com/BerriAI/litellm/pull/39044)
- **Alice**
    - Add the `alice` guardrail (formerly ActiveFence), evaluating requests and responses against Alice and enforcing its ALLOW, BLOCK, MASK, or DETECT verdict, with the application's policy picked by `alice_app_id` in the virtual key metadata, credential-shaped keys stripped from the outbound payload, and transport failures honoring `unreachable_fallback` - [PR #38898](https://github.com/BerriAI/litellm/pull/38898)
- **Guardrail Cost and Monitoring**
    - Roll up Bedrock guardrail cost per usage counter: spend logs carry `guardrail_cost_by_unit`, `/guardrails/usage/overview` gains `cost`, `untrackedUsageUnits`, and `totalCost`, and `/guardrails/usage/detail/{id}` gains cost by unit, team, and key; unpriced or pre-migration units read as untracked, never as $0 - [PR #39196](https://github.com/BerriAI/litellm/pull/39196)
    - Show Usage Units and Cost columns, a Guardrail Cost card, and a per-counter, team, and key Usage & Cost section on the Guardrails Monitor, with a "How is this calculated?" popover and unpriced units flagged next to the cost they are left out of - [PR #39853](https://github.com/BerriAI/litellm/pull/39853)
    - Deep link guardrail detail views with `?guardrail=<id>` on the Guardrails and Guardrails Monitor pages, so a shared link, reload, or browser back keeps the selected guardrail, and a stale id shows Guardrail not found with a Back to Guardrails button - [PR #39930](https://github.com/BerriAI/litellm/pull/39930)
- **Custom Code Guardrails**
    - Add a non-blocking `flag(reason, metadata={})` verdict to custom code guardrails, so content passes through unchanged while a `guardrail_flagged` entry is logged, counted as flagged on the Guardrails Monitor, filterable with `?action=flagged` on `/guardrails/usage/logs`, and rendered FLAGGED in Request Logs - [PR #39728](https://github.com/BerriAI/litellm/pull/39728)
    - Record guardrail information for `CustomGuardrail` subclasses whose `apply_guardrail` override is not wrapped in `@log_guardrail_information`, so a docs-style custom guardrail that blocks now shows up on the Guardrails Monitor and in the request's Guardrails tab - [PR #39727](https://github.com/BerriAI/litellm/pull/39727)
- **[Presidio](../../docs/proxy/guardrails/pii_masking_v2)**
    - Track and tear down Presidio's sibling `post_call` callbacks on `DELETE` and `PUT /guardrails/{id}`, so a deleted guardrail stops masking responses and an entity edit no longer leaves a stale sibling enforcing the old `pii_entities_config` - [PR #39271](https://github.com/BerriAI/litellm/pull/39271)
- **[CrowdStrike AIDR](../../docs/proxy/guardrails/crowdstrike_aidr)**
    - Honor `mode`, `streaming_end_of_stream_only`, and `streaming_sampling_rate` on the `crowdstrike_aidr` guardrail instead of always running pre_call and post_call and rescanning every 5th streamed chunk; a config with `mode: during_call` or `logging_only` now fails at boot under strict guardrail modes - [PR #39317](https://github.com/BerriAI/litellm/pull/39317)
- **[HiddenLayer](../../docs/proxy/guardrails/hiddenlayer)**
    - Drop `image_url` parts before building the HiddenLayer v1 detection payload, since the v1 endpoint only accepts text; HiddenLayer v2 still receives the full multimodal content - [PR #29210](https://github.com/BerriAI/litellm/pull/29210)
- **[Prompt Security](../../docs/proxy/guardrails/prompt_security)**
    - Add a `file_sanitization_timeout` (default 30s) and a `file_sanitization_fail_open` policy for Prompt Security file sanitization: a timed-out file is forwarded unsanitized by default, and `file_sanitization_fail_open: false` returns HTTP 408 instead - [PR #38083](https://github.com/BerriAI/litellm/pull/38083)
- **Hide Secrets**
    - Stop redacting benign identifiers: the OpenAI detector only matches standalone `sk-` tokens carrying a digit, the base64 entropy threshold moves to detect-secrets' 4.5 default, and redaction order is deterministic across workers so prompt caching keys stay stable - [PR #39879](https://github.com/BerriAI/litellm/pull/39879)
    - Redact secrets in the guardrail playground (`POST /guardrails/apply_guardrail`) instead of echoing them back, list Hide Secrets with its `pre_call` mode in the Add Guardrail form, and record `allow` or `mask` guardrail telemetry with masked entity counts in Spend Logs and the Guardrails Monitor - [PR #39398](https://github.com/BerriAI/litellm/pull/39398)
- **[Model Armor](../../docs/proxy/guardrails/model_armor)**
    - Handle streamed `/v1/messages`, `/v1/responses`, and Google `:streamGenerateContent` responses in Model Armor `post_call` instead of returning 500, refuse a stream the guardrail cannot assemble in that endpoint's own error shape (`fail_on_error: false` forwards it unscanned with a warning), and block rather than rewrite a streamed `/v1/responses` that needs masking - [PR #39181](https://github.com/BerriAI/litellm/pull/39181)
- **Policy Engine**
    - Restore the request's own guardrails list after a policy pipeline finishes with allow, so an independently attached `post_call` content filter no longer silently skips when an unrelated `pre_call` pipeline is attached to the same model - [PR #39038](https://github.com/BerriAI/litellm/pull/39038)
- **General**
    - Apply `PUT /guardrails/{id}` to the worker that served it immediately, rebuilding the guardrail from the new row so mode changes take effect without a restart, and reject an invalid config (an uncompilable regex) with HTTP 422 on PUT and PATCH while the previous config keeps enforcing - [PR #38877](https://github.com/BerriAI/litellm/pull/38877), [PR #39243](https://github.com/BerriAI/litellm/pull/39243)
    - Deliver a `modify_response` guardrail block on streaming `/v1/chat/completions` and `/v1/responses` as a valid SSE stream ending in `data: [DONE]` with HTTP 200 (a `content_filter` finish chunk on chat, `response.completed` on Responses), instead of an error frame or a bare HTTP 500 when buffering - [PR #39036](https://github.com/BerriAI/litellm/pull/39036)
    - Skip streaming guardrail rounds whose text has not changed since the last scan, end of stream included, so a finished answer is scanned once and no scan goes out with empty text; rounds carrying tool calls are never skipped - [PR #39386](https://github.com/BerriAI/litellm/pull/39386)
    - Run `apply_guardrail`-only providers (`custom_code`, `panw_prisma_airs`) in `mode: logging_only` on copies of the logged request and response, so the verdict lands in `guardrail_information` as `success` or `guardrail_intervened` instead of the provider never being called - [PR #39297](https://github.com/BerriAI/litellm/pull/39297)
    - Keep Codex `namespace` (MCP) tools, `custom` tools, and computer_use, image_generation, and shell tools intact on `/v1/responses` when a guardrail returns them unchanged, rebuilding only the members a guardrail edited or dropped, so MCP tool calls stop coming back as unsupported `ns__member` functions - [PR #39366](https://github.com/BerriAI/litellm/pull/39366)
    - Carry Anthropic `url` image sources through to guardrails on `/v1/messages` and label `base64` sources as `data:<media_type>;base64,...`, so an image-aware guardrail sees the picture instead of recording a clean pass - [PR #38940](https://github.com/BerriAI/litellm/pull/38940)
    - Keep vector store `search_results` in `provider_specific_fields` on `/v1/chat/completions` when any guardrail is registered, by returning None from a guardrail post-success hook that did not run and chaining results through every callback - [PR #38984](https://github.com/BerriAI/litellm/pull/38984)

### Prompt Management

- **General**
    - Key the in-memory prompt registry by environment so development and production copies of one `prompt_id` no longer shadow each other: serving defaults to production, then staging, then development, a new `prompt_environment` param on `/v1/chat/completions` and `/v1/responses` pins one, and the dashboard lists one row per environment - [PR #38440](https://github.com/BerriAI/litellm/pull/38440)

## Spend Tracking, Budgets and Rate Limiting

- **[Budgets and Rate Limiting](../../docs/proxy/users)**
    - Show per-window budget usage on `/key/info` and `/v2/key/info`: a new `budget_limits_usage` field reports `current_spend` for each `budget_duration` in `budget_limits`, read from the same counter enforcement uses - [PR #37044](https://github.com/BerriAI/litellm/pull/37044)
    - Reject a request up front under `fail_closed_budget_enforcement: true` when its worst-case estimate exceeds the key's remaining budget, returning 429 with the persisted spend and estimated cost instead of shrinking the reservation and letting spend land over `max_budget` - [PR #39214](https://github.com/BerriAI/litellm/pull/39214)
    - Enforce per-model budgets (`model_max_budget`) across replicas by moving their counters onto the Redis-backed spend counter cache, so a capped key gets 429 on every replica and `/key/info` reports the shared `current_spend` without `enable_redis_auth_cache` - [PR #39375](https://github.com/BerriAI/litellm/pull/39375)
    - Zero the cached end-user spend counter in memory and Redis on budget reset and evict the cached end-user object, so requests stop returning 429 as soon as the window rolls over on every worker and replica - [PR #39729](https://github.com/BerriAI/litellm/pull/39729)
    - Clear organization budget fields when `PATCH /organization/update` sends `null` for `tpm_limit`, `rpm_limit`, `max_budget` or another budget field, matching the merge-patch semantics of `PATCH /v2/organization/{organization_id}` - [PR #39670](https://github.com/BerriAI/litellm/pull/39670)
    - Return 422 from `PATCH /v2/organization/{organization_id}` on a negative `tpm_limit`, `rpm_limit` or `max_parallel_requests` and on an unparseable `budget_duration`, instead of writing the values to the budget row - [PR #39793](https://github.com/BerriAI/litellm/pull/39793)
    - Seed new budget window rows from a time-bounded spend log aggregate instead of a client-chosen `request_id` list, so proxy memory stays flat through a database outage and window spend matches the logs across pods - [PR #38851](https://github.com/BerriAI/litellm/pull/38851)
- **Off-Peak Pricing**
    - Add time-based off-peak pricing: a model's `off_peak_pricing` block takes `hours_utc` windows or weekday-qualified `windows` (with `weekday_timezone`) plus discounted per-token rates that replace the standard, tier or threshold rate while the window is open - [PR #31725](https://github.com/BerriAI/litellm/pull/31725)
    - Accept `output_cost_per_reasoning_token` and `cache_creation_input_token_cost` in the `off_peak_pricing` block, so reasoning and cache-creation tokens bill at the discounted rate inside the window on the generic cost path and the DashScope calculator - [PR #39635](https://github.com/BerriAI/litellm/pull/39635)
    - Honor `off_peak_pricing` in the DashScope, Fireworks AI and Perplexity cost calculators, which billed the standard rate inside the window while a DeepSeek deployment with the same block already discounted - [PR #39592](https://github.com/BerriAI/litellm/pull/39592), [PR #39632](https://github.com/BerriAI/litellm/pull/39632)
- **[Cost Calculation](../../docs/proxy/cost_tracking)**
    - Carry the final response cost as `usage.cost` on the last streamed usage chunk for chat completions and `/v1/responses` by default, so clients pricing an aliased model no longer get None; per-chunk SSE cost injection stays behind its flag - [PR #39069](https://github.com/BerriAI/litellm/pull/39069)
    - Bill xAI requests at the cost xAI reports in `usage.cost_in_usd_ticks`, on chat and Responses, streamed or not, so server-side tools such as X search are charged; config-priced deployments and margins still apply on top - [PR #39441](https://github.com/BerriAI/litellm/pull/39441)
    - Bill the auto-router's routing embedding to the caller's key and team, so each auto-routed request logs an `aembedding` row alongside the completion instead of leaving the embedding unattributed - [PR #39532](https://github.com/BerriAI/litellm/pull/39532)
    - Bill Bedrock Mantle web search at $12 per 1,000 queries using the `tool_usage.web_search.num_requests` count Bedrock reports on `/v1/responses`, falling back to counting `web_search_call` items when no count is present - [PR #39610](https://github.com/BerriAI/litellm/pull/39610)
    - Bill OCR annotation pages via `annotation_cost_per_page` (falling back to `ocr_cost_per_page`), so annotation-only and mixed Document AI calls on `/v1/ocr` no longer log $0 spend - [PR #38985](https://github.com/BerriAI/litellm/pull/38985)
    - Keep guardrail cost in spend on cache hits, so a cached request fronted by a paid guardrail records the guardrail charge in spend logs, daily tables and budgets instead of $0 - [PR #39960](https://github.com/BerriAI/litellm/pull/39960)
    - Keep the every-deployment scope on gateway cache-injection marks recorded before deployment choice, so `gateway_injected_caching_savings_spend` credits the gateway for cache hits billed through any deployment or failover leg - [PR #39241](https://github.com/BerriAI/litellm/pull/39241)
- **Spend Logs**
    - Add `GET /team/spend/by_user` and a Spend Per User Within Team card with CSV download on the Team Usage page, breaking team spend down per user including JWT traffic; team admins see every member, members see only themselves - [PR #39771](https://github.com/BerriAI/litellm/pull/39771)
    - Key `/v1/messages` spend rows on the `msg_` id the client received, including streaming, the `/anthropic/v1/messages` passthrough and bridged non-Anthropic models, so `GET /spend/logs?request_id=msg_...` finds the row - [PR #39511](https://github.com/BerriAI/litellm/pull/39511), [PR #39541](https://github.com/BerriAI/litellm/pull/39541)
    - Add `general_settings.missing_session_id` for requests with no session id: `generate` stamps one id shared by SpendLogs and Langfuse, `reject` returns 400, and `omit` leaves `SpendLogs.session_id` null; unset keeps today's fallback - [PR #39450](https://github.com/BerriAI/litellm/pull/39450), [PR #39458](https://github.com/BerriAI/litellm/pull/39458)
    - Stamp `user_api_key_hash` on batch cost writers and recover alias and email for double-hashed rows in Usage, CloudZero and Focus exports, so batch spend since v1.99 shows under the key alias instead of `key-hash-...` - [PR #39568](https://github.com/BerriAI/litellm/pull/39568)
    - Group the `GET /spend/logs` summary by day inside Postgres instead of per-row Prisma `group_by`, returning the same per-day JSON while proxy memory stays flat across repeated calls - [PR #39351](https://github.com/BerriAI/litellm/pull/39351)
    - Ship `psycopg` in the proxy extras so partitioned `LiteLLM_SpendLogs` detection runs during migration, and warn when it is missing, instead of failing on the primary-key rewrite - [PR #38994](https://github.com/BerriAI/litellm/pull/38994)
- **Alerting**
    - Add `user_spend_thresholds` and `user_spend_anomalies` Slack alert types with daily and monthly per-user thresholds and an anomaly multiplier set via `alerting_args` or the Admin UI, and reject out-of-range values with a 400 instead of breaking config reload - [PR #38438](https://github.com/BerriAI/litellm/pull/38438)
    - Deliver budget alerts when `alerting` contains only `webhook`, and accept `ALERTING_WEBHOOK_URL` as a provider-neutral fallback for `SLACK_WEBHOOK_URL` so Slack-format alerts reach Rocket.Chat or Mattermost - [PR #38441](https://github.com/BerriAI/litellm/pull/38441)
- **Model Pricing Map**
    - Retry the boot-time cost map fetch on 429, 5xx and transport errors with Retry-After aware backoff, and re-create config deployments a stale cost map dropped on the next `/reload/model_cost_map` instead of losing them for the pod's lifetime - [PR #39230](https://github.com/BerriAI/litellm/pull/39230)
    - Replace 52 dead cost map `source` URLs across 119 entries and correct or add 12 `deprecation_date` values, including the OpenAI realtime previews (2026-05-07) and `whisper-1` plus the transcribe models (2027-02-26) - [PR #38801](https://github.com/BerriAI/litellm/pull/38801)
    - Price Veo 3.1 by resolution tier on Gemini and Vertex AI, align Fireworks DeepSeek V4 Flash with its published rate, add `zai/glm-5.2`, `together_ai/Qwen/Qwen3.8-Flash`, `cerebras/gemma-4-31b`, `elevenlabs/scribe_v2` and Databricks DeepSeek V4, plus six deprecation dates - [PR #38990](https://github.com/BerriAI/litellm/pull/38990)
    - Reprice the registry from provider pages: OpenAI realtime limits and GPT-5.4 to 5.6 flex and priority tiers above 272k, Mistral aliases, Together Qwen3.8, Azure AI cache rates, GovCloud and Azure Government models, Cloudflare Whisper, and new deprecation dates - [PR #39170](https://github.com/BerriAI/litellm/pull/39170)
    - Add 252 verified registry entries and correct 135 more (Databricks September catalog, OpenRouter, W&B per-1M divisors), move realtime image rates to the per-token field, and drop the unpublished GPT Image 2 text output price - [PR #39388](https://github.com/BerriAI/litellm/pull/39388)

## MCP Gateway

- **Tools and admission**
    - Add semantic tool search to the native MCP Gateway: with `litellm_settings.mcp_tool_search.embedding_model` set, the `mcp_tool_search` virtual tool ranks the caller's authorized tools by embedding similarity, with `top_k`, a score threshold and always-first `core_tools` tunable from the Admin UI; without an embedding model, keyword matching stays - [PR #39404](https://github.com/BerriAI/litellm/pull/39404)
    - Scan and mask MCP tool call arguments in `mode: pre_mcp_call` guardrails: Presidio, Model Armor, Noma, Pillar, Bedrock and other `apply_guardrail` integrations now receive the argument strings as `texts` and their rewrites land in `modified_arguments`, so PII in MCP payloads is masked instead of passing through unscanned - [PR #35142](https://github.com/BerriAI/litellm/pull/35142)
    - Follow `nextCursor` pagination on upstream `tools/list`, so multi-page catalogs expose every tool in the gateway, REST endpoints, Admin UI preview and the SDK `load_mcp_tools` helper instead of page one; the whole walk runs under `MCP_TOOL_LISTING_TIMEOUT`, so raise `LITELLM_MCP_TOOL_LISTING_TIMEOUT` for very slow upstreams - [PR #39172](https://github.com/BerriAI/litellm/pull/39172)
    - Report per-server outcomes on aggregate `GET /mcp-rest/tools/list`: a new `server_outcomes` map names every queried server as `ok` with a tool count or `auth_required` with its HTTP status, so an OAuth-protected server without credentials no longer vanishes silently from the list - [PR #39232](https://github.com/BerriAI/litellm/pull/39232)
    - Add an opt-in `mcp_allow_all_keys_respects_mcp_scope: true` setting so a virtual key with an explicit MCP server list no longer discovers or calls unrelated allow-all servers; unscoped keys and the default behavior are unchanged - [PR #39531](https://github.com/BerriAI/litellm/pull/39531)
    - Persist a key's MCP alias grants verbatim instead of rewriting them to region-local server ids, so a key created in one region of a shared-database multi-region setup works in the other again (regressed in v1.88.0); keys saved while broken need re-saving with the alias - [PR #39119](https://github.com/BerriAI/litellm/pull/39119)
    - Reject an `mcp_tool_permissions` key that is a name or alias shared by several MCP servers with a 400 naming those servers, on key, team, organization, user, customer and agent writes; existing ambiguous entries keep working until their tool list is edited - [PR #39947](https://github.com/BerriAI/litellm/pull/39947)
    - Show MCP servers inherited via access groups, toolsets or tool permissions in the tool permission matrix, badged with their source, so saving a team no longer wipes an inherited server's tool allowlist; equivalent id, name and alias keys collapse onto one entry on write - [PR #35154](https://github.com/BerriAI/litellm/pull/35154)
    - List MCP servers and agents inherited from access groups on the team Overview and Settings Object Permissions card, counted alongside direct grants with a hover naming the granting group; `/team/info` `access_group_details` now carries `mcp_server_ids` and `agent_ids` per group - [PR #39215](https://github.com/BerriAI/litellm/pull/39215)
    - Keep `/v1/responses` MCP auto-execution stateless under `store: false`: the follow-up model call replays the prior turn with its `reasoning.encrypted_content` instead of sending a `previous_response_id` the provider never stored, so zero data retention callers get an answer instead of a 400 - [PR #36575](https://github.com/BerriAI/litellm/pull/36575)
- **OAuth and session tokens**
    - Renew the SSO identity assertion behind `oauth2_id_jag` servers by redeeming the stored refresh token as the assertion nears expiry, single-flighted per user across replicas, so ID-JAG agents keep working past one `id_token` lifetime without another interactive sign-in; a refused renewal still returns the sign-in-again 412 - [PR #35401](https://github.com/BerriAI/litellm/pull/35401)
    - Warn when an `oauth2_id_jag` server is created, updated or loaded from config while the active SSO provider (Google, Microsoft, SAML) cannot capture an identity assertion, and at SSO login when nothing was captured, instead of letting the server fail silently forever - [PR #35394](https://github.com/BerriAI/litellm/pull/35394)
    - Accept `x-mcp-<access_group>-<header>` as the default upstream credential for every server in that access group on `/mcp/<group>`, targeted tool calls and `/mcp-rest`, so one header covers the group; a server's own `x-mcp-<server>-*` header still wins and servers outside the group never receive it - [PR #39717](https://github.com/BerriAI/litellm/pull/39717)
    - Stop exchanging the LiteLLM virtual key as the upstream subject token on token-exchange and ID-JAG servers: a request carrying only `Authorization: Bearer sk-...` now gets a 401 challenge instead of shipping the gateway key to the IdP; send the key in `x-litellm-api-key` and the IdP token in `Authorization` - [PR #39446](https://github.com/BerriAI/litellm/pull/39446)
    - Resolve the connect-time OBO pre-flight through the key's allowed servers, so a key not entitled to a token-exchange server no longer triggers an IdP exchange or caches a credential for it - [PR #39447](https://github.com/BerriAI/litellm/pull/39447)
    - Pre-flight the `oauth2_id_jag` credential at connect time, so a missing or expired stored assertion surfaces as a plain 412 and an assertion-store outage as 503, instead of a 200 `tools/list` with no tools followed by "tool not found" on the call - [PR #35392](https://github.com/BerriAI/litellm/pull/35392)
    - Fence an in-flight outbound-token mint against an overlapping invalidation with a per-key generation counter, so a bearer the upstream just rejected with 401 is no longer re-cached for its full TTL and the retry gets a fresh token - [PR #35398](https://github.com/BerriAI/litellm/pull/35398)
    - Cache SSO identity assertion reads on the ID-JAG path in memory for `MCP_SSO_ASSERTION_CACHE_TTL_SECONDS` (default 60s), invalidated by a login on the same pod, so repeated `tools/call` requests stop reading Postgres on every call - [PR #39348](https://github.com/BerriAI/litellm/pull/39348)
    - Strip the inbound `Authorization` scheme case-insensitively and across any whitespace before token exchange, so a client sending `authorization: bearer <jwt>` no longer leaks `bearer` into the RFC 8693 `subject_token` and gets 401 from every `oauth2_token_exchange` server - [PR #39346](https://github.com/BerriAI/litellm/pull/39346)
    - Resolve the OAuth broker routes (`/{server}/authorize`, `/{server}/.well-known/oauth-authorization-server` and the rest) by `server_id` when the name or alias lookup misses, with the same client IP access check, so clients that put the stable id in the path stop getting 404 - [PR #39432](https://github.com/BerriAI/litellm/pull/39432)
- **Server configuration**
    - Let a config.yaml MCP server pin its `server_id`, so editing the server's url no longer changes its id and silently breaks every key and team grant for it; a pinned id that collides with another config entry is rejected at startup and servers without one keep their current id - [PR #39286](https://github.com/BerriAI/litellm/pull/39286)
    - Cap the Admin UI tools preview and Test Connection (`POST /mcp-rest/test/tools/list`) at `MCP_TOOL_LISTING_TIMEOUT` (30s) across OAuth discovery, connect and handshake, and name the unreachable upstream URL in the error, so a blocked upstream returns a JSON message instead of a load balancer 504 - [PR #38791](https://github.com/BerriAI/litellm/pull/38791)
    - Normalize a schemed `authentication_token` on the v2 shared-key and OpenAPI static paths as the v1 client already does, so pasting `Bearer eyJ...` no longer sends `Bearer Bearer eyJ...` upstream and `basic` credentials given as `user:pass` are base64 encoded - [PR #39345](https://github.com/BerriAI/litellm/pull/39345)
    - Reject a `username:password@host` MCP URL under `auth_type: none` before any upstream client is created, pointing the admin at `auth_type: basic`, instead of sending an unauthenticated request and surfacing a generic upstream 401 - [PR #39926](https://github.com/BerriAI/litellm/pull/39926)

## Performance / Loadbalancing / Reliability improvements

- **Complexity router (Auto Router)**
    - Add `classifier_type: heuristic_v2`, a calibrated local four-tier classifier backed by a bundled UltraFeedback preset that picks a tier without a classifier model call; on a Terminal-Bench subset it solved 14 of 21 tasks for $9.78 against heuristic v1's 11 of 21 for $14.06 - [PR #39276](https://github.com/BerriAI/litellm/pull/39276)
    - Meter auto-router capabilities against the `auto_router` license feature: without it a proxy holds one `heuristic_v2` router and one router with operator-defined `tier_definitions` or a custom classifier prompt, an over-limit config.yaml refuses to start, and `/model/new` returns 403; the shipped prompt, rubric presets and `tier_labels` stay free - [PR #39468](https://github.com/BerriAI/litellm/pull/39468), [PR #39674](https://github.com/BerriAI/litellm/pull/39674)
    - Escalate a prompt that cannot fit its classified tier's context window to the lowest tier that fits before dispatch, so long coding-agent sessions stop getting 400s on the cheap tier; spend logs record `context_escalated` with the original tier, and `enable_context_window_escalation: false` turns it off - [PR #38844](https://github.com/BerriAI/litellm/pull/38844)
    - Add `classification_mode: user_turn` under `complexity_router_config` to classify only new human asks and replay the session's held decision on tool-result continuations (logged as `user_turn_continuation`); an agentic benchmark measured 85% fewer classifier calls and zero mid-loop model switches - [PR #38861](https://github.com/BerriAI/litellm/pull/38861)
    - Add `classifier_type: hybrid`, which keeps the heuristic scorer's tier at any level and calls the LLM classifier only when the score falls within `hybrid_boundary_margin` of a tier boundary or no scorer signal fired, logged as `hybrid_short_circuit` - [PR #39403](https://github.com/BerriAI/litellm/pull/39403)
    - Add opt-in `modality_routing: true` in `complexity_router_config` so image requests route to the nearest tier holding a vision-capable model, then `default_model`, then a clear 400, instead of a provider rejection on a text-only tier; decisions record `cause: modality_escalation` - [PR #39032](https://github.com/BerriAI/litellm/pull/39032)
    - Add opt-in `modality_pin_override` so an image turn in a session pinned to a text-only model re-routes to a vision-capable model while the stored pin survives, so the next text turn returns to the original model - [PR #39454](https://github.com/BerriAI/litellm/pull/39454)
    - Let the LLM classifier see request images with opt-in `classifier_llm_config.vision` (`enabled`, `max_images`), forwarded only to a classifier declared `supports_vision`, so a hard screenshot with a trivial caption routes on its content and image-only turns are classified instead of landing on the fallback model - [PR #39825](https://github.com/BerriAI/litellm/pull/39825)
    - Set a classifier-only `reasoning_effort` on a complexity auto-router, with allowed values drawn from the classifier model group's capabilities and provider defaults kept when unset; Test Connection probes the classifier with the override before save - [PR #39372](https://github.com/BerriAI/litellm/pull/39372)
    - Auto-escalate a stalled agent task one tier when the request's own history shows repeated identical tool calls or repeated tool errors (`stall_escalation_enabled`, default 3 repeats over the last 6 tool calls), off by default and rejected together with `session_affinity`, `classification_mode: user_turn` and `tier_definitions` - [PR #39809](https://github.com/BerriAI/litellm/pull/39809)
    - Name a compression guardrail per hop on an auto router under Advanced: Compression, one for the routing decision and one for the model call (or none), so the classifier and the routed model can be compressed independently; the same guardrail on both hops runs compression once - [PR #39823](https://github.com/BerriAI/litellm/pull/39823)
    - Give the auto-router classifier one total timeout with no retries or fallbacks, let an explicit `num_retries: 0` beat a configured retry policy, and open a default-on circuit breaker after a classifier timeout so other sessions go straight to `classifier_fallback` for `circuit_breaker_cooldown_seconds` (default 30s) - [PR #39696](https://github.com/BerriAI/litellm/pull/39696), [PR #39701](https://github.com/BerriAI/litellm/pull/39701)
    - Fall back to a live peer in the same tier when the decided tier model's deployments are all cooled down, including for a pinned session, instead of returning 429 `No deployments available` until the pin expires; the routing record logs `cause: health_failover` and the displaced model - [PR #39675](https://github.com/BerriAI/litellm/pull/39675)
- **Shadow Eval**
    - Target teams and users (`team_ids`, `user_ids` on `POST /auto_router/shadow_eval/start`) beside keys, matched on the identity each request resolves to at auth time, so JWT-auth deployments without virtual keys can shadow eval their traffic; the dashboard start form gains Teams and Users pickers - [PR #39015](https://github.com/BerriAI/litellm/pull/39015)
    - Compare up to four auto-routers in one shadow eval job via `router_names`, running every arm on each sampled request and judging each blind against the same live response, with `results.by_router` win rates and spend and a per-router comparison table in the dashboard - [PR #39028](https://github.com/BerriAI/litellm/pull/39028)
    - Scope a forward shadow eval job to model groups with a `models` list ANDed with its key, team and user targets, matched on the requested model group or alias; an unknown name fails at start with 400, and the dashboard start form gains an Only on models picker - [PR #39828](https://github.com/BerriAI/litellm/pull/39828)
    - Judge tool-call turns instead of dropping or erroring on them: tool calls are serialized to text, the judge sees the tools available to both arms, and an empty reply reads distinctly with its `finish_reason` and model; sampled spend now matches `shadow_percentage` on agentic traffic - [PR #39818](https://github.com/BerriAI/litellm/pull/39818)
    - Raise the judge output cap from 1500 to 4096 tokens so a `judge_model` running at elevated reasoning effort stops returning empty or truncated verdicts (`unparseable judge verdict`), and record `finish_reason`, content length and served model on judge error rows - [PR #39817](https://github.com/BerriAI/litellm/pull/39817)
- **Routing**
    - Arm the `/v1/messages` safeguard-refusal fallback on a generic `fallbacks` chain when no `content_policy_fallbacks` list exists, so a dashboard-configured fallback row recovers a flagged request on the fallback model; a configured content-policy list stays authoritative and `disable_fallbacks` requests receive the refusal verbatim - [PR #39274](https://github.com/BerriAI/litellm/pull/39274)
    - Resolve `model_group_retry_policy` by walking the exception's class hierarchy and add `ServiceUnavailableErrorRetries` plus a `DefaultRetries` catch-all, so `InternalServerErrorRetries` is no longer ignored and 503, 502 and connection errors can be set to fail fast; both fields appear in the Admin UI retry settings - [PR #35853](https://github.com/BerriAI/litellm/pull/35853)
    - Keep an `order` fallback on the requested order level: a target order with no match stays empty, prompt-cache and deployment affinity do not pin while a target order is set, and each hop clears the previous target, so an `order: 2` Bedrock deployment serves when the `order: 1` Azure deployment returns 429 - [PR #38969](https://github.com/BerriAI/litellm/pull/38969)
    - Apply `optional_pre_call_checks` from `POST /config/update` as a live router setting, installing, deduplicating and uninstalling checks such as `prompt_caching` without a restart, and return 400 for keys that are not router settings instead of a false 200 - [PR #39249](https://github.com/BerriAI/litellm/pull/39249)
    - Count `tools` on Chat Completions, Responses and Anthropic Messages requests and the Anthropic top-level `system` block in the context-window pre-call check, so `enable_pre_call_checks` rejects oversized requests with `ContextWindowExceededError` before any provider call - [PR #39663](https://github.com/BerriAI/litellm/pull/39663)
    - Evict a wildcard deployment from the global pattern router on update or delete, matching the team pattern routers, so a corrected `openai/*` entry stops round-robining half of requests onto the stale pre-update deployment until pods restart - [PR #39664](https://github.com/BerriAI/litellm/pull/39664)
    - Hold a deployment's `max_parallel_requests` slot until a streaming response is exhausted or closed (`[DONE]`, `aclose()`, client disconnect, mid-stream fallback) instead of releasing it when the upstream stream opens, so the cap holds for streaming clients - [PR #39859](https://github.com/BerriAI/litellm/pull/39859)
    - Keep router retry breadcrumbs per request and out of the request snapshot, so repeated failing requests under `--detailed_debug` no longer get slower on every attempt and then hang the proxy - [PR #39491](https://github.com/BerriAI/litellm/pull/39491)
    - Map a `CancelledError` raised inside the aiohttp transport (a connector closing mid DNS lookup) to a retryable `httpx.ConnectError` when the request task itself was not cancelled, so router retries and error mapping apply instead of a bare 500 `No response returned` - [PR #39240](https://github.com/BerriAI/litellm/pull/39240)
    - Coordinate async and sync failure handlers at the five remaining router failure paths through `dispatch_failure_handlers`, running the sync callback on the logging executor after the async one finishes instead of on a concurrent raw thread, the suspected cause of reported exit 139 crashes - [PR #39887](https://github.com/BerriAI/litellm/pull/39887)
- **Session Affinity**
    - Route Claude Code subagents through the Auto Router their foreground session selected, read through Redis so every proxy worker follows the latest main-thread router, so subagent requests carrying a concrete model get a routing decision and savings instead of bypassing the router - [PR #39239](https://github.com/BerriAI/litellm/pull/39239)
    - Pin JWT-authenticated callers by user id in `deployment_affinity` when no key hash exists, in a namespace separate from key pins, so a JWT user sticks to one deployment for the affinity TTL like a virtual-key caller - [PR #39594](https://github.com/BerriAI/litellm/pull/39594)
    - Recognize opencode's bare `x-session-id` header as the session id for `session_affinity`, after the explicit `x-litellm-*` and vendor-scoped headers, so opencode turns group under one session and stay on one deployment - [PR #39802](https://github.com/BerriAI/litellm/pull/39802)
- **Caching**
    - Add `cache_params.semantic_cache_scope: end_user` so semantic cache hits are isolated per authenticated end user instead of shared across everyone on one virtual key, read from `metadata` and `litellm_metadata` on chat, Responses and Messages, and settable from `/cache/settings` and the Admin UI - [PR #39590](https://github.com/BerriAI/litellm/pull/39590)
    - Coerce `REDIS_*` env var and Helm `--set` strings (for example `REDIS_HEALTH_CHECK_INTERVAL`) to the types redis-py expects and discover Redis parameters through redis-py 6.x decorator wrappers, so env-configured Redis caching no longer fails every operation with a `TypeError` - [PR #30644](https://github.com/BerriAI/litellm/pull/30644)
    - Count Redis timeouts separately from hard connectivity failures so a short timeout burst against a healthy Redis no longer opens the circuit breaker; timeout-only streaks open it only after `REDIS_CIRCUIT_BREAKER_TIMEOUT_MIN_DURATION` (default 5s), and breaker state, transitions and failures are exported to Prometheus - [PR #38999](https://github.com/BerriAI/litellm/pull/38999)
    - Keep one Redis Cluster node's timeout from forcing a cluster-wide topology reinit on redis-py 8.x, so requests whose keys live on healthy nodes no longer wait behind the slow node and `litellm_redis_latency` max stays near p99 - [PR #39349](https://github.com/BerriAI/litellm/pull/39349)
    - Read sync cache batches (routing cooldown state) through the blocking Redis client instead of reusing async clients across event loops, keep circuit-breaker protection on those reads, and count swallowed failures in `litellm_redis_failed_requests_total` - [PR #39358](https://github.com/BerriAI/litellm/pull/39358)
- **Proxy runtime**
    - Add per-worker admission control: set `general_settings.max_in_flight_requests_per_worker` (plus `max_queued_requests_per_worker` and `admission_queue_timeout_seconds`) to reject excess requests with an immediate `503 overloaded_error` and `retry-after: 1`, with probe paths bypassing the gate and new `litellm_admission_*` metrics and `/health/backlog` fields - [PR #39352](https://github.com/BerriAI/litellm/pull/39352)
    - Build a coordination Redis from `REDIS_HOST`/`REDIS_PORT` env vars at boot when no `coordination_redis` block or `litellm_settings.cache` sets one, so multi-replica budget enforcement and `/key/{key}/reset_spend` take effect across pods without extra config - [PR #39410](https://github.com/BerriAI/litellm/pull/39410)
    - Emit `: ping` SSE keepalives on `/queue/chat/completions`, `/v1/rag/query`, the Azure router-model passthrough, `/usage/ai/chat` and `/policy/templates/enrich/stream` when `sse_keepalive_ping_interval_seconds` is set, so idle-timeout hops such as ALB or nginx no longer drop the connection before the first token - [PR #39273](https://github.com/BerriAI/litellm/pull/39273)
    - Keep the wildcard model registry sorted at registration and reuse the failure log payload, so a burst of invalid-model 403 rejections costs roughly 8 to 15% less CPU per rejection and valid traffic waits less - [PR #39892](https://github.com/BerriAI/litellm/pull/39892)
    - Honor `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY` when `force_ipv4: true` runs on the httpx transport (`DISABLE_AIOHTTP_TRANSPORT=true`), so egress no longer bypasses the proxy on `AsyncHTTPHandler`, `HTTPHandler` and the OpenAI async client - [PR #39443](https://github.com/BerriAI/litellm/pull/39443)
- **Database**
    - Keep the v1 migration resolver as the proxy default: #31125 switched the default to v2 and #39178 reverted it after two replicas booting against one database deadlocked in `prisma migrate deploy`; v2 stays opt-in via `--use_v2_migration_resolver` or `USE_V2_MIGRATION_RESOLVER=true` - [PR #31125](https://github.com/BerriAI/litellm/pull/31125), [PR #39178](https://github.com/BerriAI/litellm/pull/39178)
    - Recover the v2 migration resolver from concurrent `prisma migrate deploy` deadlocks: the loser rolls back and retries, the survivor retries on `P3009` or a `P1002` advisory-lock timeout, and no deadlocked migration is marked applied, so two replicas booting together no longer need manual repair - [PR #39187](https://github.com/BerriAI/litellm/pull/39187)
    - Give `prisma migrate deploy` its own `LITELLM_PRISMA_MIGRATE_DEPLOY_TIMEOUT` budget (default 600s) instead of the 60s per-command `LITELLM_PRISMA_COMMAND_TIMEOUT`, so a fresh database replaying all migrations no longer fails boot with "Database migration failed after 4 attempts" - [PR #39365](https://github.com/BerriAI/litellm/pull/39365)
    - Kill the whole Prisma process group (wrapper, Node and schema engine) when a command times out, so an orphaned schema engine no longer holds the migration advisory lock and blocks every later boot - [PR #39466](https://github.com/BerriAI/litellm/pull/39466)
    - Spend a migrate-deploy attempt only when a pass made no progress, so a database first created with `--use_prisma_db_push` can boot under `--use_v2_migration_resolver` instead of exhausting its four attempts on idempotent-error recoveries - [PR #39506](https://github.com/BerriAI/litellm/pull/39506)
    - Default `max_idle_connection_lifetime=60` on `DATABASE_URL`, `DIRECT_URL` and the read replica, tunable via `database_max_idle_connection_lifetime`, so RDS or NLB idle reaping no longer surfaces as `Error { kind: Closed }` and hung requests after quiet periods - [PR #39134](https://github.com/BerriAI/litellm/pull/39134)
    - Translate libpq `sslmode=verify-ca`/`verify-full` and `sslrootcert=<pem>` into Prisma's `sslmode=require&sslaccept=strict` and `sslcert` on every DB URL, so a mounted CA bundle is actually verified (chain and hostname) instead of silently downgraded to `prefer` - [PR #39563](https://github.com/BerriAI/litellm/pull/39563)
- **Error handling**
    - Redact credentials, filesystem paths, internal hostnames and embedded tracebacks from unclassified exception messages at the proxy response boundary (the full exception still goes to server logs under `x-litellm-call-id`), and stop sending the `Server: uvicorn` header - [PR #39380](https://github.com/BerriAI/litellm/pull/39380)
    - Word database 503s by whether the fault is transient: a permanent Prisma engine fault now says the deployment needs attention instead of "temporarily unreachable, retry shortly", on auth, MCP admission, bridge and DCR flows, with the 503 status unchanged - [PR #39256](https://github.com/BerriAI/litellm/pull/39256)
    - Stop serializing the literal string `"None"` as `type` and `param` in error payloads on `/v1/chat/completions`, `/v1/responses` and `/v1/messages`; `type` falls back to the status code's error type (for example `invalid_request_error`) and `param` becomes JSON `null` - [PR #39521](https://github.com/BerriAI/litellm/pull/39521)
- **Headroom compression**
    - Hold retrieved `headroom_retrieve` (and `mcp__<server>__headroom_retrieve`) tool results back from the compression service, so clients running their own tool loop no longer get the retrieved body re-stubbed to the same `<<ccr:HASH>>` and loop on it - [PR #38591](https://github.com/BerriAI/litellm/pull/38591)
    - Bound the Headroom `/v1/compress` and `/v1/retrieve` calls with a 60s default timeout and honor `timeout` in the guardrail's `litellm_params`, so a stalled compression service fails in a minute instead of hanging requests for about ten - [PR #39527](https://github.com/BerriAI/litellm/pull/39527)
- **Python bridge and Rust**
    - Rename the Rust rollout API to a single boolean `litellm.rust(True)` before its first release, and make both `LITELLM_RUST` and the legacy OCR env flag enable every eligible Rust route - [PR #39704](https://github.com/BerriAI/litellm/pull/39704)
    - Unify Rust opt-in and bridge policy in one place: unrecognized or empty `LITELLM_RUST` and legacy OCR values disable Rust instead of raising during routing, while explicit request and process overrides keep priority - [PR #39334](https://github.com/BerriAI/litellm/pull/39334)
    - Enable ABI3 in the bridge's default Cargo features and put strip and panic policy in the release profile, so release builds produce one `cp310-abi3` wheel per platform without a manifest rewrite and the PyPI release stays near 200 MB instead of 900 MB - [PR #39020](https://github.com/BerriAI/litellm/pull/39020)
    - Harden the bridge's sync and async execution boundaries with shared helpers for GIL release, nested-runtime rejection, signal polling, cancellation and panic mapping - [PR #39332](https://github.com/BerriAI/litellm/pull/39332)
    - Split the bridge's `lib.rs` into error, marshaling, diagnostics and route modules with shared function tracing, declare sync and async route pairs once through a macro, and make `Error` the sole public core error type - [PR #39031](https://github.com/BerriAI/litellm/pull/39031), [PR #39333](https://github.com/BerriAI/litellm/pull/39333), [PR #39331](https://github.com/BerriAI/litellm/pull/39331)
    - Extract a `litellm-config` crate as the gateway's config-loading boundary, and remove the low-signal GIL counter and `/health/gil` route - [PR #39706](https://github.com/BerriAI/litellm/pull/39706)
    - Restructure the Rust/Python test harness around Python-owned strategy definitions with trace-derived unit-test mapping, and add Rust OCR response metadata, optional parameter and multipart upload plumbing - [PR #39628](https://github.com/BerriAI/litellm/pull/39628)
- **SDK**
    - Restore Python 3.10 and 3.14 compatibility (typing imports via `typing_extensions`, reasoning-summary Pydantic validation, recursive Prisma types, uvloop on 3.14, aware UTC timestamps) and run the unit-test shards on 3.10 through 3.14 - [PR #39399](https://github.com/BerriAI/litellm/pull/39399)
    - Keep `import litellm` working on Python 3.10 by moving the remaining 3.11-only `typing` imports (`NotRequired`, `assert_never`, `Never`, `Required`) to `typing_extensions`, with an AST check and a 3.10 import job in CI - [PR #39448](https://github.com/BerriAI/litellm/pull/39448)
    - Keep `import litellm` eager: #39121 lazy-loaded SDK symbols to cut import RSS from about 225 MB to 55 MB, and #39969 reverted it after circular imports in `litellm.cost_calculator` and a broken Interactions API bridge, so there is no net change this release - [PR #39121](https://github.com/BerriAI/litellm/pull/39121), [PR #39969](https://github.com/BerriAI/litellm/pull/39969)
    - Pin one response `id` across every streamed chunk for providers that send no upstream id (such as GigaChat), so clients that merge deltas by chunk id, goose for example, render one message instead of many - [PR #38106](https://github.com/BerriAI/litellm/pull/38106)
- **Dependencies**
    - Raise the tornado floor to 6.5.8 and the `proxy-runtime` pypdf floor to 6.16.1 to clear six new OSV advisories; environments pinning pypdf below 6.16.1 stop resolving - [PR #39188](https://github.com/BerriAI/litellm/pull/39188)
- **General**
    - Keep `PrismaDBExceptionHandler` predicates from raising `TypeError` when tests mock the `prisma` module; production behavior with real prisma is unchanged - [PR #39253](https://github.com/BerriAI/litellm/pull/39253)

## Documentation Updates

Documentation now lives in [BerriAI/litellm-docs](https://github.com/BerriAI/litellm-docs), so doc changes in this window are counted there rather than in this repository's PR set. One docstring-only change landed in the proxy: the `spend` field on `/v2/user/info` and `/user/daily/activity` is now documented as the user's own spend ([PR #38883](https://github.com/BerriAI/litellm/pull/38883)).

### PR roll-up by ownership area

PRs by ownership area (total: 458)

- Other (CI / chore / tests / build / version bumps): 87
- Performance: 72
- LLM API Endpoints: 55
- Auth & Management: 55
- Models & Providers: 39
- UI: 36
- Spend / Budgets / Rate Limits: 33
- Logging: 29
- Guardrails: 26
- MCP: 24
- Prompt Management: 1
- Docs: 1

## End-to-End Testing

We are investing heavily in end-to-end testing to cut regressions and make LiteLLM more stable release over release. Every version is exercised by a live suite that runs against a real deployed proxy and hits real provider endpoints, not mocks, so the behavior we validate is the behavior you get in production.

This window added 58 test-only pull requests, 25 of them touching the live e2e suite. The Admin UI Playwright suite grew the most: eight manual QA checklist flows are now automated, and SCIM token creation and auth, the Budgets page, guardrail create, test and delete, the Logs filter drawer, the team Settings tab, and the Usage activity tabs all have browser coverage, with seeded passwords, credential polling, and page-size selection repaired so multi-instance runs stop failing on things that are not regressions. On the proxy side the shared e2e cells now cover Anthropic `/chat/completions` streaming and tool calls, prompt caching on Anthropic, OpenAI, and Vertex, Cohere embeddings, costed `/openai` passthrough, Bedrock batch cancel and list, retry-on-timeout and context-window fallbacks, key spend reset and the regenerate grace period, and Presidio, tool-permission, and Weave logging, while the `/v1/messages` streaming and background-cancel cases are judged on the clock so an upstream stall skips fast instead of failing the run. A new interactive harness runs the existing e2e SDK tests against both the Python and Rust gateways, with OCR parity carried through migration strategy runners, recorded provider fixtures, and a python-to-rust parity ledger. Test quality also moved: CLAUDE.md now requires tests to assert behavior rather than code structure, and the dashboard and e2e suites were swept to query the screen, pick options by role, and read the preset catalog at runtime. CI reports every failing test in a job instead of stopping at the first, records each e2e test's source location in the JUnit report, and the unit shards run on Python 3.10 through 3.14. The full list of test and CI pull requests is at the bottom of these notes.

## New Contributors

- @cat0825 made their first contribution in [PR #34696](https://github.com/BerriAI/litellm/pull/34696)
- @eeshsaxena made their first contribution in [PR #36260](https://github.com/BerriAI/litellm/pull/36260)
- @koladefaj made their first contribution in [PR #30644](https://github.com/BerriAI/litellm/pull/30644)
- @jliounis made their first contribution in [PR #37883](https://github.com/BerriAI/litellm/pull/37883)
- @Timik232 made their first contribution in [PR #38106](https://github.com/BerriAI/litellm/pull/38106)
- @georgeatparallel made their first contribution in [PR #38113](https://github.com/BerriAI/litellm/pull/38113)
- @yatishgoel made their first contribution in [PR #38479](https://github.com/BerriAI/litellm/pull/38479)
- @QuantumBreakz made their first contribution in [PR #38591](https://github.com/BerriAI/litellm/pull/38591)
- @Lee-Si-Yoon made their first contribution in [PR #38880](https://github.com/BerriAI/litellm/pull/38880)
- @seanyasno-af made their first contribution in [PR #38898](https://github.com/BerriAI/litellm/pull/38898)
- @samtsai15 made their first contribution in [PR #38940](https://github.com/BerriAI/litellm/pull/38940)
- @rakeshrepository made their first contribution in [PR #39561](https://github.com/BerriAI/litellm/pull/39561)
- @amasen02 made their first contribution in [PR #39729](https://github.com/BerriAI/litellm/pull/39729)

## CI, Tests and Internal Housekeeping

These pull requests are not customer facing. They are listed here so the counts above reconcile against the full changelog, and are counted under Other in the roll-up.

- **Admin UI end-to-end coverage** - The Playwright suite automates eight manual QA checklist flows and adds coverage for SCIM token creation and auth, the Budgets page, guardrail create, test and delete, the Logs filter drawer, the team Settings tab and the Usage activity tabs, with seeded passwords, credential polling, a search placeholder and table page sizes repaired so multi-instance runs stop failing on non-regressions - [PR #39025](https://github.com/BerriAI/litellm/pull/39025), [PR #39027](https://github.com/BerriAI/litellm/pull/39027), [PR #39052](https://github.com/BerriAI/litellm/pull/39052), [PR #39053](https://github.com/BerriAI/litellm/pull/39053), [PR #39056](https://github.com/BerriAI/litellm/pull/39056), [PR #39058](https://github.com/BerriAI/litellm/pull/39058), [PR #39061](https://github.com/BerriAI/litellm/pull/39061), [PR #39063](https://github.com/BerriAI/litellm/pull/39063), [PR #39073](https://github.com/BerriAI/litellm/pull/39073), [PR #39442](https://github.com/BerriAI/litellm/pull/39442), [PR #39678](https://github.com/BerriAI/litellm/pull/39678), [PR #39934](https://github.com/BerriAI/litellm/pull/39934)
- **Proxy end-to-end coverage** - New shared-proxy e2e cells cover Anthropic `/chat/completions` streaming and tool calls, prompt caching on Anthropic, OpenAI and Vertex, Cohere embeddings, costed `/openai` passthrough, Bedrock batch cancel and list, retry-on-timeout and context-window fallbacks, key spend reset and regenerate grace periods, and Presidio, tool-permission and Weave logging, while `/v1/messages` streaming and background cancel are now judged on the clock so an upstream stall skips fast - [PR #39055](https://github.com/BerriAI/litellm/pull/39055), [PR #39197](https://github.com/BerriAI/litellm/pull/39197), [PR #39279](https://github.com/BerriAI/litellm/pull/39279), [PR #39617](https://github.com/BerriAI/litellm/pull/39617), [PR #39804](https://github.com/BerriAI/litellm/pull/39804), [PR #39847](https://github.com/BerriAI/litellm/pull/39847), [PR #39916](https://github.com/BerriAI/litellm/pull/39916), [PR #39917](https://github.com/BerriAI/litellm/pull/39917), [PR #39920](https://github.com/BerriAI/litellm/pull/39920), [PR #39938](https://github.com/BerriAI/litellm/pull/39938), [PR #39946](https://github.com/BerriAI/litellm/pull/39946), [PR #39953](https://github.com/BerriAI/litellm/pull/39953)
- **Behavior-first test assertions** - CLAUDE.md now requires tests to check behavior rather than code structure, and the dashboard and e2e suites were swept to query the screen, pick select options by role, assert DataTable behavior instead of DOM shape, and read the preset catalog at runtime - [PR #38772](https://github.com/BerriAI/litellm/pull/38772), [PR #39016](https://github.com/BerriAI/litellm/pull/39016), [PR #39082](https://github.com/BerriAI/litellm/pull/39082), [PR #39084](https://github.com/BerriAI/litellm/pull/39084), [PR #39085](https://github.com/BerriAI/litellm/pull/39085), [PR #39175](https://github.com/BerriAI/litellm/pull/39175), [PR #39478](https://github.com/BerriAI/litellm/pull/39478)
- **Rust and Python parity harness** - An interactive harness now runs the existing e2e SDK tests against both the Python and Rust gateways, with OCR parity built out through migration strategy runners, recorded provider fixtures, Mistral transformation coverage, a python-to-rust parity ledger, full Rust unit test parity and a written harness structure - [PR #38765](https://github.com/BerriAI/litellm/pull/38765), [PR #39419](https://github.com/BerriAI/litellm/pull/39419), [PR #39425](https://github.com/BerriAI/litellm/pull/39425), [PR #39434](https://github.com/BerriAI/litellm/pull/39434), [PR #39456](https://github.com/BerriAI/litellm/pull/39456), [PR #39463](https://github.com/BerriAI/litellm/pull/39463), [PR #39482](https://github.com/BerriAI/litellm/pull/39482), [PR #39689](https://github.com/BerriAI/litellm/pull/39689)
- **Typing and tech debt sweeps** - About 7,000 basedpyright `Any` errors were cleared across roughly 370 backend files with the ceilings ratcheted down, the fresh-debt windows from August 29 through September 4 were cleared, the dead `get_api_key` provider-key resolver was removed, and the dashboard's inline-object lint budget is back under its ceiling - [PR #36722](https://github.com/BerriAI/litellm/pull/36722), [PR #37778](https://github.com/BerriAI/litellm/pull/37778), [PR #38796](https://github.com/BerriAI/litellm/pull/38796), [PR #39104](https://github.com/BerriAI/litellm/pull/39104), [PR #39461](https://github.com/BerriAI/litellm/pull/39461), [PR #38884](https://github.com/BerriAI/litellm/pull/38884), [PR #39091](https://github.com/BerriAI/litellm/pull/39091), [PR #39518](https://github.com/BerriAI/litellm/pull/39518), [PR #39260](https://github.com/BerriAI/litellm/pull/39260), [PR #39856](https://github.com/BerriAI/litellm/pull/39856)
- **CI infrastructure** - CI now reports every failing test in a job instead of stopping at the first, records each e2e test's source location in the JUnit report, builds and tests the Rust ai-gateway server feature, runs the UI build check through the image's ui-builder stage, pins setup-uv to v10.0.1, grants the release wheel reporter `pull_requests` write, and closes duplicate issues after a three-day grace period - [PR #39772](https://github.com/BerriAI/litellm/pull/39772), [PR #39209](https://github.com/BerriAI/litellm/pull/39209), [PR #39246](https://github.com/BerriAI/litellm/pull/39246), [PR #39493](https://github.com/BerriAI/litellm/pull/39493), [PR #39496](https://github.com/BerriAI/litellm/pull/39496), [PR #39111](https://github.com/BerriAI/litellm/pull/39111), [PR #39922](https://github.com/BerriAI/litellm/pull/39922), [PR #38381](https://github.com/BerriAI/litellm/pull/38381)
- **Dependency and version bumps** - litellm moves to 1.101.0 with litellm-enterprise 0.1.62 -> 0.1.65 and litellm-proxy-extras 0.4.91 -> 0.4.94 across three bumps, browserslist goes to 4.28.8 to clear osv-scan, and the Admin UI bundle was rebuilt for the release - [PR #39140](https://github.com/BerriAI/litellm/pull/39140), [PR #39595](https://github.com/BerriAI/litellm/pull/39595), [PR #39912](https://github.com/BerriAI/litellm/pull/39912), [PR #39142](https://github.com/BerriAI/litellm/pull/39142), [PR #39959](https://github.com/BerriAI/litellm/pull/39959)
- **Test repairs and deflakes** - Chronically failing and flaky unit tests were repaired or deflaked (JWT tamper, fuzzy picker, tag routing, liveliness, redis stall burst, MCP registry, team race, timeout and migrate-deploy harness among them), fakes were updated for the Bedrock KB `router` and `embedding_executor` kwargs, OpenAI's 404 for an unknown model and CrowdStrike's deduped end-of-stream scan, a leaked module-global guardrail mapping and an EOL Cohere model were removed, and `NO_DOCS`/`NO_REDOC`/`NO_OPENAPI`, router configured-mode lookup, New Relic per-team routing and the unknown-model spend log 400 got coverage - [PR #39770](https://github.com/BerriAI/litellm/pull/39770), [PR #39932](https://github.com/BerriAI/litellm/pull/39932), [PR #38891](https://github.com/BerriAI/litellm/pull/38891), [PR #39306](https://github.com/BerriAI/litellm/pull/39306), [PR #39611](https://github.com/BerriAI/litellm/pull/39611), [PR #39583](https://github.com/BerriAI/litellm/pull/39583), [PR #39773](https://github.com/BerriAI/litellm/pull/39773), [PR #39669](https://github.com/BerriAI/litellm/pull/39669), [PR #39673](https://github.com/BerriAI/litellm/pull/39673), [PR #39185](https://github.com/BerriAI/litellm/pull/39185), [PR #38863](https://github.com/BerriAI/litellm/pull/38863), [PR #39074](https://github.com/BerriAI/litellm/pull/39074), [PR #39420](https://github.com/BerriAI/litellm/pull/39420), [PR #39472](https://github.com/BerriAI/litellm/pull/39472), [PR #39502](https://github.com/BerriAI/litellm/pull/39502), [PR #39457](https://github.com/BerriAI/litellm/pull/39457), [PR #39467](https://github.com/BerriAI/litellm/pull/39467), [PR #39543](https://github.com/BerriAI/litellm/pull/39543), [PR #39608](https://github.com/BerriAI/litellm/pull/39608), [PR #39378](https://github.com/BerriAI/litellm/pull/39378), [PR #39630](https://github.com/BerriAI/litellm/pull/39630), [PR #39634](https://github.com/BerriAI/litellm/pull/39634), [PR #39659](https://github.com/BerriAI/litellm/pull/39659), [PR #38857](https://github.com/BerriAI/litellm/pull/38857), [PR #39842](https://github.com/BerriAI/litellm/pull/39842)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.100.0-rc.1...v1.101.0-rc.1
