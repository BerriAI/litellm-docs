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

Between July 4 and July 10, proxies running `v1.91.0` or `v1.91.1` silently broke Anthropic prompt caching for Claude Code sessions routed through Amazon Bedrock's Invoke API. For the customer who reported it, warm-session cache hit rates dropped from roughly 90% to 25-45% and team daily spend rose 2-3x for the same usage. Requests kept returning 200s with correct completions; the only symptoms were the cache miss rate and the bill.

The cause: [PR #31364](https://github.com/BerriAI/litellm/pull/31364) moved every `role: "system"` entry in `messages` into the top-level `system` field on the Invoke path, which invalidates every cache breakpoint past the first moved entry. The fix shipped July 10 in `v1.91.2` ([#32578](https://github.com/BerriAI/litellm/pull/32578), [#32831](https://github.com/BerriAI/litellm/pull/32831), [#32882](https://github.com/BerriAI/litellm/pull/32882)), with regression tests that fail on pre-fix code.

We own this outcome entirely. The trigger was an undocumented change in how new Claude models and Claude Code use system messages, but customers run a gateway precisely so they do not have to track provider quirks. Translating requests faithfully, including their caching semantics, is our core job.

{/* truncate */}

---

## Background

Three facts set up the incident:

1. **Anthropic prompt caching is prefix based.** A request reads from cache only up to the point where its payload matches a previously written prefix; cached tokens cost a small fraction of normal input. Claude Code resends the entire growing conversation every turn, so a warm session reads hundreds of thousands of tokens from cache per turn, and anything that rewrites content early in the payload turns the rest back into full-price input.
2. **Mid-conversation system messages are new.** On May 28, 2026, Claude Opus 4.8 shipped as the first model accepting `role: "system"` entries inside `messages` ([docs](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages)). Claude Code (`v2.1.154`) began emitting them the same day, with no mention in its changelog.
3. **Bedrock has two Anthropic APIs with different rules.** Converse requires all system content in a top-level field; LiteLLM has hoisted it there since December 2024 ([#7037](https://github.com/BerriAI/litellm/pull/7037)). Invoke takes the native Anthropic Messages format, where models older than Opus 4.8 reject mid-conversation system entries with a 400 and newer models accept them.

---

## What went wrong

1. After May 28, Claude Code sessions on Bedrock Invoke began failing with 400s mid-session when two things were true: the model was older than Opus 4.8, and the proxy model alias did not tell Claude Code which Claude version it was talking to, so it assumed support and emitted mid-conversation system messages.
2. An enterprise customer worked around the 400s with a local patch that hoisted every system entry from `messages` into top-level `system`, mirroring the Converse behavior, and asked us to upstream it. We shipped it as [#31364](https://github.com/BerriAI/litellm/pull/31364) in `v1.91.0` on July 4.
3. The hoist fixed the 400s but rewrote the request prefix in two places at once: the top-level `system` block changes and the message list changes. Previously cached prefixes no longer match, so every cache breakpoint past the first moved entry is invalidated.
4. Net effect in a warm Claude Code session: nearly everything except the tool schemas misses cache on every turn, at full input price.

---

## Detection and response

On July 8 the affected customer reported the regression with request-level forensics that localized it for us: warm turns that had read 100% of a 306,892-token cached prefix the week before now read 17-22%, with everything past the first breakpoint re-written, all inside the cache's 5-minute TTL (ruling out expiry). Testing older Claude Code versions ruled out a client-side change. We reproduced it live the same day: a real Claude Code session against real Bedrock Invoke showed cache reads collapsing to 33,436 tokens exactly on the turns where Claude Code appended a mid-conversation system message.

Three PRs fixed it, all released July 10 in `v1.91.2` with regression tests that fail on pre-fix code:

1. [#32578](https://github.com/BerriAI/litellm/pull/32578) hoists only the leading run of system entries and forwards mid-conversation ones untouched
2. [#32831](https://github.com/BerriAI/litellm/pull/32831) gates forwarding to models that support the feature, since unconditional forwarding reintroduces the 400s below Opus 4.8
3. [#32882](https://github.com/BerriAI/litellm/pull/32882) adds Sonnet 5 and Fable 5, which shipped after the gate was written

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

1. **The proof of fix was synthetic.** We validated the original patch with single-turn requests showing a 400 become a 200: no multi-turn session, no cache breakpoints, no growing prefix. The one traffic shape that mattered was never exercised.
2. **The PR's tests encoded the bug.** They asserted the hoist as the new expected behavior; when a PR redefines expected behavior, its own tests bless it by construction. Automated PR review tooling did not flag the caching implication either.
3. **Cost regressions are silent.** Every response was a 200 with a correct completion. The only signal was cache-read token counts, which nothing in our CI or monitoring measured.
4. **The documentation was incomplete.** The feature never appeared in the Claude Code changelog, and as of July 13 the platform docs still describe it as Opus 4.8 only and unavailable on Bedrock; live traffic contradicts both. Provider behavior has to be established empirically.

---

## What we are changing

- Our e2e suite gains a scripted multi-turn Claude Code session growing to roughly 250k tokens of context against real Bedrock, asserting cache reads grow monotonically and never collapse (started in [#32963](https://github.com/BerriAI/litellm/pull/32963))
- A weekly load test flags anomalies in spend, cache reads and writes, and turn latency, so silent cost regressions surface in days rather than on a customer's bill
- Daily automated diffs of Anthropic's SDKs and docs alert us to new features that need translation support before customer traffic finds them
- Live proxy traffic is monitored for new request shapes, such as unknown `anthropic-beta` headers, so undocumented client changes surface within a day
- Translation fixes now have a higher merge bar: validated means reproduced against the real client's traffic shape end to end; synthetic requests are not proof

---

## Known limitation: Bedrock Converse

Converse rejects system entries inside `messages` at any position, so on `bedrock_converse` we must still hoist, and Claude Code sessions routed through Converse still lose cached prefix on every mid-conversation system message. If you run Claude Code against Bedrock, route it through the Invoke path (`bedrock/invoke/<model>`). We are raising the API constraint with AWS, and we are testing whether the Vertex AI and Azure paths need equivalent handling.

To every team whose bill went up because of this: we are sorry. The value of a gateway is that this class of provider change gets absorbed by us instead of reaching you, and the tests and monitoring above are how we intend to keep it that way.
