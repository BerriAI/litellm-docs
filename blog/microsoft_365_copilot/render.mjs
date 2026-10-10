import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {CONFIG, svgScene, mobileScene} from './scene.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || 'sharp');
await mkdir(path.join(root, 'review'), {recursive: true});
const fontconfig = path.join(root, 'review/fonts.conf');
await writeFile(fontconfig, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${path.join(root,'assets')}</dir><cachedir>${path.join(root,'review/.font-cache')}</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = fontconfig;
const imageData = async file => `data:image/png;base64,${(await readFile(path.join(root,'assets',file))).toString('base64')}`;
const providerHrefs = {microsoft: await imageData('microsoft-copilot.png')};
for (const dark of [false,true]) {
  const logo = await imageData(dark ? 'litellm-logo-white.png' : 'litellm-logo-blue.png');
  for (const mobile of [false,true]) {
    const name = `cover${mobile ? '-mobile' : ''}${dark ? '-dark' : ''}`;
    const svg = (mobile ? mobileScene : svgScene)(logo,providerHrefs,dark);
    await writeFile(path.join(root,`${name}.svg`),svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(root,`${name}.png`));
    await sharp(Buffer.from(svg)).flatten({background:dark ? '#101418' : '#ffffff'}).png().toFile(path.join(root,'review',`${name}.png`));
  }
}
console.log(`Rendered transparent static covers: ${CONFIG.width}×${CONFIG.height} and ${CONFIG.mobileWidth}×${CONFIG.mobileHeight}, light and dark.`);
