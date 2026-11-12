/**
 * Deterministic 2D pulse transport through non-overlapping circular glass beads.
 *
 * This is geometric ray optics, not a 3D renderer or a wave simulation. Circle
 * intersections, Snell directions, unpolarized dielectric Fresnel reflectance,
 * optical path length, and Beer-Lambert absorption are calculated explicitly.
 * Frosting uses a bounded Gaussian microfacet-normal model with rejection of
 * geometrically invalid directions; it is an approximation to a rough BSDF,
 * without polarization, diffraction, volumetric scattering, or microfacet
 * masking/shadowing. All rays carry the same cool-white spectrum, with no
 * invented rainbow dispersion. Phosphor decay and emission belong to the
 * material renderer and must be powered by depositedEnergy, not a new clock.
 *
 * Units are scene units. opticalTime is optical path length (distance * IOR),
 * not seconds: divide it by a chosen animation propagation speed. A finite
 * temporal pulse is rendered by convolving these impulse paths/events with a
 * source pulse. The incident beam has finite width; optional beamSigma gives
 * its power a truncated Gaussian cross-section. angularWidth opens a diverging
 * fan, and angularSigma optionally gives that fan a Gaussian power profile.
 *
 * Fresnel reference: https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission
 */

const EPS = 1e-6;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const dot = (a, b) => a.x * b.x + a.y * b.y;
const normalize = p => {
  const length = Math.hypot(p.x, p.y);
  if (!(length > 0)) throw new Error('An optical direction must be nonzero.');
  return {x: p.x / length, y: p.y / length};
};
const point = p => Array.isArray(p) ? {x: p[0], y: p[1]} : {x: p.x, y: p.y};

function randomSequence(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = value;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

/** Positive distance to the first circle boundary, including an inside exit. */
export function intersectCircle(origin, direction, circle, minimum = EPS) {
  const ox = origin.x - circle.x, oy = origin.y - circle.y;
  const projection = ox * direction.x + oy * direction.y;
  const discriminant = projection * projection - (ox * ox + oy * oy - circle.r * circle.r);
  if (discriminant < 0) return null;
  const root = Math.sqrt(Math.max(0, discriminant));
  const near = -projection - root, far = -projection + root;
  return near > minimum ? near : far > minimum ? far : null;
}

/** Exact unpolarized Fresnel power reflectance, for an incident-facing normal. */
export function fresnelDielectric(cosIncident, nIncident = 1, nTransmitted = 1.5) {
  const ci = clamp(cosIncident);
  if (nIncident === nTransmitted) return 0;
  const sinTransmitted2 = (nIncident / nTransmitted) ** 2 * (1 - ci * ci);
  if (sinTransmitted2 >= 1) return 1;
  const ct = Math.sqrt(1 - sinTransmitted2);
  const perpendicular = (nIncident * ci - nTransmitted * ct) / (nIncident * ci + nTransmitted * ct);
  const parallel = (nTransmitted * ci - nIncident * ct) / (nTransmitted * ci + nIncident * ct);
  return clamp((perpendicular * perpendicular + parallel * parallel) / 2);
}

/** Ray direction points toward the surface; normal points into incident medium. */
export function refract(direction, normal, nIncident = 1, nTransmitted = 1.5) {
  const cosine = clamp(-dot(direction, normal));
  const eta = nIncident / nTransmitted;
  const discriminant = 1 - eta * eta * (1 - cosine * cosine);
  if (discriminant < 0) return null;
  const normalScale = eta * cosine - Math.sqrt(Math.max(0, discriminant));
  return normalize({x: eta * direction.x + normalScale * normal.x, y: eta * direction.y + normalScale * normal.y});
}

export function reflect(direction, normal) {
  const scale = 2 * dot(direction, normal);
  return normalize({x: direction.x - scale * normal.x, y: direction.y - scale * normal.y});
}

function boundaryDistance(origin, direction, bounds) {
  let distance = Infinity;
  if (direction.x > EPS) distance = Math.min(distance, (bounds.maxX - origin.x) / direction.x);
  if (direction.x < -EPS) distance = Math.min(distance, (bounds.minX - origin.x) / direction.x);
  if (direction.y > EPS) distance = Math.min(distance, (bounds.maxY - origin.y) / direction.y);
  if (direction.y < -EPS) distance = Math.min(distance, (bounds.minY - origin.y) / direction.y);
  return Math.max(0, distance);
}

function interfaceSample(direction, faceNormal, nIncident, nTransmitted, roughness, random) {
  for (let attempt = 0; attempt < 13; attempt++) {
    // The final smooth sample is a valid fallback at extreme grazing angles.
    const gaussian = attempt === 12 || roughness === 0 ? 0 :
      Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
    const angle = Math.atan(roughness * gaussian), c = Math.cos(angle), s = Math.sin(angle);
    const normal = {x: faceNormal.x * c - faceNormal.y * s, y: faceNormal.x * s + faceNormal.y * c};
    if (dot(direction, normal) >= -EPS) continue;
    const reflected = reflect(direction, normal);
    const transmitted = refract(direction, normal, nIncident, nTransmitted);
    if (dot(reflected, faceNormal) <= EPS || (transmitted && dot(transmitted, faceNormal) >= -EPS)) continue;
    return {reflected, transmitted, reflectance: transmitted ? fresnelDielectric(-dot(direction, normal), nIncident, nTransmitted) : 1};
  }
  return {reflected: reflect(direction, faceNormal), transmitted: null, reflectance: 1};
}

/**
 * @param {Array<{x:number,y:number,r:number}>} pods Disjoint circular sections.
 * @param {{x:number,y:number}|number[]} source Center of the incident source plane.
 * @param {{x:number,y:number}|number[]} target Point defining incident direction.
 * @param {object} options See defaults below. roughness is RMS microfacet slope;
 * absorption is the inverse-scene-unit Beer-Lambert coefficient. beamSigma is
 * an optional positive standard deviation in scene units; beamWidth remains
 * the full finite support. Omit beamSigma for uniform spatial power. Optional
 * angularWidth is the full angular support in radians, centered on the target
 * direction; angularSigma is its Gaussian standard deviation in radians.
 * Set beamWidth:0 for a true point-source fan. Nonzero beamWidth and divergence
 * describe an expanded source plane with direction varying across the plane.
 * mirrorBounds:true makes all four bounds ideal specular mirrors. Wall hits
 * preserve power and optical time; exact corner hits flip both components.
 * Wall bounces do not consume the bead-interface Fresnel split budget.
 * maxOpticalDistance optionally stops paths at an animation's visible horizon,
 * in the same optical-distance units as opticalTime; default is unlimited.
 * @returns {{segments:Array,events:Array,firstHit:object|null,stats:object}}
 *
 * segments: x1/y1/x2/y2, direction, energy/energyEnd, rgb, kind, beadIndex,
 * rayIndex, branchIndex, parentSegment, distanceStart/End, opticalStart/End.
 * events: beadIndex, depositedEnergy, incidentEnergy, rgb, x/y, opticalTime,
 * opticalStart/End, segmentIndex. opticalTime is the absorption centroid;
 * opticalStart/End delimit the continuous deposition interval in that bead.
 * firstHit: exact first contact for collimated beams and point-source fans;
 * for a source with both width and divergence, the earliest sampled contact.
 *
 * Exact branches are kept for splitDepth interactions, then deterministic
 * Monte Carlo chooses R/T with Fresnel probabilities and unchanged packet
 * energy. This conserves packet power and estimates the split statistically.
 * Truncated/pruned energy is reported separately, never turned into glow.
 */
export function buildTransport(pods, source, target, options = {}) {
  const settings = {
    seed: 27913, rayCount: 192, beamWidth: 34, angularWidth: 0, maxSegments: 4096,
    maxBounces: 32, splitDepth: 2, minEnergy: 1e-7,
    nAir: 1, nGlass: 1.5, absorption: 0.008, roughness: 0.22,
    maxDistance: 6000, maxOpticalDistance: Infinity, mirrorBounds: false,
    rgb: [0.88, 0.95, 1], ...options,
  };
  for (const key of ['rayCount', 'maxSegments', 'maxBounces', 'splitDepth']) {
    if (!Number.isInteger(settings[key]) || settings[key] < (key === 'splitDepth' ? 0 : 1)) throw new Error(`Invalid optics ${key}.`);
  }
  for (const key of ['beamWidth', 'angularWidth', 'absorption', 'roughness', 'minEnergy']) {
    if (!Number.isFinite(settings[key]) || settings[key] < 0) throw new Error(`Invalid optics ${key}.`);
  }
  for (const key of ['nAir', 'nGlass', 'maxDistance']) {
    if (!Number.isFinite(settings[key]) || settings[key] <= 0) throw new Error(`Invalid optics ${key}.`);
  }
  for (const key of ['beamSigma', 'angularSigma']) {
    if (settings[key] !== undefined && (!Number.isFinite(settings[key]) || settings[key] <= 0)) throw new Error(`Invalid optics ${key}.`);
  }
  if (!(settings.maxOpticalDistance > 0) || settings.maxOpticalDistance !== Infinity && !Number.isFinite(settings.maxOpticalDistance)) throw new Error('Invalid optics maxOpticalDistance.');
  if (settings.angularWidth > Math.PI * 2) throw new Error('Optics angularWidth must not exceed 2π radians.');
  source = point(source); target = point(target);
  if (![source.x, source.y, target.x, target.y].every(Number.isFinite)) throw new Error('Optical source and target must be finite.');
  const circles = pods.map((pod, index) => {
    if (![pod.x, pod.y, pod.r].every(Number.isFinite) || pod.r <= 0) throw new Error(`Invalid optical bead ${index}.`);
    return {x: pod.x, y: pod.y, r: pod.r};
  });
  const direction = normalize({x: target.x - source.x, y: target.y - source.y});
  const lateral = {x: -direction.y, y: direction.x};
  const centralAngle = Math.atan2(direction.y, direction.x);
  const spectrum = settings.rgb.slice();
  if (spectrum.length !== 3 || !spectrum.every(v => Number.isFinite(v) && v >= 0) || !spectrum.some(v => v > 0)) throw new Error('Optical RGB must contain three nonnegative channels.');
  const spectrumTotal = spectrum.reduce((sum, value) => sum + value, 0);
  const rgb = spectrum.map(value => value / spectrumTotal);
  const defaultBounds = {
    minX: Math.min(source.x, ...circles.map(p => p.x - p.r)) - 100,
    minY: Math.min(source.y, ...circles.map(p => p.y - p.r)) - 100,
    maxX: Math.max(source.x, ...circles.map(p => p.x + p.r)) + 100,
    maxY: Math.max(source.y, ...circles.map(p => p.y + p.r)) + 100,
  };
  const requestedBounds = options.bounds || defaultBounds;
  const bounds = {
    minX: requestedBounds.minX ?? requestedBounds.xMin,
    minY: requestedBounds.minY ?? requestedBounds.yMin,
    maxX: requestedBounds.maxX ?? requestedBounds.xMax,
    maxY: requestedBounds.maxY ?? requestedBounds.yMax,
  };
  if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite) || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) throw new Error('Optics bounds require minX/minY/maxX/maxY.');
  const random = randomSequence(settings.seed), segments = [], events = [];
  const stats = {
    inputEnergy: 1, absorbedEnergy: 0, escapedEnergy: 0, terminatedEnergy: 0,
    rayCount: settings.rayCount, interfaceCount: 0, rouletteCount: 0,
    totalInternalReflections: 0, overlapCount: 0, overlapPairs: [],
    mirrorReflections: 0, mirrorCornerReflections: 0,
    opticalHorizonEnergy: 0,
    maxOpticalTime: 0, maxSegmentsReached: false,
  };
  for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
    if (Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y) < circles[i].r + circles[j].r - EPS) {
      stats.overlapCount++;
      if (stats.overlapPairs.length < 12) stats.overlapPairs.push([i, j]);
    }
  }
  // A supplied overlapping layout cannot represent separate solid beads.
  if (stats.overlapCount && options.allowOverlaps !== true) throw new Error(`Optical bead circles overlap in ${stats.overlapCount} pairs; reduce optical radii. First pairs: ${JSON.stringify(stats.overlapPairs)}.`);

  const offsets = Array.from({length: settings.rayCount}, (_, i) => settings.beamWidth * ((i + 0.5) / settings.rayCount - 0.5));
  const angles = Array.from({length: settings.rayCount}, (_, i) => settings.angularWidth * ((i + 0.5) / settings.rayCount - 0.5));
  let firstHit = null;
  if (settings.angularWidth === 0) for (let i = 0; i < circles.length; i++) {
    const p = circles[i], relative = {x: p.x - source.x, y: p.y - source.y};
    const axial = dot(relative, direction), across = dot(relative, lateral);
    const offset = clamp(across, -settings.beamWidth / 2, settings.beamWidth / 2);
    const perpendicular = across - offset;
    if (Math.abs(perpendicular) >= p.r) continue;
    const distance = axial - Math.sqrt(p.r * p.r - perpendicular * perpendicular);
    if (distance <= EPS || firstHit && distance >= firstHit.distance) continue;
    firstHit = {beadIndex: i, x: source.x + lateral.x * offset + direction.x * distance,
      y: source.y + lateral.y * offset + direction.y * distance,
      distance, opticalTime: distance * settings.nAir, offset, angle: 0, rayIndex: -1};
  }
  else if (settings.beamWidth === 0) for (let i = 0; i < circles.length; i++) {
    const p = circles[i];
    const difference = Math.atan2(p.y - source.y, p.x - source.x) - centralAngle;
    const relativeAngle = Math.atan2(Math.sin(difference), Math.cos(difference));
    const angle = clamp(relativeAngle, -settings.angularWidth / 2, settings.angularWidth / 2);
    const launchDirection = {x: Math.cos(centralAngle + angle), y: Math.sin(centralAngle + angle)};
    const distance = intersectCircle(source, launchDirection, p);
    if (distance === null || firstHit && distance >= firstHit.distance) continue;
    firstHit = {beadIndex: i, x: source.x + launchDirection.x * distance,
      y: source.y + launchDirection.y * distance, distance,
      opticalTime: distance * settings.nAir, offset: 0, angle, rayIndex: -1};
  }
  // Include the exact first-contact ray, keeping deterministic beam quadrature.
  if (firstHit) {
    const values = settings.angularWidth === 0 ? offsets : angles;
    const exact = settings.angularWidth === 0 ? firstHit.offset : firstHit.angle;
    let closest = 0;
    for (let i = 1; i < values.length; i++) if (Math.abs(values[i] - exact) < Math.abs(values[closest] - exact)) closest = i;
    values[closest] = exact; firstHit.rayIndex = closest;
  }
  const launchRays = offsets.map((offset, rayIndex) => ({
    origin: {x: source.x + lateral.x * offset, y: source.y + lateral.y * offset},
    direction: settings.angularWidth === 0 ? direction :
      {x: Math.cos(centralAngle + angles[rayIndex]), y: Math.sin(centralAngle + angles[rayIndex])},
  }));
  if (settings.angularWidth > 0 && settings.beamWidth > 0) for (let rayIndex = 0; rayIndex < launchRays.length; rayIndex++) {
    const launch = launchRays[rayIndex];
    for (let i = 0; i < circles.length; i++) {
      const distance = intersectCircle(launch.origin, launch.direction, circles[i]);
      if (distance === null || firstHit && distance >= firstHit.distance) continue;
      firstHit = {beadIndex: i, x: launch.origin.x + launch.direction.x * distance,
        y: launch.origin.y + launch.direction.y * distance, distance,
        opticalTime: distance * settings.nAir, offset: offsets[rayIndex], angle: angles[rayIndex], rayIndex};
    }
  }
  const gaussianWeights = (values, sigma) => {
    const nearest = Math.min(...values.map(Math.abs));
    return values.map(value => {
      if (sigma === undefined || Math.abs(value) === nearest) return 1;
      // Subtract the largest log weight before exponentiation. This remains
      // finite even when a very narrow Gaussian underflows away from its peak.
      const distance = Math.abs(value);
      return Math.exp(-0.5 * ((distance - nearest) / sigma) * ((distance + nearest) / sigma));
    });
  };
  const spatialWeights = gaussianWeights(offsets, settings.beamSigma);
  const angularWeights = gaussianWeights(angles, settings.angularSigma);
  const weights = spatialWeights.map((weight, index) => weight * angularWeights[index]);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const energies = weights.map(weight => weight / weightTotal);
  // Put rounding residue in the last packet so a left-to-right sum is exactly
  // one. If its true Gaussian weight underflows, adjust a central packet first
  // rather than allowing a negative tail weight.
  const last = energies.length - 1;
  const prefixTotal = () => energies.slice(0, last).reduce((sum, energy) => sum + energy, 0);
  let prefix = prefixTotal();
  if (prefix > 1) {
    const largest = energies.indexOf(Math.max(...energies.slice(0, last)));
    while (prefix > 1) {
      energies[largest] -= prefix - 1 + Number.EPSILON;
      prefix = prefixTotal();
    }
  }
  energies[last] = 1 - prefix;
  let nextBranch = settings.rayCount;
  const queue = launchRays.map((launch, rayIndex) => ({
    origin: launch.origin, direction: launch.direction,
    energy: energies[rayIndex], medium: -1, interactions: 0, wallBounces: 0,
    distance: 0, optical: 0, rayIndex, branchIndex: rayIndex, parentSegment: -1,
  }));
  let head = 0;
  while (head < queue.length) {
    const ray = queue[head++];
    if (ray.optical >= settings.maxOpticalDistance) {
      stats.terminatedEnergy += ray.energy; stats.opticalHorizonEnergy += ray.energy; continue;
    }
    if (segments.length >= settings.maxSegments) {
      stats.maxSegmentsReached = true; stats.terminatedEnergy += ray.energy; continue;
    }
    if (ray.energy < settings.minEnergy || ray.interactions >= settings.maxBounces || ray.distance >= settings.maxDistance) {
      stats.terminatedEnergy += ray.energy; continue;
    }
    const inside = ray.medium >= 0;
    const indexOfRefraction = inside ? settings.nGlass : settings.nAir;
    let hitIndex = -1, hitDistance = Infinity;
    if (inside) {
      const distance = intersectCircle(ray.origin, ray.direction, circles[ray.medium]);
      if (distance !== null) { hitDistance = distance; hitIndex = ray.medium; }
    } else {
      for (let i = 0; i < circles.length; i++) {
        const distance = intersectCircle(ray.origin, ray.direction, circles[i]);
        if (distance !== null && distance < hitDistance) { hitDistance = distance; hitIndex = i; }
      }
    }
    const edgeDistance = boundaryDistance(ray.origin, ray.direction, bounds);
    const remainingDistance = Math.min(settings.maxDistance - ray.distance,
      (settings.maxOpticalDistance - ray.optical) / indexOfRefraction);
    const limit = Math.min(edgeDistance, remainingDistance);
    const length = Math.min(hitDistance, limit);
    const hits = hitIndex >= 0 && hitDistance <= limit;
    const end = {x: ray.origin.x + ray.direction.x * length, y: ray.origin.y + ray.direction.y * length};
    const absorption = inside ? -Math.expm1(-settings.absorption * length) : 0;
    const depositedEnergy = ray.energy * absorption;
    const energyEnd = ray.energy - depositedEnergy;
    const segmentIndex = segments.length;
    const opticalEnd = ray.optical + length * indexOfRefraction;
    segments.push({x1: ray.origin.x, y1: ray.origin.y, x2: end.x, y2: end.y,
      direction: ray.direction, energy: ray.energy, energyEnd, rgb,
      kind: inside ? 'glass' : ray.interactions === 0 && ray.wallBounces === 0 ? 'incident' : 'air',
      beadIndex: inside ? ray.medium : -1, hitBeadIndex: hits ? hitIndex : -1,
      rayIndex: ray.rayIndex, branchIndex: ray.branchIndex, parentSegment: ray.parentSegment,
      distanceStart: ray.distance, distanceEnd: ray.distance + length,
      opticalStart: ray.optical, opticalEnd});
    stats.maxOpticalTime = Math.max(stats.maxOpticalTime, opticalEnd);
    if (depositedEnergy > 0) {
      const thickness = settings.absorption * length;
      const meanDistance = thickness < 1e-4 ? length * (0.5 - thickness / 12) :
        1 / settings.absorption - length / Math.expm1(thickness);
      events.push({beadIndex: ray.medium, depositedEnergy, incidentEnergy: ray.energy, rgb,
        x: ray.origin.x + ray.direction.x * meanDistance, y: ray.origin.y + ray.direction.y * meanDistance,
        opticalTime: ray.optical + meanDistance * indexOfRefraction,
        opticalStart: ray.optical, opticalEnd, segmentIndex});
      stats.absorbedEnergy += depositedEnergy;
    }
    if (!hits) {
      if (edgeDistance <= remainingDistance) {
        if (settings.mirrorBounds) {
          const vertical = Math.abs(end.x - bounds.minX) <= EPS * 16 || Math.abs(end.x - bounds.maxX) <= EPS * 16;
          const horizontal = Math.abs(end.y - bounds.minY) <= EPS * 16 || Math.abs(end.y - bounds.maxY) <= EPS * 16;
          if (!vertical && !horizontal) throw new Error('Mirror intersection did not reach a rectangular boundary.');
          stats.mirrorReflections++;
          if (vertical && horizontal) stats.mirrorCornerReflections++;
          queue.push({...ray, origin: end,
            direction: {x: vertical ? -ray.direction.x : ray.direction.x, y: horizontal ? -ray.direction.y : ray.direction.y},
            energy: energyEnd, wallBounces: ray.wallBounces + 1,
            distance: ray.distance + length, optical: opticalEnd,
            branchIndex: nextBranch++, parentSegment: segmentIndex});
        } else stats.escapedEnergy += energyEnd;
      } else {
        stats.terminatedEnergy += energyEnd;
        if (opticalEnd >= settings.maxOpticalDistance - EPS) stats.opticalHorizonEnergy += energyEnd;
      }
      continue;
    }
    // A mirror can redirect a launch ray to a bead outside the initial fan.
    if (settings.mirrorBounds && !inside && (!firstHit || opticalEnd < firstHit.opticalTime)) {
      firstHit = {beadIndex: hitIndex, x: end.x, y: end.y,
        distance: ray.distance + length, opticalTime: opticalEnd,
        offset: offsets[ray.rayIndex], angle: angles[ray.rayIndex], rayIndex: ray.rayIndex,
        wallReflections: ray.wallBounces};
    }
    const circle = circles[hitIndex];
    const outward = normalize({x: end.x - circle.x, y: end.y - circle.y});
    const faceNormal = inside ? {x: -outward.x, y: -outward.y} : outward;
    const sample = interfaceSample(ray.direction, faceNormal, indexOfRefraction,
      inside ? settings.nAir : settings.nGlass, settings.roughness, random);
    stats.interfaceCount++;
    if (!sample.transmitted) stats.totalInternalReflections++;
    const enqueue = (outgoing, energy, medium) => {
      if (!(energy > 0)) return;
      queue.push({origin: end, direction: outgoing, energy, medium,
        interactions: ray.interactions + 1, wallBounces: ray.wallBounces,
        distance: ray.distance + length, optical: opticalEnd,
        rayIndex: ray.rayIndex, branchIndex: nextBranch++, parentSegment: segmentIndex});
    };
    if (ray.interactions < settings.splitDepth) {
      enqueue(sample.reflected, energyEnd * sample.reflectance, ray.medium);
      if (sample.transmitted) enqueue(sample.transmitted, energyEnd * (1 - sample.reflectance), inside ? -1 : hitIndex);
    } else {
      stats.rouletteCount++;
      if (!sample.transmitted || random() < sample.reflectance) enqueue(sample.reflected, energyEnd, ray.medium);
      else enqueue(sample.transmitted, energyEnd, inside ? -1 : hitIndex);
    }
  }
  stats.segmentCount = segments.length; stats.eventCount = events.length;
  stats.accountedEnergy = stats.absorbedEnergy + stats.escapedEnergy + stats.terminatedEnergy;
  stats.energyError = Math.abs(stats.inputEnergy - stats.accountedEnergy);
  return {segments, events, firstHit, stats};
}
