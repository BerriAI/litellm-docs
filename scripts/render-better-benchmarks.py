#!/usr/bin/env python3
"""Render the blog charts from committed CSVs. Requires matplotlib 3.10.8.

Run: MPLCONFIGDIR=/tmp/matplotlib python3 scripts/render-better-benchmarks.py
SVGs are used in the article; the headline PNG also serves as its social image.
"""
import csv
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, NullLocator

ROOT = Path(__file__).resolve().parents[1] / 'blog/better_benchmarks'
BLUE, INK, MUTED, GRID = '#3455ec', '#17212f', '#677487', '#e8edf2'
COLORS = {'LiteLLM Rust': BLUE, 'LiteLLM Python': '#343f50', 'Bifrost': '#8794aa', 'Portkey': '#a8b3c6'}
LINES = {'LiteLLM Rust': '-', 'LiteLLM Python': '-.', 'Bifrost': '--', 'Portkey': ':'}
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11, 'text.color': INK,
                     'axes.labelcolor': MUTED, 'xtick.color': MUTED, 'ytick.color': MUTED,
                     'svg.fonttype': 'none', 'savefig.facecolor': 'white'})

def data(name):
    with (ROOT / 'data' / f'{name}.csv').open(newline='') as f:
        return list(csv.DictReader(f))

def frame(title, subtitle, height=9):
    fig = plt.figure(figsize=(11, height), facecolor='white')
    fig.text(.055, .96, title, fontsize=23, weight='bold', va='top')
    fig.text(.055, .91, subtitle, fontsize=11, color=MUTED, va='top')
    return fig

def clean(ax, axis='y'):
    for s in ax.spines.values():
        s.set_visible(False)
    ax.tick_params(length=0, pad=8)
    ax.grid(axis=axis, color=GRID, lw=.8)
    ax.set_axisbelow(True)

def save(fig, name, note):
    fig.text(.055, .035, note, fontsize=9, color=MUTED, va='bottom', linespacing=1.6)
    for ext in ('png', 'svg'):
        fig.savefig(ROOT / 'img' / f'{name}.{ext}', dpi=180)
    plt.close(fig)

def headline():
    rows = data('headline')
    fig = frame('Gateway performance at 50 requests / sec', 'Five-minute run · lower is better · exact values beside every mark', 10)
    metrics = [('gateway_overhead_p50_ms', 'Median overhead', 'ms', True),
               ('gateway_overhead_p99_ms', 'Tail overhead · p99', 'ms', True),
               ('cpu_cores_mean', 'CPU', 'cores', False),
               ('peak_memory_mib', 'Peak memory', 'MiB', False)]
    for i, (key, title, unit, log) in enumerate(metrics):
        ax = fig.add_axes([.065 + (i % 2)*.49, .56 - (i//2)*.36, .385, .25])
        for j,r in enumerate(rows):
            y = 4-j
            name = r['gateway'].replace('LiteLLM ', '') + ('*' if r['gateway']=='OpenRouter' else '')
            col = BLUE if j==0 else '#aeb8ca'
            ax.text(.0, y+.28, name, transform=ax.get_yaxis_transform(), fontsize=10, weight='bold' if j==0 else 'normal', color=INK)
            if r[key]:
                value=float(r[key])
                if log:
                    ax.scatter(value,y,s=48,color=col,zorder=3)
                else:
                    ax.barh(y,value,height=.23,color=col,zorder=3)
                label=f'{value:g} {unit}'
                ax.annotate(label,(value,y),xytext=(7,0),textcoords='offset points',va='center',fontsize=10,color=BLUE if j==0 else INK,weight='bold' if j==0 else 'normal')
            else:
                ax.text(0,y,'Not available (hosted)',transform=ax.get_yaxis_transform(),fontsize=9,color=MUTED,va='center')
        ax.set_title(title + (' · log scale' if log else ''),loc='left',fontsize=13,weight='bold',pad=27)
        ax.set_ylim(-.6,4.7);ax.set_yticks([])
        if log:
            ax.set_xscale('log');ax.set_xlim(.3,10000 if i==1 else 500)
            ax.set_xticks([1,10,100,1000] if i==1 else [1,10,100]);ax.xaxis.set_major_formatter(FuncFormatter(lambda v,p:f'{v:g}'))
            ax.xaxis.set_minor_locator(NullLocator())
        else:
            ax.set_xlim(0,4 if i==2 else 13000)
            ax.set_xticks([0,1,2,3] if i==2 else [0,4000,8000])
        clean(ax,'x')
    save(fig,'headline','Full features; Portkey has none. All gateways served 100% of requests. 4 cores / 16 GiB per pod.\n*OpenRouter: separate Azure test at 8 RPS. Its p99 is not baseline-subtracted; see methodology.\nLatency uses a logarithmic axis so every value remains visible without capped bars.')

def lines(name, title, subtitle, fields, xkey, note):
    rows=data('sweep' if name == 'sweep-linear' else name);fig=frame(title,subtitle,10)
    for i,(key,label,unit,log) in enumerate(fields):
        ax=fig.add_axes([.08+(i%2)*.49, .57-(i//2)*.38, .825 if len(fields)==3 and i==2 else .335, .245])
        for gateway in COLORS:
            rs=[r for r in rows if r['gateway']==gateway]
            if not rs:continue
            xs=[float(r[xkey]) for r in rs];ys=[float(r[key]) for r in rs]
            ax.plot(xs,ys,color=COLORS[gateway],ls=LINES[gateway],lw=2.4 if gateway=='LiteLLM Rust' else 1.6,marker='o',ms=4,zorder=3)
            ax.annotate(gateway.replace('LiteLLM ',''),(xs[-1],ys[-1]),xytext=(8, 8 if gateway=='Bifrost' else -9 if gateway=='Portkey' else 0),textcoords='offset points',color=COLORS[gateway],fontsize=9,va='center')
            if gateway=='LiteLLM Python':
                for x,y,r in zip(xs,ys,rs):
                    if float(r['ok_pct'])<100:
                        ax.scatter(x,y,s=42,facecolors='white',edgecolors=COLORS[gateway],zorder=4)
                        if key=='cpu_cores_mean':ax.annotate(f"{float(r['ok_pct']):g}% OK",(x,y),xytext=(-8,-20),textcoords='offset points',ha='right',fontsize=8,color=MUTED)
        ax.set_title(label+(' · log scale' if log else ''),loc='left',fontsize=13,weight='bold',pad=18)
        if log:
            ax.set_yscale('log');ax.yaxis.set_major_formatter(FuncFormatter(lambda v,p:f'{v:g}'));ax.yaxis.set_minor_locator(NullLocator())
        else:ax.set_ylim(bottom=0)
        ax.set_ylabel(unit,fontsize=9);ax.set_xlabel('Requests / sec',fontsize=10,labelpad=12)
        ax.set_xticks(sorted({float(r[xkey]) for r in rows}));ax.xaxis.set_major_formatter(FuncFormatter(lambda v,p:f'{v:g}'));ax.tick_params(axis='x',labelsize=9);clean(ax)
    save(fig,name,note)

def requests():
    rows=data('request-bars');fig=frame('Where a request spends its time','One non-streamed chat completion · phases retain their measured proportions',8.8)
    keys=['auth_ms','limits_and_hooks_ms','build_request_and_call_provider_ms','everything_else_ms']
    labels=['Auth','Limits + hooks','Build + call provider','Other'];cols=[BLUE,'#879ce9','#8996aa','#d6dde7']
    for i,(subset,title,limit) in enumerate([(rows,'All requests · common scale',60),(rows[2:],'Rust detail · enlarged scale',5)]):
        ax=fig.add_axes([.24,.51 if i==0 else .20,.65,.28 if i==0 else .18])
        for j,r in enumerate(subset):
            y=len(subset)-1-j;left=0
            for key,col in zip(keys,cols):
                v=float(r[key]);ax.barh(y,v,left=left,height=.43,color=col,edgecolor='white',lw=.7);left+=v
            ax.text(left+.5 if i==0 else left+.07,y,f"{float(r['total_ms']):.2f} ms",va='center',fontsize=10,weight='bold',color=BLUE if 'Rust' in r['request'] else INK)
        ax.set_yticks(range(len(subset)),[r['request'].replace('LiteLLM ','').replace(', ',' / ') for r in subset[::-1]],fontsize=10)
        ax.set_xlim(0,limit);ax.set_xlabel('Milliseconds',fontsize=9);ax.set_title(title,loc='left',fontsize=12,weight='bold',pad=16);clean(ax,'x')
    from matplotlib.patches import Patch
    fig.legend(handles=[Patch(color=c,label=l) for c,l in zip(cols,labels)],loc='upper left',bbox_to_anchor=(.23,.875),ncol=4,frameon=False,fontsize=9)
    save(fig,'request-bars','One pinned core per gateway; all callbacks on. Python phases scaled from a traced request.\nThe lower panel enlarges the same Rust measurements; it uses a different horizontal scale.')

def memory():
    rows=data('memory');fig=frame('Heap held per open stream','500k-token request · 2.45 MB body · same linear scale for every gateway',10)
    gateways=['LiteLLM Python','Bifrost','LiteLLM Rust','LiteLLM Rust + S3 logs']
    for i,g in enumerate(gateways):
        rs=[r for r in rows if r['gateway']==g];total=sum(float(r['mb_per_open_stream']) for r in rs)
        top=.79-i*.17
        fig.text(.055,top,g,fontsize=13,weight='bold',color=BLUE if 'Rust' in g else INK)
        fig.text(.94,top,f'{total:.2f} MB',fontsize=13,weight='bold',ha='right',color=BLUE if 'Rust' in g else INK)
        ax=fig.add_axes([.055,top-.065,.885,.045]);left=0
        for j,r in enumerate(rs):
            v=float(r['mb_per_open_stream']);col=('#3455ec' if j%2==0 else '#8b9ff0') if 'Rust' in g else ('#aeb8ca' if j%2==0 else '#d4dce7')
            ax.barh(0,v,left=left,height=.8,color=col,edgecolor='white',lw=1.3);left+=v
        ax.set_xlim(0,12);ax.set_ylim(-.5,.5);ax.axis('off')
        pieces=[f"{r['component']}: {float(r['mb_per_open_stream']):g} MB" for r in rs]
        # Break long component descriptions between complete labels.
        import textwrap
        detail=' · '.join(pieces)
        fig.text(.055,top-.085,'\n'.join(textwrap.wrap(detail,110,break_long_words=False)),fontsize=9,color=MUTED,va='top',linespacing=1.5)
    save(fig,'memory','Profiled heap allocations, not process RSS. Python: memray; Bifrost: pprof; Rust: heaptrack.\nRust with S3 logs retains one body copy for the lifetime of the stream.')

headline()
lines('sweep-linear','Performance as request rate rises','Full features · five minutes per rate · single run per configuration',[
 ('gateway_overhead_p50_ms','Median overhead','ms',True),('gateway_overhead_p99_ms','Tail overhead · p99','ms',True),
 ('cpu_cores_mean','CPU','cores',False),('peak_memory_mib','Peak memory','MiB',False)],'rps',
 'Latency minus a separate direct-to-mock run; observed drift about ±0.7 ms. Single run per configuration.\nOpen markers: Python overloaded (78.9% OK at 75 RPS; 29.3% at 100 RPS). Portkey has no features.\nLatency axes are logarithmic; CPU and memory axes start at zero. 4 cores / 16 GiB per pod.')
lines('big-bodies','Large requests, steady streaming','870k to 1M tokens · roughly 4 MB per request · every request streamed',[
 ('first_byte_overhead_p50_ms','First-byte overhead · p50','ms',False),('first_byte_overhead_p99_ms','First-byte overhead · p99','ms',False),('peak_memory_gib','Peak memory','GiB',False)],'rps_nominal',
 'Basic features; Portkey has none. Three minutes per rate; 4 cores / 16 GiB per pod.\nFirst byte includes the cost of moving 4 MB over two hops; no direct-to-mock floor was subtracted.\nPortkey served 99.85% at 4 RPS; other points served 100%. Rates shown are nominal.')
requests()
memory()
