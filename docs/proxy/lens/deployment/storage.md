---
title: "Storage and secrets"
description: "Configure external ClickHouse, an existing Lens service token, or GitOps."
slug: "/proxy/lens/deployment/storage"
---

# Storage and secrets

Skip this page if you use the chart's bundled ClickHouse and automatically generated credentials.

Choose the setting you need:

| Your requirement | Configure |
| --- | --- |
| Use your own ClickHouse | [External ClickHouse](#external-clickhouse) |
| Supply the internal service token yourself | [Service token](#service-token) |
| Render Helm without cluster access | [GitOps](#gitops) |

## ClickHouse connection {#clickhouse-connection}

Use the ClickHouse **HTTP(S) endpoint**. For example:

```text
https://lens_user:URL_ENCODED_PASSWORD@clickhouse.example.com:8443
```

For a private ClickHouse server without TLS, the usual HTTP port is `8123`. Port `9000` is the native protocol port and cannot be used for Lens's HTTP connection. Use the hostname and HTTP port supplied by your ClickHouse provider.

URL-encode special characters in the username and password. Lens uses the `litellm` database by default. Set `lensWorker.clickhouseDatabase` in Helm, or `CLICKHOUSE_DATABASE` on the Lens container, to use another name.

Lens creates the database if it is missing and applies schema migrations at startup. Its user needs permission to create the database, tables, and materialized views; apply schema and retention changes; and read and insert data. A read-only account cannot initialize or run Lens. Lens still issues `CREATE DATABASE IF NOT EXISTS` when the database already exists.

## External ClickHouse {#external-clickhouse}

Setting `clickhouseSecret.name` selects your ClickHouse instance and disables the bundled instance. The chart can still generate the Lens service token for you.

### 1. Create the database secret

Use your secret manager to create a Kubernetes Secret with a `url` key, or run the commands below. Replace `litellm` with your existing namespace:

```bash
export LITELLM_NAMESPACE="litellm"
printf 'ClickHouse HTTP URL: '
IFS= read -r -s LENS_CLICKHOUSE_URL
printf '\n'
printf '%s' "$LENS_CLICKHOUSE_URL" | kubectl create secret generic litellm-lens-clickhouse \
  --namespace "$LITELLM_NAMESPACE" --from-file=url=/dev/stdin
unset LENS_CLICKHOUSE_URL
```

### 2. Reference it in your values

Merge these settings into the `lensWorker` block in your values file:

```yaml
lensWorker:
  enabled: true
  clickhouseSecret:
    name: litellm-lens-clickhouse
    key: url
  clickhouseDatabase: litellm
  retentionDays: 14
```

Set the database name and retention period to your requirements. Deploy with your Helm command, then [check the installation](./kubernetes.md#check-the-installation).

## Service token {#service-token}

The service token authenticates the private connection between LiteLLM and Lens. It is separate from the tracing keys your agents use. Supplying this token yourself still allows the chart to run bundled ClickHouse.

### 1. Create the token secret

Use your secret manager, or generate a token and create the Kubernetes Secret once. Replace `litellm` with your namespace:

```bash
export LITELLM_NAMESPACE="litellm"
openssl rand -hex 32 | tr -d '\n' | kubectl create secret generic litellm-lens-service \
  --namespace "$LITELLM_NAMESPACE" --from-file=service-token=/dev/stdin
```

### 2. Reference it in your values

```yaml
lensWorker:
  enabled: true
  serviceTokenSecret:
    name: litellm-lens-service
    key: service-token
```

The chart supplies the same token to LiteLLM and Lens. Reuse the secret on future deployments. Deploy with your Helm command, then [check the installation](./kubernetes.md#check-the-installation).

## GitOps {#gitops}

Tools that render Helm without cluster access, such as Argo CD's repo-server, cannot use Helm's `lookup` to preserve generated passwords. For this mode, the chart requires an externally provisioned ClickHouse instance and both existing secrets.

The chart does not provide an existing-password-secret setting for bundled ClickHouse. GitOps tools that execute Helm with cluster access can use its generated credentials when `lookup` is available.

1. Provision ClickHouse and create the [database URL secret](#external-clickhouse).
2. Create the [service token secret](#service-token).
3. Have your secret manager create both Kubernetes Secrets before the application sync, then use both references:

```yaml
lensWorker:
  enabled: true
  serviceTokenSecret:
    name: litellm-lens-service
    key: service-token
  clickhouseSecret:
    name: litellm-lens-clickhouse
    key: url
  clickhouseDatabase: litellm
```

Sync the application, then [check the installation](./kubernetes.md#check-the-installation). Keep plaintext secret values out of Git.
