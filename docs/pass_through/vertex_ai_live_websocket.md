# Vertex AI Live API WebSocket Passthrough

LiteLLM now supports WebSocket passthrough for the Vertex AI Live API, enabling real-time bidirectional communication with Gemini models.

## Overview

The Vertex AI Live API WebSocket passthrough allows you to:
- Connect to Vertex AI Live API through LiteLLM proxy
- Use existing Vertex AI authentication methods
- Pass through all WebSocket messages bidirectionally
- Support text, audio, video, and multimodal interactions
- Track costs automatically for all usage types

## Configuration

### Environment Variables

Set the following environment variables for Vertex AI authentication:

```bash
# Required
DEFAULT_VERTEXAI_PROJECT=your-project-id
DEFAULT_VERTEXAI_LOCATION=us-central1

# Optional - use one of these for authentication
DEFAULT_GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# OR run: gcloud auth application-default login
```

### Configuration File

Alternatively, configure in your `config.yaml`:

```yaml
default_vertex_config:
  vertex_project: "your-project-id"
  vertex_location: "us-central1"
  vertex_credentials: "os.environ/GOOGLE_APPLICATION_CREDENTIALS"
```

`default_vertex_config` is a top-level key, not a child of `litellm_settings`.

## Usage

### WebSocket Endpoint

- `ws://your-proxy-host/vertex_ai/live`

### Query Parameters

- `vertex_project` (optional): Google Cloud project ID (can be set in config)
- `vertex_location` (optional): Vertex AI location (can be set in config, default: us-central1)
- `model` (optional): model name, used to determine the Vertex region for global models and to pick a `use_in_pass_through` deployment

### Pinned deployments

When `model` names a `use_in_pass_through` Vertex AI deployment and the proxy has no `default_vertex_config` or `DEFAULT_VERTEXAI_PROJECT`, the session uses that deployment's project and region. A `vertex_project` or `vertex_location` query param that differs from the deployment's value closes the connection with code `1008` and the reason `Rejected Request: vertex_location is pinned by the deployment, see configurable_clientside_auth_params`. A `vertex_project` and `vertex_location` pair that matches another `use_in_pass_through` deployment connects through that deployment instead.

To let callers pick the region or project, list the param in the deployment's `configurable_clientside_auth_params`, or set `general_settings.allow_client_side_credentials: true` proxy-wide.

When the proxy sets `default_vertex_config`, each field it sets pins the session the same way. A `vertex_project` or `vertex_location` query param that differs from it closes the connection with code `1008` and the reason `Rejected Request: vertex_location is pinned by default_vertex_config, see allow_client_side_credentials`. A field that `default_vertex_config` leaves unset is still the caller's choice. `default_vertex_config` has no per-field opt-in, so only `general_settings.allow_client_side_credentials: true` lifts its pin.

Google's SDKs send the setup message's `model` as a full `projects/<project>/locations/<location>/publishers/google/models/<model>` path. The proxy moves the project and region in that path onto the session's own before it forwards the message, so the session stays on the project and region the admin chose. With `allow_client_side_credentials: true` the path is forwarded as sent.

```yaml
model_list:
  - model_name: gemini-live
    litellm_params:
      model: vertex_ai/gemini-3.8-live
      vertex_project: my-project
      vertex_location: us-central1
      vertex_credentials: os.environ/GOOGLE_APPLICATION_CREDENTIALS
      use_in_pass_through: true
      configurable_clientside_auth_params: ["vertex_location"] # optional, lets callers pick the region
```

```javascript
const ws = new WebSocket('ws://localhost:4000/vertex_ai/live?model=gemini-live');
```

<SinceVersion v="1.109.0" />

### Example Connection

```javascript
// If vertex_project and vertex_location are set in config, you can connect without query params
const ws = new WebSocket('ws://localhost:4000/vertex_ai/live');

// Or specify them explicitly
const ws = new WebSocket('ws://localhost:4000/vertex_ai/live?vertex_project=your-project-id&vertex_location=us-central1');
```

## Cost Tracking

The WebSocket passthrough automatically tracks costs for all usage types based on the [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing#model-optimizer-pricing):

### Supported Cost Tracking

- **Text**: Character-based or token-based pricing depending on model
- **Audio**: Per-second pricing for audio input/output
- **Video**: Per-second pricing for video input
- **Images**: Per-image pricing for image input

### Cost Calculation

Costs are calculated using the same methods as other Vertex AI models in LiteLLM:
- Uses `cost_per_character` for Gemini models
- Uses `cost_per_token` for partner models (Claude, Llama, etc.)
- Includes audio, video, and image costs when applicable

### Cost Logging

Costs are automatically logged to:
- LiteLLM proxy logs
- Database (if configured)
- Spend tracking system
- Admin dashboard

Example log output:
```
Vertex AI Live WebSocket session cost: $0.001234 (input: $0.000800, output: $0.000434) tokens: 150, characters: 1200, duration: 45.2s
```

## API Reference

### Setup Message

Send this message first to initialize the session:

```json
{
  "setup": {
    "model": "projects/your-project-id/locations/us-central1/publishers/google/models/gemini-2.0-flash-live-preview-04-09",
    "generation_config": {
      "response_modalities": ["TEXT"]
    }
  }
}
```

### Text Input

```json
{
  "client_content": {
    "turns": [
      {
        "role": "user",
        "parts": [{"text": "Hello! How are you?"}]
      }
    ],
    "turn_complete": true
  }
}
```

### Audio Input

```json
{
  "realtime_input": {
    "media_chunks": [
      {
        "data": "base64-encoded-audio-data",
        "mime_type": "audio/pcm"
      }
    ]
  }
}
```

## Supported Features

### Response Modalities

- **TEXT**: Text responses
- **AUDIO**: Audio responses with voice synthesis

### Tools

- **Function Calling**: Define and use custom functions
- **Code Execution**: Execute Python code
- **Google Search**: Search the web
- **Voice Activity Detection**: Detect when user is speaking

### Advanced Features

- **Audio Transcription**: Transcribe input and output audio
- **Proactive Audio**: Model responds only when relevant
- **Affective Dialog**: Understand emotional expressions

## Examples

### Python Client

```python
import asyncio
import json
import websockets

async def chat_with_gemini():
    uri = "ws://localhost:4000/vertex_ai/live?vertex_project=your-project-id"
    
    headers = {"Authorization": "Bearer sk-<your-litellm-api-key>"}

    async with websockets.connect(uri, additional_headers=headers) as websocket:
        # Setup
        setup = {
            "setup": {
                "model": "projects/your-project-id/locations/us-central1/publishers/google/models/gemini-2.0-flash-live-preview-04-09",
                "generation_config": {"response_modalities": ["TEXT"]}
            }
        }
        await websocket.send(json.dumps(setup))
        
        # Wait for setup response
        response = await websocket.recv()
        print(f"Setup: {response}")
        
        # Send message
        message = {
            "client_content": {
                "turns": [{"role": "user", "parts": [{"text": "Hello!"}]}],
                "turn_complete": True
            }
        }
        await websocket.send(json.dumps(message))
        
        # Receive response
        async for response in websocket:
            print(f"Response: {response}")
            # Check if turn is complete
            data = json.loads(response)
            if data.get("serverContent", {}).get("turnComplete"):
                break

asyncio.run(chat_with_gemini())
```

### JavaScript Client

```javascript
const ws = new WebSocket('ws://localhost:4000/vertex_ai/live?vertex_project=your-project-id');

ws.onopen = function() {
    // Send setup
    const setup = {
        setup: {
            model: "projects/your-project-id/locations/us-central1/publishers/google/models/gemini-2.0-flash-live-preview-04-09",
            generation_config: { response_modalities: ["TEXT"] }
        }
    };
    ws.send(JSON.stringify(setup));
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
    
    // Check if setup is complete
    if (data.setupComplete) {
        // Send a message
        const message = {
            client_content: {
                turns: [{ role: "user", parts: [{ text: "Hello!" }] }],
                turn_complete: true
            }
        };
        ws.send(JSON.stringify(message));
    }
};
```

## Error Handling

If the proxy cannot resolve Vertex AI credentials or a project ID (no `use_in_pass_through` Vertex model, no `default_vertex_config`, and no `DEFAULT_VERTEXAI_*` env vars), it accepts the connection and then closes it with code `1011` and the reason:

```
Vertex AI auth failed: set a use_in_pass_through vertex model, default_vertex_config, or DEFAULT_VERTEXAI_* env
```

A `vertex_project` or `vertex_location` query param that moves a pinned deployment or a field `default_vertex_config` sets closes the connection with code `1008` before any call to Vertex AI. See [Pinned deployments](#pinned-deployments).

## Authentication

The WebSocket passthrough uses the same authentication as other LiteLLM endpoints:

1. **API Key**: Pass `Authorization: Bearer your-api-key` header
2. **Vertex AI Credentials**: Set environment variables or config file

## Limitations

- Requires valid Google Cloud project with Vertex AI API enabled
- WebSocket connections are not persistent across server restarts
- Rate limits apply based on your Google Cloud quotas

## Troubleshooting

### Common Issues

1. **Authentication Error**: Ensure Vertex AI credentials are properly configured
2. **Project Not Found**: Verify the project ID exists and has Vertex AI enabled
3. **Connection Refused**: Check that the LiteLLM proxy server is running

### Debug Mode

Enable debug logging to see detailed connection information:

```bash
export LITELLM_LOG=DEBUG
```

## Related Documentation

- [Vertex AI Live API Reference](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/multimodal-live)
- [LiteLLM Proxy Configuration](/docs/proxy/configs)
- [Vertex AI Passthrough Endpoints](./vertex_ai.md)
