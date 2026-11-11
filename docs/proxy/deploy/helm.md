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

Use Kubernetes 1.25 or newer and Helm 3.8 or newer. Create PostgreSQL and Redis instances. Allow the cluster to reach them over a private network. Redis coordinates replicas. The chart does not deploy these data stores.

| Cloud | PostgreSQL | Redis |
| --- | --- | --- |
| AWS | [RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html) | [ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html) |
| GCP | [Cloud SQL PostgreSQL](https://cloud.google.com/sql/docs/postgres) | [Memorystore](https://cloud.google.com/memorystore/docs/redis) |
| Azure | [Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/overview) | [Azure Managed Redis](https://learn.microsoft.com/en-us/azure/redis/overview) |

Create these Kubernetes Secrets in the `litellm` namespace through your secret manager. Create them **before the first sync** so the migration Job can use them. Keep the master key and salt across upgrades. Changing the salt makes stored provider credentials unreadable.

| Secret | Required fields |
| --- | --- |
| `litellm-masterkey` | `masterkey` |
| `litellm-db` | `username`, `password` |
| `litellm-redis` | `password` |
| `litellm-env` | `LITELLM_SALT_KEY` and provider credentials such as `OPENAI_API_KEY` |

## values.yaml

Keep these values in your platform's GitOps repository. Replace the image registry, datastore endpoints, and Redis port/TLS settings with your environment's values.

Set `image.repository` and `image.tag` to the [image you built from the same source as the chart](../docker_quick_start.md#build-from-source).

```yaml title="environments/production/litellm/values.yaml"
image:
  repository: registry.example.com/platform/litellm
  tag: source-f52f26d

# false: separate gateway, backend, and UI services (default)
# true: one service configured by gateway.*
# Single-service mode ignores backend.* and ui.*
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

The gateway and backend load `gateway.config.proxy_config`. Give both services the same provider credentials and salt. To manage models entirely through the [UI or Management API](../configuration/overview.md), set `gateway.config.proxy_config: {}` and keep `STORE_MODEL_IN_DB=True`.

## Install the chart

Publish the chart to your OCI registry before deploying. The examples use `ghcr.io/YOUR_ORG/charts/litellm`. Replace `YOUR_ORG` with your registry namespace.

<details>
<summary>Publish the chart to GHCR</summary>

[Sign in to the registry](https://helm.sh/docs/topics/registries/#the-registry-subcommand). Run these commands in your release pipeline from the LiteLLM source directory you used to build the image:

```bash
helm package ./helm/litellm --destination dist
helm push ./dist/litellm-1.0.0.tgz oci://ghcr.io/YOUR_ORG/charts
```

</details>

<Tabs queryString="install">
<TabItem value="argocd" label="Argo CD" default>

Use Argo CD 2.6 or newer for [values in a separate Git repository](https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/#helm-value-files-from-external-git-repository). This Application pulls the chart from GHCR and `values.yaml` from your platform repository. Replace the repository URLs, chart version, destination, and project as needed.

```yaml title="application.yaml"
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: litellm
  namespace: argocd
spec:
  project: default
  sources:
    - repoURL: ghcr.io/YOUR_ORG/charts
      chart: litellm
      targetRevision: "1.0.0"
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

Argo CD's Helm `repoURL` omits the `oci://` prefix. For a private registry, configure a [Helm repository credential with `enableOCI: "true"`](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#helm).

Add the Application to your Argo CD configuration and sync it. The migration Job runs as a **PreSync hook** before application resources. Its database credentials, network access, and any cloud service account must already exist. Use a full application sync. [Hooks do not run during selective sync](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/).

</TabItem>
<TabItem value="cli" label="Helm CLI">

Pull the chart from GHCR and apply your values. The default Helm hooks run migrations before installation and upgrades.

```bash
helm upgrade --install litellm oci://ghcr.io/YOUR_ORG/charts/litellm \
  --version 1.0.0 \
  --namespace litellm -f environments/production/litellm/values.yaml \
  --wait --timeout 30m
```

For single-service mode, set `monolith.enabled: true` in `values.yaml`. Run `kubectl -n litellm port-forward svc/litellm-litellm 4000:4000` to check it locally. Then open `http://localhost:4000/ui`.

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

Replace the host and certificate ARN. Merge these values into your existing configuration. `ingress.controller` selects the chart's path format (`alb` or `nginx`). Install the controller separately. For another controller, supply its ingress class, TLS configuration, and health checks. Separate services listen on ports 4000 (gateway), 4001 (backend), and 3000 (UI). The monolith uses port 4000. The static UI needs ingress routing to reach the APIs.

Keep health and metrics endpoints private. Use `/health/readiness` for gateway, backend, and monolith health checks and `/` for the static UI. See [cloud reference architectures](./cloud/overview.md) for network placement.

## Database and Redis

PostgreSQL TLS uses `database.writer.sslMode` and `database.writer.sslRootCert`. Mount a private CA bundle into every connecting workload, including the migration Job. For token authentication, choose `database.writer.useIAMAuth` or `database.writer.useAzureEntraAuth`. Keep the username in the referenced Secret. If the migration Job needs cloud permissions, create a Kubernetes service account with those permissions before the sync. Set `migrationJob.serviceAccountName` to its name.

For Redis Cluster, set `redis.cluster: true`. For a private Redis CA, mount its bundle and set `redis.sslCaCerts`. Redis coordinates replicas. Configure response caching separately in LiteLLM.

Use [Sizing & Scaling](./sizing.md) and [Autoscaling](./autoscaling.md) to set resources and replica limits. The [values reference](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/values.yaml) covers read replicas, connection pooling, disruption budgets, metrics, and collector sidecars. After a sync, check [workload readiness](../health.md) and [send a request with a virtual key](../docker_quick_start.md#6-call-the-gateway-from-your-app).

## Existing installations

Convert your values before upgrading an existing `litellm-helm` installation. The current chart uses `gateway.config.proxy_config`, `database.writer`, and `gateway.hpa`. Move any per-component image settings to the top-level `image` setting. Review the [chart compatibility notes](https://github.com/BerriAI/litellm/blob/f52f26d9c636038c6e3609cc7d17cf625d434c3e/helm/litellm/README.md#migrating-from-the-litellm-helm-chart) and preserve existing secrets before an upgrade.
