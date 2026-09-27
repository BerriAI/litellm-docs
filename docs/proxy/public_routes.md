import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Control Public & Private Routes

<EnterpriseFeature />

Control which routes require authentication and which routes are publicly accessible.

## Route Types

| Route Type | Requires Auth | Description |
|------------|---------------|-------------|
| `public_routes` | No | Routes accessible without any authentication |
| `admin_only_routes` | Yes (Admin only) | Routes only accessible by [Proxy Admin](./self_serve#available-roles) |
| `allowed_routes` | Yes | Exact-match list of routes exposed on the proxy. If not set, all routes are exposed |

## Quick Start

### Make Routes Public

Allow specific routes to be accessed without authentication:

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  public_routes: ["LiteLLMRoutes.public_routes", "/spend/calculate"]
```

### Restrict Routes to Admin Only

Restrict certain routes to only be accessible by Proxy Admin:

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  admin_only_routes: ["/key/generate", "/key/delete"]
```

### Limit Available Routes

Only expose specific routes on the proxy:

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  allowed_routes: ["/chat/completions", "/embeddings"]
```

`allowed_routes` is an exact-match list checked before the public route check, so route group names like `LiteLLMRoutes.public_routes` and wildcards are not expanded here. Any route not listed that goes through authentication, for example `/routes` or `/models`, returns `403 Route ... not allowed`. Unauthenticated endpoints such as `/health/liveliness` and `/health/readiness` are unaffected by `allowed_routes` and stay reachable. List every authenticated route that must stay reachable.

## Usage Examples

### Define Public, Admin Only, and Allowed Routes

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  public_routes: ["LiteLLMRoutes.public_routes", "/spend/calculate"]
  admin_only_routes: ["/key/generate"]
  allowed_routes: ["/chat/completions", "/spend/calculate"]
```

`LiteLLMRoutes.public_routes` in `public_routes` refers to the default public routes on LiteLLM, which stay public without being listed. [View the source](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/_types.py). It is not expanded in `allowed_routes`.

### Testing

<Tabs>

<TabItem value="public" label="Test public_routes">

```shell
curl --request POST \
  --url 'http://localhost:4000/spend/calculate' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hey, how'\''s it going?"}]
  }'
```

This endpoint works without an `Authorization` header.

</TabItem>

<TabItem value="admin_only_routes" label="Test admin_only_routes">

**Successful Request (Admin)**

```shell
curl --location 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <your-master-key>' \
--header 'Content-Type: application/json' \
--data '{}'
```

**Unsuccessful Request (Non-Admin)**

```shell
curl --location 'http://0.0.0.0:4000/key/generate' \
--header 'Authorization: Bearer <virtual-key-from-non-admin>' \
--header 'Content-Type: application/json' \
--data '{"user_role": "internal_user"}'
```

**Expected Response**

```json
{
  "error": {
    "message": "user not allowed to access this route. Route=/key/generate is an admin only route",
    "type": "auth_error",
    "param": "None",
    "code": "403"
  }
}
```

</TabItem>

<TabItem value="allowed_routes" label="Test allowed_routes">

**Successful Request**

```shell
curl http://localhost:4000/chat/completions \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-d '{
"model": "fake-openai-endpoint",
"messages": [
    {"role": "user", "content": "Hello, Claude"}
]
}'
```

**Unsuccessful Request (Route Not Allowed)**

```shell
curl --location 'http://0.0.0.0:4000/embeddings' \
--header 'Content-Type: application/json' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
--data '{
"model": "text-embedding-ada-002",
"input": ["write a litellm poem"]
}'
```

**Expected Response**

```json
{
  "error": {
    "message": "Route /embeddings not allowed",
    "type": "auth_error",
    "param": "None",
    "code": "403"
  }
}
```

</TabItem>

</Tabs>

## Advanced: Wildcard Patterns

Use wildcard patterns to match multiple routes at once.

### Syntax

| Pattern | Description | Example |
|---------|-------------|---------|
| `/path/*` | Matches any route starting with `/path/` | `/api/*` matches `/api/users`, `/api/users/123` |


### Examples

#### Make All Routes Under a Path Public

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  public_routes:
    - "LiteLLMRoutes.public_routes"
    - "/api/v1/*"      # All routes under /api/v1/
    - "/health/*"       # All health check routes
```

#### Admin Only Routes Do Not Support Wildcards

`admin_only_routes` is an exact-match list. A pattern like `/key/*` will not match anything, so list each route explicitly:

```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  admin_only_routes:
    - "/key/generate"
    - "/key/delete"
```

### Testing Wildcard Routes

**Config:**
```yaml
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  public_routes:
    - "/public/*"
```

**Test:**
```shell
# This works without auth (matches /public/*)
curl http://localhost:4000/public/status

# This also works without auth (matches /public/*)
curl http://localhost:4000/public/health/detailed

# This requires auth (doesn't match /public/*)
curl http://localhost:4000/private/data
```

