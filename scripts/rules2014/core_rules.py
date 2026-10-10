"""Italian paraphrases and structured constants from pages read locally."""
from __future__ import annotations

from curated import record, ABILITIES


def skills():
    rows = [
      ('athletics','Athletics','Atletica','strength'),('acrobatics','Acrobatics','Acrobazia','dexterity'),
      ('sleight-of-hand','Sleight of Hand','Rapidità di Mano','dexterity'),('stealth','Stealth','Furtività','dexterity'),
      ('arcana','Arcana','Arcano','intelligence'),('history','History','Storia','intelligence'),('investigation','Investigation','Indagare','intelligence'),
      ('nature','Nature','Natura','intelligence'),('religion','Religion','Religione','intelligence'),
      ('animal-handling','Animal Handling','Addestrare Animali','wisdom'),('insight','Insight','Intuizione','wisdom'),
      ('medicine','Medicine','Medicina','wisdom'),('perception','Perception','Percezione','wisdom'),('survival','Survival','Sopravvivenza','wisdom'),
      ('deception','Deception','Inganno','charisma'),('intimidation','Intimidation','Intimidire','charisma'),
      ('performance','Performance','Intrattenere','charisma'),('persuasion','Persuasion','Persuasione','charisma')]
    return [record('skill',i,n,it,175,{'ability':a},'Associazione ordinaria; la variante con caratteristiche diverse richiede una scelta del DM.') for i,n,it,a in rows]


def conditions():
    rows=[
      ('blinded','Blinded','Accecato',291,{'cannotSee':True,'automaticCheckFailure':['sight'],'attackDisadvantage':True,'attackersAdvantage':True},'Non vedi; fallisci le prove che richiedono vista, attacchi con svantaggio e chi ti attacca ha vantaggio.'),
      ('charmed','Charmed','Affascinato',291,{'cannotHarm':'charmer','charmerSocialCheckAdvantage':True},'Non puoi attaccare o danneggiare chi ti ha affascinato; quella creatura ha vantaggio nelle interazioni sociali con te.'),
      ('deafened','Deafened','Assordato',291,{'cannotHear':True,'automaticCheckFailure':['hearing']},'Non senti e fallisci le prove che richiedono udito.'),
      ('frightened','Frightened','Spaventato',291,{'disadvantageWhenFearSourceVisible':['attack','ability-check'],'cannotWillinglyApproach':'fear-source'},'La fonte visibile della paura penalizza attacchi e prove; non puoi avvicinarti volontariamente.'),
      ('grappled','Grappled','Afferrato',291,{'speed':0,'ignoreSpeedBonuses':True,'endsWhen':['grappler-incapacitated','removed-from-grappler-reach']},'La velocità è zero; la condizione finisce se chi afferra è incapacitato o il bersaglio esce dalla sua portata.'),
      ('incapacitated','Incapacitated','Incapacitato',291,{'cannotTake':['action','reaction','bonus-action']},'Non puoi compiere azioni o reazioni. Il divieto delle azioni bonus deriva dalla regola generale a pagina PDF 190.'),
      ('invisible','Invisible','Invisibile',292,{'unseenWithout':'magic-or-special-sense','hidingObscurement':'heavy','locationMayBeDetectedBy':['noise','tracks'],'attackAdvantage':True,'attackersDisadvantage':True},'La vista normale non ti rileva; rumori e tracce possono rivelare la posizione. Invisibile non equivale automaticamente a nascosto.'),
      ('paralyzed','Paralyzed','Paralizzato',292,{'inherits':['incapacitated'],'cannotMove':True,'cannotSpeak':True,'automaticSaveFailure':['strength','dexterity'],'attackersAdvantage':True,'hitIsCriticalWhenAttackerWithinFt':5},'Sei incapacitato e immobile; fallisci i TS fisici indicati e i colpi di attaccanti entro cinque piedi sono critici.'),
      ('petrified','Petrified','Pietrificato',292,{'inherits':['incapacitated'],'cannotMove':True,'cannotSpeak':True,'unaware':True,'weightMultiplier':10,'agingSuspended':True,'attackersAdvantage':True,'automaticSaveFailure':['strength','dexterity'],'resistance':'all-damage','immunity':['poison','disease'],'existingPoisonDisease':'suspended'},'Diventi materia solida con gli oggetti non magici; ottieni resistenze e immunità, senza neutralizzare veleni o malattie già presenti.'),
      ('poisoned','Poisoned','Avvelenato',293,{'disadvantage':['attack','ability-check']},'Attacchi e prove di caratteristica hanno svantaggio; questa condizione non infligge da sola danni da veleno.'),
      ('prone','Prone','Prono',293,{'movement':'crawl-until-standing','attackDisadvantage':True,'attackersAdvantageWithinFt':5,'attackersDisadvantageBeyondFt':5},'A terra puoi strisciare o rialzarti; gli attacchi contro di te dipendono dalla distanza dell’attaccante.'),
      ('restrained','Restrained','Trattenuto',293,{'speed':0,'ignoreSpeedBonuses':True,'attackDisadvantage':True,'attackersAdvantage':True,'saveDisadvantage':['dexterity']},'La velocità è zero; attacchi e TS di Destrezza hanno svantaggio e chi ti attacca ha vantaggio.'),
      ('stunned','Stunned','Stordito',293,{'inherits':['incapacitated'],'cannotMove':True,'speech':'faltering','automaticSaveFailure':['strength','dexterity'],'attackersAdvantage':True},'Sei incapacitato e immobile, parli a fatica e fallisci automaticamente i TS di Forza e Destrezza.'),
      ('unconscious','Unconscious','Privo di Sensi',293,{'inherits':['incapacitated','prone'],'cannotMove':True,'cannotSpeak':True,'unaware':True,'dropHeldObjects':True,'automaticSaveFailure':['strength','dexterity'],'attackersAdvantage':True,'hitIsCriticalWhenAttackerWithinFt':5},'Non percepisci l’ambiente, lasci gli oggetti e cadi prono; i colpi da attaccanti entro cinque piedi sono critici.'),
      ('exhaustion','Exhaustion','Indebolimento',292,{'maxLevel':6,'cumulative':True,'effectsByLevel':[
        {'level':1,'disadvantage':['ability-check']},{'level':2,'speedMultiplier':0.5},{'level':3,'disadvantage':['attack','saving-throw']},
        {'level':4,'hitPointMaximumMultiplier':0.5},{'level':5,'speed':0},{'level':6,'death':True}],
        'longRestReduction':{'levels':1,'requires':['food','drink']}},'Gli effetti dei sei livelli sono cumulativi; un riposo lungo con cibo e acqua riduce il livello di uno.'),
    ]
    result=[]
    for index,name,it,page,mechanics,summary in rows:
        item=record('condition',index,name,it,page,mechanics,summary)
        if index=='incapacitated':
            from curated import source
            item['sources'].append(source(190,'Bonus Actions'))
            item['fieldSources']['cannotTake']=[0,1]
        result.append(item)
    return result


def rules():
    rows=[
      ('ability-modifier','Ability Modifier','Modificatore di Caratteristica',[174],{'formula':{'operation':'floor-divide','numerator':{'operation':'subtract','left':'abilityScore','right':10},'denominator':2},'scoreRange':[1,30]},'Sottrai 10 al punteggio, dividi per due e arrotonda per difetto, anche per risultati negativi.'),
      ('proficiency','Proficiency Bonus','Bonus di Competenza',[16,174,175],{'byCharacterLevel':[2]*4+[3]*4+[4]*4+[5]*4+[6]*4,'addOnce':True,'multiplyOnce':True},'Il bonus dipende dal livello totale e non si aggiunge più volte allo stesso tiro.'),
      ('advantage','Advantage and Disadvantage','Vantaggio e Svantaggio',[174],{'dice':'2d20','advantage':'higher','disadvantage':'lower','multipleSourcesDoNotStack':True,'bothPresent':'1d20','rerollOneDieOnly':True},'Vantaggio e svantaggio si annullano se sono entrambi presenti, a prescindere dal numero di fonti.'),
      ('passive-check','Passive Checks','Prove Passive',[176],{'base':10,'add':'normal-check-modifiers','advantageBonus':5,'disadvantagePenalty':5},'Una prova passiva parte da 10 e include i modificatori normali; vantaggio o svantaggio valgono ±5.'),
      ('checks','Ability Checks and Contests','Prove e Confronti',[175],{'success':'total-at-least-DC','typicalDC':[5,10,15,20,25,30],'contestTie':'preserve-current-situation'},'Raggiungere la CD è sufficiente; in un confronto pari la situazione precedente resta invariata.'),
      ('group-check','Group Checks','Prove di Gruppo',[176],{'success':'at-least-half-participants-succeed'},'Il gruppo riesce se almeno metà dei partecipanti supera la prova.'),
      ('background-customization','Customizing a Background','Personalizzare il Background',[126,128],{'skills':2,'toolsOrLanguagesCombined':2,'feature':'choose-from-backgrounds-or-create-with-DM','personalityTraits':2,'ideals':1,'bonds':1,'flaws':1,'equipmentChoice':['background-package-and-class-package','buy-with-starting-wealth']},'La personalizzazione è prevista nelle regole base. Competenze duplicate da fonti diverse possono essere sostituite con altre dello stesso tipo.'),
      ('inspiration','Inspiration','Ispirazione',[126],{'maximumHeld':1,'spendFor':'advantage-on-attack-save-or-ability-check','canTransferToOtherPlayer':True},'Il DM assegna ispirazione; puoi spenderla per vantaggio o cederla a un altro giocatore.'),
      ('short-rest','Short Rest','Riposo Breve',[187],{'minimumHours':1,'hitDiceSpend':'up-to-available','healingPerDie':'die-plus-constitutionModifier'},'Durante almeno un’ora di attività leggere puoi spendere dadi vita uno alla volta per recuperare PF.'),
      ('long-rest','Long Rest','Riposo Lungo',[187],{'minimumHours':8,'maxWatchHours':2,'hitPointsRecovery':'all','hitDiceRecovery':{'fraction':0.5,'rounding':'down','minimum':None},'maximumPerHours':24,'minimumStartingHitPoints':1,'restartInterruptionHours':1},'Il riposo lungo recupera i PF e metà dei dadi vita. La stampa locale non specifica il minimo di un dado vita presente nell’SRD successivo.'),
      ('multiclassing','Multiclassing','Multiclassamento',[164,165,166],{'optional':True,'mustMeetPrerequisites':'current-and-new-class','proficiencyFrom':'total-character-level','newClassHP':'higher-level-class-formula','extraAttackDoesNotStack':True,'unarmoredDefenseCannotBeGainedTwice':True,'spellLists':'separate-per-class','casterLevel':{'fullClasses':['bard','cleric','druid','sorcerer','wizard'],'halfClasses':['paladin','ranger'],'thirdSubclasses':['eldritch-knight','arcane-trickster'],'rounding':'floor-per-class'},'pactMagicSlots':'separate-pool-but-interchangeable-for-known-prepared-spells'},'Livelli, prerequisiti e competenze si combinano secondo regole specifiche; slot più alti non permettono da soli di imparare magie di livello maggiore.'),
      ('feats-option','Feats','Talenti',[166],{'optional':True,'replaces':'ability-score-improvement','repeatable':False,'exception':'explicit-feat-text','prerequisiteLost':'effects-disabled-until-restored'},'I talenti sostituiscono gli incrementi quando la campagna li permette; controlla prerequisiti e ripetibilità.'),
      ('armor-proficiency','Armor Proficiency','Competenza nelle Armature',[145],{'withoutProficiencyDisadvantage':['strength-check','dexterity-check','strength-save','dexterity-save','strength-attack','dexterity-attack'],'withoutProficiencyCanCast':False,'insufficientStrengthSpeedPenaltyFt':10,'shieldACBonus':2,'maxBeneficialShields':1},'Indossare armatura non competente penalizza i tiri fisici indicati e impedisce il lancio di incantesimi.'),
      ('don-doff','Donning and Doffing Armor','Indossare e Togliere Armature',[147],{'light':{'donMinutes':1,'doffMinutes':1},'medium':{'donMinutes':5,'doffMinutes':1},'heavy':{'donMinutes':10,'doffMinutes':5},'shield':{'donActions':1,'doffActions':1},'helpDoffMultiplier':0.5},'Per beneficiare della CA serve completare il tempo di vestizione; l’aiuto dimezza il tempo per togliere l’armatura.'),
      ('critical-hit','Critical Hits','Colpi Critici',[197],{'damageDiceMultiplier':2,'flatDamageModifierMultiplier':1,'includes':'additional-attack-damage-dice'},'Raddoppia i dadi di danno dell’attacco, compresi quelli aggiuntivi appropriati; non raddoppiare i modificatori fissi.'),
      ('damage-resistance','Damage Resistance and Vulnerability','Resistenza e Vulnerabilità',[198],{'resistanceMultiplier':0.5,'vulnerabilityMultiplier':2,'order':['other-modifiers','resistance','vulnerability'],'sameTypeSourcesStack':False},'Applica prima gli altri modificatori, poi resistenza e vulnerabilità; più resistenze dello stesso tipo non si moltiplicano.'),
      ('healing','Healing','Guarigione',[198],{'cap':'hitPointMaximum','deadCreatures':'cannot-regain-hit-points-before-return-to-life'},'La guarigione non supera il massimo dei PF; i morti devono prima essere riportati in vita.'),
      ('death-saves','Death Saving Throws','Tiri Salvezza Contro Morte',[198],{'successDC':10,'successesToStabilize':3,'failuresToDie':3,'natural1Failures':2,'natural20HitPoints':1,'damageAtZeroFailures':1,'criticalAtZeroFailures':2,'damageAtZeroInstantDeath':'damage-at-least-hitPointMaximum','resetWhen':['regain-hit-points','stabilized'],'stabilize':{'activation':'action','skill':'medicine','ability':'wisdom','DC':10}},'A zero PF registra separatamente successi e fallimenti; 1, 20, critici e danni massicci hanno effetti specifici.'),
      ('instant-death','Instant Death','Morte Istantanea',[198],{'atPositiveHP':'remaining-damage-after-reaching-zero-at-least-hitPointMaximum'},'Quando i danni residui dopo aver raggiunto zero PF eguagliano il massimo, il personaggio muore immediatamente.'),
      ('ranged-attacks','Ranged Attacks','Attacchi a Distanza',[196],{'beyondNormalRange':'disadvantage','beyondLongRange':'cannot-attack','closeHostileDisadvantage':{'rangeFt':5,'mustSeeAttacker':True,'mustNotBeIncapacitated':True}},'Un nemico vicino impone svantaggio agli attacchi a distanza solo se vede l’attaccante ed è capace di agire.'),
      ('opportunity-attack','Opportunity Attacks','Attacchi di Opportunità',[196],{'activation':'reaction','trigger':'visible-hostile-leaves-reach','attack':'one-melee','timing':'before-leaves-reach','notProvokedBy':['disengage','teleport','movement-without-own-movement-action-reaction']},'La reazione interrompe l’uscita dalla portata; spostamenti forzati privi di movimento, azione o reazione propri non la provocano.'),
      ('two-weapon-fighting','Two-Weapon Fighting','Combattere con Due Armi',[196],{'requires':'attack-action-with-light-melee-weapon-in-one-hand','activation':'bonus-action','otherWeapon':'different-light-melee-weapon-in-other-hand','bonusAttackAbilityDamage':'only-if-negative','thrownAllowed':True},'L’attacco con la seconda arma usa un’azione bonus e normalmente non aggiunge un modificatore positivo al danno.'),
      ('grapple','Grappling','Afferrare',[196],{'replaces':'one-attack-of-attack-action','freeHands':1,'maxSizeDifference':1,'attackerCheck':['strength','athletics'],'targetChoice':[['strength','athletics'],['dexterity','acrobatics']],'successCondition':'grappled','escapeAction':True,'moveWithTargetSpeedMultiplier':0.5,'speedException':'target-at-least-two-sizes-smaller','release':'no-action'},'Il bersaglio sceglie Atletica o Acrobazia nel confronto; non usare la CD dei TS del 2024.'),
      ('shove','Shoving a Creature','Spingere',[196,197],{'replaces':'one-attack-of-attack-action','maxSizeDifference':1,'attackerCheck':['strength','athletics'],'targetChoice':[['strength','athletics'],['dexterity','acrobatics']],'onSuccessChoice':['prone','push-5-ft']},'Una spinta riuscita può far cadere prono o allontanare di cinque piedi.'),
      ('cover','Cover','Copertura',[197],{'half':{'armorClassBonus':2,'dexteritySaveBonus':2},'threeQuarters':{'armorClassBonus':5,'dexteritySaveBonus':5},'total':'cannot-target-directly','combine':'best-only'},'Le coperture non si sommano; quella totale può comunque interagire con aree di effetto secondo il percorso della magia.'),
      ('bonus-action-spells','Bonus Action Spellcasting','Incantesimi con Azione Bonus',[203],{'sameTurnOtherSpellAllowed':{'level':0,'castingTime':'1-action'},'scope':'turn','appliesEvenIfBonusSpellIsCantrip':True},'Dopo una magia con azione bonus, nello stesso turno le altre magie consentite sono soltanto trucchetti da un’azione.'),
      ('concentration','Concentration','Concentrazione',[204,205],{'maxSimultaneous':1,'damageSaveAbility':'constitution','damageSaveDC':{'baseMinimum':10,'damageFraction':0.5,'rounding':'down'},'savePerDamageSource':True,'endsWhen':['new-concentration-spell','incapacitated','death'],'endVoluntarily':'no-action','environmentalDC':10},'I danni richiedono TS separati per fonte; la CD è il maggiore tra 10 e metà dei danni, arrotondata per difetto.'),
      ('spell-components','Components','Componenti degli Incantesimi',[204],{'verbal':'requires-ability-to-produce-words','somatic':'requires-free-hand','material':'component-pouch-or-appropriate-focus-unless-cost-or-consumption','costedComponent':'specific-component-required','consumedComponent':'provide-each-casting','somaticMaterialMayShareHand':True},'Un focus non sostituisce componenti costosi o da consumare; la stessa mano può eseguire gesti e manipolare i materiali.'),
      ('ritual','Rituals','Rituali',[202,203],{'additionalMinutes':10,'consumesSlot':False,'upcast':False,'requires':'ritual-capability','preparedOrKnownRequired':'unless-class-feature-exception'},'Il rituale richiede dieci minuti aggiuntivi e una capacità appropriata; non consuma slot e non viene potenziato.'),
      ('long-casting','Longer Casting Times','Lanci Prolungati',[203],{'requiresActionEachTurn':True,'requiresConcentration':True,'interrupted':'restart','failedCastConsumesSlot':False},'Un lancio oltre un’azione o una reazione richiede concentrazione e azioni ripetute; se fallisce non spende lo slot.'),
      ('spell-target-path','A Clear Path to the Target','Percorso Libero per il Bersaglio',[205],{'totalCoverBlocksDirectTargeting':True,'blockedAreaOrigin':'near-side-of-obstruction'},'Per scegliere il bersaglio serve un percorso libero; non confondere copertura con possibilità di vedere.'),
      ('condition-stacking','Conditions','Cumulo delle Condizioni',[291],{'duplicateEffectsStack':False,'durations':'separate-per-source'},'Le istanze della stessa condizione conservano durate distinte ma non aggravano gli effetti ordinari.'),
    ]
    return [record('rule',i,n,it,p,m,s,optional=bool(m.get('optional'))) for i,n,it,p,m,s in rows]


# Full caster progression visually checked on local PHB PDF page 166, including
# columns absent from the OCR. Zero is explicit, not inferred from a missing field.
FULL_SLOTS = [
 [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
 [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],
 [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
]


def progressions():
    from curated import CLASS_ROWS, source
    result=[]
    for row in CLASS_ROWS:
        cls,name,it,page=row[:4]
        page={'bard':54,'paladin':84}.get(cls,page)
        for level in range(1,21):
            m={'level':level,'proficiencyBonus':2+(level-1)//4}
            if cls in ['bard','cleric','druid','sorcerer','wizard']:
                m['spellSlots']=FULL_SLOTS[level-1]+[0]*(9-len(FULL_SLOTS[level-1]))
                m['spellSlotRecovery']='long-rest'
            elif cls in ['paladin','ranger']:
                slots=FULL_SLOTS[(level+1)//2-1] if level>1 else []
                m['spellSlots']=slots+[0]*(9-len(slots))
                m['spellSlotRecovery']='long-rest'
            else:
                m['spellSlots']=[0]*9
            if cls in ['cleric','wizard']:
                m['cantripsKnown']=3+(level>=4)+(level>=10)
            elif cls in ['bard','druid','warlock']:
                m['cantripsKnown']=2+(level>=4)+(level>=10)
            elif cls=='sorcerer':
                m['cantripsKnown']=4+(level>=4)+(level>=10)
            else:
                m['cantripsKnown']=0
            if cls=='rogue':
                m['sneakAttackDice']=f'{(level+1)//2}d6'
            if cls=='bard':
                m['spellsKnown']=[4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22][level-1]
                m['bardicInspirationDie']='1d6' if level<5 else '1d8' if level<10 else '1d10' if level<15 else '1d12'
                m['songOfRestDie']=None if level<2 else '1d6' if level<9 else '1d8' if level<13 else '1d10' if level<17 else '1d12'
            if cls=='monk':
                m['kiPoints']=level if level>=2 else 0
                m['martialArtsDie']='1d4' if level<5 else '1d6' if level<11 else '1d8' if level<17 else '1d10'
                m['unarmoredMovementBonusFt']=0 if level<2 else 10+5*((level-2)//4)
            if cls=='barbarian':
                m['rages']=2 if level<3 else 3 if level<6 else 4 if level<12 else 5 if level<17 else 6 if level<20 else 'unlimited'
                m['rageDamageBonus']=2 if level<9 else 3 if level<16 else 4
            if cls=='sorcerer':
                m['sorceryPoints']=level if level>=2 else 0
                m['spellsKnown']=[2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15][level-1]
            if cls=='ranger':
                m['spellsKnown']=[0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11][level-1]
            if cls=='warlock':
                m['pactSlots']={'count':1 if level==1 else 2 if level<11 else 3 if level<17 else 4,
                                'level':min(5,(level+1)//2),'recovery':['short-rest','long-rest']}
                m['spellsKnown']=[2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15][level-1]
                m['invocationsKnown']=[0,2,2,2,3,3,4,4,5,5,5,6,6,6,7,7,7,8,8,8][level-1]
                m['mysticArcanumLevels']=[s for s,minimum in [(6,11),(7,13),(8,15),(9,17)] if level>=minimum]
            item=record('class-level',f'{cls}-{level}',f'{name} {level}',f'{it} {level}',page,m,'Progressione dei valori estratti; i privilegi richiedono relazioni separate.',missing=['featureLinks'])
            item['relations']={'classId':f'phb2014:class:{cls}'}
            item['sources'].append(source(16,'Character Advancement'))
            item['fieldSources']['proficiencyBonus']=[1]
            if 'spellSlots' in m and cls in ['bard','cleric','druid','sorcerer','wizard','paladin','ranger']:
                item['sources'].append({**source(166,'Multiclass Spellcaster: Spell Slots per Spell Level'),'verification':'read-local-render'})
                item['fieldSources']['spellSlots']=[0,2]
                if cls in ['paladin','ranger']:
                    item['interpretations'].append({'field':'spellSlots','kind':'derived','method':'Single-class half-caster table mapped to full table using ceil(level/2), with no slots at level 1. This is not the multiclass floor rule.'})
            result.append(item)
    return result


def advancement():
    xp=[0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000]
    return [record('advancement',str(level),'Character Advancement '+str(level),'Avanzamento '+str(level),16,
                   {'level':level,'minimumXP':minimum,'proficiencyBonus':2+(level-1)//4},'Il livello e la competenza si basano sul personaggio totale.') for level,minimum in enumerate(xp,1)]
