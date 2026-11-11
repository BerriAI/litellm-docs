import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {frame, WIDTH, HEIGHT, FPS, DURATION, POSTER_TIME} from './scene.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'frames');
await fs.mkdir(out,{recursive:true});
const keys=process.argv.includes('--keyframes');
if(!keys)for(const name of await fs.readdir(out)){
  if(/^\d{4}\.png$/.test(name)&&Number(name.slice(0,4))>=FPS*DURATION)await fs.unlink(path.join(out,name));
}
const times=keys?[.5,1.5,2.4,3.6,4.6,5.4,6.8,7.96]:Array.from({length:FPS*DURATION},(_,i)=>i/FPS);
for(let i=0;i<times.length;i++){
  const t=times[i];
  const filename=keys?`key-${t.toFixed(2)}.png`:`${String(i).padStart(4,'0')}.png`;
  await sharp(Buffer.from(frame(t))).png().toFile(path.join(out,filename));
  if(!keys&&i%50===0)console.log(`Rendered ${i}/${times.length}`);
}
await sharp(Buffer.from(frame(POSTER_TIME))).png().toFile(path.join(root,'..','cover.png'));
console.log(JSON.stringify({frames:times.length,width:WIDTH,height:HEIGHT,fps:FPS,duration:DURATION}));
