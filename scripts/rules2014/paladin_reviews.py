"""PHB PDF 83–89 read; progression and all three oath lists checked on renders."""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:paladin'
OATHS={
 'devotion':(87,['Protection from Evil and Good','Sanctuary','Lesser Restoration','Zone of Truth','Beacon of Hope','Dispel Magic','Freedom of Movement','Guardian of Faith','Commune','Flame Strike']),
 'ancients':(88,['Ensnaring Strike','Speak with Animals','Moonbeam','Misty Step','Plant Growth','Protection from Energy','Ice Storm','Stoneskin','Commune with Nature','Tree Stride']),
 'vengeance':(89,['Bane',"Hunter's Mark",'Hold Person','Misty Step','Haste','Protection from Energy','Banishment','Dimension Door','Hold Monster','Scrying'])
}
TENETS={
 'devotion':['Parlare sinceramente e rispettare le promesse','Agire con coraggio e prudenza','Aiutare i deboli e usare misericordia saggia','Agire equamente riducendo il danno','Assumersi responsabilità e rispettare autorità giuste'],
 'ancients':['Diffondere speranza con misericordia e perdono','Difendere bontà, bellezza e vita','Conservare la propria gioia','Essere un esempio di gioia e coraggio'],
 'vengeance':['Affrontare prima il male maggiore','Non concedere misericordia ai nemici giurati','Superare gli scrupoli contro quei nemici','Riparare le sofferenze causate dai nemici']
}


def apply_paladin_reviews(entities):
    by_id={e['id']:e for e in entities}
    turned={'durationMinutes':1,'endsOn':'takes-damage','movement':'try-to-move-as-far-as-possible-from-paladin',
       'cannotWillinglyMoveWithinFt':30,'canTakeReactions':False,'allowedActions':['Dash','escape-movement-preventing-effect'],
       'ifCannotMoveMayUse':'Dodge'}
    channel={'pool':'paladin-channel-divinity','uses':1,'recovery':['short-rest','long-rest']}
    daily={'uses':1,'recovery':['long-rest']}
    rows=[
      ('devotion',3,'Sacred Weapon','Arma Sacra',87,{'activation':'action','resourceCost':channel,'target':'one-held-weapon','durationMinutes':1,
       'attackBonus':'max(1,charismaModifier)','brightLightRadiusFt':20,'additionalDimLightFt':20,'weaponBecomesMagical':True,
       'endOnOwnTurn':'part-of-another-action','endsEarlyIf':['no-longer-held-or-carried','paladin-unconscious']},
       'Con un uso di Incanalare Divinità e un’azione consacri un’arma per un minuto: aggiungi Carisma agli attacchi, minimo uno, e diventa magica. Emette luce per venti più venti piedi; termina se non la porti più o perdi coscienza.'),
      ('devotion',3,'Turn the Unholy','Scacciare gli Empi',87,{'activation':'action','resourceCost':channel,'requires':['present-holy-symbol','speak-prayer'],
       'targetTypes':['fiend','undead'],'radiusFt':30,'targetMust':'see-or-hear-paladin','save':'wisdom','saveDC':'paladin-spell-save-DC','failedSave':turned},
       'Con un’azione, simbolo e preghiera, immondi e non morti entro trenta piedi che ti vedono o sentono fanno TS Saggezza. Se falliscono fuggono senza reazioni per un minuto o fino a subire danni, usando solo Scatto, fuga da vincoli o Schivata se bloccati.'),
      ('devotion',7,'Aura of Devotion','Aura di Devozione',87,{'radiusFt':10,'radiusFtFromPaladin18':30,'beneficiaries':'self-and-friendly-creatures','requiresConscious':True,'prevents':'charmed'},
       'Finché sei cosciente, tu e gli amici entro dieci piedi non potete essere affascinati; il raggio sale a trenta dal livello 18.'),
      ('devotion',15,'Purity of Spirit','Purezza di Spirito',87,{'alwaysUnderSpellEffects':'phb2014:spell:protection-from-evil-and-good'},
       'Sei sempre protetto dagli effetti di Protezione dal Bene e dal Male.'),
      ('devotion',20,'Holy Nimbus','Nimbo Sacro',87,{'activation':'action','resource':daily,'durationMinutes':1,'sunlight':True,'brightLightRadiusFt':30,
       'additionalDimLightFt':30,'enemyStartsTurnInBrightLight':{'damage':10,'type':'radiant'},'saveAdvantageAgainstSpellsCastBy':['fiend','undead']},
       'Per un minuto emani luce solare intensa per trenta piedi e fioca per altri trenta; i nemici che iniziano il turno nella luce intensa subiscono dieci radiosi. Hai vantaggio ai TS contro magie di immondi e non morti. Recupero dopo riposo lungo.'),
      ('ancients',3,"Nature's Wrath",'Collera della Natura',88,{'activation':'action','resourceCost':channel,'target':'visible-creature-within-10-ft',
       'saveAbilityChosenByTarget':['strength','dexterity'],'saveDC':'paladin-spell-save-DC','failedSave':'restrained',
       'repeatSave':'end-of-each-target-turn','successfulSave':'released-and-vines-vanish','fixedDuration':'not-stated'},
       'Un’azione e un uso di Incanalare Divinità evocano rampicanti contro una creatura visibile entro dieci piedi. Sceglie TS Forza o Destrezza; se fallisce è trattenuta e ripete al termine dei propri turni fino a liberarsi.'),
      ('ancients',3,'Turn the Faithless','Scacciare gli Infedeli',88,{'activation':'action','resourceCost':channel,'requires':'present-holy-symbol',
       'targetTypes':['fey','fiend'],'radiusFt':30,'targetMust':'hear-paladin','save':'wisdom','saveDC':'paladin-spell-save-DC',
       'failedSave':{**turned,'trueFormRevealedWhileTurned':True}},
       'Folletti e immondi che ti sentono entro trenta piedi fanno TS Saggezza o vengono scacciati per un minuto, fino a subire danni. Fuggono senza reazioni, con azioni limitate; la vera forma nascosta viene rivelata.'),
      ('ancients',7,'Aura of Warding','Aura di Interdizione',88,{'radiusFt':10,'radiusFtFromPaladin18':30,'beneficiaries':'self-and-friendly-creatures',
       'resistanceTo':'damage-from-spells','consciousnessRequirement':'not-stated'},
       'Tu e gli amici entro dieci piedi avete resistenza ai danni degli incantesimi; il raggio sale a trenta dal livello 18. Il passaggio non richiede esplicitamente coscienza, diversamente dalle altre aure.'),
      ('ancients',15,'Undying Sentinel','Sentinella Immortale',88,{'trigger':'reduced-to-zero-hp-without-instant-death','mayInsteadHaveHP':1,'resource':daily,
       'agingBenefits':['no-old-age-drawbacks','cannot-be-magically-aged'],'preventsDeathFromOldAge':'not-stated'},
       'Una volta per riposo lungo, quando scendi a zero PF senza morire immediatamente puoi restare a un PF. Non subisci gli svantaggi della vecchiaia né invecchiamento magico; il testo non promette vita infinita.'),
      ('ancients',20,'Elder Champion','Campione degli Antichi',88,{'activation':'action','resource':daily,'durationMinutes':1,
       'startOfEachOwnTurnHealing':10,'paladinSpellCastingTimeReplacement':{'from':'action','to':'bonus-action'},
       'enemyWithin10FtSaveDisadvantageAgainst':['paladin-spells','paladin-channel-divinity']},
       'Una trasformazione di un minuto recupera dieci PF all’inizio dei tuoi turni, consente di lanciare con azione bonus le magie da paladino normalmente da un’azione e impone svantaggio ai nemici entro dieci piedi contro magie e Incanalare Divinità. Un uso per riposo lungo.'),
      ('vengeance',3,'Abjure Enemy','Abiurare il Nemico',89,{'activation':'action','resourceCost':channel,'requires':['present-holy-symbol','speak-prayer'],
       'target':'visible-creature-within-60-ft','unaffectedIf':'immune-to-frightened','save':'wisdom','saveDC':'paladin-spell-save-DC',
       'saveDisadvantageTypes':['fiend','undead'],'durationMinutes':1,'endsOn':'takes-any-damage',
       'failedSave':{'condition':'frightened','speed':0,'benefitsFromSpeedBonuses':False},'successfulSave':{'speedMultiplier':0.5}},
       'Una creatura visibile entro sessanta piedi fa TS Saggezza, con svantaggio se immondo o non morto. Il fallimento la spaventa e azzera la velocità; il successo dimezza la velocità. Dura un minuto o fino ai danni; chi è immune alla paura non è influenzato.'),
      ('vengeance',3,'Vow of Enmity','Voto di Inimicizia',89,{'activation':'bonus-action','resourceCost':channel,'target':'visible-creature-within-10-ft',
       'advantageOn':'attacks-against-target','durationMinutes':1,'endsEarlyWhenTarget':['zero-hit-points','unconscious']},
       'Un’azione bonus e un uso di Incanalare Divinità concedono vantaggio agli attacchi contro una creatura visibile entro dieci piedi, per un minuto o fino a zero PF o perdita di coscienza del bersaglio.'),
      ('vengeance',7,'Relentless Avenger','Vendicatore Implacabile',89,{'trigger':'hit-creature-with-opportunity-attack','maximumMovement':'half-speed',
       'timing':'immediately-after-attack-as-part-of-same-reaction','provokesOpportunityAttacks':False},
       'Dopo un attacco di opportunità che colpisce, nella stessa reazione puoi muoverti fino a metà velocità senza provocare attacchi di opportunità.'),
      ('vengeance',15,'Soul of Vengeance','Anima della Vendetta',89,{'trigger':'creature-under-own-vow-of-enmity-makes-attack','activation':'reaction',
       'attack':'one-melee-weapon-attack-against-triggering-creature','requires':'within-weapon-range'},
       'Quando il bersaglio del tuo Voto di Inimicizia effettua un attacco, puoi reagire con un attacco con arma in mischia contro di lui se è a portata.'),
      ('vengeance',20,'Avenging Angel','Angelo Vendicatore',89,{'activation':'action','resource':daily,'durationHours':1,'flySpeedFt':60,'auraRadiusFt':30,
       'enemySaveTrigger':'first-entry-or-start-of-turn-in-aura-during-battle','save':'wisdom','saveDC':'paladin-spell-save-DC',
       'maximumSavesPerEnemyPerBattle':1,
       'failure':{'condition':'frightened','durationMinutes':1,'endsOn':'any-damage','attacksAgainstTarget':'advantage'}},
       'Per un’ora voli a sessanta piedi ed emani un’aura di trenta piedi: al primo ingresso o inizio turno durante la battaglia ogni nemico fa TS Saggezza. Se fallisce è spaventato per un minuto o fino ai danni, e gli attacchi contro di lui hanno vantaggio. Recupero dopo riposo lungo.'),
    ]
    added=[]
    for sub,level,name,it,page,effect,summary in rows:
        missing=['spellDescription:protection-from-evil-and-good'] if name=='Purity of Spirit' and not by_id['phb2014:spell:protection-from-evil-and-good']['verification']['complete'] else []
        e=record('subclass-feature',f'{sub}-{level}-'+slug(name),name,it,page,{'level':level,'effect':effect},summary,missing=missing)
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub}
        added.append(e)
    for sub,(page,names) in OATHS.items():
        grants=[{'paladinLevel':[3,5,9,13,17][i//2],'spellId':'phb2014:spell:'+slug(name),'alwaysPrepared':True,
                 'countsAgainstPreparedLimit':False,'countsAsPaladinSpell':True} for i,name in enumerate(names)]
        e=record('subclass-feature',f'{sub}-3-oath-spells','Oath Spells','Incantesimi del Giuramento',page,
                 {'level':3,'effect':{'grants':grants,'spellDescriptionsVerifiedByGrantTable':False}},
                 'Le coppie del giuramento arrivano ai livelli 3, 5, 9, 13 e 17; sono sempre preparate senza occupare il limite e contano come magie da paladino.')
        e['sources'][0]['verification']='read-local-render';e['sources'].append(source(86,'Oath Spells'))
        e['fieldSources']['effect']=[0,1];e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub,'grantedSpellIds':[g['spellId'] for g in grants]}
        added.append(e)
    entities.extend(added)
    styles=['defense','dueling','great-weapon-fighting','protection']
    origin='phb2014:class-feature:paladin-2-fighting-style'
    for index in styles:
        e=by_id['phb2014:class-option:fighter-'+index]
        e['mechanics']['selectionOrigins'].append({'originId':origin,'classId':CLASS,'minimumClassLevel':2})
        e['sources'].append(source(85,'Fighting Style'));e['fieldSources']['selectionOrigins'].append(len(e['sources'])-1)
    core={
      'Divine Sense':(85,'Percezione del Divino',{'activation':'action','expires':'end-of-own-next-turn','radiusFt':60,
       'creatureDetection':{'types':['celestial','fiend','undead'],'excluded':'behind-total-cover','reveals':['location','type'],'revealsIdentity':False},
       'consecrationDetection':{'targets':['place','object'],'reveals':'consecrated-or-desecrated-presence','totalCoverRestriction':'not-stated'},
       'resource':{'maximum':'1+charismaModifier','recovery':['long-rest']}},'Un’azione individua posizione e tipo di celestiali, immondi e non morti entro sessanta piedi fino alla fine del tuo prossimo turno, esclusa copertura totale. Rileva anche luoghi o oggetti consacrati; non identifica le creature.'),
      'Lay on Hands':(85,'Imposizione delle Mani',{'activation':'action','range':'touch','resource':{'maximum':'5*paladinLevel','recovery':['long-rest']},
       'healing':'chosen-hp-up-to-remaining-pool','alternativeCostPerDiseaseOrPoison':5,'mayRemoveMultipleInOneAction':True,'excludedTypes':['undead','construct']},'Il pool di cinque PF per livello da paladino si recupera con riposo lungo. Un’azione cura la creatura toccata o spende cinque punti per ogni malattia o veleno da eliminare; non funziona su non morti e costrutti.'),
      'Fighting Style':(85,'Stile di Combattimento',{'choose':1,'optionIds':['phb2014:class-option:fighter-'+s for s in styles],'mayChooseKnownStyleAgain':False},'Scegli Difesa, Duellare, Combattere con Armi Possenti o Protezione; non puoi imparare di nuovo uno stile già conosciuto.'),
      'Spellcasting':([85,86],'Incantesimi',{'ability':'charisma','list':'paladin','preparation':'max(1,charismaModifier+floor(paladinLevel/2))',
       'preparedSpellLevels':'available-paladin-class-slots','changePreparation':'finish-long-rest','preparationMinutes':'sum-prepared-spell-levels',
       'spellSlotScope':'your-spells','slotRecovery':['long-rest'],'focus':'holy-symbol','ritualCastingGranted':False},'Dal livello 2 prepari magie con Carisma più metà livello da paladino arrotondata in basso, minimo una. I livelli seguono la tabella di classe; cambi lista e recuperi slot dopo riposo lungo. Il focus è un simbolo sacro; la classe non concede lancio rituale.'),
      'Divine Smite':(86,'Punizione Divina',{'trigger':'hit-creature-with-melee-weapon-attack','cost':'one-paladin-spell-slot',
       'damage':'min(slotLevel+1,5)d8','damageType':'radiant','extraDieAgainst':['undead','fiend'],'maximumDiceWithTypeBonus':'not-explicitly-stated'},'Dopo aver colpito una creatura con un attacco con arma in mischia, spendi uno slot da paladino: 2d8 radiosi più 1d8 per livello superiore, massimo 5d8, e un altro dado contro immondi o non morti. Le precisazioni delle errata sono separate.'),
      'Divine Health':(86,'Salute Divina',{'immunity':'disease'},'Sei immune alle malattie.'),
      'Sacred Oath':(86,'Giuramento Sacro',{'chooseSubclass':1,'subclassIds':['phb2014:subclass:'+s for s in OATHS],'featureLevels':[3,7,15,20],
       'channelDivinity':{'maximumUses':1,'recovery':['short-rest','long-rest'],'chooseEffectEachUse':True,'saveDC':'paladin-spell-save-DC'}},'Scegli Devozione, Antichi o Vendetta. Le opzioni di Incanalare Divinità condividono un uso recuperato con riposo breve o lungo e la CD delle magie da paladino.'),
      'Extra Attack':(86,'Attacco Extra',{'attackActionAttacks':2,'requires':'own-turn'},'Con l’azione Attaccare nel tuo turno puoi effettuare due attacchi.'),
      'Aura of Protection':(86,'Aura di Protezione',{'radiusFt':10,'radiusFtFromPaladin18':30,'requiresConscious':True,'beneficiaries':'self-and-friendly-creatures','savingThrowBonus':'max(1,charismaModifier)'},'Finché sei cosciente, tu e gli amici entro dieci piedi aggiungete Carisma ai TS, minimo uno. Dal livello 18 il raggio è trenta piedi.'),
      'Aura of Courage':(86,'Aura di Coraggio',{'radiusFt':10,'radiusFtFromPaladin18':30,'requiresConscious':True,'beneficiaries':'self-and-friendly-creatures','prevents':'frightened'},'Finché sei cosciente, tu e gli amici nell’aura non potete essere spaventati; dieci piedi, trenta dal livello 18.'),
      'Improved Divine Smite':(86,'Punizione Divina Migliorata',{'trigger':'hit-creature-with-melee-weapon','additionalDamage':'1d8','damageType':'radiant','statedStacksWithDivineSmite':True},'Ogni colpo con un’arma da mischia contro una creatura aggiunge 1d8 radiosi. La prima stampa esplicita che si somma a Punizione Divina; l’erratum elimina quella frase senza eliminare il danno aggiuntivo.'),
      'Cleansing Touch':(86,'Tocco Purificatore',{'activation':'action','endsSpells':1,'targetChoice':['self','willing-touched-creature'],
       'resource':{'maximum':'max(1,charismaModifier)','recovery':['long-rest']}},'Con un’azione termini una magia su te stesso o una creatura consenziente toccata. Usi pari a Carisma, minimo uno, recuperati dopo riposo lungo.'),
      'Aura Improvements':(86,'Miglioramento delle Aure',{'radiusFt':30,'appliesTo':['aura-of-protection','aura-of-courage','selected-oath-aura-if-present']},'Le aure di Protezione, Coraggio e del giuramento che prevedono l’incremento raggiungono trenta piedi.'),
    }
    for e in entities:
        if e['kind']!='class-feature' or e['relations']['classId']!=CLASS:continue
        if e['name']=='Subclass Feature':
            e['mechanics']['concreteAlternativeIds']=[f['id'] for f in added if f['mechanics']['level']==e['mechanics']['level']];e['fieldSources']['concreteAlternativeIds']=[0]
            continue
        if e['name'] not in core:continue
        pages,it,effect,summary=core[e['name']]
        e.update(nameIt=it,summaryIt=summary,translation={'language':'it','status':'assistant-translation'})
        e['sources'].append(source(pages,e['name']));e['mechanics']['effect']=effect;e['fieldSources']['effect']=[len(e['sources'])-1]
        e['verification'].update(complete=True,missingFields=[])
    for sub in OATHS:
        parent=by_id['phb2014:subclass:'+sub];fs=[f for f in added if f['relations']['subclassId']==parent['id']]
        parent['relations']['featureIds']=[f['id'] for f in fs];parent['mechanics']['tenetsIt']=TENETS[sub];parent['fieldSources']['tenetsIt']=[0]
        parent['summaryIt']=' '.join(f['summaryIt'] for f in fs)
        missing=['featureEffects:'+f['id'] for f in fs if not f['verification']['complete']]
        parent['verification'].update(complete=not missing,missingFields=missing)
    return entities
