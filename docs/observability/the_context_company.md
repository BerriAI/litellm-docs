# The Context Company

[The Context Company](https://www.thecontextcompany.com) ([LiteLLM documentation](https://docs.thecontextcompany.com/frameworks/custom-instrumentation/python/litellm)) is an AI agent observability and customer analytics platform that helps teams understand and improve AI agents in production. The LiteLLM callback records model calls as steps within agent runs and connects them with analysis across runs.

The integration provides:

- Traces for model inputs and outputs, token usage, finish reasons, returned tool calls, errors, and model information
- Sessions, conversational runs, feedback, and custom metadata through The Context Company run API
- [Pattern detection](https://docs.thecontextcompany.com/features/patterns), [insight search](https://docs.thecontextcompany.com/features/insight-search), and [recaps](https://docs.thecontextcompany.com/features/weekly-insights) that analyze production behavior and link findings to supporting traces

## Prerequisites

- A The Context Company API key
- Python 3.9 or later
- LiteLLM used through the Python SDK

## Quick start

### 1. Install the integration

```bash
pip install "contextcompany[litellm]"
```

### 2. Set environment variables

```bash
export TCC_API_KEY="your-tcc-api-key"
export OPENAI_API_KEY="your-openai-api-key"
```

### 3. Register the callback

Create a run, register `TCCCallback`, and pass the run ID in LiteLLM's `metadata` parameter:

```python
import contextcompany as tcc
import litellm
from contextcompany.litellm import TCCCallback

litellm.callbacks = [TCCCallback()]

run = tcc.run()
run.prompt("Explain why production agents need observability.")

response = litellm.completion(
    model="openai/gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": "Explain why production agents need observability.",
        }
    ],
    metadata={"tcc.runId": run.run_id},
)

answer = response.choices[0].message.content
run.response(answer)
run.end()
```

The callback associates the LiteLLM request with the surrounding run through `tcc.runId`. Calling `run.end()` completes the run and makes it available for analysis.

## Add run metadata

Use the run API for custom metadata, sessions, and conversational status:

```python
run = tcc.run(
    session_id="support-session-123",
    conversational=True,
)
run.prompt("Help me troubleshoot my deployment.")
run.metadata({
    "environment": "production",
    "feature": "deployment-assistant",
})

response = litellm.completion(
    model="openai/gpt-4o-mini",
    messages=[
        {"role": "user", "content": "Help me troubleshoot my deployment."}
    ],
    metadata={"tcc.runId": run.run_id},
)

run.response(response.choices[0].message.content)
run.end()
```

## What is captured

For every LiteLLM request, the callback records:

- Requested and returned model information
- Input and output messages
- Prompt and completion token usage
- Finish reasons
- Tool calls returned by the model
- Failed requests and error status

See [The Context Company LiteLLM documentation](https://docs.thecontextcompany.com/frameworks/custom-instrumentation/python/litellm) for the complete setup and metadata reference.
