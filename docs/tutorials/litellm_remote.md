---
title: LiteLLM Remote
description: Continue Claude Code and Codex sessions from your iPhone or Android phone while model requests use your LiteLLM gateway.
---

# LiteLLM Remote

{/* keep-version-note */}

LiteLLM Remote lets you continue Claude Code and Codex conversations from a native iPhone or Android app. You can send messages, start sessions, choose a model, review supported tool approvals, and stop a running turn.

Your agent still runs on your Mac, using the files and tools there. Model requests still go through your LiteLLM gateway. You do not need to enter your Mac's IP address or open a port on your router.

:::note Preview

Ask your administrator for the mobile preview app and your remote-service address.

:::

## Before you start

Your administrator must [deploy the remote service](./litellm_remote_deployment.md). You need a Mac with a Relay build that includes `relay remote`, your chosen agent already configured through the gateway, and the mobile preview app. The iOS app requires iOS 18 or later. The Android app requires Android 9 or later.

Keep the Mac awake and connected to your organization's network. If the gateway or remote service requires a VPN or Cloudflare WARP, enroll your phone with your organization's approved profile too. The app does not set up that connection for you.

## Connect your Mac

Ask your administrator for the remote-service HTTPS address. This is the shared service address, not your Mac's address or the gateway's inference endpoint.

Set `LITELLM_REMOTE_URL` to that address in your terminal, then run the following commands as the same Mac user who runs Claude Code or Codex.

```bash
relay remote pair
relay remote connect
```

Pairing opens the gateway sign-in page. Enter the code printed in the terminal, sign in with your work account, and choose your team if prompted. Leave `relay remote connect` running. Closing it disconnects the Mac from the phone app.

Pairing is separate from Relay installation. An MDM installation does not start or supervise the remote connector in this preview.

## Sign in on your phone

Open LiteLLM Remote and enter your organization's HTTPS gateway URL in **LiteLLM Gateway**. Tap **Continue**, then **Sign in with LiteLLM**. Tap **Open secure sign-in**, enter the code shown in the app, and sign in with the same account and team you used on the Mac. Return to the app when sign-in finishes.

Your gateway can supply the remote-service address automatically. If it does not, expand **Advanced** before tapping Continue and enter the remote-service address your administrator provided. You never need a separate socket address.

The **Devices** tab shows your paired Mac. Open **Sessions** to choose a conversation.

:::info HTTPS is required

Both apps require an HTTPS gateway URL, even for localhost. A local HTTP gateway needs a TLS frontend whose certificate your phone trusts. On a physical phone, localhost refers to the phone, not your Mac.

:::

## Continue a conversation

### Codex

Open an existing Codex conversation from Sessions and send a message. The connector uses Codex's shared local control process, so you do not need to hand over the conversation manually. Codex must expose its shared app-server control socket for your Mac user. If a turn is running, wait for it to finish or stop it before sending another message.

### Claude Code

An existing terminal conversation needs a one-time handoff. Finish its current turn and any pending tools on the Mac, then run `/exit`.

In your terminal, open the handoff picker.

```bash
relay remote handoff
```

Choose the conversation by its title, project, and last-updated time. You do not need to find or copy a UUID. Keep the connector running and open the conversation on your phone. It resumes the saved context. An in-flight tool or unsaved process state does not move to the phone.

To return to the terminal, stop the current turn, stop the connector with Ctrl+C, and run `claude --resume` to choose the conversation. Do not run two writers against the same Claude conversation.

## Start a new session

From Sessions, choose **New session**, select **Claude Code** or **Codex**, and enter the full path to a project folder on your Mac. You can also choose a recent folder. Tap **Start session**, then send your first message. The folder must already exist on the Mac. It is not a folder on your phone.

New Claude sessions started from the phone do not need handoff. For either agent, use the model dropdown above the message box to choose a model from your gateway catalog. You can change it between turns, not during a running turn.

## Tools, approvals, and Stop

When an agent needs permission, the conversation shows a pending approval with the available command or file-change details. Review it before allowing or declining the request. A mobile approval applies to that request only.

Requests with incomplete file diffs, oversized details, or unsupported interactive questions must be reviewed on the Mac. Persistent permission grants are not available from the phone. Remote control does not bypass the agent's normal permissions.

Use **Stop** to cancel the current turn. This does not undo file edits or commands that already ran. If the connection drops before you receive confirmation, refresh the conversation before sending the same message again.

## Disconnect a device

In Devices, open the Mac's menu and choose **Disconnect device**. This revokes its remote access without deleting its local conversations or project files. Pair it again to reconnect. Signing out in Account revokes that phone's app session.

## Troubleshooting

### My Mac is missing or offline

Check that `relay remote connect` is still running, the Mac is awake, and both devices use the same service, gateway account, and team. Check the VPN or WARP connection on each device. The phone and Mac do not need to share a Wi-Fi network.

### My Claude conversation is read-only

Finish all tools, exit the terminal conversation, and run `relay remote handoff` to choose it. A terminal conversation that has not been handed over cannot accept phone messages.

### My model is missing or rejected

Use the exact model ID your gateway serves. Your administrator can set it in Relay’s managed Codex configuration. For manual setup, use the existing `relay onboard-codex --model <gateway-model-id>` command. You do not need to repeat onboarding if Codex already works through your gateway. Sign in to the app again after your gateway model permissions change.

### I see a certificate error or a different-gateway error

Ask your administrator to check the TLS certificate and discovery configuration. The gateway and service must identify the same gateway. Do not work around certificate errors by disabling verification.
