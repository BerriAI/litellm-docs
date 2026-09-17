import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# AWS ElastiCache IAM Authentication

Connect LiteLLM's Redis cache to AWS ElastiCache (Redis OSS or Valkey) using IAM authentication, so
no Redis password ever exists in your config, your environment, or your secret store

## Why use it

ElastiCache and Valkey speak the Redis protocol, so LiteLLM has always been able to talk to them.
What was missing was the auth story. With IAM authentication the client presents a short-lived AWS
SigV4 token in place of a password, and ElastiCache validates it against your IAM policy on every
connection

That buys you four things a static Redis password cannot. Access is granted by IAM rather than by a
shared secret, so you revoke it by detaching a policy instead of rotating a password and redeploying
every replica. Every connection attempt is attributable to an IAM principal. The token itself is
valid for fifteen minutes and is re-signed for each new connection, so a leaked token is close to
worthless. And because the signing credentials come from the standard AWS chain, a proxy running
under IRSA, an EC2 instance profile, or an ECS task role picks up rotated credentials on its own
with no restart

Before this existed, turning IAM auth on meant handing `redis-py` a Python credential provider
object, which a YAML config cannot express. Operators had to patch LiteLLM or write a custom
integration. Now it is four settings

## Requirements

Encryption in transit must be enabled on the cache. LiteLLM refuses to start with IAM auth on a
plaintext connection rather than silently downgrading, so `ssl: true` is mandatory. ElastiCache
Serverless always encrypts in transit; for a self-designed cluster you must create it with
`--transit-encryption-enabled`

You also need `boto3` installed, which ships with `litellm[proxy]`, and an ElastiCache user created
in IAM mode. ElastiCache requires that such a user's name and id are identical

## Walkthrough

This sets up a LiteLLM proxy on EKS, authenticating to an ElastiCache Serverless Valkey cache with
IRSA. Substitute your own account id, region, and names throughout

### 1. Create an ElastiCache user in IAM mode

The user name and user id must match, and the access string controls what the proxy may do inside
Redis. `on ~* +@all` gives it the whole keyspace, which is what the response cache expects

```shell
aws elasticache create-user \
  --user-id litellm-cache \
  --user-name litellm-cache \
  --engine valkey \
  --authentication-mode Type=iam \
  --access-string "on ~* +@all"
```

### 2. Put the user in a user group and attach it to the cache

Every user group needs a member named `default`. If you do not already have one for this engine,
create a disabled placeholder so the real access runs through your IAM user

```shell
aws elasticache create-user-group \
  --user-group-id litellm-cache-users \
  --engine valkey \
  --user-ids default-placeholder litellm-cache

aws elasticache create-serverless-cache \
  --serverless-cache-name litellm-cache \
  --engine valkey \
  --user-group-id litellm-cache-users \
  --security-group-ids sg-0123456789abcdef0 \
  --subnet-ids subnet-0123456789abcdef0 subnet-0fedcba9876543210
```

To attach the group to a cache that already exists, use `modify-serverless-cache --user-group-id`
or `modify-replication-group --user-group-ids` instead

### 3. Grant `elasticache:Connect` to the role the proxy runs as

The policy must name both the cache and the user. Granting one without the other fails closed at
connect time

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "elasticache:Connect",
      "Resource": [
        "arn:aws:elasticache:us-east-1:123456789012:serverlesscache:litellm-cache",
        "arn:aws:elasticache:us-east-1:123456789012:user:litellm-cache"
      ]
    }
  ]
}
```

Attach that policy to the IAM role your service account assumes, and annotate the service account so
the pods receive it

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: litellm
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/litellm-proxy
```

For a self-designed cluster the cache ARN is
`arn:aws:elasticache:<region>:<account>:replicationgroup:<replication-group-id>` instead

### 4. Point LiteLLM at the cache

Use `redis_startup_nodes` for ElastiCache Serverless and any cluster mode enabled cache, since both
require a cluster aware client. `aws_iam_cache_name` is the cache's name, not its endpoint hostname,
because that name is what gets signed

<Tabs>

<TabItem value="serverless" label="Serverless">

```yaml
litellm_settings:
  cache: true
  cache_params:
    type: redis
    redis_startup_nodes:
      [{ "host": "litellm-cache-abc123.serverless.use1.cache.amazonaws.com", "port": 6379 }]
    ssl: true
    aws_iam_auth: true
    aws_iam_user_name: litellm-cache
    aws_iam_cache_name: litellm-cache
    aws_iam_region: us-east-1
    aws_iam_serverless: true
```

</TabItem>

<TabItem value="self-designed" label="Self-designed cluster">

For a cluster mode disabled replication group, point `host` at the primary endpoint and leave
`aws_iam_serverless` unset. `aws_iam_cache_name` is the replication group id

```yaml
litellm_settings:
  cache: true
  cache_params:
    type: redis
    host: master.litellm-cache.abc123.use1.cache.amazonaws.com
    port: 6379
    ssl: true
    aws_iam_auth: true
    aws_iam_user_name: litellm-cache
    aws_iam_cache_name: litellm-cache
    aws_iam_region: us-east-1
```

</TabItem>

<TabItem value="env" label="Environment variables">

Every setting has a `REDIS_`-prefixed environment variable equivalent, which is the better fit when
the values come from a secret manager or a Helm values file

```shell
REDIS_CLUSTER_NODES='[{"host": "litellm-cache-abc123.serverless.use1.cache.amazonaws.com", "port": 6379}]'
REDIS_SSL="True"
REDIS_AWS_IAM_AUTH="True"
REDIS_AWS_IAM_USER_NAME="litellm-cache"
REDIS_AWS_IAM_CACHE_NAME="litellm-cache"
REDIS_AWS_IAM_REGION="us-east-1"
REDIS_AWS_IAM_SERVERLESS="True"
```

</TabItem>

</Tabs>

### 5. Roll it out and verify

Ping the cache through the proxy. A healthy response means the SigV4 token was signed, accepted by
ElastiCache, and a write round-tripped

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

Then confirm the cache is actually serving traffic by sending the same completion twice. The second
call returns the same response id and comes back in a fraction of the time

```shell
curl -s -X POST 'http://localhost:4000/v1/chat/completions' \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "ping"}], "temperature": 0}'
```

## Settings

| Setting | Required | Description |
| --- | --- | --- |
| `aws_iam_auth` | yes | Turns on ElastiCache IAM authentication. Accepts a bool or a truthy string |
| `aws_iam_user_name` | yes | The ElastiCache user name, which must equal its user id |
| `aws_iam_cache_name` | yes | The serverless cache name or replication group id. This is signed, so it is not the endpoint hostname |
| `aws_iam_region` | no | Region used for signing. Falls back to `AWS_REGION`, then `AWS_DEFAULT_REGION` |
| `aws_iam_serverless` | no | Set on ElastiCache Serverless caches. Adds `ResourceType=ServerlessCache` to the signed request |

`ssl: true` is required alongside these. LiteLLM raises at startup when IAM auth is enabled without
TLS, or when any required setting is missing, so a misconfiguration surfaces immediately instead of
becoming an auth failure under load

## Notes

AWS credentials are resolved through the standard boto3 chain, so IRSA, instance profiles, ECS task
roles, `AWS_PROFILE`, and static keys all work without extra configuration. LiteLLM holds on to the
resolved credential object rather than a snapshot of it, which is what lets a rotating credential
source keep working across a long-lived proxy

If you configure GCP IAM (`gcp_service_account`) or Azure AD (`azure_redis_ad_token`) alongside AWS
IAM, the GCP or Azure path wins and LiteLLM logs a warning. Configure exactly one

Supplying your own `credential_provider` overrides all of this, which is still the escape hatch for
an auth flow LiteLLM does not model

## Troubleshooting

`AWS ElastiCache IAM Redis authentication requires TLS` means `ssl: true` is missing from
`cache_params`, or the `url` you supplied uses the `redis://` scheme rather than `rediss://`

`AWS ElastiCache IAM Redis authentication requires: <setting>` names the settings you left out

`invalid username-password pair or user is disabled` from Redis means the token was well formed but
AWS rejected it. The usual causes are an `aws_iam_cache_name` that does not match the cache, a user
that is not in a user group attached to that cache, or an IAM policy missing either the cache ARN or
the user ARN

`Unable to resolve AWS credentials for ElastiCache IAM Redis authentication` means the boto3 chain
came back empty, so the pod has no role attached or the environment has no credentials

## See also

Everything else about the Redis cache, including cluster topology, namespaces and TLS, lives on
[Redis and Valkey](./caching_redis.md). For Memorystore, see
[GCP Memorystore IAM Authentication](./gcp_memorystore_iam.md)
