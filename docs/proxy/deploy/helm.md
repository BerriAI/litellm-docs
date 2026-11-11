---
title: Deploy with Helm
description: Configure one LiteLLM Helm chart and shared image with values.yaml, then deploy through Argo CD or the Helm CLI.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Deploy with Helm

{/* keep-version-note */}

Deploy LiteLLM with one chart and one shared image. Run a single service or scale the gateway, management backend, and UI separately.

## Prerequisites

Use Kubernetes 1.25 or newer and Helm 3.8 or newer. Provision PostgreSQL, Redis for coordination across replicas, and private connectivity from the cluster. The chart does not deploy these data stores.

| Cloud | PostgreSQL | Redis |
| --- | --- | --- |
| AWS | [RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html) | [ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html) |
| GCP | [Cloud SQL PostgreSQL](https://cloud.google.com/sql/docs/postgres) | [Memorystore](https://cloud.google.com/memorystore/docs/redis) |
| Azure | [Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/overview) | [Azure Managed Redis](https://learn.microsoft.com/en-us/azure/redis/overview) |

Have your secret manager provision the following Kubernetes Secrets in the `litellm` namespace **before the first sync**, including the migration Job. Keep the master key and salt across upgrades; changing the salt makes stored provider credentials unreadable.

| Secret | Required fields |
| --- | --- |
| `litellm-masterkey` | `masterkey` |
| `litellm-db` | `username`, `password` |
| `litellm-redis` | `password` |
| `litellm-env` | `LITELLM_SALT_KEY` and provider credentials such as `OPENAI_API_KEY` |

## values.yaml

Keep these values in your platform's GitOps repository. Replace the image registry, datastore endpoints, and Redis port/TLS settings with your environment's values.

:::note Image compatibility

The chart requires an image with the component entrypoint. [Build and publish a matching image](../docker_quick_start.md#build-from-source); the chart's default `appVersion` does not guarantee compatibility.

:::

```yaml title="environments/production/litellm/values.yaml"
image:
  repository: registry.example.com/platform/litellm
  tag: source-f52f26d

# false: separate gateway, backend, and UI services (default)
# true: one service; gateway.* configures it, backend.* and ui.* are ignored
monolith:
  enabled: false

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

redis:
  host: "<redis-endpoint>"
  port: 6379
  ssl: true
  sslCertReqs: required
  passwordSecret:
    name: litellm-redis
    passwordKey: password

gateway:
  envSecrets: [litellm-env]
  extraEnv:
    - name: STORE_MODEL_IN_DB
      value: "True"
  config:
    proxy_config:
      model_list:
        - model_name: {{openai_large}}
          litellm_params:
            model: openai/{{openai_large}}
            api_key: os.environ/OPENAI_API_KEY

backend:
  envSecrets: [litellm-env]
  extraEnv:
    - name: STORE_MODEL_IN_DB
      value: "True"
```

The image is configured once for every component, migration Job, and built-in sidecar. Set `image.digest` to pin its bytes. Add `imagePullSecrets` if your registry requires authentication.

Both gateway and backend load `gateway.config.proxy_config` and need the same provider credentials and salt. To manage models entirely through the [UI or Management API](../configuration/overview.md), leave `gateway.config.proxy_config: {}` and retain `STORE_MODEL_IN_DB`.

## Install the chart

<Tabs queryString="install">
<TabItem value="argocd" label="Argo CD" default>

Use an Argo CD version that supports [multiple sources](https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/). This Application combines the pinned upstream chart with your platform repository's `values.yaml`. Replace the platform repository URL, revision, destination, and project as needed.

```yaml title="application.yaml"
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: litellm
  namespace: argocd
spec:
  project: default
  sources:
    - repoURL: https://github.com/BerriAI/litellm.git
      targetRevision: f52f26d9c636038c6e3609cc7d17cf625d434c3e
      path: helm/litellm
      helm:
        releaseName: litellm
        valueFiles:
          - $values/environments/production/litellm/values.yaml
        parameters:
          - name: migrationJob.hooks.helm.enabled
            value: "false"
          - name: migrationJob.hooks.argocd.enabled
            value: "true"
    - repoURL: https://git.example.com/platform/configuration.git
      targetRevision: main
      ref: values
  destination:
    server: https://kubernetes.default.svc
    namespace: litellm
```

Commit the Application to your existing Argo CD bootstrap flow and sync it. The migration Job runs as a **PreSync hook** before application resources. Its database credentials, network access, and any cloud service account must already exist. Use a full application sync; [hooks do not run during selective sync](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/).

</TabItem>
<TabItem value="cli" label="Helm CLI">

Check out the same source and apply your values. The default Helm hooks run migrations before installation and upgrades.

```bash
git clone --filter=blob:none https://github.com/BerriAI/litellm.git litellm-source
git -C litellm-source checkout f52f26d9c636038c6e3609cc7d17cf625d434c3e

helm upgrade --install litellm ./litellm-source/helm/litellm \
  --namespace litellm -f environments/production/litellm/values.yaml \
  --wait --timeout 30m
```

For single-service mode, set `monolith.enabled: true` in `values.yaml`. You can verify it locally with `kubectl -n litellm port-forward svc/litellm-litellm 4000:4000`, then open `http://localhost:4000/ui`.

</TabItem>
</Tabs>

## Ingress

The chart routes inference, management, and UI paths to the matching service. In single-service mode, every path targets the monolith Service. This example uses the AWS Load Balancer Controller and an existing ACM certificate:

```yaml
ingress:
  enabled: true
  className: alb
  controller: alb
  host: llm.example.com
  annotations:
    alb.ingress.kubernetes.io/scheme: internal
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: "arn:aws:acm:REGION:ACCOUNT:certificate/CERTIFICATE_ID"
gateway:
  service:
    annotations:
      alb.ingress.kubernetes.io/healthcheck-path: /health/readiness
backend:
  service:
    annotations:
      alb.ingress.kubernetes.io/healthcheck-path: /health/readiness
ui:
  service:
    annotations:
      alb.ingress.kubernetes.io/healthcheck-path: /
```

Replace the host and certificate ARN. Merge these values into your existing configuration. `ingress.controller` selects the chart's path format (`alb` or `nginx`); it does not install a controller. For another controller, supply its ingress class, TLS configuration, and health checks. Separate services listen on ports 4000 (gateway), 4001 (backend), and 3000 (UI); the monolith uses 4000. The static UI needs ingress routing to reach the APIs.

Keep health and metrics endpoints private. Use `/health/readiness` for gateway, backend, and monolith health checks and `/` for the static UI. See [cloud reference architectures](./cloud/overview.md) for network placement.

## Database and Redis

PostgreSQL TLS uses `database.writer.sslMode` and `database.writer.sslRootCert`. Mount a private CA bundle into every connecting workload, including the migration Job. For token authentication, choose `database.writer.useIAMAuth` or `database.writer.useAzureEntraAuth`; keep the username in the referenced Secret. Set `migrationJob.serviceAccountName` to a **pre-existing** cloud-enabled service account when the Job needs one.

For Redis Cluster, set `redis.cluster: true`. For a private Redis CA, mount its bundle and set `redis.sslCaCerts`. Redis coordinates replicas; response caching remains a separate LiteLLM setting.

Use [Sizing & Scaling](./sizing.md) and [Autoscaling](./autoscaling.md) to set resources and replica limits. The [values reference](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/values.yaml) covers read replicas, connection pooling, disruption budgets, metrics, and collector sidecars. After a sync, check [workload readiness](../health.md) and [send a request with a virtual key](../docker_quick_start.md#6-call-the-gateway-from-your-app).

## Existing installations

Existing `litellm-helm` installations need their values converted. The current chart uses `gateway.config.proxy_config`, `database.writer`, and `gateway.hpa`; earlier per-component image settings become top-level `image`. Review the [chart compatibility notes](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/README.md#migrating-from-the-litellm-helm-chart) and preserve existing secrets before an upgrade.
