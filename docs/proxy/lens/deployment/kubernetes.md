---
title: "Kubernetes"
description: "Install Lens and connect LiteLLM with pinned Helm charts, existing PostgreSQL and Kubernetes Secrets."
slug: "/proxy/lens/deployment/kubernetes"
---

# Kubernetes

Use Helm and kubectl with your cluster. The cluster needs a default StorageClass; set `clickhouse.storageClassName` in the Lens values otherwise.

Lens includes persistent ClickHouse storage with Keeper and does not use PostgreSQL. The separate LiteLLM gateway chart **does not bundle PostgreSQL or Lens**, by design. Use an existing managed PostgreSQL database reachable from the gateway and migration pods, with permission to create and migrate the LiteLLM schema. The published gateway chart uses `lens.*`, not the removed `lensWorker.*` settings.

## Prepare the deployment

Set your namespaces, release names, DNS hostnames and installed ingress controller's class. Choose the gateway chart's `ingress.controller` mode for that controller from `helm show values`. Keep the chart versions pinned:

```sh
export LENS_NAMESPACE="<lens-namespace>" GATEWAY_NAMESPACE="<gateway-namespace>"
export LENS_RELEASE="<lens-release>" GATEWAY_RELEASE="<gateway-release>"
export LENS_VERSION="0.1.0" GATEWAY_VERSION="1.111.0-rc.2"
export LENS_HOST="<lens-hostname>" GATEWAY_HOST="<gateway-hostname>"
export INGRESS_CLASS="<ingress-class>" GATEWAY_INGRESS_CONTROLLER="<chart-controller-mode>"
export DB_HOST="<postgres-hostname>" DB_NAME="<database-name>"
export SECRET_DIR="<private-directory-outside-your-repository>"
kubectl create namespace "$LENS_NAMESPACE"
kubectl create namespace "$GATEWAY_NAMESPACE"
```

Use existing namespaces when available. For an existing gateway, keep its release, database, keys and model configuration, and merge the Lens settings into its complete values file. For standalone Lens, omit `gateway` and `serviceTokenSecret` from the Lens values and skip the gateway steps.

### Provision Secrets

Use your secret manager to provision Secrets directly, or export credentials to files in `$SECRET_DIR` with directory mode `0700` and file mode `0600`. Files must contain only the value, without a trailing newline. Export PostgreSQL credentials as `db-username` and `db-password`, and its trusted CA bundle as `db-ca.crt`. Keep passwords out of values files, command arguments and shell history. Disable shell tracing.

For a **new installation only**, generate the Lens admin token, gateway master key and two distinct connection credentials into that directory. Reuse existing credentials on upgrades:

```sh
umask 077
openssl rand -hex 32 | tr -d '\n' > "$SECRET_DIR/admin-token"
openssl rand -hex 32 | tr -d '\n' > "$SECRET_DIR/service-token"
openssl rand -hex 32 | tr -d '\n' > "$SECRET_DIR/gateway-secret"
{ printf 'sk-'; openssl rand -hex 32 | tr -d '\n'; } > "$SECRET_DIR/master-key"
kubectl --namespace "$LENS_NAMESPACE" create secret generic lens-admin \
  --from-file=admin-token="$SECRET_DIR/admin-token"
for namespace in "$LENS_NAMESPACE" "$GATEWAY_NAMESPACE"; do
  kubectl --namespace "$namespace" create secret generic lens-connection \
    --from-file=service-token="$SECRET_DIR/service-token" \
    --from-file=gateway-secret="$SECRET_DIR/gateway-secret"
done
kubectl --namespace "$GATEWAY_NAMESPACE" create secret generic gateway-master-key \
  --from-file=master-key="$SECRET_DIR/master-key"
kubectl --namespace "$GATEWAY_NAMESPACE" create secret generic gateway-db \
  --from-file=username="$SECRET_DIR/db-username" \
  --from-file=password="$SECRET_DIR/db-password"
kubectl --namespace "$GATEWAY_NAMESPACE" create secret generic gateway-db-ca \
  --from-file=ca.crt="$SECRET_DIR/db-ca.crt"
```

The matching `lens-connection` Secret must exist in **both namespaces** because Kubernetes Secret references cannot cross namespaces. Retain these credentials in your secret manager and recovery materials.

Provision DNS, ingress routing and TLS certificates for both public hostnames before team access. Supply `lens.crt` / `lens.key` and `gateway.crt` / `gateway.key` from your certificate manager, or create TLS Secrets from files:

```sh
kubectl --namespace "$LENS_NAMESPACE" create secret tls lens-tls \
  --cert="$SECRET_DIR/lens.crt" --key="$SECRET_DIR/lens.key"
kubectl --namespace "$GATEWAY_NAMESPACE" create secret tls gateway-tls \
  --cert="$SECRET_DIR/gateway.crt" --key="$SECRET_DIR/gateway.key"
```

## Install Lens {#new-deployment}

Create `lens-values.yaml`. The shell expands your non-secret deployment variables:

```sh
cat > lens-values.yaml <<EOF
fullnameOverride: ${LENS_RELEASE}
publicUrl: https://${LENS_HOST}
adminTokenSecret: {name: lens-admin, key: admin-token}
gateway:
  enabled: true
  secretName: lens-connection
  secretKey: gateway-secret
serviceTokenSecret: {name: lens-connection, key: service-token}
clickhouse:
  storage: 20Gi
ingress:
  enabled: true
  className: ${INGRESS_CLASS}
  host: ${LENS_HOST}
  tls:
    - secretName: lens-tls
      hosts: [${LENS_HOST}]
EOF
helm upgrade --install "$LENS_RELEASE" oci://ghcr.io/berriai/charts/lens \
  --version "$LENS_VERSION" --namespace "$LENS_NAMESPACE" \
  -f lens-values.yaml --wait --timeout 10m
```

Size `clickhouse.storage` for traffic and retention, and review `retentionDays`, `resources` and `clickhouse.resources` for your workload. The chart sets CPU/memory requests and memory limits by default. Review gateway `gateway.resources`, its sidecar resources and `migrationJob.resources` separately. The values below are starting allocations, not production sizing guarantees. Preserve persistent volumes and [back up ClickHouse payloads and Keeper state together](./storage.md) before upgrades.

## Connect a LiteLLM gateway {#existing-deployment}

Create `gateway-values.yaml`. Both the gateway and migration Job mount the database CA; `verify-full` verifies the PostgreSQL hostname and certificate:

```sh
cat > gateway-values.yaml <<EOF
fullnameOverride: ${GATEWAY_RELEASE}
monolith: {enabled: true}
masterKey: {secretName: gateway-master-key, secretKey: master-key}
database:
  writer:
    host: ${DB_HOST}
    dbname: ${DB_NAME}
    passwordSecret: {name: gateway-db, usernameKey: username, passwordKey: password}
    sslMode: verify-full
    sslRootCert: /etc/postgresql-ca/ca.crt
gateway:
  resources:
    requests: {cpu: 500m, memory: 1Gi}
    limits: {cpu: "2", memory: 4Gi}
  volumes:
    - {name: db-ca, secret: {secretName: gateway-db-ca}}
  volumeMounts:
    - {name: db-ca, mountPath: /etc/postgresql-ca, readOnly: true}
  config:
    proxy_config:
      general_settings:
        tracing:
          store: {type: lens}
migrationJob:
  resources:
    requests: {cpu: 250m, memory: 512Mi}
    limits: {cpu: "1", memory: 2Gi}
  volumes:
    - {name: db-ca, secret: {secretName: gateway-db-ca}}
  volumeMounts:
    - {name: db-ca, mountPath: /etc/postgresql-ca, readOnly: true}
lens:
  enabled: true
  url: http://${LENS_RELEASE}.${LENS_NAMESPACE}.svc.cluster.local:4318
  publicUrl: https://${LENS_HOST}
  gatewaySecret: {name: lens-connection, key: gateway-secret}
  serviceTokenSecret: {name: lens-connection, key: service-token}
ingress:
  enabled: true
  className: ${INGRESS_CLASS}
  controller: ${GATEWAY_INGRESS_CONTROLLER}
  host: ${GATEWAY_HOST}
  tls:
    - secretName: gateway-tls
      hosts: [${GATEWAY_HOST}]
EOF
helm upgrade --install "$GATEWAY_RELEASE" oci://ghcr.io/berriai/litellm/chart/litellm \
  --version "$GATEWAY_VERSION" --namespace "$GATEWAY_NAMESPACE" \
  -f gateway-values.yaml --wait --timeout 10m
```

Lens `publicUrl` is its browser-facing HTTPS origin. Gateway `lens.publicUrl` is the address shown to agent exporters. Gateway `lens.url` is the private service address, using cluster DNS across namespaces, never `localhost`. None includes `/ui/` or `/v1/traces`. The public addresses require working ingress, DNS and TLS; port-forward is only a first check.

## Check the installation

Helm waits for readiness, including the gateway's database migration. On first start, Lens can restart a few times with `Error: Storage(Storage(Transport))` while ClickHouse initializes. Wait for ClickHouse and Lens to become Ready. Persistent failures need [storage and startup diagnostics](./configuration.md#troubleshooting).

For an initial check, run each port-forward in a separate terminal with the same variables:

```sh
kubectl --namespace "$LENS_NAMESPACE" port-forward service/"$LENS_RELEASE" 4318:4318
```

```sh
kubectl --namespace "$GATEWAY_NAMESPACE" port-forward service/"$GATEWAY_RELEASE" 4000:4000
```

Then check readiness and the authenticated gateway-to-Lens connection without putting the master key in curl's arguments:

```sh
curl --fail http://localhost:4318/health/ready
curl --fail http://localhost:4000/health/readiness
{ printf 'Authorization: Bearer '; cat "$SECRET_DIR/master-key"; printf '\n'; } | \
  curl --fail --header @- http://localhost:4000/lens/service
```

Expect `connected: true`, `storage_ready: true` and `credentials_ready: true`. Stop the tunnels after this check. Open `https://$GATEWAY_HOST/ui/`, sign in with the gateway administrator credential and select **Lens**. Standalone Lens is at `https://$LENS_HOST/ui/` and uses the Lens admin token. Follow [Send your first trace](../first-trace.md) to verify stored data through the published endpoint.

## Upgrade

Back up both databases, retain your Secrets and review the target release's notes. Change the pinned `LENS_VERSION` or `GATEWAY_VERSION`, review changes with `helm template` using the retained values file, then rerun that release's `helm upgrade --install` command and the readiness/connection checks. Do not regenerate credentials or delete persistent volumes as part of an upgrade.
