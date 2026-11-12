import assert from 'node:assert/strict';
import test from 'node:test';
import {buildTransport, fresnelDielectric, intersectCircle, refract} from './optics.mjs';

const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
const source = {x: 0, y: 0}, target = {x: 100, y: 0};
const bead = {x: 100, y: 0, r: 10};
const options = {
  rayCount: 1, beamWidth: 0, roughness: 0, absorption: 0.05,
  maxBounces: 64, splitDepth: 8, maxSegments: 1000, minEnergy: 1e-12,
  bounds: {xMin: -50, yMin: -100, xMax: 200, yMax: 100},
};

test('air/glass Fresnel reflectance is 4% at normal incidence', () => {
  close(fresnelDielectric(1, 1, 1.5), 0.04);
  close(fresnelDielectric(Math.cos(Math.PI / 3), 1, 1.5), 0.08918671280221276);
  const transport = buildTransport([bead], source, target, options);
  const children = transport.segments.filter(segment => segment.parentSegment === 0);
  close(children.find(segment => segment.kind === 'air').energy, 0.04);
  close(children.find(segment => segment.kind === 'glass').energy, 0.96);
  close(children.reduce((sum, segment) => sum + segment.energy, 0), 1);
});

test('Snell refraction maps 30 degrees in air to 19.471 degrees in glass', () => {
  const direction = {x: 0.5, y: -Math.sqrt(3) / 2};
  const transmitted = refract(direction, {x: 0, y: 1}, 1, 1.5);
  close(Math.asin(transmitted.x) * 180 / Math.PI, 19.47122063449069);
  close(Math.hypot(transmitted.x, transmitted.y), 1);
  const reversed = refract({x: -transmitted.x, y: -transmitted.y}, {x: 0, y: -1}, 1.5, 1);
  close(reversed.x, -direction.x);
  close(reversed.y, -direction.y);
});

test('glass/air transmission stops at the critical angle', () => {
  const critical = Math.asin(1 / 1.5), normal = {x: 0, y: 1};
  const at = angle => ({x: Math.sin(angle), y: -Math.cos(angle)});
  assert.notEqual(refract(at(critical - 1e-6), normal, 1.5, 1), null);
  assert.equal(refract(at(critical + 1e-6), normal, 1.5, 1), null);
  close(fresnelDielectric(Math.cos(critical + 1e-6), 1.5, 1), 1);
  // A smooth circular bead cannot create TIR from rays initially in air.
  const transport = buildTransport([bead], source, target, {...options, beamWidth: 19.8, rayCount: 64});
  assert.equal(transport.stats.totalInternalReflections, 0);
});

test('intersections and light deposition are causal with slower glass travel', () => {
  close(intersectCircle(source, {x: 1, y: 0}, bead), 90);
  close(intersectCircle({x: 100, y: 0}, {x: 1, y: 0}, bead), 10);
  assert.equal(intersectCircle({x: 0, y: 20}, {x: 1, y: 0}, bead), null);
  const transport = buildTransport([bead], source, target, options);
  close(transport.firstHit.opticalTime, 90);
  const glass = transport.segments.find(segment => segment.kind === 'glass');
  close(glass.opticalStart, 90);
  close(glass.opticalEnd, 120); // 20 units of glass at n=1.5.
  const deposit = transport.events[0];
  close(deposit.depositedEnergy, 0.96 * (1 - Math.exp(-1)));
  close(deposit.x, 90 + 20 - 20 / Math.expm1(1));
  for (const event of transport.events) {
    assert.ok(event.opticalStart >= transport.firstHit.opticalTime);
    assert.ok(event.opticalTime >= event.opticalStart && event.opticalTime <= event.opticalEnd);
  }
  for (const segment of transport.segments.filter(segment => segment.kind !== 'incident')) {
    assert.ok(segment.opticalStart >= transport.firstHit.opticalTime);
  }
});

test('rough scattering conserves energy and repeats deterministically', () => {
  const pods = Array.from({length: 60}, (_, index) => ({
    x: 100 + index % 10 * 26, y: -65 + Math.floor(index / 10) * 26, r: 9,
  }));
  const settings = {...options, rayCount: 64, beamWidth: 30, roughness: 0.28,
    splitDepth: 2, absorption: 0.008, maxSegments: 8000,
    bounds: {minX: -50, minY: -100, maxX: 400, maxY: 100}};
  const transport = buildTransport(pods, source, target, settings);
  assert.deepEqual(transport, buildTransport(pods, source, target, settings));
  const deposits = transport.events.reduce((sum, event) => sum + event.depositedEnergy, 0);
  close(deposits, transport.stats.absorbedEnergy);
  close(deposits + transport.stats.escapedEnergy + transport.stats.terminatedEnergy, 1);
  assert.ok(deposits <= 1);
  for (const segment of transport.segments) {
    close(Math.hypot(segment.direction.x, segment.direction.y), 1);
    assert.ok(segment.energyEnd >= 0 && segment.energyEnd <= segment.energy);
  }
  const clear = buildTransport([bead], source, target, {...options, absorption: 0});
  assert.equal(clear.events.length, 0);
  close(clear.stats.escapedEnergy + clear.stats.terminatedEnergy, 1);
});

test('separate bead solids must not overlap', () => {
  assert.throws(() => buildTransport([bead, {...bead, x: 110}], source, target), /overlap/);
  assert.doesNotThrow(() => buildTransport([bead, {...bead, x: 121}], source, target));
});

test('Gaussian beam power is strongest at the center and sums to one', () => {
  const settings = {...options, rayCount: 5, beamWidth: 10, beamSigma: 2};
  const transport = buildTransport([], source, target, settings);
  const rays = transport.segments;
  rays.forEach((ray, index) => close(ray.y1, [-4, -2, 0, 2, 4][index]));
  assert.equal(rays.reduce((sum, ray) => sum + ray.energy, 0), 1);
  close(rays[0].energy / rays[2].energy, Math.exp(-2));
  close(rays[1].energy / rays[2].energy, Math.exp(-0.5));
  close(rays[0].energy, rays[4].energy);
  assert.ok(rays.every(ray => ray.energy >= 0));
  close(transport.stats.accountedEnergy, 1);
  const hit = buildTransport([bead], source, target, {...settings, rayCount: 128, beamWidth: 90, beamSigma: 18});
  assert.equal(hit.segments.filter(ray => ray.kind === 'incident').reduce((sum, ray) => sum + ray.energy, 0), 1);
  close(hit.stats.accountedEnergy, 1);
  // Narrow distributions must not generate NaN or negative residual power.
  const narrow = buildTransport([], source, target, {...settings, rayCount: 128, beamSigma: 1e-300});
  assert.ok(narrow.segments.every(ray => Number.isFinite(ray.energy) && ray.energy >= 0));
  close(narrow.stats.accountedEnergy, 1);
  assert.throws(() => buildTransport([], source, target, {...settings, beamSigma: 0}), /beamSigma/);
});

test('a Gaussian point-source fan diverges while conserving incident power', () => {
  const settings = {...options, rayCount: 5, beamWidth: 0, angularWidth: 1, angularSigma: 0.2};
  const transport = buildTransport([], source, target, settings);
  const rays = transport.segments;
  rays.forEach((ray, index) => {
    close(ray.x1, source.x); close(ray.y1, source.y);
    close(Math.atan2(ray.direction.y, ray.direction.x), [-0.4, -0.2, 0, 0.2, 0.4][index]);
    close(Math.hypot(ray.direction.x, ray.direction.y), 1);
  });
  assert.equal(rays.reduce((sum, ray) => sum + ray.energy, 0), 1);
  close(rays[0].energy / rays[2].energy, Math.exp(-2));
  close(rays[1].energy / rays[2].energy, Math.exp(-0.5));
  close(transport.stats.accountedEnergy, 1);
  const offAxisBead = {...bead, y: 30};
  const hit = buildTransport([offAxisBead], source, target, {...settings, rayCount: 32});
  close(hit.firstHit.distance, Math.hypot(offAxisBead.x, offAxisBead.y) - offAxisBead.r);
  const firstRay = hit.segments.find(ray => ray.kind === 'incident' && ray.rayIndex === hit.firstHit.rayIndex);
  close(firstRay.opticalEnd, hit.firstHit.opticalTime);
  assert.ok(hit.events.every(event => event.opticalStart >= hit.firstHit.opticalTime - 1e-10));
  close(hit.stats.accountedEnergy, 1);
  assert.throws(() => buildTransport([], source, target, {...settings, angularSigma: 0}), /angularSigma/);
  assert.throws(() => buildTransport([], source, target, {...settings, angularWidth: 7}), /angularWidth/);
});

test('mirrored bounds preserve straight-ray energy and optical time', () => {
  const settings = {...options, mirrorBounds: true, maxDistance: 20,
    bounds: {minX: 0, minY: 0, maxX: 10, maxY: 10}};
  const transport = buildTransport([], {x: 5, y: 5}, {x: 15, y: 5}, settings);
  assert.deepEqual(transport.segments.map(ray => [ray.x1, ray.x2]), [[5, 10], [10, 0], [0, 5]]);
  assert.deepEqual(transport.segments.map(ray => [ray.opticalStart, ray.opticalEnd]), [[0, 5], [5, 15], [15, 20]]);
  assert.deepEqual(transport.segments.map(ray => ray.kind), ['incident', 'air', 'air']);
  assert.equal(transport.stats.mirrorReflections, 2);
  assert.equal(transport.stats.escapedEnergy, 0);
  close(transport.stats.terminatedEnergy, 1);
  assert.ok(transport.segments.every(ray => ray.energy === 1));
  const open = buildTransport([], {x: 5, y: 5}, {x: 15, y: 5}, {...settings, mirrorBounds: false});
  assert.equal(open.segments.length, 1);
  assert.equal(open.stats.mirrorReflections, 0);
  close(open.stats.escapedEnergy, 1);
});

test('an exact mirror corner flips both direction components', () => {
  const transport = buildTransport([], {x: 5, y: 5}, {x: 15, y: 15}, {
    ...options, mirrorBounds: true, maxDistance: 12,
    bounds: {minX: 0, minY: 0, maxX: 10, maxY: 10},
  });
  const [incoming, reflected] = transport.segments;
  close(incoming.x2, 10); close(incoming.y2, 10);
  close(reflected.direction.x, -Math.SQRT1_2); close(reflected.direction.y, -Math.SQRT1_2);
  close(reflected.opticalStart, Math.sqrt(50)); close(reflected.opticalEnd, 12);
  assert.equal(transport.stats.mirrorReflections, 1);
  assert.equal(transport.stats.mirrorCornerReflections, 1);
  assert.equal(transport.stats.escapedEnergy, 0);
  close(transport.stats.accountedEnergy, 1);
});

test('a reflected ray can first reach and later re-enter a bead causally', () => {
  const transport = buildTransport([{x: 5, y: 5, r: 1}], {x: 2, y: 5}, {x: -8, y: 5}, {
    ...options, mirrorBounds: true, maxDistance: 24,
    bounds: {minX: 0, minY: 0, maxX: 10, maxY: 10},
  });
  close(transport.firstHit.opticalTime, 6); // Two units to the left wall, then four to glass.
  assert.equal(transport.firstHit.wallReflections, 1);
  assert.ok(transport.events.every(event => event.opticalStart >= 6));
  assert.ok(transport.segments.some(ray => ray.kind === 'glass' && ray.direction.x < 0 && ray.opticalStart > 6));
  const deposits = transport.events.reduce((sum, event) => sum + event.depositedEnergy, 0);
  close(deposits + transport.stats.terminatedEnergy, 1);
  assert.equal(transport.stats.escapedEnergy, 0);
  assert.ok(transport.stats.mirrorReflections > 1);
});

test('an optical horizon clips glass travel and records remaining energy separately', () => {
  const transport = buildTransport([bead], source, target, {
    ...options, mirrorBounds: true, maxOpticalDistance: 105,
  });
  const glass = transport.segments.find(ray => ray.kind === 'glass');
  close(glass.x2, 100); close(glass.opticalEnd, 105);
  close(transport.stats.absorbedEnergy, 0.96 * (1 - Math.exp(-0.5)));
  assert.ok(transport.segments.every(ray => ray.opticalEnd <= 105 + 1e-10));
  assert.ok(transport.events.every(event => event.opticalTime <= 105));
  assert.equal(transport.stats.escapedEnergy, 0);
  close(transport.stats.terminatedEnergy, transport.stats.opticalHorizonEnergy);
  close(transport.stats.absorbedEnergy + transport.stats.opticalHorizonEnergy, 1);
});
