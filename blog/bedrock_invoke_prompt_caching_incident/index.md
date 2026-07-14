---
slug: bedrock-invoke-prompt-caching-incident
title: "Incident Report: Prompt Cache Invalidation for Claude Code on Bedrock Invoke"
date: 2026-07-13T10:00:00
authors:
  - mateo
  - krrish
  - ishaan-alt
tags: [incident-report, bedrock, caching, claude-code]
hide_table_of_contents: false
---

**Date:** July 4 to July 10, 2026
**Affected versions:** `v1.91.0` and `v1.91.1`
**Severity:** High (silent cost regression; no correctness impact)
**Status:** Resolved in `v1.91.2`

> **Note:** If you run Claude Code against Amazon Bedrock through LiteLLM, upgrade to `v1.91.2` or higher.

## Summary

Between July 4 and July 10, proxies running `v1.91.0` or `v1.91.1` silently broke Anthropic prompt caching for Claude Code sessions routed through Amazon Bedrock's Invoke API. For the customer who reported it, warm-session cache hit rates dropped from roughly 90% to 25-45% and team daily spend rose 2-3x for the same usage. Every request still returned a 200 with a correct completion; the only symptoms were a higher cache miss rate and a higher bill.

The regression was introduced by [PR #31364](https://github.com/BerriAI/litellm/pull/31364), which moved every `role: "system"` entry in `messages` into the top-level `system` field on the Invoke path. The fix shipped July 10 in `v1.91.2` across three PRs ([#32578](https://github.com/BerriAI/litellm/pull/32578), [#32831](https://github.com/BerriAI/litellm/pull/32831), [#32882](https://github.com/BerriAI/litellm/pull/32882)), with regression tests that fail on pre-fix code.

We own this outcome entirely. The trigger was an undocumented change in how a new generation of Claude models and Claude Code use system messages, but customers run an LLM gateway precisely so they do not have to track provider quirks themselves. Translating requests faithfully, including their caching semantics, is our core job, and here we fell short. This post explains exactly what happened, why our testing and review failed to catch it, and what we have changed so this class of regression does not ship again.

{/* truncate */}

---

## Background

Anthropic prompt caching is prefix based. Clients place `cache_control` breakpoints in the request, and a request reads from cache only up to the point where its payload matches a previously written prefix; cached tokens are billed at a small fraction of the normal input price. Agentic tools like Claude Code depend on this heavily because every turn resends the entire growing conversation. A warm Claude Code session routinely reads hundreds of thousands of tokens from cache per turn, so anything that rewrites content early in the payload turns almost the whole request back into full-price input tokens.

On May 28, 2026, Anthropic released Claude Opus 4.8, the first model to accept `role: "system"` entries mid-conversation inside `messages` ([docs](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages)). Claude Code began emitting these messages the same day. The feature did not appear in the Claude Code changelog, so gateways first encountered it as an unexplained new request shape in live traffic.

Bedrock exposes Claude through two APIs that treat system content differently. Converse requires all system content in a top-level field and rejects system entries inside `messages` at any position; LiteLLM has hoisted them accordingly since December 2024 ([PR #7037](https://github.com/BerriAI/litellm/pull/7037)). Invoke accepts the native Anthropic Messages format, where models older than Opus 4.8 reject mid-conversation system entries with a 400 and newer models accept them.

---

## What went wrong

After May 28, a specific combination started failing: Claude Code sessions pointed at a Bedrock Invoke model older than Opus 4.8, using a proxy model alias that Claude Code could not map to a specific Claude version. Claude Code assumed the model supported mid-conversation system messages, emitted one, and the model rejected the request with a 400 mid-session.

An enterprise customer hit exactly this, worked around it with a local patch set, and asked us to upstream it. One of those patches fixed the 400s by hoisting every system entry from `messages` into the top-level `system` field on the Invoke path, mirroring the longstanding Converse behavior. We shipped it as [PR #31364](https://github.com/BerriAI/litellm/pull/31364) in `v1.91.0` on July 4.

Hoisting fixed the 400s but broke caching. Pulling a mid-conversation system entry out of `messages` rewrites the request prefix in two places at once: the top-level `system` block changes and the message list changes. From the model's perspective the previously cached prefix no longer matches, so every cache breakpoint past that point is invalidated. In a warm Claude Code session, that means nearly everything except the tool schemas misses cache on every turn, and the session pays full input price for context it had been reading at cache-hit rates.

---

## Detection and response

On July 8, the affected customer reported the regression with request-level forensics that localized it for us: identical warm mid-session turns that had read 100% of a 306,892-token cached prefix the week before were now reading 17-22%, with everything past the first breakpoint re-written, all well inside the cache's 5-minute TTL, which ruled out expiry. They had also ruled out their own side by testing older Claude Code versions.

The same day, we reproduced it live: a real Claude Code session against real Bedrock Invoke showed cache reads collapsing to 33,436 tokens exactly on the turns where Claude Code appended a mid-conversation system message. [PR #32578](https://github.com/BerriAI/litellm/pull/32578) restored the correct behavior by hoisting only the leading run of system entries and forwarding mid-conversation ones untouched. Further investigation showed that forwarding them unconditionally would reintroduce the 400s on models below Opus 4.8, so [PR #32831](https://github.com/BerriAI/litellm/pull/32831) gated forwarding to models that support the feature, and [PR #32882](https://github.com/BerriAI/litellm/pull/32882) extended the supported-model list to Sonnet 5 and Fable 5, which had shipped after the initial gate was written.

All three fixes were backported with regression tests that fail on pre-fix code and released July 10 in `v1.91.2`. The customer upgraded July 12 and confirmed on July 13 that cache hit rates and spend were back to baseline.

| Date (2026) | Event |
|---|---|
| May 28 | Opus 4.8 ships; Claude Code starts emitting mid-conversation system messages |
| Jun 27 | Customer workaround upstreamed as [#31364](https://github.com/BerriAI/litellm/pull/31364) |
| Jul 4 | `v1.91.0` ships with the regression |
| Jul 6 | Customer observes 2-3x spend and collapsed cache hit rates |
| Jul 8 | Regression reported; root cause reproduced live; fix opened |
| Jul 10 | `v1.91.2` ships with all three fixes and regression tests |
| Jul 13 | Customer confirms full recovery |

---

## Why our process did not catch this

Four gaps let this reach production undetected.

First, the proof of fix was synthetic. We validated the original patch with single-turn requests showing a 400 become a 200. Those requests did not resemble what Claude Code actually sends: no multi-turn session, no cache breakpoints, no growing prefix. The one traffic shape that mattered was never exercised end to end.

Second, the tests shipped with the change asserted the hoist as the new expected behavior, so they encoded the bug rather than catching it. When a PR redefines expected behavior, its own tests bless that behavior by construction; only an independent end-to-end check against real client traffic can catch the regression. Automated PR review tooling did not flag the caching implication either.

Third, cost regressions are silent. Every response was a 200 with a correct completion, and the only signal was in cache read token counts. Nothing in our CI or monitoring measured cache hit rate, so there was no alarm to trip.

Fourth, we leaned on documentation that was incomplete. Mid-conversation system messages never appeared in the Claude Code changelog, and as of July 13 the platform docs still describe the feature as Opus 4.8 only and unavailable on Bedrock, both of which live traffic contradicts. Provider behavior has to be established empirically, not from docs alone.

---

## What we are changing

Our end-to-end suite now includes a scripted multi-turn Claude Code session that grows to roughly 250k tokens of context against real Bedrock and asserts that cache reads grow monotonically and never collapse; this work started in [PR #32963](https://github.com/BerriAI/litellm/pull/32963). A weekly load test checks for anomalies in spend, cache reads and writes, and turn latency, so silent cost regressions surface within days instead of waiting for a customer's bill.

We are also closing the discovery gap that let an undocumented client change reach us through a 400 in production. Automated daily diffs of Anthropic's SDKs and documentation alert us to new features that need translation support, and live proxy traffic is monitored for new request shapes, such as unknown `anthropic-beta` headers, so client-side changes surface within a day of appearing.

Finally, we changed the bar for merging translation fixes: a fix is not considered validated until it has been reproduced against the real client's traffic shape end to end. Synthetic requests demonstrating a status code change are not proof.

---

## Known limitation: Bedrock Converse

The fix applies to the Invoke path. Converse rejects system entries inside `messages` at any position, so on `bedrock_converse` we must still hoist, and Claude Code sessions routed through Converse will still lose cached prefix on every mid-conversation system message. If you run Claude Code against Bedrock, route it through the Invoke path (`bedrock/invoke/<model>`). We are raising the API constraint with AWS, and we are testing whether the Vertex AI and Azure paths need equivalent handling.

To every team whose bill went up because of this: we are sorry. The entire value of a gateway is that this class of provider change gets absorbed by us instead of reaching you, and the tests and monitoring above are how we intend to keep it that way.
