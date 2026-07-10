import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';
import { MultiRegionArchitecture } from '@site/src/components/CloudArchitecture';

# Multi-Region Deployment

Run LiteLLM proxy instances in multiple regions of the same cloud provider, all connected to one shared PostgreSQL database. Clients get routed to the nearest region for low latency, while keys, teams, users, and spend tracking stay consistent everywhere because there is a single source of truth.

This page covers the supported topology, how licensing works across regions, and step-by-step setup. For deploying the proxy itself in each region, see [Deploy to Cloud (AWS, GCP, Azure)](./deploy_cloud.md).

## Architecture

<MultiRegionArchitecture />

The topology has three rules:

1. **One database.** Every region's proxy instances point `DATABASE_URL` at the same PostgreSQL database, hosted in your primary region. This is what makes keys created in one region work in every region, and what makes budgets and spend tracking globally consistent.
2. **One Redis per region.** Redis handles rate limiting, router state, and response caching between the instances of a region. Keep it in-region; putting a single Redis behind cross-region links adds a network round trip to every rate-limit check.
3. **One cloud provider.** Run all regions in the same cloud provider.

The same topology runs active-active (DNS routes every client to its nearest region; the goal is latency) or active-passive (all traffic on one region, a second region deployed but idle behind a DNS failover record; the goal is disaster recovery). The configuration is identical; only the DNS policy differs.

## Licensing across regions

A single LiteLLM Enterprise license covers all regions, as long as all regions share one database.

Each proxy instance independently validates the `LITELLM_LICENSE` key it is given (offline against a signed payload, or against the license server), and nothing in the license check counts instances or regions. The quantitative limits a license carries, maximum users and maximum teams, are counted from the database. When every region shares one database, those counts exist once, so the license is enforced once, globally.

The corollary: separate databases per region are separate deployments, and each needs its own license. Two databases means two sets of user and team counts, two sets of keys, and two licenses.

| Topology | Databases | Licenses needed |
|---|---|---|
| Multi-region, shared database (this page) | 1 | 1 |
| Independent deployment per region | 1 per region | 1 per region |
| [High Availability Control Plane](./high_availability_control_plane.md) (BETA) | 1 per worker | 1 per worker |

If you want fully independent deployments per region (own database, Redis, master key, and license) managed from a single UI, use the [High Availability Control Plane](./high_availability_control_plane.md) (BETA, Enterprise) instead of this page. It trades global consistency for blast-radius isolation: a database outage in one region cannot affect another, but keys and budgets do not span regions.

## Requirements

Every proxy instance in every region must share the following. If any of these differ between regions, the deployment will misbehave in ways that are hard to debug (instances that cannot decrypt stored credentials, keys that fail auth in one region, seat limits enforced inconsistently).

| Setting | Must be | Why |
|---|---|---|
| `DATABASE_URL` | Same database in every region | Single source of truth for keys, teams, users, spend, and license seat counts |
| `LITELLM_MASTER_KEY` | Identical in every region | Keys are validated against the shared database; the master key must match everywhere |
| `LITELLM_SALT_KEY` | Identical in every region, never changed after setup | Encrypts and decrypts LLM credentials stored in the database. An instance with a different salt key cannot read stored model credentials |
| `LITELLM_LICENSE` | Same license key in every region | Each instance validates the license independently; one key activates all of them |
| `DISABLE_SCHEMA_UPDATE` | `true` on all proxy instances | Schema migrations must run exactly once (as a job), not raced by every instance in every region |

Per region, you additionally run a Redis instance and point that region's proxy at it with [`general_settings.coordination_redis`](./coordination_redis). Setting `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` per region, as the environment blocks below do, is enough on its own; the proxy builds the coordination Redis client from those variables when no explicit block is present. Redis state is regional: rate limits and cached responses are scoped to the region that served the request.

:::info

Rate limits (TPM/RPM on keys, teams, and users) are enforced through the coordination Redis. With one Redis per region, a limit of 100 RPM means 100 RPM per region, not globally. If you need strictly global rate limiting, all instances must share one Redis, which puts a cross-region round trip in the request path for remote regions. Most deployments accept per-region enforcement.

:::

## Setup

The steps below assume you can already deploy a single-region production proxy (load balancer, proxy instances, Postgres, Redis). If not, start with [Deploy to Cloud](./deploy_cloud.md) and the [production checklist](./prod.md).

### 1. Provision the shared database

Create one PostgreSQL database in your primary region and run the schema migrations against it once, using the migrations job from the [Helm charts](./deploy_cloud.md#deploy-with-helm) or the [Terraform modules](./deploy_cloud.md#deploy-with-terraform-aws-and-gcp). All regions will use this database's connection string.

### 2. Connect the regions' networks

Proxy instances in secondary regions must reach the primary region's database over a private, routed connection: [VPC peering](https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html) or [Transit Gateway](https://docs.aws.amazon.com/vpc/latest/tgw/what-is-transit-gateway.html) on AWS, [VPC Network Peering](https://cloud.google.com/vpc/docs/vpc-peering) on GCP (a global VPC with regional subnets also works), [VNet peering](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-peering-overview) on Azure. Open the database port (5432) from each secondary region's proxy subnets in the database's security group or firewall, and require TLS on the connection (`sslmode=require`); this traffic crosses a regional boundary. Every uncached database read from a secondary region pays the inter-region round trip, which is why step 4 adds regional read replicas.

### 3. Deploy proxy instances in each region

Deploy the proxy in every region exactly as you would for a single region, with two differences: point `DATABASE_URL` at the primary region's database instead of a regional one, and run the schema migrations job only from the primary region (`migrationJob.enabled: false` in the secondary regions' Helm values), so a rollout in one region never races another region's migrations against the shared schema. Deploy every region from the same source of truth (one Helm values file or Terraform configuration, parameterized only by region) so regions cannot drift apart in version or config.

<Tabs>
<TabItem value="primary" label="Primary region (us-east-1)">

```bash
DATABASE_URL="postgresql://litellm:<password>@db.us-east-1.internal:5432/litellm?sslmode=require"
LITELLM_MASTER_KEY="sk-<same-everywhere>"
LITELLM_SALT_KEY="sk-<same-everywhere-never-rotate>"
LITELLM_LICENSE="<same-everywhere>"
DISABLE_SCHEMA_UPDATE="true"
REDIS_HOST="redis.us-east-1.internal"
REDIS_PORT="6379"
REDIS_PASSWORD="<regional>"
```

</TabItem>
<TabItem value="secondary" label="Secondary region (eu-west-1)">

```bash
# Same database as the primary region
DATABASE_URL="postgresql://litellm:<password>@db.us-east-1.internal:5432/litellm?sslmode=require"
LITELLM_MASTER_KEY="sk-<same-everywhere>"
LITELLM_SALT_KEY="sk-<same-everywhere-never-rotate>"
LITELLM_LICENSE="<same-everywhere>"
DISABLE_SCHEMA_UPDATE="true"
# Redis stays regional
REDIS_HOST="redis.eu-west-1.internal"
REDIS_PORT="6379"
REDIS_PASSWORD="<regional>"

# Optional: regional read replica (see next section)
DATABASE_URL_READ_REPLICA="postgresql://litellm:<password>@db-replica.eu-west-1.internal:5432/litellm"
```

</TabItem>
</Tabs>

### 4. Optional: add regional read replicas

Every request authenticates its key against the database (with in-memory caching, so steady-state traffic does not hit the database on every call). Secondary regions can still cut their database read latency by running a PostgreSQL read replica in-region and setting `DATABASE_URL_READ_REPLICA`. LiteLLM routes read-only queries to the replica and all writes to the primary. See [Database Read Replica](./db_read_replica.md) for what routes where and how to handle replication lag.

Writes (key creation, config changes, spend updates) always go to the primary region's database. Spend updates are batched, so cross-region write latency does not sit in the request path.

### 5. Route clients to the nearest region

Put latency-based or geo DNS in front of the regional load balancers: [Route 53 latency-based routing](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy-latency.html) on AWS, [Cloud DNS geolocation routing policies](https://cloud.google.com/dns/docs/routing-policies) on GCP, [Traffic Manager](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-routing-methods) or [Front Door](https://learn.microsoft.com/en-us/azure/frontdoor/front-door-overview) on Azure. Clients use one hostname and land on their nearest region.

Health-check each region against `/health/liveliness`, not `/health/readiness`. Readiness returns 503 whenever the database is unreachable, and the database is shared: an outage would trip every region's readiness check at once and pull all regions out of DNS rotation, exactly when `allow_requests_on_db_unavailable` would have kept them serving cached traffic. Liveliness reports whether the region's proxies are up, which is what a DNS failover decision needs.

### 6. Verify

1. Open the primary region's Admin UI (`https://llm.example.com/ui`), go to **Virtual Keys**, and create a key.

<Image img={require('../../img/ui_create_key_flow.gif')} alt="Creating a virtual key in the LiteLLM Admin UI" />

2. Open the secondary region's UI directly (`https://eu.llm.example.com/ui`), go to the **Test Key** playground, paste the key you just created, and send a request. It succeeds because both regions validate keys against the same database.

<Image img={require('../../img/ui_playground_navigation.png')} alt="Test Key playground in the LiteLLM Admin UI" />

3. Back on **Virtual Keys**, confirm the key shows the spend from the request you made through the secondary region.

## Optional: dedicated admin instance

By default every instance serves both LLM traffic and admin traffic (UI and management APIs). In a multi-region deployment you can designate one instance as admin-only and strip admin surfaces from the regional instances. This keeps management access behind one hostname and reduces the attack surface of the instances serving LLM traffic.

:::info

`DISABLE_ADMIN_ENDPOINTS` and `DISABLE_LLM_API_ENDPOINTS` are Enterprise features. [Enterprise Pricing](https://www.litellm.ai/#pricing)

:::

<Tabs>
<TabItem value="admin" label="Admin instance">

```bash
# Serves the UI and management APIs, refuses LLM traffic
DISABLE_LLM_API_ENDPOINTS="true"
DATABASE_URL="postgresql://...@db.us-east-1.internal:5432/litellm"
LITELLM_MASTER_KEY="sk-<same-everywhere>"
```

</TabItem>
<TabItem value="worker" label="Regional instances">

```bash
# Serve LLM traffic, refuse admin traffic
DISABLE_ADMIN_UI="true"
DISABLE_ADMIN_ENDPOINTS="true"
DATABASE_URL="postgresql://...@db.us-east-1.internal:5432/litellm"
LITELLM_MASTER_KEY="sk-<same-everywhere>"
```

</TabItem>
</Tabs>

| Variable | Default | Effect when `true` |
|---|---|---|
| `DISABLE_ADMIN_UI` | `false` | The web UI at `/ui` becomes unavailable |
| `DISABLE_ADMIN_ENDPOINTS` | `false` | Management endpoints (`/key/*`, `/user/*`, `/team/*`, `/model/*`) return errors; LLM endpoints, `/health`, and `/metrics` keep working |
| `DISABLE_LLM_API_ENDPOINTS` | `false` | LLM endpoints (`/chat/completions`, `/v1/*`, provider pass-through routes) return errors; management endpoints keep working, and `/models` stays available so the UI can list models |

## FAQ

**Do I need multi-region at all?**
Often not. A single-region deployment with a multi-AZ database and Redis already survives zone failures; see [Production Best Practices](./prod.md). Add regions when you need lower latency for distant users or cross-region disaster recovery.

**Does multi-region require an Enterprise license?**
The shared-database topology itself runs on the open source proxy. Enterprise features are covered by one license across regions, as described in [Licensing across regions](#licensing-across-regions).

**What happens if the primary region's database goes down?**
All regions lose database access: key validation falls back to caches, and management operations fail until the database returns. The database is the single point of coupling in this architecture. Set `general_settings.allow_requests_on_db_unavailable: true` so proxies keep serving traffic for already-cached keys during the outage (see [graceful DB unavailability](./prod.md#6-if-running-litellm-on-vpc-gracefully-handle-db-unavailability)), run the database multi-AZ with automated failover, and if that is still not enough isolation, consider the [High Availability Control Plane](./high_availability_control_plane.md) instead.

**Can I run different LiteLLM versions in different regions?**
Briefly, during a rolling upgrade. Do not run mixed versions steady-state; the shared database schema follows the newest version, and migrations should run exactly once per upgrade.