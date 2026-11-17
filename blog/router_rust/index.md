---
slug: router-rust
title: "Routing in Rust"
date: 2026-11-11T17:00:00
authors:
  - nate
description: "As of v1.110.0, all routing in LiteLLM flows through a Rust core. Here is why we rebuilt the router and how differential testing let us migrate it without regressions."
image: ./router-swap-cover.gif
tags: [rust, rust-migration, routing, engineering]
hide_table_of_contents: false
---

import PlaygroundModal from '@site/src/components/RouterPlayground/PlaygroundModal';
import RouterSwapHero from './RouterSwapHero';
import {SwapDiagram, HubDiagram, PlanDiagram, ApiMapDiagram, DiffTestDiagram, LitefuzzDiagram, MutationDiagram, AgentPipelineDiagram} from './diagrams';

export const Hero = RouterSwapHero;

As of today, v1.110.0, all routing in LiteLLM flows through a Rust core! The previous python code that implemented it is fully deleted, and we have one source of truth in the codebase. That includes all logic around retries, fallbacks, name resolution, deployment selection, etc. It was over 50k LOC deleted in the final swap.

Right now, LiteLLM users won't see a huge change, but the value will manifest when we have incredibly fast messages in December. Additionally, this refactor enabled us to create the <PlaygroundModal>router playground</PlaygroundModal>, which is great for exploring routing configurations.

This post covers why we chose the Router to operate, and how we managed to migrate it safely without causing regressions.

{/* truncate */}

<SwapDiagram />

## The router

We are moving towards the goal of getting `/v1/messages` calls (like Claude code makes) entirely in the Rust fast-path by December 1.
Routing is on the critical path of _every_ request, and is a crucial part of the value proposition of LiteLLM itself.
However, rewriting the router isn't easy.
It reaches out to a large number of other components, and does redis access, database access, calls every inference endpoint, and is called by both SDK users and the proxy itself.

<HubDiagram />

### How we changed it

Because it's called by SDK users, we can't just rewrite fully to Rust and change the API in a way that breaks existing code.
However, the existing router code had grown in a fairly unwieldy way, regularly growing additional methods that did almost the same thing as one another.
It was worth the time to refactor it first while maintaining backwards compatibility, and only after that migrate the core over to Rust.
We can make the surface exposed via the new API a lot more amenable to being passed across a serialization boundary.

<PlanDiagram />

For example, the old router API had the following methods, which did not quite have the same arguments:

```python
def get_available_deployment(...): ...
def async_get_available_deployment(...): ... # not same arg order as above
def async_get_healthy_deployments(...): ... # called by above method internally
```

We were able to pare this down to a family of methods that still exposed all the same behavior, but were a lot more intentional about when we were inducing side effects, exposing mutable objects, or changing configuration.

### The new interface

The new interface of the router looks something like this

```python
class Router:
  def registry(): Registry # answers which deployments exist
  def settings(): Settings # A snapshot of how the router is configured
  def health(): Health # Deployment health and cooldowns. Used to report outcomes
  def select(): Deployment | None # Select the deployment to use without using it
  def apply(ChangeSet): ApplyResult # Modify deployments or settings
  def register_plugin(Plugin): None # Register a custom routing strategy
```

The new interface segments functionality into logic subsets, and most of its exposed information is immutable. Callers have to be very explicit about what they want to modify. This shape of interface is a lot more efficient, and also gives you more information from reading the code. If someone accesses the router with `router.registry().something`, without reading further you can verify that the router is unchanged in the rest of the code.

<ApiMapDiagram />

Existing open source code that uses the router will log a deprecation warning that clarifies what should be used instead, and the existing router interface will be removed at the end of this month.

### Lessons from other rewrites

There have been a huge number of rewrites in software over the last few decades of software. Some successful, but many that were not successful. Joel Spolsky's [classic post](https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/) on why rewrites from scratch are a bad idea captures the biggest failing of any rewrite: forgetting the lessons that the source code already learned. Our router code has been battle-tested over years, and we don't want to lose the correctness that we already have. That correctness is hugely valuable.

If we had a 100% comprehensive test suite, it would be almost trivially easy to complete such a rewrite.
Just shoot agents at the problem, wait until we pass every test, and then we're done!
However, no test suite is 100% comprehensive, and the router contains a lot of very complex and delicate logic.
There are edge cases around retries, wildcards and aliases, per-request overrides for specific keys, teams, or regions, etc.
Our test coverage was pretty good, but we wanted to make sure that we didn't lose important edge cases.

## Differential testing

Differential testing solves that for us, as well as anything can.
The core question of differential testing is "If I put black box A and black box B through the same case, do they do the same thing?"

### What is differential testing?

Differential testing is at its most useful when making a large, yet behavior-preserving change. A 'behavior-preserving' change means that you are changing the code, and maybe the way that callers interact with your code, but you are not trying to change behavior for an end user. This could be to expose a new interface, switch to a new library for a particular purpose, swap out your nosql store for a relational database, or any number of other things. The important part is that you want it to act in the same way.

> A behavior-preserving change is transparent to an end user.

In other words, saying that your change is behavior-preserving is the same as saying "Given any input, I want my old implementation and my new implementation to do the same thing". This is the core statement that we are trying to verify when performing differential testing. We do not care if "the same thing" is the *correct* thing, only that it is the same in all the ways we care about.

<DiffTestDiagram />

### How we do differential testing

We use differential testing to test every single aspect of these huge changes.
We use it for both the initial large refactor and also the swap into Rust.
Differential testing has the advantage that you can generate a huge number of cases very cheaply.
However, it requires some setup and scaffolding shared across many cases.

#### `litefuzz`

We have a private repository called `litefuzz` (written in Rust) which powers our differential testing.
It is domain-specific to the litellm repo, and uses the state of the art in differential testing and coverage-guided mutation.

<LitefuzzDiagram />

At a high level, it breaks down into the following components:

- The world is the surrounding environment that has a setup shared among different testcases. It might be seeded rows into the database, a set of deployments or a config.yaml, or the Redis and Postgres instances.
- A case is a specific set of steps that the test drives against the object under test. For an http-level test, it is the requests that the client sends, as well as how the upstream provider responds.
- A channel is a way that we collect information about what happened during our test cases. A channel might be the response the server sends to the client, the data that lives in postgres afterwards, the state in Redis, or what exactly was sent to the upstream provider. Channels normalize their output to avoid random noise creating false differences.
- An oracle is used to compare if the case running on a separate implementation differed in a way that matters.

The **world** sets up the environment in which the **case** runs, with output **channels** being judged against each other by the **oracle**.

#### Fuzz testing and coverage-guided mutation

Line and statement coverage is a common mechanism by which test thoroughness is measured.
It makes sense, you want to see how much of the logic (the lines) are covered by the test cases.
We use the exact same metric to guide which cases we should keep, and also make modifications to our existing cases so that they reach new statements.

When running with `litefuzz`, it measures which lines are captured by each test case. It also has the ability to modify the parameters of the case, which is called 'fuzzing'. It might modify strings to be twice as long, or empty, or an emoji, or in Chinese. It will do similar things with numbers, making them very large, very small, negative, etc. In addition to these edge-case modifications, the cases can be written so that it generates modifications on a specific set of fields in a certain way.

`litefuzz` can be run to generate new cases via mutation, and it will only keep the mutated cases if either:

- the new case finds a difference between the two implementations being tested
- the new case reaches a new line of code that has not been reached before

<MutationDiagram />

#### Creating cases and test suites

In one word, *agents*. We heavily leverage agents for all phases of the generation and validation process.

<AgentPipelineDiagram />

We first have the change set or feature that we are trying to test. We use a series of agents to try to capture the set of behaviors we might care about for that particular module, as well as what functionality we need in the `litefuzz` harness in order to test it. These behaviors are just plaintext descriptions first, as that way we separate the intention from the code. We operate in rounds where the set of all behaviors is compared, and agents try to look for gaps we might not have covered. Once this settles, we start generating the actual cases.

For all of the behaviors in question, we fan out agents to generate cases for them. We have a large number of ephemeral workers that can spin up to run these cases and check line coverage on either side of the change. We keep generating the behavior-driven cases until agents told to look for gaps are coming up with very low-meaning cases. Adversarial agents also check that the cases actually test the behavior in question. Cases are run throughout this process to see when they catch differences in behavior.

Finally, we enter the last round of testing. For this round, we are pushing the line coverage to the limit. We want to cover every line multiple times over. We run some mutations rounds, then dispatch subagents to try to compose cases that touch specific lines of code. These agents are usually tracing backwards in the code in order to reason about what sequence of things must be true for the code to get there. Then, we run those cases, and update the state of line coverage.

If a specific line fails to be reached after multiple attempts, it is marked 'difficult'. The orchestrator will later go over those difficult cases and indicate which ones should be addressed by a more flexible harness, or if the line is actually impossible to hit.

## Where we're going next

From here, we are reworking callbacks, configuration, and the auth path as necessary to get `/v1/messages` blazing fast by Dec 1. Keep tabs on our progress at the [GitHub discussion](https://github.com/BerriAI/litellm/discussions/48869), where we post updates every Monday!
