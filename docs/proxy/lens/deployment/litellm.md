---
title: "Add Lens to LiteLLM"
description: "Connect a running Lens service to your gateway and open it from the LiteLLM sidebar."
slug: "/proxy/lens/deployment/litellm"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Add Lens to LiteLLM

Traffic you send through the gateway shows up in Lens as traces with cost when your app or agent has the OpenTelemetry (OTel) environment variables set. Follow the [app tracing](../first-trace.md) or [coding-agent setup](../coding-agents.md). Lens also opens from the LiteLLM sidebar with your LiteLLM login.

You need LiteLLM v1.108.0 or later, a running Lens, and access to the environment settings of both. Gateway admins become Lens admins, so connect only a gateway you trust. {/* keep-version-note: The minimum gateway release is the subject of this note. */}

## 1. Get the Lens address

If Lens already runs, use its existing URL and continue to step 2. For example, a Render service uses its public HTTPS URL. Use the application URL, not the Render dashboard URL.

If you have not installed Lens, complete the [standalone quickstart](./local.md), [server setup](./server.md), or [Helm setup](./kubernetes.md#new-deployment) first. Then return here.

Check that Lens is ready. Replace the example URL with yours:

```sh
curl --fail https://lens.example.com/health/ready
```

Expect HTTP 200. The gateway must also be able to reach this service. A gateway container cannot use `localhost` to reach Lens in another container or on another host.

## 2. Create the two connection secrets

If Lens already connects to a gateway, reuse its existing `LITELLM_LENS_SERVICE_TOKEN` and `LENS_GATEWAY_SECRET`. Do not rotate them as part of adding this connection.

For a new connection, generate two different secrets in a private terminal:

```sh
openssl rand -hex 32
openssl rand -hex 32
```

Save the first as `LITELLM_LENS_SERVICE_TOKEN` and the second as `LENS_GATEWAY_SECRET` in your secret manager. You will give both services the same pair of values.

| Value | Purpose |
| --- | --- |
| `LITELLM_LENS_SERVICE_TOKEN` | Authenticates internal requests from LiteLLM to Lens |
| `LENS_GATEWAY_SECRET` | Lets Lens verify the user identity sent by LiteLLM |

These are separate from the Lens admin token, agent tracing keys, and LiteLLM model keys. Do not put their values in Git, browser code, or shared logs.

## 3. Add the secrets to Lens

Add these environment variables to the **existing Lens service**:

```dotenv
LITELLM_LENS_SERVICE_TOKEN=YOUR_SERVICE_SECRET
LENS_GATEWAY_SECRET=YOUR_SIGNING_SECRET
```

Replace each placeholder with its value from step 2. Keep the other Lens settings unchanged.

<Tabs groupId="lens-host">
<TabItem value="render" label="Render">

Open your Lens service in the Render dashboard. Select **Environment**, add the two variables, then save and redeploy the service. Wait for the deployment to become **Live**.

</TabItem>
<TabItem value="compose" label="Docker Compose">

If you started Lens with the [quickstart](./local.md), add the two variables to the `.env` beside the downloaded `compose.yaml`. From that folder, apply them:

```sh
docker compose up -d --wait
```

If you run the [release bundle](./server.md), add them to `deploy/lens/.env` instead. From the `lens-0.1.0` directory, apply them:

```sh
docker compose -f deploy/lens/compose.yaml up -d --wait
```

</TabItem>
<TabItem value="other" label="Helm or another platform">

**Helm.** Create one Secret with both values in the Lens namespace and in the gateway namespace. A Secret reference cannot cross namespaces. Replace the two placeholders with the values from step 2:

```sh
SERVICE_TOKEN=YOUR_SERVICE_SECRET
GATEWAY_SECRET=YOUR_SIGNING_SECRET
for namespace in lens litellm; do
  kubectl --namespace "$namespace" create secret generic lens-connection \
    --from-literal=service-token="$SERVICE_TOKEN" \
    --from-literal=gateway-secret="$GATEWAY_SECRET"
done
```

Add these values to the Lens `values.yaml` and run its [install command](./kubernetes.md#new-deployment) again:

```yaml title="values.yaml"
gateway:
  enabled: true
  secretName: lens-connection
serviceTokenSecret:
  name: lens-connection
```

**Another platform.** Add the two variables through the Lens service's environment settings, then redeploy it

</TabItem>
</Tabs>

Repeat the readiness check from step 1 after the deployment finishes.

## 4. Configure LiteLLM

Add these variables to the LiteLLM service. In a split gateway/backend deployment, supply them to both services:

```dotenv
LITELLM_LENS_URL=https://lens.example.com
LITELLM_LENS_PUBLIC_URL=https://lens.example.com
LITELLM_LENS_SERVICE_TOKEN=YOUR_SERVICE_SECRET
LENS_GATEWAY_SECRET=YOUR_SIGNING_SECRET
```

Use your Lens URL and the same two secrets from step 2. Neither URL ends in `/ui/` or `/v1/traces`.

`LITELLM_LENS_URL` is the address the gateway calls. `LITELLM_LENS_PUBLIC_URL` is the address shown to agent exporters. They can be the same HTTPS URL. If you use a private address for the first value, the second must still be reachable by your agents.

For Kubernetes, use the private Lens Service address for the gateway connection and a reachable HTTPS origin for exporters

Setting `LITELLM_LENS_URL` turns on the Lens connection, so a gateway without a `config.yaml`, such as the [Docker quickstart](../../docker_quick_start.md), needs no other change. If your gateway has a `config.yaml`, you can also state the store there. Preserve its model list and other settings:

```yaml
general_settings:
  tracing:
    store:
      type: lens
```

Apply the change through your normal gateway deployment

### Helm

The [LiteLLM chart](../../deploy/helm.md) sets the four variables from its values. Add these to the gateway's `values.yaml`, keep its other settings, and upgrade the release. The chart does not install Lens:

```yaml title="values.yaml"
lens:
  enabled: true
  url: http://lens.lens.svc.cluster.local:4318
  publicUrl: https://lens.example.com
  gatewaySecret:
    name: lens-connection
  serviceTokenSecret:
    name: lens-connection
gateway:
  config:
    proxy_config:
      general_settings:
        tracing:
          store:
            type: lens
```

`lens.url` is the private Service address, `http://<release>.<namespace>.svc.cluster.local:4318`. `lens.publicUrl` is the Lens ingress address

### Docker Compose

Lens publishes port 4318 on the host's `127.0.0.1` only, which a gateway container cannot reach. When both run on the same Docker host, attach the gateway to the network Lens already created, `lens_default`. Lens then answers at `http://lens:4318` from the gateway container, and the Lens Compose file stays unchanged. Check that the network exists:

```sh
docker network inspect lens_default --format '{{.Name}}'
```

In your gateway's Compose directory, save the four variables above in `lens-gateway.env` with `LITELLM_LENS_URL=http://lens:4318`. Keep the public URL reachable by agents. Keep the file out of Git and restrict access with `chmod 600 lens-gateway.env`.

Add the file and the network to the existing gateway service in its Compose file, such as `docker-compose.quickstart.yml` from the [Docker quickstart](../../docker_quick_start.md). Preserve its other `env_file` and `networks` entries, and keep `default` so the gateway still reaches its database:

```yaml
services:
  litellm:
    env_file:
      - lens-gateway.env
    networks: [default, lens]

networks:
  lens:
    name: lens_default
    external: true
```

For a gateway on another host or a different network layout, see [Docker networking](./configuration.md#docker-network).

Explicit `environment` entries override `env_file`; update any existing definitions of the four variables so they agree. For a split deployment, add the file to both gateway and backend/API services. Keep your existing database, volumes and model configuration.

Recreate the gateway to load the settings. Replace `litellm` with your service name (`docker compose config --services` lists them), and include the backend service if separate:

```sh
docker compose up -d --no-deps litellm
```

Keep your usual Compose file and project flags. This restarts the selected services and can interrupt requests. Continue with the connection check below.

## 5. Open Lens in the gateway

Sign in to your LiteLLM dashboard as a gateway administrator and select **Lens** in the sidebar. The connected Lens workspace opens on **Traces**. You should not be asked for the standalone Lens admin token.

If the service is connected but has no traces, select **Home** in Lens and follow [Send your first trace](../first-trace.md) from there. Creating the tracing key here applies the gateway user's access scope. Existing standalone traces are not reassigned to a different user or team when you connect the gateway.

Make one normal model request through your gateway to check that its existing model connection still works. Lens setup does not require changing the model endpoint or model keys used by your agents.

## If the connection does not work

| What you see | What to check |
| --- | --- |
| Lens still shows installation instructions | Confirm that all four gateway variables reached the running service, then check its version. |
| Lens is configured but unavailable | Check `/health/ready`, gateway-to-Lens network access, and that both secrets match. |
| You can open Lens but cannot send traces | Check the public ingestion URL and use an agent tracing key, not either connection secret. |
| An existing trace is absent for one user | Check the tracing key's user/team scope. Use an administrator account to inspect the workspace. |

For an API connection check, call `GET /lens/service` on the gateway with a LiteLLM administrator credential. A ready connection reports `connected: true`, `status.storage_ready: true`, `status.credentials_ready: true`, and `status.public_contract: 1`. Keep that credential private. On the LiteLLM Helm chart, send this request through the ingress or to the backend Service; the gateway Service returns 404 for this path.

**Optional:** For help adapting these steps to your deployment, copy the [existing LiteLLM setup prompt](https://github.com/BerriAI/lens/blob/main/docs/setup-with-agent.md#add-lens-to-existing-litellm) into your coding agent. Tell it that Lens already runs and give it the service URL. Share secrets through your secret manager.
