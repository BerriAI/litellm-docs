-- Run as the database owner. Point Hex at a replica when traffic is high.
CREATE SCHEMA IF NOT EXISTS litellm_analytics;
CREATE OR REPLACE VIEW litellm_analytics.spend_daily_v1
WITH (security_barrier = true) AS
SELECT
  "startTime"::date AS day,
  COALESCE(NULLIF(metadata->>'user_api_key_project_id', ''),
           NULLIF(metadata->>'project_id', ''), '(unassigned)') AS project_id,
  COALESCE(NULLIF(team_id, ''), '(unassigned)') AS team_id,
  COALESCE(NULLIF(model_group, ''), NULLIF(model, ''), '(unassigned)') AS model,
  COUNT(*) AS requests,
  SUM(spend) AS spend_usd,
  COUNT(*) FILTER (WHERE spend IS NULL) AS unknown_cost_requests,
  SUM(total_tokens) AS tokens,
  COUNT(*) FILTER (WHERE status = 'failure') AS failures,
  COUNT(*) FILTER (WHERE status IS NULL OR status NOT IN ('success', 'failure')) AS unknown_status_requests,
  COUNT(*) FILTER (WHERE lower(cache_hit) = 'true') AS response_cache_hits,
  COUNT(*) FILTER (WHERE lower(cache_hit) IN ('true', 'false')) AS response_cache_known,
  SUM(EXTRACT(EPOCH FROM ("endTime" - "startTime")))
    FILTER (WHERE "endTime" >= "startTime") AS latency_seconds_sum,
  COUNT(*) FILTER (WHERE "endTime" >= "startTime") AS latency_count,
  SUM(EXTRACT(EPOCH FROM ("completionStartTime" - "startTime")))
    FILTER (WHERE "completionStartTime" BETWEEN "startTime" AND "endTime") AS ttft_seconds_sum,
  COUNT(*) FILTER (WHERE "completionStartTime" BETWEEN "startTime" AND "endTime") AS ttft_count
FROM public."LiteLLM_SpendLogs"
WHERE "startTime" >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '60 days'
  AND "startTime" < date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
GROUP BY 1, 2, 3, 4;

-- Grant these to a dedicated existing login. Do not grant the source table.
-- Replace hex_reader with the role your database administrator provisions.
GRANT USAGE ON SCHEMA litellm_analytics TO hex_reader;
GRANT SELECT ON litellm_analytics.spend_daily_v1 TO hex_reader;
