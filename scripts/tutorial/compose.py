import json, os
from PIL import Image, ImageDraw, ImageFilter
os.chdir(os.environ.get('OUT', '.video'))
W,H=1080,1920; PW,PH=694,1502; PX,PY=(W-PW)//2,350
bg=Image.new('RGB',(W,H),(14,11,26))
glow=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(glow)
d.ellipse((-300,-250,700,650),fill=(109,59,255,120)); d.ellipse((550,-150,1400,600),fill=(255,122,69,80)); d.ellipse((150,1300,950,2200),fill=(176,75,214,70))
glow=glow.filter(ImageFilter.GaussianBlur(160)); bg.paste(glow,(0,0),glow)
sh=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(sh)
d.rounded_rectangle((PX-10,PY+30,PX+PW+10,PY+PH+40),radius=70,fill=(109,59,255,150))
sh=sh.filter(ImageFilter.GaussianBlur(45)); bg.paste(sh,(0,0),sh); bg.save('bg.png')
m=Image.new('L',(PW,PH),0); ImageDraw.Draw(m).rounded_rectangle((0,0,PW-1,PH-1),radius=56,fill=255); m.save('mask.png')
fr=Image.new('RGBA',(PW+24,PH+24),(0,0,0,0)); ImageDraw.Draw(fr).rounded_rectangle((2,2,PW+21,PH+21),radius=66,outline=(60,50,100,255),width=10); fr.save('frame.png')
tl=json.load(open('timeline.json')); off=max(0,tl.get('firstFrame',0))
filt=[]
for i,c in enumerate([c for c in tl['caps'] if c['end']]):
    s=max(0,c['start']-off); e=c['end']-off
    open(f'cap{i}a.txt','w').write(c['text']); open(f'cap{i}b.txt','w').write(c['sub'] or '')
    a=f"if(lt(t,{s}+0.35),(t-{s})/0.35,if(gt(t,{e}-0.35),({e}-t)/0.35,1))"
    filt.append(f"drawtext=fontfile=fonts/jakarta-800.ttf:textfile=cap{i}a.txt:fontcolor=white:fontsize=78:x=(w-text_w)/2:y=118:alpha='{a}':enable='between(t,{s},{e})'")
    filt.append(f"drawtext=fontfile=fonts/jakarta-500.ttf:textfile=cap{i}b.txt:fontcolor=0xC9C2EA:fontsize=40:x=(w-text_w)/2:y=222:alpha='{a}':enable='between(t,{s},{e})'")
dur=tl['total']-off
open('filter.txt','w').write(f"[1:v]scale={PW}:{PH}:flags=lanczos,format=rgba[ph];[2:v]format=gray[mk];[ph][mk]alphamerge[phr];"
  f"[0:v][phr]overlay={PX}:{PY}:shortest=1[a];[a][3:v]overlay={PX-12}:{PY-12}[b];"
  f"[b]{','.join(filt)},fade=t=in:st=0:d=0.6,fade=t=out:st={dur-0.9:.2f}:d=0.9,format=yuv420p[v]")
