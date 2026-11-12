import assert from 'node:assert/strict';
import test from 'node:test';
import {createCanvas} from '@napi-rs/canvas';
import {drawLight} from './raster.mjs';

const width = 400, height = 200;
const settings = {sceneWidth: width, sceneHeight: height, exposure: 2};
const packet = {
  x1: 10, y1: 100, x2: 390, y2: 100,
  gx1: 80, gy1: 100, gx2: 320, gy2: 100,
  diffuse: false, energy: 1,
};
const read = context => context.getImageData(0, 0, width, height).data;
const hasLight = pixels => pixels.some((value, index) => index % 4 === 3 && value > 0);

test('HDR accumulation preserves sub-byte light when a packet is split', () => {
  const context = createCanvas(width, height).getContext('2d');
  for (const diffuse of [false, true]) {
    const ray = {...packet, diffuse};
    drawLight(context, {rays: [{...ray, energy: 1 / 1024}]}, width, height, createCanvas, settings);
    assert.equal(hasLight(read(context)), false, 'each small packet is below 8-bit alpha precision');
    drawLight(context, {rays: [ray]}, width, height, createCanvas, settings);
    const whole = read(context);
    assert.ok(hasLight(whole));
    drawLight(context, {rays: Array.from({length: 1024}, () => ({...ray, energy: 1 / 1024}))}, width, height, createCanvas, settings);
    const split = read(context);
    let maximumDifference = 0;
    for (let i = 0; i < whole.length; i++) maximumDifference = Math.max(maximumDifference, Math.abs(whole[i] - split[i]));
    assert.ok(maximumDifference <= 1, `packet subdivision changed a channel by ${maximumDifference}`);
  }
});

test('an empty frame clears both cached light buffers and destination alpha', () => {
  const context = createCanvas(width, height).getContext('2d');
  drawLight(context, {rays: [packet, {...packet, diffuse: true}]}, width, height, createCanvas, settings);
  assert.ok(hasLight(read(context)));
  drawLight(context, {rays: []}, width, height, createCanvas, settings);
  assert.ok(read(context).every(value => value === 0), 'empty frames must contain no light or residual RGB');
});
