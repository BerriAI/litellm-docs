# Enterprise Registry animation

A 1600 by 800, 8-second GIF at 25 fps. The Enterprise Registry forms a cohesive group in the upper left, and a mosaic of customer gateway pods anchors the lower right. One diagonal beam pulse represents one image pull. Only the receiving pod acknowledges arrival; the other workloads stay still. Official logos stand directly on a light canvas.

Cognito represents OAuth access: its token is exchanged through the registry credentials API for temporary ECR credentials. The LiteLLM and ECR source logos are paired because the Enterprise Registry itself runs on ECR. The customer mosaic uses generic gateway symbols, with the LiteLLM logo beside the deployment caption. The cover focuses on image access; the article explains both OAuth and ECR pull-through access options.

The beam represents an individual image pull. It does not depict throughput, request volume, or measured transfer speed. The direct-access exchange is simplified; the customer access guide documents the OAuth and registry-credential exchanges.

Install Node.js, FFmpeg, and the pinned renderer dependency, then run from this directory:

```sh
npm install
node render.mjs --keyframes
node render.mjs
node encode.mjs
```

`scene.mjs` contains the dimensions, timing, routes, colors and service placement. It renders deterministically at explicit timestamps, without browser screenshots. `render.mjs` also exports `../cover.png` as the poster. The GIF uses a shared palette and a 40 ms frame interval. Intermediate frames and the palette are ignored by Git.

The official AWS icons and LiteLLM monogram are upright, with their original artwork and proportions. See `assets/SOURCES.md` for provenance. The opaque light background keeps the logos and labels readable in either site theme. The blog hero includes a pause control and a still poster for reduced-motion preferences.
