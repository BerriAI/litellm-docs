import fs from 'node:fs';

export const WIDTH = 1600;
export const HEIGHT = 800;
export const FPS = 25;
export const DURATION = 8;
export const POSTER_TIME = 3.6;

const C={blue:'#0117BE',cyan:'#159BC6',ink:'#233451',muted:'#61708C',paper:'#F8FAFF'};
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const mix=(a,b,u)=>a+(b-a)*u;
const rect=(x,y,w,h,fill,r=0,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const path=(d,color,width=1,opacity=1,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const label=(x,y,s)=>`<text x="${x}" y="${y}" fill="${C.ink}" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="600" text-anchor="middle">${s}</text>`;
const assets=Object.fromEntries(['litellm','cognito','ecr'].map(name=>{
  const svg=fs.readFileSync(new URL(`./assets/${name}.svg`,import.meta.url),'utf8');
  const tag=svg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/);
  return [name,{viewBox:tag[1].match(/viewBox="([^"]+)"/)[1],inner:tag[2]}];
}));
function icon(name,x,y,size){
  const art=assets[name].inner.replace(/id="([^"]+)"/g,(_,id)=>`id="${name}-${x}-${y}-${id}"`);
  return `<svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="${assets[name].viewBox}">${art}</svg>`;
}
const START=[435,281],END=[1017,552];
const BEAM=`M${START.join(' ')}L${END.join(' ')}`;
const point=u=>START.map((n,i)=>mix(n,END[i],u));
const PODS=[
  [1115,460],[1217,460],[1319,460],
  [1064,552],[1166,552],[1268,552],[1370,552],
  [1115,644],[1217,644],[1319,644],
];
function hex(x,y){return `M${x} ${y-52}L${x+45} ${y-26}V${y+26}L${x} ${y+52}L${x-45} ${y+26}V${y-26}Z`;}
function pod(x,y,index,received){
  const target=index===3;
  const active=target?received:0;
  let s=`<path d="${hex(x,y)}" fill="${index%3===0?'#EEF2FF':'#F4F6FC'}" stroke="#A7B4E1" stroke-width="1.5"/>`;
  if(active>.001)s+=`<path d="${hex(x,y)}" fill="#E4ECFF" stroke="${C.blue}" stroke-width="2.8" opacity="${active}"/>`;
  // A compact gateway/container symbol. No brand mark is enclosed in a pod.
  s+=rect(x-21,y-23,42,42,'none',5,`stroke="${C.blue}" stroke-width="1.8"`);
  s+=path(`M${x-28} ${y-8}H${x-14}M${x+14} ${y-8}H${x+28}M${x-28} ${y+5}H${x-14}M${x+14} ${y+5}H${x+28}`,C.blue,1.8,.7);
  s+=path(`M${x-6} ${y-10}L${x+6} ${y-2}L${x-6} ${y+6}`,C.blue,2.2);
  for(let i=0;i<3;i++)s+=rect(x-11+i*9,y+30,5,3,index%3===i?'#7A91DB':'#C1CDED',1);
  if(target){
    s+=`<circle cx="${x-45}" cy="${y}" r="4" fill="${C.paper}" stroke="${C.blue}" stroke-width="1.5"/>`;
    if(active>.001)s+=`<g opacity="${active}">${path(`M${x+21} ${y-29}l5 5 9-11`,C.cyan,2.5)}</g>`;
  }
  return s;
}
function registry(t){
  let s=icon('litellm',220,236,104)+icon('ecr',360,236,112);
  s+=path('M282 236H294',C.blue,2,.2);
  s+=icon('cognito',360,120,58);
  s+=path('M360 156V174',C.cyan,1.5,.4);
  // A quiet authorization acknowledgement precedes the single image pull.
  const access=ramp(t,.45,1.05)*(1-ramp(t,6.8,7.5));
  s+=`<g opacity="${access}">${path('M398 157l5 5 10-12',C.cyan,2.5)}</g>`;
  s+=label(290,342,'Enterprise Registry');
  return s;
}
function beam(t){
  const u=(t-1.4)/3.2;
  const visible=u>0&&u<1;
  let s=path(BEAM,C.blue,22,.035)+path(BEAM,C.blue,2,.18);
  if(visible){
    const alpha=Math.min(1,u*7,(1-u)*7);
    const p0=point(Math.max(0,u-.14)),p1=point(Math.min(1,u+.14));
    const d=`M${p0.join(' ')}L${p1.join(' ')}`;
    s+=`<defs><linearGradient id="pull-pulse" gradientUnits="userSpaceOnUse" x1="${p0[0]}" y1="${p0[1]}" x2="${p1[0]}" y2="${p1[1]}"><stop stop-color="${C.blue}" stop-opacity="0"/><stop offset=".4" stop-color="${C.blue}"/><stop offset=".65" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient></defs>`;
    s+=`<g opacity="${alpha}">${path(d,'url(#pull-pulse)',30,.25,'filter="url(#beam-softness)"')}${path(d,'url(#pull-pulse)',9,.9)}${path(d,'url(#pull-pulse)',2,1)}</g>`;
  }
  return s;
}
export function frame(seconds){
  const t=((seconds%DURATION)+DURATION)%DURATION;
  const received=ramp(t,4.35,4.85)*(1-ramp(t,6.65,7.5));
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><title>Pulling an image from the LiteLLM Enterprise Registry</title><desc>A single pulsing beam connects the ECR registry in the upper left to one gateway pod in the customer's deployment mosaic in the lower right. Cognito represents OAuth access.</desc><defs><filter id="beam-softness" x="-30%" y="-50%" width="160%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>`;
  s+=rect(0,0,WIDTH,HEIGHT,C.paper);
  // Stable geometry and one pulse per loop represent an image pull, not traffic volume.
  for(const [x,y] of [[112,110],[1485,110],[112,710],[1485,710]])s+=path(`M${x-5} ${y}H${x+5}M${x} ${y-5}V${y+5}`,C.blue,1,.16);
  s+=beam(t)+registry(t);
  for(let i=0;i<PODS.length;i++)s+=pod(...PODS[i],i,received);
  // Customer branding sits beside the mosaic, never inside a service card.
  s+=icon('litellm',1084,740,30);
  s+=label(1225,750,'Your deployment');
  return s+'</svg>';
}
