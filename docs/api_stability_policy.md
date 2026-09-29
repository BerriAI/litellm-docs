# API Stability Policy

This page defines which parts of the LiteLLM Proxy HTTP API are a public contract we work to preserve, and which parts are private and may change at any time.

## The OpenAPI spec is the public API

Every endpoint that appears in the proxy's OpenAPI spec is public. The spec is served at `/openapi.json` and rendered as Swagger UI at `/` by default (configurable with `DOCS_URL`, see [UI settings](./proxy/ui.md)). For public endpoints we work to maintain the behavior contract: the path and HTTP method, the request and response shapes, authentication requirements, and default behavior.

Additive changes are not breaking and can ship in any release: new endpoints, new optional request fields, and new response fields. Clients should ignore response fields they do not recognize. A change that removes or renames a field, changes a default, tightens who may call an endpoint, or otherwise requires action to keep prior behavior is a breaking change. Breaking changes are called out in a dedicated `Breaking Changes` section at the top of the [release notes](/release_notes) for the version that ships them, and are held to the [release cycle](./proxy/release_cycle.md) versioning rules.

## Everything else is private

Any endpoint not in the OpenAPI spec is private. These routes exist to serve the LiteLLM Admin UI or internal proxy needs. In the codebase they are hidden from the spec with `include_in_schema=False` on the route definition; `/login`, `/v2/login`, and `/fallback/login` are examples. Private endpoints can change their request or response shape, change behavior, or be removed in any release without notice, and they are not covered by the breaking change process above.

Do not build integrations against private endpoints. If you need functionality that only a private endpoint provides today, open a [GitHub issue](https://github.com/BerriAI/litellm/issues) describing the use case so it can be exposed through a supported public endpoint.

## Checking what is public on your version

The spec is generated from the running proxy, so it reflects exactly the version you deploy. To list the public paths:

```bash
curl -s http://localhost:4000/openapi.json | jq '.paths | keys'
```

Setting `NO_DOCS` or `NO_OPENAPI` (see [environment variables](./proxy/config_settings.md#environment-variables---reference)) stops the proxy from serving Swagger UI or `/openapi.json`; it does not change which endpoints are public. Fetch the spec from a proxy without those flags set, or from the same version running locally, to see the public surface.

## Related

- [Release Cycle](./proxy/release_cycle.md): how versions are numbered and what a major, minor, and patch bump means.
- [Migration Policy](./migration_policy.md): what happens when a beta feature moves to Enterprise.
