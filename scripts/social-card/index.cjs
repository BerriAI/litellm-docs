const fs = require('node:fs/promises');
const path = require('node:path');
const {parseArgs} = require('node:util');
const sharp = require('sharp');

const assets = path.join(__dirname, 'assets');
const width = 1200;
const height = 630;
const background = '#F5F5F2';
const ink = '#14161C';
const muted = '#5D616B';

function escapeMarkup(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

async function textLayer(text, size, color, {bold = false, wrap} = {}) {
  return sharp({text: {
    text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
    font: `Liberation Sans${bold ? ' Bold' : ''} ${size}`,
    fontfile: path.join(assets, `LiberationSans-${bold ? 'Bold' : 'Regular'}.ttf`),
    width: 1040,
    ...(wrap ? {wrap} : {}),
    dpi: 72,
    rgba: true,
  }}).png().toBuffer({resolveWithObject: true});
}

async function fitTitle(title, size = 84) {
  const layer = await textLayer(title, size, ink, {bold: true});
  if (layer.info.width <= 1040 && layer.info.height <= 188) return {layer, size};
  if (size <= 36) throw new Error('The title is too long to fit in the preview.');
  return fitTitle(title, size - 2);
}

async function renderSocialCard({title, section = 'Documentation'}) {
  if (typeof title !== 'string' || !title.trim()) throw new Error('A page title is required.');
  if (typeof section !== 'string') throw new Error('The section must be text.');
  const cleanTitle = title.trim().replace(/\s+/g, ' ');
  const cleanSection = section.trim().replace(/\s+/g, ' ');
  if (cleanTitle.length > 180) throw new Error('Use a title with 180 characters or fewer.');
  if (cleanSection.length > 80) throw new Error('Use a section with 80 characters or fewer.');

  const [{layer: titleLayer, size}, logo] = await Promise.all([
    fitTitle(cleanTitle),
    sharp(path.join(assets, 'litellm-logo-blue.svg')).resize({width: 304}).png().toBuffer(),
  ]);
  const sectionLayer = cleanSection ? await textLayer(cleanSection, 34, muted, {bold: true, wrap: 'none'}) : null;
  if (sectionLayer && sectionLayer.info.width > 1040) throw new Error('The section is too wide to fit.');
  const multipleLines = titleLayer.info.height > size * 1.2;
  return sharp({create: {width, height, channels: 3, background}}).composite([
    {input: logo, left: 80, top: 80},
    ...(sectionLayer ? [{input: sectionLayer.data, left: 80, top: multipleLines ? 278 : 332}] : []),
    {input: titleLayer.data, left: 80, top: multipleLines ? 341 : 395},
  ]).png().toBuffer();
}

async function main() {
  const {values} = parseArgs({options: {
    title: {type: 'string'},
    section: {type: 'string', default: 'Documentation'},
    output: {type: 'string'},
    help: {type: 'boolean', short: 'h'},
  }});
  if (values.help) {
    console.log('npm run generate:social-card -- --title "Getting Started" --section "Documentation" --output static/img/og/getting-started.png');
    return;
  }
  if (!values.output || path.extname(values.output).toLowerCase() !== '.png') {
    throw new Error('Provide --output with a .png file path.');
  }
  const image = await renderSocialCard(values);
  const output = path.resolve(values.output);
  await fs.mkdir(path.dirname(output), {recursive: true});
  await fs.writeFile(output, image);
  console.log(`Created ${output} (${width} x ${height})`);
}

module.exports = {renderSocialCard};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
