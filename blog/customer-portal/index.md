---
slug: customer-portal
title: "Introducing Customer Portal for AI agent builders"
date: 2026-11-13T09:00:00
authors:
  - ishaan
  - moe
  - kerry
  - tin
description: "Give your AI agent's customers budgets with LiteLLM AI Gateway. Track spend by company, team, and member, then build your own usage portal."
tags: [ai-gateway, spend-tracking, customer-portal]
hide_table_of_contents: true
image: ./hero-flow-charge-budget.png
custom_hero: true
draft: true
---

import CustomerPortalHero from './CustomerPortalHero';
import {PostByline} from '@theme/BlogPostPage';
import {SideRails} from '../litellm_lens_launch/LaunchHero';
import styles from './customer-portal-hero.module.css';

export const sections = [
  [
    "built-for-the-developer-shipping-an-ai-agent",
    "AI agent builders"
  ],
  [
    "give-acme-a-budget-then-its-teams-and-members",
    "Customer budgets"
  ],
  [
    "attribute-the-model-calls-at-the-ai-gateway",
    "Request attribution"
  ],
  [
    "put-acmes-usage-inside-your-product",
    "Your customer portal"
  ],
  [
    "use-the-same-records-when-you-charge-customers",
    "Customer billing"
  ],
  [
    "start-with-one-customer",
    "Get started"
  ]
];

<CustomerPortalHero />

<PostByline horizontal />

<SideRails sections={sections} />

Today we're launching Customer Portal in LiteLLM. Give the customers of your AI product their own budgets, track spend by organization, team, and member, and bring that usage into your product through APIs.

If you already run your agents through LiteLLM, you already send their model traffic through the gateway and record its cost. Customer Portal connects those cost records to the customers using your application. You can manage their allowances in LiteLLM and use the same data to build the usage page they see.

{/* truncate */}

## Built for the developer shipping an AI agent

You build an agent that searches a knowledge base and drafts support replies. Acme, our fictional customer, starts with its Support team. Alice uses the agent throughout the day. Bob opens it once a week.

Then Acme wants to invite Engineering. Its administrator asks how much Support spent, who used the allowance, and whether Engineering can have its own budget.

Your application knows which customer requested each task. LiteLLM records the model calls behind it. You need those records to follow the same customer structure, so you can set an allowance during onboarding and explain the spend afterward.

## Give Acme a budget, then its teams and members

Create Acme as a customer organization through the API. Add Support as a customer team, then Alice and Bob as customer members. Use stable IDs from your application to keep the records connected.

In this example, you give Acme a $1,000 budget, Support a $250 budget, and each member a $50 default allowance. An organization template supplies the member defaults; overrides let you change an individual's allowance. When Engineering joins, you add another team under Acme.

LiteLLM keeps these customer resources separate from the internal teams and users that administer your gateway. They represent the companies and people using the product you sell.

<figure data-full-width className={styles.productShot}>
  <img src="/img/customer_portal/member-caps.jpg" alt="LiteLLM Customer Portal shows the Support customer team and Alice and Bob with their spend, token counts, and $50 member caps." loading="lazy" />
  <figcaption>LiteLLM's admin view shows customer team usage and each member's spend against their budget. These product captures use demo customer records.</figcaption>
</figure>

## Attribute the model calls at the AI Gateway

Alice asks the agent to investigate a support issue. It calls a model, uses a tool, and makes another model call. Each call contributes to the cost of her task.

Your backend passes Acme's organization alias and Alice's member ID with those requests:

```http
x-litellm-customer-org-alias: Acme
x-litellm-customer-member-id: acme-alice
```

LiteLLM resolves Alice's team and organization, checks their budgets, and attributes the usage to Alice, Support, and Acme. Use these headers with OpenAI Responses, Chat Completions, and Anthropic Messages. Your existing application key can serve multiple customers; choose the identity from the authenticated session for each request.

The gateway rejects a request when its recorded spend has exhausted a budget, checking the organization before the team and member. Accounting runs in the background, and requests can already be in flight when a threshold is reached. Allow for that delay when you display remaining budgets. Builds preceding the [shared spend counter fix](https://github.com/BerriAI/litellm/pull/51568) can use cached spend until refresh.

## Put Acme's usage inside your product

Acme's administrator opens your app and selects Support. They can see its spend and compare Alice's usage with Bob's. Your frontend gets that data from your backend, which reads the customer usage APIs.

Use the organization aggregated activity endpoint for Acme's complete date-range totals:

`GET /management/v1/customer_organizations/daily/activity/aggregated`

The response includes spend in USD, token counts, and request counts. Team and member activity endpoints provide the detail behind that total. Fetch their resource records to read the configured caps and a member's effective budget, including active overrides.

Your backend authorizes the signed-in customer and selects the IDs they can access before querying LiteLLM. Management and usage reads require a proxy admin credential; keep it on your server.

LiteLLM provides an admin view for your own team to inspect usage and manage the customer hierarchy. You build Acme's portal in your application, with your own authentication, branding, and navigation. Put a usage chart next to their plan or an allowance beside each member's spend.

<figure data-full-width className={styles.productShot}>
  <img src="/img/customer_portal/usage-overview.jpg" alt="Acme's populated customer organization usage page shows $0.14 spend, one request, 120 tokens, and a daily spend chart broken down by the Support team." loading="lazy" />
  <figcaption>Acme's usage after a test request in LiteLLM's customer usage view. The same usage APIs provide the data for the portal inside your product.</figcaption>
</figure>

## Use the same records when you charge customers

At the end of the month, use Acme's attributed usage as input to your pricing. You can pass through recorded AI cost, add a markup, or compare usage with an included allowance. Your product applies those pricing rules, and your billing system creates invoices and collects payment.

Use the organization total for Acme's overall cost. The team and member views include the same requests, so adding all three levels together counts usage more than once. For current balances, use the resource's running spend and reset timestamp; date-range usage preserves historical costs across resets.

If Alice questions a charge, your team can follow the request's `x-litellm-call-id` through the [spend-log debugging guide](/docs/proxy/customer_portal/api_reference_guide#6-debug-a-request-in-spend-logs) and check the attribution behind it.

<figure data-full-width className={`${styles.productShot} ${styles.requestShot}`}>
  <img src="/img/customer_portal/spend-log-customer.jpg" alt="A saved request's Customer section resolves Alice to the Support customer team and Acme customer organization, with $0.14 cost and 120 tokens in Metrics." loading="lazy" />
  <figcaption>Preview build: follow a saved request from the customer member to its team and organization, then inspect its cost and tokens. Customer fields in spend logs are part of <a href="https://github.com/BerriAI/litellm/pull/51596">#51596</a>.</figcaption>
</figure>

## Start with one customer

Follow the [Customer Portal walkthrough](/docs/proxy/customer_portal/api_reference_guide) to create Acme, give Alice an allowance, send an attributed request, and fetch the result. The [API reference](/docs/proxy/customer_portal/api_reference) covers the customer resources, budgets, and usage responses.

When your next customer signs up, reuse that flow. Keep AI cost and customer budget settings at the gateway, and show the data wherever your customers need it in your product.

This launch draft includes the integration on `main` and the spend-log preview labeled above. A published release containing the complete flow has not been verified. Check the [availability reference](/docs/proxy/customer_portal/api_reference#availability) for the changes your deployment needs.
