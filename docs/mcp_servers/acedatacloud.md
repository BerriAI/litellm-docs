# Ace Data Cloud media MCP servers

[简体中文](./acedatacloud_zh.md)

Connect Suno, Seedance, HappyHorse, GPT Image, or Nano Banana to the LiteLLM MCP Gateway. Each service has its own connection and tools. These integrations are maintained by Ace Data Cloud and require your own Ace API token. They are not official integrations from the model brands.

## Install and open the MCP Gateway

Install `litellm[proxy]` and follow the [Proxy quick start](https://docs.litellm.ai/docs/proxy/quick_start) for your deployment. Use a database-backed deployment with `store_model_in_db: true` when saving connections through the UI; see [MCP prerequisites](../mcp.md#prerequisites). Sign in with your LiteLLM administrator account, then open **MCP Servers**. The five discovery entries require the catalog integration described below; an older stable installation can use the manual connection route.

```bash
python -m pip install 'litellm[proxy]'
```

## Choose a service

Open **MCP Servers**, click **Add New MCP Server**, and search for the service name. Select its **by Ace Data Cloud** entry.

| Search | Connection | What it provides | Source |
| --- | --- | --- | --- |
| Suno | `https://suno.mcp.acedata.cloud/mcp` | Music, lyrics, covers, and task retrieval | [SunoMCP](https://github.com/AceDataCloud/SunoMCP) |
| Seedance | `https://seedance.mcp.acedata.cloud/mcp` | Text or image to video and task retrieval | [SeedanceMCP](https://github.com/AceDataCloud/SeedanceMCP) |
| HappyHorse or Happy Horse | `https://happyhorse.mcp.acedata.cloud/mcp` | Video generation, editing, and task retrieval | [HappyHorseMCP](https://github.com/AceDataCloud/HappyHorseMCP) |
| GPT Image | `https://openai.mcp.acedata.cloud/mcp` | Image generation and editing through the OpenAI MCP server, which also exposes chat, embedding, and audio tools | [OpenAIMCP](https://github.com/AceDataCloud/OpenAIMCP) |
| Nano Banana or NanoBanana | `https://nanobanana.mcp.acedata.cloud/mcp` | Image generation, editing, and task retrieval | [NanoBananaMCP](https://github.com/AceDataCloud/NanoBananaMCP) |

The discovery entries require a LiteLLM version containing [the media catalog integration](https://github.com/BerriAI/litellm/pull/47149). If your installation has no matching entry, use **Custom Server** with the endpoint above, **Streamable HTTP**, and **Bearer Token**. This manual route does not mean the entry is already included in your installed release.

![Five separate media service entries in the actual LiteLLM candidate UI](/img/acedatacloud/litellm-five-media-cards-candidate.jpg)

This is a real local candidate capture from October 18, 2026, at media-discovery commit `c2971654`. It shows the five separate service entries before official release, not proof that an installed stable version contains them.

## Get an API token

Register or sign in at [Ace Data Cloud Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_docs_api_key). If no General application exists, choose **Initialize General Application**. Open **General application**, check that the account can use your chosen service, and review its [current prices and balance](https://platform.acedata.cloud/models?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_docs_pricing) before generating anything.

Copy the existing API key using the copy button, or choose **Manage Keys** and **Create** to make a separate key named `LiteLLM media`. Apply expiration, spending, or API restrictions as needed. If you restrict Allowed APIs, include the selected service's generation and task-query APIs. A service-specific application key is limited to its service. Use a General application key only when you need its broader entitled access.

![Ace Applications, copy a key or open Manage Keys](https://raw.githubusercontent.com/AceDataCloud/SunoDify/8d3d03570e73324220f111f7fe343da0792a8071/_assets/tutorial/get-api-key-en.png)

![Create a separate Ace API key](https://raw.githubusercontent.com/AceDataCloud/SunoDify/8d3d03570e73324220f111f7fe343da0792a8071/_assets/tutorial/create-api-key-en.png)

These are redacted Ace console screenshots from the Suno Dify onboarding guide at reference commit `8d3d0357`, reused on October 18, 2026. The example key name in the image is `Dify tutorial`; use `LiteLLM media` for your new key. They show the shared key workflow, not LiteLLM installation or authentication success. Copy your real token value, not the redacted characters. Do not use an Account Token for the platform management API.

## Connect in LiteLLM

In a release containing the media catalog change, the selected discovery card fills the server name, endpoint, Streamable HTTP transport, and Bearer Token authentication. Paste only the Ace token into **Authentication Value**, without `Bearer ` or quotes. Leave OAuth and custom Authorization headers unset when using this token route.

The authenticated discovery preset waits for a nonblank token before testing the connection. Follow **Get your API token** to Applications if needed. Clicking **Add MCP Server** with an empty token displays a required-field error and does not submit; the button itself remains clickable.

![Real candidate shows the empty password field and token-acquisition link](/img/acedatacloud/litellm-suno-required-token-fixed.jpg)

The token-first form was captured with normal local product login on October 18 at commit `166f54e3`, without an Ace key or server creation. The subsequent `6ed14e00` change only splits an equivalent condition for lint and does not change the form markup. These images are candidate interaction evidence, not remote authentication, final media output, billing, or official release proof.


Check the connection and credential scope, then choose **Add MCP Server**. Open the server's **MCP Tools** tab. Do not grant tools to all teams or keys by default. Use [MCP Permission Management](../mcp_control.md) to give the intended users access. Storing connections through the UI needs `store_model_in_db: true`, as described in [MCP prerequisites](../mcp.md#prerequisites).

For a configuration-file deployment, this example connects only Suno. Use a separate entry and secret for another service.

```yaml title="config.yaml"
mcp_servers:
  suno_acedatacloud:
    url: https://suno.mcp.acedata.cloud/mcp
    transport: http
    auth_type: bearer_token
    auth_value: os.environ/ACEDATACLOUD_SUNO_API_TOKEN
    description: Suno music through Ace Data Cloud
```

Keep the token in your deployment secret store. Do not put it in prompts, screenshots, Git, or exported configurations. An administrator-managed token represents its owner for every caller who can use this connection. The endpoints also support OAuth, but that is a separate setup from the explicit Bearer-token route here.

## First use and asynchronous results

A loaded tool list confirms the MCP connection, not API permissions, balance, successful generation, or billing. Start with a reference tool where available.

| Service | Reference tool | Generation and result tools | Current API guide |
| --- | --- | --- | --- |
| Suno | `suno_list_models` | `suno_generate_music`, then `suno_get_task` | [Suno](https://platform.acedata.cloud/documents/suno-audios?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_suno_first_use) |
| Seedance | `seedance_list_models` | `seedance_generate_video`, then `seedance_get_task` | [Seedance](https://platform.acedata.cloud/documents/seedance-videos?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_seedance_first_use) |
| HappyHorse | `happyhorse_list_models` | `happyhorse_generate_video`, then `happyhorse_get_task` | [HappyHorse](https://platform.acedata.cloud/documents/happyhorse-videos?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_happyhorse_first_use) |
| GPT Image | `openai_list_image_models` | `openai_generate_image`, then `openai_get_task` when a task ID is returned | [GPT Image](https://platform.acedata.cloud/documents/openai?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_gpt_image_first_use) |
| Nano Banana | Inspect its tools and input schema | `nanobanana_generate_image`, then `nanobanana_get_task` | [Nano Banana](https://platform.acedata.cloud/documents/nanobanana-images?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_nano_banana_first_use) |

Use the current tool schema for model names and parameters. Generation and edits may be billed. Submit once with automatic paid retries off, save the task ID, and query that same ID until terminal success or failure. Do not submit another generation to check progress. A running task or preview URL is not a finished result. Only share final media from a successful terminal response. Query pricing follows the selected service's current rules.

For a first Suno run after checking access and cost, ask the agent to call `suno_generate_music` with a short instrumental prompt, keep its task ID, and call `suno_get_task` until completion. If the wait expires, continue querying that ID rather than restarting the generation. A green LiteLLM tool call alone is not proof that the media task completed.

## Troubleshooting and cost

| Symptom | Check |
| --- | --- |
| No discovery match | Confirm the installed LiteLLM version includes the entry. Use the full service name or the listed alternate spelling. |
| 401 | Confirm you used the business API token, selected Bearer Token, and omitted an extra `Bearer ` prefix. |
| 403 | Read the error. Check service access, token restrictions, and moderation results separately. |
| Pending or no final URL | Query the same task ID. Do not regenerate for polling. |
| 429 | Reduce concurrency and wait. Do not enable automatic paid retries. |
| Failed task or 5xx | Inspect the original task and request history before deciding to resubmit. |
| Media URL fails | Check terminal status and network access to the returned URL. |

Ace settles API usage in Credits. Its effective USD value depends on the current recharge package. LiteLLM's optional per-tool cost settings are an administrator's estimate and are not a reconciliation of the final Ace bill. Do not reuse the text-model token price for music, video, or images. Confirm the original request, terminal task result, and Ace usage record before treating a generation as billed exactly once.

[Source and support](https://github.com/AceDataCloud/MCPs) are maintained by Ace Data Cloud. Use [Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=litellm_media_docs_support_key) to revoke or rotate a key independently. API requests and generated media follow the selected service's current terms and pricing.
