# LiteLLM Lens hero assets

`lens_hero.gif` and `lens_hero.mp4` are the social-preview versions of the animated hero in `blog/litellm_lens_launch/LensHero.js`. The blog post renders the live canvas; these files exist only because link previews on X, LinkedIn and Slack cannot run JavaScript, so `og:image` points at the GIF and `og:video` at the mp4

Both are recorded from the canvas, so regenerate them whenever `LensHero.js` changes. Record one 12 second cycle of the hero at 1600x860 with no text labels to `hero.webm` (any headless browser screen recorder works), then:

```shell
ffmpeg -ss 0.8 -i hero.webm -t 12 -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart hero.mp4

ffmpeg -i hero.mp4 -vf "scale=1600:-2" -c:v libx264 -pix_fmt yuv420p -crf 26 -an -movflags +faststart lens_hero.mp4

ffmpeg -i hero.mp4 -t 8 -vf "fps=8,scale=800:420:force_original_aspect_ratio=increase,crop=800:420,split[a][b];[a]palettegen=max_colors=24:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" lens_hero.gif
```

Keep `lens_hero.gif` under 5MB: that is the animated-GIF limit on X and LinkedIn, and a larger file falls back to a static frame or no preview at all. The current file is about 3MB at 800x420
