# Cache-aware routing animation

Transparent 1440 × 820 GIF, 8-second seamless loop, authored at 25 fps. Uses flat isometric geometry and no visible text. Claude Code and Codex requests travel through the LiteLLM gateway to stable Kubernetes inference pods running vLLM. The blue and cyan streams retain separate pod assignments; cache cells flash when a request returns.

The artwork has no background, gradients, or soft shadows. The Codex icon uses a solid blue fill while retaining its original geometry. Other icon sources and licensing are recorded in `assets/SOURCES.md`.

The Kubernetes cluster badge and inference pods use hexagonal prisms. The inference pods display only their vLLM logos, with cache indicators on the side. The LiteLLM gateway remains a rectangular block displaying only its train icon.

To render, install Node.js and Python, then run:

```sh
npm install
python3 -m pip install -r requirements.txt
node render.mjs
python3 encode.py .. cover
```

Edit the colors, routing coordinates, and event timing in `scene.mjs`. `node render.mjs --keyframes` exports selected preview frames. `encode.py` uses one global palette, binary transparency, and disposal mode 2; it checks every decoded frame's transparent mask against the source. Identical frames can be combined without changing the total duration.

The animation is illustrative, not a latency measurement. The three cells on each pod represent cached prefix data. The packets and pulse timing are design choices.
