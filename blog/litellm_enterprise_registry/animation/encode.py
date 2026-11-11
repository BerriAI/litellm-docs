"""Export RGBA frames without a matte, then verify the decoded animations.

Dependencies: Python 3.10+, Pillow 12.3.0 (with libwebp), numpy>=1.24.
Invoke encode.mjs so FPS and frame count come from scene.mjs. --count and
--output-dir allow scratch exports without replacing the blog assets.

GIF uses one 255-color palette, a fixed 8x8 Bayer alpha screen, and full-frame
disposal-2 records. WebP defaults to quality-85 RGB and lossless continuous
alpha; --webp-lossless preserves RGB too. --review-dir writes light/dark
source-versus-WebP composites for visual inspection.
--width resizes RGBA sources with Lanczos before palette creation, encoding,
and verification, without changing the original PNGs or animation timing.
"""

import argparse
import json
from pathlib import Path
from functools import partial

import numpy as np
from PIL import GifImagePlugin, Image, ImageDraw, features


def bayer(size=8):
    matrix = np.array([[0]], dtype=np.uint16)
    while matrix.shape[0] < size:
        matrix = np.block([[4 * matrix, 4 * matrix + 2],
                           [4 * matrix + 3, 4 * matrix + 1]])
    return matrix


def alpha_screen(size):
    width, height = size
    ranks = np.tile(bayer(), ((height + 7) // 8, (width + 7) // 8))
    return (2 * ranks[:height, :width] + 1) * 255


def visible_mask(rgba, screen):
    # Integer equivalent of alpha / 255 > (rank + .5) / 64.
    return np.asarray(rgba.getchannel('A'), dtype=np.uint16) * 128 > screen


def read_rgba(filename, source_size=None, target_size=None):
    with Image.open(filename) as image:
        rgba = image.convert('RGBA')
    if source_size and rgba.size != source_size:
        raise ValueError(f'Unexpected source frame size: {filename}: {rgba.size} != {source_size}')
    if target_size and rgba.size != target_size:
        # Pillow resamples RGBA in premultiplied-alpha space, avoiding dark
        # fringes around translucent edges, then returns straight RGBA.
        resized = rgba.resize(target_size, Image.Resampling.LANCZOS)
        rgba.close()
        rgba = resized
    return rgba


def global_palette(paths, load):
    """Sample straight RGB only where pixels can contribute to the animation."""
    samples = []
    for index in np.linspace(0, len(paths) - 1, min(32, len(paths)), dtype=int):
        with load(paths[index]) as rgba:
            pixels = np.asarray(rgba)[::3, ::3]
            colors = pixels[:, :, :3][pixels[:, :, 3] >= 8]
            if len(colors):
                samples.append(colors)
    colors = np.concatenate(samples) if samples else np.zeros((1, 3), dtype=np.uint8)
    width = 512
    count = ((len(colors) + width - 1) // width) * width
    padded = np.empty((count, 3), dtype=np.uint8)
    padded[:len(colors)] = colors
    padded[len(colors):] = colors[-1]
    # No compositing or background enters palette construction.
    palette = Image.fromarray(padded.reshape(-1, width, 3)).quantize(
        colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    entries = palette.getpalette()[:765]
    entries += [0] * (765 - len(entries))
    # Duplicate color 0 at the reserved transparency slot. Restore any
    # quantizer choice of that duplicate before applying the alpha screen.
    palette.putpalette(entries + entries[:3])
    return palette


def indexed_frame(rgba, palette, screen):
    frame = rgba.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
    pixels = np.asarray(frame).copy()
    pixels[pixels == 255] = 0
    pixels[~visible_mask(rgba, screen)] = 255
    frame = Image.fromarray(pixels).convert('P')
    frame.putpalette(palette.getpalette())
    frame.info['transparency'] = 255
    return frame


def encode_gif(paths, output, size, duration, palette, screen, load):
    # Explicit records avoid inter-frame crop/merge optimizations and ensure
    # every disposal restores the entire transparent canvas.
    with output.open('wb') as target:
        for index, filename in enumerate(paths):
            with load(filename) as rgba:
                frame = indexed_frame(rgba, palette, screen)
            if index == 0:
                header, _ = GifImagePlugin.getheader(frame, info={
                    'loop': 0, 'background': 255, 'transparency': 255,
                    'optimize': False,
                })
                for chunk in header:
                    target.write(chunk)
            for chunk in GifImagePlugin.getdata(
                    frame, offset=(0, 0), duration=duration, disposal=2,
                    transparency=255, include_color_table=False):
                target.write(chunk)
            if index % 50 == 0:
                print(f'GIF: encoded {index + 1}/{len(paths)} frames', flush=True)
        target.write(b';')


def encode_webp(paths, output, size, duration, lossless, quality, load):
    if not features.check('webp'):
        raise RuntimeError('Pillow needs libwebp support for animated WebP export')
    # The same encoder used by Pillow's WebPImagePlugin._save_all. Feed frames
    # directly instead of retaining 250 decoded 1600x800 RGBA images in RAM.
    # This low-level signature is pinned to Pillow 12.3.0.
    from PIL import _webp
    encoder = _webp.WebPAnimEncoder(size, 0, 0, True, 9, 17, False, False)
    for index, filename in enumerate(paths):
        with load(filename) as rgba:
            encoder.add(rgba.getim(), index * duration, lossless, quality, 100, 4)
        if index % 50 == 0:
            print(f'WebP: encoded {index + 1}/{len(paths)} frames', flush=True)
    encoder.add(None, len(paths) * duration, lossless, quality, 100, 0)
    result = encoder.assemble('', '', '')
    if result is None:
        raise RuntimeError('WebP encoder returned no animation')
    output.write_bytes(result)


def verify_gif(paths, output, size, duration, palette, screen, load):
    elapsed = 0
    with Image.open(output) as animation:
        assert animation.n_frames == len(paths), 'GIF frame count changed'
        assert animation.info.get('loop') == 0, 'GIF must loop indefinitely'
        for index, filename in enumerate(paths):
            animation.seek(index)
            assert animation.disposal_method == 2, 'GIF disposal must be 2'
            assert animation.tile[0][1] == (0, 0, *size), 'GIF frame was cropped'
            elapsed += animation.info['duration']
            actual = np.asarray(animation.convert('RGBA'))
            with load(filename) as rgba:
                expected = np.asarray(indexed_frame(rgba, palette, screen).convert('RGBA'))
            visible = expected[:, :, 3] > 0
            assert np.array_equal(actual[:, :, 3], expected[:, :, 3]), f'GIF alpha mismatch at {index}'
            assert np.array_equal(actual[:, :, :3][visible], expected[:, :, :3][visible]), f'GIF color/trail mismatch at {index}'
    assert elapsed == len(paths) * duration, 'GIF duration changed'
    return {'frames': len(paths), 'duration_ms': elapsed, 'disposal': 2,
            'full_frames': True, 'alpha_dither': 'fixed 8x8 Bayer',
            'decoded_alpha_mismatches': 0, 'decoded_color_mismatches': 0}


def review_composites(source, decoded, directory, frame_index):
    directory.mkdir(parents=True, exist_ok=True)
    width, height = source.size
    paths = []
    for name, color in [('light', '#FFFFFF'), ('dark', '#0B0E14')]:
        sheet = Image.new('RGB', (width * 2, height + 30), color)
        draw = ImageDraw.Draw(sheet)
        ink = '#1F2937' if name == 'light' else '#F3F4F6'
        for column, (label, rgba) in enumerate([('Source RGBA', source), ('Decoded WebP', decoded)]):
            background = Image.new('RGBA', (width, height), color)
            background.alpha_composite(rgba)
            sheet.paste(background.convert('RGB'), (column * width, 30))
            draw.text((column * width + 12, 10), f'{label} · frame {frame_index}', fill=ink)
        filename = directory / f'webp-{name}-review.png'
        sheet.save(filename)
        paths.append(str(filename))
    return paths


def verify_webp(paths, output, size, duration, lossless, quality, load, review_dir=None):
    source_index = 0
    elapsed = 0
    partial_alpha = 0
    error_histogram = np.zeros(256, dtype=np.int64)
    weighted_error = 0
    alpha_weight = 0
    reviews = []
    with Image.open(output) as animation:
        assert animation.info.get('loop') == 0, 'WebP must loop indefinitely'
        encoded_frames = animation.n_frames
        for index in range(encoded_frames):
            animation.seek(index)
            animation.load()
            actual = np.asarray(animation.convert('RGBA'))
            hold = animation.info['duration']
            assert hold > 0 and hold % duration == 0, 'WebP frame duration changed'
            for _ in range(hold // duration):
                assert source_index < len(paths), 'WebP has unexpected extra frames'
                with load(paths[source_index]) as rgba:
                    expected = np.asarray(rgba)
                    visible = expected[:, :, 3] > 0
                    partial_alpha += int(np.count_nonzero((expected[:, :, 3] > 0) & (expected[:, :, 3] < 255)))
                    assert np.array_equal(actual[:, :, 3], expected[:, :, 3]), f'WebP alpha mismatch at {source_index}'
                    error = np.abs(actual[:, :, :3][visible].astype(np.int16) - expected[:, :, :3][visible].astype(np.int16))
                    error_histogram += np.bincount(error.ravel(), minlength=256)
                    weights = expected[:, :, 3][visible].astype(np.int64)
                    weighted_error += int(np.sum(error.astype(np.int64) * weights[:, None]))
                    alpha_weight += int(weights.sum()) * 3
                    if lossless:
                        assert not np.any(error), f'WebP visible RGB mismatch at {source_index}'
                    if review_dir is not None and source_index == len(paths) // 2:
                        reviews = review_composites(rgba, Image.fromarray(actual), review_dir, source_index)
                source_index += 1
            elapsed += hold
    assert source_index == len(paths), 'WebP source frames are missing'
    assert elapsed == len(paths) * duration, 'WebP duration changed'
    bins = np.arange(256, dtype=np.int64)
    samples = int(error_histogram.sum())
    rgb_error = {
        'mean_absolute': round(float(np.dot(error_histogram, bins)) / max(1, samples), 5),
        'root_mean_square': round((float(np.dot(error_histogram, bins * bins)) / max(1, samples)) ** .5, 5),
        'p99_absolute': int(np.searchsorted(np.cumsum(error_histogram), samples * .99)) if samples else 0,
        'maximum_absolute': int(np.flatnonzero(error_histogram)[-1]) if samples else 0,
        'alpha_weighted_mean_absolute': round(weighted_error / max(1, alpha_weight), 5),
    }
    return {'frames': encoded_frames, 'source_frames': source_index,
            'duration_ms': elapsed, 'lossless': lossless, 'quality': quality,
            'alpha_quality': 100, 'minimize_size': True,
            'partial_alpha_samples_preserved': partial_alpha,
            'decoded_alpha_mismatches': 0, 'visible_rgb_error_0_to_255': rgb_error,
            'review_composites': reviews}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frames-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--stem', default='cover')
    parser.add_argument('--fps', type=int, required=True)
    parser.add_argument('--count', type=int, required=True)
    parser.add_argument('--formats', default='gif,webp')
    parser.add_argument('--webp-lossless', action='store_true')
    parser.add_argument('--webp-quality', type=int, default=85)
    parser.add_argument('--review-dir', type=Path)
    parser.add_argument('--width', type=int)
    args = parser.parse_args()
    if args.count < 1 or args.fps < 1 or 100 % args.fps:
        parser.error('count must be positive; fps must divide 100 for exact GIF timing')
    if not 0 <= args.webp_quality <= 100:
        parser.error('webp-quality must be between 0 and 100')
    if args.width is not None and args.width < 1:
        parser.error('width must be positive')
    if Path(args.stem).name != args.stem:
        parser.error('stem must be a filename without directories')
    formats = list(dict.fromkeys(args.formats.split(',')))
    if not formats or any(fmt not in ('gif', 'webp') for fmt in formats):
        parser.error('formats must contain gif and/or webp')
    paths = [args.frames_dir / f'{index:04d}.png' for index in range(args.count)]
    for filename in paths:
        if not filename.is_file():
            parser.error(f'Missing source frame: {filename}; render the complete scene first')
    with read_rgba(paths[0]) as first:
        source_size = first.size
    size = source_size
    if args.width is not None:
        size = (args.width, max(1, round(source_size[1] * args.width / source_size[0])))
    load = partial(read_rgba, source_size=source_size, target_size=size)
    duration = 1000 // args.fps
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = {'width': size[0], 'height': size[1], 'fps': args.fps,
              'source_width': source_size[0], 'source_height': source_size[1],
              'resampling': 'Lanczos' if size != source_size else 'none',
              'source_frames': args.count, 'exports': {}}
    for fmt in formats:
        final = args.output_dir / f'{args.stem}.{fmt}'
        pending = final.with_name(f'.{final.name}.pending')
        try:
            if fmt == 'gif':
                palette = global_palette(paths, load)
                screen = alpha_screen(size)
                encode_gif(paths, pending, size, duration, palette, screen, load)
                checked = verify_gif(paths, pending, size, duration, palette, screen, load)
            else:
                encode_webp(paths, pending, size, duration, args.webp_lossless, args.webp_quality, load)
                checked = verify_webp(paths, pending, size, duration,
                                      args.webp_lossless, args.webp_quality, load, args.review_dir)
            pending.replace(final)
        finally:
            pending.unlink(missing_ok=True)
        report['exports'][fmt] = {'path': str(final), 'bytes': final.stat().st_size, **checked}
    report_path = args.output_dir / f'{args.stem}-export-check.json'
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
