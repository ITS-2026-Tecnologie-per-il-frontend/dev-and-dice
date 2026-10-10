"""PHB gear table, visually read on PDF 151; effects read on PDF 152–154."""
from curated import record, source
from spell_extract import slug

# English; Italian paraphrase; cost; unit; pounds (None = dash, not zero).
ROWS = '''Abacus|Abaco|2|gp|2
Acid (vial)|Acido, fiala|25|gp|1
Alchemist's fire (flask)|Fuoco dell'alchimista, ampolla|50|gp|1
Arrows (20)|Frecce, 20|1|gp|1
Blowgun needles (50)|Aghi da cerbottana, 50|1|gp|1
Crossbow bolts (20)|Quadrelli, 20|1|gp|1.5
Sling bullets (20)|Proiettili da fionda, 20|4|cp|1.5
Antitoxin (vial)|Antitossina, fiala|50|gp|-
Crystal|Cristallo arcano|10|gp|1
Orb|Globo arcano|20|gp|3
Rod|Verga arcana|10|gp|2
Staff|Bastone arcano|5|gp|4
Wand|Bacchetta arcana|10|gp|1
Backpack|Zaino|2|gp|5
Ball bearings (bag of 1,000)|Sfere metalliche, 1000|1|gp|2
Barrel|Barile|2|gp|70
Basket|Cesta|4|sp|2
Bedroll|Giaciglio|1|gp|7
Bell|Campanella|1|gp|-
Blanket|Coperta|5|sp|3
Block and tackle|Carrucola|1|gp|5
Book|Libro|25|gp|5
Bottle, glass|Bottiglia di vetro|2|gp|2
Bucket|Secchio|5|cp|2
Caltrops (bag of 20)|Triboli, 20|1|gp|2
Candle|Candela|1|cp|-
Case, crossbow bolt|Custodia per quadrelli|1|gp|1
Case, map or scroll|Custodia per mappe o pergamene|1|gp|1
Chain (10 feet)|Catena, 10 piedi|5|gp|10
Chalk (1 piece)|Gesso|1|cp|-
Chest|Forziere|5|gp|25
Climber's kit|Kit da scalatore|25|gp|12
Clothes, common|Abiti comuni|5|sp|3
Clothes, costume|Costume|5|gp|4
Clothes, fine|Abiti pregiati|15|gp|6
Clothes, traveler's|Abiti da viaggiatore|2|gp|4
Component pouch|Borsa delle componenti|25|gp|2
Crowbar|Piede di porco|2|gp|5
Sprig of mistletoe|Ramoscello di vischio|1|gp|-
Totem|Totem druidico|1|gp|-
Wooden staff|Bastone di legno|5|gp|4
Yew wand|Bacchetta di tasso|10|gp|1
Fishing tackle|Attrezzatura da pesca|1|gp|4
Flask or tankard|Ampolla o boccale|2|cp|1
Grappling hook|Rampino|2|gp|4
Hammer|Martello|1|gp|3
Hammer, sledge|Maglio|2|gp|10
Healer's kit|Kit del guaritore|5|gp|3
Amulet|Amuleto sacro|5|gp|1
Emblem|Emblema sacro|5|gp|-
Reliquary|Reliquiario|5|gp|2
Holy water (flask)|Acqua santa, ampolla|25|gp|1
Hourglass|Clessidra|25|gp|1
Hunting trap|Trappola da caccia|5|gp|25
Ink (1 ounce bottle)|Inchiostro, un'oncia|10|gp|-
Ink pen|Pennino|2|cp|-
Jug or pitcher|Brocca|2|cp|4
Ladder (10-foot)|Scala, 10 piedi|1|sp|25
Lamp|Lampada|5|sp|1
Lantern, bullseye|Lanterna a lente|10|gp|2
Lantern, hooded|Lanterna schermabile|5|gp|2
Lock|Serratura|10|gp|1
Magnifying glass|Lente d'ingrandimento|100|gp|-
Manacles|Manette|2|gp|6
Mess kit|Gavetta|2|sp|1
Mirror, steel|Specchio d'acciaio|5|gp|0.5
Oil (flask)|Olio, ampolla|1|sp|1
Paper (one sheet)|Carta, foglio|2|sp|-
Parchment (one sheet)|Pergamena, foglio|1|sp|-
Perfume (vial)|Profumo, fiala|5|gp|-
Pick, miner's|Piccone|2|gp|10
Piton|Chiodo da roccia|5|cp|0.25
Poison, basic (vial)|Veleno base, fiala|100|gp|-
Pole (10-foot)|Pertica, 10 piedi|5|cp|7
Pot, iron|Pentola di ferro|2|gp|10
Potion of healing|Pozione di guarigione|50|gp|0.5
Pouch|Borsello|5|sp|1
Quiver|Faretra|1|gp|1
Ram, portable|Ariete portatile|4|gp|35
Rations (1 day)|Razioni, un giorno|5|sp|2
Robes|Vesti|1|gp|4
Rope, hempen (50 feet)|Corda di canapa, 50 piedi|1|gp|10
Rope, silk (50 feet)|Corda di seta, 50 piedi|10|gp|5
Sack|Sacco|1|cp|0.5
Scale, merchant's|Bilancia|5|gp|3
Sealing wax|Ceralacca|5|sp|-
Shovel|Pala|2|gp|5
Signal whistle|Fischietto|5|cp|-
Signet ring|Anello con sigillo|5|gp|-
Soap|Sapone|2|cp|-
Spellbook|Libro degli incantesimi|50|gp|3
Spikes, iron (10)|Chiodi di ferro, 10|1|gp|5
Spyglass|Cannocchiale|1000|gp|1
Tent, two-person|Tenda per due|2|gp|20
Tinderbox|Acciarino|5|sp|1
Torch|Torcia|1|cp|1
Vial|Fiala|1|gp|-
Waterskin|Otre|2|sp|5
Whetstone|Cote|1|cp|1'''

EFFECTS = {
 'antitoxin-vial':(152,{'saveAdvantageAgainst':'poison','durationHours':1,'excludedCreatureTypes':['undead','construct']}),
 'ball-bearings-bag-of-1-000':(152,{'activation':'action','squareSideFt':10,'save':{'ability':'dexterity','DC':10},'failure':'prone','avoidSave':'half-speed'}),
 'block-and-tackle':(152,{'liftMultiplier':4}),
 'caltrops-bag-of-20':(152,{'activation':'action','squareSideFt':5,'save':{'ability':'dexterity','DC':15},'failure':{'stopMovement':True,'damage':1,'damageType':'piercing','walkingSpeedPenaltyFt':10},'endsSpeedPenalty':'regain-at-least-one-hit-point','avoidSave':'half-speed'}),
 'candle':(152,{'durationHours':1,'brightRadiusFt':5,'additionalDimFt':5}),
 'chain-10-feet':(152,{'hitPoints':10,'breakStrengthDC':20}),
 'climber-s-kit':(152,{'anchorActivation':'action','maxFallFromAnchorFt':25,'maxDistanceFromAnchorFt':25}),
 'crowbar':(152,{'advantage':'strength-check-when-leverage-applies'}),
 'healer-s-kit':(152,{'uses':10,'activation':'action','spend':1,'effect':'stabilize-zero-hit-point-creature-without-medicine-check'}),
 'holy-water-flask':(152,{'activation':'action','attack':'ranged-improvised','splashWithinFt':5,'throwRangeFt':20,'damage':'2d6','damageType':'radiant','affectsTypes':['fiend','undead']}),
 'poison-basic-vial':(154,{'activation':'action','coatsChoice':['one-slashing-or-piercing-weapon','three-ammunition'],'potencyMinutes':1,'save':{'ability':'constitution','DC':10},'failureDamage':'1d4','damageType':'poison'}),
 'potion-of-healing':(154,{'activation':'action','canAdminister':True,'healing':'2d4+2'}),
 'ram-portable':(154,{'doorStrengthCheckBonus':4,'oneHelperGivesAdvantage':True}),
 'rope-hempen-50-feet':(154,{'hitPoints':2,'breakStrengthDC':17}),
 'rope-silk-50-feet':(154,{'hitPoints':2,'breakStrengthDC':17}),
 'spellbook':(154,{'blankPages':100}),
 'spyglass':(154,{'magnification':2}),
 'tent-two-person':(154,{'sleepingCapacity':2}),
 'tinderbox':(154,{'abundantFuelLight':'action','otherFireMinutes':1}),
 'torch':(154,{'durationHours':1,'brightRadiusFt':20,'additionalDimFt':20,'burningMeleeHit':{'damage':1,'damageType':'fire'}}),
}


def gear():
    result=[]
    for row in ROWS.splitlines():
        name,it,cost,unit,weight=row.split('|')
        index=slug(name)
        m={'cost':{'quantity':float(cost),'unit':unit},'weightLb':None if weight=='-' else float(weight),
           'weightStatus':'unspecified-in-source' if weight=='-' else 'stated','effect':None}
        batch={'arrows-20':20,'blowgun-needles-50':50,'crossbow-bolts-20':20,'sling-bullets-20':20,
               'ball-bearings-bag-of-1-000':1000,'caltrops-bag-of-20':20,'spikes-iron-10':10}
        m['purchaseQuantity']=batch.get(index,1)
        missing=['effect']
        if index in EFFECTS:
            page,m['effect']=EFFECTS[index]
            missing=[]
        # A table identity and price do not establish every descriptive effect.
        r=record('gear',index,name,it,151,m,'Costo e peso verificati nella tabella; il peso non indicato resta nullo.',missing=missing)
        r['sources'][0]['verification']='read-local-render'
        if index in EFFECTS:
            r['sources'].append(source(page,name));r['fieldSources']['effect']=[1]
        if index=='waterskin':
            r['mechanics']['weightIncludesContents']=True;r['fieldSources']['weightIncludesContents']=[0]
        result.append(r)
    return result


PACKS = {
 'burglars':('Burglar\'s Pack','Dotazione da scassinatore',16,{'backpack':1,'ball-bearings-bag-of-1-000':1,'bell':1,'candle':5,'crowbar':1,'hammer':1,'piton':10,'lantern-hooded':1,'oil-flask':2,'rations-1-day':5,'tinderbox':1,'waterskin':1,'rope-hempen-50-feet':1},[{'name':'String','quantity':10,'unit':'ft'}]),
 'diplomats':('Diplomat\'s Pack','Dotazione da diplomatico',39,{'chest':1,'case-map-or-scroll':2,'clothes-fine':1,'ink-1-ounce-bottle':1,'ink-pen':1,'lamp':1,'oil-flask':2,'paper-one-sheet':5,'perfume-vial':1,'sealing-wax':1,'soap':1},[]),
 'dungeoneers':('Dungeoneer\'s Pack','Dotazione da esploratore di dungeon',12,{'backpack':1,'crowbar':1,'hammer':1,'piton':10,'torch':10,'tinderbox':1,'rations-1-day':10,'waterskin':1,'rope-hempen-50-feet':1},[]),
 'entertainers':('Entertainer\'s Pack','Dotazione da intrattenitore',40,{'backpack':1,'bedroll':1,'clothes-costume':2,'candle':5,'rations-1-day':5,'waterskin':1},[{'name':'Disguise kit','quantity':1,'toolIndex':'disguise-kit'}]),
 'explorers':('Explorer\'s Pack','Dotazione da esploratore',10,{'backpack':1,'bedroll':1,'mess-kit':1,'tinderbox':1,'torch':10,'rations-1-day':10,'waterskin':1,'rope-hempen-50-feet':1},[]),
 'priests':('Priest\'s Pack','Dotazione da sacerdote',19,{'backpack':1,'blanket':1,'candle':10,'tinderbox':1,'rations-1-day':2,'waterskin':1},[{'name':'Alms box','quantity':1},{'name':'Incense blocks','quantity':2},{'name':'Censer','quantity':1},{'name':'Vestments','quantity':1}]),
 'scholars':('Scholar\'s Pack','Dotazione da studioso',40,{'backpack':1,'book':1,'ink-1-ounce-bottle':1,'ink-pen':1,'parchment-one-sheet':10},[{'name':'Small bag of sand','quantity':1},{'name':'Small knife','quantity':1}]),
}


def packs():
    result=[]
    for index,(name,it,cost,contents,unpriced) in PACKS.items():
        m={'cost':{'quantity':cost,'unit':'gp'},'contents':[{'entityId':'phb2014:gear:'+i,'quantity':q} for i,q in contents.items()],'additionalContents':unpriced,'weightLb':None}
        r=record('equipment-pack',index+'-pack',name,it,152,m,'Acquisto cumulativo a prezzo fisso; non sostituire il prezzo con la somma dei componenti.',missing=['weightLb'])
        result.append(r)
    return result
