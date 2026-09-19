---
slug: jev-auto-router-benchmark
title: "JEV Classifier: 5.43x as Fast as Haiku, 96% Lower Cost"
date: 2026-09-18T22:30:00
authors:
  - moe
description: "JEV classified requests 5.43x as fast as Haiku by median latency in our AI Gateway benchmark. Explore the setup, cost savings and methodology."
tags: [routing, complexity-router, engineering, ai-gateway]
hide_table_of_contents: true
---

*Last Updated: September 18, 2026*

An Auto Router pays for classification before the selected model can answer. In our benchmark, TypeSafe JEV classified requests **5.43x as fast as Haiku**, comparing median classifier latency: **126.81 ms versus 688.40 ms**. Registry-priced classifier cost was **96.12% lower**, rounded to 96% in the title. Across 80 frozen, authored synthetic cases, JEV matched 95.00% of the tier labels versus 73.75% for Haiku. These measurements cover classification on this corpus, so answer quality and total application savings still need a separate evaluation

{/* truncate */}

## The AI Gateway has to pay for the routing decision

Classifying a greeting and a complex debugging request lets you send each to a different model. A general-purpose LLM can make that decision, but its network round trip, input tokens and structured output add latency and cost before the completion begins

We compared the existing LLM classifier path with `classifier_type: jev`, using the same authored tier rubric and opening instructions. JEV uses TypeSafe System One Choice evaluation. It returns a tier choice with confidence and probabilities, and the existing Auto Router selects a model from that tier. Tier pools, fallback and the completion path stay in the same router

The question we measured was narrow: how quickly and cheaply can each classifier reproduce the labels we assigned to these prompts? We did not grade generated answers or establish general LLM-quality equivalence

## What we measured

The benchmark ran on **September 18, 2026 UTC**, with `jev-latest` first resolved to **`jev-1.13.0`** and then pinned. The comparison model was **`anthropic/claude-haiku-4-5-20251001`**. Each classified the same 80 cases three times, giving 240 measured calls per classifier

| Metric | JEV | Haiku |
| --- | ---: | ---: |
| Authored-label accuracy | 228/240, 95.00% | 177/240, 73.75% |
| Mean classifier latency | 138.38 ms | 720.71 ms |
| p50 classifier latency | 126.81 ms | 688.40 ms |
| p95 classifier latency | 231.16 ms | 896.94 ms |
| Maximum measured latency | 401.26 ms | 1,914.98 ms |
| Registry-priced cost for 240 calls | $0.007706664 | $0.198534 |
| HTTP 200 responses | 240/240 | 240/240 |
| Provider errors / timeouts / fallback decisions | 0 / 0 / 0 | 0 / 0 / 0 |

All measured attempts succeeded, so all-attempt and successful-call latency statistics are identical. Calls with an incorrect tier remain in both latency and cost totals

### How we calculate 5.43x as fast

The title compares the **median of all 240 JEV calls with the median of all 240 Haiku calls**. Using unrounded measurements:

```text
p50 speed ratio = Haiku_p50 / JEV_p50
                = 688.395634 ms / 126.814470 ms
                = 5.43x
```

This is a ratio of aggregate statistics, not an average of per-request ratios. The same calculation gives **3.88x as fast at p95** (231.16 ms versus 896.94 ms) and **5.21x as fast by mean latency** (138.38 ms versus 720.71 ms). These ratios measure classification time, not end-to-end completion speed or throughput under load

| Comparison | Estimate | 95% clustered-bootstrap interval |
| --- | ---: | --- |
| p50 speed ratio | 5.43x | 5.20x to 5.71x |
| p95 speed ratio | 3.88x | 2.94x to 4.78x |
| Registry-priced classifier cost savings | 96.118% | 95.973% to 96.266% |
| Paired authored-label accuracy difference | 21.25 percentage points | 12.92 to 30.42 points |

### Accuracy and agreement answer different questions

Accuracy here means exact match with a frozen, authored label. JEV's 95% interval was **90.00% to 98.75%**, and Haiku's was **64.16% to 82.92%**. Labels and prompts came from the same author, without independent annotation or blind adjudication

The classifiers agreed with each other on **189/240 calls, or 78.75%**, with an interval of **69.58% to 87.08%**. Agreement ignores whether either classifier matched the authored label

| Authored tier, 20 cases and 60 calls each | JEV accuracy [95% interval] | Haiku accuracy [95% interval] | Agreement |
| --- | --- | --- | ---: |
| SIMPLE | 60/60, 100% [100%, 100%] | 60/60, 100% [100%, 100%] | 100% |
| MEDIUM | 51/60, 85% [70%, 100%] | 23/60, 38.33% [18.33%, 60%] | 53.33% |
| COMPLEX | 57/60, 95% [85%, 100%] | 48/60, 80% [60%, 95%] | 85% |
| REASONING | 60/60, 100% [100%, 100%] | 46/60, 76.67% [58.33%, 93.33%] | 76.67% |

An empirical interval of 100% to 100% means every case in that sampled subset matched. It does not establish perfect accuracy on unseen prompts. There are **80 independent case clusters**, with correlated repeats

JEV consistently assigned four cases to a lower tier than the authored label: M07, M13 and M15 went from MEDIUM to SIMPLE, and C10 went from COMPLEX to MEDIUM. Haiku's errors also assigned lower tiers: 37 MEDIUM observations became SIMPLE, 12 COMPLEX became MEDIUM, and 14 REASONING became COMPLEX. The largest difference is on the subjective MEDIUM boundary

| Subset | Cases / calls per classifier | JEV accuracy | Haiku accuracy | Agreement |
| --- | --- | ---: | ---: | ---: |
| Short | 40 / 120 | 97.50% | 73.33% | 75.83% |
| Long | 16 / 48 | 87.50% | 62.50% | 75.00% |
| Follow-up | 8 / 24 | 100% | 87.50% | 87.50% |
| Tool context | 8 / 24 | 100% | 83.33% | 83.33% |
| Ambiguous boundary | 8 / 24 | 87.50% | 75.00% | 87.50% |

The boundary subset's accuracy difference was 12.50 points with a **0 to 37.50 point interval**, which includes zero. JEV's long-case accuracy was lower than its short-case accuracy. Both findings matter when choosing prompts for your own evaluation

### Per-tier latency

| Authored tier | JEV p50 | Haiku p50 | JEV p95 | Haiku p95 |
| --- | ---: | ---: | ---: | ---: |
| SIMPLE | 127.78 ms | 678.22 ms | 243.44 ms | 897.53 ms |
| MEDIUM | 128.15 ms | 690.80 ms | 215.59 ms | 844.70 ms |
| COMPLEX | 126.89 ms | 694.19 ms | 198.34 ms | 874.73 ms |
| REASONING | 120.78 ms | 696.01 ms | 231.68 ms | 1,001.60 ms |

Full per-tier and per-repeat latency, cost, confidence intervals, confusion matrices and mismatches are in the downloadable `metrics.json`

## Cost savings stop at the classifier boundary

The cost comparison uses observed tokens multiplied by the archived LiteLLM registry prices. It is **classifier cost**, excluding the completion model, embeddings, warmups and evaluation judges

| Measured usage and registry rates | JEV | Haiku |
| --- | ---: | ---: |
| Input tokens | 183,492 | 186,519 |
| Output tokens | 12,897 | 2,403 |
| Input price per million tokens | $0.042 | $1 |
| Output price per million tokens | $0 | $5 |
| Mean cost per classification | $0.0000321111 | $0.000827225 |

The resulting saving is `100 * (1 - 0.007706664 / 0.198534) = 96.118%`. Every measured response was independently repriced against the archived registry and matched the classifier's reported cost. Prices are the registry values captured for this run. Provider invoices, taxes, discounts and plan entitlements were not checked

The corrected run's excluded resolution and warmup calls cost $0.002478554 at those prices. An earlier setup resolution call is retained separately. They are overhead outside the 240-call comparison

## Configure JEV in the existing Auto Router

Provision `TYPESAFE_API_KEY` in the proxy's server environment. `TYPESAFE_API_BASE` is optional and defaults to `https://api.typesafe.ai`. Keep provider credentials on the server, and let clients call the router with a LiteLLM virtual key

Add this entry beside the existing tier deployments in `model_list`, replacing the tier values with your deployed model names:

```yaml title="config.yaml"
- model_name: jev-router
  litellm_params:
    model: auto_router/complexity_router
    complexity_router_default_model: {{openai_large}}
    complexity_router_config:
      tiers:
        SIMPLE: {{openai_small}}
        MEDIUM: {{openai_large}}
        COMPLEX: {{anthropic}}
        REASONING: {{anthropic_large}}
      classifier_type: jev
      jev_classifier_config:
        model: jev-latest
        timeout_ms: 3000
        circuit_breaker_enabled: true
        circuit_breaker_cooldown_seconds: 30
      classifier_fallback: default_model
      classifier_context_window_size: 3
      classifier_context_budget_chars: 8000
      classifier_context_include_assistant_turns: false
```

This deployment example uses built-in tier criteria, a three-second deadline and a circuit breaker. It explicitly chooses default-model fallback. The benchmark used a shared custom rubric, a ten-second deadline, assistant context and disabled breakers to compare every measured attempt

In the dashboard, create or edit an Auto Router under **Models + Endpoints**, then select **JEV Classifier** under **Classification Method**. The form exposes model, timeout, circuit breaker, context and fallback settings. Custom **JEV Instructions** replace the built-in instructions and follow the Enterprise custom-classifier policy. [The setup guide](/docs/auto_router/setup#jev-classifier-typesafe-ai) covers the full create, test and edit flow

JEV receives the current ask and classifier context in a System One `state`, with one `questions.tier` Choice question. Built-in tiers use shipped criteria. With `tier_definitions`, the custom descriptions become the Choice criteria. The classifier context budget bounds prior-turn text, while the current ask and extracted system text sit outside it

## Failure handling in a production-grade AI Gateway

A reliable AI Gateway needs a defined route when its classifier cannot answer. JEV uses the existing fallback on a timeout, HTTP failure, malformed response, unknown tier or open circuit. Built-in tiers default to heuristic fallback. Setting `classifier_fallback: default_model` uses the configured default, while custom tiers can choose a `fallback_tier`

To keep routing resilient to classifier timeouts, the enabled circuit breaker skips JEV calls during the 30-second default cooldown after a recognized timeout. One request then probes recovery. Success closes it, and failure starts another cooldown. The state is local to a router instance in one process, so it does not coordinate provider load across workers. Non-timeout errors while closed fall back without opening the circuit

The supplied live gateway evidence used a real local proxy, PostgreSQL and provider calls. A normal completion and Test Routing succeeded. A separate 1 ms deadline configuration produced a successful completion with `default_model_fallback` recorded. The logs did not retain the exception subtype, and no JEV usage returned for that cancellation, so receipt or billing by the provider remains unverified

All downstream tier aliases in this gateway check used the same Haiku model. That demonstrates tier selection and execution, without measuring quality or savings from different completion models. Streaming, tool-call completions, custom tier names, all authorization roles and multi-worker accounting are outside this proof

### Test Routing can spend money

Test Routing stops after classification and does not send a completion to the selected model. A JEV classification can still incur a charge. Test Connection additionally probes model dependencies and checks that the JEV result actually came from JEV rather than fallback

In the supplied gateway check, Test Routing persisted one classifier row costing **$0.000018186**. The normal completion persisted a **$0.000018060** classifier row and a **$0.000064000** downstream row. The completion's routing metadata carried the classifier cost for attribution, but its spend stayed separate

For accounting, sum the stored row spends once. Adding `routing_decision.classifier_cost` again would double count the classifier. Successful JEV decisions include the resolved classifier model, probabilities, confidence and registry-priced cost where available. Missing usage or pricing leaves cost unknown. A usable HTTP response can be logged even when its choice later fails validation, so inspect classifier spend rows when reconciling fallback traffic

JEV participates in dependency authorization as `typesafe/<configured model>` with the `evaluation` role. Restricted callers need access to the dependencies they invoke. Team-member management requests cannot override the provider key or base URL. See the [configuration reference](/docs/proxy/auto_routing#jev-classifier) for the exact settings and accounting behavior

## Methodology and reproduction

The corpus and protocol were frozen at **22:18:53 UTC**, before provider calls. Measured calls ran from approximately **22:21:05 to 22:24:32 UTC**. There were 20 cases in each tier, with 40 short cases, 16 long cases, eight follow-ups, eight tool-context cases and eight boundary cases. Each has an authored rationale

Both production classifier paths received the same authored rubric and opening instructions. SIMPLE covers lookup and mechanical work, MEDIUM routine drafting and localized code, COMPLEX coupled technical work, and REASONING explicit proofs, justified optimization and decisions with conflicting objectives. Their wire formats differ: the LLM path retains its trust boundary and structured-output wrapper, while JEV uses a Choice question. Neither prompt was independently tuned

| Setting | Value |
| --- | --- |
| Repeats and ordering | Three repeats, seeded shuffle per repeat, alternating JEV-first and Haiku-first across pairs |
| Seed | `20260918` |
| Concurrency | `1` |
| Deadline | `10000` ms for both classifiers |
| Retries / circuit breakers | Zero retries / disabled |
| Fallback tier | REASONING |
| Context | Three turns, 8,000 total characters, 4,000 per turn, assistant turns included |
| Excluded setup | One model-resolution call and four warmup pairs in the corrected run |
| Sampling settings | Existing classifier defaults |
| Caching | LiteLLM response caching disabled, no provider prompt-cache directives |
| Timing | Wall clock around production `ComplexityRouter.aclassify` |
| Uncertainty | 10,000 percentile-bootstrap resamples of whole cases, preserving both classifiers and all repeats |

A symmetric loopback HTTP relay forwarded real provider requests and retained sanitized request/response bodies without authorization headers. Timings include local relay, client, network and provider work. Haiku reported zero cache-read and cache-creation tokens. JEV did not expose cache usage, and provider-internal caching is unknown. Client and provider regions are also unknown

Quantiles use linear interpolation. The bootstrap resamples cases, keeping repeated observations together, rather than treating 240 calls as independent prompts. These intervals describe this corpus and run. They do not cover author bias, another region, sustained load, rate limits, cold starts or another account

[Download the frozen raw results and reproduction scripts](/benchmarks/jev-live-evidence-20260918.tar.gz). The archive contains `cases.jsonl`, `protocol.json`, `attempts.jsonl`, sanitized `wire.jsonl`, `metrics.json`, the captured registry, environment versions, gateway evidence, setup failures and a hash manifest

```bash
curl -fL https://docs.litellm.ai/benchmarks/jev-live-evidence-20260918.tar.gz \
  -o jev-live-evidence-20260918.tar.gz
echo "c2653861ab4cf591e902d4d62d55078187e4c66ad5845b5cf5b023d5f427fd7f  jev-live-evidence-20260918.tar.gz" | sha256sum -c -
tar -xzf jev-live-evidence-20260918.tar.gz
cd jev-benchmark
sha256sum -c SHA256SUMS
python analyze.py
```

Offline analysis needs Python and Pydantic as listed in the archive's environment record. Its README gives the locked-repository setup and commands for fresh paid provider calls. Use a fresh run directory because the runner refuses to overwrite historical attempts. A future `jev-latest` resolution may produce a different model, requiring a new experiment and an explicit pricing-analysis update

The measured tree was `9dce43d6a0562a4926c39b1bacf7e9a1feac1170`, reconstructed from base `1d91fc232d20a434a86323506a1303935b9c684f`, budget change `b9e5bb3abb0f2f0ddc06dcaf9edb63563cac2a2a` first, and integration `8e5f43f45897fc72612aac53a690fa573ce029cd` second. This identifies the tested combination without implying a released version

| Frozen artifact | SHA256 |
| --- | --- |
| Corpus | `dc85aa66fcab982a2af812a46c6bcd17e0e2a764c2e0c921fb811ce0ce4f31ce` |
| Protocol | `27d564fa022d29d8d9dd9c1a905fbf9a92695a138271f59d1174e7b7c49c4927` |
| Registry | `529638485889e5499ddb631f05a7fa58c7aaa25ebddfea8b5152d6eca77b1d2b` |

The first harness configuration combined incompatible custom-prompt fields and stopped before measured calls. Two earlier gateway configurations also used invalid or misplaced fallback settings. Their evidence is retained separately, including the first run's implicitly selected MEDIUM default. No measured case was removed or relabeled after calls began

## Key Takeaways

- JEV classified requests 5.43x as fast as Haiku by median latency, and 3.88x as fast at p95, on these 80 authored cases
- Authored-label accuracy was 95.00% versus 73.75%, with 78.75% agreement between classifiers. Downstream answer quality was not measured
- Registry-priced classifier cost was 96.118% lower. Total application cost and provider invoices need separate measurement
- JEV uses the existing Auto Router's context, tier pools and fallback, with a process-local timeout breaker and separate classifier spend logging
- Evaluate your own prompts and completion quality before changing a production routing policy

## Frequently Asked Questions

### Does this establish LLM-quality classification?

It establishes higher agreement with our authored labels than this Haiku configuration on this corpus. The labels were not independently reviewed, and repeated calls do not create new independent cases. Use [shadow evaluation](/docs/auto_router/evaluate) to measure downstream answers on your traffic

### What does 5.43x as fast mean?

Haiku's median classification time divided by JEV's was 5.43: 688.40 ms versus 126.81 ms. The title describes that measured classification speed ratio. It does not measure end-to-end completion speed or throughput under load

### What happens if TypeSafe is unavailable?

The configured fallback picks the next routing path, and recognized classification timeouts open the local circuit breaker. The chosen completion provider must still succeed. Cancellation does not establish that an upstream request was unbilled

### Is JEV available in LiteLLM OSS or Enterprise?

Built-in JEV classification is available without an Enterprise license under the same policy as the built-in LLM classifier. Custom JEV instructions and custom tier definitions use the existing Enterprise custom-classifier capability. TypeSafe provider charges are separate from LiteLLM licensing

## Conclusion

JEV classified requests 5.43x as fast as Haiku by median latency in this comparison, with lower registry-priced cost and higher accuracy against the authored labels. For Enterprise AI Gateway deployments and OSS deployments alike, the next step is to test real prompts, score the resulting answers and include fallback traffic in spend accounting. Start with the [JEV setup guide](/docs/auto_router/setup#jev-classifier-typesafe-ai) and [evaluate on your traffic](/docs/auto_router/evaluate)

## Recommended Reading

- [JEV Auto Router setup](https://docs.litellm.ai/docs/auto_router/setup#jev-classifier-typesafe-ai)
- [Auto Router configuration reference](https://docs.litellm.ai/docs/proxy/auto_routing#jev-classifier)
- [TypeSafe System One pass-through](https://docs.litellm.ai/docs/pass_through/typesafe)
