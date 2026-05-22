import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Memory Management

Store user preferences and feedback so your LLM remembers them across sessions. Scoped per user and team, with built-in access control.

**Requires:** LiteLLM `v1.83.10+` with PostgreSQL connected. No config changes needed.

### Create

<Tabs>
<TabItem value="curl" label="curl">

```shell
curl -X POST "http://localhost:4000/v1/memory" \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "user:preferences",
    "value": "Prefers concise responses. Timezone: PST.",
    "metadata": {"version": 1}
  }'
```

</TabItem>
<TabItem value="python" label="Python">

```python
import httpx

client = httpx.Client(
    base_url="http://localhost:4000",
    headers={"Authorization": "Bearer sk-1234"},
)

client.post("/v1/memory", json={
    "key": "user:preferences",
    "value": "Prefers concise responses. Timezone: PST.",
    "metadata": {"version": 1},
})
```

</TabItem>
</Tabs>

### Read

```shell
curl "http://localhost:4000/v1/memory/user:preferences" \
  -H "Authorization: Bearer sk-1234"
```

### Update

```shell
curl -X PUT "http://localhost:4000/v1/memory/user:preferences" \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"value": "Prefers concise responses. Timezone: EST."}'
```

### List

```shell
# All entries
curl "http://localhost:4000/v1/memory" \
  -H "Authorization: Bearer sk-1234"

# By prefix
curl "http://localhost:4000/v1/memory?key_prefix=user:" \
  -H "Authorization: Bearer sk-1234"
```

### Delete

```shell
curl -X DELETE "http://localhost:4000/v1/memory/user:preferences" \
  -H "Authorization: Bearer sk-1234"
```

## Access Control

Scoping is automatic based on the API key.

| Role | Reads | Writes |
|------|-------|--------|
| User | Own + team entries | Own entries only |
| Team admin | Own + team entries | Own + team entries |
| Proxy admin | All | All |

## Key Naming

Keys are globally unique. Use prefixes to namespace and query:

```
user:preferences           → per-user settings
team:playbook:onboarding   → shared team resources
agent:memory:scratchpad    → agent working memory
```

## Example: Per-user memory in a Slack bot

Partition memory by Slack workspace and user so each person's preferences are isolated.

**Key format:** `slack:{team_id}:{user_id}`

```python
import httpx

LITELLM_BASE = "http://localhost:4000"
LITELLM_KEY = "sk-1234"

def memory_key(team_id: str, user_id: str) -> str:
    return f"slack:{team_id}:{user_id}"

async def get_preferences(team_id: str, user_id: str) -> str:
    """Read saved preferences. Returns "" if none exist."""
    key = memory_key(team_id, user_id)
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{LITELLM_BASE}/v1/memory/{key}",
            headers={"Authorization": f"Bearer {LITELLM_KEY}"},
        )
    if r.status_code == 404:
        return ""
    return r.json().get("value", "")

async def save_preference(team_id: str, user_id: str, note: str):
    """Append a preference. PUT upserts — creates or updates."""
    key = memory_key(team_id, user_id)
    existing = await get_preferences(team_id, user_id)

    # Store as bullet list
    bullets = [b for b in existing.split("\n") if b.strip()]
    bullets.append(f"- {note}")
    
    async with httpx.AsyncClient() as client:
        await client.put(
            f"{LITELLM_BASE}/v1/memory/{key}",
            headers={"Authorization": f"Bearer {LITELLM_KEY}"},
            json={"value": "\n".join(bullets)},
        )
```

**Inject into your system prompt each turn:**

```python
prefs = await get_preferences(team_id, user_id)

messages = [
    {"role": "system", "content": f"""You are a helpful assistant.

SAVED USER PREFERENCES:
{prefs}

Follow these unless the current message contradicts them."""},
    {"role": "user", "content": user_message},
]
```

**Query all preferences for a workspace:**

```shell
curl "http://localhost:4000/v1/memory?key_prefix=slack:T024BE7LD:" \
  -H "Authorization: Bearer sk-1234"
```

## Metadata

Attach any JSON to an entry:

```json
{
  "key": "agent:findings",
  "value": "Q1 API usage up 15%...",
  "metadata": {"tags": ["research"], "confidence": 0.92}
}
```

## API Reference

Full request/response schemas, parameters, and error codes: [/memory endpoint reference](/docs/memory_management).
