"""Encode opaque hero frames with one palette and verify decoded GIF frames."""
from pathlib import Path
import sys
from PIL import Image, ImageChops

directory, output = map(Path, sys.argv[1:])
paths = sorted(directory.glob('[0-9][0-9][0-9][0-9].png'))
assert len(paths) == 240
atlas = Image.new('RGB', (960, 504 * 12))
for index, path in enumerate(paths[::20]):
    with Image.open(path) as image:
        atlas.paste(image.convert('RGB'), (0, index * 504))
palette = atlas.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
frames = []
for path in paths:
    with Image.open(path) as image:
        frames.append(image.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE))
frames[0].save(output, save_all=True, append_images=frames[1:], duration=50,
               loop=0, disposal=1, optimize=False)
with Image.open(output) as gif:
    assert gif.size == (960, 504)
    assert gif.n_frames == len(frames)
    assert gif.info['loop'] == 0
    total_duration = 0
    for index in range(gif.n_frames):
        gif.seek(index)
        total_duration += gif.info['duration']
        assert ImageChops.difference(gif.convert('RGB'), frames[index].convert('RGB')).getbbox() is None
    assert total_duration == 12000
print(f'GIF verified: {len(frames)} frames, seamless 12-second loop, {output.stat().st_size} bytes')
