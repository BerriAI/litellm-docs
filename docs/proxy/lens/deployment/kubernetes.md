---
title: "Kubernetes"
description: "Install Lens with Helm and connect a LiteLLM gateway across namespaces."
slug: "/proxy/lens/deployment/kubernetes"
---

# Kubernetes

You need Helm, kubectl and a cluster with a default StorageClass. On EKS, install the [Amazon EBS CSI driver add-on](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html) and configure a StorageClass before installing Lens. If your class is named `gp3`, add `--set clickhouse.storageClassName=gp3` to the Lens command below. Check with `kubectl get storageclass`.

Lens includes ClickHouse and Keeper. It does not need PostgreSQL. The LiteLLM gateway chart is separate and **does not install PostgreSQL or Lens**. Do not use the removed `lensWorker.*` values.

## New deployment {#new-deployment}

For standalone Lens, install the public chart and forward its port:

```sh
helm install lens oci://ghcr.io/berriai/charts/lens \
  --version 0.1.0 --namespace lens --create-namespace --wait --timeout 10m
kubectl --namespace lens port-forward service/lens 4318:4318
```

Keep port-forward running. Open `http://localhost:4318/ui/` and sign in with the admin token from this command in another terminal. Keep the token private:

```sh
curl --fail http://localhost:4318/health/ready
kubectl --namespace lens get secret lens-admin \
  -o jsonpath='{.data.admin-token}' | base64 --decode
```

On first start, Lens can restart a few times with `Error: Storage(Storage(Transport))` while ClickHouse starts. Wait for both pods to become Ready. If restarts continue after ClickHouse is Ready, check [storage and startup diagnostics](./configuration.md#troubleshooting), not just the restart count.

## Connect an existing LiteLLM deployment {#existing-deployment}

Keep your gateway's PostgreSQL, master key, model configuration and release name. The example below also works for a new test gateway: Lens runs in namespace `lens`, LiteLLM in `litellm`. It uses Lens chart `0.1.0` and gateway chart `1.111.0-rc.2`. The gateway chart is at `oci://ghcr.io/berriai/litellm/chart/litellm`.

### Shared connection secrets

For a fresh installation, generate two separate secrets and create the same `lens-connection` Secret in **both namespaces**. Kubernetes cannot reference a Secret in another namespace. For an existing connection, use its current values instead of generating replacements. Run these commands in one private shell without command tracing:

```sh
kubectl create namespace lens
kubectl create namespace litellm
SERVICE_TOKEN=$(openssl rand -hex 32)
GATEWAY_SECRET=$(openssl rand -hex 32)
for namespace in lens litellm; do
  kubectl --namespace "$namespace" create secret generic lens-connection \
    --from-literal=service-token="$SERVICE_TOKEN" \
    --from-literal=gateway-secret="$GATEWAY_SECRET"
done
unset SERVICE_TOKEN GATEWAY_SECRET
```

Skip namespace creation when they already exist. For production, use your secret manager to provision the same keys in each namespace.

### Lens values

Save as `lens-values.yaml`:

```yaml
publicUrl: http://localhost:4318
gateway:
  enabled: true
  secretName: lens-connection
  secretKey: gateway-secret
serviceTokenSecret:
  name: lens-connection
  key: service-token
```

```sh
helm upgrade --install lens oci://ghcr.io/berriai/charts/lens \
  --version 0.1.0 --namespace lens -f lens-values.yaml --wait --timeout 10m
```

Here, `publicUrl` is the browser-facing Lens origin. With port-forward only, `http://localhost:4318` works for browsers and agents on your computer while the tunnel is open. It is not a public service and does not work for agents on other machines. For team access, use a reachable HTTPS address and ingress instead.

### Gateway database and master key

The gateway needs its own PostgreSQL and credentials before Helm can run migrations. Use your existing database in production. For this disposable test only, create an ephemeral PostgreSQL pod and Service. Deleting the pod deletes its database. Create the Secrets in the gateway namespace:

```sh
DB_PASSWORD=$(openssl rand -hex 32)
MASTER_KEY="sk-$(openssl rand -hex 32)"
kubectl --namespace litellm create secret generic litellm-db-secret \
  --from-literal=POSTGRES_USER=litellm --from-literal=POSTGRES_DB=litellm \
  --from-literal=POSTGRES_PASSWORD="$DB_PASSWORD"
kubectl --namespace litellm create secret generic litellm-master-key-secret \
  --from-literal=master-key="$MASTER_KEY"
unset DB_PASSWORD MASTER_KEY
kubectl --namespace litellm run postgres --image=postgres:17.7 \
  --overrides='{"spec":{"containers":[{"name":"postgres","image":"postgres:17.7","envFrom":[{"secretRef":{"name":"litellm-db-secret"}}]}]}}'
kubectl --namespace litellm expose pod postgres --port=5432
kubectl --namespace litellm wait --for=condition=Ready pod/postgres --timeout=5m
kubectl --namespace litellm exec postgres -- sh -c \
  'until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do sleep 2; done'
```

### Gateway values

Save as `gateway-values.yaml`. For an existing gateway, merge the `lens` and tracing settings into its complete values file instead of replacing it:

```yaml
monolith:
  enabled: true
masterKey:
  secretName: litellm-master-key-secret
  secretKey: master-key
database:
  writer:
    host: postgres.litellm.svc.cluster.local
    dbname: litellm
    passwordSecret:
      name: litellm-db-secret
      usernameKey: POSTGRES_USER
      passwordKey: POSTGRES_PASSWORD
gateway:
  config:
    proxy_config:
      general_settings:
        tracing:
          store:
            type: lens
lens:
  enabled: true
  url: http://lens.lens.svc.cluster.local:4318
  publicUrl: http://localhost:4318
  gatewaySecret:
    name: lens-connection
    key: gateway-secret
  serviceTokenSecret:
    name: lens-connection
    key: service-token
```

`lens.url` is the gateway-to-Lens address, so use cluster DNS across namespaces, never `localhost`. `lens.publicUrl` is the address shown to agent exporters. It matches the port-forward address here. Neither URL includes `/ui/` or `/v1/traces`.

```sh
helm upgrade --install litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.111.0-rc.2 --namespace litellm -f gateway-values.yaml --wait --timeout 10m
kubectl --namespace litellm port-forward service/litellm-litellm 4000:4000
```

## Check the installation

Keep the gateway tunnel open and run the Lens port-forward from the standalone section in another terminal. Check both services:

```sh
curl --fail http://localhost:4318/health/ready
curl --fail http://localhost:4000/health/liveliness
MASTER_KEY=$(kubectl --namespace litellm get secret litellm-master-key-secret \
  -o jsonpath='{.data.master-key}' | base64 --decode)
curl --fail http://localhost:4000/lens/service -H "Authorization: Bearer $MASTER_KEY"
unset MASTER_KEY
```

The Lens connection reports `connected: true`. Open `http://localhost:4000/ui/`, sign in as administrator with your gateway master key, then select **Lens**. Users use their LiteLLM session, not the standalone Lens admin token. Follow [Send your first trace](../first-trace.md) to verify stored data.

For a persistent deployment, keep the generated credentials and ClickHouse volume and [back up ClickHouse payloads and Keeper state together](https://github.com/BerriAI/lens/blob/main/docs/backup.md). An older gateway-owned Lens installation needs a [resource ownership transfer](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#select-versions-independently) before changing controllers.
