---
title: Customer Management RBAC
sidebar_label: RBAC
description: Give users, teams and organizations read-only access to specific applications in Customer Management, while proxy admins keep full control.
---

# Customer Management RBAC

<SinceVersion v="1.112.0" />

A proxy admin sees and manages everything in Customer Management. Anyone else sees nothing there until a proxy admin grants them an [application](./applications.md). A grant gives read-only access to that application, its customer organizations and members, and its usage. An application owner sees their own application, and a proxy admin sees all of them.

Grants reuse the object permissions that already control access to MCP servers, agents and vector stores. An application grant is one more list on that record, `object_permission.apps`, which holds application ids. There is no separate grant table or grant API to learn, and anything that already manages users, teams or organizations, such as Terraform or SSO team sync, can manage these grants too.

## Who can see what

| Caller | Customer Management in the UI | Reads | Writes |
|---|---|---|---|
| Proxy admin | All pages | Every application and customer | Everything |
| User with at least one granted application | Applications page, read-only | Granted applications only | None |
| User with no granted application | Hidden | None | None |

A proxy admin viewer is treated like any other user here and needs a grant to read an application.

A user's applications are the union of three sources: the grants on the user, the grants on every team the user belongs to, and the grants on every organization the user is a member of. A grant on a team or an organization reaches every member, so adding someone to a team in your identity provider is enough to give them the team's applications.

## Grant an application

Find the application's id with `GET /management/v1/apps`, then put it in `object_permission.apps` on a team, a user or an organization. Only a proxy admin can add, change or remove these ids.

In the Admin UI, a proxy admin opens Customer Management, goes to Internal Access, picks a team, a user or an organization and selects the applications it can view. The same grants are available through the API. To grant a team, update the team.

```bash
curl -X POST "$LITELLM_BASE_URL/team/update" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"team_id": "'"$TEAM_ID"'", "object_permission": {"apps": ["'"$APP_ID"'"]}}'
```

To grant one user, update the user.

```bash
curl -X POST "$LITELLM_BASE_URL/user/update" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "'"$USER_ID"'", "object_permission": {"apps": ["'"$APP_ID"'"]}}'
```

To grant every member of an organization, update the organization.

```bash
curl -X PATCH "$LITELLM_BASE_URL/organization/update" \
  -H "Authorization: Bearer $LITELLM_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "'"$ORGANIZATION_ID"'", "object_permission": {"apps": ["'"$APP_ID"'"]}}'
```

The list you send replaces the stored list, so send every application the team, user or organization should keep. Other fields of `object_permission` that you leave out are not changed. To revoke access, send the list without that application id, or an empty list to remove all of them.

## What a grantee can do

A grantee signs in to the Admin UI and finds Customer Management in the view switcher. It opens the Applications page, which lists only their applications with spend and budget and has no edit controls.

The same scope applies to the API. `GET /management/v1/apps` returns only granted applications, and `GET /management/v1/apps/{app_id}` returns `403` for any other id. Customer organizations and members are read per application, through `GET /management/v1/apps/{app_id}/customer_organizations/{customer_org_id}` and `GET /management/v1/apps/{app_id}/customer_members/{customer_member_id}`. A customer member that the application has never served returns `404`, the same as an id that does not exist, so a grantee cannot learn about another application's customers.

Usage routes need a granted `app_id`. A grantee who leaves it out or names another application gets `403`.

```bash
curl "$LITELLM_BASE_URL/management/v1/customer_organizations/daily/activity?app_id=$APP_ID&start_date=2026-11-01&end_date=2026-11-30" \
  -H "Authorization: Bearer $GRANTEE_KEY"
```

Every write stays with proxy admins. A grantee gets `403` when they try to create or change an application, a budget, a customer organization or a customer member, or to list the resources that can become applications. They can read which kind of resource an application is, and cannot change it.

## Who can change grants

Only a proxy admin can change `object_permission.apps`. Wherever someone else is allowed to edit an object permission, a request that sends the stored application list back unchanged is accepted, so existing forms and scripts keep working. A request from them that adds or removes an application id, or that clears an object permission which holds application grants, returns `403`.

```json
{
  "error": "Only a proxy admin can change access to customer management apps."
}
```

Virtual keys do not carry application grants. `/key/generate` and `/key/update` refuse an `apps` list, because access follows the user who owns the key, their teams and their organizations.

## Access to the Gateway

A grant adds Customer Management access and takes nothing away. A grantee keeps whatever their role already allows in the Gateway, both in the UI and in the API. An `internal_user` with a grant can still create their own keys and call models as before. To keep an application owner out of the Gateway, give them a role that allows little there, such as `internal_user_viewer`, and grant the application through a team.
