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
const times=keys?[0,1.5,2.4,3.6,4.7,5.8,7.2,9.96]:Array.from({length:FPS*DURATION},(_,i)=>i/FPS);
let next=0,completed=0;
await Promise.all(Array.from({length:4},async()=>{
  while(next<times.length){
    const i=next++,t=times[i];
    const filename=keys?`key-${t.toFixed(2)}.png`:`${String(i).padStart(4,'0')}.png`;
    await sharp(Buffer.from(frame(t))).png({compressionLevel:3}).toFile(path.join(out,filename));
    completed++;
    if(!keys&&completed%50===0)console.log(`Rendered ${completed}/${times.length}`);
  }
}));
await sharp(Buffer.from(frame(POSTER_TIME))).png().toFile(path.join(root,'..','cover.png'));
console.log(JSON.stringify({frames:times.length,width:WIDTH,height:HEIGHT,fps:FPS,duration:DURATION}));
