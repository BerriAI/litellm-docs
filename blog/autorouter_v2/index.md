---
slug: autorouter-v2
title: "Auto Router v2: one router for complexity, semantic, and adaptive routing"
date: 2026-07-13T12:00:00
authors:
  - krrish
description: "Auto Router v2 folds LiteLLM's complexity, semantic, and adaptive routers into a single router with an LLM classifier, keyword tiers, multi-model pools, and adaptive Thompson sampling."
tags: [routing, complexity-router, semantic-router, adaptive, product]
hide_table_of_contents: false
---

:::info Availability

Auto Router v2 ships in **v1.94.x**. The earliest dev release cuts **Tuesday, 2026-07-14**. Suggestions and feedback: [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

Auto Router v2 collapses complexity, semantic, and adaptive routing into a single `auto_router/complexity_router`. One config now covers heuristic scoring, LLM classification, lexical or semantic keyword rules, and Thompson-sampled tier pools.

The push came from the community. On [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168), users pointed out that all three routing strategies should converge into a single Auto Router. One router with configurable signals and weights keeps the API simple while letting the routing engine evolve internally, instead of forcing you to pick a mode up front.

The operational half came from [discussion #32172](https://github.com/BerriAI/litellm/discussions/32172): predictable beats clever for debuggability. A fixed, versioned mapping from capability class to model is what makes "why did this response cost 4x today" answerable after the fact.

{/* truncate */}

## What v2 adds

| Capability             | Before                          | After                                                                                                                     |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Classification         | Heuristic scorer only           | Heuristic, LLM classifier, lexical or semantic keyword rules ([#32169](https://github.com/BerriAI/litellm/pull/32169), [#32859](https://github.com/BerriAI/litellm/pull/32859)) |
| Tier value             | One model per tier              | One model, random-pick pool, or Thompson-sampled pool ([#32967](https://github.com/BerriAI/litellm/pull/32967), [#32947](https://github.com/BerriAI/litellm/pull/32947)) |
| Technical keywords     | Fixed built-in list             | `custom_technical_keywords` appends without replacing ([#32262](https://github.com/BerriAI/litellm/pull/32262))            |
| Decision log           | "keyword rule fired"            | `cause=literal_keyword_match \| semantic_keyword_match \| complexity_scorer` ([#32943](https://github.com/BerriAI/litellm/pull/32943)) |
| Alias `litellm_params` | Silently dropped                | Merged into outbound request ([#32974](https://github.com/BerriAI/litellm/pull/32974))                                    |
| Session affinity       | Reclassified every turn         | Opt-in `session_affinity`: pin the first-turn model for the session, skip reclassification ([#33126](https://github.com/BerriAI/litellm/pull/33126)) |

## One config, all the knobs

```yaml
model_list:
  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      drop_params: true
      complexity_router_config:
        tiers:
          SIMPLE:    ["gpt-4o-mini", "claude-haiku-4-5"]   # random-pick pool
          MEDIUM:    gpt-4o                                 # single pin
          COMPLEX:   claude-sonnet-5
          REASONING: gpt-5.5

        # optional: LLM classifier instead of heuristic scorer
        classifier_type: llm
        classifier_llm_config:
          model: claude-haiku-4-5-20251001
          timeout_ms: 2000

        # optional: keyword rules, escalate to highest matched tier
        keyword_tier_rules:
          - keywords: ["hi", "hello", "thanks"]
            tier: SIMPLE
          - keywords: ["kubernetes", "k8s", "istio"]
            tier: REASONING
        semantic_keyword_matching: true
        embedding_model: voyage-3-5
        match_threshold: 0.5

        # optional: append to the built-in technical keyword list
        custom_technical_keywords: [kafka, redis, postgresql, udp, dns]

        # optional: Thompson-sample within the tier's pool
        adaptive: true

        # optional: pin a session to its first-turn model (preserves prompt cache)
        session_affinity: true
        session_affinity_ttl_seconds: 3600

      complexity_router_default_model: claude-sonnet-5
```

## Notes on the new pieces

**LLM classifier** goes through the same `Router` instance, so credentials, budgets, and fallbacks apply. Timeout, empty content, or schema mismatch falls back to the heuristic scorer.

**Keyword rules** run before the scorer. Multiple matches escalate to the highest tier (SIMPLE < MEDIUM < COMPLEX < REASONING), so rule order does not silently change behavior. Semantic matching uses MAX aggregation (was MEAN), so one strong keyword match is not diluted by other utterances on the tier.

**Adaptive** turns tier pools into learning pools. Cold requests sample only inside the classified tier instead of collapsing on the cheapest model. Feedback attributes back to the model that actually served the previous turn, even when stateless routing picks a different one this turn.

**Session affinity** (opt-in) pins the first-turn model for a session and skips reclassification on later turns, so provider-side prompt caches keyed to that model do not get invalidated when a follow-up ("thanks!") would otherwise classify into a different tier ([#33126](https://github.com/BerriAI/litellm/pull/33126)). TTL defaults to 3600s. `session_id` comes from request metadata.

**Decision log** emits one greppable line per request:

```
ComplexityRouter: routing decision cause=complexity_scorer,      tier=SIMPLE,     score=-0.150, signals=['short (7 tokens)', 'simple (what is)'], routed_model=gpt-4o-mini
ComplexityRouter: routing decision cause=literal_keyword_match,  tier=REASONING,                                                                    routed_model=gpt-5.5
ComplexityRouter: routing decision cause=semantic_keyword_match, tier=REASONING,                                                                    routed_model=gpt-5.5
ComplexityRouter: routing decision cause=session_affinity_pin,                                                                                      routed_model=gpt-5.5
```

## Fixes worth calling out

`drop_params`, `cache_control_injection_points`, and any other `litellm_params` set on the auto router alias itself used to vanish when the router picked a tier. They now merge into the outbound request, without overriding anything the caller passed explicitly ([#32974](https://github.com/BerriAI/litellm/pull/32974)). Same PR fixes an Anthropic `/v1/messages` to Responses API `tool_choice` shape bug that broke Bedrock-backed complexity routers (reported in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168) by @icsy7867).

UI got a working Test Connection per tier ([#32950](https://github.com/BerriAI/litellm/pull/32950)) and required-tier inline validation ([#32978](https://github.com/BerriAI/litellm/pull/32978)).

## Try it

Existing complexity router configs keep working. To try v2, add `keyword_tier_rules`, `classifier_type: llm`, `adaptive: true`, `session_affinity: true`, or a list value on a tier to your existing `complexity_router_config`. Full reference on the [Auto Routing docs page](/docs/proxy/auto_routing).

## What's next

**Router plugins.** From [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168): a pipeline where each plugin receives the routing context, enriches it, and passes it on before Auto Router makes the final call. Plugins do not replace the router; they contribute structured signals (classification, policies, candidate filters, scores) that Auto Router combines.

Concrete end-to-end:

1. User sends a request.
2. Language plugin detects `en`.
3. Domain classifier labels it `coding` with 0.93 confidence.
4. Tenant policy limits allowed providers to OpenAI and Anthropic.
5. Budget plugin removes models exceeding the tenant's cost cap.
6. Auto Router picks the best remaining model from the enriched context.

Config sketch:

```yaml
router_settings:
  plugins:
    - name: language-detector
    - name: domain-classifier
      params:
        provider: openai/gpt-5-mini
    - name: budget-policy
      params:
        daily_limit: 100
    - name: tenant-policy
    - name: custom-python
      path: ./plugins/my_router.py
```

The initial work landed in [#32972](https://github.com/BerriAI/litellm/pull/32972); support for plugins on the proxy, and custom plugin files will be next.

**Also on the list:**

- **Escalation ceilings on fallback chains.** Per-request cap on escalations plus a cooldown once a key walks the chain N times, so a bad upstream cannot cascade into a bill.
- **Attributable decisions.** Stamp the routed model and routing-table version on every response, and export structured decision traces (candidates, scores, fallbacks, latency) through the standard logging integrations.

Running Auto Router in production and hitting these? Drop a note on [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).
