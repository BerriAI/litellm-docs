---
slug: rust-ocr-benchmark
title: "Early Results: Rust Makes LiteLLM OCR Faster on Larger Payloads"
date: 2026-09-05T09:00:00
authors:
  - yujonglee
description: "An early Python and Rust SDK comparison for LiteLLM OCR, measured against recorded OCR fixtures on a local provider."
keywords: [rust, ocr, mistral ocr, ai gateway, python sdk, performance benchmark]
tags: [rust, ocr, performance, benchmarks, engineering]
---

import { BenchmarkVisualization } from '@site/src/components/MiddlewareDiagrams';

The first Rust migration surface in LiteLLM is OCR. It is a narrow API with a useful mix of request sizes, response sizes, sync calls, and async calls, which makes it the right place to establish a performance baseline before moving larger endpoints.

Our early measurements show the Rust OCR path is faster for every synchronous fixture we tested. The largest gain came from medium requests, where the Rust path completed `4.19x` as many calls per second. Async results are also faster for four of five fixtures, while the smallest async call is currently slower and needs more investigation.

These are early, single-repeat measurements on one macOS arm64 host at concurrency one. They describe this workload, not a production capacity claim.

{/* truncate */}

## The early result

For the large-request OCR fixture, Rust reduced median SDK latency from `9.739ms` to `3.291ms` and increased throughput from `101.5` to `306.2` calls per second.

<BenchmarkVisualization
  configLabel="Mistral OCR SDK benchmark · recorded large-request fixture · macOS arm64 · concurrency 1"
  totalRequests={100}
  columns={[
    {
      title: 'Python SDK',
      accent: 'before',
      durationMs: 10000,
      layers: [
        { label: 'Recorded OCR fixture' },
        { label: 'Python request transformation' },
        { label: 'Local isolated provider' },
      ],
      metrics: [
        { label: 'Calls/s', value: 101.5 },
        { label: 'P50', value: 9.739, suffix: 'ms' },
      ],
    },
    {
      title: 'Rust SDK path',
      accent: 'after',
      durationMs: 3300,
      layers: [
        { label: 'Recorded OCR fixture' },
        { label: 'Rust request transformation' },
        { label: 'Local isolated provider' },
      ],
      metrics: [
        { label: 'Calls/s', value: 306.2 },
        { label: 'P50', value: 3.291, suffix: 'ms' },
      ],
    },
  ]}
  summaryStats={[
    { value: '2.96x', label: 'Throughput on large requests' },
    { value: '-66%', label: 'Median SDK latency' },
  ]}
  table={{
    title: 'Synchronous OCR results',
    headers: ['Fixture', 'Python calls/s', 'Rust calls/s', 'Rust speedup'],
    rows: [
      ['Small', '506.6', '589.4', '1.24x'],
      ['Medium request', '56.1', '496.0', '4.19x'],
      ['Large request', '101.5', '306.2', '2.96x'],
      ['Medium response', '494.9', '1,798.4', '3.84x'],
      ['Large response', '465.5', '603.4', '1.31x'],
    ],
  }}
/>

## What we measured

The benchmark replays recorded Mistral OCR request and response shapes through a local isolated provider. It measures SDK latency percentiles, process CPU time, calls per second, and sampled RSS separately for the Python and Rust implementations.

| Fixture | Python p50 | Rust p50 | Rust throughput speedup |
|---|---:|---:|---:|
| Small request and response | 1.576 ms | 1.269 ms | 1.24x |
| Medium request | 5.714 ms | 1.363 ms | 4.19x |
| Large request | 9.739 ms | 3.291 ms | 2.96x |
| Medium response | 1.961 ms | 0.511 ms | 3.84x |
| Large response | 2.125 ms | 1.628 ms | 1.31x |

The async path shows the same direction on medium and large fixtures: `2.64x` faster for medium requests, `1.93x` for large requests, `1.27x` for medium responses, and `1.38x` for large responses. The small async fixture measured `0.56x`, so we are treating it as a regression to understand, not a result to average away.

Memory was workload-dependent. On the large-request fixture, sampled peak RSS fell from `457.6 MiB` on Python to `390.6 MiB` on Rust. Smaller fixtures had similar resident memory, so this early report does not make a general memory claim.

## Why OCR first

OCR is a focused way to verify the Rust boundary. The benchmark keeps provider latency out of the comparison and varies the request and response shapes that exercise serialization, parsing, and transformation work in the SDK.

Correctness remains the gate. Each Python/Rust pair validates matching response digests before its performance numbers are accepted. That lets us distinguish a real speedup from an implementation that simply did less work.

## How to read these numbers

This benchmark is deliberately local and controlled. It uses one host, a local provider, one concurrent caller, 100 timed calls per worker, and one paired repeat. The machine was not reserved, and sampled RSS can miss brief allocation peaks.

Use the result as an early signal: Rust is already reducing SDK overhead for meaningful OCR payloads. We will repeat the workload on an idle host, add more repeats and concurrency levels, and extend coverage to streaming, additional providers, and proxy traffic before treating it as a broader performance claim.

The benchmark harness and its full output are in [PR #39931](https://github.com/BerriAI/litellm/pull/39931).
