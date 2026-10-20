# Model Cost Map

LiteLLM prices every request from its model cost map, [`model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). Each entry maps a model to its rates, context limits, and capabilities. The raw JSON is large enough that GitHub will not render it, so browse the same data at [models.litellm.ai](https://models.litellm.ai/), which lists every model with its prices, context window, and supported features and lets you search by model name or provider. The proxy fetches the latest map from GitHub at startup, so new models and price changes arrive without upgrading LiteLLM. To change a price for your own deployment, see [Custom LLM Pricing](./custom_pricing) and [Custom Model Cost Map](./custom_model_cost_map).

## Every price is USD per billable unit

Every price in the map is in US dollars for one unit of what the provider bills. For token-priced models that unit is a single token, so `"input_cost_per_token": 1e-05` means $0.00001 per input token, which is $10 per 1M input tokens. `1e-05` is just how Python prints `0.00001`.

| Key | Unit | Example |
|---|---|---|
| `input_cost_per_token`, `output_cost_per_token` | USD per token | `3e-06` is $3 per 1M tokens |
| `cache_read_input_token_cost`, `cache_creation_input_token_cost` | USD per cached token read or written | `3e-07` is $0.30 per 1M tokens |
| `output_cost_per_image` | USD per generated image | `0.04` is $0.04 per image |
| `input_cost_per_second`, `output_cost_per_second` | USD per second of audio or video | `0.1` is $0.10 per second |
| `input_cost_per_query` | USD per search or tool query | `0.005` is $5 per 1,000 queries |
| `input_cost_per_character` | USD per input character | `1.5e-05` is $15 per 1M characters |

Variants of a rate keep the same unit and add a suffix. `_batches`, `_priority` and `_flex` are the batch and service-tier rates, `_above_200k_tokens` and `_above_272k_tokens` are long-context rates that apply once the prompt crosses that size, and `cache_creation_input_token_cost_above_1hr` is the 1-hour prompt cache write rate.

To convert a vendor's "$X per 1M tokens" price into a cost map value, divide by 1,000,000. For example, $2.50 per 1M tokens is `2.5e-06`.

```yaml
model_list:
  - model_name: my-model
    litellm_params:
      model: openai/{{openai_large}}
    model_info:
      input_cost_per_token: 2.5e-06   # $2.50 per 1M input tokens
      output_cost_per_token: 1.5e-05  # $15 per 1M output tokens
```

## How a request is priced

After the response comes back, LiteLLM reads the provider's usage block, splits it into the token types that bill differently, and multiplies each count by its rate. Take an entry with `input_cost_per_token: 1e-05`, `cache_read_input_token_cost: 2.5e-07` and `output_cost_per_token: 5e-05`. A request with 112,000 prompt tokens, 100,000 of them cache reads, and 800 output tokens costs:

```text
 12,000 uncached input tokens x 1e-05    = $0.12
100,000 cache read tokens     x 2.5e-07  = $0.025
    800 output tokens         x 5e-05    = $0.04
                                  total  = $0.185
```

The same pattern covers everything else. A prompt over a long-context threshold uses the `_above_..._tokens` rate, a request sent with `service_tier: priority` or `flex` uses the matching suffixed rate, and audio, image, video, and reasoning tokens use their own rate when the entry has one and the text rate when it does not. Entries with a regional uplift, such as a data residency region, multiply the total by the `regional_processing_uplift_multiplier_<region>` stored on the entry.

Some providers return the cost of the request themselves, and LiteLLM uses that number. xAI reports `cost_in_usd_ticks`, where one tick is 1e-10 USD. Since xAI reports one total, LiteLLM splits it between input and output in the ratio its own token math gives.

## Currency

Spend is always tracked in USD. LiteLLM does no currency conversion at request time. When a vendor publishes prices only in another currency, the cost map entry is converted to USD once at a fixed rate, and that rate is recorded in the entry's `metadata.comment`.

The result of each request is written to `LiteLLM_SpendLogs.spend` as a USD float and rolled up into key, user, and team spend for budgets. Because it is a float, you may see values such as `0.14500000000000002` in logs. The tail is far below a cent, even summed over billions of requests.

## When a request costs $0

A request prices to $0 when its model, or a rate the request used, is missing from the map. The request is still logged with `spend = 0`. When the model has a non-zero rate on its entry but the request still prices to $0, the proxy also counts it in the `litellm_zero_cost_requests_total` Prometheus metric. See [Requests that price to $0](./cost_tracking#requests-that-price-to-0) for how to read the warning and fix the missing rate.
