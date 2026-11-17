---
title: Pulling a New Model on Day-0
description: Reload missing model prices in LiteLLM without a new image or Helm chart version. Use the Admin UI, API, or a periodic reload schedule.
---

# Pulling a New Model on Day-0

If a new model comes out or model pricing is missing, use **Reload Price Data** before upgrading LiteLLM. You do not need a new container image or a Helm chart version bump just to update model prices that are already in the [pricing map on GitHub main](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). LiteLLM can fetch that map while the proxy runs.

The normal startup path fetches the remote map and falls back to the bundled copy if the fetch fails or the file fails validation. Local-only and offline modes use the bundled copy instead. The `lite` and `litellm-proxy` CLI entry points also start with the bundled copy, so use a runtime reload to fetch current prices. Reload updates pricing and model metadata. It does not add a deployment, configure provider credentials, or add provider API support that your installed version lacks.

## Reload from the Admin UI or API

Sign in as a proxy admin. Under **Models and Endpoints**, open **Price Data Reload**, click **Reload Price Data**, and confirm **Yes**. Use **Set Up Periodic Reload** on the same page to keep prices current.

For the API, use the master key or a token with the `proxy_admin` role. Manual reload and scheduling require a database connection on current releases.

```bash
curl --fail-with-body -X POST "http://localhost:4000/reload/model_cost_map" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

A successful response has `status: "success"` and `models_count`. A `502` means the remote fetch or validation failed and the proxy kept its current prices. Check the response before treating a reload as complete.

To schedule a reload every six hours, call the schedule endpoint with a positive integer `hours` query parameter.

```bash
curl --fail-with-body -X POST "http://localhost:4000/schedule/model_cost_map_reload?hours=6" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

See [Auto Sync New Models](./sync_models_github) for schedule status, cancellation, and the full API reference.

## Verify the pricing source

```bash
curl --fail-with-body "http://localhost:4000/model/cost_map/source" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

This read-only endpoint also accepts proxy admin viewer access. Check `url` for the expected map, `source` for `remote` or `local`, and `is_env_forced` for forced local mode. `fallback_reason` explains a startup fallback. `model_count` counts the loaded entries, while `source_revision` identifies the exact file by its git blob ID. Compare revisions rather than counts to confirm that two workers loaded the same file. See [revision checks](./sync_models_github#checking-which-revision-is-loaded).

## When a reload does not fix missing pricing

If `LITELLM_LOCAL_MODEL_COST_MAP=True` is set, reload uses the bundled map too. Remove that setting and restart to use remote prices, or upgrade the image if you must keep bundled pricing. To use a different remote map, set `LITELLM_MODEL_COST_MAP_URL` and restart, with local-only mode disabled. `LITELLM_OFFLINE_MODE=true` also prevents remote fetches. See [Custom model cost map](./custom_model_cost_map) for source selection and validation.

A pricing PR merged into `litellm_internal_staging` is not necessarily on `main` yet. Reload cannot fetch an entry absent from its configured URL. Check the exact provider-prefixed model key in that file. Follow [Model missing after Reload Price Data](../troubleshoot/missing_model) if the entry is still missing after a successful reload.

For multiple replicas or workers, current releases publish a manual reload through the database and other workers reload on their next poll. This is not an immediate fleet-wide switch. Verify `source_revision` on each replica. Older releases can reload only the worker that handled the request, so check every replica or restart them against the same remote map.

If you need prices before the upstream entry is available, set per-deployment `input_cost_per_token` and `output_cost_per_token` under `model_info`. Use provider prices in dollars per token, not dollars per million tokens. See [Custom LLM Pricing](./custom_pricing) for configuration examples. On current releases, these deployment overrides survive a map reload.

## Helm and Kubernetes

Keep the chart and image versions unchanged for a pricing-only refresh. Call the reload or schedule API against your deployed proxy. The schedule is stored in the database, not in the chart version.

If you need a custom map URL or must disable forced local mode, configure the proxy environment and roll out those configuration changes instead of bumping the chart version. The [current Helm chart](https://github.com/BerriAI/litellm/blob/main/litellm/deploy/helm/litellm/values.yaml) exposes `gateway.extraEnv` and `backend.extraEnv` for environment variables and `gateway.envSecrets` and `backend.envSecrets` for Secret references. Apply consistent pricing source settings to every proxy component that serves requests. See [Deploy with Helm](./deploy/helm) for the chart configuration.
