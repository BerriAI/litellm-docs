# AFK Integration

This guide shows how to connect AFK to an existing LiteLLM Proxy so AFK coding-agent sessions can use models routed through LiteLLM.

:::info

Use LiteLLM with AFK to centralize model credentials, virtual keys, usage tracking, budgets, guardrails, and routing while AFK provides browser-based supervision for persistent coding-agent sessions.

:::

## Prerequisites

- AFK account at [afk.mooglest.com](https://afk.mooglest.com)
- AFK daemon connected to the machine or network where your project is available
- LiteLLM Proxy running and reachable from the AFK daemon
- LiteLLM master key or virtual key
- At least one public model name configured in LiteLLM

## 1. Configure LiteLLM Proxy

Make sure your LiteLLM Proxy exposes one or more models. For example:

```yaml showLineNumbers
model_list:
  - model_name: coding-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: coding-gemini
    litellm_params:
      model: gemini/gemini-2.5-pro
      api_key: os.environ/GEMINI_API_KEY

litellm_settings:
  drop_params: true
```

Start LiteLLM Proxy:

```bash showLineNumbers
litellm --config /path/to/config.yaml
```

By default, the proxy listens on `http://localhost:4000`.

For production, use your hosted LiteLLM Proxy URL and a virtual key with the model access and budget limits you want AFK sessions to use.

## 2. Create or sign in to AFK

Open [afk.mooglest.com](https://afk.mooglest.com) and create an account or sign in.

## 3. Install and connect an AFK daemon

AFK sessions run through a daemon that has access to your projects and can reach your LiteLLM Proxy.

In AFK:

1. Open **Account → API Keys**.
2. Create a daemon token.
3. Follow the installation command shown in the app to install and connect the daemon.
4. Confirm your machine appears as a connected daemon in the browser.

:::tip

If you use `http://localhost:4000/v1` as the LiteLLM Base URL, `localhost` is resolved from the AFK daemon machine. If LiteLLM runs somewhere else, use a URL that the daemon can reach.

:::

## 4. Add LiteLLM as an OpenAI-compatible connection in AFK

LiteLLM Proxy exposes an OpenAI-compatible API, so AFK can use it through the OpenAI connection with a custom Base URL.

In AFK:

1. Open **Account → LLM**.
2. Click **Add connection**.
3. Choose **OpenAI**.
4. Paste your LiteLLM master key or virtual key as the API key.
5. Set **Base URL** to your LiteLLM OpenAI-compatible endpoint:

   ```text
   http://localhost:4000/v1
   ```

   For a hosted proxy, use your HTTPS proxy URL ending in `/v1`.

6. Save or test the connection.

:::tip

If your LiteLLM Proxy is strictly local and does not require an API key, AFK's **Local model** connection can also point at `http://localhost:4000/v1`. Use the OpenAI connection when you need to send a LiteLLM virtual key.

:::

## 5. Start an AFK session through LiteLLM

Click **New session** in AFK, then:

1. Select the connected daemon and project directory.
2. Choose the OpenAI connection that points at LiteLLM Proxy.
3. Select or type a public model name from your LiteLLM configuration, such as:

   ```text
   coding-sonnet
   coding-gemini
   ```

4. Choose a permission mode and enter the coding task.

AFK will route the session's model requests through LiteLLM Proxy.

:::info

If model discovery cannot reach a local LiteLLM Proxy, manually type the LiteLLM public model name in the session model field. Runtime requests still use the Base URL configured on the connection.

:::

## Why use LiteLLM with AFK?

### Centralized model access

Use LiteLLM virtual keys so AFK sessions do not need direct provider credentials. Teams can centrally manage which models are available and which users or projects can access them.

### Usage tracking and budgets

LiteLLM tracks spend and usage across requests. AFK sessions remain visible in the AFK browser UI while LiteLLM provides gateway-level cost and usage controls.

### Routing, failover, and guardrails

Route AFK sessions across providers, apply model aliases, add fallbacks, and enforce guardrails at the LiteLLM layer without changing AFK session workflows.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| AFK cannot connect | Confirm LiteLLM Proxy is reachable from the AFK daemon machine and that the Base URL ends in `/v1`. |
| Auth errors | Check that the LiteLLM key pasted into AFK is valid and has access to the selected model. |
| Model not found | Use the public `model_name` from your LiteLLM `model_list`. AFK also supports manually typing model names. |
| `localhost` confusion | For runtime requests, `localhost` must be reachable from the daemon/agent machine. If model discovery cannot reach a local proxy, manually type the model name or use a network URL. |

## Additional Resources

- [AFK](https://afk.mooglest.com)
- [AFK provider setup docs](https://docs.mooglest.com/providers)
- [LiteLLM Proxy Quick Start](/docs/proxy/docker_quick_start)
- [LiteLLM Virtual Keys](/docs/proxy/virtual_keys)
- [LiteLLM Model Management](/docs/proxy/model_management)
