# Code Quality

🚅 LiteLLM follows the [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html).

We run: 
- Ruff for formatting and linting (`make format`, `make lint-ruff`)
- basedpyright for type checking (`make lint-basedpyright`)
- Circular import and import safety checks (`make check-circular-imports`, `make check-import-safety`)

Run `make lint` from the root of the `litellm` repository to run the same checks as CI.


If you have suggestions on how to improve the code quality feel free to open an issue or a PR.
