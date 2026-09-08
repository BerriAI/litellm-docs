import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Budgets, Rate Limits

:::info **Budget Setup Options**
**Personal budgets**: Create virtual keys without team_id for individual spending limits

**Team budgets**: Add team_id to virtual keys to draw on a team's shared budget

**Team member budgets**: Set individual spending limits within the team's shared budget

**Agent budgets**: Set rate limits (tpm/rpm) and session-level caps (iterations, dollar budget) on agents [**Jump**](#agents)

***If a key belongs to a team, only the team (and team-member) budgets are enforced; the key owner's personal budget does not apply. `v1.94.0` briefly enforced the personal budget as well, behind a `skip_user_budget_on_team_key` opt-out; both the enforcement and the flag were removed in `v1.95.0`.***
:::

Requirements: 

- Need to a postgres database (e.g. [Supabase](https://supabase.com/), [Neon](https://neon.tech/), etc) [**See Setup**](./virtual_keys.md#setup)

:::warning Budgets require a database

Every budget on this page is enforced against spend read from the database, so none of them cap anything on a [DB-less deployment](./docker_quick_start.md#running-without-a-database). `litellm_settings.max_budget` fails open there rather than erroring: the proxy's global spend is only loaded when a database client exists, and with no total to compare against, the global budget check is skipped and requests keep being served past the limit. A warning is logged once at startup when a budget is set with no database connected, but nothing blocks at request time. Key, team, and user budgets are unavailable for the same reason, since virtual keys cannot be resolved without a database (`No connected db.`). Run with a database if a budget is part of how you bound spend

:::


## Set Budgets

### Global Proxy

Apply a budget across all calls on the proxy

**Step 1. Modify config.yaml**

```yaml
general_settings:
  master_key: sk-1234

litellm_settings:
  # other litellm settings
  max_budget: 0 # (float) sets max budget as $0 USD
  budget_duration: 30d # (str) frequency of reset - You can set duration as seconds ("30s"), minutes ("30m"), hours ("30h"), days ("30d").
```

**Step 2. Start proxy**

```bash
litellm /path/to/config.yaml
```

**Step 3. Send test call**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
    --header 'Autherization: Bearer sk-1234' \
    --header 'Content-Type: application/json' \
    --data '{
    "model": "{{openai_small}}",
    "messages": [
        {
        "role": "user",
        "content": "what llm are you"
        }
    ],
}'
```

### Team

You can:
- Add budgets to Teams

:::info

**Step-by step tutorial on setting, resetting budgets on Teams here (API or using Admin UI)**


#### **Add budgets to teams**
```shell 
curl --location 'http://localhost:4000/team/new' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "team_alias": "my-new-team_4",
  "members_with_roles": [{"role": "admin", "user_id": "5c4a0aa3-a1e1-43dc-bd87-3c2da8382a3a"}],
  "rpm_limit": 99
}' 
```

[**See Swagger**](https://litellm-api.up.railway.app/#/team%20management/new_team_team_new_post)

**Sample Response**

```shell
{
    "team_alias": "my-new-team_4",
    "team_id": "13e83b19-f851-43fe-8e93-f96e21033100",
    "admins": [],
    "members": [],
    "members_with_roles": [
        {
            "role": "admin",
            "user_id": "5c4a0aa3-a1e1-43dc-bd87-3c2da8382a3a"
        }
    ],
    "metadata": {},
    "tpm_limit": null,
    "rpm_limit": 99,
    "max_budget": null,
    "models": [],
    "spend": 0.0,
    "max_parallel_requests": null,
    "budget_duration": null,
    "budget_reset_at": null
}
```

#### **Add budget duration to teams**

`budget_duration`: Budget is reset at the end of specified duration. If not set, budget is never reset. You can set duration as seconds ("30s"), minutes ("30m"), hours ("30h"), days ("30d").

```
curl 'http://0.0.0.0:4000/team/new' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "team_alias": "my-new-team_4",
  "members_with_roles": [{"role": "admin", "user_id": "5c4a0aa3-a1e1-43dc-bd87-3c2da8382a3a"}],
  "budget_duration": "30s",
}'
```

### Team Members

Use this when you want to budget a users spend within a Team 


#### Step 1. Create User

Create a user with `user_id=ishaan`

```shell
curl --location 'http://0.0.0.0:4000/user/new' \
    --header 'Authorization: Bearer sk-1234' \
    --header 'Content-Type: application/json' \
    --data '{
        "user_id": "ishaan"
}'
```

#### Step 2. Add User to an existing Team - set `max_budget_in_team`

Set `max_budget_in_team` when adding a User to a team. We use the same `user_id` we set in Step 1

```shell
curl -X POST 'http://0.0.0.0:4000/team/member_add' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{"team_id": "e8d1460f-846c-45d7-9b43-55f3cc52ac32", "max_budget_in_team": 0.000000000001, "member": {"role": "user", "user_id": "ishaan"}}'
```

#### Step 3. Create a Key for Team member from Step 1

Set `user_id=ishaan` from step 1

```shell
curl --location 'http://0.0.0.0:4000/key/generate' \
    --header 'Authorization: Bearer sk-1234' \
    --header 'Content-Type: application/json' \
    --data '{
        "user_id": "ishaan",
        "team_id": "e8d1460f-846c-45d7-9b43-55f3cc52ac32"
}'
```
Response from `/key/generate`

We use the `key` from this response in Step 4
```shell
{"key":"sk-RV-l2BJEZ_LYNChSx2EueQ", "models":[],"spend":0.0,"max_budget":null,"user_id":"ishaan","team_id":"e8d1460f-846c-45d7-9b43-55f3cc52ac32","max_parallel_requests":null,"metadata":{},"tpm_limit":null,"rpm_limit":null,"budget_duration":null,"allowed_cache_controls":[],"soft_budget":null,"key_alias":null,"duration":null,"aliases":{},"config":{},"permissions":{},"model_max_budget":{},"key_name":null,"expires":null,"token_id":null}% 
```

#### Step 4. Make /chat/completions requests for Team member

Use the key from step 3 for this request. After 2-3 requests expect to see The following error `ExceededBudget: Crossed spend within team` 


```shell
curl --location 'http://localhost:4000/chat/completions' \
    --header 'Authorization: Bearer sk-RV-l2BJEZ_LYNChSx2EueQ' \
    --header 'Content-Type: application/json' \
    --data '{
    "model": "llama3",
    "messages": [
        {
        "role": "user",
        "content": "tes4"
        }
    ]
}'
```

#### Update a team member's budget

Update `max_budget_in_team` for an existing team member with `/team/member_update`. The new budget takes effect on the member's next request

```shell
curl -X POST 'http://0.0.0.0:4000/team/member_update' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{"team_id": "e8d1460f-846c-45d7-9b43-55f3cc52ac32", "user_id": "ishaan", "max_budget_in_team": 10}'
```

#### Reset a team member's spend

Reset the spend tracked against a member's in-team budget without changing the budget itself. Callable by a proxy admin or the team's admin, but a team admin cannot reset their own spend

```shell
curl -X POST 'http://0.0.0.0:4000/team/e8d1460f-846c-45d7-9b43-55f3cc52ac32/member/ishaan/reset_spend' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{"reset_to": 0}'
```

`reset_to` must be a number no greater than the member's current spend or their budget. The reset takes effect on the member's next request

Response:

```shell
{"team_id":"e8d1460f-846c-45d7-9b43-55f3cc52ac32","user_id":"ishaan","spend":0.0,"previous_spend":3.495e-05,"max_budget":10.0}
```


### Internal User

Apply a budget across all calls an internal user (key owner) can make on the proxy. 

:::info

For keys with a `team_id` set, this personal budget is not enforced; the team (and team-member) budgets apply instead. `v1.94.0` enforced it alongside the team budget behind a `skip_user_budget_on_team_key` opt-out, and `v1.95.0` removed both.

To apply a budget to a user within a team, use team member budgets.

:::

LiteLLM exposes a `/user/new` endpoint to create budgets for this.

You can:
- Add budgets to users [**Jump**](#add-budgets-to-users)
- Add budget durations, to reset spend [**Jump**](#add-budget-duration-to-users)

By default the `max_budget` is set to `null` and is not checked for keys

#### **Add budgets to users**
```shell 
curl --location 'http://localhost:4000/user/new' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{"models": ["azure-models"], "max_budget": 0, "user_id": "krrish3@berri.ai"}' 
```

[**See Swagger**](https://litellm-api.up.railway.app/#/user%20management/new_user_user_new_post)

**Sample Response**

```shell
{
    "key": "sk-YF2OxDbrgd1y2KgwxmEA2w",
    "expires": "2023-12-22T09:53:13.861000Z",
    "user_id": "krrish3@berri.ai",
    "max_budget": 0.0
}
```

#### **Add budget duration to users**

`budget_duration`: Budget is reset at the end of specified duration. If not set, budget is never reset. You can set duration as seconds ("30s"), minutes ("30m"), hours ("30h"), days ("30d").

```
curl 'http://0.0.0.0:4000/user/new' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "team_id": "core-infra", # [OPTIONAL]
  "max_budget": 10,
  "budget_duration": "30s",
}'
```

#### Create new keys for existing user

Now you can just call `/key/generate` with that user_id (i.e. krrish3@berri.ai) and:
- **Budget Check**: krrish3@berri.ai's budget (i.e. $10) will be checked for this key
- **Spend Tracking**: spend for this key will update krrish3@berri.ai's spend as well

```bash
curl --location 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data '{"models": ["azure-models"], "user_id": "krrish3@berri.ai"}'
```

### Virtual Key

Apply a budget on a key.

You can:
- Add budgets to keys [**Jump**](#add-budgets-to-keys)
- Add budget durations, to reset spend [**Jump**](#add-budget-duration-to-keys)

**Expected Behaviour**
- Costs Per key get auto-populated in `LiteLLM_VerificationToken` Table
- After the key crosses it's `max_budget`, requests fail
- If duration set, spend is reset at the end of the duration

By default the `max_budget` is set to `null` and is not checked for keys

#### **Add budgets to keys**

```bash
curl 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "team_id": "core-infra", # [OPTIONAL]
  "max_budget": 10,
}'
```

Example Request to `/chat/completions` when key has crossed budget

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <generated-key>' \
  --data ' {
  "model": "azure-gpt-3.5",
  "user": "e09b4da8-ed80-4b05-ac93-e16d9eb56fca",
  "messages": [
      {
      "role": "user",
      "content": "respond in 50 lines"
      }
  ],
}'
```


Expected Response from `/chat/completions` when key has crossed budget
```shell
{
  "detail":"Authentication Error, ExceededTokenBudget: Current spend for token: 7.2e-05; Max Budget for Token: 2e-07"
}   
```

#### **Add budget duration to keys**

`budget_duration`: Budget is reset at the end of specified duration. If not set, budget is never reset. You can set duration as seconds ("30s"), minutes ("30m"), hours ("30h"), days ("30d").

```
curl 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "team_id": "core-infra", # [OPTIONAL]
  "max_budget": 10,
  "budget_duration": "30s",
}'
```

#### **Set multiple budget windows on a key**

Apply multiple concurrent budget limits at different time scales on the same key, for example capping a key at **$10/day** AND **$100/month**.

**When is this useful?**

A single `budget_duration` window can't prevent a bad day from burning your entire month. Multiple budget windows let you:

- Block a runaway usage spike within the day while still allowing normal monthly spend.
- Give Claude Code rollouts a daily guardrail (`24h`) and a monthly ceiling (`30d`) so a single heavy session doesn't exhaust the whole month.
- Layer fine-grained hourly limits for bursty workloads on top of a weekly cap.

:::info

See [User Budget docs](https://docs.litellm.ai/docs/proxy/users) for more on how budgets work across keys, teams, and users.

:::

**Via API**

Pass `budget_limits` as a list of `{budget_duration, max_budget}` objects:

```bash
curl 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "budget_limits": [
    {"budget_duration": "24h",  "max_budget": 10},
    {"budget_duration": "30d",  "max_budget": 100}
  ]
}'
```

Each window is tracked independently and resets on its own schedule:

| `budget_duration` | Resets |
|---|---|
| `1h`  | Every hour |
| `24h` | Daily at midnight UTC |
| `7d`  | Every Sunday at midnight UTC |
| `30d` | 1st of every month at midnight UTC |

**Via Dashboard**

Open **Virtual Keys → Create Key → Optional Settings → Budget Windows**.

![Step 1 - open key settings](https://colony-recorder.s3.amazonaws.com/files/2026-04-01/18930ba5-67c0-4031-afc0-57f37b4e59e4/ascreenshot_ef79d8a000bb41cdacf1bd9827732ee8_text_export.jpeg)

Click **+ Add Budget Window** to add a row, choose the period from the dropdown, and enter the spend cap.

![Step 2 - add a window](https://colony-recorder.s3.amazonaws.com/files/2026-04-01/5ae8c0b3-2d03-41ad-a63c-47b20c350dfe/ascreenshot_1a7dc6c7d65544f38fd8a65604674f22_text_export.jpeg)

Add a second row for a different time period (e.g. monthly $100 on top of a daily $10).

![Step 3 - add second window](https://colony-recorder.s3.amazonaws.com/files/2026-04-01/cbded3a7-1086-4e20-8f0f-de154b76146c/ascreenshot_c51c18752c3b4f8b976d28799b2638b6_text_export.jpeg)

Each window shows the reset schedule below the input so it's always clear when spend resets.

![Step 4 - reset hints](https://colony-recorder.s3.amazonaws.com/files/2026-04-01/8754f121-1640-4892-9dd0-fd4a870418bf/ascreenshot_8079eb0df2194e8f99e5258ba4b3c082_text_export.jpeg)


### ✨ Virtual Key (Model Specific)

Set a separate budget for each model available to a virtual key. For example, one key can have:

- A $0.0000001 daily budget for `{{openai_large}}`
- A $10 budget every 30 days for `{{openai_small}}`

<EnterpriseFeature />

`model_max_budget` uses the **[`Dict[str, GenericBudgetInfo]`](#genericbudgetinfo)** schema.

```bash
curl 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "model_max_budget": {"{{openai_large}}": {"budget_limit": "0.0000001", "time_period": "1d"}}
}'
```

**Via Dashboard**

To add a per-model budget to a new key, go to **Virtual Keys → Create Key → Optional Settings → Per-Model Budgets**. To update an existing key, open the key's edit page and use the same section.

![Per-Model Budgets on the key form](https://raw.githubusercontent.com/yassin-berriai/litellm-pr-media/main/lit-5894/key-per-model-budget-empty.png)

Select **+ Add Model Budget**, choose a model, set the spending limit, and select the budget period. Each model has its own tracking and reset schedule. For example, a daily limit on one model does not affect a monthly limit on another. Limits can be less than $0.01.

![A per-model budget filled in](https://raw.githubusercontent.com/yassin-berriai/litellm-pr-media/main/lit-5894/key-per-model-budget-filled.png)

#### How LiteLLM matches model names

LiteLLM matches a budget against the model name in the request and its provider-prefixed form. For example, a budget for `claude-opus-4-8` applies to requests that use any of these names:

- `claude-opus-4-8`
- `anthropic/claude-opus-4-8`
- `bedrock/anthropic.claude-opus-4-8`
- `us.anthropic.claude-opus-4-8`

Set the budget using the name configured in `model_list`. If you route the same model under multiple names, use the unprefixed model family name so that one budget applies to all supported variants.

#### View current usage

`/key/info` returns `model_max_budget_usage` together with `model_max_budget`. For each budgeted model, it reports the amount spent during the current budget period. LiteLLM uses the same usage value to enforce the budget, so the reported usage is consistent with enforcement.

```bash
curl -X GET 'http://0.0.0.0:4000/key/info?key=sk-...' \
--header 'Authorization: Bearer <your-master-key>'
```

```json
{
  "info": {
    "model_max_budget": {"{{openai_large}}": {"budget_limit": 0.0001, "time_period": "30d"}},
    "model_max_budget_usage": {
      "{{openai_large}}": {"current_spend": 0.0002, "budget_limit": 0.0001, "time_period": "30d"}
    }
  }
}
```

If a model's `time_period` is missing or invalid, the model is omitted from `model_max_budget_usage` instead of being reported with zero usage.

#### Test the budget

With the small `{{openai_large}}` budget shown above, the first request should succeed. The second request should be rejected after the key exceeds the limit.

**[LangChain and OpenAI SDK usage examples](../proxy/user_keys#request-format)**

<Tabs>
<TabItem label="Successful call" value="allowed">

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <sk-generated-key>' \
--data ' {
      "model": "{{openai_large}}",
      "messages": [
        {
          "role": "user",
          "content": "testing request"
        }
      ]
    }
'
```

</TabItem>
<TabItem label="Rejected call" value="not-allowed">

Send the same request again. LiteLLM rejects it after the key exceeds its `{{openai_large}}` budget.

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <sk-generated-key>' \
--data ' {
      "model": "{{openai_large}}",
      "messages": [
        {
          "role": "user",
          "content": "testing request"
        }
      ]
    }
'
```

Expected response:

```json
{
    "error": {
        "message": "LiteLLM Virtual Key: 9769f3f6768a199f76cc29xxxx, key_alias: None, exceeded budget for model={{openai_large}}",
        "type": "budget_exceeded",
        "param": null,
        "code": "400"
    }
}
```

</TabItem>
</Tabs>

By default, LiteLLM returns a `budget_exceeded` error when a per-model budget is exceeded. To route the request to another model instead, see [Budget Fallbacks](./budget_fallbacks).

### ✨ Internal User (Model Specific)

Use an internal-user per-model budget to apply one limit across all keys owned by that user. This prevents a user from bypassing the limit by creating another key. For example, use this scope to give each engineer a $200 monthly Opus budget when engineers have multiple keys.

<EnterpriseFeature />

`model_max_budget` uses the same **[`Dict[str, GenericBudgetInfo]`](#genericbudgetinfo)** schema as the key-level setting. You can configure it with either `/user/new` or `/user/update`.

```bash
curl 'http://0.0.0.0:4000/user/new' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "user_id": "engineer-1",
  "model_max_budget": {"{{anthropic_large}}": {"budget_limit": 200, "time_period": "1mo"}}
}'
```

Use `1mo` for a calendar-month budget that resets on the first day of each month. After the user exceeds the limit, LiteLLM rejects requests made with any of the user's keys:

```json
{
    "error": {
        "message": "LiteLLM User: engineer-1, exceeded budget for model={{anthropic_large}}",
        "type": "budget_exceeded",
        "param": null,
        "code": "429"
    }
}
```

`/user/info` returns each model's spend for the current budget period in `model_max_budget_usage`, using the same format as `/key/info`.

**Via Dashboard**

Go to **Internal Users**, select the user, and then open **Details → Edit → Per-Model Budgets**. For each existing budget, the dashboard shows the amount spent during the current period.

![Per-Model Budgets on an internal user](https://raw.githubusercontent.com/yassin-berriai/litellm-pr-media/main/lit-5894/user-per-model-budget.png)

User-level and key-level budgets are tracked independently. If a key has its own per-model budget, each request counts toward both the key budget and the owner's user budget. LiteLLM rejects the request when either limit is exceeded.


### Agents

Set budgets and rate limits on agents registered with LiteLLM's [Agent Gateway](../a2a.md). You can control:
- **Per-agent rate limits**: `tpm_limit` and `rpm_limit` on the agent itself
- **Per-session rate limits**: `session_tpm_limit` and `session_rpm_limit` applied per session
- **Per-session iteration cap**: `max_iterations` in agent `litellm_params`
- **Per-session budget cap**: `max_budget_per_session` in agent `litellm_params`

<Tabs>
<TabItem value="agent-rate-limits" label="Agent Rate Limits">

Set `tpm_limit` and `rpm_limit` on the agent to cap total throughput across all sessions.

```bash
curl -X POST 'http://localhost:4000/v1/agents' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_name": "my-research-agent",
    "agent_card_params": {
      "name": "my-research-agent",
      "description": "A research agent",
      "url": "http://my-agent:8080",
      "version": "1.0.0"
    },
    "tpm_limit": 100000,
    "rpm_limit": 100
  }'
```

</TabItem>
<TabItem value="session-rate-limits" label="Session Rate Limits">

Set `session_tpm_limit` and `session_rpm_limit` to cap throughput per individual session.

```bash
curl -X POST 'http://localhost:4000/v1/agents' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_name": "my-research-agent",
    "agent_card_params": {
      "name": "my-research-agent",
      "description": "A research agent",
      "url": "http://my-agent:8080",
      "version": "1.0.0"
    },
    "session_tpm_limit": 50000,
    "session_rpm_limit": 50
  }'
```

</TabItem>
<TabItem value="session-budgets" label="Session Budgets">

Set `max_iterations` and `max_budget_per_session` in agent `litellm_params` to cap individual sessions. Requires `require_trace_id_on_calls_by_agent` so LiteLLM can track calls per session.

```bash
curl -X POST 'http://localhost:4000/v1/agents' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_name": "my-research-agent",
    "agent_card_params": {
      "name": "my-research-agent",
      "description": "A research agent",
      "url": "http://my-agent:8080",
      "version": "1.0.0"
    },
    "litellm_params": {
      "require_trace_id_on_calls_by_agent": true,
      "max_iterations": 25,
      "max_budget_per_session": 5.00
    }
  }'
```

When a session exceeds the limit, requests receive a **429 Too Many Requests** response.

See the [Agent Iteration Budgets](../a2a_iteration_budgets) guide for full details.

</TabItem>
</Tabs>

:::info

You can also update rate limits on existing agents using `PATCH /v1/agents/{agent_id}`:

```bash
curl -X PATCH 'http://localhost:4000/v1/agents/<agent_id>' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "tpm_limit": 200000,
    "rpm_limit": 200,
    "session_tpm_limit": 50000,
    "session_rpm_limit": 50
  }'
```

:::


### Customers

Use this to budget `user` passed to `/chat/completions`, **without needing to create a key for every user**

**Step 1. Create the budget**

```shell
curl --location 'http://0.0.0.0:4000/budget/new' \
        --header 'Authorization: Bearer sk-1234' \
        --header 'Content-Type: application/json' \
        --data '{
        "budget_id": "default-customer-budget",
        "max_budget": 0.0001
        }'
```

**Step 2. Point `max_end_user_budget_id` at that budget in config.yaml**

```yaml
general_settings:
  master_key: sk-1234

litellm_settings:
  max_end_user_budget_id: "default-customer-budget" # applied to any 'user' without their own budget
```

This budget applies to every customer that has no budget of their own, including customers that don't exist in the database yet. LiteLLM caches the budget object for 60 seconds, so edits to it take up to a minute to apply. The float setting `max_end_user_budget` is no longer enforced; if you have it in your config, replace it with `max_end_user_budget_id` as shown above.

3. Make a /chat/completions call, pass 'user' - First call Works 
```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
        --header 'Content-Type: application/json' \
        --header 'Authorization: Bearer sk-zi5onDRdHGD24v0Zdn7VBA' \
        --data ' {
        "model": "azure-gpt-3.5",
        "user": "ishaan3",
        "messages": [
            {
            "role": "user",
            "content": "what time is it"
            }
        ]
        }'
```

4. Make a /chat/completions call, pass 'user' - Call Fails, since 'ishaan3' over budget
```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
        --header 'Content-Type: application/json' \
        --header 'Authorization: Bearer sk-zi5onDRdHGD24v0Zdn7VBA' \
        --data ' {
        "model": "azure-gpt-3.5",
        "user": "ishaan3",
        "messages": [
            {
            "role": "user",
            "content": "what time is it"
            }
        ]
        }'
```

Error
```shell
{"error":{"message":"ExceededBudget: End User=ishaan3 over budget. Spend=0.0008869999999999999, Budget=0.0001","type":"auth_error","param":"None","code":401}}%
```

Customer budgets are global per deployment. Spend is tracked against the customer id alone, so the same customer shares one budget across every virtual key and team, and a customer budget can't be scoped to a single key or team.

## Reset Budgets 

Reset budgets across keys/internal users/teams/customers

`budget_duration`: Budget is reset at the end of specified duration. If not set, budget is never reset. You can set duration as seconds ("30s"), minutes ("30m"), hours ("30h"), days ("30d").

<Tabs>
<TabItem value="users" label="Internal Users">

```bash
curl 'http://0.0.0.0:4000/user/new' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "max_budget": 10,
  "budget_duration": "30s", # 👈 KEY CHANGE
}'
```
</TabItem>
<TabItem value="keys" label="Keys">

```bash
curl 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "max_budget": 10,
  "budget_duration": "30s", # 👈 KEY CHANGE
}'
```

</TabItem>
<TabItem value="teams" label="Teams">

```bash
curl 'http://0.0.0.0:4000/team/new' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "max_budget": 10,
  "budget_duration": "30s", # 👈 KEY CHANGE
}'
```
</TabItem>
</Tabs>

**Note:** By default, the server checks for resets every 10 minutes, to minimize DB calls.

To change this, set `proxy_budget_rescheduler_min_time` and `proxy_budget_rescheduler_max_time`

E.g.: Check every 1 seconds
```yaml
general_settings: 
  proxy_budget_rescheduler_min_time: 1
  proxy_budget_rescheduler_max_time: 1
```

## Fallback to 'free' models

If a key/user/team is at its budget limit, requests to models configured with `input_cost_per_token: 0` and `output_cost_per_token: 0` are still allowed. Budget checks are skipped entirely for zero-cost models.

This lets you configure free or self-hosted models as a fallback that budget-exhausted keys can still access.

To mark a model as free, set both cost fields explicitly to `0` in your `config.yaml`:

```yaml
model_list:
  - model_name: my-free-model
    litellm_params:
      model: ollama/llama3
      input_cost_per_token: 0
      output_cost_per_token: 0
```

**Note:** The cost fields must be explicitly set to `0`. If they are unset (`null`/missing), the model is not treated as free and budget checks still apply.

## Budget reservation

Budget reservation is enabled by default. It helps enforce budgets during concurrent traffic by accounting for a request before the provider processes it.

### How it works

1. LiteLLM estimates the request's maximum cost from the request body and the model's pricing.
2. It temporarily reserves that amount against the applicable budget.
3. If the reservation would exceed the budget, LiteLLM rejects the request before sending it to the provider.
4. After the response is priced, LiteLLM replaces the reservation with the actual cost.

When `max_tokens` or `max_completion_tokens` is present, LiteLLM uses that value in the estimate. Otherwise, it uses the model's configured limits. For routes without token pricing, such as some image and audio routes, LiteLLM cannot reserve a cost and instead enforces the budget using recorded spend.

### Disable budget reservation

Disable reservation only as a temporary mitigation if unreconciled reservations cause unexpected `BudgetExceededError` responses after the affected requests have completed:

```yaml
general_settings:
  disable_budget_reservation: true
```

:::warning

Disabling reservation can allow concurrent requests to exceed a configured budget because each request is evaluated only against spend already recorded.

:::

Requests are still rejected when the budget is already exhausted. LiteLLM also logs a warning for each request while reservation is disabled.

If a budget must remain a hard ceiling when Redis is unavailable or contains stale data, keep reservation enabled and also configure [`fail_closed_budget_enforcement`](#hard-budget-enforcement-fail-closed).

### Batch requests

Budget reservation cannot estimate the full cost of a batch job. A `POST /batches` request contains an `input_file_id` rather than the prompts in the file, so LiteLLM cannot price the complete workload at submission. The submission reservation is released after the submission response, and LiteLLM records the final cost when the batch completes.

Use [batch rate limiting](../batches#how-rate-limiting-for-batches-api-works) to control batch throughput, and monitor completed batch costs for budget reporting.

## Hard budget enforcement (fail closed)

Budget checks read current spend from a cross-pod counter in Redis, which keeps enforcement fast and consistent across workers and replicas. The counter is the source of truth on the hot path, and the database is reconciled in the background. If Redis restarts and reloads an older snapshot, the counter can come back lower than the spend already recorded in the database; on the hot path that stale value is trusted, which can let a key keep spending past its `max_budget` until the counter is corrected.

For deployments where a configured budget must be a hard ceiling even while Redis is degraded, set `fail_closed_budget_enforcement`:

```yaml
general_settings:
  fail_closed_budget_enforcement: true
```

With it enabled, every budgeted request validates spend against the authoritative database before being admitted (covering key, team, user, organization, end-user, tag, and per-window budgets), so a stale or missing Redis counter cannot under-report spend. The database read is coalesced and cached in-process for a few seconds, so the extra load is bounded to roughly one read per budgeted entity per cache window per worker rather than one read per request. If current spend can be verified against neither Redis nor the database, the request is rejected with a `503` instead of being admitted on an unverifiable budget.

Leave the setting off (the default) to keep healthy under-budget traffic entirely off the database; in the default mode the counter is still cross-checked against the database whenever it reads below the caller's last-known recorded spend, which catches the common stale-counter case without a per-request database read.

## Set Rate Limits 

You can set: 
- tpm limits (tokens per minute)
- rpm limits (requests per minute)
- max parallel requests
- rpm / tpm limits per model for a given key or team

### TPM Rate Limit Type (Input/Output/Total)

By default, TPM (tokens per minute) rate limits count **total tokens** (input + output). You can configure this to count only input tokens or only output tokens instead.

Set `token_rate_limit_type` in your `config.yaml`:

```yaml
general_settings:
  master_key: sk-1234
  token_rate_limit_type: "output"  # Options: "input", "output", "total" (default)
```

| Value | Description |
|-------|-------------|
| `total` | Count total tokens (prompt + completion). **Default behavior.** |
| `input` | Count only prompt/input tokens |
| `output` | Count only completion/output tokens |

This setting applies globally to all TPM rate limit checks (keys, users, teams, etc.).

### Estimated Output Tokens (requests without `max_tokens`)

TPM limits are enforced by reserving tokens before the call and reconciling against real usage after it. When a request omits `max_tokens` / `max_completion_tokens`, LiteLLM has to guess how many output tokens to reserve, and the built-in guess is a single static estimate shared by every key, team and model.

That guess is wrong in both directions. If your model really emits more than the estimate, concurrent requests are all admitted against an under-reservation and the window overruns the limit once they finish. If it emits far less, the over-reservation blocks requests the budget could have served.

Declare what your models actually emit with `default_estimated_output_tokens` (one value) and `default_estimated_output_tokens_per_model` (a map of model name to value). Both are settable on a key and on a team.

```shell
curl --location 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "team_id": "my-prod-team",
  "tpm_limit": 1000000,
  "default_estimated_output_tokens": 2048,
  "default_estimated_output_tokens_per_model": {
    "{{openai_large}}": 4096,
    "{{openai_small}}": 1024
  }
}'
```

The same two fields work on `/team/new` and `/team/update`, and both are editable from the Admin UI on the key and team settings pages.

```shell
curl --location 'http://0.0.0.0:4000/team/update' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "team_id": "my-prod-team",
  "default_estimated_output_tokens": 4096,
  "default_estimated_output_tokens_per_model": {"{{openai_large}}": 8192}
}'
```

**Resolution order** for the reserved output budget, first match wins:

| Priority | Source |
| --- | --- |
| 1 | Request `max_tokens` or `max_completion_tokens` |
| 2 | Key `default_estimated_output_tokens_per_model[model]` |
| 3 | Key `default_estimated_output_tokens` |
| 4 | Team `default_estimated_output_tokens_per_model[model]` |
| 5 | Team `default_estimated_output_tokens` |
| 6 | Built-in static estimate |

Values must be positive integers, and the management endpoints reject anything else with a `422` naming the offending field. A value that is missing, or malformed because it was written straight into `metadata` rather than through these fields, falls through to the next tier, so a key that declares nothing behaves exactly as it does today. Embedding requests are unaffected since they produce no output tokens.

:::tip
Size the estimate from your observed output distribution for that model, around the p95, not from its maximum context. Both directions cost you something:

- Declaring **more** than the model emits throttles traffic the budget could have served. If the declared value plus the input estimate exceeds the limit the request is charged against, every such request is refused, and the proxy logs the reservation and the limit at debug level so you can see why.
- Declaring **less** than the model emits is worse than declaring nothing, because the reservation is then smaller than the built-in estimate and more concurrent requests are admitted before the real usage lands.
:::

:::note
The proxy already hard-caps generation for tenants whose smallest applicable TPM limit is under 4096, by injecting a `max_tokens` of a quarter of that limit. A declaration larger than that cap raises it, so you are never truncated below what you said your model emits. A declaration smaller than it is ignored, because an estimate describes the typical response and must not silently truncate the long tail.
:::


<Tabs>
<TabItem value="per-team" label="Per Team">

Use `/team/new` or `/team/update`, to persist rate limits across multiple keys for a team.


```shell
curl --location 'http://0.0.0.0:4000/team/new' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{"team_id": "my-prod-team", "max_parallel_requests": 10, "tpm_limit": 20, "rpm_limit": 4}' 
```

[**See Swagger**](https://litellm-api.up.railway.app/#/team%20management/new_team_team_new_post)

**Expected Response**

```json
{
    "key": "sk-sA7VDkyhlQ7m8Gt77Mbt3Q",
    "expires": "2024-01-19T01:21:12.816168",
    "team_id": "my-prod-team"
}
```

</TabItem>
<TabItem value="per-team-model" label="Per Team Per Model">

**Set rate limits per model for a team**

Use `model_rpm_limit` and `model_tpm_limit` to set rate limits per model for all keys belonging to a team. These limits apply across all keys in the team and are inherited by keys unless overridden at the key level.

Use `/team/new` or `/team/update` with `model_rpm_limit` and `model_tpm_limit` as dictionaries mapping model names to their limits:

```shell
curl --location 'http://0.0.0.0:4000/team/new' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "team_id": "my-prod-team",
  "model_rpm_limit": {"{{openai_large}}": 100, "{{openai_small}}": 200},
  "model_tpm_limit": {"{{openai_large}}": 10000, "{{openai_small}}": 20000}
}'
```

**Update existing team with per-model limits:**

```shell
curl --location 'http://0.0.0.0:4000/team/update' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "team_id": "my-prod-team",
  "model_rpm_limit": {"{{openai_large}}": 100, "{{openai_small}}": 200},
  "model_tpm_limit": {"{{openai_large}}": 10000, "{{openai_small}}": 20000}
}'
```

**Alternative: Use metadata**

You can also pass per-model limits via the `metadata` field:

```shell
curl --location 'http://0.0.0.0:4000/team/update' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "team_id": "my-prod-team",
  "metadata": {
    "model_rpm_limit": {"{{openai_large}}": 100, "{{openai_small}}": 200},
    "model_tpm_limit": {"{{openai_large}}": 10000, "{{openai_small}}": 20000}
  }
}'
```

**Resolution order:** When a key belongs to a team, rate limits are resolved as: **Key metadata > Key model_max_budget > Team metadata**. Keys can override team-level per-model limits with their own `model_rpm_limit` or `model_tpm_limit`.

**Verify:** Make a `/chat/completions` request and check response headers `x-litellm-key-remaining-requests-{model}` and `x-litellm-key-remaining-tokens-{model}` for the model-specific limits.

[**See Swagger**](https://litellm-api.up.railway.app/#/team%20management/new_team_team_new_post)

</TabItem>
<TabItem value="per-user" label="Per Internal User">

Use `/user/new` or `/user/update`, to persist rate limits across multiple keys for internal users.


```shell
curl --location 'http://0.0.0.0:4000/user/new' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{"user_id": "krrish@berri.ai", "max_parallel_requests": 10, "tpm_limit": 20, "rpm_limit": 4}' 
```

[**See Swagger**](https://litellm-api.up.railway.app/#/user%20management/new_user_user_new_post)

**Expected Response**

```json
{
    "key": "sk-sA7VDkyhlQ7m8Gt77Mbt3Q",
    "expires": "2024-01-19T01:21:12.816168",
    "user_id": "krrish@berri.ai"
}
```

</TabItem>
<TabItem value="per-key" label="Per Key">

Use `/key/generate`, if you want them for just that key.

```shell
curl --location 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{"max_parallel_requests": 10, "tpm_limit": 20, "rpm_limit": 4}' 
```

**Expected Response**

```json
{
    "key": "sk-ulGNRXWtv7M0lFnnsQk0wQ",
    "expires": "2024-01-18T20:48:44.297973",
    "user_id": "78c2c8fc-c233-43b9-b0c3-eb931da27b84"  // 👈 auto-generated
}
```

</TabItem>
<TabItem value="per-key-model" label="Per API Key Per model">

**Set rate limits per model per api key**

Set `model_rpm_limit` and `model_tpm_limit` to set rate limits per model per api key

Here `{{openai_large}}` is the `model_name` set on the [litellm config.yaml](configs.md)

```shell
curl --location 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{"model_rpm_limit": {"{{openai_large}}": 2}, "model_tpm_limit": {"{{openai_large}}":}}' 
```

**Expected Response**

```json
{
    "key": "sk-ulGNRXWtv7M0lFnnsQk0wQ",
    "expires": "2024-01-18T20:48:44.297973"
}
```

**Verify Model Rate Limits set correctly for this key**

**Make /chat/completions request check if `x-litellm-key-remaining-requests-gpt-5.6-terra` returned**

```shell
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ulGNRXWtv7M0lFnnsQk0wQ" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [
      {"role": "user", "content": "Hello, Claude!ss eho ares"}
    ]
  }'
```


**Expected headers**

```shell
x-litellm-key-remaining-requests-gpt-5.6-terra: 1
x-litellm-key-remaining-tokens-gpt-5.6-terra: 179
```

These headers indicate:

- 1 request remaining for the gpt-5.6-terra model for key=`sk-ulGNRXWtv7M0lFnnsQk0wQ`
- 179 tokens remaining for the gpt-5.6-terra model for key=`sk-ulGNRXWtv7M0lFnnsQk0wQ`

</TabItem>
<TabItem value="per-agent" label="Per Agent">

Set rate limits on agents registered with the [Agent Gateway](../a2a.md).

**Agent-level limits** cap total throughput across all sessions:

```shell
curl -X POST 'http://0.0.0.0:4000/v1/agents' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{"agent_name": "my-agent", "agent_card_params": {"name": "my-agent", "description": "My agent", "url": "http://my-agent:8080", "version": "1.0.0"}, "tpm_limit": 100000, "rpm_limit": 100}'
```

**Session-level limits** cap throughput per individual session:

```shell
curl -X POST 'http://0.0.0.0:4000/v1/agents' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{"agent_name": "my-agent", "agent_card_params": {"name": "my-agent", "description": "My agent", "url": "http://my-agent:8080", "version": "1.0.0"}, "session_tpm_limit": 50000, "session_rpm_limit": 50}'
```

You can also set **max_iterations** (call count cap) and **max_budget_per_session** (dollar cap) per session via `litellm_params`. See [Agent Iteration Budgets](../a2a_iteration_budgets) for details.

</TabItem>
<TabItem value="per-end-user" label="For customers">

:::info 

You can also create a budget id for a customer on the UI, under the 'Rate Limits' tab.

:::

Use this to set rate limits for `user` passed to `/chat/completions`, without needing to create a key for every user

#### Step 1. Create Budget

Set a `tpm_limit` on the budget (You can also pass `rpm_limit` if needed)

```shell
curl --location 'http://0.0.0.0:4000/budget/new' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
    "budget_id" : "free-tier",
    "tpm_limit": 5
}'
```


#### Step 2. Create `Customer` with Budget

We use `budget_id="free-tier"` from Step 1 when creating this new customers

```shell
curl --location 'http://0.0.0.0:4000/customer/new' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
    "user_id" : "palantir",
    "budget_id": "free-tier"
}'
```


#### Step 3. Pass `user_id` id in `/chat/completions` requests

Pass the `user_id` from Step 2 as `user="palantir"` 

```shell
curl --location 'http://localhost:4000/chat/completions' \
    --header 'Authorization: Bearer sk-1234' \
    --header 'Content-Type: application/json' \
    --data '{
    "model": "llama3",
    "user": "palantir",
    "messages": [
        {
        "role": "user",
        "content": "gm"
        }
    ]
}'
```


</TabItem>
</Tabs>

## Set default budget for ALL internal users 

Use this to set a default budget for users who you give keys to.

This will apply when a user has [`user_role="internal_user"`](./self_serve.md#available-roles) (set this via `/user/new` or `/user/update`). 

This will NOT apply if a key has a team_id (team budgets will apply then). [Tell us how we can improve this!](https://github.com/BerriAI/litellm/issues)

1. Define max budget in your config.yaml

```yaml
model_list: 
  - model_name: "{{openai_small}}"
    litellm_params:
      model: {{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  max_internal_user_budget: 0 # amount in USD
  internal_user_budget_duration: "1mo" # reset every month
```

2. Create key for user 

```bash
curl -L -X POST 'http://0.0.0.0:4000/key/generate' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{}'
```

Expected Response: 

```bash
{
  ...
  "key": "sk-X53RdxnDhzamRwjKXR4IHg"
}
```

3. Test it! 

```bash
curl -L -X POST 'http://0.0.0.0:4000/chat/completions' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer sk-X53RdxnDhzamRwjKXR4IHg' \
-d '{
    "model": "{{openai_small}}",
    "messages": [{"role": "user", "content": "Hey, how's it going?"}]
}'
```

Expected Response: 

```bash
{
    "error": {
        "message": "ExceededBudget: User=<user_id> over budget. Spend=3.7e-05, Budget=0.0",
        "type": "budget_exceeded",
        "param": null,
        "code": "400"
    }
}
```

### Multi-instance rate limiting


**Important Notes:**
- **Rate limits do not apply to proxy admin users.** 
- When testing rate limits, use internal user roles (non-admin) to ensure limits are enforced as expected.

Changes: 
- This moves to using async_increment instead of async_set_cache when updating current requests/tokens. 
- The in-memory cache is synced with redis every 0.01s, to avoid calling redis for every request. 
- In testing, this was found to be 2x faster than the previous implementation, and reduced drift between expected and actual fails to at most 10 requests at high-traffic (100 RPS across 3 instances). 


## Grant Access to new model 

Use model access groups to give users access to select models, and add new ones to it over time (e.g. mistral, llama-2, etc.). 

Difference between doing this with `/key/generate` vs. `/user/new`? If you do it on `/user/new` it'll persist across multiple keys generated for that user.

**Step 1. Assign model, access group in config.yaml**

```yaml
model_list:
  - model_name: text-embedding-ada-002
    litellm_params:
      model: azure/azure-embedding-model
      api_base: "os.environ/AZURE_API_BASE"
      api_key: "os.environ/AZURE_API_KEY"
      api_version: "2023-07-01-preview"
    model_info:
      access_groups: ["beta-models"] # 👈 Model Access Group
```

**Step 2. Create key with access group**

```bash
curl --location 'http://localhost:4000/user/new' \
-H 'Authorization: Bearer <your-master-key>' \
-H 'Content-Type: application/json' \
-d '{"models": ["beta-models"], # 👈 Model Access Group
			"max_budget": 0}'
```


## Create new keys for existing internal user

Just include user_id in the `/key/generate` request.

```bash
curl --location 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data '{"models": ["azure-models"], "user_id": "krrish@berri.ai"}'
```


## API Specification 

### `GenericBudgetInfo`

A Pydantic model that defines budget information with a time period and limit.

```python
class GenericBudgetInfo(BaseModel):
    budget_limit: float  # The maximum budget amount in USD
    time_period: str    # Duration string like "1d", "30d", etc.
```

#### Fields:
- `budget_limit` (float): The maximum budget amount in USD
- `time_period` (str): Duration string specifying the time period for the budget. Supported formats:
  - Seconds: "30s"
  - Minutes: "30m" 
  - Hours: "30h"
  - Days: "30d"

#### Example:
```json
{
  "budget_limit": "0.0001",
  "time_period": "1d"
}
```
