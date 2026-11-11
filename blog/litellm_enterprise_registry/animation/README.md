# Enterprise Registry animation

A transparent, text-free animation authored at 1600 by 800 and exported at 1200 by 600, at 25 fps. The LiteLLM monogram stands alone in the upper left. A broad pulse of light moves slowly toward 710 gateway pods in a flowing field that is sparse at the top and wider and denser toward the bottom, spilling leftward across the canvas midpoint. There is no persistent beam path, cone, or enclosure. The fleet varies in blue, cyan, and lavender shades, size, and internal details. Each pod glows and cycles in sequence, then settles into its updated state to represent a rolling deployment.

The ten-second loop illustrates one image pull and deployment. Its timing and pod count do not represent measured transfer speed, throughput, or customer scale. The article explains OAuth and AWS ECR pull-through access; the cover focuses on the pull and deployment.

Install Node.js, Python 3.10 or later, and the renderer and encoder dependencies, then run from this directory:

```sh
npm install
python3 -m pip install -r requirements.txt
node render.mjs --keyframes
node render.mjs
node encode.mjs --width 1200
```

Set `PYTHON` to use a Python virtual environment. Pillow needs libwebp support. `scene.mjs` contains the dimensions, timing, seeded pod layout, colors, and service placement. Frames render at explicit timestamps. `render.mjs` also exports `../cover.png` as the reduced-motion poster.

The blog displays `cover.webp` for continuous transparency and smooth beam and fleet glows. A transparent `cover.gif` remains the fallback and frontmatter cover. GIF only supports binary transparency, so the encoder uses a fixed 8 by 8 alpha screen, one shared palette, and full-frame disposal mode 2. WebP uses quality 85 with lossless alpha. Pass `--webp-lossless` for an exact RGB archival export. The encoder verifies transparency and timing against every source frame before replacing either cover. It checks exact GIF palette colors and reports WebP color error. Temporary PNG frames and export reports stay out of Git.

Both formats have a 40 ms frame interval and loop indefinitely. The blog has an icon-only pause control and a still poster for reduced-motion preferences. The cover and its wrapper have no background fill. The LiteLLM mark preserves its original artwork and proportions; see `assets/SOURCES.md` for provenance.
