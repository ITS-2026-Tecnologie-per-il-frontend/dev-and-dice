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
 'acid-vial':([149,152],{'activation':'action','attack':'ranged-improvised-against-creature-or-object','splashWithinFt':5,'throwMaximumFt':20,'damage':'2d6','damageType':'acid'}),
 'alchemist-s-fire-flask':([149,152],{'activation':'action','attack':'ranged-improvised-against-creature-or-object','throwMaximumFt':20,'onHit':{'damage':'1d4','damageType':'fire','when':'start-each-target-turn'},'extinguish':{'activation':'action','rollKind':'ability-check','ability':'dexterity','DC':10}}),
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
 'hunting-trap':(153,{'setActivation':'action','anchoredTo':'immobile-object','trigger':'step-on-center-plate','save':{'ability':'dexterity','DC':13},'failure':{'damage':'1d4','damageType':'piercing','stopMovement':True},'movementLimitedBy':'chain-length-typically-3-ft','release':{'activation':'action','rollKind':'ability-check','ability':'strength','DC':13,'target':'self-or-other-creature-within-reach'},'eachFailedReleaseCheck':{'damage':1,'damageType':'piercing'}}),
 'lamp':(153,{'brightRadiusFt':15,'additionalDimFt':30,'durationHoursPerPintOil':6}),
 'lantern-bullseye':(153,{'brightConeLengthFt':60,'additionalDimConeFt':60,'durationHoursPerPintOil':6}),
 'lantern-hooded':(153,{'brightRadiusFt':30,'additionalDimFt':30,'durationHoursPerPintOil':6,'lowerHood':{'activation':'action','dimRadiusFt':5,'brightRadiusFt':0}}),
 'lock':(153,{'includesKeys':1,'pick':{'requires':'thieves-tools-proficiency','rollKind':'ability-check','ability':'dexterity','DC':15},'betterLocks':'DM-may-offer-for-higher-price'}),
 'magnifying-glass':(153,{'appraiseOrInspectSmallOrDetailedItemChecks':'advantage','lightFire':{'requires':['at-least-sunlight-brightness','tinder'],'minutes':5}}),
 'manacles':(153,{'targetSizes':['Small','Medium'],'hitPoints':15,'includesKeys':1,'escape':{'rollKind':'ability-check','ability':'dexterity','DC':20},'break':{'rollKind':'ability-check','ability':'strength','DC':20},'pickLock':{'requires':'thieves-tools-proficiency','rollKind':'ability-check','ability':'dexterity','DC':15}}),
 'oil-flask':(153,{'volumePints':1,'attack':{'activation':'action','roll':'ranged-improvised-against-creature-or-object','splashWithinFt':5,'throwMaximumFt':20,'onHit':'covered-in-oil-for-one-minute','ifCoveredTargetTakesFireDamage':'additional-5-fire-damage'},'ground':{'squareSideFt':5,'requires':'level-surface','burnDurationRounds':2,'damage':5,'damageType':'fire','trigger':['enter-area','end-turn-in-area'],'maximumInstancesPerCreaturePerTurn':1}}),
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

CAPACITIES={
 'backpack':{'volumeCubicFt':1,'maximumContentsLb':30,'mayStrapItemsOutside':True},
 'barrel':{'liquidGallons':40,'solidCubicFt':4},'basket':{'volumeCubicFt':2,'maximumContentsLb':40},
 'bottle-glass':{'liquidPints':1.5},'bucket':{'liquidGallons':3,'solidCubicFt':0.5},
 'chest':{'volumeCubicFt':12,'maximumContentsLb':300},'flask-or-tankard':{'liquidPints':1},
 'jug-or-pitcher':{'liquidGallons':1},'pot-iron':{'liquidGallons':1},
 'pouch':{'volumeCubicFt':0.2,'maximumContentsLb':6,'exampleSlingBullets':20,'exampleBlowgunNeedles':50},
 'sack':{'volumeCubicFt':1,'maximumContentsLb':30},'vial':{'liquidOunces':4},'waterskin':{'liquidPints':4},
 'quiver':{'arrows':20},'case-crossbow-bolt':{'crossbowBolts':20},'case-map-or-scroll':{'rolledPaperSheets':10,'rolledParchmentSheets':5}
}

DESCRIPTIONS={
 'book':(152,{'role':'lore-or-diagrams-book-distinct-from-spellbook'},'Libro di conoscenze o diagrammi; distinto dal libro degli incantesimi.'),
 'component-pouch':(152,{'supplies':'spell-material-components-except-explicit-cost','waterproof':True},'Borsa impermeabile di componenti; non fornisce materiali con costo esplicito.'),
 'fishing-tackle':(152,{'contains':['wooden-rod','silken-line','cork-floats','steel-hooks','lead-sinkers','lures','narrow-net']},'Canna, lenza, galleggianti, ami, piombi, esche e rete da pesca.'),
 'mess-kit':(153,{'contains':['cup','cutlery','tin-box'],'boxHalvesUsableAs':['pan','plate-or-bowl']},'Gavetta con tazza e posate; le metà della scatola sono padella e piatto.'),
 'rations-1-day':(154,{'food':'dried-travel-food','daysPurchased':1},'Cibo secco da viaggio per un giorno.'),
 'scale-merchant-s':(154,{'preciselyWeighsMaximumLb':2},'Bilancia con pesi fino a due libbre per valutare piccoli oggetti.')
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
        # Chapter 5 explicitly lists the exceptional item descriptions. An
        # absent special effect is recorded as a source scope, not invented.
        missing=[]
        m['effect']={'additionalEffectInEquipmentChapter':'not-described'}
        if index in EFFECTS:
            page,m['effect']=EFFECTS[index]
            missing=[]
        # A table identity and price do not establish every descriptive effect.
        r=record('gear',index,name,it,151,m,'Costo e peso verificati nella tabella; il peso non indicato resta nullo.',missing=missing)
        r['sources'][0]['verification']='read-local-render'
        if index in EFFECTS:
            r['sources'].append(source(page,name));r['fieldSources']['effect']=[1]
            r['summaryIt']='Effetto speciale strutturato dal paragrafo dell’oggetto; costi e pesi della tabella restano distinti.'
        else:
            r['sources'].append(source([149,152,153,154],'Adventuring Gear; reviewed exception inventory'))
            r['fieldSources']['effect']=[1]
        if index in DESCRIPTIONS:
            page,effect,summary=DESCRIPTIONS[index];r['mechanics']['effect']=effect;r['summaryIt']=summary
            r['sources'].append(source(page,name));r['fieldSources']['effect']=[len(r['sources'])-1]
        if index in CAPACITIES:
            r['mechanics']['capacity']=CAPACITIES[index];r['sources'].append(source([152,154],'Container Capacity and item description'));r['fieldSources']['capacity']=[len(r['sources'])-1]
        if index in ['crystal','orb','rod','staff','wand','sprig-of-mistletoe','totem','wooden-staff','yew-wand','amulet','emblem','reliquary']:
            classes=['sorcerer','warlock','wizard'] if index in ['crystal','orb','rod','staff','wand'] else ['druid'] if index in ['sprig-of-mistletoe','totem','wooden-staff','yew-wand'] else ['cleric','paladin']
            r['mechanics']['effect']={'spellcastingFocusForClasses':classes,'materialComponentRules':'PHB-spellcasting-components-apply'}
            if classes==['cleric','paladin']:r['mechanics']['effect']['useChoice']=['held-in-hand','worn-visibly','on-shield']
            r['sources'].append(source(152,'Spellcasting Focus'));r['fieldSources']['effect']=[len(r['sources'])-1]
            r['summaryIt']='Focus per le classi indicate; il simbolo sacro può essere in mano, visibile indossato o sullo scudo. Le componenti costose o consumate seguono le regole della magia.' if classes==['cleric','paladin'] else 'Focus per le classi indicate, soggetto alle regole delle componenti della magia.'
        if index=='holy-water-flask':
            r['mechanics']['effect']['creation']={'eligibleClasses':['cleric','paladin'],'ritualHours':1,'powderedSilverGP':25,'spellSlotLevel':1}
            r['sources'].append(source(153,'Holy Water; creation'));r['fieldSources']['effect'].append(len(r['sources'])-1)
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
        m={'cost':{'quantity':cost,'unit':'gp'},'contents':[{'entityId':'phb2014:gear:'+i,'quantity':q} for i,q in contents.items()],'additionalContents':unpriced,'weightLb':None,'weightStatus':'whole-pack-weight-not-stated-in-source'}
        r=record('equipment-pack',index+'-pack',name,it,152,m,'Acquisto cumulativo a prezzo fisso; non sostituire il prezzo con la somma dei componenti. Il peso totale non è specificato, non è zero.')
        r['sources'][0]['verification']='read-local-render'
        result.append(r)
    return result


# PHB PDF 158 table: name, translation, gp, walking feet, base carrying pounds.
MOUNTS=[('Camel','Cammello',50,50,480),('Donkey or mule','Asino o Mulo',8,40,420),('Elephant','Elefante',200,40,1320),
 ('Horse, draft','Cavallo da Tiro',50,40,540),('Horse, riding','Cavallo da Sella',75,60,480),('Mastiff','Mastino',25,40,195),
 ('Pony','Pony',30,40,225),('Warhorse','Cavallo da Guerra',400,60,540)]
TACK=[('Bit and bridle','Morso e Briglia',2,'gp',1),('Carriage','Carrozza',100,'gp',600),('Cart','Carretto',15,'gp',200),
 ('Chariot','Biga',250,'gp',100),('Feed (per day)','Foraggio Giornaliero',5,'cp',10),('Saddle, exotic','Sella Esotica',60,'gp',40),
 ('Saddle, military','Sella Militare',20,'gp',30),('Saddle, pack','Sella da Soma',5,'gp',15),('Saddle, riding','Sella da Equitazione',10,'gp',25),
 ('Saddlebags','Borse da Sella',4,'gp',8),('Sled','Slitta',20,'gp',300),('Stabling (per day)','Stallaggio Giornaliero',5,'sp',None),('Wagon','Carro',35,'gp',400)]
SHIPS=[('Galley','Galea',30000,4),('Keelboat','Barca a Chiglia',3000,1),('Longship','Nave Lunga',10000,3),
 ('Rowboat','Barca a Remi',50,1.5),('Sailing ship','Veliero',10000,2),('Warship','Nave da Guerra',25000,2.5)]
TRADE=[('wheat','Grano',1,'cp','lb'),('flour','Farina',2,'cp','lb'),('chicken','Pollo',2,'cp','animal'),('salt','Sale',5,'cp','lb'),
 ('iron','Ferro',1,'sp','lb'),('canvas','Tela',1,'sp','square-yard'),('copper','Rame',5,'sp','lb'),('cotton-cloth','Cotone',5,'sp','square-yard'),
 ('ginger','Zenzero',1,'gp','lb'),('goat','Capra',1,'gp','animal'),('cinnamon','Cannella',2,'gp','lb'),('pepper','Pepe',2,'gp','lb'),('sheep','Pecora',2,'gp','animal'),
 ('cloves','Chiodi di Garofano',3,'gp','lb'),('pig','Maiale',3,'gp','animal'),('silver','Argento',5,'gp','lb'),('linen','Lino',5,'gp','square-yard'),
 ('silk','Seta',10,'gp','square-yard'),('cow','Mucca',10,'gp','animal'),('saffron','Zafferano',15,'gp','lb'),('ox','Bue',15,'gp','animal'),('gold','Oro',50,'gp','lb'),('platinum','Platino',500,'gp','lb')]
FOOD=[('Ale, gallon','Birra, Gallone',2,'sp','gallon'),('Ale, mug','Birra, Boccale',4,'cp','mug'),('Banquet','Banchetto',10,'gp','person'),
 ('Bread, loaf','Pane, Pagnotta',2,'cp','loaf'),('Cheese, hunk','Formaggio, Pezzo',1,'sp','hunk'),('Meat, chunk','Carne, Pezzo',3,'sp','chunk'),
 ('Wine, common','Vino Comune',2,'sp','pitcher'),('Wine, fine','Vino Pregiato',10,'gp','bottle')]
SERVICES=[('Coach between towns','Carrozza Fra Città',3,'cp','mile'),('Coach within city','Carrozza in Città',1,'cp','trip'),
 ('Hireling, skilled','Lavoratore Qualificato',2,'gp','day'),('Hireling, untrained','Lavoratore Non Qualificato',2,'sp','day'),
 ('Messenger','Messaggero',2,'cp','mile'),('Road or gate toll','Pedaggio Stradale',1,'cp','passage'),('Ship passage','Passaggio in Nave',1,'sp','mile')]


def trinkets():
    descriptions='''Mano di goblin conservata per mummificazione.
Cristallo dal tenue bagliore sotto la luna.
Moneta d’oro coniata in un paese sconosciuto.
Diario in una lingua che non conosci.
Anello d’ottone che non perde la lucentezza.
Vecchio pezzo degli scacchi di vetro.
Due dadi di ossicini: un teschio sostituisce il sei.
Idoletto di una creatura da incubo; dormire vicino causa sogni inquietanti.
Collana di corda con quattro dita elfiche mummificate.
Atto di proprietà di un terreno in un regno ignoto.
Blocco di materiale non identificato, del peso di un’oncia.
Bambolina di stoffa trafitta da aghi.
Dente appartenuto a una bestia sconosciuta.
Scaglia gigantesca, forse di drago.
Piuma verde brillante.
Vecchia carta da divinazione con il tuo ritratto.
Sfera di vetro con fumo in movimento all’interno.
Uovo da una libbra con guscio rosso vivo.
Pipa da cui escono bolle.
Vaso di vetro con carne insolita immersa in liquido conservante.
Minuscolo carillon gnomesco: la melodia ricorda vagamente la tua infanzia.
Statuina di legno di un halfling dall’espressione compiaciuta.
Sfera d’ottone incisa con rune bizzarre.
Dischetto di pietra dai molti colori.
Piccola icona d’argento di un corvo.
Sacchetto con quarantasette denti umanoidi, uno cariato.
Scheggia d’ossidiana sempre tiepida al tatto.
Artiglio osseo di drago su una semplice collana di cuoio.
Due vecchi calzini.
Libro vuoto: sulle pagine non restano inchiostro, gesso, grafite o altri segni.
Distintivo d’argento a stella con cinque punte.
Coltello già appartenuto a un tuo parente.
Fialetta di vetro contenente ritagli di unghie.
Dispositivo metallico rettangolare con due coppette a un’estremità; bagnato produce scintille.
Guanto bianco con lustrini, della misura di una mano umana.
Gilet dotato di cento minuscole tasche.
Blocchetto di pietra senza peso.
Piccolo schizzo del ritratto di un goblin.
Fialetta vuota che, aperta, sa di profumo.
Gemma che a tutti gli altri sembra un pezzo di carbone.
Ritaglio di stoffa di un antico stendardo.
Insegna di grado di un legionario scomparso.
Campanellino d’argento privo di battaglio.
Canarino meccanico dentro una lampada gnomesca.
Scrignetto scolpito come se avesse molti piedi sul fondo.
Sprite morto conservato in una bottiglia trasparente.
Barattolo metallico senza apertura; il rumore suggerisce liquido, sabbia, ragni o vetri, a scelta.
Sfera piena d’acqua con un pesciolino dorato a ingranaggi.
Cucchiaio d’argento con una M sul manico.
Fischietto di legno color oro.
Scarabeo morto grande quanto la tua mano.
Due soldatini giocattolo, uno senza testa.
Scatolina piena di bottoni di varie dimensioni.
Candela che non si riesce ad accendere.
Gabbietta sprovvista di sportello.
Chiave antica.
Mappa di un tesoro che non sai decifrare.
Impugnatura di una spada spezzata.
Zampa di coniglio.
Occhio di vetro.
Cammeo col volto di una persona orribile.
Teschietto d’argento delle dimensioni di una moneta.
Maschera d’alabastro.
Piramide d’incenso nero appiccicoso, dall’odore pessimo.
Berretto da notte che dona sogni piacevoli quando indossato.
Un solo tribolo d’osso.
Montatura d’oro di un monocolo senza lente.
Cubo di un pollice, con ciascuna faccia di un colore diverso.
Pomello di cristallo di una porta.
Pacchettino di polvere rosa.
Frammento di una bella melodia annotato su due pergamene.
Orecchino d’argento a goccia ricavato da una lacrima vera.
Guscio d’uovo dipinto con minuziose scene di sofferenza umana.
Ventaglio che aperto mostra un gatto addormentato.
Serie di canne musicali d’osso.
Quadrifoglio pressato in un libro di buone maniere.
Pergamena con il disegno di un congegno complesso.
Fodero ornato: nessuna lama trovata finora vi entra bene.
Invito a una festa durante la quale avvenne un omicidio.
Pentacolo di bronzo con una testa di ratto incisa al centro.
Fazzoletto viola ricamato col nome di un potente arcimago.
Metà della pianta di un tempio, castello o altra costruzione.
Stoffa ripiegata che, aperta, diventa un cappello elegante.
Ricevuta di deposito di una banca in una città remota.
Diario al quale mancano sette pagine.
Tabacchiera d’argento vuota con un’iscrizione riferita ai sogni.
Simbolo sacro di ferro di una divinità sconosciuta.
Libro sull’ascesa e caduta di un eroe leggendario, senza capitolo finale.
Fiala di sangue di drago.
Freccia antica di fattura elfica.
Ago che non si piega mai.
Spilla riccamente lavorata di fattura nanica.
Bottiglia di vino vuota con etichetta Wizard of Wines, Red Dragon Crush, codice 331422-W.
Tessera di mosaico smaltata in più colori.
Topo pietrificato.
Bandiera pirata nera con teschio di drago e ossa incrociate.
Piccolo granchio o ragno meccanico che si sposta solo quando nessuno lo osserva.
Vasetto di strutto etichettato come grasso di grifone.
Scatola di legno dal fondo ceramico con un verme vivo: ha una testa a entrambe le estremità.
Urna metallica con le ceneri di un eroe.'''.splitlines()
    rows=[{'roll':n,'index':f'trinket-{n:03}','summaryIt':text,'sourceIndex':0,'weightLb':{11:1/16,18:1,37:0}.get(n),'weightStatus':'stated' if n in [11,18,37] else 'not-stated','price':None,'priceStatus':'not-stated','gameStatisticsBeyondDescription':'not-stated'} for n,text in enumerate(descriptions,1)]
    if len(rows)!=100:raise ValueError('Trinket table must contain exactly one hundred reviewed entries')
    e=record('rule','trinkets','Trinkets','Cianfrusaglie',[161,162],{'tableDice':'d100','rows':rows,'creationRollsAllowed':1,'creationRollOptional':True,'DMMayUseToPopulate':'rooms-and-creature-pockets','notAStandardPricedMagicItemCatalog':True},'Alla creazione puoi tirare una volta sulla tabella d100 per ottenere una cianfrusaglia misteriosa; il DM può usarla per arricchire stanze e tasche. Descrizioni non equivalgono a bonus o statistiche di oggetti magici.')
    e['sources'][0]['verification']='read-local-render';e['sources'].append(source(160,'Trinkets: creation and DM use'));e['fieldSources']['creationRollsAllowed']=[1];e['fieldSources']['creationRollOptional']=[1];e['fieldSources']['DMMayUseToPopulate']=[1]
    return e


def market():
    result=[]
    def add(index,name,it,page,category,cost,unit,weight,effect,price_unit='purchase'):
        m={'category':category,'cost':{'quantity':cost,'unit':unit},'purchaseQuantity':1,'priceUnit':price_unit,
           'weightLb':weight,'weightStatus':'stated' if weight is not None else 'not-stated-in-source','effect':effect}
        r=record('gear',index,name,it,page,m,'Costo per l’unità indicata, dalla tabella del PHB; peso assente conservato come nullo. Effetti e capacità sono separati dal prezzo.')
        r['sources'][0]['verification']='read-local-render';result.append(r)
    for name,it,cost,speed,capacity in MOUNTS:
        add('mount-'+slug(name),name,it,158,'mount',cost,'gp',None,{'walkingSpeedFt':speed,'baseCarryingCapacityLb':capacity,'creatureStatisticsVerifiedByMarketTable':False})
    for name,it,cost,unit,weight in TACK:
        effect={'additionalSpecialEffect':'not-stated'}
        if name=='Saddle, military':effect={'advantageOn':'checks-to-remain-mounted'}
        elif name=='Saddle, exotic':effect={'requiredFor':['aquatic-mount','flying-mount']}
        add('tack-'+slug(name),name,it,158,'tack-or-land-vehicle',cost,unit,weight,effect,'day' if '(per day)' in name else 'purchase')
        if name in ['Saddle, military','Saddle, exotic']:
            result[-1]['sources'].append(source(156,'Saddles'));result[-1]['fieldSources']['effect']=[1]
    for name,it,cost,speed in SHIPS:
        add('vehicle-'+slug(name),name,it,158,'water-vehicle',cost,'gp',100 if name=='Rowboat' else None,{'speedMilesPerHour':speed,'rowed':name in ['Rowboat','Keelboat']})
        if name=='Rowboat':result[-1]['sources'].append(source([156,158],'Rowed Vessels'));result[-1]['fieldSources']['weightLb']=[1]
    for index,it,cost,unit,price_unit in TRADE:add('trade-'+index,index.title(),it,158,'trade-good',cost,unit,1 if price_unit=='lb' else None,{'fullResaleValue':True},price_unit)
    for name,it,cost,unit,price_unit in FOOD:add('food-'+slug(name),name,it,159,'food-drink',cost,unit,None,{},price_unit)
    for name,it,cost,unit,price_unit in SERVICES:
        effect={'minimumPrice':True} if name=='Hireling, skilled' else {}
        add('service-'+slug(name),name,it,160,'service',cost,unit,None,effect,price_unit)
    levels=[('Squalid','Squallido',1,'sp'),('Poor','Povero',2,'sp'),('Modest','Modesto',1,'gp'),('Comfortable','Confortevole',2,'gp'),('Wealthy','Ricco',4,'gp'),('Aristocratic','Aristocratico',10,'gp')]
    add('lifestyle-wretched','Wretched','Misero',158,'lifestyle',0,'cp',None,{'fixedBenefits':'not-guaranteed'},'day')
    for n,(name,it,cost,unit) in enumerate(levels):
        add('lifestyle-'+slug(name),name,it,158,'lifestyle',cost,unit,None,{'minimumPrice':name=='Aristocratic','includes':['lodging','food-and-drink','other-necessities','equipment-maintenance']},'day')
        add('lodging-'+slug(name),'Inn stay: '+name,'Pernottamento: '+it,159,'lodging',[7,10,50,80,200,400][n],'cp',None,{'alreadyIncludedInLifestyle':True},'day')
        add('meals-'+slug(name),'Meals: '+name,'Pasti: '+it,159,'food-drink',[3,6,30,50,80,200][n],'cp',None,{'alreadyIncludedInLifestyle':True},'day')
    rules=[
      ('vehicle-and-barding','Vehicles and Barding','Veicoli e Bardature',[156,158],{'drawnVehicles':['carriage','cart','chariot','sled','wagon'],'maximumPulledWeight':'5*sum-animal-base-carrying-capacity','includesVehicleWeight':True,'barding':{'priceMultiplier':4,'weightMultiplier':2},'vehicleProficiency':'add-proficiency-to-control-in-difficult-circumstances','downstreamRowedSpeed':'vehicle-speed-plus-current-speed','typicalCurrentMilesPerHour':3,'rowAgainstSignificantCurrent':False,'towUpstream':'draft-animals-on-shore'},'Il tiro trainato permette cinque volte la somma delle capacità degli animali, includendo il veicolo. Bardatura: quadruplo prezzo e doppio peso. Le imbarcazioni a remi sommano la corrente a favore e richiedono traino contro correnti significative.'),
      ('selling-equipment','Selling Treasure','Vendere Tesori',145,{'undamagedMundaneEquipmentResaleFraction':0.5,'gemsArtTradeGoodsResaleFraction':1,'magicItemMarket':'not-guaranteed','monsterEquipment':'rarely-saleable-condition','buyerRequired':True},'Equipaggiamento integro normalmente a metà prezzo; gemme, arte e merci a valore pieno, trovando un compratore. Oggetti magici non hanno un mercato garantito.'),
      ('spellcasting-service','Spellcasting Services','Servizi Magici',160,{'standardFixedRates':False,'commonFirstOrSecondLevelSpellTypicalGoldRange':[10,50],'addExpensiveMaterials':True,'higherLevelAvailability':'harder-to-find-may-require-quest-instead-of-money'},'Una magia comune di primo o secondo livello può costare fra dieci e cinquanta mo più materiali costosi; non è un tariffario universale. Magie superiori possono richiedere viaggi o missioni.'),
      ('self-sufficiency','Self-sufficiency','Autosufficienza',160,{'coinCost':0,'requires':'time-outside-adventures-maintaining-self','professionEquivalentLifestyle':'poor','ifSurvivalProficientEquivalentLifestyle':'comfortable'},'L’autosufficienza consuma tempo senza monete: vivere del proprio lavoro equivale a povero, competenza in Sopravvivenza a confortevole.')
    ]
    for index,name,it,page,m,summary in rules:result.append(record('rule',index,name,it,page,m,summary))
    return result
