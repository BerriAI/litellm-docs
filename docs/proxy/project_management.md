# [Beta] Project Management

<EnterpriseFeature />

Projects in LiteLLM sit between teams and keys in the organizational hierarchy, enabling fine-grained access control and budget management for specific use cases or applications.

```mermaid
graph TD
    A[Organization] --> B[Team 1]
    A --> C[Team 2]
    B --> D[Project A]
    B --> E[Project B]
    C --> F[Project C]
    D --> G[API Key 1]
    D --> H[API Key 2]
    E --> I[API Key 3]
    F --> J[API Key 4]
    
    style A fill:#e1f5ff
    style B fill:#fff4e6
    style C fill:#fff4e6
    style D fill:#f3e5f5
    style E fill:#f3e5f5
    style F fill:#f3e5f5
    style G fill:#e8f5e9
    style H fill:#e8f5e9
    style I fill:#e8f5e9
    style J fill:#e8f5e9
```

**Hierarchy**: `Organizations > Teams > Projects > Keys`

## Quick Start

This walkthrough shows how to create a project, generate an API key, make requests, and view project-level spend tracking in the UI.

### Step 1: Create a Project

```bash showLineNumbers
curl --location 'http://0.0.0.0:4000/project/new' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--header 'Content-Type: application/json' \
--data '{
    "project_alias": "flight-search-assistant",
    "team_id": "ad898803-c8a3-4f4a-976a-a3c372cffa45",
    "models": ["{{openai_large}}", "{{openai_small}}"],
    "max_budget": 100,
    "metadata": {
        "use_case_id": "SNOW-12345",
        "responsible_ai_id": "RAI-67890"
    }
}' | jq
```

**Response:**
```json
{
  "project_id": "e402a141-725a-4437-bff5-d47459189716",
  "project_alias": "flight-search-assistant",
  "team_id": "ad898803-c8a3-4f4a-976a-a3c372cffa45",
  "models": ["{{openai_large}}", "{{openai_small}}"],
  "max_budget": 100,
  ...
}
```

### Step 2: Generate API Key for Project

```bash showLineNumbers
curl 'http://0.0.0.0:4000/key/generate' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
    "models": ["{{openai_small}}", "{{openai_large}}"],
    "metadata": {"user": "ishaan@berri.ai"},
    "project_id": "e402a141-725a-4437-bff5-d47459189716"
}' | jq
```

**Response:**
```json
{
  "key": "sk-W8VbscpfuyvHm5TkxRYiXA",
  "key_name": "sk-...YiXA",
  "project_id": "e402a141-725a-4437-bff5-d47459189716",
  ...
}
```

### Step 3: Use API Key in Chat Completions

```bash showLineNumbers
curl http://localhost:4000/v1/chat/completions \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer sk-W8VbscpfuyvHm5TkxRYiXA' \
--data '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "What is litellm?"}]
}' | jq
```

### Step 4: View Project Spend in UI

Navigate to the **Logs** page in the LiteLLM Admin UI. You'll see the `user_api_key_project_id` tracked in the request metadata:

![Project Spend Tracking](/img/project_spend.png)

As shown above, the spend logs metadata includes:
- `"user_api_key_project_id": "e402a141-725a-4437-bff5-d47459189716"` - Links the request to your project
- All costs and token usage are automatically attributed to the project
- You can query and filter logs by project ID for detailed reporting

## API Endpoints

### POST /project/new

Create a new project.

**Who can call**: Admins or Team Admins

**Parameters**:
- `project_alias` (string, optional): Human-readable name for the project
- `team_id` (string, required): The team this project belongs to
- `models` (array, optional): List of models the project can access
- `max_budget` (float, optional): Maximum spend budget for the project
- `tpm_limit` (int, optional): Tokens per minute limit
- `rpm_limit` (int, optional): Requests per minute limit
- `budget_duration` (string, optional): Budget reset period (e.g., "30d", "1mo")
- `metadata` (object, optional): Custom metadata for the project
- `blocked` (boolean, optional): Block all API calls for this project

**Example**:

```bash
curl --location 'http://0.0.0.0:4000/project/new' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--header 'Content-Type: application/json' \
--data '{
    "project_alias": "hotel-recommendations",
    "team_id": "team-123",
    "models": ["{{anthropic}}"],
    "max_budget": 200,
    "tpm_limit": 100000,
    "metadata": {
        "use_case_id": "SNOW-12346",
        "cost_center": "travel-products"
    }
}'
```

**Response**:

```json
{
    "project_id": "project-def",
    "project_alias": "hotel-recommendations",
    "team_id": "team-123",
    "models": ["{{anthropic}}"],
    "spend": 0.0,
    "budget_id": "budget-xyz",
    "metadata": {
        "use_case_id": "SNOW-12346",
        "cost_center": "travel-products"
    },
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
}
```

### POST /project/update

Update an existing project.

**Who can call**: Admins or Team Admins

**Parameters**:
- `project_id` (string, required): The project to update
- `project_alias` (string, optional): Updated project name
- `team_id` (string, optional): Move project to different team
- `models` (array, optional): Updated list of allowed models
- `max_budget` (float, optional): Updated budget
- `tpm_limit` (int, optional): Updated TPM limit
- `rpm_limit` (int, optional): Updated RPM limit
- `metadata` (object, optional): Updated metadata
- `blocked` (boolean, optional): Updated blocked status

**Example**:

```bash
curl --location 'http://0.0.0.0:4000/project/update' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--header 'Content-Type: application/json' \
--data '{
    "project_id": "project-abc",
    "max_budget": 200,
    "tpm_limit": 200000,
    "metadata": {
        "status": "production"
    }
}'
```

### GET /project/info

Get information about a specific project.

**Parameters**:
- `project_id` (string, required): Query parameter

**Example**:

```bash
curl --location 'http://0.0.0.0:4000/project/info?project_id=project-abc' \
--header "Authorization: Bearer $LITELLM_API_KEY"
```

**Response**:

```json
{
    "project_id": "project-abc",
    "project_alias": "flight-search-assistant",
    "team_id": "team-123",
    "models": ["{{openai_large}}", "{{openai_small}}"],
    "spend": 45.67,
    "model_spend": {
        "{{openai_large}}": 42.30,
        "{{openai_small}}": 3.37
    },
    "litellm_budget_table": {
        "budget_id": "budget-xyz",
        "max_budget": 100.0,
        "tpm_limit": 100000,
        "rpm_limit": 100
    },
    "metadata": {
        "use_case_id": "SNOW-12345"
    }
}
```

### GET /project/list

List all projects the user has access to.

**Example**:

```bash
curl --location 'http://0.0.0.0:4000/project/list' \
--header "Authorization: Bearer $LITELLM_API_KEY"
```

**Response**:

```json
[
    {
        "project_id": "project-abc",
        "project_alias": "flight-search-assistant",
        "team_id": "team-123",
        "spend": 45.67
    },
    {
        "project_id": "project-def",
        "project_alias": "hotel-recommendations",
        "team_id": "team-123",
        "spend": 23.45
    }
]
```

### DELETE /project/delete

Delete one or more projects.

**Who can call**: Admins only

**Parameters**:
- `project_ids` (array, required): List of project IDs to delete

**Example**:

```bash
curl --location --request DELETE 'http://0.0.0.0:4000/project/delete' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--header 'Content-Type: application/json' \
--data '{
    "project_ids": ["project-abc", "project-def"]
}'
```

**Note**: Projects with associated API keys cannot be deleted. Delete or reassign the keys first.

## Model-Specific Quotas

You can set different quotas for different models within a project:

```bash
curl --location 'http://0.0.0.0:4000/project/new' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--header 'Content-Type: application/json' \
--data '{
    "project_alias": "multi-model-project",
    "team_id": "team-123",
    "models": ["{{openai_large}}", "{{openai_small}}", "{{anthropic}}"],
    "max_budget": 500,
    "metadata": {
        "model_tpm_limit": {
            "{{openai_large}}": 50000,
            "{{openai_small}}": 200000,
            "{{anthropic}}": 100000
        },
        "model_rpm_limit": {
            "{{openai_large}}": 50,
            "{{openai_small}}": 500,
            "{{anthropic}}": 100
        }
    }
}'
```

### Require quotas on project models

Quotas are optional by default, so a project can be created with some models limited and others unbounded. Set `enforce_project_model_quota` in `general_settings` to require them <SinceVersion v="1.100.0" />.

```yaml
general_settings:
  enforce_project_model_quota: true
```

With `true`, `POST /project/new` and `POST /project/update` answer `400` unless every model on the project has a positive `model_rpm_limit` and `model_tpm_limit`, and the error names each model with the limits it is missing. Projects that list `all-proxy-models`, a wildcard such as `azure/*`, or a model access group are rejected while the setting is on, because those expand to several models at request time and the rate limiter looks quotas up by the exact model name. This applies to the mapping form below too, even when the mapping exempts that provider. List the concrete model names instead.

The check covers the models a project lists, so a project with an empty `models` list passes it. That project is not limited to any models either, so its keys can call every model the key and its team allow, with no project quota on any of them. Give each project a `models` list when every project has to be capped.

An update is checked against the project as it will look after the change. A request that leaves out `models` keeps the stored list, but the limits work differently. The project keeps them in its `metadata`, and an update that sends `metadata`, `tags`, `guardrails`, `policies`, `model_rpm_limit`, `model_tpm_limit`, or any other field stored in `metadata` replaces the project's whole `metadata` with what that request carries. So that update is checked only against the limits it sends, and it answers `400` unless it repeats every limit the project's models need, even when it only changes the tags. Once it passes, every limit, tag, guardrail, and other `metadata` key it left out is removed from the project, so send the full set each time. An update that sends none of those fields, such as one that only changes the description, is checked against the stored limits. So once the setting is on, it answers `400` on a project that is missing a limit until an update sets that limit.

### Per-provider and per-model requirements

<SinceVersion v="1.109.0" />

Some models do not need an rpm or tpm limit, such as a video generation model or a pass-through name. Instead of `true`, give the setting a mapping that says which limits each provider and model needs:

```yaml
general_settings:
  enforce_project_model_quota:
    default: [rpm, tpm]
    providers:
      vertex_ai: [rpm, tpm]
      runwayml: []
    models:
      "veo-*": [rpm]
      my-passthrough-model: []
```

Each entry lists the limits it requires: `[rpm, tpm]`, `[rpm]`, `[tpm]`, or `[]`. An entry replaces the whole requirement, so `[]` exempts that provider or model and `[rpm]` drops the `tpm` requirement. `default` applies wherever no other entry decides, and it is `[rpm, tpm]` when left out, so a mapping that only lists exemptions still requires both limits on every other model. With the config above, a project can list a Runway model and `my-passthrough-model` with no limits, a model whose name starts with `veo-` with only `model_rpm_limit`, and a Gemini model on Vertex AI with both.

For each model on the project, the first of these that applies decides:

1. The entry under `models` with the model's exact name.
2. The most specific `*` pattern under `models` that matches the name from its start, ranked the same way the router ranks its wildcard routes.
3. The entries under `providers` for the providers of the deployments the name routes to, aliases, routing groups, and the wildcard route a request would use included. A name served by more than one provider needs every limit any of them requires.
4. `default`, which also covers a name that no deployment serves.

A provider is the deployment's LiteLLM provider id. That is the `custom_llm_provider` it sets, else the prefix of its `litellm_params.model` (`vertex_ai` in `vertex_ai/gemini-3.8-flash`), else the provider behind a known OpenAI-compatible `api_base` (`groq` for `gpt-4o` with `https://api.groq.com/openai/v1`), else the provider LiteLLM infers from the model name (`vertex_ai` for a bare `gemini-2.5-flash`). A name a team model serves is matched against `models` entries by the model each team deployment calls, its `litellm_params.model` without the provider prefix, rather than by the public name its team admin picked, so naming a team model after an exempt entry does not exempt it. The team admin picks the called model too, so an exempt entry under `models` also exempts a team model that calls a model of that name, whatever its provider. A limit that is set still has to be positive, even on an exempt model, so a `0` or negative value answers `400` as before.

While a policy exempts any provider or model, a team model add, update, or delete re-checks the team's projects that list a name the change serves. It answers `400` naming those projects when the change makes that name need a limit they do not set, such as moving it from an exempt provider to one that needs limits, so set the limits on the projects first and then change the model. A delete that leaves no deployment serving the name is not re-checked, since nothing can call that name anymore, but each project that lists it then answers `400` on its next update until it removes the name or sets its limits. Only team model writes re-check projects. A shared model added or changed through the API or `config.yaml`, or an edit to the policy, can leave a project short of a limit without an error, and that project's next update then answers `400` until it sets the limit.

Every value the boolean setting accepted keeps its meaning. Anything falsy is off, and any other value requires both limits on every model. That includes the strings `"true"` and `"false"` and a mapping such as `{enabled: false}`, so turn the check off with `false` or by removing the key. Only a mapping that names `default`, `providers`, or `models` is read as a policy. A policy with an unknown key next to those three, a limit other than `rpm` or `tpm`, or a provider id LiteLLM does not know makes project create and update, and every team model add, update, and delete, answer `500` with an error naming `general_settings.enforce_project_model_quota`, instead of turning the check off. Model names under `models` are not checked against the model list, since an entry may name a model before anyone adds it, so a misspelled name is ignored and that model falls back to its providers.
