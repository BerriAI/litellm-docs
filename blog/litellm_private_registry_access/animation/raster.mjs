/**
 * HDR rasterization of precomputed optical paths. Light stays in Float32 until
 * one final tone-map operation; overlapping rays never add in an 8-bit canvas.
 * The Gaussian is sampled in optical-pulse coordinates supplied by the scene.
 * This module changes display exposure/softness only, never path geometry,
 * arrival times, or absorbed energy used by the phosphorescent material.
 */

const surfaces = new Map();
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function surfaceFor(width, height, canvasFactory) {
  const key = `${width}x${height}`;
  let surface = surfaces.get(key);
  if (!surface) {
    const canvas = canvasFactory(width, height);
    const context = canvas.getContext('2d');
    surface = {
      canvas, context, image: context.createImageData(width, height),
      incident: new Float32Array(width * height),
      diffuse: new Float32Array(width * height),
      scratch: new Float32Array(width * height),
    };
    // Rendering is synchronous, so consecutive frames safely reuse this work
    // surface even when their outer export jobs are asynchronous.
    if (surfaces.size >= 3) surfaces.delete(surfaces.keys().next().value);
    surfaces.set(key, surface);
  }
  return surface;
}

function boxRadii(sigma) {
  if (!(sigma > 0)) return [];
  const ideal = Math.sqrt(4 * sigma * sigma + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower--;
  lower = Math.max(1, lower);
  const upper = lower + 2;
  const lowerCount = clamp(Math.round((12 * sigma * sigma - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4)), 0, 3);
  return Array.from({length: 3}, (_, index) => ((index < lowerCount ? lower : upper) - 1) / 2);
}

function blurHorizontal(input, output, width, height, radius) {
  const scale = 1 / (2 * radius + 1);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = 0; x <= radius && x < width; x++) sum += input[row + x];
    for (let x = 0; x < width; x++) {
      output[row + x] = Math.max(0, sum * scale);
      const remove = x - radius, add = x + radius + 1;
      if (remove >= 0) sum -= input[row + remove];
      if (add < width) sum += input[row + add];
    }
  }
}

function blurVertical(input, output, width, height, radius) {
  const scale = 1 / (2 * radius + 1);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y <= radius && y < height; y++) sum += input[y * width + x];
    for (let y = 0; y < height; y++) {
      output[y * width + x] = Math.max(0, sum * scale);
      const remove = y - radius, add = y + radius + 1;
      if (remove >= 0) sum -= input[remove * width + x];
      if (add < height) sum += input[add * width + x];
    }
  }
}

function blur(buffer, scratch, width, height, sigma) {
  // Three separable boxes approximate a Gaussian in O(pixel count), independent
  // of blur radius. Zero padding lets illumination fall beyond the image edge.
  for (const radius of boxRadii(sigma)) {
    if (radius === 0) continue;
    blurHorizontal(buffer, scratch, width, height, radius);
    blurVertical(scratch, buffer, width, height, radius);
  }
}

function splat(buffer, width, height, x, y, power) {
  const left = Math.floor(x), top = Math.floor(y);
  const fx = x - left, fy = y - top;
  if (top >= 0 && top < height) {
    const row = top * width;
    if (left >= 0 && left < width) buffer[row + left] += power * (1 - fx) * (1 - fy);
    if (left + 1 >= 0 && left + 1 < width) buffer[row + left + 1] += power * fx * (1 - fy);
  }
  if (top + 1 >= 0 && top + 1 < height) {
    const row = (top + 1) * width;
    if (left >= 0 && left < width) buffer[row + left] += power * (1 - fx) * fy;
    if (left + 1 >= 0 && left + 1 < width) buffer[row + left + 1] += power * fx * fy;
  }
}

/**
 * Draw one transparent light-only frame, replacing the destination contents.
 *
 * canvasFactory must be a function such as @napi-rs/canvas createCanvas.
 * current.rays supply geometry, gx1/gy1/gx2/gy2 at Gaussian +/-3 sigma,
 * diffuse, and untone-mapped packet energy. Optional alpha===0 culls an inactive
 * ray; otherwise alpha is ignored when physical energy is supplied. A legacy
 * alpha-only ray is accepted as already exposed display power.
 *
 * exposure multiplies the accumulated linear radiance before the single tone
 * map. Doubling it doubles light power, not final alpha. It is a display gain,
 * independent of optical transport and phosphor exposure. The default 1200 is
 * intended for a source normalized to total energy 1 and a broad 2048-ray fan.
 * incidentSigma/diffuseSigma are Gaussian standard deviations in grid pixels.
 * gridScale=.5 gives an 800x400 work grid for a 1600x800 export.
 */
export function drawLight(context, current, width, height, canvasFactory, options = {}) {
  if (typeof canvasFactory !== 'function') throw new Error('HDR drawLight requires a canvasFactory(width, height) function.');
  const settings = {
    sceneWidth: 1600, sceneHeight: 800, gridScale: 0.5, sampleStep: 2,
    exposure: 1200, incidentGain: 1, diffuseGain: 1.15,
    incidentSigma: 2, diffuseSigma: 5, ...options,
  };
  for (const key of ['sceneWidth', 'sceneHeight', 'gridScale', 'sampleStep']) {
    if (!(Number.isFinite(settings[key]) && settings[key] > 0)) throw new Error(`Invalid HDR ${key}.`);
  }
  for (const key of ['exposure', 'incidentGain', 'diffuseGain', 'incidentSigma', 'diffuseSigma']) {
    if (!(Number.isFinite(settings[key]) && settings[key] >= 0)) throw new Error(`Invalid HDR ${key}.`);
  }
  const gridWidth = Math.max(1, Math.round(width * settings.gridScale));
  const gridHeight = Math.max(1, Math.round(height * settings.gridScale));
  const surface = surfaceFor(gridWidth, gridHeight, canvasFactory);
  const {incident, diffuse, scratch, image} = surface;
  incident.fill(0); diffuse.fill(0);
  const sx = gridWidth / settings.sceneWidth, sy = gridHeight / settings.sceneHeight;
  let activeRays = 0, samples = 0;
  for (const ray of current.rays) {
    if (ray.alpha === 0) continue;
    const physicalEnergy = Number.isFinite(ray.energy);
    const energy = physicalEnergy ? ray.energy : ray.alpha / Math.max(settings.exposure, Number.EPSILON);
    if (!(energy > 0)) continue;
    const dx = ray.x2 - ray.x1, dy = ray.y2 - ray.y1;
    const gx = ray.gx2 - ray.gx1, gy = ray.gy2 - ray.gy1;
    const gradientLength2 = gx * gx + gy * gy;
    const segmentLength = Math.hypot(dx, dy);
    if (!(gradientLength2 > 1e-12 && segmentLength > 1e-9)) continue;
    const uStart = ((ray.x1 - ray.gx1) * gx + (ray.y1 - ray.gy1) * gy) / gradientLength2;
    const uDelta = (dx * gx + dy * gy) / gradientLength2;
    let from = 0, to = 1;
    if (Math.abs(uDelta) < 1e-12) {
      if (uStart < 0 || uStart > 1) continue;
    } else {
      const zero = -uStart / uDelta, one = (1 - uStart) / uDelta;
      from = Math.max(0, Math.min(zero, one));
      to = Math.min(1, Math.max(zero, one));
      if (!(to > from)) continue;
    }
    const extent = to - from;
    const count = Math.max(1, Math.ceil(segmentLength * extent / settings.sampleStep));
    // Weight by the sampled grid length so brightness is independent of the
    // number of samples, and stays stable when sampleStep changes.
    const packetPower = energy * Math.hypot(dx * sx, dy * sy) * extent / count;
    const buffer = ray.diffuse ? diffuse : incident;
    for (let i = 0; i < count; i++) {
      const t = from + (i + 0.5) / count * extent;
      const u = uStart + t * uDelta;
      const gaussian = Math.exp(-18 * (u - 0.5) * (u - 0.5));
      splat(buffer, gridWidth, gridHeight, (ray.x1 + dx * t) * sx - 0.5,
        (ray.y1 + dy * t) * sy - 0.5, packetPower * gaussian);
    }
    activeRays++; samples += count;
  }
  blur(incident, scratch, gridWidth, gridHeight, settings.incidentSigma);
  blur(diffuse, scratch, gridWidth, gridHeight, settings.diffuseSigma);
  const pixels = image.data;
  // Compensate for angular-ray density changing with output resolution. At the
  // reference 800x400 grid this is one; a smaller export retains its exposure.
  const resolutionGain = Math.sqrt(sx * sy) / 0.5;
  let peakRadiance = 0;
  for (let i = 0; i < incident.length; i++) {
    const radiance = (incident[i] * settings.incidentGain + diffuse[i] * settings.diffuseGain) * settings.exposure * resolutionGain;
    peakRadiance = Math.max(peakRadiance, radiance);
    const alpha = -Math.expm1(-radiance);
    const offset = i * 4;
    if (alpha < 0.5 / 255) {
      pixels[offset] = 0; pixels[offset + 1] = 0; pixels[offset + 2] = 0; pixels[offset + 3] = 0;
      continue;
    }
    // Low radiance has a cool blue halo; high radiance approaches a white-blue
    // core. Alpha is generated once, after all overlaps and softening.
    const white = -Math.expm1(-2 * radiance);
    pixels[offset] = Math.round(66 + 179 * white);
    pixels[offset + 1] = Math.round(147 + 106 * white);
    pixels[offset + 2] = Math.round(214 + 41 * white);
    pixels[offset + 3] = Math.round(alpha * 255);
  }
  surface.context.putImageData(image, 0, 0);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1; context.globalCompositeOperation = 'source-over'; context.filter = 'none';
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  context.drawImage(surface.canvas, 0, 0, width, height);
  context.restore();
  return {gridWidth, gridHeight, activeRays, samples, peakRadiance};
}
