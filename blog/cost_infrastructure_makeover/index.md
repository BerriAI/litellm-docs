---
slug: cost-infrastructure-makeover
title: "LiteLLM’s Cost Infrastructure Is Getting a Makeover"
date: 2026-10-31T09:00:00
authors: [joshua]
description: "Durable usage tracking, explainable charges, and analytics that fit your stack."
tags: [engineering, reliability]
hide_table_of_contents: true
unlisted: true
---

import { ReliabilityPromise, ArchitectureComparison, AccountingOwners, PricingReceipt, DestinationAdapters, RecoverySequence } from './diagrams';

*More reliable spend tracking. More accurate accounting. Built for your analytics stack.*

Your AI spend should be easy to trust. You should be able to open a report, check a budget and understand a charge without tracing it through several systems.

Customers have told us where that experience falls short: missing usage, totals that disagree and unexpected budget blocks. We’ve fixed individual bugs. Now we’re rebuilding the foundation to make reliable accounting part of the design.

**Our commitment is simple: preserve committed usage, reuse one finalized charge, and make that charge explainable.**

<ReliabilityPromise />

{/* truncate */}

## One charge. The same answer everywhere.

Today’s separate reporting and budget-update paths can drift apart when one write succeeds and another fails. The new design will give both a shared source: durable metered usage and a saved charge with tracked delivery.

<ArchitectureComparison />

For your team, that means less time reconciling conflicting numbers. Reports and settled budgets will converge on the same charge for the same activity and time window. Outstanding budget holds stay separate from settled spend.

## A restart should not erase committed usage

Once usage is durably recorded, the system will retain the event and unfinished delivery work so processing can resume. Retrying delivery will reuse the event instead of creating another charge.

<RecoverySequence />

Reporting can catch up asynchronously. The durable record gives recovery something concrete to resume, while each destination protects completed updates from being applied again.

## Accuracy you can inspect

A total is more useful when you can explain it. The new `PricingSnapshot` will retain the usage, rates, multipliers and adjustments behind each finalized charge.

<PricingReceipt />

Per-call pricing overrides will stay local to the request. Unknown pricing will be explicitly marked unpriced. Caller requests and provider attempts will have distinct records, so retry usage can be accounted for without inflating the number of customer requests.

## Four responsibilities. One accounting flow.

<AccountingOwners />

These are interfaces inside the existing proxy. They build on established durable metering, [transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) and idempotent-consumer patterns: persist the event and delivery work together, then make retries safe.

PostgreSQL reporting will commit contributions with their delivery state. Redis settlement will independently deduplicate counter and hold changes. The scheduler will retry unfinished work using the saved charge, including the original free-allowance allocation.

## Your data. Your analytics stack.

**CostAggregator’s destination-independent contract will separate accounting from where you analyze it.** The initial adapter will keep existing PostgreSQL reports and dashboard queries, while planned ClickHouse and export adapters will bring the same finalized data into your own analytics tools.

<DestinationAdapters />

Your team will be able to build reporting around a consistent accounting record instead of recreating LiteLLM’s pricing logic. PostgreSQL and Redis remain the core infrastructure; adapters extend the reporting destinations.

## Built for confidence in your AI spend

We’re bringing this architecture into LiteLLM in stages, beginning with known-cost synchronous calls and expanding across request types. The goal is a better everyday experience: recoverable accounting for operators, explainable charges for developers, and consistent spend data for finance.

Durability starts at commit. Default asynchronous capture does not make responses wait for that commit; optional synchronous capture will provide that choice under an explicit failure policy. Reports may briefly lag while delivery catches up.

**Which analytics destination should we support next?** Tell us where your team wants to take its LiteLLM spend data.
