# Auto Sync New Models (Day-0 Launches)

Automatically keep your model pricing and context window data up to date without restarting your service. **This allows you to add day-0 support for new models without restarting your service.**

## Overview

When providers like OpenAI or Anthropic release new models (e.g., GPT-5, Claude 4), you typically need to restart your LiteLLM service to get the latest pricing and context window data. 

With auto-sync, LiteLLM automatically pulls the latest model data from GitHub's [`model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) without requiring a restart. This means:

- **Zero downtime** when new models are released
- **Always accurate pricing** for cost tracking and budgets
- **Automatic updates** - set it once and forget it

<iframe width="840" height="500" src="https://www.loom.com/embed/ba41acc1882d41b284bbddbb0e9c27ce?sid=bdae351e-2026-4e39-932b-fcb185ff612c" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

<br/>
<br/>

## Quick Start

**Manual sync:**
```bash
curl -X POST "https://your-proxy-url/reload/model_cost_map" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Automatic sync every 6 hours:**
```bash
curl -X POST "https://your-proxy-url/schedule/model_cost_map_reload?hours=6" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/reload/model_cost_map` | POST | Manual sync |
| `/schedule/model_cost_map_reload?hours={hours}` | POST | Schedule periodic sync |
| `/schedule/model_cost_map_reload` | DELETE | Cancel scheduled sync |
| `/schedule/model_cost_map_reload/status` | GET | Check sync status |
| `/model/cost_map/source` | GET | Where the loaded map came from and which revision it is |

**Authentication:** Requires admin role or master key

If a reload succeeds but a newly added model still does not show up, work through [Model missing after Reload Price Data](../troubleshoot/missing_model) before changing anything on the deployment.

## Checking which revision is loaded

The pricing file carries a top-level `_metadata` entry, stamped by the sync bots that write it, with `generated_at` (when the file was written, UTC) and `source_revision` (the commit the file was generated from). The proxy records both when it loads the map, together with the `etag` GitHub served for the fetch, and reports them on `GET /model/cost_map/source`, `POST /reload/model_cost_map`, and `GET /schedule/model_cost_map_reload/status`. The Admin UI shows the same three values on the Price Data Reload card under Models and Endpoints

```bash
curl -s "https://your-proxy-url/model/cost_map/source" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

```json
{
  "source": "remote",
  "url": "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
  "is_env_forced": false,
  "fallback_reason": null,
  "loaded_at": "2026-09-07T23:59:20.508051+00:00",
  "generated_at": "2026-09-07T23:38:47Z",
  "source_revision": "cd681a573fd9f5b6f15a1355f46178e4e9d374d2",
  "etag": "W/\"adb2c10e22f905be5b7362b73dbb589d02751b720db9024218900cca9fc7d2de\"",
  "model_count": 3850
}
```

`source_revision` is the one-line answer to "which pricing map is my proxy on": compare it against the commit that added the model you are looking for. `etag` is `null` when the map came from the bundled copy (`LITELLM_LOCAL_MODEL_COST_MAP=True` or a failed fetch), and both stamp fields are `null` on a file written before the stamp existed. `_metadata` is metadata only: it never shows up in `/v1/models`, `/model/info`, `/public/litellm_model_cost_map`, or cost lookups

## Python Example

```python
import requests

def sync_models(proxy_url, admin_token):
    response = requests.post(
        f"{proxy_url}/reload/model_cost_map",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    return response.json()

# Usage
result = sync_models("https://your-proxy-url", "your-admin-token")
print(result['message'])
```

## Configuration

**Custom model cost map URL:**
```bash
export LITELLM_MODEL_COST_MAP_URL="https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
```

**Use local model cost map:**
```bash
export LITELLM_LOCAL_MODEL_COST_MAP=True
```