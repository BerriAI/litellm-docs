import fs from 'node:fs';

export const WIDTH = 1600;
export const HEIGHT = 900;
export const FPS = 25;
export const DURATION = 12;
export const POSTER_TIME = 7.2;

const C = {blue:'#4264ff', cyan:'#65d9f4', ink:'#0b1423', line:'#516888', steel:'#d5e1ef', muted:'#a1b2ca', white:'#f3f7fe'};
const asset = Object.fromEntries(['litellm','cognito','ecr'].map(name => {
  const svg=fs.readFileSync(new URL(`./assets/${name}.svg`, import.meta.url),'utf8');
  const tag=svg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/);
  return [name,{viewBox:tag[1].match(/viewBox="([^"]+)"/)[1],inner:tag[2].replace(/id="([^"]+)"/g,(_,id)=>`id="${name}-${id}"`)}];
}));
const clamp = t => Math.max(0,Math.min(1,t));
const ease = t => {t=clamp(t);return t*t*(3-2*t);};
const ramp = (t,a,b) => ease((t-a)/(b-a));
const windowed = (t,a,b,fade=.18) => ramp(t,a,a+fade)*(1-ramp(t,b-fade,b));
const pt = p => p.map(n=>n.toFixed(2)).join(',');
const points = p => p.map(pt).join(' ');
const poly = (p,fill,stroke='none',sw=1) => `<polygon points="${points(p)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const line = (p,stroke,width=1,extra='') => `<polyline points="${points(p)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const text = (x,y,value,size=24,fill=C.white,weight=500,anchor='middle',extra='') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${value}</text>`;
const rect = (x,y,w,h,fill,r=0,stroke='none',sw=1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const lerp = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
const diamond = (x,y,w,d) => [[x,y-d/2],[x+w/2,y],[x,y+d/2],[x-w/2,y]];

function slab(x,y,w,d,h,colors={},stroke='#58718e',sw=1.5) {
  const [T,R,B,L]=diamond(x,y,w,d), down=p=>[p[0],p[1]+h];
  return poly([L,B,down(B),down(L)],colors.left||'url(#metalLeft)',stroke,sw)
    +poly([B,R,down(R),down(B)],colors.right||'url(#metalRight)',stroke,sw)
    +poly([T,R,B,L],colors.top||'url(#metalTop)',stroke,sw)
    +line([L,T,R],'#e9f3ff',1.6,'opacity=".72"');
}
function faceIcon(name,x,y,size) {
  return `<g transform="matrix(.866 .5 -.866 .5 ${x} ${y})"><svg x="${-size/2}" y="${-size/2}" width="${size}" height="${size}" viewBox="${asset[name].viewBox}">${asset[name].inner}</svg></g>`;
}
function bolt(x,y,scale=1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="2" rx="5" ry="3" fill="#07101c"/><ellipse rx="5" ry="3" fill="#a5b9d1" stroke="#edf5ff" stroke-width=".6"/><path d="M-2.5 -1.2L2.5 1.2" stroke="#354d69" stroke-width="1.5"/></g>`;
}
function hardware(x,y,w,d,h) {
  const [T,R,B,L]=diamond(x,y,w,d);
  let s='';
  for(const p of [lerp(T,L,.18),lerp(T,R,.18),lerp(B,L,.18),lerp(B,R,.18)]) s+=bolt(...p);
  for(let j=0;j<7;j++){
    const a=lerp(L,B,.24+j*.065), b=[a[0],a[1]+h*.38];
    s+=line([[a[0],a[1]+h*.36],b.map((v,i)=>i?v+h*.22:v)],'#334c68',2.5);
  }
  return s;
}
function statusStrip(x,y,w,d,h,color,amount=1) {
  const [T,R,B,L]=diamond(x,y,w,d);
  const a=lerp(B,R,.16),b=lerp(B,R,.78);
  const top=[a[0],a[1]+h*.44],end=[b[0],b[1]+h*.44];
  let s=line([top,end],'#0a1c32',10)+line([[top[0],top[1]+5],[end[0],end[1]+5]],'#e2ecf7',1,'opacity=".35"');
  if(amount>0)s+=line([top,lerp(top,end,amount)],color,4)+line([top,lerp(top,end,amount)],color,12,'opacity=".12"');
  return s;
}
function depot(x,y,{name,size=260,depth=150,height=72,active=0,accent=C.blue}={}) {
  let s=`<ellipse cx="${x+10}" cy="${y+height+35}" rx="${size*.58}" ry="${depth*.40}" fill="#030915" opacity=".7" filter="url(#shadow)"/>`;
  s+=slab(x,y+height+6,size+30,depth+18,12,{top:'#1e3048',left:'#0b1729',right:'#101e33'},'#314764');
  s+=slab(x,y,size,depth,height);
  s+=slab(x,y-4,size-24,depth-14,5,{top:'url(#metalTop)',left:'#a2b4c8',right:'#6c849e'},'#91a8c1',1);
  s+=hardware(x,y-5,size-8,depth-5,height);
  if(name){
    const iconSize=name==='litellm'?142:114;
    s+=slab(x,y-11,iconSize*1.76+12,iconSize+8,6,{top:name==='litellm'?'#f2f7ff':'#cbd8e7',left:'#7f95ad',right:'#59728e'},'#566e88',1);
    s+=faceIcon(name,x,y-12,iconSize);
  }
  s+=statusStrip(x,y,size,depth,height,accent,.2+.8*active);
  return s;
}
function receiver(x,y,active) {
  let s=depot(x,y,{size:250,depth:144,height:72,active,accent:C.cyan});
  // A recessed delivery dock with a three-slat lid, rather than another logo.
  s+=slab(x,y-8,178,103,8,{top:'#192b42',left:'#6b819b',right:'#526982'},'#c2d2e5',1.4);
  for(let i=0;i<3;i++)s+=slab(x-42+i*40,y-30+i*23,75,43,14,{top:i===2&&active>.2?'#a7c5ff':'#c7d5e5',left:'#8da3bd',right:'#5a7492'},'#d6e4f3',1);
  return s;
}

const direct=[[410,450],[540,450],[620,404],[1160,404],[1215,436]];
const fillCache=[[393,497],[500,559],[660,616],[684,630]];
const cachedPull=[[920,640],[1070,563],[1215,504]];
const authRequest=[[1220,391],[1168,361],[1168,239],[952,239],[914,217]];
const credential=[[800,306],[800,344],[814,352],[814,402]];
const railPaths=[direct,fillCache,cachedPull];

function lengthPath(p) {return p.slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-p[i][0],b[1]-p[i][1]),0);}
function along(p,t) {
  let distance=clamp(t)*lengthPath(p);
  for(let i=1;i<p.length;i++){
    const len=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);
    if(distance<=len)return lerp(p[i-1],p[i],distance/len);
    distance-=len;
  }
  return p.at(-1);
}
function rail(p,color,active=0) {
  let s=line(p.map(([x,y])=>[x,y+13]),'#030a16',23,'opacity=".65"')+line(p,'#60748e',22)+line(p,'#182940',18)+line(p,'#8fa3bc',13)+line(p,'#223751',10);
  s+=line(p,color,2,`opacity="${.25+active*.7}"`);
  const len=lengthPath(p);
  for(let i=20;i<len;i+=48){const [x,y]=along(p,i/len);s+=`<circle cx="${x}" cy="${y}" r="2" fill="${active>.1?color:'#7e93ad'}" opacity=".7"/>`;}
  return s;
}
function parcel(x,y,size=40,opacity=1) {
  let s=`<g opacity="${opacity}">`;
  s+=`<ellipse cx="${x+3}" cy="${y+14}" rx="${size*.65}" ry="${size*.20}" fill="#050b17" opacity=".55"/>`;
  s+=slab(x,y-19,size,size*.58,27,{top:'#dbe8f6',left:'#8ea5c1',right:'#4e6eb4'},'#bacfe7',1.2);
  s+=poly([[x-size*.12,y-19-size*.29+size*.07],[x+size*.40,y-19-size*.06],[x+size*.13,y-19+size*.29-size*.07],[x-size*.40,y-19+size*.06]],C.blue);
  s+=line([[x,y-19+size*.29],[x,y+8]],'#9db6dc',1);
  for(let i=0;i<4;i++)s+=line([[x-size*.35+i*3,y-10+i*1.7],[x-size*.35+i*3,y-2+i*1.7]],'#27405f',1.1);
  return s+'</g>';
}
function movingParcel(p,t,start,end) {
  if(t<start||t>=end)return '';
  const u=(t-start)/(end-start),[x,y]=along(p,ease(u));
  return parcel(x,y,42,Math.min(1,u*12,(1-u)*12));
}
function pulse(p,u,color=C.cyan) {
  if(u<0||u>1)return '';
  const [x,y]=along(p,u);
  return `<circle cx="${x}" cy="${y}" r="12" fill="${color}" opacity=".12"/><circle cx="${x}" cy="${y}" r="4.8" fill="${color}"/><circle cx="${x}" cy="${y}" r="2" fill="#fff"/>`;
}
function credentialChip(t) {
  const start=1.12,end=1.96;
  if(t<start||t>end)return '';
  const [x,y]=along(credential,ease((t-start)/(end-start)));
  return `<g transform="translate(${x} ${y})"><rect x="-15" y="-10" width="30" height="20" rx="4" fill="#b2e9ed" stroke="#f5ffff" stroke-width="1.5"/><circle cx="-5" cy="0" r="3" fill="none" stroke="#167588" stroke-width="2"/><path d="M-2 0H8M5 0V4" stroke="#167588" stroke-width="2"/></g>`;
}
function gate(open) {
  let s='';
  // Two short machined bollards and a retracting access bar.
  s+=slab(814,385,45,26,48,{top:'#c6d7eb',left:'#546f91',right:'#294260'},'#8ba6c8',1);
  s+=slab(814,437,45,26,30,{top:'#c6d7eb',left:'#546f91',right:'#294260'},'#8ba6c8',1);
  const h=45*(1-open);
  if(h>.2)s+=line([[814,390],[814,390+h]],'#c1d6f2',9)+line([[814,390],[814,390+h]],open>.2?C.cyan:'#6483b4',3);
  s+=`<ellipse cx="814" cy="380" rx="7" ry="4" fill="${open>.7?C.cyan:'#7992b1'}"/>`;
  return s;
}

function background() {
  let s=rect(0,0,WIDTH,HEIGHT,'url(#background)');
  // A quiet drafting grid and a single chamfered industrial backplate.
  for(let y=42;y<900;y+=38)s+=line([[0,y],[1600,y]],'#314460',.6,'opacity=".15"');
  for(let x=20;x<1600;x+=38)s+=line([[x,0],[x,900]],'#314460',.6,'opacity=".15"');
  s+=poly([[80,70],[1520,70],[1560,110],[1560,790],[1520,830],[80,830],[40,790],[40,110]],'url(#plate)','#2b3e58',1.4);
  s+=line([[82,72],[1518,72],[1558,112]],'#6e83a0',1,'opacity=".3"');
  for(const [x,y] of [[74,105],[1526,105],[74,795],[1526,795]])s+=bolt(x,y,1.3);
  // Precision alignment marks echo the earlier routing cover.
  for(const [x,y] of [[134,188],[1466,188],[134,710],[1466,710]])s+=line([[x-9,y],[x+9,y]],'#425b7a',1)+line([[x,y-9],[x,y+9]],'#425b7a',1);
  return s;
}

export function frame(seconds) {
  const t=((seconds%DURATION)+DURATION)%DURATION;
  const reset=1-ramp(t,11.25,11.85);
  const authenticated=windowed(t,1.68,4.85,.35);
  const directActive=windowed(t,1.75,4.75,.35);
  const cacheActive=windowed(t,5.2,10.95,.35);
  const populated=ramp(t,6.55,6.95)*reset;
  const delivered=(windowed(t,3.6,4.75,.25)+windowed(t,7.7,8.6,.25)+windowed(t,9.7,10.9,.25))*reset;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><title>LiteLLM Enterprise Registry package access</title><desc>Cognito authorizes direct registry pulls. A separate AWS ECR pull-through route caches a package and serves a later pull locally.</desc><defs>
    <radialGradient id="background" cx="48%" cy="38%" r="75%"><stop stop-color="#1b2d49"/><stop offset="1" stop-color="#080e19"/></radialGradient>
    <linearGradient id="plate" x2=".2" y2="1"><stop stop-color="#17243a"/><stop offset=".6" stop-color="#111d30"/><stop offset="1" stop-color="#0d182a"/></linearGradient>
    <linearGradient id="metalTop" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0f6fd"/><stop offset=".38" stop-color="#d7e2ee"/><stop offset=".5" stop-color="#e7f0f9"/><stop offset="1" stop-color="#9eb5d0"/></linearGradient>
    <linearGradient id="metalLeft" x2="1" y2="1"><stop stop-color="#a4b8d0"/><stop offset="1" stop-color="#6c849f"/></linearGradient>
    <linearGradient id="metalRight" x2=".3" y2="1"><stop stop-color="#6985a7"/><stop offset="1" stop-color="#3a536f"/></linearGradient>
    <filter id="shadow" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="12"/></filter>
  </defs>`;
  s+=background();
  // Authentication is a thin, separate circuit. Packages never pass through Cognito.
  s+=line(authRequest,'#557b94',2,'stroke-dasharray="5 8"');
  s+=line(credential,'#557b94',2,'stroke-dasharray="5 8"');
  s+=rail(direct,C.blue,directActive);
  s+=rail(fillCache,C.cyan,windowed(t,5.2,7.1));
  s+=rail(cachedPull,C.cyan,cacheActive);
  s+=pulse(authRequest,(t-.15)/.88,C.cyan);
  s+=pulse([...direct].reverse(),(t-2.02)/.6,C.blue);
  s+=pulse([...cachedPull].reverse(),(t-4.8)/.65,C.cyan);
  s+=pulse([...fillCache].reverse(),(t-5.42)/.55,C.cyan);
  s+=pulse([...cachedPull].reverse(),(t-8.55)/.6,C.cyan);
  s+=depot(800,221,{name:'cognito',size:226,depth:130,height:47,active:windowed(t,.7,2.3),accent:C.cyan});
  s+=depot(270,450,{name:'litellm',size:280,depth:162,height:82,active:Math.max(directActive,windowed(t,5.6,6.7))});
  s+=receiver(1340,450,delivered);
  s+=depot(800,640,{name:'ecr',size:240,depth:138,height:63,active:populated,accent:C.cyan});
  // A physical cache slot retains a package after the first pull.
  s+=slab(957,698,88,51,12,{top:'#243a57',left:'#162a43',right:'#102239'},'#4b6c91',1);
  if(populated>.001)s+=parcel(957,694,43,populated);
  s+=gate(authenticated);
  s+=credentialChip(t);
  for(const start of [2.42,2.88,3.34])s+=movingParcel(direct,t,start,start+1.15);
  s+=movingParcel(fillCache,t,5.82,6.9);
  s+=movingParcel(cachedPull,t,6.98,8.08);
  s+=movingParcel(cachedPull,t,9.12,10.15);
  // Etched service captions remain readable at article width.
  s+=text(800,112,'Amazon Cognito',27,C.white,600);
  s+=text(800,145,'OAuth access',20,C.muted);
  s+=text(270,675,'LiteLLM registry',29,C.white,600);
  s+=text(270,707,'Private packages',20,C.muted);
  s+=text(1340,675,'Your deployment',29,C.white,600);
  s+=text(1340,707,'Package pulls',20,C.muted);
  s+=text(800,824,'Your Amazon ECR',27,C.white,600);
  s+=text(800,856,'Pull-through cache · IAM',20,C.muted);
  s+=text(1030,370,'DIRECT PULL',17,directActive>.1?'#a2b6ff':'#7e94b2',600,'middle','letter-spacing="2.4"');
  // Compact sequence label; no benchmarks or invented performance claims.
  const phases=[{a:0,b:2.12,n:'01',label:'AUTHORIZE',color:C.cyan},{a:2.12,b:4.7,n:'02',label:'PULL PACKAGES',color:C.blue},{a:4.7,b:8.48,n:'03',label:'IAM CACHE FILL',color:C.cyan},{a:8.48,b:11.3,n:'04',label:'PULL FROM CACHE',color:C.cyan}];
  for(const phase of phases){
    const opacity=windowed(t,phase.a,phase.b,.2);
    if(opacity>.001)s+=`<g opacity="${opacity}">${rect(108,770,36,28,'#1d3550',4,'#365778')}${text(126,790,phase.n,16,phase.color,600)}${text(158,791,phase.label,17,C.muted,500,'start','letter-spacing="1.7"')}</g>`;
  }
  return s+'</svg>';
}
