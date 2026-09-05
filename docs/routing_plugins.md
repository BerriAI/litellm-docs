# Routing Plugins

:::info

Routing plugins are available from **v1.92.x** (Thursday's release). The design is still evolving, so tell us how you'd use it and what you'd want next in the autorouter discussion on GitHub: [#32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

Routing plugins are a pipeline, where each plugin receives the routing context, enriches it, and passes it to the next plugin before the final routing decision.

Two configuration surfaces:

- **Python SDK.** Pass instances to `Router(plugins=[...])`. Runs on every routing decision.
- **Proxy YAML.** `complexity_router_config.plugins` accepts dotted-path refs. Runs inside the complexity router's tier-pick, against the tier's actual candidate pool.

Plugins don't replace the router. They enrich the routing context in a standardized way before the router makes the final decision.

The complexity auto-router takes a second, separate plugin for the other half of the decision: a classifier plugin names the tier instead of narrowing a pool. Same context object, different interface, and the two compose. See [Classifier plugins: choosing the tier](#classifier-plugins-choosing-the-tier).

## What plugins can and can't do

A plugin can:

- **Narrow `candidate_models`.** Removing entries restricts which deployments the Router may pick. Adding entries has no effect; only the initial deployment pool is dispatchable.
- **Publish `signals`.** Later plugins read them off `context.signals`; the Router and downstream strategies (auto-router, complexity-router, adaptive-router, quality-router) read them off `metadata["routing_plugin_signals"]`.
- **Stop the pipeline.** Raise from `run()` to short-circuit the request. Narrowing to zero candidates also aborts (raises `ValueError`).
- **Read `raw_messages` or `structured_messages`.** Read only. Neither is written back to the outgoing request. Read `structured_messages` for a provider-agnostic OpenAI chat-format shape; read `raw_messages` for the original wire payload (`/chat/completions`, `/v1/messages`, Responses API `input`, etc.).

A plugin cannot:

- **Mutate the request body.** Changing `context.raw_messages` or `context.structured_messages` doesn't rewrite the messages sent to the provider. For prompt rewriting, use a pre-call hook or guardrail; routing plugins are read-only over the request.
- **Mutate request metadata directly.** `context.metadata` is a copy. Publish through `context.signals` instead; the Router surfaces them on `metadata["routing_plugin_signals"]`.
- **Add deployments to the candidate pool.** Filtering is include/exclude only. A model added to `candidate_models` that isn't in the Router's `model_list` has no effect.
- **Choose the complexity router's tier.** A routing plugin runs against whichever tier was already classified. To decide the tier itself, write a [classifier plugin](#classifier-plugins-choosing-the-tier).

## Concrete end-to-end example

1. User sends a request.
2. Language plugin detects `en`.
3. Domain classifier labels it as `coding` with 0.93 confidence.
4. Tenant policy limits the allowed providers to OpenAI and Anthropic.
5. Budget plugin removes models exceeding the tenant's cost policy.
6. The Router receives the enriched routing context and selects the best remaining model.

## Quick start

```python
from litellm import Router
from litellm.types.router import RoutingContext


class LanguageDetector:
    async def run(self, context: RoutingContext) -> RoutingContext:
        context.signals["language-detector"] = {"lang": "en"}
        return context


class DomainClassifier:
    async def run(self, context: RoutingContext) -> RoutingContext:
        context.signals["domain-classifier"] = {"domain": "coding", "confidence": 0.93}
        return context


class TenantPolicy:
    ALLOWED = {"acme-corp": {"openai", "anthropic"}}

    async def run(self, context: RoutingContext) -> RoutingContext:
        tenant = context.metadata.get("tenant", "default")
        allowed = self.ALLOWED.get(tenant, {"openai", "anthropic", "self-hosted"})
        context.candidate_models = [
            m for m in context.candidate_models if m.split("/")[0] in allowed
        ]
        return context


class BudgetPolicy:
    COST_CAP_PER_TOKEN = 0.000001
    COST_BY_MODEL = {
        "openai/{{openai_small}}": 0.0000002,
        "anthropic/{{anthropic}}": 0.000002,
        "openai/{{openai_large}}": 0.000002,
    }

    async def run(self, context: RoutingContext) -> RoutingContext:
        context.candidate_models = [
            m for m in context.candidate_models
            if self.COST_BY_MODEL.get(m, 0) <= self.COST_CAP_PER_TOKEN
        ]
        return context


router = Router(
    model_list=[
        {"model_name": "smart-router", "litellm_params": {"model": "openai/{{openai_small}}"}},
        {"model_name": "smart-router", "litellm_params": {"model": "anthropic/{{anthropic}}"}},
        {"model_name": "smart-router", "litellm_params": {"model": "openai/{{openai_large}}"}},
        {"model_name": "smart-router", "litellm_params": {"model": "ollama/llama-3-70b"}},
    ],
    plugins=[LanguageDetector(), DomainClassifier(), TenantPolicy(), BudgetPolicy()],
)

response = await router.acompletion(
    model="smart-router",
    messages=[{"role": "user", "content": "Write a function to reverse a linked list."}],
    metadata={"tenant": "acme-corp"},
)
```

## The routing context

Plugin authors shouldn't need to understand every provider's request format. Work against a stable interface:

```python
class RoutingContext(BaseModel):
    raw_messages: list[dict[str, Any]]         # original request payload, read-only
    structured_messages: list[dict[str, Any]]  # normalized to OpenAI chat format, read-only
    candidate_models: list[str]                # provider/model; narrow to restrict Router
    metadata: dict[str, Any]                   # tenant, user, session info (copy; not writable back)
    signals: dict[str, Any]                    # write here to pass output downstream
```

A plugin is any object with `async def run(self, context) -> RoutingContext`.

## Request lifecycle

Plugins run pre-auto-routing. Ordering inside `async_pre_routing_hook`:

1. Request enters `acompletion()` (or another async Router entry point).
2. **Routing-plugin pipeline runs, in list order.** Each plugin's `run()` sees the previous plugin's mutations.
3. Auto-router / complexity-router / adaptive-router / quality-router dispatch, reading `metadata["routing_plugin_signals"]` if they key off plugin output.
4. Healthy-deployment filtering enforces the narrowed `candidate_models`, in the same slot as tag-based routing.
5. Routing strategy (`simple-shuffle`, `usage-based-routing-v2`, `cost-based-routing`, `latency-based-routing`, `least-busy`) picks a deployment from what's left.
6. Provider call fires.

The pipeline runs once per request. Narrowing to zero raises `ValueError`; a plugin returning no candidates is a policy decision and silently falling back to the unfiltered pool would defeat it.

## Combining with the complexity auto-router

Plugins compose with the complexity auto-router in two ways:

**Signals for the router to consume.** Anything a plugin writes to `context.signals` is surfaced on `metadata["routing_plugin_signals"]` before the router runs, so a domain-classifier plugin can publish its label and the router can key off it.

**Candidate narrowing as a hard policy gate.** Plugins narrow the tier's actual candidate pool. If a plugin drops every candidate in a tier, that call raises; the router does not fall back to `default_model`, since that would be an unconditional escape hatch around the policy.

### On the proxy (YAML)

Add `plugins` under `complexity_router_config`. Each entry is a dotted path to a `RoutingPlugin` instance, resolved the same way `litellm_settings.callbacks` are (path relative to `config.yaml`'s directory).

```yaml
model_list:
  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE: ["{{openai_small}}"]
          MEDIUM: ["{{openai_small}}"]
          COMPLEX: ["{{openai_large}}", "{{openai_small}}"]
          REASONING: ["{{openai_large}}", "{{openai_small}}"]
        default_model: {{openai_small}}
        plugins:
          - plugins.cost_ceiling_plugin.cost_ceiling_plugin

  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
```

Sibling `plugins/cost_ceiling_plugin.py`:

```python
class CostCeilingPlugin:
    def __init__(self, max_cost_per_token: float, cost_by_model: dict):
        self.max_cost_per_token = max_cost_per_token
        self.cost_by_model = cost_by_model

    async def run(self, context):
        context.candidate_models = [
            m for m in context.candidate_models
            if self.cost_by_model.get(m, 0.0) <= self.max_cost_per_token
        ]
        context.signals["cost-ceiling-plugin"] = {"max_cost_per_token": self.max_cost_per_token}
        return context


cost_ceiling_plugin = CostCeilingPlugin(
    max_cost_per_token=0.000001,
    cost_by_model={"{{openai_small}}": 2e-07, "{{openai_large}}": 2e-06},
)
```

The proxy resolves each dotted path at startup, validates the result is a `RoutingPlugin` (fails startup with a clear error otherwise), and wires the instance into every tier-pick site: weighted scoring, `keyword_tier_rules` overrides, and the no-user-message default-tier path. No route bypasses the pipeline.

For a `COMPLEX` request routed to a tier of `["{{openai_large}}", "{{openai_small}}"]`, `CostCeilingPlugin` drops `{{openai_large}}` (above the ceiling); every dispatch lands on `{{openai_small}}`.

Two behaviors to know when using plugins with the complexity router on the proxy:

- **`session_affinity` is disabled when plugins are configured.** The cache pins a session's first-turn model and skips the plugin pipeline on later turns otherwise, so a mid-session policy change (e.g. budget cap crossed) would only apply to turn one.
- **`adaptive=True` combined with `plugins` raises at config-validation time.** The bandit selector doesn't consume plugin-narrowed pools yet.

### From the SDK

Same wiring, plugins passed as instances to `Router(plugins=[...])`. Same rules: candidate narrowing runs against the classified tier's pool, zero survivors raises, `default_model` is not an escape hatch.

```python
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "{{openai_small}}", "litellm_params": {"model": "openai/{{openai_small}}"}},
        {"model_name": "{{openai_large}}", "litellm_params": {"model": "openai/{{openai_large}}"}},
        {
            "model_name": "smart-router",
            "litellm_params": {
                "model": "auto_router/complexity_router",
                "complexity_router_config": {
                    "tiers": {
                        "SIMPLE": ["{{openai_small}}"],
                        "COMPLEX": ["{{openai_large}}", "{{openai_small}}"],
                    },
                    "default_model": "{{openai_small}}",
                },
            },
        },
    ],
    plugins=[cost_ceiling_plugin],
)
```

## Classifier plugins: choosing the tier

A routing plugin narrows the pool the router picks from. A classifier plugin decides which pool that is. It replaces the complexity router's classification step, so instead of the heuristic scorer, an LLM classifier, or keyword rules deciding the tier, your code names it and the router serves that tier's models.

Reach for it when the tier does not follow from reading the prompt: route by team or tenant plan, by an entitlement in a service you own, by a flag you flip during an incident. Caller identity arrives on `context.metadata` (`user_api_key_team_id`, `user_api_key_team_alias`, `user_api_key_user_id`), so team-based or tenant-based tiering needs no plumbing of its own.

:::info

Classifier plugins ship in **v1.99.x** ([PR #37249](https://github.com/BerriAI/litellm/pull/37249)). Config file only, the same close-off `plugins` has: a live object does not travel over HTTP, so neither key can be set through the model-management API or the UI.

:::

Set `classifier_type: custom` and point `classifier_plugin` at a dotted path to a `ClassifierPlugin` instance, resolved at startup exactly like a `plugins` entry (relative to `config.yaml`'s directory). `classifier_plugin_timeout_ms` bounds the call and defaults to 3000.

```yaml title="config.yaml"
model_list:
  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        classifier_type: custom
        classifier_plugin: plugins.tier_by_team.tier_by_team
        classifier_plugin_timeout_ms: 3000
        tiers:
          SIMPLE: ["{{openai_small}}"]
          REASONING: ["{{openai_large}}", "{{openai_small}}"]
        default_model: {{openai_small}}

  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
```

Sibling `plugins/tier_by_team.py`:

```python
class TierByTeam:
    async def classify(self, context):
        team = context.metadata.get("user_api_key_team_alias")
        if team == "research":
            return "REASONING"
        if team == "support":
            return "SIMPLE"
        return None


tier_by_team = TierByTeam()
```

A classifier plugin is any object with `async def classify(self, context) -> str | None`. It receives the same `RoutingContext` a routing plugin does, and returns the name of a tier: a built-in tier (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`) or its `tier_labels` display name. Returning `None` declines the request and hands it to the configured fallback.

### How it differs from a routing plugin

`ClassifierPlugin` is a separate interface rather than an overload of `RoutingPlugin`, and the differences follow from what each one decides.

A router has one classifier and a list of routing plugins. `classifier_plugin` takes a single dotted path, `plugins` takes a list that runs as a pipeline; there is nothing to chain when the question is which tier, since the first answer is the answer.

`candidate_models` is informational here. It arrives as a snapshot of every tier's models so a classifier can see what the router serves, but the tier you return picks the pool, so filtering the list is a no-op. Narrowing is the routing pipeline's job.

Failure means the opposite thing in each seam. A routing plugin that narrows to zero raises, because narrowing to nothing is a policy decision and quietly widening the pool would defeat it. A classifier that declines, raises, exceeds `classifier_plugin_timeout_ms`, or names a tier the router does not recognize has produced no policy at all, so the request falls back the way it does when the LLM classifier fails: `classifier_fallback` sends it to the heuristic scorer, or to `default_model`. A classifier plugin that is down degrades routing; it never fails the request.

Config mistakes surface at startup, not on the first classified request. A dotted path that does not resolve to an object with an async `classify` is rejected with the config key named, `classifier_type: custom` without a plugin raises, and a `classifier_plugin` left under any other `classifier_type` raises too, since it would never run.

### Composing the two

Both keys live on the same `complexity_router_config` and a router may set both. The classifier picks the tier, then the routing pipeline filters that tier's pool, so a team-based classifier and a cost-ceiling routing plugin stack without either knowing about the other.

The two constraints noted above for `plugins` are specific to candidate narrowing and do not apply to a classifier plugin. `session_affinity` keeps working, since a classifier only runs on turns that are classified and the pin skips classification rather than policy. `adaptive: true` also composes, Thompson-sampling inside whichever tier the classifier returned, where `adaptive` combined with `plugins` still raises at config-validation time.

Everything else on the router behaves as documented: `keyword_tier_rules` short-circuit ahead of the classifier, escalation keywords can still escalate the tier it returned, and the `classifier_context_*` settings stay LLM-classifier only, since a plugin reads the messages itself. Each decision logs as `cause=classifier_plugin`. Full field reference on the [Auto Routing](./proxy/auto_routing.md#classification) page.

## Limitations

Async only. Sync `Router.completion()` raises when plugins are configured. Supported strategies: `simple-shuffle`, `usage-based-routing-v2`, `cost-based-routing`, `latency-based-routing`, `least-busy`, and `auto_router/*` (complexity router today). Legacy `usage-based-routing` (v1) raises.

Proxy YAML config is wired for the complexity router today. Other auto-routers (adaptive, semantic, quality) still require the SDK.

Current candidate filtering is include/exclude only. Weighted scoring, where plugins express preferences ("prefer Claude", "penalize expensive models") rather than eliminate models entirely, is not part of the first cut.

## Reference

Config: [`router_settings.plugins`](./proxy/config_settings#router_settings---reference).
PRs: [#32972](https://github.com/BerriAI/litellm/pull/32972) (SDK), [#33251](https://github.com/BerriAI/litellm/pull/33251) (proxy YAML for complexity router), [#37249](https://github.com/BerriAI/litellm/pull/37249) (classifier plugins). Discussion: [#32168](https://github.com/BerriAI/litellm/discussions/32168).

## Join the discussion

Available from **v1.92.x** (Thursday's release). We're actively shaping where routing plugins and the autorouter go next, and want your input on the plugins you'd write, the signals you'd want, and the routing strategies you'd reach for. Share your use case and follow along in the autorouter discussion on GitHub: [#32168](https://github.com/BerriAI/litellm/discussions/32168).
