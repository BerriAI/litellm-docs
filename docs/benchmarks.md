# Benchmarks

Performance test results for LiteLLM Gateway.

## Load test {#high-throughput-profile-3000-rps-with-50k-to-100k-token-prompts}

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
| Deployment | [High-throughput Helm configuration](./proxy/high_throughput.md); 33 gateway pods, 4 workers per pod; 132 vCPU and 528 GiB memory requested in total |
| Load | Distributed Locust with 30 workers; 3,000 users at one request per second each; 24 minutes 22 seconds |
| Requests | `/v1/chat/completions`; 50K, 75K, and 100K-token prompts in equal shares; 50% streaming; `max_tokens: 16` |
| Gateway features | Virtual-key authentication, budget checks, token counting, spend tracking, and metrics |
| Model and network | In-process mock model; response caching disabled; public AWS Application Load Balancer; 60-second client timeout |

Prometheus measures throughput and gateway latency. Locust measures client success and time to first token, including request upload and the load balancer.

## Realtime API {#realtime-api-benchmarks}

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
| Deployment | 4 gateway instances, each with 4 vCPUs, 8 GB RAM, and 4 workers |
| Load | Locust with 1,000 users and a 0.5 to 1 second pause between requests |
| Endpoint | `/realtime` with a mock realtime endpoint |
| Database | PostgreSQL; Redis disabled |

## Short-prompt chat performance test results

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
| Deployment | 2 or 4 gateway instances, each with 4 vCPUs and 8 GB RAM |
| Load | Locust with 1,000 users and a 0.5 to 1 second pause between requests |
| Endpoint | `/chat/completions` with a mock OpenAI endpoint |
| Database | PostgreSQL; Redis disabled |

Request latency measures the full request. Gateway overhead measures the processing time added by LiteLLM.

## Logging callback performance test results {#logging-callbacks}

| Configuration | Requests per second | Median request latency |
|---|---:|---:|
| Base proxy | 1,133.2 | 140 ms |
| GCS bucket logging | 1,137.3 | 138 ms |
| LangSmith logging | 1,135 | 132 ms |

### Methodology

Each test compares the base proxy with a logging integration enabled. See [GCS bucket logging](./observability/gcs_bucket_integration.md) and [LangSmith logging](./observability/langsmith_integration.md) for configuration.
