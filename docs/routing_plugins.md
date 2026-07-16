# Routing Plugins

:::info

Routing plugins are available from **v1.92.x** (Thursday's release). The design is still evolving, so tell us how you'd use it and what you'd want next in the autorouter discussion on GitHub: [#32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

Routing plugins are a pipeline, where each plugin receives the routing context, enriches it, and passes it to the next plugin before the final routing decision.

Two configuration surfaces:

- **Python SDK.** Pass instances to `Router(plugins=[...])`. Runs on every routing decision.
- **Proxy YAML.** `complexity_router_config.plugins` accepts dotted-path refs. Runs inside the complexity router's tier-pick, against the tier's actual candidate pool.

Plugins don't replace the router. They enrich the routing context in a standardized way before the router makes the final decision.

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
    COST_CAP_PER_TOKEN = 0.000005
    COST_BY_MODEL = {
        "openai/gpt-4o-mini": 0.00000015,
        "anthropic/claude-haiku-4-5": 0.000001,
        "openai/gpt-5.1": 0.00003,
    }

    async def run(self, context: RoutingContext) -> RoutingContext:
        context.candidate_models = [
            m for m in context.candidate_models
            if self.COST_BY_MODEL.get(m, 0) <= self.COST_CAP_PER_TOKEN
        ]
        return context


router = Router(
    model_list=[
        {"model_name": "smart-router", "litellm_params": {"model": "openai/gpt-4o-mini"}},
        {"model_name": "smart-router", "litellm_params": {"model": "anthropic/claude-haiku-4-5"}},
        {"model_name": "smart-router", "litellm_params": {"model": "openai/gpt-5.1"}},
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
          SIMPLE: ["gpt-4o-mini"]
          MEDIUM: ["gpt-4o-mini"]
          COMPLEX: ["gpt-4o", "gpt-4o-mini"]
          REASONING: ["gpt-4o", "gpt-4o-mini"]
        default_model: gpt-4o-mini
        plugins:
          - plugins.cost_ceiling_plugin.cost_ceiling_plugin

  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
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
    cost_by_model={"gpt-4o-mini": 1.5e-07, "gpt-4o": 2.5e-06},
)
```

The proxy resolves each dotted path at startup, validates the result is a `RoutingPlugin` (fails startup with a clear error otherwise), and wires the instance into every tier-pick site: weighted scoring, `keyword_tier_rules` overrides, and the no-user-message default-tier path. No route bypasses the pipeline.

For a `COMPLEX` request routed to a tier of `["gpt-4o", "gpt-4o-mini"]`, `CostCeilingPlugin` drops `gpt-4o` (above the ceiling); every dispatch lands on `gpt-4o-mini`.

Two behaviors to know when using plugins with the complexity router on the proxy:

- **`session_affinity` is disabled when plugins are configured.** The cache pins a session's first-turn model and skips the plugin pipeline on later turns otherwise, so a mid-session policy change (e.g. budget cap crossed) would only apply to turn one.
- **`adaptive=True` combined with `plugins` raises at config-validation time.** The bandit selector doesn't consume plugin-narrowed pools yet.

### From the SDK

Same wiring, plugins passed as instances to `Router(plugins=[...])`. Same rules: candidate narrowing runs against the classified tier's pool, zero survivors raises, `default_model` is not an escape hatch.

```python
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "gpt-4o-mini", "litellm_params": {"model": "openai/gpt-4o-mini"}},
        {"model_name": "gpt-4o", "litellm_params": {"model": "openai/gpt-4o"}},
        {
            "model_name": "smart-router",
            "litellm_params": {
                "model": "auto_router/complexity_router",
                "complexity_router_config": {
                    "tiers": {
                        "SIMPLE": ["gpt-4o-mini"],
                        "COMPLEX": ["gpt-4o", "gpt-4o-mini"],
                    },
                    "default_model": "gpt-4o-mini",
                },
            },
        },
    ],
    plugins=[cost_ceiling_plugin],
)
```

## Limitations

Async only. Sync `Router.completion()` raises when plugins are configured. Supported strategies: `simple-shuffle`, `usage-based-routing-v2`, `cost-based-routing`, `latency-based-routing`, `least-busy`, and `auto_router/*` (complexity router today). Legacy `usage-based-routing` (v1) raises.

Proxy YAML config is wired for the complexity router today. Other auto-routers (adaptive, semantic, quality) still require the SDK.

Current candidate filtering is include/exclude only. Weighted scoring, where plugins express preferences ("prefer Claude", "penalize expensive models") rather than eliminate models entirely, is not part of the first cut.

## Reference

Config: [`router_settings.plugins`](./proxy/config_settings#router_settings---reference).
PRs: [#32972](https://github.com/BerriAI/litellm/pull/32972) (SDK), [#33251](https://github.com/BerriAI/litellm/pull/33251) (proxy YAML for complexity router). Discussion: [#32168](https://github.com/BerriAI/litellm/discussions/32168).

## Join the discussion

Available from **v1.92.x** (Thursday's release). We're actively shaping where routing plugins and the autorouter go next, and want your input on the plugins you'd write, the signals you'd want, and the routing strategies you'd reach for. Share your use case and follow along in the autorouter discussion on GitHub: [#32168](https://github.com/BerriAI/litellm/discussions/32168).
