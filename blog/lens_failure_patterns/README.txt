Lens failure patterns blog

The post uses the MP4 hero for playback and the GIF as its cover metadata.
Readers who request reduced motion see the static poster. Video controls allow
readers to pause the animation. All examples in the artwork are illustrative.

The six architecture diagrams are SVGs with embedded fonts. Source files under
source/ produce the artwork; they are not part of the page's JavaScript bundle.
Geist font licensing is included in source/fonts/OFL.txt.

To edit the graphics, use source/hero.js and source/diagrams.py. Shared visual
tokens are in source/brand-tokens.json and source/brand-tokens.js. Preview the
animation by opening source/hero.html in a browser.

To render exports, install Playwright for Node and Pillow, fonttools, brotli,
and imageio-ffmpeg for Python. Set CHROME_PATH if Chrome is not installed at
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome, then run:

python3 source/diagrams.py
node source/render-diagrams.cjs
node source/render.cjs --full
python3 source/export.py

The renderer writes temporary frames and checks under qa/. Do not commit them.
SVGs, the hero GIF/MP4, the poster, and the manifest are the published assets.
