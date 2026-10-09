---
title: "Storage and secrets"
description: "Configure supported ClickHouse storage, Lens credentials and GitOps."
slug: "/proxy/lens/deployment/storage"
---

# Storage and secrets

The standalone Lens starter and Helm chart include ClickHouse with Keeper and generate private credentials. Use this page when supplying external storage or secrets. The [Lens Helm guide](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#use-existing-clickhouse) owns the complete storage requirements

## ClickHouse connection {#clickhouse-connection}

Use the ClickHouse HTTP(S) endpoint, with special characters in credentials URL-encoded:

```text
https://lens_user:URL_ENCODED_PASSWORD@clickhouse.example.com:8443
```

The usual private HTTP port is 8123; port 9000 uses the native protocol and is not the Lens HTTP connection. Keep the URL in your secret manager. Standalone Lens defaults to database `lens`; existing gateway installations can retain `litellm`. Preserve the database containing your records

Lens initializes its schema and application state before accepting requests. Its credential must allow database, table and materialized-view creation, reads, inserts and alters for publication and cleanup. A read-only analytical account cannot run Lens

## External ClickHouse {#external-clickhouse}

Supported external storage is one stable endpoint reaching one ClickHouse server, shared by the Lens replicas. That server must support KeeperMap with Keeper and `keeper_map_path_prefix` configured. Use the [bundled Keeper configuration](https://github.com/BerriAI/lens/blob/main/deploy/clickhouse/keeper.xml) as the single-server reference

Lens payload tables are local to that server. Shared Keeper does not replicate them between ClickHouse nodes. Multi-server load balancing, distributed tables and automatic failover to a different ClickHouse server are unsupported. Confirm your provider's actual engine, coordination and permission support before choosing a managed database

For independent Helm, create a Kubernetes Secret containing the authenticated URL, then reference it at the top level:

```yaml
clickhouseSecret:
  name: lens-clickhouse
  key: url
clickhouseDatabase: lens
retentionDays: 14
```

The reference suppresses bundled ClickHouse resources. Supply your actual secret and database names. When the gateway chart owns Lens, the corresponding values live under `lensWorker`. Keep ClickHouse payloads and Keeper metadata together in backups and restores

## Service and administrator credentials {#service-token}

The independent chart can generate its administrator credential for Helm installations with cluster access. To supply it yourself, provision a Secret and set:

```yaml
adminTokenSecret:
  name: lens-admin
  key: admin-token
```

Connecting a gateway also requires the [service and signing credentials](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#connect-a-gateway). Reuse the same values on both services, with at least 32 characters each. These credentials are separate from the administrator token, agent tracing keys and model provider keys

Preserve existing secrets across upgrades. An old enrolled-worker token belongs to the previous gateway control plane and does not authorize the new standalone runtime

## GitOps {#gitops}

A Helm renderer without cluster access cannot use `lookup` to retain generated secrets across renders. For this flow, provision the Lens admin credential and external ClickHouse connection through your secret manager before application sync. When connecting a gateway, provision its service and signing credentials too

Reference the existing secrets in `adminTokenSecret`, `clickhouseSecret` and the optional gateway settings instead of committing plaintext values. Select and pin the image or chart artifact independently from the gateway. Keep one release or application owner for each resource

For an existing installation, follow the [writer migration](https://github.com/BerriAI/lens/blob/main/docs/migration.md) and [resource ownership transfer](https://github.com/BerriAI/lens/blob/main/helm/lens/README.md#select-versions-independently) before changing controllers. Verify a stored trace, dataset and investigation after the handoff
