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
**Severity:** Medium (silent cost regression; no correctness impact)  
**Status:** Resolved in `v1.91.2`

> **Note:** If you run Claude Code against Amazon Bedrock through LiteLLM on either `v1.91.0` or `v1.91.1`, upgrade to `v1.91.2` or higher.

## Summary

Between July 4 and July 10, proxies running `v1.91.0` or `v1.91.1` silently broke Anthropic prompt caching for Claude Code sessions routed through Amazon Bedrock's Invoke API. For the customers who reported it, warm-session cache hit rates dropped from roughly 90% to 25-45% and team daily spend rose 2-3x for the same usage. Requests kept returning 200s with correct completions; the only symptoms were the cache miss rate and the bill.

The cause: [PR #31364](https://github.com/BerriAI/litellm/pull/31364) moved every `role: "system"` entry in `messages` into the top-level `system` field on the Invoke path, which invalidates every cache breakpoint past the tool definitions and system prompt. The fix shipped July 10 in `v1.91.2` ([#32578](https://github.com/BerriAI/litellm/pull/32578), [#32831](https://github.com/BerriAI/litellm/pull/32831), [#32882](https://github.com/BerriAI/litellm/pull/32882)), with regression tests that fail on pre-fix code.

We own this outcome entirely. The trigger was a poorly documented change in how new Claude models and Claude Code use system messages, but customers run a gateway precisely so they do not have to track provider quirks. Translating requests faithfully, including their caching semantics, is our core job and here we fell short. This post explains exactly what happened, why our testing and review failed to catch it, and what we have changed so this class of regression does not ship again.

{/* truncate */}

---

## Background

Three facts set up the incident:

1. **Claude prompt caching is prefix based:**
   1. the pricing of tokens in increasing cost is:
      1. cache read (0.1x)
      2. normal write (1x)
      3. cache write (1.25x for 5m ttl, 2x for 1h ttl)
   2. when Claude Code makes a new request, the Bedrock provider checks if any previous request was a truncated prefix of the current request. If so, it reads from the cache only up to that point.
2. **Mid-conversation system messages are new:**
   1. On May 28, 2026, Claude Opus 4.8 shipped as the first model accepting `role: "system"` entries inside `messages` ([docs](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages)). This was documented on the Claude API docs [on the same day](https://web.archive.org/web/20260528184320/https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages)
   2. Claude Code (`v2.1.154`) began emitting them on May 28, 2026, with no mention in its changelog.
   3. Bedrock documented the same support by [June 9, 2026](https://web.archive.org/web/20260609182343/https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-mid-conversation-system.html) at the latest (the first archive.org capture; the page may have appeared as early as May 28)
3. **Bedrock has two Anthropic APIs with different rules:**
   1. Converse requires all system content in a top-level field; LiteLLM has hoisted it there since December 2024 ([#7037](https://github.com/BerriAI/litellm/pull/7037)).
   2. Invoke takes the native Anthropic Messages format, where models older than Opus 4.8 reject mid-conversation system entries with a 400 and newer models accept them.

---

## What went wrong

1. After May 28, Claude Code sessions on Bedrock Invoke began failing with 400s mid-session when two things were true:
   1. the model was older than Opus 4.8
   2. the model is served under an alias
      1. Claude Code detects capabilities by looking for version substrings like `opus-4-7` or `sonnet-4-6` in the model name.
      2. For example, an alias like `bedrock-claude` contains none, so Claude Code assumes the newest feature set and always emits mid-conversation system messages.
2. An enterprise customer worked around the 400s with a local patch that hoisted every system entry from `messages` into top-level `system`, mirroring the Converse behavior, and asked us to upstream it. We shipped it as [#31364](https://github.com/BerriAI/litellm/pull/31364) in `v1.91.0` on July 4.
3. The hoist fixed the 400s but by always hoisting the system entries in `messages`, that would invalidate the entire `messages` cache whenever a new mid-conversation system message was written by Claude Code, which we measured to happen every ~3 turns on average.
4. This greatly decreased the cache hit rate and increased the cache write rate, increasing spend.

---

## Detection and response

On July 8, an affected customer gave a detailed bug report of this regression. We reproduced it ourselves the same day end-to-end.

Three PRs fixed it, all released July 10 in `v1.91.2` after extensive end-to-end testing, with regression tests that fail on pre-fix code:

1. [#32578](https://github.com/BerriAI/litellm/pull/32578) disables mid-conversation system message hoisting on Invoke.
2. [#32831](https://github.com/BerriAI/litellm/pull/32831) re-enables hoisting on models below Opus 4.8.
3. [#32882](https://github.com/BerriAI/litellm/pull/32882) disables hoisting on Sonnet 5 and Fable 5, too.

| Date (2026) | Event                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| May 28      | Opus 4.8 ships; Claude Code starts emitting mid-conversation system messages              |
| Jun 27      | Customer workaround upstreamed as [#31364](https://github.com/BerriAI/litellm/pull/31364) |
| Jul 4       | `v1.91.0` ships with the regression                                                       |
| Jul 6       | Customer observes 2-3x spend and collapsed cache hit rates                                |
| Jul 8       | Regression reported; root cause identified; fix opened                                    |
| Jul 10      | `v1.91.2` ships with all three fixes and regression tests                                 |
| Jul 13      | Customer confirms full recovery                                                           |

---

## Why our process did not catch this

1. **Testing the original patch was not end-to-end.** We validated it with single-turn `curl` requests showing a 400 become a 200 that we assumed was the shape that Claude Code would use. That was not the case. We did not trace the root cause (we did not yet know mid-conversation system messages existed) or its caching implications, and treated it as a harmless edge case fix.
2. **Review lacked the context to object.** The human reviewer saw a small compatibility patch with passing tests and no explanation of why Claude Code started sending these kinds of mid-conversation system messages, and our AI review bots did not flag the caching implication either. Nobody in the loop had the info to connect the hoist to cache invalidation.
3. **Cost regressions are silent.** Every response was a 200 with a correct completion. The only signal was cache-read token counts, which nothing in our CI or monitoring measured.
4. **The documentation was incomplete.** The feature never appeared in the Claude Code changelog, and as of July 13 the Claude API docs still describe it as Opus 4.8 only (without mentioning Sonnet or Fable 5) and unavailable on Bedrock, which contradicts our empirical measurements.

---

## What we are changing

- Our e2e suite will gain a scripted multi-turn Claude Code session growing to roughly 250k tokens of context against real Bedrock, asserting cache reads grow monotonically and never collapse (started in [#32963](https://github.com/BerriAI/litellm/pull/32963))
- We will set up a weekly automated load test that will flag anomalies in spend, cache reads and writes, turn latency, error rates, etc., so cost and performance regressions are detected and fixed before a release.
- Daily automated diffs of Anthropic's SDKs and docs alert us to new features that need translation support before customer traffic finds them
- We [dogfood](https://en.wikipedia.org/wiki/Eating_your_own_dog_food) LiteLLM internally and will set up monitoring for new request shapes, such as unknown `anthropic-beta` headers, and the same anomoly detction, which will alert us ahead of a release.
- Bug fixes now have a higher merge bar: validated means reproduced against the real client's traffic on their exact end-user application end-to-end and a complete understanding of the root cause; synthetic requests are not enough.

---

## Known limitations

1. Converse rejects system entries inside `messages` at any position, so on `bedrock_converse` we must still hoist, and Claude Code sessions routed through Converse still lose cached prefix on every mid-conversation system message. If you run Claude Code against Bedrock, route it through the Invoke path (`bedrock/invoke/<model>`). We are raising the API constraint with AWS
2. We are testing whether the Vertex AI and Azure paths need equivalent hoisting and will update this post when we have more info.

To every team whose bill went up because of this: we are sorry. The value of a gateway is that this class of provider change gets absorbed by us instead of reaching you, and the tests, monitoring, and process improvements above are how we intend to keep it that way.
