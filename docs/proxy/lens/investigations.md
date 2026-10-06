---
title: "Investigations"
description: "Review agent activity, investigate failures, and read the supporting evidence."
slug: "/proxy/lens/investigations"
---

# Investigations

## Run your first investigation

### Connect the analyzer

Sign in as a proxy administrator and open **Lens > Investigations** under **Observability**. Once activity is available, click **Connect worker**. Choose an **Analysis model** and a **Monthly limit**, then click **Get install command**. The default limit is $100 per month. This creates a virtual key restricted to your chosen model; analysis spend appears under that key in **Virtual Keys**. To use an existing virtual key or change the proxy URL, open **Advanced options**. Existing workers can change their virtual key through the worker's **Settings** without replacing their worker token.

Run the Docker command on a server that can reach your LiteLLM deployment. Keep the command private because it contains the worker token. Wait for **Worker connected**. Investigation creation unlocks when the worker is ready.

![Lens worker setup with an analysis model and a monthly limit.](/img/lens/worker-setup.png)

This worker runs on your infrastructure. It checks LiteLLM for scheduled or requested investigations and sends the results back. It calls your chosen model through LiteLLM and keeps running when you close the dashboard.

The generated command starts one worker process, which can run up to three investigations at a time. An investigation's concurrency setting controls its parallel model calls. Running more workers allows more simultaneous investigations; workers assigned the same virtual key share that key's budget. Runs of the same investigation do not overlap.

### Choose the traces

Click **New investigation**. In **Activity**, name the investigation and choose an **Agent**. The dropdown lists recorded agent names; leave it blank to include all accessible activity. Open **Advanced filters** to choose agent traces, LLM requests, or both, restrict the selection to a team, or add metadata conditions. Request analysis uses the request logs stored in ClickHouse. Metadata conditions match recorded keys and values exactly.

### Describe what to check

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

### Start the run

Click **Continue** to open **Run**. Set the time window and percentage of matching runs to analyze. By default, Lens selects 100% of matching activity from the last day, with no count limit. The preview shows matching activity and the selected sample. Selection does not mean every trace needs another paid review. Click **Open run** to inspect an example. Newly received or updated traces need a two-minute settling period before they appear here.

Lens uses the worker's analysis model by default. To change the model, set a maximum number of runs, or change the monthly limit, open **Advanced options**. Trace content goes to the selected model through LiteLLM.

Click **Run investigation** to run once. For monitoring, enable **Repeat this investigation** in **Advanced options**, set **Repeat every** to the interval you want, then click **Run and monitor**.

Lens checks the selected trace content for reusable reviews before making model calls. It reviews new or changed traces in parallel, groups similar observations, checks the original evidence, and reconciles findings with those already saved for this investigation.

Use **Run now** to start another investigation with the saved settings. Scheduled investigations use those same settings. Use **Duplicate** in the actions menu to ask a one-off question or investigate a different selection without changing the original lens. Use **Pause monitoring** to stop scheduled investigations.

## Repeated runs and review reuse

A trace selected in overlapping time windows does not need another model review when its saved review is complete, its recorded content is unchanged, and the investigation criteria match. Criteria are the expected behavior, enabled checks, and analysis model. Lens compares those values and the complete recorded trace content, including content beyond the preview.

Changing the expected behavior, enabled checks, or analysis model requires a matching review for those criteria. New spans or other changes to a trace's content also require another review. Changing the name, budget, schedule, or sampling settings preserves completed reviews for unchanged traces that remain selected. Reuse belongs to the same investigation; a duplicate investigation has its own reviews and findings.

For example, the first run reviews 20 traces. The next run selects those same 20 plus five new traces. With unchanged criteria and content, Lens reuses 20 reviews and reviews the five new traces. It compares the new observations with saved findings, including unresolved issues found in earlier runs.

If no new or changed traces need review and all saved observations have been incorporated into findings, the run completes with zero model calls and zero analysis cost. It still appears in history with its reuse count. Its empty findings list means the run added nothing; **All accumulated findings** still shows earlier findings. This also works when the investigation's monthly budget is spent.

An interrupted run keeps completed trace reviews. A later run can reuse them, but grouping or investigating observations that have not yet been incorporated into findings can still require paid model calls. Reuse avoids repeating completed trace analysis; it does not make unfinished work free.

While a run is active, Lens distinguishes reviews **eligible for reuse** from traces that **need review**. The completed run reports reviews actually reused and traces newly reviewed. A cancelled or failed run only counts reviews it recorded before stopping.

![An investigation run report showing two reused reviews, one newly reviewed trace, and a recurring finding across two investigation runs.](/img/lens/investigation-run-report.png)

## Budgets and cost

Each investigation has a monthly budget. Budget edits apply to subsequent model calls, including those in an active run. A running investigation keeps its analysis settings and selected traces across retries. Model calls also use the worker's assigned virtual key, so that key's budget, model permissions, and rate limits apply independently. A worker key shared by several investigations can reach its limit while one investigation still has budget available.

The investigation summary separates **spent**, **reserved**, and **available** amounts. Spent is settled analysis cost for the current month. Reserved is the temporary allowance held for model calls in progress. Available is the monthly limit minus spent and unexpired reservations. For example, with a $100 limit, $45 spent, and $10 reserved, $45 is available for further calls; the reservation is not another $10 of settled spend.

Lens determines which reviews it can reuse before requesting model budget. Reusing a completed review makes no model call and needs no reservation. New reviews, grouping, and finding investigation can incur cost.

Before each model call, Lens reserves a conservative allowance based on the input and permitted output. When concurrent calls hold the remaining capacity, another call waits for those reservations to settle, within the proxy's request timeout. A successful call settles to its recorded cost and releases the unused allowance. Failed or timed-out requests release their hold; abandoned holds expire.

If a single request's allowance exceeds the unspent budget, Lens stops with the amount it needs and the amount remaining. This can happen before settled spend reaches the monthly limit. Reduce the model deployment's output allowance or increase the investigation limit. When spend reaches the limit, additional paid analysis stops until the limit increases or the next monthly period begins. Completed reviews remain available for reuse.

Budget, authorization, and connection failures stop the run after any applicable retries. Completed trace reviews and their evidence remain saved, and the run shows its completed assessments with the error explaining what stopped. Findings appear only after comparison with each other and saved findings finishes. If that comparison cannot finish, a later run reuses the completed reviews and retries the remaining grouping and investigation. Cancellation stops subsequent work, but a model call already in flight may still incur cost.

## Read the findings

Open **Findings** when the investigation finishes. **Needs attention** shows problems, ordered by priority. **Patterns** shows other observations, including successful recovery and useful behavior.

Open a finding to read what happened and the suggested next step. Expand a trace under **Affected traces and counterexamples** to read the quotes. Click **Open original step** to see the cited step in its trace, or **Open request** for an LLM request.

![An example finding with a suggested next step and supporting evidence.](/img/lens/investigation-findings.png)

Use the **Investigation run** selector or **History** to return to a run's findings, settings, progress, duration, and cost. Duration includes any wait for a worker. Choose **All accumulated findings** to see findings across runs. **Agent traces** shows the activity selected for a run; the tab is called **LLM requests** or **Traces and requests** when those activity types are selected.

### Recurring findings across runs

When new traces support the same problem or pattern, Lens extends the existing finding within that investigation. It preserves earlier evidence and feedback, adds the newly affected traces, and records the investigation runs that contributed evidence. Different problems stay separate, and conflicting user feedback prevents automatic merging. Links to findings that are merged continue to open the retained finding.

**Affected traces** counts distinct traces or requests supporting the finding. **Investigation runs** counts the scans that contributed evidence. A finding supported by three traces from two scans shows three affected traces and two investigation runs. Selecting the same unchanged trace again does not add another occurrence or contributing run. The finding lists all affected traces, including ones without a displayed quote. Counterexamples remain visible without increasing the affected count.

Findings describe the reviewed sample, not every possible failure in your traffic. Read the run's partial, unassessable, and error counts alongside its findings. Missing, redacted, expired, or incomplete trace content limits what Lens can conclude.

### Give feedback

Enter your explanation under **What should Lens remember?**, then choose a status action to save it. **This is expected** dismisses the finding. **Mark resolved** records that an issue has been fixed. **Reopen** returns a resolved issue to open. Typing an explanation alone does not save it or mark anything resolved.

Saved feedback informs later analysis and finding reconciliation for the same investigation. It preserves the original evidence and does not invalidate completed trace reviews. A resolved issue reopens when a newly affected trace supports it again. A dismissed finding stays dismissed when matching evidence recurs; unrelated problems can still produce findings. Use the finding status filter to view resolved or dismissed findings.
