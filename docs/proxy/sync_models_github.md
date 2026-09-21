# Auto Sync New Models (Day-0 Launches)

Automatically keep your model pricing and context window data up to date without restarting your service. **This allows you to add day-0 support for new models without restarting your service.**

## Overview

When providers like OpenAI or Anthropic release new models (e.g., GPT-5, Claude 4), you typically need to restart your LiteLLM service to get the latest pricing and context window data. 

With auto-sync, LiteLLM automatically pulls the latest model data from GitHub's [`model_prices_and_context_window.json`](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) without requiring a restart. This means:

- **Zero downtime** when new models are released
- **Always accurate pricing** for cost tracking and budgets
- **Automatic updates** - set it once and forget it

:::info Startup behavior (no configuration needed)
The endpoints on this page only control **re-syncing while the proxy is running**. Independently of them, every LiteLLM process already fetches the remote `model_prices_and_context_window.json` from GitHub `main` (or `LITELLM_MODEL_COST_MAP_URL` if set) **once at startup**, and falls back to the copy bundled with the package (`litellm/model_prices_and_context_window_backup.json`) only if that fetch fails or fails validation. If you ship your own copy of the pricing file in your image and want the proxy to use it instead of the remote file, you must set `LITELLM_LOCAL_MODEL_COST_MAP=True`. See [Custom model cost map](./custom_model_cost_map) for details and `GET /model/cost_map/source` to check which copy is loaded.
:::

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

Every time the proxy loads the pricing map it records the git blob id of the bytes it parsed, the same id `git rev-parse <commit>:model_prices_and_context_window.json` prints for that file in a litellm checkout. It reports that id as `source_revision`, together with the `etag` GitHub served for the fetch and `loaded_at`, on `GET /model/cost_map/source`, `POST /reload/model_cost_map`, and `GET /schedule/model_cost_map_reload/status`. The Admin UI shows the same three values on the Price Data Reload card under Models and Endpoints

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
  "loaded_at": "2026-09-08T00:49:21.311283+00:00",
  "source_revision": "b1ffc1583e46583bb4becd34cf85ec70c6930828",
  "etag": "W/\"6523ba12ad8daed03f7c879bc2c079d11b111d1ebdee2c27a34c0c756af30445\"",
  "model_count": 3850
}
```

`source_revision` is the one-line answer to "which pricing map is my proxy on". To check it against `main`, run `git rev-parse origin/main:model_prices_and_context_window.json` in a litellm checkout: a match means the proxy is on the current file. To see when `main` shipped that exact file, run `git log --first-parent --find-object=<source_revision> --format='%h %cs %s' origin/main -- model_prices_and_context_window.json`: the older line is the merge that shipped it and the newer line, when there is one, the merge that replaced it. `--first-parent` matters because most revisions reach `main` through merges from `litellm_internal_staging`, and plain `git log` leaves those merges out. Without a checkout, `gh api 'repos/BerriAI/litellm/contents/model_prices_and_context_window.json?ref=main' --jq .sha` prints the id `main` serves right now. Two proxies reporting the same `source_revision` are serving byte-identical maps, whatever URL each fetched from. `etag` is `null` when the map came from the bundled copy (`LITELLM_LOCAL_MODEL_COST_MAP=True` or a failed fetch), and `source_revision` is then the bundled file's id. Nothing is stamped into the JSON itself, so the file has no `_metadata` entry and no `generated_at`

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

Both variables apply to the startup fetch and to every reload triggered by the endpoints above.

**Custom model cost map URL** (default shown; the remote fetch happens even when this is unset):
```bash
export LITELLM_MODEL_COST_MAP_URL="https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
```

**Use local model cost map only** (disables the remote fetch at startup and on reload; the bundled backup file is used):
```bash
export LITELLM_LOCAL_MODEL_COST_MAP=True
```