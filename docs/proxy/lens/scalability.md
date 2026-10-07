---
title: "Scalability design"
description: "How Lens keeps sampling, trace reads, and investigation state fast as trace volume, retention, and the number of lenses grow."
slug: "/proxy/lens/scalability"
---

# Scalability design

Lens stores two kinds of data. Traces and request logs live in ClickHouse, which is append-only and grows with traffic. Lenses, investigation jobs, findings, and worker state live in PostgreSQL, which is small and changes often. Each design rule below keeps the cost of a common operation tied to the work it actually does, so it does not grow with total retention, total traffic, or the number of lenses

The numbers on this page come from a local benchmark. It runs ClickHouse 26.10 with the Lens migrations and holds 6M spans over 30 daily partitions, with one team owning 3M of them. PostgreSQL 14 holds 200 lenses. These figures show how cost grows and are not production latency targets

## Every trace query is bounded by time {#time-bounded-queries}

`otel_traces` is partitioned by day and ordered by `(TeamId, ServiceName, Timestamp, TraceId)`. ClickHouse skips data only when a query constrains those columns, so a query that filters on a derived expression such as `EngineReceivedMs`, or that has no time filter at all, has to open every partition the team has retained. Its cost then grows with retention even when the answer covers a single day

Every Lens query against `otel_traces` and `spend_logs` must therefore put a direct range on `Timestamp` or `start_time` on top of its own logic. Spans can start before the window being sampled, and they can arrive late, so the lower bound carries a fixed slack of 7 days. That covers multi-day coding agent sessions while still skipping the rest of retention. The upper bound applies only where it cannot hide spans that later checks depend on. For example, the sample query still sees later spans so that traces still in progress stay excluded

In the benchmark, a 24 hour sample reads 2.8M rows with the 7 day bound against 9.4M without it, and the gap widens as retention grows

## Samples are selected once per job {#one-pass-sampling}

A sample is a deterministic selection over every trace eligible in the window. It needs the eligible count and the selection order, and both require the full eligible set. Paging that query 100 rows at a time recomputes the full set on every page, so a single sample costs pages times window size. In the benchmark, one 24 hour sample of 5,096 traces took 51 queries and read 167M rows

The worker requests the selection in pages of 10,000, so a normal sample takes one query, then freezes it on the job. Later reads use the frozen selection and do not query ClickHouse again. With the time bound, the same sample reads under 1M rows. Previews in the dashboard still page, but each page is time bounded

## Single trace reads are keyed and windowed {#single-trace-reads}

Reading one trace is a point lookup. A bloom filter on `TraceId` narrows the read to the granules that hold the trace, and pages return at most 40 spans, ordered and cursored by `SpanId`, with span content truncated to a fixed budget. Each read therefore returns a bounded payload however large the trace is

The bloom filter is still checked on every granule of the team. Lens reads pass the trace start time saved with the sampled execution, minus the same 7 day slack, so the lookup opens only the partitions that can hold the trace. In the benchmark this cut the partitions opened from 30 to 2 while reading the same single granule

## Scheduling does not scan every lens {#scheduling}

A worker claim must find one due job, and that cost should not grow with the number of lenses. Today a claim loads and validates every lens, which took 1.3 s with 200 medium lenses and 5.7 s with 200 large ones, per attempt. The target design keeps the scheduling fields in plain columns with a partial index on due lenses, and claims with `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1`, so concurrent workers never block on the same row

## Hot state is narrow and history is append-only {#narrow-hot-state}

A heartbeat or progress update should touch only what changed. Today a lens and all of its jobs, findings, and reservations are stored as one JSONB document. Every heartbeat rewrites the whole document, costing 44 KB of WAL for a medium lens against 184 bytes for a lease column. Every update to a lens also contends on the same row. The target design moves leases and job progress into narrow rows. Findings, occurrences, and evidence become rows that are only ever appended, and run and review history gets a retention cutoff

## Trace lists use a time-ordered rollup {#trace-list-rollup}

The trace list aggregates spans into one row per trace. Ordering that rollup by `(TeamId, ApiKeyHash, TraceId)` with no time column forces every page to aggregate the team's whole retention before filtering by start time. The target design orders the rollup by team and trace start, so a page reads only the window it shows. This requires a new table and a backfill, so it ships separately from the query changes above

## Load tests {#load-tests}

Each design rule above has a load test that fails if the rule is broken. Each test measures the cost of an operation, adds data the operation should never touch, and asserts that the cost does not grow

`lens_sample_reads_scale_with_window_not_retention` seeds 8 recent days for one team and measures rows read for a 24 hour sample. It then adds 24 older days at the same volume and asserts that rows read stay within 5%. It lives in `litellm-rust/crates/traces-clickhouse/tests/load.rs`

`lens_content_reads_scale_with_trace_not_retention` does the same for a single trace content read, and lives in the same file

The scheduling and hot state rules get a PostgreSQL load test. It asserts that claim latency stays flat as the number of lenses grows, and that heartbeat WAL stays flat as findings and samples grow. It ships with the scheduling change
