---
unlisted: true
---

# TypeSafe pass-through removed

The TypeSafe `/typesafe/...` pass-through route was removed. Jev remains available through the unified `/v1/systemone` and `/v1/decisions` endpoints.

Follow the [migration guide](../decisions.md#migrate-from-typesafe-pass-through) to configure a Jev deployment and update your requests. It includes JSON image examples using base64 assets or `input_image` parts and the required `TypeSafe-Danger-Zone-Images` header.
