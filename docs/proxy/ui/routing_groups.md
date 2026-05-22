import Image from '@theme/IdealImage';

# Manage Routing Groups

Routing groups let you apply different routing strategies to different models in the same router — for example, latency-based routing for `gpt-4o` while cheaper models use simple-shuffle. You can manage them from the LiteLLM dashboard without editing your `proxy_config.yaml`.

For the conceptual overview and full strategy reference, see [Routing Groups - Per-Model Strategies](../../routing.md#routing-groups---per-model-strategies).

> Click any screenshot below to open the full Scribe walkthrough.

## Via the UI

### Routing Group Settings

Navigate to **General Settings** in the sidebar and select the **Routing Groups** section.

[![Open Routing Groups settings](../../../static/img/routing-groups/access-rg-settings.png)](https://scribehow.com/viewer/Accessing_Routing_Groups_in_Settings__hxNoFOtLQeSfOvcLYgzXzA)

### Create a Routing Group

Click **Add Routing Group**, then fill in:

- **Group name** — a unique identifier (e.g. `anthropic-latency`). The name `default` is reserved.
- **Models** — one or more `model_name`s from your model list. Each model may belong to at most one group.
- **Routing strategy** — the strategy to apply to this group (e.g. `latency-based-routing`, `usage-based-routing-v2`, `simple-shuffle`).
- **Routing strategy args** *(optional)* — strategy-specific overrides such as `ttl`, `rpm`, or `tpm`.

Click **Save** to create the group.

[![Create a routing group](../../../static/img/routing-groups/create-rg.png)](https://scribehow.com/viewer/Create_a_New_Latency_Based_Routing_Group__y3EoV7U7QOaNdR1YrD-03w)

### Edit a Routing Group

Click the group row in the table to open it, then update any field — for example, change the `ttl` under **Routing strategy args** to tune how quickly the strategy reacts to latency changes. Click **Save** to apply.

[![Edit a routing group](../../../static/img/routing-groups/update-rg.png)](https://scribehow.com/viewer/How_To_Configure_Strategy_Arguments_In_Router_Settings__u98H3SRAQKK-qHOa1Tbx9g)

### Delete a Routing Group

Click the **Delete** action on the group row and confirm. Models that were in the deleted group immediately fall back to the default routing strategy.

[![Delete a routing group](../../../static/img/routing-groups/delete-rg.png)](https://scribehow.com/viewer/How_To_Delete_A_Router_Setting__O96ij__rQj6QjOurwOqSFA)

## Via `proxy_config.yaml`

You can also define routing groups in your proxy configuration file. Settings configured via the UI are persisted and override the values defined here.

```yaml
router_settings:
  # fallback strategy for models not in any explicit group
  routing_strategy: simple-shuffle

  routing_groups:
    - group_name: anthropic-latency
      models: [claude-sonnet, claude-opus]
      routing_strategy: latency-based-routing
      routing_strategy_args:
        ttl: 3600
```

See [Routing Groups - Per-Model Strategies](../../routing.md#routing-groups---per-model-strategies) for the full schema, multi-group examples, and runtime update behavior.

## Test a Request

After configuring a group, confirm that requests to a grouped model are actually being routed by that group's strategy. LiteLLM logs the `routing_group`, `model`, and `strategy` chosen for every request, so verification comes down to sending a request and inspecting the proxy logs.

### 1. Send a request

Send a request to a `model_name` that's claimed by a routing group:

```bash
curl -X POST 'http://localhost:4000/v1/chat/completions' \
  -H 'Authorization: Bearer <your-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "claude-sonnet",
    "messages": [{"role": "user", "content": "ping"}]
  }'
```

![Send a request](../../../static/img/routing-groups/model-request.png)

### 2. Inspect the proxy logs

Each request emits a log line containing `routing_group=<name> model=<model> strategy=<strategy>`.

**Plain logs** — grep the proxy stdout directly:

```bash
kubectl logs -n litellm -l app=litellm --tail=200 | grep routing_group=
```

**Loki (LogQL)** — extract and reformat the fields for a clean readout:

```logql
{namespace="litellm", pod=~"<your-litellm-pod-regex>"} |= "routing_group="
| regexp `routing_group=(?P<routing_group>\S+) model=(?P<model>\S+) strategy=(?P<strategy>\S+)`
| line_format `{{.routing_group}} {{.model}} {{.strategy}}`
```

![Verify the routing group in logs](../../../static/img/routing-groups/verify-rg.png)

A row like `anthropic-latency claude-sonnet latency-based-routing` confirms the request hit the expected group. If you instead see `default <strategy>`, the model isn't claimed by the group — check the group's **Models** list.

## Notes

- Each `model_name` may belong to **at most one** routing group. Overlap is rejected.
- The group name `default` is reserved for the implicit fallback group.
- Updates take effect immediately — per-group state is rebuilt on save.
