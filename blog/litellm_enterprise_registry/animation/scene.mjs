import fs from 'node:fs';

export const WIDTH = 1600;
export const HEIGHT = 800;
export const FPS = 25;
export const DURATION = 10;
export const POSTER_TIME = 6.2;

const C={blue:'#0117BE',cobalt:'#4055EC',cyan:'#1699C7',ink:'#243552',muted:'#64758E',paper:'#F8FAFF'};
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const ramp=(t,a,b)=>ease((t-a)/(b-a));
const windowed=(t,a,b,f=.25)=>ramp(t,a,a+f)*(1-ramp(t,b-f,b));
const mix=(a,b,u)=>a+(b-a)*u;
const rect=(x,y,w,h,fill,r=0,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const path=(d,color,width=1,opacity=1,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const label=(x,y,s)=>`<text x="${x}" y="${y}" fill="${C.muted}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600" letter-spacing="2">${s}</text>`;
const assets=Object.fromEntries(['litellm','cognito','ecr'].map(name=>{
  const svg=fs.readFileSync(new URL(`./assets/${name}.svg`,import.meta.url),'utf8');
  const tag=svg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/);
  return [name,{viewBox:tag[1].match(/viewBox="([^"]+)"/)[1],inner:tag[2]}];
}));
function icon(name,x,y,size){
  const art=assets[name].inner.replace(/id="([^"]+)"/g,(_,id)=>`id="${name}-${x}-${y}-${id}"`);
  return `<svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="${assets[name].viewBox}">${art}</svg>`;
}
function cubic(a,b,c,d,t){const u=1-t;return [0,1].map(i=>u*u*u*a[i]+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]);}
function curve(segments){
  const points=[];
  for(const segment of segments)for(let j=points.length?1:0;j<=64;j++)points.push(cubic(...segment,j/64));
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  return {points,lengths,length:lengths.at(-1),d:segments.map((p,i)=>`${i?'':`M${p[0].join(' ')} `}C${p.slice(1).map(v=>v.join(' ')).join(' ')}`).join(' ')};
}
function at(p,u){
  const n=clamp(u)*p.length;let lo=0,hi=p.lengths.length-1;
  while(lo+1<hi){const m=(lo+hi)>>1;if(p.lengths[m]<n)lo=m;else hi=m;}
  const f=(n-p.lengths[lo])/(p.lengths[hi]-p.lengths[lo]||1);
  return p.points[lo].map((v,i)=>mix(v,p.points[hi][i],f));
}
const LANES=12;
const direct=Array.from({length:LANES},(_,i)=>{
  const v=i-(LANES-1)/2;
  return curve([[[350,375+v*2],[480,375+v*2],[525,300+v*7],[740,300+v*7]],[[740,300+v*7],[980,300+v*7],[1085,375+v*2],[1320,375+v*2]]]);
});
const intoCache=Array.from({length:LANES},(_,i)=>{
  const v=i-(LANES-1)/2;
  return curve([[[350,375+v*2],[510,375+v*2],[495,630+v*5],[829,630+v*5]]]);
});
const fromCache=Array.from({length:LANES},(_,i)=>{
  const v=i-(LANES-1)/2;
  return curve([[[951,630+v*5],[1130,630+v*5],[1120,375+v*2],[1320,375+v*2]]]);
});
function cube(x,y,size,color=C.blue,fill=C.paper){
  const k=size/24;
  return `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 -12L11 -6V7L0 13L-11 7V-6Z" fill="${fill}" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>${path('M-11 -6L0 0L11 -6M0 0V13M-5.5 -9L5.5 -3',color,1.5)}</g>`;
}
function ribbons(paths,activity){
  let s='';
  for(let i=0;i<paths.length;i++)s+=path(paths[i].d,i%3===0?C.cyan:C.blue,1.2,.09+activity*.19);
  return s;
}
function parcel(p,u,size,color,major=false){
  const [x,y]=at(p,u),[tx,ty]=at(p,Math.max(0,u-.013));
  const alpha=Math.min(1,u*18,(1-u)*18);
  return `<g opacity="${alpha}">${path(`M${tx} ${ty}L${x} ${y}`,color,major?2:1.8,.25)}${major?cube(x,y,24,color):rect(x-size/2,y-size/2,size,size,color,1.3)}</g>`;
}
// These are timed package transfers, not measured throughput. The cached copy persists
// while later requests use the cache, so the story is visible without explanatory text.
function stream(paths,t,{start,slots,interval,duration,baseColor=C.blue}){
  let s='';
  for(let lane=0;lane<paths.length;lane++)for(let slot=0;slot<slots;slot++){
    const a=start+slot*interval+(lane%4)*.036;
    const u=(t-a)/duration;
    if(u<=0||u>=1)continue;
    const major=lane===5&&slot%4===1;
    const color=(lane+slot)%4===0?C.cyan:(lane%3===0?C.cobalt:baseColor);
    s+=parcel(paths[lane],u,4.5+(lane%3)*.55,color,major);
  }
  return s;
}
function request(p,t,a,duration){
  const u=(t-a)/duration;if(u<0||u>1)return '';
  const [x,y]=at(p,1-u);
  return `<circle cx="${x}" cy="${y}" r="8" fill="${C.cyan}" opacity=".12"/><circle cx="${x}" cy="${y}" r="3.3" fill="${C.cyan}"/>`;
}
function shutter(t){
  const opened=ramp(t,1.1,1.65)*(1-ramp(t,5.0,5.45));
  const fade=1-.75*windowed(t,5.45,9.95,.4);
  let s=`<g opacity="${fade}">`;
  const y=300,travel=opened*68;
  s+=rect(733,y-52-travel,14,52,C.blue,3);
  s+=rect(733,y+travel,14,52,C.blue,3);
  s+=rect(736,y-48-travel,2,42,'#7D8BF0',1);
  s+=rect(736,y+travel+4,2,42,'#7D8BF0',1);
  const lockY=220-travel*.25;
  if(opened<.65){
    s+=`<g opacity="${1-opened}">${path(`M733 ${lockY-3}V${lockY-9}a7 7 0 0 1 14 0v6`,C.ink,2.5)}${rect(729,lockY-3,22,16,C.paper,3,`stroke="${C.ink}" stroke-width="2.5"`)}</g>`;
  }else s+=path(`M758 ${lockY}l6 6 12-13`,C.cyan,3,opened);
  if(t>.55&&t<1.1){
    const yy=mix(163,205,ease((t-.55)/.55));
    s+=`<g transform="translate(740 ${yy})"><circle cx="-6" cy="0" r="5" fill="${C.paper}" stroke="${C.cyan}" stroke-width="2.5"/>${path('M-1 0H12M7 0V5',C.cyan,2.5)}</g>`;
  }
  return s+'</g>';
}
function queuedPackages(t){
  const restarting=t>9.55;
  const alpha=restarting?ramp(t,9.55,9.95):1;
  let s='';
  for(let i=0;i<3;i++){
    const u0=.35-i*.055;
    const progress=restarting?0:ease((t-1.3-i*.08)/1.55);
    if(progress>=1)continue;
    const u=mix(u0,1,progress);
    const [x,y]=at(direct[4+i],u);
    s+=`<g opacity="${alpha*Math.min(1,(1-u)*14)}">${cube(x,y,24,i===1?C.cyan:C.blue)}</g>`;
  }
  return s;
}
function destination(t){
  let s='';
  const delivered=windowed(t,2.8,5.6)+windowed(t,6.1,9.6);
  for(let i=0;i<3;i++){
    const y=338+i*37;
    s+=rect(1346,y,104,26,'none',5,`stroke="${C.blue}" stroke-width="2.2"`);
    s+=path(`M1357 ${y+13}H1409`,C.blue,1.5,.35);
    s+=`<circle cx="1434" cy="${y+13}" r="3.5" fill="${delivered>.2?C.cyan:'#A6B3D4'}"/>`;
  }
  return s;
}
export function frame(seconds){
  const t=((seconds%DURATION)+DURATION)%DURATION;
  const reset=1-ramp(t,9.55,9.95);
  const directActive=windowed(t,1.4,5.8,.4);
  const fillActive=windowed(t,3.9,6.8,.3);
  const cacheActive=windowed(t,5.4,9.65,.3);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><title>Private packages, two access paths</title><desc>OAuth access unlocks a stream from LiteLLM's ECR registry. A separate IAM path stores copies in customer ECR and serves repeated pulls from that cache. Motion is illustrative.</desc>`;
  s+=rect(0,0,WIDTH,HEIGHT,C.paper);
  s+=ribbons(direct,directActive)+ribbons(intoCache,fillActive)+ribbons(fromCache,cacheActive);
  // Alignment marks echo the engineering covers without adding UI or label clutter.
  for(const [x,y] of [[116,155],[1468,155],[116,683],[1468,683]])s+=path(`M${x-5} ${y}H${x+5}M${x} ${y-5}V${y+5}`,C.blue,1,.2);
  s+=icon('litellm',190,375,104)+icon('ecr',296,375,80);
  s+=icon('cognito',740,115,72)+label(800,124,'OAuth');
  s+=icon('ecr',890,630,92)+label(958,718,'IAM');
  s+=path('M740 161V194',C.cyan,1.5,.28,'stroke-dasharray="3 6"');
  s+=destination(t);
  s+=request(direct[5],t,.12,.8);
  s+=request(fromCache[5],t,3.4,.55)+request(intoCache[5],t,3.95,.5);
  s+=request(fromCache[5],t,7.3,.55);
  s+=stream(direct,t,{start:1.65,slots:14,interval:.15,duration:1.85});
  s+=stream(intoCache,t,{start:4.15,slots:10,interval:.13,duration:1.3});
  s+=stream(fromCache,t,{start:5.65,slots:18,interval:.15,duration:1.25});
  s+=queuedPackages(t);
  // Three copies visibly remain beside ECR during repeated downstream pulls.
  for(let i=0;i<3;i++){
    const alpha=ramp(t,5.4+i*.16,5.65+i*.16)*reset;
    s+=`<g opacity="${alpha}">${cube(859+i*31,708,22,i===1?C.cyan:C.blue)}</g>`;
  }
  s+=shutter(t);
  return s+'</svg>';
}
