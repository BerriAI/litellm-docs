# Contributing Code

## Checklist before submitting a PR

Here are the core requirements for any PR submitted to LiteLLM:

- [ ] Sign the [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [ ] Keep scope as isolated as possible — your changes should address **one specific problem** at a time
- [ ] Follow the [Commit and Branch Conventions](#commit-and-branch-conventions) — PR titles are gated by CI

### Proxy (Backend) PRs

- [ ] Add testing — **at least 1 test is a hard requirement** ([details](#2-adding-tests))
- [ ] Ensure your PR passes:
  - [ ] [Unit Tests](#3-running-unit-tests) — `make test-unit`
  - [ ] [Formatting / Linting Tests](#4-running-linting-tests) — `make lint`

### UI PRs

- [ ] Ensure the UI builds successfully — `npm run build`
- [ ] Ensure all UI unit tests pass — `npm run test`
- [ ] If you are adding a **new component** or **new logic**, add corresponding tests

## Contributor License Agreement (CLA)

Before contributing code to LiteLLM, you must sign our [Contributor License Agreement (CLA)](https://cla-assistant.io/BerriAI/litellm). This is a legal requirement for all contributions to be merged into the main repository. The CLA helps protect both you and the project by clearly defining the terms under which your contributions are made.

**Important:** We strongly recommend signing the CLA **before** starting work on your contribution to avoid delays in the review process. You can find and sign the CLA [here](https://cla-assistant.io/BerriAI/litellm).

---

## Commit and Branch Conventions

LiteLLM enforces two community specs:

- **Commits** follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) — `<type>(<scope>)!: <description>`
- **Branches** follow [Conventional Branches](https://conventional-branch.github.io/) — `<type>/<description>`

Enforcement happens in two places: opt-in local git hooks in `.githooks/`, and a required CI check on the PR title (since squash-merge uses the PR title as the commit subject).

### Commit message format

```
<type>(<optional scope>)!: <description>

<optional body>

<optional footer>
```

- `<type>` is one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- `<scope>` is optional and lowercase.
- `!` before `:` marks a breaking change.
- `<description>` is required and **must start with a lowercase letter** (digits and symbols are also fine; only `A–Z` is rejected).

Examples:

```
feat(router): add weighted round-robin strategy
fix(bedrock): decouple STS region from aws_region_name
chore(deps): bump black to 26.3.1
refactor!: drop Python 3.8 support
```

PR titles must follow the same format — squash-merge uses the PR title as the commit subject and the **Conventional PR Title** workflow validates it.

### Branch naming

Format: `<type>/<short-description>` where `<type>` is one of `feature`, `bugfix`, `hotfix`, `release`, `chore`.

```
feature/weighted-round-robin
bugfix/streaming-empty-chunks
chore/bump-black
hotfix/auth-bypass
release/v1.45.0
```

Branches always allowed (the `pre-push` hook bypasses them):

- `main`
- `litellm_internal_staging`
- `dependabot/*`
- `gh-readonly-queue/*`

Tag pushes and branch deletions are also skipped.

### Installing the hooks

The hooks live in `.githooks/` and are opt-in. Run once per clone:

```shell
make install-hooks
```

This sets `core.hooksPath=.githooks` for the local repository. After that:

- `git commit` runs `commit-msg`, which validates the subject line.
- `git push` runs `pre-push`, which validates branch names.

In a rare emergency you can bypass either hook per command:

```shell
git commit --no-verify -m "..."
git push   --no-verify
```

To uninstall: `git config --unset core.hooksPath`.

---

## Proxy (Backend)

### 1. Setting up your local dev environment

Step 1: Clone the repo

```shell
git clone https://github.com/BerriAI/litellm.git
```

Step 2: Install dev dependencies

```shell
uv sync --group dev --extra proxy
```

### 2. Adding tests

- Add your tests to the [`tests/test_litellm/` directory](https://github.com/BerriAI/litellm/tree/main/tests/litellm).
- This directory mirrors the `litellm/` directory 1:1 and should **only** contain mocked tests.
- **Do not** add real LLM API calls to this directory.

#### File naming convention for `tests/test_litellm/`

The test directory follows the same structure as `litellm/`:

- `test_{filename}.py` maps to `litellm/{filename}.py`
- `litellm/proxy/test_caching_routes.py` maps to `litellm/proxy/caching_routes.py`

### 3. Running unit tests

Run the following command from the root of the `litellm` directory:

```shell
make test-unit
```

### 4. Running linting tests

Run the following command from the root of the `litellm` directory:

```shell
make lint
```

LiteLLM uses `mypy` for type checking. CI/CD also runs `black` for formatting.

### 5. Submit a PR

- Push your changes to your fork on GitHub
- Open a Pull Request from your fork

---

## UI

### 1. Setting up your local dev environment

Step 1: Clone the repo

```shell
git clone https://github.com/BerriAI/litellm.git
```

Step 2: Navigate to the UI dashboard directory

```shell
cd ui/litellm-dashboard
```

Step 3: Install dependencies

```shell
npm install
```

Step 4: Start the development server

```shell
npm run dev
```

### 2. Adding tests

If you are adding a **new component** or **new logic**, you must add corresponding tests.

### 3. Running UI unit tests

```shell
npm run test
```

### 4. Building the UI

Ensure the UI builds successfully before submitting your PR:

```shell
npm run build
```

### 5. Submit a PR

- Push your changes to your fork on GitHub
- Open a Pull Request from your fork

---

## Advanced

### Building the LiteLLM Docker Image

Follow these instructions if you want to build and run the LiteLLM Docker image yourself.

Step 1: Clone the repo

```shell
git clone https://github.com/BerriAI/litellm.git
```

Step 2: Build the Docker image

Build using `Dockerfile.non_root`:

```shell
docker build -f docker/Dockerfile.non_root -t litellm_test_image .
```

Step 3: Run the Docker image

Make sure `config.yaml` is present in the root directory. This is your LiteLLM proxy config file.

```shell
docker run \
    -v $(pwd)/proxy_config.yaml:/app/config.yaml \
    -e DATABASE_URL="postgresql://xxxxxxxx" \
    -e LITELLM_MASTER_KEY="sk-1234" \
    -p 4000:4000 \
    litellm_test_image \
    --config /app/config.yaml --detailed_debug
```

### Running the LiteLLM Proxy Locally

1. Navigate to the `proxy/` directory:

```shell
cd litellm/litellm/proxy
```

2. Run the proxy:

```shell
python3 proxy_cli.py --config /path/to/config.yaml

# RUNNING on http://0.0.0.0:4000
```
