
# Dynamic TPM/RPM Allocation 

Prevent projects from gobbling too much tpm/rpm.

**See Also:** [Request Prioritization](../scheduler.md) - Prioritize LLM API requests in high-traffic by adding them to a priority queue.

Share a model's TPM/RPM capacity across keys and teams. The limiter watches how saturated the model is: while recorded usage is below a configurable saturation threshold, any key may use idle capacity; once usage crosses the threshold, each priority level is held to its reserved share. [**See Code**](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/hooks/dynamic_rate_limiter_v3.py)

## Quick Start Usage

1. Setup config.yaml 

```yaml showLineNumbers title="config.yaml"
model_list: 
  - model_name: my-fake-model
    litellm_params:
      model: {{openai_small}}
      api_key: my-fake-key
      mock_response: hello-world
      tpm: 60

litellm_settings: 
  callbacks: ["dynamic_rate_limiter_v3"]

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY # OR set `LITELLM_MASTER_KEY=".."` in your .env
  database_url: postgres://.. # OR set `DATABASE_URL=".."` in your .env
```

2. Start proxy 

```bash
litellm --config /path/to/config.yaml
```

3. Test it! 

```python showLineNumbers title="test.py"
"""
- Run 2 keys calling the same model
- model has 60 TPM
- Mock response returns 30 total tokens / request
- The model serves 2 requests in the window (2 x 30 = 60 tokens),
  then 429s every key until the 60s window rolls
"""

import requests
from openai import OpenAI, RateLimitError

def create_key(api_key: str, base_url: str): 
    response = requests.post(
        url="{}/key/generate".format(base_url), 
        json={},
        headers={
            "Authorization": "Bearer {}".format(api_key)
        }
    )

    _response = response.json()

    return _response["key"]

key_1 = create_key(api_key="sk-<your-litellm-api-key>", base_url="http://0.0.0.0:4000")
key_2 = create_key(api_key="sk-<your-litellm-api-key>", base_url="http://0.0.0.0:4000")

# call proxy with key 1 - works
openai_client_1 = OpenAI(api_key=key_1, base_url="http://0.0.0.0:4000")

response = openai_client_1.chat.completions.with_raw_response.create(
    model="my-fake-model", messages=[{"role": "user", "content": "Hello world!"}],
)

print("Headers for call 1 - {}".format(response.headers))
_response = response.parse()
print("Total tokens for call - {}".format(_response.usage.total_tokens))


# call proxy with key 2 -  works 
openai_client_2 = OpenAI(api_key=key_2, base_url="http://0.0.0.0:4000")

response = openai_client_2.chat.completions.with_raw_response.create(
    model="my-fake-model", messages=[{"role": "user", "content": "Hello world!"}],
)

print("Headers for call 2 - {}".format(response.headers))
_response = response.parse()
print("Total tokens for call - {}".format(_response.usage.total_tokens))
# call proxy with key 2 -  fails
try:  
    openai_client_2.chat.completions.with_raw_response.create(model="my-fake-model", messages=[{"role": "user", "content": "Hey, how's it going?"}])
    raise Exception("This should have failed!")
except RateLimitError as e: 
    print("This was rate limited b/c - {}".format(str(e)))

```

**Expected Response**

```
This was rate limited b/c - Error code: 429 - {'error': {'message': 'Model capacity reached for my-fake-model. Priority: None, Rate limit type: tokens, Model TPM: 60, Model RPM: not configured, Remaining: 0', 'type': 'throttling_error', 'param': None, 'code': '429'}}
```

Tokens are recorded on the limiter's counters after each response completes, so the block fires on the first request after recorded usage reaches the model's TPM. Requests already in flight when the budget runs out are not blocked; see [How enforcement works](#how-enforcement-works) below.


## [BETA] Set Priority / Reserve Quota

Reserve TPM/RPM capacity for different environments or use cases. This ensures critical production workloads always have guaranteed capacity, while development or lower-priority tasks use remaining quota.

**Use Cases:**
- Production vs Development environments
- Real-time applications vs batch processing
- Critical services vs experimental features

<EnterpriseFeature feature="Reserving TPM/RPM on keys based on priority" />

### How Priority Reservation Works

Priority reservation allocates a percentage of your model's total TPM/RPM to specific priority levels. Keys with higher priority get guaranteed access to their reserved quota first.

**Example Scenario:**
- Model has 10 RPM total capacity
- Priority reservation: `{"prod": 0.9, "dev": 0.1}`
- Result: Production keys get 9 RPM guaranteed, Development keys get 1 RPM guaranteed

### Configuration

#### 1. Setup config.yaml

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{openai_small}}             
    litellm_params:
      model: "{{openai_small}}"       
      api_key: os.environ/OPENAI_API_KEY 
      rpm: 10   # Total model capacity

litellm_settings:
  callbacks: ["dynamic_rate_limiter_v3"]
  priority_reservation:
    "prod": 0.9 # 90% reserved for production (9 RPM)
    "dev": 0.1 # 10% reserved for development (1 RPM)
    # Alternative format:
    # "prod":
    #   type: "rpm"    # Reserve based on requests per minute
    #   value: 9       # 9 RPM = 90% of 10 RPM capacity
    # "dev":
    #   type: "tpm"    # Reserve based on tokens per minute
    #   value: 100     # 100 TPM
  priority_reservation_settings:
    default_priority: 0  # Weight (0%) assigned to keys without explicit priority metadata
    saturation_threshold: 0.50 #  A model is saturated if it has hit 50% of its RPM limit
    saturation_check_cache_ttl: 60 # How long (seconds) saturation values are cached locally

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY # OR set `LITELLM_MASTER_KEY=".."` in your .env
  database_url: postgres://.. # OR set `DATABASE_URL=".."` in your.env
```

**Configuration Details:**

`priority_reservation`: Dict[str, Union[float, PriorityReservationDict]]
- **Key (str)**: Priority level name (can be any string like "prod", "dev", "critical", etc.)
- **Value**: Either a float (0.0-1.0) or dict with `type` and `value`
  - Float: `0.9` = 90% of capacity
  - Dict: `{"type": "rpm", "value": 9}` = 9 requests/min
  - Supported types: `"percent"`, `"rpm"`, `"tpm"`

`priority_reservation_settings`: Object (Optional)
- **default_priority (float)**: Weight/percentage (0.0 to 1.0) assigned to API keys that have no priority metadata set (defaults to 0.25). All keys without an explicit priority share ONE pool of this size; it is not a per-key allocation. Two unlabeled teams therefore compete inside the same default pool with no floor between them
- **saturation_threshold (float)**: Saturation level (0.0 to 1.0) at which strict priority enforcement begins for a model. Saturation is calculated as `max(current_rpm/max_rpm, current_tpm/max_tpm)`. Below this threshold, generous mode allows priority borrowing from unused capacity. Above this threshold, strict mode enforces normalized priority limits.
  - Example: When model usage is low, keys can use more than their allocated share. When model usage is high, keys are strictly limited to their allocated share.
- **saturation_check_cache_ttl (int)**: TTL in seconds for local cache when reading saturation values from Redis (defaults to 60). In multi-node deployments, this controls how quickly nodes converge on the same saturation state. Lower values mean faster convergence but more Redis reads.
  - Example: Set to `5` for faster multi-node consistency, or `0` to always read directly from Redis.
- **model_limit_borrowing_config.borrow_idle_capacity (list)**: Which callers run past their `model_tpm_limit` and `model_rpm_limit` on capacity other callers are not using (defaults to an empty list). Accepts `team`, `key` and `customer_organization`. Only models this limiter covers are affected. While the model is below `saturation_threshold` a listed caller may exceed its limits, and once the model saturates it is held to them, with a 429 whose `rate_limited_by` header reads `model_per_team_saturated`, `model_per_key_saturated` or `model_per_customer_org_saturated`. The model's own `tpm` and `rpm` are always enforced, and limits of a type that is not listed stay hard. See [Model limits that borrow idle capacity](#model-limits-that-borrow-idle-capacity).
- **priority_class_share_config.split_equally_among_active (list)**: Which callers take their own equal slice of a priority class's share of a model (defaults to an empty list). Accepts `team`, `key`, `customer_organization` and `customer_member`. A caller counts as active on a model once it sends a request there and stops counting after a rate-limit window (60 seconds) without one. The configured weights are renormalized over only the classes with an active caller, and each class's share is divided equally among its active callers. Once the model saturates, each caller is held to its own share, with a 429 whose `rate_limited_by` header reads `priority_class_share_saturated`. A request that matches no listed type keeps the shared class pool. See [Split a priority class share among active callers](#split-a-priority-class-share-among-active-callers).

**Start Proxy**

```bash
litellm --config /path/to/config.yaml
```

### Set priority on either a team or a key

Priority can be set at either the **team level** or **key level**. Team-level priority takes precedence over key-level priority.

**Option A: Set Priority on Team (Recommended)**

All keys within a team will inherit the team's priority. This is useful when you want all keys for a specific environment or project to have the same priority.

```bash
curl -X POST 'http://0.0.0.0:4000/team/new' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "team_alias": "production-team",
  "metadata": {"priority": "prod"}
}'
```

Create a key for this team:
```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "team_id": "team-id-from-previous-response"
}'
```

**Option B: Set Priority on Individual Keys**

Set priority directly on the key. This is useful when you need fine-grained control per key.

**Production Key:**
```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "metadata": {"priority": "prod"}
}'
```

**Development Key:**
```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "metadata": {"priority": "dev"}
}'
```

**Key Without Priority (uses default_priority weight):**
```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{}'
```

**Expected Response:**
```json
{
  "key": "sk-...",
  "metadata": {"priority": "prod"}, // or "dev"
  ...
}
```

**Priority Resolution Order:**
1. If key belongs to a team with `metadata.priority` set → use team priority
2. Else if key has `metadata.priority` set → use key priority  
3. Else → use `default_priority` from config

#### 3. Test Priority Allocation

**Test Production Key (should get 9 RPM):**
```bash
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-prod-key' \
  -d '{
    "model": "{{openai_small}}",
    "messages": [{"role": "user", "content": "Hello from prod"}]
  }'
```

**Test Development Key (should get 1 RPM):**
```bash
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-dev-key' \
  -d '{
    "model": "{{openai_small}}", 
    "messages": [{"role": "user", "content": "Hello from dev"}]
  }'
```

### Expected Behavior

A priority's reservation is a floor, not a ceiling. What a key can actually use depends on how saturated the model is:

1. **Below the saturation threshold (generous mode)**: only the model-wide capacity is enforced. Any key, regardless of priority, may use idle capacity beyond its own reservation
2. **At or above the threshold (strict mode)**: each priority is held to its reserved share for the rest of the window. Keys whose priority pool is exhausted receive 429s while priorities still inside their reservation keep being served
3. **Keys without explicit priority** share one pool weighted by `default_priority`. With the configuration above (`default_priority: 0`) they get nothing; with the default (`0.25`) all unlabeled keys together get 25%
4. Capacity a key consumed while borrowing in generous mode is not taken back when strict mode engages. Floors protect capacity that has not been consumed yet, so a floor is only fully guaranteed if the protected priority sends traffic throughout the window

An important consequence of (1) and (2): saturation measures recorded usage, not how many keys are active. A key alone on an idle model still trips strict mode with its own traffic, so the most a single priority can use in one window is `max(its reservation, saturation_threshold) x model capacity`, plus at most one in-flight request. A lone key never reaches 100% of the model unless its reservation or the threshold allows it.

#### Worked example

Model with `tpm: 1000`, `priority_reservation: {"team_a": 0.5, "team_b": 0.5}`, `saturation_threshold: 0.5`. Team A demands more than full capacity every minute; team B demands what the row says. Each row is one fresh 60s window:

| Window | A demands | B demands | A is served | B is served | Why |
|---|---|---|---|---|---|
| 1 | 100%+ | idle | ~500 | | A alone saturates the model to 50%, strict mode caps A at its own 500 floor |
| 2 | 100%+ | 500 | ~500 | ~500 | strict mode splits capacity along the 50/50 floors |
| 3 | 100%+ | 400 | ~500 | ~400 | B under its floor is fully served, zero 429s; A takes the rest |

Raising `saturation_threshold` to `0.8` changes window 1 to ~800 (A borrows up to the threshold) but weakens window 2: A grabs ~600 in generous mode before strict engages, and B tops out around ~420 because A's borrowed capacity is not clawed back and the model-wide cap blocks the remainder.

#### How enforcement works

Request counts are checked and incremented before the LLM call, so RPM limits are exact. Token counts are only known after a response completes, so TPM enforcement is admission control against recorded usage: a request is admitted while recorded tokens are below the limit, and its own tokens land on the counter afterwards. Two consequences:

1. Actual tokens served in a window can exceed the configured TPM by roughly one request's tokens per concurrently sending key. A burst of parallel requests admitted together can overshoot further; TPM is not a hard intra-minute cap
2. If the configured TPM is smaller than a typical single response, a single request blows through the whole budget and enforcement degenerates to roughly one request per window. Size TPM well above your typical per-request token count when testing this feature

Windows are rolling 60 seconds from the first request on the model, not calendar minutes. In multi-node deployments the saturation value is additionally cached locally for `saturation_check_cache_ttl` seconds, so strict mode can engage up to that many seconds late on nodes that did not serve the triggering traffic.

**Rate Limit Error Examples:**

Priority pool exhausted in strict mode:

```json
{
  "error": {
    "message": "Priority-based rate limit exceeded. Model: {{openai_small}}, Priority: dev, Rate limit type: tokens, Model TPM: 1000, Model RPM: not configured, Remaining: 0, Model saturation: 52.8%",
    "type": "throttling_error",
    "code": "429"
  }
}
```

Model-wide capacity exhausted (any priority):

```json
{
  "error": {
    "message": "Model capacity reached for {{openai_small}}. Priority: prod, Rate limit type: tokens, Model TPM: 1000, Model RPM: not configured, Remaining: 0",
    "type": "throttling_error",
    "code": "429"
  }
}
```

### Model limits that borrow idle capacity

By default a `model_tpm_limit` and `model_rpm_limit` on a team, a key or a customer organization are hard ceilings, enforced by the regular rate limiter before this limiter runs. A caller that hits one is refused even when everyone else is leaving the model idle. List the entity types that should borrow that idle capacity under `model_limit_borrowing_config.borrow_idle_capacity`.

```yaml
litellm_settings:
  callbacks: ["dynamic_rate_limiter_v3"]
  priority_reservation_settings:
    saturation_threshold: 0.5
    model_limit_borrowing_config:
      borrow_idle_capacity: ["team", "key", "customer_organization"]   # default: []
```

With a model at `tpm: 1000`, team A at `model_tpm_limit: {"my-model": 500}` and team B idle, team A can run past 500 tokens a minute while the model is under 50% saturation. Once usage crosses the threshold, team A is held to 500 from that moment on, and a request past that gets a 429 whose `rate_limited_by` header reads `model_per_team_saturated`, while team B still has its own 500 to use. `model_rpm_limit` works the same way with requests. Aggregate traffic never exceeds the model's `tpm` or `rpm`, and borrowing only ever uses capacity on the same model, never a limit on another model.

`team` covers the limits a key inherits from its team. `key` covers a `model_tpm_limit` or `model_rpm_limit` set on the key itself, refused at saturation with `model_per_key_saturated`. `customer_organization` covers the per-model limits on a customer organization's budget, refused with `model_per_customer_org_saturated`. A customer organization's usage is one counter per organization and model, counted across every key its requests come through, so a customer calling through several service keys borrows and is clamped as one caller. When a request has more than one listed holder, for example a key with its own limit calling for a customer organization, each share applies and the tighter one refuses.

A limit whose entity type is not listed stays a hard ceiling, as do overall `tpm_limit` and `rpm_limit` values. Models that have neither `tpm` nor `rpm` configured, or that the dynamic limiter does not cover, keep hard limits. Because saturation is cached for `saturation_check_cache_ttl` seconds, a caller may run a little past its limit before the clamp engages. The sections below describe a team, and a key or a customer organization behaves the same way.

#### A borrower gets its share back once the model saturates

What a team used while the model was idle is not charged against its share. The per-team counter this limiter holds a team to only counts requests admitted while the model is saturated, so it starts fresh the moment saturation engages. In the example above team A has used 510 tokens when the model crosses 50% saturation. Team A is not refused for the rest of the minute. It keeps its full 500 for the next 60 seconds, team B has its own 500, and a team below its share is always admitted ahead of a team past it. Tokens already consumed are never clawed back, so the model's own `tpm` still bounds what both teams get in that minute. Aggregate admitted traffic stays within it.

Each node learns the model is saturated when it refreshes the saturation value, every `saturation_check_cache_ttl` seconds (60 by default). A node that did not serve the triggering traffic keeps admitting the borrower on idle terms until then, so set the TTL to a few seconds when teams share a model under contention.

```yaml
litellm_settings:
  callbacks: ["dynamic_rate_limiter_v3"]
  priority_reservation_settings:
    saturation_threshold: 0.5
    model_limit_borrowing_config:
      borrow_idle_capacity: ["team"]
    saturation_check_cache_ttl: 2
```

#### Cap how far a caller borrows

While the model is idle, a borrowing team may use everything up to the model's own `tpm` and `rpm`, so one team can take most of the idle capacity on its own. To bound that, set `model_limit_max_borrow_multiple` in the team's metadata next to `model_tpm_limit` and `model_rpm_limit`. The same field goes in a key's metadata for the key's own limits and on a customer organization's `budget` for its limits. The team's usage on a model is then capped at its share times that multiple, for TPM and RPM alike, even while the model is idle. The cap runs on its own counter that counts everything the team used this window, idle or not, while the share counter still only counts what the team used once the model saturated, so a capped team gets its fresh share at saturation like any other.

```bash
curl -X POST 'http://0.0.0.0:4000/team/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "metadata": {
      "model_tpm_limit": {"my-model": 500},
      "model_limit_max_borrow_multiple": 2
    }
  }'
```

With this team at `model_tpm_limit: {"my-model": 500}` and a multiple of `2`, it can borrow up to 1000 tokens a minute on `my-model` while the model is below `saturation_threshold`. A request past that gets a 429 whose `rate_limited_by` header reads `model_per_team_max_borrow_multiple`, with a message that names the share, the multiple and the resulting cap. Once the model saturates, the team is held to its original 500 as before, with `rate_limited_by: model_per_team_saturated`. The multiple applies per team and per model, and a team's borrowing never counts against another team's cap. A key or a customer organization past its cap gets `model_per_key_max_borrow_multiple` or `model_per_customer_org_max_borrow_multiple`.

Leave it unset to keep the default, where the team borrows up to the model's limit. The value must be a number of at least `1`. A smaller or non-numeric value is logged as a warning and ignored, so the team behaves as if it were unset rather than every request failing. The multiple only matters for an entity type listed in `borrow_idle_capacity`. Without it, the `model_tpm_limit` and `model_rpm_limit` stay hard ceilings.

### Split a priority class share among active callers

By default every team in a priority class draws from one shared pool, so with `interactive: 0.6` on a `tpm: 1000` model all interactive teams together get 600 tokens a minute. One busy team can empty that pool and the other interactive teams get a 429 with nothing used, while the 400 reserved for an idle `batch` class sits unused. List `team` under `priority_class_share_config.split_equally_among_active` to split each class share among the teams that are actually using the model.

```yaml
litellm_settings:
  callbacks: ["dynamic_rate_limiter_v3"]
  priority_reservation:
    interactive: 0.6
    batch: 0.4
  priority_reservation_settings:
    saturation_threshold: 0.5
    priority_class_share_config:
      split_equally_among_active: ["team"]   # default: []
```

There is nothing to configure per team. A team becomes active on a model when it sends a request there and stops counting 60 seconds (one rate-limit window) after its last one. Active teams are tracked per model in Redis, so every worker sees the same set. Teams get their class from `metadata.priority` on the team or key as before, and teams with no priority form one `default` class weighted by `default_priority`.

The share is computed in two steps on every request. First, the class weights are renormalized over only the classes that have an active team on that model, so with no batch team sending, interactive is worth the whole model, and the moment a batch team sends it drops back to 0.6. Second, each class share is divided equally among that class's active teams. On a model with `tpm: 500000000`, two active interactive teams and four active batch teams get 150M each and 50M each. With only the four batch teams active, each gets 125M. A team that goes quiet for a window stops counting in both steps, so the others grow back.

Below `saturation_threshold` teams still borrow idle capacity as usual. Once the model saturates, each team's share counter starts fresh, so what a team used while the model was idle is not charged against its share. A team that then runs past its own share gets a 429 whose `rate_limited_by` header reads `priority_class_share_saturated` and whose message names the team, its class, how many teams are active in the class and the team's share in tokens or requests. A teammate that stayed within its share keeps going. When `team` is also listed in `borrow_idle_capacity`, a team's `model_tpm_limit` share applies as well and the tighter of the two wins.

The list also accepts `key`, `customer_organization` and `customer_member`, and each listed type gets its own slice the same way a team does. A customer organization's slice is counted across every key it calls through, and a customer member's slice is its own. The priority class always comes from `metadata.priority` on the key or team the request used. A request that matches several listed types counts under the most specific one, in the order `customer_member`, `customer_organization`, `team`, `key`. A request that matches none, such as a key with no team when only `team` is listed, is held to the shared class pool and still counts its class as active, so a class carrying only such traffic does not lend its share away.

```yaml
litellm_settings:
  callbacks: ["dynamic_rate_limiter_v3"]
  priority_reservation: {interactive: 0.6, batch: 0.4}
  priority_reservation_settings:
    saturation_threshold: 0.5
    priority_class_share_config:
      split_equally_among_active: ["team", "key", "customer_organization", "customer_member"]
```

### Prometheus metrics for shares and throttling

With the `prometheus` callback enabled next to `dynamic_rate_limiter_v3`, the limiter publishes what each team is entitled to on a model, how far it is running past that, and why it was refused. These series are enough to tell a team that is starved from one that is over its share, without reading proxy logs.

```yaml
litellm_settings:
  callbacks: ["dynamic_rate_limiter_v3", "prometheus"]
  priority_reservation_settings:
    saturation_threshold: 0.5
    model_limit_borrowing_config:
      borrow_idle_capacity: ["team"]
```

| Metric | Type | Meaning |
|--------|------|---------|
| `litellm_dynamic_limiter_share_tokens` | gauge | The team's token share of the model for the current window, as of the team's last settled request. This is the team's `model_tpm_limit`, or its slice of the priority class share when `team` is listed in `split_equally_among_active`, whichever is smaller. |
| `litellm_dynamic_limiter_borrowed_tokens` | gauge | Tokens the team has used above that share this window. `0` while the team is under its share. |
| `litellm_dynamic_limiter_throttled_total` | counter | Requests the limiter refused, by team, model and reason. |

The gauges carry `model_group`, `team`, `team_alias` and `priority`. The counter adds `rate_limit_type` (`tokens` or `requests`) and `reason`. The `reason` label is the value of the `rate_limited_by` header on the 429 the caller received, so a dashboard and a client log always agree. The values are `model_per_team_saturated` (the team is past its `model_tpm_limit` or `model_rpm_limit` and the model is saturated), `model_per_team_max_borrow_multiple` (the team hit its `model_limit_max_borrow_multiple` ceiling while borrowing) and `priority_class_share_saturated` (the team is past its slice of the class share and the model is saturated).

Both gauges are refreshed from actual usage when a request settles, successful or failed, so a team that stops sending keeps its last values until its next request settles. With several proxy workers the gauges aggregate with `livemostrecent`, so `/metrics` shows one series per team and model carrying the value the worker that settled the team's latest request wrote, and a new window's first settlement replaces the old window's value whichever worker handles it. A scrape of `/metrics` after team A ran past a 100 token share on a saturated model looks like this.

```
litellm_dynamic_limiter_share_tokens{model_group="my-model",priority="default",team="team-a",team_alias="analytics"} 100.0
litellm_dynamic_limiter_borrowed_tokens{model_group="my-model",priority="default",team="team-a",team_alias="analytics"} 260.0
litellm_dynamic_limiter_throttled_total{model_group="my-model",priority="default",rate_limit_type="tokens",reason="model_per_team_saturated",team="team-a",team_alias="analytics"} 4.0
```

A failure in the metrics sink is logged and never changes whether a request is admitted or refused.

### Demo Video

This video walks through setting up dynamic rate limiting with priority reservation and locust tests to validate the behavior.

<iframe width="840" height="500" src="https://www.loom.com/embed/1b54b93139ee415d959402cc0629f3f7
" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

## Fall back before the preferred model saturates

Some teams care which model answers them, others only care that something good answers quickly. Router fallbacks normally run after a request is refused, so a flexible team keeps using its preferred model until that model is full and a team that can only use that model shares the 429s. With `dynamic_rate_limiter_v3` enabled, a key or team can set `fallback_on_saturation` in its `router_settings` to walk its fallback list as soon as the requested model reaches `saturation_threshold`, while it still has room:

```bash
curl -X POST 'http://0.0.0.0:4000/team/new' \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "team_alias": "flexible-team",
    "models": ["luna", "opus"],
    "router_settings": {
      "fallbacks": [{"luna": ["opus"]}],
      "fallback_on_saturation": true
    }
  }'
```

When a key from that team asks for `luna`, the proxy reads the saturation the dynamic rate limiter already tracks for `luna` (the same value that flips priority reservation into strict mode). Below `saturation_threshold` the request goes to `luna` as usual. At or above it, the request takes the same path a request refused by a local rate limit takes: the proxy walks the `fallbacks` entry for `luna` in order and serves the first one that is itself below the threshold and admits the request. The fallback list is resolved Key > Team > Global, so a key or team without its own `fallbacks` walks the router's. Each fallback has to pass the checks every rate-limit fallback passes, so the caller has to be allowed to call it (see [Enforce Key Model Access on Fallbacks](./reliability.md#enforce-key-model-access-on-fallbacks)), its team member budget has to have room and it has to serve the endpoint of the request. When no fallback qualifies, the request goes back to `luna` and is admitted or rate limited there exactly as before, so the setting never turns a request `luna` could have served into a 429.

A request served by a fallback carries the usual fallback headers, with a reason that names saturation rather than a limit that refused the request:

```text
x-litellm-attempted-fallbacks: 1
x-litellm-fallback-reason: rate_limit:model_saturation_fallback
```

The request counts against the model that served it. Spend logs record `opus` with `opus` pricing and the request is charged to the `opus` rate limit, which leaves `luna` capacity for teams that want only `luna`. Keys and teams without `fallback_on_saturation` are untouched, and so are models the dynamic rate limiter does not cover. The threshold is the same `priority_reservation_settings.saturation_threshold` described above, and the saturation value is cached for `saturation_check_cache_ttl` seconds, so the walk can lag a sudden burst by up to that long.

## PTU share ceilings on Azure provisioned deployments

An Azure provisioned throughput (PTU) deployment split across teams with `model_info.ptu_shares` gets a per-team, per-minute ceiling without any `model_tpm_limit` worked out by hand. The proxy converts each team's share through the Azure sizing table it ships (input TPM per PTU and the output-to-input ratio for the model) and charges each request in Azure's normalized tokens, so the ceiling stays in step with the reservation when the shares change:

```yaml
model_list:
  - model_name: gpt-4.1-ptu
    litellm_params:
      model: azure/<your-deployment-name>
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE
    model_info:
      id: gpt-4.1-ptu-shared
      base_model: gpt-4.1
      ptu_count: 50
      cost_per_ptu_per_hour: 1.0
      ptu_effective_from: "2026-01-01T00:00:00Z"
      ptu_shares:
        <team a id>: 30
        <team b id>: 20
```

Team A's 30 PTUs of gpt-4.1 are 30 x 3,000 = 90,000 normalized tokens a minute (output counted at 4x), and the first request past that gets a 429 while team B keeps its own 20 PTUs:

```json
{
  "error": {
    "message": "Rate limit exceeded for model_per_team_ptu: <team a id>:gpt-4.1-ptu. Limit type: tokens. Current limit: 90000, Remaining: 0. Limit resets at: ...",
    "type": "throttling_error",
    "code": "429"
  }
}
```

The ceiling shares the per-minute window of a team's `model_tpm_limit` and needs only `LITELLM_ENABLE_PTU_COST_ATTRIBUTION=True`; the share filter itself (which teams the deployment is served to) applies without the flag. Setup, the cost split by share, and PTU-hours on the usage routes are covered in [Azure PTU Flat Cost Attribution](./ptu_flat_cost.md#share-a-deployment-across-teams)
