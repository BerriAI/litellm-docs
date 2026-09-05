---
slug: rust-ocr-benchmark
title: "Rust OCR: A Safe First Step in LiteLLM’s Migration"
date: 2026-09-05T09:00:00
authors:
  - yujonglee
description: "Early OCR results show LiteLLM's Rust migration is improving SDK performance while keeping correctness as the release gate."
keywords: [rust, ocr, mistral ocr, ai gateway, python sdk, performance benchmark]
tags: [rust, ocr, performance, benchmarks, engineering, reliability]
---

import { BenchmarkVisualization } from '@site/src/components/MiddlewareDiagrams';

LiteLLM’s move to Rust is underway, and OCR is the first surface we are measuring end to end. The early result is encouraging: on the synchronous OCR fixtures we tested, the Rust path was faster in every case. On a large request, it cut median SDK latency from `9.739ms` to `3.291ms` and raised throughput from `101.5` to `306.2` calls per second.

The number matters, but how we got it matters more. We are moving one bounded surface at a time, checking it against the established Python behavior, and publishing the cases where the result is not yet good enough. That is how we make the gateway faster without making it less dependable.

{/* truncate */}

## A migration that is moving forward

OCR is a practical first step. It exercises request transformation, response parsing, async behavior, and varied payload sizes without asking us to move the whole gateway at once. The work gives us a real Rust path to measure, a focused contract to preserve, and a repeatable way to decide what should move next.

For the large-request fixture, Rust completed nearly three times as many calls per second as Python:

<BenchmarkVisualization
  configLabel="Mistral OCR SDK benchmark · recorded large-request fixture · macOS arm64 · concurrency 1"
  pythonLabel="Existing Python code"
  rustLabel="Rust core"
  metrics={[
    { label: 'Median latency', unit: 'ms', python: 9.739, rust: 3.291, lowerIsBetter: true },
    { label: 'CPU time per call', unit: 'ms', python: 9.6, rust: 3.438, lowerIsBetter: true },
    { label: 'Throughput', unit: 'calls/s', python: 101.5, rust: 306.2, lowerIsBetter: false },
    { label: 'Peak RSS', unit: 'MiB', python: 457.6, rust: 390.6, lowerIsBetter: true },
  ]}
/>

These results are early, not a broad production capacity claim. They come from one macOS arm64 host, one concurrent caller, 100 timed calls per worker, and one paired repeat. The job now is to keep measuring, widen the workload, and make sure the gains hold.

## Safe means proving parity before expanding scope

A fast implementation is not useful if it changes what a customer receives. Before we accept a result, each Python/Rust pair validates matching response digests. The benchmark uses recorded Mistral OCR request and response shapes through a local isolated provider, so provider latency does not hide SDK behavior.

That gives every case two gates:

- Does the Rust path produce the same result?
- Does it improve the work that happens inside LiteLLM?

The harness captures latency percentiles, CPU time, calls per second, and sampled RSS in separate processes. It keeps the timing, provider, and memory measurements from interfering with one another, and it saves atomic result files so a partial worker cannot look like a valid run.

## Better includes finding the regressions

The sync results are consistently faster. The async path is faster for medium and large requests and responses, from `1.27x` to `2.64x`. The smallest async fixture measured `0.56x`, so we are treating it as a regression to understand, not a number to average away.

That is the behavior we want from this migration: a smaller, testable surface makes it possible to find a rough edge before it spreads into the next endpoint. The same discipline applies to memory. On the large-request fixture, sampled peak RSS fell from `457.6 MiB` to `390.6 MiB`, while smaller fixtures were similar. We will not turn that into a general memory claim until repeated workloads support it.

## The gateway gets better without a new contract

The outcome we are working toward is simple. LiteLLM should continue to behave as customers expect while more of the CPU-bound transformation work moves onto a faster, lighter path. The same SDK, configuration, providers, and response contracts stay in place. The implementation underneath improves.

OCR is the first checkpoint, not the finish line. We will repeat these runs on an idle host, add more repeats and concurrency levels, and extend coverage to streaming, more providers, and proxy traffic. Each next surface will have to meet the same standard: preserve behavior, show the measurement, and address regressions before expanding.

The benchmark harness and its full early output are in [PR #39931](https://github.com/BerriAI/litellm/pull/39931).
