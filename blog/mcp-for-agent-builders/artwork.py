"""Render the MCP Gateway for Agent Builders cover using official Geist fonts and LiteLLM logo.

Requires fonttools and brotli. Pass the brand kit's assets/fonts directory and
its primary-white.png logo with --fonts and --logo. Rasterize the resulting
SVGs at 2x with the repository's sharp dependency.
"""
import argparse
import base64
from html import escape
from pathlib import Path
from xml.etree import ElementTree as ET
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

parser = argparse.ArgumentParser()
parser.add_argument('--fonts', type=Path, required=True)
parser.add_argument('--logo', type=Path, required=True)
args = parser.parse_args()
out = Path(__file__).parent
fonts = {}
for face, filename in [('sans', 'geist-variable.woff2'), ('mono', 'geist-mono-variable.woff2')]:
    font = TTFont(args.fonts / filename)
    fonts[face] = instantiateVariableFont(font, {'wght': 500 if face == 'sans' else 400})
logo = base64.b64encode(args.logo.read_bytes()).decode()
BLUE, PAPER, INK, MUTED, RULE = '#243de4', '#f3f6fc', '#14203a', '#48556d', '#ccd6ea'

def text(label, x, y, size, color=INK, face='sans', tracking=0):
    font = fonts[face]
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    units = font['head'].unitsPerEm
    scale = size / units
    paths = []
    advance = 0
    for char in label:
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        paths.append(f'<path d="{pen.getCommands()}" transform="translate({advance:.2f},0)"/>')
        advance += glyphs[name].width + tracking / scale
    return f'<g aria-label="{escape(label)}" fill="{color}" transform="translate({x},{y}) scale({scale},-{scale})">{"".join(paths)}</g>'

def line(x1, y1, x2, y2, color=RULE):
    return f'<path d="M{x1} {y1}H{x2}" stroke="{color}"/>' if y1 == y2 else f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{color}"/>'

def graphic(name, x, y, width, height):
    root = ET.fromstring((out.parents[1] / 'static' / 'img' / name).read_text())
    root.set('x', str(x))
    root.set('y', str(y))
    root.set('width', str(width))
    root.set('height', str(height))
    root.set('preserveAspectRatio', 'xMidYMid meet')
    return ET.tostring(root, encoding='unicode')


def render():
    w, h, margin = 1200, 630, 64
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">',
        '<title id="title">MCP Gateway for Agent Builders</title>',
        '<desc id="desc">LiteLLM connects to GitHub, Slack, and a custom MCP service.</desc>',
        f'<rect width="{w}" height="{h}" fill="{BLUE}"/>',
        f'<image x="{margin}" y="48" width="184" height="46" preserveAspectRatio="xMinYMid meet" href="data:image/png;base64,{logo}"/>',
        text('CONNECTOR AUTH', 913, 78, 18, '#d8deff', 'mono', 1),
        line(margin, 130, w-margin, 130, '#6274ec'),
        text('MCP Gateway', margin, 272, 98, '#ffffff', tracking=-3),
        text('for Agent', margin, 383, 98, '#ffffff', tracking=-3),
        text('Builders', margin, 494, 98, '#ffffff', tracking=-3),
        '<g fill="none" stroke="#93a2ff" stroke-width="2">',
        '<path d="M888 344h42q28 0 28-28v-94q0-28 28-28h40"/>',
        '<path d="M888 344h138"/>',
        '<path d="M888 344h42q28 0 28 28v94q0 28 28 28h40"/>',
        '</g>',
        '<circle cx="958" cy="344" r="5" fill="#ffffff"/>',
        '<rect x="768" y="284" width="120" height="120" rx="20" fill="#ffffff"/>',
        graphic('brand/litellm-monogram-blue.svg', 793, 309, 70, 70),
        text('LiteLLM', 787, 439, 22, '#ffffff', tracking=-.3)]
    for y, name, icon in [(150, 'GitHub', 'providers/github.svg'), (300, 'Slack', 'integrations/slack.svg'), (450, 'Your MCP', None)]:
        parts.append(f'<rect x="1026" y="{y}" width="104" height="88" rx="14" fill="#ffffff"/>')
        if icon:
            parts.append(graphic(icon, 1050, y+16, 56, 56))
        else:
            parts.append(text('</>', 1045, y+56, 32, BLUE, 'mono', -1))
        parts.append(text(name, 1035 if icon else 1022, y+118, 21, '#ffffff', tracking=-.2))
    parts.append('</svg>')
    (out / 'hero.svg').write_text('\n'.join(parts))

render()
