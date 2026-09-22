---
title: "[Beta] Auto Routing"
sidebar_label: "[Beta] Auto Routing"
---

import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# [Beta] Auto Routing

One router for complexity, semantic, and adaptive routing. Classify each request with heuristics, an LLM classifier, JEV through TypeSafe System One Choice, lexical/semantic keyword rules, or your own classifier plugin, then route to a pinned model, a random pool, or a Thompson-sampled pool per tier

:::info Availability

Auto routing is in **beta**, so config keys and defaults can still change between releases. Ships in **v1.94.x**. The earliest dev release cuts **Tuesday, 2026-07-14**. Suggestions and feedback: [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

## When to use

| Feature      | Semantic Auto Router (deprecated) | Auto Routing (this page)                                                   |
| ------------ | --------------------------------- | -------------------------------------------------------------------------- |
| Classifier   | Embedding match on utterances     | Heuristics, LLM classifier, JEV, lexical/semantic keyword rules, or your own plugin |
| Tier value   | One model                         | One model, random pool, or adaptive (Thompson-sampled) pool                |
| Latency      | ~100-500ms (embedding call)       | Sub-millisecond (heuristic/keyword) or one small classifier call (LLM)     |
| Session pin  | No                                | Opt-in `session_affinity` (off by default), keyed by `session_id` metadata |
| Log          | No routing-cause signal           | `cause=` marker per decision (scorer, literal, semantic, session_pin, LLM, plugin) |
| Best for     | Intent-based routing              | Cost/quality tiering, hybrid rule + classifier setups, prompt-cache pinning |

The [semantic auto router](./auto_routing_semantic.md) is deprecated but still works for existing configs.

## Quick start (Proxy)

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params: {model: openai/{{openai_small}}, api_key: os.environ/OPENAI_API_KEY}
  - model_name: {{openai_large}}
    litellm_params: {model: openai/{{openai_large}}, api_key: os.environ/OPENAI_API_KEY}
  - model_name: {{anthropic}}
    litellm_params: {model: anthropic/{{anthropic}}, api_key: os.environ/ANTHROPIC_API_KEY}
  - model_name: {{anthropic_large}}
    litellm_params: {model: anthropic/{{anthropic_large}}, api_key: os.environ/ANTHROPIC_API_KEY}

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    {{openai_small}}
          MEDIUM:    {{openai_large}}
          COMPLEX:   {{anthropic}}
          REASONING: {{anthropic_large}}
      complexity_router_default_model: {{openai_large}}
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
        SIMPLE:    ["{{openai_small}}", "{{gemini_flash}}"]   # random-pick pool
        MEDIUM:    {{openai_large}}                                 # single pin
        COMPLEX:   {{anthropic}}
        REASONING: {{anthropic_large}}

      # Optional display names; omit to keep SIMPLE/MEDIUM/COMPLEX/REASONING everywhere
      # tier_labels:
      #   SIMPLE: Cheap

      # LLM classifier instead of the heuristic scorer
      classifier_type: llm
      classifier_llm_config:
        model: {{anthropic}}
        timeout_ms: 2000
        # system_prompt: <your rubric>         # replaces the built-in rubric entirely; omit for the default
      classifier_fallback: heuristic           # default; or default_model
      # Prior conversation the classifier sees (LLM or JEV)
      classifier_context_window_size: 3          # default 3; 0 disables
      classifier_context_budget_chars: 8000     # default 8000
      # classifier_context_per_turn_chars: 200  # optional per-turn cap; unset by default
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

      # Escalate a prompt that provably does not fit the decided tier, before dispatch
      enable_context_window_escalation: true   # default
      context_window_escalation_buffer: 0.95   # default; prompt must fit within this fraction of the window

      # Send image-bearing requests to a tier that can see them
      modality_routing: false   # default; set true to opt in

      # Classify new user asks only, carrying the decision through continuation turns
      classification_mode: every_request   # default; or user_turn

      # Thompson-sample within the tier's pool
      adaptive: true

      # Pin a session to its first-turn model to preserve prompt cache
      session_affinity: false   # default; set true to pin
      session_affinity_ttl_seconds: 3600

      # Return the model the router picked in the response body `model` field
      # instead of restamping it back to the alias the client called
      return_raw_model_name: false   # default

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

    complexity_router_default_model: {{anthropic}}

    # Compression guardrail per hop; a guardrail name, or `none`. Both unset (the
    # default) keeps whatever compression the key, team, or request already applies
    # on both hops
    # auto_router_routing_compression: headroom-compression
    # auto_router_model_compression: none
```

## Classification

Choose a classifier, with optional keyword rules before classification. Unless configured otherwise, an LLM, JEV or custom classifier failure falls back to the heuristic scorer

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

**LLM classifier.** Uses a small fast model (gpt-5.6-luna, Claude Sonnet 5, whatever you point it at) with structured output. Goes through the same `Router` instance, so credentials, budgets, and fallbacks apply. Timeout, empty content, or schema mismatch falls back to the heuristic scorer, or to `complexity_router_default_model` with `classifier_fallback: default_model`, which is what a classifier grading something other than complexity wants since a complexity score would produce a tier unrelated to its taxonomy.

```yaml
classifier_type: llm
classifier_llm_config:
  model: {{anthropic}}
  timeout_ms: 2000
```

### JEV classifier

Set `classifier_type: jev` with `jev_classifier_config` to use [TypeSafe System One](/docs/pass_through/typesafe). It sends one `questions.tier` Choice question to `POST /v1/systemone`, with the classification input in `state` and tier descriptions in `criteria`. The returned choice selects the existing tier pool. See [setup and dashboard instructions](/docs/auto_router/setup#jev-classifier-typesafe-ai)

```yaml
classifier_type: jev
jev_classifier_config:
  model: jev-latest
  timeout_ms: 3000
  circuit_breaker_enabled: true
  circuit_breaker_cooldown_seconds: 30
classifier_fallback: heuristic
classifier_context_window_size: 3
classifier_context_budget_chars: 8000
classifier_context_include_assistant_turns: false
```

| `jev_classifier_config` field | Default | Behavior |
| --- | --- | --- |
| `model` | `jev-latest` | TypeSafe model identifier, without a `typesafe/` prefix. Pin a version for a repeatable evaluation |
| `api_key` | `null` | Reads `TYPESAFE_API_KEY` from the server when omitted |
| `api_base` | `null` | Reads `TYPESAFE_API_BASE`, then falls back to `https://api.typesafe.ai`. An explicit value requires an explicit `api_key` |
| `timeout_ms` | `3000` | Deadline for a classification, at least 1 ms |
| `instructions` | `null` | Replaces the built-in question instructions. Omit to keep the default. Blank strings are rejected |
| `circuit_breaker_enabled` | `true` | Enables the process-local timeout breaker for this router instance |
| `circuit_breaker_cooldown_seconds` | `30` | Positive cooldown before one recovery probe is admitted |

#### Context sent to JEV

JEV shares the classifier context builder with the LLM classifier. `classifier_context_window_size` defaults to three prior user turns. `classifier_context_budget_chars` defaults to 8,000 characters of prior-turn text, taking the newest turns first. `classifier_context_per_turn_chars` is an optional positive cap with no default cap. `classifier_context_include_assistant_turns: true` includes assistant text and makes the window count both roles

Prior turns are sent to the configured TypeSafe endpoint by default, even if another provider serves the completion. Assistant turns are excluded unless enabled. Existing JEV routers gain this history behavior when upgrading to the [context integration](https://github.com/BerriAI/litellm/pull/41886). Set `classifier_context_window_size: 0` before upgrading to keep prior conversation out of JEV requests

These bounds cover prior-turn text. The current ask and extracted system text are outside that budget, as is the numbering around quoted turns. Recognized Claude Code requests omit their harness system text. A window size of `0` disables prior-turn context, and a character budget below `120` suppresses that block. Increasing context changes what is sent to TypeSafe and can change classification cost and tier choices

#### Fallback and recovery

Timeouts, HTTP failures, malformed responses, missing or unknown choices, and an open circuit use the existing classifier fallback. For built-in tiers, `classifier_fallback: heuristic` is the default. `classifier_fallback: default_model` sends the request to `litellm_params.complexity_router_default_model`. A configured `fallback_tier` takes precedence for custom tiers

The breaker opens on a recognized classification timeout. During its cooldown, requests use fallback without making another JEV call. After cooldown, one request probes recovery while others continue to fall back. A successful probe closes the breaker, and a failed probe reopens it. Ordinary non-timeout failures while closed use fallback without opening the breaker. This state belongs to one router instance in one process and is not shared across workers

The classifier deadline bounds waiting for classification. It does not guarantee that a canceled provider request was never received or billed, and a fallback completion can still fail at its own provider

#### Customization, licensing and authorization

Built-in JEV classification is available without an Enterprise license under the same policy as the built-in LLM classifier. Replacing `instructions` or defining `tier_definitions` uses the existing Enterprise custom-classifier capability. With `tier_definitions`, each description becomes the corresponding Choice criterion. JEV also supports the normal `enable_non_reasoning_tier` configuration

Dependency authorization identifies JEV as `typesafe/<configured model>` with role `evaluation`, alongside the router's tier, default and embedding dependencies. Restricted keys and team members need access to the dependencies they can invoke. Team-member management writes cannot supply `api_key` or `api_base`, even when the user can edit a router. Choosing JEV does not grant additional model or management permissions

#### Test Routing and accounting

`POST /auto_router/test_routing` classifies without sending a completion to the selected tier. A JEV call can still incur provider spend, as can a semantic embedding call. The request's `default_model` field selects the default for this preview. **Test Connection** also probes JEV and the configured model dependencies, so it can incur both classifier and completion charges

Test Routing checks access to the models it can call and enforces virtual-key budget limits before classification. Team and member policy also applies through management-route authorization. The preview does not bypass these checks because it skips the downstream completion

Successful JEV decisions record `cause: jev_classifier`, `classifier_model: typesafe/<model>`, `classifier_probabilities`, `classifier_confidence`, and `classifier_cost` when priceable. The model is the version returned by TypeSafe, or the configured model when the response omits it. Probabilities describe TypeSafe's choice, not independently measured correctness

JEV usage is logged as a separate classifier call with the originating request's identity metadata. Returned input/output tokens are priced using the model registry. Missing usage or pricing makes cost unknown. An HTTP response with usable usage can be logged even if its choice later fails validation, but a fallback decision does not guarantee a `classifier_cost` value. When reconciling spend, inspect the separate classifier row as well as the parent completion

For successful classifications, reported Auto Router savings deduct `classifier_cost`. Do not add that metadata again when summing spend rows that already include the classifier call. See [evaluation and savings accounting](/docs/auto_router/evaluate#evaluate-jev-on-your-own-prompts) and the [benchmark's cost scope](/blog/jev-auto-router-benchmark)

### Keyword rules

Deterministic short-circuit. Match a keyword, land in that tier. When multiple rules match, routing escalates to the highest tier (`SIMPLE < MEDIUM < COMPLEX < REASONING`) so rule order does not silently change behavior

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
        SIMPLE:    {{openai_small}}
        REASONING: {{openai_large}}
    complexity_router_default_model: {{openai_small}}
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

The LLM and JEV classifiers receive up to three prior user turns by default, within an 8,000-character prior-turn budget. A follow-up like "now do the same for the streaming path" can then be rated against what it refers to. `classifier_context_per_turn_chars` optionally caps each turn before the total budget applies, and is unset by default

By default, only turns carrying text a human wrote count toward the window. Tool output never qualifies (`tool_result` blocks on the Messages surface, the `tool` role on chat completions), complete reminder blocks are stripped before a turn is considered (`<system-reminder>` ... `</system-reminder>` by default, another pair with `reminder_markers`), and a turn left empty after stripping is skipped rather than spending a slot. Set `classifier_context_include_assistant_turns` to include assistant turns too; see [Assistant turns in the context window](#assistant-turns-in-the-context-window) below. A turn whose text equals the ask being classified is excluded so the ask is never quoted twice. Prior turns are sent oldest first and numbered `[1]`, `[2]`, `[3]`, and a turn cut at the character limit gets a trailing `...` so the classifier can tell it was clipped. When prior conversation exists, a single depth line (`Conversation so far: ~N tokens across the request`) is included as well. That trajectory count is a rough four-characters-per-token estimate over the text of every message on the request, not a tokenizer count and not limited to the turns in the window, so it reads as a depth signal rather than as a billable number

On the LLM path, the system role carries the operator's rubric, while caller-supplied context is quoted in the user turn. JEV sends this classification context as `state` with the instructions on the Choice question. A three-turn conversation on the LLM path produces:

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

Set `classifier_context_window_size: 0` to disable prior-turn context and the depth line. The current ask and extracted system text remain outside the prior-turn budget, except that recognized Claude Code harness system text is omitted. Raise `classifier_context_budget_chars` or an explicit per-turn cap if relevant context is clipped. These context controls also apply to JEV. Keyword matching still reads the human ask, and the heuristic scorer does not use this prior-turn window

Note that `session_affinity` skips reclassification after a session's first turn, so on a router that turns it on the context window only comes into play on turn one, or on requests where no `session_id` is resolvable from metadata. It is off by default, so by default every turn is classified and the window applies throughout.

### Assistant turns in the context window

`classifier_context_include_assistant_turns` is off by default and puts the model's own replies in the window. It exists for the conversation where difficulty is stated by the assistant rather than by the user: the assistant answers "here is the plan, it is complex, should I execute?", the user answers "yes", and with user turns alone the router rates the word "yes" and picks the cheapest tier. With it on, the classifier rates the work the current message approves, judged in the conversation it continues.

```yaml
classifier_type: llm
classifier_llm_config:
  model: {{anthropic}}
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
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
  # same tier, second deployment: this is the fan-out a model-name pin cannot hold
  - model_name: {{anthropic}}
    litellm_params:
      model: bedrock/us.anthropic.{{anthropic}}
      aws_region_name: us-east-1
  - model_name: {{anthropic_large}}
    litellm_params:
      model: anthropic/{{anthropic_large}}
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-auto
    litellm_params:
      model: auto_router/complexity_router
      cache_control_injection_points:
        - location: message
          role: system
      complexity_router_config:
        tiers:
          SIMPLE:    {{openai_small}}
          MEDIUM:    {{anthropic}}
          COMPLEX:   {{anthropic}}
          REASONING: {{anthropic_large}}
        session_affinity: true
        session_affinity_ttl_seconds: 3600
      complexity_router_default_model: {{anthropic}}

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
ComplexityRouter: routing decision cause=complexity_scorer,      tier=SIMPLE,     score=-0.150, signals=['short (7 tokens)', 'simple (what is)'], routed_model={{openai_small}}
ComplexityRouter: routing decision cause=literal_keyword_match,  tier=REASONING,                                                                    routed_model={{openai_large}}
ComplexityRouter: routing decision cause=semantic_keyword_match, tier=REASONING,                                                                    routed_model={{openai_large}}
ComplexityRouter: routing decision cause=llm_classifier,         tier=COMPLEX,    score=1.000, signals=['llm-classifier:COMPLEX'],                  routed_model={{anthropic}}
ComplexityRouter: routing decision cause=classifier_plugin,      tier=REASONING,  score=n/a,   signals=['classifier-plugin:REASONING'],             routed_model={{openai_large}}
ComplexityRouter: routing decision cause=session_affinity_pin,                                                                                      routed_model={{openai_large}}
```

## Reading the picked model from the response

By default the response body `model` field stays the alias you called (`smart-router`), matching the OpenAI convention that a client gets back the model name it asked for, and the tier that actually answered is reachable only through the [`x-litellm-model-id` response header](./response_headers.md#litellm-specific-headers). Clients that cannot read response headers, including framework wrappers and streaming consumers that only see body chunks, need the value in the body.

Set `return_raw_model_name` on the router to put it there. The proxy then skips the restamp and leaves the resolved model in `model`, on the non-streaming response and on every streaming chunk:

```yaml
- model_name: smart-router
  litellm_params:
    model: auto_router/complexity_router
    complexity_router_config:
      tiers:
        SIMPLE:    {{openai_small}}
        REASONING: {{openai_large}}
      return_raw_model_name: true   # default false
```

The same switch is on the auto router tab in the UI, as "Return raw model name".

Non-streaming:

```json
{
  "id": "chatcmpl-abc123",
  "model": "{{openai_large}}",
  "choices": [{"...": "..."}]
}
```

Streaming, on every SSE chunk rather than only the first or the last:

```
data: {"id":"chatcmpl-abc123","model":"{{openai_large}}","choices":[{"delta":{"content":"The"},"...":"..."}]}

data: {"id":"chatcmpl-abc123","model":"{{openai_large}}","choices":[{"delta":{"content":" sum"},"...":"..."}]}
```

Because `model` is a standard OpenAI response field, every SDK and framework already carries it through to application code; nothing needs to read raw chunks. In LangChain it arrives as `response_metadata.model_name`, on the final chunk when streaming.

Two things change once the flag is on. Callers stop getting back the alias they sent, which some clients assert on. And the value is the resolved model as the deployment reports it, so a provider-prefixed identifier such as `hosted_vllm/my-model` reaches the client verbatim rather than the `model_list` `model_name` that the [decision log](#decision-log) prints as `routed_model=`.

:::info No dedicated body field

The v1.99 release candidates briefly carried a separate `router_model_name` body field for this ([PR #37725](https://github.com/BerriAI/litellm/pull/37725)), added with LangChain callers in mind. It never reached them: `@langchain/openai` builds `additional_kwargs` and `response_metadata` from fixed key allowlists and drops unknown fields at both the top level of a chunk and inside `delta`, so no proxy-side placement of a namespaced key could work. The field was removed before the stable release in favor of `return_raw_model_name`, which lands in the `model` field that LangChain does propagate.

:::

## Reported savings

Every auto-routed request records what routing saved against a counterfactual: the one model the traffic would have run on without a router, net of what the routing decision itself cost

```text
savings = cost(baseline model, this request)
        - cost(the model the router picked, this request)
        - cost(the classifier call that routed it)
```

- **The baseline is derived, not configured.** Without a router a deployment has to pick one model able to carry the hardest request it will see, so the baseline is the most expensive model in the hardest tier the router configures. Hardest *configured*, so a router defining only `SIMPLE` and `MEDIUM` is measured against the best it could actually have picked. A tier naming a pool contributes every model in it, and self-defined tier labels carry no severity order, so there every model across every tier competes
- **"Most expensive" is settled by cost, not by rate**, since a model dearer per output token can be cheaper per cached token. Candidates are priced once against a fixed reference request (20k prompt tokens: 19k cache reads and a 1k cache write, plus 1k completion) through the same engine the savings use. Unpriceable candidates drop out, and if none price the driver reports zero. The ranking is pinned per router instance, so it stays off the per-request path
- **Only one side is hypothetical.** What the request actually cost is read back from what the cost calculator recorded, on the service tier and data residency it was billed on, rather than re-derived; the baseline never ran, so it is priced through the same engine on that same basis. That figure is input plus output cost, leaving built-in tool cost, discounts and margins outside the comparison
- **The result is signed.** Switching models leaves the new one cold, and when the resulting cache-creation charge outweighs the cheaper rates the number goes negative and the dashboard says so
- **The classifier's own charge counts against the saving** (v1.100 and later). An LLM classifier records what its call cost on the routing decision as `classifier_cost`, and the reported figure is net of it, so the number is what routing earned after paying for the decision. A decision the heuristic made on its own records no charge, and nothing is deducted there
- **Zero savings retains both costs.** For supported native Anthropic requests, complete observed usage establishes equal model costs while the recorded session has used the exact baseline deployment at the same prices, including overlapping requests. Both costs remain nonzero when the request was billable. A recorded classifier charge still counts against savings. After routing diverges, returning to the same model requires cache-history evidence; model identity alone does not establish zero savings. Missing pricing or evidence produces an unavailable estimate

### Cache-prefix history and expiry {#the-baseline-is-priced-with-a-warm-cache}

For supported native Anthropic `/v1/messages` requests, a baseline cache read requires a matching prefix that was available when the request started and remained within its five-minute or one-hour TTL. A prefix known to have expired is charged as a write. Requests served by cheaper models advance the hypothetical baseline history too. An assistant message alone does not establish a cache hit

Use a stable session ID, a configured proxy database and enabled spend logging. Accounting runs after inference and replays recorded observations in request-start order. Late observations can temporarily withdraw affected estimates while request, session and daily totals are corrected. Actual billed spend remains recorded throughout

Baseline token counting requires the same endpoint and API key as the served request. An Anthropic-compatible gateway must support native counting for every required prefix, including system or tools without messages. Missing or timed-out counts produce unknown estimates; a local tokenizer or invented message cannot establish a cache hit

The comparison holds recorded prompts, output usage and request timing fixed. It does not predict alternate model responses, provider evictions or unrecorded traffic. Legacy sessions do not become new baseline-identical sessions merely because their recorded history is unavailable. Inactive session history is pruned according to session retention, and reusing a retired session ID does not establish another initial estimate

Some Claude Code beta headers and `context_management` shapes remain unsupported for modeled cache accounting. Initial baseline-identical requests can still use complete observed usage. Support after switching models depends on the actual request shape and available prefix counts

### Estimate coverage

The dashboard compares baseline and routed costs over the same estimated turns, including turns with numeric zero savings. It shows how many turns have estimates alongside total actual spend. Unknown and pending turns contribute to neither comparison cost, while their actual spend remains in the total. Existing session-status clients receive no baseline total when coverage is partial

For example, a baseline-identical request costing $0.10 has $0.10 baseline cost, $0.10 routed model cost and $0 model savings. If the next turn has unavailable cache history, its billed spend is still recorded but it is excluded from both sides of the savings comparison

### Where it shows up

- **Usage**, normalized from each provider's own shape: `cache_read_input_tokens` and `cache_creation_input_tokens` on the Anthropic surface, `prompt_tokens_details.cached_tokens` on the OpenAI-compatible surface, plus DeepSeek's `prompt_cache_hit_tokens`
- **Daily rollups**: `cache_read_input_tokens` and `cache_creation_input_tokens` columns alongside `autorouter_savings_spend`, on `LiteLLM_DailyUserSpend`, `LiteLLM_DailyTeamSpend`, `LiteLLM_DailyTagSpend`, `LiteLLM_DailyOrganizationSpend`, `LiteLLM_DailyEndUserSpend` and `LiteLLM_DailyAgentSpend`
- **API**: `GET /user/daily/activity` returns them under `metrics`, with a `total_autorouter_savings_spend` in the response metadata
- **UI**: the **Cost Optimization** page reads that endpoint, where the number is labeled "Auto-router savings". Its Auto-Router Benchmarks tab folds each turn's `classifier_cost` into that turn's spend, so the savings percentage there is net savings measured against the full baseline cost

:::note

`LiteLLM_SpendLogs` has no cache-token or savings columns, so the split is not queryable there; the daily rollup above is. The usage carrying that split does ride in the row's `metadata` under `usage_object`, which is what the daily savings writer reads back to rebuild `Usage`. Its `cache_hit` and `cache_key` columns are unrelated, describing LiteLLM's own response cache rather than provider-side prompt caching. Routing itself persists as `routing_decision` in metadata: `routed_model`, `cause` and `conversation_continuing` always, `tier` when a tier was determined, `classifier_cost` when the LLM classifier ran, and the derived baseline alongside the deployment it resolved to. The net figure is stamped on that metadata as `autorouter_savings`. The versioned `autorouter_savings_estimate` records comparison identity, provenance, status, reason and both comparison costs. Readers use the recorded estimate and its coverage

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

## Compression

From v1.101.0 an auto router can name a compression guardrail for each of the two hops a routed request makes: the classifier call that decides the tier, and the call to the model it routes to. Both fields sit on the marker's `litellm_params` next to `complexity_router_default_model`, take the name of a [Headroom](./headroom.md), [Compresr](./guardrails/compresr.md), or [TypeSafe](./guardrails/typesafe.md) guardrail, and accept `none`, case-insensitive, for a hop that should not be compressed at all.

```yaml title="config.yaml"
- model_name: smart-router
  litellm_params:
    model: auto_router/complexity_router
    complexity_router_config: {...}
    auto_router_routing_compression: headroom-compression
    auto_router_model_compression: none
```

Leaving both unset preserves what every existing router does today: a single compression pass, whichever one the key, team, or request already selected, feeding both hops. Setting either field makes the router authoritative for the requests it serves instead, and every other compression guardrail is suppressed for them, including one marked `default_on` and one the caller named in the request body. Ordinary deployments on the same proxy are untouched. Naming the same guardrail on both hops runs it once and reuses the result rather than compressing the same text twice.

A name that does not resolve to an active compression guardrail costs a warning in the proxy logs and an uncompressed hop rather than a failed request. Errors from a guardrail that does resolve still behave as that guardrail is configured to behave, so a compression service that is unreachable and set to fail closed still fails the request before any provider call.

Two things are worth knowing before rolling this out. Compressing the routing hop only saves tokens when the LLM classifier is what runs, since that is the only classifier that sends the text to a model; the heuristic scorers read it locally for free, and the deprecated semantic router embeds only the last user message, which compression leaves alone. And when the two hops name different guardrails, the model hop compresses first, so the classifier reads the model-compressed text rather than the original. Routing deliberately reads the live messages: the only uncompressed copy available is the one taken before the pre-call guardrails run, and handing that to a compression service would ship a masking guardrail's own input to a third party.

## Context window

An auto router entry is a marker rather than a callable model, so it carries no provider metadata of its own and advertises no context window until you declare one. The number is not derived from the tier models: not the minimum across them, not the maximum, and not the window of `complexity_router_default_model`. Tiers hold model names the proxy resolves at request time, and nothing in the model-info path walks that list. Until you declare a window, `GET /v1/models` omits `max_input_tokens` and `max_output_tokens` for the router entirely, and `/model_group/info` reports `null` for both.

Declare it in `model_info` on the router entry:

```yaml title="config.yaml"
- model_name: smart-router
  litellm_params:
    model: auto_router/complexity_router
    complexity_router_config:
      tiers:
        SIMPLE:    {{openai_small}}
        REASONING: {{openai_large}}
    complexity_router_default_model: {{openai_large}}
  model_info:
    max_input_tokens: 200000
    max_output_tokens: 64000
```

Both values then appear on `/v1/models`, `/model/info`, and `/model_group/info`, which is what clients and the LiteLLM UI read. They are advisory. Nothing gates, escalates, or rejects a request against the window declared on the router entry, so pick a number that describes the router honestly to callers; the smallest window a request might land on is the conservative choice, and the largest is the optimistic one.

Where a `model_name` fronts both a router marker and ordinary deployments, `/model_group/info` reports the largest `max_input_tokens` in that group rather than the smallest, since model-group metadata aggregates by maximum across deployments.

:::info Cost fields read zero on a router entry

`/model_group/info` reports `input_cost_per_token` and `output_cost_per_token` as `0.0` for an auto router, and its `providers` as an empty string, because custom pricing on a strategy alias is deliberately excluded from the cost map. Spend is still tracked against the tier model that served the request, so those zeros are a gap in this metadata view rather than untracked usage.

:::

### What enforces the window

Routing resolves first. The router picks a tier, the marker drops out of the candidate pool, and everything after that is ordinary model-group behavior applied to the selected model: deployment selection, cooldowns, tag routing, and context-window pre-call checks against that deployment's own `max_input_tokens`. Enforcement therefore depends on `router_settings.enable_pre_call_checks: true` and on a window being declared or resolvable for the tier deployments, never on the router entry. See [Context Window Fallbacks](./reliability.md#context-window-fallbacks-pre-call-checks--fallbacks).

`context_window_fallbacks` are resolved against the tier the router selected first and the name the client called second, so a chain keyed on either `smart-router` or the tier's own model group is honored.

`auto_router_max_input_chars` is unrelated to any of this. It truncates the text handed to the embedding model that matches routes on a semantic router, and defaults to 2000 characters.

### Context-window escalation

From v1.101.0 the complexity router checks whether the decided tier can hold the prompt before dispatch and moves the request when it provably cannot. This is on by default.

```yaml title="config.yaml"
complexity_router_config:
  enable_context_window_escalation: true   # default
  context_window_escalation_buffer: 0.95   # default
```

The estimate covers the whole prompt footprint, including the top-level `system` block, Responses API `instructions`, and serialized tool definitions, which carry most of the payload on coding-agent traffic. A tier model qualifies when the count fits within `context_window_escalation_buffer` of its declared window, so the default keeps 5% of headroom instead of gambling on prompts that land near the limit. Where only some of the tier's models fit, the tier keeps the request and the pick narrows to those; where none fit, the request moves to the lowest higher tier holding a model that provably fits.

Unknown windows are left alone in both directions. A model group with no resolvable window is never escalated away from, because its misfit cannot be proven, and never escalated onto, because its fit cannot be proven either. A group counts as unproven if even one of its deployments lacks a window, since the group is only as safe as its smallest member. When nothing anywhere provably fits, the classified tier stands and the request dispatches, so escalation never raises on its own and never diverts to `complexity_router_default_model`.

The window escalation reads is `model_info.max_input_tokens` on each tier deployment, falling back to the model cost map. Declaring a window on the router entry has no effect here. Escalated decisions log `context_escalated` alongside the tier the classifier originally picked, and they are never session-pinned, so routing comes back down when the session does.

Both keys belong inside `complexity_router_config`. Setting either one level up, directly under `litellm_params`, is rejected at load and on management-endpoint writes rather than silently ignored.

## Effort ladders

Switching models is not the only axis a router can climb. Reasoning effort changes how many output tokens a request spends at the same per-token rate, while switching models changes the rate on every token in the request, so climbing effort on a cheap model is often the cheaper next step and worth exhausting before the tier ladder reaches for a frontier model

Nothing new is needed to express that. Declare one `model_list` entry per rung, identical except for the reasoning parameter in its `litellm_params`, and point tiers at those names. When the router returns a tier's model name, that name resolves to its deployment and the deployment's own `litellm_params` are merged into the outbound request, with anything the caller sent explicitly winning over them. A client that sets `reasoning_effort` itself therefore keeps its value, and everyone else gets the rung

```yaml
model_list:
  - model_name: {{openai_small}}-low
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      reasoning_effort: low

  # same model and the same per-token rate as the rung above, more thinking
  - model_name: {{openai_small}}-high
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      reasoning_effort: high
  - model_name: {{openai_small}}-xhigh
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
      reasoning_effort: xhigh

  # top rung: a different rate on every token
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      drop_params: true
      complexity_router_config:
        tiers:
          SIMPLE:    {{openai_small}}-low
          MEDIUM:    {{openai_small}}-high
          COMPLEX:   {{openai_small}}-xhigh
          REASONING: {{openai_large}}
      complexity_router_default_model: {{openai_small}}-high
```

Anthropic-family rungs use `thinking` the same way, since it is an ordinary `litellm_params` key:

```yaml
  - model_name: claude-sonnet-5-thinking
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
      thinking: {type: enabled, budget_tokens: 8192}
```

Effort levels are per-model capabilities, so check the model supports the rung you are asking for: `gpt-5-mini` rejects `xhigh` while `gpt-5.4-mini` accepts it, and `drop_params: true` on the router alias turns that rejection into a silently dropped parameter, which reads as a ladder that changed nothing. Two more things to keep in mind. Cost tracking prices each rung under its underlying model, so a ladder built this way shows up in spend as one model at several effort levels rather than as separate models. And `session_affinity` pins the rung's `model_name`; the TTL is refreshed on cache hits, and an escalation request can move the pin up a tier rather than leaving it on a hard fixed-duration lock

## Python SDK

```python
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "{{openai_small}}",   "litellm_params": {"model": "{{openai_small}}"}},
        {"model_name": "{{openai_large}}",        "litellm_params": {"model": "{{openai_large}}"}},
        {"model_name": "claude-sonnet", "litellm_params": {"model": "{{anthropic}}"}},
        {"model_name": "claude-opus",   "litellm_params": {"model": "{{anthropic_large}}"}},
        {
            "model_name": "smart-router",
            "litellm_params": {
                "model": "auto_router/complexity_router",
                "complexity_router_config": {
                    "tiers": {
                        "SIMPLE":    "{{openai_small}}",
                        "MEDIUM":    "{{openai_large}}",
                        "COMPLEX":   "claude-sonnet",
                        "REASONING": "claude-opus",
                    },
                    "session_affinity": True,
                },
                "complexity_router_default_model": "{{openai_large}}",
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

Models + Endpoints > Add Model > Auto Router tab. Enter a router name, then click **Configure automatically** to have LiteLLM check the models your proxy already serves, select the best available models for all four complexity tiers, and fill in the form for you. Review the generated tiers before saving. You can also use the **Template** dropdown to pick one of the bundled templates to prefill all four tiers, or **Custom Configuration** to fill them in yourself. A template whose models this proxy does not serve is greyed out with the missing names, so anything selectable is applicable. Everything else lives under **Detailed Configuration**, collapsed by default with a one-line summary of the tiers it currently holds; expand it to set the tier model groups, tier display names, Semantic Keyword Matching, LLM Classifier, escalation keywords, or Adaptive.

**Test Routing** sends the input through the form's classifier without creating a router or calling the selected completion model. LLM and JEV classifier calls and semantic embedding calls can incur spend. **Test Connection** probes the configured model dependencies and, for JEV, separately checks that classification succeeded. See [JEV Test Routing and accounting](#test-routing-and-accounting)

Tier and classifier dropdowns exclude embedding-mode models; the semantic embedding dropdown lists only embedding-mode models. All four tiers are required on submit; missing tiers are flagged inline.

Selecting **LLM Classifier** exposes its model, timeout and prompt editor. **JEV Classifier** exposes JEV model, timeout, circuit breaker and instructions. Both expose classifier fallback, **Context Window Size**, **Context Character Budget**, and **Include Assistant Turns**. See [JEV dashboard setup](/docs/auto_router/setup#create-or-edit-in-the-dashboard) for the create and edit flow

**Advanced > Session Affinity** holds the session pin, off to match the config default. Both the create tab and the edit modal write the value explicitly, so a router built in the UI records what it does rather than inheriting whatever the default happens to be.

**Advanced > Compression** picks the compression guardrail for the routing decision, then either reuses it for the model call or takes a different one, `None` included. Editing a router back to *not configured* does not clear a policy that was already saved, because a model update merges the fields it is given and never deletes a key, so picking **None** for both hops is how you turn compression off from the modal. Legacy semantic auto routers (`auto_router/<name>`) accept both fields through `config.yaml` and the model-management API but have no control for them in the UI yet.

## Claude Code and Claude Desktop

Two things decide whether a router shows up in a Claude client, and only one of them is about the name:

1. **Gateway model discovery only picks up a `model_name` containing `claude` or `anthropic`.** That's the whole filter Claude Code applies when it populates the `/model` picker from `/v1/models`; a name like `smart-router` just doesn't get auto-discovered. It still works fine if you point `ANTHROPIC_MODEL` or `ANTHROPIC_CUSTOM_MODEL_OPTION` at it directly, which skips discovery and its filter entirely.
2. **On Claude for Teams or Enterprise, the name has to be on the organization's `availableModels` allowlist.** Anything missing from the allowlist is greyed out in the Claude Desktop picker and replaced at CLI startup with `restricted by your organization's settings`, regardless of whether the name looks Anthropic.

The allowlist check runs client-side, so a router excluded by it leaves nothing in the LiteLLM logs to explain itself. See [Auto Router with Claude Code and Claude Desktop](../tutorials/claude_code_autorouter.md).

## See also

- Announcement post: [Auto Router v2: one router for complexity, semantic, and adaptive routing](/blog/autorouter-v2)
- Local Claude Code preview: [lite autoroute](../learn/autorouter_cli.md)
- Legacy semantic router: [Semantic Auto Router (deprecated)](./auto_routing_semantic.md)
