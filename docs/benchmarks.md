# Benchmarks

LiteLLM Gateway throughput and latency, measured with mock model responses.

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
