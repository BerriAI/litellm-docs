---
slug: auto-router-stall-escalation
title: "Auto-Router: Escalate a Task That Gets Stuck"
date: 2026-09-08T10:00:00
authors:
  - moe
image: ./hero.png
description: "The Auto-Router now reads the assistant's own recent tool calls, notices when an agentic task is stuck in a retry loop, and escalates it one tier automatically, the same bump escalation_keywords already offers."
keywords: [auto router, complexity router, stall detection, agentic routing, model escalation, tool calling, llm gateway, litellm]
tags: [routing, complexity-router, engineering]
hide_table_of_contents: false
---

![Mid-task escalation: the Auto-Router bumps a stuck request to a higher tier](./hero.png)

{/* truncate */}

:::info[🚀 Help shape the Auto-Router]

Get early access, work directly with the LiteLLM team, and influence the roadmap with your production traffic.

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

<br /><br />

Already testing it? Share your results in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168).

:::

The classifier scores the human ask. An agent client resends the whole conversation every turn, and the router pulls the last real human ask out of it; the tool calls underneath are not part of what gets scored.

That works until a cheap model gets stuck. The agent calls the same tool with the same arguments three times, or the same call keeps erroring, and the human ask sitting above all of it hasn't changed since the task started. Turn one and turn fifteen hand the classifier the same string, so a deterministic classifier returns the same tier, and the task goes back to the model that is failing it. The part of the conversation that was changing was the part nothing looked at.

`stall_escalation_enabled: true` gives the router that judgment on its own.

## How it decides

- **Reads the assistant's own tool calls, not the human's messages.** A task counts as stalled once the newest call repeats, or errors, at least `stall_escalation_repeat_threshold` times across the last `stall_escalation_window` calls
- **Anchored on the newest call, not whichever pattern is most common in the window.** A task that tried the same thing three times and then found a different path still has those calls sitting in the window for a few more turns; anchoring on the newest one keeps that history from escalating a task that already recovered
- **Reads both tool-call shapes.** Anthropic Messages `tool_use`/`tool_result` blocks, including `is_error`, and chat-completions `tool_calls`/`tool` messages, which carry no error flag, so those are judged on repetition alone
- **Stateless.** Detection reruns on every classified turn from that request's own messages, so the bump lasts only as long as the task looks stuck and lifts on its own the moment it doesn't

Escalation records `stall_escalation` in `routing_decision.signals`, right next to `escalation_keywords`.

## In the dashboard

Auto-Routers get an **Advanced: Stalled Task Escalation** section with the toggle and both knobs:

![Advanced: Stalled Task Escalation, with the repeat threshold and window set](./stall-escalation-config.png)

It's rejected together with `session_affinity` and `classification_mode: user_turn`. Both replay a held routing decision on most turns instead of classifying, so detection would never see the tool calls it needs, and the toggle greys out with that reason instead of letting you save a config the backend would reject.

## Turning it on

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params: {model: openai/gpt-4o-mini, api_key: os.environ/OPENAI_API_KEY}
  - model_name: gpt-4o
    litellm_params: {model: openai/gpt-4o, api_key: os.environ/OPENAI_API_KEY}

  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE: gpt-4o-mini
          MEDIUM: gpt-4o

        # off by default: bump a stuck task one tier higher
        stall_escalation_enabled: true
        stall_escalation_window: 6
        stall_escalation_repeat_threshold: 3
```

:::info[Try it on your traffic]

Point a shadow-eval job at your busiest team, compare your current config against one with stall escalation on, and tell us what you see in [discussion #32168](https://github.com/BerriAI/litellm/discussions/32168), or

<a className="button button--primary button--lg" style={{background: '#2e8555', borderColor: '#2e8555', color: '#fff'}} href="https://calendar.app.google/i2e7qVEJphHi5S8UA">Apply to Become a Design Partner</a>

:::
