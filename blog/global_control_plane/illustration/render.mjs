import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');
const root = path.dirname(fileURLToPath(import.meta.url));
const post = path.dirname(root);
const WIDTH = 1440, HEIGHT = 760;
const c = {ink:'#3657F5', top:'#F0F6FF', left:'#D8E7FF', right:'#BDD3FF', wire:'#8CB6FF', grid:'#CADCFF', blue:'#4055FF', cyan:'#13A5E9'};
const logo = await fs.readFile(path.join(root, 'assets/litellm.svg'), 'utf8');
const logoPaths = [...logo.matchAll(/<path[^>]* d="([^"]+)"\s*\/>/g)].map(match => `<path d="${match[1]}"/>`).join('');
const pt = p => p.map(v => v.toFixed(2)).join(',');
const polygon = (points, fill, stroke=c.ink, width=2) => `<polygon points="${points.map(pt).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const line = (points, color=c.wire, width=2, dash='') => `<polyline points="${points.map(pt).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const lerp = (a,b,t) => a.map((v,i) => v + (b[i]-v)*t);
const diamond = (x,y,w,d) => [[x,y-d/2],[x+w/2,y],[x,y+d/2],[x-w/2,y]];
function slab(x,y,w,d,h,colors={},stroke=c.ink,width=2) {
  const [T,R,B,L]=diamond(x,y,w,d), drop=p => [p[0],p[1]+h];
  return polygon([L,B,drop(B),drop(L)],colors.left||c.left,stroke,width)
    + polygon([B,R,drop(R),drop(B)],colors.right||c.right,stroke,width)
    + polygon([T,R,B,L],colors.top||c.top,stroke,width);
}
const train = (x,y,size) => `<g transform="matrix(.866 .5 -.866 .5 ${x} ${y})"><g transform="translate(${-size/2} ${-size/2}) scale(${size/372.14})" fill="#0117BE">${logoPaths}</g></g>`;
const cross = (x,y,s=8) => line([[x-s,y],[x+s,y]],c.wire,1.7)+line([[x,y-s],[x,y+s]],c.wire,1.7);
function platform(x,y,w=380,d=220) {
  const corners=diamond(x,y,w,d);
  let out=slab(x,y,w,d,20,{top:'#F3F8FF',left:'#E1ECFF',right:'#CADCFF'},'#769CFF',1.8);
  for(const t of [.33,.67]) {
    out+=line([lerp(corners[0],corners[1],t),lerp(corners[3],corners[2],t)],c.grid,1);
    out+=line([lerp(corners[0],corners[3],t),lerp(corners[1],corners[2],t)],c.grid,1);
  }
  return out;
}
function server(x,y) {
  let out=slab(x,y,150,87,62,{top:'#ECF4FF',left:'#D3E4FF',right:'#B3CFFF'},c.ink,2.2);
  out+=train(x,y-2,68);
  const B=[x,y+43.5],R=[x+75,y];
  for(let i=0;i<3;i++) {
    const a=lerp(B,R,.24+i*.20),b=lerp(B,R,.35+i*.20);
    out+=polygon([[a[0],a[1]+22],[b[0],b[1]+22],[b[0],b[1]+33],[a[0],a[1]+33]],i===0?c.cyan:'#7C9AF0','none',0);
  }
  return out;
}
function database(x,y) {
  const rx=37, ry=21, h=65;
  return `<g stroke="${c.ink}" stroke-width="2" stroke-linejoin="round">
    <path d="M${x-rx} ${y}V${y+h}A${rx} ${ry} 0 0 0 ${x+rx} ${y+h}V${y}Z" fill="#D5E7FF"/>
    <path d="M${x} ${y+ry}V${y+h+ry}A${rx} ${ry} 0 0 0 ${x+rx} ${y+h}V${y}Z" fill="#BBD6FF" stroke="none"/>
    <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#F5F9FF"/>
    <path d="M${x-rx} ${y+23}A${rx} ${ry} 0 0 0 ${x+rx} ${y+23}M${x-rx} ${y+44}A${rx} ${ry} 0 0 0 ${x+rx} ${y+44}" fill="none"/>
  </g>`;
}
function region(x,y) {
  return platform(x,y)
    +line([[x-43,y+37],[x+12,y+5],[x+64,y+5]],'#7BA7FF',2.1)
    +server(x-48,y-66)
    +database(x+73,y-18);
}
function scene() {
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><title>LiteLLM Global Control Plane API</title><desc>A central LiteLLM control plane with a globe manages three separate regional deployments. Each regional deployment has its own gateway and storage. The connections represent management traffic.</desc>`;
  s+=cross(83,155,11)+cross(1363,635,11);
  for(let r=0;r<3;r++)for(let q=0;q<4;q++)s+=`<circle cx="${84+q*22}" cy="${668+r*20}" r="1.5" fill="#ACC9FF"/>`;
  // The three management connections are separate; regions have no cross-links.
  s+=line([[492,393],[454,415],[454,473],[420,493]],c.blue,2.5,'6 8');
  s+=line([[748,355],[815,316],[815,247],[914,190]],c.blue,2.5,'6 8');
  s+=line([[748,398],[825,442],[825,498],[914,549]],c.cyan,2.5,'6 8');
  // Each region is an independent island with its own gateway and storage.
  s+=region(1104,204);
  s+=region(232,504);
  s+=region(1104,566);
  // Central management service, deliberately separated from regional storage.
  s+=slab(620,370,256,148,58,{top:'#ECF4FF',left:'#D1E2FF',right:'#AFCBFF'},c.ink,2.5);
  s+=train(620,365,117);
  // A wireframe globe floats above the control plane.
  s+=line([[620,261],[620,288]],c.wire,1.8,'3 7');
  s+=`<g transform="translate(620 169) rotate(-18)" fill="none" stroke="#667CF0" stroke-width="2.7">
    <circle r="84"/>
    <ellipse rx="37" ry="84"/>
    <ellipse rx="68" ry="84"/>
    <ellipse rx="84" ry="29"/>
    <path d="M-72.75 -42C-39 -23 39 -23 72.75 -42M-72.75 42C-39 61 39 61 72.75 42"/>
  </g>`;
  s+=cross(1104,94,6)+cross(232,614,6)+cross(1104,676,6);
  return s+'</svg>';
}
const svg=scene();
await fs.writeFile(path.join(post,'cover.svg'),svg);
await sharp(Buffer.from(svg)).png().toFile(path.join(post,'cover.png'));
console.log(`Rendered text-free ${WIDTH} × ${HEIGHT} SVG and PNG.`);
