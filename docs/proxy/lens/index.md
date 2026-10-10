---
slug: /proxy/lens
title: LiteLLM Lens
description: Trace agent runs and investigate recurring failures with LiteLLM Lens.
image: /img/lens/lens_hero_labeled.gif
---

# LiteLLM Lens

<p>
  <a className="button button--primary button--sm" href="https://forms.gle/3GC1Ner4vjthGWi18">Early access</a>
</p>

![Agent swarms flow through the LiteLLM gateway into one trace per run, and LiteLLM Lens feeds improvements back.](/img/lens/lens_hero_labeled.gif)

Once your agents are in production, you cannot manually review every trace.

LiteLLM Lens uses AI agents to analyze your agent traces and find recurring problems. You specify the expected behavior. Lens investigates failures, groups similar problems, and links each finding to the original traces.

Use **Lens > Traces** to manually inspect individual runs. Use **Lens > Investigations** to investigate a set of runs, on demand or on a schedule.

Before setup, click **Preview sample** beside the Lens title to explore sample traces, investigations, and linked evidence. **Exit demo** returns to your own workspace.

## Get started

If your team already runs Lens, [send your first trace](./first-trace.md). Choose your framework, give the agent a name, and run the example.

You can [deploy Lens on its own](./deployment/local.md) or [add it to your LiteLLM dashboard](./deployment/litellm.md). If Lens already runs, [connect that deployment to your gateway](./deployment/litellm.md#1-get-the-lens-address). Each guide ends with a connection check and a first trace.

Use the [coding agent guide](./coding-agents.md) to record personal Claude Code or Codex sessions. Once traces are available, [run an investigation](./investigations.md) or use the [API reference](./api.md).

## How Lens works

**1. Capture your agent's traces**

Send traces from your agent to Lens. Open a run to inspect its inputs, responses, and tool calls, along with latency and cost.

![Lens Traces page showing support agent runs with inputs, duration, cost, findings, and user feedback.](/img/lens/overview-traces.webp)

**2. Find where your agent falls short**

Run an investigation to find problems across your traces. Review findings with examples, suggested fixes, and how often each problem occurs in the traces analyzed.

![Lens finding showing repeated order lookups, a suggested handoff to support, and the share of affected traces.](/img/lens/overview-finding.webp)

**3. Turn those runs into test cases**

Save runs into a dataset and add the responses you expect. Export the dataset to test changes to your agent's prompts, tools, or models.

![Lens dataset with support requests, recorded replies, expected responses, and an Export JSONL button.](/img/lens/overview-dataset.webp)
