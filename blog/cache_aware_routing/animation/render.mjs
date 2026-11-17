import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {frame,FPS,DURATION,WIDTH,HEIGHT} from './scene.mjs';

const root=path.dirname(new URL(import.meta.url).pathname);
const frames=path.join(root,'frames');
await fs.mkdir(frames,{recursive:true});
const times=process.argv.includes('--keyframes')?[0,.4,1.6,2.45,4.1,6.7]:Array.from({length:FPS*DURATION},(_,i)=>i/FPS);
for(let j=0;j<times.length;j++){
  const t=times[j], svg=frame(t), filename=process.argv.includes('--keyframes')?`key-${t.toFixed(2)}.png`:`${String(j).padStart(4,'0')}.png`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(frames,filename));
}
await fs.writeFile(path.join(root,'poster.svg'),frame(1.6));
console.log(JSON.stringify({frames:times.length,width:WIDTH,height:HEIGHT,fps:FPS,duration:DURATION,output:frames}));
