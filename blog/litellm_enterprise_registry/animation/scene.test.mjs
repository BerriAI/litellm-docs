import assert from 'node:assert/strict';
import test from 'node:test';
import {PODS, WIDTH, HEIGHT, TRANSPORT} from './scene.mjs';

test('the full bead field and its glow fit inside the image', () => {
  assert.equal(PODS.length, 386);
  for (const [index, pod] of PODS.entries()) {
    const extent = pod.r * 3.6;
    assert.ok(pod.x - extent >= 0 && pod.x + extent <= WIDTH, `Bead ${index} is cropped horizontally`);
    assert.ok(pod.y - extent >= 0 && pod.y + extent <= HEIGHT, `Bead ${index} is cropped vertically`);
  }
  assert.equal(TRANSPORT.stats.overlapCount, 0);
});

test('the scene reflects at the image edges and illuminates every bead', () => {
  assert.ok(TRANSPORT.stats.mirrorReflections > 0);
  assert.equal(TRANSPORT.stats.escapedEnergy, 0);
  assert.equal(TRANSPORT.stats.maxSegmentsReached, false);
  assert.ok(TRANSPORT.stats.energyError < 1e-9);
  assert.equal(new Set(TRANSPORT.events.map(event => event.beadIndex)).size, PODS.length);
  for (const segment of TRANSPORT.segments) {
    for (const [x, y] of [[segment.x1, segment.y1], [segment.x2, segment.y2]]) {
      assert.ok(x >= -1e-6 && x <= WIDTH + 1e-6 && y >= -1e-6 && y <= HEIGHT + 1e-6);
    }
  }
});
