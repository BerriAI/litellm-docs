---
title: Production rollout
sidebar_label: Production rollout
description: Roll out LiteLLM Enterprise in five steps. Deploy the gateway, give access to models, MCP tools, and agents, connect clients, secure authentication, and allocate costs across projects and business units.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

This guide gives the five steps to roll out LiteLLM Enterprise for all the teams in your company. Do the steps in sequence. Each step uses the deployment, the team, and the virtual key from the steps before it.

1. [Deploy LiteLLM](#step-1-deploy-litellm) with the critical deployment settings.
2. [Give access](#step-2-give-access-to-models-mcp-tools-and-agents) to providers, models, MCP tools, and agents.
3. [Configure the client endpoints](#step-3-configure-the-client-endpoints).
4. [Implement secure authentication](#step-4-implement-secure-authentication).
5. [Set up chargeback](#step-5-set-up-chargeback) and allocate costs across projects and business units.

:::info

- **Free trial**: [30-day enterprise license](https://www.litellm.ai/enterprise#trial)
- **Talk to us**: [Book a demo](https://enterprise.litellm.ai/demo)
- **Gateway that you run now**: start with [Moving from OSS](/docs/enterprise/moving_from_oss)
- **All Enterprise features**: [Enterprise overview](/docs/enterprise)

:::

## Step 1. Deploy LiteLLM

### Critical deployment settings

Make these decisions before the first deployment. Each one is difficult to change after teams start to use the gateway.

- **Postgres.** The Admin UI, virtual keys, the MCP and agent registries, and budget tracking keep their data in Postgres. Refer to [Database sizing](/docs/proxy/db_sizing).
- **Redis.** Run Redis 7.0 or newer when you run more than one instance or more than one worker. Without Redis, each instance enforces rate limits and budgets independently. Refer to [What needs Redis](/docs/proxy/redis_requirements).
- **Salt key.** Set `LITELLM_SALT_KEY` before you add the first model. The salt key encrypts the stored credentials, and you must not change it after you add a model. Refer to [Set the salt key](/docs/proxy/prod#set-the-salt-key).
- **Master key.** Keep the master key in your secret manager. Applications must use virtual keys, not the master key.
- **Version.** Pin an exact version or image digest, and [verify the image signature](/docs/proxy/docker_image_security). Stay on a [supported version](/docs/enterprise/version_support).
- **Topology.** For more than one region, read [Multi-region deployment](/docs/proxy/multi_region) before you deploy.

The full list is in [Production best practices](/docs/proxy/prod) and [Security best practices](/docs/proxy/security_best_practices).

### Prerequisites

- An API key for an LLM provider (OpenAI, Azure, Anthropic, or a different provider)
- A Postgres database, or the Postgres database that the deployment method creates
- Your **Enterprise license key**
- A deployment target: **Docker Compose**, **Kubernetes** (`kubectl`), or **Helm**

### Deploy the gateway

<Tabs>
<TabItem value="docker-compose" label="Docker Compose">

Follow the [Quickstart](/docs/proxy/docker_quick_start). Condensed steps:

```bash
curl -O https://raw.githubusercontent.com/BerriAI/litellm/main/docker-compose.yml
```

Create `.env`:

```bash
LITELLM_MASTER_KEY="sk-<paste-a-long-random-key>"
LITELLM_SALT_KEY="sk-salt-change-me"
LITELLM_LICENSE="eyJ..."
OPENAI_API_KEY="your-api-key"
```

Create `config.yaml`:

```yaml title="config.yaml" showLineNumbers
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["prometheus"]

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: "postgresql://llmproxy:dbpassword9090@db:5432/litellm"
  store_model_in_db: true
```

```bash
docker compose up
```

</TabItem>

<TabItem value="kubernetes" label="Kubernetes">

Deploy with raw manifests when you manage your own Postgres and want full control over the resources. You need an existing Postgres reachable from the cluster.

#### 1. Create a ConfigMap for `config.yaml`

```yaml title="litellm-config.yaml" showLineNumbers
apiVersion: v1
kind: ConfigMap
metadata:
  name: litellm-config
data:
  config.yaml: |
    model_list:
      - model_name: {{openai_large}}
        litellm_params:
          model: openai/{{openai_large}}
          api_key: os.environ/OPENAI_API_KEY

    litellm_settings:
      callbacks: ["prometheus"]

    general_settings:
      master_key: os.environ/LITELLM_MASTER_KEY
      store_model_in_db: true
```

```bash
kubectl apply -f litellm-config.yaml
```

#### 2. Create a Secret for keys

```bash
kubectl create secret generic litellm-secrets \
  --from-literal=LITELLM_MASTER_KEY="sk-<paste-a-long-random-key>" \
  --from-literal=LITELLM_SALT_KEY="sk-salt-change-me" \
  --from-literal=LITELLM_LICENSE="eyJ..." \
  --from-literal=OPENAI_API_KEY="your-api-key" \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/litellm"
```

#### 3. Create `deployment.yaml`

```yaml title="deployment.yaml" showLineNumbers
apiVersion: apps/v1
kind: Deployment
metadata:
  name: litellm-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: litellm
  template:
    metadata:
      labels:
        app: litellm
    spec:
      containers:
        - name: litellm
          image: docker.litellm.ai/berriai/litellm:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 4000
          envFrom:
            - secretRef:
                name: litellm-secrets
          args:
            - "--config"
            - "/app/proxy_config.yaml"
          volumeMounts:
            - name: config-volume
              mountPath: /app/proxy_config.yaml
              subPath: config.yaml
              readOnly: true
          livenessProbe:
            httpGet:
              path: /health/liveliness
              port: 4000
            initialDelaySeconds: 120
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health/readiness
              port: 4000
            initialDelaySeconds: 120
            periodSeconds: 15
      volumes:
        - name: config-volume
          configMap:
            name: litellm-config
```

```bash
kubectl apply -f deployment.yaml
```

#### 4. Create `service.yaml`

```yaml title="service.yaml" showLineNumbers
apiVersion: v1
kind: Service
metadata:
  name: litellm-service
spec:
  selector:
    app: litellm
  ports:
    - protocol: TCP
      port: 4000
      targetPort: 4000
  type: NodePort
```

```bash
kubectl apply -f service.yaml
```

#### 5. Start the server

```bash
kubectl port-forward service/litellm-service 4000:4000
```

Your LiteLLM Gateway is now running on `http://0.0.0.0:4000`.

</TabItem>

<TabItem value="helm" label="Helm">

The chart is published to an OCI registry, so Helm installs it directly; there is no need to clone the repo. It can provision Postgres for you (`db.deployStandalone: true`) or point at an existing database (`db.useExisting`). See the [chart README](https://github.com/BerriAI/litellm/blob/main/helm/litellm-helm/README.md) and the full [values.yaml](https://github.com/BerriAI/litellm/blob/main/helm/litellm-helm/values.yaml).

#### 1. Create a Secret for your license + provider keys

```bash
kubectl create secret generic litellm-env-secret \
  --from-literal=LITELLM_LICENSE="eyJ..." \
  --from-literal=OPENAI_API_KEY="your-api-key"
```

#### 2. Create `values-enterprise.yaml`

Layer your enterprise settings onto the chart. `environmentSecrets` injects the Secret above as env vars, which `proxy_config` then references with `os.environ/<NAME>`.

```yaml title="values-enterprise.yaml" showLineNumbers
masterkey: sk-<your-litellm-api-key>

environmentSecrets:
  - litellm-env-secret

db:
  deployStandalone: true

proxyConfigMap:
  create: true

proxy_config:
  model_list:
    - model_name: {{openai_large}}
      litellm_params:
        model: openai/{{openai_large}}
        api_key: os.environ/OPENAI_API_KEY
  litellm_settings:
    callbacks: ["prometheus"]
  general_settings:
    store_model_in_db: true
```

`db.deployStandalone: true` provisions a single-node Postgres with the Bitnami chart and a default password. Fine for a trial; for anything longer-lived, override it with `--set postgresql.auth.password=<pw>,postgresql.auth.postgres-password=<pw>` or bring your own database below.

**Bring your own database.** To point at an existing Postgres instead of letting the chart provision one, replace the `db` block. Create a Secret (default name `postgres`) holding `username` and `password` keys; the chart builds the connection URL from `endpoint`, `database`, and those credentials.

```yaml title="values-enterprise.yaml" showLineNumbers
db:
  useExisting: true
  endpoint: my-postgres.default.svc.cluster.local
  database: litellm
  secret:
    name: litellm-db-secret
    usernameKey: username
    passwordKey: password
```

#### 3. Deploy with Helm

Install the chart straight from the OCI registry, passing your enterprise values:

```bash
helm install \
  -f values-enterprise.yaml \
  mydeploy \
  oci://docker.litellm.ai/berriai/litellm-helm
```

#### 4. Expose the service to localhost

```bash
kubectl port-forward service/mydeploy-litellm-helm 4000:4000
```

Your LiteLLM Gateway is now running on `http://127.0.0.1:4000`.

</TabItem>
</Tabs>

### Verify Enterprise Edition

Open `http://localhost:4000/`. The API docs page must show **Enterprise Edition** in the description. If it does not, refer to [Activate your license](/docs/enterprise/activate).

Open the Admin UI at `http://localhost:4000/ui` and sign in with your master key. In Step 4, you replace this login with SSO.

---

## Step 2. Give access to models, MCP tools, and agents

In this step, you add providers, models, MCP servers, and agents to the gateway. Then you give one team access to them.

### 2a. Add providers and models

The deployment in Step 1 adds `{{openai_large}}` in `config.yaml`. To add more models, use the **Models** page of the Admin UI or `model_list` in `config.yaml`. Use one source of truth for models. Refer to [Model management](/docs/proxy/model_management) and [all the providers](/docs/providers).

### 2b. Create an organization, a team, and a virtual key

Do these steps in the Admin UI.

| Step | Action | Why |
| ---- | ------ | --- |
| 1 | Create an **Organization** and a **Team** | An organization is the top-level entity, for example a business unit. An organization contains teams, for example a frontend team. |
| 2 | Invite **Internal Users** to the team | Each user gets access to the team models, and the gateway tracks the spend of each user. |
| 3 | Set the team **`max_budget`** (for example `$10` for `30d`) | The budget gives a hard spend limit. In Step 5, you use it to examine budget enforcement. |
| 4 | Create a **team virtual key** with access to the model | Applications use this key in Step 3. The gateway records the spend of the key and the team. |

Refer to [Multi-tenant architecture](/docs/proxy/multi_tenant_architecture) and [Virtual keys](/docs/proxy/virtual_keys).

### 2c. Add MCP tools

1. In the Admin UI, go to **MCP Servers** and select **Add New MCP Server**:

   - Name: `deepwiki`
   - URL: `https://mcp.deepwiki.com/mcp`
   - Transport: HTTP

   Or add the server to `config.yaml`:

```yaml
mcp_servers:
  deepwiki:
    url: https://mcp.deepwiki.com/mcp
    transport: http
    available_on_public_internet: true
```

2. In the MCP settings of the team or the virtual key, allow the `deepwiki` server. Refer to [MCP permission management](/docs/mcp_control).
3. Make sure that the tools show in the Admin UI under **MCP Servers > MCP Tools**.

### 2d. Add agents

1. Deploy a sample A2A agent, for example [Multi-agent collaboration using A2A](https://github.com/a2aproject/a2a-samples/tree/main/demo). This agent supports streaming.
2. In the Admin UI, go to **Agents** and select **Add Agent**. Enter the name and the URL of the agent.
3. In the agent settings of the virtual key, allow the agent. Refer to [Agent permission management](/docs/a2a_agent_permissions).

```mermaid
flowchart TD
    CLIENT["Client (A2A SDK / curl)"]
    CLIENT -->|"Authorization: Bearer sk-..."| PROXY["LiteLLM Agent Gateway"]
    PROXY -->|"object_permission.agents"| PERMS["Key / Team agent allowlist"]
    PERMS -->|"GET /v1/agents filter"| LIST["Agent catalog"]
    PERMS -->|"POST /a2a/{agent_id}"| AGENT["Downstream A2A Agent"]
    AGENT -->|"response + nested LLM calls"| PROXY
    PROXY -->|"X-LiteLLM-Trace-Id · agent spend"| LOGS["Logs tab · Agent cost tracking"]
```

→ [MCP overview](/docs/mcp) · [Agent Gateway overview](/docs/a2a)

---

## Step 3. Configure the client endpoints

Applications and tools send requests to the gateway URL with the team virtual key. In this step, you send one LLM request, one MCP tool call, and one agent call. Then you connect your client tools.

### 3a. LLM requests

```mermaid
flowchart TD
    APP["Client App / SDK"]
    APP -->|"Authorization: Bearer sk-..."| PROXY["LiteLLM Gateway"]
    PROXY -->|"virtual key lookup"| KEY["Virtual Key + Team"]
    KEY -->|"model allowlist"| ROUTE["LLM Router /v1/chat/completions"]
    ROUTE -->|"litellm_params.model"| PROVIDER["Provider API (OpenAI, Azure, Bedrock)"]
    PROXY -->|"request + token spend"| LOGS["Logs tab · Spend dashboard"]
```

1. Send a request with the team virtual key:

```bash
curl -X POST 'http://localhost:4000/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-team-key' \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hello from LiteLLM Enterprise Gateway"}]
  }'
```

2. Make sure that the response is `200 OK`. The assistant text is in `choices[0].message.content`.
3. Open the **Logs** page. Make sure that the log shows the key, the team, the model, the latency, and the spend.
4. Open the **Teams** page and select your team. Make sure that the spend increased.

### 3b. MCP tool calls

```mermaid
flowchart TD
    CLIENT["Client (curl / OpenAI SDK / Cursor)"]
    CLIENT -->|"x-litellm-api-key: Bearer sk-..."| PROXY["LiteLLM MCP Gateway"]
    PROXY -->|"object_permission.mcp_servers"| PERMS["Key / Team MCP allowlist"]
    PERMS -->|"allowed server"| MCP["DeepWiki MCP Server"]
    MCP -->|"tool result"| PROXY
    PROXY -->|"mcp tool call log + cost"| LOGS["Logs tab · MCP cost tracking"]
```

1. Send a request that uses the `deepwiki` tools:

```bash
curl -X POST 'http://localhost:4000/v1/chat/completions' \
  -H 'Authorization: Bearer sk-team-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "TLDR of BerriAI/litellm repo"}],
    "tools": [{
      "type": "mcp",
      "server_url": "litellm_proxy/deepwiki",
      "server_label": "deepwiki",
      "require_approval": "never"
    }]
  }'
```

2. Make sure that the response contains the tool output and a summary from the assistant.
3. Open the **Logs** page. Make sure that the log shows the MCP tool call with the tool name and the cost.

Refer to [Using your MCP](/docs/mcp_usage).

### 3c. Agent calls

1. List the agents that the key can use:

```bash
curl -H 'Authorization: Bearer sk-team-key' \
  'http://localhost:4000/v1/agents'
```

2. Call the agent with the A2A SDK:

```python showLineNumbers title="invoke_a2a_agent.py"
import httpx, asyncio
from uuid import uuid4
from a2a.client import A2ACardResolver, A2AClient
from a2a.types import MessageSendParams, SendMessageRequest

LITELLM_BASE_URL = "http://localhost:4000"
LITELLM_VIRTUAL_KEY = "sk-team-key"

async def main():
    headers = {"Authorization": f"Bearer {LITELLM_VIRTUAL_KEY}"}
    async with httpx.AsyncClient(headers=headers) as client:
        agents = (await client.get(f"{LITELLM_BASE_URL}/v1/agents")).json()
        agent_id = agents[0]["agent_id"]
        base_url = f"{LITELLM_BASE_URL}/a2a/{agent_id}"
        resolver = A2ACardResolver(httpx_client=client, base_url=base_url)
        a2a_client = A2AClient(
            httpx_client=client,
            agent_card=await resolver.get_agent_card(),
        )
        response = await a2a_client.send_message(
            SendMessageRequest(
                id=str(uuid4()),
                params=MessageSendParams(
                    message={
                        "role": "user",
                        "parts": [{"kind": "text", "text": "Hello, what can you do?"}],
                        "messageId": uuid4().hex,
                    }
                ),
            )
        )
        print(response.model_dump(mode="json", exclude_none=True, indent=2))

asyncio.run(main())
```

3. Open the **Logs** page. Make sure that the log shows the key, the team, the latency, and the cost of the agent call.

Refer to [Invoking A2A agents](/docs/a2a_invoking_agents) and [Agent cost tracking](/docs/a2a_cost_tracking).

### 3d. Connect your client tools

Code tools and chat apps use the gateway URL and a virtual key or a sign-in token. Each client has a setup page, for example Claude Code, Codex, and Claude Desktop. Refer to [Client setup](/docs/proxy/client_setup/overview).

---

## Step 4. Implement secure authentication

In this step, you replace the shared master key login with your identity provider. Then you limit what each person and each workload can do.

### SSO for the Admin UI

SSO controls the login to the Admin UI. API requests use a different method: virtual keys or JWT. Register this redirect URI in your identity provider:

```
https://<your-proxy-base-url>/sso/callback
```

<Tabs>
<TabItem value="google" label="Google">

```bash
GOOGLE_CLIENT_ID="<your-client-id>"
GOOGLE_CLIENT_SECRET="<your-client-secret>"
PROXY_BASE_URL="https://<your-proxy-base-url>"
```

</TabItem>
<TabItem value="microsoft" label="Microsoft">

```bash
MICROSOFT_CLIENT_ID="<your-client-id>"
MICROSOFT_CLIENT_SECRET="<your-client-secret>"
MICROSOFT_TENANT="<your-tenant-id>"
PROXY_BASE_URL="https://<your-proxy-base-url>"
```

</TabItem>
<TabItem value="okta" label="Okta / Generic OIDC">

```bash
GENERIC_CLIENT_ID="<your-client-id>"
GENERIC_CLIENT_SECRET="<your-client-secret>"
GENERIC_AUTHORIZATION_ENDPOINT="https://<your-idp>/oauth2/v1/authorize"
GENERIC_TOKEN_ENDPOINT="https://<your-idp>/oauth2/v1/token"
GENERIC_USERINFO_ENDPOINT="https://<your-idp>/oauth2/v1/userinfo"
PROXY_BASE_URL="https://<your-proxy-base-url>"
```

</TabItem>
</Tabs>

Sign in to the Admin UI through your identity provider. Then disable the login with the master key and `UI_PASSWORD`. Refer to [Disable environment credential login](/docs/proxy/security_best_practices#disable-environment-credential-login-to-the-admin-ui).

To create users and teams from your identity provider, use [SCIM provisioning](/docs/tutorials/scim_litellm). For more options, refer to [SSO for the Admin UI](/docs/proxy/admin_ui_sso), [SSO event hooks](/docs/proxy/custom_sso), and [CLI SSO](/docs/proxy/cli_sso).

### JWT authentication for API traffic

Workloads can send JWTs from your OIDC provider in place of long-lived virtual keys. The JWT claims can map each request to a LiteLLM user, team, and model access. Refer to [JWT authentication](/docs/proxy/token_auth) and [JWT to virtual key mapping](/docs/proxy/jwt_key_mapping).

### Least-privilege access

Give each person the minimum [RBAC role](/docs/proxy/access_control), and keep the number of proxy admins small. Give each production workload its own [service account](/docs/proxy/service_accounts) key, so that you can revoke one workload without an effect on the others. To limit the network sources, use [IP address filtering](/docs/proxy/ip_address).

### Secret manager

Keep the provider keys in your secret manager, not in configuration files. Refer to [Secret managers](/docs/secret_managers/overview).

### Audit logs

Audit logs are on by default when the gateway has a license. To turn them off, set `store_audit_logs: false` in `litellm_settings`. To do a test, delete a virtual key in the API or the Admin UI. Then open the **Audit Logs** page. Refer to [Audit logs](/docs/proxy/multiple_admins).

---

## Step 5. Set up chargeback

Chargeback assigns the cost of each request to the business unit or project that sent it. LiteLLM attributes spend at each level of the tenant hierarchy: organization, team, user, and virtual key. Projects and tags add more dimensions. Use organizations for business units and teams for the groups in them. Use projects for applications, and tags for costs that go across teams.

```mermaid
flowchart TD
    REQUEST["Client Request (LLM / MCP / Agent)"]
    REQUEST -->|"Authorization: Bearer sk-..."| PROXY["LiteLLM Enterprise Gateway"]

    PROXY -->|"key.team_id"| TEAMS["Team (Org hierarchy)"]
    PROXY -->|"virtual key lookup"| KEYS["Virtual Keys"]
    PROXY -->|"metadata.tags on request"| TAGS["Tag Budget (cross-cutting projects)"]

    TEAMS --> TBUDGET["Team max_budget / Monthly spend envelope"]
    KEYS --> KBUDGET["Key max_budget + RPM/TPM limits"]
    TAGS --> TABUDGET["Tag budget limits"]

    TBUDGET --> ENFORCE["Budget check before route"]
    KBUDGET --> ENFORCE
    TABUDGET --> ENFORCE
    ENFORCE --> ROUTES["LLM / MCP / Agent routes"]
    PROXY --> SPEND["Spend dashboard · GET /spend/tags"]
```

The same virtual key and the same budgets apply to LLM, MCP, and agent requests.

### 5a. Team budget

You set the team `max_budget` in Step 2. After Step 3:

1. Open the **Teams** page and select your team.
2. Make sure that the spend includes the LLM, MCP, and agent calls.
3. Optional: set the team `max_budget` to a very low value, for example `$0.0001`. Send one LLM request, and make sure that the gateway returns a budget error.

To send an email to a team before it reaches its budget, use [soft budget alerts](/docs/proxy/ui_team_soft_budget_alerts).

### 5b. Projects

A project groups the keys of one application or use case. A project has a budget, owners, rate limits, a model allowlist, and its own spend view. Refer to [Projects](/docs/proxy/project_management).

### 5c. Key budget and rate limits

1. Create a key with a small budget and an RPM limit:

```bash
curl -X POST 'http://localhost:4000/key/generate' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "max_budget": 0.01,
    "rpm_limit": 1,
    "team_id": "<your-team-id>"
  }'
```

2. Send a request with the new key. Make sure that the response is `200 OK`.
3. Send a second request in the same minute. Make sure that the gateway returns a rate limit error.
4. Open **Virtual Keys** in the Admin UI and find the spend of the key.

Refer to [Virtual keys](/docs/proxy/virtual_keys).

### 5d. Tag budget

1. Add `tag_budget_config` to `config.yaml` and restart the gateway:

```yaml
litellm_settings:
  tag_budget_config:
    poc:chat-app:
      max_budget: 0.000000000001
      budget_duration: 1d
```

2. Send a request with the tag:

```bash
curl -X POST 'http://localhost:4000/chat/completions' \
  -H 'Authorization: Bearer sk-team-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hello"}],
    "metadata": {"tags": ["poc:chat-app"]}
  }'
```

3. Make sure that the first request is successful. Send a second request with the same tag. Make sure that the gateway returns a budget error.

4. Get the spend for each tag:

```bash
curl -X GET 'http://localhost:4000/spend/tags' \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Make sure that the response shows `poc:chat-app` with `total_spend` and `log_count`.

Refer to [Request tags](/docs/proxy/request_tags) and [Tag budgets](/docs/proxy/tag_budgets).

### 5e. Spend reports

To send costs to finance, get spend reports by team, key, tag, or model with the API. Refer to [Generate spend reports](/docs/proxy/cost_tracking#-enterprise-generate-spend-reports).

For temporary limits, use a [temporary budget increase](/docs/proxy/temporary_budget_increase). For tiers of limits, use [budget and rate limit tiers](/docs/proxy/rate_limit_tiers).

---

## After the rollout

- **Guardrails.** Create a guardrail, attach it to a team or a key with a policy, and send a request that the guardrail must block. Refer to [Guardrails quick start](/docs/proxy/guardrails/quick_start) and [Guardrail policies](/docs/proxy/guardrails/guardrail_policies).
- **Team logging.** Send the logs of each team to its own observability project. Refer to [Team and key logging](/docs/proxy/team_logging).
- **AI Hub.** Show the models, MCP servers, and agents that your users can use on one page. Refer to [AI Hub](/docs/proxy/ai_hub).
- **Security review.** Collect the SOC 2 Type II report and the answers for your security team. Refer to [Compliance and SOC 2 Type II](/docs/enterprise/compliance).

## Get help

Each Enterprise license includes a dedicated Slack or Teams channel with the LiteLLM engineers. You can also send an email to `support@berri.ai`. Refer to [Support and SLA](/docs/enterprise/support).
