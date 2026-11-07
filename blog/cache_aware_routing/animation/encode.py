from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image

root = Path(__file__).parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root
stem = sys.argv[2] if len(sys.argv) > 2 else 'cache-aware-routing'
out.mkdir(parents=True, exist_ok=True)
paths = sorted((root / 'frames').glob('[0-9][0-9][0-9][0-9].png'))
assert len(paths) == 200, len(paths)
samples = []
for p in paths[::10]:
    im = Image.open(p).convert('RGBA')
    im.thumbnail((720, 410), Image.Resampling.NEAREST)
    samples.append(im.convert('RGB'))
atlas = Image.new('RGB', (720 * 5, 410 * 4), 'white')
for i, sample in enumerate(samples):
    atlas.paste(sample, ((i % 5) * 720, (i // 5) * 410))
palette = atlas.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
palette.putpalette(palette.getpalette()[:765] + [255, 0, 255])
frames = []
for path in paths:
    rgba = Image.open(path).convert('RGBA')
    frame = rgba.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
    alpha = np.asarray(rgba.getchannel('A'))
    pixels = np.asarray(frame).copy()
    pixels[alpha < 128] = 255
    frame = Image.fromarray(pixels, mode='P')
    frame.putpalette(palette.getpalette())
    frame.info['transparency'] = 255
    frames.append(frame)
target = out / f'{stem}.gif'
frames[0].save(target, save_all=True, append_images=frames[1:], duration=40,
               loop=0, transparency=255, disposal=2, optimize=False)
Image.open(paths[40]).save(out / f'{stem}.png')
gif = Image.open(target)
duration = 0
mask_differences = 0
source_index = 0
for i in range(gif.n_frames):
    gif.seek(i)
    hold = gif.info['duration']
    duration += hold
    actual = np.asarray(gif.convert('RGBA').getchannel('A')) > 0
    for source in range(source_index, source_index + hold // 40):
        expected = np.asarray(Image.open(paths[source]).getchannel('A')) >= 128
        mask_differences += np.count_nonzero(actual != expected)
    source_index += hold // 40
assert source_index == 200
assert duration == 8000
assert mask_differences == 0, mask_differences
info = dict(path=str(target), dimensions=gif.size, frames=gif.n_frames,
            duration_ms=duration, loop=gif.info.get('loop'),
            alpha_mask_mismatches=int(mask_differences), bytes=target.stat().st_size)
(root / 'export-check.json').write_text(json.dumps(info, indent=2))
print(json.dumps(info))
