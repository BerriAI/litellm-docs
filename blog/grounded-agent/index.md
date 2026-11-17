---
slug: grounded-agent
title: "How to build an agent with grounding on LiteLLM"
date: 2026-10-31T09:00:00-07:00
authors:
  - ishaan
description: "Build a grounded chat agent in four steps with LiteLLM's AI Gateway. Connect your evidence, call a grounding guardrail, and show its verdict in chat."
tags: [engineering, guardrails, agents]
hide_table_of_contents: true
custom_hero: true
image: /img/grounded-agent/chat-grounded.png
---

import CodeWindow from './CodeWindow';
import {bedrockConfig, policy, sdkConnection, evidence, generateAnswer, sdkCall, bedrockResult, readAssessment, chatBadge, setup} from './examples';
import GroundedPage, {VerdictStates} from './GroundedPage';

<GroundedPage>

Build an agent that answers questions from your documents, then checks each answer against the evidence before showing it in chat.

We will connect to a LiteLLM gateway, load a policy, generate and check an answer, then display the grounding result. The Python snippets form one async request handler. Start with one document; connect your retriever once you can inspect the complete flow.

:::note Source preview

This guide uses the unreleased [SDK helper #49469](https://github.com/BerriAI/litellm/pull/49469), [native endpoint response #49460](https://github.com/BerriAI/litellm/pull/49460), and [Bedrock assessment setting #49470](https://github.com/BerriAI/litellm/pull/49470), for [issue #49217](https://github.com/BerriAI/litellm/issues/49217). Use that implementation for both your SDK and gateway until release. The template at the end pins the complete revision.

:::

## Step 1. Connect to your gateway

Configure your SDK once. Use your gateway URL and a virtual key with access to the agent model and grounding guardrail:

<CodeWindow title="agent.py / connection">{sdkConnection}</CodeWindow>

We use a model named `agent` on the gateway. The `openai/` prefix below selects the OpenAI-compatible transport; the gateway can route `agent` to a model from another provider.

For the grounding check, use [Amazon Bedrock Guardrails through LiteLLM](/docs/proxy/guardrails/bedrock#contextual-grounding). AWS maintains the assessment service, and you can use it with answers from other model providers. Add this to your gateway configuration:

<CodeWindow title="config.yaml / grounding" language="yaml">{bedrockConfig}</CodeWindow>

Create an AWS guardrail with contextual grounding enabled. For conversational answers, choose Standard tier and its required cross-Region inference profile. Set the AWS filter action to `NONE` so your application can receive an unsupported finding and decide what to display. Set `outputScope: FULL` in LiteLLM to receive supported assessments too. See [AWS setup](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.html), [filter actions](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_GuardrailContextualGroundingFilterConfig.html), and [full assessments](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ApplyGuardrail.html).

`default_on: false` leaves this guardrail available for the explicit SDK call in step 3. You control when the check runs.

## Step 2. Retrieve the evidence

Start with a home office policy. Save this text as `home-office.md`:

<CodeWindow title="home-office.md" language="markdown">{policy}</CodeWindow>

Load the policy and keep it with the question:

<CodeWindow title="agent.py / evidence">{evidence}</CodeWindow>

Your agent and the grounding service must receive the same evidence. With `contextual_grounding_from_messages: true`, LiteLLM sends the system text to Bedrock as the grounding source and the user question as the query.

For your own documents, replace the file read with your retriever. Pass only documents the current user can access. Keep previous assistant answers out of the reference evidence.

## Step 3. Generate and check the answer

Ask your model to answer from that evidence:

<CodeWindow title="agent.py / answer">{generateAnswer}</CodeWindow>

Then call the grounding guardrail with the answer and source messages:

<CodeWindow title="agent.py / grounding">{sdkCall}</CodeWindow>

`"answer-grounding"` selects the configured guardrail. `response=answer` tells the SDK to check generated output; the SDK infers the direction. You do not need to provide an input type or a response-format flag.

The call returns the guardrail's native structured findings, after LiteLLM's existing reporting sanitization. For Bedrock, the grounding assessment looks like this illustrative excerpt:

<CodeWindow title="Bedrock assessment" language="json">{bedrockResult}</CodeWindow>

Bedrock compares the answer with the supplied evidence. It does not verify whether the source document itself is correct. Evaluate the check on supported, contradicted, and incomplete answers from your use case before using it to enforce policy.

## Step 4. Show the result in chat

Read the `GROUNDING` assessments. Require an assessment before showing a positive badge, and check the score against its configured threshold:

<CodeWindow title="agent.py / verdict">{readAssessment}</CodeWindow>

Check all returned chunks. Do not infer success from Bedrock's overall `action`: a report-only guardrail can return `NONE` with a negative grounding finding.

Return the answer and verdict from your chat backend. In your chat component, show the result beside the answer:

<CodeWindow title="GroundingBadge.jsx" language="jsx">{chatBadge}</CodeWindow>

<VerdictStates />

A timeout, missing assessment, or invalid result should produce **Check unavailable**, with no green badge. The template below includes typed response validation and those failure states.

Bedrock evaluates the supplied documents together. Label the references **Documents checked**; its response does not attribute an answer to an individual document. For an unsupported answer, you can show the gap, retrieve more evidence, or withhold the answer. Wait for the check before rendering if your product gates delivery on the result.

## Deploy the complete chat template

You have the core flow: evidence, answer, grounding call, and a verdict beside the response. [Use the template](https://github.com/BerriAI/litellm-grounded-agent-starter/generate) to get the complete chat UI, a tool-calling document agent, and validated result handling in a separate repository.

<CodeWindow title="Run the complete app" language="bash">{setup}</CodeWindow>

Open [localhost:8502](http://127.0.0.1:8502). Choose **Home office allowance** for a supported answer, or **Check an unsupported answer** to see a negative verdict. This local demo uses fixed model and judge responses, labelled in the UI, so you can exercise the SDK, gateway, and chat without provider credentials.

For a live deployment, follow the template's Bedrock setup, replace the included documents with your retriever, and connect your models. The launcher supports local development; deploy the gateway and chat app with your platform's normal service configuration. Add sign-in and document authorization before sharing the app with coworkers. Live AWS execution remains unverified in this example; the template tests its adapter with representative responses.

## Key takeaways

Give your agent and grounding guardrail the same evidence. Call `litellm.guardrails.apply` after the answer exists, read the provider's assessment, and keep supported, unsupported, and failed checks distinct in your UI.

## Frequently asked questions

### Can I use an existing agent and guardrail?

Yes. Keep your framework and evaluation logic. Replace the answer-generation snippet with your agent's final answer, call `litellm.guardrails.apply`, and read your guardrail's result schema.

### Does LiteLLM generate a second answer for the check?

The SDK invokes your configured guardrail. Bedrock evaluates the supplied answer. A custom LLM judge makes an evaluation request; it does not regenerate the agent's answer to obtain the verdict.

### Can I use this with LiteLLM OSS?

The SDK changes and template are open source. Use the linked implementation revision for both the SDK and AI Gateway until release. [LiteLLM Enterprise](https://litellm.ai/enterprise) adds controls and support for production deployments.

## Recommended reading

[Call a guardrail directly](/docs/apply_guardrail), [configure Bedrock grounding](/docs/proxy/guardrails/bedrock#contextual-grounding), and [write a custom guardrail](/docs/proxy/guardrails/custom_guardrail).

</GroundedPage>

{/* truncate */}
