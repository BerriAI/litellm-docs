# Animated blog cover

`request-flow-cover.gif` is the blog-list version of `RequestFlowHero.js`. The article keeps the React hero and its pause control. The GIF uses a 1200:630 canvas to fit the list cards, exported at 960 × 504 pixels.

The renderer reads the existing component, samples its SVG paths, and rasterizes the particle positions at 20 fps. Fast particles complete three cycles per 12-second loop; Python particles complete one. These timings illustrate the speed difference. They are not benchmark data. The encoder uses a shared palette and verifies every decoded frame against its source.

From the repository root, install the normal Node dependencies and Pillow in your Python environment, then run:

```sh
node blog/rust_migration_rerouted/animation/render-cover.cjs
```

Set `PYTHON` if Pillow is installed in a different Python environment. Frames are temporary and are removed after a successful export. The script writes `blog/rust_migration_rerouted/request-flow-cover.gif`.
