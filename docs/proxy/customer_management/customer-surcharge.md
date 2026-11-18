---
title: Add a surcharge to customer requests
sidebar_label: Add a surcharge
description: Add a percentage to every request made for a customer, and read billed spend, base cost and the surcharge separately.
---

# Add a surcharge to customer requests

<SinceVersion v="1.112.0" />

A surcharge is a percentage that LiteLLM adds to the cost of every request made for a customer organization. Use it to charge customers for the cost of running the platform on top of what the model provider charges. Requests with no customer are not surcharged, so internal traffic keeps its normal cost.

## Which requests are surcharged

A request is surcharged when it is made for a customer organization, that is, when it carries `x-litellm-customer-org-alias` or `x-litellm-customer-member-id` and LiteLLM resolves it to an organization. See [Set customer budgets and read usage](./track-customer-spend.md) for how to send those headers.

## Set the surcharge

In the Admin UI, open the Cost Tracking page, add a margin, and choose Customer requests as the provider. You can also set it in config with the `customer` key.

```yaml
litellm_settings:
  cost_margin_config:
    customer: 0.02   # 2% on every request made for a customer
```

The value is a fraction between 0 and 10, so `0.02` is 2%. A fixed amount per request is not supported for this key. Set it to `0` or remove it to stop the surcharge.

The surcharge is applied on top of any [provider or global margin](../provider_margins.md). A request with a base cost of $1.00 and a 2% customer surcharge is billed at $1.02.

## Surcharge per application

An application can carry its own surcharge, which replaces the gateway-wide one for that application's customer requests. See [Give an application its own surcharge](./applications.md#give-an-application-its-own-surcharge).

## How spend and budgets count it

The surcharge is part of spend. Customer organization, customer team and customer member spend all include it, and so do key, team and user spend for the same request. Customer budgets are enforced against the billed amount, so a $50 budget is used up by $50 of billed spend and not by $50 of base cost.

Each request also records the surcharge on its own. The cost before the surcharge therefore stays exact for past requests after you change the percentage.

## Read billed spend, base cost and the surcharge

| Where | Billed amount | Cost before the surcharge | Surcharge |
|---|---|---|---|
| Response headers | `x-litellm-response-cost` | `x-litellm-response-cost-original` | |
| Spend log, `metadata.cost_breakdown` | `total_cost` | | `customer_margin_amount`, `customer_margin_percent` |
| Customer daily activity endpoints | `total_spend` | | `total_customer_margin_spend` |
| Customer usage page | Spend | Base cost | Surcharge |

The cost before the surcharge is the billed amount minus the surcharge. The customer usage page shows Base cost and Surcharge under Spend only when a surcharge was charged in the selected period.
