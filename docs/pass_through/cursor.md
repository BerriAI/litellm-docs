# Cursor Cloud Agents

Pass-through endpoints for the [Cursor Cloud Agents API](https://docs.cursor.com/account/api). Launch and manage cloud agents that work on your repositories, in native format (no translation).

| Feature | Supported | Notes |
|---------|-----------|-------|
| Cost Tracking | ✅ | Logged as $0.00 (subscription-based, no per-request pricing) |
| Logging | ✅ | All requests logged with operation classification |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ❌ | Cursor API does not use streaming |

Just replace `https://api.cursor.com` with `LITELLM_PROXY_BASE_URL/cursor` 🚀

This route fronts the Cloud Agents REST API only. Cursor CLI agent sessions log in to `api2.cursor.sh` by default (`agent --endpoint` only moves that login), not to `api.cursor.com`, so they cannot use this route, see [Cursor CLI](../tutorials/cursor_integration.md#cursor-cli-cursor-agent).

**Supported endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v0/agents` | GET | List agents |
| `/v0/agents` | POST | Launch an agent |
| `/v0/agents/{id}` | GET | Agent status |
| `/v0/agents/{id}` | DELETE | Delete an agent |
| `/v0/agents/{id}/conversation` | GET | Agent conversation |
| `/v0/agents/{id}/followup` | POST | Add follow-up |
| `/v0/agents/{id}/stop` | POST | Stop an agent |
| `/v0/me` | GET | API key info |
| `/v0/models` | GET | List models |
| `/v0/repositories` | GET | List GitHub repositories |

## Quick Start

### 1. Add Your Cursor API Key to the Proxy

The proxy needs your Cursor API key to authenticate to the Cursor Cloud Agents API on your behalf. Add it as a credential under **Models + Endpoints → LLM Credentials** (select **Cursor** from the provider dropdown), or set the `CURSOR_API_KEY` environment variable on the proxy.

### 2. Launch a Cursor Agent

```bash
curl -X POST http://0.0.0.0:4000/cursor/v0/agents \
  -H "Authorization: Bearer <your-litellm-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {
      "text": "Add a README.md with installation instructions"
    },
    "source": {
      "repository": "https://github.com/your-org/your-repo",
      "ref": "main"
    },
    "target": {
      "autoCreatePr": true
    }
  }'
```

**Expected Response:**

```json
{
  "id": "bc_abc123",
  "name": "Add README Documentation",
  "status": "CREATING",
  "source": {
    "repository": "https://github.com/your-org/your-repo",
    "ref": "main"
  },
  "target": {
    "branchName": "cursor/add-readme-1234",
    "url": "https://cursor.com/agents?id=bc_abc123",
    "autoCreatePr": true
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### 3. View Logs

Navigate to **Logs** in the sidebar. Filter by "cursor" to see your agent requests. Each request shows the operation type (e.g., `cursor/cursor:agent:create`), status, duration, and cost.

Click on any log entry to see full request details including provider, API base, and metadata.

## Examples

Anything after `http://0.0.0.0:4000/cursor` is treated as a provider-specific route, and handled accordingly.

| **Original Endpoint** | **Replace With** |
|---|---|
| `https://api.cursor.com` | `http://0.0.0.0:4000/cursor` (LITELLM_PROXY_BASE_URL) |
| `-u YOUR_API_KEY:` (Basic Auth) | `-H "Authorization: Bearer <your-litellm-key>"` (LiteLLM Virtual Key) |

### List Available Models

```bash
curl http://0.0.0.0:4000/cursor/v0/models \
  -H "Authorization: Bearer <your-litellm-key>"
```

### Check Agent Status

```bash
curl http://0.0.0.0:4000/cursor/v0/agents/bc_abc123 \
  -H "Authorization: Bearer <your-litellm-key>"
```

### List All Agents

```bash
curl http://0.0.0.0:4000/cursor/v0/agents \
  -H "Authorization: Bearer <your-litellm-key>"
```

### Add Follow-up to Agent

```bash
curl -X POST http://0.0.0.0:4000/cursor/v0/agents/bc_abc123/followup \
  -H "Authorization: Bearer <your-litellm-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {
      "text": "Also add a section about troubleshooting"
    }
  }'
```

### Stop an Agent

```bash
curl -X POST http://0.0.0.0:4000/cursor/v0/agents/bc_abc123/stop \
  -H "Authorization: Bearer <your-litellm-key>"
```

### Delete an Agent

```bash
curl -X DELETE http://0.0.0.0:4000/cursor/v0/agents/bc_abc123 \
  -H "Authorization: Bearer <your-litellm-key>"
```

### Get API Key Info

```bash
curl http://0.0.0.0:4000/cursor/v0/me \
  -H "Authorization: Bearer <your-litellm-key>"
```

## Related

- [Cursor Cloud Agents API Docs](https://docs.cursor.com/account/api)
- [Pass-through Endpoints Overview](./intro.md)
- [Virtual Keys](../proxy/virtual_keys.md)
