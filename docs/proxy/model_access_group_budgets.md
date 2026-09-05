import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Model Access Group Budgets

Give a [model access group](model_access_groups.md) one shared budget. Every key that reaches a model in the group draws from the same pool, so a tier of models can carry a single monthly allowance instead of a separate budget on each key.

This is the budget to reach for when the spend you care about belongs to the models rather than to any one caller: a "premium" tier that the whole org shares, a pool of expensive reasoning models, an evaluation group you want capped no matter who runs the evals.

## Pre-Requisites

- You must set up a Postgres database (e.g. Supabase, Neon, etc.)

## Setting a group budget

### 1. Put a model in an access group

Add `model_info.access_groups` to a deployment, either in `config.yaml` or through `/model/new`.

<Tabs>

<TabItem value="config" label="config.yaml">

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: premium-sonnet
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY
    model_info:
      access_groups: ["premium"]
```

</TabItem>

<TabItem value="api" label="API">

```shell
curl -X POST 'http://0.0.0.0:4000/model/new' \
     -H 'Authorization: Bearer sk-1234' \
     -H 'Content-Type: application/json' \
     -d '{
           "model_name": "premium-sonnet",
           "litellm_params": {"model": "anthropic/{{anthropic}}", "api_key": "os.environ/ANTHROPIC_API_KEY"},
           "model_info": {"access_groups": ["premium"]}
         }'
```

</TabItem>

</Tabs>

### 2. Set the group's budget

```shell
curl -X PUT 'http://0.0.0.0:4000/access_group/premium/budget' \
     -H 'Authorization: Bearer sk-1234' \
     -H 'Content-Type: application/json' \
     -d '{
           "max_budget": 500.0,
           "budget_duration": "30d"
         }'
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `max_budget` | float | No | Requests are refused once the group's shared spend reaches this |
| `soft_budget` | float | No | Fires an alert when reached; requests still succeed |
| `budget_duration` | string | No | How often the group's spend resets (`"1d"`, `"7d"`, `"30d"`, ...) |
| `budget_id` | string | No | Link an existing budget instead of creating one |

At least one of these is required. The call is idempotent, so sending it again replaces the group's budget rather than stacking a second one.

### 3. Grant a key the group

The key has to name the group in its `models` list. That grant is what ties the key's spend to the pool.

```shell
curl -X POST 'http://0.0.0.0:4000/key/generate' \
     -H 'Authorization: Bearer sk-1234' \
     -H 'Content-Type: application/json' \
     -d '{
           "models": ["premium"]
         }'
```

Teams, projects, organizations, and per-member team scopes work the same way: whichever allowlist granted the group is the one that counts.

### 4. Test it

Call a model in the group with that key until the pool runs out.

```shell
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
     -H 'Authorization: Bearer sk-your-premium-key' \
     -H 'Content-Type: application/json' \
     -d '{
           "model": "premium-sonnet",
           "messages": [{"role": "user", "content": "Hello"}]
         }'
```

Once the group's spend reaches `max_budget`, every key that can reach the group is refused, including keys that have spent nothing themselves:

```json
{
  "error": {
    "message": "Budget has been exceeded! Model access group=premium Current cost: 500.12, Max budget: 500.0",
    "type": "budget_exceeded",
    "param": null,
    "code": "429"
  }
}
```

## Reading and clearing the budget

Read the pool and the spend drawn against it:

```shell
curl -X GET 'http://0.0.0.0:4000/access_group/premium/budget' \
     -H 'Authorization: Bearer sk-1234'
```

```json
{
  "access_group": "premium",
  "spend": 245.5,
  "budget": {
    "budget_id": "f56842f7-78d7-4816-847d-b016af57df4c",
    "max_budget": 500.0,
    "soft_budget": null,
    "budget_duration": "30d",
    "budget_reset_at": "2026-09-28T00:00:00Z"
  }
}
```

Clearing the budget leaves the group and its models in place:

```shell
curl -X DELETE 'http://0.0.0.0:4000/access_group/premium/budget' \
     -H 'Authorization: Bearer sk-1234'
```

```json
{
  "access_group": "premium",
  "budget_deleted": true,
  "message": "Budget for access group 'premium' deleted successfully"
}
```

## Which requests draw from the pool

A request is charged to a group when two things are both true: the group serves the model being called, and the caller was granted that group **by name**. That second condition is the one to watch.

An allowlist that does not name a group names nothing to charge, so it never draws from the pool. That covers a key with `models: []` or `models: ["*"]`, a key granted `all-proxy-models`, and a key granted a wildcard like `openai/*`, even when the model it calls belongs to a budgeted group. Such a key can still call the model; its spend just lands on the key, user, team, and org budgets instead of the group's.

So an admin key or an unrestricted key is not held back by a group budget. If you want a group's cap to be the real ceiling for a set of callers, grant those callers the group itself rather than a wildcard.

Multiple groups are charged in full when more than one applies. A key granted both `premium` and `eval` calling a model that belongs to both draws the request's cost from each pool separately, and either pool being exhausted refuses the request.

## Related

- [Model Access Groups](model_access_groups.md) for creating and granting the groups themselves
- [Tag Budgets](tag_budgets.md) when the spend you want to cap follows a cost center rather than a set of models
- [Team Budgets](team_budgets.md) when it follows the callers
