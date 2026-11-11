# Enterprise Registry animation

A 1600 by 900, 12-second GIF at 25 fps. Flat white cards, restrained shadows, blue connectors and simple package icons create a minimal Material design on a light background.

Cognito supplies a credential chip on a separate control connection. Packages travel directly from the LiteLLM registry to the customer's deployment. The second sequence fills the customer's ECR cache, delivers a package, then serves a later pull from that cache. A retained package badge marks the populated cache. ECR pull-through does not pass through Cognito.

This is an illustrative access flow, not a literal network trace or performance measurement. The direct-access exchange is simplified; the customer access guide documents the OAuth and registry-credential exchanges.

Install Node.js, FFmpeg, and the pinned renderer dependency, then run from this directory:

```sh
npm install
node render.mjs --keyframes
node render.mjs
node encode.mjs
```

`scene.mjs` contains the dimensions, timing, routes, colors and service placement. It renders deterministically at explicit timestamps, without browser screenshots. `render.mjs` also exports `../cover.png` as the poster. The GIF uses a shared palette and a 40 ms frame interval. Intermediate frames and the palette are ignored by Git.

The official AWS icons and LiteLLM monogram are upright, with their original artwork and proportions. See `assets/SOURCES.md` for provenance. The opaque light background keeps the cards and labels readable in either site theme. The blog hero includes a pause control and a still poster for reduced-motion preferences.
