import csv,json,re,subprocess
from pathlib import Path
from collections import defaultdict
from PIL import Image,ImageDraw
BASE=Path(__file__).resolve().parents[1]; OUT=BASE/'.pdf-fidelity/barbaro'
im=Image.open(OUT/'images/page-001-image-001.jpeg').convert('L')
S=im.width/595.2
# Source geometry is recorded in PDF points. No full-page image is shipped.
regions=[('header',(0,0,595.2,91)),('proficiency',(38,91,161,126)),('passive',(2,128,92,162)),('inspiration',(99,129,186,162)),('abilities',(0,168,194,629)),('languages',(0,630,193,734)),('training',(1,735,70,838)),('tools',(71,735,192,838)),('combat',(204,94,393,301)),('attacks',(201,303,396,429)),('rage-counters',(204,430,393,500)),('extra-features',(201,501,396,558)),('rage',(204,557,397,678)),('unarmored',(204,677,397,727)),('reckless',(204,727,397,788)),('danger',(204,788,397,838))]
right=[(91,177),(177,221),(221,265),(265,350),(350,404),(404,464),(464,545),(545,609),(609,695),(695,744),(744,789),(789,838)]
regions += [(f'feature-{i+1}',(402,y,595.2,b)) for i,(y,b) in enumerate(right)]
import numpy as np
# Reviewed source-ink rectangles, excluding adjacent irregular frame strokes.
layout=json.loads((BASE/'src/barbarian/page1.json').read_text())
wordzones=[]
for line in layout['texts']:
 x,y,w,h=line['box']
 if line['kind']=='number':continue
 if any(c in line['text'] for c in ['{','}','[',']','|']):continue
 wordzones.append((x-.4,y-.3,x+w+.4,y+h+.3))
wordzones += [(575,y+6,585.6,y+18) for y in [95.5,182.5,226.3,269,356,408.5]]
wordzones += [(571.5,y+6,588.5,y+18) for y in [469,547,612.5,697,745.5,794.2]]
wordzones += [(377,y+6,385.5,y+21) for y in [560,681,730,792]]
wordzones += [(414,440,423,451),(499,440,507,451),(247,282.2,263,290),(18.7,254.5,23,259.5),(322.5,254.2,326,260),(349,254.2,352,260),(375.5,254.2,379,260)]
# Source text not recognized by OCR. These boxes lie strictly inside the printed borders.
wordzones += [(106.3,187.4,158.5,193.5),(106.3,335.4,158.5,341.8),(84,750,123,754.5),(84,760,122,765),(84,799,105,803),(414,443.6,423,450),(499,443.6,507,450),(310.8,254.5,314.7,260),(324.1,254.5,328,260),(337.4,254.5,341.3,260),(350.7,254.5,354.6,260),(364,254.5,367.9,260),(377.3,254.5,381.2,260)]
wordzones += [(25,481.5,27,486.6),(27,556,30,561.6)]
wordzones += [(16.4,332.8,60.3,337.2),(17.8,407.9,60.1,412.5),(22.5,481.4,53.6,485.8),(24.9,556.5,50.9,561)]
wordzones += [(337.3,109,375.5,116),(106,187,159,193.4),(106,335,159,342),(344,167,379,171.7),(344,174,379,179),(216.4,140,230,147),(247,141,260,147),(75.6,760,121.8,764),(84.2,799,103,802.5),(84.2,823,104,827),(84.5,750,123,754.5),(136,750,173.5,754),(74,796,80,804)]
# Paragraph blocks are white; removing their full line areas also removes OCR single-character gaps.
wordzones += [(211.2,574.4,388.3,669),(211.2,699,381,718),(210.8,749,389,775),(210.5,808,381,828),(411.5,371.5,570,390),(408.5,561.4,584.3,594),(408.2,712.5,560,725),(408,761,559,780),(408,811.5,569,824),(410.3,240.5,566,253),(412,200.5,558,207),(410.5,424.5,570,437),(426.5,444,470,450),(511.4,444,555,450)]
clean=im.copy();draw=ImageDraw.Draw(clean);pixels=np.asarray(im)
for box in wordzones:
 x,y,r,b=[round(n*S) for n in box]
 ring=np.concatenate([pixels[max(0,y-4):y,x:r].ravel(),pixels[b:min(im.height,b+4),x:r].ravel()])
 bg=int(np.percentile(ring,70)) if len(ring) else 255
 if 70<box[0]<191 and 178<box[1]<622:bg=229
 if bg>240 or bg<170:bg=255
 draw.rectangle((x,y,r,b),fill=bg)
clean.save(OUT/'page-001-decoration-mask.png')
assets=[]
for name,(x,y,r,b) in regions:
 px,py,pr,pb=[round(v*S) for v in (x,y,r,b)]; crop=clean.crop((px,py,pr,pb));w,h=crop.size
 layers=[]
 # ponytail: five tone bands approximate scan antialiasing; add bands for finer shading.
 for threshold,color in [(245,'#f1f1f1'),(235,'#e5e5e5'),(224,'#dcdcdc'),(150,'#888888'),(85,'#292929')]:
  mask=crop.point(lambda p:0 if p<threshold else 255,'1');mask.save('/tmp/barbarian-mask.pbm')
  subprocess.run(['potrace','/tmp/barbarian-mask.pbm','-s','-o','/tmp/barbarian-trace.svg','--turdsize','3','--alphamax','1','--opttolerance','0.2'],check=True)
  svg=Path('/tmp/barbarian-trace.svg').read_text();g=svg[svg.index('<g '):svg.rindex('</svg>')].replace('fill="#000000"',f'fill="{color}"')
  layers.append(g)
 content=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><g id="geometry">'+''.join(layers)+'</g></svg>'
 (BASE/f'public/templates/barbarian/p1-{name}.svg').write_text(content)
 assets.append({'name':name,'box':[px/S,py/S,w/S,h/S],'viewBox':[w,h],'src':f'/templates/barbarian/p1-{name}.svg'})
rows=list(csv.DictReader(open(OUT/'page-001-ocr.tsv'),delimiter='\t')); lines=defaultdict(list)
for r in rows:
 if r['level']=='5' and r['text'].strip():lines[(r['block_num'],r['par_num'],r['line_num'])].append(r)
texts=[]
for words in lines.values():
 text=' '.join(r['text'] for r in words)
 if not re.search('[A-Za-z]{3}',text): continue
 x=min(int(r['left']) for r in words)/S;y=min(int(r['top']) for r in words)/S
 right=max(int(r['left'])+int(r['width']) for r in words)/S;bottom=max(int(r['top'])+int(r['height']) for r in words)/S
 if bottom-y<=8 or text.upper()=='BARBARO':
  if x<105 and any(v in text.upper() for v in ['TIRO SALVEZZA','ATLETICA']):
   words=[r for r in words if int(r['left'])/S>=105];text=' '.join(r['text'] for r in words);x=min(int(r['left']) for r in words)/S
  if re.search('[A-Za-z]{3}',text):texts.append({'text':text,'box':[x,y,right-x,bottom-y]})
(OUT/'page-001-layout.json').write_text(json.dumps({'width':595.2,'height':841.92,'ornaments':assets,'texts':texts},ensure_ascii=False,indent=2))
print(len(assets),'ornaments;',len(texts),'OCR lines retained for review')
