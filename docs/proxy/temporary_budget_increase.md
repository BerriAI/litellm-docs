# ✨ Temporary Budget Increase

Set a temporary budget increase for a LiteLLM Virtual Key or a team member. Use this if you get asked to increase the budget for a key or a team member temporarily.


| Hierarchy | Supported | 
|-----------|-----------|
| LiteLLM Virtual Key | ✅ |
| Team Member | ✅ |
| User | ❌ |
| Team | ❌ |
| Organization | ❌ |

For a team member, send `temp_budget_increase` and `temp_budget_expiry` on `/team/member_update` or fill in the two fields when editing the member in the Admin UI (`v1.103.0` and later). See [Update a team member's budget](./users#update-a-team-members-budget). The steps below cover virtual keys.

<EnterpriseFeature feature="Temporary Budget Increase" />

1. Create a LiteLLM Virtual Key with budget

```bash
curl -L -X POST 'http://localhost:4000/key/generate' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer LITELLM_MASTER_KEY' \
-d '{
    "max_budget": 0.0000001
}'
```

Expected response:

```json
{
    "key": "sk-your-new-key"
}
```

2. Update key with temporary budget increase

```bash
curl -L -X POST 'http://localhost:4000/key/update' \
-H 'Authorization: Bearer LITELLM_MASTER_KEY' \
-H 'Content-Type: application/json' \
-d '{
    "key": "sk-your-new-key",
    "temp_budget_increase": 100, 
    "temp_budget_expiry": "2025-01-15"
}'
```

3. Test it! 

```bash
curl -L -X POST 'http://localhost:4000/chat/completions' \
-H 'Authorization: Bearer sk-your-new-key' \
-H 'Content-Type: application/json' \
-d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hello, world!"}]
}'
```

Expected Response Header:

```
x-litellm-key-max-budget: 100.0000001
```


