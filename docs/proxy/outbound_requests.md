# Outbound Requests and Offline Mode

LiteLLM sends requests to the providers, callbacks, guardrails, secret managers and SSO servers you configure. It also makes a few requests on its own, to fetch catalogs that change more often than LiteLLM is released. This page lists those requests and shows how to turn them off for air-gapped or egress-restricted deployments.

## Turn on offline mode

Set `LITELLM_OFFLINE_MODE=true` on the proxy to stop every request in the table below:

```shell
export LITELLM_OFFLINE_MODE=true
litellm --config config.yaml
```

Set it as an environment variable on every proxy instance. It can't be set in `config.yaml`, because the model cost map loads before the config is read.

Only `true` turns it on, in any letter case. Any other value, such as `1` or `yes`, leaves it off.

## Requests offline mode stops

| What | Host | When | With offline mode on | Per-feature switch |
|---|---|---|---|---|
| Model cost map | `raw.githubusercontent.com`, or `LITELLM_MODEL_COST_MAP_URL` | Startup, `/reload/model_cost_map` and the scheduled cost map reload | Uses the copy bundled with the package | `LITELLM_LOCAL_MODEL_COST_MAP=true` |
| Anthropic beta headers | `raw.githubusercontent.com`, or `LITELLM_ANTHROPIC_BETA_HEADERS_URL` | First Anthropic or Bedrock request that sends a beta header, `/reload/anthropic_beta_headers` and its scheduled reload | Uses the bundled copy | `LITELLM_LOCAL_ANTHROPIC_BETA_HEADERS=true` |
| Auto router presets | `raw.githubusercontent.com`, or `LITELLM_AUTOROUTER_PRESETS_URL` | `/public/autorouter_presets`, called by the Admin UI auto router form | Uses the bundled copy | `LITELLM_LOCAL_AUTOROUTER_PRESETS=true` |
| Policy templates | `raw.githubusercontent.com` | `/policy/templates`, called by the Admin UI Policies page | Uses the bundled copy | `LITELLM_LOCAL_POLICY_TEMPLATES=true` |
| Blog posts | `docs.litellm.ai`, or `LITELLM_BLOG_POSTS_URL` | `/public/litellm_blog_posts`, called by the Admin UI Home page and Blog menu | Uses the bundled copy | `LITELLM_LOCAL_BLOG_POSTS=true` |
| Latest release | `docs.litellm.ai` and `api.github.com` | `/get/latest_release_info`, called by the Admin UI notifications bell | Returns `null`, so no upgrade notice shows | `LITELLM_DISABLE_LATEST_RELEASE_CHECK=true` |
| Breached password check | `api.pwnedpasswords.com` | Setting or changing a user password, and password login | Skipped | `general_settings.password_policy_check_breached_passwords: false` |
| Hugging Face tokenizers | `huggingface.co` | Token counting for Cohere, Llama 2 and Llama 3 models | Counts with the OpenAI tokenizer instead | `litellm_settings.disable_hf_tokenizer_download: true` |
| Kimi K3 tokenizer | `huggingface.co` | Token counting for Bedrock Kimi K3 models | Reads the file from the local Hugging Face cache, and estimates the count when it isn't cached | `litellm_settings.disable_hf_tokenizer_download: true` |

The breached password check sends only the first 5 characters of the password's SHA-1 hash, never the password.

Offline mode overrides the per-feature settings. With offline mode on, the breached password check stays off even when `password_policy_check_breached_passwords` is `true`, and the `*_URL` variables are ignored. To read a catalog from an internal mirror, leave offline mode off, set that catalog's `*_URL` variable, and turn off the other requests with their per-feature switches.

The bundled copies are as current as the installed LiteLLM version. New model prices, presets, templates and blog posts arrive when you upgrade.

## Requests offline mode doesn't stop

### Destinations you configure

Offline mode doesn't change requests to destinations in your config, such as LLM providers, logging callbacks, guardrail vendors, secret managers, SSO, email and alerting. It also doesn't change these:

- **Model info refresh.** For `openai`, `openai_like`, `text-completion-openai` and `hosted_vllm` deployments with an `api_base`, the proxy calls `{api_base}/v1/models` every 5 minutes. Set `general_settings.disable_model_info_refresh: true` to stop it.
- **License check.** With `LITELLM_LICENSE` set, the proxy checks the key against `license.litellm.ai` when it can't verify the key's signature locally.
- **Image URLs in requests.** When a request carries an image URL, token counting and some providers, such as Bedrock, download it.

### Hugging Face model lookups

For `huggingface/` models, LiteLLM can call `huggingface.co` with no switch to turn it off:

- **Model config.** Looking up the context window of a `huggingface/` model reads its `config.json`. When the host is unreachable, the lookup returns no value.
- **Chat templates.** Providers that build a text prompt from chat messages, such as SageMaker, vLLM, Replicate, Triton and Bedrock invoke, read the model's chat template. When the host is unreachable, LiteLLM falls back to a generic prompt format. Set a [custom prompt template](../completion/prompt_formatting) for the model to skip the lookup.
- **Embedding task.** `huggingface/` embedding requests look up the model's task, and the request fails when the host is unreachable. Send `input_type` in the request to skip the lookup.

### Database tooling

The proxy runs migrations with the Prisma CLI:

- **Prisma CLI install.** On a pip install, the first start downloads the Prisma CLI and its engines from `registry.npmjs.org` and `binaries.prisma.sh`, and Node.js from `nodejs.org` when it isn't installed. LiteLLM Docker images include them and set `PRISMA_OFFLINE_MODE=true`.
- **Prisma version check.** The Prisma CLI checks `checkpoint.prisma.io` for updates. Set `CHECKPOINT_DISABLE=1` to stop it.

### Tokenizer files

LiteLLM bundles the `cl100k_base`, `o200k_base` and `p50k_base` tiktoken files. Counting tokens for a legacy model, such as `davinci`, `ada` or `gpt2`, downloads its tokenizer from `openaipublic.blob.core.windows.net`. To avoid it, put the files in a folder and set `CUSTOM_TIKTOKEN_CACHE_DIR` to that folder.

### Callback packages

The `supabase`, `sentry` and `slack` callbacks run `pip install` when their package is missing. Install the package in the image instead.

### Browser requests

These requests come from the browser of the person using the Admin UI or API docs, not from the proxy:

- **ReDoc.** The `/redoc` page loads its script from `cdn.jsdelivr.net` and fonts from `fonts.googleapis.com`. Set `NO_REDOC=True` to turn off the page.
- **MCP server icons.** The MCP server catalog and OpenAPI picker in the Admin UI load icons from `cdn.simpleicons.org` and `raw.githubusercontent.com`. When they are blocked, the icons don't show.

The Admin UI and the Swagger page at `/` serve their own scripts and fonts.
