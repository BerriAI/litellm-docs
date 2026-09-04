# Auto Routing Benchmark: Cost Ladders

This benchmark evaluates how well LiteLLM routing strategies reduce cost while preserving response quality. It compares the semantic [Auto Router](./auto_routing_semantic.md), the rule-based `complexity_router`, fixed-model baselines, and a cost-matched shuffled control on a three-model Gemini 3.x cost ladder.

## Key findings

- The semantic Auto Router preserved more quality than the `complexity_router` at the same cost. At approximately 58% savings, the semantic router achieved a 46.8% win rate against the flagship and 82/90 exact-match answers. The fitted `complexity_router` achieved 41.5% and 71/90.
- The semantic router performed significantly better than the shuffled control. The `complexity_router` did not.
- The rule-based complexity score was not predictive of when the cheap model would produce an acceptable answer.
- The middle model in this ladder cost 14.1 times more than the cheap model while producing worse results. Model-tier selection was therefore as important as router selection.

## Benchmark design

### Evaluation dataset

The evaluation used 300 prompts across three categories:

| Category | Prompts | Source |
|---|---:|---|
| Chat | 120 | WildChat-1M |
| Verifiable reasoning | 90 | MATH-500 levels 4 and 5, plus MMLU-Pro |
| Code | 90 | BigCodeBench |

A separate 100-prompt training set was used for all configuration and threshold-fitting decisions. The training and evaluation prompts came from disjoint index ranges.

### Response generation and scoring

Each of the three models generated one response per evaluation prompt at temperature 0, producing a fixed 3 x 300 response matrix. Every routing strategy selected from this same matrix. This design pairs the strategies exactly and prevents generation sampling from affecting comparisons.

Quality was measured in two ways:

1. A model from a different provider family performed blinded, pairwise comparisons against the all-flagship baseline. Each pair was judged in both response orders, and conflicting judgments were recorded as ties.
2. The 90 verifiable reasoning prompts were scored with mechanical exact match, without an LLM judge.

The reported cost includes the selected model's input, output, and thinking tokens.

## Results

| Strategy | Win rate vs. flagship | 95% CI | Cost | Savings vs. flagship | Exact match |
|---|---:|---:|---:|---:|---:|
| All flagship (baseline) | 50.0% | | $9.320 | | 82/90 |
| Semantic Auto Router, threshold 0.3 | 48.2% | [45.8%, 50.5%] | $4.893 | 47.5% | 82/90 |
| Semantic Auto Router, threshold 0.2 | 46.8% | [44.0%, 49.5%] | $3.894 | 58.2% | 82/90 |
| All cheap | 43.7% | [40.0%, 47.5%] | $0.247 | 97.4% | 81/90 |
| `complexity_router`, fitted | 41.5% | [38.0%, 45.0%] | $3.889 | 58.3% | 71/90 |
| `complexity_router`, default | 39.8% | [36.0%, 43.7%] | $2.053 | 78.0% | 76/90 |
| Shuffled control | 39.2% | [35.7%, 42.7%] | $3.784 | 59.4% | 68/90 |

A 50% win rate means that a strategy was indistinguishable from the all-flagship baseline. Ties count as half a win.

### Comparison at matched cost

The clearest comparison is between the two strategies with approximately 58% savings:

| Strategy | Savings | Win rate vs. flagship | Exact match |
|---|---:|---:|---:|
| Semantic Auto Router, threshold 0.2 | 58.2% | 46.8% | 82/90 |
| `complexity_router`, fitted | 58.3% | 41.5% | 71/90 |

At effectively the same cost, the semantic router achieved a 5.3 percentage-point higher win rate and answered 11 more verifiable prompts correctly.

## Does the routing decision add value?

The shuffled control uses the fitted `complexity_router`'s exact tier counts but randomly assigns those tiers to prompts using a fixed seed. Its cost is therefore similar by construction. Comparing a router with this control tests whether the routing decisions add value beyond the overall mix of cheap and expensive models.

Compared with the shuffled control:

- The semantic router improved win rate by 9.0 points at threshold 0.3, with a 95% confidence interval of [+5.3, +12.7].
- The semantic router improved win rate by 7.7 points at threshold 0.2, with a 95% confidence interval of [+3.8, +11.5].
- The fitted `complexity_router` improved win rate by 2.3 points, with a 95% confidence interval of [-0.2, +4.8].
- The default `complexity_router` improved win rate by 0.7 points, with a 95% confidence interval of [-2.5, +3.8].

Both semantic-router confidence intervals exclude zero. Both `complexity_router` intervals include zero. On this evaluation, semantic routing added measurable value; rule-based complexity routing did not.

## Why the complexity score underperformed

The training prompts were labeled by comparing the flagship and cheap responses and identifying cases where the cheap response was worse. The complexity score was then evaluated as a predictor of those labels.

Its area under the ROC curve (AUC) was:

- 0.524 across the full training set, which is close to random.
- 0.420 on chat prompts, which indicates mildly inverted predictions.

Mean complexity scores were identical to three decimal places for prompts where the cheap model was sufficient and prompts where it was not. No tested threshold outperformed always predicting that the cheap model would be sufficient.

The default scoring weights emphasize features such as code and explicit reasoning markers. These features describe the type of prompt, but they did not predict whether the cheap model could answer it successfully. In this evaluation:

- 97% of chat prompts were assigned to the cheapest tier.
- 97% of code prompts were assigned to the middle tier.
- The cheap model was sufficient for 90% of verifiable reasoning prompts but only 50% of chat prompts.

These results apply to a same-family cost ladder, where every model can attempt every request and the routing decision is primarily whether the cheap model is sufficient. Routing across models with different capabilities is a separate use case.

## Validate the model tiers before tuning the router

The middle tier, `gemini-3-flash-preview`, appeared to offer a useful price and quality trade-off based on list prices. Its measured performance did not support that assumption:

| Metric | `gemini-3-flash-preview` | `gemini-3.1-flash-lite` |
|---|---:|---:|
| Relative cost | 14.1x the Flash-Lite cost | Baseline |
| Win rate vs. flagship | 37.5% | 43.7% |
| Exact match | 63/90 | 81/90 |

Among prompts where exactly one of these models answered correctly, Flash-Lite won 20 to 2. The middle tier did not provide a useful cost-quality trade-off on this dataset.

Thinking tokens explain much of the unexpected cost. `gemini-3-flash-preview` generated 981,308 thinking tokens, compared with 581,883 from the flagship. As a result, its 4x list-price output advantage produced only a 2.7x measured cost advantage. Flash-Lite generated no thinking tokens and cost 37 times less than the flagship, compared with the 8x difference suggested by list prices.

Both `complexity_router` configurations sent most prompts to the underperforming middle tier. Before tuning a router, measure each candidate model on representative traffic and include thinking-token charges in the cost calculation.

## Choosing a routing strategy

For a cost ladder within one model family:

1. Start with the semantic [Auto Router](./auto_routing_semantic.md).
2. Build routes from labeled examples that show when the cheap model is sufficient.
3. Fit `score_threshold` on a held-out training set that represents production traffic.
4. Select a threshold based on an explicit quality and savings target.

`score_threshold` controls when the router falls back to `auto_router_default_model`:

- At 0.3, the router sent 52% of prompts to the flagship, saved 47.5%, and achieved a 48.2% win rate.
- At 0.2, it sent 38% of prompts to the flagship, saved 58.2%, and achieved a 46.8% win rate.

The lower threshold increased savings by 10.7 percentage points and reduced win rate by 1.4 points. Neither setting met both a 45% win-rate floor and 50% savings target with 95% confidence: threshold 0.3 missed the savings target, while the lower bound for threshold 0.2's win rate was 44.0%.

Do not tune a threshold on the evaluation set. Doing so would overfit the reported result and would not provide a valid estimate of production performance.

## Limitations

This benchmark covers one provider family, one three-model ladder, one 300-prompt evaluation set, and one judge model. Additional limitations include:

- The judge disagreed with itself on 32% of pairs when response order was reversed. These disagreements were recorded as ties, which moves results toward 50%.
- Judge decisions agreed with mechanical ground truth 90% of the time on the verifiable subset.
- Code responses were judged but not executed.
- The results measure this specific model ladder and dataset. Other models and production workloads may produce different cost-quality trade-offs.

Use the methodology, rather than the exact percentages, when evaluating another deployment: generate one paired response matrix, reserve a separate training set, include a cost-matched shuffled control, count thinking tokens, and define quality and savings requirements before evaluating the routers.
