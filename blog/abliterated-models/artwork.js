/* Shade a parametric surface, then quantize the light into a stable dither pattern. */
export default function drawArtwork(canvas) {
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const plate=document.createElement('canvas'), ink=document.createElement('canvas');
  let width=0,height=0,resizeFrame=0;
  const TAU=Math.PI*2;
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,k)=>a.map(v=>v*k);
  const unit=a=>mul(a,1/(Math.hypot(...a)||1));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const center=u=>[.81*(Math.sin(u)+1.5*Math.sin(2*u)),.71*(Math.cos(u)-1.8*Math.cos(2*u)),.7*Math.sin(3*u)];
  const rotate=([x,y,z])=>{
    const a=.65,b=-.35,c=-.7;
    const y1=y*Math.cos(a)-z*Math.sin(a),z1=y*Math.sin(a)+z*Math.cos(a);
    const x2=x*Math.cos(b)+z1*Math.sin(b),z2=-x*Math.sin(b)+z1*Math.cos(b);
    return [x2*Math.cos(c)-y1*Math.sin(c),x2*Math.sin(c)+y1*Math.cos(c),z2];
  };
  const verts=[],normals=[],U=208,V=44;
  for(let i=0;i<U;i++){
    const u=i/U*TAU,c=center(u),t=unit(sub(center(u+.001),center(u-.001)));
    const n=unit(cross(t,[0,0,1])),b=cross(t,n),twist=u*.7;
    for(let j=0;j<V;j++){
      const v=j/V*TAU+twist, cv=Math.cos(v),sv=Math.sin(v);
      const r=.36+.12*Math.sin(3*u+.4)+.06*Math.sin(7*u);
      const radial=add(mul(n,Math.sign(cv)*Math.pow(Math.abs(cv),.68)),mul(b,.73*Math.sign(sv)*Math.pow(Math.abs(sv),.68)));
      verts.push(rotate(add(c,mul(radial,r))));normals.push(rotate(unit(add(mul(n,cv),mul(b,sv)))));
    }
  }
  const light=unit([-.4,-.7,1]);
  const faces=[];
  for(let i=0;i<U;i++)for(let j=0;j<V;j++){
    const ids=[i*V+j,((i+1)%U)*V+j,((i+1)%U)*V+(j+1)%V,i*V+(j+1)%V];
    const n=unit(ids.reduce((s,k)=>add(s,normals[k]),[0,0,0]));
    const lum=.055+.72*Math.max(0,dot(n,light))+.15*Math.pow(Math.max(0,n[2]),5);
    faces.push({ids,z:ids.reduce((s,k)=>s+verts[k][2],0)/4,lum});
  }
  faces.sort((a,b)=>a.z-b.z);
  function buildPlate(){
    const pw=Math.min(1500,Math.round(width*1.2)),ph=Math.round(pw*height/width);
    plate.width=ink.width=pw;plate.height=ink.height=ph;
    const p=plate.getContext('2d');p.fillStyle='#050505';p.fillRect(0,0,pw,ph);
    function sculpture(cx,cy,s,mirror,brightness){
      for(const f of faces){
        p.beginPath();f.ids.forEach((k,i)=>{const v=verts[k],x=cx+v[0]*s*mirror,y=cy+v[1]*s;i?p.lineTo(x,y):p.moveTo(x,y);});p.closePath();
        const g=Math.round(f.lum*255*brightness);p.fillStyle=`rgb(${g},${g},${g})`;p.fill();
      }
    }
    sculpture(pw*.18,ph*.43,Math.min(ph*.25,pw*.14),-1,.72);
    sculpture(pw*.67,ph*.46,Math.min(ph*.40,pw*.23),1,1);
    const original=p.getImageData(0,0,pw,ph),out=p.createImageData(pw,ph);
    const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],cell=2;
    for(let y=0;y<ph;y+=cell)for(let x=0;x<pw;x+=cell){
      const at=(y*pw+x)*4,lum=original.data[at]/255;
      const threshold=(bayer[((y/cell)&3)*4+((x/cell)&3)]+.5)/16;
      const active=lum>.055&&Math.pow(lum,.85)>threshold;
      const v=active?Math.round(148+lum*99):5;
      for(let yy=0;yy<cell&&y+yy<ph;yy++)for(let xx=0;xx<cell&&x+xx<pw;xx++){
        const k=((y+yy)*pw+x+xx)*4;out.data[k]=v;out.data[k+1]=v;out.data[k+2]=active?Math.max(0,v-7):5;out.data[k+3]=active?255:0;
      }
    }
    ink.getContext('2d').putImageData(out,0,0);
  }
  function draw(){
    ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(ink,0,0,width,height);
  }
  function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;width=r.width;height=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);ctx.setTransform(d,0,0,d,0,0);buildPlate();draw();}
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resize);
  });
  observer.observe(canvas);
  resize();
  return () => { observer.disconnect(); cancelAnimationFrame(resizeFrame); };
}
