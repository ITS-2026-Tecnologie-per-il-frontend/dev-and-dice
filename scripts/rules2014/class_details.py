"""Class equipment and progression events; incomplete feature effects are explicit."""
from curated import record, source


def item(index,quantity=1,**kwargs):
    return {'index':index,'quantity':quantity,**kwargs}


def category(name,quantity=1):
    return {'category':name,'quantity':quantity}


def choice(*options):
    return {'choose':1,'options':[o if isinstance(o,list) else [o] for o in options]}


def starting_equipment():
    i,c,ch=item,category,choice
    return {
      'barbarian':(49,{'fixed':[i('explorers-pack'),i('javelin',4)],'choices':[ch(i('greataxe'),c('martial-melee-weapons')),ch(i('handaxe',2),c('simple-weapons'))]}),
      'bard':(53,{'fixed':[i('leather-armor'),i('dagger')],'choices':[ch(i('rapier'),i('longsword'),c('simple-weapons')),ch(i('diplomats-pack'),i('entertainers-pack')),ch(i('lute'),c('musical-instrument'))]}),
      'cleric':(58,{'fixed':[i('shield'),c('holy-symbol')],'choices':[ch(i('mace'),i('warhammer',requiresProficiency=True)),ch(i('scale-mail'),i('leather-armor'),i('chain-mail',requiresProficiency=True)),ch([i('crossbow-light'),i('crossbow-bolt',20)],c('simple-weapons')),ch(i('priests-pack'),i('explorers-pack'))]}),
      'druid':(67,{'fixed':[i('leather-armor'),i('explorers-pack'),c('druidic-focus')],'choices':[ch(i('shield',material='wood'),c('simple-weapons')),ch(i('scimitar'),c('simple-melee-weapons'))]}),
      'fighter':(73,{'fixed':[],'choices':[ch(i('chain-mail'),[i('leather-armor'),i('longbow'),i('arrow',20)]),ch([c('martial-weapons'),i('shield')],c('martial-weapons',2)),ch([i('crossbow-light'),i('crossbow-bolt',20)],i('handaxe',2)),ch(i('dungeoneers-pack'),i('explorers-pack'))]}),
      'monk':(78,{'fixed':[i('dart',10)],'choices':[ch(i('shortsword'),c('simple-weapons')),ch(i('dungeoneers-pack'),i('explorers-pack'))]}),
      'paladin':(85,{'fixed':[i('chain-mail'),c('holy-symbol')],'choices':[ch([c('martial-weapons'),i('shield')],c('martial-weapons',2)),ch(i('javelin',5),c('simple-melee-weapons')),ch(i('priests-pack'),i('explorers-pack'))]}),
      'ranger':(92,{'fixed':[i('longbow'),i('quiver'),i('arrow',20)],'choices':[ch(i('scale-mail'),i('leather-armor')),ch(i('shortsword',2),c('simple-melee-weapons',2)),ch(i('dungeoneers-pack'),i('explorers-pack'))]}),
      'rogue':(97,{'fixed':[i('leather-armor'),i('dagger',2),i('thieves-tools')],'choices':[ch(i('rapier'),i('shortsword')),ch([i('shortbow'),i('quiver'),i('arrow',20)],i('shortsword')),ch(i('burglars-pack'),i('dungeoneers-pack'),i('explorers-pack'))]}),
      'sorcerer':(102,{'fixed':[i('dagger',2)],'choices':[ch([i('crossbow-light'),i('crossbow-bolt',20)],c('simple-weapons')),ch(i('component-pouch'),c('arcane-focus')),ch(i('dungeoneers-pack'),i('explorers-pack'))]}),
      'warlock':(108,{'fixed':[i('leather-armor'),i('dagger',2)],'choices':[ch([i('crossbow-light'),i('crossbow-bolt',20)],c('simple-weapons')),ch(i('component-pouch'),c('arcane-focus')),ch(i('scholars-pack'),i('dungeoneers-pack')),ch(c('simple-weapons'))]}),
      'wizard':(115,{'fixed':[i('spellbook')],'choices':[ch(i('quarterstaff'),i('dagger')),ch(i('component-pouch'),c('arcane-focus')),ch(i('scholars-pack'),i('explorers-pack'))]}),
    }


# Level events from the class tables and headings. Repeated upgrades retain level.
EVENTS = {
 'barbarian':{1:'Rage|Unarmored Defense',2:'Reckless Attack|Danger Sense',3:'Primal Path',5:'Extra Attack|Fast Movement',7:'Feral Instinct',9:'Brutal Critical',11:'Relentless Rage',13:'Brutal Critical',15:'Persistent Rage',17:'Brutal Critical',18:'Indomitable Might',20:'Primal Champion'},
 'bard':{1:'Spellcasting|Bardic Inspiration',2:'Jack of All Trades|Song of Rest',3:'Bard College|Expertise',5:'Font of Inspiration|Bardic Inspiration',6:'Countercharm',9:'Song of Rest',10:'Bardic Inspiration|Expertise|Magical Secrets',13:'Song of Rest',14:'Magical Secrets',15:'Bardic Inspiration',17:'Song of Rest',18:'Magical Secrets',20:'Superior Inspiration'},
 'cleric':{1:'Spellcasting|Divine Domain',2:'Channel Divinity|Turn Undead',5:'Destroy Undead',6:'Channel Divinity',8:'Destroy Undead',10:'Divine Intervention',11:'Destroy Undead',14:'Destroy Undead',17:'Destroy Undead',18:'Channel Divinity',20:'Divine Intervention'},
 'druid':{1:'Druidic|Spellcasting',2:'Wild Shape|Druid Circle',4:'Wild Shape',8:'Wild Shape',18:'Timeless Body|Beast Spells',20:'Archdruid'},
 'fighter':{1:'Fighting Style|Second Wind',2:'Action Surge',3:'Martial Archetype',5:'Extra Attack',9:'Indomitable',11:'Extra Attack',13:'Indomitable',17:'Action Surge|Indomitable',20:'Extra Attack'},
 'monk':{1:'Unarmored Defense|Martial Arts',2:'Ki|Unarmored Movement',3:'Monastic Tradition|Deflect Missiles',4:'Slow Fall',5:'Extra Attack|Stunning Strike',6:'Ki-Empowered Strikes',7:'Evasion|Stillness of Mind',9:'Unarmored Movement',10:'Purity of Body',13:'Tongue of the Sun and Moon',14:'Diamond Soul',15:'Timeless Body',18:'Empty Body',20:'Perfect Self'},
 'paladin':{1:'Divine Sense|Lay on Hands',2:'Fighting Style|Spellcasting|Divine Smite',3:'Divine Health|Sacred Oath',5:'Extra Attack',6:'Aura of Protection',10:'Aura of Courage',11:'Improved Divine Smite',14:'Cleansing Touch',18:'Aura Improvements'},
 'ranger':{1:'Favored Enemy|Natural Explorer',2:'Fighting Style|Spellcasting',3:'Ranger Archetype|Primeval Awareness',5:'Extra Attack',6:'Favored Enemy|Natural Explorer',8:'Land’s Stride',10:'Natural Explorer|Hide in Plain Sight',14:'Favored Enemy|Vanish',18:'Feral Senses',20:'Foe Slayer'},
 'rogue':{1:'Expertise|Sneak Attack|Thieves’ Cant',2:'Cunning Action',3:'Roguish Archetype',5:'Uncanny Dodge',6:'Expertise',7:'Evasion',11:'Reliable Talent',14:'Blindsense',15:'Slippery Mind',18:'Elusive',20:'Stroke of Luck'},
 'sorcerer':{1:'Spellcasting|Sorcerous Origin',2:'Font of Magic',3:'Metamagic',10:'Metamagic',17:'Metamagic',20:'Sorcerous Restoration'},
 'warlock':{1:'Otherworldly Patron|Pact Magic',2:'Eldritch Invocations',3:'Pact Boon',11:'Mystic Arcanum',13:'Mystic Arcanum',15:'Mystic Arcanum',17:'Mystic Arcanum',20:'Eldritch Master'},
 'wizard':{1:'Spellcasting|Arcane Recovery',2:'Arcane Tradition',18:'Spell Mastery',20:'Signature Spells'},
}


def class_features(class_records):
    from spell_extract import slug
    features=[]
    table_page={'bard':54,'paladin':84}
    for cls in class_records:
        index=cls['index']
        page=table_page.get(index,cls['sources'][0]['pdfPages'][0])
        events={k:v.split('|') for k,v in EVENTS[index].items()}
        for level in cls['mechanics']['abilityScoreImprovementLevels']:
            events.setdefault(level,[]).append('Ability Score Improvement')
        from curated import SUBCLASS_LEVELS
        for level in SUBCLASS_LEVELS[index][1:]:
            events.setdefault(level,[]).append('Subclass Feature')
        for level,names in sorted(events.items()):
            for name in names:
                feature=record('class-feature',f'{index}-{level}-{slug(name)}',name,None,page,{'level':level},
                               'Evento della progressione di classe. Il nome e il livello non bastano a implementarne gli effetti.',missing=['effect','choices','resources','italianName'])
                feature['translation']['status']='missing'
                feature['relations']={'classId':cls['id']}
                if name=='Subclass Feature':
                    feature['verification']['identity']='derived-placeholder'
                    feature['interpretations'].append({'field':'name','kind':'derived','method':'Standardized event label for class-table subclass progression; not the literal name of a subclass privilege.'})
                features.append(feature)
    return features


def apply_equipment(class_records):
    for cls in class_records:
        page,value=starting_equipment()[cls['index']]
        cls['mechanics']['startingEquipment']=value
        cls['sources'].append(source(page,'Equipment'))
        cls['fieldSources']['startingEquipment']=[len(cls['sources'])-1]
        cls['verification']['missingFields'].remove('startingEquipment')
        casting_page={'bard':54,'cleric':59,'druid':67,'paladin':86,'ranger':93,'sorcerer':102,'warlock':108,'wizard':115}
        if cls['index'] in casting_page:
            cls['sources'].append(source(casting_page[cls['index']],'Spellcasting Ability'))
            cls['fieldSources']['castingAbility']=[len(cls['sources'])-1]
        table_page={'bard':54,'paladin':84}.get(cls['index'])
        if table_page:
            cls['sources'].append(source(table_page,'Class Progression Table'))
            cls['fieldSources']['abilityScoreImprovementLevels']=[len(cls['sources'])-1]
            cls['fieldSources']['subclassMinimumLevel']=[len(cls['sources'])-1]


def dmg_options():
    from curated import SUBCLASS_LEVELS
    rows=[('cleric','death','Death Domain','Dominio della Morte',[97,98]),('paladin','oathbreaker','Oathbreaker','Apostata',[98])]
    result=[]
    for cls,index,name,it,pages in rows:
        m={'minimumLevel':SUBCLASS_LEVELS[cls][0],'featureLevels':SUBCLASS_LEVELS[cls],'requiresDMApproval':True}
        if cls=='paladin':
            m['requiresAlignment']='evil'
            m['replaces']='previous-sacred-oath-features-and-spells'
        item=record('subclass',index,name,it,pages,m,'Opzione per personaggi malvagi e PNG; per i giocatori richiede il consenso del DM.',book='dmg',optional=True,missing=['fullFeatureEffects','spellGrants'])
        item['relations']={'classId':f'phb2014:class:{cls}'}
        result.append(item)
    return result


def apply_dmg_class_reviews(entities):
    """DMG PDF 97–98 read, both spell tables inspected on the render."""
    from spell_extract import slug
    by_id={e['id']:e for e in entities}
    rows=[
      ('death','cleric',1,'Bonus Proficiency','Competenza Aggiuntiva',97,{'weaponProficiency':'martial'},'Competenza nelle armi da guerra.'),
      ('death','cleric',1,'Reaper','Mietitore',97,{'learnCantrips':1,'school':'necromancy','list':'any','whenCastingNecromancyCantripNormallyTargetingOneCreature':{'mayTargetCreatures':2,'bothWithinSpellRange':True,'maximumSeparationFt':5}},'Impari un trucchetto di necromanzia da qualsiasi lista. Un trucchetto di necromanzia normalmente rivolto a una creatura può invece colpirne due entro gittata e a cinque piedi l’una dall’altra.'),
      ('death','cleric',2,'Touch of Death','Tocco della Morte',98,{'trigger':'hit-creature-with-melee-attack','resourceCost':{'pool':'cleric-channel-divinity','cost':1},'additionalDamage':'5+2*clericLevel','damageType':'necrotic','requiresWeaponAttack':False},'Quando colpisci una creatura con un attacco in mischia, anche senza arma, un uso di Incanalare Divinità aggiunge cinque più due volte il livello da chierico danni necrotici.'),
      ('death','cleric',6,'Inescapable Destruction','Distruzione Ineluttabile',98,{'ignoreResistance':'necrotic','damageOrigins':['own-cleric-spells','own-channel-divinity-options'],'ignoresImmunity':False},'I danni necrotici delle tue magie da chierico e opzioni di Incanalare Divinità ignorano la resistenza, senza ignorare l’immunità.'),
      ('death','cleric',8,'Divine Strike','Colpo Divino',98,{'trigger':'hit-creature-with-weapon-attack','maximumUses':'once-per-own-turn','additionalDamage':'1d8','additionalDamageFromCleric14':'2d8','damageType':'necrotic'},'Una volta nel tuo turno il colpo con arma aggiunge 1d8 necrotico, 2d8 dal quattordicesimo livello da chierico.'),
      ('death','cleric',17,'Improved Reaper','Mietitore Migliorato',98,{'school':'necromancy','spellLevelMinimum':1,'spellLevelMaximum':5,'spellMustTarget':'only-one-creature','mayTargetCreatures':2,'bothWithinSpellRange':True,'maximumSeparationFt':5,'consumedMaterialsRequired':'for-each-target'},'Una necromanzia dal primo al quinto livello rivolta a una sola creatura può invece colpirne due entro gittata e a cinque piedi tra loro. I materiali consumati vanno forniti per ciascun bersaglio.'),
      ('oathbreaker','paladin',3,'Control Undead','Controllare Non Morti',98,{'activation':'action','resourceCost':{'pool':'paladin-channel-divinity','cost':1},'target':'one-visible-undead-within-30-ft','save':'wisdom','saveDC':'paladin-spell-save-DC','immuneIf':'challenge-rating>=own-paladin-level','failure':'obeys-paladin-commands','maximumHours':24,'endsEarlyWhen':'paladin-uses-Control-Undead-again'},'Un’azione e Incanalare Divinità impongono TS Saggezza a un non morto visibile entro trenta piedi: fallendo obbedisce fino a ventiquattro ore o al successivo uso. GS pari o superiore al tuo livello da paladino rende immune.'),
      ('oathbreaker','paladin',3,'Dreadful Aspect','Aspetto Terrificante',98,{'activation':'action','resourceCost':{'pool':'paladin-channel-divinity','cost':1},'targets':'chosen-creatures-within-30-ft-that-see-paladin','save':'wisdom','saveDC':'paladin-spell-save-DC','failure':{'condition':'frightened-of-paladin','durationMinutes':1,'repeatSave':'end-of-target-turn-only-if-more-than-30-ft-from-paladin','successfulRepeat':'ends-effect'}},'Le creature scelte entro trenta piedi che ti vedono fanno TS Saggezza o ti temono per un minuto. Ripetono il TS soltanto se finiscono il turno a più di trenta piedi da te.'),
      ('oathbreaker','paladin',7,'Aura of Hate','Aura d’Odio',98,{'targets':['self','any-fiend-or-undead-in-aura'],'requiresFriendlyTarget':False,'radiusFt':10,'radiusFromPaladin18Ft':30,'meleeWeaponDamageBonus':'max(1,charismaModifier)','maximumPaladinsBenefitingSameCreature':1},'Tu e ogni immondo o non morto entro dieci piedi aggiungete Carisma, minimo uno, ai danni con armi in mischia; vale anche per nemici. Raggio trenta dal livello 18, senza cumulare più paladini.'),
      ('oathbreaker','paladin',15,'Supernatural Resistance','Resistenza Soprannaturale',98,{'damageResistances':['bludgeoning','piercing','slashing'],'condition':'nonmagical-weapons'},'Resistenza a contundente, perforante e tagliente da armi non magiche. Si conserva la formulazione della stampa DMG.'),
      ('oathbreaker','paladin',20,'Dread Lord','Signore del Terrore',98,{'activation':'action','durationMinutes':1,'radiusFt':30,'brightLightBecomes':'dim','startOfEnemyTurn':{'requires':'enemy-frightened-by-paladin-and-in-aura','damage':'4d10','damageType':'psychic'},'shadowProtection':{'targets':'self-and-chosen-creatures-in-aura','sightReliantAttackers':'disadvantage'},'shadowAttack':{'activation':'bonus-action-on-own-turn','target':'one-creature','attack':'melee-spell-attack','damage':'3d10+charismaModifier','damageType':'necrotic','explicitAttackReachOrRange':'not-stated'},'resource':{'uses':1,'recovery':['long-rest']}},'Per un minuto l’aura di trenta piedi attenua la luce intensa. Il nemico che ti teme e inizia il turno dentro subisce 4d10 psichici. Le ombre proteggono te e gli scelti dagli attacchi basati sulla vista; un’azione bonus permette un attacco magico in mischia da 3d10 più Carisma necrotici. Un uso per riposo lungo.'),
    ]
    added=[]
    for sub,cls,level,name,it,pages,effect,summary in rows:
        e=record('subclass-feature',f'{sub}-{level}-'+slug(name),name,it,pages,{'level':level,'effect':effect},summary,book='dmg',optional=True)
        e['relations']={'classId':'phb2014:class:'+cls,'subclassId':'dmg2014:subclass:'+sub};added.append(e)
    spell_rows=[('death','cleric',1,97,['False Life','Ray of Sickness','Blindness/Deafness','Ray of Enfeeblement','Animate Dead','Vampiric Touch','Blight','Death Ward','Antilife Shell','Cloudkill'],[1,3,5,7,9],59,'Domain Spells','Incantesimi del Dominio'),('oathbreaker','paladin',3,98,['Hellish Rebuke','Inflict Wounds','Crown of Madness','Darkness','Animate Dead','Bestow Curse','Blight','Confusion','Contagion','Dominate Person'],[3,5,9,13,17],86,'Oath Spells','Incantesimi dell’Apostata')]
    for sub,cls,level,page,names,levels,base_page,name,it in spell_rows:
        grants=[{cls+'Level':levels[i//2],'spellId':'phb2014:spell:'+slug(n),'alwaysPrepared':True,'countsAgainstPreparedLimit':False,'countsAs'+cls.title()+'Spell':True} for i,n in enumerate(names)]
        e=record('subclass-feature',f'{sub}-{level}-'+slug(name),name,it,page,{'level':level,'effect':{'grants':grants,'spellDescriptionsVerifiedByGrantTable':False}},'Le dieci magie della tabella sono sempre preparate ai livelli della propria classe indicati, senza occupare il limite; la tabella non certifica le loro descrizioni.',book='dmg',optional=True)
        e['sources'][0]['verification']='read-local-render';e['sources'].append(source(base_page,name));e['fieldSources']['effect']=[0,1]
        e['relations']={'classId':'phb2014:class:'+cls,'subclassId':'dmg2014:subclass:'+sub,'grantedSpellIds':[g['spellId'] for g in grants]};added.append(e)
    for sub in ['death','oathbreaker']:
        parent=by_id['dmg2014:subclass:'+sub];fs=[e for e in added if e['relations']['subclassId']==parent['id']]
        parent['relations']['featureIds']=[e['id'] for e in fs];parent['verification'].update(complete=True,missingFields=[])
        parent['summaryIt']='Scelta opzionale del DMG 2014 per giocatori solo con consenso del DM. '+' '.join(e['summaryIt'] for e in fs)
    oath=by_id['dmg2014:subclass:oathbreaker']
    oath['mechanics']['atonement']={'requiresDMApproval':True,'first':'cease-evil-alignment-and-demonstrate-with-words-and-deeds','then':['lose-all-Oathbreaker-features','choose-deity-and-sacred-oath'],'newOathFeaturesRequire':'complete-dangerous-quest-or-trial-chosen-by-DM','mayChangePreviousDeityOrOath':'with-DM-permission','secondOathBreach':'may-become-Oathbreaker-again-but-cannot-atone'}
    oath['fieldSources']['atonement']=[0]
    entities.extend(added)
    return entities


def supplemental_rules():
    return [
      record('rule','attunement','Attunement','Sintonia',[137,139],
             {'maxItemsPerCreature':3,'maxCreaturesPerItem':1,'duplicateCopiesAllowed':False,'requires':'separate-uninterrupted-short-rest-in-contact',
              'endsWhen':['prerequisites-lost','more-than-100-ft-for-24-hours','death','another-creature-attunes'],'voluntaryEnd':'short-rest-unless-cursed','withoutAttunement':'only-nonmagical-benefits-unless-item-exception','classPrerequisite':'member-of-class; monster-with-slots-and-class-list-qualifies','spellcasterPrerequisite':'casts-one-spell-by-traits-or-features-not-item'},
             'La sintonia è distinta dall’identificazione. Non puoi sintonizzarti con un quarto oggetto o con più copie dello stesso oggetto.',book='dmg'),
      record('rule','magic-item-identification','Identifying a Magic Item','Identificare Oggetti Magici',137,
             {'handling':'senses-extraordinary-but-does-not-learn-properties','methods':['identify-spell','short-rest-focused-on-one-item-in-contact'],'potions':'small-taste-identifies','harderIdentificationVariant':{'optional':True,'requiresDMApproval':True,'removeShortRestMethod':True,'methods':['identify','experimentation','both']}},
             'Toccare rivela una natura insolita, non le proprietà. Identificare o un riposo breve in contatto rivela uso e proprietà; un assaggio identifica pozioni. La variante del DM elimina il metodo del riposo.',book='dmg'),
      record('rule','magic-item-rarity','Magic Item Rarity','Rarità degli Oggetti Magici',136,
             {'levelsAreGuidanceNotPrerequisites':True,'availability':'DM-determined-not-automatic-shopping','valuesGP':{'common':[50,100],'uncommon':[101,500],'rare':[501,5000],'very-rare':[5001,50000],'legendary':[50001,None]},'suggestedLevels':{'common':1,'uncommon':1,'rare':5,'very-rare':11,'legendary':17},'consumableValueMultiplier':.5},
             'Rarità, livelli e prezzi orientano il DM: non vietano il ritrovamento anticipato. Pozioni e pergamene valgono normalmente metà di un permanente della stessa rarità.',book='dmg'),
      record('rule','magic-item-use','Wearing, Wielding and Activating Items','Usare Oggetti Magici',[140,141,142],
             {'armor':'must-wear-unless-exception','rings':'wear-on-digit-unless-exception','weapon':'held','staff':'usable-as-quarterstaff-unless-exception','pairedItems':'both-pieces-required','usualWornLimits':{'footwear':1,'gloves-or-gauntlets':1,'bracers':1,'armor':1,'headwear':1,'cloak':1},'exceptions':'DM-discretion-including-nonhumanoid-fit','size':'usually-adjustable-DM-may-except','unspecifiedArmorOrWeaponSubtype':'DM-choose-or-random','magicWeaponAmmunition':'magical-to-overcome-nonmagical-attack-and-damage-resistance-immunity','magicActivationActionIsUseAnObject':False,'fastHandsCanActivateMagicItems':False,'commandWord':'must-speak-no-silence','potionDrinkOrAdminister':'action','potion':'immediate-effect-and-consumed','oil':'item-specific-application-time','scrollActivationInLocalPrinting':'action-to-read','scrollReaderDefault':'understands-a-written-language-unless-description-exception','consumable':'loses-magic-when-used'},
             'Rispetta modo d’impiego, entrambe le parti di una coppia ed eccezioni del DM. Bere o somministrare una pozione richiede azione. L’attivazione magica non usa Usare un Oggetto e non beneficia di Mani Veloci. Parole di comando richiedono voce. Il tempo delle pergamene conserva separatamente prima formulazione ed erratum.',book='dmg'),
      record('rule','magic-item-spellcasting','Spells','Incantesimi degli Oggetti',142,
             {'defaultSpellLevelInLocalPrinting':'lowest-possible-spell-level','spendsCasterSpellSlots':False,'componentsRequired':False,'normalCastingTimeRangeDuration':True,'concentrationRequiredIfSpellRequires':True,'itemSpecificExceptionsOverride':True,'effectsWithoutCasting':'many-potions-grant-effect-not-cast','ownSpellcastingAbility':'choose-if-multiple; if-none-modifier-zero-plus-proficiency'},
             'Una magia lanciata dall’oggetto usa normalmente livello minimo, tempo, gittata e durata dell’incantesimo; niente slot personali o componenti. La concentrazione resta richiesta. Le pozioni possono concedere direttamente effetti senza lancio. Le eccezioni del singolo oggetto prevalgono.',book='dmg'),
      record('rule','magic-item-charges-resilience','Charges and Magic Item Resilience','Cariche e Resistenza degli Oggetti',142,
             {'chargeCountRevealedBy':['identify','attunement'],'recoveredChargeCountKnownBy':'attuned-creature','durability':'at-least-normal-item','usualDamageResistance':'all-damage-except-potions-and-scrolls','artifactDestruction':'extraordinary-specific-methods','nonRechargeableWandVariant':{'optional':True,'requiresDMApproval':True,'suggestedMaximumInitialCharges':25,'recharges':False}},
             'Identificazione e sintonia rivelano le cariche; lo sintonizzato conosce quelle recuperate. Di solito gli oggetti, esclusi pozioni e pergamene, resistono a tutti i danni; gli artefatti richiedono metodi speciali. Bacchette non ricaricabili sono una variante del DM.',book='dmg'),
      record('rule','cursed-magic-items','Cursed Items','Oggetti Maledetti',[139,140],
             {'identificationUsuallyRevealsCurse':False,'voluntaryEndAttunement':'requires-break-curse-first','examplesOfCurseBreaking':['remove-curse'],'individualDescriptionOverrides':True},
             'Di norma identificare non rivela una maledizione; lore e descrizione possono fare eccezione. La sintonia non termina volontariamente prima di spezzare la maledizione.',book='dmg'),
      record('rule','crafting-magic-items','Crafting a Magic Item','Creare Oggetti Magici',[129,130,142],
             {'requiresDMApproval':True,'requires':['formula','spellcaster-with-slots','can-cast-spells-item-produces'],'minimumLevels':{'common':3,'uncommon':3,'rare':6,'very-rare':11,'legendary':17},'costsGP':{'common':100,'uncommon':500,'rare':5000,'very-rare':50000,'legendary':500000},'consumableCostMultiplier':.5,'progressGPPerWorkerDay':25,'workHoursPerDay':8,'producedSpellSlot':'one-of-spell-level-per-day','materialComponents':'available-throughout; if-consumed-once-per-day-unless-item-produces-spell-once-then-once-total','multipleWorkers':'each-meets-level; contribute-spells-slots-components-and-participate-whole-process','DMMayAddRequirements':'special-materials-or-locations','lifestyle':{'modest':'free','comfortable':'half-price'},'formulaRarity':'one-step-rarer-than-item; none-for-legendary','formulaCommonCreationCampaignVariant':'may-match-item; common-uncommon-may-sell-at-double-item-value'},
             'Opzione autorizzata dal DM: formula, livelli, slot e magie pertinenti. Ogni collaboratore produce venticinque monete d’oro per otto ore al giorno. Consumabili costano metà; componenti consumate giornalmente o una sola volta per oggetti che producono la magia una volta. Collaboratori partecipano all’intero lavoro; stile modesto gratuito o agiato a metà.',book='dmg',optional=True),
      record('rule','monster-hit-dice','Hit Points','Dadi Vita dei Mostri',[8],
             {'bySize':{'Tiny':4,'Small':6,'Medium':8,'Large':10,'Huge':12,'Gargantuan':20},'constitutionAdded':'modifier-times-number-of-hit-dice','averageDice':'count-times-(die+1)/2'},
             'Il dado vita dei mostri dipende dalla taglia; il modificatore di Costituzione si applica per ogni dado.',book='mm'),
      record('rule','monster-proficiency','Saving Throws and Skills','Competenza dei Mostri',[9],
             {'proficiencyByChallenge':{'0-4':2,'5-8':3,'9-12':4,'13-16':5,'17-20':6,'21-24':7,'25-28':8,'29-30':9},'checkBonus':'ability-modifier-plus-proficiency-with-explicit-exceptions'},
             'La competenza deriva dal grado di sfida, non da un livello del personaggio; alcune statistiche prevedono eccezioni esplicite.',book='mm'),
      record('rule','monster-spellcasting','Innate Spellcasting and Spellcasting','Incantesimi dei Mostri',[11],
             {'innateDefaultCast':'lowest-level-no-upcast','innateCantripScalingWhenNoLevel':'challenge-rating','classSpellcastingCantripScaling':'spellcaster-level','classSpellcastingCanUpcastWithSlots':True},
             'Mantieni separate magia innata e capacità di classe; il livello che potenzia un trucchetto dipende dalla fonte.',book='mm'),
      record('rule','monster-senses','Senses','Sensi Speciali',[9,10],
             {'blindsight':'perception-without-sight-within-radius','tremorsenseRequires':'same-ground-or-substance','tremorsenseCannotDetect':['flying','incorporeal'],'truesight':['magical-darkness','invisible','visual-illusions','original-form','ethereal-plane']},
             'Ogni senso speciale ha limiti propri; percezione tellurica non rileva creature in volo o incorporee.',book='mm'),
    ]
