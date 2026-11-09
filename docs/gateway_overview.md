---
id: gateway_overview
title: LiteLLM AI Gateway
sidebar_label: LiteLLM Gateway
slug: /simple_proxy
description: The LiteLLM AI Gateway is a self-hosted server that gives your applications one OpenAI-compatible endpoint for 100+ LLM providers, MCP tools, and A2A agents.
---

import NavigationCards from '@site/src/components/NavigationCards';
import QuickStartBox from '@site/src/components/QuickStartBox';
import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LiteLLM AI Gateway

The LiteLLM AI Gateway is a self-hosted server. It gives your applications one OpenAI-compatible endpoint for 100+ LLM providers, MCP tools, and A2A agents.

Your applications send requests to the gateway. The gateway sends each request to the provider of the model. Then the gateway sends the response back to your application in the OpenAI format. If a client can use the OpenAI API, the client can also use the gateway. You do not change the client code.

<QuickStartBox variant="gateway" showTitle={false} heading="Start the gateway now" source="gateway-overview">

When the command completes, open the Admin UI at `http://localhost:4000/ui`. For each step, refer to the [Quickstart](/docs/proxy/docker_quick_start).

</QuickStartBox>

## What the gateway does

- **Access control.** Give each user, team, and project a virtual key. Each key has its models, budgets, and rate limits.
- **Spend tracking.** The gateway records the cost of each request. You can see the spend for each key, team, user, and tag.
- **Reliability.** Load balancing, fallbacks, and retries move traffic between deployments when a provider has a problem.
- **Guardrails.** Apply content filters, PII masking, and policies to requests and responses.
- **Logging.** Send logs and metrics to Langfuse, Datadog, OpenTelemetry, Prometheus, and other tools.
- **Admin UI.** Add models, add keys, and look at spend and logs in a browser.
- **MCP and agents.** The same gateway also gives access to [MCP tools](/docs/mcp) and [A2A agents](/docs/a2a). It uses the same keys and spend records.

## Set up the gateway

The pages in this section follow the steps of a new deployment. Do the steps in the table that follows:

| Step | What you do | Start here |
|---|---|---|
| 1. Deploy | Start the gateway with Docker, Helm, or Terraform. Connect a Postgres database. | [Quickstart](/docs/proxy/docker_quick_start), [Production deployment](/docs/proxy/deploy) |
| 2. Add models and providers | Add the models that your users can call. Add MCP tools and agents if necessary. | [Model management](/docs/proxy/model_management), [Providers](/docs/providers) |
| 3. Connect clients | Set the gateway URL and a virtual key in your applications and coding tools. | [Client setup](/docs/proxy/client_setup/overview) |
| 4. Set up authentication | Add virtual keys. Connect your identity provider for single sign-on. | [Virtual keys](/docs/proxy/virtual_keys), [Admin UI SSO](/docs/proxy/admin_ui_sso) |
| 5. Track spend and set budgets | Assign costs to teams and projects. Set budgets and rate limits. | [Spend tracking](/docs/proxy/cost_tracking), [Budgets](/docs/proxy/users) |

## Call the gateway

After you start the gateway, use the OpenAI client with the gateway URL and a virtual key:

```python
import openai

client = openai.OpenAI(api_key="sk-your-virtual-key", base_url="http://localhost:4000")

response = client.chat.completions.create(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Write a short poem"}],
)
print(response.choices[0].message.content)
```

## Admin UI

The Admin UI is part of the gateway. Use it to set up and monitor the gateway in a browser:

<Tabs>
<TabItem value="models" label="Models" default>

Add models from each provider. The table shows the price of input and output tokens for each model.

<Image img={require('../img/ui_tour_models.png')} dark={require('../img/ui_tour_models_dark.png')} alt="Models page with five models from OpenAI, Anthropic, and Google, and the token price of each model" />

</TabItem>
<TabItem value="keys" label="Virtual keys">

Give each application or person a virtual key. Each key has a team, a budget, and a list of models.

<Image img={require('../img/ui_tour_keys.png')} dark={require('../img/ui_tour_keys_dark.png')} alt="Virtual Keys page with five keys, the team of each key, and the spend of each key against its budget" />

</TabItem>
<TabItem value="mcp" label="MCP servers">

Add MCP servers. Agents use the tools of these servers through the gateway, with the same virtual keys.

<Image img={require('../img/ui_tour_mcp.png')} dark={require('../img/ui_tour_mcp_dark.png')} alt="MCP Servers page with two connected MCP servers and their health status" />

</TabItem>
<TabItem value="guardrails" label="Guardrails">

Add guardrails that examine requests before the model receives them, for example PII masking.

<Image img={require('../img/ui_tour_guardrails.png')} dark={require('../img/ui_tour_guardrails_dark.png')} alt="Guardrails page with a PII masking guardrail and a harmful content guardrail" />

</TabItem>
<TabItem value="usage" label="Usage">

Look at the spend, the requests, and the tokens for all teams, keys, and models.

<Image img={require('../img/ui_tour_usage.png')} dark={require('../img/ui_tour_usage_dark.png')} alt="Usage page with total spend, request counts, token counts, and a daily spend chart" />

</TabItem>
<TabItem value="logs" label="Logs">

Find each request with its cost, duration, team, key, and model.

<Image img={require('../img/ui_tour_logs.png')} dark={require('../img/ui_tour_logs_dark.png')} alt="Request Logs page with a table of requests, the cost of each request, and the team and key that sent it" />

</TabItem>
</Tabs>

## Gateway or Python SDK

Use the gateway if more than one application or person sends requests to LLMs. Also use the gateway if virtual keys, spend tracking, logs in one location, or guardrails are necessary. Use the [Python SDK](/docs/python_sdk) if you send requests from one Python application and these controls are not necessary.

## Next steps

<NavigationCards
columns={3}
items={[
{
title: "Quickstart",
description: "Start the gateway and send your first request in approximately five minutes.",
to: "/docs/proxy/docker_quick_start",
},
{
title: "Production deployment",
description: "Deploy with Helm or Terraform, and size the database and Redis.",
to: "/docs/proxy/deploy",
},
{
title: "Client setup",
description: "Connect Claude Code, Codex, and other clients to the gateway.",
to: "/docs/proxy/client_setup/overview",
},
{
title: "MCP Gateway",
description: "Give agents access to MCP tools through one endpoint.",
to: "/docs/mcp",
},
{
title: "Agent Gateway",
description: "Add and call A2A agents through the gateway.",
to: "/docs/a2a",
},
{
title: "Enterprise",
description: "SSO, audit logs, and support for production deployments.",
to: "/docs/enterprise",
},
]}
/>
