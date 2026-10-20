---
sidebar_label: "Benchmark"
---

import Image from '@theme/IdealImage';

# Benchmark: flagging problems in agent traces

This benchmark uses decision models to find [LiteLLM Lens](../proxy/lens/index.md) signals in agent traces. Each model received the same 621 yes/no questions for 207 test traces. For each yes answer, the model also found the part of the trace that shows the problem

<Image
  img={require('../../img/decisions_lens_signals_benchmark.png')}
  dark={require('../../img/decisions_lens_signals_benchmark_dark.png')}
  alt="Lens Signals benchmark, share of 621 calls that agree with the label: GPT-6 Luna 99.4%, pplx-decider 99.2%, Rune 98.7%, Clef 97.9%, Jev 1.13 and Jev 1.14 97.1%, Clef Flash 93.7%, Decision-1 93.2%, Clef Omni 92.8%, OpenJev Qwen3.5 4B 90.2%. Self-hosted on CPU: Bespoke Nimble 9B 94.4%, Strands Decider 2B 84.1%, Laya Typed Decisions 74.6%, Laya English 57.0%, Laya Multilingual 42.7%"
/>

GPT-6 Luna, Perplexity, Fireworks Rune and Cloudflare Clef agree with the labels on 97.9% to 99.4% of the questions. Decision-1 agrees on 93.2%, but it finds the correct part for only 44% of its yes answers. Bespoke Nimble 9B gives the best self-hosted result, 94.4%
