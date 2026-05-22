import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Database Read Replica

LiteLLM Proxy can route read-only queries to a separate database endpoint while
writes continue to go to the primary. This is useful for Aurora-style clusters
that expose distinct reader/writer endpoints, where directing reads at the
reader keeps the writer free for transactional workloads.

## Quick start

Set `DATABASE_URL_READ_REPLICA` alongside the existing `DATABASE_URL`:

```shell
export DATABASE_URL=postgresql://user:pass@writer.db.example.com:5432/litellm
export DATABASE_URL_READ_REPLICA=postgresql://user:pass@reader.db.example.com:5432/litellm
```

The proxy automatically detects the env var on startup and switches the
internal Prisma client into a routing mode that splits traffic between the two
endpoints. If `DATABASE_URL_READ_REPLICA` is unset, the proxy continues to use
single-database behavior — no other configuration is required.

## What gets routed

| Operation | Destination |
| --- | --- |
| `find_first`, `find_many`, `find_unique` (and `_or_raise` variants) | Reader |
| `count`, `group_by` | Reader |
| `query_raw`, `query_first` | Reader |
| `create`, `update`, `upsert`, `delete`, `update_many`, `delete_many` | Writer |
| `execute_raw` | Writer |
| Transactions (`tx`, `batch_`) | Writer |

Reads originating in code (e.g. virtual key lookup, team membership, spend
queries) are dispatched to the reader without changes to call sites — the
routing wrapper intercepts the per-model action accessor and chooses the
backend per method.

## Reader degradation

If the reader endpoint is unreachable at startup, the proxy logs a warning and
falls back to the writer for reads instead of failing to start:

```
Failed to connect to read replica DB: <error>. Falling back to the writer for
reads until the reader is reachable.
```

The same fallback applies if the reader fails during a reconnect cycle. The
next successful reader recreate clears the degraded flag and reads start
hitting the reader again.

This means: enabling read-replica routing **never reduces availability** — at
worst it degrades to single-database performance.

## RDS IAM authentication

When `IAM_TOKEN_DB_AUTH=True`, both the writer and the reader refresh their
IAM tokens independently on the same ~12-minute cadence. The reader does not
need parallel `DATABASE_HOST_READ_REPLICA` / `DATABASE_USER_READ_REPLICA`
env vars — host, port, user, and database name are parsed once from
`DATABASE_URL_READ_REPLICA` at startup, and only the IAM token rotates after
that.

This pairs naturally with Aurora's reader endpoint, which resolves to the
reader instances in the cluster.

## Kubernetes / Helm

The official Helm chart exposes two ways to wire the reader URL:

<Tabs>

<TabItem value="secret" label="From a Kubernetes secret (recommended)">

When the reader URL embeds credentials, source it from the existing
`db.secret.name` Kubernetes secret using `db.secret.readReplicaUrlKey`. This
keeps the URL out of the rendered pod spec and the Helm release secret.

```yaml
db:
  useExisting: true
  secret:
    name: postgres
    usernameKey: username
    passwordKey: password
    # Add the reader URL to the same secret under any key, then reference it:
    readReplicaUrlKey: read-url
```

</TabItem>

<TabItem value="plain" label="Plaintext value">

For credential-less URLs (for example, when `IAM_TOKEN_DB_AUTH` supplies
the password at runtime), `db.readReplicaUrl` works:

```yaml
db:
  readReplicaUrl: "postgresql://litellm@reader.aurora.local:5432/litellm"
```

Avoid this form if the URL embeds a password — the value renders into the
pod spec and the Helm release secret.

</TabItem>

</Tabs>

## Docker Compose

Add the env var to your service:

```yaml
services:
  litellm:
    environment:
      DATABASE_URL: postgresql://user:pass@writer:5432/litellm
      DATABASE_URL_READ_REPLICA: postgresql://user:pass@reader:5432/litellm
```

## When to enable it

Read-replica routing is most useful when:

- You're on Aurora (or another managed Postgres with reader endpoints) and
  want to offload spend / team / key lookups from the writer.
- Read traffic dominates and writer CPU / connections are constrained.
- You want geographic read locality (reader closer to the proxy).

It is **not** useful when:

- Your primary and replica are the same physical endpoint.
- You're running a single-node Postgres without replicas.
- Replication lag would invalidate consistency assumptions in your app — note
  that all reads route to the reader, including reads that immediately follow
  a write.

## Replication lag

The proxy does not implement read-after-write consistency for the reader
endpoint. If your replication lag is meaningful (>100ms) and you have flows
that write then immediately read the same row, those reads may see stale data.
Code that needs strong consistency on a fresh write should use `query_raw`
through the writer or rely on transaction-scoped reads.

## Related env vars

| Env var | Description |
| --- | --- |
| `DATABASE_URL` | Writer connection URL (required). |
| `DATABASE_URL_READ_REPLICA` | Reader connection URL (optional). When unset, all reads go to the writer. |
| `IAM_TOKEN_DB_AUTH` | When `True`, both writer and reader refresh RDS IAM tokens automatically. |

See [environment variables - Reference](./config_settings#environment-variables---reference)
for the full list.
