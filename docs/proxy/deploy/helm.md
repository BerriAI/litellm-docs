---
title: Deploy with Helm
description: Deploy LiteLLM on Kubernetes with Helm, using managed PostgreSQL and Redis on AWS, Google Cloud, or Azure.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Deploy with Helm

{/* keep-version-note */}

Use Helm to deploy LiteLLM on an existing Kubernetes cluster. The same charts work on Amazon EKS, Google Kubernetes Engine, Azure Kubernetes Service, and other Kubernetes clusters. You supply PostgreSQL and Redis, then choose a single proxy deployment or separate gateway, backend, and UI services.

If you need help choosing a deployment method, start with the [deployment overview](../deploy.md). For Kubernetes YAML without a chart, use [Kubernetes without Helm](./kubernetes.md).

## Core configuration

```bash
DATABASE_URL="postgresql://user:password@host:5432/litellm"
LITELLM_MASTER_KEY="sk-..."   # admin key for the proxy
LITELLM_SALT_KEY="sk-..."     # encrypts provider credentials stored in the DB. Set once, never change it
DISABLE_SCHEMA_UPDATE="true"  # proxy instances never run migrations; the migrations job does
STORE_MODEL_IN_DB="True"      # manage models from the Admin UI instead of config files
```

`LITELLM_SALT_KEY` cannot be rotated after you add models: it encrypts the provider credentials stored in your database, and changing it makes them unreadable. Generate a strong random value and store both keys in your cloud's secret manager.

Official images are published to `ghcr.io/berriai` and mirrored at `docker.litellm.ai/berriai`. Use `ghcr.io/berriai/litellm` for monolithic deployments, including those with Postgres, since it bundles the Prisma toolchain, and pin a version tag rather than `latest` or a moving tag, so rollbacks are deterministic. All images are signed; see the [Docker Image Security Guide](../docker_image_security.md) for verification and the non-root variant.

## Provision the data stores

The Helm path needs a PostgreSQL database and a Redis reachable from your cluster. Use the managed services:

<Tabs>
<TabItem value="aws" label="AWS">

Provision [RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html) and [ElastiCache Redis](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html) in the same VPC as your EKS cluster, with security groups permitting the cluster's nodes on ports 5432 and 6379.

</TabItem>
<TabItem value="gcp" label="Google Cloud">

Provision [Cloud SQL PostgreSQL](https://cloud.google.com/sql/docs/postgres) and [Memorystore Redis](https://cloud.google.com/memorystore/docs/redis) with private IPs on the VPC your GKE cluster uses (Cloud SQL needs [Private Services Access](https://cloud.google.com/vpc/docs/private-services-access)). Use the instances' private IPs as the endpoints below.

</TabItem>
<TabItem value="azure" label="Azure">

```bash
az group create --name litellm-prod --location eastus

az aks create --resource-group litellm-prod --name litellm-aks \
  --node-count 3 --enable-managed-identity

az postgres flexible-server create --resource-group litellm-prod \
  --name litellm-db --database-name litellm \
  --tier GeneralPurpose --sku-name Standard_D2ds_v5

az redis create --resource-group litellm-prod --name litellm-redis \
  --location eastus --sku Standard --vm-size c1
```

Docs: [AKS](https://learn.microsoft.com/en-us/azure/aks/what-is-aks), [Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/overview), [Azure Cache for Redis](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview). Azure Cache for Redis serves TLS on port 6380, and TLS is enabled through the URL scheme: instead of `redis_host` and `redis_port`, set `redis_url: "rediss://:<access-key>@litellm-redis.redis.cache.windows.net:6380"` under `router_settings` (the `rediss://` scheme turns TLS on).

</TabItem>
</Tabs>

## Install the chart

First create the secrets both charts consume:

```bash
kubectl create secret generic litellm-masterkey \
  --from-literal=masterkey="sk-$(openssl rand -hex 24)"

kubectl create secret generic litellm-db \
  --from-literal=username=litellm \
  --from-literal=password="<database-password>"

kubectl create secret generic litellm-env \
  --from-literal=LITELLM_SALT_KEY="sk-$(openssl rand -hex 24)" \
  --from-literal=REDIS_PASSWORD="<redis-password>" \
  --from-literal=OPENAI_API_KEY="<provider-key>"
```

Then pick a deployment mode:

<Tabs>
<TabItem value="monolith" label="Monolithic (litellm-helm)">

```yaml title="values.yaml"
replicaCount: 3

image:
  repository: ghcr.io/berriai/litellm
  tag: "v1.90.2"          # pin your version

masterkeySecretName: litellm-masterkey
masterkeySecretKey: masterkey

db:
  useExisting: true
  deployStandalone: false
  endpoint: "<postgres-endpoint>"
  database: litellm
  secret:
    name: litellm-db
    usernameKey: username
    passwordKey: password

environmentSecrets:
  - litellm-env

proxy_config:
  model_list:
    - model_name: {{openai_large}}
      litellm_params:
        model: openai/{{openai_large}}
        api_key: os.environ/OPENAI_API_KEY
  router_settings:
    redis_host: "<redis-endpoint>"
    redis_port: 6379
    redis_password: os.environ/REDIS_PASSWORD
```

```bash
helm install litellm oci://ghcr.io/berriai/litellm-helm -f values.yaml
```

If the database takes short-lived tokens instead of a password (RDS or Aurora with IAM database authentication, Azure Database for PostgreSQL with Microsoft Entra ID), there is no password to put in `litellm-db`. Set `db.useIAMAuth: true` (or `db.useAzureEntraAuth: true`) with `db.username` and drop the `secret` block. The chart then sets `IAM_TOKEN_DB_AUTH` (or `AZURE_POSTGRESQL_AUTH`) and emits `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME` and `DATABASE_NAME` instead of `DATABASE_PASSWORD` and `DATABASE_URL`, and the proxy, the migrations job and the collector sidecar each mint their own token at startup. The pod needs cloud credentials for that token, IRSA or Pod Identity on EKS and workload identity on AKS.

```yaml title="values.yaml (RDS IAM)"
db:
  useExisting: true
  deployStandalone: false
  useIAMAuth: true
  endpoint: "<postgres-endpoint>"
  database: litellm
  username: litellm_iam   # the role granted rds_iam
```

The chart lives at [`helm/litellm-helm`](https://github.com/BerriAI/litellm/tree/main/helm/litellm-helm); the published chart versions carry LiteLLM release numbers (for example `1.90.2`), and `helm show values oci://ghcr.io/berriai/litellm-helm` lists every knob. Beyond the values above it supports [autoscaling](./autoscaling.md) (`autoscaling.*` or `keda.*`), PodDisruptionBudgets (`pdb.*`), a Prometheus ServiceMonitor (`serviceMonitor.*`), read replica routing (`db.readReplicaUrl`, see [Database Read Replica](../db_read_replica.md)), graceful drain on shutdown (`lifecycle`), ArgoCD or Helm hooks for the migrations job (`migrationJob.hooks.*`, see [Helm PreSync hooks](../prod.md#run-migrations-from-the-helm-presync-hook)), and an optional [dedicated Prometheus metrics listener](../prometheus.md#isolate-prometheus-scraping-from-inference-traffic) configured through `metricsServer.*`.

</TabItem>
<TabItem value="micro" label="Microservices (litellm)">

```yaml title="values.yaml"
masterKey:
  secretName: litellm-masterkey
  secretKey: masterkey

database:
  writer:
    host: "<postgres-endpoint>"
    port: 5432
    dbname: litellm
    passwordSecret:
      name: litellm-db
      usernameKey: username
      passwordKey: password
  # optional: add database.reader to route reads to a replica

redis:
  host: "<redis-endpoint>"
  port: 6379
  passwordSecret:
    name: litellm-env
    passwordKey: REDIS_PASSWORD

# one host fronting gateway, backend, and ui
ingress:
  enabled: true
  className: "<alb | gce | azure-application-gateway | nginx>"
  # alb (default) or nginx. ingress-nginx's admission webhook rejects the chart's
  # dotted paths (/favicon.ico, /eu.assemblyai) unless this is nginx
  controller: alb
  host: llm.example.com
  # optional: routes the chart does not ship a rule for, e.g. a passthrough
  # prefix added after this chart version or a custom
  # general_settings.pass_through_endpoints path. Additive: every built-in
  # UI, gateway, and backend path is still rendered
  extraPaths:
    - path: /watsonx
      pathType: Prefix     # default; Exact and ImplementationSpecific also work
      service: gateway     # default; backend and ui also work
```

For one DNS hostname per component without path-based routing, see [Separate hostname per component](../manifests_to_microservices.md#separate-hostname-per-component).

```bash
helm upgrade --install litellm \
  oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.89.2 \
  -f values.yaml
```

This deploys `gateway`, `backend`, and `ui` as separate services. You can scale the gateway for inference traffic without scaling the management API or Admin UI. The chart requires external Postgres and Redis and supports database read replicas, IAM database authentication, Redis Cluster, per-component probes, and per-component autoscaling.

Pin the chart to `1.89.0` or newer. Each component image tag defaults to the chart version. See the [chart values](https://github.com/BerriAI/litellm/blob/main/helm/litellm/values.yaml) for every option, [Autoscaling](./autoscaling.md) for scaling configuration, and [Prometheus metrics isolation](../prometheus.md#isolate-prometheus-scraping-from-inference-traffic) for the gateway metrics sidecar.

The [high-throughput deployment profile](../high_throughput.md) adds shared database connections, isolated spend processing, and RPS/TPS autoscaling.

</TabItem>
</Tabs>

Both charts run the migrations job automatically and keep `DISABLE_SCHEMA_UPDATE=true` on the proxy pods. Expose the service through your cloud's ingress: the [AWS Load Balancer Controller](https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html) on EKS, [GKE Ingress](https://cloud.google.com/kubernetes-engine/docs/concepts/ingress) on GKE, or [Application Gateway Ingress (AGIC)](https://learn.microsoft.com/en-us/azure/application-gateway/ingress-controller-overview) on AKS, with health checks on `/health/readiness`, then point your DNS record at the resulting load balancer. For secrets, prefer your cloud's secret manager over plain Kubernetes secrets ([Key Vault CSI driver](https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver) on AKS, for example); the charts consume whatever secret you mount.

## Next steps

Choose resources with [Sizing & Scaling](./sizing.md), configure [autoscaling](./autoscaling.md), and [verify the deployment](../deploy.md#verify-the-deployment). Use the [production checklist](../prod.md) to prepare for production. See the [Quickstart](../docker_quick_start.md#2-log-in-to-the-admin-ui) to add a model and send a test request through the Admin UI.
