---
slug: liteflow
title: "Launching Liteflow: define and run AI workflows."
date: 2026-11-06T09:00:00+08:00
authors:
  - ishaan
description: "Preview AI workflows on the LiteLLM AI Gateway: define LLM calls and Python with the Liteflow SDK, then register and invoke them as models."
tags: [engineering, ai-gateway]
hide_table_of_contents: true
custom_hero: true
image: /img/liteflow/social.png
---

import LiteflowPage from './LiteflowPage';
import { BeforeWorkflow, GatewayWorkflow } from './WorkflowArchitecture';

<LiteflowPage>

## The problem

Today, when you build production AI workflows for document processing or email processing, you define the workflow in your code. For example:

1. Call Anthropic to classify an email as negative or positive.
2. Use that result in a second LLM call to extract a summary.
3. Call a third LLM to write a reply.

Once you build this, you need to deploy and maintain a server for the workflows that connect these model calls.

<BeforeWorkflow />

## The solution

With [Liteflow](https://github.com/BerriAI/liteflow), you define your workflows and register them on the LiteLLM AI Gateway. When you want to run a workflow, call it as a Chat Completions request on the gateway.

The gateway stores the workflow definition, connects the LLM calls, and runs the Python steps through Monty. Liteflow is the SDK you use to call these gateway APIs. You do not need to maintain a separate workflow server.

<GatewayWorkflow />

**Developer preview.** The SDK is available from source; the [gateway runner](https://github.com/BerriAI/litellm/pull/50376) and [Monty Python worker](https://github.com/BerriAI/litellm/pull/50327) are under review.

## How to use it

Draft a customer email with one model, turn its output into review messages in Python, then review it with another model. Use the [SDK and gateway setup](#preview-setup) below to run these steps. Replace `sonnet` and `haiku` with your gateway's model aliases.

### Step 1. Define your workflow {#step-1-define-your-workflow}

Save this as `workflow.py`:

```python title="workflow.py"
from liteflow import ChatCompletion, ChatMessage, Input, Python, Workflow

def review_messages(draft: str) -> list[ChatMessage]:
    return [{"role": "user", "content": "Review and improve this reply: " + draft}]

workflow = Workflow(name="email-reply", nodes=[
    ChatCompletion(model="sonnet", messages=Input.messages),
    Python(fn=review_messages),
    ChatCompletion(model="haiku", messages=Input.previous),
])
```

`Input.messages` contains the caller's email. Sonnet drafts a reply, Python receives that text as `draft: str`, and Haiku receives the returned chat messages through `Input.previous`.

Use saved, top-level Python functions with input and output types. Set `timeout_seconds` on nodes and the workflow to fit your workload; `Retry(max_attempts=2, backoff_seconds=1)` configures node retries.

### Step 2. Register it on the gateway {#step-2-register-and-publish}

Set your gateway URL and key. The URL should not include `/v1`:

```bash
export LITELLM_PROXY_URL="https://gateway.example.com"
export LITELLM_PROXY_API_KEY="<team-bound workflow key>"
```

Save `register.py` beside `workflow.py` and run `python register.py`:

```python title="register.py"
import os
from liteflow import GatewayClient
from workflow import workflow

with GatewayClient(
    base_url=os.environ["LITELLM_PROXY_URL"],
    api_key=os.environ["LITELLM_PROXY_API_KEY"],
    timeout=75,
) as gateway:
    draft = gateway.register(workflow)
    print(draft.workflow_id)
```

Registration creates a draft. Before Step 3, ask a team admin who did not create the workflow to [review and publish it](#reviewer-publication), using the printed workflow ID.

### Step 3. Invoke it as a model {#step-3-run-and-read-the-result}

Call the standard Chat Completions endpoint with `model` set to `workflow/email-reply`:

```bash
curl --fail-with-body "$LITELLM_PROXY_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "workflow/email-reply",
    "messages": [
      {"role": "system", "content": "Write a short customer-service reply."},
      {"role": "user", "content": "I was charged twice for my booking. Can you help?"}
    ],
    "stream": false
  }'
```

Read the reviewed reply in `choices[0].message.content`. Your application sends one request; the gateway executes the sequence and returns the last model's text.

If the gateway cannot find the workflow, check publication and the invoking key's access to the workflow and child models. The preview gateway waits up to 60 seconds for a synchronous result; a longer client timeout does not extend that limit.

## Examples {#more-production-processing-examples}

You can define these workflows with the SDK today. Running these examples on the gateway is still in development.

### Parallel calls

Compare two models on the same input. Each named branch contributes its result to the output. Save this as `parallel_workflow.py`:

```python title="parallel_workflow.py"
from liteflow import ChatCompletion, Input, Parallel, Workflow

workflow = Workflow(name="compare-models", nodes=[
    Parallel(branches={
        "sonnet": [ChatCompletion(model="sonnet", messages=Input.messages)],
        "haiku": [ChatCompletion(model="haiku", messages=Input.messages)],
    }),
])
```

For an email pipeline, use parallel branches for independent issue extraction, topic classification, or sentiment analysis. Join those results before the sequential reply steps.

### If/else

Extract expense fields from a document into JSON, then choose a review queue with a Python rule. Save this as `expense_workflow.py`:

```python title="expense_workflow.py"
from pydantic import BaseModel, ConfigDict, Field
from liteflow import ChatCompletion, If, Input, Python, Workflow

class Expense(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_usd: float = Field(ge=0)
    has_receipt: bool

def needs_review(expense: Expense) -> bool:
    return not expense.has_receipt or expense.amount_usd > 250

def review_queue(expense: Expense) -> str:
    return "review"

def ready_queue(expense: Expense) -> str:
    return "ready"

workflow = Workflow(name="expense-intake", nodes=[
    ChatCompletion(model="sonnet", messages=Input.messages, response_model=Expense),
    If(condition=needs_review,
       then=[Python(fn=review_queue)],
       otherwise=[Python(fn=ready_queue)]),
])
```

`response_model=Expense` defines the first model's JSON output. For `{"amount_usd": 300, "has_receipt": true}`, the condition receives a typed `Expense` and chooses the `review` branch. A $180 expense with a receipt returns `ready`. These labels select a queue; they do not approve a payment.

### Loops

Extract a batch of rows and classify each one. Save this as `classification_workflow.py`:

```python title="classification_workflow.py"
from pydantic import BaseModel, ConfigDict
from liteflow import ChatCompletion, ChatMessage, ForEach, Input, Python, Workflow

class Rows(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[str]

def classification_messages(row: str) -> list[ChatMessage]:
    return [{"role": "user", "content": "Classify as billing, booking, or other. Return only the label: " + row}]

workflow = Workflow(name="classify-rows", nodes=[
    ChatCompletion(model="sonnet", messages=Input.messages, response_model=Rows),
    ForEach(items=Input.previous.field("items"), nodes=[
        Python(fn=classification_messages),
        ChatCompletion(model="haiku", messages=Input.previous),
    ]),
])
```

The first model returns JSON such as `{"items": ["Change my booking", "Explain this charge"]}`. `ForEach` passes each row to its body and returns classifications in the original order. Your application supplies the row text; this example does not read a workbook.

Nest these patterns when your workflow needs both parallel and sequential stages. See the [graph workflow guide](https://github.com/BerriAI/liteflow/blob/main/docs/graph-workflows.md) for input bindings and limits.

## Security

Every Python step runs through Monty in a separate worker process. Monty limits how long the code can run, how much memory it can use, and how much data it can read or return.

The gateway does not give Python steps its model clients or provider credentials. Monty has limited `print` output and no functions for reading host files, making network requests, or reading the gateway's environment variables. If Monty cannot run a step, the step fails. It does not fall back to ordinary Python on the gateway.

Python execution and validation run outside the gateway's event loop. The gateway handles model calls while Monty handles Python code. Monty restricts the Python language and its available functions; it is not an operating system sandbox or a guarantee of zero impact on other requests. Review the workflow and the data it sends to models before you publish it.

## Setup {#preview-setup}

Use Python 3.10 or later and Git. Install the SDK from this source revision in a new environment: {/* keep-python-version: minimum declared by this pinned Liteflow SDK, not the LiteLLM runtime. */}

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install \
  'git+https://github.com/BerriAI/liteflow.git@3289b9290ccbc8261617af3b76ed4e82b8a60919'
```

The PyPI name `liteflow` belongs to a different project. Use the source install above.

Get a workflow-enabled preview gateway from your platform administrator; stable releases do not include the runner. Use a reachable root URL and a team-bound key with access to the child models and published workflow names. Structured examples need JSON-schema output.

Check the first definition without calling a model or gateway:

```bash
python -c 'from workflow import workflow; from liteflow import compile_workflow; print([node["type"] for node in compile_workflow(workflow)["nodes"]])'
```

Expected output:

```text
['chat_completion', 'python', 'chat_completion']
```

### Review and publish {#reviewer-publication}

Give the workflow ID to a different authorized administrator on the same team. The reviewer sets these values in their shell, using their own key:

```bash
export LITELLM_PROXY_URL="https://gateway.example.com"
export LITEFLOW_WORKFLOW_ID="<workflow ID from registration>"
export LITELLM_PUBLISHER_API_KEY="<reviewer administrator key>"
```

Save this as `publish.py` and run `python publish.py`:

```python title="publish.py"
import os
from liteflow import GatewayClient

with GatewayClient(
    base_url=os.environ["LITELLM_PROXY_URL"],
    api_key=os.environ["LITELLM_PUBLISHER_API_KEY"],
    timeout=75,
) as publisher:
    draft = publisher.get(os.environ["LITEFLOW_WORKFLOW_ID"])
    print(publisher.validate(draft))
    print(publisher.publish(draft))
```

Continue to Step 3 after both calls succeed. A second key belonging to the author does not satisfy the preview API's reviewer separation.

### Update a workflow

Edit the definition in Git. In the author's shell, set the existing workflow ID:

```bash
export LITEFLOW_WORKFLOW_ID="<workflow ID from registration>"
```

With the author's connection values, save and run `update.py`:

```python title="update.py"
import os
from liteflow import GatewayClient
from workflow import workflow

with GatewayClient(
    base_url=os.environ["LITELLM_PROXY_URL"],
    api_key=os.environ["LITELLM_PROXY_API_KEY"],
    timeout=75,
) as gateway:
    current = gateway.get(os.environ["LITEFLOW_WORKFLOW_ID"])
    updated = gateway.register(workflow, draft=current)
    print(updated.workflow_id)
```

Have the reviewer validate and publish the updated draft. Your application continues to call `workflow/email-reply`.

### Run it from Python

For Python applications, save this as `run.py` and run `python run.py` with the invoking key:

```python title="run.py"
import os
from liteflow import GatewayClient

with GatewayClient(
    base_url=os.environ["LITELLM_PROXY_URL"],
    api_key=os.environ["LITELLM_PROXY_API_KEY"],
    timeout=75,
) as gateway:
    result = gateway.run(
        "email-reply",
        messages=[
            {"role": "system", "content": "Write a short customer-service reply."},
            {"role": "user", "content": "I was charged twice for my booking. Can you help?"},
        ],
    )
    print(result.output)
    print(gateway.inspect(result.run_id))
```

`result.output` contains the final reply; `inspect()` returns the stored step details. See [implementation status](https://github.com/BerriAI/liteflow), [workflow examples](https://github.com/BerriAI/liteflow/tree/main/examples), or [talk to the LiteLLM team](https://www.litellm.ai/enterprise) about your processing flows.

</LiteflowPage>

{/* truncate */}
