# 💸 GET Daily Spend, Usage Metrics

The `GET /daily_metrics` endpoint that this page used to describe has been removed from the proxy. Daily spend and usage is now served by `GET /user/daily/activity`, which returns per-day spend, token counts and request counts with a breakdown by model, model group, provider, endpoint, API key and MCP server. See the [Daily Spend Breakdown API](./cost_tracking#daily-spend-breakdown-api) section for the full response shape and the [Swagger reference](https://docs.litellm.ai/api-reference/#/Budget%20%26%20Spend%20Tracking/get_user_daily_activity_user_daily_activity_get) for all parameters.

## Request Format
```shell
curl -X GET "http://0.0.0.0:4000/user/daily/activity?start_date=2025-03-20&end_date=2025-03-27" \
  -H "Authorization: Bearer $LITELLM_API_KEY"
```

Optional query parameters: `model`, `api_key` and `user_id` filter the results (non-admin callers must pass their own `user_id`), `page` and `page_size` (default 50, max 1000) paginate them, and `timezone` (offset in minutes from UTC) with `include_current_utc_day` control how day buckets are aligned.

## Response format
```json
{
    "results": [
        {
            "date": "2025-03-27",
            "metrics": {
                "spend": 0.0177072,
                "prompt_tokens": 111,
                "completion_tokens": 1711,
                "total_tokens": 1822,
                "api_requests": 11,
                "successful_requests": 11,
                "failed_requests": 0
            },
            "breakdown": {
                "models": {"{{openai_small}}": {"metrics": {"spend": 1.82e-05, "...": "..."}, "metadata": {}}},
                "providers": {"openai": {"metrics": {"...": "..."}, "metadata": {}}},
                "api_keys": {"3126b6eaf1...": {"metrics": {"...": "..."}, "metadata": {"key_alias": "my-key", "team_id": null}}}
            }
        }
    ],
    "metadata": {
        "total_spend": 0.7274667,
        "total_prompt_tokens": 280990,
        "total_completion_tokens": 376674,
        "total_tokens": 657664,
        "total_api_requests": 14,
        "total_successful_requests": 14,
        "total_failed_requests": 0
    }
}
```

For individual request logs, use [`GET /spend/logs`](./cost_tracking#-spend-logs-api---individual-transaction-logs).
