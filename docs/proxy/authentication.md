---
title: Authentication
sidebar_label: Overview
description: Choose how users and applications authenticate to LiteLLM.
---

# Authentication

{/* keep-version-note */}

Authentication identifies the user or application calling LiteLLM or signing in to the Admin UI.

Configure what that identity can use and manage in [Access Management](./access_management/overview.md).

For LiteLLM connecting to MCP servers, see [MCP upstream authentication](../mcp_upstream_auth.md).

## Choose a flow

| Flow | When to use it | Guides |
| --- | --- | --- |
| Virtual Keys | Call the gateway with a LiteLLM credential. | [Use a Virtual Key](./api_key_auth.md) |
| Single sign-on | Sign in with your organization's identity provider. | [OIDC](./admin_ui_sso.md), [SAML](./saml_sso.md) |
| Identity mapping | Connect an identity provider's token to a LiteLLM identity. | [Users and teams](./jwt_user_team_auth.md), [Virtual Keys](./jwt_key_mapping.md) |
| ID-JAG | Let an application act on a signed-in user's behalf across services. | [ID-JAG](./id_jag/overview.md) |
| Custom Auth | Authenticate callers with your own handler. | [Custom Auth](./custom_auth.md) |

## Single sign-on

Use [OpenID Connect (OIDC)](./admin_ui_sso.md), the identity layer built on OAuth 2.0, to sign in to the Admin UI. [SAML](./saml_sso.md) is an alternative when your organization uses SAML for sign-in.

## Identity mapping

Applications can send an identity provider's JWT directly to LiteLLM. LiteLLM verifies the token, then maps its claims to [users and teams](./jwt_user_team_auth.md) or an existing [Virtual Key](./jwt_key_mapping.md).

For machine-to-machine requests, map the claims that identify the application or workload.

## Delegated identity

[ID-JAG](./id_jag/overview.md) connects applications acting on a signed-in user's behalf. Use it when another application needs to call LiteLLM for that user, or when LiteLLM needs to call an MCP server for them.

The identity provider and the target service's authorization server must support ID-JAG.
