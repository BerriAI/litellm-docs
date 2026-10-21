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

JevRank uses decision models to rerank documents through LiteLLM. In our 300-query SciFact run, **Jev 1.13 scored 0.768 nDCG@10**, up from **0.686 for BM25** on the same candidates. Reranking cost an estimated **$0.575 per 1,000 queries**, with **0.50 s median latency**.

The preview supports Perplexity and TypeSafe models with two scoring strategies: one multiple-choice question across the candidate set, or one yes/no question per document. Each provider supplies its model's scores; JevRank adapts them to LiteLLM's existing rerank API.

An external reference benchmark points to a cheaper multiple-choice option: Perplexity Decider Flash v1.2 and Cohere Rerank 4 Pro both scored **0.775 nDCG@10**, with projected costs of **$73 versus $2,500 per million queries**, about **34× lower cost** for Flash. We could not access those models for our run, so that comparison remains labeled as reference.

{/* truncate */}

:::caution Preview

This preview requires [the JevRank implementation](https://github.com/BerriAI/litellm/pull/47782). We have not assigned a release version. The Jev 1.13 and BM25 results below come from our own run. Other rows are external reference results from October 2026, with provider calls through OpenRouter. Costs from our run are estimates from returned tokens at configured gateway rates.

:::

## Measured and reference results

![SciFact ranking quality and cost, with LiteLLM's measured Jev 1.13 result separated from external reference results for other models.](./jevrank-comparison.png)

Both experiments use the full BEIR SciFact test split: 300 English queries over scientific abstracts, with 20 BM25 candidates per query. Each experiment holds its candidates fixed. The reference does not specify every retrieval setting, so we have not verified that its candidates match ours. nDCG@10 measures the order of relevant documents in the first ten results; a higher score means a better ranking.

| System and method | Origin | nDCG@10 | Cost per 1,000 queries | Median latency per query |
| --- | --- | ---: | ---: | ---: |
| TypeSafe Jev 1.13, per-document decisions | LiteLLM run | 0.768 | $0.575 estimated | 0.50 s |
| BM25 without reranking | Local baseline | 0.686 | No rerank call | Not measured |
| Perplexity Decider v1.2, multiple choice | Reference | 0.777 | $0.15 | 0.71 s |
| Perplexity Decider Flash v1.2, multiple choice | Reference | 0.775 | $0.07 | 0.32 s |
| TypeSafe Jev 1.14, per-document decisions | Reference | 0.776 | $0.58 | 0.50 s |
| Cohere Rerank 4 Pro | Reference | 0.775 | $2.50 | 0.65 s |

*Reference rows use Table 2 of the external benchmark. Its Jev latency is the slowest of 20 parallel document requests; our run uses eight concurrent document calls. Routes, rates, versions and retrieval settings can differ. The 34× reference comparison uses Table 8's $73 and $2,500 projections per million queries.*

## Our LiteLLM run

We ran the local SDK from [commit 5aa0a8304c](https://github.com/BerriAI/litellm/commit/5aa0a8304c) through a gateway's Decisions transport. All **300 queries and 6,000 document judgments completed**, and every response identified the model as **jev-1.13.0**. The gateway alias was `typesafe/jev-latest`; the runner required that concrete returned version rather than assuming the alias meant 1.14.

Our retrieval used BM25s 0.3.13, Lucene BM25 with k1=1.5 and b=0.75, English stop words and Snowball stemming. Documents contained the title and full abstract. The run used fixed top-20 candidates, pointwise scoring, a concurrency limit of eight and no automatic client retries. Jev reached 0.680 hit@1 and 0.803 hit@3; end-to-end p95 latency was 1.15 s.

Returned token usage implies **$0.172618 for the full run**, or **$0.575394 per 1,000 queries**, at the configured rate of $0.042 per million input tokens and zero output-token charge. This is a rate-based estimate, not an invoice. Provider pricing, model version and document length affect production costs.

Download the [run manifest](/benchmarks/jevrank/measured-run.json), [all 300 per-query measurements](/benchmarks/jevrank/measured-per-query.csv), and [normalized provider responses](/benchmarks/jevrank/measured-responses.jsonl.gz). The [runner](/benchmarks/jevrank/scifact_benchmark.py), [pinned preparation dependencies](/benchmarks/jevrank/requirements.lock.txt) and [reproduction instructions](/benchmarks/jevrank/README.md) let you reconstruct the candidate protocol and run another evaluation. A separate [audit](/benchmarks/jevrank/independent-audit.json) recomputed the scores and estimated cost from the saved responses and relevance labels.

## What the reference adds

These are close reference scores. The report's paired tests did not establish a quality difference between the Perplexity multiple-choice runs and Cohere Pro. It does not provide a paired confidence interval for Jev versus Cohere. The 0.001 gap does not establish a Jev quality advantage. Liquid D1 Ultra also scored 0.777, so Jev did not rank first overall.

![SciFact quality against cost, with the measured Jev 1.13 point and BM25 baseline labeled separately from reference models.](./decision-rerank-cost-quality.png)

Download the values behind the [comparison chart](./jevrank-comparison.csv) and [cost-quality chart](./decision-rerank-cost-quality.csv), including each row's origin and cost source.

Download the [reference values from Table 2](./benchmark-summary.csv) and the [reference million-query cost projections](./projected-costs.csv) as CSV. Each file labels its measurement origin. The reference Jev 1.14 score of 0.776 is a different model version and experiment from our Jev 1.13 score of 0.768.

At one million queries with the reference workload, its rates project to about $580 for Jev 1.14 and $2,500 for Cohere Pro, about 4.3× lower cost. This reference comparison covers reranking; it does not include retrieval or answer generation.

## Two methods, different request counts

For the Perplexity multiple-choice reference runs, all 20 candidates were placed in one input, with a question asking which passage was most relevant. Each option's probability became that passage's score. This uses one provider request per query. Those probabilities depend on the candidate set; you cannot combine scores from separate multiple-choice batches as if they share a scale.

In LiteLLM, choose `strategy: multiple_choice` for that request shape. The preview accepts 2 through 255 documents in one request and returns an error if the input exceeds the provider's context limit. It does not split the list into separate probability distributions or switch strategies on failure.

TypeSafe trains Jev to answer typed questions with probabilities. For each candidate, we put the query and document in the input and ask:

> Is the passage relevant to the query, meaning it contains information that answers, supports or contradicts it?

We use the probability of “yes” as `relevance_score`, sort the candidates from highest to lowest, and keep each document's original index. For tied scores, we preserve the input order. With 20 documents, this method makes 20 decision calls.

You can use the same rerank request fields as before: `query`, `documents`, `top_n` and `return_documents`. The model alias selects the provider and scoring method. You still need to evaluate score thresholds on your data; the response shape does not make scores interchangeable across providers.

## Configure JevRank

This configuration requires the preview implementation. Add a Perplexity multiple-choice preset and a TypeSafe Jev per-document preset. The example pins Jev 1.14; our measured gateway run returned Jev 1.13, so evaluate the version you deploy:

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

<!-- Publication gate: link the first supported release, verify implementation availability, and keep measured/reference origins explicit. Attach manifests and per-query results for measured claims. Keep draft: true until the launch is ready. -->
