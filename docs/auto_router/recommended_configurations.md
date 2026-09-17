---
title: Recommended Configurations
sidebar_label: Recommended Configurations
description: The bundled 1M Context, Anthropic, OpenAI, Gemini, and Lite presets as config.yaml, the configs the public benchmarks were run on, and how to choose between them.
---

Recommended ladders, matching the dashboard's Auto Router templates. Every tier must exist as a `model_name` in the same file; swap the provider prefix or credentials for your own deployments and the router entry stays the same.

| Ladder | SIMPLE | MEDIUM | COMPLEX | REASONING | Classifier |
| --- | --- | --- | --- | --- | --- |
| [1M Context](#1m-context) | gpt-5.6-luna | gpt-5.6-terra | gpt-5.6-sol | claude-opus-5, high effort | heuristic v2 |
| [Anthropic Family](#anthropic-family) | claude-haiku-4-5 | claude-sonnet-5 | claude-opus-5 | claude-opus-5, high effort | heuristic |
| [OpenAI Family](#openai-family) | gpt-5.6-luna | gpt-5.6-terra | gpt-5.6-sol | gpt-5.6-sol, xhigh effort | heuristic |
| [Gemini Family](#gemini-family) | gemini-2.5-flash-lite | gemini-3.1-flash-lite | gemini-3.7-flash | gemini-3.1-pro-preview | heuristic |
| [Lite](#lite) | deepseek-v4-flash | muse-spark-1.2, xhigh | kimi-k3, max | claude-opus-5 | LLM, agentic rubric |
| [Benchmark config](#the-benchmark-configuration) | claude-haiku-4-5 | claude-sonnet-5 | claude-opus-5 | claude-opus-5 | LLM, gpt-5.4-mini |
| [Production config](#the-production-configuration) | claude-haiku-4-5 | claude-haiku-4-5 | claude-sonnet-5 | claude-opus-5 | heuristic |

## Choosing a ladder

- **One family** when clients depend on provider-specific behavior (Anthropic cache control, OpenAI reasoning params). Every tier stays on one API surface.
- **Lite** when cost beats provider consistency and traffic is agentic. Mixed providers, LLM classifier with the `agentic` rubric.
- **1M Context** for long prompts. Luna, Terra, Sol, then Opus 5 at high effort, with the heuristic v2 classifier.
- **Same model, more effort** for the top rung. Costs more output tokens, not a higher per-token rate. Pattern: [effort ladders](/docs/proxy/auto_routing#effort-ladders).
- All ladders leave `session_affinity` off (the default; see [prompt caching](/docs/auto_router/prompt_caching)) and set `escalation_keywords: ["LITELLM ESCALATE"]`, which bumps a request one tier when the exact phrase appears. Matching is case-sensitive.

## Anthropic Family

Haiku, Sonnet, Opus, then Opus at high reasoning effort.

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-opus-5
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-opus-5-high
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY
      reasoning_effort: high

  - model_name: claude-auto
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    claude-haiku-4-5
          MEDIUM:    claude-sonnet-5
          COMPLEX:   claude-opus-5
          REASONING: claude-opus-5-high
        classifier_type: heuristic
        escalation_keywords: ["LITELLM ESCALATE"]
        session_affinity: false
      complexity_router_default_model: claude-sonnet-5
```

Keep `claude` in the router name if Claude Code or Claude Desktop needs to discover it. See [Setup](/docs/auto_router/setup#claude-code-and-claude-desktop).

## OpenAI Family

Luna, Terra, Sol, then Sol at xhigh reasoning effort.

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-5.6-sol
    litellm_params:
      model: openai/gpt-5.6-sol
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-5.6-sol-xhigh
    litellm_params:
      model: openai/gpt-5.6-sol
      api_key: os.environ/OPENAI_API_KEY
      reasoning_effort: xhigh

  - model_name: gpt-auto
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    {{openai_small}}
          MEDIUM:    {{openai_large}}
          COMPLEX:   gpt-5.6-sol
          REASONING: gpt-5.6-sol-xhigh
        classifier_type: heuristic
        escalation_keywords: ["LITELLM ESCALATE"]
        session_affinity: false
      complexity_router_default_model: {{openai_large}}
```

## Gemini Family

Flash Lite 2.5, Flash Lite 3.1, Flash 3.7, then Pro 3.1.

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: gemini-2.5-flash-lite
    litellm_params:
      model: gemini/gemini-2.5-flash-lite
      api_key: os.environ/GEMINI_API_KEY
  - model_name: gemini-3.1-flash-lite
    litellm_params:
      model: gemini/gemini-3.1-flash-lite
      api_key: os.environ/GEMINI_API_KEY
  - model_name: gemini-3.7-flash
    litellm_params:
      model: gemini/gemini-3.7-flash
      api_key: os.environ/GEMINI_API_KEY
  - model_name: gemini-3.1-pro-preview
    litellm_params:
      model: gemini/gemini-3.1-pro-preview
      api_key: os.environ/GEMINI_API_KEY

  - model_name: gemini-auto
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    gemini-2.5-flash-lite
          MEDIUM:    gemini-3.1-flash-lite
          COMPLEX:   gemini-3.7-flash
          REASONING: gemini-3.1-pro-preview
        classifier_type: heuristic
        escalation_keywords: ["LITELLM ESCALATE"]
        session_affinity: false
      complexity_router_default_model: gemini-3.1-flash-lite
```

## Lite

Cross-provider, built for cost. DeepSeek V4 Flash also serves as the LLM classifier, with the `agentic` rubric and a zero-turn context window.

```yaml title="config.yaml"
model_list:
  - model_name: deepseek-v4-flash
    litellm_params:
      model: deepseek/deepseek-v4-flash
      api_key: os.environ/DEEPSEEK_API_KEY
  - model_name: muse-spark-1.2-xhigh
    litellm_params:
      model: meta/muse-spark-1.2
      api_key: os.environ/META_API_KEY
      reasoning_effort: xhigh
  - model_name: kimi-k3-max
    litellm_params:
      model: moonshot/kimi-k3
      api_key: os.environ/MOONSHOT_API_KEY
      reasoning_effort: max
  - model_name: {{anthropic_large}}
    litellm_params:
      model: anthropic/{{anthropic_large}}
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: lite-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    deepseek-v4-flash
          MEDIUM:    muse-spark-1.2-xhigh
          COMPLEX:   kimi-k3-max
          REASONING: {{anthropic_large}}
        classifier_type: llm
        classifier_llm_config:
          model: deepseek-v4-flash
          timeout_ms: 3000
          classification_rubric: agentic
        classifier_context_window_size: 0
        escalation_keywords: ["LITELLM ESCALATE"]
        session_affinity: false
      complexity_router_default_model: muse-spark-1.2-xhigh
```

## 1M Context

Luna, Terra, Sol, then Opus 5 at high reasoning effort. Uses the heuristic v2 classifier, so classification adds no LLM call.

The GPT tiers accept up to 922K input tokens and Opus 5 accepts 1M. The router moves oversized prompts to the lowest higher tier with capacity. See [context-window escalation](/docs/proxy/auto_routing#context-window).

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-5.6-sol
    litellm_params:
      model: openai/gpt-5.6-sol
      api_key: os.environ/OPENAI_API_KEY
  - model_name: claude-opus-5-high
    litellm_params:
      model: anthropic/{{anthropic_large}}
      api_key: os.environ/ANTHROPIC_API_KEY
      reasoning_effort: high

  - model_name: 1m-auto
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    {{openai_small}}
          MEDIUM:    {{openai_large}}
          COMPLEX:   gpt-5.6-sol
          REASONING: claude-opus-5-high
        classifier_type: heuristic_v2
        escalation_keywords: ["LITELLM ESCALATE"]
        session_affinity: false
      complexity_router_default_model: {{openai_large}}
```

## The benchmark configuration

- [Terminal-Bench](/blog/auto-router-terminal-bench-benchmark): Opus-5 solve rate at 27% lower cost, this config, gpt-5.4-mini classifier reading only the current message.
- [Cost and quality](/blog/auto-router-cost-quality-benchmark) and [prompt caching](/blog/auto-router-prompt-caching-benchmark): same tiers, heuristic classifier.

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-opus-5
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: gpt-5.4-mini
    litellm_params:
      model: openai/gpt-5.4-mini
      api_key: os.environ/OPENAI_API_KEY

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    claude-haiku-4-5
          MEDIUM:    claude-sonnet-5
          COMPLEX:   claude-opus-5
          REASONING: claude-opus-5
        classifier_type: llm
        classifier_llm_config:
          model: gpt-5.4-mini
        classifier_context_window_size: 0
      complexity_router_default_model: claude-sonnet-5
```

The classifier context window is the knob to revisit for your own traffic:

- Terminal-Bench: last 3 user messages raised solve rate 66.7% to 76.2% and cost 44%. Assistant replies made both worse.
- Chat traffic ([v1.97 measurements](/blog/auto-router-context-and-benchmarks)): prior turns raised follow-up agreement 14% to 78%.
- Shipped default: 3 user turns, no assistant turns.

## The production configuration

- The [production case study](/blog/auto-router-production-savings) that reported 51.1% savings.
- Haiku serves both SIMPLE and MEDIUM; Opus is reserved for REASONING.
- 95% of requests never reached the flagship tier.

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-opus-5
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-auto-latest
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE:    claude-haiku-4-5
          MEDIUM:    claude-haiku-4-5
          COMPLEX:   claude-sonnet-5
          REASONING: claude-opus-5
      complexity_router_default_model: claude-haiku-4-5
```

## Coding agents with load balancing

- For a tier with more than one deployment behind it, for example the same Claude model on Anthropic and on Bedrock.
- `session_affinity` pins the tier for the session; `deployment_affinity` plus the `prompt_caching` pre-call check pins the deployment holding the cache.
- Both matter on agent traffic. Details: [Session affinity](/docs/proxy/auto_routing#session-affinity).

```yaml title="config.yaml" keep-model-ids
model_list:
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-5
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-5
      aws_region_name: us-east-1
  - model_name: claude-opus-5
    litellm_params:
      model: anthropic/claude-opus-5
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
          REASONING: claude-opus-5
        session_affinity: true
        session_affinity_ttl_seconds: 3600
      complexity_router_default_model: claude-sonnet-5

router_settings:
  optional_pre_call_checks: ["deployment_affinity", "session_affinity", "prompt_caching"]
  deployment_affinity_ttl_seconds: 3600
```
