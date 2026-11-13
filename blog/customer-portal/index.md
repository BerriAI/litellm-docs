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
draft: true
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import CustomerPortalHero from './CustomerPortalHero';
import CustomerHierarchy, {CustomerBudgetAlert} from './CustomerHierarchy';
import {PostByline} from '@theme/BlogPostPage';
import styles from './customer-portal-hero.module.css';

<CustomerPortalHero />

<PostByline horizontal className={styles.byline} />

Today we're launching **LiteLLM Customer Portal** for AI-native companies using the gateway. If you're building an agent on LiteLLM and need to track spend and set budget limits for your customers by their organizations, teams, and individual members, this is for you.

{/* truncate */}

## Who is this for?

For AI-native companies building production agents using LiteLLM AI Gateway who need to run their agents profitably, with positive ROI.

## The problem

The simple version:

- Tracking costs across models and providers is hard.
- With B2B AI agents, the complexity grows. You need cost tracking, budgets, and chargebacks for each customer organization, team, and member.
- Within the same customer, you have default users and power users who need different allowances.

Your customer's Sales admin might want each member to spend up to $100 a month. Engineering might need $500 per member. Both teams still sit under the same customer organization's overall budget.

<CustomerHierarchy />

When you serve an agent to customers, you need a way to charge them for their usage. With B2B agents, you also need to account for their hierarchy: **customer organization → customer teams → customer members**. Your customers want spend tracking and budget controls at each level.

We want you to have the controls you need to protect your agent's profit margin: set allowances at the right level, see which users keep hitting their limits, and create budget profiles for default users and power users.

That's a bunch of glue code to build around your agent. Add the different prices for each model, provider, and request parameter, and your application's billing logic gets more complex.

Since LiteLLM is already your source of truth for model costs, we're exposing APIs to consume that data and control spend for your customers. Use them in your own product for customer onboarding, usage pages, budget settings, and chargebacks. Your billing system applies your prices, creates invoices, and collects payment.

## How to use LiteLLM AI Gateway

### Step 1. Identify your customer organization and member

For an existing customer, the change to your model call is two headers: the **customer organization alias** and the **customer member ID**. LiteLLM resolves the member's team and organization and attributes the request's cost at each level.

The examples below use `Acme` and `acme-alice` as sample IDs. Register the organization, team, and member using Step 2 before running the SDK example. Use IDs from your own product in production.

Set `LITELLM_BASE_URL` to your gateway URL without `/v1`, `LITELLM_API_KEY` to your application's gateway key, and `LITELLM_MODEL` to a model alias that key can use. The same application key can serve your customers; your backend chooses the identity from the authenticated customer's session.

<Tabs groupId="customer-portal-sdk">
<TabItem value="openai" label="OpenAI Responses" default>

Install it with `pip install openai`, then add `extra_headers` to your Responses call:

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

</TabItem>
<TabItem value="deepagents" label="LangChain Deep Agents">

Install them with `pip install deepagents langchain-openai`. Pass the headers through your model's `default_headers`:

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

Use a model configuration scoped to that customer's request. Configure other models your agent calls with the same customer identity. See [Deep Agents model configuration](https://docs.langchain.com/oss/python/deepagents/models#openai-and-the-responses-api).

</TabItem>
</Tabs>

That's it for the model call: send LiteLLM the organization alias and the member ID within that organization. We'll track the spend. The same headers work with Chat Completions and Anthropic Messages.

Your spend lands in **Customer Portal → Customers** in the LiteLLM UI. Open the customer to see its spend, requests, tokens, and model breakdown.

<figure data-full-width className={styles.productShot}>
  <a className={styles.screenshotLink} href="/img/customer_portal/launch-usage-overview.webp" target="_blank" rel="noopener noreferrer" aria-label="Open the customer organization usage screenshot at full resolution">
    <img src="/img/customer_portal/launch-usage-overview.webp" width="3270" height="4266" alt="Customer organization usage in LiteLLM, with spend and token totals, a daily trend across three models, and a per-model breakdown." loading="lazy" />
  </a>
  <figcaption>Demo usage across three models, with 13 days of activity. Track the customer's total and inspect the model costs behind it. <a href="/img/customer_portal/launch-usage-overview.webp" target="_blank" rel="noopener noreferrer">View full size.</a></figcaption>
</figure>

### Step 2. Set a customer organization budget and a default member profile

Give the customer an overall budget and choose a default allowance for its members. In this example, the organization has a $1,000 cap and each default member has a $100 cap. The examples use a 30-day budget period.

Run management calls from your backend using `LITELLM_ADMIN_KEY`, a proxy admin credential. Keep this credential on your server and authorize the customer's access before exposing budget or usage data through your product.

<Tabs groupId="customer-portal-budget-setup">
<TabItem value="api" label="API" default>

Create the organization and its default member profile:

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
      "max_budget": 100,
      "soft_budget": 80,
      "budget_duration": "30d"
    }],
    "default_budget_template": "default-user"
  }'
```

Create a team within that organization, then add a member. Omitting `budget_id` assigns the organization's default member profile:

```bash
curl --fail-with-body --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_teams" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "customer_team_id": "acme-sales",
    "parent_org_id": "org-acme",
    "alias": "Sales",
    "budget": {"max_budget": 500, "budget_duration": "30d"}
  }'

curl --fail-with-body --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_members" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "customer_member_id": "acme-alice",
    "alias": "Alice",
    "parent_org_id": "org-acme",
    "parent_team_ids": ["acme-sales"]
  }'
```

Each create returns `201`. Use `PATCH` on the existing resource when you need to change a budget; repeating a create with the same ID returns `409`.

</TabItem>
<TabItem value="ui" label="LiteLLM UI">

Open **Customer Portal → Customers**, select your customer, then open **Settings**. Use **Set budget** or **Edit budget** to set its **Spend limit (USD)** and **Reset period**.

In the customer's teams and members, use **Budget and limits** to inspect the applicable controls. A member's **Budget template** supplies its default settings. You can inspect member spend and allowances together in the customer usage view:



</TabItem>
</Tabs>

<figure data-full-width className={styles.productShot}>
  <a className={styles.screenshotLink} href="/img/customer_portal/launch-member-caps.webp" target="_blank" rel="noopener noreferrer" aria-label="Open the customer member budgets screenshot at full resolution">
    <img src="/img/customer_portal/launch-member-caps.webp" width="3172" height="1153" alt="Customer member spend and budgets in LiteLLM, with token counts and $50 caps for two demo members." loading="lazy" />
  </a>
  <figcaption>Demo members and their configured allowances in the LiteLLM admin UI. <a href="/img/customer_portal/launch-member-caps.webp" target="_blank" rel="noopener noreferrer">View full size.</a></figcaption>
</figure>

The organization cap covers the customer's total usage. The team cap covers that team's usage, and the member cap covers that person's usage. LiteLLM checks the applicable caps before allowing a model request. Accounting runs in the background, so allow for updates and requests already in flight when you display a remaining balance.

### Step 3. Create budget profiles for your customer's members

Some enterprise customers want different profiles for different users. Give default users $100 and power users $500, or let a customer's admin choose profiles for Sales and Engineering members.

Expose these APIs through your product so your customers can manage those allowances. A budget profile maps to an organization-owned **member budget template** in the API. Team and organization caps remain separate controls.

Create a power-user profile:

```bash
curl --fail-with-body --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_organizations/org-acme/default_budgets" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "power-user",
    "max_budget": 500,
    "soft_budget": 400,
    "budget_duration": "30d"
  }'
```

The response includes the organization's updated `default_budgets`. Save the `budget_id` for `power-user` as `PROFILE_BUDGET_ID`. When you create a new member, assign that profile using `budget_id`. The following example uses the Sales team created above:

```bash
curl --fail-with-body --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_members" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --header "Content-Type: application/json" \
  --data "{
    \"customer_member_id\": \"acme-power-user\",
    \"parent_org_id\": \"org-acme\",
    \"parent_team_ids\": [\"acme-sales\"],
    \"budget_id\": \"$PROFILE_BUDGET_ID\"
  }"
```

You can also `PATCH /management/v1/customer_members/{customer_member_id}` with `budget_id` to change an existing member's profile. Updating a template changes the settings its assigned members inherit. Changing the organization's default affects new members; it does not reassign existing ones. Read a member's `effective_budget` to show the limits that apply, including active overrides.

### Step 4. Trigger workflows when a customer reaches a budget

With a $100 member cap and an $80 soft threshold, you can notify your team before the member runs out of allowance. Configure the customer budget callback in your gateway and point it at your backend's webhook receiver:

```yaml title="Add to your existing gateway config.yaml"
general_settings:
  use_spend_logs_ledger: true

litellm_settings:
  callbacks: [customer_budget_webhook]

callback_settings:
  customer_budget_webhook:
    endpoint: https://billing.example.com/litellm/customer-budget
```

Merge this with your existing settings and restart the gateway before testing delivery. Keep any existing callbacks in the list.

After a positive spend update commits, LiteLLM emits `soft_budget_crossed` at the soft threshold and `budget_crossed` at the hard cap. The JSON event includes the customer scope and IDs, spend, triggering budget, and budget period. Your receiver can use that information to send a Slack alert:

<CustomerBudgetAlert />

LiteLLM sends JSON to your receiver. Your workflow formats the Slack message; a Slack incoming-webhook URL needs that adapter. See [Slack's incoming-webhook format](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).

Set the hard cap up front so LiteLLM can reject later requests when the recorded spend reaches it. A soft-budget alert does not pause traffic. Your workflow can notify the customer, open an approval request, or update a cap after a policy check.

For example, after approving a larger allowance for an existing member, your backend can set a $250 override:

```bash
curl --fail-with-body --request PATCH \
  "$LITELLM_BASE_URL/management/v1/customer_members/acme-alice" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --header "Content-Type: application/json" \
  --data '{"budget_override": {"max_budget": 250}}'
```

This preserves recorded spend. The team's and organization's caps still apply. Add `budget_override_expires_at` with a future timestamp to make an increase temporary, or use the [budget increase request and approval APIs](/docs/proxy/customer_portal/api_reference#budget-increase-requests) for a review queue.

Return `2xx` from your receiver within 10 seconds. Delivery is best effort, and LiteLLM suppresses repeat events for the same scope, entity, and budget period even after a delivery failure. Use usage reads to reconcile missed events. The [walkthrough](/docs/proxy/customer_portal/track-customer-spend#4-check-budgets-and-webhook-delivery) shows how to test budget rejection and webhook delivery.

## Put the usage and budget controls in your own product

Use the usage APIs to build a customer-facing dashboard, display a remaining allowance, or feed your chargeback calculations. Fetch complete organization totals for a date range:

```bash
curl --fail-with-body --silent --show-error --get \
  "$LITELLM_BASE_URL/management/v1/customer_organizations/daily/activity/aggregated" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --data-urlencode "customer_org_ids=org-acme" \
  --data-urlencode "start_date=2026-11-01" \
  --data-urlencode "end_date=2026-11-30"
```

Read `metadata.total_spend`, `total_tokens`, and `total_api_requests`. Team and member activity APIs provide the breakdowns; resource reads provide running spend, caps, and reset timestamps. Your backend authorizes the customer, calls LiteLLM, and returns the data they can access.

Use the organization total for the customer's overall cost. Team and member totals include the same requests, so adding all three levels together counts usage more than once. Your product applies any markup or plan pricing before handing the result to your billing system.

If you need to debug a charge, follow the request's `x-litellm-call-id` into spend logs to inspect its customer organization, team, member, cost, and token counts:

<figure data-full-width className={`${styles.productShot} ${styles.requestShot}`}>
  <a className={styles.screenshotLink} href="/img/customer_portal/launch-spend-log.webp" target="_blank" rel="noopener noreferrer" aria-label="Open the request customer attribution screenshot at full resolution">
    <img src="/img/customer_portal/launch-spend-log.webp" width="2020" height="1052" alt="A saved request's Customer section shows its customer organization, team, and member, alongside $0.14 cost and 120 tokens in Metrics." loading="lazy" />
  </a>
  <figcaption>A saved request with demo customer data: inspect the resolved hierarchy and request cost. <a href="/img/customer_portal/launch-spend-log.webp" target="_blank" rel="noopener noreferrer">View full size.</a></figcaption>
</figure>

## OSS and Enterprise

| Customer Portal | LiteLLM OSS | LiteLLM Enterprise |
| --- | --- | --- |
| Customer organizations | Up to 5 | More than 5 |
| Customer teams | Up to 5 | More than 5 |
| Customer members | Up to 5 | More than 5 |

Start with the [Customer Portal walkthrough](/docs/proxy/customer_portal/track-customer-spend) and [API reference](/docs/proxy/customer_portal/api_reference). For more than five customer organizations, teams, or members, [talk to us about LiteLLM Enterprise](https://www.litellm.ai/enterprise).

This launch draft targets the current `main` implementation. We have not verified a published release containing the complete flow. Check [availability](/docs/proxy/customer_portal/api_reference#availability) before deploying it.
