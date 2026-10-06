---
title: Deploy LiteAdmin MCP on Enterprise
sidebar_label: Deploy MCP (Enterprise)
description: Enable LiteAdmin MCP in unified or componentized LiteLLM deployments and connect Claude Code or Codex.
toc_max_heading_level: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Deploy LiteAdmin MCP on Enterprise

Connect Claude Code or Codex to your gateway at `/admin/mcp` to manage keys, teams, models, and budgets

<EnterpriseFeature feature="Embedded LiteAdmin MCP" />

:::info Image availability

**Available in LiteLLM 1.106.x and later.** Start with an HTTPS deployment and a database. Hosting is off by default; a base Enterprise license covers this feature

:::

## 1. Enable MCP {#enable-the-endpoint}

Keep your existing `DATABASE_URL`, `LITELLM_MASTER_KEY`, and proxy configuration. Rename any MCP server alias called `admin` before enabling the endpoint, which reserves `/admin`

<Tabs groupId="liteadmin-deployment">
<TabItem value="unified" label="Unified Docker" default>

Add these entries to your existing `litellm` service. Supply the license through your secret store or Compose environment

```yaml title="docker-compose.yml (service fragment)"
services:
  litellm:
    environment:
      LITELLM_ENABLE_ADMIN_MCP: "true"
      LITELLM_LICENSE: ${LITELLM_LICENSE}
      PROXY_BASE_URL: https://gateway.example.com
```

Recreate the service:

```bash
docker compose up -d litellm
```

Route `/admin/mcp` to the container's existing port, default `4000`. This works with unified, database, and non-root images

</TabItem>
<TabItem value="componentized" label="Componentized (Helm)">

For the [`helm/litellm` chart](https://github.com/BerriAI/litellm/tree/main/helm/litellm), merge these entries into `backend.extraEnv`. Reuse existing license and public-URL entries to avoid duplicates

```yaml title="values.yaml (componentized chart fragment)"
backend:
  extraEnv:
    - name: LITELLM_ENABLE_ADMIN_MCP
      value: "true"
    - name: LITELLM_LICENSE
      valueFrom:
        secretKeyRef:
          name: litellm-enterprise
          key: license
    - name: PROXY_BASE_URL
      value: https://gateway.example.com
```

Replace `litellm-enterprise` and `license` with your existing Secret name and key, then apply your Helm upgrade

The chart's ingress routes `/admin/mcp` to the backend. For custom ingress, use the backend service port, default `4001`, and preserve the path and `Authorization` header. The gateway component does not serve this endpoint

</TabItem>
</Tabs>

<details>
<summary>Public URL and startup settings</summary>

Set `PROXY_BASE_URL` to your public HTTPS origin for Host and Origin checks. For a separate MCP hostname, set `LITELLM_MCP_PUBLIC_URL=https://admin-mcp.example.com` and connect to `https://admin-mcp.example.com/admin/mcp`

Opting in with an invalid license or enable-flag value fails startup. To disable MCP, set `LITELLM_ENABLE_ADMIN_MCP=false` and restart the serving container

</details>

## 2. Connect a client {#connect-a-client}

For native key authentication, use a personal [virtual key](./virtual_keys.md) owned by a [`proxy_admin`](./access_control.md#global-proxy-roles) for reads and writes. Viewer and team-admin roles cannot connect. Keep the master key on the server

<Tabs groupId="liteadmin-enterprise-client">
<TabItem value="claude-code" label="Claude Code" default>

```bash
claude mcp add --scope user --transport http litellm-admin \
  https://gateway.example.com/admin/mcp \
  --header 'Authorization: Bearer <your-personal-proxy-admin-key>'
```

Restart Claude Code and run `/mcp`. The command stores your key in Claude's configuration and may leave it in shell history

</TabItem>
<TabItem value="codex" label="Codex">

```toml title="~/.codex/config.toml"
[mcp_servers.litellm-admin]
url = "https://gateway.example.com/admin/mcp"
bearer_token_env_var = "LITELLM_API_KEY"
```

For Codex CLI:

```bash
export LITELLM_API_KEY='<your-personal-proxy-admin-key>'
codex
```

Run `/mcp` to check the connection. For Codex desktop, make the same environment variable available to the app and restart it

</TabItem>
</Tabs>

Keep client keys out of version control. The endpoint does not provide browser OAuth login for `codex mcp login`. For Claude Desktop, use the [local MCP setup](./liteadmin_mcp.md#connect-your-client)

<details>
<summary id="native-key-authentication">Custom key headers</summary>

Send `Authorization: Bearer ...` even with `general_settings.litellm_key_header_name`. LiteLLM forwards the same key under your configured header

Keep credential headers separate from identity, transport, audit, network, and policy headers. Conflicting names fail startup

</details>

<details>
<summary id="oauth2-proxy-authentication">OAuth2 proxy authentication</summary>

With `general_settings.enable_oauth2_proxy_auth`, route requests through your authentication proxy. The original caller's direct peer must match `trusted_proxy_ranges`; the headers in `oauth2_config_mappings` select a user with the stored `proxy_admin` role

Configure the proxy to overwrite identity headers with the authenticated user's values. The connector requires a bearer, but native authentication uses the identity headers. A personal admin key does not override this mode

</details>

## 3. Verify {#verify-the-deployment}

Ask your connected client:

> Use LiteAdmin to list my teams and their current budgets.

Confirm that it calls an admin tool and returns your gateway's data. An empty team list is valid

<details>
<summary>Check with curl</summary>

For native key authentication, set `ADMIN_KEY` to your personal proxy-admin key:

```bash
curl --fail-with-body https://gateway.example.com/admin/mcp \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expect a tool catalog with an admin key, `401` without a credential, and `403` without the `proxy_admin` role. A disabled endpoint or a request to the gateway component returns `404`

</details>

## Tool and response settings

<details>
<summary>Restrict tools or change response formats</summary>

Set these variables on the LiteLLM or backend container, then restart it

| Variable | Default | Options |
| --- | --- | --- |
| `LITELLM_ADMIN_READ_ONLY` | `false` | `true` restricts discovery and execution to reviewed read operations; `proxy_admin` required |
| `LITELLM_ADMIN_TOOLS` | All available reviewed operations | Comma-separated [tool names](https://github.com/BerriAI/litellm-admin-mcp/blob/main/src/litellm_admin_mcp/operations.json), such as `list_keys,list_teams`; combines with read-only restrictions |
| `LITELLM_ADMIN_RESPONSE_VIEW` | `full` | `full` returns results inline; `compact` can return saved-result references |
| `LITELLM_ADMIN_SCHEMA_MODE` | `full` | `discovery` defers parameter details to `describe_admin_tool`; execution validates the full schema |

Keep `full` responses for multiple workers or replicas. With `compact`, send `read_admin_result` calls to the same worker process; pod affinity alone is insufficient. Results expire and disappear on worker restart. Inspect gateway state before retrying a write

</details>

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Startup fails | Check the license, enable flag, and conflicting header names in the startup error |
| Missing MCP dependency | Use a unified or backend image from LiteLLM 1.106.x or later |
| `404` | Check the image version, enable flag, and container restart. Route `/admin/mcp` unchanged to the unified proxy or backend |
| `401` or `403` in key mode | Use an active personal `proxy_admin` key |
| OAuth2 proxy authentication fails | Check the trusted direct peer, mapped identity headers, and stored user role |
| Host or Origin rejected | Match `PROXY_BASE_URL` or `LITELLM_MCP_PUBLIC_URL` to your public HTTPS origin |
| Missing tools | Check tool restrictions and the underlying management API's availability |
| Compact result unavailable | Use the same worker process or switch to `full` |
| Write times out | Inspect gateway state before retrying; the connector does not retry tool calls |

For model creation, see [Add a model deployment](./liteadmin_mcp.md#add-a-model-deployment). To run the Slack agent worker, follow [LiteAdmin Slack app setup](./liteadmin_slack.md)
