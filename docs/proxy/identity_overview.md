---
title: Identity overview
sidebar_label: Identity overview
description: How LiteLLM connects to your identity provider. Compare Admin UI SSO with gateway sign-in for users, map IdP groups to LiteLLM teams, keep users in sync with SCIM, and see where JWT auth fits.
---

# Identity overview

Your identity provider (IdP), for example Microsoft Entra ID, Okta or Google Workspace, can control access to LiteLLM in two places:

- **The Admin UI.** People sign in to the LiteLLM dashboard with SSO. The IdP sets who can sign in and which LiteLLM role each person gets.
- **The gateway.** Developers and apps call models with their IdP identity. LiteLLM puts each user in the correct teams and applies the models, budgets and rate limits of those teams.

You can set up one place or both. Most teams start with the Admin UI and then connect the gateway.

## Choose what you need

| You want to | Use |
|---|---|
| Let admins and users sign in to the dashboard with the IdP | [Admin UI SSO](./admin_ui_sso.md) (OIDC) or [SAML SSO](./saml_sso.md) |
| Give users the models, budgets and limits of their IdP groups | [Map groups to teams](#map-groups-to-teams) |
| Add and remove users and teams when the IdP changes | [SCIM provisioning](../tutorials/scim_litellm.md) |
| Let developers get a LiteLLM key from the terminal with SSO | [CLI sign-in](./cli_sso.md) |
| Let apps send IdP tokens in place of LiteLLM virtual keys | [JWT auth](./token_auth.md) |
| Give each JWT client its own key, limits and spend tracking | [JWT to virtual key mapping](./jwt_key_mapping.md) |

## Admin UI SSO

Admin UI SSO controls sign-in to the LiteLLM dashboard. LiteLLM supports OIDC providers (Google, Microsoft, Okta and generic OIDC) and SAML 2.0.

After sign-in, users can see their teams, create virtual keys and look at their spend. The IdP can also set each user's LiteLLM role, for example with Entra app roles or the SAML role attribute.

<EnterpriseFeature feature="SSO">SSO is free for up to 5 users. Beyond that, an enterprise license is required.</EnterpriseFeature>

Admin UI SSO does not control API calls by itself. A virtual key that a user creates stays active until an admin blocks it or SCIM deprovisions the user.

## Map groups to teams

In LiteLLM, a [team](./access_control.md) holds the allowed models, the budget and the rate limits. When your IdP groups map to LiteLLM teams, the IdP decides what each user can do. You do not add users to teams by hand.

LiteLLM has more than one method to map groups to teams. The methods differ in when membership updates and in who creates the teams.

| Method | When membership updates | Creates teams |
|---|---|---|
| [OIDC group claim](./admin_ui_sso.md#auto-add-sso-users-to-teams-oidc) (`team_ids_jwt_field`) | At each Admin UI sign-in | No. Create the teams first. |
| [SAML team attribute](./saml_sso.md#attribute-mapping) (`SAML_ATTRIBUTE_TEAM_IDS`) | At each Admin UI sign-in | No. Create the teams first. |
| [Microsoft Entra ID group sync](../tutorials/msft_sso.md) | At each Admin UI sign-in | Yes, from the groups assigned to the Entra app |
| [SCIM provisioning](../tutorials/scim_litellm.md) | When the group changes in the IdP | Yes, one team for each SCIM group |
| [JWT auth team claim](./token_auth.md#control-model-access-with-teams) | On each API request | No. Create the teams first. |

For the methods that do not create teams, give each LiteLLM team a `team_id` that is the same as the group ID in the token. LiteLLM skips group IDs that do not match a team.

## Keep users in sync with SCIM

Sign-in mapping updates a user only when that user signs in. If you remove a user from the IdP, their existing virtual keys stay active.

SCIM fixes this. The IdP sends user and group changes to LiteLLM as they occur. When the IdP deprovisions a user, LiteLLM blocks all virtual keys of that user at once. LiteLLM keeps the keys for spend history.

Use SCIM when offboarding must take effect immediately. SCIM does not create virtual keys. For keys, use CLI sign-in or JWT auth.

## JWT auth and OIDC

[JWT auth](./token_auth.md) lets apps send an IdP token on API requests in place of a virtual key. LiteLLM checks the token signature against the public keys of the IdP. Then it reads the user, team and role claims from the token.

The docs use "OIDC JWT auth" and "JWT auth" for the same feature. For example, Claude Desktop can send the Entra ID or Okta token of the user to LiteLLM. See [Claude Desktop and Cowork](../tutorials/claude_desktop_cowork.md).

:::note
[OpenID Connect (OIDC) for providers](../oidc.md) is a different feature. It lets LiteLLM authenticate to upstream LLM providers with OIDC tokens. It does not sign in your users.
:::

## Recommended rollout

1. Set up Admin UI SSO and make yourself a proxy admin.
2. Map IdP groups to LiteLLM teams. Set the models, budgets and limits for each team.
3. Add SCIM if you must remove access as soon as a user leaves.
4. Connect clients. Use CLI sign-in for developer tools, or JWT auth for apps that send IdP tokens.

For a full example that combines SCIM, JWT auth and CLI sign-in, see [Provisioning and keys](./identity_provisioning.md).

## Provider guides

- [Microsoft Entra ID](./entra_id_sso.md)
- [Okta for Claude Code](../tutorials/claude_code_okta_sso.md)
- [SAML 2.0 setup for Okta and Entra ID](./saml_sso.md#idp-setup-guides)
