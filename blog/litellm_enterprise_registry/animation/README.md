# Enterprise Registry animation

A 1600 by 800, 10-second GIF at 25 fps. Two flowing ribbons of packages, a splitting access shutter, and retained cache copies tell the story with only two labels: OAuth and IAM. The composition takes its motion cues from the Rust router and prompt-latency covers, with the cobalt and cyan palette of cache-aware routing. Official logos stand directly on a light canvas.

Cognito's key gesture represents the OAuth access exchange: Cognito supplies an OAuth token, which the registry credentials API exchanges for temporary ECR credentials. The shutter opens and queued packages join a continuous stream from LiteLLM's ECR. The lower ribbon independently fills the customer's ECR cache; three package copies remain visible while the cache serves repeated downstream pulls. ECR pull-through does not pass through Cognito. The LiteLLM and ECR source logos are paired because the Enterprise Registry itself runs on ECR.

This is an illustrative access flow, not a literal network trace or performance measurement. The direct-access exchange is simplified; the customer access guide documents the OAuth and registry-credential exchanges.

Install Node.js, FFmpeg, and the pinned renderer dependency, then run from this directory:

```sh
npm install
node render.mjs --keyframes
node render.mjs
node encode.mjs
```

`scene.mjs` contains the dimensions, timing, routes, colors and service placement. It renders deterministically at explicit timestamps, without browser screenshots. `render.mjs` also exports `../cover.png` as the poster. The GIF uses a shared palette and a 40 ms frame interval. Intermediate frames and the palette are ignored by Git.

The official AWS icons and LiteLLM monogram are upright, with their original artwork and proportions. See `assets/SOURCES.md` for provenance. The opaque light background keeps the logos and labels readable in either site theme. The blog hero includes a pause control and a still poster for reduced-motion preferences.
