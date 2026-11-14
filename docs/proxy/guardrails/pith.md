# Output-Token Profiles (pith)

[pith](https://github.com/dex0shubham/pith) shortens model *output* per route. It fingerprints each route by its system prompt and tools, records usage, and, once an offline sweep has shown that a shorter output profile is judged equivalent to the unconstrained baseline, injects that profile into requests. As a LiteLLM guardrail it runs in-process, holds no provider keys, records into its own SQLite file, and fails open: any pith error forwards the request unchanged.

This is available on `/v1/chat/completions`.

## How it works

1. **Observe.** Every chat request is fingerprinted (`provider:model:hash(system+tools)`, or the name given in `X-Optimizer-Route`). Usage from the response is recorded, including streams.
2. **Sweep.** An operator runs `pith sweep` from the CLI with provider keys in its environment. It replays a frozen sample of the route's requests under each profile, judges equivalence against the unconstrained baseline with an LLM judge, measures the baseline's own self-consistency as the noise floor, and pins the cheapest profile that clears the bar on a fit set and again on a holdout. Identical effective requests are judged once; a sweep that cannot repay itself at the route's volume refuses.
3. **Apply.** On the next request the guardrail appends the pinned instruction to the last user message (never a `system` or `developer` message, so prompt caches survive). Only the shape profiles apply through LiteLLM: the guardrail cannot retry a rejected request, so effort and verbosity parameters are left to the standalone proxy.
4. **Guard.** `pith recheck` re-judges live responses after a pin and reverts on drift; three provider-attributed 400/422 responses on a pinned route revert it.

Streaming is supported. `X-Optimizer: off` forces the baseline for a request; `X-Optimizer: bypass` also skips recording.

## Quick Start

### 1. Install pith into the proxy's environment

```bash
pip install pith-optimizer
```

### 2. Define the guardrail in your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
      api_key: os.environ/ANTHROPIC_API_KEY

guardrails:
  - guardrail_name: pith
    litellm_params:
      guardrail: pith.guardrail.PithGuardrail
      mode: [pre_call, post_call]
      default_on: true
```

Set `OPTIMIZER_CONFIG=/path/to/pith.toml` in the proxy's environment, or configure through `OPTIMIZER_<FIELD>` variables (`OPTIMIZER_DB_PATH` is the one you will want). Keep the SQLite file on local disk.

### 3. Start the proxy and send traffic

```bash
litellm --config config.yaml
```

Requests are recorded as they flow. A route becomes sweepable after 50 sampled baseline requests.

### 4. Sweep, then let the guardrail apply the pin

```bash
export LITELLM_API_KEY=sk-...          # a LiteLLM virtual key or the master key
pith sweep --config pith.toml --holdout 0.3
```

Replays go through the LiteLLM proxy itself (`litellm_upstream` in `pith.toml`) with `X-Optimizer: bypass`, so the guardrail neither rewrites nor records them. A `[prices."<model_name>"]` entry is required for each model name clients send. The sweep prints one table per route and pins or refuses with a reason; `GET /optimizer/sweeps/<route>` on `pith serve` returns the full result.

## Configuration reference

| Setting | Where | Meaning |
|---|---|---|
| `OPTIMIZER_CONFIG` | proxy env | Path to `pith.toml`; optional |
| `OPTIMIZER_DB_PATH` | proxy env | SQLite file shared with the CLI (default `./pith.db`) |
| `OPTIMIZER_SAMPLE_RATE` | proxy env | Fraction of requests whose bodies are stored for sweeps (default 0.05) |
| `litellm_upstream` | `pith.toml` | The LiteLLM proxy sweeps replay through (default `http://localhost:4000`) |
| `[prices."<model>"]` | `pith.toml` | `$/M` input and output for model names not in pith's built-in table |
| `[routes."<key>"]` | `pith.toml` | `enabled = false` or a per-route `equivalence_bar` |

## Limits

Chat completions only; shape profiles only; provider rejections after a rewrite are counted but not retried. The sweep is a fixed cost (a few dollars at 100–200 items), so pins pay on volume; the sweep's table says `sweep cost not recovered at projected volume` when they do not. Details and live benchmark results: [pith README](https://github.com/dex0shubham/pith#readme) and [how pith decides a pin](https://github.com/dex0shubham/pith/blob/main/docs/methodology.md).
