import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Auto Routing

One router for complexity, semantic, and adaptive routing. Classify each request with heuristics, an LLM classifier, lexical/semantic keyword rules, or your own classifier plugin, then route to a pinned model, a random pool, or a Thompson-sampled pool per tier.

:::info Availability

Ships in **v1.94.x**. The earliest dev release cuts **Tuesday, 2026-07-14**. Suggestions and feedback: [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

## When to use

| Feature      | Semantic Auto Router (deprecated) | Auto Routing (this page)                                                   |
| ------------ | --------------------------------- | -------------------------------------------------------------------------- |
| Classifier   | Embedding match on utterances     | Heuristic, LLM classifier, lexical/semantic keyword rules, or your own plugin |
| Tier value   | One model                         | One model, random pool, or adaptive (Thompson-sampled) pool                |
| Latency      | ~100-500ms (embedding call)       | Sub-millisecond (heuristic/keyword) or one small classifier call (LLM)     |
| Session pin  | No                                | Opt-in `session_affinity` (off by default), keyed by `session_id` metadata |
| Log          | No routing-cause signal           | `cause=` marker per decision (scorer, literal, semantic, session_pin, LLM, plugin) |
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

      # Optional display names; omit to keep SIMPLE/MEDIUM/COMPLEX/REASONING everywhere
      # tier_labels:
      #   SIMPLE: Cheap

      # LLM classifier instead of the heuristic scorer
      classifier_type: llm
      classifier_llm_config:
        model: claude-haiku-4-5-20251001
        timeout_ms: 2000
        # system_prompt: <your rubric>         # replaces the built-in rubric entirely; omit for the default
      classifier_fallback: heuristic           # default; or default_model
      # Prior conversation the classifier sees (LLM classifier only)
      classifier_context_window_size: 3          # default 3; 0 disables
      classifier_context_per_turn_chars: 200     # default 200
      classifier_context_include_assistant_turns: false   # default false

      # Or hand the tier decision to your own code (config file only)
      # classifier_type: custom
      # classifier_plugin: classifiers.tier_by_team   # dotted path to an async classify(context)
      # classifier_plugin_timeout_ms: 3000            # default

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

      # Marker pair whose blocks are stripped before classification
      reminder_markers: ["<system-reminder>", "</system-reminder>"]   # default

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

Four ways to pick a tier. Pick one; the router falls back to the heuristic scorer if no keyword rule matches, and, unless `classifier_fallback` says otherwise, if the LLM classifier or a custom classifier plugin fails.

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

**LLM classifier.** Uses a small fast model (Haiku, gpt-4o-mini, whatever you point it at) with structured output. Goes through the same `Router` instance, so credentials, budgets, and fallbacks apply. Timeout, empty content, or schema mismatch falls back to the heuristic scorer, or to `complexity_router_default_model` with `classifier_fallback: default_model`, which is what a classifier grading something other than complexity wants since a complexity score would produce a tier unrelated to its taxonomy.

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

**Custom classifier plugin.** Your own code picks the tier. Set `classifier_type: custom` and point `classifier_plugin` at a dotted path to an object with an async `classify(context)`, resolved the same way routing [`plugins`](../routing_plugins.md) are. Reach for it when the tier is not a judgment about the prompt at all: route by team or tenant plan, by a flag in a service you own, by any rule you can express in Python.

:::info

Custom classifier plugins ship in **v1.99.x** ([PR #37249](https://github.com/BerriAI/litellm/pull/37249)). Config file only: like `plugins`, `classifier_plugin` cannot be set through the model-management API or the UI, because a live object does not travel over HTTP.

:::

```yaml title="config.yaml"
- model_name: smart-router
  litellm_params:
    model: auto_router/complexity_router
    complexity_router_config:
      classifier_type: custom
      classifier_plugin: classifiers.tier_by_team   # dotted path, resolved next to this config file
      classifier_plugin_timeout_ms: 3000            # default
      tiers:
        SIMPLE:    gpt-4o-mini
        REASONING: gpt-5.5
    complexity_router_default_model: gpt-4o-mini
```

```python title="classifiers.py"
from litellm.types.router import RoutingContext


class TierByTeam:
    async def classify(self, context: RoutingContext) -> str | None:
        team = context.metadata.get("user_api_key_team_alias")
        if team == "research":
            return "REASONING"
        if team == "support":
            return "SIMPLE"
        return None   # decline, and let classifier_fallback decide


tier_by_team = TierByTeam()
```

`context` is the same `RoutingContext` a routing plugin receives: `raw_messages`, `structured_messages` (normalized to OpenAI chat format), `metadata`, and `candidate_models`. Caller identity rides along on `metadata`, so `user_api_key_team_id`, `user_api_key_team_alias`, and `user_api_key_user_id` are readable with no plumbing of your own. `candidate_models` here is an informational snapshot of every tier's models rather than the narrowing surface a routing plugin filters: the tier you return picks the pool, so mutating the list is a no-op.

Return the name of a tier: a built-in tier (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`), or its `tier_labels` display name. Return `None` to decline.

Anything else is treated as availability rather than policy and falls back exactly the way the LLM classifier does. `None`, a raised exception, a call slower than `classifier_plugin_timeout_ms`, a tier name the router does not recognize, and a tier with no models configured all hand the request to `classifier_fallback`: the heuristic scorer by default, or `default_model`. A plugin that is down degrades routing; it never fails the request.

Config mistakes surface at startup instead of on the first classified request. A `classifier_plugin` whose `classify` is missing or not `async` is rejected with the config key named, `classifier_type: custom` without a plugin raises, and a plugin set under any other `classifier_type` raises too, since it would never run.

Everything else on the router still applies. `keyword_tier_rules` short-circuit ahead of the plugin, escalation keywords still escalate the tier it returns, `adaptive: true` still Thompson-samples inside that tier's pool, and `session_affinity: true` still pins a session to its first-turn model. The `classifier_context_*` settings are LLM-classifier only; a plugin gets the messages directly and decides for itself how much of them to read.

### What gets classified

A request is not classified as a blob. The router extracts the **last real human ask** and the **latest system prompt** from the message list, and the current-request scoring paths read those strings rather than the raw payload. The classifier context window can also add prior turns and a trajectory estimate, described below. This matters most under an agent harness, where a single turn arrives as a huge shared system prefix, a pile of tool results, and a one-line ask

Extraction walks the message list newest-first and returns the first user turn that still carries human text. Content is flattened by keeping `type == "text"` blocks only, so a turn whose content is entirely tool output flattens to the empty string and is skipped rather than accepted as the ask; on the Messages surface tool results ride non-text `tool_result` blocks on a user turn, and on chat completions they sit on the `tool` role, which is never read. Complete `<system-reminder>` ... `</system-reminder>` blocks are removed before the text is used, and the ask written around them survives. Marker matching is literal and case-insensitive, an unclosed opening tag is not a block and is left alone, and `reminder_markers` swaps in a different pair for a harness that brands its reminders differently. When every user turn holds nothing but plumbing there is no ask at all, and the request goes to `complexity_router_default_model` rather than letting harness-injected text pick the tier. On a router with `plugins` configured it goes through the `MEDIUM` pool instead, so a default model can never bypass the plugin pipeline

The consequence is the one an expert reader usually assumes is missing: "fix this typo" and "refactor the auth subsystem" are each scored on their own ask rather than being forced onto the same tier by the 40k-token system prefix and reminder blocks they share

The stripped human ask is the only text that reaches `keyword_tier_rules`, semantic keyword matching, escalation keywords, and the heuristic scorer's reasoning-marker dimension. The system prompt is extracted separately and is **not** reminder-stripped; it feeds the heuristic scorer's code, technical, and simple dimensions, and it is quoted into the LLM classifier payload. Reasoning markers deliberately read the human ask alone, which is what stops a `You are an expert engineer. Always think step by step.` system prompt from pinning every request in the session to `REASONING`. Escalation keywords are narrower still: they read only the newest user turn's stripped text, so one escalate request does not re-fire on each of the tool turns that follow it

The heuristic override that forces `REASONING` on two or more reasoning markers is part of the scorer, so it applies when `classifier_type` is `heuristic` and on the scorer fallback after a failed classifier call. On the LLM classifier path the tier the classifier returns is used as-is

The deprecated [semantic auto router](./auto_routing_semantic.md) has a much thinner contract. It takes the newest user message alone and returns whatever that message flattens to, with no reminder stripping, no system prompt, and no skipping, so a newest turn holding only tool-result blocks yields the empty string and gets embedded as such. What it does embed is cut to the first `auto_router_max_input_chars` characters (default 2000, head kept) before the call to `auto_router_embedding_model`, since a truncated prompt still routes where an over-long one errors out. Under an agent harness that reads as routing on the opening of one turn, which is the design an expert reader tends to assume the complexity router also has

### Classifier context window

:::info

Context-window support ships in **v1.96.x** ([PR #35185](https://github.com/BerriAI/litellm/pull/35185)); assistant turns in the window arrived in the same release ([PR #35471](https://github.com/BerriAI/litellm/pull/35471)). On earlier versions the classifier saw only the current message, and these keys are silently ignored.

:::

The LLM classifier does not see the request in isolation. By default it also receives the last 3 prior turns of the conversation, truncated to 200 characters each, so a referring follow-up like "now do the same for the streaming path" is rated against what it refers to rather than on its own length. Without that context a hard follow-up mid-session classifies as whatever landed last, which in an agentic harness is often a `<system-reminder>` blob that barely varies across the session and pins every turn to one tier.

By default, only turns carrying text a human wrote count toward the window. Tool output never qualifies (`tool_result` blocks on the Messages surface, the `tool` role on chat completions), complete reminder blocks are stripped before a turn is considered (`<system-reminder>` ... `</system-reminder>` by default, another pair with `reminder_markers`), and a turn left empty after stripping is skipped rather than spending a slot. Set `classifier_context_include_assistant_turns` to include assistant turns too; see [Assistant turns in the context window](#assistant-turns-in-the-context-window) below. A turn whose text equals the ask being classified is excluded so the ask is never quoted twice. Prior turns are sent oldest first and numbered `[1]`, `[2]`, `[3]`, and a turn cut at the character limit gets a trailing `...` so the classifier can tell it was clipped. When prior conversation exists, a single depth line (`Conversation so far: ~N tokens across the request`) is included as well. That trajectory count is a rough four-characters-per-token estimate over the text of every message on the request, not a tokenizer count and not limited to the turns in the window, so it reads as a depth signal rather than as a billable number

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

Set `classifier_context_window_size: 0` to turn it off; the classifier then receives the caller's latest system prompt and the current ask alone, no prior turns and no depth line, and the rubric closes on "classify only the current message" to match. Raise `classifier_context_per_turn_chars` if turns are being clipped before the part that carries the difficulty. Both settings apply only when `classifier_type: llm`; the heuristic scorer and keyword rules always read the current human ask alone

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

`session_id` is read from request metadata; when no `session_id` is resolvable the router classifies every turn as usual, whatever this is set to. When `adaptive: true` is also set, a pinned turn still stamps the adaptive bandit's chosen-model metadata key so reward feedback keeps working. `session_affinity` is ignored when routing `plugins` are configured, so a mid-session policy change still applies on later turns rather than being skipped by a cached pin. That is routing `plugins` specifically; a `classifier_plugin` picks the tier on the turns that are classified and leaves the pin in place.

:::info Changed default

`session_affinity` used to default to `true`. Routers created before that changed have no `session_affinity` key stored, so they pick up the new `false` default and start reclassifying every turn. Add `session_affinity: true` to any router that should keep pinning.

:::

### Session affinity pins the model name

The pin the complexity router stores is the **model name** it routed to, cached under `complexity_router_session_affinity:v1:<router name>:<key hash>:<session_id>` for `session_affinity_ttl_seconds`. The TTL is refreshed on cache hits, and an escalation request can move the pin up a tier. Deployment selection then runs as usual underneath that name. If the tier entry names a model group fanned across several deployments (two Bedrock regions, Vertex plus the first-party Anthropic API, a pair of Azure resources), the session stays on one model and still spreads across those deployments, and each provider-side prefix cache sees a fraction of the session's turns. On a coding-agent workload, where the cache prefix is most of the request, that is the difference between reading a warm prefix and writing it again

`DeploymentAffinityCheck` is the piece that closes it. It pins a concrete deployment id (`model_info.id`) rather than a model name, and it exists for exactly this implicit prompt-caching case. It is a separate Router pre-call check, enabled independently of anything on the router alias, and it takes two flags worth knowing apart:

| `optional_pre_call_checks` entry | Pins the deployment by |
| ------------------------------- | ---------------------- |
| `deployment_affinity`           | the caller's key hash (`metadata.user_api_key_hash`) |
| `session_affinity`              | `session_id` from request metadata |
| `responses_api_deployment_check` | `previous_response_id`, which wins over both above |

The `session_affinity` string in `optional_pre_call_checks` is a different setting from `session_affinity` inside `complexity_router_config`, despite the shared name. The first pins a deployment id under a Router pre-call check; the second pins a model name and skips reclassification. Both are worth having on an agent workload. `deployment_affinity_ttl_seconds` (default `3600`) is the TTL for the deployment pin, and it lives in `router_settings`, not on the router alias

Recommended shape for a coding-agent workload, pinning the tier for the session and the deployment behind it:

```yaml
model_list:
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
  # same tier, second deployment: this is the fan-out a model-name pin cannot hold
  - model_name: claude-sonnet-5
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-5
      aws_region_name: us-east-1
  - model_name: claude-opus-4-8
    litellm_params:
      model: anthropic/claude-opus-4-8
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-auto
    litellm_params:
      model: auto_router/complexity_router
      cache_control_injection_points:
        - location: message
          role: system
      complexity_router_config:
        tiers:
          SIMPLE:    claude-haiku-4-5
          MEDIUM:    claude-sonnet-5
          COMPLEX:   claude-sonnet-5
          REASONING: claude-opus-4-8
        session_affinity: true
        session_affinity_ttl_seconds: 3600
      complexity_router_default_model: claude-sonnet-5

router_settings:
  optional_pre_call_checks: ["deployment_affinity", "session_affinity", "prompt_caching"]
  deployment_affinity_ttl_seconds: 3600
```

The third entry, `prompt_caching`, enables `PromptCachingDeploymentCheck`, which is prefix-driven rather than session-driven: after a successful completion it records the deployment that served the prompt keyed on the cacheable prefix (everything up to and including the last `cache_control` checkpoint), and sends the next request carrying that same prefix back to the same deployment. It only looks when the prompt clears the model's minimum cacheable token count, and it helps callers that send no `session_id` and no stable key, so it complements the two affinity pins rather than replacing either

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
ComplexityRouter: routing decision cause=classifier_plugin,      tier=REASONING,  score=n/a,   signals=['classifier-plugin:REASONING'],             routed_model=gpt-5.5
ComplexityRouter: routing decision cause=session_affinity_pin,                                                                                      routed_model=gpt-5.5
```

## Reading the picked model from the response

The response body `model` field always stays the alias you called (`smart-router`), matching OpenAI semantics: a client should get back the model name it asked for. The tier an auto-routing strategy actually picked is a separate field, `router_model_name`, present on every response an auto router produced.

:::info Availability

`router_model_name` ships in **v1.99.x** ([PR #37725](https://github.com/BerriAI/litellm/pull/37725)). Before this, the picked tier was only reachable through the [`x-litellm-model-id` response header](./response_headers.md#litellm-specific-headers), which SDKs and frameworks that do not expose response headers, or that consume the response as a stream of body chunks, could not read.

:::

Non-streaming:

```json
{
  "id": "chatcmpl-abc123",
  "model": "smart-router",
  "router_model_name": "gpt-5.5",
  "choices": [{"...": "..."}]
}
```

Streaming: the field is written on every SSE chunk, not only the first or the last, so a consumer that reads one chunk in isolation still sees it.

```
data: {"id":"chatcmpl-abc123","model":"smart-router","router_model_name":"gpt-5.5","choices":[{"delta":{"content":"The"},"...":"..."}]}

data: {"id":"chatcmpl-abc123","model":"smart-router","router_model_name":"gpt-5.5","choices":[{"delta":{"content":" sum"},"...":"..."}]}
```

`router_model_name` is the `model_name` of the `model_list` entry the router picked (`gpt-5.5`, `claude-sonnet-5`), the same value logged as `routed_model=` in the [decision log](#decision-log) above, never the alias and never the upstream `litellm_params.model`.

The field is present only when an auto-routing strategy actually selected the deployment for that request. It is absent on a request to a plain, non-auto-routed `model_name`, and it is also absent after a mid-stream fallback moves the request off the tier the router picked. The counterfactual `router_model_name` claimed is no longer the model that answered, so the field is dropped rather than continuing to name the original tier; use `x-litellm-attempted-fallbacks` to detect that a fallback occurred.

**LangChain callers:** `@langchain/openai`'s `ChatOpenAI` drops response fields it does not recognize, both at the top level of a chunk and inside `delta`, so `router_model_name` does not reach `response_metadata` or `additional_kwargs` by default. Pass `__includeRawResponse: true` to the constructor (requires `@langchain/openai` >= 0.2.11; the option is marked experimental in LangChain's own types) and read `additional_kwargs.__raw_response.router_model_name` instead:

```js
const llm = new ChatOpenAI({
  model: "smart-router",
  __includeRawResponse: true,
  configuration: { baseURL: "<proxy base>/v1" },
});
for await (const chunk of await llm.stream(prompt)) {
  const routedModel = chunk.additional_kwargs?.__raw_response?.router_model_name;
}
```

The raw `openai` SDK and plain HTTP/SSE clients need no such workaround; `router_model_name` is a normal top-level field on every chunk and on the non-streaming response.

## Reported savings

Every auto-routed request records what routing saved against a counterfactual: the one model the traffic would have run on without a router

```text
savings = cost(baseline model, this request) - cost(the model the router picked, this request)
```

- **The baseline is derived, not configured.** Without a router a deployment has to pick one model able to carry the hardest request it will see, so the baseline is the most expensive model in the hardest tier the router configures. Hardest *configured*, so a router defining only `SIMPLE` and `MEDIUM` is measured against the best it could actually have picked. A tier naming a pool contributes every model in it, and self-defined tier labels carry no severity order, so there every model across every tier competes
- **"Most expensive" is settled by cost, not by rate**, since a model dearer per output token can be cheaper per cached token. Candidates are priced once against a fixed reference request (20k prompt tokens: 19k cache reads and a 1k cache write, plus 1k completion) through the same engine the savings use. Unpriceable candidates drop out, and if none price the driver reports zero. The ranking is pinned per router instance, so it stays off the per-request path
- **Only one side is hypothetical.** What the request actually cost is read back from what the cost calculator recorded, on the service tier and data residency it was billed on, rather than re-derived; the baseline never ran, so it is priced through the same engine on that same basis. That figure is input plus output cost, leaving built-in tool cost, discounts and margins outside the comparison
- **The result is signed.** Switching models leaves the new one cold, and when the resulting cache-creation charge outweighs the cheaper rates the number goes negative and the dashboard says so
- **It reads `0.0`** when either side cannot be resolved or priced, or when both resolve to the same provider and model. That is model identity rather than deployment identity, so routing between two deployments of one model reports zero even where their negotiated rates differ

### The baseline is priced with a warm cache

The baseline is one model serving every turn, so whether it had this prompt cached is simply whether the conversation was already underway. The router records that as `conversation_continuing` on the decision; an assistant turn anywhere in the history is the evidence, and no messages at all counts as continuing, which is the direction that cannot inflate

```python
warm   = conversation_continuing and cache_creation > 0 and cache_read <= cache_creation
reads  = cache_read + cache_creation if warm else cache_read
writes = 0 if warm else cache_creation
```

- **Continuing turn that paid to write cache**, the `warm` case: those tokens become baseline cache *reads* and its creation charge drops to zero, since a single-model baseline wrote that prefix on an earlier turn. The write this request really paid stays on the router's side of the subtraction, which is exactly the cost of having switched
- **Continuing turn that mostly read**, where reads exceed writes: buckets stay put and both arms carry the write. The selected model was evidently already serving this conversation, so those tokens are the turn's own growth and the baseline would have paid to write them too
- **A conversation's first turn**: buckets stay put for the same reason, nothing was warm for any model
- **A baseline missing a cache rate of its own**: those tokens become ordinary input at its plain rate rather than a free bucket. The relevant OpenAI, Azure and Gemini entries have no separate cache-write rate, and treating an absent rate as zero would carry the whole prompt for nothing, turning a profitable route into a reported loss

### Where it shows up

- **Usage**, normalized from each provider's own shape: `cache_read_input_tokens` and `cache_creation_input_tokens` on the Anthropic surface, `prompt_tokens_details.cached_tokens` on the OpenAI-compatible surface, plus DeepSeek's `prompt_cache_hit_tokens`
- **Daily rollups**: `cache_read_input_tokens` and `cache_creation_input_tokens` columns alongside `autorouter_savings_spend`, on `LiteLLM_DailyUserSpend`, `LiteLLM_DailyTeamSpend`, `LiteLLM_DailyTagSpend`, `LiteLLM_DailyOrganizationSpend`, `LiteLLM_DailyEndUserSpend` and `LiteLLM_DailyAgentSpend`
- **API**: `GET /user/daily/activity` returns them under `metrics`, with a `total_autorouter_savings_spend` in the response metadata
- **UI**: the **Cost Optimization** page reads that endpoint, where the number is labeled "Auto-router savings"

:::note

`LiteLLM_SpendLogs` has no cache-token or savings columns, so the split is not queryable there; the daily rollup above is. The usage carrying that split does ride in the row's `metadata` under `usage_object`, which is what the daily savings writer reads back to rebuild `Usage`. Its `cache_hit` and `cache_key` columns are unrelated, describing LiteLLM's own response cache rather than provider-side prompt caching. Routing itself persists as `routing_decision` in metadata: `routed_model`, `cause` and `conversation_continuing` always, `tier` when a tier was determined, and the derived baseline alongside the deployment it resolved to

:::

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

## Effort ladders

Switching models is not the only axis a router can climb. Reasoning effort changes how many output tokens a request spends at the same per-token rate, while switching models changes the rate on every token in the request, so climbing effort on a cheap model is often the cheaper next step and worth exhausting before the tier ladder reaches for a frontier model

Nothing new is needed to express that. Declare one `model_list` entry per rung, identical except for the reasoning parameter in its `litellm_params`, and point tiers at those names. When the router returns a tier's model name, that name resolves to its deployment and the deployment's own `litellm_params` are merged into the outbound request, with anything the caller sent explicitly winning over them. A client that sets `reasoning_effort` itself therefore keeps its value, and everyone else gets the rung

```yaml
model_list:
  - model_name: gpt-5.4-mini-low
    litellm_params:
      model: openai/gpt-5.4-mini
      api_key: os.environ/OPENAI_API_KEY
      reasoning_effort: low

  # same model and the same per-token rate as the rung above, more thinking
  - model_name: gpt-5.4-mini-high
    litellm_params:
      model: openai/gpt-5.4-mini
      api_key: os.environ/OPENAI_API_KEY
      reasoning_effort: high
  - model_name: gpt-5.4-mini-xhigh
    litellm_params:
      model: openai/gpt-5.4-mini
      api_key: os.environ/OPENAI_API_KEY
      reasoning_effort: xhigh

  # top rung: a different rate on every token
  - model_name: gpt-5.5
    litellm_params:
      model: openai/gpt-5.5
      api_key: os.environ/OPENAI_API_KEY

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      drop_params: true
      complexity_router_config:
        tiers:
          SIMPLE:    gpt-5.4-mini-low
          MEDIUM:    gpt-5.4-mini-high
          COMPLEX:   gpt-5.4-mini-xhigh
          REASONING: gpt-5.5
      complexity_router_default_model: gpt-5.4-mini-high
```

Anthropic-family rungs use `thinking` the same way, since it is an ordinary `litellm_params` key:

```yaml
  - model_name: claude-sonnet-5-thinking
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
      thinking: {type: enabled, budget_tokens: 8192}
```

Effort levels are per-model capabilities, so check the model supports the rung you are asking for: `gpt-5-mini` rejects `xhigh` while `gpt-5.4-mini` accepts it, and `drop_params: true` on the router alias turns that rejection into a silently dropped parameter, which reads as a ladder that changed nothing. Two more things to keep in mind. Cost tracking prices each rung under its underlying model, so a ladder built this way shows up in spend as one model at several effort levels rather than as separate models. And `session_affinity` pins the rung's `model_name`; the TTL is refreshed on cache hits, and an escalation request can move the pin up a tier rather than leaving it on a hard fixed-duration lock

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

Models + Endpoints > Add Model > Auto Router tab. The form opens on the two things every router needs, a name and a **Template**: pick one of the bundled templates to prefill all four tiers, or **Custom Configuration** to fill them in yourself. A template whose models this proxy does not serve is greyed out with the missing names, so anything selectable is applicable. Everything else lives under **Detailed Configuration**, collapsed by default with a one-line summary of the tiers it currently holds; expand it to set the tier model groups, tier display names, Semantic Keyword Matching, LLM Classifier, escalation keywords, or Adaptive.

**Test Routing** sends one prompt through the classifier for the config in the form, without creating the router, and shows the model it would pick with the same routing-decision card the logs drawer uses. Nothing is sent to the model it routes to, so a heuristic config spends nothing, while an LLM classifier or semantic matching bills its classifier or embedding call to your key. **Test Connection** instead runs a minimal `/v1/chat/completions` or `/v1/embeddings` per distinct tier model group, so a green row means the tier is genuinely reachable and a red row shows the real provider error.

Tier and classifier dropdowns exclude embedding-mode models; the semantic embedding dropdown lists only embedding-mode models. All four tiers are required on submit; missing tiers are flagged inline.

Selecting **LLM Classifier** reveals, alongside the classifier model and timeout, a **Classifier Prompt** editor (`classifier_llm_config.system_prompt`, prefilled with the built-in rubric for the router's context window size and tier names, and sent only once you edit it), an **If the classifier fails** choice between scoring with the heuristic and routing to the default model (`classifier_fallback`, the second option available only once the router has a default model), and the classifier context settings: **Context Window Size** (`classifier_context_window_size`), **Context Per-Turn Character Limit** (`classifier_context_per_turn_chars`), and an **Include Assistant Turns** toggle (`classifier_context_include_assistant_turns`). They are written only when the classifier type is LLM, and a value left at the default is omitted from the saved config so the backend default applies.

**Advanced > Session Affinity** holds the session pin, off to match the config default. Both the create tab and the edit modal write the value explicitly, so a router built in the UI records what it does rather than inheriting whatever the default happens to be.

## Claude Code and Claude Desktop

Two prerequisites before a router is selectable in a Claude client:

1. **The router's `model_name` has to read as an Anthropic model.** It needs `claude`, `anthropic`, or a family name such as `opus`, `sonnet`, or `haiku` somewhere in it, and no other vendor's name, so `claude-auto` is accepted where `smart-router` is rejected.
2. **On Claude for Teams or Enterprise, that name has to be on the organization's `availableModels` allowlist.** Anything missing from the allowlist is greyed out in the Claude Desktop picker and replaced at CLI startup with `restricted by your organization's settings`.

Both checks run in the client, so a router that fails either one leaves nothing in the LiteLLM logs to explain itself. See [Auto Router with Claude Code and Claude Desktop](../tutorials/claude_code_autorouter.md).

## See also

- Announcement post: [Auto Router v2: one router for complexity, semantic, and adaptive routing](/blog/autorouter-v2)
- Legacy semantic router: [Semantic Auto Router (deprecated)](./auto_routing_semantic.md)
