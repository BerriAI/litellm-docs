---
slug: router-plugins-on-the-proxy
title: "Router plugins are now on the proxy"
date: 2026-07-17T12:00:00
authors:
  - krrish
description: "Router plugins now run on the LiteLLM proxy, not just the SDK. Configure a plugin pipeline in YAML with router_settings.plugins or complexity_router_config.plugins, load plugins from a local file or an installed pip package, and pull from a shared plugin catalog."
tags: [routing, complexity-router, plugins, proxy, product]
hide_table_of_contents: false
---

:::info Availability

Router plugins run on the proxy from **v1.94.x**. The design is still evolving; tell us how you'd use it and what you'd want next in the [autorouter discussion on GitHub (#32168)](https://github.com/BerriAI/litellm/discussions/32168).

:::

Router plugins started in the SDK: pass instances to `Router(plugins=[...])` and each one receives the routing context, enriches it, and hands it to the next before the router makes the final decision. That worked if you drove LiteLLM from Python, but most production traffic goes through the proxy, where the only way to shape routing was to fork the config surface. Now the same plugin pipeline runs on the proxy, configured in YAML, with no code changes to the router itself.

The push came from the [autorouter discussion (#32168)](https://github.com/BerriAI/litellm/discussions/32168): teams wanted to layer their own signals (language detection, domain classification, tenant policy, budget caps) onto routing without waiting for each one to land in core. A plugin pipeline is that extension point, and it only mattered once it worked where requests actually arrive.

{/* truncate */}

## Two ways to wire plugins in on the proxy

The proxy exposes two configuration surfaces, and they operate at different stages.

`router_settings.plugins` configures the global pipeline. It runs on every routing decision, the same place `Router(plugins=[...])` runs in the SDK.

```yaml
router_settings:
  plugins:
    - plugins.language_detector.language_detector_plugin
```

`complexity_router_config.plugins` scopes plugins to the complexity router, where they run inside the tier pick against that tier's actual candidate pool.

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
          - plugins.cost_ceiling.cost_ceiling_plugin

  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
```

Each entry is a dotted path to a plugin instance. The proxy resolves it at startup, validates that the object satisfies the `RoutingPlugin` protocol and that its `run` method is actually async, and fails startup with a clear error otherwise. Nothing bypasses the pipeline once it's wired in.

## Load from a local file or an installed package

The dotted path resolves the same way `litellm_settings.callbacks` does. If a matching `.py` file exists next to your `config.yaml`, the proxy loads that local file; so `plugins.language_detector.language_detector_plugin` reads `plugins/language_detector.py` relative to the config directory. If no such file exists, the proxy falls back to a normal import, which means a plugin shipped as a pip package works with the same syntax:

```yaml
router_settings:
  plugins:
    - litellm_plugin_language_detector.plugin.language_detector_plugin
```

That single change is what turns router plugins from a per-deployment script into something you can publish, version, and pull into any proxy with `pip install`.

## A shared catalog to publish against

To make plugins discoverable, there's now a `router_plugins.json` catalog at the root of the LiteLLM repo. Each entry records the plugin's name, description, author, public repo, a pinned commit or PyPI spec, minimum LiteLLM version, license, the dotted entrypoint, and searchable tags. It's reference metadata for finding and pinning community plugins, not a runtime registry.

The first community entry is [language-detector](https://github.com/jeann2013/language-detector) by Jean Nuñez, which detects the user's language and publishes a routing signal. It pins to a reviewed commit, targets `litellm>=1.94.0`, and its entrypoint is `litellm_plugin_language_detector.plugin.language_detector_plugin`; drop that string under `router_settings.plugins` and it runs. If you've written a plugin, add it to the catalog so others can find it.

## What a plugin actually does

A plugin is any object with `async def run(self, context: RoutingContext) -> RoutingContext`. The context is a stable interface, so authors never have to understand each provider's request format:

```python
class RoutingContext(BaseModel):
    raw_messages: list[dict[str, Any]]         # original request payload, read-only by contract
    structured_messages: list[dict[str, Any]]  # normalized to OpenAI chat format, read-only by contract
    candidate_models: list[str]                # provider/model; narrow to restrict the router
    metadata: dict[str, Any]                   # tenant, user, session info (a copy)
    signals: dict[str, Any]                    # write here to pass output downstream
```

Plugins run in list order, each seeing the previous plugin's mutations. Narrowing `candidate_models` is a hard policy gate: removing an entry restricts what the router can pick, and narrowing to zero raises rather than falling back to the unfiltered pool, since silently ignoring a policy would defeat it. Adding a model that isn't already a deployment does nothing; filtering is include and exclude only. Anything a plugin writes to `context.signals` is surfaced on `metadata["routing_plugin_signals"]` for downstream strategies or your own logic to read. Plugins don't rewrite the outgoing request; for prompt rewriting, reach for a pre-call hook or guardrail instead.

Two behaviors to know when combining plugins with the complexity router: `session_affinity` is disabled when plugins are configured, so a mid-session policy change still applies on later turns instead of being skipped by a cached model pin, and `adaptive=true` alongside `plugins` raises at config validation, since the bandit selector doesn't consume plugin-narrowed pools yet.

## Try it

Full configuration, the request lifecycle, and the limitations are in the [routing plugins docs](/docs/routing_plugins). We're actively shaping where router plugins and the autorouter go next, and want to hear the plugins you'd write, the signals you'd want, and the routing strategies you'd reach for. Share your use case in the [autorouter discussion (#32168)](https://github.com/BerriAI/litellm/discussions/32168).
