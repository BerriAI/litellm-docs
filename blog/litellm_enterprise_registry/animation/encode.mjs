import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FPS} from './scene.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const input=path.join(root,'frames','%04d.png');
const palette=path.join(root,'palette.png');
const output=path.join(root,'..','cover.gif');
function run(args){
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','warning','-y',...args],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
run(['-framerate',String(FPS),'-i',input,'-vf','palettegen=max_colors=256:stats_mode=full','-frames:v','1','-update','1',palette]);
run(['-framerate',String(FPS),'-i',input,'-i',palette,'-lavfi','paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-loop','0','-final_delay',String(100/FPS),output]);
console.log(output);
