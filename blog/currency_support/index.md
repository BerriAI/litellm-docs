---
slug: currency-support
title: "Introducing Currency Support in LiteLLM"
date: 2026-11-16T09:00:00
authors: [joshua]
description: "Supply token prices in your currency, let LiteLLM handle exchange rates, and explore dated currency estimates on the Usage dashboard."
tags: [engineering]
hide_table_of_contents: true
---

import { RequestPricing, ReferenceRates, SpendDashboard } from './visuals';

**Your AI spend, in a currency familiar to your team.**

A team with token prices quoted in euros should be able to use those prices directly. A team reviewing its AI spend in yen should be able to see an estimate without opening a separate currency calculator.

LiteLLM now supports both. Send custom token prices in a declared currency on each chat request, let LiteLLM convert them using automatically fetched ECB reference rates, and view a dated currency estimate alongside your USD spend in the Usage dashboard.

{/* truncate */}

## Supply each request's prices in its original currency

Your application can now send `pricing_currency` alongside `input_cost_per_token` and `output_cost_per_token`. One request can use EUR prices and the next can use JPY prices. LiteLLM converts the supplied prices into USD before calculating spend, so each request uses its own pricing inputs without changing your configured model prices.

<RequestPricing />

**The currency belongs to the request.** These overrides work with streaming and non-streaming proxy chat completions. Only the explicitly supplied input and output token prices are converted. Currency overrides do not extend to cache-token, time-based, or other pricing fields, and cannot be combined with those pricing overrides.

For example, send this JSON body to `/v1/chat/completions`, using your configured model alias and an authorized virtual key. The amounts below are sample prices per token, not per million tokens.

```json
{
  "model": "your-model-alias",
  "messages": [{"role": "user", "content": "Hello!"}],
  "pricing_currency": "EUR",
  "input_cost_per_token": 0.000001,
  "output_cost_per_token": 0.000002
}
```

Client pricing remains opt-in. An admin must allow `pricing_currency`, `input_cost_per_token`, and `output_cost_per_token` through the deployment's `litellm_params.configurable_clientside_auth_params`, and set `allow_client_pricing_override: true` in the key or team's metadata. Requests without currency overrides keep their existing behavior. This feature applies to proxy chat-completion routes, not other endpoints or pass-through requests.

## Let LiteLLM keep track of exchange rates

There is no exchange-rate table for your application to maintain. LiteLLM fetches European Central Bank reference rates automatically, caches them, and refreshes them when due. Requests can reuse a usable cached snapshot instead of waiting for a new lookup each time.

<ReferenceRates />

**Automatic conversion keeps spend in a common unit.** EUR and JPY request prices become USD amounts for spend tracking and budget accounting. Supported non-USD currencies need an available ECB reference rate. USD-only requests do not need an ECB lookup.

A usable cached snapshot can continue serving conversions during a refresh failure, up to its seven-day freshness limit. If no usable rate is available, non-USD pricing returns a `503` before the provider call. Unsupported currency codes are rejected. Reference rates provide a conversion estimate, not a bank's settlement quote.

## Make spend easier for your team to interpret

Open **Usage**, find the spend card, and use **Spend display** to select a currency. LiteLLM shows an estimated amount alongside the original USD total and includes the reference date used for the conversion.

<SpendDashboard />

**You can use the display option with spend you already have.** It works independently of request pricing. Sending prices in EUR does not select EUR in the dashboard, and selecting JPY in the dashboard does not change how requests are priced.

Rates load when you open the selector. If they are unavailable, the card keeps the USD total visible and shows an unavailable notice. Reopening the selector retries a failed lookup. The selection resets on page reload.

The estimate converts the selected period's USD total using a recent reference rate. It does not reconstruct historical exchange rates for individual charges. This first release adds the estimate to the Usage overview spend card. Stored spend, budgets, charts, and exports remain in USD.

<div className="currency-launch-note">
<p><strong>Available now</strong></p>
<p>Try the currency selector in Usage, or enable request pricing overrides and send your next chat request with prices in its original currency. See the <a href="/docs/proxy/custom_pricing">custom pricing guide</a> and <a href="/docs/proxy/cost_tracking">spend tracking guide</a> for the underlying pricing and accounting setup.</p>
</div>
