---
title: Sandboxes
---

# Sandboxes

A sandbox is where the runtime runs and which files it can touch. You always pass one. There's no default that runs on your host.

## Built-in sandboxes

| Constructor | Runs | Good for |
|---|---|---|
| `sandbox.local(path)` | host subprocess, working directory is `path` | your laptop and trusted repos; the runtime has your user's permissions |
| `sandbox.docker(image, mounts=, workdir="/workspace")` | a container started with the `docker` CLI | CI and code you don't trust |

`sandbox.local` strips provider credentials from the child environment (`ANTHROPIC_*`, `OPENAI_*`, `LITELLM_*`, `AZURE_*`, `AWS_*`, `GEMINI_*`, `GOOGLE_API_KEY`, `CODEX_*`, `CURSOR_*`), so the runtime can't pick up your real keys. `sandbox.docker` reaches the host endpoint through `host.docker.internal` and needs no Python Docker SDK.

## Runtime binaries

In this release the runtime must already be installed in the sandbox. Build an image with the CLIs you need:

```dockerfile title="Dockerfile"
FROM node:24
RUN npm install -g @anthropic-ai/claude-code @openai/codex opencode-ai
WORKDIR /workspace
```

For `sandbox.local`, the binary must be on your `PATH`. A missing binary raises `HarnessInstallFailed` naming it. Deep Agents runs in your process and needs nothing in the sandbox.

## Setup before the first turn

Do any setup in your own code. There are no lifecycle hooks.

```python
box = sandbox.docker("my-agents:latest", mounts={"./repo": "/workspace"})
await box.run(["pip", "install", "-e", ".[dev]"])

async with litellm.aagent_session(Harness.CODEX, sandbox=box, model="litellm_proxy/coder") as s:
    ...
```

## Your own sandbox

Any object with these members is a sandbox. There's no base class to inherit from.

```python
class Sandbox(Protocol):
    workdir: str
    async def exec(self, cmd: list[str], *, env=None, cwd=None) -> Process: ...
    async def run(self, cmd: list[str], *, env=None, cwd=None, timeout=None) -> CompletedRun: ...
    async def read(self, path: str) -> bytes: ...
    async def write(self, path: str, data: bytes) -> None: ...
    def host_url(self, port: int) -> str: ...
    async def which(self, binary: str) -> str | None: ...
    async def snapshot(self) -> dict[str, str]: ...
    async def close(self) -> None: ...
```

`host_url(port)` returns a URL that code inside the sandbox can use to reach a port on your host; the runtime uses it to reach the local model endpoint. `snapshot()` returns a map of relative path to SHA-256, which is diffed before and after each turn to produce `FileChange` events.
