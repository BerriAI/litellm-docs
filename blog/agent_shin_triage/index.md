---
slug: agent-shin-triage
title: "Meet Agent Shin: how we triage external PRs and issues on LiteLLM"
date: 2026-08-10T10:00:00
authors:
  - mateo
description: "Agent Shin is the automated triage bot for BerriAI/litellm. This post explains what it checks, why we built it, and exactly what to do if it comments on your PR or issue."
tags: [community, contributing]
hide_table_of_contents: false
---

If you've opened a pull request or issue on [BerriAI/litellm](https://github.com/BerriAI/litellm), you may have heard from **Agent Shin**, the automated triage bot that runs against external contributions. This post is the long-form explanation that every Agent Shin comment links to: what it does, why, and what to do if you think it got things wrong.

{/* truncate */}

## Why we built it

LiteLLM gets a lot of inbound. On a typical week the repo sees ~150 new pull requests and ~100 new issues, most of them from external contributors we've never worked with before. That volume is wonderful; it's why LiteLLM has integrations with 100+ providers. It also has a cost: a meaningful fraction of those PRs and issues are not actionable as filed.

The most common patterns we see are:

- A PR with no body, or a body that's just the template with nothing filled in.
- A PR that touches non-trivial provider code but doesn't link an issue, doesn't describe the bug, and doesn't show any output of the fix actually working.
- A bug report that's two sentences and a screenshot of a stack trace: no repro, no config, no way for a maintainer to make it happen on their machine.
- A feature request with no use case (just "support X").

Each of these costs a maintainer 10 to 30 minutes of reading code, guessing intent, and writing a comment asking for more information. Multiply by a few hundred and the result is that high-quality contributions, the ones that *did* link an issue, *did* attach a screenshot, *did* show a clean before/after, wait days for a first response while we sift.

Agent Shin's job is to do that first sift consistently, in public, and with a clear path back into the queue.

## What Agent Shin does

Agent Shin runs on every external PR and issue. For each one, it asks a small LLM to check the body against the contribution rubric. Based on the verdict, it does one of three things:

1. **Pass quietly.** Most PRs and issues land here. Agent Shin leaves no comment; the contribution flows to the normal review queue.
2. **Post a heads-up and give you a grace window.** If the body is missing the basics, Agent Shin comments on the PR/issue with a list of what it couldn't find and a 2-hour window to fix it.
3. **Auto-close after the grace window.** If the window passes and the body still doesn't meet the bar, Agent Shin closes the PR/issue with a follow-up comment explaining how to bring it back. Closing is reversible, see [If you disagree](#if-you-disagree) below.

A few important things Agent Shin will **not** do:

- It does not touch PRs or issues from BerriAI org members, repo collaborators, or other bots.
- It does not auto-close anything a human maintainer has already engaged with or labeled for review.
- It does not delete your work. A closed PR keeps all its commits, comments, and diff; it's just moved out of the open queue.

## The rubric for pull requests

A PR passes triage when **both** of the following are true:

### (1) Context: at least one of

- **A linked issue.** `Fixes #1234`, `Closes #1234`, `Resolves #1234`, or a link to the issue. A bare `#1234` without a closing keyword counts only if it's clearly the related issue.
- **Or a clear problem description in the body** that explains what bug or missing feature this addresses (beyond the title), plus expected vs. actual behavior (or, for features, "what's possible now vs. with this PR").

### (2) End-to-end QA proof: at least one of

- **A screenshot** (or before/after screenshots) showing the fix or feature working.
- **A short screen recording / video** showing the fix or feature working.
- **The exact commands you ran, paired with their real output**, demonstrating the change works against the real system: a real curl against the real upstream, a real proxy request, real log output from your dev instance.

> **"No mocking allowed" for option 3.** Unit tests in `tests/test_litellm/*` stub the upstream LLM provider, the database, and the network. They're great for catching regressions and you should still add them, and they're a hard requirement in the PR template, but they don't *prove* the change works end-to-end. For Agent Shin's purposes, the output of a real integration run, a real proxy hit, or a screenshot of the feature in the UI is what counts. "I ran pytest, 36 passed" is not QA proof on its own.

If your PR has a linked issue but no QA proof, it fails. The linked issue gives the maintainer context; QA proof gives them evidence. We need both.

### What doesn't count as QA proof

- Generic claims: "I tested it", "works locally", "all tests pass".
- A checked "I added tests" box with no output shown.
- A description of what tests exist without their actual output in the PR body.
- A linked issue (that's context, not proof).

## The rubric for issues

### Bug reports must contain:

- **A reproduction.** Runnable code, a curl command, or an example config a maintainer can paste into their machine.
- **A screenshot, traceback, or log** showing the bug.
- **Expected vs. actual behavior.**

### Feature requests must contain:

- **A clear description** of what LiteLLM should do that it doesn't today.
- **A use case with a concrete example**: config, API call, UI flow, or scenario showing what's blocked today.

## What happens if you got the heads-up comment

The first time Agent Shin spots a problem, you'll get a comment that looks roughly like this:

> 🚅 Hi, thanks for the PR! I'm Agent Shin… What's still missing: end-to-end QA proof… If the description isn't updated in the next 2 hours, I'll auto-close this PR.

You have three ways to clear it:

1. **Edit the PR/issue description** to add what's missing. Agent Shin re-checks on its next sweep and skips the close if it now passes; you can also comment `@agent-shin reconsider` to have the rubric re-run right away.
2. **Comment `@greptileai`** on a PR to request a fresh Greptile review. A Greptile confidence score of 4/5 or higher is one of the signals that lifts a PR out of the close queue, even after the grace warning. (This works for closed PRs too.)
3. **Do nothing**, and if the body genuinely doesn't have what's being asked for, the PR/issue gets auto-closed once the 2-hour window is up. That's not a final answer, see below.

## What happens after auto-close

A closed PR or issue is not a "won't fix". To bring it back:

- For PRs: you can either open a fresh PR with the same commits (the most reliable path, since GitHub doesn't always let an external contributor reopen a bot-closed PR), or comment `@agent-shin reconsider` after updating the description. If the rubric now passes, Agent Shin reopens the PR.
- For issues: comment `@agent-shin reconsider` after editing the issue. The bot re-evaluates and reopens if it now meets the bar.
- For either: a human maintainer can always reopen with a one-line comment. If you ping one and they agree the close was wrong, they'll override Agent Shin.

## If you disagree

Agent Shin uses an LLM, and LLMs aren't perfect. We've spot-checked it against 50+ recent contributions, but it will misjudge edge cases.

If you think Agent Shin got it wrong:

- **Comment `@agent-shin reconsider`** with a sentence explaining why. It re-runs the rubric on the current body and posts a fresh verdict.
- **Ping a maintainer.** A human can override the bot at any time.
- **File feedback** on the [Agent Shin tracking issue](https://github.com/BerriAI/litellm/issues) if you think the *rubric itself* is wrong: too strict, too lenient, or missing a category that should pass.

The goal of this system is to make external contributions faster to land, not harder. If Agent Shin is doing the opposite for you, we want to know.

## A note on what this isn't

Agent Shin doesn't decide whether your idea is good, whether the code is correct, or whether the PR will be merged. Those are humans-and-Greptile decisions and they happen after triage. All Agent Shin does is check that the PR or issue has enough context and evidence for a maintainer to act on it. If you've linked the issue, described the problem, and shown that your fix works against the real system, you've cleared the bar, and the rest of the review is up to the team.

Thanks for contributing to LiteLLM.
