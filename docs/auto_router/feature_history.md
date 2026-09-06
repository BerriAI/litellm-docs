---
title: Auto Router Feature History
sidebar_label: Auto Router Feature History
description: Which Auto Router features shipped in which LiteLLM release, so you know what to expect when you upgrade.
---

Every stable release links to its GitHub release and full release notes. Newest first. A feature listed under a version is available from that version onward.

## Coming in Next Release

Merged after the v1.100.0 release candidate was cut. Available in `v1.101.0-dev` builds now; the stable link will be added when it ships.

- **Heuristic v2 classifier.** `classifier_type: trained_heuristic`, pretrained, no LLM call on the request path. 27% more Terminal-Bench tasks solved at 45% lower cost per task than v1. [#39276](https://github.com/BerriAI/litellm/pull/39276), [#39423](https://github.com/BerriAI/litellm/pull/39423). [Post](/blog/heuristic-v2).
- **Context-window escalation.** Oversized prompts move to the cheapest tier that fits before dispatch. On by default, `context_window_escalation_buffer: 0.95`. [#38844](https://github.com/BerriAI/litellm/pull/38844), UI [#39054](https://github.com/BerriAI/litellm/pull/39054).
- **Modality routing.** Opt-in `modality_routing: true` sends image requests to a tier that can see them. [#39032](https://github.com/BerriAI/litellm/pull/39032), UI [#39059](https://github.com/BerriAI/litellm/pull/39059).
- **User-turn classification.** `classification_mode: user_turn` classifies new user asks only and carries the decision through continuation turns. [#38861](https://github.com/BerriAI/litellm/pull/38861).
- **Shadow evals on teams and users.** Target a `key`, `team`, or `user`, so JWT-authenticated traffic can be evaluated. [#39015](https://github.com/BerriAI/litellm/pull/39015).
- **Shadow evals across several routers.** Compare multiple router configs on one job's sampled traffic, paired. [#39028](https://github.com/BerriAI/litellm/pull/39028).
- **1M context preset.** [#39490](https://github.com/BerriAI/litellm/pull/39490).
- **Mid-task stall escalation.** `stall_escalation_enabled: true` reads the assistant's own recent tool calls and bumps a request one tier when it's stuck in a retry loop, the same ladder `escalation_keywords` uses. Off by default. [#39809](https://github.com/BerriAI/litellm/pull/39809). [Post](/blog/auto-router-stall-escalation).
- **One-click Auto Router setup.** Configure automatically checks the chat model groups your proxy already serves and fills all four tiers, mixing providers when needed, without picking a template first. [#39693](https://github.com/BerriAI/litellm/pull/39693).
- **Per-hop compression.** `auto_router_routing_compression` and `auto_router_model_compression` name a compression guardrail for the routing decision and for the model call separately, or `none` for either hop. Naming the same guardrail on both compresses once. [#39823](https://github.com/BerriAI/litellm/pull/39823).

Posts: [Route on Context Size and Modality](/blog/auto-router-more-routing-configurations), [Mid-Task Stall Escalation](/blog/auto-router-stall-escalation).

## v1.100.0

[GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.100.0), [Release notes](/release_notes/v1.100.0/v1-100-0)

- **Custom tier sets.** Define your own tiers for the LLM classifier, preview the exact classifier prompt, keyword rules follow renames. [#38602](https://github.com/BerriAI/litellm/pull/38602), [#38603](https://github.com/BerriAI/litellm/pull/38603), [#38605](https://github.com/BerriAI/litellm/pull/38605).
- **Heuristic-first chaining.** `classifier_type: heuristic_first` scores locally and calls the LLM classifier only when needed. [#38428](https://github.com/BerriAI/litellm/pull/38428).
- **Classifier context budget.** A character budget across turns replaces the per-turn 200-character clip. [#38141](https://github.com/BerriAI/litellm/pull/38141), [#38145](https://github.com/BerriAI/litellm/pull/38145).
- **Housekeeping prompts skip the classifier.** Client housekeeping messages go to the cheapest tier with no classifier call. [#38598](https://github.com/BerriAI/litellm/pull/38598).
- **Gemini Family preset; per-tier reasoning effort in the Lite and Anthropic presets.** [#38138](https://github.com/BerriAI/litellm/pull/38138), [#38482](https://github.com/BerriAI/litellm/pull/38482), [#38490](https://github.com/BerriAI/litellm/pull/38490).
- **Dry-run validation before save.** The UI validates a config against `/auto_router/validate_complexity_router_config`; `/auto_router/test_routing` accepts a real request body. [#38595](https://github.com/BerriAI/litellm/pull/38595).
- **Tier-pinned reasoning effort wins.** A tier's `reasoning_effort` supersedes client carriers; unsupported tier params are dropped instead of failing the tier. [#38622](https://github.com/BerriAI/litellm/pull/38622), [#38698](https://github.com/BerriAI/litellm/pull/38698).
- **Classifier cost counted.** Savings figures, benchmarks, and shadow evals net out the router's own classifier charge. [#38835](https://github.com/BerriAI/litellm/pull/38835), [#38631](https://github.com/BerriAI/litellm/pull/38631).
- **Router health from its models.** A router is flagged when a tier, default, or classifier model cannot serve. [#37966](https://github.com/BerriAI/litellm/pull/37966), [#38174](https://github.com/BerriAI/litellm/pull/38174).
- **`model_group_alias` works for auto-routers.** [#38272](https://github.com/BerriAI/litellm/pull/38272), [#38382](https://github.com/BerriAI/litellm/pull/38382).
- **Breaking.** Settings placed outside `complexity_router_config` are rejected ([#38570](https://github.com/BerriAI/litellm/pull/38570)). `router_model_name` is gone, use `return_raw_model_name` ([#38429](https://github.com/BerriAI/litellm/pull/38429)). `autorouter_savings_baseline_model` is deleted; each router derives its baseline from its hardest tier ([#38700](https://github.com/BerriAI/litellm/pull/38700)).

## v1.99.0

[GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.99.0), [Release notes](/release_notes/v1.99.0/v1-99-0)

- **Operator-defined tier sets** for the LLM classifier. [#37226](https://github.com/BerriAI/litellm/pull/37226).
- **Custom classifier plugins.** `classifier_type: custom` with a dotted path to your own `classify()`. [#37249](https://github.com/BerriAI/litellm/pull/37249).
- **Plan-mode tier floor** for coding-agent clients. [#37230](https://github.com/BerriAI/litellm/pull/37230).
- **Per-tier `litellm_params`** and per-model reasoning effort in the tier editor. [#37064](https://github.com/BerriAI/litellm/pull/37064), [#37673](https://github.com/BerriAI/litellm/pull/37673).
- **Business classification rubric** preset. [#37534](https://github.com/BerriAI/litellm/pull/37534).
- **Lite preset** (mixed provider) and heuristic scorer settings in the UI. [#37068](https://github.com/BerriAI/litellm/pull/37068), [#37216](https://github.com/BerriAI/litellm/pull/37216).
- **Shadow evals: several keys per job, budget in dollars.** `api_key_ids` replaces `api_key_id`, `max_budget` replaces `max_turns` (breaking). [#37251](https://github.com/BerriAI/litellm/pull/37251), [#37555](https://github.com/BerriAI/litellm/pull/37555).
- **Responses API** input routed through the auto-router. [#37333](https://github.com/BerriAI/litellm/pull/37333).
- **Savings to callbacks and per key.** Per-request savings reach logging callbacks; a Savings tab on the key page. [#37894](https://github.com/BerriAI/litellm/pull/37894), [#37693](https://github.com/BerriAI/litellm/pull/37693).

## v1.98.0

[GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.98.0), [Release notes](/release_notes/v1.98.0/v1-98-0)

- **Shadow evaluations.** Sample one key's live traffic, replay it through the router without serving the response, blind LLM judge, reverse mode, `/v1/messages` and `/v1/responses`. [#36587](https://github.com/BerriAI/litellm/pull/36587), [#36830](https://github.com/BerriAI/litellm/pull/36830), [#36865](https://github.com/BerriAI/litellm/pull/36865). UI [#36588](https://github.com/BerriAI/litellm/pull/36588), [#36994](https://github.com/BerriAI/litellm/pull/36994). [Post](/blog/auto-router-shadow-evaluations).
- **Calibrated classifier rubric** with worked examples, selectable per router; system prompt text no longer scored. [#36578](https://github.com/BerriAI/litellm/pull/36578), [#36721](https://github.com/BerriAI/litellm/pull/36721).
- **Deployment affinity toggle** in the UI; models shown under each tier in the benchmark chart. [#36302](https://github.com/BerriAI/litellm/pull/36302), [#36291](https://github.com/BerriAI/litellm/pull/36291).
- **Tag routing gates.** Required-AND tag prefix, `allow_fail_open`, untagged requests bypass a tagged pre-routing strategy. [#36193](https://github.com/BerriAI/litellm/pull/36193), [#36627](https://github.com/BerriAI/litellm/pull/36627), [#36628](https://github.com/BerriAI/litellm/pull/36628).

## v1.97.0

[GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.97.0), [Release notes](/release_notes/v1.97.0/v1-97-0)

- **Deployment affinity on by default** (breaking). A session returning to a model group lands on the deployment it used before, so the provider cache stays warm. `deployment_affinity: false` restores the old behavior. [#36146](https://github.com/BerriAI/litellm/pull/36146).
- **Session affinity off by default**, exposed in the UI. [#35714](https://github.com/BerriAI/litellm/pull/35714).
- **Savings and usage tab.** Net auto-router savings on Cost Optimization, baseline derived from the hardest tier, per-session rollup, turns per tier. [#35522](https://github.com/BerriAI/litellm/pull/35522), [#35995](https://github.com/BerriAI/litellm/pull/35995), [#35521](https://github.com/BerriAI/litellm/pull/35521), [#35907](https://github.com/BerriAI/litellm/pull/35907), [#35910](https://github.com/BerriAI/litellm/pull/35910), [#36209](https://github.com/BerriAI/litellm/pull/36209). [Post](/blog/auto-router-spend-visibility).
- **Classifier cost per request** in `routing_decision` and the `x-litellm-classifier-cost` header. [#36015](https://github.com/BerriAI/litellm/pull/36015).
- **1-click presets and Test Routing.** Add Auto Router is name plus template; Test Routing shows the pick before saving; presets match deployments by underlying model ID. [#35746](https://github.com/BerriAI/litellm/pull/35746), [#35859](https://github.com/BerriAI/litellm/pull/35859), [#35972](https://github.com/BerriAI/litellm/pull/35972), [#36111](https://github.com/BerriAI/litellm/pull/36111). [Post](/blog/auto-router-setup-and-testing).
- **Replaceable classifier prompt and tier names.** [#35855](https://github.com/BerriAI/litellm/pull/35855), [#35893](https://github.com/BerriAI/litellm/pull/35893).

## v1.96.0

[GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.96.0), [Release notes](/release_notes/v1.96.0/v1-96-0)

- **Classifier context window.** The LLM classifier sees prior turns (`classifier_context_window_size`, default 3). [#35185](https://github.com/BerriAI/litellm/pull/35185). [Post](/blog/auto-router-context-and-benchmarks).
- **Assistant turns** optionally included (`classifier_context_include_assistant_turns`). [#35471](https://github.com/BerriAI/litellm/pull/35471).
- **Routing decision recorded.** Tier, cause, and classifier request body in spend logs and the log drawer; the router's own classifier calls are marked. [#35016](https://github.com/BerriAI/litellm/pull/35016), [#35164](https://github.com/BerriAI/litellm/pull/35164), [#35300](https://github.com/BerriAI/litellm/pull/35300), [#35304](https://github.com/BerriAI/litellm/pull/35304).
- **Auto-routers get their own tab** in Models + Endpoints, with the context window fields. [#35009](https://github.com/BerriAI/litellm/pull/35009), [#35315](https://github.com/BerriAI/litellm/pull/35315), [#35500](https://github.com/BerriAI/litellm/pull/35500).

## v1.95.0

[GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.95.0), [Release notes](/release_notes/v1.95.0/v1-95-0)

- **`return_raw_model_name`.** Put the picked model in the response body `model` field instead of the alias. [#33875](https://github.com/BerriAI/litellm/pull/33875).
- **Logs show the router.** The log drawer and session sidebar mark requests an auto-router served. [#34434](https://github.com/BerriAI/litellm/pull/34434).

## v1.94.0

[GitHub release](https://github.com/BerriAI/litellm/releases/tag/v1.94.0), [Release notes](/release_notes/v1.94.0/v1-94-0)

- **Auto Router v2.** Complexity, semantic, and adaptive routing in one `auto_router/complexity_router`. [Post](/blog/autorouter-v2).
- **Router plugins.** `Router(plugins=[...])`, resolvable from proxy config. [#32972](https://github.com/BerriAI/litellm/pull/32972), [#33251](https://github.com/BerriAI/litellm/pull/33251), [#33644](https://github.com/BerriAI/litellm/pull/33644). [Post](/blog/router-plugins-on-the-proxy).
- **Tier pools.** Soft-floor adaptive mode and random-pick multi-model tiers. [#32947](https://github.com/BerriAI/litellm/pull/32947), [#32967](https://github.com/BerriAI/litellm/pull/32967).
- **Session affinity.** Pin a session to its first-turn model. [#33126](https://github.com/BerriAI/litellm/pull/33126), [#33500](https://github.com/BerriAI/litellm/pull/33500), [#33723](https://github.com/BerriAI/litellm/pull/33723).
- **Escalation keywords** and per-tier semantic keyword prompts. [#33656](https://github.com/BerriAI/litellm/pull/33656), [#33508](https://github.com/BerriAI/litellm/pull/33508).
- **Cost Optimization page (beta)** with an Autorouter tab. [#33899](https://github.com/BerriAI/litellm/pull/33899).
- **Test Connection** for the auto router. [#32950](https://github.com/BerriAI/litellm/pull/32950), [#33146](https://github.com/BerriAI/litellm/pull/33146).
