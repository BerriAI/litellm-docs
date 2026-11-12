# SAEF (carbon and water estimates)

{/* keep-version-note */}

:::tip

This is community maintained. Please make an issue at https://github.com/guillermollopis/soma-ai-emission-factors/issues if you run into a bug.

:::

[SAEF](https://github.com/guillermollopis/soma-ai-emission-factors) is an open source Python package that estimates the CO2e and water use of each LLM call from the token counts, the model and the cloud region. The factors are estimates and not measurements. Each result carries the data file and line behind the number. The code is MIT licensed and the data is CC BY 4.0. The method is described in a [paper](https://arxiv.org/abs/2606.10660) accepted for publication in Sustainable Production and Consumption.

## Getting Started

Install the package with the LiteLLM extra.

```shell
pip install "saef[litellm]"
```

Add `SaefLogger` to `litellm.callbacks`. The logger works with every provider LiteLLM supports, because it only needs the usage block of the response.

```python
import litellm
from saef.integrations.litellm import SaefLogger

logger = SaefLogger(region="eu-west-1")
litellm.callbacks = [logger]

response = litellm.completion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Hello"}],
    mock_response="Hi there",
)

totals = logger.totals()
print(totals["calls"], totals["input_tokens"], totals["output_tokens"])
print(totals["kg_co2e"], totals["kg_co2e_high_case"], totals["water_ml"])
```

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

## Notes

Cache reads get the cache credit and cache writes count as ordinary input. The result also reports a high case next to the central estimate, so you can show a range instead of a single number.
