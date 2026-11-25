---
unlisted: true
---

# TypeSafe pass-through removed

The TypeSafe `/typesafe/...` pass through route was removed in `v1.113.0`. Jev is still available via the unified `/v1/systemone` and `/v1/decisions` endpoints.

Follow the [migration guide](../decisions.md#migrate-from-typesafe-pass-through) to set up your Jev deployment and update your requests. It contains JSON image examples using either base64 assets or `input_image` parts and the requisite `TypeSafe-Danger-Zone-Images` header.
