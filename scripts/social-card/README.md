# Docs preview template

Generate a 1200 x 630 PNG with the LiteLLM logo, a section label, and a page title. The template uses the existing `sharp` dependency and bundled Liberation Sans fonts, so it does not need a browser, network access, or system fonts

Run from the docs repository root:

```sh
npm run generate:social-card -- \
  --title "Getting Started" \
  --section "Documentation" \
  --output static/img/og/getting-started.png
```

Add the image to the page's existing Markdown frontmatter:

```yaml
image: /img/og/getting-started.png
```

Docusaurus uses this image for the page's Open Graph and Twitter preview metadata. The Getting Started page is connected as an example. This command generates one image at a time; it does not regenerate every page during a docs build

Change the layout and colors in `index.cjs`. Titles wrap to two lines and shrink when necessary. Inputs that still cannot fit are rejected before the output file is written. The default section is `Documentation`; pass `--section ""` to leave it blank

The renderer can also be called from a future build plugin:

```js
const {renderSocialCard} = require('./scripts/social-card/index.cjs');
const png = await renderSocialCard({title: 'Routing', section: 'LLM Gateway'});
```

The logo is the supplied LiteLLM artwork, preserved in its original proportions and colors. The font license is included in `assets/LICENSE_LIBERATION`
