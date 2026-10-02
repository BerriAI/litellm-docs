---
slug: litellm-rust-ocr
title: "OCR uses Rust by default starting with v1.102.0-rc.1"
date: 2026-09-13T10:00:00
authors:
  - yujonglee
description: "Starting with v1.102.0-rc.1, OCR calls use the Rust implementation by default while preserving the existing API."
keywords: [litellm, rust, ocr, python sdk, ai gateway]
tags: [litellm, rust, rust-migration, ocr, reliability]
---

import {OcrFixedArrivalChart, OcrProviderDelayChart, OcrThroughputChart} from '@site/src/components/OcrBenchmarkCharts';

Starting with LiteLLM `v1.102.0-rc.1`, OCR runs on Rust by default. 

{/* truncate */}

## No action required

Continue using the existing OCR API:

```python
import litellm

response = litellm.ocr(
    model="mistral/mistral-ocr-latest",
    document={
        "type": "document_url",
        "document_url": "https://arxiv.org/pdf/2201.04234",
    },
)
```

The same default applies to asynchronous OCR calls. Gateway users get the Rust path automatically on upgrade too.

### Opt out when needed

Set `LITELLM_RUST=0` to disable the Rust path for a process:

```bash
export LITELLM_RUST=0
```

You can also opt out for the current Python process before making OCR calls:

```python
import litellm

litellm.rust(False)
```

## What is the performance impact?

**TL;DR:** When proxy CPU is the bottleneck, Rust sustains more OCR requests per second.

### How we tested

We measured proxy overhead, not end-to-end OCR latency. Each path ran in a fresh container with `v1.102.0-rc.1`, one proxy worker, one CPU, `2 GiB` of memory, and a local mock provider. Python and Rust used the same image and limits; only `LITELLM_RUST` changed, and the order alternated across six paired rounds for each upload size.

### Rust raises the CPU-limited proxy ceiling

On one CPU, median throughput moved from `143.6` to `211.7 RPS` at `1 MiB` (`1.48x`) and from `21.6` to `36.2 RPS` at `8 MiB` (`1.69x`). Each gain is the median of the six within-round Rust/Python ratios.

<OcrThroughputChart />

Both paths used 97% to 99% of their one-CPU allowance. This supports a higher OCR proxy throughput ceiling when proxy CPU is the bottleneck. It does not mean that a real OCR request finishes `1.69x` faster; provider latency usually dominates end-to-end latency.

Absolute RPS varied as load on the shared development host changed. The paired rounds preserve the more useful signal: which implementation was faster under nearby conditions.

### The advantage depends on the bottleneck

We ran a few extra checks to see where the main result holds and where it stops. The charts show one run each and the exact numbers moved between reruns, so read them as rough boundaries rather than precise numbers. The direction of each result held.

#### The gain appears only when proxy CPU saturates

<OcrProviderDelayChart />

We added a `100 ms` delay to the mock provider so that waiting on the provider, not the proxy, could become the bottleneck. At concurrency 8 it did: the proxy sat mostly idle and there was no measured Rust gain. At concurrency 64, enough requests were in flight that proxy CPU saturated again and the gain returned.

#### Above Python's ceiling, requests queue

<OcrFixedArrivalChart />

The primary benchmark fixed concurrency and measured each path's ceiling. This check instead offered a fixed thirty `8 MiB` requests per second, which is above Python's measured ceiling at that size and below Rust's. Rust completed every arrival with CPU to spare, so latency stayed in the tens of milliseconds. Python's CPU saturated, requests queued, p95 latency climbed into seconds, and it used roughly twice the memory.
