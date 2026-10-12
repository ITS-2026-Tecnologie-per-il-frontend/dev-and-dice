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
      ('working-together','Working together','Collaborare',[176],
       {'leaderCheck':'advantage','leaderChoice':['leads-effort','highest-ability-modifier'],
        'helperMustBeAbleToAttemptAlone':True,'cooperationMustBeProductive':True,'inCombatRequires':'help-action'},
       'Chi guida la prova ottiene vantaggio se l’aiutante può tentare il compito da solo e collaborare è utile. In combattimento serve l’azione Aiutare; questa regola è distinta dalle prove di gruppo.'),
      ('hiding','Hiding','Nascondersi',[178],
       {'check':{'ability':'dexterity','skill':'stealth'},'resultPersistsUntil':['discovered','stops-hiding'],
        'activeSearchOpposedBy':'wisdom-perception','unawareObservers':'passive-wisdom-perception',
        'cannotHideFrom':'creature-that-can-see-you','noiseRevealsPosition':True,
        'invisibleMayTryHiding':True,'invisibleStillRequiresQuiet':True,'approachInCombat':'usually-seen-unless-DM-allows-distracted-observer'},
       'Nascondersi usa Furtività contro Percezione attiva o passiva. Il risultato dura fino a scoperta o rinuncia. Rumore rivela la posizione e invisibilità non elimina la necessità del silenzio. Avvicinarsi in combattimento normalmente espone alla vista, con eccezioni decise dal DM.'),
      ('saving-throws','Saving throws','Tiri salvezza',[180],
       {'roll':'d20-plus-appropriate-ability-modifier','proficiency':'only-if-proficient-in-that-save',
        'situationalModifiersAndAdvantage':True,'dcAndOutcome':'specified-by-triggering-effect','successfulSaveAlwaysHalfDamage':False},
       'Il TS aggiunge modificatore della caratteristica e competenza solo quando posseduta per quel TS. CD, successo e fallimento dipendono dall’effetto; successo non significa sempre dimezzare danni.'),
      ('constitution-hit-points','Constitution and hit points','Costituzione e punti ferita',[178],
       {'maximumHPChange':'total-character-level-times-change-in-constitution-modifier','appliesRetroactively':True},
       'Se cambia il modificatore di Costituzione, il massimo dei PF cambia retroattivamente per ogni livello totale già posseduto. Un aumento del modificatore di uno vale un PF massimo per livello; una diminuzione vale la corrispondente perdita.'),
      ('spellcasting-basics','Spell levels, slots and effects','Livelli, slot ed effetti magici',[202,203,204,206],
       {'spellLevelRange':[0,9],'spellLevelIsCharacterLevel':False,'requiresKnownOrPrepared':'according-to-class-or-specific-feature',
        'slotRequired':'spell-level-or-higher-unless-feature-exempts','higherSlotSpellLevel':'becomes-slot-level','upcastEffect':'only-if-description-provides',
        'cantripsUseSlots':False,'instantaneousEffectDispelableAfterResolution':False,
        'spellSaveDC':'eight-plus-casting-modifier-plus-proficiency-plus-special-modifiers','spellAttackBonus':'casting-modifier-plus-proficiency',
        'afterCastRangeLimitsEffect':'only-if-description-says-so','sameSpellOverlappingEffects':'most-potent-not-additive','equalPotencyPriorityInLocalPrinting':None},
       'Grado della magia e livello del personaggio sono distinti. Uno slot dello stesso grado o superiore serve salvo eccezioni; il grado del lancio sale con lo slot ma il potenziamento dipende dal testo. Effetti istantanei non si dissolvono dopo la risoluzione. Stessa magia sovrapposta applica solo l’effetto più potente; la stampa non specifica la priorità a parità.'),
      ('spell-area-geometry','Areas of effect','Geometria delle aree magiche',[205,206],
       {'shapes':['cone','cube','cylinder','line','sphere'],'spread':'unblocked-straight-lines-from-origin','totalCoverBlocks':True,
        'coneWidth':'distance-from-origin','cubeOrigin':'anywhere-on-face','cylinderOrigin':'circle-center-on-ground-or-effect-height',
        'line':'straight-length-and-width','sphereSize':'radius',
        'originIncludedByDefault':{'cone':False,'cube':False,'cylinder':True,'line':False,'sphere':True},
        'casterMayIncludeOrigin':['cone','cube','line']},
       'Aree propagano da un’origine lungo linee non bloccate da copertura totale. Cono largo quanto la distanza dall’origine, cubo originato su una faccia, cilindro da centro della base o sommità, linea retta e sfera col suo raggio. Origine inclusa in cilindro e sfera, facoltativa nelle altre tre forme.'),
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
      ('languages','Languages','Lingue',[124],{'standard':{'common':'common','dwarvish':'dwarvish','elvish':'elvish','giant':'dwarvish','gnomish':'dwarvish','goblin':'dwarvish','halfling':'common','orc':'dwarvish'},'exotic':{'abyssal':'infernal','celestial':'celestial','draconic':'draconic','deep-speech':None,'infernal':'infernal','primordial':'dwarvish','sylvan':'elvish','undercommon':'elvish'},'valuesRepresent':'writing-script','exoticAndSecretSelection':'requires-DM-permission','standardAlternative':'language-common-in-campaign','primordialDialects':['auran','aquan','ignan','terran'],'dialectsSameLanguage':'mutually-intelligible'},'Otto lingue standard e otto esotiche, con alfabeti verificati sul render. Linguaggio Profondo non ha alfabeto indicato. Il DM autorizza lingue esotiche e segrete; i quattro dialetti primordiali comunicano fra loro.'),
      ('alignment','Alignment','Allineamento',[123,124],{'moralAxes':['good','neutral','evil'],'socialAxes':['lawful','neutral','chaotic'],'combinations':9,'descriptions':'typical-not-binding-individual-behavior','unaligned':'no-capacity-for-moral-or-ethical-choice','humanoidAlignment':'choice','celestialFiendNature':'alignment-essential-to-nature','evilAdventurers':'source-discourages-for-most-groups-not-universal-character-creation-ban'},'Nove combinazioni dei due assi descrivono inclinazioni tipiche, non comandi automatici. Chi non può scegliere moralmente è senza allineamento. Il testo sconsiglia personaggi malvagi in molti gruppi, senza vietarli in ogni campagna.'),
      ('travel-pace','Travel Pace','Andatura di Viaggio',[182,183],{'rows':{'fast':{'feetPerMinute':400,'milesPerHour':4,'milesPerDay':30,'passivePerceptionPenalty':-5},'normal':{'feetPerMinute':300,'milesPerHour':3,'milesPerDay':24},'slow':{'feetPerMinute':200,'milesPerHour':2,'milesPerDay':18,'stealthPossible':True}},'dayTravelHours':8,'difficultTerrainDistanceMultiplier':0.5,'forcedMarch':'each-extra-hour-end-Constitution-save-DC-ten-plus-hours-beyond-eight-fail-one-exhaustion','mountGallop':'about-one-hour-double-fast-distance','waterVehicle':'own-speed-no-pace-penalty-or-benefit-may-travel-twenty-four-hours-depending-crew-and-vessel'},'Tabella di viaggio distinta dalle velocità in combattimento, controllata sul render. Terreno difficile dimezza distanza; oltre otto ore TS Costituzione ogni ora extra o sfinimento. Mezzi acquatici usano propria velocità e gestione dell’equipaggio.'),
      ('travel-activities','Activity While Traveling','Attività Durante il Viaggio',[183,184],{'marchingOrder':'front-middle-back-two-ranks-front-back-one-rank-front','threatDetection':'passive-Perception-only-characters-watching-danger-rank-may-limit-detection','otherTasks':{'navigate':'Wisdom-Survival-DM-calls-check','track':'Wisdom-Survival-DM-calls-check','forage':'Wisdom-Survival-DM-calls-check','draw-map':'no-ability-check'},'stealth':'slow-pace-not-in-open'},'Chi naviga, traccia, cerca cibo o disegna una mappa non contribuisce alla Percezione passiva del gruppo. Il rango di marcia può limitare cosa rileva; mappare non richiede prova, gli altri controlli dipendono dal DM.'),
      ('special-movement','Climbing, Swimming, and Crawling','Scalare Nuotare e Strisciare',[183],{'climbAndSwimExtraMovementFtPerFt':1,'climbAndSwimDifficultTerrainExtraFtPerFt':2,'exception':'matching-climb-or-swim-speed','AthleticsMayBeRequired':'DM-for-slippery-or-few-handholds-or-rough-water','crawlCrossReference':'combat-prone-rule'},'Scalare e nuotare costano un piede aggiuntivo per piede, due aggiuntivi in terreno difficile, salvo velocità appropriata. Il DM può chiedere Atletica in condizioni difficili; strisciare segue anche la regola di prono.'),
      ('jumping','Jumping','Saltare',[183],{'runningApproachFt':10,'longJumpFt':'Strength-score','standingLongJumpMultiplier':0.5,'highJumpFt':'3+Strength-modifier','minimumHighJumpFtInLocalPrinting':None,'standingHighJumpMultiplier':0.5,'movementCostFtPerJumpFt':1,'lowObstacle':'DM-may-require-Strength-Athletics-DC-ten-for-obstacle-up-to-quarter-distance','landDifficultTerrain':'Dexterity-Acrobatics-DC-ten-failure-prone','reachAboveGround':'jump-height-plus-one-and-half-own-height','jumpHigher':'DM-may-allow-Strength-Athletics'},'Rincorsa dieci piedi: lungo pari a Forza, alto tre più modificatore. Da fermo metà; ogni piede saltato costa movimento. Atterrare su terreno difficile richiede Acrobazia dieci. Il minimo zero del salto alto è aggiunto solo dalle errata.'),
      ('falling','Falling','Cadute',[184],{'damageDicePerTenFt':'1d6','maximumDamageDice':'20d6','damageType':'bludgeoning','landing':'prone-unless-avoids-falling-damage'},'Alla fine della caduta un d6 contundente ogni dieci piedi, massimo venti d6. Atterri prono salvo evitare il danno.'),
      ('suffocating','Suffocating','Soffocamento',[184],{'holdBreathMinutes':'1+Constitution-modifier','minimumHoldBreathSeconds':30,'afterNoBreathSurvivalRounds':'Constitution-modifier-minimum-one','afterRounds':'start-next-turn-zero-HP-and-dying','chokingExplicitInLocalPrinting':False,'healingAndStabilizationRestrictionInLocalPrinting':'not-stated'},'Trattieni fiato uno più modificatore Costituzione minuti, minimo trenta secondi. Esaurito il fiato sopravvivi modificatore round, minimo uno, poi zero PF a inizio turno seguente. Le errata esplicitano strozzamento e divieto di stabilizzazione o guarigione finché manca aria.'),
      ('vision-light','Vision and Light','Visione e Luce',[184,186],{'brightLight':'normal-vision','dimLight':'light-obscurement-disadvantage-sight-based-Perception','darkness':'heavy-obscurement','heavyObscurementInLocalPrinting':'creature-in-area-effectively-blinded','blindsight':'perceive-surroundings-without-sight-within-own-range','darkvisionInLocalPrinting':'darkness-as-dim-light-no-colors-only-gray','truesight':'within-range-see-normal-and-magical-darkness-invisible-detect-visual-illusions-auto-save-original-shapechanger-or-magically-transformed-form-Ethereal-plane'},'Luce fioca dà svantaggio alla Percezione visiva. Vista cieca non usa occhi; scurovisione vede oscurità in grigio; vista pura rivela invisibilità, illusioni, forme vere ed Etereo. Cecità in oscuramento pesante e scurovisione mantengono formulazioni originali distinte dalle errata.'),
      ('food-water','Food and Water','Cibo e Acqua',[186],{'foodLbPerDay':1,'halfFood':'counts-half-day-without-food','daysWithoutFood':'3+Constitution-modifier-minimum-one','beyondFoodLimit':'one-exhaustion-at-each-day-end','normalEatingDay':'resets-food-counter','waterGallonsPerDay':1,'hotWeatherWaterGallonsPerDay':2,'halfWater':'Constitution-save-DC-fifteen-day-end-failure-one-exhaustion','lessThanHalfWater':'automatic-one-exhaustion','alreadyExhaustedWaterPenaltyLevels':2,'removeTheseExhaustion':'requires-full-required-food-and-water'},'Una libbra di cibo e un gallone d’acqua al giorno, due al caldo. Mezze razioni contano mezzo giorno di digiuno; sete richiede TS o sfinimento, doppio se già sfinito. Sfinimento da carenza resta finché assumi quantità complete.'),
      ('object-interaction','Interacting with Objects','Interagire con Oggetti',[186],{'damageImmunities':['poison','psychic'],'strengthAndDexteritySaves':'automatic-failure','otherSaveEffects':'immune','armorClassAndHP':'DM-determined','resistanceImmunity':'DM-may-assign','zeroHP':'breaks','breakByStrengthCheck':'DM-sets-DC'},'Oggetti immuni a veleno e psichico falliscono TS Forza e Destrezza e sono immuni a effetti che richiedono altri TS. Il DM fissa CA, PF e CD per romperli; a zero PF si spezzano.'),
      ('downtime','Downtime Activities','Attività Fra Avventure',[188],{'minimumHoursPerCountedDay':8,'consecutiveDaysRequired':False,'crafting':{'nonmagicalOnly':True,'requires':'relevant-tool-proficiency-materials-and-facilities','marketValueProgressGPPerDayPerProficientWorker':5,'rawMaterialCostFraction':0.5,'lifestyle':'modest-free-or-comfortable-half-price'},'profession':'modest-supported-organization-comfortable-Performance-proficiency-used-wealthy','recuperating':{'days':3,'constitutionSaveDC':15,'successChoice':['end-one-effect-preventing-HP-recovery','advantage-against-one-current-disease-or-poison-for-twenty-four-hours']},'research':{'extraGPPerDay':1,'availability-days-restrictions-checks':'DM-determined'},'training':{'language-or-tool':True,'instructor':'willing-required','days':250,'GPPerDay':1,'additionalOptionsAndChecks':'DM-determined'}},'Giorni non necessariamente consecutivi ma almeno otto ore di attività. Creazione non magica cinque mo di valore al giorno per artigiano competente e metà in materiali; ricerca costa una mo extra. Addestramento a lingua o attrezzo: insegnante, duecentocinquanta giorni e una mo al giorno.'),
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
