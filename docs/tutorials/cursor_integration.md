import Image from '@theme/IdealImage';

# Cursor Integration

Route Cursor IDE requests through LiteLLM for unified logging, budget controls, and access to any model.

:::info
**Supported modes:** Ask, Plan, Agent. With the base URL override, agent mode requires LiteLLM v1.97.0+, which translates the Responses API request shapes Cursor's agent sends to the chat completions path. Cursor gates custom API keys by mode and model on its side, so coverage follows what Cursor enables.

Cursor does not officially support AI Gateways, our work here is best effort from reverse engineering their APIs. The Cursor CLI (`agent` / `cursor-agent`) cannot target LiteLLM at all, see [Cursor CLI](#cursor-cli-cursor-agent).
:::

:::warning Override OpenAI Base URL missing?
Newer Cursor builds no longer show the **Override OpenAI Base URL** setting on every plan. If your Cursor does not have it, use the [Azure OpenAI fallback](#fallback-azure-openai-settings) below instead of the setup in this section.
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

The proxy must be reachable from the internet: Cursor sends the requests from its own servers, not from your machine, with `User-Agent: Cursor/1.0`. A proxy behind a VPN or an IP allowlist, or on a private address, fails from Cursor's side before any request reaches LiteLLM; [Troubleshooting](#troubleshooting) lists what Cursor shows in each case.

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
  - model_name: litellm-claude-sonnet-5
    litellm_params:
      model: anthropic/{{anthropic}}
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

## Fallback: Azure OpenAI settings

If your Cursor build has no **Override OpenAI Base URL** setting, Cursor's Azure OpenAI settings still accept a custom base URL and route traffic to your LiteLLM proxy. This path uses LiteLLM's Azure-compatible `/openai/deployments/<deployment>/chat/completions` route, which has been in LiteLLM since 2023, so it needs no proxy upgrade. Ask, Plan, and Agent modes all work over it (verified on Cursor 3.17.21); Cursor's Azure client sends plain chat completions requests for agent mode too, so the v1.97.0 requirement from the base URL override path does not apply here.

| Setting | Value |
|---------|-------|
| Base URL | `<LITELLM_PROXY_BASE_URL>` (no `/cursor` suffix) |
| Deployment Name | Public Model Name from LiteLLM |
| API Key | Your LiteLLM Virtual Key |

### 1. Enable Azure OpenAI

Open **Cursor → Settings → Cursor Settings → Models**, expand **API Keys**, and enable the **Azure OpenAI** toggle. Cursor shows a confirmation dialog warning that some features cannot be billed to an API key; confirm it.

Fill in the fields:

- **Base URL**: your LiteLLM proxy URL, e.g. `https://your-litellm-proxy.com`. Do not append `/cursor`. The proxy must be reachable from the internet: Cursor sends requests from its backend, not from your machine.
- **Deployment Name**: the LiteLLM public model name to use, e.g. `{{anthropic}}`. This decides which model serves every request (see the warning below).
- **API Key**: your LiteLLM virtual key.

### 2. Add a custom model

While the Azure OpenAI toggle is on, only custom models work. Cursor refuses its own models (Composer, Cursor Grok) with `This model does not support custom API keys`, and it still routes built-in Claude and GPT models to your proxy, but in Anthropic Messages or Azure Responses formats that the chat completions deployment route rejects, so those chats hang. Click **+ Add Custom Model**, enter a name that does not collide with a built-in model (e.g. `litellm-claude`), enable it, and select it in the chat model picker.

To use Composer or another built-in model on your Cursor subscription, turn the Azure OpenAI toggle off; turn it back on to route through LiteLLM again.

:::warning The Deployment Name decides the model
On this path, Cursor sends every request to `/openai/deployments/<Deployment Name>/chat/completions`, and LiteLLM serves the model the path names. The custom model you pick in Cursor is only a label: picking a different custom model does not change which model answers. To switch models, edit the **Deployment Name** in the Azure OpenAI settings. Keep a single enabled custom model so the picker cannot mislead you.
:::

### 3. Test

Send a message in Ask mode, then try Agent mode. Requests appear in your LiteLLM logs as chat completions on `/openai/deployments/<Deployment Name>/chat/completions`, attributed to the deployment's model.

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

## Cursor CLI (cursor-agent)

The Cursor CLI (`agent`, also installed as `cursor-agent`) cannot target LiteLLM or any other gateway. Its `--endpoint` flag and `CURSOR_API_ENDPOINT` variable pick which Cursor backend the CLI logs in to, not an OpenAI-compatible API: on startup the CLI posts your key to `<endpoint>/auth/exchange_user_api_key` to trade it for Cursor session tokens, and every request after that is a Cursor-private RPC. Cursor does not document the flag and does not offer a custom endpoint or an OpenAI-compatible key in the CLI ([open feature request](https://forum.cursor.com/t/cursor-cli-custom-endpoint-and-api-key-support/129424)); its one bring-your-own-credentials option, `agent bedrock`, still routes through Cursor's backend.

Pointing the CLI at a proxy fails before any model is reached (verified on the public Cursor CLI 2026.08.31 build):

```shell
export CURSOR_API_KEY=<LITELLM_VIRTUAL_KEY>
agent --endpoint https://your-litellm-proxy.com
```

```
⚠ Warning: The provided API key is invalid.
The API key was loaded from the CURSOR_API_KEY environment variable.
Please check you have the right key, create a new one, or authenticate without it.
```

The CLI prints this warning for any answer below 500 that does not carry Cursor session tokens (a 5xx gets a fixed `Failed to reach the Cursor API` error instead), so a proxy without that route (LiteLLM answers 404 at the root and 401 under `/cursor`) looks exactly like a wrong Cursor key, and no text from the proxy ever reaches the screen. To route Cursor through LiteLLM use the Cursor IDE setup on this page; for a terminal agent that supports custom endpoints, see [Claude Code](./claude_responses_api.md), [Codex CLI](./openai_codex.md), [Gemini CLI](./litellm_gemini_cli.md), or [OpenCode](./opencode_integration.md).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Model not responding | Check base URL ends with `/cursor` and key has model access |
| `The provided API key is invalid` from the Cursor CLI (`agent` / `cursor-agent`) | The Cursor CLI cannot use a gateway: `--endpoint` selects a Cursor backend, not an OpenAI-compatible API, so its login fails with this warning on any proxy that lacks Cursor's auth route. See [Cursor CLI](#cursor-cli-cursor-agent) |
| `Invalid API key` / `Unauthorized User API key` | Cursor shows this when the proxy answers 401. The API Key field must hold a LiteLLM virtual key (it starts with `sk-`); a placeholder value is rejected |
| `User API Key Rate limit exceeded` | Cursor shows this when its request to the proxy gets a 429 or a 5xx, and also when it gets no answer at all, which is what a VPN or an IP allowlist that drops traffic from Cursor's servers looks like (verified on Cursor 3.18.25: the chat sits on `Taking longer than expected` for about a minute, then shows this). So the cause is often not a rate limit. First, from a machine outside your network, run `curl <LITELLM_PROXY_BASE_URL>/cursor/models -H "Authorization: Bearer <LITELLM_VIRTUAL_KEY>"`; if it hangs, the proxy is unreachable from the internet and LiteLLM never saw the requests. If it answers, look up the requests in the LiteLLM logs (they arrive with `User-Agent: Cursor/1.0`) for the real error. Frequent causes there are rpm or tpm limits on the key, since each Cursor request carries a system prompt of about 25k tokens, and provider 429s |
| `Network Error` / `We're having trouble connecting to the model provider` | The base URL hostname does not resolve on the public internet, e.g. an internal DNS name. Cursor shows `Rate limited by model provider, retrying` while it retries for about a minute, then this. Use a hostname that public DNS resolves |
| `Provider returned error: Access to private networks is forbidden` | The base URL points at a private address (`10.x`, `192.168.x`, `localhost`, and the like), which Cursor's servers refuse to call. Put the proxy on a public address |
| Agent mode not working | Upgrade to LiteLLM v1.97.0+ and confirm the model supports custom API keys in Cursor |
| Cursor does not list your LiteLLM models | Upgrade to LiteLLM v1.97.0+, which serves `GET /cursor/models`. Earlier versions do not serve that route and answer 401 or 404. Verify with `curl <LITELLM_PROXY_BASE_URL>/cursor/models -H "Authorization: Bearer <LITELLM_VIRTUAL_KEY>"` |
| `The model "X" is already available as "Y"` | Cursor blocks names that match its built-in models. Add the model under a distinct public model name (see the warning in step 3) |
| `This model does not support custom API keys` | You selected a Cursor-native model (Composer, Cursor Grok) while a custom API key is enabled. Select the custom model you added, or disable the Azure OpenAI toggle to use Cursor's models on your subscription |
| Chat hangs with a built-in model picked while Azure OpenAI is enabled | Cursor still routes built-in Claude and GPT models to your proxy, in formats the deployment route rejects. Select the custom model you added |
| No **Override OpenAI Base URL** setting | Your Cursor build does not offer it. Use the [Azure OpenAI fallback](#fallback-azure-openai-settings) |
| Azure fallback always answers with the same model | Expected: the **Deployment Name** decides the model, whichever custom model is picked. Edit the Deployment Name to switch |
