---
slug: typesafe_jev_images
title: "Day 0 Support: TypeSafe Jev 1.14: Adds images, box questions, and long context"
date: 2026-10-15T10:00:00
authors:
  - kerry
  - mateo
description: "TypeSafe Jev 1.14 reads images, answers box questions with coordinates and takes long-context requests. LiteLLM serves all three on /v1/systemone and /v1/decisions behind TypeSafe's opt-in headers."
card_title: "Jev 1.14"
card_summary: "Jev 1.14 reads PNG and JPEG images, answers box questions with coordinates, and takes long-context requests on LiteLLM."
tags: [typesafe, jev, decisions, day 0 support]
hide_table_of_contents: false
---

TypeSafe's Jev 1.14 adds a question type, `box`, that answers with where something is in an image. LiteLLM supports it from day 0 on both [decision routes](/docs/decisions), `POST /v1/systemone` and `POST /v1/decisions`, together with TypeSafe's image input and long-context mode. If you are new to Jev, start with the [TypeSafe Jev launch post](/blog/typesafe_jev) and the [decision models post](/blog/decision-models), which cover what a decision model is and how the two routes relate. Request `jev-1.14.0` through the proxy and the same virtual keys, budgets, spend logs and fallbacks you already use for decision models apply.

{/* truncate */}

## Why images on a decision model matter

A decision model answers typed questions with probabilities instead of text, which is what makes it cheap enough to sit in front of every request. Until now LiteLLM only sent text to them. The visual checks in a production app, whether an upload is a receipt, whether a listing photo breaks a policy, whether a screenshot shows an error dialog, still went to a chat model with a vision prompt, a JSON parser and a retry loop. Jev 1.14 answers those the same way it answers text questions: a `noul` question about an image comes back as a single probability you can threshold, log and compare, with no prose to parse.

The `box` question type, new in Jev 1.14 and also on `jev-preview`, adds where. Ask for "the red square in `photo`" and the answer is four edges, `top`, `bottom`, `left` and `right`, as fractions of the image height and width measured from the top left corner, plus a `confidence`. Because the edges are fractions, the same answer is correct at any image size, so you can crop the region for a bigger model, highlight it in a review tool or check that a required element is where it should be, without a generation step in between.

Long context is the third piece. TypeSafe's default limits are 64k tokens per request and 32k per question. With `TypeSafe-Danger-Zone-Long-Context: true` on the request, Jev decides over a whole contract, transcript or record in one call rather than a sliding window you stitch together yourself.

## What LiteLLM adds

TypeSafe keeps images, `box` questions and long context behind opt-in request headers, `TypeSafe-Danger-Zone-Images: true` and `TypeSafe-Danger-Zone-Long-Context: true`. The proxy forwards any client header that starts with `TypeSafe-Danger-Zone-` to TypeSafe deployments and to no other provider, so a client turns the features on per request and nothing leaks to the other decision providers behind the same model name.

On `/v1/systemone` you send the images TypeSafe's way, named in `assets` and referenced from `state`. On `/v1/decisions` you send them OpenAI's way, as `input_image` parts with an image URL or a data URL, and LiteLLM turns each PNG or JPEG into an asset, puts the asset's name where the image was in the text and downloads image URLs first. A `box` answer comes back in the shape of the route you called, so an app written against the OpenAI Decisions format gets Jev's image answers without learning the System One format.

The same headers work on the [`/typesafe` pass-through](/docs/pass_through/typesafe). If you call TypeSafe's API directly with `LITELLM_PROXY_BASE_URL/typesafe` as the base URL, client headers that start with `TypeSafe-Danger-Zone-` are forwarded to TypeSafe and other client headers are not, so an existing System One client only needs the header and `jev-1.14.0` to use images and `box`.

The failure modes stay predictable. A `box` question to a model that cannot answer it, `jev-1.13.0` and `jev-latest` included, or an image sent without the header, gets a 400 before any provider is called. With `drop_params` on, LiteLLM drops the question or the image instead and the rest of the request goes through, with a dropped question returned as `{"type": "refusal"}` on `/v1/decisions` and left out of `answers` on `/v1/systemone`. Spend for `jev-1.14.0` lands in the spend logs at TypeSafe's $0.042 per 1M input tokens, with no output charge.

The headers, the `assets` shape and a worked box example are in [TypeSafe images, box questions and long context](/docs/decisions/typesafe_images), and SDK usage is in [SDK usage](/docs/decisions/sdk). Images and `box` questions ship in the next LiteLLM release, and cost tracking for `jev-1.14.0` works on the version you already run after you reload the model cost map.

## Feedback

Tell us what you build with image decisions, and what breaks, in [GitHub Discussions](https://github.com/BerriAI/litellm/discussions).
