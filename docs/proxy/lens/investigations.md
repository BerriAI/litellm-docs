---
title: "Investigations"
description: "Review agent activity, investigate failures, and read the supporting evidence."
slug: "/proxy/lens/investigations"
---

# Investigations

## Run your first investigation

You need a [running Lens installation](./deployment.md), proxy administrator access, and at least one [recorded agent trace](./first-trace.md).

### 1. Enable investigations {#connect-the-analyzer}

1. Open **Lens > Investigations** under **Observability**.
2. Click **Connect worker**.
3. Choose an **Analysis model** and a **Monthly limit**, then click **Enable investigations**.
4. Wait for **Worker connected**. Lens connects automatically once these settings are saved.

This creates a virtual key restricted to your chosen model; analysis spend appears under that key in **Virtual Keys**. To use an existing virtual key, open **Advanced options**. Change the analysis key later through the worker's **Settings**.

### 2. Choose the traces {#choose-the-traces}

Click **New investigation**. In **Activity**, name the investigation and choose an **Agent**. The dropdown lists recorded agent names; leave it blank to include all accessible activity. Open **Advanced filters** to choose agent traces, LLM requests, or both, restrict the selection to a team, or add metadata conditions. Request analysis uses the request logs stored in ClickHouse. Metadata conditions match recorded keys and values exactly.

### 3. Describe what to check {#describe-what-to-check}

Click **Continue** to open **Expectations**. Describe what your agent should do in **What should the agent be doing?**.

For example:

> The research agent answers the user's question with sources. It checks the sources before writing the final answer and states when it cannot verify a claim.

Under **What should we look out for?**, use **Add check** to add questions you want Lens to answer. Expected behavior is checked even when you leave these blank. You can edit the suggested questions or write your own:

```text
Find claims that conflict with the retrieved sources.
Find tool failures that the agent does not recover from.
Find repeated searches that add no new information.
```

After setup, you can review these under **Criteria** and change them through **Edit investigation** in the actions menu.

![Expected behavior and individual checks for an investigation.](/img/lens/investigation-expectations.png)

### 4. Start the run {#start-the-run}

Click **Continue** to open **Run**. Set the time window and percentage of matching runs to analyze. By default, Lens reviews 100% of matching activity from the last day, with no count limit. The preview shows how many runs match and how many will be analyzed. Click **Open run** to inspect an example. Newly received traces need a two-minute settling period before they appear here.

Lens uses the worker's analysis model by default. To change the model, set a maximum number of runs, or change the monthly limit, open **Advanced options**. Trace content goes to the selected model through LiteLLM.

Click **Run investigation** to run once. For monitoring, enable **Repeat this investigation** in **Advanced options**, set **Repeat every** to the interval you want, then click **Run and monitor**.

Lens reviews the selected runs in parallel, groups similar observations, and checks the original evidence before saving findings.

Use **Run now** to start another investigation with the saved settings. Scheduled investigations use those same settings. Use **Duplicate** in the actions menu to ask a one-off question or investigate a different selection without changing the original lens. Use **Pause monitoring** to stop scheduled investigations.

## Read the findings

Open **Findings** when the investigation finishes. **Needs attention** shows problems, ordered by priority. **Patterns** shows other observations, including successful recovery and useful behavior.

Open a finding to read what happened and the suggested next step. Expand **Evidence by run** to read the quotes. Click **Open original step** to see the cited step in its trace.

![An example finding with a suggested next step and supporting evidence.](/img/lens/investigation-findings.png)

Use **History** to return to a previous run and its findings, settings, progress, total duration, and cost. Duration includes any wait for a worker. **Traces** shows the activity selected for that run; this tab is called **Requests** or **Traces & requests** when those activity types are selected.

Findings describe the reviewed sample. **Linked runs** counts cited supporting runs; it is not a count of all failures. Evidence can also include labeled counterexamples.

### Give feedback

If Lens flags expected behavior, explain why in **Feedback** and click **This is expected**. Lens uses that feedback in later investigations for the same lens.

After you fix an issue, click **Mark resolved**. Lens can reopen it if the same issue appears in new runs.

## How investigations run

Lens runs on your infrastructure. It checks LiteLLM for scheduled or requested investigations, calls your chosen model through LiteLLM, and sends the results back. It keeps running when you close the dashboard.

Each Lens service replica runs one investigation at a time. The investigation's concurrency setting controls how many traces it reviews simultaneously. More replicas allow more simultaneous investigations; their analysis costs share the assigned virtual key's budget.
