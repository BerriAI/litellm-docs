---
title: "Run evals in CI"
description: "Run a saved Lens eval against your agent and fail CI when its quality gate fails."
slug: "/proxy/lens/ci"
---

# Run evals in CI

Deploy your agent, run its saved Lens eval, and get a pass or fail with a link to the results.

The SDK runs **inside your CI runner**. It calls Lens to load the saved cases and calls your agent's HTTP API to execute them. Your agent runs on its own configured infrastructure. Lens scores the completed results, and the Action publishes the GitHub check and report link. The SDK does not call or provision a GitHub runner.

:::info Preview

This guide requires the Lens server and SDK changes in [Lens PR #30](https://github.com/BerriAI/lens/pull/30). The Action below is pinned to that implementation and builds the SDK from source. Earlier SDK wheels do not support running saved evals by name.

:::

## 1. Choose your saved eval

Use the **eval name**, such as `moyai-coding-regressions`. The saved definition must include a dataset revision, scorers, quality gates, and an `agent_io` mapping that tells Lens how to send an input and read the completed output.

If you only have a dataset, [save an eval definition first](https://github.com/BerriAI/lens/blob/45b11ae53b740e77c0f8cea804bb4aa9bbc8f760/docs/agent-io.md). That guide includes a Moyai example. You configure the mapping once; CI runs the saved definition by name.

Use an eval deployment that your CI runner can reach. It needs working model credentials and execution workers. Lens must also have a configured judge model for judge scorers.

## 2. Connect CI to Lens and your agent

For Moyai, add this to your agent repository's `pyproject.toml`:

```toml title="pyproject.toml"
[tool.lens.connections.moyai]
base_url_env = "MOYAI_EVAL_URL"
auth = "moyai_session"
password_env = "MOYAI_EVAL_PASSWORD"
```

The profile name, `moyai`, must match the saved eval's `agent_io.connection`. This preset handles Moyai's password login, session cookie, and CSRF. For a different agent, use the [HTTP connection example](https://github.com/BerriAI/lens/blob/45b11ae53b740e77c0f8cea804bb4aa9bbc8f760/docs/agent-io.md#an-agent-that-returns-its-answer-immediately).

In your GitHub repository, open **Settings > Secrets and variables > Actions** and add:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `LENS_API_KEY` | A Lens key that can read evals and datasets and create eval runs. A tracing-only key is insufficient. |
| Variable | `LENS_BASE_URL` | Your Lens server URL, without `/ui`, for example `https://lens.example.com`. |
| Secret | `MOYAI_EVAL_PASSWORD` | The password for your dedicated Moyai eval deployment. |

The agent URL and deployed build version come from your existing deployment step in the next section. Keep credentials in GitHub secrets; the committed profile contains only environment variable names.

## 3. Add Lens after your deployment step

Use your existing CI workflow to deploy the version you want to test and wait for it to be ready. The Lens Action runs the eval; it does not deploy or start Moyai.

In this example, your deployment step has `id: deploy` and exposes two outputs:

| Deployment output | Value |
| --- | --- |
| `agent-url` | The reachable URL of the eval deployment. |
| `agent-build-sha` | The actual build running at that URL. |

Use your deployment action's equivalent outputs, or write them to `$GITHUB_OUTPUT` from your deployment script. Add the following steps **after that deployment step**, in the same job, with your agent repository checked out:

```yaml title="Steps to add to your existing workflow"
- uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065
  with:
    python-version: '{{python_version}}'

- name: Run Lens eval
  uses: BerriAI/lens/src/sdk/action@45b11ae53b740e77c0f8cea804bb4aa9bbc8f760
  env:
    MOYAI_EVAL_URL: ${{ steps.deploy.outputs.agent-url }}
    MOYAI_EVAL_PASSWORD: ${{ secrets.MOYAI_EVAL_PASSWORD }}
    LENS_VERSION: ${{ steps.deploy.outputs.agent-build-sha }}
  with:
    eval-name: moyai-coding-regressions
    api-key: ${{ secrets.LENS_API_KEY }}
    base-url: ${{ vars.LENS_BASE_URL }}
    install-from-source: 'true'
```

Replace `moyai-coding-regressions` with your saved eval name. The source install needs a runner with `rustup`, such as GitHub's `ubuntu-latest` runner.

Set these permissions on the job so Lens can publish its check and PR comment:

```yaml
permissions:
  contents: read
  checks: write
  pull-requests: write
```

Run the job on pushes to `main` and on pull requests. Skip fork and Dependabot PRs, which do not receive these secrets. Add this job condition, or combine it with your existing condition:

```yaml
if: >-
  github.actor != 'dependabot[bot]' &&
  (github.event_name != 'pull_request' ||
   github.event.pull_request.head.repo.full_name == github.repository)
```

**Run it on `main` first** against the deployed main build to establish a baseline. Then run the same eval against a PR's deployed build. Lens compares compatible runs, publishes `Lens / moyai-coding-regressions`, and links to the results. A failed quality gate publishes its report before failing the job.

`LENS_VERSION` labels the evaluated build. Setting it to a commit SHA does not update the agent at `MOYAI_EVAL_URL`; always use the version your deployment actually runs.

## Run the same eval in pytest

An existing test suite can use the same saved eval and connection profile:

```python title="tests/test_lens.py"
import os

from lens import Lens


def test_moyai():
    lens = Lens(
        base_url=os.environ["LENS_BASE_URL"],
        api_key=os.environ["LENS_API_KEY"],
    )
    lens.evals.run("moyai-coding-regressions").assert_passed()
```

Install the preview SDK and pytest in your project's environment. This source install needs Rust 1.99.0:

```bash
python -m pip install pytest \
  'lens-evals @ git+https://github.com/BerriAI/lens.git@45b11ae53b740e77c0f8cea804bb4aa9bbc8f760#subdirectory=src/sdk'
```

Set the same connection environment variables and `LENS_VERSION`, then run `pytest tests/test_lens.py`. `assert_passed()` fails the test when the saved quality gate fails. Use the Action above when you also want the GitHub check and comparison comment.

## If the run fails

Open the **Run evals** step for configuration errors. For a completed run, follow its Lens link to inspect case outputs, trial errors, scores, and the failed gate.

| What you see | What to check |
| --- | --- |
| Eval not found, or missing connection profile | Use the saved eval name, not the dataset name. Match `agent_io.connection` to the profile in the checked-out `pyproject.toml`. |
| Authentication, connection, or timeout error | Check the Lens key, Moyai password, runner access to both services, and the agent's model gateway and workers. |
| Trace missing or version mismatch | If the eval uses traces, the agent must emit `agent.name`, `agent.version` matching `LENS_VERSION`, and `deployment.environment = "lens-eval"`, plus the ID used by its trace mapping. |
| Neutral PR check | No compatible main baseline exists yet and the absolute gates passed. Run the same eval on main first. |
| Quality gate failed | Review the failing cases in Lens, fix the agent, and rerun the eval. |

Output-only judge evals can run without traces. Tool-use scorers and cost gates require a trace mapping and matching traces. The [agent I/O guide](https://github.com/BerriAI/lens/blob/45b11ae53b740e77c0f8cea804bb4aa9bbc8f760/docs/agent-io.md#mapping-and-scoring-rules) covers both.

For other CI systems, run `lens eval --name moyai-coding-regressions` with the same configuration. The CLI exits with `0` for pass, `1` for a failed quality gate, and `2` for a configuration or infrastructure error.
