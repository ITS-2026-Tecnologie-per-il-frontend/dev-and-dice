"""Reconstruct scanned ornaments and verified HTML lettering, one secondary page at a time."""
import argparse,csv,json,re,subprocess
from pathlib import Path
from collections import defaultdict
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.pdf-fidelity/barbaro'
def trace(page,regions,texts,slots=()):
 im=Image.open(OUT/f'images/page-{page:03d}-image-001.jpeg').convert('RGB');S=im.width/595.2
 clean=im.copy();draw=ImageDraw.Draw(clean)
 for line in texts:
  x,y,w,h=line['box'];draw.rectangle((round((x-.3)*S),round((y-.2)*S),round((x+w+.3)*S),round((y+h+.2)*S)),fill='white')
 if page==2:
  for y in [116.4,175.2,233.8,292.6,351.1,413.8,472.6,531.1,591.1,649.7,708.2,780.7]:
   draw.rectangle(tuple(round(v*S) for v in (562 if y!=708.2 else 560.5,y-5,589.7,y+16.5)),fill='white')
 clean.save(OUT/f'page-{page:03d}-decoration-mask.png');assets=[]
 for name,box in regions:
  px,py,pr,pb=[round(v*S) for v in box];crop=clean.crop((px,py,pr,pb))
  if name=='silhouette':
   eraser=ImageDraw.Draw(crop)
   for _,slot in slots:
    a,b,c,d=slot;eraser.rectangle((round(a*S)-px,round(b*S)-py,round(c*S)-px,round(d*S)-py),fill='white')
  gray=crop.convert('L');w,h=crop.size;layers=[]
  # ponytail: five tone bands; add bands and compare again for finer shading.
  palette=[(245,'#f4f0ed'),(232,'#ded6d3'),(215,'#cdc5c2'),(165,'#a49e9a'),(85,'#292929')] if page==2 else [(245,'#f3f3f3'),(232,'#e5e5e5'),(210,'#dadada'),(165,'#797576'),(85,'#252525')]
  for threshold,color in palette:
   gray.point(lambda p:0 if p<threshold else 255,'1').save('/tmp/barbarian-mask.pbm')
   subprocess.run(['potrace','/tmp/barbarian-mask.pbm','-s','-o','/tmp/barbarian-trace.svg','--turdsize','3','--opttolerance','0.2'],check=True)
   svg=Path('/tmp/barbarian-trace.svg').read_text();g=svg[svg.index('<g '):svg.rindex('</svg>')].replace('fill="#000000"',f'fill="{color}"');layers.append(g)
  (ROOT/f'public/templates/barbarian/p{page}-{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><g id="geometry">'+''.join(layers)+'</g></svg>')
  assets.append({'name':name,'box':[px/S,py/S,w/S,h/S],'viewBox':[w,h],'src':f'/templates/barbarian/p{page}-{name}.svg'})
 return assets

def page2():
 texts=[];fields=[]
 def text(s,box):texts.append({'text':s,'box':box,'kind':'plain'})
 def field(group,key,label,box,kind='text',**kw):fields.append({'group':group,'key':key,'label':label,'box':box,'kind':kind,**kw})
 for s,box in [("ETA’",[245.3,47,10.1,4.4]),('ALTEZZA',[301,47,23.7,4.4]),('PESO',[370.6,47,13.9,4.4]),('PELLE',[426.2,47,15.6,4.4]),('OCCHI',[474.2,47,18,4.4]),('CAPELLI',[529.9,47,21.4,4.4]),('NOME DEL PERSONAGGIO',[43,73.2,85.6,5]),("DIVINITA’",[244.6,73.4,24,4.1]),('CICATRICI',[380.2,73.4,25.9,4.4]),('SEGNI DI RICONOSCIMENTO',[491.3,73.2,79.9,4.3]),('TRATTI CARATTERIALI',[268.8,102.5,58.3,4.3]),('OGGETTI MAGICI / PERGAMENTE / POZIONI',[434.4,101.5,122.6,5.8]),('IDEALI',[289.7,168.7,17,4.6]),('LEGAMI',[287.8,233.8,20.4,4.3]),('ASPETTO',[84.7,249.1,25.2,4.6]),('TALENTI & TRATTI AGGIUNTIVI',[53.8,283,84.7,4.8]),('DIFETTI',[288,296.2,20.2,4.3]),('ZAINO & BORSE',[271,377.3,44.8,4.8]),('OGGETTO',[210.7,388.1,23.3,3.6]),("QTA’",[372.5,387.6,10.1,4.8]),('BACKGROUND',[77,584.9,41.6,4.5]),('ALLEATI',[38.4,758.5,21,4.4]),('NEMICI',[137.4,758.5,20.5,4.4])]:text(s,box)
 for i,name in enumerate(['MR','MA','ME','MO','MP']):text(name,[232.8+i*35.2,829.7,8.4,4.3]);field('equipment','coins.'+name,'Monete '+name,[226+i*35.2,810,23,14],'number',min=0)
 for key,label,box,kind in [('name','Nome del personaggio',[19,39,209,27],'text'),('age','Età',[245,28,48,16],'number'),('height','Altezza',[300,28,60,16],'text'),('weight','Peso',[370,28,45,16],'number'),('skin','Pelle',[426,28,38,16],'text'),('eyes','Occhi',[474,28,45,16],'text'),('hair','Capelli',[530,28,38,16],'text'),('deity','Divinità',[245,55,120,15],'text'),('scars','Cicatrici',[380,55,101,15],'text'),('marks','Segni di riconoscimento',[491,55,79,15],'text')]:field('identity' if key=='name' else 'appearance',key,label,box,kind)
 for key,label,box in [('appearance','Aspetto',[15,115,162,130]),('talents','Talenti e tratti aggiuntivi',[13,296,169,269]),('background','Storia del background',[13,596,171,144]),('allies','Alleati',[11,770,77,61]),('enemies','Nemici',[108,770,77,61]),('traits','Tratti caratteriali',[212,113,171,44]),('ideals','Ideali',[212,180,171,42]),('bonds','Legami',[212,245,171,40]),('flaws','Difetti',[212,307,171,42])]:field('notes',key,label,box,'textarea')
 for row in range(32):
  field('equipment',f'bag.{row}.name',f'Oggetto nello zaino {row+1}',[211,397+row*12.7,154,11])
  field('equipment',f'bag.{row}.quantity',f'Quantità nello zaino {row+1}',[372,397+row*12.7,12,11],'number',min=0)
 magicY=[116.4,175.2,233.8,292.6,351.1,413.8,472.6,531.1,591.1,649.7,708.2,780.7]
 for i,y in enumerate(magicY):
  x=412.1 if i==10 else 413.8
  text('Nome',[x,y,15.6,4.3])
  field('equipment',f'magic.{i}.name',f'Nome oggetto magico {i+1}',[431,y-5,124,9])
  field('equipment',f'magic.{i}.description',f'Descrizione oggetto magico {i+1}',[415,y+8,139,(magicY[i+1]-y-20) if i<11 else 38],'textarea')
  for j,(key,label) in enumerate([('equipped','Equipaggiato'),('requires','Rich. Sintonia'),('attuned','Sintonia Attiva' if i not in [6,7,8,9,11] else 'Sintonia Attiv.')]):
   tx=563 if i!=10 else 561.3;ty=y-3.8+j*6.7
   text(label,[tx,ty,23.6 if j==0 else 24.6 if j==1 else 25.7,2.7])
   field('checks',f'magic.{i}.{key}',f'{label} oggetto magico {i+1}',[558.2 if i!=10 else 556.5,ty-1.2,4.4,4.4],'checkbox')
 regions=[('header',(0,0,595.2,96)),('appearance',(1,94,194,273)),('talents',(1,277,193,576)),('background',(1,579,194,752)),('allies',(2,752,97,841.92)),('enemies',(99,752,194,841.92)),('traits',(204,97,393,164)),('ideals',(204,164,393,229)),('bonds',(204,229,393,292)),('flaws',(204,292,393,358)),('inventory',(200,372,396,841.92))]
 starts=[97,166,225,284,343,403,463,522,582,641,700,772,839]
 regions += [(f'magic-{i}',(402,starts[i],595.2,starts[i+1])) for i in range(12)]
 ornaments=trace(2,regions,texts)
 (ROOT/'src/barbarian/page2.json').write_text(json.dumps({'width':595.2,'height':841.92,'ornaments':ornaments,'texts':texts,'fields':fields},ensure_ascii=False,indent=2))
 print('Page 2:',len(ornaments),'ornaments',len(texts),'text lines',len(fields),'fields')
def page3():
 texts=[];fields=[]
 def text(s,box,kind='plain'):texts.append({'text':s,'box':box,'kind':kind})
 def field(group,key,label,box,kind='text',**kw):fields.append({'group':group,'key':key,'label':label,'box':box,'kind':kind,**kw})
 for s,box in [('DUNGEONS',[269.5,28,64.4,8.5]),('DRAGONS',[354.2,28,54.6,8.5]),('®',[409.6,27.9,4.4,4.4])]:text(s,box,'brand')
 text('Nome del Personaggio',[228.5,79.2,74.1,4.8],'heading')
 text('Sintonie Attive',[451.4,52.8,91.2,9.1],'heading')
 titles=[('Viso',[35.3,126.3,29.5,11]),('Testa',[534.5,126.3,36.5,11]),('Collo',[35,196.9,41,11]),('Schiena',[516,237.3,54.4,11]),('Corpo',[35,311.7,46.3,11]),('Torso',[529,329.5,42,11]),('Mani',[35,419.1,32.6,11]),('Braccia',[520,434.3,51.7,11]),('Vita',[35.5,517.7,31,11]),('Anelli',[529,561.1,42,9.9]),('Piedi',[35,611.9,35,11]),('Armi',[528,730.1,31.5,10.8]),('Altro',[34,762.2,39.2,11.1])]
 for title,box in titles:text(title,box,'heading')
 for s,box in [('Lenti, Maschere, Occhi, Occhiali',[33.6,142.8,133,8.9]),('Cappelli, Corone, Diademi,Elmi',[440.9,141.1,128.6,9.9]),('Fasce, Filatteri',[511.7,153.1,57.8,8.9]),('Amuleti, Collane, Medaglioni,',[34.1,212.2,121.7,10.5]),('Ninnoli, Pendenti, Sciarpe,',[35,224.9,109.2,9.8]),('Cappe, Coprispalle, Mantelli',[454.8,253.4,115.4,9.9]),('Abiti, Armature',[33.8,327.4,63.2,8.8]),('Maglie, Tuniche, Sottovesti',[458.9,345.1,109.7,9.9]),('Vesti',[549.6,357.8,19,6.8]),('Guanti, Guanti d’arme, Tirapugni',[34.6,432.5,136.8,9.8]),('Copribraccia, Bracciali,',[476.2,450.2,93.1,9.9]),('Braccialetti',[525.4,462.2,44.1,7.5]),('Cinture, Fasce',[35,534.7,57.6,8.2]),('Anelli, Ditali',[519.6,579.8,49.9,8.9]),('Sandali, Scarpe, Stivali',[34.6,625.9,92.1,9.9]),('Armi da mischia/distanza, Bastoni,',[412.3,748.1,145.2,9.8]),('Bacchette, Scudi',[490.6,760.1,66.9,8.9]),('Pozioni, Pergamene, Tratti, Ecc.',[82.9,765.1,130,7.9])]:text(s,box)
 slots=[('Viso',(66,90,218,141)),('Collo',(78,161,230,212)),('Corpo',(78,272,230,323)),('Mani',(70,380,223,431)),('Vita',(63,481,215,532)),('Piedi',(66,571,218,623)),('Testa',(385,90,538,141)),('Schiena',(366,201,518,252)),('Torso',(378,291,531,342)),('Braccia',(366,399,518,450)),('Anello 1',(272,509,423,560)),('Anello 2',(423,509,575,560)),('Arma 1',(372,594,525,645)),('Arma 2',(372,643,525,695)),('Arma 3',(372,693,525,744)),('Altro 1',(28,659,181,710)),('Altro 2',(181,659,333,710)),('Altro 3',(28,708,181,760)),('Altro 4',(181,708,333,760))]
 for name,(x,y,r,b) in slots:
  field('equipment','slot.'+name+'.name','Nome slot '+name,[x+10,y+4,r-x-18,7])
  field('equipment','slot.'+name+'.description','Descrizione slot '+name,[x+10,y+17,r-x-18,b-y-21],'textarea')
  left=name in ['Viso','Collo','Corpo','Mani','Vita','Piedi'] or name.startswith('Altro')
  field('checks','slot.'+name+'.active','Attivo slot '+name,[x+3.5 if left else r-9,y+2,7.5,7.5],'checkbox')
 for i,x in enumerate([475,494.5,514]):field('checks',f'attunement.{i}',f'Sintonia attiva {i+1}',[x+2,68,7,7],'checkbox')
 field('identity','name','Nome del personaggio',[203,56,193,19])
 regions=[('header',(184,9,426,88)),('attunement',(449,50,549,82)),('silhouette',(92,116,531,678))]
 regions += [(re.sub(' ','-',name.lower()),box) for name,box in slots]
 ornaments=trace(3,regions,texts,slots)
 (ROOT/'src/barbarian/page3.json').write_text(json.dumps({'width':595.2,'height':793.68,'ornaments':ornaments,'texts':texts,'fields':fields},ensure_ascii=False,indent=2))
 print('Page 3:',len(ornaments),'ornaments',len(texts),'text lines',len(fields),'fields')

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('page',type=int,choices=[2,3]);args=p.parse_args()
 if args.page==2:page2()
 else:page3()
