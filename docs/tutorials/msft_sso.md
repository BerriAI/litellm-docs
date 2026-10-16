---
title: Microsoft Entra ID group sync
sidebar_label: Entra ID group sync
description: Sync Microsoft Entra ID groups and members to LiteLLM teams, and set LiteLLM roles from Entra app roles.
---

import Image from '@theme/IdealImage';

# Microsoft Entra ID group sync

Use this page to sync Microsoft Entra ID groups and members to LiteLLM teams. LiteLLM reads the groups from Microsoft Graph each time a user signs in to the Admin UI.

:::tip
This page covers Admin UI sign-in over OIDC with Microsoft Graph group sync. For Admin UI sign-in over SAML with Entra app roles, or for Claude Desktop sign-in with Entra, see [Microsoft Entra ID](../proxy/entra_id_sso.md). To use the group sync on this page for Claude Code and Codex CLI sign-in, see [Entra sign-in for Claude Code and Codex](../proxy/entra_id_cli_sso.md).
:::

<Image img={require('../../img/litellm_entra_id.png')}  style={{ width: '800px', height: 'auto' }} />

## Before you start

You need:

- Admin access to the Microsoft Entra admin center or the [Azure portal](https://portal.azure.com/).
- An app registration for LiteLLM, with its enterprise application.
- A LiteLLM proxy with a database.
- A LiteLLM Enterprise license (`LITELLM_LICENSE`) for more than 5 SSO users. SSO is free for up to 5 users.

### Redirect URI

In the app registration, add a **Web** redirect URI:

```text
<PROXY_BASE_URL>/sso/callback
```

### Required environment variables

| Variable | Value |
| --- | --- |
| `MICROSOFT_CLIENT_ID` | **Application (client) ID** of the app registration |
| `MICROSOFT_CLIENT_SECRET` | Client secret value of the app registration |
| `MICROSOFT_TENANT` | **Directory (tenant) ID** |
| `PROXY_BASE_URL` | Public URL of the proxy, for example `https://litellm.example.com` |
| `MICROSOFT_SERVICE_PRINCIPAL_ID` | **Object ID** of the enterprise application. You need it for [step 1](#1-auto-create-entra-id-groups-on-litellm-teams). |

```bash showLineNumbers title="Microsoft SSO environment variables"
export MICROSOFT_CLIENT_ID="<application-client-id>"
export MICROSOFT_CLIENT_SECRET="<client-secret>"
export MICROSOFT_TENANT="<directory-tenant-id>"
export PROXY_BASE_URL="https://litellm.example.com"
export MICROSOFT_SERVICE_PRINCIPAL_ID="<enterprise-app-object-id>"
```

:::note
Get `MICROSOFT_SERVICE_PRINCIPAL_ID` from **Enterprise applications** > your LiteLLM app > **Overview** > **Object ID**. Do not use the Object ID of the app registration. It is a different value.
:::

### Microsoft Graph permissions

LiteLLM calls Microsoft Graph with the access token of the user who signs in. Thus, all permissions are **delegated** permissions. Add them in the app registration under **API permissions** > **Microsoft Graph** > **Delegated permissions**.

| Feature | Graph call | Delegated permission | Admin consent |
| --- | --- | --- | --- |
| Sign in | `GET /me` | `openid`, `email`, `User.Read` | No |
| [Sync memberships](#2-sync-entra-id-team-memberships) | `GET /me/memberOf` | `User.Read` | No |
| [Create teams from groups](#1-auto-create-entra-id-groups-on-litellm-teams) | `GET /servicePrincipals/{id}/appRoleAssignedTo` | `Application.Read.All` | Yes |

`User.Read` is enough for the membership sync, because LiteLLM uses only the group IDs. After you add `Application.Read.All`, select **Grant admin consent**.

LiteLLM reads direct group memberships only. A user in a nested group does not get the team of the parent group.

If Graph refuses the `appRoleAssignedTo` call for a user, LiteLLM creates no teams. It then adds the user to each existing team that has the ID of one of their groups.

### Optional environment variables

| Variable | Default | Use |
| --- | --- | --- |
| `MICROSOFT_GRAPH_ENDPOINT` | `https://graph.microsoft.com/v1.0` | Graph host for sovereign clouds. See [Azure Government Cloud](#25-azure-government-cloud-gcc-high). |
| `MICROSOFT_AUTHORIZATION_ENDPOINT` | Microsoft endpoint for your tenant | Custom sign-in endpoint |
| `MICROSOFT_TOKEN_ENDPOINT` | Microsoft endpoint for your tenant | Custom token endpoint |
| `MICROSOFT_USERINFO_ENDPOINT` | Microsoft endpoint for your tenant | Custom user info endpoint |
| `MICROSOFT_USER_EMAIL_ATTRIBUTE` | `userPrincipalName` | Claim that holds the user email. For the other attribute variables, see [SSO for Admin UI](../proxy/admin_ui_sso.md). |

## Steps on this page

1. Create LiteLLM teams from Entra ID groups.
2. Sync the members of each group to the LiteLLM team.
3. Set default values for new teams.
4. Set LiteLLM roles from Entra ID app roles.

## 1. Create LiteLLM teams from Entra ID groups {#1-auto-create-entra-id-groups-on-litellm-teams}

When you assign a group to the LiteLLM enterprise application, LiteLLM creates a team for that group. LiteLLM does this at the next SSO sign-in. This step needs `MICROSOFT_SERVICE_PRINCIPAL_ID`.

### 1.1 Create a group in Entra ID

In the [Azure portal](https://portal.azure.com/), go to **Groups** > **New group**. Create the group.

<Image img={require('../../img/entra_create_team.png')}  style={{ width: '800px', height: 'auto' }} />

### 1.2 Assign the group to the LiteLLM enterprise application

1. In the Azure portal, go to **Enterprise applications**.
2. Select your LiteLLM application.

<Image img={require('../../img/msft_enterprise_app.png')}  style={{ width: '800px', height: 'auto' }} />

<br />
<br />

3. Select **Users and groups** > **Add user/group**.

<Image img={require('../../img/msft_enterprise_assign_group.png')}  style={{ width: '800px', height: 'auto' }} />

<br />

4. Select the group from step 1.1.
5. Select **Assign**.

In this example, the group is `Production LLM Evals Group`.

<Image img={require('../../img/msft_enterprise_select_group.png')}  style={{ width: '800px', height: 'auto' }} />

### 1.3 Sign in to the LiteLLM UI with SSO

1. Open the LiteLLM UI.
2. Sign in with SSO.

The Entra ID sign-in page opens. At sign-in, LiteLLM gets the latest groups and members from Entra ID.

<Image img={require('../../img/msft_sso_sign_in.png')}  style={{ width: '800px', height: 'auto' }} />

### 1.4 Find the new team in the LiteLLM UI

In the LiteLLM UI, go to **Teams**. The new team `Production LLM Evals Group` shows in the list.

<Image img={require('../../img/msft_auto_team.png')}  style={{ width: '900px', height: 'auto' }} />

#### How this works

When an SSO user signs in to LiteLLM:

1. LiteLLM gets the groups that you assigned to the LiteLLM enterprise application.
2. LiteLLM looks for each group ID in the LiteLLM teams table.
3. If the ID is not in the table, LiteLLM creates a team.

The new team has:

- Name: the name of the Entra ID group
- Team ID: the ID of the Entra ID group

## 2. Sync Entra ID team memberships {#2-sync-entra-id-team-memberships}

When you add a user to an Entra ID group, LiteLLM adds the user to the matching team. LiteLLM does this when the user signs in.

### 2.1 Open the group in Entra ID

In the Azure portal, open the `Production LLM Evals Group` group.

<Image img={require('../../img/msft_member_1.png')}  style={{ width: '800px', height: 'auto' }} />

### 2.2 Add a member to the group

1. Select **Members** > **Add members**.
2. Select the user to add to the team.

<Image img={require('../../img/msft_member_2.png')}  style={{ width: '800px', height: 'auto' }} />

### 2.3 Sign in to the LiteLLM UI as the new user

Sign in to the LiteLLM UI with SSO as the new user. At sign-in, LiteLLM gets the groups of the user from Entra ID. LiteLLM then updates the team memberships of the user.

<Image img={require('../../img/msft_sso_sign_in.png')}  style={{ width: '800px', height: 'auto' }} />

### 2.4 Find the team membership in the LiteLLM UI

In the LiteLLM UI, go to **Teams**. The user is a member of `Production LLM Evals Group` in Entra ID. Thus, the team `Production LLM Evals Group` shows for the user.

<Image img={require('../../img/msft_member_3.png')}  style={{ width: '900px', height: 'auto' }} />

### 2.5 Azure Government Cloud (GCC High) {#25-azure-government-cloud-gcc-high}

By default, LiteLLM uses the commercial Microsoft Graph endpoint, `https://graph.microsoft.com/v1.0`. Azure Government Cloud GCC High uses a different Graph host. Set `MICROSOFT_GRAPH_ENDPOINT` to the sovereign cloud endpoint.

```bash showLineNumbers title="GCC High Graph endpoint"
export MICROSOFT_GRAPH_ENDPOINT="https://graph.microsoft.us/v1.0"
```

LiteLLM uses this endpoint for the `/me/memberOf` call and the `appRoleAssignedTo` call. Commercial cloud deployments do not need this variable.

For GCC High, also set `MICROSOFT_AUTHORIZATION_ENDPOINT`, `MICROSOFT_TOKEN_ENDPOINT` and `MICROSOFT_USERINFO_ENDPOINT`.

## 3. Set default values for new teams {#3-set-default-params-for-new-teams-auto-created-on-litellm}

LiteLLM creates a team for each new group that you assign to the LiteLLM enterprise application. You can set a default budget, models and other values for these new teams.

### 3.1 Set `default_team_params` in the LiteLLM config

Add `default_team_params` to your LiteLLM config file:

```yaml showLineNumbers title="litellm config with default_team_params"
litellm_settings:
  default_team_params:             # Applied to all /team/new calls (including SSO auto-created teams) when the field is not explicitly set
    max_budget: 100                # Optional[float]: $100 budget for the team
    budget_duration: 30d           # Optional[str]: 30 days budget_duration for the team
    models: ["{{openai_small}}"]      # Optional[List[str]]: models for the team (only applied to SSO auto-created teams)
    team_member_permissions:       # Optional[List[str]]: permissions granted to non-admin team members
      - "/team/daily/activity"     # Allow members to view team usage
```

### 3.2 Test the default values

1. In Entra ID, assign a new group to the LiteLLM enterprise application, as in step 1.2. In this example, the group is `Default LiteLLM Prod Team`.
2. Start the LiteLLM proxy with your config.
3. Sign in to the LiteLLM UI with SSO.
4. Go to **Teams**.
5. Find the new team `Default LiteLLM Prod Team`.

The new team has the values from `default_team_params`.

<Image img={require('../../img/msft_default_settings.png')}  style={{ width: '900px', height: 'auto' }} />

## 4. Set LiteLLM roles from Entra ID app roles {#4-using-entra-id-app-roles-for-user-permissions}

You can set the global LiteLLM role of a user with Entra ID app roles. At SSO sign-in, LiteLLM reads the app roles from the ID token. LiteLLM then gives the matching role to the user.

### 4.1 Supported roles

Use one of these global proxy roles. Case does not matter.

- `proxy_admin`: admin of the full LiteLLM platform
- `proxy_admin_viewer`: read-only admin. Can see all keys and spend.
- `internal_user`: standard user. Can create, see and delete their own keys, and see their own spend.
- `internal_user_viewer`: read-only standard user. Can see their own keys and spend.

Do not use `org_admin` as an Entra app role. LiteLLM stores the value as the global role of the user. But the role claim does not identify an organization, and LiteLLM does not create an organization membership. Thus, the role does not give organization admin permissions. Add the user as an `org_admin` to each organization with [organization access control](../proxy/access_control.md).

### 4.2 Create app roles in Entra ID

1. In the [Azure portal](https://portal.azure.com/), open your app registration.
2. Go to **App roles** > **Create app role**.
3. Set the fields of the app role:
   - **Display name**: Proxy Admin, or a name of your choice
   - **Value**: `proxy_admin`, or one of the other supported roles
   - **Description**: Administrator access to LiteLLM proxy
   - **Allowed member types**: Users/Groups
4. Select **Apply**.

### 4.3 Assign users to app roles

1. In the Azure portal, go to **Enterprise applications**.
2. Select your LiteLLM application.
3. Go to **Users and groups** > **Add user/group**.
4. Select the user.
5. Select one of the app roles that you created.
6. Select **Assign**.

### 4.4 Test the role assignment

1. Sign in to the LiteLLM UI with SSO as a user with an app role.
2. In the LiteLLM UI, go to **Internal Users**.
3. Find the user and check the role.

#### How this works

- At sign-in, LiteLLM reads the `roles` or `app_roles` claim from the `id_token`.
- If a role matches a LiteLLM role, LiteLLM gives that role to the user. Case does not matter.
- If the token has more than one supported role, LiteLLM uses the role with the most access. The order is `proxy_admin`, `proxy_admin_viewer`, `internal_user`, then `internal_user_viewer`.
- LiteLLM stores the role in its database. The role sets the access level of the user.

## Video walkthrough

This video shows how to set up the group sync with Microsoft Entra ID.

<iframe width="840" height="500" src="https://www.loom.com/embed/ea711323aa9a496d84a01fd7b2a12f54?sid=c53e238c-5bfd-4135-b8fb-b5b1a08632cf" frameBorder="0" allowFullScreen></iframe>
