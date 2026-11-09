---
title: "Upgrade Lens"
description: "Update Lens independently while retaining its records, credentials and recovery point."
slug: "/proxy/lens/deployment/upgrades"
---

# Upgrade Lens

Select an available [Lens artifact](./releases.md) and read its migration requirements. Lens and gateway versions can differ when their contracts are compatible. An embedded UI change requires the corresponding gateway UI update

Before changing a persistent installation, [back up and rehearse recovery](https://github.com/BerriAI/lens/blob/main/docs/backup.md). Retain the exact installed image, source or installation bundle, environment file, ClickHouse data and Keeper state. Pause scheduled work and finish or cancel active investigations before the maintenance window

## Move from gateway-hosted Lens

If Lens metadata still lives in PostgreSQL, follow the [metadata migration guide](https://github.com/BerriAI/lens/blob/main/docs/migration.md). Stop old writers, inspect the import plan, apply it and verify saved identities and records before starting the new Lens runtime. If metadata already lives in ClickHouse, preserve that database and its Keeper state instead of running the importer over it

A deployment ownership change also requires one controller per resource. Use the [Helm ownership-transfer procedure](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#select-versions-independently) when separating a bundled Lens deployment from a gateway release. Keep existing resource names, selectors, secrets and volumes

## Update an independent installation

For Compose, update `LENS_IMAGE` in the retained `deploy/lens/.env` to the verified artifact, then apply it from the matching Lens checkout or installation bundle:

```sh
docker compose -f deploy/lens/compose.yaml up -d --wait
```

For Helm, retain your release name, namespace and values and update the Lens image or chart through the [Lens Helm guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md). Generated credentials are reused by Helm with cluster access; GitOps uses [pre-provisioned secrets](./storage.md#gitops)

Complete the [first-trace check](../deployment.md#check-the-installation), open a previously stored trace and dataset, and run a bounded investigation before resuming schedules. When connected to LiteLLM, also verify ordinary inference and existing user scopes in the embedded page

## Roll back with the matching data

Keep the prior artifact and recovery point until verification finishes. Confirm that a rollback target can read the current state before switching images. Returning to a PostgreSQL-writing implementation requires the matching snapshot and reconciliation of any new writes; the [migration guide](https://github.com/BerriAI/lens/blob/main/docs/migration.md#interrupted-import-and-rollback) explains that boundary

Retain the environment file and ClickHouse volume. `docker compose down --volumes` deletes stored Lens data
