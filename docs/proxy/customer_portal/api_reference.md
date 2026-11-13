---
title: API reference
sidebar_label: API reference
description: Manage customer organizations, teams, members, budget templates, and usage through the Customer Portal API.
---

# API reference

Use these APIs from your backend to import customers, set budgets, and return usage to your product. For a complete integration, follow [Track customer spend](./track-customer-spend.md).

The management base path is `/management/v1`. Customer organizations, teams, and members are separate from LiteLLM's internal organizations, teams, users, and `/customer` end-user records.

{/* keep-version-note: The reference describes verified main-branch contracts. A published release containing this complete surface has not been verified. */}

## Availability

The management and usage routes below are on `main`. Check your gateway's `/openapi.json` and apply its customer migrations. A published release containing the complete integration has not been verified.

| Capability | Required change |
| --- | --- |
| Organization, team, member, template, and usage APIs | On `main`; members use `budget_id`. |
| Identity headers, first-request member registration, and hierarchy budget checks | On `main`, including [#51546](https://github.com/BerriAI/litellm/pull/51546). |
| Fresh shared customer spend counters | On `main`, including [#51568](https://github.com/BerriAI/litellm/pull/51568). |
| Member email field and email identity header | Preview: [#51617](https://github.com/BerriAI/litellm/pull/51617). |
| Customer identity fields in request logs | On `main`, including [#51596](https://github.com/BerriAI/litellm/pull/51596). |
| Customer budget events and webhook callback | On `main`, including [#51579](https://github.com/BerriAI/litellm/pull/51579) and the recurring-period, member-event, and team-override fixes in [#51645](https://github.com/BerriAI/litellm/pull/51645). |
| Native upserts and first-request organization creation | Under review in [#51607](https://github.com/BerriAI/litellm/pull/51607); not documented as a supported contract. |
| Fail-open customer identity handling | Under review in [#51604](https://github.com/BerriAI/litellm/pull/51604); configuration and asserted-identity logging remain unverified. |

Preview features require a build containing the linked change while it remains unmerged.

Free-tier support limits the customer portal to 5 organizations, 5 teams per organization, and 5 members per team without Enterprise. Check `/openapi.json` for `/management/v1/customer_portal/limits` to confirm your build includes it.

## Authentication and conventions

Send `Authorization: Bearer $LITELLM_ADMIN_KEY` on management requests. These routes require `proxy_admin`, including list, retrieve, and usage requests. Keep this key on your server and authorize the customer before returning data to your application.

Examples use `LITELLM_BASE_URL` for your gateway's base URL, without `/v1` or `/ui`. They use `curl` from your terminal.

```bash
export LITELLM_BASE_URL="http://localhost:4000"
export END_DATE="$(date -u +%Y-%m-%d)"
export START_DATE="$END_DATE"
```

Usage examples query today in UTC. Set `START_DATE` to an earlier `YYYY-MM-DD` value for a longer range.

Set `LITELLM_ADMIN_KEY` through your secret store or existing terminal environment. Send JSON bodies with `Content-Type: application/json`.

Create parents before children. IDs identify records across the gateway, so use a customer prefix such as `acme-support`. Omit a resource ID to let LiteLLM generate one. URL-encode IDs in paths. Use IDs without commas when you query usage through comma-separated filters.

Creation returns `201`. Retrieval and updates return `200` with a resource object at the top level. Deletion returns `204` with no body. Resource lists return `data`, `meta`, and `links`; usage reads return `results` and `metadata`.

### Retry a customer import

A repeated `POST` with an existing ID returns `409`; it does not update the record. After a timeout or `409`, retrieve that ID, compare its parent and settings with your application, then use `PATCH` for the required changes. Omit unchanged fields in a patch. An explicit `null` clears a nullable field where the resource permits it.

## Budget object

Organizations and teams accept `budget`. Members inherit a template through `budget_id` and accept `budget_override` for their own settings.

| Field | Type and default | Meaning |
| --- | --- | --- |
| `max_budget` | Number or `null`; default `null` | Spend cap in USD. Must be finite and at least `0`. |
| `soft_budget` | Number or `null`; default `null` | Soft threshold in USD, finite and at least `0`. This value does not block requests. Notifications require the [customer budget callback](#customer-budget-events). |
| `rpm_limit` | Integer or `null`; default `null` | Requests per minute. Must be at least `0`. |
| `tpm_limit` | Integer or `null`; default `null` | Tokens per minute. Must be at least `0`. |
| `allowed_models` | Array of strings or `null`; default `null` | Allowed gateway model names. A non-empty member override replaces the inherited list. An empty override list inherits the template's list. |
| `budget_duration` | String or `null`; default `null` | Reset interval, for example `"1h"`, `"24h"`, `"7d"`, or `"30d"`. Must resolve to a positive duration. |
| `model_rpm_limit` | Object or `null`; default `null` | Model name to non-negative requests-per-minute limit. |
| `model_tpm_limit` | Object or `null`; default `null` | Model name to non-negative tokens-per-minute limit. |
| `budget_limits` | Array or `null`; default `null` | Extra spend caps, each with `budget_duration` set to `"1mo"` or `"12mo"` and a `max_budget`. Each window resets on its own and blocks requests when reached. |
| `cap_policy` | `"pause_until_reset"`, `"pause_allow_increase"`, or `null`; default `null` | What a member can do at its cap. `null` and `"pause_until_reset"` wait for the reset. `"pause_allow_increase"` lets the member [request a temporary increase](#budget-increase-requests). |

With customer identity headers, LiteLLM checks the organization, team, and member budgets before inference. A scope at or above `max_budget` causes a budget error; the organization takes precedence over the team and member. LiteLLM also checks each scope's model access and rate limits. Requests without these headers do not enter this hierarchy enforcement path.

Builds preceding the [shared customer spend counter fix](https://github.com/BerriAI/litellm/pull/51568) can use cached hierarchy spend until refresh. Use a build containing that change. Allow for requests already in flight and background accounting when you display balances.

The reset job updates `budget_reset_at` and the resource's running `spend` counter for a configured duration. Read the returned timestamp; use the usage APIs for historical dates. Budget resets do not erase historical daily usage.

### Common response fields

Each organization, team, and member includes these fields in addition to its resource-specific fields.

| Field | Type | Meaning |
| --- | --- | --- |
| `alias` | String or `null` | Display name. |
| `spend` | Number; initial value `0` | Recorded budget spend in USD. Accounting updates this value in the background. |
| `budget_reset_at` | Datetime or `null` | Next recorded reset time. |
| `created_at`, `updated_at` | Datetime | Creation and last-update timestamps. |
| `created_by`, `updated_by` | String | Actor recorded for each write. |

## Customer portal limits

`GET /management/v1/customer_portal/limits` requires a proxy admin key and returns `200` with current customer portal capacity. It accepts no query parameters or request body.

```bash
curl "$LITELLM_BASE_URL/management/v1/customer_portal/limits" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY"
```

| Response field | Type | Meaning |
| --- | --- | --- |
| `limits_apply` | Boolean | `true` without a LiteLLM Enterprise license. |
| `organization_limit` | Integer | Free-tier organization limit, `5`. |
| `teams_per_organization_limit` | Integer | Free-tier teams per organization, `5`. Includes the auto-created `default` team. |
| `members_per_team_limit` | Integer | Free-tier members per team, `5`. A member counts toward every team in its `parent_team_ids`. |
| `organization_count` | Integer | Total registered customer organizations. |
| `any_limit_reached` | Boolean | `true` when limits apply and the organization count is at least 5, any organization has at least 5 teams, or any team has at least 5 members. Always `false` with Enterprise. |

```json title="Free-tier deployment at the organization limit"
{
  "limits_apply": true,
  "organization_limit": 5,
  "teams_per_organization_limit": 5,
  "members_per_team_limit": 5,
  "organization_count": 5,
  "any_limit_reached": true
}
```

Enterprise removes the limits. The numeric fields still report the free-tier thresholds when `limits_apply` is `false`. See [free-tier behavior](./track-customer-spend.md#free-tier-limits) for request tracking at capacity and after a license lapses.

## Customer organizations

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/management/v1/customer_organizations` | `201`, organization. |
| `GET` | `/management/v1/customer_organizations` | `200`, organization list. Supports `q`. |
| `GET` | `/management/v1/customer_organizations/{customer_org_id}` | `200`, organization. |
| `PATCH` | `/management/v1/customer_organizations/{customer_org_id}` | `200`, updated organization. |
| `DELETE` | `/management/v1/customer_organizations/{customer_org_id}` | `204`. Delete its teams first. |

### Request fields

| Field | Create | Update | Meaning |
| --- | --- | --- | --- |
| `customer_org_id` | Optional, generated when omitted | Not accepted | Stable organization ID. |
| `alias` | Optional, default `null` | Optional; `null` clears it | Display name and value used by `x-litellm-customer-org-alias`. Use a unique alias for header lookup. |
| `budget` | Optional, default `null` | Optional; `null` removes the overall budget | Organization [budget object](#budget-object). |
| `default_budgets` | Optional, default `[]` | Not accepted | Named member templates. A single template becomes the default; with several, select one by name through `default_budget_template`. |
| `default_budget_template` | Optional, default `null` | Not accepted | Name from `default_budgets` to use for new members. Required when creating several templates. |
| `default_budget_template_id` | Not accepted | Optional; `null` clears the default | Template ID from this organization's `default_budgets`. Changes the default for new members. |

| Additional response field | Type | Meaning |
| --- | --- | --- |
| `customer_org_id` | String | Organization ID. |
| `budget_id` | String or `null` | Organization's own budget record. |
| `budget` | Budget object or `null` | Organization's overall limits. |
| `member_count` | Integer | Registered members across the organization's teams. |
| `default_budget_template_id` | String or `null` | Default member template ID. |
| `default_budgets` | Array | Member templates, each with budget fields plus `budget_id` and `name`. Compare `budget_id` with `default_budget_template_id` to identify the default. |

```bash title="Create an organization with a default member template"
curl --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_organizations" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "customer_org_id": "org-acme",
    "alias": "Acme",
    "budget": {
      "max_budget": 1000,
      "budget_duration": "30d"
    },
    "default_budgets": [
      {
        "name": "standard",
        "max_budget": 50,
        "budget_duration": "30d"
      }
    ],
    "default_budget_template": "standard"
  }'
```

## Customer teams

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/management/v1/customer_teams` | `201`, team. |
| `GET` | `/management/v1/customer_teams` | `200`, team list. Supports `parent_org_id`. |
| `GET` | `/management/v1/customer_teams/{customer_team_id}` | `200`, team. |
| `PATCH` | `/management/v1/customer_teams/{customer_team_id}` | `200`, updated team. |
| `DELETE` | `/management/v1/customer_teams/{customer_team_id}` | `204`. Delete its members first. |

| Request field | Create | Update | Meaning |
| --- | --- | --- | --- |
| `customer_team_id` | Optional, generated when omitted | Not accepted | Stable team ID. |
| `parent_org_id` | Required | Not accepted | Existing customer organization ID. |
| `alias` | Optional, default `null` | Optional; `null` clears it | Display name. |
| `budget` | Optional, default `null` | Optional; `null` removes it | Team [budget object](#budget-object). |
| `budget_override` | Optional, default `null` | Optional; `null` removes it | Team [budget fields](#budget-object) that override `budget`. |
| `budget_override_expires_at` | Optional, default `null` | Optional; `null` removes expiry | Timestamp with a timezone. After expiry, the team uses `budget`. |

| Additional response field | Type | Meaning |
| --- | --- | --- |
| `customer_team_id`, `parent_org_id` | String | Team ID and its customer organization ID. |
| `budget_id` | String or `null` | Team's own budget record. |
| `budget` | Budget object or `null` | Team limits. An absent team budget does not remove organization or member limits. |
| `budget_override_id`, `budget_override`, `budget_override_expires_at` | String, budget object, and datetime, each nullable | Stored team override and its expiry. |
| `effective_budget` | Budget object | Team budget plus its active override. |

```bash title="Create a customer team"
curl --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_teams" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "customer_team_id": "acme-support",
    "parent_org_id": "org-acme",
    "alias": "Support",
    "budget": {
      "max_budget": 250,
      "budget_duration": "30d"
    }
  }'
```

## Customer members

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/management/v1/customer_members` | `201`, member. One member per request. |
| `GET` | `/management/v1/customer_members` | `200`, member list. Supports `parent_team_id`. |
| `GET` | `/management/v1/customer_members/{customer_member_id}` | `200`, member with its effective budget. |
| `PATCH` | `/management/v1/customer_members/{customer_member_id}` | `200`, updated member. |
| `DELETE` | `/management/v1/customer_members/{customer_member_id}` | `204`. Removes its owned override budget. |

| Request field | Create | Update | Meaning |
| --- | --- | --- | --- |
| `customer_member_id` | Optional, generated when omitted | Not accepted | Stable member ID. |
| `parent_team_ids` | Required, non-empty array | Not accepted | Existing customer team IDs from one customer organization. The first team is the member's default team. |
| `parent_org_id` | Optional | Not accepted | Customer organization ID. When set, it must match the teams' organization. |
| `email` | Optional, default `null`; preview #51617 | Optional; `null` clears it; preview #51617 | String of 1–254 characters after trimming and lowercasing. Unique within the customer organization. |
| `alias` | Optional, default `null` | Optional; `null` clears it | Display name. |
| `budget_id` | Optional; omitted or `null` uses the organization's default template | Optional; `null` detaches the template | Member template ID from the same customer organization. |
| `budget_override` | Optional, default `null` | Optional; `null` removes it | Member [budget fields](#budget-object) that override the template. |
| `budget_override_expires_at` | Optional, default `null` | Optional; `null` removes expiry | Timestamp with a timezone. After expiry, the member uses its template's settings. |

Use `budget_id` for the selected member template. The current API rejects the old `budget_template_id` field. The response's `budget_override_id` identifies the separate override record; it is read-only.

A member needs a selected template or `budget_override`. LiteLLM merges non-null override fields with the template. A non-empty `allowed_models` override replaces inherited models. Read `effective_budget` to display the settings that apply now, including override expiry.

```bash title="Create a member using the organization's default template"
curl --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_members" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "customer_member_id": "acme-alice",
    "parent_team_ids": ["acme-support"],
    "alias": "Alice"
  }'
```

| Additional response field | Type | Meaning |
| --- | --- | --- |
| `customer_member_id`, `parent_org_id` | String | Member ID and its customer organization ID. |
| `parent_team_ids` | Array of strings | Member's customer teams, default team first. |
| `email` | String or `null`; preview #51617 | Normalized email, when the build includes member email support. |
| `budget_id` | String or `null` | Selected organization template. |
| `budget_override_id` | String or `null` | Owned override record. |
| `budget_override` | Budget object or `null` | Stored override, including an override that has expired. |
| `budget_override_expires_at` | Datetime or `null` | Stored override expiry. |
| `effective_budget` | Budget object | Template plus active overrides. |

:::info Member email requires #51617

Main uses `customer_member_id` for member identity. Sending an email string as that ID does not look up an existing member by email. The `email` resource field and `x-litellm-customer-member-email` header require a build containing [#51617](https://github.com/BerriAI/litellm/pull/51617). That header requires `x-litellm-customer-org-alias`; conflicting member ID and email identities return `403`.

:::

## Member budget templates

Templates belong to a customer organization. Updating a template changes the settings its members inherit. Changing the default template affects new members; it does not reassign existing members.

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/management/v1/customer_organizations/{customer_org_id}/default_budgets` | `201`, organization with its updated `default_budgets`. |
| `PATCH` | `/management/v1/customer_organizations/{customer_org_id}/default_budgets/{budget_id}` | `200`, updated organization. |
| `DELETE` | `/management/v1/customer_organizations/{customer_org_id}/default_budgets/{budget_id}` | `204`. Template must be unused and must not be the default. |

Creation accepts a [budget object](#budget-object) plus required non-empty `name`. Names must be unique within the organization. The first template becomes the default. Updating accepts budget fields and optional `name`. Template requests do not accept `is_default`; select the default through the organization's `default_budget_template_id` field.

```bash title="Add a named member template"
curl --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_organizations/org-acme/default_budgets" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "extended",
    "max_budget": 100,
    "budget_duration": "30d"
  }'
```

To make this template the default for new members, copy its `budget_id` from the response's `default_budgets` array. Replace `<budget_id>` below with that value:

```bash title="Choose the default member template"
curl --request PATCH \
  "$LITELLM_BASE_URL/management/v1/customer_organizations/org-acme" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data '{"default_budget_template_id":"<budget_id>"}'
```

Changing the default does not reassign existing members. Select another default or clear it before deleting the current template; a referenced template still cannot be deleted.

## Budget increase requests

A member whose effective budget has `cap_policy: "pause_allow_increase"` can ask for a temporary cap. The budget error at the cap names this route. Members with any other policy get `422`.

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/management/v1/customer_budget_increase_requests` | `201`, request with `status: "pending_review"`. |
| `GET` | `/management/v1/customer_budget_increase_requests` | `200`, review queue. |
| `GET` | `/management/v1/customer_budget_increase_requests/{request_id}` | `200`, one request. |
| `PUT` | `/management/v1/customer_budget_increase_requests/{request_id}/approve` | `200`. The member's override takes `requested_max_budget` until `expires_at`. |
| `PUT` | `/management/v1/customer_budget_increase_requests/{request_id}/reject` | `200`. The member stays paused. Accepts optional `review_notes`. |

Creation requires `customer_member_id`, `requested_max_budget`, and a timezone-aware `expires_at`, and accepts an optional `reason`.

```bash title="Request a temporary increase"
curl --request POST \
  "$LITELLM_BASE_URL/management/v1/customer_budget_increase_requests" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "customer_member_id": "acme-alice",
    "requested_max_budget": 75,
    "expires_at": "2026-12-01T00:00:00Z",
    "reason": "Quarter-end workload"
  }'
```

## List pagination

Organization, team, and member lists share these query parameters. Unknown parameters and repeated query parameters return `400`.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `page` | `1` | Page number, at least `1`. |
| `page_size` | `50` | Requested rows, at least `1`. The server caps it at `100`. |
| `q` | `""` | Organization lists only. Case-insensitive substring of organization ID or alias. |
| `parent_org_id` | Unset | Team lists only. Restrict to one organization. |
| `parent_team_id` | Unset | Member lists only. Restrict to members of one team. |

```bash title="List a customer's teams"
curl --get \
  "$LITELLM_BASE_URL/management/v1/customer_teams" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --data-urlencode "parent_org_id=org-acme" \
  --data-urlencode "page=1" \
  --data-urlencode "page_size=100"
```

The response contains `data` (resource objects), `meta.total_count`, `meta.page`, `meta.page_size`, `meta.total_pages`, and `links.self`, `first`, `prev`, `next`, and `last`. `prev` and `next` are `null` when no such page exists. Follow `links.next` or stop at `meta.total_pages`.

## Attribute inference requests

Send these headers with the inference key you use for your application. They work on Chat Completions, Responses, and Anthropic Messages.

| Header | Meaning |
| --- | --- |
| `x-litellm-customer-org-alias` | Resolve a customer organization by its `alias`. Alone, charges and checks the organization scope. |
| `x-litellm-customer-member-id` | Resolve a member, then its parent team and organization. Alone, requires an existing member. |

With both headers, LiteLLM checks that the member belongs to that organization. An unknown member joins the organization's `default` team when the organization has a default member budget. LiteLLM generates that team's ID as `{customer_org_id}:default`. An unknown organization alias returns `401`; a shared alias returns `400`; a mismatched member and organization returns `403`.

Use your existing application key across customers. Your backend chooses the organization alias and member ID from the authenticated customer session and passes them in the SDK request. See the [OpenAI Responses and Deep Agents examples](./track-customer-spend.md).

| Supported inference API | Route |
| --- | --- |
| OpenAI Responses | `POST /v1/responses` |
| Chat Completions | `POST /v1/chat/completions` |
| Anthropic Messages | `POST /v1/messages` |


## Customer usage

All four reads require a proxy admin key. Dates use inclusive UTC calendar days. Spend uses USD; tokens and requests use integer counts. Query each hierarchy level separately for its breakdown; adding organization, team, and member totals counts the same requests more than once.

| Method | Path | Customer filter | Pagination |
| --- | --- | --- | --- |
| `GET` | `/management/v1/customer_organizations/daily/activity` | `customer_org_ids` | `page`, `page_size`. |
| `GET` | `/management/v1/customer_teams/daily/activity` | `customer_team_ids` | `page`, `page_size`. |
| `GET` | `/management/v1/customer_members/daily/activity` | `customer_member_ids` | `page`, `page_size`. |
| `GET` | `/management/v1/customer_organizations/daily/activity/aggregated` | Required `customer_org_ids`, 1–100 IDs | Complete range totals in one response. |

### Daily activity parameters

| Parameter | Default | Meaning |
| --- | --- | --- |
| `start_date`, `end_date` | Required | Dates in `YYYY-MM-DD` format. |
| Customer filter from the table above | Unset on paginated routes | Comma-separated IDs. Omitting it queries all customer entities visible to the proxy admin. |
| `exclude_customer_org_ids`, `exclude_customer_team_ids`, `exclude_customer_member_ids` | Unset | Paginated routes only. Use the exclusion field for the route's entity type. |
| `model` | Unset | Filter by recorded model. |
| `api_key` | Unset | Filter by reporting API key ID from a usage response. Do not put a raw inference key in the URL. |
| `page` | `1` | Paginated routes only. Must be at least `1`. |
| `page_size` | `10` | Paginated routes only. Must be at least `1`. |

Unknown query parameters and repeated parameters return `400`. The aggregated route accepts at most a 400-day difference between its start and end dates. It returns complete spend, request, and token totals; its API key breakdown includes only the top key.

```bash title="Complete organization totals for your product"
curl --get \
  "$LITELLM_BASE_URL/management/v1/customer_organizations/daily/activity/aggregated" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --data-urlencode "customer_org_ids=org-acme" \
  --data-urlencode "start_date=$START_DATE" \
  --data-urlencode "end_date=$END_DATE"
```

### Usage pagination

Organization aggregated usage returns the complete range in one response. Team and member daily activity use `page` and `page_size`.

For another page, repeat the request with the next page number:

```bash title="Second page of member usage"
curl --get "$LITELLM_BASE_URL/management/v1/customer_members/daily/activity" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  --data-urlencode "customer_member_ids=acme-alice" \
  --data-urlencode "start_date=$START_DATE" \
  --data-urlencode "end_date=$END_DATE" \
  --data-urlencode "page=2" \
  --data-urlencode "page_size=100"
```

Sum each page's totals once. Stop when `metadata.has_more` is `false`; merge matching dates when building a chart.

### Usage response

| Field | Meaning |
| --- | --- |
| `results[].date` | UTC day in `YYYY-MM-DD` format. |
| `results[].metrics` | `spend`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `api_requests`, `successful_requests`, `failed_requests`, and additional recorded metrics. |
| `results[].breakdown` | Metrics by `models`, `model_groups`, `providers`, `endpoints`, `api_keys`, and `entities` where present. Entity metadata includes its `alias`. |
| `metadata.total_spend`, `total_tokens`, `total_api_requests` | Totals for this response. |
| `metadata.page`, `total_pages`, `has_more` | Page information. Aggregated responses use `1`, `1`, and `false`. |

Paginated activity limits stored rows before grouping them by date. The same date can appear on more than one page. Sum each page's totals once and merge matching dates until `metadata.has_more` is `false`. Increment `page` until `metadata.has_more` is `false`.

```json title="Usage response excerpt"
{
  "results": [{
    "date": "2026-11-13",
    "metrics": {"spend": 0.14, "total_tokens": 120, "api_requests": 1}
  }],
  "metadata": {
    "total_spend": 0.14,
    "total_tokens": 120,
    "total_api_requests": 1,
    "page": 1,
    "total_pages": 1,
    "has_more": false
  }
}
```

Accounting writes usage in the background. Check the date range and customer headers if a successful inference request has no usage yet. A zero-cost model can report tokens and requests with no spend.

## Customer budget events

Customer budget events are on `main` through [#51579](https://github.com/BerriAI/litellm/pull/51579) and the [customer budget alert fix, #51645](https://github.com/BerriAI/litellm/pull/51645), for recurring periods, member events, and team overrides. Use a build containing both changes. Register `customer_budget_webhook` in `litellm_settings.callbacks`. Configure it through top-level `callback_settings.customer_budget_webhook`:

| Setting | Type | Meaning |
| --- | --- | --- |
| `endpoint` | HTTP or HTTPS URL | Receiver URL. Falls back to `CUSTOMER_BUDGET_WEBHOOK_URL` when omitted. Required through one of these sources. |
| `headers` | Object of string values | Additional request headers. Overrides matching values from `CUSTOMER_BUDGET_WEBHOOK_HEADERS`, a JSON object supplied through the environment. Defaults to `Content-Type: application/json`. |

The callback posts the event directly as JSON. [The guide provides a complete configuration and sample payload](./track-customer-spend.md#1-set-up-budget-webhooks). It uses the same event object as `CustomLogger.async_on_customer_budget_event(event: CustomerBudgetEvent)`.

| Event field | Type | Meaning |
| --- | --- | --- |
| `event` | `"soft_budget_crossed"` or `"budget_crossed"` | Recorded spend is at or above the corresponding configured threshold after a positive spend update commits. |
| `scope` | `"customer_org"`, `"customer_team"`, or `"customer_member"` | Scope whose threshold was reached. |
| `entity_id` | String | ID at the event's scope. |
| `customer_org_id`, `customer_org_alias` | String or `null` | Resolved customer organization. |
| `customer_team_id`, `customer_team_alias` | String or `null` | Resolved team for team events; `null` for organization and member events. |
| `customer_member_id`, `customer_member_alias` | String or `null` | Resolved member for member events; `null` at other scopes. |
| `spend` | Number | Recorded spend in USD after accounting. |
| `budget` | Number | Threshold in USD: `soft_budget` or `max_budget`, according to `event`. |
| `period` | String | Recorded next reset timestamp, or `"lifetime"` when no reset is recorded. |
| `timestamp` | Datetime | Time the event was detected. |

Teams and members use their effective template and active override. Member budgets cover the member across teams, so member events have no team ID or alias. One update can emit both event types at multiple scopes. Requests rejected before inference, zero-cost updates, and refunds do not trigger this detector.

The webhook accepts successful `2xx` responses and has a 10-second timeout. Delivery is best effort. An event claim is keyed by `(event, scope, entity_id, period)` until that budget period resets and is retained even if delivery fails. Lifetime budgets use a cache claim with a 100-year TTL. Shared Redis coordinates claims across workers; an in-memory fallback can produce duplicates. The HTTP client retries a connection error once. There is no durable retry queue, backoff, or replay API for HTTP errors or timeouts. Use usage reads to reconcile missed events; do not use the callback as your only billing record.

## Errors

Management errors use problem details with `type`, `title`, `status`, and `detail`. An unknown query parameter response can include `allowed`, the accepted parameter names.

| Status | Cause and next action |
| --- | --- |
| `400` | Unknown or repeated query parameter, invalid date range, or invalid pagination. Check the route's parameter table. |
| `401` | Missing or invalid authentication. On inference, also check an unknown member or organization alias. |
| `403` | Caller lacks `proxy_admin`, or the member does not belong to the supplied customer organization. |
| `403` | Free-tier create limit. Type `urn:litellm:error:customer-hierarchy-free-tier-limit`, title `Free customer portal limit reached`, detail `Free customer portal limit reached: up to 5 customer organizations, 5 teams per organization and 5 members per team without a LiteLLM Enterprise license. Upgrade to Enterprise to remove the limits: https://www.litellm.ai/enterprise`. Upgrade to Enterprise or free capacity before retrying. |
| `404` | Resource or parent does not exist. Retrieve or create the parent first. |
| `409` | Duplicate ID, parent still has children, or template remains default or referenced. |
| `422` | Invalid body, budget value, template selection, or missing member budget. Inference budget rejection also uses `422` with an inference error body. |
| `429` | Inference request exceeds a configured rate limit. |
| `503` | Management database is unavailable. |

```json title="Duplicate customer ID"
{
  "type": "urn:litellm:error:customer-hierarchy-already-exists",
  "title": "Already exists",
  "status": 409,
  "detail": "Customer entity ID already exists."
}
```
