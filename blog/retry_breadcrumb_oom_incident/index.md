---
slug: retry-breadcrumb-oom-incident
title: "Incident Report: Retry Breadcrumb Memory Growth Causing OOM on v1.100.0"
date: 2026-09-12T10:00:00
authors:
  - kerry
tags: [incident-report, router, redis, memory]
hide_table_of_contents: false
---

**Date:** September 7 to September 9, 2026  
**Affected versions:** `v1.100.0`  
**Severity:** Medium (production outage for one customer; low blast radius, required an unreachable Redis)  
**Status:** Resolved in `v1.100.1`

> **Note:** If you are running `v1.100.0`, upgrade to `v1.100.1` or later. [`v1.99.1`](https://github.com/BerriAI/litellm/releases/tag/v1.99.1) and earlier are not affected. The `v1.100.0` dev and rc pre-releases and `v1.101.0-dev.1` carry the same defect; `v1.101.0-rc.1` and later are not affected.

## Summary

Between September 7 and September 9, 2026, an enterprise customer running `litellm-database:v1.100.0` behind nginx experienced two waves of kernel OOM kills across their proxy fleet: dozens of kills by the customer's count, one worker process reaching 61 GB RSS, and thousands of HTTP 502s and tens of thousands of HTTP 499s while the platform was down.

This needed two things to be true at once: the provider on the customer's traffic kept failing, so the router kept retrying, and Redis was unreachable at the same time, so every completing request logged the growing result of those retries in full. The retries grew unbounded because of a one-line change in [PR #38133](https://github.com/BerriAI/litellm/pull/38133) (August 24), which ran retry breadcrumbs, the record the router keeps of each failed LLM attempt, through an existing credential-masking helper before storing them. The helper was correct for its original inputs but assumed it was copying a plain tree; the breadcrumb was not a tree, it contained a pointer back to the same list it was about to be appended to. Copying it without preserving that shared reference turned a structure that had cost nothing in memory since December 2023 into one that roughly doubled in size with every retry, until a cost-tracking error handler turned it into a log string on every request for as long as the Redis outage lasted, and a single allocation reached 27 GB.

We fixed the underlying growth in [PR #39491](https://github.com/BerriAI/litellm/pull/39491), merged September 3 and included in `v1.101.0-rc.1`. It was not backported to `v1.100.0` before that version was tagged stable two days later. We backported it to `stable/1.100.x` on September 9 ([PR #40455](https://github.com/BerriAI/litellm/pull/40455)) and published `v1.100.1`.

We own this outcome entirely. The defect existed in a form we could have caught, a ticket filed three days before the stable release correctly identified a growth problem in the same code path, and our own fix PR turned an untested hedge in that ticket into a stated fact. The rest of this post explains how each of those things happened and what we're changing so that a defect like this can't reach a stable release the same way again.

{/* truncate */}

---

## Background

1. **What a retry breadcrumb is.** When an LLM call fails and the router retries or falls back, it writes a note about the failed attempt into the request's metadata under `previous_models`, so logs can show what was tried and what succeeded. One breadcrumb is roughly 10 KB.
2. **Why the breadcrumb needed masking.** Because it copies request settings wholesale, a breadcrumb can carry a forwarded `Authorization` header or a provider key, and it flows into spend logs and logging callbacks. `mask_credentials_in_payload` is an existing helper that replaces values under credential-looking keys with asterisks; it was already used elsewhere for guardrail responses. Running new breadcrumbs through it was reviewed and merged as a one-line security fix.
3. **A pointer loop that was already there, and had always been free.** For every incoming request, the proxy builds one metadata dict and a request snapshot whose body is a shallow copy of that same dict. When a call fails, the router's breadcrumb stores the snapshot by reference, appends itself to a list shared across the process, and the metadata's `previous_models` field points at that same list. The breadcrumb, the snapshot, the metadata, and the list form a loop. This had existed since December 2023 and cost nothing: a pointer is 8 bytes, so the process held four breadcrumbs' worth of memory, forever, regardless of how many failures occurred.

|                     | v1.98.0 (before)                                                                                                                                    | v1.100.0 (regression)                                                       | v1.101.0-rc.1 (fix)                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Breadcrumb contents | Exception info, request kwargs, metadata, and a shallow copy of the request snapshot, all shared references, so the loop costs nothing              | Same fields, now passed through `mask_credentials_in_payload` before storage | Same as v1.100.0, minus the request snapshot, which is what closed the loop     |
| Stored on           | The router, one list shared by every request in the process, last four kept                                                                        | Same                                                                        | The request's own metadata, last four per request                               |

---

## What went wrong

1. **The masking helper assumed a tree, and the breadcrumb wasn't one.** To star out a secret without mutating the original (which the router still needs for the retry), `mask_credentials_in_payload` rebuilds the structure it's given as a new copy. That's correct for guardrail responses and provider params, which are plain trees. It has no memo of objects it has already visited, which is how Python's own `copy.deepcopy` keeps shared references shared and loops as loops. Handed the breadcrumb's pointer back to the shared list, it didn't keep the pointer. It built a new list containing copies of every earlier breadcrumb, each of which already held copies of its own predecessors.
2. **Each retry's breadcrumb became roughly the sum of the last four.** With nothing shared anymore, breadcrumb size compounds: measured at close to 1.85x per failed retry in our reproduction of the incident, which put one request's metadata past a million characters by the twelfth failure. The fix PR's own measurement shows the same curve on a chat completions path under `--detailed_debug`: a single debug log line grew from roughly 10 KB to 1.24 MB within nine failing requests ([PR #39491](https://github.com/BerriAI/litellm/pull/39491)).
3. **Two failures at once is what made this an outage.** Either one alone was survivable. The provider on the customer's high-volume embeddings path kept failing, so the router kept retrying, and every retry made the breadcrumb structure bigger: a request that failed a dozen times carried a structure over a million characters wide by the end. At the same time Redis was genuinely unreachable, so the spend-tracking call on every completing request failed with the same exception for as long as the outage lasted. The provider failures decided how large the structure got, and the Redis outage decided how often something read the whole thing back. On their own, the provider failures would have grown a structure nothing expensive touched, and the Redis outage would have raised an exception over a structure that was still 10 KB. Together, on that traffic, every completing request paid the full cost of every retry that preceded it.
4. **The growing structure was turned into a log string on every request, with no level gate.** Each time the spend-counter increment failed, that exception landed in the cost-tracking callback's error handler, which builds a Slack alert by pasting the request's full metadata into an f-string, evaluated immediately, at every log level, not only under `--detailed_debug`. For a full minute at a time, every completing request turned an already-doubling structure into text, on the event loop. The customer's `py-spy` trace showed the worker pinned at 100% inside that single line; their memory map showed one 27 GB allocation.

---

## Detection and response

The customer opened a Sev 0 ticket on September 9 reporting two waves of kernel OOM kills (September 7 and 9), 502s and 499s across their fleet, and one process at 61 GB RSS. A `py-spy` flamegraph they captured pinpointed the stall inside the cost-tracking callback's error handler, and they traced the regression to commit `721227e9ee` before we did.

| Date (2026)     | Event                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aug 24          | [PR #38133](https://github.com/BerriAI/litellm/pull/38133) merges: retry breadcrumbs are masked before storage. Regression introduced.                                                                  |
| Sep 2, 17:47 PT | LIT-6780 filed at Medium priority after an engineer QA'ing an unrelated PR notices the proxy slowing down under repeated failing requests. The ticket's own text flags "running without --detailed_debug was not tried." |
| Sep 3           | [PR #39491](https://github.com/BerriAI/litellm/pull/39491) merges, fixing the growth, but states "Only happens with --detailed_debug on", dropping the ticket's hedge rather than testing it. It is not nominated for a stable backport. |
| Sep 5, 18:12 PT | `v1.101.0-rc.1` is tagged from staging, including both fixes.                                                                                                                                            |
| Sep 5, 18:45 PT | `v1.100.0` is tagged stable from the earlier rc line; neither fix is present.                                                                                                                            |
| Sep 6           | Customer deploys `v1.100.0`.                                                                                                                                                                             |
| Sep 7, 08:40 PT | First OOM wave.                                                                                                                                                                                          |
| Sep 9, 04:29 PT | Second OOM wave. The customer opens a Sev 0 ticket at 05:04 PT.                                                                                                                                          |
| Sep 9, 06:21 PT | Customer traces the regression to commit `721227e9ee`, moves to `v1.102.0-dev.1`, which already carries the fix, and reports no further OOM kills.                                                       |
| Sep 9, 14:27 PT | [PR #40455](https://github.com/BerriAI/litellm/pull/40455) backports the PR #39491 fix to `stable/1.100.x`.                                                                                              |
| Sep 9, 18:42 PT | `v1.100.1` is published with the backport.                                                                                                                                                               |

---

## Why our process did not catch this

1. **Nothing tested two dependency failures at once.** This incident needed upstream retries and a sustained Redis outage together. The twelve days between the regression merging and the stable tag, seven of them with [`v1.100.0-rc.1`](https://github.com/BerriAI/litellm/releases/tag/v1.100.0-rc.1) out as the release candidate, never combined them, so nothing exercised the path that broke.
2. **A hedge in a ticket did not survive into the fix that closed it.** LIT-6780's repro was a credential failure that never reached the cost-tracking callback, so every test in it looked debug-only by construction, and the ticket said so directly. The fix PR dropped that hedge and stated the opposite as fact, without running the one test that would have checked it.
3. **The alert line that actually broke had no log-level gate, and nobody had reason to look at it.** The line the fix PR measured and fixed was a genuinely debug-only line. A second consumer of the same structure, the cost-tracking alert, ran at every log level and was untouched by that PR, because nothing connected the two.
4. **Cost and memory regressions are silent in review.** A one-line change to run an existing, well-tested helper on a new input looked like a self-evidently safe security fix. Nothing in code review or CI surfaces that an input violates an unstated assumption the helper depends on.

---

## What we're changing

- **Verified assumptions, not inferred ones.** A claim that narrows a bug's blast radius (such as "only under `--detailed_debug`") now has to be written down and either tested or explicitly carried forward, not silently dropped when the fix ships. Rather than a new section, we added this to the existing Caveats instructions in our PR template, alongside the severity-tiered caveats authors already list there.
- **Chaos testing on every release candidate.** Every release candidate of the proxy now has to pass a load test under an injected fault before it ships. Stable releases are cut from a release candidate that passed it; a patch cut straight from a stable branch, the way `v1.100.1` was, is not gated yet. The first case is this incident's exact trigger: [`tests/e2e/load/test_redis_chaos_e2e.py`](https://github.com/BerriAI/litellm/blob/main/tests/e2e/load/test_redis_chaos_e2e.py) (added in [PR #40482](https://github.com/BerriAI/litellm/pull/40482)) drives sustained chat completions and Anthropic messages traffic through a live multi-worker proxy against deployments that fail and fall back, then holds the proxy's Redis unreachable for 90 seconds mid-run. It asserts zero failed requests on both endpoints, budgets the proxy's RSS at p50, p90, and p99 and its CPU per request as multiples of the healthy baseline from the same run, and puts flat ceilings on p50/p90/p99 latency and log bytes per request. This is the class of test that would have caught this defect regardless of how the originating ticket was classified, because it doesn't depend on anyone correctly predicting the trigger. From here it expands to other dependencies: slow database writes and provider errors that trigger retries and fallbacks.

| Action item                                                                                                                                                                                                       | Status  | Date               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------ |
| Untested-assumptions guidance added to PR template ([litellm#40811](https://github.com/BerriAI/litellm/pull/40811))                                                                                               | Shipped | September 12, 2026 |
| Redis chaos load test gating every release candidate ([litellm#40482](https://github.com/BerriAI/litellm/pull/40482), [project-releaser#238](https://github.com/BerriAI/project-releaser/pull/238))               | Shipped | September 12, 2026 |

---

## Known limitations

1. The cost-tracking callback's error handler still turns the full request metadata into a log string at every log level, bounded now only by the per-request cap of four breadcrumbs. This is a smaller version of the same class of defect and is tracked for a follow-up fix.
2. `mask_credentials_in_payload` still copies without a memo of visited objects, and any value nested past a depth of 10 is returned unmasked. It is safe today because nothing currently hands it a structure with a shared reference or a loop, but that safety is an invariant of its callers, not a guarantee the helper itself enforces.

We're sorry for the outage this caused. A defect in a one-line security fix should not have been able to take down a production proxy for hours, and the gap between "we have a ticket that describes this" and "we shipped a release that has it" is exactly the gap we're closing with the changes above.
