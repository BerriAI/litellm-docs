
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
  master_key: sk-1234 # OR set `LITELLM_MASTER_KEY=".."` in your .env
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

key_1 = create_key(api_key="sk-1234", base_url="http://0.0.0.0:4000")
key_2 = create_key(api_key="sk-1234", base_url="http://0.0.0.0:4000")

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
  master_key: sk-1234 # OR set `LITELLM_MASTER_KEY=".."` in your .env
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
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
  "team_alias": "production-team",
  "metadata": {"priority": "prod"}
}'
```

Create a key for this team:
```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H 'Authorization: Bearer sk-1234' \
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
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
  "metadata": {"priority": "prod"}
}'
```

**Development Key:**
```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H 'Authorization: Bearer sk-1234' \
-H 'Content-Type: application/json' \
-d '{
  "metadata": {"priority": "dev"}
}'
```

**Key Without Priority (uses default_priority weight):**
```bash
curl -X POST 'http://0.0.0.0:4000/key/generate' \
-H 'Authorization: Bearer sk-1234' \
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

### Demo Video

This video walks through setting up dynamic rate limiting with priority reservation and locust tests to validate the behavior.

<iframe width="840" height="500" src="https://www.loom.com/embed/1b54b93139ee415d959402cc0629f3f7
" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

