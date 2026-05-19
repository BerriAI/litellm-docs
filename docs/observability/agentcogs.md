import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AgentCOGS - Per-customer margin

[AgentCOGS](https://github.com/vaibhav11123/agentcogs) tracks per-customer LLM cost and gross margin for B2B SaaS (cost + revenue), alongside your existing proxy and observability stack.

## Quick Start

Use one line to send successful completion cost to AgentCOGS:

Get your AgentCOGS [API key and workspace id](https://github.com/vaibhav11123/agentcogs/blob/main/docs/quickstart.md).

```python
litellm.success_callback = ["agentcogs"]
```

<Tabs>
<TabItem value="sdk" label="SDK">

```python
import litellm
import os

os.environ["AGENTCOGS_API_KEY"] = ""
os.environ["AGENTCOGS_WORKSPACE_ID"] = ""
os.environ["AGENTCOGS_ENDPOINT"] = "https://api.agentcogs.dev"  # optional

litellm.success_callback = ["agentcogs"]

response = litellm.completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hi"}],
    user="your_customer_id",  # B2B tenant id → AgentCOGS customer_id
    metadata={"agentcogs_workflow_id": "support_bot"},
)
```

</TabItem>
<TabItem value="proxy" label="PROXY">

```yaml
litellm_settings:
  callbacks: ["agentcogs"]
```

Set `AGENTCOGS_API_KEY`, `AGENTCOGS_WORKSPACE_ID`, and optionally `AGENTCOGS_ENDPOINT` in the proxy environment.

</TabItem>
</Tabs>

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENTCOGS_API_KEY` | Yes | Workspace API key (`acg_live_...`) |
| `AGENTCOGS_WORKSPACE_ID` | Yes | Workspace UUID |
| `AGENTCOGS_ENDPOINT` | No | API base URL (default `https://api.agentcogs.dev`) |
| `AGENTCOGS_CHARGE_BY` | No | Proxy attribution: `end_user_id` (default), `user_id`, `team_id` — same as [Lago](./lago.md) |

## Tenant attribution

**Proxy:** Uses `AGENTCOGS_CHARGE_BY` (default `end_user_id` from request `user` in proxy body). Client `metadata.agentcogs_customer_id` is not trusted on proxy traffic.

**SDK / direct:** Pass `user=` on each completion, or `metadata.agentcogs_customer_id`.

Completions without a resolvable customer id are skipped (non-blocking).

## Learn more

- [AgentCOGS quickstart](https://github.com/vaibhav11123/agentcogs/blob/main/docs/quickstart.md)
- [User-landed callback](https://github.com/vaibhav11123/agentcogs/blob/main/docs/integrations/litellm.md)
