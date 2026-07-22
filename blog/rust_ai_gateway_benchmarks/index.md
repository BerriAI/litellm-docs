---
slug: rust-ai-gateway-benchmarks
title: "Benchmarking the Rust AI Gateway: Overhead, Memory, and Cost"
date: 2026-07-22T09:00:00
authors:
  - ishaan
description: "AIGatewayBench measures the overhead an AI gateway adds on top of the upstream model, isolated against a deterministic mock, across LiteLLM (Rust), LiteLLM (Python v1), Portkey, and Bifrost. The Rust gateway has the lowest tail overhead and memory footprint of the four, with details on methodology and limitations."
keywords: [fastest ai gateway, fastest llm gateway, ai gateway benchmark, llm gateway benchmark, rust ai gateway, ai gateway overhead, ai gateway memory, ai gateway cost, litellm rust, high throughput llm gateway, lightweight ai gateway, coding agent gateway]
image: ./overhead_comparison.png
tags: [rust, ai-gateway, performance, benchmarks, engineering]
hide_table_of_contents: true
---

*Last Updated: July 2026*

We are launching an early beta of the LiteLLM AI Gateway in Rust, with support for the `/messages` API on Anthropic and Azure Anthropic. To hold that work to a number instead of a claim, we built [AIGatewayBench](https://github.com/BerriAI/ai-gateway-bench): a reproducible benchmark for the one thing a gateway actually controls, the overhead it adds on top of the upstream model.

The short version: across the four gateways we tested, the Rust gateway has the lowest p99 added latency and the smallest memory footprint by a wide margin, roughly `7x` lower tail overhead and `9x` less memory than the next-closest gateway, Bifrost. On raw sustained throughput it is close to Bifrost; where it separates is tail overhead, memory, and the deployment cost that follows from them. The rest of this post is the methodology, the numbers, and the parts that do not favor us.

{/* truncate */}

## Why gateway overhead is worth measuring

For a single chat completion, gateway overhead is noise. The model takes hundreds of milliseconds to seconds to respond, and a few milliseconds of gateway time disappears into that. If that is your workload, none of these numbers should change your decision.

Overhead starts to matter in two regimes. The first is high request rate against fast responses: embeddings, classification, reranking, and guardrail calls, where the upstream is quick and the gateway is a real fraction of total latency. The second is agentic coding, where a single task is a tight loop of many turns, and per-turn overhead compounds into wall-clock lag a developer feels. In both cases the gateway's memory and CPU footprint also decide how many pods you run to hold a given QPS, and how close each pod sits to an out-of-memory kill under load. That footprint is what the cost numbers below are really about.

## How we measured, and what these numbers are not

Every gateway points at the same local deterministic Rust mock upstream, so provider latency and network jitter drop out and what remains is the gateway's own cost:

```
overhead = latency(client -> gateway -> mock) - latency(client -> mock directly)
```

Because the upstream is a local mock, the absolute latencies here are not real-world request latencies; they are the gateway's slice in isolation. Treat every number as a comparison between gateways under identical conditions, not as a figure you will see in production.

A few things to keep honest about the setup:

- **Versions.** LiteLLM Rust from the `litellm-rust` beta, LiteLLM Python v1 (`litellm[proxy]`), Bifrost `v1.6.4`, and the current Portkey OSS gateway. All four run against the same mock and the same load driver on one host.
- **Raw forwarding, not full governance.** Each gateway is configured to forward the Anthropic Messages body to the mock with no logging callbacks, spend tracking, or persistence enabled. This isolates forwarding overhead; it is not a comparison of the full feature sets teams actually run, and turning those features on would add cost to every gateway here, including ours.
- **Single host, per-scenario runs.** Sample sizes vary by scenario (n=5000 for the overhead panel, n=2000 per concurrency point, n=100 for streaming). These are single-host runs without repeated-trial error bars, so read them as order-of-magnitude differences, not certified figures.
- **It is a vendor-run benchmark.** We wrote it and we come out ahead, so the guardrail is reproducibility: every plotted value is a committed CSV in the [results directory](https://github.com/BerriAI/ai-gateway-bench/tree/main/results), and the mock and driver are identical across all four gateways. Run it against your own build and check.

## Overhead and memory

The headline panel is p99 added latency (log scale) and peak memory. The Rust gateway adds about `0.7ms` at p99, against `2.3ms` for Portkey, `4.5ms` for Bifrost, and `257.7ms` for the LiteLLM Python v1 proxy. On peak memory it holds around `21.8MB`, against `90.4MB` for Portkey, `199.1MB` for Bifrost, and `329.5MB` for Python. That is roughly `7x` lower tail overhead and `9x` less memory than Bifrost, the closest compiled-language gateway, and about `3x` and `4x` lower than Portkey.

![Gateway overhead (p99 added latency) and peak memory across LiteLLM Rust, Portkey, Bifrost, and LiteLLM Python](./overhead_comparison.png)

The Python v1 number deserves a note, since it is our own gateway. This is the default Python proxy on a minimal forwarding config, and its per-request work in the interpreter is exactly the overhead the Rust migration exists to remove. It is also why we have been pushing the Python path itself lower in parallel; see [Achieving Sub-Millisecond Proxy Overhead](/blog/sub-millisecond-proxy-overhead) for that track. The Rust gateway is the structural fix.

## Cost and footprint

Lower CPU and memory at higher throughput mean fewer and smaller pods for the same traffic. To put a rough dollar figure on it, we estimate USD per one million requests from measured CPU, peak RSS, and sustained throughput on a standard 4 vCPU / 16 GB instance at `$0.04` per vCPU-hour and `$0.005` per GB-hour. This is a footprint estimate, not a provider invoice, and it excludes token cost, which dominates any real bill. On that basis the Rust gateway comes in around `$0.000175` per million requests, against `$0.001008` for Bifrost, `$0.001042` for Portkey, and `$0.015354` for Python, roughly `6x` below the next-closest gateway.

![Estimated request cost in dollars per one million requests](./cost_per_million.png)

The same footprint advantage shows up as throughput efficiency: sustained requests per second per dollar per hour. Here the Rust gateway reaches about `283,833` RPS per dollar against `63,246` for Bifrost, because it holds a similar sustained request rate at a fraction of the CPU and memory. This is an efficiency metric, not a peak-throughput one; on raw sustained RPS the Rust gateway (`~2,814` req/s at its ceiling) and Bifrost (`~2,744`) are close, and the gap in this chart comes from cost per unit of throughput, not from serving far more requests.

![Estimated sustained RPS per dollar across the four gateways](./rps_per_dollar.png)

## Agentic coding workloads

For a coding agent the number that matters is added wall time across a whole session, not one request. We replay deterministic Claude Code and Codex-style control loops of 30 turns and measure the overhead each gateway adds to the full session. The Rust gateway adds about `0.03s` to a Claude Code session and `0.016s` to a Codex-style session, against `0.13s` and `0.047s` for Bifrost, `0.12s` and `0.09s` for Portkey, and `0.97s` and `0.24s` for Python. Across an agent that issues many turns per task, the Rust path stays effectively invisible while the Python proxy adds close to a second per session.

![Whole-session gateway overhead for Claude Code and Codex-style loops](./session_overhead.png)

Tail overhead under concurrency is the more demanding test, and it is where we want to be precise rather than triumphant. Sweeping concurrency from 1 to 64 against a controlled direct baseline, the Rust and Bifrost tails stay low and close to each other while the Python proxy's p99 added latency climbs into the hundreds of milliseconds. At concurrency 64 the Rust tail does rise, to about `40ms` added p99, comparable to Bifrost's `29ms`; both stay far below Python's `546ms` and Portkey's `108ms`. We retained points through concurrency 64 because the direct baseline p99 stayed within twice its single-client floor there; the 256 point was dropped because the baseline itself became unreliable, not because the gateways failed. So the honest read is that the Rust path holds a low, competitive tail as concurrency rises, not that it stays flat.

![p99 added latency versus concurrency for each gateway](./latency_vs_concurrency.png)

Streaming is not yet in the Rust beta, so we are not claiming a streaming result. We include the time-to-first-token chart for completeness and to be transparent about the gap: the Rust `/messages` streaming route and the Portkey OSS streaming route both return errors on streaming Anthropic Messages requests today and are labeled unavailable rather than scored, and the signed differences shown for the gateways that do stream reflect measurement noise against the fast mock, not real speedups. Streaming parity is on the beta roadmap, and we will publish it when the route is real.

![Streaming time-to-first-token overhead, with unavailable routes labeled unavailable](./ttft_overhead.png)

## Reproduce it

Every chart above is generated from a committed CSV containing the exact plotted values, with the mock, load driver, and host held identical across all four gateways. The full harness, per-gateway setup, versions, and raw run data live in [AIGatewayBench](https://github.com/BerriAI/ai-gateway-bench), and the fastest way to check any claim here is to run it against your own build. If you want to run the Rust gateway in your own stack, [sign up for the early beta](https://docs.google.com/forms/d/e/1FAIpQLSecWdOjkzjEson2UiZpDftOoZPs8RQbtlAM40KSvDXZqEgYaA/viewform?usp=dialog), and for the architecture behind the migration see [Migrating LiteLLM to Rust](/blog/litellm-rust-launch).
