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

The benchmark measures one complete `litellm.ocr()` call, from invocation until the parsed OCR response returns. Each workload below pairs a PDF request size with a response page count. The local provider removes live model latency, but request transformation, loopback HTTP transfer, and response parsing all remain inside the measurement.

<BenchmarkVisualization
  configLabel="Mistral OCR SDK benchmark · controlled payload fixtures · macOS arm64 · concurrency 1"
  pythonLabel="Existing Python code"
  rustLabel="Rust core"
  groups={[
    {
      label: 'End-to-end OCR workloads',
      description: 'Complete SDK calls through a local provider replay',
      takeaway: 'Rust lowers median latency across all five measured request and response combinations.',
      profiles: [
        {
          name: '32 KiB → 1 page',
          description: 'Baseline fixture',
          metrics: [
            { label: 'Median latency', unit: 'ms', python: 1.576, rust: 1.269, lowerIsBetter: true },
            { label: 'CPU time per call', unit: 'ms', python: 1.549, rust: 1.308, lowerIsBetter: true },
            { label: 'Throughput', unit: 'calls/s', python: 506.6, rust: 589.4, lowerIsBetter: false },
            { label: 'Peak RSS', unit: 'MiB', python: 221.4, rust: 223.1, lowerIsBetter: true },
          ],
        },
        {
          name: '256 KiB → 1 page',
          description: 'PDF padded; response fixed',
          metrics: [
            { label: 'Median latency', unit: 'ms', python: 5.714, rust: 1.363, lowerIsBetter: true },
            { label: 'CPU time per call', unit: 'ms', python: 3.814, rust: 1.438, lowerIsBetter: true },
            { label: 'Throughput', unit: 'calls/s', python: 56.1, rust: 496, lowerIsBetter: false },
            { label: 'Peak RSS', unit: 'MiB', python: 232, rust: 222.2, lowerIsBetter: true },
          ],
        },
        {
          name: '2 MiB → 1 page',
          description: 'PDF padded; response fixed',
          metrics: [
            { label: 'Median latency', unit: 'ms', python: 9.739, rust: 3.291, lowerIsBetter: true },
            { label: 'CPU time per call', unit: 'ms', python: 9.6, rust: 3.438, lowerIsBetter: true },
            { label: 'Throughput', unit: 'calls/s', python: 101.5, rust: 306.2, lowerIsBetter: false },
            { label: 'Peak RSS', unit: 'MiB', python: 457.6, rust: 390.6, lowerIsBetter: true },
          ],
        },
        {
          name: '32 KiB → 16 pages',
          description: 'PDF fixed; pages repeated',
          metrics: [
            { label: 'Median latency', unit: 'ms', python: 1.961, rust: 0.511, lowerIsBetter: true },
            { label: 'CPU time per call', unit: 'ms', python: 1.879, rust: 0.63, lowerIsBetter: true },
            { label: 'Throughput', unit: 'calls/s', python: 494.9, rust: 1798.4, lowerIsBetter: false },
            { label: 'Peak RSS', unit: 'MiB', python: 221.4, rust: 221.1, lowerIsBetter: true },
          ],
        },
        {
          name: '32 KiB → 128 pages',
          description: 'PDF fixed; pages repeated',
          metrics: [
            { label: 'Median latency', unit: 'ms', python: 2.125, rust: 1.628, lowerIsBetter: true },
            { label: 'CPU time per call', unit: 'ms', python: 2.059, rust: 2.082, lowerIsBetter: true },
            { label: 'Throughput', unit: 'calls/s', python: 465.5, rust: 603.4, lowerIsBetter: false },
            { label: 'Peak RSS', unit: 'MiB', python: 220.6, rust: 223, lowerIsBetter: true },
          ],
        },
      ],
    },
  ]}
/>

These results are early, not a broad production capacity claim. They come from one macOS arm64 host, one concurrent caller, 100 timed calls per worker, and one paired repeat. The job now is to measure profiles that match real traffic mixes, widen the workload, and make sure the gains hold.

These are controlled sensitivity fixtures, not five representative production requests. The larger PDFs use padding, and the larger responses use repeated synthetic pages. Because real OCR request and response sizes are related, the next step is to repeat the benchmark with naturally paired documents and OCR results from production-like traffic.

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
