---
title: Auto Router Feature History
sidebar_label: Auto Router Feature History
description: Which Auto Router features shipped in which LiteLLM release, so you know what to expect when you upgrade.
---

Every release links to its GitHub release and full release notes. Newest first. A feature listed under a version is available from that version onward.

## Coming in Next Release

Merged after the v1.101.0 release candidate was cut. These changes are in `v1.102.0-dev` builds.

- **Harness-aware classification.** Omit Claude Code system text and strip Codex reminder envelopes from classification while preserving delegated tasks and the original routed request. [#40655](https://github.com/BerriAI/litellm/pull/40655), [#40599](https://github.com/BerriAI/litellm/pull/40599)
- **Encrypted delegated tasks.** Preserve encrypted task blocks in native OpenAI or Azure OpenAI Responses classifier calls. Unsupported deployments and decryption errors follow `classifier_fallback`. [#40608](https://github.com/BerriAI/litellm/pull/40608)
- **Classifier input logs.** Inspect the provider-bound classifier input, masked originating request, and classifier response separately in the Classify row. [#40604](https://github.com/BerriAI/litellm/pull/40604)
- **Heuristic v1 tuning.** One tuned router stays editable without the `auto_router` license feature. [#39952](https://github.com/BerriAI/litellm/pull/39952)
- **Faster semantic cold start.** Build the first route layer once, off the event loop. [#39954](https://github.com/BerriAI/litellm/pull/39954)
- **Adaptive router fixes.** Read model pricing from `model_info` and preserve bandit priors across restarts. [#39957](https://github.com/BerriAI/litellm/pull/39957), [#39955](https://github.com/BerriAI/litellm/pull/39955)
- **Cross-provider tool history.** `/v1/messages` can replay `tool_use` blocks across OpenAI and Anthropic tiers. [#39967](https://github.com/BerriAI/litellm/pull/39967)

Use a build containing the linked PRs; earlier development builds may not include every change. [Harness-aware routing update](/blog/auto-router-harness-aware-classification)

## v1.101.0 (release candidate)

[GitHub pre-release](https://github.com/BerriAI/litellm/releases/tag/v1.101.0-rc.1), [Release notes](/release_notes/v1.101.0rc1/v1-101-0-rc-1)

- **Heuristic classifiers.** `heuristic_v2` routes locally; `hybrid` calls the LLM near a tier boundary. [#39276](https://github.com/BerriAI/litellm/pull/39276), [#39403](https://github.com/BerriAI/litellm/pull/39403). [Post](/blog/heuristic-v2)
- **Context and user-turn routing.** Fit oversized prompts to a tier and classify only new user turns when configured. [#38844](https://github.com/BerriAI/litellm/pull/38844), [#38861](https://github.com/BerriAI/litellm/pull/38861), UI [#39042](https://github.com/BerriAI/litellm/pull/39042), [#39054](https://github.com/BerriAI/litellm/pull/39054)
- **Image routing.** Send images to vision-capable tiers and optionally let the classifier read them. [#39032](https://github.com/BerriAI/litellm/pull/39032), [#39454](https://github.com/BerriAI/litellm/pull/39454), [#39825](https://github.com/BerriAI/litellm/pull/39825), UI [#39059](https://github.com/BerriAI/litellm/pull/39059), [#39840](https://github.com/BerriAI/litellm/pull/39840)
- **Stall escalation.** Move a request up one tier when an agent repeats tool calls or errors. [#39809](https://github.com/BerriAI/litellm/pull/39809). [Post](/blog/auto-router-stall-escalation)
- **Classifier controls.** Set classifier reasoning effort, a total timeout, and a circuit breaker for repeated timeouts. [#39372](https://github.com/BerriAI/litellm/pull/39372), [#39696](https://github.com/BerriAI/litellm/pull/39696), [#39701](https://github.com/BerriAI/litellm/pull/39701)
- **Tier failover and compression.** Use a live peer when a tier is cooled down and choose compression per routing or model hop. [#39675](https://github.com/BerriAI/litellm/pull/39675), [#39823](https://github.com/BerriAI/litellm/pull/39823). [Post](/blog/auto-router-per-hop-compression)
- **Shadow eval targeting.** Target teams, users, and model groups, compare up to four routers, and judge tool-call turns. [#39015](https://github.com/BerriAI/litellm/pull/39015), [#39028](https://github.com/BerriAI/litellm/pull/39028), [#39817](https://github.com/BerriAI/litellm/pull/39817), [#39818](https://github.com/BerriAI/litellm/pull/39818), [#39828](https://github.com/BerriAI/litellm/pull/39828)
- **Setup and prompt editing.** Configure all tiers from existing models, edit built-in prompts by section, and set session affinity TTL in the UI. [#39679](https://github.com/BerriAI/litellm/pull/39679), [#39688](https://github.com/BerriAI/litellm/pull/39688), [#39693](https://github.com/BerriAI/litellm/pull/39693)
- **Presets.** Add the 1M Context preset, update OpenAI Family, and serve the catalog at runtime. [#39412](https://github.com/BerriAI/litellm/pull/39412), [#39490](https://github.com/BerriAI/litellm/pull/39490), [#39396](https://github.com/BerriAI/litellm/pull/39396), [#39797](https://github.com/BerriAI/litellm/pull/39797)
- **Claude Code support.** Route subagents through the selected router, expose its mode in `/v1/models`, and bill routing embeddings to the caller. [#39239](https://github.com/BerriAI/litellm/pull/39239), [#39619](https://github.com/BerriAI/litellm/pull/39619), [#39532](https://github.com/BerriAI/litellm/pull/39532)
- **Breaking changes.** The `auto_router` license feature meters customization, and shadow eval results rename key fields. [#39468](https://github.com/BerriAI/litellm/pull/39468), [#39674](https://github.com/BerriAI/litellm/pull/39674), [#39015](https://github.com/BerriAI/litellm/pull/39015)

Posts: [Route on Context Size and Modality](/blog/auto-router-more-routing-configurations), [Mid-Task Stall Escalation](/blog/auto-router-stall-escalation), [Per-Hop Compression](/blog/auto-router-per-hop-compression).

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
