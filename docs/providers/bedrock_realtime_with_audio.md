# Bedrock Realtime API

## Overview

Amazon Bedrock's Nova Sonic model supports real-time bidirectional audio streaming for voice conversations. This tutorial shows how to use it through LiteLLM Proxy.

## Setup

### 1. Configure LiteLLM Proxy

Create a `config.yaml` file:

```yaml
model_list:
  - model_name: "bedrock-sonic"
    litellm_params:
      model: bedrock/amazon.nova-2-sonic-v1:0
      aws_region_name: us-east-1  # or your preferred region
    model_info:
      mode: realtime
```

`amazon.nova-sonic-v1:0` has reached end of life on Bedrock, and requests to it fail with `The provided model identifier is invalid`. Use `amazon.nova-2-sonic-v1:0`.

### 2. Start LiteLLM Proxy

Nova Sonic needs AWS's bidirectional streaming SDK, which ships in the `bedrock-realtime` extra. The LiteLLM Docker image already includes it.

```bash
pip install 'litellm[proxy,bedrock-realtime]'
litellm --config config.yaml
```

## Basic Text Interaction

```python
import asyncio
import websockets
import json

LITELLM_API_KEY = "sk-<your-litellm-api-key>"  # Your LiteLLM API key
LITELLM_URL = 'ws://localhost:4000/v1/realtime?model=bedrock-sonic'

async def test_text_conversation():
    async with websockets.connect(
        LITELLM_URL,
        additional_headers={
            "Authorization": f"Bearer {LITELLM_API_KEY}"
        }
    ) as ws:
        # Wait for session.created
        response = await ws.recv()
        print(f"Connected: {json.loads(response)['type']}")
        
        # Configure session
        session_update = {
            "type": "session.update",
            "session": {
                "instructions": "You are a helpful assistant.",
                "modalities": ["text"],
                "temperature": 0.8
            }
        }
        await ws.send(json.dumps(session_update))
        
        # Send a message
        message = {
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": "Hello!"}]
            }
        }
        await ws.send(json.dumps(message))
        
        # Trigger response
        await ws.send(json.dumps({"type": "response.create"}))
        
        # Listen for response
        while True:
            response = await ws.recv()
            event = json.loads(response)
            
            if event['type'] == 'response.text.delta':
                print(event['delta'], end='', flush=True)
            elif event['type'] == 'response.done':
                print("\nComplete")
                break

if __name__ == "__main__":
    asyncio.run(test_text_conversation())
```

## Audio Streaming with Voice Conversation

Nova Sonic sends answer audio much faster than it plays, often tens of seconds ahead. Keep reading the websocket while audio plays: put received audio on a queue and play it from a separate thread. A client that plays each chunk inside its receive loop stops reading the socket, misses the proxy's keepalive pings, and gets disconnected with `1011 (internal error) keepalive ping timeout` on long answers.

```python
import asyncio
import base64
import json
import queue
import threading

import pyaudio
import websockets

LITELLM_API_KEY = "sk-<your-litellm-api-key>"
LITELLM_URL = 'ws://localhost:4000/v1/realtime?model=bedrock-sonic'

# Audio configuration
INPUT_RATE = 16000   # Nova Sonic expects 16kHz input
OUTPUT_RATE = 24000  # Nova Sonic outputs 24kHz
CHUNK = 1024

def play_audio(output_stream, playback_queue):
    """Play received audio on its own thread so the websocket keeps being read"""
    while True:
        audio_bytes = playback_queue.get()
        if audio_bytes is None:
            return
        output_stream.write(audio_bytes)

async def audio_conversation():
    # Initialize PyAudio
    p = pyaudio.PyAudio()
    
    # Input stream (microphone)
    input_stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=INPUT_RATE,
        input=True,
        frames_per_buffer=CHUNK
    )
    
    # Output stream (speakers)
    output_stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=OUTPUT_RATE,
        output=True,
        frames_per_buffer=CHUNK
    )

    playback_queue = queue.Queue()
    threading.Thread(target=play_audio, args=(output_stream, playback_queue), daemon=True).start()
    
    async with websockets.connect(
        LITELLM_URL,
        additional_headers={"Authorization": f"Bearer {LITELLM_API_KEY}"}
    ) as ws:
        # Wait for session.created
        await ws.recv()
        print("Connected")
        
        # Configure session with audio
        session_update = {
            "type": "session.update",
            "session": {
                "instructions": "You are a friendly voice assistant.",
                "modalities": ["text", "audio"],
                "voice": "matthew",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16"
            }
        }
        await ws.send(json.dumps(session_update))
        print("Speak into your microphone...")
        
        async def send_audio():
            """Capture and send audio from microphone"""
            while True:
                audio_data = await asyncio.to_thread(input_stream.read, CHUNK, exception_on_overflow=False)
                audio_b64 = base64.b64encode(audio_data).decode('utf-8')
                await ws.send(json.dumps({
                    "type": "input_audio_buffer.append",
                    "audio": audio_b64
                }))
        
        async def receive_events():
            """Queue audio for playback and print text as it arrives"""
            async for message in ws:
                event = json.loads(message)
                
                if event['type'] == 'response.audio.delta':
                    audio_b64 = event.get('delta', '')
                    if audio_b64:
                        playback_queue.put(base64.b64decode(audio_b64))
                
                elif event['type'] == 'response.text.delta':
                    print(event['delta'], end='', flush=True)
                
                elif event['type'] == 'response.done':
                    print("\nResponse complete")
                
                elif event['type'] == 'error':
                    print(f"\nError: {event['error'].get('message')}")
        
        try:
            # Run both tasks concurrently
            await asyncio.gather(send_audio(), receive_events())
        finally:
            playback_queue.put(None)

if __name__ == "__main__":
    try:
        asyncio.run(audio_conversation())
    except KeyboardInterrupt:
        print("\n\nGoodbye!")
```

## Using Tools/Function Calling

After the client sends a tool result, Nova Sonic answers in a new response, so keep listening past the `response.done` that ends the tool call turn.

```python
import asyncio
import websockets
import json

LITELLM_API_KEY = "sk-<your-litellm-api-key>"
LITELLM_URL = 'ws://localhost:4000/v1/realtime?model=bedrock-sonic'

# Define tools
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name"
                    }
                },
                "required": ["location"]
            }
        }
    }
]

def get_weather(location: str) -> dict:
    """Simulated weather function"""
    return {
        "location": location,
        "temperature": 72,
        "conditions": "sunny"
    }

async def conversation_with_tools():
    async with websockets.connect(
        LITELLM_URL,
        additional_headers={"Authorization": f"Bearer {LITELLM_API_KEY}"}
    ) as ws:
        # Wait for session.created
        await ws.recv()
        
        # Configure session with tools
        session_update = {
            "type": "session.update",
            "session": {
                "instructions": "You are a helpful assistant with access to tools.",
                "modalities": ["text"],
                "tools": TOOLS
            }
        }
        await ws.send(json.dumps(session_update))
        
        # Send a message that requires a tool
        message = {
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": "What's the weather in San Francisco?"}]
            }
        }
        await ws.send(json.dumps(message))
        await ws.send(json.dumps({"type": "response.create"}))
        
        # Handle responses and tool calls
        awaiting_tool_answer = False
        while True:
            response = await ws.recv()
            event = json.loads(response)
            
            if event['type'] == 'response.text.delta':
                print(event['delta'], end='', flush=True)
            
            elif event['type'] == 'response.function_call_arguments.done':
                # Execute the tool
                function_name = event['name']
                arguments = json.loads(event['arguments'])
                
                print(f"\nCalling {function_name}({arguments})")
                result = get_weather(**arguments)
                
                # Send tool result back
                tool_result = {
                    "type": "conversation.item.create",
                    "item": {
                        "type": "function_call_output",
                        "call_id": event['call_id'],
                        "output": json.dumps(result)
                    }
                }
                await ws.send(json.dumps(tool_result))
                await ws.send(json.dumps({"type": "response.create"}))
                awaiting_tool_answer = True
            
            elif event['type'] == 'response.done':
                if awaiting_tool_answer:
                    awaiting_tool_answer = False
                    continue
                print("\nComplete")
                break

if __name__ == "__main__":
    asyncio.run(conversation_with_tools())
```

## Configuration Options

### Voice Options
Available voices: `matthew`, `joanna`, `ruth`, `stephen`, `gregory`, `amy`

### Audio Formats
- **Input**: 16kHz PCM16 (mono)
- **Output**: 24kHz PCM16 (mono)

### Modalities
- `["text"]` - Text only
- `["audio"]` - Audio only  
- `["text", "audio"]` - Both text and audio

## Session Limits

Bedrock ends a Nova Sonic session on its own in three cases: no audio or other input arrives for 55 seconds, no speech is detected for about 5 minutes (sending silence does not keep the session open), or the session reaches 8 minutes. The client receives an `error` event with Bedrock's message, then the websocket closes with code 1011. Clients that need longer conversations should open a new session when this happens.

LiteLLM versions before v1.103.0 closed the websocket with code 1000 and no error event in these cases, so the client saw `ConnectionClosedOK: received 1000 (OK)` with no explanation. Upgrade to see Bedrock's reason.

## Requirements

```bash
uv add websockets pyaudio
```

## AWS Configuration

Ensure your AWS credentials are configured:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION_NAME=us-east-1
```

Or use AWS CLI configuration:

```bash
aws configure
```

## Troubleshooting

### Connection Issues
- Ensure LiteLLM proxy is running on the correct port
- Verify AWS credentials are properly configured
- Check that the Bedrock model is available in your region
- `ConnectionClosedError: received 1011 (internal error) keepalive ping timeout` means the client stopped reading the websocket for about 20 seconds or more, usually because it plays audio inside its receive loop. Play audio from a queue on a separate thread as shown above. Setting `ping_interval=None` on the client does not help, because the proxy sends the pings
- A close with an `error` event about timing out or a model timeout is one of Bedrock's [session limits](#session-limits)

### Audio Issues
- Verify PyAudio is properly installed
- Check microphone/speaker permissions
- Ensure correct sample rates (16kHz input, 24kHz output)

### Tool Calling Issues
- Ensure tools are properly defined in session.update
- Verify tool results are sent back with correct call_id
- Check that response.create is sent after tool result

## Related Resources

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [Amazon Bedrock Nova Sonic Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/nova-sonic.html)
- [LiteLLM Realtime API Documentation](/docs/realtime)
