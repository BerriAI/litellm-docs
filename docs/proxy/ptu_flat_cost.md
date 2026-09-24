import Image from '@theme/IdealImage';

# Azure PTU Flat Cost Attribution

Azure provisioned throughput is billed by the hour for reserved capacity, not per token. A team with its own PTU deployment pays that hourly rate whether it sends one request or a million, so LiteLLM's per-token cost tracking reports nothing that matches the invoice. PTU flat cost attribution fixes the mismatch: you tell LiteLLM how much capacity a deployment reserves and what it costs per hour, and a daily job attributes that cost to the owning team.

A PTU deployment is billed by its reserved capacity alone. LiteLLM stores zero per-token pricing on it, so the traffic the capacity serves is never charged on top of the flat cost.

One deployment can also be split across several teams in PTUs. Each team's share becomes a per-minute ceiling the proxy enforces, the flat cost is attributed by share, and usage reports the PTU-hours each team consumed next to its tokens. See [Share a deployment across teams](#share-a-deployment-across-teams)

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
| `team_id` | one of the two | The team the capacity belongs to, when one team owns the whole deployment |
| `ptu_shares` | one of the two | Team id to whole PTUs, adding up to `ptu_count`, when several teams share it |
| `ptu_count` | yes | Provisioned throughput units reserved, a whole number |
| `cost_per_ptu_per_hour` | yes | Your contracted hourly rate per unit |
| `ptu_effective_from` | yes | When the reservation starts accruing |
| `ptu_effective_to` | no | When it stops. Leave unset for an open reservation |
| `base_model` | for the ceiling | The Azure model name when the deployment name is not one, e.g. `gpt-4.1` |

`ptu_count` and `cost_per_ptu_per_hour` must be set together, and `ptu_effective_from` is required because flat cost accrues from that instant. Without it a deployment configured today would bill for days it did not exist.

Take `cost_per_ptu_per_hour` from your Azure agreement rather than a list price; PTU rates are negotiated and vary by region and commitment term.

## Share a deployment across teams

A department that reserves 50 PTUs and lets two teams use them declares the split once, in PTUs, with `model_info.ptu_shares` in place of `team_id`:

```bash
curl -X POST http://localhost:4000/model/new \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model_name": "gpt-4.1-ptu",
    "litellm_params": {
      "model": "azure/<your-deployment-name>",
      "api_key": "os.environ/AZURE_API_KEY",
      "api_base": "os.environ/AZURE_API_BASE"
    },
    "model_info": {
      "base_model": "gpt-4.1",
      "ptu_count": 50,
      "cost_per_ptu_per_hour": 1.0,
      "ptu_effective_from": "2026-01-01T00:00:00Z",
      "ptu_shares": {"<team a id>": 30, "<team b id>": 20}
    }
  }'
```

Or in `config.yaml`:

```yaml
model_list:
  - model_name: gpt-4.1-ptu
    litellm_params:
      model: azure/<your-deployment-name>
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
    model_info:
      id: gpt-4.1-ptu-shared
      base_model: gpt-4.1
      ptu_count: 50
      cost_per_ptu_per_hour: 1.0
      ptu_effective_from: "2026-01-01T00:00:00Z"
      ptu_shares:
        <team a id>: 30
        <team b id>: 20
```

`ptu_shares` and `team_id` cannot both be set, and the shares have to add up to `ptu_count` exactly, in whole PTUs. A split that leaves capacity unowned or hands out more than was reserved is refused with a 400 saying how many of the PTUs were allocated, from `POST /model/new` and `config.yaml` alike

A shared deployment keeps its public model name and stays visible in model lists, but the proxy serves it only to the teams named in `ptu_shares`. A key from any other team, a key with no team, and the master key all get a 400 on it, whether or not `LITELLM_ENABLE_PTU_COST_ATTRIBUTION` is set, because a declared split is an access rule; the ceiling, the cost split, and PTU-hours below need the flag:

```
Deployment gpt-4.1-ptu is reserved for the teams holding a PTU share of it
```

### Each share is a per-minute ceiling

Azure sizes a provisioned deployment in normalized tokens per minute: uncached input tokens in full, cached input at the model's cached ratio (a tenth for the GPT-6 family, nothing for the rest), and output tokens weighted by the model's output-to-input ratio, divided by the model's input TPM per PTU. LiteLLM ships that table, read from [Azure's provisioned throughput sizing page](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/provisioned-throughput-sizing#deployment-parameters-and-throughput-values-by-model), and turns each share into a per-minute ceiling in the same units:

```
team ceiling per minute = share x input TPM per PTU for the model
tokens charged per request = uncached input + cached input x cached ratio + output x output ratio
```

Team A's 30 PTUs of gpt-4.1 (3,000 input TPM per PTU, output counted at 4x) are 90,000 normalized tokens a minute. Each request reserves its input plus its output budget (`max_tokens`, or without one the proxy's output floor, sized so it never takes more than a quarter of the share) in those units before the call and settles at the usage the response reports, so a burst of concurrent requests cannot together pass the share. The first request past it gets a 429 with a `retry-after` header, and team B's 20 PTUs are untouched:

```
Rate limit exceeded for model_per_team_ptu: <team a id>:gpt-4.1-ptu. Limit type: tokens. Current limit: 90000, Remaining: 0. Limit resets at: ...
```

The ceiling lives on the same per-minute window as a team's `model_tpm_limit`, so it reads and resets the way the limits you already set do, and it needs nothing beyond `LITELLM_ENABLE_PTU_COST_ATTRIBUTION`. The sizing row is looked up by `model_info.base_model` first, then by the model in `litellm_params`, because an Azure deployment name is arbitrary. A shared deployment, or an Azure deployment reserved for one team, whose model has no row logs a warning at startup, sets no ceiling, and reports no PTU-hours; set `base_model` to the Azure model name to fix it. A single-team reservation on another provider only feeds the flat-cost rollup, which needs no sizing, so it is not warned about

A deployment owned by one team through `team_id` gets no ceiling, since that team already owns all of it, but its usage does report PTU-hours


## How the cost is calculated

A job runs at 00:15 UTC and writes one row per team and model for the previous day:

```
flat cost = ptu_count x cost_per_ptu_per_hour x hours active that day
```

A deployment split with `ptu_shares` writes one row per team instead, each carrying that team's share in place of `ptu_count`: 30 and 20 of the 50 PTUs at $1 per PTU-hour are $720 and $480 for a full day, and the deployment's $1,200 lands on nobody else. Active hours are the overlap between the day and the reservation window, so a reservation starting at noon accrues 12 hours on its first day and 24 thereafter. The rows are written into `LiteLLM_DailyTeamSpend` under the reserved key `__ptu_flat_cost__`, which keeps flat cost separate from the per-request spend recorded against real API keys.

A reservation that starts before the job first sees it is filled in as well: the catch-up pass prices each elapsed day back to `ptu_effective_from`, up to 91 days. A deployment configured today with a backdated start therefore accrues its whole window on the first run

Flat cost does not count against team or key budgets. Reserved capacity is already paid for, so a team cannot exhaust a budget by using the capacity it reserved.

## Spillover requests

When a PTU deployment is full, Azure can send the overflow to a pay-as-you-go deployment you configure as its spillover target, and bills those requests per token. LiteLLM does the same: a response with `x-ms-is-spilled-over: true` is priced at the served model's standard rates, while requests the PTU serves stay at zero. The hourly flat cost is unchanged either way

Spilled requests are tagged in the spend log metadata, so you can tell them apart on the Logs page:

```json
"azure_spillover": {"from_deployment": "<your-deployment-name>"}
```

This needs `LITELLM_ENABLE_PTU_COST_ATTRIBUTION` set and a pricing map entry for the served model (set `base_model` if the deployment name does not match one). Without either, spilled requests still log at zero

## Read the cost back

`/team/daily/activity` reports `flat_cost` per day and `total_flat_cost` for the range, alongside the usual per-token `spend`, and `ptu_hours` next to the tokens: on each day, on each PTU model group and the API keys under it, and as `total_ptu_hours` for the range. PTU-hours are the team's prompt, cached, and completion tokens converted through the model's sizing row, so a team can compare what it consumed with what it reserved:

```bash
curl -s "http://localhost:4000/team/daily/activity?team_ids=<team-id>&start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" | jq '{
    total_spend: .metadata.total_spend,
    total_flat_cost: .metadata.total_flat_cost,
    total_ptu_hours: .metadata.total_ptu_hours,
    gpt41_ptu_hours: [.results[].breakdown.model_groups["gpt-4.1-ptu"].metrics.ptu_hours]
  }'
```

The Usage page in the Admin UI shows the same figures under Team Usage, charting flat cost separately from request cost, with a PTU Hours tile for a team whose window consumed any, and CSV export carries them:

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

PTU-hours are reported on team activity only. The per-key, per-user, and per-tag activity routes carry no model group in their rows today, so they report none

An unshared deployment in the same model group as a shared one counts toward the teams' ceilings and PTU-hours on that group, and a group mixing models is sized by its first reserved deployment's row. Keep a shared deployment in a model group of its own

`ptu_shares` is edited through `POST /model/new`, `PATCH /model/{model_id}/update`, or `config.yaml`; the model form in the Admin UI has no shares editor yet
