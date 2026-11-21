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

Send token prices in euros, review spend in yen, and let LiteLLM handle the conversion. Currency support brings per-request pricing, automatic ECB exchange rates, and dated spend estimates together in your gateway.

{/* truncate */}

## Supply each request's prices in its original currency

Send `pricing_currency` alongside `input_cost_per_token` and `output_cost_per_token`. One request can use EUR prices and the next can use JPY prices. LiteLLM converts each request's supplied prices into USD for spend tracking and budget accounting.

<RequestPricing />

**Each request carries its own prices and currency.** Use overrides with streaming and non-streaming proxy chat completions. Send this JSON body to `/v1/chat/completions` with your configured model alias and an authorized virtual key. The example uses sample prices per token.

```json
{
  "model": "your-model-alias",
  "messages": [{"role": "user", "content": "Hello!"}],
  "pricing_currency": "EUR",
  "input_cost_per_token": 0.000001,
  "output_cost_per_token": 0.000002
}
```

To enable request pricing, allow these three fields through the deployment's `litellm_params.configurable_clientside_auth_params` and set `allow_client_pricing_override: true` in the key or team's metadata.

## Let LiteLLM keep track of exchange rates

LiteLLM automatically fetches European Central Bank reference rates, caches them, and refreshes them when due. Requests reuse the cached rates for conversion, so your application can supply prices directly in an ECB-supported currency.

<ReferenceRates />

**Different currencies, consistent accounting.** LiteLLM converts EUR and JPY token prices into a common USD spend record. Automatic rate lookup and caching handle the exchange-rate work for you.

## Make spend easier for your team to interpret

Open **Usage** and choose a currency from **Spend display** on the spend card. A local-currency estimate appears beside the USD total, together with the reference date used for conversion.

<SpendDashboard />

**Explore the spend you already have.** Choose a reporting period and view its total in a currency familiar to your team. Each estimate uses a recent reference rate to convert that period's USD spend.

Request pricing and dashboard display are independent choices. You can supply token prices in EUR and review the total in JPY, with USD as the common unit for accounting.

<div className="currency-launch-note">
<p><strong>Available now</strong></p>
<p>Try the currency selector in Usage, or enable per-request pricing and send your next chat request with local token prices. See the <a href="/docs/proxy/custom_pricing">custom pricing guide</a> and <a href="/docs/proxy/cost_tracking">spend tracking guide</a> to get started.</p>
</div>
