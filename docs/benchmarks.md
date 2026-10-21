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
