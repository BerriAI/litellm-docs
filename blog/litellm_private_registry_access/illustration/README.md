# Private Registry illustration

A static, transparent diagram with the Amazon ECR, Amazon Cognito, and LiteLLM icons. The solid arrow represents an artifact pull from the registry to a LiteLLM deployment. The dotted Cognito connection represents authentication, separate from the artifact transfer. A small package glyph identifies the transfer. There is no animation or visible text.

The SVG scales with the page. LiteLLM uses its blue logo in light mode and white logo in dark mode. The original AWS service artwork retains its category colors and proportions, with no additional containers or cards.

Run `npm install` and `node render.mjs` in this directory to regenerate `../cover.svg`, the transparent `../cover.png`, and `../cover-dark.png`. The page imports the SVG directly; the PNG is used for blog metadata and external renderers. No rendering library runs in the browser.

See `assets/SOURCES.md` for icon provenance.
