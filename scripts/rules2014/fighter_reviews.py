"""Fighter PHB PDF 71-76 read in full; original printing, errata separate."""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:fighter'
RESTS=['short-rest','long-rest']
STYLES=[
 ('Archery','Tiro con l’Arco',{'attackBonus':2,'requires':'ranged-weapon'}),
 ('Defense','Difesa',{'armorClassBonus':1,'requires':'wearing-armor'}),
 ('Dueling','Duellare',{'damageBonus':2,'requires':'one-handed-melee-weapon-and-no-other-weapons'}),
 ('Great Weapon Fighting','Combattere con Armi Possenti',{'rerollDamageDieResults':[1,2],'mustUseNewRoll':True,'requires':'melee-weapon-wielded-in-two-hands-with-two-handed-or-versatile-property'}),
 ('Protection','Protezione',{'activation':'reaction','trigger':'visible-creature-attacks-other-target-within-5-ft-of-self','requires':'wielding-shield','effect':'attack-disadvantage'}),
 ('Two-Weapon Fighting','Combattere con Due Armi',{'addsAbilityModifierTo':'second-attack-damage-during-two-weapon-fighting'}),
]
MANEUVERS=[
 ("Commander's Strike",'Attacco del Comandante',{'activation':'forgo-one-own-attack-and-bonus-action-on-own-turn','target':'friendly-creature-that-sees-or-hears-self',
   'targetReaction':'one-weapon-attack','superiorityDieAddedTo':'target-attack-damage'}),
 ('Disarming Attack','Attacco Disarmante',{'trigger':'hit-creature-with-weapon-attack','superiorityDieAddedTo':'damage','save':'strength','failedSave':'one-chosen-held-item-dropped-at-target-feet'}),
 ('Distracting Strike','Colpo Distraente',{'trigger':'hit-creature-with-weapon-attack','superiorityDieAddedTo':'damage','advantage':'next-attack-against-target-by-another-attacker','expires':'start-of-self-next-turn'}),
 ('Evasive Footwork','Passo Evasivo',{'trigger':'move','superiorityDieAddedTo':'armor-class','expires':'when-stopping-movement'}),
 ('Feinting Attack','Attacco Finto',{'activation':'bonus-action-on-own-turn','target':'creature-within-5-ft','advantage':'next-attack-against-target','superiorityDieAddedTo':'damage-if-hit','advantageExpires':None}),
 ('Goading Attack','Attacco Provocatorio',{'trigger':'hit-creature-with-weapon-attack','superiorityDieAddedTo':'damage','save':'wisdom','failedSave':'disadvantage-on-attacks-against-other-targets','expires':'end-of-self-next-turn'}),
 ('Lunging Attack','Attacco Affondante',{'trigger':'melee-weapon-attack-on-own-turn','reachIncreaseFt':5,'appliesTo':'this-attack-only','superiorityDieAddedTo':'damage-if-hit'}),
 ('Maneuvering Attack','Attacco Manovrante',{'trigger':'hit-creature-with-weapon-attack','superiorityDieAddedTo':'damage','target':'friendly-creature-that-sees-or-hears-self',
   'targetReaction':'move-up-to-half-own-speed','opportunityAttackImmunity':'only-from-hit-creature'}),
 ('Menacing Attack','Attacco Minaccioso',{'trigger':'hit-creature-with-weapon-attack','superiorityDieAddedTo':'damage','save':'wisdom','failedSave':'frightened-of-self','expires':'end-of-self-next-turn'}),
 ('Parry','Parata',{'activation':'reaction','trigger':'another-creature-damages-self-with-melee-attack','damageReduction':'superiorityDieRoll+dexterityModifier'}),
 ('Precision Attack','Attacco Preciso',{'trigger':'weapon-attack-roll-against-creature','superiorityDieAddedTo':'attack-roll','timing':'before-or-after-roll-but-before-attack-effects'}),
 ('Pushing Attack','Attacco Spingente',{'trigger':'hit-creature-with-weapon-attack','superiorityDieAddedTo':'damage','save':'strength','sizeForSave':'Large-or-smaller','failedSave':'push-away-up-to-15-ft'}),
 ('Rally','Rinvigorire',{'activation':'bonus-action-on-own-turn','target':'friendly-creature-that-sees-or-hears-self','temporaryHitPoints':'superiorityDieRoll+charismaModifier'}),
 ('Riposte','Risposta',{'activation':'reaction','trigger':'creature-misses-self-with-melee-attack','attack':'melee-weapon-against-triggering-creature','superiorityDieAddedTo':'damage-if-hit'}),
 ('Sweeping Attack','Attacco Ampio',{'trigger':'hit-creature-with-melee-weapon-attack','secondTarget':'another-creature-within-5-ft-of-first-and-within-self-reach',
   'requires':'original-attack-roll-would-hit-second-target','secondTargetDamage':'superiorityDieRoll','damageType':'same-as-original-attack'}),
 ('Trip Attack','Attacco Sbilanciante',{'trigger':'hit-creature-with-weapon-attack','superiorityDieAddedTo':'damage','save':'strength','sizeForSave':'Large-or-smaller','failedSave':'prone'}),
]
EK_KNOWN=[3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13]
EK_SLOTS=[[2,0,0,0],[3,0,0,0],[3,0,0,0],[3,0,0,0],[4,2,0,0],[4,2,0,0],[4,2,0,0],
          [4,3,0,0],[4,3,0,0],[4,3,0,0],[4,3,2,0],[4,3,2,0],[4,3,2,0],[4,3,3,0],
          [4,3,3,0],[4,3,3,0],[4,3,3,1],[4,3,3,1]]

STYLE_SUMMARIES=[
 'Gli attacchi con armi a distanza ottengono +2 al tiro per colpire.',
 'Mentre indossi un’armatura ottieni +1 alla CA.',
 'Un’arma da mischia impugnata in una mano infligge +2 danni se non impugni altre armi.',
 'Con un’arma da mischia versatile o a due mani usata con due mani puoi ritirare un dado di danno che mostra 1 o 2; devi conservare il nuovo risultato.',
 'Con uno scudo puoi usare la reazione per svantaggiare l’attacco di una creatura visibile contro un altro bersaglio entro cinque piedi da te.',
 'Nel combattimento con due armi aggiungi il modificatore di caratteristica anche ai danni del secondo attacco.',
]
MANEUVER_SUMMARIES=[
 'Durante l’azione Attaccare rinunci a un attacco e usi l’azione bonus: un alleato che ti vede o sente può attaccare immediatamente con la reazione, aggiungendo il dado ai danni.',
 'Dopo aver colpito con un’arma aggiungi il dado ai danni; un TS Forza fallito fa cadere ai piedi del bersaglio un oggetto che impugna.',
 'Dopo aver colpito con un’arma aggiungi il dado ai danni; il prossimo attacco di un altro attaccante contro quel bersaglio ha vantaggio prima dell’inizio del tuo prossimo turno.',
 'Durante il movimento aggiungi il dado alla CA finché non smetti di muoverti.',
 'Un’azione bonus nel tuo turno concede vantaggio al prossimo attacco contro una creatura entro cinque piedi; se colpisci aggiungi il dado ai danni. La prima stampa non indica la scadenza del vantaggio.',
 'Dopo aver colpito con un’arma aggiungi il dado ai danni; un TS Saggezza fallito impone svantaggio agli attacchi contro altri bersagli fino alla fine del tuo prossimo turno.',
 'Per un attacco da mischia nel tuo turno aumenti la portata di cinque piedi; aggiungi il dado ai danni se colpisci.',
 'Dopo aver colpito con un’arma aggiungi il dado ai danni; un alleato che ti vede o sente può usare la reazione per muoversi fino a metà velocità senza attacchi di opportunità dalla creatura colpita.',
 'Dopo aver colpito con un’arma aggiungi il dado ai danni; un TS Saggezza fallito rende il bersaglio spaventato da te fino alla fine del tuo prossimo turno.',
 'La reazione riduce i danni di un attacco da mischia altrui del risultato del dado più il tuo modificatore di Destrezza.',
 'Aggiungi il dado a un tiro per colpire con un’arma contro una creatura, prima o dopo il tiro ma prima dell’applicazione degli effetti.',
 'Dopo aver colpito con un’arma aggiungi il dado ai danni; una creatura Grande o più piccola che fallisce il TS Forza viene spinta fino a quindici piedi lontano da te.',
 'Un’azione bonus nel tuo turno concede a un alleato che ti vede o sente PF temporanei pari al dado più il tuo modificatore di Carisma.',
 'Quando una creatura ti manca in mischia puoi attaccarla in mischia con la reazione, aggiungendo il dado ai danni se colpisci.',
 'Dopo un colpo con un’arma da mischia, una seconda creatura entro cinque piedi dalla prima e nella tua portata subisce il risultato del dado, dello stesso tipo di danno, se il tiro originale la colpirebbe.',
 'Dopo aver colpito con un’arma aggiungi il dado ai danni; una creatura Grande o più piccola che fallisce il TS Forza cade prona.',
]

FEATURE_SUMMARIES=[
 'Gli attacchi con armi sono critici con un risultato di 19 o 20 sul dado.',
 'Alle prove di Forza, Destrezza e Costituzione senza competenza aggiungi metà del bonus di competenza arrotondata in eccesso; il salto in lungo con rincorsa aumenta del modificatore di Forza in piedi.',
 'Scegli un altro stile di combattimento diverso da quelli già conosciuti.',
 'Gli attacchi con armi sono critici con un risultato di 18, 19 o 20 sul dado.',
 'All’inizio del tuo turno recuperi 5 più il modificatore di Costituzione PF se hai al massimo metà dei PF massimi, ma più di zero.',
 'Impari tre manovre e ne aggiungi due ai livelli 7, 10 e 15, potendo sostituirne una quando ne impari altre. I dadi e il loro recupero sono descritti nella progressione collegata.',
 'Scegli un tipo di strumenti da artigiano con cui ottenere competenza.',
 'Dopo un minuto di osservazione o interazione fuori dal combattimento il DM confronta con te due caratteristiche scelte tra le sette indicate, qualificandole inferiori, uguali o superiori.',
 'I dadi di superiorità diventano d10.',
 'Quando tiri l’iniziativa senza dadi di superiorità ne recuperi uno.',
 'I dadi di superiorità diventano d12.',
 'Impari magie dalla lista del mago e usi Intelligenza. Gli slot recuperano con riposo lungo; scuole consentite, scelte libere e sostituzioni seguono i vincoli e la tabella collegati.',
 'Un rituale di un’ora lega un’arma mantenuta nella tua portata. Salvo incapacità non puoi esserne disarmato; con un’azione bonus nel tuo turno puoi richiamarla nella mano sullo stesso piano. Massimo due legami, un richiamo per azione bonus.',
 'Dopo aver usato l’azione per lanciare un trucchetto puoi effettuare un attacco con arma come azione bonus.',
 'Una creatura colpita con un’arma ha svantaggio al prossimo TS contro una tua magia effettuato prima della fine del tuo prossimo turno.',
 'Usando Azione Impetuosa puoi teletrasportarti fino a trenta piedi in uno spazio visibile e libero, prima o dopo l’azione aggiuntiva.',
 'Dopo aver usato l’azione per lanciare una magia puoi effettuare un attacco con arma come azione bonus.',
]


def extra_records():
    result=[]
    for (name,italian,effect),summary in zip(STYLES,STYLE_SUMMARIES,strict=True):
        e=record('class-option','fighter-'+slug(name),name,italian,73,
                 {'optionType':'fighting-style','prerequisites':{},'effect':effect,'maySelectSameStyleTwice':False,
                  'selectionOrigins':[{'originId':'phb2014:class-feature:fighter-1-fighting-style','classId':CLASS,'minimumClassLevel':1},
                     {'originId':'phb2014:subclass-feature:champion-10-additional-fighting-style','classId':CLASS,'minimumClassLevel':10,'subclassId':'phb2014:subclass:champion'}]},summary)
        e['relations']={'classId':CLASS,'parentFeatureId':'phb2014:class-feature:fighter-1-fighting-style'}
        e['sources'].append(source(74,'Additional Fighting Style'))
        e['fieldSources']['selectionOrigins']=[0,1]
        result.append(e)
    for (name,italian,effect),summary in zip(MANEUVERS,MANEUVER_SUMMARIES,strict=True):
        e=record('class-option',slug(name),name,italian,75,
                 {'optionType':'fighter-maneuver','prerequisites':{},
                  'selectionOrigins':[{'originId':'phb2014:subclass-feature:battle-master-3-combat-superiority','classId':CLASS,'minimumClassLevel':3,'subclassId':'phb2014:subclass:battle-master'},
                     {'originId':'phb2014:feat:martial-adept','featId':'phb2014:feat:martial-adept'}],
                  'effect':effect,'resourceCost':{'pool':'superiority-dice','dice':1},'maximumManeuversPerAttack':1,
                  'saveDC':'8+proficiencyBonus+chosenStrengthOrDexterityModifier'},
                 summary+' Consuma un dado di superiorità; massimo una manovra per attacco.',
                 missing=['effect.advantageExpires'] if name=='Feinting Attack' else [])
        e['sources'].append(source(74,'Combat Superiority'))
        e['sources'].append(source(169,'Martial Adept'))
        for key in ['resourceCost','maximumManeuversPerAttack','saveDC']: e['fieldSources'][key]=[1]
        e['fieldSources']['selectionOrigins']=[1,2]
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:battle-master'}
        result.append(e)
    styles=[e['id'] for e in result if e['mechanics']['optionType']=='fighting-style']
    maneuvers=[e['id'] for e in result if e['mechanics']['optionType']=='fighter-maneuver']
    superior={
        'maneuversKnownByFighterLevel':{'3':3,'7':5,'10':7,'15':9},'diceCountByFighterLevel':{'3':4,'7':5,'15':6},
        'dieByFighterLevel':{'3':'d8','10':'d10','18':'d12'},'recovery':RESTS,'maximumManeuversPerAttack':1,
        'choiceIds':maneuvers,'replaceKnownManeuversWhenLearningMore':1,'saveDC':'8+proficiencyBonus+chosenStrengthOrDexterityModifier'}
    casting={'spellList':'wizard','castingAbility':'intelligence','slotRecovery':['long-rest'],
        'spellSaveDC':'8+proficiencyBonus+intelligenceModifier','spellAttackModifier':'proficiencyBonus+intelligenceModifier',
        'initialKnownSpells':{'choose':3,'level':1,'abjurationOrEvocationRequired':2},'restrictedSchools':['abjuration','evocation'],
        'newUnrestrictedSpellAtFighterLevels':[8,14,20],'replaceKnownSpellsPerFighterLevelGain':1,
        'unrestrictedReplacementForSpellLearnedAtLevels':[8,14,20],'newSpellMaximumLevel':'highest-available-slot',
        'progression':[{'fighterLevel':n,'cantripsKnown':2 if n<10 else 3,'spellsKnown':EK_KNOWN[n-3],
                        'spellSlots':EK_SLOTS[n-3]+[0]*5} for n in range(3,21)]}
    rows=[
      ('champion',3,'Improved Critical','Critico Migliorato',73,{'weaponCriticalRolls':[19,20]}),
      ('champion',7,'Remarkable Athlete','Atleta Straordinario',73,{'checkBonus':'ceil(proficiencyBonus/2)','abilities':['strength','dexterity','constitution'],
          'appliesWhen':'check-does-not-already-use-proficiency-bonus','runningLongJumpExtraFt':'strengthModifier'}),
      ('champion',10,'Additional Fighting Style','Stile di Combattimento Aggiuntivo',74,{'choose':1,'choiceIds':styles,'cannotDuplicateKnownStyle':True}),
      ('champion',15,'Superior Critical','Critico Superiore',74,{'weaponCriticalRolls':[18,19,20]}),
      ('champion',18,'Survivor','Sopravvissuto',74,{'trigger':'start-of-own-turn','requires':'current-HP-greater-than-zero-and-at-most-half-maximum','healing':'5+constitutionModifier'}),
      ('battle-master',3,'Combat Superiority','Superiorità in Combattimento',[74,75],superior),
      ('battle-master',3,'Student of War','Studente della Guerra',74,{'artisanToolProficiencyChoice':{'choose':1,'category':'artisan-tools'}}),
      ('battle-master',7,'Know Your Enemy','Conosci il Tuo Nemico',[74,75],{'minimumObservationOrInteractionMinutes':1,'requires':'outside-combat',
          'chooseComparisons':2,'comparisonChoices':['strength','dexterity','constitution','armor-class','current-hit-points','total-class-levels-if-any','fighter-levels-if-any'],
          'DMAnswers':['equal','superior','inferior'],'relativeTo':'self'}),
      ('battle-master',10,'Improved Combat Superiority','Superiorità in Combattimento Migliorata',75,{'superiorityDie':'d10'}),
      ('battle-master',15,'Relentless','Implacabile',75,{'trigger':'roll-initiative-with-no-superiority-dice','recoverSuperiorityDice':1}),
      ('battle-master',18,'Improved Combat Superiority','Superiorità in Combattimento Migliorata',75,{'superiorityDie':'d12'}),
      ('eldritch-knight',3,'Spellcasting','Incantesimi',76,casting),
      ('eldritch-knight',3,'Weapon Bond','Legame con l’Arma',76,{'ritualHours':1,'mayRitualDuring':'short-rest','weaponMustRemainWithinReach':True,
          'touchWeaponAtRitualEnd':True,'cannotBeDisarmedUnless':'incapacitated','summon':{'activation':'bonus-action-on-own-turn','requires':'same-plane','destination':'own-hand'},
          'maximumBondedWeapons':2,'summonMaximumPerBonusAction':1,'thirdBondRequires':'break-one-existing-bond'}),
      ('eldritch-knight',7,'War Magic','Magia da Guerra',76,{'trigger':'use-action-to-cast-cantrip','grants':'one-weapon-attack-as-bonus-action'}),
      ('eldritch-knight',10,'Eldritch Strike','Colpo Occulto',76,{'trigger':'hit-creature-with-weapon-attack','targetDisadvantage':'next-save-against-self-spell','expires':'end-of-self-next-turn'}),
      ('eldritch-knight',15,'Arcane Charge','Carica Arcana',76,{'trigger':'use-action-surge','teleportMaximumFt':30,'destination':'visible-unoccupied-space','timingChoice':['before-extra-action','after-extra-action']}),
      ('eldritch-knight',18,'Improved War Magic','Magia da Guerra Migliorata',76,{'trigger':'use-action-to-cast-spell','grants':'one-weapon-attack-as-bonus-action'}),
    ]
    for (subclass,level,name,italian,pages,effect),summary in zip(rows,FEATURE_SUMMARIES,strict=True):
        e=record('subclass-feature',subclass+'-'+str(level)+'-'+slug(name),name,italian,pages,{'level':level,'effect':effect},
                 summary,missing=['choiceEffects:phb2014:class-option:feinting-attack'] if name=='Combat Superiority' else [])
        if subclass=='eldritch-knight' and name=='Spellcasting':
            e['sources'].append(source(76,'Eldritch Knight Spellcasting table'))
            e['sources'][-1]['verification']='read-local-render'
            e['fieldSources']['effect']=[0,1]
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+subclass}
        result.append(e)
    return result


def apply_fighter_reviews(entities):
    added=extra_records(); entities.extend(added)
    styles=[e['id'] for e in added if e['kind']=='class-option' and e['mechanics']['optionType']=='fighting-style']
    for e in entities:
        if e['kind']=='subclass' and e['relations']['classId']==CLASS:
            feats=[f for f in added if f['kind']=='subclass-feature' and f['relations']['subclassId']==e['id']]
            e['relations']['featureIds']=[f['id'] for f in feats]
            e['mechanics'].update(choices=[],spellGrants=[])
            e['sources'].append(source([73,74,75,76],'Martial Archetypes'))
            e['fieldSources'].update(choices=[len(e['sources'])-1],spellGrants=[len(e['sources'])-1])
            missing=['featureEffects:phb2014:subclass-feature:battle-master-3-combat-superiority'] if e['index']=='battle-master' else []
            e['verification'].update(complete=not missing,missingFields=missing)
            e['summaryIt']='Archetipo del guerriero con privilegi e scelte nei record collegati; le magie del Cavaliere Mistico sono scelte da apprendere.'
        if e['kind']=='class-feature' and e['relations']['classId']==CLASS:
            if e['name']=='Subclass Feature':
                e['relations']['concreteAlternativeIds']=[f['id'] for f in added if f['kind']=='subclass-feature' and f['mechanics']['level']==e['mechanics']['level']]
            elif e['name'] in ['Fighting Style','Martial Archetype']:
                effect={'choose':1,'choiceIds':styles,'cannotDuplicateKnownStyle':True} if e['name']=='Fighting Style' else {
                    'choose':1,'subclassIds':['phb2014:subclass:'+s for s in ['champion','battle-master','eldritch-knight']],'featureLevels':[3,7,10,15,18]}
                e['mechanics']['effect']=effect
                e['sources'].append(source(73,e['name'])); e['fieldSources']['effect']=[len(e['sources'])-1]
                e['nameIt']='Stile di Combattimento' if e['name']=='Fighting Style' else 'Archetipo Marziale'
                e['translation']['status']='assistant-translation'; e['verification'].update(complete=True,missingFields=[])
                e['summaryIt']='Scegli uno stile tra i sei verificati, senza poter ripetere uno stile già noto.' if e['name']=='Fighting Style' else 'Scegli Campione, Maestro di Battaglia o Cavaliere Mistico; ottieni i privilegi ai livelli 3, 7, 10, 15 e 18.'
        if e['id']=='phb2014:feat:martial-adept':
            ids=[f['id'] for f in added if f['kind']=='class-option' and f['mechanics']['optionType']=='fighter-maneuver']
            e['mechanics']['choiceIds']=ids
            e['fieldSources']['choiceIds']=[0]
            e['verification'].update(complete=False,missingFields=['choiceEffects:phb2014:class-option:feinting-attack'])
    return entities
