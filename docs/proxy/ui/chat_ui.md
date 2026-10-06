---
title: Chat UI
description: Chat with the models on your LiteLLM gateway, use MCP tools, and see your own keys, logs, and usage on one page in the Admin UI.
---

import Image from '@theme/IdealImage';

# Chat UI

The Chat UI is a chat page in the LiteLLM Admin UI. Users can send messages to the models on the gateway and use the tools of MCP servers.

Each request from the Chat UI goes through the gateway. LiteLLM applies the same model access, budgets, and logs to these requests as to API requests.

:::info Beta

The Chat UI is a beta feature. Its pages and controls can change in new releases. The Chat UI is available in v1.92.0 and newer versions. The screenshots on this page show v1.105.0.

:::

## Enable the Chat UI

The Chat UI is off by default. A proxy admin must enable it.

1. Log in to the Admin UI as a proxy admin.
2. Go to **Settings** > **Admin Settings**.
3. Click the **UI Settings** tab.
4. Set **[BETA] Enable Chat page** to on. The page refreshes.

<Image
  img={require('../../../img/chat_ui_enable.png')}
  dark={require('../../../img/chat_ui_enable_dark.png')}
  alt="The Enable Chat page switch on the UI Settings tab of Admin Settings"
  style={{width: '100%', display: 'block', margin: '0'}}
/>

When the Chat UI is on, the view switcher at the top of the Admin UI shows **Chat**. Select **Chat** to open the Chat UI. You can also go to `PROXY_BASE_URL/ui/chat`.

<Image
  img={require('../../../img/chat_ui_switcher.png')}
  dark={require('../../../img/chat_ui_switcher_dark.png')}
  alt="The view switcher with the AI Gateway and Chat options"
  style={{maxWidth: '640px', display: 'block', margin: '0'}}
/>

When the Chat UI is off, the view switcher shows **Chat** as not available. If a user goes to `/ui/chat`, the Admin UI opens the dashboard.

To change this value without the Admin UI, send this request with a proxy admin key:

```bash
curl -X PATCH "$PROXY_BASE_URL/update/ui_settings" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"enable_chat_ui": true}'
```

LiteLLM keeps this value in the database. The gateway must have a `DATABASE_URL`.

## Send a message

1. Click **New Chat**.
2. Select a model in the model list below the message box.
3. Type your message.
4. Click **Send**, or push Enter.

<Image
  img={require('../../../img/chat_ui_new_chat.png')}
  dark={require('../../../img/chat_ui_new_chat_dark.png')}
  alt="A new chat in the Chat UI with the message box and the model list"
  style={{width: '100%', display: 'block', margin: '0'}}
/>

The model list shows the models that your login can use. Type in the search box to find a model.

<Image
  img={require('../../../img/chat_ui_model_picker.png')}
  dark={require('../../../img/chat_ui_model_picker_dark.png')}
  alt="The open model list with a search box"
  style={{width: '100%', display: 'block', margin: '0'}}
/>

The Chat UI shows the response as the model sends it. Below each response, the Chat UI shows these metrics for the request:

- **TTFT**: the time to the first token
- **Total Latency**: the time for the full response
- **In**, **Out**, and **Total**: the input tokens, the output tokens, and the sum of these tokens
- **Cost**: the cost of the request

<Image
  img={require('../../../img/chat_ui_conversation.png')}
  dark={require('../../../img/chat_ui_conversation_dark.png')}
  alt="A chat with a response and the request metrics below the response"
  style={{width: '100%', display: 'block', margin: '0'}}
/>

### Chat history

The Chat UI keeps your chats in the local storage of your browser. The gateway does not keep the chats. The **Recents** list shows your chats. The title of each chat is the start of its first message.

Your browser keeps a maximum of 100 chats. When you start one more chat, the Chat UI deletes the chat with the oldest change. Chats from one browser do not show in a different browser or on a different computer. If you clear the data of your browser, the browser deletes your chats.

The gateway records each request in the logs. Refer to [See your logs](#see-your-logs).

## Use MCP tools in a chat

The Chat UI can give the tools of an MCP server to the model.

1. Click **+** next to the model list.
2. For each MCP server that you will use, set the switch to on.
3. Send your message.

<Image
  img={require('../../../img/chat_ui_mcp_picker.png')}
  dark={require('../../../img/chat_ui_mcp_picker_dark.png')}
  alt="The MCP server list with one switch for each server"
  style={{maxWidth: '720px', display: 'block', margin: '0'}}
/>

The model can then call the tools of the servers that you selected. The list shows only the MCP servers that your login can access. To give users access to an MCP server, refer to [Grant access to MCP servers](../../mcp_grant_access.md).

## Connect to an MCP server with OAuth

Some MCP servers must have a sign-in for each user. For these servers, LiteLLM keeps one OAuth token for each user.

1. Click **Integrations**.
2. Find the MCP server. A server that must have a sign-in shows a **Connect** button.
3. Click **Connect**.
4. Sign in on the page of the provider.

<Image
  img={require('../../../img/chat_ui_integrations.png')}
  dark={require('../../../img/chat_ui_integrations_dark.png')}
  alt="The Integrations page with one MCP server and one OAuth server with a Connect button"
  style={{width: '100%', display: 'block', margin: '0'}}
/>

The **All** tab shows all the MCP servers that your login can access. Each server shows its number of tools. The **Connected** tab shows the servers that are on for your chats.

The **Credentials** page shows your OAuth connections. To remove a connection, click the delete icon (**Revoke connection**) on its row.

To show the **Connect** button for an MCP server, a proxy admin sets `auth_type: oauth2` and `oauth2_flow: authorization_code` on the server:

```yaml title="config.yaml"
mcp_servers:
  github:
    url: https://api.githubcopilot.com/mcp/
    transport: http
    auth_type: oauth2
    oauth2_flow: authorization_code
    description: Issues, pull requests, and code search
```

:::warning

Set `oauth2_flow` on each MCP server that has `auth_type: oauth2`. If `oauth2_flow` is missing, the gateway does not start.

:::

For the full OAuth settings, refer to [MCP OAuth](../../mcp_oauth.md).

## See your API keys

The **API Keys** page shows the virtual keys of your user. For each key, the page shows the spend, the budget, the expiry date, and the creation date.

On LiteLLM Enterprise, each key also has a **Rotate** button. **Rotate** makes a new secret value for the key.

<Image
  img={require('../../../img/chat_ui_api_keys.png')}
  dark={require('../../../img/chat_ui_api_keys_dark.png')}
  alt="The API Keys page with two virtual keys"
  style={{width: '100%', display: 'block', margin: '0'}}
/>

## See your logs

The **Logs** page shows only the requests of your user. Each row shows the time, the model, the status, the tokens, the duration, and the cost. Click **24h**, **7d**, or **30d** to change the time range.

Click a row to see the details of the request. The details show the request body and the response body. To keep these bodies, set `store_prompts_in_spend_logs: true` in `general_settings`.

<Image
  img={require('../../../img/chat_ui_logs.png')}
  dark={require('../../../img/chat_ui_logs_dark.png')}
  alt="The Logs page with three successful requests"
  style={{width: '100%', display: 'block', margin: '0'}}
/>

## See your usage

The **Usage** page shows your total spend, the number of API requests, the tokens, and the success rate. Click **7d**, **30d**, or **90d** to change the time range.

<Image
  img={require('../../../img/chat_ui_usage.png')}
  dark={require('../../../img/chat_ui_usage_dark.png')}
  alt="The Usage page with spend, requests, tokens, and success rate"
  style={{width: '100%', display: 'block', margin: '0'}}
/>

## Spend for Chat UI requests

The Chat UI sends each request with the login session of the user. LiteLLM records the spend of the request for that user. The spend does not go to the virtual keys of the user.

## Chat UI and Playground

The Admin UI also has a **Playground** page. Use the Playground to do tests on models and to compare a maximum of 3 models side by side. The Chat UI keeps a chat history, connects to MCP servers, and shows your keys, logs, and usage.

For more information, refer to [Model Compare Playground UI](../model_compare_ui.md), [MCP Overview](../../mcp.md), and [Admin UI](../ui.md).
