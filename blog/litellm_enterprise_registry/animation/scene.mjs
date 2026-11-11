import fs from 'node:fs';

export const WIDTH = 1600;
export const HEIGHT = 900;
export const FPS = 25;
export const DURATION = 12;
export const POSTER_TIME = 7.2;

const C={blue:'#3657F5',ink:'#18233B',muted:'#63718A',line:'#CED7E7',cyan:'#16869B',surface:'#F7F9FD'};
const asset=Object.fromEntries(['litellm','cognito','ecr'].map(name=>{
  const svg=fs.readFileSync(new URL(`./assets/${name}.svg`,import.meta.url),'utf8');
  const tag=svg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/);
  return [name,{viewBox:tag[1].match(/viewBox="([^"]+)"/)[1],inner:tag[2].replace(/id="([^"]+)"/g,(_,id)=>`id="${name}-${id}"`)}];
}));
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const windowed=(t,a,b,fade=.2)=>ramp(t,a,a+fade)*(1-ramp(t,b-fade,b));
const rect=(x,y,w,h,fill,r=0,stroke='none',sw=1,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const text=(x,y,value,size=26,fill=C.ink,weight=500)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${value}</text>`;
const path=(d,color,width=3,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const line=(p,color,width=3,extra='')=>path('M'+p.map(v=>v.join(',')).join(' L'),color,width,extra);
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const icon=(name,x,y,size)=>`<svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="${asset[name].viewBox}">${asset[name].inner}</svg>`;
const direct=[[400,428],[1200,428]];
const cacheIn=[[260,536],[260,630],[288,658],[660,658]];
const cacheOut=[[940,658],[1312,658],[1340,630],[1340,536]];
const authRequest=[[1340,320],[1340,213],[1312,185],[930,185]];
const credential=[[800,290],[800,386]];
function along(p,u){
  const lengths=p.slice(1).map((b,i)=>Math.hypot(b[0]-p[i][0],b[1]-p[i][1]));
  let n=clamp(u)*lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<lengths.length;i++){if(n<=lengths[i])return lerp(p[i],p[i+1],n/lengths[i]);n-=lengths[i];}
  return p.at(-1);
}
function route(d,color,active=0){
  return path(d,C.line,3.5)+path(d,color,3.5,`opacity="${active}"`);
}
function check(x,y,color=C.blue,size=1){return `<g transform="translate(${x} ${y}) scale(${size})">${path('M-8 0 L-2 6 L9 -7',color,3)}</g>`;}
function service({x,y,w=280,h=216,name,title,subtitle,active=0,badge=0}){
  let s=rect(x-w/2,y,w,h,'#FFFFFF',24,'#E0E6F0',1.5,'filter="url(#elevation)"');
  if(active>.001)s+=rect(x-w/2,y,w,h,'none',24,C.blue,2.5,`opacity="${active}"`);
  if(name)s+=icon(name,x,y+70,name==='litellm'?104:88);
  else {
    s+=rect(x-44,y+31,88,68,'#EEF2FF',15);
    s+=rect(x-28,y+47,56,16,'#FFFFFF',4,'#6E85EC',2);
    s+=rect(x-28,y+71,56,16,'#FFFFFF',4,'#6E85EC',2);
    s+=`<circle cx="${x+16}" cy="${y+55}" r="2.8" fill="${C.blue}"/><circle cx="${x+16}" cy="${y+79}" r="2.8" fill="${C.blue}"/>`;
  }
  s+=text(x,y+151,title,28,C.ink,600);
  if(subtitle)s+=text(x,y+183,subtitle,22,C.muted);
  if(badge>.001)s+=`<g opacity="${badge}">${rect(x+w/2-50,y+12,34,34,'#EAF0FF',10)}${packageGlyph(x+w/2-33,y+29,16,C.blue)}</g>`;
  return s;
}
function packageGlyph(x,y,size=20,color='#FFF'){
  const k=size/20;
  return `<g transform="translate(${x} ${y}) scale(${k})">${path('M-9 -5 L0 -10 L9 -5 L9 6 L0 11 L-9 6 Z M-9 -5 L0 0 L9 -5 M0 0 V11 M-4.5 -7.5 L4.5 -2.5',color,1.8)}</g>`;
}
function parcel(x,y,opacity=1){
  return `<g opacity="${opacity}">${rect(x-20,y-20,40,40,C.blue,11,'#FFF',2)}${packageGlyph(x,y,22)}</g>`;
}
function movingParcel(p,t,a,b){
  if(t<a||t>=b)return '';
  const u=(t-a)/(b-a),[x,y]=along(p,ease(u));
  return parcel(x,y,Math.min(1,u*12,(1-u)*12));
}
function pulse(p,u,color=C.blue){
  if(u<0||u>1)return '';
  const [x,y]=along(p,u);
  return `<circle cx="${x}" cy="${y}" r="11" fill="${color}" opacity=".1"/><circle cx="${x}" cy="${y}" r="4.5" fill="${color}"/>`;
}
function credentialChip(t){
  if(t<1.12||t>1.96)return '';
  const [x,y]=along(credential,ease((t-1.12)/.84));
  return `<g transform="translate(${x} ${y})">${rect(-21,-14,42,28,'#E5F5F7',9,C.cyan,1.5)}<circle cx="-6" cy="0" r="4" fill="none" stroke="${C.cyan}" stroke-width="2"/>${path('M-2 0H10M6 0V4',C.cyan,2)}</g>`;
}
function access(open){
  const y=428-42*open;
  let s=`<circle cx="800" cy="${y}" r="19" fill="${open>.7?'#E5F5F7':C.surface}" stroke="${open>.7?C.cyan:'#B9C6DA'}" stroke-width="1.5"/>`;
  if(open>.7)s+=check(800,y,C.cyan,.9);
  else s+=`<g transform="translate(800 ${y})">${rect(-7,-2,14,11,'none',2,'#8191AA',2)}${path('M-4 -2V-6a4 4 0 0 1 8 0v4','#8191AA',2)}</g>`;
  return s;
}
export function frame(seconds){
  const t=((seconds%DURATION)+DURATION)%DURATION;
  const reset=1-ramp(t,11.25,11.85);
  const authenticated=windowed(t,1.68,4.85,.35);
  const directActive=windowed(t,1.75,4.75,.35);
  const cacheActive=windowed(t,5.2,10.95,.35);
  const populated=ramp(t,6.55,6.95)*reset;
  const delivered=(windowed(t,3.6,4.75,.25)+windowed(t,7.7,8.6,.25)+windowed(t,9.7,10.9,.25))*reset;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><title>LiteLLM Enterprise Registry access and package pulls</title><desc>A direct OAuth access path through Cognito and a separate AWS IAM path through an ECR pull-through cache.</desc><defs><filter id="elevation" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#34466C" flood-opacity=".07"/></filter></defs>`;
  s+=rect(0,0,WIDTH,HEIGHT,C.surface);
  s+=route('M400 428H1200',C.blue,directActive);
  s+=route('M260 536V630Q260 658 288 658H660',C.blue,windowed(t,5.2,7.1));
  s+=route('M940 658H1312Q1340 658 1340 630V536',C.blue,cacheActive);
  s+=path('M1340 320V213Q1340 185 1312 185H930','#A5C5D0',2,'stroke-dasharray="5 9"');
  s+=line([[800,290],[800,409]],'#A5C5D0',2,'stroke-dasharray="5 9"');
  s+=text(1037,395,'Direct pull',22,C.muted);
  s+=pulse(authRequest,(t-.15)/.88,C.cyan);
  s+=pulse([...direct].reverse(),(t-2.02)/.6);
  s+=pulse([...cacheOut].reverse(),(t-4.8)/.65);
  s+=pulse([...cacheIn].reverse(),(t-5.42)/.55);
  s+=pulse([...cacheOut].reverse(),(t-8.55)/.6);
  s+=service({x:260,y:320,name:'litellm',title:'LiteLLM',subtitle:'Enterprise Registry',active:Math.max(directActive,windowed(t,5.6,6.7))});
  s+=service({x:800,y:80,w:260,h:210,name:'cognito',title:'Amazon Cognito',subtitle:'OAuth access',active:windowed(t,.7,2.3)});
  s+=service({x:1340,y:320,title:'Your deployment',subtitle:'Package pulls',active:delivered});
  s+=service({x:800,y:550,name:'ecr',title:'Your Amazon ECR',subtitle:'Pull-through cache · IAM',active:cacheActive,badge:populated});
  s+=access(authenticated);
  s+=credentialChip(t);
  for(const a of [2.42,2.88,3.34])s+=movingParcel(direct,t,a,a+1.15);
  s+=movingParcel(cacheIn,t,5.82,6.9);
  s+=movingParcel(cacheOut,t,6.98,8.08);
  s+=movingParcel(cacheOut,t,9.12,10.15);
  for(const p of [
    {a:0,b:2.12,label:'OAuth · Authorize access'},
    {a:2.12,b:4.7,label:'OAuth · Pull packages'},
    {a:4.7,b:8.48,label:'IAM · Fill your cache'},
    {a:8.48,b:11.3,label:'IAM · Pull from cache'},
  ]){const opacity=windowed(t,p.a,p.b,.2);if(opacity>.001)s+=`<g opacity="${opacity}">${text(800,849,p.label,24,C.muted)}</g>`;}
  return s+'</svg>';
}
