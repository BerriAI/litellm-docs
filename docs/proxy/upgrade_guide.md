---
title: Upgrade Guide
description: Upgrade LiteLLM without downtime. Prepare a rolling deployment, protect active streams, verify the new version, and keep a rollback path.
toc_max_heading_level: 2
---

# Upgrade LiteLLM with zero downtime

## Overview

Keep the current version serving until replacements are ready. Route new requests to healthy instances and let active requests finish before retiring old instances.

**Prepare → Migrate if needed → Roll out and drain → Verify**

Use rolling deployments for routine upgrades, [blue/green](./deploy/ha/blue_green.md) to test a full replacement before cutover, or a [canary](./deploy/ha/canary.md) to shift traffic gradually.

## Before you start {#before-you-upgrade}

| Check | Required for this workflow |
| --- | --- |
| Availability | At least two healthy instances behind a load balancer, an autoscaler minimum of two, and spare compute/database connections for replacements. |
| Release | Pin the image and chart/module versions. Review [release notes](/release_notes) for every version you cross. Save the current image and configuration. |
| Shared state | Keep the same database, Redis, authentication settings, and `LITELLM_SALT_KEY`. See [production configuration](./prod.md). |
| Rehearsal | Back up the database. Test both versions against a migrated production-sized copy, and test a long stream during instance replacement. |

## 1. Configure a rolling deployment

Merge this into your [Helm values](./deploy/helm.md), preserving existing `extraEnv` entries. This HPA example assumes a **600-second request limit**; adjust timeouts for your longest request, including streams.

```yaml title="values.yaml"
gateway:
  hpa:
    minReplicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  terminationGracePeriodSeconds: 650
  extraEnv:
    - name: GRACEFUL_SHUTDOWN_TIMEOUT
      value: "610"
  lifecycle:
    preStop:
      exec:
        command: ["sh", "-c", "sleep 10"]
```

**These settings apply to new pods.** Check the existing pods' shutdown settings before replacement. If they cannot drain your longest requests, start replacement capacity, remove old pods from new traffic, and let active requests finish before terminating them.

Keep the chart's [`/health/readiness` probe](./health.md#probe-endpoints) enabled. With KEDA, set `gateway.keda.minReplicaCount: 2`; without autoscaling, set `gateway.replicaCount: 2`. Apply equivalent settings to separate backend/UI components.

The `preStop` delay allows traffic routing to update; the server then drains requests on shutdown. Keep termination grace above **preStop + server drain + cleanup time**. Align ingress timeouts and test stream completion; see [shutdown settings](./server_tuning.md#keep-restarts-hitless).

`maxUnavailable: 0` preserves the desired number of available replicas during the update, but the surge pod still needs schedulable CPU, memory, and database connections. A PodDisruptionBudget governs voluntary evictions and does not control the Deployment's own rolling update. See Kubernetes' [rolling update settings](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment) and [pod termination flow](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination-flow).

## 2. Prepare the database {#database-migrations}

Skip this step without a database. Helm runs schema changes through a separate migration job automatically. For upgrades from older versions or custom deployments, review the [migration safeguards](./database_migrations.md#upgrading-from-a-version-before-v11040) before rollout.

Run one migration job with the **target image** before application rollout. Require successful schema migration and request-log indexing. Helm and the official Terraform modules provide this job; custom deployments use [`litellm --skip_server_startup`](./database_migrations.md#run-the-migration-job). See [dry runs](./database_migrations.md#dry-run-the-migrations-before-the-upgrade) and [job timeouts](./database_migrations.md#migration-duration-and-timeouts).

## 3. Roll out the new version {#upgrade-with-helm-or-terraform}

| Deployment | Action |
| --- | --- |
| [Helm](./deploy/helm.md) | Pin `image.tag` or `image.digest`. Keep `migrationJob.enabled: true` and the Helm pre-upgrade hook enabled. Run the command below. |
| [Argo CD](./deploy/helm.md) | Pin the chart/image. Enable the Argo CD migration hook and disable the Helm hook. Sync the full Application so PreSync completes first. |
| [Terraform](./deploy/terraform.md) | Pin the module revision and `image`. Run `terraform init -upgrade`, review `terraform plan`, then apply. Confirm replacement capacity and draining for your cloud runtime. |
| Custom containers or VMs | Start new instances behind the load balancer, wait for readiness, then stop sending new requests to old instances. Keep them running until active requests finish. |

For Helm, set the chart version and measured timeout below. Use your existing release name and namespace:

```bash
helm upgrade litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --version "$CHART_VERSION" \
  --namespace litellm --values values.yaml \
  --wait --timeout "$UPGRADE_TIMEOUT"
```

In another terminal, inspect the migration job and replacement pods. Discover the gateway Deployment name, then watch its rollout, replacing `<gateway-deployment>` with that name:

```bash
kubectl -n litellm get jobs,pods
kubectl -n litellm get deployments -l app.kubernetes.io/instance=litellm
kubectl -n litellm rollout status deployment/<gateway-deployment> --timeout=10m
kubectl -n litellm get events --sort-by=.lastTimestamp
```

The observation timeout above does not cancel or undo the rollout. Inspect a failing job's logs or an unready pod's events before retrying. Do not assume that a failed Helm command restored the previous application or database state.

If migrations fail, replacements stay unready, or errors rise, stop the rollout. Keep healthy instances serving while you investigate.

## 4. Verify the upgrade

Confirm every new instance passes `/health/readiness`. Through the normal ingress, send an authenticated model request and a streaming request using an existing virtual key. Check that streams finish, model permissions work, spend is recorded, and required callbacks arrive.

Compare errors, latency, and interrupted streams with your baseline for the observation period you selected. Verify the target image on every serving component, including separate backend/UI deployments. Finish when all instances run the target version, old instances have drained, and metrics stay within the agreed limits. Readiness and a successful Helm command do not test provider calls; see [health checks](./health.md).

## Roll back if needed

Restore the previous image and configuration, or switch traffic back to blue, **only if that version was tested against the current database schema**. Skip migration hooks/jobs for this application rollback and drain the failed version.

An image rollback does not undo migrations. If the old version cannot use the new schema, stop and follow the tested database recovery plan; restoring a snapshot requires downtime and can lose writes made since the snapshot. See [database recovery](./database_migrations.md#recovery-when-migration-history-is-ahead-of-the-schema).
