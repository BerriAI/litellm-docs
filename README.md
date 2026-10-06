# litellm-docs

Source for [docs.litellm.ai](https://docs.litellm.ai); the documentation site for [LiteLLM](https://github.com/BerriAI/litellm).

Built with [Docusaurus 3](https://docusaurus.io/).

## Local development

```bash
npm install
npm start
```

Open http://localhost:3000 to see the site with live reload.

## Build

```bash
npm run build
```

Static output goes to `build/`.

The build renders up to four pages and optimizes up to two images at a time to fit the 8 GB Vercel build machine. Set `DOCUSAURUS_SSR_CONCURRENCY` to override page-rendering concurrency when running `npm run build` on a different machine.

## Deploy

Deploys are handled automatically by Vercel on push to `main`.

## Contributing

Edits are welcome via pull request. For substantive content changes, please open an issue first to discuss.

The main LiteLLM repository is at <https://github.com/BerriAI/litellm>.

## Update Lens integrations

Run `npm run sync:lens` to clone the latest `main` branch of BerriAI/litellm-lens-example and import the READMEs listed in its docs.json manifest. The script adds Docusaurus metadata, rewrites repository links, copies image assets, and updates the integration sidebar. It replaces only `docs/proxy/lens/imported/`; the locally maintained Lens pages stay in `docs/proxy/lens/`.

Review and commit the generated changes with the docs update. Each page records its source commit and links editing back to its README. Builds use the committed pages and do not fetch the examples repository. No GitHub token, dispatch event, or scheduled workflow is required.

For a local committed checkout, run `npm run sync:lens -- --source-dir /path/to/litellm-lens-example`. This imports that checkout’s HEAD, excluding uncommitted changes.
