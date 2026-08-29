# Restate

[Restate](https://restate.dev) is an open-source durable execution platform for building resilient AI agents, workflows, and backend services. Restate pairs naturally with LiteLLM: every LLM call and tool invocation can be wrapped in a durable step, so agents automatically retry on failure, recover from crashes, and run side effects exactly once — across any of LiteLLM's 100+ providers.

```python
import restate
from litellm import acompletion

agent = restate.Service("agent")

@agent.handler()
async def run(ctx: restate.Context, prompt: str) -> str:
    async def call_llm():
        resp = await acompletion(model="gpt-4o-mini",
                                 messages=[{"role": "user", "content": prompt}])
        return resp.choices[0].message.content
    return await ctx.run("LLM call", call_llm)
```

- [Tutorial: Restate with LiteLLM](../tutorials/restate_durable_agents)
- [Restate documentation](https://docs.restate.dev)
- [Restate + LiteLLM examples](https://github.com/restatedev/ai-examples)
- [GitHub](https://github.com/restatedev/restate)
