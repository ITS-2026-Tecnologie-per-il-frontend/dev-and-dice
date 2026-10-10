"""Paraphrased facts checked against the indicated local PHB pages.

This is an independent reference, not a copy of the existing SRD database.
Page numbers are 1-based PDF numbers; this PHB has printed page = PDF page - 1.
No category is marked complete merely because its identities are present.
"""
from __future__ import annotations

from pdf_sources import BOOKS

ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']


def source(pages, section, book='phb'):
    if isinstance(pages, int):
        pages = [pages]
    return {'edition': '2014', 'book': book, 'filename': BOOKS[book],
            'pdfPages': pages, 'printedPages': [p - 1 for p in pages] if book == 'phb' else None,
            'section': section, 'verification': 'read-local-text'}


def record(kind, index, name, italian, pages, mechanics=None, summary=None, *, book='phb', missing=None, optional=False):
    return {'id': f'phb2014:{kind}:{index}' if book == 'phb' else f'{book}2014:{kind}:{index}',
            'index': index, 'kind': kind, 'edition': '2014', 'name': name, 'nameIt': italian,
            'translation': {'status': 'assistant-translation', 'language': 'it'},
            'sources': [source(pages, name, book)], 'optional': optional,
            'mechanics': mechanics or {}, 'summaryIt': summary,
            'verification': {'identity': 'verified', 'mechanics': 'verified-fields',
                             'complete': not missing, 'missingFields': missing or []},
            'fieldSources': {key: [0] for key in (mechanics or {})}, 'interpretations': []}


# index, English, Italian, class features PDF page, hit die, saves, skill count, skill pool, armor, weapons, tools, casting, subclass level
CLASS_ROWS = [
    ('barbarian','Barbarian','Barbaro',48,12,'strength constitution',2,'animal-handling athletics intimidation nature perception survival','light medium shields','simple martial',[],None,3),
    ('bard','Bard','Bardo',53,8,'dexterity charisma',3,'any','light','simple hand-crossbow longsword rapier shortsword',[{'category':'musical-instrument','choose':3}],'charisma',3),
    ('cleric','Cleric','Chierico',58,8,'wisdom charisma',2,'history insight medicine persuasion religion','light medium shields','simple',[],'wisdom',1),
    ('druid','Druid','Druido',66,8,'intelligence wisdom',2,'arcana animal-handling insight medicine nature perception religion survival','light medium shields','club dagger dart javelin mace quarterstaff scimitar sickle sling spear',[{'index':'herbalism-kit'}],'wisdom',2),
    ('fighter','Fighter','Guerriero',72,10,'strength constitution',2,'acrobatics animal-handling athletics history insight intimidation perception survival','light medium heavy shields','simple martial',[],None,3),
    ('monk','Monk','Monaco',78,8,'strength dexterity',2,'acrobatics athletics history insight religion stealth','','simple shortsword',[{'categories':['artisan-tools','musical-instrument'],'choose':1}],None,3),
    ('paladin','Paladin','Paladino',85,10,'wisdom charisma',2,'athletics insight intimidation medicine persuasion religion','light medium heavy shields','simple martial',[],'charisma',3),
    ('ranger','Ranger','Ranger',91,10,'strength dexterity',3,'animal-handling athletics insight investigation nature perception stealth survival','light medium shields','simple martial',[],'wisdom',3),
    ('rogue','Rogue','Ladro',96,8,'dexterity intelligence',4,'acrobatics athletics deception insight intimidation investigation perception performance persuasion sleight-of-hand stealth','light','simple hand-crossbow longsword rapier shortsword',[{'index':'thieves-tools'}],None,3),
    ('sorcerer','Sorcerer','Stregone',101,6,'constitution charisma',2,'arcana deception insight intimidation persuasion religion','','dagger dart sling quarterstaff crossbow-light',[],'charisma',1),
    ('warlock','Warlock','Warlock',107,8,'wisdom charisma',2,'arcana deception history intimidation investigation nature religion','light','simple',[],'charisma',1),
    ('wizard','Wizard','Mago',114,6,'intelligence wisdom',2,'arcana history insight investigation medicine religion','','dagger dart sling quarterstaff crossbow-light',[],'intelligence',2),
]
CLASS_RANGES = {'barbarian':(47,51),'bard':(52,56),'cleric':(57,64),'druid':(65,70),'fighter':(71,76),'monk':(77,82),
                'paladin':(83,89),'ranger':(90,94),'rogue':(95,99),'sorcerer':(100,105),'warlock':(106,112),'wizard':(113,120)}
SUBCLASS_LEVELS = {'barbarian':[3,6,10,14],'bard':[3,6,14],'cleric':[1,2,6,8,17],'druid':[2,6,10,14],
                   'fighter':[3,7,10,15,18],'monk':[3,6,11,17],'paladin':[3,7,15,20],'ranger':[3,7,11,15],
                   'rogue':[3,9,13,17],'sorcerer':[1,6,14,18],'warlock':[1,6,10,14],'wizard':[2,6,10,14]}
MULTICLASS = {
    'barbarian':{'all':[{'ability':'strength','minimum':13}]}, 'bard':{'all':[{'ability':'charisma','minimum':13}]},
    'cleric':{'all':[{'ability':'wisdom','minimum':13}]},'druid':{'all':[{'ability':'wisdom','minimum':13}]},
    'fighter':{'any':[{'ability':'strength','minimum':13},{'ability':'dexterity','minimum':13}]},
    'monk':{'all':[{'ability':'dexterity','minimum':13},{'ability':'wisdom','minimum':13}]},
    'paladin':{'all':[{'ability':'strength','minimum':13},{'ability':'charisma','minimum':13}]},
    'ranger':{'all':[{'ability':'dexterity','minimum':13},{'ability':'wisdom','minimum':13}]},
    'rogue':{'all':[{'ability':'dexterity','minimum':13}]},'sorcerer':{'all':[{'ability':'charisma','minimum':13}]},
    'warlock':{'all':[{'ability':'charisma','minimum':13}]},'wizard':{'all':[{'ability':'intelligence','minimum':13}]},
}


def classes():
    result = []
    for index,name,it,page,die,saves,count,pool,armor,weapons,tools,casting,sublevel in CLASS_ROWS:
        pages = [page] + ([page+1] if index in ['fighter','druid','warlock'] else [])
        mechanics = {'hitDie':die,'hitPointsFirstLevel':{'base':die,'addAbilityModifier':'constitution'},
                     'hitPointsHigherLevels':{'dice':f'1d{die}','fixedAlternative':die//2+1,'addAbilityModifier':'constitution'},
                     'savingThrowAbilities':saves.split(),'skillChoices':{'choose':count,'from':pool.split()},
                     'armorProficiencies':armor.split(),'weaponProficiencies':weapons.split(),'toolProficiencies':tools,
                     'castingAbility':casting,'subclassMinimumLevel':sublevel,'abilityScoreImprovementLevels':
                     [4,6,8,12,14,16,19] if index=='fighter' else [4,8,10,12,16,19] if index=='rogue' else [4,8,12,16,19]}
        if index == 'druid':
            mechanics['metalArmorRestriction'] = 'will-not-wear-metal-armor-or-use-metal-shields'
        item = record('class',index,name,it,pages,mechanics,'Competenze iniziali e dati vita della classe; i requisiti di multiclassamento sono una regola opzionale distinta.',missing=['startingEquipment','fullFeatureEffects'])
        item['multiclassPrerequisites'] = {'value':MULTICLASS[index], 'optional':True,'source':source(164,'Multiclassing Prerequisites')}
        result.append(item)
    return result


# Canonical full names, with explicit legacy IDs for matching shortened SRD names.
SUBCLASS_ROWS = [
 ('barbarian','berserker','Path of the Berserker','Cammino del Berserker',[50,51]),
 ('barbarian','totem-warrior','Path of the Totem Warrior','Cammino del Combattente Totemico',[51]),
 ('bard','lore','College of Lore','Collegio della Sapienza',[55,56]),('bard','valor','College of Valor','Collegio del Valore',[56]),
 ('cleric','knowledge','Knowledge Domain','Dominio della Conoscenza',[60,61]),('cleric','life','Life Domain','Dominio della Vita',[61]),
 ('cleric','light','Light Domain','Dominio della Luce',[61,62]),('cleric','nature','Nature Domain','Dominio della Natura',[62,63]),
 ('cleric','tempest','Tempest Domain','Dominio della Tempesta',[63]),('cleric','trickery','Trickery Domain','Dominio dell’Inganno',[63,64]),('cleric','war','War Domain','Dominio della Guerra',[64]),
 ('druid','land','Circle of the Land','Circolo della Terra',[69,70]),('druid','moon','Circle of the Moon','Circolo della Luna',[70]),
 ('fighter','champion','Champion','Campione',[73,74]),('fighter','battle-master','Battle Master','Maestro di Battaglia',[74,75]),('fighter','eldritch-knight','Eldritch Knight','Cavaliere Mistico',[75,76]),
 ('monk','open-hand','Way of the Open Hand','Via della Mano Aperta',[80,81]),('monk','shadow','Way of Shadow','Via dell’Ombra',[81]),('monk','four-elements','Way of the Four Elements','Via dei Quattro Elementi',[81,82]),
 ('paladin','devotion','Oath of Devotion','Giuramento di Devozione',[86,87]),('paladin','ancients','Oath of the Ancients','Giuramento degli Antichi',[87,88]),('paladin','vengeance','Oath of Vengeance','Giuramento di Vendetta',[88,89]),
 ('ranger','hunter','Hunter','Cacciatore',[94]),('ranger','beast-master','Beast Master','Signore delle Bestie',[94]),
 ('rogue','thief','Thief','Furfante',[98]),('rogue','assassin','Assassin','Assassino',[98]),('rogue','arcane-trickster','Arcane Trickster','Mistificatore Arcano',[98,99]),
 ('sorcerer','draconic','Draconic Bloodline','Discendenza Draconica',[103,104]),('sorcerer','wild-magic','Wild Magic','Magia Selvaggia',[104,105]),
 ('warlock','archfey','The Archfey','Il Signore Fatato',[109,110]),('warlock','fiend','The Fiend','L’Immondo',[110]),('warlock','great-old-one','The Great Old One','Il Grande Antico',[110,111]),
 ('wizard','wizard-abjuration','School of Abjuration','Scuola di Abiurazione',[116,117]),('wizard','wizard-conjuration','School of Conjuration','Scuola di Evocazione',[117]),
 ('wizard','wizard-divination','School of Divination','Scuola di Divinazione',[117,118]),('wizard','wizard-enchantment','School of Enchantment','Scuola di Ammaliamento',[118]),
 ('wizard','evocation','School of Evocation','Scuola di Invocazione',[118,119]),('wizard','wizard-illusion','School of Illusion','Scuola di Illusione',[119]),
 ('wizard','wizard-necromancy','School of Necromancy','Scuola di Necromanzia',[119,120]),('wizard','wizard-transmutation','School of Transmutation','Scuola di Trasmutazione',[120]),
]


def subclasses():
    result = []
    for cls,index,name,it,pages in SUBCLASS_ROWS:
        item = record('subclass',index,name,it,pages,{'minimumLevel':SUBCLASS_LEVELS[cls][0],'featureLevels':SUBCLASS_LEVELS[cls]},
                      'Specializzazione della classe; l’inventario delle identità non equivale alla verifica di tutti i privilegi.',missing=['fullFeatureEffects','spellGrants','choices'])
        item['relations'] = {'classId':f'phb2014:class:{cls}'}
        result.append(item)
    return result


def races():
    rows = [
        ('dwarf','Dwarf','Nano',21,{'constitution':2},25,'Medium',['common','dwarvish'],60),
        ('elf','Elf','Elfo',24,{'dexterity':2},30,'Medium',['common','elvish'],60),
        ('halfling','Halfling','Halfling',29,{'dexterity':2},25,'Small',['common','halfling'],0),
        ('human','Human','Umano',32,{k:1 for k in ABILITIES},30,'Medium',['common'],0),
        ('dragonborn','Dragonborn','Dragonide',35,{'strength':2,'charisma':1},30,'Medium',['common','draconic'],0),
        ('gnome','Gnome','Gnomo',[37,38],{'intelligence':2},25,'Small',['common','gnomish'],60),
        ('half-elf','Half-Elf','Mezzelfo',40,{'charisma':2},30,'Medium',['common','elvish'],60),
        ('half-orc','Half-Orc','Mezzorco',42,{'strength':2,'constitution':1},30,'Medium',['common','orc'],60),
        ('tiefling','Tiefling','Tiefling',44,{'intelligence':1,'charisma':2},30,'Medium',['common','infernal'],60),
    ]
    traits = {
      'dwarf':[('dwarven-resilience',{'saveAdvantageAgainst':['poison'],'damageResistance':['poison']}),
               ('dwarven-combat-training',{'weaponProficiencies':['battleaxe','handaxe','light-hammer','warhammer']}),
               ('tool-proficiency',{'choose':1,'from':['smiths-tools','brewers-supplies','masons-tools']}),
               ('stonecunning',{'checkAbility':'intelligence','skill':'history','topic':'origin-of-stonework','proficiencyMultiplier':2}),
               ('heavy-armor-speed',{'ignoreStrengthSpeedPenalty':True})],
      'elf':[('keen-senses',{'skillProficiencies':['perception']}),('fey-ancestry',{'saveAdvantageAgainst':['charmed'],'immuneTo':['magical-sleep']}),
             ('trance',{'durationHours':4,'benefit':'equivalent-to-8-hours-human-sleep','longRestDurationInterpretation':None})],
      'halfling':[('lucky',{'rerollOn':1,'rolls':['attack','ability-check','saving-throw'],'mustUseNewRoll':True}),
                  ('brave',{'saveAdvantageAgainst':['frightened']}),('halfling-nimbleness',{'moveThrough':'larger-creature'})],
      'human':[('extra-language',{'choose':1})],
      'dragonborn':[('draconic-ancestry',{'choose':1,'from':['black','blue','brass','bronze','copper','gold','green','red','silver','white']}),
                    ('breath-weapon',{'activation':'action','saveDC':{'base':8,'add':['constitutionModifier','proficiencyBonus']},
                                      'damageByCharacterLevel':{'1':'2d6','6':'3d6','11':'4d6','16':'5d6'},'successfulSave':'half-damage',
                                      'uses':1,'recovery':['short-rest','long-rest']}),('damage-resistance',{'from':'draconic-ancestry'})],
      'gnome':[('gnome-cunning',{'saveAdvantageAbilities':['intelligence','wisdom','charisma'],'against':'magic'})],
      'half-elf':[('ability-choice',{'choose':2,'bonus':1,'exclude':['charisma'],'distinct':True}),
                  ('fey-ancestry',{'saveAdvantageAgainst':['charmed'],'immuneTo':['magical-sleep']}),('skill-versatility',{'choose':2,'from':'skills'}),('extra-language',{'choose':1})],
      'half-orc':[('menacing',{'skillProficiencies':['intimidation']}),('relentless-endurance',{'trigger':'reduced-to-0-hp-without-instant-death','replaceHP':1,'uses':1,'recovery':['long-rest']}),
                  ('savage-attacks',{'trigger':'critical-melee-weapon-attack','additionalWeaponDamageDice':1})],
      'tiefling':[('hellish-resistance',{'damageResistance':['fire']}),('infernal-legacy',{'castingAbility':'charisma','grants':[
                    {'spell':'thaumaturgy','minimumLevel':1,'atWill':True},{'spell':'hellish-rebuke','minimumLevel':3,'slotLevel':2,'uses':1,'recovery':'day'},
                    {'spell':'darkness','minimumLevel':5,'slotLevel':2,'uses':1,'recovery':'day'}],'printingNote':'Il PDF dice una volta al giorno; non sostituire automaticamente con riposo lungo.'})],
    }
    result = []
    for index,name,it,pages,bonuses,speed,size,languages,darkvision in rows:
        result.append(record('race',index,name,it,pages,{'fixedAbilityBonuses':bonuses,'speed':{'value':speed,'unit':'ft'},'size':size,
                         'languages':languages,'darkvision':{'value':darkvision,'unit':'ft'},
                         'traits':[{'index':k,'mechanics':v} for k,v in traits[index]]},
                         'Tratti meccanici dell’origine. Età e inclinazioni di allineamento non sono vincoli automatici.',missing=['age','alignmentDescription']))
    return result


def subraces():
    rows = [
      ('dwarf','hill-dwarf','Hill Dwarf','Nano delle Colline',[21],{'wisdom':1},{'hitPointsPerCharacterLevel':1}),
      ('dwarf','mountain-dwarf','Mountain Dwarf','Nano delle Montagne',[21],{'strength':2},{'armorProficiencies':['light','medium']}),
      ('elf','high-elf','High Elf','Elfo Alto',[24,25],{'intelligence':1},{'weaponProficiencies':['longsword','shortsword','shortbow','longbow'],'cantripChoice':{'choose':1,'class':'wizard','castingAbility':'intelligence'},'extraLanguages':1}),
      ('elf','wood-elf','Wood Elf','Elfo dei Boschi',[25],{'wisdom':1},{'weaponProficiencies':['longsword','shortsword','shortbow','longbow'],'speedOverrideFt':35,'hideWhen':'lightly-obscured-by-natural-phenomena'}),
      ('elf','dark-elf','Dark Elf (Drow)','Elfo Oscuro (Drow)',[25],{'charisma':1},{'darkvisionOverrideFt':120,'weaponProficiencies':['rapier','shortsword','crossbow-hand'],'sunlightSensitivity':{'disadvantageOn':['attack','sight-perception'],'when':'self-or-target-or-observed-object-in-direct-sunlight'},'spellGrants':{'castingAbility':'charisma','grants':[{'spell':'dancing-lights','minimumLevel':1,'atWill':True},{'spell':'faerie-fire','minimumLevel':3,'uses':1,'recovery':'day'},{'spell':'darkness','minimumLevel':5,'uses':1,'recovery':'day'}]}}),
      ('halfling','lightfoot-halfling','Lightfoot Halfling','Halfling Piedelesto',[29],{'charisma':1},{'hideWhen':'obscured-by-creature-at-least-one-size-larger'}),
      ('halfling','stout-halfling','Stout Halfling','Halfling Tozzo',[29],{'constitution':1},{'saveAdvantageAgainst':['poison'],'damageResistance':['poison']}),
      ('gnome','forest-gnome','Forest Gnome','Gnomo delle Foreste',[38],{'dexterity':1},{'spellGrants':[{'spell':'minor-illusion','castingAbility':'intelligence','atWill':True}],'communicateSimpleIdeasWith':'small-or-smaller-beasts'}),
      ('gnome','rock-gnome','Rock Gnome','Gnomo delle Rocce',[38],{'constitution':1},{'historyProficiencyMultiplier':{'value':2,'topic':['magic-items','alchemical-objects','technology']},'toolProficiencies':['tinkers-tools'],'tinker':{'buildHours':1,'materialCostGP':10,'maxActive':3,'durationHours':24,'armorClass':5,'hitPoints':1,'maintenanceHours':1,'options':['clockwork-toy','fire-starter','music-box']}}),
    ]
    result=[]
    for race,index,name,it,pages,bonuses,extra in rows:
        item=record('subrace',index,name,it,pages,{'fixedAbilityBonuses':bonuses,**extra},'Aggiungi questi tratti alla razza base; applica come sostituzione soltanto i campi esplicitamente indicati.',missing=['descriptiveTraits'])
        item['relations']={'raceId':f'phb2014:race:{race}'}
        result.append(item)
    return result


def race_variants():
    item=record('race-variant','variant-human','Variant Human','Umano Variante',32,
                {'replace':['fixedAbilityBonuses'],'abilityBonusChoice':{'choose':2,'bonus':1,'distinct':True},'skillChoice':{'choose':1},'featChoice':{'choose':1}},
                'Con il consenso del DM e i talenti abilitati, sostituisce i sei incrementi dell’umano con due incrementi scelti, una competenza e un talento.',optional=True)
    item['relations']={'raceId':'phb2014:race:human'}
    return [item]


BG_ROWS = [
 ('acolyte','Acolyte','Accolito',[128],'insight religion',[],2,15,'Shelter of the Faithful','Ottieni cure e ospitalità da comunità della tua fede; fornisci i componenti materiali degli incantesimi.', [('holy-symbol',1),('prayer-book-or-wheel',1),('incense-stick',5),('vestments',1),('clothes-common',1),('pouch',1)]),
 ('charlatan','Charlatan','Ciarlatano',[129],'deception sleight-of-hand',['disguise-kit','forgery-kit'],0,15,'False Identity','Possiedi un’identità alternativa documentata e puoi imitare documenti di cui hai visto un esempio.', [('clothes-fine',1),('disguise-kit',1),('con-tools-choice',1),('pouch',1)]),
 ('criminal','Criminal','Criminale',[130,131],'deception stealth',['gaming-set-choice','thieves-tools'],0,15,'Criminal Contact','Un contatto affidabile ti collega alla rete criminale e permette di scambiare messaggi a distanza.', [('crowbar',1),('clothes-common-dark-hooded',1),('pouch',1)]),
 ('entertainer','Entertainer','Intrattenitore',[131,132],'acrobatics performance',['disguise-kit','musical-instrument-choice'],0,15,'By Popular Demand','Esibendoti ogni sera puoi ricevere vitto e alloggio e diventare riconoscibile agli abitanti.', [('musical-instrument-choice',1),('admirer-favor',1),('clothes-costume',1),('pouch',1)]),
 ('folk-hero','Folk Hero','Eroe Popolare',[132,133],'animal-handling survival',['artisan-tools-choice','vehicles-land'],0,10,'Rustic Hospitality','La gente comune può offrirti rifugio e protezione, senza rischiare la vita e purché tu non rappresenti un pericolo.', [('artisan-tools-choice',1),('shovel',1),('pot-iron',1),('clothes-common',1),('pouch',1)]),
 ('guild-artisan','Guild Artisan','Artigiano di Gilda',[133,134],'insight persuasion',['artisan-tools-choice'],1,15,'Guild Membership','La gilda può sostenerti e offrire contatti; richiede quote di 5 mo al mese e il saldo degli arretrati.', [('artisan-tools-choice',1),('guild-letter',1),('clothes-travelers',1),('pouch',1)]),
 ('hermit','Hermit','Eremita',[135],'medicine religion',['herbalism-kit'],1,5,'Discovery','Concorda con il DM la scoperta ottenuta durante l’isolamento e il suo ruolo nella campagna.', [('case-map-or-scroll-with-notes',1),('blanket',1),('clothes-common',1),('herbalism-kit',1)]),
 ('noble','Noble','Nobile',[136,137],'history persuasion',['gaming-set-choice'],1,25,'Position of Privilege','Il rango facilita l’accesso all’alta società e le udienze con nobili locali.', [('clothes-fine',1),('signet-ring',1),('pedigree-scroll',1),('purse',1)]),
 ('outlander','Outlander','Forestiero',[137,138],'athletics survival',['musical-instrument-choice'],1,10,'Wanderer','Ricordi mappe e territorio; se l’ambiente lo permette trovi cibo e acqua per te e altre cinque persone ogni giorno.', [('staff',1),('hunting-trap',1),('animal-trophy',1),('clothes-travelers',1),('pouch',1)]),
 ('sage','Sage','Sapiente',[138,139],'arcana history',[],2,10,'Researcher','Quando non conosci un’informazione puoi sapere dove cercarla; disponibilità e accessibilità dipendono dal DM.', [('ink-1-ounce-bottle',1),('ink-pen',1),('small-knife',1),('colleague-letter',1),('clothes-common',1),('pouch',1)]),
 ('sailor','Sailor','Marinaio',[140],'athletics perception',['navigators-tools','vehicles-water'],0,10,'Ship’s Passage','Puoi ottenere passaggi per te e i compagni aiutando l’equipaggio; itinerario e tempi dipendono dal DM.', [('club',1),('rope-silk-50-feet',1),('lucky-charm',1),('clothes-common',1),('pouch',1)]),
 ('soldier','Soldier','Soldato',[141],'athletics intimidation',['gaming-set-choice','vehicles-land'],0,10,'Military Rank','Il grado riconosciuto nella tua precedente organizzazione permette di influenzare soldati e chiedere prestiti di equipaggiamento.', [('rank-insignia',1),('enemy-trophy',1),('gaming-set-choice',1),('clothes-common',1),('pouch',1)]),
 ('urchin','Urchin','Monello',[142],'sleight-of-hand stealth',['disguise-kit','thieves-tools'],0,10,'City Secrets','Fuori dal combattimento guidi te e i compagni tra luoghi della città in metà del tempo normale.', [('small-knife',1),('city-map',1),('pet-mouse',1),('parents-token',1),('clothes-common',1),('pouch',1)]),
]


def backgrounds():
    result=[]
    for index,name,it,pages,skills,tools,languages,gold,feature,summary,gear in BG_ROWS:
        item=record('background',index,name,it,pages,{'skillProficiencies':skills.split(),'toolProficiencies':tools,
                   'languageChoice':{'choose':languages},'startingGold':{'quantity':gold,'unit':'gp'},
                   'startingEquipment':[{'index':k,'quantity':v,'kind':'choice' if k.endswith('-choice') else 'item-or-narrative-object'} for k,v in gear],
                   'feature':{'name':feature,'summaryIt':summary}},summary,missing=['personalityTables'])
        result.append(item)
    return result


def background_variants():
    rows=[('criminal','spy','Spy','Spia',131,{},'Cambia il contesto narrativo del criminale; le capacità restano le stesse.'),
          ('entertainer','gladiator','Gladiator','Gladiatore',132,{'equipmentReplacement':{'from':'musical-instrument-choice','to':'inexpensive-unusual-weapon-choice'}},'Il privilegio si applica agli spettacoli di combattimento; puoi sostituire lo strumento musicale con un’arma economica e insolita.'),
          ('guild-artisan','guild-merchant','Guild Merchant','Mercante di Gilda',134,{'toolReplacementChoice':['navigators-tools','extra-language'],'equipmentReplacement':{'from':'artisan-tools-choice','to':['mule','cart']}},'Puoi sostituire strumenti e competenza artigiana con le alternative del mercante.'),
          ('noble','knight','Knight','Cavaliere',137,{'featureReplacement':'retainers','retainers':3,'squires':1,'retainerCombat':False},'Tre servitori svolgono compiti ordinari; uno è uno scudiero nobile. Non seguono il personaggio in pericoli evidenti.'),
          ('sailor','pirate','Pirate','Pirata',140,{'featureReplacementChoice':'bad-reputation'},'Puoi scegliere Cattiva Reputazione al posto del passaggio in nave: negli insediamenti piccoli reati possono essere ignorati per paura.')]
    result=[]
    for parent,index,name,it,page,mechanics,summary in rows:
        item=record('background-variant',index,name,it,page,mechanics,summary)
        item['relations']={'backgroundId':f'phb2014:background:{parent}'}
        result.append(item)
    return result


WEAPON_ROWS = [
 ('club','Club','Randello',1,'sp','1d4','bludgeoning',2,'light',None,None),
 ('dagger','Dagger','Pugnale',2,'gp','1d4','piercing',1,'finesse light thrown',(20,60),None),
 ('greatclub','Greatclub','Randello Pesante',2,'sp','1d8','bludgeoning',10,'two-handed',None,None),
 ('handaxe','Handaxe','Ascia',5,'gp','1d6','slashing',2,'light thrown',(20,60),None),
 ('javelin','Javelin','Giavellotto',5,'sp','1d6','piercing',2,'thrown',(30,120),None),
 ('light-hammer','Light Hammer','Martello Leggero',2,'gp','1d4','bludgeoning',2,'light thrown',(20,60),None),
 ('mace','Mace','Mazza',5,'gp','1d6','bludgeoning',4,'',None,None),
 ('quarterstaff','Quarterstaff','Bastone Ferrato',2,'sp','1d6','bludgeoning',4,'versatile',None,'1d8'),
 ('sickle','Sickle','Falce',1,'gp','1d4','slashing',2,'light',None,None),
 ('spear','Spear','Lancia',1,'gp','1d6','piercing',3,'thrown versatile',(20,60),'1d8'),
 ('crossbow-light','Crossbow, Light','Balestra Leggera',25,'gp','1d8','piercing',5,'ammunition loading two-handed',(80,320),None),
 ('dart','Dart','Dardo',5,'cp','1d4','piercing',0.25,'finesse thrown',(20,60),None),
 ('shortbow','Shortbow','Arco Corto',25,'gp','1d6','piercing',2,'ammunition two-handed',(80,320),None),
 ('sling','Sling','Fionda',1,'sp','1d4','bludgeoning',None,'ammunition',(30,120),None),
 ('battleaxe','Battleaxe','Ascia da Battaglia',10,'gp','1d8','slashing',4,'versatile',None,'1d10'),
 ('flail','Flail','Mazzafrusto',10,'gp','1d8','bludgeoning',2,'',None,None),
 ('glaive','Glaive','Falcione',20,'gp','1d10','slashing',6,'heavy reach two-handed',None,None),
 ('greataxe','Greataxe','Ascia Bipenne',30,'gp','1d12','slashing',7,'heavy two-handed',None,None),
 ('greatsword','Greatsword','Spadone',50,'gp','2d6','slashing',6,'heavy two-handed',None,None),
 ('halberd','Halberd','Alabarda',20,'gp','1d10','slashing',6,'heavy reach two-handed',None,None),
 ('lance','Lance','Lancia da Cavaliere',10,'gp','1d12','piercing',6,'reach special',None,None),
 ('longsword','Longsword','Spada Lunga',15,'gp','1d8','slashing',3,'versatile',None,'1d10'),
 ('maul','Maul','Maglio',10,'gp','2d6','bludgeoning',10,'heavy two-handed',None,None),
 ('morningstar','Morningstar','Morning Star',15,'gp','1d8','piercing',4,'',None,None),
 ('pike','Pike','Picca',5,'gp','1d10','piercing',18,'heavy reach two-handed',None,None),
 ('rapier','Rapier','Stocco',25,'gp','1d8','piercing',2,'finesse',None,None),
 ('scimitar','Scimitar','Scimitarra',25,'gp','1d6','slashing',3,'finesse light',None,None),
 ('shortsword','Shortsword','Spada Corta',10,'gp','1d6','piercing',2,'finesse light',None,None),
 ('trident','Trident','Tridente',5,'gp','1d6','piercing',4,'thrown versatile',(20,60),'1d8'),
 ('war-pick','War Pick','Piccone da Guerra',5,'gp','1d8','piercing',2,'',None,None),
 ('warhammer','Warhammer','Martello da Guerra',15,'gp','1d8','bludgeoning',2,'versatile',None,'1d10'),
 ('whip','Whip','Frusta',2,'gp','1d4','slashing',3,'finesse reach',None,None),
 ('blowgun','Blowgun','Cerbottana',10,'gp','1','piercing',1,'ammunition loading',(25,100),None),
 ('crossbow-hand','Crossbow, Hand','Balestra a Mano',75,'gp','1d6','piercing',3,'ammunition light loading',(30,120),None),
 ('crossbow-heavy','Crossbow, Heavy','Balestra Pesante',50,'gp','1d10','piercing',18,'ammunition heavy loading two-handed',(100,400),None),
 ('longbow','Longbow','Arco Lungo',50,'gp','1d8','piercing',2,'ammunition heavy two-handed',(150,600),None),
 ('net','Net','Rete',1,'gp',None,None,3,'special thrown',(5,15),None),
]


def weapons():
    result=[]
    for pos,(index,name,it,cost,unit,dice,damage,weight,properties,rng,versatile) in enumerate(WEAPON_ROWS):
        mechanics={'cost':{'quantity':cost,'unit':unit},'weight':{'value':weight,'unit':'lb','unspecifiedInTable':weight is None},
                   'weaponCategory':'simple' if pos<14 else 'martial','weaponRange':'ranged' if 10<=pos<14 or pos>=32 else 'melee',
                   'damage':{'dice':dice,'type':damage},'properties':properties.split(),'range':{'normal':rng[0],'long':rng[1],'unit':'ft'} if rng else None,'versatileDamage':versatile}
        summary='Dati della tabella armi; la competenza si aggiunge al tiro per colpire, non al danno.'
        result.append(record('weapon',index,name,it,150,mechanics,summary))
    return result


ARMOR_ROWS = [
 ('padded-armor','Padded','Imbottita','light',5,11,None,0,True,8),('leather-armor','Leather','Cuoio','light',10,11,None,0,False,10),
 ('studded-leather-armor','Studded Leather','Cuoio Borchiato','light',45,12,None,0,False,13),
 ('hide-armor','Hide','Pelle','medium',10,12,2,0,False,12),('chain-shirt','Chain Shirt','Giaco di Maglia','medium',50,13,2,0,False,20),
 ('scale-mail','Scale Mail','Corazza di Scaglie','medium',50,14,2,0,True,45),('breastplate','Breastplate','Corazza di Piastre','medium',400,14,2,0,False,20),
 ('half-plate-armor','Half Plate','Mezza Armatura','medium',750,15,2,0,True,40),
 ('ring-mail','Ring Mail','Armatura ad Anelli','heavy',30,14,0,0,True,40),('chain-mail','Chain Mail','Cotta di Maglia','heavy',75,16,0,13,True,55),
 ('splint-armor','Splint','Armatura a Strisce','heavy',200,17,0,15,True,60),('plate-armor','Plate','Armatura Completa','heavy',1500,18,0,15,True,65),
 ('shield','Shield','Scudo','shield',10,2,0,0,False,6),
]


def armor():
    result=[]
    for index,name,it,category,cost,base,dex,strength,stealth,weight in ARMOR_ROWS:
        mechanics={'cost':{'quantity':cost,'unit':'gp'},'weight':{'value':weight,'unit':'lb'},'armorCategory':category,
                   'armorClass':{'base':base,'dexBonus':category in ['light','medium'],'maxDexBonus':dex,'isBonus':category=='shield'},
                   'strengthMinimumToAvoidSpeedPenalty':strength,'stealthDisadvantage':stealth}
        result.append(record('armor',index,name,it,146,mechanics,'Lo scudo aggiunge +2 alla CA; le armature pesanti ignorano anche un modificatore di Destrezza negativo.'))
    return result


# independent PHB tools table, including the two gaming sets missing from SRD.
TOOL_ROWS = [
 ('alchemists-supplies',"Alchemist’s Supplies",'Scorte da Alchimista',50,'gp',8),('brewers-supplies',"Brewer’s Supplies",'Scorte da Mescitore',20,'gp',9),
 ('calligraphers-supplies',"Calligrapher’s Supplies",'Scorte da Calligrafo',10,'gp',5),('carpenters-tools',"Carpenter’s Tools",'Strumenti da Falegname',8,'gp',6),
 ('cartographers-tools',"Cartographer’s Tools",'Strumenti da Cartografo',15,'gp',6),('cobblers-tools',"Cobbler’s Tools",'Strumenti da Calzolaio',5,'gp',5),
 ('cooks-utensils',"Cook’s Utensils",'Utensili da Cuoco',1,'gp',8),('glassblowers-tools',"Glassblower’s Tools",'Strumenti da Soffiatore',30,'gp',5),
 ('jewelers-tools',"Jeweler’s Tools",'Strumenti da Gioielliere',25,'gp',2),('leatherworkers-tools',"Leatherworker’s Tools",'Strumenti da Conciatore',5,'gp',5),
 ('masons-tools',"Mason’s Tools",'Strumenti da Muratore',10,'gp',8),('painters-supplies',"Painter’s Supplies",'Scorte da Pittore',10,'gp',5),
 ('potters-tools',"Potter’s Tools",'Strumenti da Vasaio',10,'gp',3),('smiths-tools',"Smith’s Tools",'Strumenti da Fabbro',20,'gp',8),
 ('tinkers-tools',"Tinker’s Tools",'Strumenti da Inventore',50,'gp',10),('weavers-tools',"Weaver’s Tools",'Strumenti da Tessitore',1,'gp',5),
 ('woodcarvers-tools',"Woodcarver’s Tools",'Strumenti da Intagliatore',1,'gp',5),('disguise-kit','Disguise Kit','Trucchi per il Camuffamento',25,'gp',3),
 ('forgery-kit','Forgery Kit','Arnesi da Falsario',15,'gp',5),('dice-set','Dice Set','Dadi',1,'sp',None),
 ('dragonchess-set','Dragonchess Set','Scacchi dei Draghi',1,'gp',0.5),('playing-card-set','Playing Card Set','Carte da Gioco',5,'sp',None),
 ('three-dragon-ante-set','Three-Dragon Ante Set','Set di Three-Dragon Ante',1,'gp',None),('herbalism-kit','Herbalism Kit','Borsa da Erborista',5,'gp',3),
 ('bagpipes','Bagpipes','Cornamusa',30,'gp',6),('drum','Drum','Tamburo',6,'gp',3),('dulcimer','Dulcimer','Dulcimer',25,'gp',10),
 ('flute','Flute','Flauto',2,'gp',1),('lute','Lute','Liuto',35,'gp',2),('lyre','Lyre','Lira',30,'gp',2),('horn','Horn','Corno',3,'gp',2),
 ('pan-flute','Pan Flute','Flauto di Pan',12,'gp',2),('shawm','Shawm','Ciaramella',2,'gp',1),('viol','Viol','Viola',30,'gp',1),
 ('navigators-tools',"Navigator’s Tools",'Strumenti da Navigatore',25,'gp',2),('poisoners-kit',"Poisoner’s Kit",'Sostanze da Avvelenatore',50,'gp',2),
 ('thieves-tools',"Thieves’ Tools",'Arnesi da Scasso',25,'gp',1),
]


def tools():
    result=[]
    for pos,(index,name,it,cost,unit,weight) in enumerate(TOOL_ROWS):
        cat='artisan-tools' if pos<17 else 'gaming-set' if 19<=pos<=22 else 'musical-instrument' if 24<=pos<=33 else 'kit-or-tools'
        result.append(record('tool',index,name,it,155,{'category':cat,'cost':{'quantity':cost,'unit':unit},
                      'weight':{'value':weight,'unit':'lb','unspecifiedInTable':weight is None}},
                      'La competenza consente di aggiungere il bonus di competenza alla prova pertinente; non è associata a una sola caratteristica.'))
    return result


def feats():
    # Effects are declarative data, not executable strings; no eval() is required.
    rows = [
      ('alert','Alert','Allerta',[166],{}, {'initiativeBonus':5,'cannotBeSurprisedWhenConscious':True,'hiddenAttackersGainAdvantage':False},'Ottieni +5 all’iniziativa, eviti la sorpresa da cosciente e neghi il vantaggio dovuto al nascondersi degli attaccanti.'),
      ('athlete','Athlete','Atleta',[166],{}, {'abilityBonusChoice':{'from':['strength','dexterity'],'bonus':1,'maximum':20},'standFromProneCostFt':5,'climbingExtraMovementCost':0,'runningJumpApproachFt':5},'Un incremento fisico e minori costi di movimento per rialzarti, arrampicarti e preparare salti.'),
      ('actor','Actor','Attore',[166],{}, {'abilityBonus':{'charisma':1},'maximum':20,'advantageChecks':['deception-impersonation','performance-impersonation'],'mimicryListeningMinutes':1,'mimicryContest':['wisdom-insight','charisma-deception']},'Imiti identità e suoni ascoltati per almeno un minuto; un confronto tra Intuizione e Inganno può smascherarti.'),
      ('charger','Charger','Caricatore',[166],{}, {'requiresAction':'dash','activation':'bonus-action','choice':['one-melee-weapon-attack','shove'],'straightApproachFt':10,'attackDamageBonus':5,'shoveDistanceFt':10},'Dopo Scatto puoi attaccare o spingere con un’azione bonus; dieci piedi in linea retta attivano il beneficio aggiuntivo.'),
      ('crossbow-expert','Crossbow Expert','Esperto di Balestre',[166],{}, {'ignoreLoading':'proficient-crossbows','ignoreCloseHostileRangedDisadvantageFt':5,'bonusAttack':{'requires':'attack-action-with-one-handed-weapon','weapon':'loaded-hand-crossbow-held'}},'Ignori Caricamento con balestre competenti e lo svantaggio a distanza dovuto a nemici vicini; è prevista un’opzione di attacco bonus.'),
      ('defensive-duelist','Defensive Duelist','Duellante Difensivo',[166],{'ability':'dexterity','minimum':13}, {'activation':'reaction','trigger':'hit-by-melee-attack','requires':'proficient-finesse-weapon-wielded','armorClassBonus':'proficiencyBonus','duration':'triggering-attack'},'Puoi aggiungere la competenza alla CA contro il solo attacco in mischia che ti ha colpito.'),
      ('dual-wielder','Dual Wielder','Combattente con Due Armi',[166],{}, {'armorClassBonus':1,'requiresAC':'separate-melee-weapon-in-each-hand','twoWeaponFightingAllowsNonLight':True,'drawOrStowWeapons':2},'Usi due armi a una mano anche non leggere, puoi estrarne due e ottieni +1 alla CA mentre ne impugni una per mano.'),
      ('dungeon-delver','Dungeon Delver','Esploratore di Dungeon',[167],{}, {'advantageChecks':['perception-secret-doors','investigation-secret-doors'],'saveAdvantageAgainst':['traps'],'damageResistance':['trap-damage'],'trapSearchAllowedTravelPace':'normal'},'Migliori individuazione di porte segrete, difesa dalle trappole e ricerca durante il viaggio.'),
      ('durable','Durable','Robusto',[167],{}, {'abilityBonus':{'constitution':1},'maximum':20,'hitDieHealingMinimum':{'multiplier':2,'abilityModifier':'constitution','floor':2}},'Incrementi Costituzione; la guarigione ottenuta spendendo un dado vita ha un minimo legato al modificatore.'),
      ('elemental-adept','Elemental Adept','Adepto Elementale',[167],{'canCastSpell':True}, {'damageTypeChoice':['acid','cold','fire','lightning','thunder'],'ignoreResistance':True,'minimumDamageDieResult':2,'repeatableWithDistinctChoice':True},'Scegli un tipo di danno per gli incantesimi: ignori la resistenza e puoi trattare gli 1 dei dadi come 2; non ignori l’immunità.'),
      ('grappler','Grappler','Lottatore',[168],{'ability':'strength','minimum':13}, {'attackAdvantageAgainst':'creature-grappled-by-self','pin':{'activation':'action','check':'grapple','onSuccess':['self-restrained','target-restrained']},'printingOnlyClause':'one-size-larger-creatures-do-not-automatically-escape'},'Ottieni vantaggio contro la creatura afferrata e puoi tentare di immobilizzarla, rendendo trattenuti entrambi. La clausola finale della stampa locale differisce dall’SRD.'),
      ('great-weapon-master','Great Weapon Master','Maestro delle Armi Possenti',[168],{}, {'bonusActionMeleeAttackTrigger':['melee-weapon-critical-on-own-turn','melee-weapon-reduces-target-to-0-on-own-turn'],'powerAttack':{'requires':'proficient-heavy-melee-weapon','attackPenalty':5,'damageBonus':10}},'Un critico o un abbattimento in mischia nel tuo turno può dare un attacco bonus; con un’arma pesante competente scegli −5 al tiro e +10 al danno.'),
      ('healer','Healer','Guaritore',[168],{}, {'stabilizeWithKitHitPoints':1,'heal':{'activation':'action','kitUses':1,'dice':'1d6','base':4,'add':'targetMaximumHitDice','targetRecovery':['short-rest','long-rest']}},'La borsa del guaritore può restituire PF quando stabilizzi o curi; la cura maggiore è limitata per bersaglio tra riposi.'),
      ('heavily-armored','Heavily Armored','Pesantemente Corazzato',[168],{'armorProficiency':'medium'}, {'abilityBonus':{'strength':1},'maximum':20,'armorProficiencies':['heavy']},'Incrementi Forza e acquisisci competenza nelle armature pesanti.'),
      ('heavy-armor-master','Heavy Armor Master','Maestro delle Armature Pesanti',[168],{'armorProficiency':'heavy'}, {'abilityBonus':{'strength':1},'maximum':20,'damageReduction':{'amount':3,'types':['bludgeoning','piercing','slashing'],'from':'nonmagical-weapons','requires':'wearing-heavy-armor'}},'Incrementi Forza e riduci di 3 i danni fisici delle armi non magiche mentre indossi un’armatura pesante.'),
      ('inspiring-leader','Inspiring Leader','Condottiero Ispiratore',[168],{'ability':'charisma','minimum':13}, {'durationMinutes':10,'maxTargets':6,'rangeFt':30,'temporaryHitPoints':{'add':['characterLevel','charismaModifier']},'targetRequirements':['friendly','see-or-hear','understand'],'targetRecovery':['short-rest','long-rest']},'Un discorso di dieci minuti concede PF temporanei a un massimo di sei creature amiche, con un limite per destinatario tra riposi.'),
      ('keen-mind','Keen Mind','Mente Acuta',[168],{}, {'abilityBonus':{'intelligence':1},'maximum':20,'knows':['north','hours-until-sunrise-or-sunset'],'accurateRecallMonths':1},'Incrementi Intelligenza e ricordi con precisione ciò che hai percepito nell’ultimo mese, oltre a orientamento e orari solari.'),
      ('lightly-armored','Lightly Armored','Leggermente Corazzato',[168],{}, {'abilityBonusChoice':{'from':['strength','dexterity'],'bonus':1,'maximum':20},'armorProficiencies':['light']},'Un incremento fisico e competenza nelle armature leggere.'),
      ('linguist','Linguist','Linguista',[168],{}, {'abilityBonus':{'intelligence':1},'maximum':20,'languageChoice':{'choose':3},'cipherDC':{'add':['intelligenceScore','proficiencyBonus']}},'Impari tre lingue e crei cifrari; la difficoltà usa il punteggio di Intelligenza, non il modificatore.'),
      ('lucky','Lucky','Fortunato',[168],{}, {'uses':3,'recovery':['long-rest'],'rollExtraD20For':['attack','ability-check','saving-throw','attack-against-self'],'decision':'after-roll-before-outcome','conflictingLuckPoints':'cancel'},'Spendendo fortuna aggiungi un d20 e scegli quello usato, prima di conoscere l’esito. L’interazione con vantaggio e svantaggio resta da esplicitare.'),
      ('mage-slayer','Mage Slayer','Sterminatore di Maghi',[169],{}, {'reactionAttack':{'trigger':'creature-within-5-ft-casts-spell','type':'melee-weapon'},'damagedTargetConcentrationSaveDisadvantage':True,'saveAdvantageAgainstSpellCasterWithinFt':5},'Reagisci ai lanci vicini, ostacoli la concentrazione di chi danneggi e migliori i TS contro incantatori adiacenti.'),
      ('magic-initiate','Magic Initiate','Iniziato alla Magia',[169],{}, {'classChoice':['bard','cleric','druid','sorcerer','warlock','wizard'],'cantrips':2,'firstLevelSpells':1,'freeCast':{'slotLevel':1,'uses':1,'recovery':['long-rest']},'castingAbilityFromChosenClass':True},'Impari due trucchetti e un incantesimo di primo livello della stessa classe; il lancio gratuito torna dopo un riposo lungo.'),
      ('martial-adept','Martial Adept','Adepto Marziale',[169],{}, {'maneuversKnown':2,'superiorityDiceAdded':1,'dieWithoutExistingDice':'1d6','recovery':['short-rest','long-rest'],'saveDC':{'base':8,'add':['proficiencyBonus','chosenStrengthOrDexterityModifier']}},'Impari due manovre del Maestro di Battaglia e ottieni un dado di superiorità aggiuntivo.'),
      ('medium-armor-master','Medium Armor Master','Maestro delle Armature Medie',[169],{'armorProficiency':'medium'}, {'removeMediumArmorStealthDisadvantage':True,'maxDexBonus':3,'requiresDexterity':16},'Le armature medie non penalizzano Furtività e possono usare fino a +3 di Destrezza con punteggio almeno 16.'),
      ('mobile','Mobile','Mobile',[169],{}, {'speedBonusFt':10,'dashIgnoresDifficultTerrainExtraCost':True,'preventOpportunityAttacksAfterMeleeAttack':{'hitRequired':False,'duration':'rest-of-own-turn','from':'attacked-creature'}},'Aumenti velocità e mobilità; il bersaglio del tuo attacco in mischia non può farti attacchi di opportunità nel resto del turno.'),
      ('moderately-armored','Moderately Armored','Moderatamente Corazzato',[169],{'armorProficiency':'light'}, {'abilityBonusChoice':{'from':['strength','dexterity'],'bonus':1,'maximum':20},'armorProficiencies':['medium','shields']},'Un incremento fisico e competenza nelle armature medie e negli scudi.'),
      ('mounted-combatant','Mounted Combatant','Combattente in Sella',[169],{}, {'requires':['mounted','not-incapacitated'],'meleeAttackAdvantageAgainst':'unmounted-creature-smaller-than-mount','redirectMountAttackToSelf':True,'mountDexteritySaveDamage':{'success':0,'failure':'half'}},'Proteggi la cavalcatura e ottieni vantaggio in mischia contro bersagli a piedi più piccoli di essa.'),
      ('observant','Observant','Osservatore',[169],{}, {'abilityBonusChoice':{'from':['intelligence','wisdom'],'bonus':1,'maximum':20},'passiveBonus':{'perception':5,'investigation':5},'readLips':'visible-mouth-and-known-language'},'Incrementi una caratteristica mentale, leggi le labbra e aggiungi +5 a Percezione e Investigazione passive.'),
      ('polearm-master','Polearm Master','Maestro delle Armi ad Asta',[169],{}, {'bonusActionAttackWeapons':['glaive','halberd','quarterstaff'],'bonusAttackDice':'1d4','bonusAttackDamageType':'bludgeoning','requiresAction':'attack-only-with-listed-weapons','opportunityOnEnteringReachWeapons':['glaive','halberd','pike','quarterstaff']},'La stampa locale permette un attacco con l’estremità opposta di alcune armi e attacchi di opportunità all’ingresso nella portata; non include la lancia nelle liste.'),
      ('resilient','Resilient','Resiliente',[169],{}, {'abilityBonusChoice':{'from':ABILITIES,'bonus':1,'maximum':20},'saveProficiency':'chosen-ability'},'Incrementi una caratteristica scelta e acquisisci competenza nei relativi tiri salvezza.'),
      ('ritual-caster','Ritual Caster','Incantatore Rituale',[170],{'any':[{'ability':'intelligence','minimum':13},{'ability':'wisdom','minimum':13}]}, {'classChoice':['bard','cleric','druid','sorcerer','warlock','wizard'],'initialRitualSpells':{'choose':2,'level':1},'requires':'ritual-book-in-hand','copy':{'maxLevel':'ceil(characterLevel/2)','hoursPerLevel':2,'gpPerLevel':50,'mustBeRitual':True,'mustBeOnChosenClassList':True},'castingAbilityFromChosenClass':True},'Usi un libro di rituali, inizi con due magie di primo livello e puoi copiarne altre rispettando lista e limite di livello.'),
      ('savage-attacker','Savage Attacker','Attaccante Selvaggio',[170],{}, {'usesPerTurn':1,'reroll':'melee-weapon-damage-dice','choose':'either-total'},'Una volta per turno puoi ritirare i dadi di danno di un attacco con arma da mischia e scegliere il totale.'),
      ('sentinel','Sentinel','Sentinella',[170,171],{}, {'opportunityHitSpeed':0,'duration':'rest-of-turn','disengageDoesNotPreventOpportunityWithinFt':5,'reactionAttack':{'trigger':'creature-within-5-ft-attacks-other-target-without-this-feat','type':'melee-weapon'}},'Gli attacchi di opportunità a segno fermano il bersaglio; alcune azioni vicine permettono una reazione aggiuntiva.'),
      ('sharpshooter','Sharpshooter','Tiratore Scelto',[171],{}, {'longRangeDisadvantage':False,'ignoreCover':['half','three-quarters'],'powerAttack':{'requires':'proficient-ranged-weapon','attackPenalty':5,'damageBonus':10}},'Ignori penalità di lunga gittata e coperture parziali; puoi scegliere −5 al tiro per colpire e +10 al danno.'),
      ('shield-master','Shield Master','Maestro degli Scudi',[171],{}, {'requires':'shield-wielded','bonusShove':{'requiresAction':'attack','rangeFt':5},'dexSaveBonus':'shieldAC-if-effect-targets-only-self-and-not-incapacitated','reactionOnSuccessfulDexHalfDamageSave':'no-damage'},'Lo scudo può aiutare a spingere, nei TS di Destrezza diretti solo a te e nell’evitare danni con una reazione dopo un TS riuscito.'),
      ('skilled','Skilled','Abile',[171],{}, {'proficiencyChoices':{'choose':3,'categories':['skills','tools']}},'Acquisisci tre competenze in qualsiasi combinazione di abilità e strumenti.'),
      ('skulker','Skulker','Furtivo',[171],{'ability':'dexterity','minimum':13}, {'hideWhen':'lightly-obscured','missedHiddenRangedWeaponAttackRevealsPosition':False,'dimLightSightPerceptionDisadvantage':False},'Nascondersi è più facile; un attacco a distanza mancato da nascosto non rivela la posizione e la penombra non penalizza Percezione visiva.'),
      ('spell-sniper','Spell Sniper','Cecchino Magico',[171],{'canCastSpell':True}, {'spellAttackRangeMultiplier':2,'rangedSpellAttackIgnoreCover':['half','three-quarters'],'cantripChoice':{'choose':1,'requiresAttackRoll':True,'classes':['bard','cleric','druid','sorcerer','warlock','wizard']},'castingAbilityFromChosenClass':True},'Raddoppi la gittata delle magie con tiro per colpire, ignori coperture parziali con attacchi magici a distanza e impari un trucchetto d’attacco.'),
      ('tavern-brawler','Tavern Brawler','Lottatore da Taverna',[171],{}, {'abilityBonusChoice':{'from':['strength','constitution'],'bonus':1,'maximum':20},'proficiencies':['improvised-weapons','unarmed-strikes'],'unarmedDamageDice':'1d4','bonusActionGrappleTrigger':'hit-with-unarmed-or-improvised-weapon-on-own-turn'},'Incrementi una caratteristica fisica, migliori il combattimento improvvisato e puoi afferrare dopo un colpo appropriato.'),
      ('tough','Tough','Tenace',[171],{}, {'hitPointsPerCharacterLevel':2,'retroactive':True},'Il massimo dei PF aumenta di due per ogni livello, compresi quelli già raggiunti.'),
      ('war-caster','War Caster','Incantatore da Guerra',[171],{'canCastSpell':True}, {'concentrationSaveAdvantageAgainst':'damage','somaticComponentsWithOccupiedWeaponOrShieldHands':True,'opportunitySpell':{'activation':'reaction','trigger':'hostile-movement-provokes-opportunity','castingTime':'1-action','target':'only-provoking-creature'}},'Migliori la concentrazione sotto danno, esegui componenti somatiche con armi o scudi in mano e puoi sostituire un attacco di opportunità con una magia adatta.'),
      ('weapon-master','Weapon Master','Maestro delle Armi',[171],{}, {'abilityBonusChoice':{'from':['strength','dexterity'],'bonus':1,'maximum':20},'weaponProficiencyChoice':{'choose':4}},'Un incremento fisico e quattro competenze in armi a scelta.'),
    ]
    result=[]
    for index,name,it,pages,prerequisite,mechanics,summary in rows:
        item=record('feat',index,name,it,pages,{'prerequisites':prerequisite,**mechanics},summary,optional=True,
                    missing=['advantageInteraction'] if index=='lucky' else [])
        result.append(item)
    return result
