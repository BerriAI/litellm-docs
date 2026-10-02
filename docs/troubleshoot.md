# Outage Troubleshooting

Use this page when LiteLLM nodes go down: pods restart or get OOMKilled, the load balancer marks targets unhealthy, or requests time out across the deployment. Most outages we investigate come down to sizing (CPU or memory per worker), workers recycling at the same time, or a dependency (database, Redis, an upstream provider) stalling the event loop. All of those are only visible from the deployment side, so support needs the information below to give you a root cause rather than a list of follow-up questions.

Gather everything in this list before opening a ticket. Redact API keys, database passwords, and other secrets from every file you share.

## What to send

| Information | Why we need it | How to collect it |
|-------------|----------------|-------------------|
| Kubernetes events | Show restarts, `OOMKilled`, failed liveness or readiness probes, evictions, and scheduling failures, with timestamps | `kubectl get events` and `kubectl describe pod`, see [Kubernetes events](#kubernetes-events) |
| `values.yaml` | Replica count, resource requests and limits, probe settings, autoscaling, worker count, and environment variables the pods actually run with | `helm get values <release>`, see [values.yaml](#valuesyaml) |
| `config.yaml` | Model list, router settings, cache and database settings, callbacks, and general settings the proxy loaded | Read it from inside a running pod, see [config.yaml](#configyaml) |
| Node type | The machine class the pods run on, so we can compare it against what the pods request | `kubectl describe node`, see [Node type](#node-type) |
| CPU | CPU requests and limits per pod and CPU usage over the incident window, compared with the [sizing recommendation](./proxy/prod.md#machine-specifications) | `kubectl top pod` and your metrics dashboard, see [CPU and memory](#cpu-and-memory) |
| Memory | Memory requests and limits per pod and memory usage over the incident window; an `OOMKilled` pod is a memory problem regardless of what the logs say | `kubectl top pod` and your metrics dashboard, see [CPU and memory](#cpu-and-memory) |
| RPS | Requests per second the deployment was serving when it went down, and the normal baseline, so we can check the CPU and memory numbers against the load | Prometheus or load balancer metrics, see [RPS](#rps) |

Along with those, include the LiteLLM version (the image tag, or `litellm_version` from `GET /health/readiness/details`), the timeline of the incident in UTC, what "down" looked like from your side (5xx from the load balancer, probe failures, restarts, timeouts), whether every replica failed at once or one at a time, whether the database and Redis were healthy at the same time, and anything that changed in the days before (a version upgrade, new models, a traffic increase, a change to `values.yaml` or `config.yaml`).

## Kubernetes events

Events record what Kubernetes did to the pods and why, and they expire after about an hour, so collect them as soon as possible after the incident.

```shell
kubectl get events -n <namespace> --sort-by=.lastTimestamp
kubectl describe pod -n <namespace> <pod-name>
```

Send the full output of both commands. In the `describe` output the `Last State`, `Reason`, `Exit Code`, and `Restart Count` fields tell us whether the container was `OOMKilled` (exit code 137), exited on its own (`Error`), or was killed because a probe failed. The `Events` section at the bottom shows probe failures and image, scheduling, or volume problems. If the pod was replaced, run the same commands against the new pod and include the previous container's logs:

```shell
kubectl logs -n <namespace> <pod-name> --previous
```

If events have already expired, or the container runtime no longer has the previous container's logs, send the pod restart and termination history and the pod logs from your cluster's logging or monitoring system instead.

## values.yaml

Send the values the release is actually running with, not the file in your repository, since the two drift.

```shell
helm get values <release-name> -n <namespace>
```

Add `--all` to include the chart defaults if you have not overridden `resources`, `replicaCount`, or the probe settings; we need to know what those resolve to. If you deploy with plain manifests or Kustomize instead of Helm, send the rendered `Deployment` (`kubectl get deployment -n <namespace> <name> -o yaml`) and the `HorizontalPodAutoscaler` if you have one.

## config.yaml

The Helm chart renders `proxy_config` from `values.yaml` into a ConfigMap and mounts it at `/etc/litellm/config.yaml`. Read it from a running pod so we see the configuration the proxy loaded, including any environment variable substitutions:

```shell
kubectl exec -n <namespace> <pod-name> -- cat /etc/litellm/config.yaml
```

If the pods are crash looping and `exec` fails with `container not found`, read the ConfigMap instead:

```shell
kubectl get configmap -n <namespace> <release-name>-config -o yaml
```

Redact `api_key`, `database_url`, `master_key`, and any other secret before sending. Also include the environment variables the container runs with that affect capacity: `NUM_WORKERS`, `MAX_REQUESTS_BEFORE_RESTART`, `MAX_REQUESTS_BEFORE_RESTART_JITTER`, `DATABASE_CONNECTION_POOL_LIMIT`, `DATABASE_CONNECTION_TIMEOUT`, `REDIS_HOST`, and `LITELLM_MODE`.

## Node type

The node type is the instance class or machine spec of the Kubernetes nodes the LiteLLM pods are scheduled on. Cloud providers label each node with it, and `describe node` also shows how much of the node is already committed to other pods:

```shell
kubectl get pod -n <namespace> <pod-name> -o wide
kubectl get node <node-name> -o jsonpath='{.metadata.labels.node\.kubernetes\.io/instance-type}{"\n"}'
kubectl describe node <node-name>
```

Send the instance type (for example `m6i.2xlarge` or `n2-standard-8`) and the `Capacity`, `Allocatable`, and `Allocated resources` sections from `describe node`. If you run on bare metal or a VM, send the vCPU count and memory of the machine instead. A node that is oversubscribed will throttle LiteLLM even when the pod's own limits look correct.

## CPU and memory

We need two things for each: what the pod is allowed (requests and limits), and what it used through the incident.

```shell
kubectl get pod -n <namespace> <pod-name> -o jsonpath='{range .spec.containers[*]}{.name}{"\t"}{.resources}{"\n"}{end}'
kubectl top pod -n <namespace>
```

`kubectl top` needs metrics-server installed in the cluster and shows current usage only, so also export a graph or table of CPU and memory per pod from Prometheus, CloudWatch, Datadog, or whatever you use, covering from an hour before the incident until after recovery. In Prometheus, `container_cpu_usage_seconds_total` and `container_memory_working_set_bytes` filtered by pod are the right series. Note the worker count per pod alongside the numbers: the [production guide](./proxy/prod.md#machine-specifications) recommends 1 vCPU and 4Gi of memory per worker, and a pod running four workers on 1 vCPU and 4Gi is undersized even though each worker looks configured correctly.

## RPS

Requests per second tells us whether the deployment fell over under normal load or under a spike. If you have [Prometheus metrics](./proxy/prometheus.md) enabled, query the proxy request counter over the incident window:

```promql
sum(rate(litellm_proxy_total_requests_metric_total[1m]))
sum by (pod) (rate(litellm_proxy_total_requests_metric_total[1m]))
```

If you do not scrape LiteLLM metrics, use the request count from the load balancer or ingress in front of it (for example the ALB `RequestCount` metric in CloudWatch). Send the peak RPS during the incident, the RPS in the hour before it, and the typical baseline, along with the number of replicas serving that traffic, so we can work out RPS per pod and per worker.

## Deployments without Kubernetes

For Docker Compose or a single container on a VM, the same information comes from Docker and the host:

```shell
docker inspect <container-name> --format '{{.State.Status}} {{.State.OOMKilled}} {{.State.ExitCode}} {{.RestartCount}} {{.HostConfig.NanoCpus}} {{.HostConfig.Memory}}'
docker logs --since 1h <container-name>
docker stats --no-stream <container-name>
nproc && free -h
```

Send your `docker-compose.yaml` (or the `docker run` command) in place of `values.yaml`, the `config.yaml` you mount into the container, the VM's instance type or vCPU and memory, and the RPS from whatever load balancer sits in front of the container.

## What we look at first

Knowing what support checks first helps you check it yourself while you wait. Undersized pods are the most common cause: compare the CPU and memory limits and the worker count against the [machine specifications](./proxy/prod.md#machine-specifications). If several pods restarted at about the same time with no OOMKill, check whether `MAX_REQUESTS_BEFORE_RESTART` is set without [jitter](./proxy/server_tuning.md#recycle-workers), which makes workers that booted together recycle together. If readiness probes failed while the process stayed up, check the database: `GET /health/readiness` returns 503 when the configured database is unreachable, see [health endpoints](./proxy/health.md#probe-endpoints). If requests timed out while CPU stayed low, look for Redis or database timeouts in the logs and check the [production settings](./proxy/prod.md) for connection limits and request timeouts.

## Support

Share the collected information with the LiteLLM team on [Slack](https://www.litellm.ai/support), on [Discord](https://discord.gg/wuPM9dRgDw), or by email at [ishaan@berri.ai](mailto:ishaan@berri.ai) and [krrish@berri.ai](mailto:krrish@berri.ai). If you already have a support channel with us, post there.
