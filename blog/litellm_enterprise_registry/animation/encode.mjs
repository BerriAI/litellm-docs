import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {FPS, DURATION} from './scene.mjs';

// PYTHON may point to a venv. See encode.py for the Python dependencies.
const root = path.dirname(fileURLToPath(import.meta.url));
const {values} = parseArgs({options: {
  'frames-dir': {type: 'string', default: path.join(root, 'frames')},
  'output-dir': {type: 'string', default: path.join(root, '..')},
  stem: {type: 'string', default: 'cover'},
  count: {type: 'string', default: String(FPS * DURATION)},
  formats: {type: 'string', default: 'gif'},
  'webp-lossless': {type: 'boolean', default: false},
  'webp-quality': {type: 'string', default: '85'},
  'review-dir': {type: 'string'},
  width: {type: 'string'},
  'gif-width': {type: 'string'},
}});
const args = [
  path.join(root, 'encode.py'),
  '--frames-dir', path.resolve(values['frames-dir']),
  '--output-dir', path.resolve(values['output-dir']),
  '--stem', values.stem,
  '--fps', String(FPS),
  '--count', values.count,
  '--formats', values.formats,
  '--webp-quality', values['webp-quality'],
];
if (values['webp-lossless']) args.push('--webp-lossless');
if (values['review-dir']) args.push('--review-dir', path.resolve(values['review-dir']));
if (values.width) args.push('--width', values.width);
if (values['gif-width']) args.push('--gif-width', values['gif-width']);
const result = spawnSync(process.env.PYTHON || 'python3', args, {stdio: 'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
