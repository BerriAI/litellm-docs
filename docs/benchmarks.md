# Benchmarks

Performance test results for LiteLLM Gateway.

## High-throughput performance test results {#high-throughput-profile-3000-rps-with-50k-to-100k-token-prompts}

**13.5 billion tokens per minute (TPM).**

| Metric | Result |
|---|---:|
| Requests per second | 3,000 |
| Client HTTP 200 rate | 100.00% |
| Gateway request latency, p50 | 30.581 ms |
| Gateway request latency, p95 | 54.029 ms |
| Gateway request latency, p99 | 91.645 ms |
| Client time to first token, p50 | 31.667 ms |

### Methodology

| Setting | Configuration |
|---|---|
| Deployment | 33 gateway pods; 4 workers, 4 vCPUs, and 16 GiB memory requested per pod |
| Traffic | Distributed Locust with 30 load-generator workers; 3,000 users at one request per second each |
| Requests | `/v1/chat/completions`; equal shares of 50K, 75K, and 100K-token prompts; 50% streaming; `max_tokens: 16` |
| Model and network | In-process mock model; public AWS Application Load Balancer; 60-second client timeout |
| Configuration | [High-throughput Helm values](./proxy/high_throughput.md); PostgreSQL and Redis; virtual-key budgets, token counting, spend tracking, and metrics; response caching disabled |
| Duration | 24 minutes 22 seconds |
| Measurement | Prometheus: throughput and gateway latency. Locust: client success and time to first token, including upload and load-balancer time |

## Realtime API performance test results {#realtime-api-benchmarks}

**1,207 requests per second.**

| Metric | Result |
|---|---:|
| End-to-end latency, p50 | 59 ms |
| End-to-end latency, p95 | 67 ms |
| End-to-end latency, p99 | 99 ms |
| Average end-to-end latency | 63 ms |

### Methodology

| Setting | Configuration |
|---|---|
| Deployment | 4 gateway instances; 4 workers, 4 vCPUs, and 8 GB RAM per instance |
| Traffic | Locust; 1,000 users with a 0.5 to 1 second pause between requests |
| Requests | `/v1/realtime` over persistent WebSockets; text requests for a two-sentence story with a random ID |
| Model and network | Mock realtime endpoint |
| Configuration | PostgreSQL; Redis disabled |
| Duration | Not recorded |
| Measurement | [Locust script](https://gist.github.com/AlexsanderHamir/73b83ada21d9b84d4fe09665cf1745f5): requests per second and latency through `response.done`, including connection setup when needed |

## Short-prompt chat performance test results {#short-prompt-chat-performance-test-results}

**1,170 requests per second with 8 ms p95 gateway overhead across four instances.**

| Metric | 2 instances | 4 instances |
|---|---:|---:|
| Requests per second | 1,035.7 | 1,170 |
| Request latency, p50 | 200 ms | 100 ms |
| Request latency, p95 | 630 ms | 150 ms |
| Request latency, p99 | 1,200 ms | 240 ms |
| Average request latency | 262.46 ms | 111.73 ms |
| Gateway overhead, p50 | 12 ms | 2 ms |
| Gateway overhead, p95 | 29 ms | 8 ms |
| Gateway overhead, p99 | 43 ms | 13 ms |
| Average gateway overhead | 14.74 ms | 3.32 ms |

### Methodology

| Setting | Configuration |
|---|---|
| Deployment | 2 or 4 instances; 4 vCPUs and 8 GB RAM per instance. The 4-instance test uses 4 workers per instance; the 2-instance worker count is not recorded |
| Traffic | Locust; 1,000 users with a 0.5 to 1 second pause between requests |
| Requests | `/chat/completions`; the [4-instance script](https://gist.github.com/AlexsanderHamir/42c33d7a4dc7a57f56a78b560dee3a42) sends text with a random ID repeated 150 times. The 2-instance payload is not recorded |
| Model and network | Mock OpenAI endpoint |
| Configuration | PostgreSQL; Redis disabled |
| Duration | Not recorded |
| Measurement | Locust: request throughput and full request latency. Gateway overhead: `x-litellm-overhead-duration-ms` response header |

## Logging callback performance test results {#logging-callbacks}

| Configuration | Requests per second | Median request latency |
|---|---:|---:|
| Base proxy | 1,133.2 | 140 ms |
| GCS bucket logging | 1,137.3 | 138 ms |
| LangSmith logging | 1,135 | 132 ms |

### Methodology

| Setting | Configuration |
|---|---|
| Deployment | Not recorded |
| Traffic | Not recorded |
| Requests | Not recorded |
| Model and network | Not recorded |
| Configuration | Base proxy compared with [GCS bucket logging](./observability/gcs_bucket_integration.md) and [LangSmith logging](./observability/langsmith_integration.md) |
| Duration | Not recorded |
| Measurement | Requests per second and median request latency |

## Per-pod streaming benchmarks {#per-pod-streaming-benchmarks}

**One gateway pod with four workers sustained approximately 20 streaming requests per second in each of nine tests, with zero failures across 23,544 measured requests.** These are fixed-rate measurements, not maximum throughput or recommended production limits.

Tested November 19, 2026 on LiteLLM v1.110.0. Each response contained 37, 82, or 165 content chunks. The mock provider waited 200 ms before responding, then emitted one chunk every 15 ms.

| Gateway node | Content chunks per response | Measured RPS per pod | Header overhead p99, ms | First token p99, ms | Full stream p99, ms | Gateway CPU ms per request |
|---|---:|---:|---:|---:|---:|---:|
| c7a.2xlarge | 37 | 20.31 | 151 | 422 | 1,233 | 32.0 |
| c7a.2xlarge | 82 | 20.11 | 84 | 347 | 1,746 | 52.1 |
| c7a.2xlarge | 165 | 19.98 | 153 | 397 | 3,027 | 86.2 |
| c7i.2xlarge | 37 | 20.31 | 166 | 439 | 1,192 | 39.1 |
| c7i.2xlarge | 82 | 20.12 | 120 | 415 | 1,866 | 65.5 |
| c7i.2xlarge | 165 | 19.91 | 245 | 473 | 3,109 | 106.6 |
| c8i.2xlarge | 37 | 20.31 | 167 | 452 | 1,196 | 36.9 |
| c8i.2xlarge | 82 | 20.14 | 98 | 384 | 1,817 | 58.2 |
| c8i.2xlarge | 165 | 19.92 | 167 | 443 | 3,264 | 92.7 |

First-token and full-stream latency include the mock provider delay. Header overhead is the value from `x-litellm-overhead-duration-ms`; it does not measure the full lifetime of a stream. Do not subtract independent p99 values to estimate gateway overhead.

Gateway CPU ms per request is mean sampled gateway CPU cores divided by measured RPS, multiplied by 1,000. It includes background work and is not a per-request CPU profile or a per-vCPU throughput limit.

[Download the results CSV](/benchmarks/per-pod-streaming/results.csv) for request counts, p50/p95/p99 latency, completed chunks per second, and sampled container CPU and memory.

### Methodology

| Setting | Configuration |
|---|---|
| Gateway image | `ghcr.io/berriai/litellm-gateway@sha256:6f90fd27a7b2c17bfafe3120548490d1bc16c0f966e17300c1bcf1fffa057135` |
| Deployment | AWS EKS Auto Mode, Kubernetes 1.34, `us-west-1a`; one gateway pod with four workers on a dedicated, tainted, on-demand node |
| Node specifications | Each node had 8 vCPUs and 16 GiB RAM. c7a had 8 physical cores with one thread per core. c7i and c8i had 4 physical cores with two threads per core |
| Support workloads | Locust, a two-worker mock provider, PostgreSQL 16.6, and Redis 7.4.2 on a separate, fixed c7i.2xlarge node in the same Availability Zone |
| Network | Direct Kubernetes Service traffic. No public load balancer or service-mesh sidecar |
| Gateway components | Separate gateway, collector, and Prometheus metrics containers in the gateway pod. Collector used a Unix socket. PgBouncer enabled with 20 database connections |
| Request configuration | API-key authentication; Redis auth cache and transaction buffer; spend logs, prompt storage, and Prometheus enabled. Redis response cache configured, with a random request ID to avoid response reuse |
| Requests | `POST /v1/chat/completions`, `stream: true`; small user message with a random ID; `max_tokens` 64, 150, or 300 mapped by the mock to 37, 82, or 165 content chunks |
| Chunk content | Alternating equal-length words. Chunk counts are not tokenizer token counts |
| Load | Locust FastHttpUser, 80 clients, spawn rate 80 clients/second. Each client used constant throughput of 0.25 requests/second, with an initial random delay of 0–4 seconds. Target total was 20 RPS |
| Duration | Each case had 20 seconds of warmup, 130 seconds of measurement, and up to 30 seconds to drain active requests |
| Client measurements | Read complete SSE lines, verify the expected content chunk count and `[DONE]`, and record first content chunk and full-response times separately. Request counts use completion timestamps within the measurement window |
| Resource measurements | Periodic Kubelet CPU/memory samples and cAdvisor counters. CPU means deduplicate cached Kubelet samples. Memory values in the CSV are maximum sampled working sets |
| Run order | c7a profiles, then c7i profiles, then a separate c8i follow-up. Same pinned stack, mock, and client code. One run per profile; no randomized repeats or confidence intervals |
| Data checks | Raw event counts and expected chunk totals matched the summaries. Downloaded request artifacts passed SHA256 checks. One c7i 82-chunk case missed a resource-sampling cycle, totaling four reads across two nodes; its request capture was complete |

The tested container allocations were:

| Container | CPU request | CPU limit | Memory request | Memory limit |
|---|---:|---:|---:|---:|
| Gateway, four workers | 4 vCPUs | 8 vCPUs | 8 GiB | 8 GiB |
| Collector | 0.5 vCPU | 1 vCPU | 1 GiB | 2 GiB |
| Prometheus metrics | 0.05 vCPU | None | 128 MiB | 512 MiB |

These allocations describe the test, not minimum production requirements. Allow additional capacity for sidecars and node services.

### How to use these results

At the tested rate, c7a used about 18–20% less sampled gateway CPU than c7i. c8i used about 6–13% less than c7i. Latency varied by profile; a newer machine did not consistently reduce latency. Equal vCPU counts also did not mean equal physical core counts.

These short synthetic runs do not establish maximum RPS, a latency-based scaling threshold, or a safe memory minimum. They do not cover mixed streaming/non-streaming traffic, large prompts, other API endpoints, custom auth or logging callbacks, Datadog, or service-mesh overhead. c8a was not tested.

For sizing, repeat the test with your request mix and integrations, increase RPS until the chosen latency or error threshold is reached, and confirm an operating rate with headroom below that threshold. Keep proxy overhead, first-token latency, and full-stream duration as separate measurements.
