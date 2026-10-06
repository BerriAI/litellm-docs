/* Deterministic, dependency-free motion source. renderFrame(seconds) supports exact scrubbing. */
const canvas=document.querySelector('canvas'), c=canvas.getContext('2d');
const W=1440,H=640,DURATION=10.8;
const C={bg:BRAND.surface,ink:BRAND.ink,muted:'#7d8087',line:BRAND['line-2'],blue:BRAND.accent,teal:BRAND.accent,purple:BRAND.accent};
const causes=[
 {name:'Truncated sources',tag:'RESEARCH',color:C.blue,pale:BRAND['accent-tint'],desc:['Missing source text']},
 {name:'Repeated tool failures',tag:'TOOL USE',color:C.teal,pale:BRAND['accent-tint'],desc:['grep → terminal fallback']},
 {name:'Missing capabilities',tag:'SUPPORT',color:C.purple,pale:BRAND['accent-tint'],desc:['Unsupported document type']}
];
const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,p)=>a+(b-a)*p;
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const ease=x=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
const tween=(t,s,d)=>ease((t-s)/d);
const rr=(x,y,w,h,r)=>{c.beginPath();c.roundRect(x,y,w,h,r)};
function box(x,y,w,h,r,fill,stroke,shadow=false){if(shadow){c.shadowColor='#272b370f';c.shadowBlur=24;c.shadowOffsetY=8;}rr(x,y,w,h,r);c.fillStyle=fill;c.fill();c.shadowColor='transparent';if(stroke){c.strokeStyle=stroke;c.lineWidth=1.2;c.stroke();}}
function text(s,x,y,size=20,color=C.ink,weight=450,font='Geist',align='left'){size=[12.5,15,18,24,32,44,64].reduce((a,b)=>Math.abs(b-size)<Math.abs(a-size)?b:a);c.font=`${weight>=500?500:400} ${size}px ${font}`;c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(s,x,y);}
function line(points,color,width=1.5){c.beginPath();c.moveTo(points[0][0],points[0][1]);points.slice(1).forEach(p=>c.lineTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function dot(x,y,r,color){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
function check(x,y,color,scale=1){line([[x-5*scale,y],[x-1*scale,y+4*scale],[x+7*scale,y-5*scale]],color,2*scale);}
function bezier(a,b,p,bend){return {x:mix(a.x,b.x,p),y:mix(a.y,b.y,p)-Math.sin(Math.PI*p)*bend};}
function groupX(g){return 64+g*446;}
const tiles=Array.from({length:36},(_,i)=>{
 const chosen=i%2===0,k=Math.floor(i/2),g=k%3,slot=Math.floor(k/3);
 return {i,chosen,g,slot,x:80+(i%9)*144,y:283+Math.floor(i/9)*87,w:128,h:72};
});
const logo=new Image();logo.src='litellm-primary.png';
function renderFrame(time){
 const t=(((time%DURATION)+DURATION)%DURATION)*18/DURATION;
 c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);c.fillStyle=C.bg;c.fillRect(0,0,W,H);
 if(logo.complete)c.drawImage(logo,64,34,168.4,32);
 text('Lens',257,60,25,C.ink,400);
 c.translate(0,-156);
 const returnP=tween(t,16.1,1.55),reset=1-returnP;
 const groupP=tween(t,5.05,2.6)*reset;
 const investigate=tween(t,8.6,1)*reset;
 const finalP=tween(t,11.9,1.0)*reset;
 // Group frames appear around the same evidence objects as they arrive.
 for(let g=0;g<3;g++){
  const def=causes[g],x=groupX(g),a=tween(t,5.55+g*.12,1.35)*reset;
  if(a>.001){c.globalAlpha=a;box(x,268,420,366,14,'#ffffff',BRAND.line,true);
   c.fillStyle=BRAND['accent-wash'];rr(x+24,291,24,24,6);c.fill();text(String(g+1).padStart(2,'0'),x+36,307,11,C.blue,500,'GeistMono','center');

   text(def.name,x+24,353,24,C.ink,500);

   c.globalAlpha=a*smooth((finalP-.5)/.5);
   def.desc.forEach((s,j)=>text(s,x+24,409+j*26,20,C.ink,450));
   c.globalAlpha=a*smooth((finalP-.82)/.18);dot(x+31,479,10,def.pale);check(x+30,479,def.color,.7);text('Source traces',x+48,484,14,def.color,550);
   c.globalAlpha=a*(1-finalP)*investigate;
   line([[x+25,595],[x+395,595]],C.line,1);
   text('read',x+35,618,13,def.color,500,'GeistMono');text('search',x+144,618,13,def.color,500,'GeistMono');text('python',x+276,618,13,def.color,500,'GeistMono');
  }
 }
 c.globalAlpha=1;
 // A short acceleration of the scan is choreography, not a performance claim.
 const ramp=clamp((t-2.0)/.55);
 const scanDistance=t*.09+.51*(t<2?0:t<2.55?.55*(ramp**3-ramp**4/2):t-2.275);
 const reviewP=smooth((t-1.7)/3.1)*reset;
 for(const tile of tiles){
  const {i,g,slot,chosen}=tile,def=causes[g];
  let p=tween(t,5.10+(i%9)*.047+Math.floor(i/9)*.04,2.15)*reset;
  if(!chosen){c.globalAlpha=(1-tween(t,5.15,1.35))*reset+returnP;}
  else c.globalAlpha=1;
  if(c.globalAlpha<.002)continue;
  const target={x:groupX(g)+24+(slot%2)*188,y:391+Math.floor(slot/2)*62};
  const compact={x:groupX(g)+24+(slot%2)*188,y:516+Math.floor(slot/2)*33};
  const end={x:mix(target.x,compact.x,finalP),y:mix(target.y,compact.y,finalP)};
  const pos=bezier(tile,end,p,chosen?(slot%2?60:-45):0);
  const w=mix(tile.w,176,p),h=mix(tile.h,mix(49,27,finalP),p);
  const scan=clamp((scanDistance-(i%9)*.055-Math.floor(i/9)*.07)*2.0);
  const revealed=chosen?smooth((scan-.18)/.5)*reset:0;
  const lift=Math.sin(Math.PI*p)*7*(slot%2?1:-1);
  c.save();c.translate(pos.x+w/2,pos.y+h/2);c.rotate(lift*Math.PI/180);c.translate(-w/2,-h/2);
  box(0,0,w,h,mix(9,6,finalP*p),mixColor('#ffffff',def.pale,revealed*.6),mixColor(BRAND['line-2'],def.color,revealed*.55),p>0&&p<1);
  if(revealed>0){c.save();c.globalAlpha*=revealed;rr(0,0,3.5,h,2);c.fillStyle=def.color;c.fill();c.restore();}
  const label=finalP>.6&&p>.9?`trace ${String(i+1).padStart(2,'0')}`:`TRACE ${String(i+1).padStart(2,'0')}`;
  text(label,12,mix(20,18,finalP*p),finalP>.6&&p>.9?11:10.5,chosen&&revealed>.3?def.color:C.muted,500,'GeistMono');
  const detailA=1-finalP*p;
  c.save();c.globalAlpha*=detailA;
  const yy=mix(36,31,p),length=mix(66,98,p);
  line([[14,yy],[14,yy+14],[32,yy+14]],revealed>.3?def.color:BRAND['line-2'],1.2);
  dot(14,yy,2.3,revealed>.3?def.color:BRAND['line-2']);dot(32,yy+14,2.3,revealed>.3?def.color:BRAND['line-2']);
  line([[23,yy],[length,yy]],BRAND['line-2'],3);line([[40,yy+14],[length+20,yy+14]],revealed>.3?def.color:BRAND.line,3);
  c.restore();
  // A moving light follows the parent and child spans within each execution.
  if(t>1.1&&t<5.15){const z=(scanDistance*2.4+i*.093)%1;const shine=Math.sin(z*Math.PI),px=24+z*(w-43),col=chosen?def.color:C.blue;c.save();c.globalAlpha*=shine*.85;const trail=4+smooth(ramp)*17;const grad=c.createLinearGradient(px-trail,0,px,0);grad.addColorStop(0,col+'00');grad.addColorStop(1,col+'75');line([[px-trail,h-19],[px,h-19]],grad,2.5);dot(px,h-19,2.7,col);c.restore();}
  c.restore();
 }
 // Investigators follow a path back to original evidence, one per candidate.
 const evA=tween(t,8.6,.65)*(1-tween(t,11.8,.55))*reset;
 if(evA>0){for(let g=0;g<3;g++){
  c.globalAlpha=evA;const def=causes[g],x=groupX(g);
  const cycle=clamp((t-9-g*.15)/2.2),scanY=393+Math.sin(cycle*Math.PI)*139;
  c.save();rr(x+22,388,376,186,6);c.clip();
  const sg=c.createLinearGradient(0,scanY-20,0,scanY+12);sg.addColorStop(0,def.color+'00');sg.addColorStop(1,def.color+'1a');c.fillStyle=sg;c.fillRect(x+23,scanY-20,374,31);line([[x+24,scanY+11],[x+396,scanY+11]],def.color+'70',1);c.restore();
  const xp=x+210;line([[xp,634],[xp,663]],def.color+'70',1.5);
  box(x+104,655,212,31,7,'#ffffff',def.color+'50');text('original trace evidence',xp,675,11.5,def.color,450,'GeistMono','center');
  const zz=((t-8.6)*1.35+g*.21)%1;dot(xp,638+zz*15,3,def.color);
 }}
 c.globalAlpha=1;
 // Persistent progression, with no invented counts or benchmark metrics.
 const phases=[['01','Review in parallel'],['02','Group patterns'],['03','Investigate'],['04','Findings']];
 const starts=[1.7,5.1,8.7,12.0];
 line([[64,721],[1376,721]],BRAND.line,1);
 phases.forEach(([n,label],i)=>{const a=smooth((t-starts[i])/.5)*reset;const x=64+i*335;
  box(x,744,27,25,6,mixColor(BRAND['surface-3'],BRAND['accent-wash'],a),null);text(n,x+13.5,761,11,mixColor(C.muted,C.blue,a),500,'GeistMono','center');
  text(label,x+39,762,17,mixColor(C.muted,C.ink,a),a>.5?550:450);
  if(a>0){c.globalAlpha=a;line([[x,721],[x+244,721]],C.blue,2);c.globalAlpha=1;}
 });
 text('Illustrative traces and findings',1374,696,11,C.muted,400,'Geist', 'right');
}
function mixColor(a,b,t){const p=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));const x=p(a),y=p(b);return '#'+x.map((v,i)=>Math.round(mix(v,y[i],t)).toString(16).padStart(2,'0')).join('');}
window.renderFrame=renderFrame;window.DURATION=DURATION;window.pauseAnimation=false;
let origin=performance.now();
Promise.all([document.fonts.load('500 20px Geist'),document.fonts.load('500 20px GeistMono'),logo.decode()]).then(()=>{window.ready=true;origin=performance.now();function tick(now){if(!window.pauseAnimation)renderFrame((now-origin)/1000);requestAnimationFrame(tick);}requestAnimationFrame(tick);});
