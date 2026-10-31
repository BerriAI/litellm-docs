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

import { ArchitectureComparison, AccountingOwners, DestinationAdapters, RecoverySequence } from './diagrams';

:::note Rough draft for review
Target architecture and planned adapters. Rollout status and recovery evidence remain subject to review.
:::

*Durable usage. Explainable charges. Analytics that fit your stack.*

You’ve told us about missing usage, conflicting spend totals and unexpected budget blocks. We’ve fixed individual bugs. Now we’re changing the accounting foundation behind them.

**Record usage durably. Finalize one charge. Reuse it for reporting and budget settlement.**

{/* truncate */}

## Why change the foundation?

In the pre-refactor design, reporting and live budgets follow separate update paths. A partial failure can leave one updated and the other behind. Customers then have to reconcile the difference.

<ArchitectureComparison />

## What you get

- **Recoverable accounting.** Committed usage survives restarts; unfinished delivery can resume.
- **Consistent totals.** Reports and settled budgets use the same charge and reconcile after recovery for matching activity, scope and time window.
- **Explainable spend.** Saved pricing inputs show how a charge was calculated, even after prices change.
- **Clearer usage.** Caller requests, provider attempts and charges have distinct records.

## Four owners. Inside the existing proxy.

<AccountingOwners />

The design follows established **durable metering, [transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) and idempotent consumer** patterns: save an event with its delivery work, then make repeated delivery safe. The existing scheduler retries unfinished reporting and settlement. Neither destination independently recalculates the charge.

**Recovery is part of the contract.** Matching event retries are no-ops; conflicting content is rejected. Reporting writes and applied delivery state commit together. Redis settlement separately deduplicates counter and hold changes, preserving outstanding reservations.

Pricing snapshots retain rates, priced usage, multipliers, component costs and adjustments. Per-call overrides stay local. Replay reuses free-allowance allocations; cleanup requires replay-safe and recovery-safe boundaries because deduplication depends on retained history.

## Your accounting data, in your infrastructure

**CostAggregator is designed around a destination-independent contract.** Adapters translate event contributions into the storage and analytics systems your team uses.

<DestinationAdapters />

A planned ClickHouse adapter would let teams visualize the same finalized accounting data in their existing analytics stack, without rebuilding pricing logic. Each new destination needs verified retry and replay behavior.

The initial path keeps existing PostgreSQL reports and dashboard queries. PostgreSQL and Redis remain core dependencies; backend flexibility applies to reporting destinations.

## A failure should mean a retry, not another charge

<RecoverySequence />

This is the flow we need to prove before activation: the same event, an interrupted reporting write, recovered totals and a single settled charge. We have not yet measured the integrated result.

## Rollout and current limits

**Foundation → shadow comparisons → narrow activation → broader coverage.**

The design marks contracts, storage foundations and early fixes complete. Integrated capture, pricing, reporting and budget recovery remain to be verified. Start with fixed-rate, known-usage synchronous calls and expand after their failure cases pass.

- **Safe activation.** Shadow mode does not change production totals or reallocate allowances. Activation reconciles spend and active holds; rollback drains or reconciles pending work.
- **Capture and consistency.** Default asynchronous capture retains a pre-commit crash window. Optional synchronous capture waits under an explicit failure policy. Reports can lag; totals reconcile within existing numeric precision, with holds tracked separately.
- **Coverage.** Streaming and deferred calls have no final-cost header promise. This work does not prevent every concurrent budget overshoot. ClickHouse and export adapters remain planned.

**What should we prioritize next?** We want your feedback on the spend reconciliation problems and analytics destinations that matter most to your team.
