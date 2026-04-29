import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# MCP Server Submissions

LiteLLM supports a submission and approval workflow for MCP servers. Team members can submit MCP servers for admin review — the server is held in a `pending_review` state until an admin approves or rejects it.

This lets organizations give team members self-service MCP registration without immediately exposing unapproved servers to all users.

:::info Related Documentation
- [MCP Overview](./mcp.md) - Adding and managing MCP servers
- [MCP Permission Management](./mcp_control.md) - Control MCP access by key, team, or org
:::

## How It Works

```
Team member submits MCP server
        ↓
Server saved as "pending_review" (NOT loaded into registry)
        ↓
Admin reviews in UI or via API
        ↓
Approve → server goes "active" and is loaded into the registry
Reject  → server stays out with optional review notes
```

**Prerequisites:**
- `store_model_in_db: true` must be set in your proxy config (required to persist MCP servers)
- The submitting user must use a **team-scoped API key** (admin keys use `POST /v1/mcp/server` directly)

```yaml title="config.yaml" showLineNumbers
general_settings:
  store_model_in_db: true
```

---

## User: Submit an MCP Server

### Via UI

Go to **MCP Servers** in the LiteLLM dashboard and click **"Submit MCP Server"**.

Fill in the form:
- **Server name** — unique name for the server
- **Transport** — `sse`, `http`, or `stdio`
- **URL** — the MCP server URL (required for `sse`/`http`)
- Any additional fields (description, auth, etc.)

The server is saved with `pending_review` status. It will not be available to users until an admin approves it.

### Via API

Use a team-scoped API key (admin keys are rejected — admins use `POST /v1/mcp/server` directly).

<Tabs>
<TabItem value="curl" label="curl">

```bash title="Submit MCP server for review" showLineNumbers
curl -X POST http://localhost:4000/v1/mcp/server/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEAM_API_KEY" \
  -d '{
    "server_name": "my-github-mcp",
    "url": "https://api.githubcopilot.com/mcp",
    "transport": "sse",
    "description": "GitHub MCP for code search and PR management"
  }'
```

</TabItem>
<TabItem value="python" label="Python">

```python title="Submit MCP server for review" showLineNumbers
import requests

response = requests.post(
    "http://localhost:4000/v1/mcp/server/register",
    headers={
        "Authorization": f"Bearer {team_api_key}",
        "Content-Type": "application/json",
    },
    json={
        "server_name": "my-github-mcp",
        "url": "https://api.githubcopilot.com/mcp",
        "transport": "sse",
        "description": "GitHub MCP for code search and PR management",
    },
)
print(response.json())
```

</TabItem>
</Tabs>

**Response** — the server is created in `pending_review` state:

```json
{
  "server_id": "abc123",
  "server_name": "my-github-mcp",
  "url": "https://api.githubcopilot.com/mcp",
  "transport": "sse",
  "approval_status": "pending_review",
  "submitted_by": "user-xyz",
  "submitted_at": "2025-04-29T12:00:00Z"
}
```

:::note
The server is **not** available to MCP clients yet. It only becomes active after an admin approves it.
:::

---

## Admin: Review Submissions

### Via UI

Go to **MCP Servers → Submissions** tab in the LiteLLM dashboard.

You'll see:
- Submission counts by status (`pending_review`, `active`, `rejected`)
- Each submission card with server details, submitter, and submission time
- Compliance indicators for required fields
- **Approve** and **Reject** buttons per submission

Clicking **Reject** opens a dialog where you can optionally add review notes explaining why.

### Via API

Admin or `proxy_admin_viewer` role required.

<Tabs>
<TabItem value="list" label="List submissions">

```bash title="List all MCP submissions" showLineNumbers
curl http://localhost:4000/v1/mcp/server/submissions \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

Response:

```json
{
  "total": 3,
  "pending_review": 2,
  "active": 1,
  "rejected": 0,
  "items": [
    {
      "server_id": "abc123",
      "server_name": "my-github-mcp",
      "approval_status": "pending_review",
      "submitted_by": "user-xyz",
      "submitted_at": "2025-04-29T12:00:00Z"
    }
  ]
}
```

</TabItem>
<TabItem value="approve" label="Approve">

```bash title="Approve a submitted MCP server" showLineNumbers
curl -X PUT http://localhost:4000/v1/mcp/server/abc123/approve \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

The server status changes to `active` and it is immediately loaded into the MCP runtime registry — clients can start using it right away.

</TabItem>
<TabItem value="reject" label="Reject">

```bash title="Reject a submitted MCP server" showLineNumbers
curl -X PUT http://localhost:4000/v1/mcp/server/abc123/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"review_notes": "This URL is not on the approved vendor list."}'
```

`review_notes` is optional. The server status changes to `rejected` and it stays out of the registry.

</TabItem>
</Tabs>

---

## Approval Status Values

| Status | Meaning |
|--------|---------|
| `pending_review` | Submitted, waiting for admin review. Not accessible to MCP clients. |
| `active` | Approved. Loaded into the MCP registry and available to clients. |
| `rejected` | Rejected by admin. Not accessible. May include `review_notes`. |

---

## FAQ

**Can an admin re-approve a rejected server?**

Yes. The approve endpoint accepts servers in `pending_review` or `rejected` status. Just call `PUT /v1/mcp/server/{id}/approve` again.

**What happens if a previously-active server is rejected?**

It is evicted from the runtime registry immediately — clients will no longer see its tools.

**Can a team member check the status of their submission?**

Not via a dedicated endpoint yet. Admins can see all submissions at `GET /v1/mcp/server/submissions`. Team members can call `GET /v1/mcp/server/{server_id}` if they have the `server_id` from the registration response.

**Do I need a special config flag to enable submissions?**

No. The submission endpoints are available by default as long as `store_model_in_db: true` is set. No additional feature flags are required.
