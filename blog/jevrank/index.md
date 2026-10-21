---
slug: jevrank
title: "JevRank: decision reranking in LiteLLM"
date: 2026-10-20T09:00:00-07:00
authors:
  - ishaan
description: "JevRank uses Perplexity and TypeSafe decision models to rerank documents through LiteLLM. Choose multiple-choice or per-document scoring."
tags: [engineering, reranking, decisions]
hide_table_of_contents: false
image: ./jevrank-comparison.png
draft: true
---

An external reference benchmark compared decision models with dedicated rerankers on 300 SciFact queries. Perplexity Decider Flash v1.2 and Cohere Rerank 4 Pro both scored **0.775 nDCG@10**. Its cost projections were **$73 versus $2,500 per million queries**, about **34× lower cost** for Flash on this workload. **LiteLLM reproduction is pending.**

We are building **JevRank**, decision reranking in LiteLLM. It supports Perplexity and TypeSafe models with two scoring strategies: one multiple-choice question across the candidate set, or one yes/no question per document. Each provider supplies its model's scores; JevRank adapts them to LiteLLM's existing rerank API.

For TypeSafe Jev's per-document method, the reference benchmark reports **0.776 nDCG@10 at $0.58 per 1,000 queries**, about **4.3× lower cost** than Cohere Pro. JevRank supports that method through LiteLLM's existing `/rerank` request format.

{/* truncate */}

:::caution Preview: LiteLLM reproduction pending

This preview requires [the JevRank implementation](https://github.com/BerriAI/litellm/pull/47782). We have not assigned a release version. All numbers below are external reference results from October 2026, with provider calls through OpenRouter. We will replace them with results from our own LiteLLM runs before publishing performance claims.

:::

## External reference results

![On 300 SciFact queries, Perplexity Decider Flash and Cohere Rerank 4 Pro both scored 0.775 nDCG at 10, with projected reranking costs of $73 and $2,500 per million queries. Jev scored 0.776 at about $580.](./jevrank-comparison.png)

The reference benchmark used BM25 to retrieve 20 candidates for each query, then gave those same candidates to each reranker. It used the full SciFact test split: 300 English queries over scientific abstracts. nDCG@10 measures the order of relevant documents in the first ten results; a higher score means a better ranking.

| System and method | nDCG@10 | Cost per 1,000 queries | Median latency per query |
| --- | ---: | ---: | ---: |
| Perplexity Decider v1.2, multiple choice | 0.777 | $0.15 | 0.71 s |
| Perplexity Decider Flash v1.2, multiple choice | 0.775 | $0.07 | 0.32 s |
| TypeSafe Jev 1.14, per-document decisions | 0.776 | $0.58 | 0.50 s |
| Cohere Rerank 4 Pro | 0.775 | $2.50 | 0.65 s |
| BM25 without reranking | 0.686 | No rerank call | Not reported |

*External reference benchmark, October 2026, Table 2. Costs and latency describe OpenRouter runs; LiteLLM reproduction is pending. Jev latency is the slowest of 20 parallel document requests for a query. The table rounds costs; the 34× comparison uses Table 8's $73 and $2,500 projections per million queries.*

These are close reference scores. The report's paired tests did not establish a quality difference between the Perplexity multiple-choice runs and Cohere Pro. It does not provide a paired confidence interval for Jev versus Cohere. The 0.001 gap does not establish a Jev quality advantage. Liquid D1 Ultra also scored 0.777, so Jev did not rank first overall.

![Reported SciFact ranking quality against provider cost for decision models and dedicated rerankers, including models with lower cost or higher scores than Jev.](./decision-rerank-cost-quality.png)

Download the [reference values from Table 2](./benchmark-summary.csv) and the [million-query cost projections](./projected-costs.csv) as CSV. The projection file names the source for each cost. These files contain aggregate reference values; our own raw per-query results are pending.

At one million queries with the same workload, the displayed rates project to about $580 for Jev and $2,500 for Cohere Pro. Production costs depend on document length, candidate count and provider pricing. This comparison covers reranking; it does not include retrieval or answer generation.

## Two methods, different request counts

For the Perplexity multiple-choice reference runs, all 20 candidates were placed in one input, with a question asking which passage was most relevant. Each option's probability became that passage's score. This uses one provider request per query. Those probabilities depend on the candidate set; you cannot combine scores from separate multiple-choice batches as if they share a scale.

In LiteLLM, choose `strategy: multiple_choice` for that request shape. The preview accepts 2 through 255 documents in one request and returns an error if the input exceeds the provider's context limit. It does not split the list into separate probability distributions or switch strategies on failure.

TypeSafe trains Jev to answer typed questions with probabilities. For each candidate, we put the query and document in the input and ask:

> Is the passage relevant to the query, meaning it contains information that answers, supports or contradicts it?

We use the probability of “yes” as `relevance_score`, sort the candidates from highest to lowest, and keep each document's original index. For tied scores, we preserve the input order. With 20 documents, this method makes 20 decision calls.

You can use the same rerank request fields as before: `query`, `documents`, `top_n` and `return_documents`. The model alias selects the provider and scoring method. You still need to evaluate score thresholds on your data; the response shape does not make scores interchangeable across providers.

## Configure JevRank

This configuration requires the preview implementation. Add a Perplexity multiple-choice preset and a TypeSafe Jev per-document preset:

```yaml keep-model-ids
model_list:
  - model_name: jevrank-flash
    litellm_params:
      model: perplexity/pplx-decider-flash-v1.2
      api_key: os.environ/PERPLEXITY_API_KEY
      rerank_mode: decisions
      decision_rerank:
        strategy: multiple_choice
        refusal_policy: error
    model_info:
      mode: rerank
  - model_name: jevrank
    litellm_params:
      model: typesafe/jev-1.14.0
      api_key: os.environ/TYPESAFE_API_KEY
      rerank_mode: decisions
      decision_rerank:
        strategy: pointwise
        max_concurrency: 8
        refusal_policy: error
    model_info:
      mode: rerank
```

Once you deploy that configuration, call the existing endpoint:

```bash
curl "$LITELLM_BASE_URL/rerank" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jevrank-flash",
    "query": "How long is the warranty?",
    "documents": [
      "Shipping takes three days.",
      "Warranty coverage lasts two years."
    ],
    "top_n": 1,
    "return_documents": true
  }'
```

Change the request's model alias to `jevrank` to use the TypeSafe per-document preset. TypeSafe and Perplexity supply the models; LiteLLM supplies the adapter. The [JevRank guide](/docs/decisions/rerank) covers SDK calls and configuration limits. Keep versioned model IDs during evaluation so a model update does not change your comparison.

## Bound the provider calls and preserve errors

For per-document scoring, we cap concurrent document calls with `max_concurrency`. That setting controls requests in flight for one rerank call; use your provider's account limits to size it. The reference Jev latency result used 20 parallel calls, so it does not predict latency with the example's limit of eight. Multiple choice uses one provider call.

A refusal or a missing score means the provider did not complete the judgment. The default policy returns an error instead of treating that document as irrelevant. A multiple-choice refusal fails the whole request, since it affects the distribution across the candidate set. Timeouts, rate limits and malformed responses remain visible to the caller. For synchronous calls, a timeout cancels queued work, but provider calls already in flight can finish and still incur charges. Account for those calls when setting retry and fallback policies.

The adapter keeps documents in the input, apart from the scoring instruction. That separation does not guarantee prompt-injection resistance. Include documents with embedded instructions in your evaluation and check that they do not change the ranking task.

## Evaluate the workload you intend to serve

Start with queries and relevance labels from your application. Keep the retrieved candidates fixed while you compare rerankers. Record nDCG or recall at the cutoff you use, total provider cost, latency and failed requests. Measure answer quality as a separate result if your application generates an answer from those documents.

The reference benchmark does not include a Jev multiple-choice run. Its 4.3× Jev comparison applies to the per-document method. The 34× Perplexity comparison applies to its multiple-choice run. A change in strategy needs a fresh evaluation.

Document length also needs a separate test. In the reference report's German long-document experiment, most runs restricted to the first 1,024 tokens performed worse than BM25 alone. That finding concerns truncation across other model configurations; it does not establish Jev's long-document quality. Keep the relevant content in the scoring input and reject requests that exceed the supported limits.

Use the [preview guide](/docs/decisions/rerank) to try the adapter after the implementation lands. Compare it with your current reranker on the same candidate sets before changing production traffic.

<!-- Publication gate: link the first supported release and replace all reference figures with verified LiteLLM measurements, run manifests and per-query results. Keep draft: true until the reproduction and implementation are ready. -->
