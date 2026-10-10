import json,re
from pathlib import Path
base=Path(__file__).resolve().parents[1];layout=json.loads((base/'.pdf-fidelity/barbaro/page-001-layout.json').read_text())
texts=layout['texts']
fix={'PRIVILEG1O':'PRIVILEGIO','VANTAGG10':'VANTAGGIO','GUADAGNI |':'GUADAGNI I','TUTTI |':'TUTTI I','TUTTI|':'TUTTI','1 TIRI':'I TIRI','SENsSO':'SENSO','SENsSO':'SENSO','LECGERE':'LEGGERE','FINCHE':'FINCHÉ','FORRZA':'FORZA','SCUDOO.':'SCUDO.','A O PUNTI':'A 0 PUNTI','VELOCITA':'VELOCITÀ','FURTIVITA':'FURTIVITÀ','RAPIDITA':'RAPIDITÀ',' E PARI':' È PARI',' E COSI':' È COSÌ',' E INFERIORE':' È INFERIORE',' E 24,':' È 24.','Scupi':'SCUDI','Lunco.':'LUNGO.','INIZIATIVE':'INIZIATIVE','PuoOI':'PUOI',' LATUA':' LA TUA','LATUA':'LA TUA',' ARMA DA':' ARMA DA','DICOSTITUZIONE':'DI COSTITUZIONE','ILTUO':'IL TUO','L’IRA':'L’IRA','©':'O','Al ':'AI ','ArMATURE':'ARMATURE'}
for t in texts:
 for a,b in fix.items():t['text']=t['text'].replace(a,b)
 t['text']=t['text'].upper()
# Remove incomplete/noisy OCR; the source lettering below is transcribed manually.
texts=[t for t in texts if not any(s in t['text'] for s in ['NTELLIGENZA','ARISMA','BORSA DA ER','D ARNESI','ENTRTI','COSTITUZIONE Y','SAGGEZZA Y','GIOCHI :','GASC','\\EASE'])]
def text(s,box,kind='label'):
 texts.append({'text':s,'box':box,'kind':kind})
for s,box in [('Intelligenza',[18,408.24,41.76,3.84]),('Carisma',[25.2,556.8,25.44,3.84]),('Costituzione',[16.8,333.2,43.2,3.84]),('Saggezza',[22.8,481.68,30.48,3.84]),('CA',[233,110,9,4.6]),('Velocità',[338.9,109.1,36,5.4]),('Tiro Salvezza',[106.32,187.2,51.84,5.52]),('Tipo',[373.2,309.1,13.9,4.3]),('Tiro Salvezza',[106.6,335.5,51.6,5.5]),('Punti Ferita',[247.2,170.3,51.5,5.9]),('Attuali',[244.9,183.8,21,4.4]),('Percezione',[37.9,140.4,35.9,4.4]),('Passiva',[37.9,147.4,25,4.4]),('Ispirazione',[110.6,143,35.3,4.4]),('No',[220,139.2,4.1,2]),('Armatura',[215.9,142.6,12.5,2]),('No',[250,139.2,4.1,2]),('Scudo',[247.8,143,10,2]),('d12',[247,283.4,14,5.8]),('Liv',[424,63.5,6.2,3.2]),('Arnesi da falsario',[84.7,750.1,37.3,2.9]),('Arnesi da scasso',[136.4,750.1,36.5,2.9]),('Borsa da erborista',[84.7,760.9,37.5,2.9]),('Giochi:',[84.7,799.1,16.3,2.9]),('Veicoli:',[84.7,823.5,18,2.9]),('Se entrti in ira prima di ogni altra azione.',[412.1,386.9,112.1,2.6])]:text(s,box)
# Retain the source typo “entrti” as printed rather than silently rewriting a rule.
for y in [242.64,317.76,390.96,466.08,542.16,615.12]:text('Base',[8.88,y,7.68,2.88],'base')
for y,n in [(95.5,3),(182.5,5),(226.3,5),(269,6),(356,7),(408.5,9),(469,10),(547,11),(612.5,14),(697,15),(745.5,18),(794.2,20)]:
 text('LEVEL',[575,y,12,3],'level');text(str(n),[572 if n>9 else 576,y+6,17 if n>9 else 9.2,12.5],'number')
for y,n in [(560,1),(681,1),(730,2),(792,2)]:text('LEVEL',[377,y,12,3],'level');text(str(n),[377,y+6,9.2,12.5],'number')
for x,n in [(414,13),(499,17)]:text('LEVEL',[x-1,441,8,2],'level');text(str(n),[x-1,444,8,6],'number')
for i in range(6):text(str(i+1),[310.3+i*13.3,254.5,3.4,5],'number')
# Positions of real inputs follow the source empty spaces, not invented controls.
fields=[]
def field(group,key,label,box,kind='text',**kw):fields.append({'group':group,'key':key,'label':label,'box':box,'kind':kind,**kw})
for key,label,box in [('name','Nome del personaggio',[16,35,184,26]),('race','Razza',[216,23,86,17]),('background','Background',[304,23,81,17]),('alignment','Allineamento',[216,51,86,16]),('player','Giocatore',[304,51,81,16]),('level','Livello',[417,68,18,9]),('path','Cammino primordiale',[449,60,125,17])]:field('identity',key,label,box,'number' if key=='level' else 'text',**({'min':1,'max':20} if key=='level' else {}))
for key,label,box,kind in [('proficiency','Competenza',[130,98,23,22],'number'),('passive','Percezione passiva',[7,135,21,18],'number'),('inspiration','Ispirazione',[159,136,19,18],'checkbox')]:field('combat',key,label,box,kind)
abilities=[('strength','Forza',180,[(194.8,'Atletica')]),('dexterity','Destrezza',255,[(271.6,'Acrobazia'),(281.5,'Furtività'),(291.4,'Rapidità di Mano')]),('constitution','Costituzione',329,[]),('intelligence','Intelligenza',403,[(420.5,'Arcano'),(430.4,'Indagare'),(440.3,'Natura'),(450.2,'Religione'),(460.1,'Storia')]),('wisdom','Saggezza',478,[(495.2,'Addestrare Animali'),(505.2,'Intuizione'),(515.2,'Medicina'),(525.2,'Percezione'),(535.2,'Sopravvivenza')]),('charisma','Carisma',552,[(569.2,'Inganno'),(579.2,'Intimidire'),(589.2,'Intrattenere'),(599.2,'Persuasione')])]
for key,label,y,skills in abilities:
 field('abilities',key,label,[17,y+12,42,31],'number',min=1,max=30)
 field('abilities',key+'Modifier','Modificatore '+label,[25,y+47,25,11],'number')
 field('abilities',key+'Base','Valore base '+label,[7,y+53,11,8],'number')
 field('checks','save.'+key,'Competenza tiro salvezza '+label,[79,y+6,7,7],'checkbox')
 field('abilities',key+'Save','Tiro salvezza '+label,[91,y+6,11,8],'number')
 for sy,skill in skills:
  field('checks','skill.'+skill,'Competenza '+skill,[78.2,sy+1.5,7.5,7.5],'checkbox')
  field('checks','expert.'+skill,'Maestria '+skill,[76.8,sy,3.7,3.7],'checkbox')
  field('abilities','skill.'+skill,'Bonus '+skill,[90.8,sy-1,11,7],'number')
for key,label,box,kind in [('armorClass','Classe armatura',[222,118,31,18],'number'),('unarmored','Senza armatura',[218,149,12,7],'number'),('shield','Scudo',[248,149,12,7],'number'),('initiative','Iniziativa',[276,119,43,32],'number'),('speed','Velocità',[337,120,42,31],'number'),('maxHP','Punti ferita massimi',[215,170,24,19],'number'),('currentHP','Punti ferita attuali',[217,194,112,32],'number'),('temporaryHP','Punti ferita temporanei',[347,185,33,41],'number'),('hitDiceTotal','Dadi vita totali',[217,261,35,21],'number'),('hitDiceUsed','Dadi vita usati',[258,261,32,21],'number'),('hitDice','Tipo dado vita',[247,282,14,8],'select'),('exhaustion','Livelli di indebolimento',[0,0,0,0],'number'),('rageTotal','Ira totale',[230,455,32,18],'number'),('rageUsed','Ira usata',[270,455,31,18],'number'),('rageDamage','Danni da ira',[260,476,13,12],'number'),('brutalCritical','Critico brutale: dadi aggiuntivi',[335,454,29,27],'number')]:
 if key!='exhaustion':field('combat',key,label,box,kind,**({'options':['d6','d8','d10','d12'],'initial':'d12'} if kind=='select' else {}))
for i in range(6):field('checks',f'exhaustion.{i+1}',f'Indebolimento livello {i+1}',[308+i*13.3,252.4,8.1,8.1],'checkbox')
for outcome,x in [('failure',308),('success',348)]:
 for i in range(3):field('checks',f'death.{outcome}.{i}',f'Salvezza da morte {outcome} {i+1}',[x+i*13.3,279,8.2,8.2],'checkbox')
for i,(y,n) in enumerate([(95.5,3),(182.5,5),(226.3,5),(269,6),(356,7),(408.5,9),(469,10),(547,11),(612.5,14),(697,15),(745.5,18),(794.2,20)]):field('checks',f'privilege.right.{i}',f'Privilegio destro {i+1}, livello {n}',[578.1,y+18.2,4.8,4.8],'checkbox')
for i,(y,n) in enumerate([(560,1),(681,1),(730,2),(792,2)]):field('checks',f'privilege.center.{i}',f'Privilegio centrale {i+1}, livello {n}',[379.2,y+17.8,4.8,4.8],'checkbox')
for i,x in enumerate([414,499]):field('checks',f'privilege.critical.{i}',f'Critico brutale livello {13 if i==0 else 17}',[x+1,448,2.4,2.4],'checkbox')
for row in range(6):
 for key,label,x,w,kind in [('name','Attacco',212,87,'text'),('bonus','Bonus TpC',307,20,'number'),('damage','Danni',334,34,'text'),('type','Tipo',376,9,'text')]:field('attacks',f'{row}.{key}',f'{label} {row+1}',[x,318+row*17.4,w,9],kind)
field('notes','languages','Linguaggi, tratti e privilegi aggiuntivi',[12,649,169,73],'textarea')
field('notes','combatFeatures','Privilegi di combattimento addizionali',[211,520,174,31],'textarea')
for i,(y,b) in enumerate([(91,177),(265,350),(464,545),(609,695)]):field('features',f'path.{i}','Privilegio del cammino primordiale '+str(i+1),[412,y+24,169,b-y-30],'textarea')
for name,x,y in [('Armature leggere',18,768),('Armature medie',18,794),('Armature pesanti',18,819),('Armi semplici',46,768),('Armi da guerra',46,794),('Scudi',46,819)]:field('checks','training.'+name,name,[x,y,7,7],'checkbox')
for name,x,y in [('Arnesi da falsario',75,750),('Borsa da erborista',75,760),('Strumenti da navigatore',75,771),('Strumenti da artigiano',75,786),('Giochi',75,799),('Strumenti musicali',75,811),('Veicoli',75,824),('Arnesi da scasso',128,750),('Sostanze da avvelenatore',128,761),('Trucchi per camuffamento',128,773)]:field('checks','tool.'+name,name,[x,y,7,7],'checkbox')
for name,y in [('Giochi',799),('Strumenti musicali',811),('Veicoli',824)]:field('notes','tool.'+name,'Descrizione '+name,[115,y,64,7])
for t in texts:
 if 'kind' not in t:
  x,y,w,h=t['box'];t['kind']='body' if (x>=210 and y>560 and len(t['text'])>35) or (x>400 and len(t['text'])>40) else 'label'
 if t['text']=='D12': t['text']='d12'
for t in texts:
 if t['text'].upper() in ['FORZA','DESTREZZA','COSTITUZIONE','INTELLIGENZA','SAGGEZZA','CARISMA','CA']:t['kind']='caps'
 if t['text']=='ATLETICA':t['box']=[106.32,196.56,30.96,5.52]
 if t['text']=='DA GUERRA':t['box']=[38.64,786,21.84,2.88]
# The editable hit-die selector owns its source lettering.
texts=[t for t in texts if t['text']!='d12']
unique=[]
for t in texts:
 if not any(u['text'].upper()==t['text'].upper() and abs(u['box'][0]-t['box'][0])<3 and abs(u['box'][1]-t['box'][1])<3 for u in unique):unique.append(t)
layout['texts']=unique;layout['fields']=fields
(base/'src/barbarian/page1.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2))
print(len(texts),'HTML text lines;',len(fields),'editable controls')
