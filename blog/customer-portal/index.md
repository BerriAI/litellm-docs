---
slug: customer-portal
title: "Introducing LiteLLM Customer Portal"
date: 2026-11-13T09:00:00
authors:
  - ishaan
  - moe
  - kerry
  - tin
description: "Track customer spend and set organization, team, and member budgets with LiteLLM AI Gateway. Use the APIs to build these controls into your product."
tags: [ai-gateway, spend-tracking, customer-portal]
hide_table_of_contents: true
image: ./hero-flow-charge-budget.png
custom_hero: true
draft: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import CustomerPortalHero from './CustomerPortalHero';
import {CostComplexity, CustomerHierarchyBreakdown, CustomerEntityBudgets, CustomerMargin, CustomerBudgetAlert, CustomerBudgetFallback} from './CustomerHierarchy';
import {PostByline} from '@theme/BlogPostPage';
import styles from './customer-portal-hero.module.css';

<CustomerPortalHero />

<PostByline horizontal className={styles.byline} />

Today we're launching **LiteLLM Customer Portal** for AI-native companies using the gateway. If you're building an agent on LiteLLM and need to track spend and set budget limits for your customers by their organizations, teams, and individual members, this is for you.

{/* truncate */}

## Who is this for?

For AI-native companies building production agents using LiteLLM AI Gateway who need to run their agents profitably, with positive ROI.

## The problem

With B2B AI agents, cost tracking gets complicated across customer organizations, teams, and individual members. If you sell pay-as-you-go credits or usage-based plans, actual spend can exceed what your customer paid and hurt your margin.

<CustomerMargin stage="uncontrolled" />

Different models, providers, and request parameters multiply that complexity.

<CostComplexity />

Track that spend by customer organization, team, and member:

<CustomerHierarchyBreakdown />

That's a bunch of glue code to build around your agent. Since LiteLLM is already your source of truth for model costs, we're exposing APIs to track customer spend, set budgets, and build these controls into your product.

## How to use LiteLLM AI Gateway for this problem

Point your agent to LiteLLM AI Gateway and send your customer's organization alias and member ID:

<Tabs groupId="customer-portal-sdk">
<TabItem value="openai" label="OpenAI Responses" default>

```python
import os

from openai import OpenAI

client = OpenAI(
    api_key=os.environ["LITELLM_API_KEY"],
    base_url=f"{os.environ['LITELLM_BASE_URL'].rstrip('/')}/v1",
)
raw_response = client.responses.with_raw_response.create(
    model=os.environ["LITELLM_MODEL"],
    input="Write a short welcome message.",
    max_output_tokens=128,
    extra_headers={
        # highlight-start
        "x-litellm-customer-org-alias": "Acme",
        "x-litellm-customer-member-id": "acme-alice",
        # highlight-end
    },
)
response = raw_response.parse()
print(response.output_text)
print("LiteLLM call ID:", raw_response.headers.get("x-litellm-call-id"))
```

Install with `pip install openai`.

</TabItem>
<TabItem value="deepagents" label="LangChain Deep Agents">

```python
import os

from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

model = ChatOpenAI(
    model=os.environ["LITELLM_MODEL"],
    base_url=f"{os.environ['LITELLM_BASE_URL'].rstrip('/')}/v1",
    api_key=os.environ["LITELLM_API_KEY"],
    use_responses_api=True,
    default_headers={
        # highlight-start
        "x-litellm-customer-org-alias": "Acme",
        "x-litellm-customer-member-id": "acme-alice",
        # highlight-end
    },
)
agent = create_deep_agent(model=model)
result = agent.invoke({"messages": [{"role": "user", "content": "Say hello to Alice."}]})
print(result["messages"][-1].text)
```

Install with `pip install deepagents langchain-openai`. Configure the model for the authenticated customer; pass the same identity to any other models the agent calls.

</TabItem>
</Tabs>

That's it for attributing the call. LiteLLM resolves the member's customer team and organization and records the spend. The same headers work with Responses, Chat Completions, and Anthropic Messages.

Use your application key and a gateway model alias. `LITELLM_BASE_URL` is the gateway root URL; [register the customer first](/docs/proxy/customer_portal/track-customer-spend#2-import-a-customer), and select their identity from your authenticated session.

<figure data-full-width className={`${styles.productShot} ${styles.requestShot}`}>
  <a className={styles.screenshotLink} href="/img/customer_portal/launch-spend-log-dark.webp" target="_blank" rel="noopener noreferrer" aria-label="Open the request customer attribution screenshot at full resolution">
    <img src="/img/customer_portal/launch-spend-log-dark.webp" width="2481" height="1533" alt="A saved request's Customer section shows its customer organization, team, and member, alongside $0.14 cost and 120 tokens in Metrics." loading="lazy" />
  </a>
  <figcaption>Follow a request into spend logs to see its customer organization, team, member, and cost. Demo data. <a href="/img/customer_portal/launch-spend-log-dark.webp" target="_blank" rel="noopener noreferrer">View full size.</a></figcaption>
</figure>

### Set customer budgets that protect your margin

If a member buys $100 in credits, set a $60 budget for actual spend to protect your margin. Set separate budgets for the customer organization, each team, and each member:

<CustomerEntityBudgets />

The same request's cost rolls up from the member to their team and organization. Here, the member hits their $60 cap while both parents still have room, so further requests pause.

Choose the organization cap and default member profile when you onboard a customer. These examples use a 30-day budget period:

<Tabs groupId="customer-portal-budget-setup">
<TabItem value="api" label="API" default>

```bash
curl --fail-with-body --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_organizations" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "customer_org_id": "org-acme",
    "alias": "Acme",
    "budget": {
      "max_budget": 1000,
      "budget_duration": "30d"
    },
    "default_budgets": [{
      "name": "default-user",
      "max_budget": 60,
      "soft_budget": 48,
      "budget_duration": "30d"
    }],
    "default_budget_template": "default-user"
  }'
```

Use a server-side proxy admin credential as `LITELLM_ADMIN_KEY`. [Add the customer's teams and members](/docs/proxy/customer_portal/track-customer-spend#2-import-a-customer); new members inherit the default profile.

</TabItem>
<TabItem value="ui" label="LiteLLM UI">

Open **Customer Portal → Customers → your customer → Settings**. Use **Set budget** or **Edit budget** to set **Spend limit (USD)** and **Reset period**. Select a member's **Budget template** for its default allowance.

</TabItem>
</Tabs>

<figure data-full-width className={styles.productShot}>
  <a className={styles.screenshotLink} href="/img/customer_portal/launch-member-caps-dark.webp" target="_blank" rel="noopener noreferrer" aria-label="Open the customer member budgets screenshot at full resolution">
    <img src="/img/customer_portal/launch-member-caps-dark.webp" width="4008" height="789" alt="Customer member spend in the latest LiteLLM UI, with monthly and yearly budget windows, share of customer spend, tokens, and status." loading="lazy" />
  </a>
  <figcaption>Customer member spend and budget windows in the latest LiteLLM UI. Seeded demo data. <a href="/img/customer_portal/launch-member-caps-dark.webp" target="_blank" rel="noopener noreferrer">View full size.</a></figcaption>
</figure>

At the cap, LiteLLM rejects new requests based on recorded spend. Leave room for accounting delays and requests already in flight.

### Give default users and power users different profiles

Some customers need more allowance. Create a power-user profile, then assign its returned `budget_id` when you create new members. Use the same APIs in your product so your customer's admins can manage these profiles.

```bash
curl --fail-with-body --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_organizations/org-acme/default_budgets" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "power-user",
    "max_budget": 90,
    "soft_budget": 72,
    "budget_duration": "30d"
  }'
```

### Trigger a webhook when a customer hits their limit

<CustomerBudgetAlert />

When a member reaches their $60 cap, use the budget webhook to alert your team or open an approval request. Your receiver formats the notification from LiteLLM's JSON event. [Configure and test delivery](/docs/proxy/customer_portal/track-customer-spend#1-set-up-budget-webhooks); reconcile missed alerts with usage reads because delivery is best effort.

### Approve a temporary increase when your customer upgrades

When the customer buys another $50 in credits, their total becomes $150. After approval, apply a temporary $90 cap on actual spend, as shown above.

Set `INCREASE_EXPIRES_AT` to a future timestamp with a timezone, then apply the temporary member override:

```bash
curl --fail-with-body --request PATCH \
  "$LITELLM_BASE_URL/management/v1/customer_members/acme-alice" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --header "Content-Type: application/json" \
  --data "{
    \"budget_override\": {\"max_budget\": 90},
    \"budget_override_expires_at\": \"$INCREASE_EXPIRES_AT\"
  }"
```

Your product manages credit purchases and balances. LiteLLM applies the spend allowance until it expires; the organization and team caps still apply. Use the [approval APIs](/docs/proxy/customer_portal/api_reference#budget-increase-requests) if your workflow needs a review queue.

### Put the usage and budget controls in your own product

Put usage next to the customer's credits and top-up options. Our APIs let your backend fetch actual spend and budget settings, so the customer sees the same costs you use for chargebacks:

<figure data-full-width className={`${styles.productShot} ${styles.usageShot}`}>
  <a className={styles.screenshotLink} href="/img/customer_portal/launch-usage-overview-dark.webp" target="_blank" rel="noopener noreferrer" aria-label="Open the customer organization usage screenshot at full resolution">
    <img src="/img/customer_portal/launch-usage-overview-dark.webp" width="4008" height="2262" alt="Customer organization usage in the dark LiteLLM UI, with spend and token totals and a daily trend across three models." loading="lazy" />
  </a>
  <figcaption>Demo usage across three models, with 13 days of activity. Track the customer's total and inspect the model costs behind it. <a href="/img/customer_portal/launch-usage-overview-dark.webp" target="_blank" rel="noopener noreferrer">View full size.</a></figcaption>
</figure>

Fetch complete organization totals for a date range:

```bash
curl --fail-with-body --silent --show-error --get \
  "$LITELLM_BASE_URL/management/v1/customer_organizations/daily/activity/aggregated" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --data-urlencode "customer_org_ids=org-acme" \
  --data-urlencode "start_date=2026-11-01" \
  --data-urlencode "end_date=2026-11-30"
```

Read `metadata.total_spend`, `total_tokens`, and `total_api_requests`. Fetch caps from the organization, team, and member records; keep admin credentials on your backend and authorize each customer's access. Your billing system applies your prices and collects payment.

### Keep serving requests with a lower-cost model

Give a customer's dedicated virtual key an Opus allowance, then configure a lower-cost fallback for when that model allowance runs out. The customer can keep using your agent while they still have room in their overall budget.

<CustomerBudgetFallback />

Set `model_max_budget` and `budget_fallbacks` on the key with your configured model aliases. These [per-model key budgets](/docs/proxy/users#-virtual-key-model-specific) require Enterprise. A shared key pools its model budget across callers; customer organization, team, and member hard caps still stop requests when exhausted. See [Budget Fallbacks](/docs/proxy/budget_fallbacks) for the API setup.

## OSS and Enterprise

| Customer Portal | LiteLLM OSS | LiteLLM Enterprise |
| --- | --- | --- |
| Customer organizations | Up to 5 | More than 5 |
| Customer teams per organization | Up to 5 | More than 5 |
| Customer members per team | Up to 5 | More than 5 |

Start with the [walkthrough](/docs/proxy/customer_portal/track-customer-spend) and [API reference](/docs/proxy/customer_portal/api_reference). For larger customer hierarchies, [talk to us about Enterprise](https://www.litellm.ai/enterprise).

This draft targets `main`; a published release containing the complete flow has not been verified. Check [availability](/docs/proxy/customer_portal/api_reference#availability) before deploying.
