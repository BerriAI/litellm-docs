# TinyFish Agent

Pass-through endpoints for the [TinyFish Agent API](https://docs.tinyfish.ai/agent-api), goal-based web automation in native format (no translation). Point the official TinyFish SDK at the proxy and it works unchanged

| Feature | Supported | Notes |
|---------|-----------|-------|
| Cost Tracking | ✅ | Billed per run as `num_of_steps x $0.016` (TinyFish's published rate) |
| Logging | ✅ | Runs logged as model `tinyfish/automation-run` |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ✅ | `run-sse` progress events relayed live |

Just replace `https://agent.tinyfish.ai` with `LITELLM_PROXY_BASE_URL/tinyfish` 🚀

**Supported endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/automation/run` | POST | Run an automation to completion (blocking) |
| `/v1/automation/run-async` | POST | Submit a run, poll for the result |
| `/v1/automation/run-sse` | POST | Run with live SSE progress events |
| `/v1/runs/{id}` | GET | Run status and result |
| `/v1/runs/{id}/cancel` | POST | Cancel a run |

Every other Agent API endpoint (vault, wallet, browser profiles) returns 403. All callers share the proxy's one upstream TinyFish key, so the credential and account management surface stays admin-only. The `GET /v1/runs` listing is also blocked: run ids are unguessable, so withholding the list keeps callers behind the shared key from discovering each other's runs

## Quick Start

### 1. Add your TinyFish API key to the proxy

Set the `TINYFISH_API_KEY` environment variable on the proxy, or add a deployment with `use_in_pass_through: true`

```bash
export TINYFISH_API_KEY="your-tinyfish-api-key"
```

### 2. Run an automation

```bash
curl http://localhost:4000/tinyfish/v1/automation/run \
  -H "X-API-Key: $LITELLM_VIRTUAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://scrapeme.live/shop",
    "goal": "Extract the first 2 product names and prices. Return JSON."
  }'
```

**Expected response:**

```json
{
  "run_id": "1e7d076e-c464-4f13-8edf-817e9cd78a8b",
  "status": "COMPLETED",
  "started_at": "2026-09-14T17:59:19.562Z",
  "finished_at": "2026-09-14T18:00:20.438Z",
  "num_of_steps": 2,
  "result": {"result": [{"name": "Bulbasaur", "price": "£63.00"}, {"name": "Ivysaur", "price": "£87.00"}]},
  "error": null
}
```

### 3. Or use the official TinyFish SDK

The SDK accepts a `base_url` with the `/tinyfish` prefix and sends the virtual key on the `X-API-Key` header, which LiteLLM accepts natively

```python
from tinyfish import TinyFish

client = TinyFish(
    base_url="http://localhost:4000/tinyfish",
    api_key="sk-your-litellm-virtual-key",
)
run = client.agent.run(
    url="https://scrapeme.live/shop",
    goal="Extract the first 2 product names and prices. Return JSON.",
)
print(run.status, run.num_of_steps, run.result)
```

### 4. View logs

Navigate to **Logs** in the sidebar and filter by `tinyfish`. Each run shows model `tinyfish/automation-run`, the calling key, and the spend

## Spend tracking

Runs are billed `num_of_steps x $0.016` to the calling key and team:

- `POST /v1/automation/run` bills when the blocking response returns
- `POST /v1/automation/run-async` bills exactly once: LiteLLM polls the run in the background and writes one spend log when it reaches a terminal status. Client polls of `GET /v1/runs/{id}` are never billed, no matter how many
- `POST /v1/automation/run-sse` bills exactly once when the run reaches a terminal status, the same way: a client that disconnects mid-stream is still billed once the run completes
- Only `COMPLETED` runs carry cost. `FAILED` and `CANCELLED` runs write a $0 spend log, matching how TinyFish invoices
- `GET /v1/runs/{id}` and cancels never write spend logs

Override the per-step rate with the `TINYFISH_COST_PER_STEP` environment variable if your TinyFish contract prices steps differently

## Authenticated runs

Request fields that run with the TinyFish account's saved logins (`use_vault`, `credential_item_ids`, `use_profile`, `profile_id`) are rejected with a 403 by default, because every caller shares the proxy's upstream key. Set `TINYFISH_ALLOW_AUTHENTICATED_RUNS=true` on the proxy to allow them

## Environment variables

| Variable | Description |
|----------|-------------|
| `TINYFISH_API_KEY` | TinyFish API key the proxy uses upstream |
| `TINYFISH_AGENT_API_BASE` | Base URL for the TinyFish Agent API. Default is https://agent.tinyfish.ai |
| `TINYFISH_COST_PER_STEP` | Per-step USD rate used for spend tracking. Default is 0.016 |
| `TINYFISH_ALLOW_AUTHENTICATED_RUNS` | Set to `true` to allow vault and browser-profile fields in run requests |
