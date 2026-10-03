const {createHash, randomUUID} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const QUALITY = 75;
const PNG_COMPRESSION_LEVEL = 9;
const SHARP_PACKAGE_VERSION = require('sharp/package.json').version;
const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

async function cacheKey(filePath, ext) {
  const isPng = ext === '.png';
  const settings = JSON.stringify({
    ext,
    format: isPng ? 'png' : 'jpeg',
    quality: QUALITY,
    compressionLevel: isPng ? PNG_COMPRESSION_LEVEL : null,
    mozjpeg: isPng ? null : true,
    sharpPackageVersion: SHARP_PACKAGE_VERSION,
    sharpVersions: sharp.versions,
  });
  const hash = createHash('sha256').update(settings);
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function removeIfExists(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function writeCacheEntry(cachePath, optimizedPath) {
  const tmp = `${cachePath}.${randomUUID()}.tmp`;
  try {
    if (optimizedPath) await fs.promises.copyFile(optimizedPath, tmp);
    else await fs.promises.writeFile(tmp, '');
    await fs.promises.rename(tmp, cachePath);
  } finally {
    await removeIfExists(tmp);
  }
}

async function copyOver(source, destination) {
  const tmp = `${destination}.${randomUUID()}.tmp`;
  try {
    await fs.promises.copyFile(source, tmp);
    await fs.promises.rename(tmp, destination);
  } finally {
    await removeIfExists(tmp);
  }
}

async function optimizeFile(filePath, cacheDir, usedEntries) {
  const ext = path.extname(filePath).toLowerCase();
  const key = await cacheKey(filePath, ext);
  const cachePath = path.join(cacheDir, key);
  const originalSize = (await fs.promises.stat(filePath)).size;
  try {
    const cached = await fs.promises.stat(cachePath);
    usedEntries.add(key);
    if (cached.size === 0) return {saved: 0, cached: true};
    await copyOver(cachePath, filePath);
    return {saved: Math.max(0, originalSize - cached.size), cached: true};
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const tmp = `${filePath}.opt`;
  let optimizedSize;
  try {
    const pipeline = sharp(filePath);
    if (ext === '.png') {
      await pipeline.png({quality: QUALITY, compressionLevel: PNG_COMPRESSION_LEVEL}).toFile(tmp);
    } else {
      await pipeline.jpeg({quality: QUALITY, mozjpeg: true}).toFile(tmp);
    }
    optimizedSize = (await fs.promises.stat(tmp)).size;
  } catch {
    await removeIfExists(tmp);
    return {saved: 0, cached: false};
  }

  const saved = optimizedSize < originalSize ? originalSize - optimizedSize : 0;
  await writeCacheEntry(cachePath, saved > 0 ? tmp : null);
  if (saved > 0) await fs.promises.rename(tmp, filePath);
  else await removeIfExists(tmp);
  usedEntries.add(key);
  return {saved, cached: false};
}

async function optimizeImages(outDir, cacheDir) {
  await fs.promises.mkdir(cacheDir, {recursive: true});
  const files = walk(outDir);
  const usedEntries = new Set();
  const results = await Promise.all(files.map((file) => optimizeFile(file, cacheDir, usedEntries)));
  const cacheEntries = await fs.promises.readdir(cacheDir, {withFileTypes: true});
  await Promise.all(cacheEntries
    .filter((entry) => entry.isFile() && !usedEntries.has(entry.name))
    .map((entry) => fs.promises.unlink(path.join(cacheDir, entry.name))));
  return {
    total: files.length,
    cached: results.filter((result) => result.cached).length,
    saved: results.reduce((total, result) => total + result.saved, 0),
  };
}

function optimizeImagesPlugin(context) {
  return {
    name: 'optimize-images',
    async postBuild({outDir}) {
      const {total, cached, saved} = await optimizeImages(
        outDir,
        path.join(context.siteDir, 'node_modules/.cache/optimize-images'),
      );
      const mb = (saved / 1024 / 1024).toFixed(1);
      console.log(`[optimize-images] Compressed ${total} images (${cached} from cache), saved ${mb} MB`);
    },
  };
}

module.exports = optimizeImagesPlugin;
module.exports.optimizeImages = optimizeImages;
