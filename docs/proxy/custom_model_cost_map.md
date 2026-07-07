# Custom Model Cost Map

LiteLLM prices every request from its model cost map, a JSON file mapping each model to per-token rates, context limits, and capabilities. By default the proxy fetches the latest map from GitHub at startup, so pricing for new models arrives without upgrading LiteLLM. When a price is wrong or missing for your deployment (a regional price variant, a negotiated rate, a brand-new tier the default map does not carry yet), you have two ways to correct it: override pricing on the specific deployment in your config, or replace the whole map with your own hosted copy.

Prefer the per-deployment override for a bounded correction. It changes only the deployments you name, survives every upstream map update, needs no file hosting, and has no fallback failure mode. Reach for a full custom map only when the correction spans so many models that per-deployment config stops being maintainable.

## Option 1: per-deployment pricing overrides (recommended)

Any pricing key from the cost map can be set directly in `litellm_params` on a deployment, including the tiered long-context keys of the form `input_cost_per_token_above_{N}k_tokens`. When the input token count crosses the threshold, LiteLLM bills the whole request at the tier rate.

Example: an Azure deployment billed under a regional price variant (such as US Data Zone) whose long-context tier is missing from the default map:

```yaml
model_list:
  - model_name: gpt-5.5
    litellm_params:
      model: azure/<your-deployment-name>
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
      input_cost_per_token: 0.0000055        # base rate for your price variant
      output_cost_per_token: 0.000044
      input_cost_per_token_above_272k_tokens: 0.000011   # long-context tier
      output_cost_per_token_above_272k_tokens: 0.0000495
      cache_read_input_token_cost: 0.00000055
      cache_read_input_token_cost_above_272k_tokens: 0.0000011
```

The full set of overridable keys includes the base per-token rates, per-second rates, cache read and cache creation rates, and the `above_128k`, `above_200k`, and `above_272k` tier variants for each, plus `_priority` service-tier variants. Numbers above are illustrative; take real rates from your provider's price sheet. See [Custom LLM Pricing](./custom_pricing) for the general override mechanism.

No code change is needed for tiered pricing to apply; the cost engine reads whatever tier keys the resolved pricing carries.

### Partial overrides do not fall back to default pricing

Setting any custom pricing field detaches the deployment from the default cost map entry: LiteLLM builds a standalone pricing entry for that deployment and bills only from it. If you override `input_cost_per_token` but leave `input_cost_per_token_above_272k_tokens` unset, that deployment has no tier boundary at all, so requests above 272k tokens bill at your custom base rate. The unset tier key does not inherit the default map's tier price, and LiteLLM never mixes your base rate with a default tier premium.

The one deliberate exception is cache pricing. When you override the base input rate, missing cache fields (`cache_read_input_token_cost`, `cache_creation_input_token_cost`, and their `above_1hr` and `above_200k` variants) are inherited from the backend model's default entry so cache reads are not silently billed at zero. Note that those inherited values are the default prices, not your price variant's, so a regional or negotiated rate card should override the cache keys as well.

Treat the override block as the complete rate card for the deployment: base input and output rates, the long-context tier keys, and the cache keys. A partial override under-bills silently on exactly the expensive requests.

## Option 2: serve your own cost map

Point the proxy at your own copy of the map with:

```bash
export LITELLM_MODEL_COST_MAP_URL="https://your-host.example.com/model_prices.json"
```

The map is fetched once at startup with a 5 second timeout, so the variable must be set before the proxy starts and changes require a restart. The URL must be HTTP(S); `file://` paths are not supported. To run fully offline instead, set `LITELLM_LOCAL_MODEL_COST_MAP=True`, which skips the fetch and uses the backup map bundled with the package (`litellm/model_prices_and_context_window_backup.json`), a file you can overwrite in your own image.

### Start from the full upstream file

Always build your custom map as a fork of the complete [model_prices_and_context_window.json](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) with your corrections edited in. A small file containing only your models will be rejected: the fetched map must contain at least 50 model entries and at least half as many entries as the bundled backup, or LiteLLM discards it. Both thresholds are tunable via `MODEL_COST_MAP_MIN_MODEL_COUNT` and `MODEL_COST_MAP_MAX_SHRINK_RATIO` if you accept the risk of a corrupted map passing validation.

### Fallback semantics: monitor them

If the fetch fails, times out, or the file fails validation, the proxy does not crash. It logs a warning and silently falls back to the bundled backup map, which means requests are billed at whatever prices that backup carries. For a production deployment this is the failure mode to watch: a transient network error at pod start quietly reverts all your pricing corrections.

Verify which map actually loaded with the admin endpoint:

```bash
curl -s http://localhost:4000/model/cost_map/source \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

The response reports `source` ("remote" or "local"), the attempted `url`, a human-readable `fallback_reason` (null on success), and `model_count`. Alert when `source` is not `remote` or `fallback_reason` is non-null.

### Production checklist

1. Host the file as a versioned artifact on infrastructure you control (object storage behind a CDN or an internal endpoint), reachable within 5 seconds from every proxy pod.
2. Alert on `/model/cost_map/source` reporting a fallback.
3. Set a re-sync cadence with the upstream map so pricing for newly released models is not frozen at fork time.
4. Treat the custom map as temporary where possible: upstream your correction to the default map, then drop the fork.

## Which option to choose

A custom map replaces the entire pricing database. You take ownership of every entry and stop receiving upstream pricing updates until you re-sync, and its failure mode (silent fallback) reverts your corrections without failing a health check. Per-deployment overrides carry none of those risks but scale linearly with the number of deployments you must correct. Fix a handful of deployments in config; fix a fleet with a forked map plus monitoring; in both cases, contribute the correction upstream so the workaround can be retired.
