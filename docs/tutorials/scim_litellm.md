
import Image from '@theme/IdealImage';


# SCIM with LiteLLM

✨ **Enterprise**: SCIM support requires a premium license.

Enables identity providers (Okta, Azure AD, OneLogin, etc.) to automate user and team (group) provisioning, updates, and deprovisioning on LiteLLM.


This tutorial will walk you through the steps to connect your IDP to LiteLLM SCIM Endpoints.

### Supported SSO Providers for SCIM
Below is a list of supported SSO providers for connecting to LiteLLM SCIM Endpoints.
- Microsoft Entra ID (Azure AD)
- Okta
- Google Workspace
- OneLogin
- Keycloak
- Auth0


## 1. Get your SCIM Tenant URL and Bearer Token

On LiteLLM, navigate to the Settings > Admin Settings > SCIM. On this page you will create a SCIM Token, this allows your IDP to authenticate to litellm `/scim` endpoints.

<Image img={require('../../img/scim_2.png')}  style={{ width: '800px', height: 'auto' }} />

## 2. Connect your IDP to LiteLLM SCIM Endpoints

On your IDP provider, navigate to your SSO application and select `Provisioning` > `New provisioning configuration`.

On this page, paste in your litellm scim tenant url and bearer token.

Once this is pasted in, click on `Test Connection` to ensure your IDP can authenticate to the LiteLLM SCIM endpoints.

<Image img={require('../../img/scim_4.png')}  style={{ width: '800px', height: 'auto' }} />


## 3. Test SCIM Connection

### 3.1 Assign the group to your LiteLLM Enterprise App

On your IDP Portal, navigate to `Enterprise Applications` > Select your litellm app 

<Image img={require('../../img/msft_enterprise_app.png')}  style={{ width: '800px', height: 'auto' }} />

<br />
<br />

Once you've selected your litellm app, click on `Users and Groups` > `Add user/group` 

<Image img={require('../../img/msft_enterprise_assign_group.png')}  style={{ width: '800px', height: 'auto' }} />

<br />

Now select the group you created in step 1.1. And add it to the LiteLLM Enterprise App. At this point we have added `Production LLM Evals Group` to the LiteLLM Enterprise App. The next step is having LiteLLM automatically create the `Production LLM Evals Group` on the LiteLLM DB when a new user signs in.

<Image img={require('../../img/msft_enterprise_select_group.png')}  style={{ width: '800px', height: 'auto' }} />


### 3.2 Sign in to LiteLLM UI via SSO

Sign into the LiteLLM UI via SSO. You should be redirected to the Entra ID SSO page. This SSO sign in flow will trigger LiteLLM to fetch the latest Groups and Members from Azure Entra ID.

<Image img={require('../../img/msft_sso_sign_in.png')}  style={{ width: '800px', height: 'auto' }} />

### 3.3 Check the new team on LiteLLM UI

On the LiteLLM UI, Navigate to `Teams`, You should see the new team `Production LLM Evals Group` auto-created on LiteLLM. 

<Image img={require('../../img/msft_auto_team.png')}  style={{ width: '900px', height: 'auto' }} />

> **Note:** When a user is removed from your organization via SCIM, every virtual key that user owns is blocked and evicted from the auth cache, so they lose all access immediately. See [Deactivation and deprovisioning](#deactivation-and-deprovisioning) below.

## User attribute mapping

LiteLLM reads a fixed set of attributes off the SCIM user your IDP sends to `POST /scim/v2/Users` and `PUT /scim/v2/Users/{id}`. Anything not listed here is ignored.

| SCIM attribute | Stored as | Notes |
|---|---|---|
| `userName` | `user_id` | Used verbatim as the LiteLLM user id. A random UUID is generated when absent. |
| `emails[0].value` | `user_email` | Positional, so the first entry wins whether or not it is marked `primary`. |
| `name.givenName` | `user_alias`, and `metadata.scim_metadata.givenName` | LiteLLM derives the alias from the given name, not from `displayName`. |
| `name.familyName` | `metadata.scim_metadata.familyName` | |
| `groups[].value` | `teams` | Each group value is treated as an existing LiteLLM `team_id`. |
| `externalId` | `sso_user_id` | Persisted on `PUT` and `PATCH` only. `POST` does not store it, so a newly provisioned user has no `sso_user_id` until the first update. |
| `active` | `metadata.scim_active` | Honored on `PUT` and `PATCH` only. A `POST` carrying `active: false` creates an active user. |
| `entitlements`, `roles` | `metadata.scim_entitlements`, `metadata.scim_roles` | Recorded so they round-trip on reads. LiteLLM grants nothing from them. |
| `urn:ietf:params:scim:schemas:extension:enterprise:2.0:User` | `metadata.scim_enterprise` | Recorded so it round-trips on reads. |

`displayName` is ignored on `POST` and `PUT`, but a `PATCH` targeting `displayName` does write `user_alias`, so the alias reflects whichever verb ran last.

Reads are not symmetric with writes. `GET /scim/v2/Users` returns `userName` and `displayName` built from `user_email`, while writes take `userName` as the `user_id`, and `externalId` is never echoed back. The `GET` filter compensates by matching `userName eq` against both `user_email` and `user_id`, which is how Okta finds a user it created before a lifecycle change.

## Provisioning a user who already exists

Two different collisions are handled two different ways, checked in this order.

A `POST` whose `userName` matches an existing LiteLLM `user_id` is rejected with `409 Conflict`. This is the ordinary case, and IDPs treat it as "already provisioned" then follow with a `PUT` or `PATCH`.

A `POST` whose `userName` is new but whose `emails[0].value` matches an existing user is upserted rather than rejected. LiteLLM rewrites the existing row's `user_id` to the incoming `userName`, reconciles team membership against the incoming `groups`, then overwrites `user_email`, `user_alias`, `teams`, and the whole `metadata` object. The response is `201` even though nothing was created. Because the row is renamed rather than duplicated, keys, memberships, and spend history follow the user through a `userName` change instead of splitting across two records. If you would rather that fail loudly, keep `userName` stable in your IDP profile mapping.

`litellm_settings.scim_upsert_user` does not govern this. That setting controls group member resolution only: with the default `true`, a `PUT` or `PATCH` on a group creates users for member ids LiteLLM has never seen, and with `false` those requests fail with `400` asking you to create the user first. It has no effect on the email match in `POST /Users`.

## Assigning the proxy admin role

By default a SCIM-provisioned user gets the role in `litellm_settings.default_internal_user_params.user_role`, falling back to `internal_user_view_only`, and LiteLLM never changes an existing user's role.

Set `scim_admin_group` to have group membership drive the global role instead:

```yaml title="config.yaml"
litellm_settings:
  scim_admin_group: "litellm-admins"
```

The value is matched against each group's `value` or its `display` name. A user in that group becomes `proxy_admin`, and everyone else falls back to the default role above. Because that fallback is applied on every write, removing someone from the admin group demotes them on the next sync. Leaving `scim_admin_group` unset is the default-safe choice, since roles you set in the UI or over the management API are then never touched by SCIM.

## Deactivation and deprovisioning

Setting `active: false` over `PUT` or `PATCH` blocks every virtual key the user owns and invalidates them in the auth cache, so access stops immediately. Each key blocked this way is tagged in its metadata, and reactivating the user unblocks only those, leaving a key an admin blocked by hand alone. A `PUT` that omits `active` entirely preserves the prior state rather than reactivating the user.

`DELETE /scim/v2/Users/{id}` removes the user from every team, blocks their keys, drops their invitation links, organization memberships, and team memberships, then deletes the user row. The keys are blocked rather than deleted, so they stop working immediately and stay in the database for spend history.
