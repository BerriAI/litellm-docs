"""Editable SVG diagrams with embedded fonts; no external resources at viewing time."""
from pathlib import Path
from html import escape
import base64, json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'; OUT.mkdir(exist_ok=True)
FONT=base64.b64encode((ROOT/'source/fonts/geist-variable.woff2').read_bytes()).decode()
TOKENS=json.loads((ROOT/'source/brand-tokens.json').read_text())
INK=TOKENS['ink']; MUTED='#7d8087'; BLUE=TOKENS['accent']; TEAL=BLUE; PURPLE=BLUE; EDGE=TOKENS['line']; AMBER=MUTED
PALE=TOKENS['accent-tint']; GREEN=PALE; LAV=PALE

def txt(x,y,s,size=20,fill=INK,weight=450,anchor='start'):
 return f'<text x="{x}" y="{y}" font-size="{min([12.5,15,18,24,32,44,64],key=lambda v:abs(v-size))}" letter-spacing="-.015em" fill="{fill}" font-weight="{500 if weight>=500 else 400}" text-anchor="{anchor}">{escape(s)}</text>'
def lines(x,y,ss,size=20,fill=MUTED,step=28,weight=450):
 return ''.join(txt(x,y+i*step,s,size,fill,weight) for i,s in enumerate(ss))
def rect(x,y,w,h,fill='white',stroke=EDGE,r=16,shadow=False):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{14 if r>12 else 6 if r<9 else 12}" fill="{fill}" stroke="{stroke}" stroke-width="1"'+(' filter="url(#shadow)"' if shadow else '')+'/>'
def path(d,color=EDGE,width=2,arrow=False,dash=False):
 return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"'+(' marker-end="url(#arrow)"' if arrow else '')+(' stroke-dasharray="5 6"' if dash else '')+'/>'
def arrow(x1,y1,x2,y2,color=TOKENS['line-2']):
 return path(f'M{x1} {y1} L{x2} {y2}',color,1.8,True)
def dot(x,y,color=BLUE,r=5):
 return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'
def pill(x,y,w,label,color=BLUE,bg=PALE):
 return rect(x,y,w,30,bg,'none',8)+txt(x+w/2,y+20,label,13,color,550,'middle')
def card(x,y,w,h,title,body=(),color=BLUE,bg='white',label=None):
 s=rect(x,y,w,h,bg,EDGE,16,True)
 s+=rect(x+22,y+23,25,4,color,'none',2)
 if label:s+=txt(x+59,y+29,label,12,color,600)
 s+=txt(x+22,y+65,title,25,INK,600)
 s+=lines(x+22,y+96,body,18,MUTED,26)
 return s
def note(x,y,w,title,body):
 return rect(x,y,w,86,'#f3f6fb','none',12)+txt(x+22,y+31,title,18,INK,580)+txt(x+22,y+60,body,16,MUTED)
def header(n,title,subtitle):
 return pill(56,36,64,n)+txt(136,59,'LITELLM LENS',13,MUTED,550)+txt(56,122,title,38,INK,590)+txt(56,164,subtitle,20,MUTED)
def label(x,y,s,color=MUTED):return txt(x,y,s,13,color,550)
def check(x,y,color=TEAL):return path(f'M{x-6} {y} l4 4 l8 -9',color,2)
def render(name,title,desc,body,height=760):
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="{height}" viewBox="0 0 1440 {height}" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title><desc id="desc">{escape(desc)}</desc>
<defs><style>@font-face{{font-family:Geist;src:url(data:font/woff2;base64,{FONT}) format('woff2');font-weight:100 900}}text{{font-family:Geist,Arial,sans-serif}}</style>
<filter id="shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#272b37" flood-opacity=".06"/></filter>
<marker id="arrow" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M2 1.5L8 5L2 8.5" fill="none" stroke="#b3b3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker>
<linearGradient id="bg" x2="0" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#f8faff"/></linearGradient></defs>
<rect x="1" y="1" width="1438" height="{height-2}" rx="27.5" fill="#ffffff" stroke="{EDGE}"/>
{body}

</svg>'''
 (OUT/(name+'.svg')).write_text(svg)
 return {'file':name,'title':title,'alt':desc,'width':1440,'height':height}
