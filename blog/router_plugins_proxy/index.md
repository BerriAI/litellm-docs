---
slug: router-plugins-on-the-proxy
title: "Announcing Router Plugins: Customize Routing Signals"
date: 2026-07-17T12:00:00
authors:
  - krrish
description: "Router plugins are now live on LiteLLM. Configure a plugin pipeline to determine which models to pick for a given input. Plugins can be chained as well"
tags: [routing, complexity-router, plugins, proxy, product]
hide_table_of_contents: false
---

:::info Availability

Router plugins run on the proxy from **v1.94.x**. The design is still evolving; tell us how you'd use it and what you'd want next in the [autorouter discussion on GitHub (#32168)](https://github.com/BerriAI/litellm/discussions/32168).

:::

Router plugins are now available on LiteLLM. Each plugin receives the routing context, enriches it, and hands it to the next before the router makes the final decision.

The push came from the [autorouter discussion (#32168)](https://github.com/BerriAI/litellm/discussions/32168): teams wanted to layer their own signals (language detection, domain classification, tenant policy, budget caps) onto routing without waiting for each one to land in core. This plugin extension lets teams make these changes while keeping LiteLLM's routing core stable.

{/* truncate */}

## Get Started

A plugin is any object with an `async run` method that takes the routing context and returns it. Narrow `candidate_models` to restrict what the router can pick, and write to `signals` to pass information downstream.

Write one next to your `config.yaml` in `plugins/cheap_first.py`:

```python
from litellm.types.router import RoutingContext


class CheapFirst:
    async def run(self, context: RoutingContext) -> RoutingContext:
        cheaper = [m for m in context.candidate_models if "mini" in m]
        context.candidate_models = cheaper or context.candidate_models
        context.signals["cheap-first"] = {"applied": bool(cheaper)}
        return context


cheap_first_plugin = CheapFirst()
```

Reference it from `router_settings.plugins` by its dotted path. The proxy loads it from the local file next to `config.yaml`, or from an installed pip package using the same syntax:

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

router_settings:
  plugins:
    - plugins.cheap_first.cheap_first_plugin
```

Start the proxy, and every routing decision now runs through your plugin:

```bash
litellm --config config.yaml
```

## Chaining plugins

Plugins run as a pipeline in list order, and each one sees the mutations and signals the previous plugin left behind. Add a second plugin in `plugins/enterprise_only.py` that reads the tenant off `context.metadata` and, for enterprise callers, restricts the pool to the models it left; it can also read the `cheap-first` signal published upstream:

```python
from litellm.types.router import RoutingContext


class EnterpriseOnly:
    ENTERPRISE = {"acme-corp", "globex"}

    async def run(self, context: RoutingContext) -> RoutingContext:
        tenant = context.metadata.get("tenant", "default")
        if tenant in self.ENTERPRISE:
            context.candidate_models = [
                m for m in context.candidate_models if "gpt-4o" in m
            ]
        # signals from earlier plugins are available here
        cheap = context.signals.get("cheap-first", {}).get("applied")
        context.signals["enterprise-only"] = {"tenant": tenant, "after_cheap": cheap}
        return context


enterprise_only_plugin = EnterpriseOnly()
```

List both under `router_settings.plugins`. `cheap_first` runs first and narrows the pool, then `enterprise_only` receives that narrowed pool and applies its own policy on top:

```yaml
router_settings:
  plugins:
    - plugins.cheap_first.cheap_first_plugin
    - plugins.enterprise_only.enterprise_only_plugin
```

Each plugin only narrows; if any plugin removes every remaining candidate, the request raises rather than silently falling back to the full pool, so a policy in the chain can't be bypassed by an earlier one.

## Plugins inside the autorouter

`router_settings.plugins` runs the pipeline globally, on every routing decision. You can also scope plugins to the [complexity autorouter](/docs/proxy/auto_routing), where they run inside the tier pick against that tier's actual candidate pool. Put them under `complexity_router_config.plugins` on the auto-router model:

```yaml
model_list:
  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE: ["gpt-4o-mini"]
          COMPLEX: ["gpt-4o", "gpt-4o-mini"]
        default_model: gpt-4o-mini
        plugins:
          - plugins.cheap_first.cheap_first_plugin

  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
```

Here the autorouter first classifies the request into a tier, then the plugin filters that tier's pool before a deployment is picked. So a `COMPLEX` request that classifies into `["gpt-4o", "gpt-4o-mini"]` still passes through `cheap_first`, which keeps only `gpt-4o-mini`. As with the global pipeline, `default_model` is not an escape hatch: if a plugin drops every candidate in the tier, the request raises rather than falling back to it.

Two things to know when combining plugins with the complexity router: `session_affinity` is disabled when plugins are configured, so a mid-session policy change still applies on later turns instead of being skipped by a cached model pin, and `adaptive: true` alongside `plugins` raises at config validation, since the bandit selector doesn't consume plugin-narrowed pools yet.

For the full contract, the request lifecycle, and more on scoping plugins to the autorouter's tiers, see the [routing plugins docs](/docs/routing_plugins).

## Register your plugin

We are also making plugins discoverable with a `router_plugins.json` at the root of the LiteLLM repo.

Here's a sample entry:

```json
  {
    "name": "language-detector",
    "description": "Detects the user's language and publishes a routing signal.",
    "author": "Jean Nuñez",
    "repo": "https://github.com/jeann2013/language-detector",
    "commit": "9e712819269173fc25a16f59ca3e9890f7864ac1",
    "version": "1.0.0",
    "pypi": null,
    "litellm_version": ">=1.94.0",
    "entrypoint": "litellm_plugin_language_detector.plugin.language_detector_plugin",
    "license": "MIT",
    "tags": ["language", "classification", "routing"]
  }
```

The first community entry is language-detector by [Jean Nuñez](https://github.com/jeann2013), which detects the user's language and publishes a routing signal. It pins to a reviewed commit, targets litellm>=1.94.0, and its entrypoint is litellm_plugin_language_detector.plugin.language_detector_plugin; drop that string under router_settings.plugins and it runs. If you've written a plugin, add it to the catalog so others can find it.

## Feedback

If you have any feedback, we'd love to hear it!

Please share your thoughts on the [autorouter discussion on GitHub (#32168)](https://github.com/BerriAI/litellm/discussions/32168) or just reach out to me (krrish@berri.ai) with your thoughts on how this can be improved!
