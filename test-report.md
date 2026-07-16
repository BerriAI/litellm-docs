# Independent e2e verification: LiteLLM PR #33555

Fix: remove dead user-cache lookup with None key in the spend-update path
(`litellm/proxy/db/db_spend_update_writer.py::_update_user_db`).
Branch: `litellm_remove_none_user_cache_lookup` (BerriAI/litellm)

- Repro confirmed: YES (merge-base 69a491e)
- Fix verified: YES (PR head 77d96b9, force-pushed head)

## How I tested

Live proxy on `localhost:4000` hitting real OpenAI `gpt-4o-mini`, with Postgres and Redis in
Docker, and the config from the task:

```yaml
litellm_settings:
  enable_redis_auth_cache: true
  success_callback: ["prometheus"]
  service_callback: ["prometheus_system"]
general_settings:
  master_key: sk-lit4411-master
  coordination_redis:
    host: localhost
    port: 6379
```

`prisma db push` was run first and `DISABLE_SCHEMA_UPDATE=true` was set. The `/metrics` endpoint
requires auth (Bearer master key) and 307-redirects, so it is queried with `curl -sL` and the
Authorization header.

The bug: with `enable_redis_auth_cache: true`, `user_api_key_cache` is Redis-backed.
`_update_user_db` opened with `await user_api_key_cache.async_get_cache(key=user_id)` where
`user_id` is `None` for any request served by a key with no user attached, so Redis raised
`redis.exceptions.DataError: Invalid input of type: 'NoneType'` on every such spend update and
incremented `litellm_redis_failed_requests_total`. The looked-up value was never used, so the PR
deletes the lookup.

## BEFORE (merge-base 69a491e) - bug reproduced

Generated a key with no user_id, sent 3 chat completions, then queried `/metrics`. Shell-only
step (not part of the recording). Result:

```
$ curl -sL http://localhost:4000/metrics -H "Authorization: Bearer sk-lit4411-master" | grep 'litellm_redis_failed_requests_total{'
litellm_redis_failed_requests_total{error_class="DataError",function_name="async_get_cache <- wrapper <- async_get_cache",redis="redis"} 3.0
```

3 requests produced 3 Redis DataError failures. Repro confirmed.

## AFTER (PR head 77d96b9) - fix verified

Recorded terminal demo. On the PR head, created the end user, generated a key with no user_id,
sent 3 plain chat completions plus 1 attributed to `some-end-user`, waited for the spend flush,
then checked `/metrics` and Postgres.

Requests all returned 200, key row has `user_id` NULL:

![after requests](/home/ubuntu/screenshots/ss_2c1ed77e.png)

Zero Redis DataError samples in `/metrics`, and spend landed in both tables:

![after metrics and psql](/home/ubuntu/screenshots/ss_81f01000.png)

- `/metrics`: no `litellm_redis_failed_requests_total` samples (zero Redis failures)
- `LiteLLM_VerificationToken`: key row `user_id` NULL, spend 1.2e-05 (4 requests billed)
- `LiteLLM_EndUserTable`: `some-end-user` spend 3e-06

## Assertions

- BEFORE: `litellm_redis_failed_requests_total{error_class="DataError"}` present and equal to the
  number of requests (3.0) - PASSED
- AFTER: key with no user_id, 4 real completions all HTTP 200 - PASSED
- AFTER: `/metrics` has zero `litellm_redis_failed_requests_total` samples - PASSED
- AFTER: spend updated in Postgres for the key row (user_id NULL) and the end user - PASSED

## Notes

- The PR branch was force-pushed mid-verification (old head 07e84fe replaced by 77d96b9 for a
  test-isolation fix). The production diff in `db_spend_update_writer.py` is identical between the
  two heads; the after-demo was re-run and re-recorded on 77d96b9.
- CI on the PR was green at verification time (107 passed, benchmarks pending only).
