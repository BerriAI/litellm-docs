---
title: Azure Redis Entra ID Authentication
description: Authenticate the LiteLLM proxy to Azure Cache for Redis or Azure Managed Redis with Microsoft Entra ID instead of an access key.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Azure Redis Entra ID Authentication

Connect LiteLLM's Redis cache to Azure Cache for Redis or Azure Managed Redis using Microsoft
Entra ID (formerly Azure AD), so the proxy authenticates as a managed identity or service principal
and no access key exists in your config

## Why use it

With Entra ID authentication the client presents a short-lived Entra access token in place of a
password, and Azure validates it against the cache's access policy assignments on every connection.
Access is revoked by removing a policy assignment instead of rotating a key and redeploying every
replica, and every connection is attributable to an identity in your tenant

LiteLLM builds the Entra credential once and keeps it alive for the life of the proxy, so the Azure
SDK's internal token cache and silent refresh apply. Each new Redis connection authenticates with a
fresh token, which avoids the failure mode where pooled connections start failing once the initial
token expires after about an hour

## Requirements

You need `azure-identity` installed, which ships with `litellm[proxy]` and the Docker image. Entra
ID authentication must be enabled on the cache, and the identity the proxy runs as needs a data
access policy on it; Data Contributor is enough for the response cache. Azure serves these caches
over TLS only, so set `ssl: true` and use port 6380 for Azure Cache for Redis or port 10000 for
Azure Managed Redis

## Configuration

Set `azure_redis_ad_token: "true"` and drop the password

<Tabs>

<TabItem value="config" label="Set on config.yaml">

```yaml
litellm_settings:
  cache: true
  cache_params:
    type: redis
    host: my-cache.redis.cache.windows.net
    port: 6380
    ssl: true
    azure_redis_ad_token: "true"
```

</TabItem>

<TabItem value="env" label="Set on .env">

```env
REDIS_HOST="my-cache.redis.cache.windows.net"
REDIS_PORT="6380"
REDIS_SSL="True"
REDIS_AZURE_AD_TOKEN="True"
REDIS_USERNAME="<object id of the proxy's identity>"
```

</TabItem>

</Tabs>

Azure Redis instances usually expect the identity's object (principal) ID as the Redis username
during `AUTH`. Set the `REDIS_USERNAME` environment variable to that object ID; when it is unset
LiteLLM sends the token alone, which ACL-configured instances may reject

## How credentials resolve

If `azure_client_id`, `azure_tenant_id`, and `azure_client_secret` are all set, in `cache_params`
or through the standard `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_SECRET` environment
variables, LiteLLM authenticates as that service principal. If only `azure_client_id` is set, it
authenticates as that user-assigned managed identity. Otherwise it falls back to
`DefaultAzureCredential`, which covers a system-assigned managed identity, the Azure CLI, and the
other standard azure-identity mechanisms

## Settings

| Setting | Required | Description |
| --- | --- | --- |
| `azure_redis_ad_token` | yes | The string `"true"` turns on Entra ID authentication. Env equivalent: `REDIS_AZURE_AD_TOKEN` |
| `azure_client_id` | no | Client ID of a user-assigned managed identity or service principal. Falls back to `AZURE_CLIENT_ID` |
| `azure_tenant_id` | no | Tenant ID, needed together with a client secret. Falls back to `AZURE_TENANT_ID` |
| `azure_client_secret` | no | Service principal secret. Falls back to `AZURE_CLIENT_SECRET` |

`REDIS_USERNAME` is environment-only and should hold the object ID of the identity when your cache
requires a username on `AUTH`

## Verify

Ping the cache through the proxy. A healthy response means a token was issued, Azure accepted it,
and a write round-tripped

```shell
curl -s -X GET 'http://localhost:4000/cache/ping' \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

```json
{
  "status": "healthy",
  "cache_type": "redis",
  "ping_response": true,
  "set_cache_response": "success"
}
```

## Notes

Sync Redis clients authenticate inside a custom connect function; async clients wrap the same live
credential in a redis-py credential provider that is consulted on every new connection. Both paths
share one credential object, so token renewal happens inside the Azure SDK with no restart

If you configure GCP IAM (`gcp_service_account`) alongside Entra ID, the GCP path wins and LiteLLM
logs a warning. If you configure AWS ElastiCache IAM (`aws_iam_auth`) alongside Entra ID, the Entra
path wins, also with a warning. Configure exactly one. Supplying your own `credential_provider`
overrides all of this

## Troubleshooting

`azure-identity is required for Azure AD Redis authentication` means the package is missing from a
custom install; it is already part of `litellm[proxy]`

`Azure AD authentication failed for Redis` or `WRONGPASS invalid username-password pair` means the
token was issued but the cache rejected it. The usual causes are Entra ID authentication not being
enabled on the cache, the identity missing a data access policy assignment, or `REDIS_USERNAME` not
matching the identity's object ID

An error from azure-identity itself, such as `DefaultAzureCredential failed to retrieve a token`,
means no credential source was found. Check that the proxy actually runs with the managed identity
you assigned, or that the `AZURE_*` variables are set

## See also

Everything else about the Redis cache, including cluster topology, namespaces and TLS, lives on
[Redis and Valkey](./caching_redis.md). For AWS, see
[AWS ElastiCache IAM Authentication](./elasticache_iam.md); for GCP, see
[GCP Memorystore IAM Authentication](./gcp_memorystore_iam.md)
