# Open-APA-Core Integration with LiteLLM

This short example shows how to use LiteLLM as a unified gateway for Open-APA-Core workflow calls.

`python
from litellm import completion
from open_apa_core import GovernedWorkflow

# Example: get a response from Claude Opus via LiteLLM
response = completion(
    model="claude-opus-4-6",
    messages=[{"role":"user","content":"What is the current EUR/USD rate?"}]
)

# Feed result into APA workflow
wf = GovernedWorkflow(state={})
wf.transition(event="process_llm", payload=response)
`

Add this file to docs/ and reference it from the main README.