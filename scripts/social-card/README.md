# Docs preview images

`npm run build` generates a separate 1200 x 630 PNG for every docs page, release note, generated category page, and blog post without a custom preview image. Each card contains the LiteLLM logo, the page's sidebar section, and its title. Blog posts use the section label `Blog`

The `social-cards` plugin reads Docusaurus's resolved titles and permalinks, including versioned and localized docs. Theme wrappers connect the generated images to each page's server-rendered `og:image` and `twitter:image` metadata. Existing `image` frontmatter and category images take precedence

Generated images live in `.docusaurus/social-cards/img/og`, which is registered as a static directory for both production builds and the development server. They are copied to `build/img/og` during the build and are not committed. Filenames include a hash of the page metadata, template, logo, and fonts. Changing any of these creates a new image URL, while unchanged images are reused

Change the layout and colors in `index.cjs`, then restart the development server or build again. The logo appears by itself, without a `Docs` label. Titles wrap and shrink to fit the available space. Inputs that still cannot fit fail the build with the affected page's URL

To export a single card manually, run:

```sh
npm run generate:social-card -- \
  --title "Getting Started" \
  --section "Documentation" \
  --output static/img/og/getting-started.png
```

The committed Getting Started image is a sample; the page's actual preview is generated automatically. Run `npm run test:social-cards` to check generation, caching, overrides, and text handling

The template uses the existing `sharp` dependency and bundled Liberation Sans fonts for Latin text. Other scripts and emoji use the build environment's fallback fonts. Generation does not need a browser or network access. The logo is the supplied artwork in its original proportions and colors. The font license is included in `assets/LICENSE_LIBERATION`
