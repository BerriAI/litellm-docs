---
slug: monetize-ai-agents
title: "How to Monetize Your AI Agent Without Losing Margin"
date: 2026-11-16T09:00:00
authors:
  - misbah
description: "Five ways AI-native companies charge for their agents, from prepaid credits to per-seat plans, and how LiteLLM Customer Management tracks cost and enforces budgets for each customer."
tags: [ai-gateway, spend-tracking, customer-portal]
hide_table_of_contents: true
custom_hero: true
draft: false
---

import {PostByline} from '@theme/BlogPostPage';
import MonetizeHero from './MonetizeHero';
import {CreditWallet, SeatAllowances, UsageInvoice, PlanUpgrade, ModelTiers} from './MonetizeFigures';
import styles from './monetize-hero.module.css';

<MonetizeHero />

<PostByline horizontal className={styles.byline} />

If you sell an AI agent to other companies, each request from your customers costs you money at the model provider. To monetize the agent, each customer must pay you more than the model cost of that customer. This post gives five frequent ways to charge for an agent. For each way, it shows the LiteLLM Customer Management controls that keep model spend below what the customer pays.

{/* truncate */}

## Request cost for the member, the team, and the organization

It is easy to set a price for your AI agent service. But oftentimes, teams find it difficult to track the cost of each customer request along with the assigned budgets. One customer sends short prompts to a small model. Another customer runs long agent loops on a frontier model. In a large account, one power user can spend more than all the other users together. If you do not know the cost of each customer, you find an underpriced plan only when the provider invoice arrives.

[LiteLLM Customer Management](/blog/customer-management) shows you the cost of each customer. Your agent sends two headers with each request. The headers give the organization alias and the member ID of the customer. LiteLLM records the cost of the request for the member, the team, and the organization. Before the request goes to the model, LiteLLM checks the budgets at all three levels.

```python
extra_headers={
    "x-litellm-customer-org-alias": "Acme",
    "x-litellm-customer-member-id": "acme-alice",
}
```

LiteLLM and your billing system do different tasks. LiteLLM records the cost of each customer and enforces the limits that you set. Your product sets the prices, the credit balances, and the plans. Your billing system collects the payment.

## Use case 1: Prepaid credits

Some companies offer credit packs to their customers. For example, coding agents or AI app builders let customers pay first for a credit pack and then use the AI coding agent. If a member buys $100 in credits, chances are that $60 to $70 of it is set as the budget for model spend. The remaining amount is the margin for the company. Now, if the usage is not tracked properly, the risk is that the customer exceeds the allowed budget and consumes part of the margin.

LiteLLM allows you to monitor this spend and stops new requests from that customer when the spend limit is reached.

<CreditWallet />

## Use case 2: Per-seat plans with an allowance

Some companies offer AI agents as assistants or researchers, with a price per seat.

Now, even though the price is the same for each seat, the usage of each seat could be quite different. A power-user tends to have significantly higher usage than a default-user.

A `default-user` template could have a $60 monthly cap, sufficient for most seats in the company. A `power-user` template with a $90 cap could be for the analysts who use the agent all day. When a new member sends their first request, LiteLLM applies the default template of the organization, and you do not have to configure each seat manually.

<SeatAllowances />

Also set an organization cap above the templates. This cap limits the total spend of one company to the amount that the company pays you. The cap stays in effect when the company adds seats. If the contract is annual, `budget_limits` can hold a monthly window and a yearly window on the same budget. Each window resets on its own schedule.

## Use case 3: Usage-based billing with a markup

A platform for customer support agents can bill each client company monthly for its usage. At the end of the period, the platform must have an accurate cost for each client. Then it adds its markup to that cost. The usage API gives the full totals for one organization over a date range. The totals include `total_spend`, `total_tokens`, and `total_api_requests`.

<UsageInvoice />

```bash
curl --get "$LITELLM_BASE_URL/management/v1/customer_organizations/daily/activity/aggregated" \
  --header "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --data-urlencode "customer_org_ids=org-acme" \
  --data-urlencode "start_date=2026-11-01" \
  --data-urlencode "end_date=2026-11-30"
```

Your billing system multiplies that spend by your markup and sends the invoice. Also set a hard cap on usage-based plans. If an agent loop does not stop, or if a key leaks, the cost can increase quickly. The hard cap limits that cost before a person reads the invoice.

## Use case 4: Upgrades at the cap

Some sales or marketing content agents have Starter and Pro plans. When a customer reaches the Starter limit, that customer is a possible Pro customer. Customer Management gives you two signals at that time. If you set a `soft_budget` below the cap, LiteLLM sends a `soft_budget_crossed` event to your budget webhook. Use this event to show an upgrade prompt before LiteLLM blocks the customer. At the cap, LiteLLM sends a `budget_crossed` event and refuses new requests with a budget error.

<PlanUpgrade />

The next step depends on the `cap_policy` of the member. With `pause_until_reset`, the member waits for the next budget period. This policy is good for a free tier. With `pause_allow_increase`, the member can send a budget increase request. You approve the request in your own review flow after the customer upgrades or buys more credits.

Webhook delivery is best effort. Thus, also read the usage data to make sure that your records agree with LiteLLM.

## Use case 5: Plan tiers with a lower-cost fallback

A research or analytics agent can offer a premium model only on higher tiers. Frontier models have the highest cost for each request, so they use your margin fastest. When the premium allowance of a customer is empty, the customer can continue to work. To do this, give the virtual key of the customer a per-model budget for the premium model and a fallback to a lower-cost model. The customer then uses the lower-cost model until the overall budget is empty. The organization, team, and member caps still apply.

<ModelTiers />

Per-model key budgets and [budget fallbacks](/docs/proxy/budget_fallbacks) are available only with LiteLLM Enterprise.

## Which control fits which plan

| How you charge | Example use case | Customer Management control |
| --- | --- | --- |
| Prepaid credits | Coding agent, app builder | Member cap below the credit value |
| Per seat | Legal or finance assistant | Budget templates per seat type, organization cap |
| Usage-based | Support agent platform | Usage aggregate API per organization, hard cap as a safety limit |
| Tiered plans | Content or sales agent | `soft_budget` webhook for upgrade prompts, `cap_policy` and increase requests |
| Premium model tiers | Research or analytics agent | Per-model key budget with a lower-cost fallback (Enterprise) |

You can use these controls together. For example, a per-seat plan with credit top-ups uses the same headers and the same budget hierarchy. A usage plan with a premium model tier also uses them.

## Show customers their own usage

Your backend uses the usage and budget APIs for billing. You can also use the same APIs for a usage page in your product. Then the customer sees the same spend that you charge for, next to their credits and upgrade options. Keep the admin key on your backend. Give each customer access to the data of their own organization only.

## Get started

To import a customer, send a request with their identity, and read their usage, follow the [Track customer spend walkthrough](/docs/proxy/customer_management/track-customer-spend). The [API reference](/docs/proxy/customer_management/api_reference) gives the details of templates, overrides, cap policies, and webhooks. Without an Enterprise license, Customer Management is free. The limit is 5 customer organizations, 5 teams for each organization, and 5 members for each team.

The customer APIs are on `main`. We did not yet verify that a published release contains the full flow. Before you deploy, check the [availability](/docs/proxy/customer_management/api_reference#availability).

If you build an agent for your customers and want help with budgets for your prices, [complete the form](https://docs.google.com/forms/d/e/1FAIpQLSfqKoWifvdeFtN-CSMQr2aEIYfpoc7D9t8Fjxb_fAOKPJbVNg/viewform). We will contact you within 24 hours.
