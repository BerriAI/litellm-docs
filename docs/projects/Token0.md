# Token0

[Token0](https://github.com/Pritom14/token0) is an open-source optimizer for vision requests. It runs as a LiteLLM Proxy pre-call hook, rewrites the image parts of a chat request before they reach the provider, and records what it changed.

- **Low detail:** large photos used for simple tasks (classify, yes/no, count) are resized to 512px and sent in low detail.
- **Verified OCR:** text-heavy images are swapped for their extracted text, but only when that text costs fewer tokens than the image.
- **UI and agent prompts:** prompts that act on a screenshot (click, type, locate) keep the original image dimensions, so the coordinates the model returns still map back onto the screen.

Install it in the same environment as the proxy:

```bash
pip install token0
```

Register the hook in `config.yaml`:

```yaml
litellm_settings:
  callbacks: ["token0.litellm_hook.proxy_handler_instance"]
```

What the provider received in a LiteLLM Proxy run, with token counts from the GPT-4.1 image formula:

| Request | Provider receives | Image tokens |
|---|---|---|
| "Classify this image", 4000×3000 photo | 512×384, low detail | 765 → 85 |
| "Extract all text", 200dpi document page | extracted text | 1,105 → 815 |
| "Click the add to cart button", 1080p screenshot | original dimensions | 1,105 → 1,105 |

For the Python SDK, use `token0.litellm_hook.completion` / `acompletion` as drop-in replacements for `litellm.completion` / `litellm.acompletion`. Usage stats are in `response._hidden_params["token0"]`.

See the [project repository](https://github.com/Pritom14/token0) for configuration options and benchmarks.
