---
title: "v1.99.2 - Caller Timeout Cooldowns"
slug: "v1-99-2"
date: 2026-09-15T10:00:00
authors:
  - name: Krrish Dholakia
    title: CEO, LiteLLM
    url: https://www.linkedin.com/in/krish-d/
    image_url: https://pbs.twimg.com/profile_images/1298587542745358340/DZv3Oj-h_400x400.jpg
  - name: Ishaan Jaff
    title: CTO, LiteLLM
    url: https://www.linkedin.com/in/reffajnaahsi/
    image_url: https://pbs.twimg.com/profile_images/1613813310264340481/lz54oEiB_400x400.jpg
  - name: Yuneng Jiang
    title: Senior Full Stack Engineer, LiteLLM
    url: https://www.linkedin.com/in/yuneng-david-jiang-455676139/
    image_url: https://avatars.githubusercontent.com/u/171294688?v=4
hide_table_of_contents: false
---

:::info[This is a Docker-only release]

`v1.99.2` is distributed as container images. There is no PyPI package for this version, so `pip install litellm==1.99.2` will not resolve, and `1.99.0` is the newest version this line ever published to PyPI. If you install LiteLLM from PyPI, this fix does not reach you yet: it is on the development line but is not in `1.101.0`, the current PyPI release, so it arrives in a later one.

The `latest` tag does NOT point at this release. LiteLLM has moved well past the 1.99 line, so `latest` stays where it is and you have to ask for `1.99.2` by name.

:::

## Deploy this version

```bash
docker run \
-e STORE_MODEL_IN_DB=True \
-p 4000:4000 \
docker.litellm.ai/berriai/litellm:1.99.2
```

`v1.99.2` is a patch release on top of [`v1.99.1`](/release_notes/v1.99.1/v1-99-1). It stops a caller's own request timeout from taking a deployment out of rotation for everyone else.

If your proxy runs a model group with a low `allowed_fails` and callers that set their own per-request `timeout`, this release is worth picking up. Before it, a request that sent `"timeout": 0.001` and got the resulting 408 counted as a deployment failure, so one impatient caller could put a healthy deployment into cooldown and every other caller on that model group saw "No deployments available" until the cooldown expired. A 408 now counts against the deployment only when it arrives after the caller's own timeout could have fired, which is the point past which the provider, not the caller, is the one that ran long.

The guard is narrow on purpose. A deployment configured with its own small `timeout` still gets cooled down on a 408, so a genuinely slow or unhealthy deployment is still pulled out of rotation the way it always was. The marker that makes a timeout caller-set is written by the proxy, so callers driving the Router directly through the SDK are unaffected either way.

This release also refreshes tornado to 6.5.8, GitPython to 3.1.59, and pypdf to 6.16.1 in the lockfile, all versions the development line already resolves at or above. Those are lockfile changes, so they reach you through the image and through the locked development environment, and no declared dependency range moved. No configuration changes.

### What's Changed

- fix(router): stop counting caller-set timeout 408s toward deployment cooldown - [PR #41230](https://github.com/BerriAI/litellm/pull/41230)

## Full Changelog

https://github.com/BerriAI/litellm/compare/v1.99.1...v1.99.2
