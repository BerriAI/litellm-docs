---
slug: auto-router-auto-setup
title: "Auto Setup for LiteLLM Auto Router: benchmark-based tiers from your models"
date: 2026-09-03T10:00:00
authors:
  - moe
description: "Auto Setup reads the models a user or team can access, uses a versioned LiveBench snapshot to build four quality tiers, and saves an editable heuristic_v2 router."
keywords: [auto router, auto setup, complexity router, heuristic v2, model routing, livebench, llm cost, litellm]
tags: [routing, complexity-router, benchmarks, cost, product]
hide_table_of_contents: false
---

An Auto Router needs a model for each complexity tier. Choosing those models by hand means comparing benchmark quality, provider prices, and the model groups each team can call. Auto Setup does that work when you create the router.

Enter a name, click **Configure automatically**, choose a quality level, and review the four tiers. You can create the router as recommended or edit any part of the generated configuration.

{/* truncate */}

:::info Availability

Auto Setup is introduced in [PR #39658](https://github.com/BerriAI/litellm/pull/39658). It changes router creation only. Requests continue to use the existing Auto Router runtime.

:::

## The setup flow

1. Open **Add Model → Auto Router** in the LiteLLM Dashboard.
2. Enter the router name and, when required, choose a team.
3. Click **Configure automatically** above the existing Template selector.
4. Choose **Economy**, **Balanced**, **High**, or **Max**.
5. Open **Review and edit configuration** to inspect the model assigned to each tier, then create the router.

The recommendation only considers model groups the current user or selected team can access. An unavailable model cannot enter the ranking. LiteLLM also leaves out model groups it cannot match to one benchmark identity without ambiguity, and the setup screen reports how many groups were excluded.

If one matched model group is available, Auto Setup uses it for all four tiers. It never fills a gap with a model the user cannot call.

## One choice: quality

Each quality level sets the largest allowed gap from the best available model, calculated again for every complexity tier.

| Quality level | Maximum gap from the best available score |
| --- | ---: |
| Economy | 15 percentage points |
| Balanced (default) | 7 percentage points |
| High | 3 percentage points |
| Max | 1 percentage point |

Suppose the best conservative score among a team's models is 0.82 for SIMPLE requests. Max admits models at 0.81 or above. Economy admits models at 0.67 or above. LiteLLM picks the lowest estimated completion cost from the models that clear the selected floor.

Max caps the quality gap at one point. The selected model may have a lower token price than the best-scoring model when both fall inside that band.

## How LiteLLM builds the four tiers

```text
User or team model groups
  -> exact model identity matches
  -> LiveBench evidence by complexity
  -> quality floor for the selected level
  -> lowest completion cost inside the floor
  -> editable SIMPLE / MEDIUM / COMPLEX / REASONING config
```

The first snapshot uses the [LiveBench](https://github.com/LiveBench/LiveBench) release from June 25, 2026: 53 measured model variants across 23 subtasks and seven categories. It also uses a pinned [LiteLLM model registry](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) revision to connect benchmark names to model keys that LiteLLM can route.

The snapshot assigns a common relative difficulty label from scores across all measured models. It orders the subtasks from easiest to hardest, then divides them into four fixed groups: trivial, simple, standard, and complex. Those groups map to the router's SIMPLE, MEDIUM, COMPLEX, and REASONING tiers.

For each model and complexity group, quality starts with the mean LiveBench subtask score. Auto Setup uses a conservative score equal to that mean minus 1.96 standard errors, floored at zero. A model with uneven results needs stronger evidence to clear the same quality floor.

The snapshot stores benchmark evidence rather than a universal tier list. LiteLLM intersects it with the caller's model groups, finds the strongest available score for each tier, and applies the chosen quality gap from that local best. The registry match also carries required parameters, such as the measured reasoning effort, into the tier configuration. Two teams with different model access can choose Max and receive different routers.

## Price means estimated cost per completed task

Raw token price is a poor comparison when models use different numbers of tokens or finish tasks at different rates. Auto Setup starts with the input and output token mix observed in the benchmark, reprices that mix with the rates on the user's configured deployment, and divides by the measured completion rate. LiveBench partial credit counts as a fractional completion in this estimate.

This produces an estimated dollar cost per completed benchmark task. It can rank a model with a low token price but a weak completion rate behind a model that costs more per token and finishes more often. Estimated completion cost sets the ranking after the quality gate. If LiteLLM cannot compare deployment prices, it chooses the highest conservative quality score in the band and still produces a setup.

The estimate has limits. LiveBench publishes mean input tokens per model rather than per subtask, and provider cache discounts or non-token charges may change the bill. Treat the number as a setup prior, then use LiteLLM's spend data to evaluate the router on your traffic.

## Auto Setup builds on Heuristic v2

Auto Setup saves a normal complexity-router configuration:

```yaml
model: auto_router/complexity_router
complexity_router_config:
  classifier_type: heuristic_v2
  tiers:
    SIMPLE: [generated-model-group]
    MEDIUM: [generated-model-group]
    COMPLEX: [generated-model-group]
    REASONING: [generated-model-group]
```

At runtime, [Heuristic v2](/blog/heuristic-v2) maps each request to one of those four tiers. The existing router handles deployment selection, retries, and fallbacks. LiteLLM stops reading the benchmark snapshot after it generates the config.

The snapshot ships with LiteLLM, so Auto Setup does not send prompts, credentials, or the user's model inventory to a hosted ranking service. The generated config remains visible and editable before it is saved.

## A snapshot, not a permanent ranking

This first version uses one public benchmark family. Its scores cover the tasks and model variants present in that release, so they cannot establish the best model for every production workload. New models also need a new reviewed snapshot before Auto Setup can rank them.

Auto Setup gives you a benchmark-backed starting configuration that you can inspect. Review the tiers before saving, then compare quality and spend on your own requests.

## Try it

Open **Add Model → Auto Router**, click **Configure automatically**, and choose the quality gap your workload can tolerate. Max is the clearest starting point when quality is the priority. Economy allows a wider quality band when cost matters more.

Full reference: [Auto Routing](https://docs.litellm.ai/docs/proxy/auto_routing). Share results or model-coverage requests in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).
