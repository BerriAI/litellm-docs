---
title: Migrate from Kubernetes Manifests to the Microservices Chart
description: Move a LiteLLM proxy deployed with raw Kubernetes manifests onto the componentized litellm Helm chart so gateway, backend, and UI scale independently.
---

# Migrate from Kubernetes Manifests to the Microservices Chart

This guide moves a LiteLLM proxy that runs from hand-written Kubernetes manifests (the [Kubernetes without Helm](./deploy.md#kubernetes-without-helm) layout: one `Deployment`, one `Service`, a `ConfigMap`, and a `Secret`) onto the componentized `litellm` Helm chart, where LLM traffic (`gateway`), management APIs (`backend`), and the Admin UI (`ui`) run as separate Deployments with their own autoscaling. The existing Postgres database and Redis are kept; no data moves. The old Deployment stays up until the new release serves traffic, so the switch is reversible at every step.

You need `helm` 3.8 or newer, `kubectl` access to the target namespace, the current manifests, and network reachability from the cluster to Postgres and Redis. For what each value does, see the chart's [`values.yaml`](https://github.com/BerriAI/litellm/blob/main/helm/litellm/values.yaml); for the architecture behind the two modes, see [Production Deployment](./deploy.md#architecture).

## 1. Capture the current deployment

Record the image tag, replica count, config, and every environment variable the proxy reads today, so nothing is lost in translation.

```bash
kubectl get deploy litellm-deployment -o yaml > old-deployment.yaml
kubectl get cm litellm-config-file -o yaml > old-config.yaml
kubectl get svc litellm-service -o yaml > old-service.yaml
kubectl get ingress -o yaml > old-ingress.yaml
kubectl get secret litellm-secrets -o jsonpath='{.data}' | jq 'keys'
```

Adjust the names to match your manifests. From `old-deployment.yaml` note `spec.replicas`, `spec.template.spec.containers[0].image`, `env`, `envFrom`, `resources`, and any probe overrides. From `old-config.yaml` keep the `config.yaml` body; it is reused verbatim in step 4.

## 2. Split `DATABASE_URL` into a username and password Secret

The chart never reads `DATABASE_URL`. It sets `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, and `DATABASE_PASSWORD` from discrete values and a Secret, and the proxy builds the URL itself. Take the pieces out of your existing URL (`postgresql://USER:PASSWORD@HOST:PORT/DBNAME`) and create the Secret:

```bash
kubectl create secret generic litellm-db \
  --from-literal=username='USER' \
  --from-literal=password='PASSWORD'
```

Passwords with `@`, `/`, or `%` need no escaping here; the proxy percent-encodes them.

Keep the existing `litellm-secrets` Secret. The chart references the master key from it directly, and provider keys in it are mounted whole in step 4. If `LITELLM_SALT_KEY` is set in the old Deployment, keep it in the same Secret; changing it makes stored provider credentials unreadable.

## 3. Choose the chart version

Pin the chart to the version that matches, or is newer than, your current proxy image; component image tags default to the chart version, so a proxy on `v1.90.2` moves to chart `1.90.2`. Chart `1.89.0` is the oldest supported.

```bash
helm show chart oci://ghcr.io/berriai/litellm/chart/litellm --version 1.90.2
```

## 4. Write `values.yaml`

Translate the manifests with this mapping.

| Manifest | Chart value |
| --- | --- |
| `ConfigMap` `config.yaml` body | `gateway.config.proxy_config` (shared by gateway and backend) |
| `LITELLM_MASTER_KEY` key in the Secret | `masterKey.secretName`, `masterKey.secretKey` |
| `DATABASE_URL` | `database.writer.host`, `.port`, `.dbname`, `.passwordSecret` (step 2) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | `redis.host`, `redis.port`, `redis.passwordSecret` |
| Provider keys in `envFrom.secretRef` | `gateway.envSecrets` and `backend.envSecrets` |
| Other `env` entries | `gateway.extraEnv`, `backend.extraEnv` |
| `spec.replicas` | `gateway.hpa.minReplicas` (or `gateway.replicaCount` with `gateway.hpa.enabled: false`) |
| `resources` | `gateway.resources` |
| `args: ["--config", ...]` | drop; the chart sets `CONFIG_FILE_PATH` |
| `Ingress` host | `ingress.host` |

A manifest deployment with two replicas, provider keys in `litellm-secrets`, and Redis at `redis.internal` becomes:

```yaml title="values.yaml"
masterKey:
  secretName: litellm-secrets
  secretKey: LITELLM_MASTER_KEY

database:
  writer:
    host: postgres.internal
    port: 5432
    dbname: litellm
    passwordSecret:
      name: litellm-db
      usernameKey: username
      passwordKey: password

redis:
  host: redis.internal
  port: 6379
  passwordSecret:
    name: litellm-secrets
    passwordKey: REDIS_PASSWORD

gateway:
  envSecrets:
    - litellm-secrets
  resources:
    requests: { cpu: "1", memory: 4Gi }
    limits: { cpu: "2", memory: 4Gi }
  hpa:
    minReplicas: 2
    maxReplicas: 10
  config:
    proxy_config:
      model_list:
        - model_name: gpt-4o
          litellm_params:
            model: openai/gpt-4o
            api_key: os.environ/OPENAI_API_KEY
      router_settings:
        redis_host: os.environ/REDIS_HOST
        redis_port: os.environ/REDIS_PORT
        redis_password: os.environ/REDIS_PASSWORD
      litellm_settings:
        cache: true
        cache_params:
          type: redis
          host: os.environ/REDIS_HOST
          port: os.environ/REDIS_PORT
          password: os.environ/REDIS_PASSWORD

backend:
  envSecrets:
    - litellm-secrets

ingress:
  enabled: false
```

Drop the `redis.passwordSecret` block if your Redis has no password. If the old deployment had no Redis, add one before scaling past one pod; see [What Needs Redis](./redis_requirements.md). Leave `ingress.enabled: false` for now; traffic moves in step 7.

Render and check the result before installing:

```bash
helm template litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.90.2 -f values.yaml | kubectl apply --dry-run=server -f -
```

## 5. Install alongside the old deployment

The chart's resource names (`litellm-gateway`, `litellm-backend`, `litellm-ui`, `litellm-gateway-config`) do not collide with the manifest names, so both can run in the same namespace.

```bash
helm upgrade --install litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.90.2 -f values.yaml --wait --timeout 10m
```

Helm runs the migrations Job as a pre-install hook before creating the Deployments. It applies the same Prisma migrations the old image applied at startup, so on an up-to-date database it is a no-op. The old pods keep running against the same schema throughout.

```bash
kubectl get pods -l app.kubernetes.io/instance=litellm
kubectl logs job/litellm-migrations
```

If the Job fails, fix the database values and rerun the same `helm upgrade` command; nothing else has been created yet.

## 6. Verify the new release

Test each component through its own Service before exposing it.

```bash
kubectl port-forward svc/litellm-gateway 4000:4000 &
kubectl port-forward svc/litellm-backend 4001:4001 &
kubectl port-forward svc/litellm-ui 3000:3000 &

curl -s localhost:4000/health/readiness
curl -s localhost:4000/v1/models -H "Authorization: Bearer $LITELLM_MASTER_KEY"
curl -s localhost:4000/v1/chat/completions -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"ping"}]}'
curl -s localhost:4001/key/info -H "Authorization: Bearer $LITELLM_MASTER_KEY"
curl -sI localhost:3000/ui/
```

The readiness response should report `"cache": "redis"` and `/v1/models` should return the same models the old deployment served. An existing virtual key must work against the new gateway, which confirms the database and master key are the ones the old deployment used.

## 7. Move traffic

Point the ingress at the chart. Enable the chart's ingress on the same host as the old one and delete the old Ingress in the same step, or, if you manage ingress outside the chart, repoint your rules by path: `/v1/*`, `/chat/*`, `/health`, `/metrics` and other LLM routes to `litellm-gateway:4000`, `/ui`, `/_next`, `/litellm-asset-prefix`, and `/` to `litellm-ui:3000`, and everything else (`/key/*`, `/team/*`, `/user/*`, ...) to `litellm-backend:4001`. The full path split is in [`templates/ingress.yaml`](https://github.com/BerriAI/litellm/blob/main/helm/litellm/templates/ingress.yaml).

```yaml title="values.yaml"
ingress:
  enabled: true
  className: alb            # or nginx
  controller: alb           # or nginx
  host: llm.example.com
  annotations: {}           # copy TLS and load balancer annotations from old-ingress.yaml
```

```bash
kubectl delete -f old-ingress.yaml
helm upgrade litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --version 1.90.2 -f values.yaml --wait
```

Clients that used the in-cluster Service name (`litellm-service:4000`) must switch to `litellm-gateway:4000` for LLM calls and `litellm-backend:4001` for management calls.

Watch the gateway HPA and error rate for a few minutes:

```bash
kubectl get hpa litellm-gateway -w
kubectl logs deploy/litellm-gateway -f | grep -i error
```

## 8. Scale the gateway

The gateway HPA is on by default with CPU and memory targets, and scales the gateway alone; the backend has its own HPA and the UI is fixed at one replica unless `ui.hpa.enabled` is set. Raise `gateway.hpa.maxReplicas` or the floor as load needs, then `helm upgrade`. For LLM traffic, where pods saturate on open connections before CPU, add a requests or tokens per second target as described in [Scale on requests and tokens per pod](./deploy.md#scale-on-requests-and-tokens-per-pod).

If the old deployment was crash-looping, check why before relying on more replicas: `kubectl describe pod` on an old pod shows `OOMKilled` (raise `gateway.resources.limits.memory`), liveness failures during startup (set `gateway.startupProbe`), or a database or Redis connection error in `kubectl logs --previous`. Replicas multiply a bad configuration rather than fixing it.

## 9. Remove the old deployment

Once the new release has taken production traffic without incident, delete the manifest objects. Keep the Secret; the chart references it.

```bash
kubectl delete -f old-deployment.yaml -f old-service.yaml
kubectl delete -f old-config.yaml
```

## Roll back

While the old Deployment still exists, revert the ingress change from step 7 (`kubectl apply -f old-ingress.yaml` and `helm upgrade ... --set ingress.enabled=false`) and traffic returns to the old pods. The database is unchanged by the migration, provided the chart version was not newer than the old image; if you moved to a newer chart, schema changes it applied are forward-only, and the rollback target must be an image of at least that version. To remove the chart entirely, `helm uninstall litellm`, which leaves the external database, Redis, and your Secrets in place.
