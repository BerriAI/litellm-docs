---
title: MCP upstream authentication
sidebar_label: Overview
description: Choose how LiteLLM authenticates to MCP servers with API keys, OAuth, user credentials, or signed requests.
---

# MCP upstream authentication

{/* keep-version-note */}

Upstream authentication is how LiteLLM authenticates to an MCP server. Configure credentials for each server, or let users connect with their own accounts.

| Direction | What to configure |
| --- | --- |
| **Client → LiteLLM** | Use [Authentication](./proxy/authentication.md) to configure how users and applications authenticate to the gateway. |
| **LiteLLM → MCP server** | Use the guides below to configure the credentials that LiteLLM sends to each MCP server. |

## Choose an authentication method

| The MCP server requires | Guide |
| --- | --- |
| A shared API key, bearer token, username and password, or custom header | [API keys and HTTP authentication](./mcp_authentication.md) |
| Each user to supply their own credentials | [Per-user credentials](./mcp_per_user_auth.md) |
| Users to sign in through OAuth | [OAuth authorization code flow with PKCE](./mcp_oauth.md#interactive-oauth-pkce) |
| A service to authenticate with an OAuth client ID and secret | [OAuth client credentials](./mcp_oauth.md#machine-to-machine-m2m-auth) |
| An OAuth token that the client already has for that server | [OAuth token passthrough](./mcp_oauth_passthrough.md) |
| A token exchanged for the target MCP server | [Token exchange (OBO)](./mcp_obo_auth.md) or [ID-JAG](./mcp_id_jag.md) |
| AWS request signing | [AWS SigV4](./mcp_aws_sigv4.md) |
| Proof that tool calls came through LiteLLM | [JWT signing](./mcp_zero_trust.md) |

For a server that requires no credentials, use [`auth_type: none`](./mcp_authentication.md#none).

## Configure access separately

Use [MCP Access](./proxy/access_management/mcp.md) to choose which servers and tools each team or Virtual Key can use.

In `true_passthrough` mode, the MCP server handles authentication and authorization. Use `oauth_delegate` when you also need LiteLLM authentication and permissions.

For client request headers, see the [MCP and agent gateway reference](./auth_overview.md#1-client--litellm-authenticating-the-caller).
