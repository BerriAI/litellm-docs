# nife-litellm

[nife-litellm](https://github.com/nifetency/nife-litellm) is an open-source (MIT) Flask service that wraps LiteLLM in a small REST API. It adds provider auto-detection, health checks, and a production Docker setup, so a single HTTP endpoint can route prompts to OpenAI, Anthropic, Google, Mistral, Cohere, Together AI, or DeepSeek through the `litellm` Python package.

Run it with Docker:

```bash
git clone https://github.com/nifetency/nife-litellm.git
cd nife-litellm
docker-compose up -d
```

Then send prompts to any supported provider:

```bash
curl -X POST http://localhost:8080/api/completion \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "gpt-3.5-turbo",
    "api_key": "sk-YOUR_OPENAI_API_KEY",
    "prompts": ["What is artificial intelligence?"]
  }'
```

See the [project repository](https://github.com/nifetency/nife-litellm) for the full API guide and a Kubernetes deployment example.
