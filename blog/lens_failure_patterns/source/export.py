from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import imageio_ffmpeg, subprocess, json, shutil
ROOT=Path(__file__).resolve().parents[1]
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
frames=ROOT/'qa/frames'; assets=ROOT/'assets'
# Blog cards use a 1200:630 cover. Preserve the full animation inside that frame.
GIF_FILTER='fps=12.5,scale=1200:-1:flags=lanczos,pad=1200:630:(ow-iw)/2:(oh-ih)/2:color=white'
def run(args):
 subprocess.run([FFMPEG,'-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
run(['-framerate','25','-i',frames/'%04d.png','-frames:v','270','-c:v','libx264','-crf','18','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart',assets/'lens-failure-patterns.mp4'])
run(['-t','10.8','-framerate','25','-i',frames/'%04d.png','-vf',GIF_FILTER+',palettegen=max_colors=192:reserve_transparent=0:stats_mode=diff','-frames:v','1',ROOT/'qa/palette.png'])
run(['-t','10.8','-framerate','25','-i',frames/'%04d.png','-i',ROOT/'qa/palette.png','-lavfi',GIF_FILTER+'[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-loop','0',assets/'lens-failure-patterns.gif'])
shutil.copy2(frames/'0202.png',assets/'lens-failure-patterns-poster.png')
gif=Image.open(assets/'lens-failure-patterns.gif'); duration=0
for i in range(gif.n_frames):
 gif.seek(i);duration+=gif.info.get('duration',0)
first=Image.open(frames/'0000.png').convert('RGB');last=Image.open(frames/'0269.png').convert('RGB')
delta=sum(ImageStat.Stat(ImageChops.difference(first,last)).mean)/3
report={'gif':{'dimensions':gif.size,'frames':gif.n_frames,'duration_seconds':duration/1000,'loop':gif.info.get('loop'),'bytes':(assets/'lens-failure-patterns.gif').stat().st_size},'mp4':{'dimensions':[1440,640],'fps':25,'duration_seconds':10.8,'bytes':(assets/'lens-failure-patterns.mp4').stat().st_size},'loop_first_last_mean_channel_difference_255':delta}
(ROOT/'qa/export-checks.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
