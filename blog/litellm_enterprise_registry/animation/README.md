# Enterprise Registry animation

A transparent animation with no logos or visible text. The 386 neutral, frosted glass circles form an organic field that is sparse at the top and wider and denser toward the bottom. A soft, cool white Gaussian pulse enters from the upper left, reflects and refracts through the beads, and leaves a phosphorescent glow that fades after the pulse passes. The canvas is 1600 by 800 at 25 fps, with a 16-second loop. The visual suggests a rolling deployment; its bead count and timing do not represent customer scale, transfer speed, or throughput.

`optics.mjs` precomputes deterministic two-dimensional light paths through the same non-overlapping circular geometry used to draw the beads. It calculates circle intersections, Snell refraction, unpolarized Fresnel reflection, optical path length, and Beer-Lambert absorption. Sampled Gaussian microfacet normals approximate a frosted surface. Early interactions split reflected and transmitted energy; later interactions use seeded sampling. The transport records absorbed energy separately from escaped or truncated energy.

`scene.mjs` applies a finite Gaussian pulse to those paths and uses deposited energy to drive the beads' absorption and decay response. `raster.mjs` accumulates the precomputed ray energy in floating-point buffers, softens the scattered field, and tone maps once to avoid bands from repeatedly blending 8-bit colors. The renderer composites that light with textured SVG glass surfaces. This is a two-dimensional geometric approximation, with no diffraction, polarization, volumetric scattering, or microfacet masking and shadowing. The refractive index, roughness, absorption, and phosphor lifetime are chosen for the illustration and are not measured material properties. Optical travel is deliberately slowed; exposure, glow footprint, and the end-of-loop emission fade are adjusted for display. This is not a calibrated simulation of a physical phosphorescent material.

The reflection and transmission references are PBRT's [Specular Reflection and Transmission](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission) and [Rough Dielectric BSDF](https://pbr-book.org/4ed/Reflection_Models/Rough_Dielectric_BSDF). The local rough-surface approximation does not implement PBRT's full BSDF.

Install Node.js, Python 3.10 or later, FFmpeg with libvpx, and the renderer dependencies. The HEVC export also requires macOS with Swift and AVFoundation. Run from this directory:

```sh
npm install
python3 -m pip install -r requirements.txt
node --test optics.test.mjs raster.test.mjs
node render.mjs --keyframes
node render.mjs
node encode-video.mjs
node encode.mjs --gif-width 960
```

Set `PYTHON` to use a Python virtual environment. Pillow needs libwebp support. The renderer uses `@napi-rs/canvas` 0.1.100 to composite the precomputed light and glass at explicit timestamps. It renders 400 RGBA frames and exports `../cover.png` at `POSTER_TIME`. Dimensions, frame rate, loop duration, and poster time are defined in `scene.mjs`; regenerate the frames, videos, and GIF after changing them. Generated frames and verification reports stay out of Git.

`encode-video.mjs` produces transparent, 1600 by 800 videos at 25 fps: VP9 WebM for Chromium and Firefox, and HEVC with alpha in a QuickTime container for Safari. The Swift encoder uses AVFoundation. Both encode the same finished RGBA frames, with no background matte. `--webm-only` can regenerate WebM on other platforms. Video compression is lossy; inspect decoded frames over both light and dark backgrounds after exporting.

`encode.mjs` produces a 960 by 480 GIF fallback with a 40 ms frame interval and indefinite looping. GIF has binary transparency, so it uses a fixed 8 by 8 alpha screen, a shared palette, and full-frame disposal mode 2. The encoder checks all decoded frames for dimensions, timing, transparency, and palette colors. `--width` resizes all requested image formats; `--gif-width` overrides GIF only. The optional `--formats webp` export retains source resolution and continuous alpha, but is not shipped because it is substantially larger than the videos. Each image format's dimensions and resampling method appear in its verification report.

`RegistryHero.js` plays native video with a GIF fallback. It imports only the finished media, React, and CSS; light transport, SVG updates, and frame rendering do not run in the page. A one-pixel alpha check on load detects browsers that decode color without transparency, then falls back from WebM to HEVC and finally GIF. The video reserves its 1600 by 800 dimensions and is only mounted while visible. An icon-only pause button selects the PNG poster. Reduced-motion preferences, a hidden tab, or an offscreen image also select the poster without changing the user's pause choice. Playback restarts when it resumes. Accessible text describes the pulse and fading glow, and the transparent media and wrapper work on both light and dark themes.
