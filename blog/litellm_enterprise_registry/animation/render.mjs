import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {frame, state, drawLight, WIDTH, HEIGHT, FPS, DURATION, POSTER_TIME} from './scene.mjs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');

const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'frames');
await fs.mkdir(out,{recursive:true});
const keys=process.argv.includes('--keyframes');
if(!keys)for(const name of await fs.readdir(out)){
  if(/^\d{4}\.png$/.test(name)&&Number(name.slice(0,4))>=FPS*DURATION)await fs.unlink(path.join(out,name));
}
const times=keys?[0,1.5,2.8,4,5.2,6.8,8.5,11,15.96]:Array.from({length:FPS*DURATION},(_,i)=>i/FPS);
async function render(t,filename){
  const current=state(t),canvas=createCanvas(WIDTH,HEIGHT),context=canvas.getContext('2d');
  drawLight(context,current,WIDTH,HEIGHT,createCanvas);
  const glass=await loadImage(Buffer.from(frame(t,'registry',{includeRays:false,currentState:current})));
  context.drawImage(glass,0,0);
  await fs.writeFile(filename,await canvas.encode('png'));
}
let next=0,completed=0;
await Promise.all(Array.from({length:4},async()=>{
  while(next<times.length){
    const i=next++,t=times[i];
    const filename=keys?`key-${t.toFixed(2)}.png`:`${String(i).padStart(4,'0')}.png`;
    await render(t,path.join(out,filename));
    completed++;
    if(!keys&&completed%50===0)console.log(`Rendered ${completed}/${times.length}`);
  }
}));
await render(POSTER_TIME,path.join(root,'..','cover.png'));
console.log(JSON.stringify({frames:times.length,width:WIDTH,height:HEIGHT,fps:FPS,duration:DURATION}));
