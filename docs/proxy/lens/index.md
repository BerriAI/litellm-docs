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

Repeated investigations reuse completed reviews when the trace content and criteria are unchanged. New evidence extends matching findings across investigation runs, preserving affected traces, supporting quotes, and feedback. Each investigation tracks its own monthly budget and analysis cost.

Use **Lens > Traces** to manually inspect individual runs. Use **Lens > Investigations** to investigate a set of runs, on demand or on a schedule.

Before setup, click **Preview sample** beside the Lens title to explore sample traces, investigations, and linked evidence. **Exit demo** returns to your own workspace.

## Get started

[Deploy Lens](./deployment.md), then [send your first trace](./first-trace.md). Choose an integration from the sidebar for a runnable project.

Use the [coding agent guide](./coding-agents.md) to record personal Claude Code or Codex sessions. Once traces are available, [run an investigation](./investigations.md) or use the [API reference](./api.md).
