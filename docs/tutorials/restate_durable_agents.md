import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Image from '@theme/IdealImage';

# Restate with LiteLLM

Build durable, resilient AI agents with full control over execution, using [Restate](https://restate.dev) for durable execution and LiteLLM for model calls.

## Overview
[Restate](https://restate.dev) is an open-source durable execution platform for building resilient AI agents, workflows, and backend services. Restate pairs naturally with LiteLLM: every LLM call and tool invocation can be wrapped in a durable step, so agents automatically retry on failure, recover from crashes, and run side effects exactly once — across any of LiteLLM's 100+ providers.

Pairing Restate with LiteLLM gives you:

- **Durable execution**: automatic retries and recovery, with every step journaled so progress isn't lost or duplicated
- **Durable sessions**: stateful entities keyed by user or conversation, with built-in state and concurrency control
- **Long-running agents and human approvals**: pause for approvals that take minutes or months, surviving crashes in between
- **Multi-agent orchestration**: durable RPC, fan-out, and timeouts across agents, tools, and services
- **Task control**: cancel, kill, roll back, or restart executions. One at a time or in bulk, via UI or API

A minimal template:

```python
import restate
from litellm import acompletion

agent = restate.Service("agent")

@agent.handler()
async def run(ctx: restate.Context, prompt: str) -> str:
    async def call_llm():
        resp = await acompletion(model="gpt-5.2", messages=[{"role": "user", "content": prompt}])
        return resp.choices[0].message.content
    return await ctx.run("LLM call", call_llm)
```

This agent can be called at `http://restate:8080/agent/run`.

This tutorial walks through a minimal durable tool-calling agent and a stateful chat session, both calling LiteLLM. Full source for these and more patterns lives in the [Restate AI examples repo](https://github.com/restatedev/ai-examples/tree/main/python-restate-only).

## Prerequisites

- Python 3.12+
- [Restate Server](https://docs.restate.dev/installation) installed locally
- API keys for your chosen LLM providers

## Installation

```bash showLineNumbers title="Install dependencies"
uv add "restate-sdk[serde]" litellm hypercorn
```

## 1. A durable tool-calling agent

A customizable agent that runs a tool-calling loop where every LLM call and every tool execution is durable. If the process crashes mid-loop, Restate replays the journal — completed steps are not repeated, and the agent picks up exactly where it left off.

```python showLineNumbers title="agent.py"
import json
import restate
from litellm import acompletion

# TOOLS
async def get_weather(city: str) -> str:
    return json.dumps({"temperature": 23, "condition": "Sunny"})


TOOLS=[{"type":"function","function":{"name":"get_weather","parameters":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}}}]

# AGENT
agent_service = restate.Service("agent")


@agent_service.handler()
async def run(ctx: restate.Context, prompt: str) -> str | None:
    messages = [{"role": "user", "content": prompt}]

    while True:
        # Durable LLM call — result is journaled by Restate
        async def call_llm():
            resp = await acompletion(model="gpt-5.2", messages=messages, tools=TOOLS)
            return resp.choices[0].message

        response = await ctx.run("LLM call", call_llm)
        messages.append(response.model_dump())

        if not response.tool_calls:
            return response.content

        for tool_call in response.tool_calls:
            city = json.loads(tool_call.function.arguments)["city"]
            # Durable tool calls — run exactly once even across retries
            result = await ctx.run_typed("get_weather", get_weather, city=city)
            messages.append({"role": "tool", "tool_call_id": tool_call.id, "content": result})
            

if __name__ == "__main__":
    import asyncio
    import hypercorn
    app = restate.app(services=[agent_service])
    conf = hypercorn.Config()
    conf.bind = ["0.0.0.0:9080"]
    asyncio.run(hypercorn.asyncio.serve(app, conf))
```

In separate shells:

```bash
# 1. Start Restate
restate-server

# 2. Run the agent
export OPENAI_API_KEY=...
uv run .

# 3. Register with Restate
restate -y deployments register localhost:9080 --force

# 4. Invoke
curl localhost:8080/agent/run --json '"Weather in San Francisco?"'
```

## 2. Stateful chat sessions

Use a Restate **Virtual Object** to give each conversation its own durable, isolated state. Conversation memory is stored by Restate, so sessions survive crashes and can be resumed days later.

```python showLineNumbers title="chat_agent.py"
import restate
from litellm import acompletion

chat = restate.VirtualObject("Chat")


@chat.handler()
async def message(ctx: restate.ObjectContext, user_message: str) -> str | None:
    # Retrieve history for this conversation
    messages = await ctx.get("memory", type_hint=list[dict]) or []
    messages.append({"role": "user", "content": user_message})
    
    async def llm_call() -> dict:
        resp = await acompletion(model="gpt-5.2", messages=messages)
        return resp.choices[0].message.model_dump()

    result = await ctx.run_typed("LLM call", llm_call)

    messages.append({"role": "assistant", "content": result["content"]})
    # Store history for this conversation
    ctx.set("memory", messages)

    return result["content"]
```

Invoke a session by name — every request to the same session id sees the same memory:

```bash
curl localhost:8080/Chat/alice/message --json '"Hi, I am Alice."'
curl localhost:8080/Chat/alice/message --json '"What is my name?"'
```

Restate also protects against race conditions, for example, when users send multiple messages at the same time.
Requests to the same session get executed one-by-one, so session state never gets corrupted.

## Observability

The Restate UI shows you detailed traces on your agents and workflows. 

<Image img={require('../../img/restate-journal.png')} />


## More patterns

The Restate AI examples repo includes durable patterns built directly on LiteLLM:

- **Human approvals**: agent suspends until a human approves or rejects a tool call.
- **Multi-agent orchestration**: durable hand-off between specialized agents.
- **Parallel tool calls**: fan out tool calls and gather results, surviving partial failures.
- **Workflow patterns**: sequential, parallel, orchestrator-worker, evaluator-optimizer.
- **Task control**: cancel execution when new context arrives, or roll back completed tasks on a failure.

See the full list in the [examples repo](https://github.com/restatedev/ai-examples).

## Related Resources

- [Restate documentation](https://docs.restate.dev)
- [Restate AI patterns](https://docs.restate.dev/ai)
- [Restate AI examples](https://github.com/restatedev/ai-examples)
