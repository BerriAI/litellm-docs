---
slug: customer-portal
title: "Introducing Customer Portal for AI product builders"
date: 2026-11-13T09:00:00
authors:
  - ishaan
  - moe
  - kerry
  - tin
description: "Build customer budgets and usage into your AI product with LiteLLM AI Gateway APIs. Onboard customers, attribute spend, and power your dashboard."
tags: [ai-gateway, spend-tracking, customer-portal]
hide_table_of_contents: true
image: ./hero-flow-charge-budget.png
custom_hero: true
draft: true
---

import CustomerPortalHero from './CustomerPortalHero';
import {PostByline} from '@theme/BlogPostPage';
import styles from './customer-portal-hero.module.css';

<CustomerPortalHero />

<PostByline horizontal className={styles.byline} />

We're launching Customer Portal in LiteLLM: APIs to give your customers budgets and bring their AI usage into your product.

You can onboard customer organizations, teams, and members, attribute their model calls, and fetch their spend and budget settings from your backend. Use those APIs to build the dashboard your customers see and supply usage data to your billing system.

If your agents already run through LiteLLM, you already use the gateway to record their model costs. Customer Portal puts the customer structure and budget settings beside those records, so you can use the same source of truth throughout your product.

{/* truncate */}

## Start when a customer signs up

You ship an AI agent. A customer creates an account, invites colleagues, and chooses a plan. Your application already knows which company and person requested a task. You need to give that account an allowance before its members start making model calls.

Connect customer provisioning to your onboarding backend. Create a customer organization in LiteLLM, add its teams, then create the members who use your product. Keep stable IDs from your application so you can connect a signed-in account to its usage later.

| Your product needs to | API |
| --- | --- |
| Register a customer organization and its budget | `POST /management/v1/customer_organizations` |
| Add a team with its own budget | `POST /management/v1/customer_teams` |
| Add a member with inherited or custom budget settings | `POST /management/v1/customer_members` |

Set an overall organization budget, separate team budgets, and a default member allowance. Budget templates supply member defaults; overrides let you change an individual's settings. Use the resource's `PATCH` endpoint when a customer changes plans or needs a different allowance.

These customer resources represent the companies and people using the product you sell. LiteLLM keeps them separate from the internal teams and users who administer your gateway.

<figure data-full-width className={styles.productShot}>
  <img src="/img/customer_portal/member-caps.jpg" alt="LiteLLM's admin view shows customer team usage and two customer members with spend, token counts, and $50 member caps." loading="lazy" />
  <figcaption>Inspect customer team usage and member budgets in LiteLLM's admin view. This capture uses demo customer records.</figcaption>
</figure>

## Attribute the model calls at the AI Gateway

The customer starts using your agent. A task can involve several model calls, and different models and token counts produce different costs. Pass the customer identity on each call so you can account for the work behind the task.

Your backend adds two headers using the organization alias and member ID stored for the authenticated session:

```http
x-litellm-customer-org-alias: <customer-organization-alias>
x-litellm-customer-member-id: <customer-member-id>
```

LiteLLM resolves the member's team and organization, checks the applicable budgets, and attributes the usage at each level. Use the same headers with OpenAI Responses, Chat Completions, and Anthropic Messages.

The gateway checks the organization before the team and member and rejects a request when the spend available to that check has exhausted a budget. Accounting runs in the background, and requests can already be in flight when a threshold is reached. Builds preceding the [shared spend counter fix](https://github.com/BerriAI/litellm/pull/51568) can use cached spend until refresh. Allow for those delays when you display a remaining allowance.

## Build the usage page inside your product

Your customer opens account settings to check their usage. Your backend can fetch the organization total, show a team breakdown, and let them inspect a member's spend against their allowance.

For complete organization totals over a date range, call the aggregated activity API. The example below uses your gateway's root URL as `LITELLM_BASE_URL`, your server's proxy admin credential as `LITELLM_ADMIN_KEY`, and the customer's stored organization ID as `CUSTOMER_ORG_ID`:

```bash
curl --fail-with-body --silent --show-error --get \
  "$LITELLM_BASE_URL/management/v1/customer_organizations/daily/activity/aggregated" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --data-urlencode "customer_org_ids=$CUSTOMER_ORG_ID" \
  --data-urlencode "start_date=2026-11-01" \
  --data-urlencode "end_date=2026-11-30"
```

The response's `metadata` includes `total_spend` in USD, `total_tokens`, and `total_api_requests`. Team and member activity endpoints provide the detail behind that total. Read the resource records for their running spend, configured caps, and reset timestamps. A member's `effective_budget` includes its inherited settings and active overrides.

Keep management and usage calls on your backend: they require a proxy admin credential. Authenticate the customer and select the IDs they can access before querying LiteLLM. Your frontend receives the data your backend authorizes.

LiteLLM provides an admin view for your team to inspect usage. You build the customer-facing portal in your own application, with your authentication, branding, and navigation. Put a usage chart beside the customer's plan or a remaining allowance next to each member.

<figure data-full-width className={styles.productShot}>
  <img src="/img/customer_portal/usage-overview.jpg" alt="LiteLLM's customer organization usage view shows $0.14 spend, one request, 120 tokens, and a daily chart broken down by customer team." loading="lazy" />
  <figcaption>LiteLLM's admin usage view after a test request with demo customer records. The same usage APIs supply the data for a dashboard inside your product.</figcaption>
</figure>

## Carry the usage into billing and support

At the end of the billing period, fetch the customer's attributed usage as input to your pricing. You can pass through AI cost, add a markup, or compare usage with an included allowance. Your product applies those rules; your billing system creates invoices and collects payment.

Use the organization total for the customer's overall cost. The team and member views include the same requests, so adding all three levels together counts usage more than once. Read running spend and `budget_reset_at` for the current budget balance; use date-range activity for historical costs across resets.

If a customer questions a charge, follow the request's `x-litellm-call-id` through the [spend-log debugging guide](/docs/proxy/customer_portal/api_reference_guide#6-debug-a-request-in-spend-logs). Your team can inspect the request's attribution, cost, and token counts.

<figure data-full-width className={`${styles.productShot} ${styles.requestShot}`}>
  <img src="/img/customer_portal/spend-log-customer.jpg" alt="A saved request's Customer section shows its customer organization, team, and member, alongside $0.14 cost and 120 tokens in Metrics." loading="lazy" />
  <figcaption>Preview build with demo customer data: inspect a saved request's customer hierarchy and cost. Customer fields in spend logs are part of <a href="https://github.com/BerriAI/litellm/pull/51596">#51596</a>.</figcaption>
</figure>

## Connect the APIs to your product

Start with the [Customer Portal walkthrough](/docs/proxy/customer_portal/api_reference_guide): create a customer, set a budget, send an attributed request, and fetch its usage. Use the [API reference](/docs/proxy/customer_portal/api_reference) for the resource fields, budget settings, and usage responses.

Connect that flow to customer signup, account settings, and billing. Keep cost accounting and customer budget settings at the gateway, and use the APIs wherever your customers need that data in your product.

This launch draft includes the integration on `main` and the spend-log preview labeled above. A published release containing the complete flow has not been verified. Check the [availability reference](/docs/proxy/customer_portal/api_reference#availability) for the changes your deployment needs.
