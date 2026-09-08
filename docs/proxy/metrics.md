# 💸 GET Daily Spend, Usage Metrics

Use the `/global/spend/report` endpoint to get daily spend, grouped by team (default), `customer`, or `api_key`. `start_date` and `end_date` are required, and this endpoint requires an enterprise license. See [Generate Spend Reports](./cost_tracking.md#-enterprise-generate-spend-reports) for the other `group_by` options.

## Request Format
```shell
curl -X GET "http://0.0.0.0:4000/global/spend/report?start_date=2024-02-01&end_date=2024-02-02&group_by=team" -H "Authorization: Bearer sk-1234"
```

## Response format 
```json
[
    {
        "group_by_day": "2024-02-01T00:00:00+00:00",
        "teams": [
            {
                "team_name": "Prod Team",
                "total_spend": 0.0015265,
                "metadata": [
                    {
                        "model": "{{openai_large}}",
                        "spend": 0.00123,
                        "total_tokens": 28,
                        "api_key": "88dc28.."
                    },
                    {
                        "model": "{{openai_small}}",
                        "spend": 0.0002965,
                        "total_tokens": 85,
                        "api_key": "84dc28.."
                    }
                ]
            }
        ]
    }
]
```
