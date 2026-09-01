import Image from '@theme/IdealImage';

# Azure PTU Flat Cost Attribution

Azure provisioned throughput is billed by the hour for reserved capacity, not per token. A team with its own PTU deployment pays that hourly rate whether it sends one request or a million, so LiteLLM's per-token cost tracking reports nothing that matches the invoice. PTU flat cost attribution fixes the mismatch: you tell LiteLLM how much capacity a deployment reserves and what it costs per hour, and a daily job attributes that cost to the owning team.

A PTU deployment is billed by its reserved capacity alone. LiteLLM stores zero per-token pricing on it, so the traffic the capacity serves is never charged on top of the flat cost.

## Enable it

The feature is off by default and inert until you opt in:

```bash
export LITELLM_ENABLE_PTU_COST_ATTRIBUTION=True
```

With the variable unset the daily job is not scheduled, the model endpoints reject PTU configuration, the usage read path reports zero flat cost, and the PTU inputs stay hidden in the model form.

## Configure a deployment

PTU configuration lives on the deployment's `model_info`. In the Admin UI, open Models + Endpoints, pick the deployment, and edit its settings. The PTU inputs sit directly under the per-token costs, which LiteLLM holds at zero for you:

<Image img={require('../../img/ptu_configure_model.png')} />

The same thing through `POST /model/new`:

```bash
curl -X POST http://localhost:4000/model/new \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model_name": "gpt-4o-ptu",
    "litellm_params": {
      "model": "azure/<your-deployment-name>",
      "api_key": "os.environ/AZURE_API_KEY",
      "api_base": "os.environ/AZURE_API_BASE"
    },
    "model_info": {
      "team_id": "<the owning team id>",
      "ptu_count": 100,
      "cost_per_ptu_per_hour": 0.02,
      "ptu_effective_from": "2026-01-01T00:00:00Z"
    }
  }'
```

Or in `config.yaml`:

```yaml
model_list:
  - model_name: gpt-4o-ptu
    litellm_params:
      model: azure/<your-deployment-name>
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
    model_info:
      id: gpt-4o-ptu-team-a
      team_id: <the owning team id>
      ptu_count: 100
      cost_per_ptu_per_hour: 0.02
      ptu_effective_from: "2026-01-01T00:00:00Z"
```

`model_info.id` is required on a deployment declared this way, and the proxy refuses to load one without it, naming the deployment in the startup log. Left to itself the id is derived from the model name and the resolved `litellm_params`, so rotating the credential mints a new identity and the reservation is charged a second time under it, which nothing later retracts. Any stable string works, and it has to be unique across your deployments

Upgrading an existing reservation that has already accrued cost, set `id` to the id it uses today rather than a fresh name, or the charges already written stay under the old identity and the new one starts beside them. The startup refusal quotes that current id so you can copy it

`team_id` is what the capacity is billed to, so a declaration without one accrues nothing

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | in `config.yaml` | The deployment's stable identity. Not needed through the API or the UI, where one is stored for you |
| `team_id` | yes | The team the capacity belongs to. One deployment maps to one team |
| `ptu_count` | yes | Provisioned throughput units reserved |
| `cost_per_ptu_per_hour` | yes | Your contracted hourly rate per unit |
| `ptu_effective_from` | yes | When the reservation starts accruing |
| `ptu_effective_to` | no | When it stops. Leave unset for an open reservation |

`ptu_count` and `cost_per_ptu_per_hour` must be set together, and `ptu_effective_from` is required because flat cost accrues from that instant. Without it a deployment configured today would bill for days it did not exist.

Take `cost_per_ptu_per_hour` from your Azure agreement rather than a list price; PTU rates are negotiated and vary by region and commitment term.

## How the cost is calculated

A job runs at 00:15 UTC and writes one row per team and model for the previous day:

```
flat cost = ptu_count x cost_per_ptu_per_hour x hours active that day
```

Active hours are the overlap between the day and the reservation window, so a reservation starting at noon accrues 12 hours on its first day and 24 thereafter. The rows are written into `LiteLLM_DailyTeamSpend` under the reserved key `__ptu_flat_cost__`, which keeps flat cost separate from the per-request spend recorded against real API keys.

A reservation that starts before the job first sees it is filled in as well: the catch-up pass prices each elapsed day back to `ptu_effective_from`, up to 91 days. A deployment configured today with a backdated start therefore accrues its whole window on the first run

Flat cost does not count against team or key budgets. Reserved capacity is already paid for, so a team cannot exhaust a budget by using the capacity it reserved.

## Read the cost back

`/team/daily/activity` reports `flat_cost` per day and `total_flat_cost` for the range, alongside the usual per-token `spend`:

```bash
curl -s "http://localhost:4000/team/daily/activity?team_ids=<team-id>&start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" | jq '{
    total_spend: .metadata.total_spend,
    total_flat_cost: .metadata.total_flat_cost
  }'
```

The Usage page in the Admin UI shows the same figures under Team Usage, charting flat cost separately from request cost, and CSV export carries them:

<Image img={require('../../img/ptu_usage_flat_cost.png')} />

## Rates you must not set

LiteLLM refuses a per-token, per-second, or cache rate on a PTU deployment, and names the field it rejected. Sending `0`, an all-zero table, or no value at all is accepted:

```
A PTU deployment bills by reserved capacity, so input_cost_per_token cannot be charged on top
of it. Send 0 or no value, or remove ptu_count and cost_per_ptu_per_hour to bill per token.
```

A rate already stored on a deployment when you add PTU configuration is zeroed rather than refused, so a deployment priced before the feature was enabled heals on its next save. Removing `ptu_count` and `cost_per_ptu_per_hour` releases those zeros, and the deployment goes back to billing per token.

Web search rates are handled the same way. Note that xAI models bill their list price per search call regardless, because their pricing reader ignores a zero rate.

## Limitations

The legacy `POST /model/update` does not run the rules above, so a PTU deployment configured through it keeps billing per token and never accrues flat cost. Use `POST /model/new`, `PATCH /model/{model_id}/update`, the Admin UI, or `config.yaml`

The Python `Router` used on its own zeroes per-token pricing at registration, but nothing schedules the daily job outside the proxy, so flat cost is not accrued there
