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
| Session pin  | No                                | Opt-in `session_affinity` (off by default), keyed by `session_id` metadata |
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

## Set it up with your agent

To get started, tell your agent:

```
run curl -fsSL https://docs.litellm.ai/skills/auto-router and follow the instructions
```

It reads the models your proxy already serves, asks how you want the router named and which model should serve each tier, and calls out the defaults it is assuming before it writes anything.

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
      # Prior conversation the classifier sees (LLM classifier only)
      classifier_context_window_size: 3          # default 3; 0 disables
      classifier_context_per_turn_chars: 200     # default 200
      classifier_context_include_assistant_turns: false   # default false

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
      session_affinity: false   # default; set true to pin
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

### Classifier context window

:::info

Context-window support ships in **v1.96.x** ([PR #35185](https://github.com/BerriAI/litellm/pull/35185)); assistant turns in the window arrived in the same release ([PR #35471](https://github.com/BerriAI/litellm/pull/35471)). On earlier versions the classifier saw only the current message, and these keys are silently ignored.

:::

The LLM classifier does not see the request in isolation. By default it also receives the last 3 prior turns of the conversation, truncated to 200 characters each, so a referring follow-up like "now do the same for the streaming path" is rated against what it refers to rather than on its own length. Without that context a hard follow-up mid-session classifies as whatever landed last, which in an agentic harness is often a `<system-reminder>` blob that barely varies across the session and pins every turn to one tier.

Only turns carrying text a human wrote count toward the window. Tool output never qualifies (`tool_result` blocks on the Messages surface, the `tool` role on chat completions), complete `<system-reminder>` blocks are stripped before a turn is considered, and a turn left empty after stripping is skipped rather than spending a slot. A turn whose text equals the ask being classified is excluded so the ask is never quoted twice. Prior turns are sent oldest first and numbered `[1]`, `[2]`, `[3]`, and a turn cut at the character limit gets a trailing `...` so the classifier can tell it was clipped. When prior conversation exists, a single depth line (`Conversation so far: ~N tokens across the request`) is included as well.

The call is split so the system role carries only the operator's rubric, byte-identical across sessions and therefore prompt-cacheable, while everything caller-supplied (their system prompt, the prior turns, the ask) is quoted as labeled sections of the user turn. A three-turn conversation on the defaults produces:

```
system: <rubric, operator-authored, identical on every request>

user:   Caller system prompt, quoted as task context:
        <the caller's own system prompt>

        Recent conversation (context only, do not classify these):
        [1] add a health check endpoint
        [2] now wire it into the readiness probe

        Conversation so far: ~1240 tokens across the request

        Classify this message:
        now do the same for the streaming path
```

Set `classifier_context_window_size: 0` to turn it off; the classifier then receives the current ask and nothing else, no prior turns and no depth line, and the rubric closes on "classify only the current message" to match. Raise `classifier_context_per_turn_chars` if turns are being clipped before the part that carries the difficulty. Both settings apply only when `classifier_type: llm`; the heuristic scorer and keyword rules always read the current human ask alone.

Note that `session_affinity` skips reclassification after a session's first turn, so on a router that turns it on the context window only comes into play on turn one, or on requests where no `session_id` is resolvable from metadata. It is off by default, so by default every turn is classified and the window applies throughout.

### Assistant turns in the context window

`classifier_context_include_assistant_turns` is off by default and puts the model's own replies in the window. It exists for the conversation where difficulty is stated by the assistant rather than by the user: the assistant answers "here is the plan, it is complex, should I execute?", the user answers "yes", and with user turns alone the router rates the word "yes" and picks the cheapest tier. With it on, the classifier rates the work the current message approves, judged in the conversation it continues.

```yaml
classifier_type: llm
classifier_llm_config:
  model: claude-haiku-4-5-20251001
classifier_context_include_assistant_turns: true
classifier_context_window_size: 3
classifier_context_per_turn_chars: 200
```

Enabling it changes what `classifier_context_window_size` counts: the last N turns of the conversation across both roles rather than the last N user turns, so budget accordingly if a chatty exchange should still carry several user asks. Turns are labeled by role in the payload only when this is on, which keeps the prompt of every existing deployment unchanged. Assistant replies share `classifier_context_per_turn_chars` with user turns, so raise it if replies truncate before the part that states the difficulty.

It ships off by default for two reasons: turning it on shifts tier decisions, and therefore spend, on an already-deployed router, and assistant text becomes net-new egress to the classifier deployment, which may be a different provider than the routed model. Assistant text reaches the classifier payload and nothing else; `keyword_tier_rules`, escalation keywords, the heuristic scorer, and semantic matching still read only the human ask, so an assistant echoing an escalation keyword back cannot pick the tier.

## Tier pools

A tier value can be a single model name or a list.

- **Single string:** pins the tier to one model.
- **List:** router random-picks per request (uniform), same idea as simple-shuffle. Empty pools raise at config load rather than falling through to `default_model`.
- **List + `adaptive: true`:** Thompson-sample across the pool. Cold requests sample only inside the classified tier so cost weights do not collapse initial traffic on the cheapest model. Models configured in multiple tiers use their minimum distance from the classified tier. Feedback from a later turn attributes back to the model that actually served the previous response.

## Session affinity

Off by default: every turn is classified on its own merits, so each one lands on the cheapest tier adequate for it.

Set `session_affinity: true` to pin the first-turn model for a session and skip reclassification on later turns. Turning it on buys two things. Provider-side prompt caches keyed to that model stop getting invalidated when a follow-up ("thanks!") would otherwise classify into a different tier. And a multi-turn session stays on a single model, which avoids provider errors when conversation history produced by one model (for example an Anthropic `thinking` block) is replayed to a different model on a later turn.

The trade is that the whole session inherits the first turn's tier. A conversation that opens with one hard question then continues with simple follow-ups keeps paying the expensive tier for all of them.

```yaml
session_affinity: true          # default false; set true to pin a session to its first-turn model
session_affinity_ttl_seconds: 3600
```

`session_id` is read from request metadata; when no `session_id` is resolvable the router classifies every turn as usual, whatever this is set to. When `adaptive: true` is also set, a pinned turn still stamps the adaptive bandit's chosen-model metadata key so reward feedback keeps working. `session_affinity` is ignored when `plugins` are configured, so a mid-session policy change still applies on later turns rather than being skipped by a cached pin.

:::info Changed default

`session_affinity` used to default to `true`. Routers created before that changed have no `session_affinity` key stored, so they pick up the new `false` default and start reclassifying every turn. Add `session_affinity: true` to any router that should keep pinning.

:::

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

Selecting **LLM Classifier** reveals the classifier context settings alongside the classifier model and timeout: **Context Window Size** (`classifier_context_window_size`), **Context Per-Turn Character Limit** (`classifier_context_per_turn_chars`), and an **Include Assistant Turns** toggle (`classifier_context_include_assistant_turns`). They are written only when the classifier type is LLM, and a value left at the default is omitted from the saved config so the backend default applies.

**Advanced > Session Affinity** holds the session pin, off to match the config default. Both the create tab and the edit modal write the value explicitly, so a router built in the UI records what it does rather than inheriting whatever the default happens to be.

## Claude Code and Claude Desktop

Two prerequisites before a router is selectable in a Claude client:

1. **The router's `model_name` has to read as an Anthropic model.** It needs `claude`, `anthropic`, or a family name such as `opus`, `sonnet`, or `haiku` somewhere in it, and no other vendor's name, so `claude-auto` is accepted where `smart-router` is rejected.
2. **On Claude for Teams or Enterprise, that name has to be on the organization's `availableModels` allowlist.** Anything missing from the allowlist is greyed out in the Claude Desktop picker and replaced at CLI startup with `restricted by your organization's settings`.

Both checks run in the client, so a router that fails either one leaves nothing in the LiteLLM logs to explain itself. See [Auto Router with Claude Code and Claude Desktop](../tutorials/claude_code_autorouter.md).

## See also

- Announcement post: [Auto Router v2: one router for complexity, semantic, and adaptive routing](/blog/autorouter-v2)
- Legacy semantic router: [Semantic Auto Router (deprecated)](./auto_routing_semantic.md)
