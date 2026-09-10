---
title: GCP Memorystore IAM Authentication
description: Authenticate the LiteLLM proxy to GCP Memorystore for Redis with a service account instead of a password.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GCP Memorystore IAM Authentication

Connect LiteLLM's Redis cache to GCP Memorystore using IAM authentication, so the proxy authenticates
as a service account and no Redis password exists in your config.

:::info

GCP IAM authentication for redis is only supported on Redis Clusters for now. For AWS ElastiCache and
Valkey, see [AWS ElastiCache IAM Authentication](./elasticache_iam.md).

:::

```shell
uv add google-cloud-iam
```

<Tabs>

<TabItem value="gcp-iam-config" label="Set on config.yaml">

For Redis Cluster with GCP IAM:

```yaml
litellm_settings:
  cache: True
  cache_params:
    type: redis
    redis_startup_nodes:
      [{ "host": "10.128.0.2", "port": 6379 }, { "host": "10.128.0.2", "port": 11008 }]
    gcp_service_account: "projects/-/serviceAccounts/your-sa@project.iam.gserviceaccount.com"
    ssl: true
    ssl_cert_reqs: null
    ssl_check_hostname: false
```

</TabItem>

<TabItem value="gcp-iam-env" label="Set on .env">

You can configure GCP IAM Redis authentication in your .env:

For Redis Cluster:

```env
REDIS_CLUSTER_NODES='[{"host": "10.128.0.2", "port": 6379}, {"host": "10.128.0.2", "port": 11008}]'
REDIS_GCP_SERVICE_ACCOUNT="projects/-/serviceAccounts/your-sa@project.iam.gserviceaccount.com"
REDIS_GCP_SSL_CA_CERTS="./server-ca.pem"
REDIS_SSL="True"
REDIS_SSL_CERT_REQS="None"
REDIS_SSL_CHECK_HOSTNAME="False"
```

**GCP Authentication Setup**

Make sure your GCP credentials are configured:

```shell
# Option 1: Service account key file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# Option 2: If running on GCP compute instance with service account attached
# No additional setup needed
```

</TabItem>

</Tabs>

Once the proxy is running, confirm the connection with
[`/cache/ping`](./caching.md#debugging-caching---cacheping). For everything else about the Redis
cache, including cluster topology and TLS, see [Redis and Valkey](./caching_redis.md).
