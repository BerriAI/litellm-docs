---
title: "Scalability design"
description: "How Lens keeps sampling, trace reads, and investigation state fast as trace volume, retention, and the number of lenses grow."
slug: "/proxy/lens/scalability"
---

# Scalability design

Lens stores two kinds of data. Traces and request logs live in ClickHouse, which is append-only and grows with traffic. Lenses, investigation jobs, findings, and worker state live in PostgreSQL, which is small and changes often. Each design rule below keeps the cost of a common operation tied to the work it actually does, so it does not grow with total retention, total traffic, or the number of lenses

![Lens scalability overview: workers and agents talk to LiteLLM, which claims work from Postgres through an indexed due queue and reads ClickHouse with time bounded queries](/img/lens/scalability/overview.svg)

| Operation | Store | Cost grows with | Does not grow with |
|---|---|---|---|
| Sample a window | ClickHouse | Spans in the window plus 7 days of slack | Retention, number of pages |
| Read one trace | ClickHouse | Partitions from the trace start minus 7 days to now | Retention for recent traces, other teams |
| Claim a job | PostgreSQL | Due lenses, at most 20 per claim | Total lenses, lenses not due |
| Heartbeat a job | PostgreSQL | Size of the lens document today; a narrow lease row in the target design | Number of lenses |

The numbers on this page come from a local benchmark with real ClickHouse 26.10 and PostgreSQL 14 running the Lens migrations and the production SQL. The ClickHouse data has 6M spans over 30 daily partitions, or 18M spans over 90 daily partitions, with one team owning half of them. These figures show how cost grows and are not production latency targets

## Every trace query is bounded by time {#time-bounded-queries}

`otel_traces` is partitioned by day and ordered by `(TeamId, ServiceName, Timestamp, TraceId)`. ClickHouse skips data only when a query constrains those columns, so a query that filters on a derived expression such as `EngineReceivedMs`, or that has no time filter at all, has to open every partition the team has retained. Its cost then grows with retention even when the answer covers a single day

Every Lens query against `otel_traces` and `spend_logs` must therefore put a direct range on `Timestamp` or `start_time` on top of its own logic. Spans can start before the window being sampled, and they can arrive late, so the lower bound carries a fixed slack of 7 days. That covers multi-day coding agent sessions while still skipping the rest of retention. The upper bound applies only where it cannot hide spans that later checks depend on. For example, the sample query still sees later spans so that traces still in progress stay excluded

![Partition pruning for a 24 hour sample: partitions older than the 7 day slack are never opened](/img/lens/scalability/partitions.svg)

A 24 hour sample with the time bound reads the same 1.77M rows at 30 and at 90 days of retention. Without it, the same single query reads 6.2M rows at 30 days and 18.4M at 90 days

## Samples are selected once per job {#one-pass-sampling}

A sample is a deterministic selection over every trace eligible in the window. It needs the eligible count and the selection order, and both require the full eligible set. Paging that query 100 rows at a time recomputes the full set on every page, so a single sample costs pages times window size

![Sampling before and now: 48 paged queries that each rank every eligible trace, versus one query whose selection is frozen on the job](/img/lens/scalability/sampling.svg)

The worker requests the selection in pages of 10,000, so a normal sample takes one query, then freezes it on the job. Later reads use the frozen selection and do not query ClickHouse again. If a page would exceed the response limit, the worker retries the same cursor with a smaller page. Previews in the dashboard still page, but each page is time bounded

Full worker sample loop for a 24 hour window, about 5,000 traces selected:

| Retention | Query | Page size | Queries | Rows read | Bytes read | Wall time |
|---|---|---:|---:|---:|---:|---:|
| 30 days | before | 100 | 50 | 163.3M | 7.7 GB | 5.5 s |
| 30 days | before | 10,000 | 1 | 6.2M | 222 MB | 154 ms |
| 30 days | time bounded | 100 | 51 | 52.7M | 3.2 GB | 5.4 s |
| 30 days | time bounded | 10,000 | 1 | 1.77M | 80 MB | 135 ms |
| 90 days | before | 100 | 48 | 455.2M | 19.5 GB | 11.0 s |
| 90 days | before | 10,000 | 1 | 18.4M | 615 MB | 314 ms |
| 90 days | time bounded | 100 | 48 | 48.9M | 2.8 GB | 4.0 s |
| 90 days | time bounded | 10,000 | 1 | 1.77M | 76 MB | 119 ms |

Both changes together cut a 30 day sample from 163M rows to 1.77M, and the cost no longer moves when retention triples. The selected traces are identical to the unbounded query

## Single trace reads are keyed and windowed {#single-trace-reads}

Reading one trace is a point lookup. A bloom filter on `TraceId` narrows the read to the granules that hold the trace, and pages return at most 40 spans, ordered and cursored by `SpanId`, with span content truncated to a fixed budget. Each read therefore returns a bounded payload however large the trace is

The bloom filter is still checked on every granule of the team. Lens reads pass the trace start time saved with the sampled execution, minus the same 7 day slack, so the lookup opens only the partitions that can hold the trace

![Single trace read: the sampled start time prunes partitions, the TraceId bloom filter picks the granule, and the page is bounded](/img/lens/scalability/trace-read.svg)

Content read for one trace, median of 7 warm runs:

| Retention | Trace age | Partitions before / now | Rows read before / now | Median before / now |
|---|---|---:|---:|---:|
| 30 days | 1 day | 30 / 9 | 13,418 / 6,690 | 12.7 ms / 13.4 ms |
| 30 days | 15 days | 30 / 23 | 6,594 / 6,594 | 16.4 ms / 17.3 ms |
| 90 days | 1 day | 90 / 9 | 13,327 / 6,685 | 31.7 ms / 14.5 ms |
| 90 days | 15 days | 90 / 23 | 34,465 / 6,652 | 29.4 ms / 17.5 ms |
| 90 days | 45 days | 90 / 53 | 12,946 / 12,946 | 28.4 ms / 22.3 ms |
| 90 days | 85 days | 90 / 90 | 13,404 / 13,404 | 28.1 ms / 30.3 ms |

A read of a recent trace stays at about 14 ms whatever the retention, while the unbounded read doubles from 30 to 90 days. Lens mostly reads traces it has just sampled, so the common case is the recent one. A trace near the end of retention costs the same as before

## Scheduling does not scan every lens {#scheduling}

A worker claim must find one due job, and that cost should not grow with the number of lenses. Before this design a claim loaded and validated every lens, which took 1.3 s with 200 medium lenses and 5.7 s with 200 large ones, per attempt. Each lens now keeps the next time it needs a worker in a `due_at` column with a partial index. That is when its queued job was created, when its running job's lease expires, or its next scheduled run. Every full update of a lens writes `due_at` in the same statement, so the column cannot drift from the document

![Worker claims before and now: loading every lens, versus reading at most 20 due lenses through the due_at index](/img/lens/scalability/claim.svg)

A claim reads at most 20 due lenses in `due_at` order, and a worker that loses the race for one moves on to the next instead of retrying against a lens another worker just took. Lenses created before the column existed start with a `due_at` in the past, and the first claim that looks at one writes its real value

Lens data a claim loads, each lens holding 100 findings (about 52 KB of JSON):

| Lenses stored | Due | Loaded with the due queue | Claim time | Loaded by a full scan | Claim time |
|---:|---:|---:|---:|---:|---:|
| 21 | 1 | 52 KB (1 lens) | 23 ms | 1.1 MB (21 lenses) | 219 ms |
| 221 | 1 | 52 KB (1 lens) | 22 ms | 11.5 MB (221 lenses) | 2.8 s |

## Hot state is narrow and history is append-only {#narrow-hot-state}

A heartbeat or progress update should touch only what changed. Today a lens and all of its jobs, findings, and reservations are stored as one JSONB document. Every heartbeat rewrites the whole document, and every update to a lens contends on the same row

| Lens size | Document | Heartbeat as a document rewrite | Heartbeat as a lease column update |
|---|---:|---:|---:|
| 10 findings, 20 traces | 5.3 KB | 1.5 ms, 8 KB WAL | 0.11 ms, 184 B WAL |
| 100 findings, 200 traces | 33 KB | 9.7 ms, 44 KB WAL | 0.24 ms, 184 B WAL |
| 500 findings, 1,000 traces | 155 KB | 42.8 ms, 204 KB WAL | 0.12 ms, 184 B WAL |

The target design moves leases and job progress into narrow rows. Findings, occurrences, and evidence become rows that are only ever appended, and run and review history gets a retention cutoff

![Lens state today in one JSONB document, versus the target with narrow job rows and append-only findings](/img/lens/scalability/hot-state.svg)

## Trace lists use a time-ordered rollup {#trace-list-rollup}

The trace list aggregates spans into one row per trace. Ordering that rollup by `(TeamId, ApiKeyHash, TraceId)` with no time column forces every page to aggregate the team's whole retention before filtering by start time. In the benchmark a one hour trace list page read all 150K of the team's traces in the rollup. The target design orders the rollup by team and trace start, so a page reads only the window it shows. This requires a new table and a backfill, so it ships separately from the query changes above

## Load tests {#load-tests}

Each design rule above has a load test that fails if the rule is broken. Each test measures the cost of an operation, adds data the operation should never touch, and asserts that the cost does not grow. Each was also run with its optimization reverted to confirm that it fails

| Test | Adds | Measured with the design | With the design reverted |
|---|---|---|---|
| `lens_sample_reads_scale_with_window_not_retention` | 24 older days of spans | 30,000 rows read before and after | fails, 30,000 grows to 110,000 |
| `lens_content_reads_scale_with_trace_not_retention` | 24 older days under the same trace id | 2,000 rows read before and after | fails, 2,000 grows to 50,000 |
| `test_lens_claim_reads_scale_with_due_lenses_not_total_lenses` | 200 lenses that are not due | 52,156 bytes loaded before and after | fails, 1.1 MB grows to 11.5 MB |

The two ClickHouse tests live in `litellm-rust/crates/traces-clickhouse/tests/load.rs` and assert that `read_rows` from `system.query_log` grows by at most 5%. The scheduler test lives in `tests/integration/database/test_lens_scheduler_load.py` and asserts that the claim loads exactly the same lens data and still claims the due lens. A heartbeat WAL test ships with the narrow lease change
