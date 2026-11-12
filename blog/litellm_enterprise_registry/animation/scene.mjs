export {drawLight} from './raster.mjs';
import {buildTransport} from './optics.mjs';

export const WIDTH=1600, HEIGHT=800, FPS=25, DURATION=16, POSTER_TIME=6.8;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const ramp=(x,a,b)=>ease((x-a)/(b-a));
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const n=x=>Number(x.toFixed(3));
export const PODS=[];
for(let row=0;row<28;row++)for(let col=0;col<49;col++){
  const seed=row*49+col;
  const x=180+col*31+(row%2)*15.5+(hash(seed+19)-.5)*5;
  const y=38+row*29+(hash(seed+27)-.5)*5;
  const depth=clamp(y/HEIGHT),center=1280-145*depth+30*Math.sin(depth*7);
  const spread=92+665*depth**1.45,distance=Math.abs((x-center)/spread);
  const envelope=Math.exp(-(distance**3.1));
  const pockets=.84+.12*Math.sin(col*.38+row*.22)+.08*Math.cos(row*.41-col*.17);
  if(hash(seed+73)>(.24+.77*depth)*envelope*pockets)continue;
  // Non-overlapping circular sections are shared by optics and material rendering.
  PODS.push({x,y,r:11.2+hash(seed+11)*2.65,seed});
}
// Fit the entire organic field inside the image, including each bead's glow.
// A uniform scale keeps the glass circles separate and preserves the layout.
const EDGE_PADDING=56;
const minX=Math.min(...PODS.map(p=>p.x)),maxX=Math.max(...PODS.map(p=>p.x));
const minY=Math.min(...PODS.map(p=>p.y)),maxY=Math.max(...PODS.map(p=>p.y));
const fieldScale=Math.min(1,(WIDTH-2*EDGE_PADDING)/(maxX-minX),(HEIGHT-2*EDGE_PADDING)/(maxY-minY));
for(const p of PODS){
  p.x=WIDTH-EDGE_PADDING-(maxX-p.x)*fieldScale;
  p.y=HEIGHT-EDGE_PADDING-(maxY-p.y)*fieldScale;
  p.r*=fieldScale;
}
export const SOURCE={x:8,y:8};
export const TRANSPORT=buildTransport(PODS,SOURCE,{x:8+1000*Math.cos(.635),y:8+1000*Math.sin(.635)},{
  rayCount:4096,beamWidth:0,angularWidth:2.4,angularSigma:.4,
  // 4100 scene units cover the entire 16-second pulse window, including its tail.
  maxSegments:2000000,maxBounces:128,splitDepth:2,maxDistance:4100,maxOpticalDistance:4100,minEnergy:1e-8,
  roughness:.28,absorption:.0015,mirrorBounds:true,bounds:{minX:0,minY:0,maxX:WIDTH,maxY:HEIGHT},
});
// Optical path is slowed for visibility. This is not a physical seconds-per-meter scale.
const SPEED=245, PULSE_CENTER=1.15, PULSE_SIGMA=.38, LIFETIME=2.4;
const events=PODS.map(()=>[]);
for(const event of TRANSPORT.events)events[event.beadIndex].push(event);
const rayExposure=125;
const gaussian=x=>Math.exp(-x*x/2);
const erf=x=>{
  const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);
  return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a));
};
const cdf=x=>(1+erf(x/Math.SQRT2))/2;
const pulseNorm=cdf(3)-cdf(-3);
function charge(age){
  if(age<=-3*PULSE_SIGMA)return 0;
  const shift=PULSE_SIGMA*PULSE_SIGMA/LIFETIME;
  return Math.exp(-age/LIFETIME+PULSE_SIGMA*PULSE_SIGMA/(2*LIFETIME*LIFETIME))
    *(cdf((Math.min(age,3*PULSE_SIGMA)-shift)/PULSE_SIGMA)-cdf((-3*PULSE_SIGMA-shift)/PULSE_SIGMA))/pulseNorm;
}
export function state(seconds){
  const t=((seconds%DURATION)+DURATION)%DURATION;
  const center=(t-PULSE_CENTER)*SPEED,sigma=PULSE_SIGMA*SPEED;
  return {

    rays:TRANSPORT.segments.flatMap(ray=>{
      const extent=ray.opticalEnd-ray.opticalStart;
      const localCenter=center;
      if(localCenter+3*sigma<=ray.opticalStart||localCenter-3*sigma>=ray.opticalEnd)return [];
      const start=clamp((localCenter-3*sigma-ray.opticalStart)/extent);
      const end=clamp((localCenter+3*sigma-ray.opticalStart)/extent);
      const g1=(localCenter-3*sigma-ray.opticalStart)/extent,g2=(localCenter+3*sigma-ray.opticalStart)/extent;
      const dx=ray.x2-ray.x1,dy=ray.y2-ray.y1;
      return [{start,span:Math.max(0,end-start),alpha:end>start?Math.min(.7,ray.energy*rayExposure):0,
        energy:ray.energy*(1-ramp(t,14,16)),diffuse:ray.kind!=='incident',x1:ray.x1,y1:ray.y1,x2:ray.x2,y2:ray.y2,
        gx1:ray.x1+dx*g1,gy1:ray.y1+dy*g1,gx2:ray.x1+dx*g2,gy2:ray.y1+dy*g2}];
    }),
    pods:PODS.map((p,i)=>{
      let stored=0,direct=0,dx=0,dy=0;
      for(const event of events[i]){
        const age=t-PULSE_CENTER-event.opticalTime/SPEED;
        stored+=event.depositedEnergy*charge(age)*.65;
        const surfaceAge=t-PULSE_CENTER-event.opticalStart/SPEED;
        const hit=Math.abs(surfaceAge)<=3*PULSE_SIGMA?gaussian(surfaceAge/PULSE_SIGMA)*event.incidentEnergy:0;
        direct+=hit;dx+=(event.x-p.x)*hit;dy+=(event.y-p.y)*hit;
      }
      const emission=Math.pow(1-Math.exp(-stored*60000),.45)*(1-ramp(t,14,16));
      const scatter=(1-Math.exp(-direct*280))*(1-ramp(t,14,16));
      const length=Math.hypot(dx,dy);
      return {emission,bloom:Math.min(1,emission*.95+scatter*.5),scatter,
        scatterX:length?dx/length*p.r*.36:0,scatterY:length?dy/length*p.r*.36:0};
    }),
  };
}
const LIGHT_STOPS=[[0,0],[.125,.08],[.25,.32],[.375,.76],[.5,1],[.625,.76],[.75,.32],[.875,.08],[1,0]];

function beadGlow(p,s,i,id){
  const r=n(p.r),outer=n(r*3.6);
  const ring=`M0 ${-outer}a${outer} ${outer} 0 1 1 0 ${outer*2}a${outer} ${outer} 0 1 1 0 ${-outer*2}Z M0 ${-r}a${r} ${r} 0 1 1 0 ${r*2}a${r} ${r} 0 1 1 0 ${-r*2}Z`;
  return `<path data-layer="bloom" transform="translate(${n(p.x)} ${n(p.y)})" d="${ring}" fill-rule="evenodd" fill="url(#${id}-afterglow)" opacity="${n(s.bloom)}"/>`;
}
function bead(p,s,i){
  const r=n(p.r);
  return `<g data-pod="${i}" transform="translate(${n(p.x)} ${n(p.y)})">
    <circle r="${r}" fill="#94A4B2" fill-opacity=".7"/>
    <circle data-layer="emission" r="${r}" fill="#DDF5FF" opacity="${n(Math.min(.96,s.emission*.92+s.scatter*.2))}"/>
  </g>`;
}
export function frame(seconds,prefix='registry',{includeRays=true,currentState}={}){
  const id=prefix.replace(/[^a-zA-Z0-9_-]/g,''),s=currentState??state(seconds);
  let rays='',rayGradients='';
  if(includeRays)s.rays.forEach((ray,i)=>{
    if(ray.alpha<.0002)return;
    rayGradients+=`<linearGradient id="${id}-ray-${i}" gradientUnits="userSpaceOnUse" x1="${n(ray.gx1)}" y1="${n(ray.gy1)}" x2="${n(ray.gx2)}" y2="${n(ray.gy2)}">${LIGHT_STOPS.map(([offset,alpha])=>`<stop offset="${offset}" stop-color="#E0F2FF" stop-opacity="${alpha}"/>`).join('')}</linearGradient>`;
    const d=`M${n(ray.x1)} ${n(ray.y1)}L${n(ray.x2)} ${n(ray.y2)}`;
    rays+=`<path d="${d}" stroke="url(#${id}-ray-${i})" stroke-width="13" opacity="${n(ray.alpha*.15)}"/><path d="${d}" stroke="url(#${id}-ray-${i})" stroke-width="3.5" opacity="${n(ray.alpha)}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">LiteLLM Enterprise Registry</title><desc id="${id}-desc">A cool white pulse enters from the upper left, reflects off the image edges, and refracts through frosted glass gateway beads. Absorbed light leaves a fading phosphorescent glow, illustrating a rolling deployment.</desc><defs>${rayGradients}
    <radialGradient id="${id}-afterglow"><stop stop-color="#A9E5FF" stop-opacity=".8"/><stop offset=".3" stop-color="#53B3ED" stop-opacity=".4"/><stop offset="1" stop-color="#389CD8" stop-opacity="0"/></radialGradient>
  </defs><g fill="none" stroke-linecap="round">${rays}</g>${PODS.map((p,i)=>beadGlow(p,s.pods[i],i,id)).join('')}${PODS.map((p,i)=>bead(p,s.pods[i],i)).join('')}</svg>`;
}
