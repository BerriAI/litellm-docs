import Image from '@theme/IdealImage';

# Cursor Integration

Route Cursor IDE requests through LiteLLM for unified logging, budget controls, and access to any model.

:::info
**Supported modes:** Ask, Plan, Agent. Agent mode requires LiteLLM v1.97.0+, which translates the Responses API request shapes Cursor's agent sends to the chat completions path. Cursor gates custom API keys by mode and model on its side, so coverage follows what Cursor enables.
:::

## Quick Reference

| Setting | Value |
|---------|-------|
| Base URL | `<LITELLM_PROXY_BASE_URL>/cursor` |
| API Key | Your LiteLLM Virtual Key |
| Model | Public Model Name from LiteLLM |

---

## Setup

### 1. Configure Base URL

Open **Cursor → Settings → Cursor Settings → Models**.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/f725f154-588d-448d-a1d7-3c8bffaf3cf3/ascreenshot.jpeg?tl_px=0,0&br_px=1376,769&force_format=jpeg&q=100&width=1120.0&wat=1&wat_opacity=0.7&wat_gravity=northwest&wat_url=https://colony-recorder.s3.us-west-1.amazonaws.com/images/watermarks/FB923C_standard.png&wat_pad=263,73)

Enable **Override OpenAI Base URL** and enter your proxy URL with `/cursor`:

```
https://your-litellm-proxy.com/cursor
```

![](https://colony-recorder.s3.amazonaws.com/files/2025-12-13/6580de2b-3a59-45b2-b7b6-3ab105d87e74/ascreenshot.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA2JDELI43356LVVTC%2F20251213%2Fus-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251213T224156Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=5a1af4ff63d38d51e06d398ed50f10161d690e3e57e9d67c1d23ce5b7ffdefd5)

### 2. Create Virtual Key

In LiteLLM Dashboard, go to **Virtual Keys → + Create New Key**.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/1d8156bc-1b12-433f-936d-77f876142e3f/ascreenshot.jpeg?tl_px=0,0&br_px=1376,769&force_format=jpeg&q=100&width=1120.0&wat=1&wat_opacity=0.7&wat_gravity=northwest&wat_url=https://colony-recorder.s3.us-west-1.amazonaws.com/images/watermarks/FB923C_standard.png&wat_pad=240,182)

Name your key and select which models it can access.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/c45843db-b623-442b-b42b-3145ef3ba986/ascreenshot.jpeg?tl_px=0,151&br_px=1376,920&force_format=jpeg&q=100&width=1120.0&wat=1&wat_opacity=0.7&wat_gravity=northwest&wat_url=https://colony-recorder.s3.us-west-1.amazonaws.com/images/watermarks/FB923C_standard.png&wat_pad=453,277)

Click **Create Key** then copy it immediately, since you won't see it again.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/4022504d-fdba-4e17-b16e-bf8e935cbcad/ascreenshot.jpeg?tl_px=0,101&br_px=1376,870&force_format=jpeg&q=100&width=1120.0&wat=1&wat_opacity=0.7&wat_gravity=northwest&wat_url=https://colony-recorder.s3.us-west-1.amazonaws.com/images/watermarks/FB923C_standard.png&wat_pad=512,277)

Paste it into the **OpenAI API Key** field in Cursor.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/6b50fc92-9219-4868-aac2-a29d0c063e57/ascreenshot.jpeg?tl_px=251,235&br_px=1627,1004&force_format=jpeg&q=100&width=1120.0&wat=1&wat_opacity=0.7&wat_gravity=northwest&wat_url=https://colony-recorder.s3.us-west-1.amazonaws.com/images/watermarks/FB923C_standard.png&wat_pad=524,276)

### 3. Add Custom Model

Click **+ Add Custom Model** in Cursor Settings.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/4e46538e-a876-44c4-a133-bdae664510f3/ascreenshot.jpeg?tl_px=192,8&br_px=1569,777&force_format=jpeg&q=100&width=1120.0&wat=1&wat_opacity=0.7&wat_gravity=northwest&wat_url=https://colony-recorder.s3.us-west-1.amazonaws.com/images/watermarks/FB923C_standard.png&wat_pad=524,276)

Get the **Public Model Name** from LiteLLM Dashboard → Models + Endpoints.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/2ee87f64-104a-4b37-8041-c92130a44896/ascreenshot.jpeg?tl_px=0,11&br_px=1376,780&force_format=jpeg&q=100&width=1120.0&wat=1&wat_opacity=0.7&wat_gravity=northwest&wat_url=https://colony-recorder.s3.us-west-1.amazonaws.com/images/watermarks/FB923C_standard.png&wat_pad=331,277)

Paste the name in Cursor and enable the toggle.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/5ab35f93-d417-423f-a359-9811ce18e2c3/ascreenshot.jpeg?tl_px=352,26&br_px=1728,795&force_format=jpeg&q=100&width=1120.0&wat=1&wat_opacity=0.7&wat_gravity=northwest&wat_url=https://colony-recorder.s3.us-west-1.amazonaws.com/images/watermarks/FB923C_standard.png&wat_pad=786,277)

:::warning Built-in model names
Cursor rejects a custom model whose name matches one of its built-in models with `The model "X" is already available as "Y"`. Cursor runs this check locally, before any request reaches LiteLLM. Add a `model_list` entry with a distinct public model name for the same deployment and use that name in Cursor:

```yaml
model_list:
  - model_name: litellm-claude-haiku-4-5
    litellm_params:
      model: anthropic/claude-haiku-4-5
```
:::

:::tip Model variants
Cursor's model picker can emit thinking and fast variants of a model name, e.g. `claude-opus-5-thinking`. LiteLLM v1.97.0+ resolves these suffixes to the underlying model automatically, so key scopes and per-model budgets apply to the resolved model and you don't need separate `model_list` entries for the variants.
:::

### 4. Test

Open **Ask** mode with `Cmd+L` / `Ctrl+L` and select your model.

![](https://colony-recorder.s3.amazonaws.com/files/2025-12-13/d87ee25b-3c6d-4231-ba00-4d841d0612bc/ascreenshot.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA2JDELI43356LVVTC%2F20251213%2Fus-west-1%2Fs3%2Faws4_request&X-Amz-Date=20251213T223855Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host&X-Amz-Signature=75316b8cd2d451f476232bd0ca459c4b6877e788637bf228bbd7d8b319fd1427)

Send a message. All requests now route through LiteLLM.

![](https://ajeuwbhvhr.cloudimg.io/https://colony-recorder.s3.amazonaws.com/files/2025-12-13/05a5853a-58ed-44bf-a5c2-c14f9003eace/ascreenshot.jpeg?tl_px=0,151&br_px=1728,1117&force_format=jpeg&q=100&width=1120.0)

---

## Connecting MCP Servers

You can also connect MCP servers to Cursor via LiteLLM Proxy.

For official instructions on configuring MCP integration with Cursor, please refer to the Cursor documentation here: [https://cursor.com/en-US/docs/context/mcp](https://cursor.com/en-US/docs/context/mcp).

1. In Cursor Settings, go to the "Tools & MCP" tab and click "New MCP Server".

2. In your `mcp.json`, add the following configuration:

```
{
  "mcpServers": {
    "litellm": {
      "url": "http://localhost:4000/everything/mcp",
      "type": "http",
      "headers": {
        "Authorization": "Bearer sk-LITELLM_VIRTUAL_KEY"
      }
    }
  }
}
```

3. LiteLLM's MCP will now appear under "Installed MCP Servers" in Cursor.

<Image img={require('../../img/cursor_mcp_installed.png')} />

## Cursor Cloud Agents

LiteLLM can also front the Cursor Cloud Agents API, so agents launched over `api.cursor.com` get the same credential management and logging. See [Cursor Cloud Agents](../pass_through/cursor.md).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Model not responding | Check base URL ends with `/cursor` and key has model access |
| Auth errors | Regenerate key; ensure it starts with `sk-` |
| Agent mode not working | Upgrade to LiteLLM v1.97.0+ and confirm the model supports custom API keys in Cursor |
| Cursor does not list your LiteLLM models | Upgrade to LiteLLM v1.97.0+, which serves `GET /cursor/models`. Earlier versions do not serve that route and answer 401 or 404. Verify with `curl <LITELLM_PROXY_BASE_URL>/cursor/models -H "Authorization: Bearer <LITELLM_VIRTUAL_KEY>"` |
| `The model "X" is already available as "Y"` | Cursor blocks names that match its built-in models. Add the model under a distinct public model name (see the warning in step 3) |
