import fs from 'node:fs';

export const WIDTH = 1440;
export const HEIGHT = 820;
export const DURATION = 8;
export const FPS = 25;
const c = { ink:'#3657F5', light:'#F2F7FF', top:'#EAF3FF', left:'#D8E7FF', right:'#BDD3FF', wire:'#8CB6FF', grid:'#C4D9FF', blue:'#4055FF', cyan:'#13A5E9', white:'#FFFFFF' };
const assets = {};
for (const name of ['claude-code', 'codex', 'kubernetes', 'litellm', 'vllm']) {
  let svg = fs.readFileSync(new URL(`./assets/${name}.svg`, import.meta.url), 'utf8');
  if (name === 'codex') svg = svg.replace('url(#codex-gradient)', '#6C7EFF').replace(/<defs>[\s\S]*?<\/defs>/, '');
  const tag = svg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/);
  assets[name] = { viewBox: tag[1].match(/viewBox="([^"]+)"/)[1], inner: tag[2], namespaces: (tag[1].match(/xmlns(?::[^=\s]+)?="[^"]+"/g)||[]).join(' ') };
}
const pt = p => p.map(v=>v.toFixed(2)).join(',');
const poly = (points, fill, stroke=c.ink, width=2) => `<polygon points="${points.map(pt).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const line = (points, color=c.wire, width=2, dash='') => `<polyline points="${points.map(pt).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash?` stroke-dasharray="${dash}"`:''}/>`;
const lerp = (a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function diamond(x,y,w,d) { return [[x,y-d/2],[x+w/2,y],[x,y+d/2],[x-w/2,y]]; }
function slab(x,y,w,d,h, colors={}, stroke=c.ink, width=2) {
  const [T,R,B,L]=diamond(x,y,w,d), drop=p=>[p[0],p[1]+h];
  return poly([L,B,drop(B),drop(L)],colors.left||c.left,stroke,width)
    +poly([B,R,drop(R),drop(B)],colors.right||c.right,stroke,width)
    +poly([T,R,B,L],colors.top||c.top,stroke,width);
}
function hexagon(x,y,w,d) {
  return [[x-w/2,y],[x-w/4,y-d/2],[x+w/4,y-d/2],[x+w/2,y],[x+w/4,y+d/2],[x-w/4,y+d/2]];
}
function hexPrism(x,y,w,d,h,colors={},stroke=c.ink,width=2) {
  const p=hexagon(x,y,w,d),drop=q=>[q[0],q[1]+h];
  return poly([p[0],p[5],drop(p[5]),drop(p[0])],colors.left||c.left,stroke,width)
    +poly([p[5],p[4],drop(p[4]),drop(p[5])],colors.front||c.left,stroke,width)
    +poly([p[4],p[3],drop(p[3]),drop(p[4])],colors.right||c.right,stroke,width)
    +poly(p,colors.top||c.top,stroke,width);
}
let iconNumber = 0;
const img = (name,x,y,size)=>{
  const prefix=`icon-${iconNumber++}-`;
  let body=assets[name].inner.replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}${id})`).replace(/xlink:href="#([^"]+)"/g,(_,id)=>`xlink:href="#${prefix}${id}"`);
  return `<svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="${assets[name].viewBox}" ${assets[name].namespaces}>${body}</svg>`;
};
const topIcon = (name,x,y,size)=>`<g transform="matrix(.866 .5 -.866 .5 ${x} ${y})">${img(name,0,0,size)}</g>`;
function cross(x,y,s=9,color=c.wire) {return line([[x-s,y],[x+s,y]],color,1.8)+line([[x,y-s],[x,y+s]],color,1.8);}
function along(points,t) {
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  let distance=Math.max(0,Math.min(1,t))*lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<lengths.length;i++){if(distance<=lengths[i])return lerp(points[i],points[i+1],distance/lengths[i]);distance-=lengths[i];}
  return points.at(-1);
}
function cube(x,y,color,size=14) {
  return slab(x,y,size,size*.58,size*.5,{top:color,left:color,right:c.white},color,1.6);
}
function packet(points,progress,color) {
  let out='';
  for(let j=2;j>=0;j--){const u=progress-j*.038;if(u<0||u>1)continue;const [x,y]=along(points,u);out+=cube(x,y-5,color,14);}
  return out;
}
function cacheSlots(x,y,w,d,h,color,active) {
  const B=[x+w/4,y+d/2], R=[x+w/2,y];
  let out='';
  for(let i=0;i<3;i++){
    const a=lerp(B,R,.18+i*.235),b=lerp(B,R,.34+i*.235);
    a[1]+=h*.30;b[1]+=h*.30;
    out+=poly([a,b,[b[0],b[1]+h*.32],[a[0],a[1]+h*.32]],active&&i===active-1?c.white:color,color,1.4);
  }
  return out;
}
function pod(x,y,selected,color,hit) {
  const w=164,d=94,h=66;
  let out=hexPrism(x,y,w,d,h,{top: selected?'#F5F9FF':c.top,left:c.left,front:'#DFEBFF',right: selected?'#CAE0FF':c.right},selected?color:c.ink,selected?2.8:2);
  out+=topIcon('vllm',x,y-4,82);
  out+=cacheSlots(x,y,w,d,h,selected?color:'#95ADE8',hit);
  if(hit){out+=poly(hexagon(x,y,w+12,d+8),'none',color,3.3);}
  return out;
}
const inputs={
  a:[[266,282],[315,282],[355,305],[355,390],[410,422]],
  b:[[266,560],[315,560],[355,536],[355,454],[410,422]],
};
const outputs={
  a:[[630,422],[688,422],[745,455],[818,455],[818,505],[900,552],[958,569]],
  b:[[630,422],[694,422],[763,382],[798,382],[798,427],[843,453]],
};
const events=[{s:0,k:'a'},{s:2.5,k:'a'},{s:5,k:'a'},{s:1.25,k:'b'},{s:3.75,k:'b'},{s:6.25,k:'b'}];
function states(t){
  const all=events.map(e=>({...e,age:(t-e.s+DURATION)%DURATION}));
  return {all, gateway:all.some(e=>e.age>=.80&&e.age<1.08), a:all.find(e=>e.k==='a'&&e.age>=2.22&&e.age<2.82), b:all.find(e=>e.k==='b'&&e.age>=2.22&&e.age<2.82)};
}
export function frame(time) {
  iconNumber = 0;
  const t=((time%DURATION)+DURATION)%DURATION, st=states(t);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><title>Cache-aware routing through LiteLLM</title><desc>Claude Code and Codex requests pass through the LiteLLM gateway to Kubernetes inference pods running vLLM. Repeated blue requests return to the same pod and its cache; cyan requests return to a second pod.</desc>`;
  // Sparse drafting marks, all opaque flat colors on a transparent canvas.
  s+=cross(83,155,12)+cross(1362,704,12);
  for(let r=0;r<3;r++)for(let q=0;q<5;q++)s+=`<circle cx="${89+q*23}" cy="${671+r*21}" r="1.6" fill="#ACC9FF"/>`;
  // Kubernetes volume: far edges sit behind all resources.
  const platform={x:1050,y:505,width:648,depth:390};
  const top=diamond(platform.x,270,platform.width,platform.depth),base=diamond(platform.x,platform.y,platform.width,platform.depth);
  s+=line([top[3],top[0],top[1]],c.wire,1.7,'2 8');
  s+=line([top[3],base[3]],c.wire,1.7,'2 8')+line([top[1],base[1]],c.wire,1.7,'2 8');
  s+=cross(...top[0],7)+cross(...top[3],7)+cross(...top[1],7);
  s+=slab(platform.x,platform.y,platform.width,platform.depth,25,{top:'#F0F6FF',left:'#DCEAFF',right:'#BCD4FF'},'#6E97FF',1.8);
  for(let u of [.25,.5,.75]){s+=line([lerp(base[0],base[1],u),lerp(base[3],base[2],u)],c.grid,1);s+=line([lerp(base[0],base[3],u),lerp(base[1],base[2],u)],c.grid,1);}
  // Discovery badge floating above the cluster, with no wordmark.
  s+=line([[1050,278],[1050,304]],c.wire,1.8,'3 7');
  s+=hexPrism(1050,228,140,81,15,{top:'#EEF5FF',left:'#D7E7FF',right:'#BDD5FF'},c.ink,1.8);
  s+=topIcon('kubernetes',1050,226,76);
  // Route guides and lightly dashed unselected deployment branch.
  s+=line(inputs.a,c.blue,2.4)+line(inputs.b,c.cyan,2.4);
  s+=line(outputs.a,c.blue,2.4)+line(outputs.b,c.cyan,2.4);
  s+=line([[688,422],[744,389],[844,332],[1064,332],[1064,410]],'#A3B9E8',1.7,'4 8');
  // The LiteLLM gateway remains a rectangular block with only its train icon.
  s+=slab(182,272,168,97,20,{top:'#F4F8FF',left:'#DFEAFF',right:'#BFD4FF'},c.ink,2);
  s+=topIcon('claude-code',182,269,79);
  s+=slab(182,550,168,97,20,{top:'#F4F8FF',left:'#DFEAFF',right:'#BFD4FF'},c.ink,2);
  s+=topIcon('codex',182,547,84);
  s+=slab(520,395,220,127,54,{top:'#ECF4FF',left:'#D1E2FF',right:'#AFCBFF'},c.ink,st.gateway?3.5:2.3);
  s+=topIcon('litellm',520,390,100);
  // Back pods first, then the front pod, for coherent occlusion.
  const hitB=st.b?1+Math.min(2,Math.floor((st.b.age-2.22)*5)):0;
  const hitA=st.a?1+Math.min(2,Math.floor((st.a.age-2.22)*5)):0;
  s+=pod(1146,410,false,c.blue,0);
  s+=pod(925,420,true,c.cyan,hitB);
  s+=pod(1040,536,true,c.blue,hitA);
  // Moving prefix tokens: each harness keeps the same route on every request.
  for(const e of st.all){const color=e.k==='a'?c.blue:c.cyan;
    if(e.age<.8)s+=packet(inputs[e.k],e.age/.8,color);
    if(e.age>=1.04&&e.age<2.32)s+=packet(outputs[e.k],(e.age-1.04)/1.18,color);
  }
  s+=cross(...base[1],7)+cross(...base[2],7);
  return s+'</svg>';
}
