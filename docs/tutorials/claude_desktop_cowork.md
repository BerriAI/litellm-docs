# Claude Desktop (Cowork) Integration

Route Claude Desktop requests through LiteLLM Proxy to get unified logging, budget controls, and access to any model.

<iframe width="840" height="500" src="https://www.loom.com/embed/adb864c1f7c74de3bfc9584ca6d32080" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

---

## Quick Reference

| Setting | Value |
|---------|-------|
| Gateway URL | `<LITELLM_PROXY_BASE_URL>` |
| API Key | Your LiteLLM Virtual Key |

---

## Step 1: Enable Developer Mode

In Claude Desktop, go to **Help → Claude → Help** and click **Enable Developer Mode**.

![](https://colony-recorder.s3.amazonaws.com/files/2026-04-22/64274593-33e6-4a7b-a7f3-a08f8aea8209/ascreenshot_8a9c909a978544888dafb6e0c7e3f468_text_export.jpeg)

---

## Step 2: Open Configure Third-Party Inference

Click the **menu bar** icon to open the Claude menu.

![](https://colony-recorder.s3.amazonaws.com/files/2026-04-22/66110720-1f11-4a1f-8a0a-a59498bc3290/ascreenshot_c674301e5a4a4ecf8cf000bbbef55aa6_text_export.jpeg)

Click **Developer**.

![](https://colony-recorder.s3.amazonaws.com/files/2026-04-22/2fcad657-4f8c-4dc2-b9ff-597de4e98030/ascreenshot_241063b192ae4c75996aaefdab991f13_text_export.jpeg)

Click **Configure Third-Party Inference…**

![](https://colony-recorder.s3.amazonaws.com/files/2026-04-22/dbb36dff-bbbe-4ddd-b30e-25b2c41bff47/ascreenshot_a7516b203052432f9a1d08cbe92cd214_text_export.jpeg)

---

## Step 3: Enter Your LiteLLM Gateway URL and API Key

The inference settings dialog opens. Enter your LiteLLM Proxy URL in the **Gateway URL** field.

![](https://colony-recorder.s3.amazonaws.com/files/2026-04-22/2d0daa12-d874-42ca-bc3e-f38c27c701e4/ascreenshot_8c8be28828974c10ab53124fa13e67c3_text_export.jpeg)

```
https://your-litellm-proxy.com
```

Next, get your virtual API key from the LiteLLM Dashboard. Go to **Virtual Keys → + Create New Key**, copy the key, then paste it into the **API Key** field.

![](https://colony-recorder.s3.amazonaws.com/files/2026-04-22/6a5b1233-de81-48be-8a17-e026d3dd9b49/ascreenshot_23dbd432db6d4f90ab5b0d598edd5a40_text_export.jpeg)

Save the settings.

![](https://colony-recorder.s3.amazonaws.com/files/2026-04-22/70e429ad-9e42-4936-a691-725701e802bc/ascreenshot_ffc156c61ed44cb7989f417dc38233b6_text_export.jpeg)

---

## Step 4: Verify Your Setup

Restart Claude Desktop. Open a new conversation and send a message. All requests now route through your LiteLLM Proxy.

![](https://colony-recorder.s3.amazonaws.com/files/2026-04-22/9e72faf1-0b5e-49d5-8ac4-b64dcd2b2f94/ascreenshot_813a1b584a1f4523ab7f7702f5985be0_text_export.jpeg)

You can verify traffic is flowing by checking the LiteLLM Dashboard under **Usage** — you should see requests attributed to your virtual key.

---

## Related

- [LiteLLM Virtual Keys](../proxy/virtual_keys.md)
- [Cursor Integration](cursor_integration.md)
- [Claude Code Integration](claude_responses_api.md)
