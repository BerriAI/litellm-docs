---
title: SSO Permissions
description: Control SSO sign-in, user roles, team membership, and key creation in LiteLLM.
---

import Image from '@theme/IdealImage';

# SSO Permissions

{/* keep-version-note */}

Configure [SSO sign-in](../admin_ui_sso.md) first, then use these settings to control who can use the Admin UI and what they can manage. See [roles and team member permissions](../access_control.md) for the permissions each role provides.

## Restrict sign-in by email domain {#restrict-email-subdomains-w-sso}

To allow SSO sign-in only from `berri.ai`, set:

```bash
export ALLOWED_EMAIL_DOMAINS="berri.ai"
```

LiteLLM checks the email returned by your SSO provider before allowing sign-in.

## Restrict UI access {#restrict-ui-access}

Allow only `proxy_admin` and `proxy_admin_viewer` users to sign in to the Admin UI:

**Step 1. Set `admin_only` access**

```yaml
general_settings:
  ui_access_mode: "admin_only"
```

**Step 2. Invite view-only users**

<Image img={require('../../../img/admin_ui_viewer.png')} />

## Set a proxy admin {#set-proxy-admin}

SSO users get their `user_id` from the identity provider. Copy the ID from the UI and set it as `PROXY_ADMIN_ID` to give that user the `proxy_admin` role.

### Step 1: Copy your ID from the UI

<Image img={require('../../../img/litellm_ui_copy_id.png')} />

### Step 2: Set it in your .env as the PROXY_ADMIN_ID

```env
export PROXY_ADMIN_ID="116544810872468347480"
```

This updates the user role in `LiteLLM_UserTable` to `proxy_admin`.

To change the admin later, update the user role through `/user/update` or the **Internal Users** page.

### Step 3: See all proxy keys

<Image img={require('../../../img/litellm_ui_admin.png')} />

:::info

If the new admin cannot see all keys, sign out and sign in again to refresh the cached token.

:::

## Assign roles through Microsoft Entra ID {#manage-user-roles-via-azure-app-roles}

Define App Roles in Microsoft Entra ID. LiteLLM reads the assigned role when each user signs in.

### Step 1: Create App Roles on Azure App Registration

1. Open your App Registration in the [Azure portal](https://portal.azure.com/).
2. Go to **App roles** > **Create app role**
3. Configure the app role using one of the [supported LiteLLM roles](../access_control.md#global-proxy-roles):
   - **Display name**: Admin Viewer (or your preferred display name)
   - **Value**: `proxy_admin_viewer` (must match one of the LiteLLM role values exactly)
4. Click **Apply** to save the role
5. Repeat for each LiteLLM role you want to use


Supported values are `proxy_admin`, `proxy_admin_viewer`, `internal_user`, and `internal_user_viewer`. See [role permissions](../access_control.md#global-proxy-roles) before assigning a role.

<Image img={require('../../../img/app_roles.png')} style={{ width: '900px', height: 'auto' }} />

---

### Step 2: Assign Users to App Roles

1. Open **Enterprise Applications** in the [Azure portal](https://portal.azure.com/).
2. Select your LiteLLM application
3. Go to **Users and groups** > **Add user/group**
4. Select the user
5. Under **Select a role**, choose the app role you created (e.g., `proxy_admin_viewer`)
6. Click **Assign** to save

<Image img={require('../../../img/app_role2.png')} style={{ width: '900px', height: 'auto' }} />

---

### Step 3: Sign in and verify

1. Sign in to the LiteLLM UI via SSO
2. LiteLLM will automatically extract the app role from the JWT token
3. The user will be assigned the corresponding role (you can verify this in the UI by checking the user profile dropdown)

<Image img={require('../../../img/app_role3.png')} style={{ width: '900px', height: 'auto' }} />

**Note:** The role from Entra ID will take precedence over any existing role in the LiteLLM database. This ensures your SSO provider is the authoritative source for user roles.

## Assign roles through a generic OIDC provider

Set `GENERIC_USER_ROLE_ATTRIBUTE` to the attribute containing the user's LiteLLM role. Nested paths such as `claims.role` or `attributes.litellm_role` are supported.

```bash
GENERIC_USER_ROLE_ATTRIBUTE="claims.role"
```

Supported values are `proxy_admin`, `proxy_admin_viewer`, `internal_user`, and `internal_user_viewer`. See [role permissions](../access_control.md#global-proxy-roles) before assigning a role.

## Assign roles and teams through SAML

After [configuring SAML sign-in](../saml_sso.md), include the LiteLLM role and team IDs in the SAML assertion. LiteLLM recognizes these common attribute names; override them if your IdP uses another name:

| Environment variable | Default candidates | Meaning |
| --- | --- | --- |
| `SAML_ATTRIBUTE_ROLE` | `role`, `roles`, `litellm_role` | Attribute mapped to the LiteLLM user role. |
| `SAML_ATTRIBUTE_TEAM_IDS` | `teams`, `team_ids`, `groups` | Attribute mapped to LiteLLM team IDs. |

```bash
SAML_ATTRIBUTE_ROLE="role"
SAML_ATTRIBUTE_TEAM_IDS="teams"
```

The role value must be `proxy_admin`, `proxy_admin_viewer`, `internal_user`, or `internal_user_viewer`.

- **Okta:** Add a custom attribute or Group Attribute Statement named `role` with a supported LiteLLM role value.
- **Microsoft Entra ID:** Add a custom claim named `role` sourced from an App Role or directory attribute.

## Assign roles with a custom SSO handler

For custom role assignment after sign-in, use a [custom SSO handler](../custom_sso.md#option-2-custom-sso-handler-post-authentication). Returning `user_role=None` preserves the stored LiteLLM role; an explicit role overrides it on every login.

## Add SSO users to teams {#auto-add-sso-users-to-teams-oidc}

For OIDC providers (Okta, Google, Generic SSO), you can pull a claim from the token returned by your identity provider into the user's `team_ids`. On every SSO login, LiteLLM reads that claim and adds the user as a member of each matching team.

### Step 1: Point LiteLLM at the claim containing the team ids

```yaml showLineNumbers title="config.yaml"
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  litellm_jwtauth:
    team_ids_jwt_field: "groups" # any claim; dot notation works for nested claims, e.g. "resource_access.myapp.groups"
```

This assumes the token from your provider looks like this:

```json
{
  "groups": ["team_id_1", "team_id_2"]
}
```

If you're unsure what your provider sends, inspect the received claims with the [SSO debug flow](../admin_ui_sso.md#debugging-sso-jwt-fields).

### Step 2: Create the teams on LiteLLM

The claim values must match the `team_id` of teams that already exist on LiteLLM. Teams are not auto-created from OIDC claims, and a claim value with no matching team is skipped.

```bash showLineNumbers title="Create team with team_id matching the SSO group value"
curl -X POST '<PROXY_BASE_URL>/team/new' \
-H 'Authorization: Bearer <PROXY_MASTER_KEY>' \
-H 'Content-Type: application/json' \
-d '{
    "team_alias": "team_1",
    "team_id": "team_id_1"
}'
```

### Step 3: Test the SSO flow

Log in via SSO and verify the user's team memberships on the UI (Internal Users page). Here's a [video walkthrough](https://www.loom.com/share/8959be458edf41fd85937452c29a33f3?sid=7ebd6d37-569a-4023-866e-e0cde67cb23e).

Some providers only include the groups claim in the access token, not in the userinfo response. In that case, configure the claim via `ui_access_mode`, which also decodes the access token. Note this form additionally restricts UI login to members of the given group:

```yaml showLineNumbers title="config.yaml"
general_settings:
  ui_access_mode:
    type: "restricted_sso_group"
    restricted_sso_group: "<group required for UI access>"
    sso_group_jwt_field: "groups"
```

For Microsoft Entra ID, group membership is read from the Microsoft Graph API instead; follow [this tutorial](../../tutorials/msft_sso.md). For SAML, team IDs come from assertion attributes; see [SAML roles and teams](#assign-roles-and-teams-through-saml).

## Restrict personal key creation {#restrict-personal-key-creation}

To limit personal key creation to proxy admins, set `key_generation_settings` in `config.yaml`. Personal keys have no team. LiteLLM enforces this restriction on `/key/generate`, so it applies to both the Admin UI and direct API calls.

```yaml
litellm_settings:
  key_generation_settings:
    personal_key_generation:
      allowed_user_roles: ["proxy_admin"]
```

See [Restricting Key Generation](../virtual_keys.md#restricting-key-generation) for all options.
