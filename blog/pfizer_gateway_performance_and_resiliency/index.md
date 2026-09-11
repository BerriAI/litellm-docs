---
slug: pfizer-gateway-performance-and-resiliency
title: "How Pfizer Improved LiteLLM Gateway Performance and Resiliency at Scale"
date: 2026-09-11T10:00:00
authors:
  - name: Ishaan Jaffer
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Yassin Kortam
    title: Senior SWE @ LiteLLM
    url: https://www.linkedin.com/in/yassink/
    image_url: /img/yassin.jpg
  - name: Gabriele Michelli
    title: LiteLLM
    url: https://github.com/BerriAI/litellm
  - name: Aleksandr Liadov
    title: Pfizer AI Platform Engineering
    url: https://www.linkedin.com/in/aleksandr-liadov-76766a152/
  - name: Praveena Mundolimoole
    title: Pfizer AI Platform Engineering
    url: https://www.linkedin.com/in/pmundolimoole/
  - name: Pramod Naik
    title: Pfizer AI Platform Engineering
    url: https://www.linkedin.com/in/pramod-naik-b02a6322a/
  - name: Tung Hoang
    title: Pfizer AI Platform Engineering
    url: https://www.linkedin.com/in/tunghoangs/
  - name: Alexey Reznichenko
    title: Pfizer AI Platform Engineering
    url: https://www.linkedin.com/in/raaar/
description: "How Pfizer AI Platform Engineering isolated a Redis connection handling bug that cut LiteLLM gateway throughput by ~48% with zero HTTP errors, reduced CI load-test latency by 76%, and built a regression prevention framework with LiteLLM."
tags: [engineering, performance, redis, testing, customer-story]
hide_table_of_contents: false
---

import styles from './styles.module.css';

![LiteLLM x Pfizer](/img/litellm_pfizer_announcement.png)

<p className={styles.deck}>A joint debugging story with LiteLLM, and the release testing that comes next.</p>

A LiteLLM version bump exposed a long-standing Redis configuration bug that cut Pfizer's gateway throughput by ~48%, with zero HTTP errors in the application logs. Here's how the team isolated it through configuration bisection, and the testing infrastructure both teams are building to catch this class of regression before it ships.

{/* truncate */}

<div className={styles.stats}>
<div className={styles.card}>
<div className={styles.num}>~48%</div>
<div className={styles.label}>throughput drop caught in CI (≈300 → 156 RPS)</div>
</div>
<div className={styles.card}>
<div className={styles.num}>76%</div>
<div className={styles.label}>faster CI latency after the fix (5,000ms → 1,200ms median)</div>
</div>
<div className={styles.card}>
<div className={styles.num}>1 line</div>
<div className={styles.label}>the Redis conditional at the root of it</div>
</div>
<div className={styles.card}>
<div className={styles.num}>134</div>
<div className={styles.label}>issues addressed in a two-week stability push (LiteLLM)</div>
</div>
</div>

<p className={styles.kicker}>The regression</p>

## Slower, with no HTTP errors in the application logs

<p className={styles.lede}>The hardest regressions to catch are the ones that produce zero errors at the HTTP layer: no failures, no single slow request, just less work done per second under concurrency.</p>

Pfizer runs LiteLLM as a self-hosted AI gateway - a single OpenAI-compatible API in front of a multi-provider model catalog, serving every team, application, and agent at Pfizer with uniform access to external and self-hosted models. One shared entry point means a regression in the gateway propagates to every consumer behind it at once, so every change, whether an upstream LiteLLM bump or an internal commit, runs through automated load and regression tests in CI before it ships.

That is what caught this one. CI throughput held steady around 300 requests per second on v1.85.0 and v1.87.3, then dropped to about 156 RPS on v1.89.2. Error rate: unchanged. Per-request latency at the HTTP layer: nothing obviously wrong. The throughput drop manifested only under concurrent load - internally, Redis operations were stalling on TLS handshake timeouts in the async hot path, degrading throughput without surfacing HTTP-level errors. The underlying Redis bug existed in older versions too, but surfaced during Pfizer's v1.89.2 upgrade validation under this workload. That was enough to hold the version back from production.

<div className={styles.pullquote}>
<p>A throughput drop with a 0% HTTP error rate is the worst kind of regression to catch after the fact - nothing pages on it, and it only shows up under real concurrency, not in a single request. Redis timeout errors appeared in the proxy's internal logs, but the gateway still returned HTTP 200 to every caller. Our CI load-tests every version bump and every internal commit against fixed baselines specifically so this class of problem gets caught before it reaches production traffic that's latency-sensitive across chat sessions and agent loops.</p>
<cite>Aleksandr Liadov & Praveena Mundolimoole, Pfizer AI Platform Engineering</cite>
</div>

<p className={styles.kicker}>The hunt</p>

## Isolate first, then read the diff

<p className={styles.lede}>Rather than bisecting commits across two minor versions, the team narrowed the surface area by configuration first.</p>

<ol className={styles.steps}>
<li>Ran vanilla LiteLLM - no custom callbacks, no custom auth, mocked backend. Both v1.85.0 and v1.92.0 landed at 320-340ms median latency under concurrent load. The core proxy was clean on both versions.</li>
<li>Added Pfizer's custom components back one at a time, then all together. Still clean.</li>
<li>Enabled Redis caching. Median latency jumped to **4,200ms**. That isolated it to the Redis connection path.</li>
</ol>

From there, the fix was in the diff. The connection-pool builder in `litellm/_redis.py` decided whether to open a TLS connection by checking whether the `ssl` key was *present* in `redis_kwargs`, not whether its value was *true*:

```python
# before (litellm/_redis.py at 142d5aa): presence check
connection_class = async_redis.Connection
if "ssl" in redis_kwargs:            # true even when ssl: false
    connection_class = async_redis.SSLConnection
    redis_kwargs.pop("ssl", None)
    redis_kwargs["connection_class"] = connection_class

# after (PR #32590): value check
if redis_kwargs.pop("ssl", None):        # only when ssl is truthy
    redis_kwargs["connection_class"] = async_redis.SSLConnection
```

The config that triggers it - `ssl: false` with a plaintext Redis endpoint:

```yaml
# litellm_config.yaml (simplified)
litellm_settings:
  cache: true
  cache_params:
    type: redis
    host: my-redis.internal
    port: 6379
    password: <redacted>
    ssl: false       # valid config, but key presence triggered SSLConnection
```

Pfizer's config sets `ssl: false` against a non-TLS Redis instance - a valid, common setup. But because the key was merely present, cache operations attempted to use `SSLConnection` against a plaintext endpoint, stalling on TLS handshakes that never completed. This bug was version-independent - it existed in v1.85.0 too - but only surfaced under Pfizer's specific load profile when combined with other changes in the v1.89+ dependency tree. Several additional issues were identified during the same investigation:

<ul className={styles.cardGrid}>
<li>
<span className={styles.cardLabel}>Redis `ssl` handling</span>
<span className={styles.cardBody}>Presence check → value check (LIT-4307 / [PR #32590](https://github.com/BerriAI/litellm/pull/32590), shipped in [v1.93.0](https://github.com/BerriAI/litellm/releases/tag/v1.93.0-rc.1)).</span>
</li>
<li>
<span className={styles.cardLabel}>Starlette/FastAPI dependency</span>
<span className={styles.cardBody}>A Starlette dependency change showed measurable per-request middleware overhead in this benchmark under high concurrency; pinning to LiteLLM's tested version restored baseline throughput. Investigated separately from the Redis fix.</span>
</li>
<li>
<span className={styles.cardLabel}>OTEL settings cache</span>
<span className={styles.cardBody}>`is_otel_v2_enabled` was recomputing on every call; caching it dropped per-call cost from 28.4µs to 0.018µs ([#30989](https://github.com/BerriAI/litellm/pull/30989)).</span>
</li>
<li>
<span className={styles.cardLabel}>OTel lazy import fix</span>
<span className={styles.cardBody}>A failed OTel import was retried on every request instead of being memoized ([#31707](https://github.com/BerriAI/litellm/pull/31707)).</span>
</li>
<li>
<span className={styles.cardLabel}>Spend-counter round-trips</span>
<span className={styles.cardBody}>Reseed path reduced back toward a single Redis round-trip under contention.</span>
</li>
</ul>

<div className={styles.pullquote}>
<p>The reason this killed throughput without raising HTTP errors: Redis cache operations in LiteLLM's hot path use best-effort semantics with timeouts. When `SSLConnection` tried to negotiate TLS against a plaintext Redis, the handshake stalled until the socket timeout (5s default), then the proxy fell back to proceeding without the cache result. The request still returned HTTP 200 - the model response came back fine - but concurrent requests accumulated waiting on Redis connection attempts and timeouts in the async hot path. Under load, this saturated the connection pool and serialized what should have been parallel async operations. Meanwhile, Redis timeout errors appeared in the proxy's internal logs, but never surfaced as HTTP failures to the client.</p>
<cite>Pramod Naik & Tung Hoang, Pfizer AI Platform Engineering</cite>
</div>

<p className={styles.kicker}>The result</p>

## The fix, and the test that now runs on every release

<p className={styles.lede}>The fix closed the immediate gap. The more durable outcome is that the load test which caught it no longer lives only in Pfizer's CI.</p>

Pfizer has shared its load-test configuration with LiteLLM for integration into their CI pipeline, including the mock-backend harness that mimics model providers without hitting real endpoints. The goal: this class of regression - a throughput drop with a clean error rate - becomes part of the release gate for every LiteLLM deployment, not just Pfizer's. This work shipped alongside a broader two-week stability push that addressed [134 issues](https://github.com/BerriAI/litellm/releases/tag/v1.93.0-rc.1) across the LiteLLM codebase.

<p className={styles.signature}>One conditional checked whether a key existed instead of whether it was true. Half the throughput. Both the fix and the test configuration that caught it have been contributed upstream.</p>

<div className={styles.beforeafter}>
<div className={styles.card}>
<span className={styles.baLabel}>Before the fix</span>
<span className={styles.baNum}>5,000ms</span>
<span className={styles.baSub}>median CI latency · 158 RPS</span>
</div>
<div className={styles.baArrow}>→</div>
<div className={styles.card}>
<span className={styles.baLabel}>After the fix</span>
<span className={styles.baNum}>1,200ms</span>
<span className={styles.baSub}>median CI latency · 236 RPS, 76% faster</span>
</div>
</div>

**Benchmark environment:** CI mode: 750 concurrent Locust users, 100 users/s spawn rate, 60s sustained load, cassette-based mock backend (deterministic responses), single LiteLLM proxy container, Redis 7 with password auth, LocalStack for AWS services. Task mix weighted: chat completions (10), health (5), embeddings (3), image gen (1). Baselines: median &lt;1,200ms, &gt;200 RPS, error rate &lt;0.5%.

<p className={styles.kicker}>How Pfizer tests the gateway</p>

## Five CI gates, and what's next

<p className={styles.lede}>The load test that caught the regression isn't a one-off script. Pfizer's AI Platform Engineering team runs five automated testing gates on every code change to the gateway - no change reaches production without passing all five - plus one in active development.</p>

<ul className={styles.cardGrid}>
<li>
<span className={styles.cardLabel}>Unit tests</span>
<span className={styles.cardBody}>Auth, routing, health checks, and metrics validated on every PR. Tests run the same runtime configuration as production containers, so there is no config drift and no difference in behavior between the system under test and the production system.</span>
</li>
<li>
<span className={styles.cardLabel}>API contract testing</span>
<span className={styles.cardBody}>Automated OpenAPI diff on every PR. Breaking changes to customer-facing endpoints block the merge. Additive changes pass and get logged.</span>
</li>
<li>
<span className={styles.cardLabel}>Load / performance testing</span>
<span className={styles.cardBody}>Concurrent load against a fully mocked local infrastructure stack in CI with LocalStack, then again against live infrastructure post-deploy in staging environment. Dedicated load-generation infrastructure with traffic weighted to match real production patterns. Every run is checked against expected latency, throughput, and error-rate baselines.</span>
</li>
<li>
<span className={styles.cardLabel}>Memory-leak detection</span>
<span className={styles.cardBody}>Long-running, sustained load tests that monitor memory over hours, not minutes. This is, for instance, how the team identified a connection leak and hot-path object accumulation that were driving unnecessary autoscaling in production.</span>
</li>
<li>
<span className={styles.cardLabel}>Functional / E2E testing</span>
<span className={styles.cardBody}>Scenario suites running against live deployed environments covering chat completions, streaming, routing, auth flows, observability, and more. All scenarios must pass - partial passes are not accepted.</span>
</li>
<li>
<span className={styles.cardLabel}>Work in progress: fault injection & mutation testing</span>
<span className={styles.cardBody}>Injecting provider failures to validate fallback routing under stress. Adding mutation testing to increase team's confidence in the quality of our test coverage.</span>
</li>
</ul>

In practice, CI runs consistently achieve **0% HTTP error rate** and comfortably beat latency and throughput thresholds. The baselines are a safety net, not the norm.

<p className={styles.kicker}>How Pfizer improves gateway performance</p>

## Instrument before you optimize

<p className={styles.lede}>Load tests catch regressions at release time. Catching slow, cumulative drift - the kind that shows up as autoscaling pressure weeks later, not a failed CI check - needs a different discipline: instrumentation deep enough to see it, then fixes targeted enough not to introduce new drift.</p>

<ul className={styles.cardGrid}>
<li>
<span className={styles.cardLabel}>Instrumentation</span>
<span className={styles.cardBody}>Requests are traced down to memory allocation, HTTP connection reuse, event-loop scheduling, and Python garbage-collector behavior. This is how the team found a connection leak and hot-path object accumulation that were quietly driving unnecessary autoscaling in production - neither showed up as an error or a failed threshold, only as a slow upward trend in memory and instance count.</span>
</li>
<li>
<span className={styles.cardLabel}>Targeted fixes, then a backstop</span>
<span className={styles.cardBody}>Once the source is visible, fixes are narrow: tightening object lifecycles, smoothing hot-path loop behavior, closing the specific leak. As a last line of defense against whatever slips past instrumentation, long-running workers are still recycled periodically - a backstop, not a substitute for finding the root cause.</span>
</li>
</ul>

{/* style-lint-allow-next-line em-dash: verbatim from the Pfizer-approved copy, not ours to reword */}
The instrumentation rests on three observability pillars: logs, metrics, and distributed traces — all enabled, all wired together. The team doesn't just turn them on and walk away. When something looks off, we inject additional instrumentation into the suspicious path, using all three pillars to triangulate exactly where the behavior diverges, until the root cause is fully visible. That's how we went from "something's slow" to root cause in a single investigation instead of a week of guesswork. These three pillars serve as the core foundation to gain insights into a constantly moving and dynamic system, such as the one we are working on.

<p className={styles.kicker}>What LiteLLM is building next</p>

## Catching this class of bug before release, not after

This regression was caught, but late - in a downstream user's CI, not in LiteLLM's own release checks. Based on what Pfizer's team flagged as highest priority, here's what's moving into the release pipeline:

<ul className={styles.cardGrid}>
<li>
<span className={styles.cardLabel}>Regression testing</span>
<span className={styles.cardBody}>Representative load and behavior tests, Pfizer's included, running as release gates instead of after-the-fact checks.</span>
</li>
<li>
<span className={styles.cardLabel}>Functional testing</span>
<span className={styles.cardBody}>Broader end-to-end coverage of the request lifecycle across providers.</span>
</li>
<li>
<span className={styles.cardLabel}>Contract verification</span>
<span className={styles.cardBody}>Provider and API-shape checks so a dependency or schema change can't silently alter behavior.</span>
</li>
<li>
<span className={styles.cardLabel}>Fuzzing</span>
<span className={styles.cardBody}>Malformed and adversarial inputs against the proxy's hot paths to surface edge cases early.</span>
</li>
<li>
<span className={styles.cardLabel}>Memory-leak detection</span>
<span className={styles.cardBody}>Retention checks under sustained large-payload load, so worker memory stays flat over time.</span>
</li>
<li>
<span className={styles.cardLabel}>In the open</span>
<span className={styles.cardBody}>We'll report where each of these stands, with numbers, at the release milestones. You shouldn't have to take our word for it.</span>
</li>
</ul>

<div className={styles.pullquote}>
<p>This is exactly why we stand for open source and not some black-box solution. We want to deeply understand what's going on inside the gateway, and be able to contribute back, even change the way it's tested. The real win here isn't the latency number; it's that our load test is being integrated into LiteLLM's release pipeline, so this class of regression gets caught before it reaches us or anyone else. That's how we sleep better at night, and how the whole community benefits from the work.</p>
<cite>Alexey Reznichenko, Pfizer AI Platform Engineering</cite>
</div>

<div className={styles.closecard}>

## Why we wrote this together

A one-line presence check cut a production gateway's throughput in half with a clean error rate - the kind of regression that's easy to miss and expensive to find late. We wrote this up jointly because Pfizer caught it in CI before it reached production, and because the fix and the test configuration have been contributed upstream, where every LiteLLM deployment can benefit. Platform teams running LiteLLM in production hit failure modes maintainers can't always reproduce locally; contributing fixes and tests, not just bug reports, is what turns those into permanent coverage. If you've hit something similar, we'd like to hear about it.

<div className={styles.btnRow}>
<a className={`${styles.btn} ${styles.btnPrimary}`} href="https://github.com/BerriAI/litellm">LiteLLM on GitHub</a>
<a className={`${styles.btn} ${styles.btnSecondary}`} href="https://docs.litellm.ai/">Read the docs</a>
</div>

</div>
