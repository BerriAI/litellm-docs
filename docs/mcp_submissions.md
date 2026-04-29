import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MCP Server Submissions

Allow team members to propose MCP servers for admin review before they go live. Admins can approve, reject, or configure required fields that every submission must pass.

:::info Related Documentation
- [MCP Overview](./mcp.md) - Learn about MCP in LiteLLM
- [MCP Permission Management](./mcp_control.md) - Control MCP access by key/team/org
- [MCP Guardrails](./mcp_guardrail.md) - Apply safety guardrails to MCP calls
:::

## How It Works

The submission workflow separates who can *propose* an MCP server from who can *activate* it:

1. A **team member** submits a server via `POST /v1/mcp/server/register` using a team-scoped API key
2. The server is stored with `approval_status = pending_review` — it is **not** reachable by clients yet
3. An **admin** reviews submissions in the UI (or API) and approves or rejects each one
4. On approval the server goes `active` and is loaded into the runtime registry immediately

```
Team Member                    LiteLLM Proxy                   Admin
     │                               │                            │
     │  POST /v1/mcp/server/register │                            │
     │──────────────────────────────►│                            │
     │                               │  saved (pending_review)    │
     │   201 Created                 │                            │
     │◄──────────────────────────────│                            │
     │                               │  GET /v1/mcp/server/       │
     │                               │  submissions               │◄──────│
     │                               │                            │
     │                               │  PUT /v1/mcp/server/       │
     │                               │  {id}/approve              │◄──────│
     │                               │                            │
     │                               │  server now active ✓       │
```

## Prerequisites

- LiteLLM proxy with a connected database (`DATABASE_URL` configured)
- Team members must use a **team-scoped API key** (a key created under a team)
- Admin review requires a **proxy admin** API key

## Submitting an MCP Server (Team Members)

Use `POST /v1/mcp/server/register` with a team-scoped key. The server is created with `approval_status=pending_review` and is **not yet live**.

```bash
curl -X POST https://your-litellm-proxy/v1/mcp/server/register \
  -H "Authorization: Bearer <team-scoped-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "server_name": "github-mcp",
    "alias": "GitHub MCP",
    "description": "Provides GitHub repository tools for code search and PR management",
    "transport": "sse",
    "url": "https://api.githubcopilot.com/mcp",
    "auth_type": "oauth2",
    "source_url": "https://github.com/github/github-mcp-server"
  }'
```

**Response:**

```json
{
  "server_id": "github-mcp",
  "server_name": "github-mcp",
  "alias": "GitHub MCP",
  "approval_status": "pending_review",
  "submitted_by": "user@example.com",
  "submitted_at": "2025-01-15T10:30:00Z"
}
```

### Required Fields

| Field | Required | Description |
|---|---|---|
| `server_name` | Yes | Unique identifier for the server |
| `transport` | Yes | `sse`, `http`, or `stdio` |
| `url` | Depends on admin config | Server URL for `sse`/`http` transports |
| `alias` | Depends on admin config | Human-readable display name |
| `description` | Depends on admin config | What the server does |
| `auth_type` | Depends on admin config | Auth method (`oauth2`, `bearer`, `none`, etc.) |
| `source_url` | Depends on admin config | Link to source repo or docs |

:::note
Admins can require specific fields. If a required field is missing, the submission is rejected with a `422` error listing which fields are needed.
:::

### Key Constraints

- **Team-scoped key required** — keys not associated with a team are rejected with `400`
- **Proxy admins cannot use this endpoint** — admins should use `POST /v1/mcp/server` to create servers directly

---

## Admin: Review Submissions

### Via UI

Open the LiteLLM Admin UI and go to **MCP Servers → Submitted MCPs**.

The submissions page shows:
- Summary cards with total, pending, active, and rejected counts
- Each submitted server with its name, description, URL, transport, and who submitted it
- Compliance check results (if required fields are configured)
- **Approve** and **Reject** buttons per server

To reject, you can optionally enter a reason that is stored as `review_notes` and visible in the API response.

### Via API

**List all submissions:**

```bash
curl https://your-litellm-proxy/v1/mcp/server/submissions \
  -H "Authorization: Bearer <admin-api-key>"
```

**Response:**

```json
{
  "total": 3,
  "pending_review": 2,
  "active": 0,
  "rejected": 1,
  "items": [
    {
      "server_id": "github-mcp",
      "server_name": "github-mcp",
      "alias": "GitHub MCP",
      "approval_status": "pending_review",
      "submitted_by": "user@example.com",
      "submitted_at": "2025-01-15T10:30:00Z",
      "reviewed_at": null,
      "review_notes": null
    }
  ]
}
```

**Approve a submission:**

```bash
curl -X PUT https://your-litellm-proxy/v1/mcp/server/github-mcp/approve \
  -H "Authorization: Bearer <admin-api-key>"
```

The server immediately becomes active and is loaded into the runtime registry. Clients can now list and call its tools.

**Reject a submission:**

```bash
curl -X PUT https://your-litellm-proxy/v1/mcp/server/github-mcp/reject \
  -H "Authorization: Bearer <admin-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"review_notes": "Missing source URL — please link to the GitHub repo"}'
```

A rejected server stays in the database (visible in submissions) but is not active. Admins can re-approve a rejected server later.

---

## Approval Status Values

| Status | Meaning |
|---|---|
| `pending_review` | Submitted, waiting for admin decision |
| `active` | Approved and live — clients can use it |
| `rejected` | Admin rejected it — not accessible to clients |

---

## Configuring Required Fields (Submission Standards)

Admins can enforce that every submission includes certain fields. Configure this in the proxy's `config.yaml` or via the Admin UI under **MCP Servers → Submitted MCPs → Submission Standards**.

### Via config.yaml

```yaml title="config.yaml"
general_settings:
  mcp_required_fields:
    - description    # Must have a non-empty description
    - alias          # Must have a display alias
    - source_url     # Must link to a source repo (GitHub URL)
    - auth_type      # Must use authentication (not "none")
```

### Available Required Fields

| Field | Category | What it enforces |
|---|---|---|
| `description` | Documentation | Non-empty server description |
| `alias` | Documentation | Human-readable display name |
| `source_url` | Source | Link to a source repository |
| `url` | Connection | Server URL must be set |
| `auth_type` | Security | Must use auth (not `none`) |

When required fields are missing, submissions get a `422` response:

```json
{
  "error": "Submission is missing required fields: ['source_url', 'auth_type']. Configure required fields via general_settings.mcp_required_fields."
}
```

---

## API Reference

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/v1/mcp/server/register` | Team member | Submit a server for review |
| `GET` | `/v1/mcp/server/submissions` | Admin | List all submissions with counts |
| `PUT` | `/v1/mcp/server/{id}/approve` | Admin | Approve and activate a server |
| `PUT` | `/v1/mcp/server/{id}/reject` | Admin | Reject with optional reason |
