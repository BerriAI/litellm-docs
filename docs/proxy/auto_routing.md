import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Auto Routing

One router for complexity, semantic, and adaptive routing. Classify each request with heuristics, an LLM classifier, or lexical/semantic keyword rules, then route to a pinned model, a random pool, or a Thompson-sampled pool per tier.

:::info Availability

Ships in **v1.94.x**. The earliest dev release cuts **Tuesday, 2026-07-14**. Suggestions and feedback: [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

## When to use

| Feature      | Semantic Auto Router (deprecated) | Auto Routing (this page)                                                   |
| ------------ | --------------------------------- | -------------------------------------------------------------------------- |
| Classifier   | Embedding match on utterances     | Heuristic, LLM classifier, or lexical/semantic keyword rules               |
| Tier value   | One model                         | One model, random pool, or adaptive (Thompson-sampled) pool                |
| Latency      | ~100-500ms (embedding call)       | Sub-millisecond (heuristic/keyword) or one small classifier call (LLM)     |
| Session pin  | No                                | Opt-in `session_affinity`, keyed by `session_id` from request metadata     |
| Log          | No routing-cause signal           | `cause=` marker per decision (scorer, literal, semantic, session_pin, LLM) |
| Best for     | Intent-based routing              | Cost/quality tiering, hybrid rule + classifier setups, prompt-cache pinning |

The [semantic auto router](./auto_routing_semantic.md) is deprecated but still works for existing configs.

## Quick start (Proxy)

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params: {model: openai/gpt-4o-mini, api_key: os.environ/OPENAI_API_KEY}
  - model_name: gpt-4o
    litellm_params: {model: openai/gpt-4o, api_key: os.environ/OPENAI_API_KEY}
  - model_name: claude-sonnet-5
    litellm_params: {model: anthropic/claude-sonnet-5, api_key: os.environ/ANTHROPIC_API_KEY}
  - model_name: gpt-5.5
    litellm_params: {model: openai/gpt-5.5, api_key: os.environ/OPENAI_API_KEY}

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    gpt-4o-mini
          MEDIUM:    gpt-4o
          COMPLEX:   claude-sonnet-5
          REASONING: gpt-5.5
      complexity_router_default_model: gpt-4o
```

Call it like any other model:

```shell
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{"model": "smart-router", "messages": [{"role": "user", "content": "What is 2+2?"}]}'
```

## Full config

Every knob v2 exposes. All fields on `complexity_router_config` are optional except `tiers`.

```yaml
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

      # LLM classifier instead of the heuristic scorer
      classifier_type: llm
      classifier_llm_config:
        model: claude-haiku-4-5-20251001
        timeout_ms: 2000

      # Keyword rules, run before the scorer, escalate to the highest matched tier
      keyword_tier_rules:
        - keywords: ["hi", "hello", "thanks"]
          tier: SIMPLE
        - keywords: ["kubernetes", "k8s", "istio"]
          tier: REASONING
      semantic_keyword_matching: true
      embedding_model: voyage-3-5
      match_threshold: 0.5

      # Append to the built-in technical keyword list
      custom_technical_keywords: [kafka, redis, postgresql, udp, dns]

      # Thompson-sample within the tier's pool
      adaptive: true

      # Pin a session to its first-turn model to preserve prompt cache
      session_affinity: true
      session_affinity_ttl_seconds: 3600

      # Tune heuristic scorer boundaries and weights (all optional)
      tier_boundaries:
        simple_medium:     0.15
        medium_complex:    0.35
        complex_reasoning: 0.60
      token_thresholds:
        simple:  15
        complex: 400
      dimension_weights:
        tokenCount:        0.10
        codePresence:      0.30
        reasoningMarkers:  0.25
        technicalTerms:    0.25
        simpleIndicators:  0.05
        multiStepPatterns: 0.03
        questionComplexity: 0.02

    complexity_router_default_model: claude-sonnet-5
```

## Classification

Three ways to pick a tier. Pick one; the router falls back to the heuristic scorer if the LLM classifier errors or if no keyword rule matches.

**Heuristic scorer (default).** Zero API calls, sub-millisecond. Scores each request across seven dimensions and maps the score to a tier.

| Dimension          | What it detects                                 |
| ------------------ | ----------------------------------------------- |
| tokenCount         | Short (&lt;15) or long (&gt;400) prompts        |
| codePresence       | "function", "class", "api", "database", etc.    |
| reasoningMarkers   | "step by step", "think through", "analyze"      |
| technicalTerms     | "architecture", "distributed", "encryption"     |
| simpleIndicators   | "what is", "define", greetings                  |
| multiStepPatterns  | "first...then", numbered steps                  |
| questionComplexity | Multiple question marks                         |

Two or more reasoning markers auto-routes to `REASONING` regardless of the weighted score.

**LLM classifier.** Uses a small fast model (Haiku, gpt-4o-mini, whatever you point it at) with structured output. Goes through the same `Router` instance, so credentials, budgets, and fallbacks apply. Timeout, empty content, or schema mismatch falls back to the heuristic scorer.

```yaml
classifier_type: llm
classifier_llm_config:
  model: claude-haiku-4-5-20251001
  timeout_ms: 2000
```

**Keyword rules.** Deterministic short-circuit. Match a keyword, land in that tier. When multiple rules match, routing escalates to the highest tier (`SIMPLE < MEDIUM < COMPLEX < REASONING`) so rule order does not silently change behavior.

Enable `semantic_keyword_matching` to match paraphrases via embeddings. Semantic scoring uses MAX aggregation so a strong match on one keyword in a tier is not diluted by that tier's other utterances. Query embeddings carry the caller's request metadata, so their spend attributes to the originating key. On embedding failure the router falls back to the scorer.

```yaml
keyword_tier_rules:
  - keywords: ["hi", "hello", "thanks"]
    tier: SIMPLE
  - keywords: ["kubernetes", "k8s", "istio"]
    tier: REASONING
semantic_keyword_matching: true
embedding_model: voyage-3-5
match_threshold: 0.5
```

## Tier pools

A tier value can be a single model name or a list.

- **Single string:** pins the tier to one model.
- **List:** router random-picks per request (uniform), same idea as simple-shuffle. Empty pools raise at config load rather than falling through to `default_model`.
- **List + `adaptive: true`:** Thompson-sample across the pool. Cold requests sample only inside the classified tier so cost weights do not collapse initial traffic on the cheapest model. Models configured in multiple tiers use their minimum distance from the classified tier. Feedback from a later turn attributes back to the model that actually served the previous response.

## Session affinity

Opt-in. Pins the first-turn model for a session and skips reclassification on later turns, so provider-side prompt caches keyed to that model do not get invalidated when a follow-up ("thanks!") would otherwise classify into a different tier.

```yaml
session_affinity: true
session_affinity_ttl_seconds: 3600
```

`session_id` is read from request metadata. When `adaptive: true` is also set, a pinned turn still stamps the adaptive bandit's chosen-model metadata key so reward feedback keeps working.

## Custom technical keywords

The built-in technical keyword list is generic; it contains "tcp" but not "udp", "api" but not "kafka" or "postgresql". `custom_technical_keywords` appends to the built-in list instead of replacing it.

```yaml
custom_technical_keywords: [kafka, redis, postgresql, mongodb, udp, dns, ssl, ssh]
```

## Decision log

Every routing decision emits one greppable line naming its cause. `cause=` is greppable by decision type in your log pipeline.

```
ComplexityRouter: routing decision cause=complexity_scorer,      tier=SIMPLE,     score=-0.150, signals=['short (7 tokens)', 'simple (what is)'], routed_model=gpt-4o-mini
ComplexityRouter: routing decision cause=literal_keyword_match,  tier=REASONING,                                                                    routed_model=gpt-5.5
ComplexityRouter: routing decision cause=semantic_keyword_match, tier=REASONING,                                                                    routed_model=gpt-5.5
ComplexityRouter: routing decision cause=llm_classifier,         tier=COMPLEX,    score=1.000, signals=['llm-classifier:COMPLEX'],                  routed_model=claude-sonnet-5
ComplexityRouter: routing decision cause=session_affinity_pin,                                                                                      routed_model=gpt-5.5
```

## Alias `litellm_params` on the router

`drop_params`, `cache_control_injection_points`, and any other `litellm_params` set on the auto router deployment itself are merged into the outbound request when the router picks a tier. Values the caller passes explicitly on a request win over the alias defaults.

```yaml
- model_name: smart-router
  litellm_params:
    model: auto_router/complexity_router
    drop_params: true
    cache_control_injection_points:
      - location: message
        role: system
    complexity_router_config: {...}
```

## Python SDK

```python
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "gpt-4o-mini",   "litellm_params": {"model": "gpt-4o-mini"}},
        {"model_name": "gpt-4o",        "litellm_params": {"model": "gpt-4o"}},
        {"model_name": "claude-sonnet", "litellm_params": {"model": "claude-sonnet-4-20250514"}},
        {"model_name": "o1-preview",    "litellm_params": {"model": "o1-preview"}},
        {
            "model_name": "smart-router",
            "litellm_params": {
                "model": "auto_router/complexity_router",
                "complexity_router_config": {
                    "tiers": {
                        "SIMPLE":    "gpt-4o-mini",
                        "MEDIUM":    "gpt-4o",
                        "COMPLEX":   "claude-sonnet",
                        "REASONING": "o1-preview",
                    },
                    "session_affinity": True,
                },
                "complexity_router_default_model": "gpt-4o",
            },
        },
    ],
)

response = await router.acompletion(
    model="smart-router",
    messages=[{"role": "user", "content": "What is 2+2?"}],
)
```

## UI

Models + Endpoints > Add Model > Auto Router tab. Router Type defaults to "Auto-Router v2 [Recommended]". Configure the four tier model groups, optionally enable Semantic Keyword Matching, LLM Classifier, or Adaptive, then click **Test Connection**. Test Connection runs a minimal `/v1/chat/completions` or `/v1/embeddings` per distinct tier model group, so a green row means the tier is genuinely reachable and a red row shows the real provider error.

Tier and classifier dropdowns exclude embedding-mode models; the semantic embedding dropdown lists only embedding-mode models. All four tiers are required on submit; missing tiers are flagged inline.

## See also

- Announcement post: [Auto Router v2: one router for complexity, semantic, and adaptive routing](/blog/autorouter-v2)
- Legacy semantic router: [Semantic Auto Router (deprecated)](./auto_routing_semantic.md)
