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

Three ways to pick a tier. Pick one; the router falls back to the heuristic scorer if no keyword rule matches, and, unless `classifier_fallback` says otherwise, if the LLM classifier errors.

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

### What gets classified

A request is not classified as a blob. The router extracts the **last real human ask** and the **latest system prompt** from the message list, and everything downstream reads those two strings rather than the raw payload. This matters most under an agent harness, where a single turn arrives as a huge shared system prefix, a pile of tool results, and a one-line ask.

Extraction walks the message list newest-first and returns the first user turn that still carries human text. Content is flattened by keeping `type == "text"` blocks only, so a turn whose content is entirely tool output flattens to the empty string and is skipped rather than accepted as the ask; on the Messages surface tool results ride non-text `tool_result` blocks on a user turn, and on chat completions they sit on the `tool` role, which is never read. Complete `<system-reminder>` ... `</system-reminder>` blocks are removed before the text is used, and the ask written around them survives. Marker matching is literal and case-insensitive, an unclosed opening tag is not a block and is left alone, and `reminder_markers` swaps in a different pair for a harness that brands its reminders differently. When every user turn holds nothing but plumbing there is no ask at all, and the request goes to `complexity_router_default_model` rather than letting harness-injected text pick the tier.

The consequence is the one an expert reader usually assumes is missing: "fix this typo" and "refactor the auth subsystem" are classified on those strings, not on the 40k-token system prefix and reminder blocks they share, so they do not land on the same tier.

The stripped human ask is the only text that reaches `keyword_tier_rules`, semantic keyword matching, escalation keywords, and the heuristic scorer's reasoning-marker dimension. The system prompt is extracted separately and is **not** reminder-stripped; it feeds the heuristic scorer's code, technical, and simple dimensions, and it is quoted into the LLM classifier payload. Reasoning markers deliberately read the human ask alone, which is what stops a `You are an expert engineer. Always think step by step.` system prompt from pinning every request in the session to `REASONING`. Escalation keywords are narrower still: they read only the newest user turn's stripped text, so one escalate request does not re-fire on each of the tool turns that follow it.

The heuristic override that forces `REASONING` on two or more reasoning markers is part of the scorer, so it applies when `classifier_type` is `heuristic` and on the scorer fallback after a failed classifier call. On the LLM classifier path the tier the classifier returns is used as-is.

The deprecated [semantic auto router](./auto_routing_semantic.md) has a much thinner contract. It takes the newest user message alone and returns whatever that message flattens to, with no reminder stripping, no system prompt, and no skipping, so a newest turn holding only tool-result blocks yields the empty string and gets embedded as such. What it does embed is cut to the first `auto_router_max_input_chars` characters (default 2000, head kept) before the call to `auto_router_embedding_model`, since a truncated prompt still routes where an over-long one errors out. Under an agent harness that reads as routing on the opening of one turn, which is the design an expert reader tends to assume the complexity router also has.

### Classifier context window

:::info

Context-window support ships in **v1.96.x** ([PR #35185](https://github.com/BerriAI/litellm/pull/35185)); assistant turns in the window arrived in the same release ([PR #35471](https://github.com/BerriAI/litellm/pull/35471)). On earlier versions the classifier saw only the current message, and these keys are silently ignored.

:::

The LLM classifier does not see the request in isolation. By default it also receives the last 3 prior turns of the conversation, truncated to 200 characters each, so a referring follow-up like "now do the same for the streaming path" is rated against what it refers to rather than on its own length. Without that context a hard follow-up mid-session classifies as whatever landed last, which in an agentic harness is often a `<system-reminder>` blob that barely varies across the session and pins every turn to one tier.

Only turns carrying text a human wrote count toward the window. Tool output never qualifies (`tool_result` blocks on the Messages surface, the `tool` role on chat completions), complete reminder blocks are stripped before a turn is considered (`<system-reminder>` ... `</system-reminder>` by default, another pair with `reminder_markers`), and a turn left empty after stripping is skipped rather than spending a slot. A turn whose text equals the ask being classified is excluded so the ask is never quoted twice. Prior turns are sent oldest first and numbered `[1]`, `[2]`, `[3]`, and a turn cut at the character limit gets a trailing `...` so the classifier can tell it was clipped. When prior conversation exists, a single depth line (`Conversation so far: ~N tokens across the request`) is included as well. That trajectory count is a rough four-characters-per-token estimate over the text of every message on the request, not a tokenizer count and not limited to the turns in the window, so it reads as a depth signal rather than as a billable number.

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

Set `classifier_context_window_size: 0` to turn it off; the classifier then receives the caller's latest system prompt and the current ask alone, no prior turns and no depth line, and the rubric closes on "classify only the current message" to match. Raise `classifier_context_per_turn_chars` if turns are being clipped before the part that carries the difficulty. Both settings apply only when `classifier_type: llm`; the heuristic scorer and keyword rules always read the current human ask alone.

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

### Session affinity pins a model name, not a deployment

The pin the complexity router stores is the **model name** it routed to, cached under `complexity_router_session_affinity:v1:<router name>:<key hash>:<session_id>` for `session_affinity_ttl_seconds`. Deployment selection then runs as usual underneath that name. If the tier entry names a model group fanned across several deployments (two Bedrock regions, Vertex plus the first-party Anthropic API, a pair of Azure resources), the session stays on one model and still spreads across those deployments, and each provider-side prefix cache sees a fraction of the session's turns. On a coding-agent workload, where the cache prefix is most of the request, that is the difference between reading a warm prefix and writing it again.

`DeploymentAffinityCheck` is the piece that closes it. It pins a concrete deployment id (`model_info.id`) rather than a model name, and it exists for exactly this implicit prompt-caching case. It is a separate Router pre-call check, enabled independently of anything on the router alias, and it takes two flags worth knowing apart:

| `optional_pre_call_checks` entry | Pins the deployment by |
| ------------------------------- | ---------------------- |
| `deployment_affinity`           | the caller's key hash (`metadata.user_api_key_hash`) |
| `session_affinity`              | `session_id` from request metadata |
| `responses_api_deployment_check` | `previous_response_id`, which wins over both above |

The `session_affinity` string in `optional_pre_call_checks` is a different setting from `session_affinity` inside `complexity_router_config`, despite the shared name. The first pins a deployment id under a Router pre-call check; the second pins a model name and skips reclassification. Both are worth having on an agent workload. `deployment_affinity_ttl_seconds` (default `3600`) is the TTL for the deployment pin, and it lives in `router_settings`, not on the router alias.

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

The third entry, `prompt_caching`, enables `PromptCachingDeploymentCheck`, which is prefix-driven rather than session-driven: after a successful completion it records the deployment that served the prompt keyed on the cacheable prefix (everything up to and including the last `cache_control` checkpoint), and sends the next request carrying that same prefix back to the same deployment. It only looks when the prompt clears the model's minimum cacheable token count, and it helps callers that send no `session_id` and no stable key, so it complements the two affinity pins rather than replacing either.

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

## Reported savings

Every auto-routed request records what it saved against a counterfactual: the one model an operator would have run instead of the router. The number is a subtraction, and only one side of it is hypothetical. What the request actually cost is read from the cost the biller already recorded for it, on the same service tier and data residency it was priced on, rather than re-derived, so it cannot disagree with the `spend` column beside it. The baseline never ran, so it is priced through the same cost engine on that same basis.

The baseline model is `litellm_settings.autorouter_savings_baseline_model` when you set one. Set nothing and the router derives it from its own ladder: without a router a deployment has to run one model able to carry the hardest request it will see, so the default baseline is the priciest model in the **hardest tier the router configures**, ranked once by costing a fixed reference request (20k prompt tokens of which 19k are cached, 1k completion) through the pricing engine rather than by comparing a chosen pair of rates. A router that only defines `SIMPLE` and `MEDIUM` is measured against the best it could actually have picked, not against a frontier model it never had.

```yaml
litellm_settings:
  autorouter_savings_baseline_model: anthropic/claude-opus-4-8   # optional; derived from the hardest tier when unset
```

Provider-qualify it. The baseline reaches the spend writer as a bare string, so `deepseek-r1` meaning Azure is priced against whoever else owns that name.

### The baseline is priced with a warm cache

The naive version of this arithmetic under-credits the always-frontier baseline badly, and the router does not use it. Because the baseline is one model serving every turn, whether it had this prompt cached is simply whether the conversation was already underway, which the router records as `conversation_continuing` on the decision (an assistant turn anywhere in the history is the evidence; no messages at all is treated as continuing, which is the direction that cannot inflate).

On a continuing turn where this request paid to write cache, those tokens move into the baseline's **cache-read** bucket and its cache-creation charge drops to zero: the single-model baseline wrote that prefix on an earlier turn and would only be reading it now. The write this request actually paid stays on the router's side of the subtraction, which is exactly the cost of having switched models. A continuing turn that mostly read from cache is treated differently on purpose, since the selected model was evidently already the one serving this conversation: when cache reads exceed cache writes the buckets stay put and both arms carry the write, because those written tokens are the turn's own growth and the baseline would have paid to write them too. A conversation's first turn keeps its buckets for the same reason, nothing was warm for any model.

One more correction runs on top: a baseline model with no cache-read or no cache-write rate of its own does not get those tokens for free, they become ordinary input at its plain rate. Every OpenAI, Azure, and Gemini entry prices cache writes implicitly, and treating an absent rate as zero would carry the whole prompt for nothing and turn a profitable route into a reported loss.

The result is signed. Switching models leaves the new one cold, and when the cache-creation charge that causes outweighs the cheaper per-token rates, the number goes negative and the dashboard says so.

### Where it shows up

Cache accounting is what makes the above auditable, and LiteLLM normalizes each provider's shape into the same fields: `cache_read_input_tokens` and `cache_creation_input_tokens` on the Anthropic surface, `prompt_tokens_details.cached_tokens` on the OpenAI-compatible surface, plus DeepSeek's `prompt_cache_hit_tokens`.

Per day and per entity those roll up into `cache_read_input_tokens` and `cache_creation_input_tokens` columns alongside `autorouter_savings_spend`, on the daily spend tables (`LiteLLM_DailyUserSpend`, `LiteLLM_DailyTeamSpend`, `LiteLLM_DailyTagSpend`, `LiteLLM_DailyOrganizationSpend`, `LiteLLM_DailyEndUserSpend`, `LiteLLM_DailyAgentSpend`). `GET /user/daily/activity` returns them under `metrics`, with a `total_autorouter_savings_spend` in the response metadata, and the Admin UI reads that endpoint for the **Cost Optimization** page, where the number is labeled "Auto-router savings".

:::note

`LiteLLM_SpendLogs` itself carries `prompt_tokens` and `completion_tokens` only, with no cache-token or savings columns; the per-request cache split lives in the usage object and the logging payload, and the persisted split is the daily rollup. What a single request does carry is its `routing_decision` in metadata, including `routed_model`, `cause`, `tier`, `conversation_continuing`, and the baseline the deciding router recorded.

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

Switching models is not the only axis a router can climb. Reasoning effort changes how many output tokens a request spends at the same per-token rate, while switching models changes the rate on every token in the request, so climbing effort on a cheap model is often the cheaper next step and worth exhausting before the tier ladder reaches for a frontier model.

Nothing new is needed to express that. Declare one `model_list` entry per rung, identical except for the reasoning parameter in its `litellm_params`, and point tiers at those names. When the router returns a tier's model name, that name resolves to its deployment and the deployment's own `litellm_params` are merged into the outbound request, with anything the caller sent explicitly winning over them. A client that sets `reasoning_effort` itself therefore keeps its value, and everyone else gets the rung.

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

Effort levels are per-model capabilities, so check the model supports the rung you are asking for: `gpt-5-mini` rejects `xhigh` while `gpt-5.4-mini` accepts it, and `drop_params: true` on the router alias turns that rejection into a silently dropped parameter, which reads as a ladder that changed nothing. Two more things to keep in mind. Cost tracking prices each rung under its underlying model, so a ladder built this way shows up in spend as one model at several effort levels rather than as separate models. And `session_affinity` pins the rung's `model_name`, which means a session that started on `gpt-5.4-mini-high` stays on that rung for the TTL rather than climbing mid-session.

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
