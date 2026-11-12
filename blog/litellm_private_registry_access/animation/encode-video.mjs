import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {FPS, DURATION} from './scene.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const {values} = parseArgs({options: {'webm-only': {type: 'boolean', default: false}}});
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {stdio: 'inherit', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}
const pendingWebm = path.join(root, '..', '.cover.pending.webm');
run('ffmpeg', ['-v', 'warning', '-framerate', String(FPS), '-i', path.join(root, 'frames', '%04d.png'),
  '-frames:v', String(FPS * DURATION), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
  '-b:v', '0', '-crf', '24', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1',
  '-threads', '4', '-an', '-auto-alt-ref', '0', '-y', pendingWebm]);
fs.renameSync(pendingWebm, path.join(root, '..', 'cover.webm'));
if (!values['webm-only']) {
  if (process.platform !== 'darwin') throw new Error('HEVC with alpha requires macOS AVFoundation. Use --webm-only to regenerate only WebM.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-video-'));
  try {
    const executable = path.join(temporary, 'encode-video');
    run('swiftc', ['-O', '-parse-as-library', path.join(root, 'encode-video.swift'), '-o', executable]);
    run(executable, [path.join(root, 'frames'), path.join(root, '..', 'cover.mov'), String(FPS), String(FPS * DURATION)]);
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}
