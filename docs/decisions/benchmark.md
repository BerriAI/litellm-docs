---
title: "Decision model benchmarks"
description: "Every decision model that LiteLLM supports, tested as a guardrail, an Auto Router classifier and an LLM judge for Lens Signals, with accuracy, cost and latency."
sidebar_label: "Benchmarks"
---

import DecisionBenchmark from '@site/src/components/DecisionBenchmark';

# Decision model benchmarks

These benchmarks test every [decision model](../decisions.md) that LiteLLM supports on three jobs: as a guardrail, as an Auto Router classifier, and as an LLM judge for Lens Signals. Each model got the same requests through a LiteLLM proxy on `/v1/decisions` in October 2026. The self-hosted models ran on an 8-core CPU without a GPU, so their latency does not compare with the hosted models

The best model depends on the job. GPT-6 Luna is in the top group as a guardrail and as a Lens judge, but it sends 15 of 80 prompts to a cheaper tier in the Auto Router test. Decision-1 ties for second on routing but picks the right evidence for only 44% of Lens flags

## Guardrails

The guardrails test has 394 coding-agent tool calls, 195 dangerous and 199 safe. Each model answers the same yes/no question about a call, and the call is blocked when the probability is 0.5 or more. This is how the [Decision Model guardrail](../proxy/guardrails/decision_model.md) uses a decision model

<DecisionBenchmark id="guardrails" />

pplx-decider, Jev 1.14, Clef and GPT-6 Luna are within noise of each other at about 97%. Almost all errors are dangerous calls that the model lets through, and no hosted model blocks more than 3 safe calls. Clef Flash, Clef Omni and Bespoke Nimble 9B rank dangerous calls above safe ones well, with an AUROC of 0.94 to 0.96, but their scores sit below 0.5, so a lower threshold catches more of the dangerous calls. The gpt-oss-120b row is a chat model with the Claude Code auto-mode safeguards prompt, for comparison. The Laya models and Strands Decider 2B score no better than chance on these long tool-call inputs

## Auto Router classification

The routing test has 80 prompts with an authored tier, 20 each for `SIMPLE`, `MEDIUM`, `COMPLEX` and `REASONING`. Each model answers the same `choice` question that picks the tier, the way the [Auto Router decision classifier](../auto_router/decision_classifiers.md) does

<DecisionBenchmark id="autorouter" />

pplx-decider routes 78 of 80 prompts to the authored tier. With only 80 prompts, the top six models are within noise of each other, about 5 points either way. Most errors send a prompt to a cheaper tier than the authored one. Bespoke Nimble 9B is the best self-hosted model at 93.8% and never picks a pricier tier

## LLM as a judge (Lens Signals)

This benchmark uses decision models to find [LiteLLM Lens](../proxy/lens/index.md) signals in agent traces. Each model received the same 621 yes/no questions for 207 test traces, three per trace. For each question, the model also picked the part of the trace that shows the problem, or none

<DecisionBenchmark id="lens-signals" />

GPT-6 Luna, Perplexity, Fireworks Rune and Cloudflare Clef agree with the labels on 97.9% to 99.4% of the questions. Decision-1 agrees on 93.2%, but it picks the right part of the trace for only 44% of the questions whose label is yes. Bespoke Nimble 9B gives the best self-hosted result, 94.4%

The traces are short and synthetic, about six steps each, so real traffic is harder and the top scores sit close together. An OpenAI model wrote the traces, which can give OpenAI models a small advantage. A Claude model checked every label before the runs, and the 13 traces where it disagreed were left out

On the chart, "right evidence passage for X% of yes answers" is the share of the questions whose label is yes where the model picked a part of the trace that the label marks as evidence. That is 157 questions for every model but Strands Decider 2B, which answered 155 of them. The 621 questions come from 207 requests, one per trace, so the chart gives cost and p50 latency per trace. Cost is the `x-litellm-response-cost` header, and the self-hosted models ran on an 8-core CPU, so their latency does not compare with the hosted models

pplx-decider v1 and v1.1 gave the same scores and picks on every trace, so the chart shows them as one bar. Databricks `ai_decide` and OpenJev gave the same yes or no answer on every question, and the chart shows the OpenJev run. LiteLLM sends `null` for an evidence option that has no description, and Strands Decider 2B answers that with a 422, so its run gave each option a short description such as `excerpt L000`. It still could not fit 6 traces in its context window and returned a 500 on 3 more, so those 27 questions count as no answer

[Download the Lens Signals data and scripts](pathname:///benchmarks/litebench-lens-signals-20261016.tar.gz) to check these numbers.
