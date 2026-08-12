# Auto Routing Benchmark: Cost Ladders

Auto routing is usually sold on a single promise: send easy requests to a cheap model, keep quality, cut the bill. This page reports what that promise measured out to on one concrete setup, a three-rung Gemini 3.x ladder, so you can calibrate what to expect and which strategy to reach for

The short version is that routing by intent carried real signal, routing by rule-based complexity score did not, and the middle rung of the ladder was worse than the rung fourteen times cheaper than it

## What was measured

300 test prompts across three strata: 120 real chat turns from WildChat-1M, 90 verifiable problems from MATH-500 levels 4 and 5 plus MMLU-Pro, and 90 code tasks from BigCodeBench. A separate 100-prompt train slice, drawn from disjoint index ranges, was used for every fitting decision so no evaluation prompt ever informed a router's configuration

Three rungs were generated once per prompt at temperature 0, giving a 3 x 300 response matrix. Every arm is a selection over that one matrix, so arms are exactly paired and no sampling noise separates them. Quality is blinded pairwise preference against the all-flagship arm, judged by a model from a different family, with every pair judged in both orders and disagreements resolved as ties. The 90 verifiable prompts also carry mechanical exact-match scoring with no model in the loop

## Results

| Arm | Win-rate vs flagship | 95% CI | Cost | Saving | Exact match |
|---|---|---|---|---|---|
| All-flagship (baseline) | 50.0% | | $9.320 | | 82/90 |
| `auto_router`, threshold 0.3 | 48.2% | [45.8%, 50.5%] | $4.893 | 47.5% | 82/90 |
| `auto_router`, threshold 0.2 | 46.8% | [44.0%, 49.5%] | $3.894 | 58.2% | 82/90 |
| All-cheap | 43.7% | [40.0%, 47.5%] | $0.247 | 97.4% | 81/90 |
| `complexity_router`, fitted | 41.5% | [38.0%, 45.0%] | $3.889 | 58.3% | 71/90 |
| `complexity_router`, stock | 39.8% | [36.0%, 43.7%] | $2.053 | 78.0% | 76/90 |
| Shuffled control | 39.2% | [35.7%, 42.7%] | $3.784 | 59.4% | 68/90 |

A win-rate of 50% means indistinguishable from the flagship; ties count as half

The cleanest comparison is the pair at matched cost. At 58.2% savings the semantic router scored 46.8%; at 58.3% savings the complexity router scored 41.5%. Same spend, five points of quality apart, and an eleven point gap on mechanically scored answers

## The control arm

The shuffled control takes the complexity router's exact tier assignments and permutes them across prompts with a fixed seed, so it costs the same by construction and differs only in whether the routing decision was informed. It is the arm that tells you whether a router is thinking or whether its tier mix is doing the work

The semantic router beat it by 9.0 points [+5.3, +12.7] at threshold 0.3 and 7.7 points [+3.8, +11.5] at threshold 0.2. The complexity router beat it by 2.3 points [-0.2, +4.8] when fitted and 0.7 points [-2.5, +3.8] as shipped. Both complexity intervals span zero

Any router benchmark without a control like this cannot separate a smart router from a cheap tier mix, and will read as a success either way

## Why the complexity score did not separate

Each train prompt was labelled by running flagship and cheap head to head and asking whether the cheap answer was worse. Against those labels, the complexity score's AUC was 0.524 pooled and 0.420 on the chat stratum, where below 0.5 means mildly inverted. Mean scores were identical to three decimals between prompts where the cheap model sufficed and prompts where it did not. No threshold beat always guessing "cheap"

The cause is structural rather than a tuning failure. The default weights lean hardest on code presence and reasoning markers, so the scorer keys on what a prompt is about. On this setup 97% of chat scored into the cheapest tier and 97% of code into the middle one, while the labels said the cheap model sufficed on 90% of verifiable reasoning and only 50% of chat. The expensive rung should have been going to open ended chat, which is the one place the scorer never sent it

This is a statement about same-family cost ladders, where every rung can attempt every request and the only question is whether the cheap one is good enough. It is not a claim about routing across heterogeneous models, which is a different problem

## Check the rungs before blaming the router

The middle rung, `gemini-3-flash-preview`, lists at a quarter of the flagship's output price and looked like an obvious intermediate. Measured end to end it cost 14.1x what `gemini-3.1-flash-lite` cost, won fewer pairings (37.5% against 43.7%), and answered 63 of 90 verifiable problems correctly against Flash-Lite's 81. Among prompts where exactly one was right, Flash-Lite won 20 to 2. There is no budget at which selecting it was correct

Thinking tokens explain the cost half. That rung emitted 981,308 thinking tokens against the flagship's 581,883, so it thought 69% more than the model above it, and thinking bills as output. A list-price advantage of 4x realized as 2.7x. Flash-Lite emitted none at all, which is most of why it came in 37x cheaper than the flagship rather than the 8x list prices imply

Both complexity arms routed most traffic into that rung, which is the mechanical reason they landed where they did. Before concluding a router is broken, price each rung on your own traffic with thinking tokens counted

## Choosing a strategy

For a cost ladder over one model family, reach for the semantic [Auto Router](./auto_routing_semantic.md) and build its routes from examples of requests you have already checked the cheap model on. What predicts "the cheap model suffices" in this setting is what kind of task it is, and matching against labelled examples captures that directly

`score_threshold` deserves fitting rather than defaulting. Below it the router falls back to `auto_router_default_model`, so an untuned threshold quietly converts a routing config into an expensive-by-default one. At 0.3 the router sent 52% of traffic to the flagship and saved 47.5%; at 0.2 it sent 38% and saved 58.2%, trading roughly a point and a half of quality. Neither setting cleared both halves of a 45% quality floor and 50% savings target at once, so pick the corner of that frontier your workload actually needs. Deliberately not reported here is a threshold swept until it cleared both, because tuning on the evaluation set produces a number that means nothing

## Scope

One provider family, one ladder, one 300-prompt corpus, one judge model. The judge disagreed with itself on 32% of pairs when response order was swapped; those resolve to ties, which pulls every arm toward 50% and makes the reported gaps conservative rather than inflated. Judge verdicts agreed with mechanical ground truth 90% of the time. Code was judged rather than executed. Treat the direction of these results as portable and the magnitudes as specific to this setup

The methodology is the part worth copying: pair your arms on one response matrix, include a cost-matched shuffled control, label a held-out train slice before fitting anything, count thinking tokens, and pre-register what would count as a pass
