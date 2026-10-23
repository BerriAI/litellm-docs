# agentverify

[agentverify](https://github.com/simukappu/agentverify) is an open-source pytest plugin for regression-testing AI agents. It records the `litellm.completion` / `acompletion` calls an agent makes, streamed or not, together with its tool calls, into a YAML cassette once, then replays them on every test run with no model calls and no API keys. Assertions check the tool call sequence, whether a step used the previous tool result, and token budgets.

```python
import asyncio

import pytest
from agentverify import ToolCall, assert_cost, assert_step_uses_result_from, assert_tool_calls

from agent import run_agent  # an agent whose model calls go through litellm.acompletion


@pytest.mark.agentverify
def test_answer_uses_the_weather_tool(cassette):
    async def main():
        with cassette("weather_tokyo.yaml", provider="litellm") as rec:
            await run_agent("What's the weather in Tokyo?")
        return rec.to_execution_result()

    result = asyncio.run(main())
    assert_tool_calls(result, expected=[ToolCall("get_weather", {"city": "Tokyo"})])
    assert_step_uses_result_from(result, step=1, depends_on=0, via="tool_result")
    assert_cost(result, max_tokens=2000)
```

Record once with `pytest --cassette-mode=record`, then run `pytest` to replay. A changed prompt or tool schema fails the replay with a diff.

- [GitHub](https://github.com/simukappu/agentverify)
- [PyPI](https://pypi.org/project/agentverify/)
- Examples with LiteLLM: an [OpenAI Agents SDK agent on `LitellmModel`](https://github.com/simukappu/agentverify/tree/main/examples/openai-agents-litellm-provider) and a [Google ADK agent team on `LiteLlm`](https://github.com/simukappu/agentverify/tree/main/examples/google-adk-agent-team)
