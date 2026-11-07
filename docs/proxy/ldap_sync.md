---
title: LDAP team sync
description: Sync LDAP groups to LiteLLM teams on a schedule, match existing users, and remove memberships and team keys when members leave.
---

# LDAP team sync

<SinceVersion v="1.109.0" />

:::info Unreleased

This guide documents [the LDAP sync implementation PR](https://github.com/BerriAI/litellm/pull/50130). The version above is the next planned release. Use a build containing that change; confirm the release version before rollout.

:::

<EnterpriseFeature free />

Keep LiteLLM team memberships aligned with selected LDAP groups. The proxy reads the directory on a schedule, creates missing teams, and adds or removes **existing LiteLLM users** from those teams. It never deletes teams or users and does not create users, change their profiles or global roles, or handle login.

Use [SCIM](../tutorials/scim_litellm.md) when your identity provider needs to provision and deprovision users as well as teams. LDAP sync pulls group membership from your directory; SCIM receives updates from your identity provider. Avoid letting both manage the same team roster.

## Before you start

You need a proxy with a database, shared Redis, and the `litellm[proxy]` dependencies. Redis is required even for a single worker. Every replica must use the same database, coordination Redis, and LDAP configuration.

The LDAP account needs read access to every selected group, its complete membership, and each user's matching identity attribute. Use LDAPS or StartTLS with a trusted server certificate. Onboard users through your existing process before expecting them to join teams.

:::warning LDAP owns matched team memberships

Once writes are enabled, LDAP replaces the roster of each matched team, including manually added members. Removing a member also deletes that member's keys for that team. Start with a narrow group filter and dry run.

:::

## Configure a dry run

Add this to your existing proxy configuration. `approved-model` is a model name from your `model_list`.

```yaml title="config.yaml"
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  coordination_redis:
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
  ldap_sync:
    enabled: true
    server_url: ldaps://ldap.example.org:636
    bind_dn: os.environ/LDAP_BIND_DN
    bind_password: os.environ/LDAP_BIND_PASSWORD
    group_search_base: ou=groups,dc=example,dc=org
    group_filter: "(cn=project-*)"
    user_search_base: ou=people,dc=example,dc=org
    group_id_attribute: cn
    group_name_attribute: cn
    member_attribute: member
    user_match_attribute: mail
    litellm_match_field: user_email
    interval_minutes: 30
    dry_run: true

litellm_settings:
  default_team_params:
    models: [approved-model]
    max_budget: 100
    budget_duration: 30d
```

Set the referenced environment variables before startup. Use a read-only service account for `LDAP_BIND_DN` and `LDAP_BIND_PASSWORD`. Omit both bind fields only if your directory allows anonymous reads. For a private certificate authority, add `ca_cert_path` with the path to a CA bundle mounted in every proxy replica. Certificate verification is always enabled.

For StartTLS, replace `server_url` with `ldap://ldap.example.org:389` and add `start_tls: true`. Plaintext LDAP is rejected for enabled syncs, including anonymous access and dry runs.

Start or restart the proxy with informational logging enabled:

```bash
LITELLM_LOG=INFO litellm --config config.yaml --num_workers 2
```

The first run is scheduled shortly after startup. Review the `LDAP sync` messages in the proxy's normal stdout/container logs. Dry-run messages report the team ID, whether the team would be created, and user IDs to add or remove. Matching messages count matched and unmatched users. Skipped groups and teams are logged as warnings with the reason. For example:

```text
LDAP sync skipped group_dn=cn=project-delta,ou=groups,dc=example,dc=org: LDAP member is not a user entry
LDAP sync team_id=project-gamma matched_users=0 unmatched_users=0
LDAP sync skipped team_id=project-gamma: group resolved to no LiteLLM users but the team has 1 members; set allow_empty_groups to remove them
LDAP sync team_id=project-beta matched_users=2 unmatched_users=0
LDAP sync dry_run team_id=project-beta create_team=False add=['alice'] remove=['carol']
LDAP sync team_id=project-alpha matched_users=1 unmatched_users=1
LDAP sync dry_run team_id=project-alpha create_team=True add=['alice'] remove=[]
```

Confirm the roster before changing `dry_run` to `false` and restarting every replica. Only one replica syncs per interval, because the job lock lasts the whole interval. A restart soon after a run therefore applies the change at the next interval rather than immediately.

After the next successful run, check the team in the Admin UI or through the API:

```bash
curl "$LITELLM_PROXY_URL/team/info?team_id=project-alpha" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

## Match groups and users

The configured `group_id_attribute` matches **exactly** to LiteLLM's `team_id`. With the default `cn`, a group whose `cn` is `project-alpha` creates or updates team ID `project-alpha`. A team with only that display name and a different ID is not adopted. Choose a unique string that stays stable across group renames; binary IDs are not supported.

A team ID can only be chosen when the team is created, through the optional **Team ID** field in the Admin UI or `team_id` on `/team/new`. Teams created without one get a generated ID that no LDAP group will match. To bring an existing team under LDAP sync, it must already use the group's ID; otherwise the sync creates a new team.

`group_name_attribute` sets the display name only when creating a team. New teams inherit `default_team_params`, as SCIM-created teams do. Existing names, budgets, model access and other team settings stay unchanged. Retained members keep their roles; newly added members receive the regular member role.

By default, the group's `member` attribute contains user DNs, the full addresses of user records. The job reads each user record's `mail` attribute and matches it to an existing LiteLLM `user_email`, ignoring email case. An unmatched user is skipped until a later run after normal onboarding.

For another identity field, set `user_match_attribute` to the LDAP field and `litellm_match_field` to `user_id` or `sso_user_id`. Those values match exactly. For POSIX groups, set `member_attribute: memberUid`; the job searches `user_search_base` using `member_lookup_attribute`, which defaults to `uid`. Other membership attributes, such as `uniqueMember` or `roleOccupant`, are treated as full DNs. Each member must be a user entry with the `person`, `organizationalPerson`, `inetOrgPerson`, `user` or `posixAccount` object class. Any other member, including a nested group, skips its group.

:::warning Protect the matching identity

Use matching fields whose values are controlled by trusted administrators or your identity system. Email matching does not verify ownership of the email address. If someone can change the matching LiteLLM field, the sync can associate their account with another directory identity. Choosing another field is only safe if its write permissions are also controlled.

:::

Changing the LDAP identity without updating the matching LiteLLM field makes the user unmatched. The next sync removes that user and their keys from every synchronized team. Coordinate identity changes before the next run.

## What each run does

1. A worker acquires the shared Redis job lock. Other workers skip that attempt.
2. It reads the selected groups and user identities into a directory snapshot before making membership changes.
3. For each valid group, it finds existing LiteLLM users, then looks up the exact team ID.
4. In dry run, it logs the proposed changes. Otherwise, it creates a missing team and reconciles memberships, preserving retained roles and revoking removed members' team keys.
5. It logs results and keeps the lock until the interval ends, so replicas whose schedule fires later in the interval skip. Unchanged rosters do not get rewritten.

Membership changes are transactional per team, not across the whole run. A later failure does not undo groups already committed. Each run has a time budget shorter than the Redis lease. A directory read that exceeds it makes no changes. Once writes begin, the budget is checked between teams, so a team that has started updating always finishes. Remaining teams retry at the next interval from current directory state. If the proxy shuts down during a team's update, a removed member's key can stay usable from the auth cache until `user_api_key_cache_ttl` expires, as with other key deletions.

## Membership and failure behavior

| Situation | Result |
|---|---|
| Group matches an existing team ID | Reconcile its roster, including manually added members. |
| Group has no matching team | Create it with team defaults and matching existing users. |
| Directory user has no LiteLLM account | Skip that user. Never create an account. |
| User leaves a successfully read group | Remove membership and delete that user's keys for the team. Keep the user account and other memberships. |
| Group resolves to no LiteLLM users while its team has members | Skip the team and log a warning. Set `allow_empty_groups: true` to remove every member and their team keys instead. |
| Group disappears from the search results | Keep the existing team and memberships unchanged. |
| Member DN no longer exists | Skip that group and preserve its roster. Healthy groups continue. |
| Missing, blank or multivalued group ID; ambiguous user; non-user member (including a nested group); ranged membership | Skip the affected group. Healthy groups continue. |
| Directory outage, partial search, referral, duplicate group IDs or unreadable member | Abort the snapshot without applying its memberships. |
| A team's membership write fails | Preserve that transaction's prior state and continue with other valid groups. A separately created team can remain. |

Only direct user memberships are supported. Active Directory ranged membership responses and groups containing nested groups or other non-user members are skipped rather than expanded.

LDAP access controls can hide an attribute in the same way an empty attribute is omitted. The job cannot always distinguish an unreadable membership field from an empty group, which is why a group that resolves to no users does not empty a populated team unless `allow_empty_groups` is set. Verify complete read permissions and dry-run output before enabling writes, and run a dry run again after changing directory access controls or group schemas.

## Settings reference

All settings below belong under `general_settings.ldap_sync`.

| Setting | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Schedule the job. When true, the URL, both search bases and group filter are required. |
| `server_url` | Empty | `ldaps://host:636`, or `ldap://host:389` with StartTLS. Do not embed credentials or a search path. |
| `bind_dn` | `null` | Service account DN. Supports `os.environ/VARIABLE`. Set together with `bind_password`. |
| `bind_password` | `null` | Service account password. Prefer `os.environ/VARIABLE`. |
| `start_tls` | `false` | Upgrade an `ldap://` connection to verified TLS before binding. |
| `ca_cert_path` | `null` | CA bundle path. Otherwise use system trust. |
| `group_search_base` | Empty | Tree location under which to search for groups. |
| `group_filter` | Empty | LDAP search filter selecting the groups to manage. |
| `user_search_base` | Empty | Tree location for `memberUid` user searches. Required when enabled. |
| `group_id_attribute` | `cn` | Unique string matched to the LiteLLM team ID. |
| `group_name_attribute` | `cn` | Display name for newly created teams. |
| `member_attribute` | `member` | Group attribute containing member DNs (`member`, `uniqueMember`, `roleOccupant`), or `memberUid` values. |
| `member_lookup_attribute` | `uid` | User attribute used to look up `memberUid` values. |
| `user_match_attribute` | `mail` | LDAP user attribute holding the LiteLLM matching identity. |
| `litellm_match_field` | `user_email` | Existing-user field: `user_email`, `user_id`, or `sso_user_id`. |
| `interval_minutes` | `30` | Time between scheduled runs. Minimum `5` minutes. |
| `timeout_seconds` | `30` | LDAP socket/search timeout upper bound, from 1 to 120 seconds. Short intervals can reduce the effective timeout. |
| `dry_run` | `false` | Log planned changes without writing users, teams, memberships or keys. Explicitly set true for your first run. |
| `allow_empty_groups` | `false` | Let a group that resolves to no LiteLLM users remove every member of a populated team. By default such teams are skipped. |

## Manage or stop the job

Configuration is YAML-based and requires a proxy restart. There is no dedicated LDAP UI, run-now endpoint or run-history table. Results and failures appear in normal proxy logs under `LDAP sync`. Inspect team membership in the existing Teams UI or `/team/info`.

To stop future syncs, set `enabled: false` or remove the block and restart every replica. Existing teams and memberships stay in place. This does not restore memberships or keys removed by earlier runs.
