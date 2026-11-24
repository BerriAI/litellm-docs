# SAEF (carbon and water estimates)

{/* keep-version-note */}

:::tip

This is community maintained. Please make an issue at https://github.com/guillermollopis/soma-ai-emission-factors/issues if you run into a bug.

:::

[SAEF](https://github.com/guillermollopis/soma-ai-emission-factors) is a Python package that estimates the CO2e and water use of each LLM call from the token counts, the model and the cloud region. The factors are estimates and not measurements. Each result carries the data file and line behind the number. The code and data are free for non-commercial use, and companies need a commercial licence (https://somaai.earth/licensing). Versions up to v3.2.0 are MIT code and CC BY 4.0 data. The method is described in a [paper](https://doi.org/10.1016/j.spc.2026.11.003) in Sustainable Production and Consumption. The dataset has the DOI [10.5281/zenodo.20443585](https://doi.org/10.5281/zenodo.20443585).

## Getting Started

Install the package with the LiteLLM extra.

```shell
pip install "saef[litellm]"
```

Add `SaefLogger` to `litellm.callbacks`. The logger works with every provider LiteLLM supports, because it only needs the usage block of the response.

```python
import time

import litellm
from saef.integrations.litellm import SaefLogger

logger = SaefLogger(region="eu-west-1")
litellm.callbacks = [logger]

response = litellm.completion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Hello"}],
    mock_response="Hi there",
)

time.sleep(1)  # success callbacks run in a background thread

totals = logger.totals()
print(totals["calls"], totals["input_tokens"], totals["output_tokens"])
print(totals["kg_co2e"], totals["kg_co2e_high_case"], totals["water_ml"])
```

LiteLLM runs success callbacks in a background thread for synchronous calls, so read the totals after a short pause or at the end of a batch.

The estimate for the call is also available on the response.

```python
print(response._hidden_params["saef"])
```

## Choosing the region

The region comes from the `region` argument first, then from the `SAEF_REGION` environment variable, and falls back to the global average. For Bedrock, SageMaker and Vertex AI the region of the call itself is used when LiteLLM exposes it. Use `region_map` to set a region per LiteLLM provider.

```python
logger = SaefLogger(region_map={"azure": "swedencentral"})
```

## Logging each call

Pass `log_path` to append one JSON line per call, and call `logger.reset()` to clear the running totals.

```python
logger = SaefLogger(region="eu-west-1", log_path="saef_calls.jsonl")
```

## Cost beside carbon

Available in saef 3.5.0 and later. SAEF does not price tokens and has no price table. When LiteLLM reports `response_cost` for a call, the logger stores it on the record as `cost` and `cost_currency` (USD), next to the estimate. Calls where LiteLLM reports no cost have no cost fields.

```python
import time

import litellm
from saef.integrations.litellm import SaefLogger

logger = SaefLogger(region="eu-west-1")
litellm.callbacks = [logger]

response = litellm.completion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Hello"}],
    mock_response="Hi there",
)

time.sleep(1)  # success callbacks run in a background thread

record = response._hidden_params["saef"]
print(record["kg_co2e"], record["cost"], record["cost_currency"])

totals = logger.totals()
print(f"{totals['cost']:.6f} {totals['cost_currency']}, {totals['g_co2e_per_usd']:.4f} g CO2e per USD")
```

`g_co2e_per_usd` is the central estimate in grams divided by the cost, over the calls that have a cost. It is `None` when the total cost is zero. To total records you logged yourself, for example the lines written with `log_path`, pass them to `saef.summarize(records)`, which returns the same cost fields.

## Notes

Cache reads get the cache credit and cache writes count as ordinary input. The result also reports a high case next to the central estimate, so you can show a range instead of a single number.
