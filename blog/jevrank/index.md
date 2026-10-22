---
slug: jevrank
title: "JevRank: decision models through LiteLLM’s rerank API"
date: 2026-10-20T09:00:00-07:00
authors:
  - ishaan
description: "Preview JevRank for low-cost reranking with Perplexity and TypeSafe decision models. Explore SciFact results, reproducible data and LiteLLM setup."
tags: [engineering, reranking, decisions]
hide_table_of_contents: true
custom_hero: true
image: /img/jevrank/launch-benchmark.png
---

import JevRankLaunch from './JevRankLaunch';

<JevRankLaunch />

<div data-blog-summary hidden>

When you search a large set of documents, a fast first pass, often plain keyword search, finds likely matches. A reranker then reorders those matches so the most relevant ones come first. Rerankers are usually dedicated models that you pay for on every search.

Jakob Gruber at Swietelsky AG tested a different idea. A decision model is a model that answers a question with a probability. If you ask one “is this passage relevant to the query?” for each match and sort by its answers, you get a ranking. JevRank brings this to LiteLLM’s standard `/rerank` endpoint: you send a query and a list of documents, and you get relevance scores back, the same as with any other reranker.

On SciFact, a public benchmark that pairs scientific claims with research papers, Gruber found that Perplexity’s Decider Flash ranked results as well as Cohere Rerank 4 Pro. Both scored 0.775 on nDCG@10, a standard 0 to 1 measure of ranking quality, but Decider Flash cost about 1/34 as much: $73 instead of $2,500 per million searches. We then ran TypeSafe’s Jev model through LiteLLM on the same benchmark. Starting from keyword search results, it raised the score from 0.686 to 0.768 and put a relevant paper first for 68% of searches instead of 55%. It did this for about $0.58 per 1,000 searches, with a median latency of half a second.

These results come from one dataset, and JevRank is still a preview. The full post shows how we ran both tests, the raw data, and how to try JevRank yourself.

</div>

{/* truncate */}
