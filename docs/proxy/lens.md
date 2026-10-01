---
image: /img/lens/lens_hero_labeled.gif
description: Set up agent traces, connect a Lens worker, and investigate your agents' behavior.
---

# LiteLLM Lens

<p>
  <a className="button button--primary button--sm" href="https://forms.gle/3GC1Ner4vjthGWi18">Early access</a>
</p>

Lens reviews recorded agent activity and finds recurring problems. Tell it what your agent should do and what to look out for. Each finding links back to the traces that support it.

For example, Lens can find an agent that repeatedly calls a failing tool without offering a handoff. You can read the finding, inspect the original steps, then decide what to change.

![Agent activity, traces, and investigation findings in LiteLLM Lens.](/img/lens/lens_hero_labeled.gif)

Open **Lens** under **Observability** in your dashboard. **Traces** lets you inspect individual runs. **Investigations** checks a set of runs against your expectations. Select **View an example** to see a sample finding before setup.

## Get started {#quick-start}

You can self-host every Lens component. You need a LiteLLM proxy with PostgreSQL, ClickHouse for traces, and a Lens worker for investigations. If these are not deployed yet, follow [Deploy Lens](./lens_deployment.md).

Sign in as a proxy administrator. In **Lens > Investigations**, complete the three setup steps in order. Each step unlocks when the previous one is ready.

### 1. Set up traces {#view-your-first-trace}

Select **Set up traces** to open the Traces tab. Use **Send a test trace** to check that ingestion works. Then follow [Sending your first trace](./lens_first_trace.md) to run the DeepAgents example and open its trace. Check that you can read the task, tool results, and final answer.

![Tracing setup with the OTEL endpoints and a successfully received test trace.](/img/lens/tracing-setup.jpg)

Return to **Investigations**. **Traces received** confirms that Lens has activity to work with.

### 2. Connect a worker {#connect-the-analyzer}

Select **Connect worker**. Choose an **Analysis model** and a **Monthly limit**, then select **Get install command**. The default limit is $100, shared across investigations through a dedicated virtual key restricted to your chosen model.

![Worker setup with an analysis model and a $100 monthly limit.](/img/lens/worker-setup.jpg)

Copy the Docker command and run it on your server. The dialog changes to **Worker connected** when it checks in. Select **New investigation** to continue.

The worker is a separate service you deploy once. It keeps running when you close the dashboard. To use an existing virtual key or change the proxy address, open **Advanced options** during setup. Later, open the worker status and select **Settings** to change its access.

### 3. Run an investigation {#run-your-first-investigation}

**Activity:** Name the investigation and choose a recorded agent name. Leave the agent blank to include all traces you can access. **Advanced filters** lets you filter by recorded metadata, such as a user ID, or choose LLM request logs instead of traces.

**Expectations:** Describe what the agent should be doing. Under **What should we look out for?**, add specific checks with **Add check**. For a support agent, you might expect it to answer order questions and check for failed lookups that never lead to a handoff.

![Investigation expectations with separate checks for the agent.](/img/lens/investigation-expectations.jpg)

**Run:** Choose the time range and sample percentage. The preview shows the matching runs. By default, Lens reviews 100% of the last day's matching activity, with no run cap, using the worker's model. Select **Run investigation**.

For a different model, a run cap, a monthly investigation limit, or a repeat schedule, open **Advanced options** on the Run step.

## Read the findings

Open a saved investigation to see its **Findings**. **Needs attention** contains problems; **Patterns** contains other observations. Open a finding, then its supporting trace to read the original steps.

![Completed investigation with findings linked to supporting runs.](/img/lens/investigation-findings.jpg)

**Traces** shows the activity analyzed, **Criteria** holds your expectations and checks, and **History** contains previous runs. Use **Run now** to investigate again with the same settings.

If a finding describes acceptable behavior, choose **This is expected** and explain why. After a fix, choose **Mark resolved**.

## If something is not ready

If no traces appear, check the agent's export URL, authentication, and ClickHouse connection. New traces currently have a two-minute settling period before they appear in the investigation preview.

If the worker stays disconnected, check its container logs and the proxy URL in the install command. For a failed investigation, open its error details. To change model access or budgets, open the worker status and select **Settings**, or open **Virtual Keys**.

See [deployment and troubleshooting](./lens_deployment.md) for the commands.

## Read results through the API {#use-the-api}

Use `GET /lens` to find an investigation, `GET /lens/{id}` to read its findings, and `GET /v1/traces/{trace_id}` to inspect an original trace. See the [Lens API](./lens_api.md) for authentication and examples.

## Deployment details {#configure-an-existing-proxy}

See [Deploy Lens](./lens_deployment.md) for the architecture, Docker setup, existing-proxy configuration, and a prompt you can give a coding agent.
