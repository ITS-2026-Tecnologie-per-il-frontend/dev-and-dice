"""Individually read class-feature effects; other events remain incomplete."""
from curated import source

ROWS = {
 ('barbarian','Rage'):(49,'Ira',{'activation':'bonus-action','requiresTurn':'own','durationMinutes':1,'benefitsRequire':'not-heavy-armor','advantage':['strength-check','strength-save'],'damageBonus':'class-table-on-strength-melee-weapon-attack','resistance':['bludgeoning','piercing','slashing'],'cannot':['cast-spells','concentrate'],'endsWhen':['unconscious','no-hostile-attack-and-no-damage-since-last-turn'],'voluntaryEnd':'bonus-action','resource':{'maximum':'class-table','recovery':['long-rest']}},'L’ira usa un’azione bonus, limita la magia e concede benefici fisici; termina se non alimentata, salvo privilegi successivi.'),
 ('barbarian','Unarmored Defense'):(49,'Difesa Senza Armatura',{'baseArmorClass':'10+dexterityModifier+constitutionModifier','requires':'no-armor','shieldAllowed':True},'Senza armatura sommi Destrezza e Costituzione alla CA base 10; puoi usare uno scudo.'),
 ('barbarian','Reckless Attack'):(49,'Attacco Irruento',{'chooseWhen':'first-attack-on-own-turn','advantage':'strength-melee-weapon-attacks-this-turn','attackersAdvantageUntil':'next-turn'},'Scegli con il primo attacco: migliori gli attacchi da mischia con Forza, esponendoti agli attacchi avversari.'),
 ('barbarian','Danger Sense'):(49,'Percezione del Pericolo',{'advantage':'dexterity-saves-against-visible-effects','disabledWhen':['blinded','deafened','incapacitated']},'Hai vantaggio sui TS di Destrezza contro effetti visibili, se percezione e capacità di agire non sono compromesse.'),
 ('barbarian','Fast Movement'):(50,'Movimento Veloce',{'speedBonusFt':10,'requires':'not-heavy-armor'},'La velocità aumenta di 10 piedi finché non indossi armatura pesante.'),
 ('barbarian','Feral Instinct'):(50,'Istinto Ferino',{'initiativeAdvantage':True,'ignoreSurprise':'not-incapacitated-and-rage-before-anything-on-first-turn'},'Hai vantaggio all’iniziativa e puoi agire pur sorpreso se entri subito in ira e non sei incapacitato.'),
 ('barbarian','Brutal Critical'):(50,'Critico Brutale',{'additionalWeaponDiceByClassLevel':{'9':1,'13':2,'17':3},'requires':'critical-melee-attack'},'Aggiungi dadi dell’arma al critico da mischia, in base al livello da barbaro.'),
 ('barbarian','Relentless Rage'):(50,'Ira Implacabile',{'trigger':'zero-hit-points-while-raging-without-instant-death','saveAbility':'constitution','initialDC':10,'increaseDCAfterEachUse':5,'onSuccessHitPoints':1,'resetDC':['short-rest','long-rest']},'A zero PF durante l’ira, un TS di Costituzione può lasciarti a un PF; la CD aumenta fino al riposo.'),
 ('barbarian','Persistent Rage'):(50,'Ira Persistente',{'replacesRageEarlyEnd':['unconscious','voluntary-end']},'L’ira termina anticipatamente solo se diventi privo di sensi o scegli di concluderla.'),
 ('barbarian','Indomitable Might'):(50,'Potenza Indomabile',{'strengthCheckMinimum':'strengthScore'},'Puoi usare il punteggio di Forza al posto di un totale inferiore in una prova di Forza.'),
 ('barbarian','Primal Champion'):(50,'Campione Primordiale',{'abilityBonuses':{'strength':4,'constitution':4},'newMaximum':24},'Forza e Costituzione aumentano di quattro e il loro massimo diventa 24.'),
 ('fighter','Second Wind'):(73,'Recuperare Energie',{'activation':'bonus-action','healing':'1d10+fighterLevel','resource':{'uses':1,'recovery':['short-rest','long-rest']}},'Un’azione bonus recupera 1d10 più il livello da guerriero; ricarica con riposo breve o lungo.'),
 ('fighter','Action Surge'):(73,'Azione Impetuosa',{'activation':'own-turn','additionalActions':1,'resource':{'usesByClassLevel':{'2':1,'17':2},'recovery':['short-rest','long-rest']},'maxUsesPerTurn':1,'additionalBonusActions':0},'Ottieni un’azione aggiuntiva, senza aggiungere un’altra azione bonus; due utilizzi dal livello 17, mai nello stesso turno.'),
 ('fighter','Indomitable'):(73,'Indomabile',{'trigger':'failed-saving-throw','effect':'reroll-use-new-result','resource':{'usesByClassLevel':{'9':1,'13':2,'17':3},'recovery':['long-rest']}},'Puoi ritirare un TS fallito, mantenendo il nuovo risultato; gli utilizzi aumentano con il livello.'),
 ('monk','Ki'):(79,'Ki',{'resource':{'maximum':'monkLevel','recovery':['short-rest','long-rest'],'meditationWithinRestMinutes':30},'saveDC':'8+proficiencyBonus+wisdomModifier','startingOptions':[
   {'name':'Flurry of Blows','cost':1,'activation':'bonus-action-immediately-after-attack-action','unarmedAttacks':2},
   {'name':'Patient Defense','cost':1,'activation':'bonus-action','action':'dodge'},
   {'name':'Step of the Wind','cost':1,'activation':'bonus-action','actionChoice':['dash','disengage'],'jumpMultiplierThisTurn':2}]},'I punti ki tornano dopo il riposo con mezz’ora di meditazione; le tre opzioni iniziali spendono un punto e un’azione bonus.'),
 ('paladin','Lay on Hands'):(85,'Imposizione delle Mani',{'activation':'action','range':'touch','resource':{'maximum':'5*paladinLevel','recovery':['long-rest']},'healing':'chosen-amount-up-to-remaining','cureDiseaseOrNeutralizePoisonCost':5,'multipleCuresAllowed':True,'excludedCreatureTypes':['undead','construct']},'Spendi una riserva di cinque PF per livello da paladino; cinque punti curano una malattia o neutralizzano un veleno.'),
 ('paladin','Divine Smite'):(86,'Punizione Divina',{'trigger':'hit-creature-with-melee-weapon-attack','activation':'no-separate-action','cost':'one-spell-slot','damageType':'radiant','damageDice':'min(slotLevel+1,5)d8','extraDiceAgainst':['undead','fiend'],'extraDiceCount':1,'printingNote':'Original says paladin spell slot; multiclass Pact Magic interoperability is cited separately.'},'Dopo un colpo da mischia spendi uno slot per danni radiosi aggiuntivi, con un dado ulteriore contro immondi o non morti.'),
 ('paladin','Divine Health'):(86,'Salute Divina',{'immunity':['disease']},'La magia divina ti rende immune alle malattie.'),
 ('cleric','Channel Divinity'):([59,60],'Incanalare Divinità',{'resource':{'usesByClassLevel':{'2':1,'6':2,'18':3},'recovery':['short-rest','long-rest']},'saveDC':'cleric-spell-save-DC','options':'turn-undead-plus-domain-options'},'Scegli un effetto ogni volta che spendi Incanalare Divinità; gli utilizzi aumentano ai livelli 6 e 18.'),
 ('druid','Wild Shape'):([67,68],'Forma Selvatica',{'activation':'action','requires':'previously-seen-beast','resource':{'uses':2,'recovery':['short-rest','long-rest']},'durationHours':'floor(druidLevel/2)','beastLimitsByClassLevel':{'2':{'maxCR':0.25,'noSpeeds':['swim','fly']},'4':{'maxCR':0.5,'noSpeeds':['fly']},'8':{'maxCR':1,'noSpeeds':[]}},'retainedAbilities':['intelligence','wisdom','charisma'],'retainAndCombineProficiencies':True,'useHigherOverlappingProficiencyBonus':True,'useLegendaryOrLairActions':False,'hitPoints':'beast-pool-then-original-pool-with-excess-damage-carried-over','spellcasting':False,'maintainConcentration':True,'retainedFeatures':'only-if-form-physically-capable','retainedSenses':'only-if-beast-has-sense','equipmentChoice':['drop','merge','wear-if-practical-DM-decides'],'mergedEquipmentWorks':False,'voluntaryRevert':'bonus-action','automaticRevert':['unconscious','zero-hit-points','death']},'Usi statistiche e PF della bestia con eccezioni esplicite. Conservi concentrazione e capacità compatibili; non acquisisci azioni leggendarie o di tana.'),
 ('wizard','Arcane Recovery'):(116,'Recupero Arcano',{'trigger':'finish-short-rest','resource':{'uses':1,'recovery':'day'},'recoverSlotLevelBudget':'ceil(wizardLevel/2)','maximumRecoverableSlotLevel':5},'Una volta al giorno, dopo un riposo breve, recuperi slot per un valore totale pari a metà livello da mago arrotondata in alto, fino al quinto livello.'),
 ('wizard','Spell Mastery'):(116,'Maestria negli Incantesimi',{'chooseFrom':'wizard-spellbook','chooseLevels':[1,2],'requiresPrepared':True,'lowestLevelCastConsumesSlot':False,'upcastRequiresSlot':True,'replaceChosenSpellsStudyHours':8},'Scegli una magia di primo e una di secondo dal libro: se preparate, le lanci al livello minimo senza slot; cambiarle richiede otto ore.'),
 ('wizard','Signature Spells'):(116,'Incantesimi Distintivi',{'choose':2,'spellLevel':3,'chooseFrom':'wizard-spellbook','alwaysPrepared':True,'countsAgainstPreparedLimit':False,'freeUsesPerChosenSpell':1,'recovery':['short-rest','long-rest'],'upcastRequiresSlot':True},'Due magie di terzo sono sempre preparate e ciascuna ha un lancio gratuito tra riposi, al livello minimo.'),
}


def apply_feature_reviews(features):
    for f in features:
        cls=f['relations']['classId'].split(':')[-1]
        key=(cls,f['name'])
        if f['name']=='Ability Score Improvement':
            page,it,effect,summary=50,'Incremento dei Punteggi di Caratteristica',{'choice':[{'abilityCount':1,'bonus':2},{'abilityCount':2,'bonus':1}],'maximum':20},'Aumenti una caratteristica di due oppure due caratteristiche di uno, fino al massimo ordinario di 20.'
        elif f['name']=='Extra Attack' and cls in ['barbarian','fighter']:
            page,it,effect,summary=(50 if cls=='barbarian' else 73),'Attacco Extra',{'attackActionAttacksByClassLevel':{'5':2,**({'11':3,'20':4} if cls=='fighter' else {})}},'Aumenta il numero di attacchi dell’azione Attaccare secondo il livello della classe.'
        elif key in ROWS:
            page,it,effect,summary=ROWS[key]
        else:
            continue
        f['nameIt']=it;f['translation']['status']='assistant-translation';f['summaryIt']=summary
        f['mechanics']['effect']=effect
        f['sources'].append(source(page,f['name']))
        f['fieldSources']['effect']=[len(f['sources'])-1]
        f['verification'].update(complete=True,missingFields=[])
    return features
