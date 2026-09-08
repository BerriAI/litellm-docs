---
title: Production Deployment
description: Production deployment guide for LiteLLM on AWS, GCP, Azure, or any Kubernetes cluster, with Helm charts and official Terraform modules.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';
import { CloudArchitectureSelector } from '@site/src/components/CloudArchitecture';

# Production Deployment

Production deployment guide for AWS, Google Cloud, Azure, or any Kubernetes cluster. For a first deployment on a single machine, start with the [Quickstart](./docker_quick_start.md); this page picks up where it ends.

There are two supported paths. If you run Kubernetes, [deploy with Helm](#deploy-with-helm) on EKS, GKE, or AKS; the install is the same on every cloud, only the data stores and ingress differ. If you do not run Kubernetes, AWS and GCP have [official Terraform modules](#deploy-with-terraform-aws-and-gcp) that stand up the entire stack; Azure has no Terraform module, so AKS with Helm is the supported path there.

## Architecture

<CloudArchitectureSelector />

LiteLLM provides two deployment modes:

- **Monolithic**: one `litellm` image serves LLM traffic, management APIs, and the UI. This is what the `litellm-helm` chart runs, and the simplest to operate.
- **Microservices**: a `gateway` (LLM traffic, port 4000), `backend` (management APIs and UI backend, port 4001), and `ui` (port 3000), each deployed and scaled independently. This is what the componentized `litellm` chart and both Terraform modules run; see the [chart values](https://github.com/BerriAI/litellm/blob/main/helm/litellm/values.yaml) for the full reference.

The supporting infrastructure is identical in either mode:

| Component | Purpose | Notes |
|---|---|---|
| LiteLLM services | One proxy deployment (monolithic) or gateway + backend + ui (microservices) | Stateless; run 2+ replicas behind a load balancer |
| PostgreSQL | Keys, teams, users, spend logs, config | Required for the proxy's auth and tracking features |
| Redis | Rate limiting, router state, caching across instances | Required once you run more than one instance |
| Migrations job | Applies schema migrations against Postgres | Runs once per upgrade; proxy instances set `DISABLE_SCHEMA_UPDATE=true` |

## Core configuration

```bash
DATABASE_URL="postgresql://user:password@host:5432/litellm"
LITELLM_MASTER_KEY="sk-..."   # admin key for the proxy
LITELLM_SALT_KEY="sk-..."     # encrypts provider credentials stored in the DB. Set once, never change it
DISABLE_SCHEMA_UPDATE="true"  # proxy instances never run migrations; the migrations job does
STORE_MODEL_IN_DB="True"      # manage models from the Admin UI instead of config files
```

`LITELLM_SALT_KEY` cannot be rotated after you add models: it encrypts the provider credentials stored in your database, and changing it makes them unreadable. Generate a strong random value and store both keys in your cloud's secret manager.

Official images are published to `ghcr.io/berriai` and mirrored at `docker.litellm.ai/berriai`. Use `ghcr.io/berriai/litellm` for monolithic deployments, including those with Postgres, since it bundles the Prisma toolchain, and pin a version tag rather than `latest` or a moving tag, so rollbacks are deterministic. All images are signed; see the [Docker Image Security Guide](./docker_image_security.md) for verification and the non-root variant.

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

## Deploy with Helm

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

The chart lives at [`helm/litellm-helm`](https://github.com/BerriAI/litellm/tree/main/helm/litellm-helm); the published chart versions carry LiteLLM release numbers (for example `1.90.2`), and `helm show values oci://ghcr.io/berriai/litellm-helm` lists every knob. Beyond the values above it supports [autoscaling](#autoscaling) (`autoscaling.*` or `keda.*`), PodDisruptionBudgets (`pdb.*`), a Prometheus ServiceMonitor (`serviceMonitor.*`), read replica routing (`db.readReplicaUrl`, see [Database Read Replica](./db_read_replica.md)), graceful drain on shutdown (`lifecycle`), and ArgoCD or Helm hooks for the migrations job (`migrationJob.hooks.*`, see [Helm PreSync hooks](./prod.md#run-migrations-from-the-helm-presync-hook)).

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

```bash
helm upgrade --install litellm \
  oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.89.2 \
  -f values.yaml
```

This deploys `gateway`, `backend`, and `ui` as separate services with per-component autoscaling, so you can run many gateway replicas against a small fixed backend. It requires external Postgres and Redis (no bundled subcharts) and supports reader/writer database splits, IAM database auth, and Redis Cluster mode. Pin the chart to `1.89.0` or newer: the component images (`ghcr.io/berriai/litellm-gateway`, `-backend`, `-ui`, `-migrations`) are published to GHCR from `v1.89.0` onward, and each component's image tag defaults to the chart version, so older chart versions resolve to image tags that were never pushed. Every knob (per-component scaling and probes, read replica routing, Redis Cluster, migrations job, ingress) is documented in the [chart's values.yaml](https://github.com/BerriAI/litellm/blob/main/helm/litellm/values.yaml); see [Autoscaling](#autoscaling) for the scaling blocks.

</TabItem>
</Tabs>

Both charts run the migrations job automatically and keep `DISABLE_SCHEMA_UPDATE=true` on the proxy pods. Expose the service through your cloud's ingress: the [AWS Load Balancer Controller](https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html) on EKS, [GKE Ingress](https://cloud.google.com/kubernetes-engine/docs/concepts/ingress) on GKE, or [Application Gateway Ingress (AGIC)](https://learn.microsoft.com/en-us/azure/application-gateway/ingress-controller-overview) on AKS, with health checks on `/health/readiness`, then point your DNS record at the resulting load balancer. For secrets, prefer your cloud's secret manager over plain Kubernetes secrets ([Key Vault CSI driver](https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver) on AKS, for example); the charts consume whatever secret you mount.

### Autoscaling

Both charts can scale themselves, and both ship autoscaling off or conservative by default. For the thresholds to aim at, and why memory is not one of them, see [autoscaling in the production checklist](./prod.md#autoscaling).

`litellm-helm` offers two mutually exclusive mechanisms. `autoscaling.*` renders a standard HorizontalPodAutoscaler, and `keda.*` renders a KEDA `ScaledObject` for scaling on queue depth, Prometheus queries, or anything else KEDA can read. Enabling both renders only the HPA, so pick one.

```yaml
autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80
  # targetMemoryUtilizationPercentage and behavior are also accepted

keda:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  pollingInterval: 30   # seconds between trigger evaluations
  cooldownPeriod: 300   # seconds of quiet before scaling back to minReplicas
  triggers: []          # required; a ScaledObject with no triggers will not scale
```

`keda.triggers` is empty by default and has no useful default, so supply the trigger yourself; the chart's `values.yaml` carries a commented Prometheus example. `keda.fallback`, `keda.behavior`, and `keda.restoreToOriginalReplicaCount` are passed through for controlling what happens when the metric source is unavailable and how replicas settle after a scale event.

The componentized chart scales each component on its own, under `gateway.hpa`, `backend.hpa`, and `ui.hpa`. The gateway and backend autoscale out of the box and the UI does not, with maximums sized to the shape of each component's traffic: the gateway defaults to `maxReplicas: 10` at 70 percent CPU and 80 percent memory, the backend to `maxReplicas: 4` at 70 percent CPU, and the UI to `maxReplicas: 3` at 80 percent CPU with `enabled: false`. Raising the gateway's ceiling is usually all you need, since it is the only component that sees LLM traffic.

Whichever mechanism you use, set the maximum against what your database can serve. The connection pool is per worker, so the ceiling on replicas is also a ceiling on Postgres connections; `litellm-helm` defaults `maxReplicas` to 100, which at the default pool limit of 10 asks for roughly 1000 connections at full scale-out. See [bounding database connections](./prod.md#bound-database-connections).

### Kubernetes without Helm

If you manage raw manifests, the equivalent deployment is a ConfigMap for `config.yaml`, a Secret for keys, a Deployment with health probes, and a Service.

<details>
<summary>Full manifest (ConfigMap, Secret, Deployment, Service)</summary>

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: litellm-config-file
data:
  config.yaml: |
      model_list:
        - model_name: {{openai_large}}
          litellm_params:
            model: openai/{{openai_large}}
            api_key: os.environ/OPENAI_API_KEY
---
apiVersion: v1
kind: Secret
type: Opaque
metadata:
  name: litellm-secrets
data:
  OPENAI_API_KEY: bWVvd19pbV9hX2NhdA== # your api key in base64
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: litellm-deployment
  labels:
    app: litellm
spec:
  replicas: 2
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
        image: docker.litellm.ai/berriai/litellm:v1.90.2 # pin a version, do not use :latest
        args:
          - "--config"
          - "/app/proxy_server_config.yaml"
        ports:
        - containerPort: 4000
        volumeMounts:
        - name: config-volume
          mountPath: /app/proxy_server_config.yaml
          subPath: config.yaml
        envFrom:
        - secretRef:
            name: litellm-secrets
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
            name: litellm-config-file
---
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

</details>

To connect the database, add `DATABASE_URL` and `LITELLM_MASTER_KEY` to the Secret; nothing else in the manifest changes, because the image already carries the Prisma toolchain.

## Deploy with Terraform (AWS and GCP)

The official modules deploy the full microservices stack (network, database, Redis, object storage, secrets, compute, load balancer, and a migrations job that runs before the services start) and are published to the Terraform Registry:

- [`BerriAI/litellm/aws`](https://registry.terraform.io/modules/BerriAI/litellm/aws/latest)
- [`BerriAI/litellm/google`](https://registry.terraform.io/modules/BerriAI/litellm/google/latest)

<Tabs>
<TabItem value="aws" label="AWS (ECS Fargate)">

By default, provisions a VPC with public and private subnets, an Aurora PostgreSQL cluster (writer plus reader, IAM database auth), ElastiCache Redis (multi-AZ, encrypted), an S3 bucket, Secrets Manager entries, an Application Load Balancer, and ECS Fargate services. The networking and both data stores are optional, so you can reuse what your account already runs; see below.

```hcl title="main.tf"
module "litellm" {
  source  = "BerriAI/litellm/aws"
  version = "~> 1.90"

  region = "us-east-1"
  azs    = ["us-east-1a", "us-east-1b"]
  tenant = "acme"
  env    = "prod"

  ui_password         = var.ui_password
  litellm_license     = var.litellm_license      # optional, omit for open source
  acm_certificate_arn = var.acm_certificate_arn  # TLS is required by default

  proxy_config = {
    model_list = [{
      model_name = "{{openai_large}}"
      litellm_params = {
        model   = "openai/{{openai_large}}"
        api_key = "os.environ/OPENAI_API_KEY"
      }
    }]
  }
  gateway_extra_secrets = {
    OPENAI_API_KEY = var.openai_key_secret_arn
  }
}
```

Before you apply: provision the TLS certificate in [AWS Certificate Manager](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html) (the module refuses a plaintext ALB unless you explicitly set `allow_plaintext_alb = true`), and create any provider-key secrets in [Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html) first, since `gateway_extra_secrets` takes their ARNs. After apply, point your DNS record at the ALB hostname.

The module auto-generates the master key into Secrets Manager if you do not supply one. The application connects to Aurora with short-lived IAM tokens, so its `DATABASE_URL` carries no password (the database master password itself is generated into Secrets Manager and never touches the application). Every resource is named `<tenant>-litellm-<env>`, and the module declares no provider, so you can `for_each` it to run one stack per tenant.

**Bringing your own VPC, database, or Redis.** The networking and both data stores are each optional, so you can deploy into infrastructure your account already has. This is the path to take when your guardrails only allow workloads inside a pre-approved VPC, or when a separate team owns the Postgres and Redis you are expected to use. Set only the pieces you want to reuse; anything you leave at its default is still created for you.

```hcl title="main.tf"
module "litellm" {
  source  = "BerriAI/litellm/aws"
  version = "~> 1.90"

  region = "us-east-1"
  tenant = "acme"
  env    = "prod"

  # Existing networking. Drop `azs` when you set these: no VPC, subnets,
  # route tables, internet gateway, or NAT gateway are created.
  vpc_id             = "vpc-0123456789abcdef0"
  public_subnet_ids  = ["subnet-aaa", "subnet-bbb"]  # ALB, 2+ AZs
  private_subnet_ids = ["subnet-ccc", "subnet-ddd"]  # tasks and data stores, 2+ AZs

  # Existing data stores. Each URL is stored in Secrets Manager and reaches
  # the containers as DATABASE_URL / REDIS_URL.
  create_database = false
  database_url    = var.database_url
  create_redis    = false
  redis_url       = var.redis_url

  # Attach a group your database already allows, alongside the module's own.
  additional_task_security_group_ids = ["sg-0123456789abcdef0"]
}
```

Your existing stores have to accept traffic from the tasks. The module always creates its own tasks security group and reports it as the `task_security_group_id` output, so either allow that group inbound on the database and Redis, or pass a group they already allow through `additional_task_security_group_ids`. Private subnets you supply also need their own egress, through a NAT gateway or VPC endpoints, since the module creates no routing of its own in this mode. It reaches Secrets Manager, pulls container images, and calls LLM providers from those subnets.

Supply private subnets in at least two availability zones whenever the module still creates Aurora or ElastiCache, since both of their subnet groups require it. One private subnet is accepted only when you have turned both stores off.

Leaving a `create_*` at `false` with an empty URL runs the stack without that component entirely. With no database there is no key management, spend tracking, or UI persistence, so authentication falls back to the master key alone. Without Redis, rate limits, budgets, and router cooldowns are counted per gateway process rather than across the cluster, and the module runs two gateway tasks by default and autoscales to ten, so a caller spread across them receives each process's full allowance. The plan warns when you configure that combination. Hold the gateway to a single process with `gateway_autoscaling_enabled = false`, `gateway_desired_count = 1`, and `gateway_num_workers = 1` if you need per-key limits to mean anything without Redis.

Missing or inconsistent inputs fail during `terraform plan` rather than halfway through an apply, so setting `vpc_id` without the subnet ids, or dropping `azs` without setting `vpc_id`, tells you so before anything is created.

</TabItem>
<TabItem value="gcp" label="Google Cloud (Cloud Run)">

Provisions a VPC with Private Services Access, Cloud SQL PostgreSQL (primary plus read replica), Memorystore Redis with TLS, a GCS bucket, Secret Manager entries, Cloud Run services, and a global HTTPS load balancer with serverless NEGs.

```hcl title="main.tf"
module "litellm" {
  source  = "BerriAI/litellm/google"
  version = "~> 1.90"

  project_id = "my-project"
  region     = "us-central1"
  tenant     = "acme"
  env        = "prod"

  ui_password     = var.ui_password
  litellm_license = var.litellm_license  # optional

  # Cloud Run cannot pull from ghcr.io. Point this at an Artifact Registry
  # remote repository backed by ghcr.io, or mirror the images.
  image_registry = "us-central1-docker.pkg.dev/my-project/ghcr-remote/berriai"

  lb_domains = ["llm.example.com"]

  proxy_config = {
    model_list = [{
      model_name = "{{gemini_pro}}"
      litellm_params = { model = "vertex_ai/{{gemini_pro}}" }
    }]
  }
}
```

Three GCP-specific caveats. First, always override `image_registry`: it defaults to `ghcr.io/berriai`, which Cloud Run cannot pull from, so the apply succeeds but the services fail at image pull. Point it at an [Artifact Registry remote repository](https://cloud.google.com/artifact-registry/docs/repositories/remote-overview) that proxies `ghcr.io`. Second, the database uses password authentication through Secret Manager rather than IAM auth; LiteLLM's IAM token support is AWS RDS specific. Third, create the DNS record for `lb_domains` pointing at the load balancer IP after apply; the [Google-managed certificate](https://cloud.google.com/load-balancing/docs/ssl-certificates/google-managed-certs) will not finish provisioning until the domain resolves to it.

</TabItem>
</Tabs>

To manage LiteLLM resources (keys, teams, models) as code once the stack is up, use [terraform-provider-litellm](https://github.com/BerriAI/terraform-provider-litellm).

## Other platforms

<Tabs>
<TabItem value="render" label="Render">

Deploy on [Render](https://render.com/):

<iframe width="840" height="500" src="https://www.loom.com/embed/805964b3c8384b41be180a61442389a3" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

</TabItem>
<TabItem value="railway" label="Railway">

Deploy on [Railway](https://railway.app): click the button, then set `PORT=4000` in the Railway environment variables.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/S7P9sn?referralCode=t3ukrU)

</TabItem>
</Tabs>

## Verify the deployment

Confirm the proxy is up and can reach its database:

```bash
curl -s https://llm.example.com/health/readiness
```

Then open the Admin UI at `https://llm.example.com/ui`, log in with your master key, add a model, create a virtual key, and send a Playground message; a response proves the full path through the load balancer, proxy, database, and provider credentials. The [Quickstart](./docker_quick_start.md#2-log-in-to-the-admin-ui) walks through each of those clicks with screenshots; the flow is identical on a production deployment.

## Next steps

Harden the deployment with the [production checklist](./prod.md) (worker counts, machine sizing, Redis settings, server tuning, graceful degradation). Verify image signatures with the [Docker Image Security Guide](./docker_image_security.md). Add regions with [Multi-Region Deployment](./multi_region.md). For very high throughput (1000+ RPS), enable the [Redis transaction buffer](./prod.md#redis-transaction-buffer).
