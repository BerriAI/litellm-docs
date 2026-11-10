---
title: Kubernetes without Helm
description: Deploy LiteLLM with Kubernetes manifests for configuration, secrets, health probes, and a service.
---

# Kubernetes without Helm

{/* keep-version-note */}

Use this manifest if you manage Kubernetes YAML directly. It creates a ConfigMap for `config.yaml`, a Secret for keys, a Deployment with health probes, and a Service. For an installation that manages database migrations and provides built-in scaling options, see [Deploy with Helm](./helm.md).

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

For production, review the [data store setup](./helm.md#provision-the-data-stores) and [production checklist](../prod.md), then [verify the deployment](../deploy.md#verify-the-deployment). Return to the [deployment overview](../deploy.md) to compare deployment methods.
