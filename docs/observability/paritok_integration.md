import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Paritok

[Paritok](https://paritok.com) is an open-source context-compression layer. As a LiteLLM
Proxy callback it compresses every request **before** it reaches the upstream provider —
so you pay the provider for fewer tokens and your context window lasts longer — with no
change to your app or agent code.

It compresses tool schemas, large file reads / tool outputs, and old conversation history,
while keeping recall **non-destructive**: the model can call `read_original` to get the
exact bytes of anything that was shortened, and Paritok also repairs `Edit`/`str_replace`
tool calls whose `old_string` was authored against a compressed view so they still match
the real file.

| Feature | Details |
|---------|---------|
| **What it does** | Tool-schema filter + file/tool-output + history compression, non-destructive recall (`read_original`), Edit recovery |
| **Where it runs** | LiteLLM **Proxy** (uses `async_pre_call_hook` + `async_post_call_success_hook`) |
| **Package** | [`litellm-paritok`](https://pypi.org/project/litellm-paritok/) on PyPI |
| **Backend** | The open Paritok 4B model — self-host via Ollama, or a hosted GPU endpoint |
| **Source** | [github.com/Paritok-official/litellm_paritok](https://github.com/Paritok-official/litellm_paritok) |

:::info

This integration works under **LiteLLM Proxy**. It uses the proxy-only call hooks
(`async_pre_call_hook` / `async_post_call_success_hook`) — see
[Custom Callback Class](../proxy/logging#custom-callback-class-async). The bare SDK path
(`litellm.completion(...)`) does not trigger these hooks.

:::

## Quick Start

### 1. Install

```shell
pip install litellm-paritok   # pulls in `paritok`
```

You also need a Paritok 4B compression backend — either one:

```shell
ollama pull paritok/paritok-4b-v1   # self-host locally
# or point Paritok at a hosted GPU endpoint via an API key
```

### 2. Add the callback to your `config.yaml`

`litellm-paritok` exports a ready-made handler instance, so register it by its dotted path
`litellm_paritok.paritok_handler` (this is the standard
[`python_filename.logger_instance_name`](../proxy/logging#custom-callback-class-async)
mechanism, shipped as a pip package):

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["litellm_paritok.paritok_handler"]
```

:::tip

Use the dotted path `litellm_paritok.paritok_handler`, **not** a bare `"paritok"` — LiteLLM
resolves the string as `module.instance`.

:::

### 3. Start the proxy

```shell
litellm --config config.yaml
```

Every request through the proxy is now compressed before it is forwarded upstream. Your
application keeps pointing at LiteLLM unchanged.

## How it works

`litellm-paritok` is a thin [`CustomLogger`](./custom_callback) over the Paritok engine:

- **`async_pre_call_hook`** — filters tool schemas and compresses file reads / tool outputs /
  old history, then returns the modified request for the upstream call.
- **`async_post_call_success_hook`** — answers any `read_original` recall calls itself (looping
  the model until a plain turn returns) and rewrites `Edit`/`str_replace` tool calls so they
  match the real file byte-for-byte.

## Configuration

Point Paritok at your compression backend and tune its behaviour with a `paritok.yaml`, and
tell the callback where it is:

```shell
export PARITOK_CONFIG=/path/to/paritok.yaml
```

See the [Paritok docs](https://paritok.com) for backend and compression settings.
