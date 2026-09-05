# Model missing after Reload Price Data

A model that was just added to LiteLLM's pricing map does not show up in the Admin UI model picker, or cost tracking logs `This model isn't mapped yet` and records `$0` spend for it, even though **Reload Price Data** reported success with a model count. In almost every one of these reports the proxy did exactly what it was asked: it fetched the file it is pointed at, and that file did not contain the entry yet. Answer the two questions in Step 1 before asking anything about the deployment; they take a minute and they settle most reports on the spot.

## Step 1: When did the entry reach `main`, and which map is the proxy on?

The proxy reads pricing from `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`: once at startup, on every Reload Price Data, and on the optional reload schedule. A pricing PR does not always merge straight into `main`. While development happens on the `litellm_internal_staging` branch, `main` receives it in batches, so an entry can be merged, announced as day-0 pricing, and still be a day or more away from the file the proxy actually fetches. A successful reload with a model count proves the fetch worked and nothing else.

Check whether the entry is on `main` right now. Test every key the model was added under, since providers usually get their own prefixed entry:

```bash
curl -s https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json \
  | jq '[has("{{gemini_flash}}"), has("gemini/{{gemini_flash}}")]'
```

Check when it got there, and when it merged upstream:

```bash
git fetch origin main litellm_internal_staging
git log -S '"{{gemini_flash}}"' --first-parent --format='%h %ci %s' origin/main -- model_prices_and_context_window.json
git log -S '"{{gemini_flash}}"' --first-parent --format='%h %ci %s' origin/litellm_internal_staging -- model_prices_and_context_window.json
```

No output for `origin/main` means the entry is not there yet, and no reload, restart, or configuration change on the deployment can find it. Otherwise the first line is the merge that carried it onto `main`, and its timestamp is the earliest moment a reload could have picked it up, plus up to five minutes while raw.githubusercontent.com serves its cached copy. The gap between the `main` line and the staging line is the delay the customer experienced.

Then ask the proxy what it is reading:

```bash
curl -s http://localhost:4000/model/cost_map/source \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
curl -s http://localhost:4000/schedule/model_cost_map_reload/status \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
curl -s -X POST http://localhost:4000/reload/model_cost_map \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

`GET /model/cost_map/source` reports `url`, the file the proxy fetches (anything other than the `main` URL means `LITELLM_MODEL_COST_MAP_URL` is set and `main` is irrelevant), `source` as `remote` or `local`, `is_env_forced` when `LITELLM_LOCAL_MODEL_COST_MAP=True` pins the proxy to the pricing bundled with its release, `fallback_reason` when a failed fetch made it fall back to that bundled copy, and `model_count` for the map it currently serves.

`GET /schedule/model_cost_map_reload/status` reports whether a reload schedule exists and its `last_run` and `next_run`. With `scheduled: false` and no manual reload since startup, the map is whatever startup fetched.

`POST /reload/model_cost_map` returns `models_count`, the number of entries in the file it just fetched (it can be larger than the file's raw key count, since the proxy adds derived alias entries). It changes with every pricing merge, which makes it a fingerprint of the `main` revision the proxy loaded: a count that does not move across a reload made after the `main` merge means the proxy is not seeing that `main`. A `502` means the fetch failed and the previous map was kept, so a success response with a count is proof the fetch went through.

Record the release as well, `litellm_version` from `GET /health/readiness/details`, since the bundled pricing is frozen at build time and older releases lack some of these endpoints.

| Observation | Meaning |
|-------------|---------|
| Entry not on `main` | Nothing to debug on the deployment. Use a Step 3 workaround until the merge lands |
| Merged to `main` after the last reload | The reload ran too early. One more reload picks it up |
| `url` is not the `main` URL | The deployment overrides the map. Check that file, not `main` |
| `source` is `local` | The proxy fell back to its bundled copy. `fallback_reason` says why |
| On `main`, `remote`, still missing | Continue to Step 2 |

## Step 2: `main` has the entry, the proxy reads `main`, and it is still missing

Reload once more before anything else: raw.githubusercontent.com caches the file for about five minutes, so a reload inside that window after the merge still returns the old file.

Then check whether every replica agrees. A manual reload runs in the pod that served the request; recent releases publish it through the database so the other replicas pick it up on their next poll, but older releases reload only the pod that was hit, and the Admin UI can be served by a pod that never reloaded. Call `GET /model/cost_map/source` a few times through the load balancer: a `model_count` that alternates between values means the replicas hold different maps, and a rolling restart puts them back on the same file.

If the count matches on every replica and the entry is on `main`, the request is probably not resolving to the key that was added. Confirm the exact model name and provider prefix the deployment uses against the keys tested in Step 1; the error message `This model isn't mapped yet. model=<name>, custom_llm_provider=<provider>` names both.

## Step 3: Workarounds until `main` has the entry

Point the proxy at the branch that already has it and restart it, since the URL is read at startup. This swaps the whole pricing map for that branch's copy, so drop the override once `main` catches up:

```bash
export LITELLM_MODEL_COST_MAP_URL=https://raw.githubusercontent.com/BerriAI/litellm/litellm_internal_staging/model_prices_and_context_window.json
```

Or give the deployment its own pricing with [custom pricing](../proxy/custom_pricing) in `model_info`. On current releases deployment-level pricing survives later reloads, so it is the safer choice when the model must be billed correctly before the merge lands.

## For maintainers

Lead the reply with the `main` merge timestamp from Step 1, not the PR merge date. Merged and fetchable are different moments for this file, and a customer who was told the pricing shipped on day 0 is reading the branch the proxy reads. Quote the reload count the customer sent next to what a fresh reload of `main` returns: two different counts are two different files, and that closes the "is it my deployment" question without a single question about their setup.

The file currently carries no timestamp or revision, so the entry count is the only fingerprint of which `main` a proxy loaded. Until the map reports its own revision, the two Step 1 commands are the check.

## Checklist

1. Is the entry on `main` right now, and under which keys?
2. When did it merge to `main`, and when did it merge to staging?
3. What does `GET /model/cost_map/source` report for `url`, `source`, `fallback_reason`, and `model_count`?
4. When did the last reload run (`GET /schedule/model_cost_map_reload/status`, or the customer's manual reload), relative to the `main` merge?
5. Does `models_count` from a fresh reload match the count the customer reported?
6. Which release is the proxy on?
7. Does the customer need the staging URL or deployment-level pricing while `main` catches up?

## See also

- [Sync model pricing from GitHub](../proxy/sync_models_github)
- [Custom model cost map](../proxy/custom_model_cost_map)
- [Custom pricing per deployment](../proxy/custom_pricing)
- [Debugging a cost discrepancy](./cost_discrepancy)
