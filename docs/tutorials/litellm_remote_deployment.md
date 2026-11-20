---
title: Set up the LiteLLM Remote service
description: Configure the LiteLLM Remote service, gateway discovery, and Mac connectors so users can continue agent sessions from their phones.
---

# Set up the LiteLLM Remote service

{/* keep-version-note */}

This guide is for administrators who set up the remote service. For day-to-day use, see [LiteLLM Remote](./litellm_remote.md).

Remote control connects your gateway, Mac, and phone. The shared service handles sign-in and routes phone actions. A connector on each Mac controls the installed agent. The iOS and Android apps connect to the shared service. Inference continues through your configured LiteLLM gateway.

## Deploy the shared service

Use an approved Relay build that includes `remote serve`. The service runs inside the existing Relay binary. You do not need a separate Node application or a new container image.

Set two environment variables on the service host. `LITELLM_GATEWAY_URL` is your HTTPS gateway origin. `REMOTE_PUBLIC_URL` is the HTTPS origin where phones and Macs reach the control service, without a path suffix. Neither URL has a built-in value.

Run the service under your usual process supervisor.

```bash
relay remote serve --listen 127.0.0.1:4174
```

State defaults to `remote/control.sqlite` under Relay's home directory. Use `--state <path>` to choose a writable path on persistent storage.

Put your existing HTTPS ingress in front of the listener. Forward service requests, allow WebSocket upgrades on `/agent`, and use an idle timeout suitable for a long-lived connection. Keep port 4174 private. The loopback listener assumes the ingress is on the same host or network namespace. For a separate ingress, bind a private interface and restrict access to that ingress.

Use a single service instance for this preview. Device connections live in that process, and the service uses a local SQLite state file. It has no shared routing layer for multiple replicas. Back up the state file with a SQLite-aware backup or stop the service before copying it.

The state file contains account ownership, hashed phone and device tokens, model IDs, and request outcomes. It does not store transcripts or gateway inference credentials. Conversation content passes through the service to the phone, so treat the service and its TLS ingress as trusted infrastructure. Transcripts remain on the Mac. Restrict access to the service state and logs.

The gateway must support `/sso/cli/start` and `/sso/cli/poll/{login_id}`. A static gateway key alone does not provide mobile sign-in. Confirm your gateway's CLI SSO flow works before enrolling users. See [CLI SSO](../proxy/cli_sso.md).

### Let users enter only their gateway URL

On your gateway ingress, route `/.well-known/litellm-remote.json` to the same path on the remote service. Keep existing gateway API routes unchanged. The service returns the gateway and service origins from its configuration.

If you cannot add this route, give users the service HTTPS address to enter under **Advanced** in the app. Both options validate that the service belongs to the gateway the user entered. No Mac address or socket URL is distributed to users.

### Check connectivity

With the public URL set in your shell, check the service through its HTTPS ingress.

```bash
curl --fail --show-error "$REMOTE_PUBLIC_URL/healthz"
curl --fail --show-error "$LITELLM_GATEWAY_URL/.well-known/litellm-remote.json"
```

The health response contains `"status":"ok"`. Discovery must identify your configured gateway and remote service. If you use manual Advanced setup instead of discovery at the gateway, check the discovery path on `REMOTE_PUBLIC_URL` instead.

Both apps require HTTPS for the gateway, including localhost. Private certificates must be trusted by the phone. The Mac connector uses the operating system's certificate roots for WSS and does not fall back to insecure TLS. If either address requires a VPN or WARP, give users a managed phone enrollment profile as well as Mac access.

## Enroll Macs

Install a Relay build with the remote commands and configure Claude Code or Codex through your gateway first. For a fresh Codex configuration, specify a model your gateway serves with `relay onboard-codex --model <gateway-model-id>`.

Set `LITELLM_REMOTE_URL` to the service's HTTPS origin on each Mac. As the same local user who runs the agent, run `relay remote pair`, complete gateway sign-in, then leave `relay remote connect` running. Relay's MDM installer and RelayBar do not supervise this connector in the preview. Arrange a per-user process supervisor separately if you need it to survive terminal closure.

Codex needs its shared app-server control socket. The default is under `CODEX_HOME`, or `~/.codex` when unset. Use `relay remote connect --codex-socket <path>` for a different socket and `--provider <id>` if the configured provider is not `litellm`.

Claude uses the installed native Claude Code executable and its existing settings. `--claude-executable <path>` selects a different binary. `CLAUDE_CONFIG_DIR` selects a different settings and transcript directory. Existing conversations need the [handoff procedure](./litellm_remote.md#claude-code). New phone-created conversations do not.

The inference broker's signed-caller checks support macOS only. On Linux, agents must use the gateway directly with a virtual key. Do not disable caller checks to make the broker work there.
