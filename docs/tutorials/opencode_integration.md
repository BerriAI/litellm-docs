import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenCode Quickstart

This tutorial shows how to connect OpenCode to your existing LiteLLM instance and switch between models.

:::info 

This integration allows you to use any LiteLLM supported model through OpenCode with centralized authentication, usage tracking, and cost controls.

:::

<br />

### Video Walkthrough

<iframe width="840" height="500" src="https://www.loom.com/embed/00791498f1d84e4ba6d7476bd2e1442f" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>

## Prerequisites

- LiteLLM already configured and running (e.g., http://localhost:4000)
- LiteLLM API key

## Installation

### Step 1: Install OpenCode

Choose your preferred installation method:

<Tabs>
<TabItem value="curl" label="One-line install (recommended)">

```bash
curl -fsSL https://opencode.ai/install | bash
```

</TabItem>
<TabItem value="npm" label="NPM">

```bash
npm install -g opencode-ai
```

</TabItem>
<TabItem value="homebrew" label="Homebrew">

```bash
brew install sst/tap/opencode
```

</TabItem>
</Tabs>

Verify installation:

```bash
opencode --version
```

### Step 2: Configure LiteLLM Provider

Create your OpenCode configuration file. You can place this in different locations depending on your needs:

**Configuration locations:**
- **Global**: `~/.config/opencode/opencode.json` (applies to all projects)
- **Project**: `opencode.json` in your project root (project-specific settings)
- **Custom**: Set `OPENCODE_CONFIG` environment variable

Create `~/.config/opencode/opencode.json` (global config):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM",
      "options": {
        "baseURL": "http://localhost:4000/v1"
      },
      "models": {
        "{{openai_large}}": {
          "name": "GPT-5.6 Terra"
        },
        "{{anthropic}}": {
          "name": "Claude Sonnet 5"
        },
        "deepseek-chat": {
          "name": "DeepSeek Chat"
        }
      }
    }
  }
}
```

:::tip
The keys in the "models" object (e.g., "gpt-5.6-terra", "claude-sonnet-5") should match the `model_name` values from your LiteLLM configuration. The "name" field provides a friendly display name that will appear as an alias in OpenCode.

If a model accepts images, it also needs a `modalities` entry; see [Enabling image and vision input](#enabling-image-and-vision-input).
:::

### Step 3: Connect to LiteLLM Provider

Launch OpenCode:

```bash
opencode
```

Add your API key:

```bash
/connect
```

Then:
- **Enter provider name**: `LiteLLM` (must match the "name" field in your config)
- **Enter your LiteLLM API key**: Your LiteLLM master key or virtual key

### Step 4: Switch Between Models

In OpenCode, run:

```bash
/models
```

Select any model from your LiteLLM configuration. OpenCode will route all requests through your LiteLLM instance.

## Advanced Configuration

### Model Parameters

You can customize model parameters like context limits:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM",
      "options": {
        "baseURL": "http://localhost:4000/v1"
      },
      "models": {
        "{{openai_large}}": {
          "name": "GPT-5.6 Terra",
          "limit": {
            "context": 922000,
            "output": 128000
          }
        },
        "{{anthropic}}": {
          "name": "Claude Sonnet 5",
          "limit": {
            "context": 1000000,
            "output": 128000
          }
        }
      }
    }
  }
}
```

### Enabling image and vision input

OpenCode does **not** discover model capabilities from the `/v1/models` endpoint. The OpenAI
model-listing schema has no field for modalities, so there is nothing for it to read. Models under a
custom `@ai-sdk/openai-compatible` provider therefore fall back to text-only input.

The effect is client-side and silent: OpenCode checks the model's declared input modalities, sees no
`image`, and **strips image attachments out of the request before it is sent**. LiteLLM never
receives the image, and the model replies as though you had pasted nothing.

Declare `modalities` on every vision-capable model in your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM",
      "options": {
        "baseURL": "http://localhost:4000/v1"
      },
      "models": {
        "{{anthropic}}": {
          "name": "Claude Sonnet 5",
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        },
        "{{openai_large}}": {
          "name": "GPT-5.6 Terra",
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        },
        "deepseek-chat": {
          "name": "DeepSeek Chat"
        }
      }
    }
  }
}
```

Leave `modalities` off text-only models such as `deepseek-chat`; declaring `image` input for a model
that cannot accept it moves the failure from the client to the provider.

:::warning
Setting `supports_vision: true` under `model_info` in your LiteLLM `config.yaml` does **not** fix
this. That flag drives LiteLLM's own routing and cost logic and is not exposed on `/v1/models`, and
OpenCode would not read it if it were. `modalities` in the OpenCode config is the only place this
can be declared.
:::

#### Auto Router and other model groups

A model group is just another model name to OpenCode, so an [Auto Router](../proxy/auto_routing)
entry needs the same declaration even though the models behind it are vision-capable:

```json
{
  "models": {
    "smart-router": {
      "name": "Smart Router",
      "modalities": { "input": ["text", "image"], "output": ["text"] }
    }
  }
}
```

Declare `image` input only when every tier the router can select accepts images. If one tier is
text-only, an image-bearing request will fail once the router lands on that tier.

### Multi-Provider Setup

You can configure multiple LiteLLM instances or mix with other providers:

<Tabs>
<TabItem value="multi-litellm" label="Multiple LiteLLM Instances">

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm-prod": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM Production",
      "options": {
        "baseURL": "https://your-prod-instance.com/v1"
      },
      "models": {
        "{{openai_large}}": {
          "name": "GPT-5.6 Terra (Production)"
        }
      }
    },
    "litellm-dev": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM Development",
      "options": {
        "baseURL": "http://localhost:4000/v1"
      },
      "models": {
        "{{openai_large}}": {
          "name": "GPT-5.6 Terra (Development)"
        }
      }
    }
  }
}
```

</TabItem>
<TabItem value="mixed-providers" label="Mixed Providers">

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM",
      "options": {
        "baseURL": "http://localhost:4000/v1"
      },
      "models": {
        "{{openai_large}}": {
          "name": "GPT-5.6 Terra via LiteLLM"
        },
        "{{anthropic}}": {
          "name": "Claude Sonnet 5 via LiteLLM"
        }
      }
    },
    "openai": {
      "npm": "@ai-sdk/openai",
      "name": "OpenAI Direct",
      "models": {
        "{{openai_large}}": {
          "name": "GPT-5.6 Terra (Direct)"
        }
      }
    }
  }
}
```

</TabItem>
</Tabs>

## Example LiteLLM Configuration

Here's an example LiteLLM `config.yaml` that works well with OpenCode:

```yaml
model_list:
  # OpenAI models
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

  # Anthropic models
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

  # DeepSeek models
  - model_name: deepseek-chat
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: os.environ/DEEPSEEK_API_KEY
```

### Dropping OpenCode-specific parameters

OpenCode sends a `reasoningSummary` parameter with reasoning-capable models such as `{{openai_large}}`. This parameter is not supported by the Chat Completions API and will cause errors. Add `additional_drop_params` to every model entry in your `model_list` that will receive requests from OpenCode with reasoning enabled:

```yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
      additional_drop_params: ["reasoningSummary"]
```

## Troubleshooting

**OpenCode not connecting:**
- Verify your LiteLLM proxy is running: `curl http://localhost:4000/health`
- Check that the `baseURL` in your OpenCode config matches your LiteLLM instance
- Ensure the provider name in `/connect` matches exactly with your config

**Authentication errors:**
- Verify your LiteLLM API key is correct
- Check that your LiteLLM instance has authentication properly configured
- Ensure your API key has access to the models you're trying to use

**Model not found:**
- Ensure the model names in OpenCode config match your LiteLLM `model_name` values
- Check LiteLLM logs for detailed error messages
- Verify the models are properly configured in your LiteLLM instance

**Configuration not loading:**
- Check the config file path and permissions
- Validate JSON syntax using a JSON validator
- Ensure the `$schema` URL is accessible

**Images and screenshots are ignored:**
- OpenCode defaults custom OpenAI-compatible provider models to text-only input and strips image
  attachments before sending, so the request reaching LiteLLM contains no image. Declare
  `modalities` on the model in your OpenCode config:
  ```json
  "{{anthropic}}": {
    "name": "Claude Sonnet 5",
    "modalities": { "input": ["text", "image"], "output": ["text"] }
  }
  ```
- `model_info: supports_vision: true` in your LiteLLM `config.yaml` has no effect here. See
  [Enabling image and vision input](#enabling-image-and-vision-input).

**`Unknown parameter: 'reasoningSummary'` error:**
- OpenCode sends a `reasoningSummary` parameter that is not supported by the Chat Completions API. Add `additional_drop_params: ["reasoningSummary"]` to each affected model entry in your `litellm_params`:
  ```yaml
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY
      additional_drop_params: ["reasoningSummary"]
  ```

## Tips

- Add more models to the config as needed - they'll appear in `/models`
- Use project-specific configs for different codebases with different model requirements
- Monitor your LiteLLM proxy logs to see OpenCode requests in real-time
