---
title: "JevRank"
sidebar_label: "JevRank"
description: "Use Perplexity or TypeSafe Jev through LiteLLM's rerank API. Choose multiple-choice or per-document scoring with explicit limits and failure handling."
---

# JevRank

**JevRank** uses Perplexity and TypeSafe decision models to score candidate documents through LiteLLM's [rerank API](../rerank.md). Choose one multiple-choice question across the candidate set or one yes/no relevance question per document. Each provider supplies its model's scores; JevRank adapts them to the rerank response format.

:::caution Preview

This guide describes [the pending JevRank implementation](https://github.com/BerriAI/litellm/pull/47782). No released LiteLLM version includes this adapter yet. The examples require a build that contains the implementation; they do not work with the existing decision endpoints alone.

:::

## Configure the proxy

Set `PERPLEXITY_API_KEY` or `TYPESAFE_API_KEY` in the proxy environment for the deployment you plan to use. Add one or both deployments to `config.yaml`:

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

`model_name` is the alias your client sends. You can choose another alias. `rerank_mode: decisions` opts this deployment into the adapter; ordinary rerank deployments keep their provider-specific behavior. Set `model_info.mode: rerank` for model selection and health routing.

Start the proxy with the configuration:

```bash
litellm --config config.yaml --port 4000
```

Send a rerank request using your LiteLLM key:

```bash
curl http://localhost:4000/rerank \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jevrank",
    "query": "How long is the warranty?",
    "documents": [
      "Shipping takes three days.",
      "Warranty coverage lasts two years."
    ],
    "top_n": 1,
    "return_documents": true
  }'
```

The response uses the rerank `results` array. Each result has its original document `index` and a numeric `relevance_score`. `return_documents: true` includes the document in each returned result. The provider computes scores for the supplied query and documents, so exact values vary.

The `jevrank` alias uses TypeSafe Jev with per-document scoring. Change `model` to `jevrank-flash` to use the Perplexity multiple-choice preset with the same query and documents.

## Use the Python SDK

Call `rerank` with the same opt-in settings:

```python keep-model-ids
import os

from litellm import rerank

response = rerank(
    model="typesafe/jev-1.14.0",
    api_key=os.environ["TYPESAFE_API_KEY"],
    rerank_mode="decisions",
    decision_rerank={
        "strategy": "pointwise",
        "max_concurrency": 8,
        "refusal_policy": "error",
    },
    query="How long is the warranty?",
    documents=[
        "Shipping takes three days.",
        "Warranty coverage lasts two years.",
    ],
    top_n=1,
    return_documents=True,
)

print(response.results)
```

Use `await litellm.arerank(...)` with the same arguments in an async application.

For Perplexity multiple-choice scoring, change the SDK model and configuration:

```python keep-model-ids
import os

from litellm import rerank

response = rerank(
    model="perplexity/pplx-decider-flash-v1.2",
    api_key=os.environ["PERPLEXITY_API_KEY"],
    rerank_mode="decisions",
    decision_rerank={"strategy": "multiple_choice", "refusal_policy": "error"},
    query="How long is the warranty?",
    documents=[
        "Shipping takes three days.",
        "Warranty coverage lasts two years.",
    ],
    top_n=1,
)

print(response.results)
```

## Scoring and document order

With `strategy: pointwise`, LiteLLM sends one decision request per document. The input contains the query and one document. The question asks whether the passage contains information that answers, supports or contradicts the query. LiteLLM uses the probability of “yes” as `relevance_score`.

With `strategy: multiple_choice`, LiteLLM sends the query and all documents in one input and asks which passage is most relevant. LiteLLM uses the normalized probabilities as relevance scores. It validates that the score vector contains one value per document, each value is finite and between zero and one, and the values sum to one within provider rounding precision.

LiteLLM sorts scores from highest to lowest and preserves input order for ties. Result indexes refer to the original request. `top_n` limits the returned results; it does not reduce the number of documents that need scoring.

A provider can assign different scores to the same document after a model update. Keep a versioned model during evaluation and retune thresholds before switching from a dedicated reranker. A score of 0.8 from Jev does not establish equivalence with a score of 0.8 from another provider.

Multiple-choice probabilities depend on the candidate set and sum to about one. Adding or removing a candidate can change the other scores. Use those scores to rank the supplied set, and evaluate any threshold on the candidate sets your application uses. LiteLLM does not split an oversized list into batches or combine probabilities from separate distributions.

## Configuration and limits

| Setting | Values | Purpose |
| --- | --- | --- |
| `rerank_mode` | `decisions` | Enable the decision adapter for this rerank deployment |
| `decision_rerank.strategy` | `pointwise` (default), `multiple_choice` | Select per-document yes/no scoring or one choice across the candidate set |
| `decision_rerank.max_concurrency` | `8` (default) | Bound provider requests in flight within one rerank call; accepts integers from 1 through 32 |
| `decision_rerank.refusal_policy` | `error` (default), `zero` | `zero` permits a refused document to receive zero in pointwise mode; multiple-choice mode requires `error` |
| `timeout` | LiteLLM's configured request timeout | A positive number of seconds for the whole rerank operation, including queued document calls |

Twenty candidate documents require twenty provider requests with pointwise scoring. Concurrency controls how many run at once; it does not change provider token limits or your account's request limit. Account for concurrent outer rerank calls when sizing capacity.

Successful responses report aggregate token usage in `meta.tokens.input_tokens` and `meta.tokens.output_tokens`. Pointwise usage sums the underlying decision responses; multiple-choice usage comes from its single response. LiteLLM records the available usage and cost once for the rerank operation. A timeout can leave provider work without a returned response, so provider billing can include usage absent from gateway accounting.

Multiple-choice scoring requires 2 through 255 documents and makes one provider call. `max_concurrency` applies to pointwise scoring. The adapter returns an error for an unsupported document count or a provider context overflow; it does not switch strategies or truncate the input.

The adapter does not shorten documents to fit a context window. TypeSafe's [model reference](https://docs.typesafe.ai/models) and Perplexity's [Decisions guide](https://docs.perplexity.ai/docs/decisions/quickstart) list current limits. Long-context options belong to the provider configuration; a larger context limit does not guarantee ranking quality on long documents.

Provide documents as strings or objects with a single `text` field, such as `{"text": "Warranty coverage lasts two years."}`. The adapter rejects extra document fields and `rank_fields`. It also rejects custom scoring instructions and document truncation or chunking options; the preview uses a fixed question for each strategy.

The `timeout` covers the full set of document calls. If the operation exceeds that deadline, LiteLLM cancels queued work and returns a timeout. In synchronous calls, provider requests already in flight can finish after the caller receives that error and can still incur charges. Set the deadline with the candidate count and concurrency limit in mind.

## Provider errors and refusals

Keep `refusal_policy: error` to treat a refused judgment as an incomplete rerank request. A refusal does not mean that the document is irrelevant. The adapter also returns errors for authentication failures, rate limits, timeouts and malformed provider responses.

If your application needs to continue after a refusal, set `refusal_policy: zero`. LiteLLM assigns zero to that refused document and records its original index in `meta.refused_document_indices`. Check that field before using a zero score to filter a document. This policy applies to explicit model refusals; it does not suppress transport or authentication failures.

The `zero` policy is available for pointwise scoring. Multiple-choice scoring produces one judgment across the candidate set, so a refusal fails the whole rerank request. LiteLLM rejects `refusal_policy: zero` with `strategy: multiple_choice`.

Use the gateway's [fallback configuration](../proxy/reliability.md) for failures you want to route to another deployment. Validate the final ranking and cost in your environment before adding this deployment to an existing fallback group.

## Benchmark results

Our local LiteLLM SDK run completed all 300 BEIR SciFact test queries with 20 fixed BM25 candidates per query. Every decision response identified the model as **jev-1.13.0**. Pointwise scoring reached **0.768 nDCG@10**, compared with **0.686** for the same BM25 candidates, at an estimated **$0.575 per 1,000 queries**. Median end-to-end latency was 0.50 s with eight concurrent document calls. The [run manifest](/benchmarks/jevrank/measured-run.json) and [per-query measurements](/benchmarks/jevrank/measured-per-query.csv) record the protocol, returned model version and cost source. The examples above use Jev 1.14, a different version that needs its own evaluation.

An external reference benchmark from October 2026 reports Jev 1.14 at 0.776 nDCG@10 and $0.58 per 1,000 queries, versus Cohere Rerank 4 Pro at 0.775 and $2.50. It used 300 SciFact queries, 20 BM25 candidates per query, and OpenRouter for the provider calls. Those reference measurements use a separate experiment; candidate identity, route and rates are not verified to match our run.

In that reference benchmark, Perplexity Decider Flash v1.2 using multiple choice scored 0.775. Its cost projections are $73 per million queries for that method versus $2,500 for Cohere Pro, about 34× lower cost on the reference workload. Perplexity and Cohere were unavailable for our run, so these remain reference values. The [launch draft](https://github.com/BerriAI/litellm-docs/pull/2522) separates measured and reference rows and explains their limits. Neither comparison establishes a quality advantage or a cost guarantee for another workload.

<!-- Publication gate: link the first supported release, verify the documented limits against the merged implementation, and preserve explicit measured/reference labels for benchmark claims. -->
