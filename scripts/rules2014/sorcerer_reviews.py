"""PHB PDF 100–105 read, tables 101–103 and all fifty surge rows on render 105."""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:sorcerer'

# Tuple order is the visually checked d100 order, not the scrambled OCR columns.
SURGES=[
 ('Per un minuto ritira all’inizio di ogni tuo turno, ignorando questo risultato successivamente.',{'repeatAt':'start-own-turn','durationMinutes':1,'ignoreSubsequentRollRange':[1,2]}),
 ('Per un minuto vedi le creature invisibili in linea di vista.',{'seeInvisibleCreatures':True,'requires':'line-of-sight','durationMinutes':1}),
 ('Un modron scelto e controllato dal DM appare in uno spazio libero entro cinque piedi per un minuto.',{'summon':'modron-chosen-by-DM','controller':'DM','unoccupiedSpaceWithinFt':5,'durationMinutes':1}),
 ('Lanci Palla di Fuoco di terzo livello centrata su di te.',{'spellId':'phb2014:spell:fireball','castLevel':3,'center':'self'}),
 ('Lanci Dardo Incantato di quinto livello.',{'spellId':'phb2014:spell:magic-missile','castLevel':5}),
 ('La statura cambia di 1d10 pollici: diminuisce con risultato dispari, cresce con pari.',{'heightChangeInches':'1d10','odd':'shrink','even':'grow'}),
 ('Lanci Confusione centrata su di te.',{'spellId':'phb2014:spell:confusion','center':'self'}),
 ('Recuperi cinque PF all’inizio dei tuoi turni per un minuto.',{'healing':5,'when':'start-own-turn','durationMinutes':1}),
 ('Una barba di piume resta fino a quando starnutisci e la disperdi.',{'featherBeard':True,'endsWhen':'sneeze'}),
 ('Lanci Unto centrato su di te.',{'spellId':'phb2014:spell:grease','center':'self'}),
 ('I bersagli hanno svantaggio ai TS della prossima tua magia con TS entro un minuto.',{'nextSpellSavingThrows':'disadvantage','windowMinutes':1}),
 ('Pelle blu vivace fino a Rimuovi Maledizione.',{'skinColor':'bright-blue','removableBySpellId':'phb2014:spell:remove-curse'}),
 ('Un occhio sulla fronte dà vantaggio a Percezione visiva per un minuto.',{'advantage':'wisdom-perception-relying-on-sight','durationMinutes':1}),
 ('Per un minuto le tue magie da un’azione richiedono un’azione bonus.',{'castingTimeReplacement':{'from':'action','to':'bonus-action'},'durationMinutes':1}),
 ('Ti teletrasporti fino a sessanta piedi verso uno spazio libero visibile.',{'teleportMaximumFt':60,'destination':'visible-unoccupied-space'}),
 ('Passi sul Piano Astrale fino al tuo prossimo fine turno, poi torni al posto precedente o al libero più vicino.',{'transportTo':'Astral-Plane','expires':'end-own-next-turn','returnSpace':'previous-or-nearest-unoccupied'}),
 ('La prossima magia dannosa entro un minuto infligge il massimo.',{'nextDamagingSpell':'maximum-damage','windowMinutes':1}),
 ('Età cambia di 1d10 anni: pari invecchia, dispari ringiovanisce fino a un minimo di un anno.',{'ageChangeYears':'1d10','odd':'younger','even':'older','minimumAgeYears':1}),
 ('1d6 flumph controllati dal DM appaiono entro sessanta piedi, spaventati da te, per un minuto.',{'summon':'flumph','quantity':'1d6','controller':'DM','unoccupiedSpaceWithinFt':60,'condition':'frightened-of-self','durationMinutes':1}),
 ('Recuperi 2d10 PF.',{'healing':'2d10'}),
 ('Diventi pianta in vaso fino all’inizio del tuo prossimo turno: incapacitato e vulnerabile a tutti i danni, ritorni anche se scendi a zero PF.',{'form':'potted-plant','expires':'start-own-next-turn','condition':'incapacitated','damageVulnerabilities':'all','endsAlsoOn':'zero-hp'}),
 ('Per un minuto puoi teletrasportarti fino a venti piedi con azione bonus nei tuoi turni.',{'teleportMaximumFt':20,'activation':'bonus-action-on-own-turn','durationMinutes':1,'destinationRestrictions':'not-stated'}),
 ('Lanci Levitazione su te stesso.',{'spellId':'phb2014:spell:levitate','target':'self'}),
 ('Un unicorno controllato dal DM appare entro cinque piedi per un minuto.',{'summon':'unicorn','controller':'DM','spaceWithinFt':5,'unoccupiedRequiredExplicitly':False,'durationMinutes':1}),
 ('Per un minuto non parli: i tentativi producono bolle rosa.',{'cannotSpeak':True,'durationMinutes':1,'visualEffect':'pink-bubbles'}),
 ('Uno scudo spettrale ti dà CA più due e immunità a Dardo Incantato per un minuto.',{'armorClassBonus':2,'immuneToSpellId':'phb2014:spell:magic-missile','durationMinutes':1}),
 ('Non puoi essere ubriacato dall’alcol per 5d6 giorni.',{'immuneTo':'alcohol-intoxication','durationDays':'5d6'}),
 ('Perdi i capelli, che ricrescono entro ventiquattro ore.',{'hairLost':True,'regrowthWithinHours':24}),
 ('Per un minuto incendi oggetti infiammabili toccati, esclusi quelli indossati o portati da altri.',{'ignites':'touched-flammable-objects-not-worn-or-carried-by-another-creature','durationMinutes':1}),
 ('Recuperi lo slot speso di livello più basso.',{'recoverExpendedSpellSlots':1,'slotChoice':'lowest-level'}),
 ('Per un minuto devi urlare quando parli.',{'speechMust':'shout','durationMinutes':1}),
 ('Lanci Nube di Nebbia centrata su di te.',{'spellId':'phb2014:spell:fog-cloud','center':'self'}),
 ('Fino a tre creature scelte entro trenta piedi subiscono 4d10 fulmine senza TS indicato.',{'maximumChosenTargets':3,'rangeFt':30,'damage':'4d10','damageType':'lightning','saveRequired':False}),
 ('Sei spaventato dalla creatura più vicina fino al tuo prossimo fine turno.',{'condition':'frightened','source':'nearest-creature','expires':'end-own-next-turn'}),
 ('Ogni creatura entro trenta piedi è invisibile per un minuto, finché attacca o lancia una magia.',{'targets':'each-creature-within-30-ft','condition':'invisible','durationMinutes':1,'endsForIndividualWhen':['attack','cast-spell']}),
 ('Resistenza a tutti i danni per un minuto.',{'damageResistances':'all','durationMinutes':1}),
 ('Una creatura casuale entro sessanta piedi è avvelenata per 1d4 ore.',{'target':'random-creature-within-60-ft','condition':'poisoned','durationHours':'1d4'}),
 ('Luce intensa per trenta piedi per un minuto; chi termina il turno entro cinque piedi è accecato fino al suo prossimo fine turno.',{'brightLightRadiusFt':30,'durationMinutes':1,'creatureEndsTurnWithin5Ft':{'condition':'blinded','expires':'end-target-next-turn'}}),
 ('Lanci Metamorfosi su di te; fallendo il TS diventi pecora per la durata della magia.',{'spellId':'phb2014:spell:polymorph','target':'self','failedSaveBeast':'sheep'}),
 ('Farfalle e petali illusori entro dieci piedi per un minuto.',{'illusoryButterfliesAndPetalsRadiusFt':10,'durationMinutes':1}),
 ('Puoi effettuare subito un’azione aggiuntiva.',{'additionalActionsImmediately':1}),
 ('Ogni creatura entro trenta piedi subisce 1d10 necrotici; recuperi PF pari al totale effettivamente inflitto.',{'targets':'each-creature-within-30-ft','damage':'1d10','damageType':'necrotic','selfHealing':'sum-necrotic-damage-dealt','saveRequired':False}),
 ('Lanci Immagine Speculare.',{'spellId':'phb2014:spell:mirror-image'}),
 ('Lanci Volare su una creatura casuale entro sessanta piedi.',{'spellId':'phb2014:spell:fly','target':'random-creature-within-60-ft'}),
 ('Per un minuto sei invisibile e altri non ti sentono; attacco o magia interrompono l’invisibilità.',{'condition':'invisible','cannotBeHeardByOthers':True,'durationMinutes':1,'invisibilityEndsWhen':['attack','cast-spell']}),
 ('Se muori entro un minuto torni subito in vita come con Reincarnazione.',{'deathWithinMinutes':1,'onDeath':'immediately-return-as-with-reincarnate','spellId':'phb2014:spell:reincarnate'}),
 ('Cresci di una categoria di taglia per un minuto.',{'increaseSizeCategories':1,'durationMinutes':1}),
 ('Tu e ogni creatura entro trenta piedi siete vulnerabili al perforante per un minuto.',{'targets':'self-and-all-creatures-within-30-ft','damageVulnerability':'piercing','durationMinutes':1}),
 ('Musica eterea tenue ti circonda per un minuto.',{'audibleEffect':'faint-ethereal-music','durationMinutes':1}),
 ('Recuperi tutti i punti stregoneria spesi.',{'recover':'all-expended-sorcery-points'})
]


def apply_sorcerer_reviews(entities):
    by_id={e['id']:e for e in entities};added=[]
    meta=[
      ('Careful Spell','Incantesimo Prudente',{'sorceryPointCost':1,'trigger':'cast-spell-forcing-other-creatures-saving-throw','maximumChosenCreatures':'max(1,charismaModifier)','chosenCreatures':'automatically-succeed-save'},'Un punto protegge fino a Carisma creature, minimo una, che superano automaticamente il TS; non annulla da solo il danno su successo.'),
      ('Distant Spell','Incantesimo Distante',{'sorceryPointCost':1,'rangeAtLeast5FtMultiplier':2,'touchRangeReplacementFt':30,'selfRangeEligible':False},'Un punto raddoppia la gittata di almeno cinque piedi, oppure porta il contatto a trenta; non modifica la gittata personale.'),
      ('Empowered Spell','Incantesimo Potenziato',{'sorceryPointCost':1,'trigger':'roll-spell-damage','maximumDamageDiceRerolled':'max(1,charismaModifier)','mustUseNewRolls':True,'mayCombineWithOtherMetamagic':True},'Un punto ritira fino a Carisma dadi di danno, minimo uno, conservando i nuovi risultati. Può combinarsi con un’altra metamagia.'),
      ('Extended Spell','Incantesimo Esteso',{'sorceryPointCost':1,'minimumOriginalDurationSeconds':60,'durationMultiplier':2,'maximumDurationHours':24},'Un punto raddoppia una durata di almeno un minuto, fino a ventiquattro ore.'),
      ('Heightened Spell','Incantesimo Intensificato',{'sorceryPointCost':3,'trigger':'cast-spell-forcing-saving-throw-to-resist-effect','targets':1,'saveDisadvantage':'first-saving-throw-against-spell'},'Tre punti danno svantaggio a un solo bersaglio al primo TS contro la magia, non ai successivi.'),
      ('Quickened Spell','Incantesimo Rapido',{'sorceryPointCost':2,'castingTimeReplacement':{'from':'action','to':'bonus-action'},'onlyThisCasting':True,'generalBonusActionSpellRestriction':'unchanged'},'Due punti trasformano quel lancio da un’azione a un’azione bonus; restano le regole generali delle magie con azione bonus.'),
      ('Subtle Spell','Incantesimo Celato',{'sorceryPointCost':1,'waivedComponents':['V','S'],'materialComponentsWaived':False},'Un punto elimina verbale e somatica, conservando materiali e loro costi.'),
      ('Twinned Spell','Incantesimo Raddoppiato',{'sorceryPointCost':'max(1,spellLevel)','requires':['spell-targets-only-one-creature','range-not-self'],'additionalCreatureTargets':1,'secondTarget':'within-range','incapableOfMultipleCreatureTargetsAtCurrentLevel':'not-stated-in-local-printing'},'Punti pari al livello della magia, uno per trucchetti, aggiungono una seconda creatura entro gittata a una magia con un solo bersaglio e gittata non personale. Le errata precisano l’incapacità di bersagliare più creature a quel livello.')
    ]
    for name,it,effect,summary in meta:
        e=record('class-option','sorcerer-'+slug(name),name,it,103,{'optionType':'metamagic','prerequisites':{},'effect':effect,'selectionOrigins':[{'originId':'phb2014:class-feature:sorcerer-3-metamagic','classId':CLASS,'minimumClassLevel':3}]},summary)
        e['sources'].append(source(102,'Metamagic'));e['fieldSources']['selectionOrigins']=[1];e['relations']={'classId':CLASS};added.append(e)
    ancestor='phb2014:subclass-feature:draconic-1-dragon-ancestor'
    for dragon,damage,it in [('black','acid','Nero'),('blue','lightning','Blu'),('brass','fire','Ottone'),('bronze','lightning','Bronzo'),('copper','acid','Rame'),('gold','fire','Oro'),('green','poison','Verde'),('red','fire','Rosso'),('silver','cold','Argento'),('white','cold','Bianco')]:
        e=record('class-option','sorcerer-ancestor-'+dragon,'Dragon Ancestor: '+dragon.title(),'Antenato Draconico: '+it,103,{'optionType':'sorcerer-choice','prerequisites':{},'effect':{'dragon':dragon,'damageType':damage},'selectionOrigins':[{'originId':ancestor,'classId':CLASS,'minimumClassLevel':1,'subclassId':'phb2014:subclass:draconic'}]},'Associazione di antenato e tipo di danno per i privilegi dello stregone, senza il soffio della razza dragonide.')
        e['sources'][0]['verification']='read-local-render';e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:draconic','parentFeatureId':ancestor};added.append(e)
    surge_table=[{'minimumRoll':i*2+1,'maximumRoll':i*2+2,'summaryIt':it,'effect':effect} for i,(it,effect) in enumerate(SURGES)]
    dep_spells=sorted({r['effect']['spellId'] for r in surge_table if 'spellId' in r['effect']})
    creature_ids=['mm2014:creature:'+s for s in ['monodrone','duodrone','tridrone','quadrone','pentadrone','flumph','unicorn']]
    missing=['spellDescription:'+s for s in dep_spells if not by_id[s]['verification']['complete']]+['creatureStatistics:'+s for s in creature_ids if s not in by_id or not by_id[s]['verification']['complete']]
    rows=[
      ('draconic',1,'Dragon Ancestor','Antenato Draconico',103,{'choose':1,'choiceIds':[e['id'] for e in added if e['mechanics']['optionType']=='sorcerer-choice'],'language':'draconic-speak-read-write','dragonInteractionCharismaChecks':'double-proficiency-bonus-if-applies'},'Scegli uno dei dieci antenati e il tipo di danno associato; impari Draconico e raddoppi competenza, se applicabile, alle prove Carisma con draghi.'),
      ('draconic',1,'Draconic Resilience','Resilienza Draconica',103,{'additionalMaximumHP':'sorcererLevel','armorClass':'13+dexterityModifier','armorClassRequires':'not-wearing-armor'},'Un PF massimo aggiuntivo per livello da stregone e CA tredici più Destrezza senza armatura.'),
      ('draconic',6,'Elemental Affinity','Affinità Elementale',103,{'trigger':'cast-spell-dealing-ancestry-damage-type','damageBonus':'charismaModifier','numberOfDamageRolls':'not-explicit-in-local-printing','optionalAtSameTime':{'sorceryPointCost':1,'resistance':'ancestry-damage-type','durationHours':1}},'Aggiungi Carisma al danno della magia del tipo dell’antenato; allo stesso tempo un punto dà resistenza al tipo per un’ora. Le errata limitano il bonus a un tiro di danno.'),
      ('draconic',14,'Dragon Wings','Ali Draconiche',104,{'activation':'bonus-action-on-own-turn','flySpeed':'current-speed','dismiss':'bonus-action-on-own-turn','armorRequires':'made-to-accommodate-wings','ordinaryClothing':'might-be-destroyed'},'Ali con volo pari alla velocità attuale, create e congedate con azione bonus. L’armatura deve accoglierle e vestiti inadatti possono rompersi.'),
      ('draconic',18,'Draconic Presence','Presenza Draconica',104,{'activation':'action','sorceryPointCost':5,'chooseCondition':['charmed','frightened'],'radiusFt':60,'durationMinutes':1,'concentration':'as-on-spell','target':'hostile-creature-starting-turn-in-aura','save':'wisdom','saveDC':'sorcerer-spell-save-DC','failureExpires':'aura-ends','successfulSaveImmunityHours':24},'Cinque punti e un’azione creano un’aura concentrata per un minuto, sessanta piedi. Nemici a inizio turno fanno TS Saggezza o sono affascinati o spaventati fino al termine; successo dà immunità all’aura per ventiquattro ore.'),
      ('wild-magic',1,'Wild Magic Surge','Impulso di Magia Selvaggia',[104,105],{'trigger':'immediately-after-casting-sorcerer-spell-of-level-one-or-higher','requiresDMChoice':True,'triggerRoll':'d20','surgeIfRoll':1,'maximumTriggerRollsPerTurn':'not-stated-in-local-printing','surgeSpellMetamagicEligible':'not-stated-in-local-printing','surgeSpellConcentrationRequired':'not-excluded-in-local-printing','table':surge_table,'tableDice':'d100','spellAndCreatureDependencies':dep_spells},'Il DM può richiedere un d20 dopo una magia da stregone dal primo livello; con uno si usa la tabella d100. Tutte cinquanta righe sono strutturate, ma dipendenze di magie e creature sono separate e le limitazioni corrette dalle errata non sovrascrivono la stampa.'),
      ('wild-magic',1,'Tides of Chaos','Maree del Caos',104,{'grantAdvantageToOne':['attack-roll','ability-check','saving-throw'],'resource':{'uses':1,'recovery':['long-rest']},'alternativeRecovery':{'when':'while-use-expended-immediately-after-casting-sorcerer-spell-of-level-one-or-higher','requiresDMChoice':True,'roll':'directly-on-Wild-Magic-Surge-table','regainsUse':True}},'Un vantaggio a un attacco, prova o TS per riposo lungo. Prima del recupero il DM può richiedere direttamente la tabella dopo una magia da stregone dal primo livello e restituire l’uso.'),
      ('wild-magic',6,'Bend Luck','Piegare Fortuna',104,{'trigger':'visible-other-creature-attack-check-or-save','activation':'reaction','sorceryPointCost':2,'roll':'1d4','choose':['add','subtract'],'decisionTiming':'after-roll-before-effects'},'Due punti e reazione aggiungono o sottraggono 1d4 a un attacco, prova o TS di un’altra creatura visibile, dopo il tiro prima degli effetti.'),
      ('wild-magic',14,'Controlled Chaos','Caos Controllato',104,{'when':'roll-Wild-Magic-Surge-table','rolls':2,'chooseResults':1},'Quando usi la tabella di impulso puoi tirare due volte e scegliere un risultato.'),
      ('wild-magic',18,'Spell Bombardment','Bombardamento Magico',104,{'trigger':'spell-damage-roll-with-at-least-one-die-at-maximum','chooseDice':1,'additionalRoll':'one-chosen-maximized-die-once','addExtraResultToDamage':True,'maximumUses':'once-per-turn','recursiveExtraRolls':False},'Una volta per turno, se un dado di danno della magia mostra il massimo, ne scegli uno e lo tiri un’altra volta aggiungendo quel risultato, senza ricorsione.')
    ]
    for sub,level,name,it,pages,effect,summary in rows:
        e=record('subclass-feature',f'{sub}-{level}-'+slug(name),name,it,pages,{'level':level,'effect':effect},summary,missing=missing if name=='Wild Magic Surge' else [])
        if name=='Wild Magic Surge':
            e['mechanics']['effect']['creatureDependencies']=creature_ids
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub};added.append(e)
    entities.extend(added)
    progression=[{'sorcererLevel':n,**{k:by_id[f'phb2014:class-level:sorcerer-{n}']['mechanics'][k] for k in ['spellSlots','cantripsKnown','spellsKnown','sorceryPoints']}} for n in range(1,21)]
    core={
      'Spellcasting':(102,'Incantesimi',{'ability':'charisma','list':'sorcerer','progression':progression,'spellSlotScope':'your-spells','slotRecovery':['long-rest'],'knownSpellLevelLimit':'own-class-table','replaceKnownSpellOnSorcererLevelGain':1,'replacementList':'sorcerer','focus':'arcane-focus','ritualCastingGranted':False},'Magie conosciute della tabella da stregone, con Carisma e focus arcano. Recuperi slot con riposo lungo; ogni livello di classe può sostituire una magia conosciuta entro la tabella, senza rituali concessi.'),
      'Sorcerous Origin':(102,'Origine Stregonesca',{'chooseSubclass':1,'subclassIds':['phb2014:subclass:draconic','phb2014:subclass:wild-magic'],'featureLevels':[1,6,14,18]},'Scegli Discendenza Draconica o Magia Selvaggia al livello 1, con ulteriori privilegi ai livelli 6, 14 e 18.'),
      'Font of Magic':(102,'Fonte di Magia',{'maximumSorceryPoints':'sorcererLevel-from-level-two','mayExceedMaximum':False,'recovery':['long-rest'],'flexibleCasting':{'activation':'bonus-action-on-own-turn','createSlotPointCostBySlotLevel':{'1':2,'2':3,'3':5,'4':6,'5':7},'maximumCreatedSlotLevel':5,'convertSlotPoints':'spent-slot-level','createdSlotsExpire':'not-stated-in-local-printing'}},'Dal livello 2 punti stregoneria pari al livello di classe, recuperati con riposo lungo, senza superare il limite. Un’azione bonus crea slot fino al quinto pagando due, tre, cinque, sei o sette punti; sacrificare uno slot restituisce punti pari al suo livello. La scadenza degli slot creati è esplicita nelle errata.'),
      'Metamagic':(102,'Metamagia',{'knownOptionsBySorcererLevel':{'3':2,'10':3,'17':4},'choiceIds':[e['id'] for e in added if e['kind']=='class-option' and e['mechanics']['optionType']=='metamagic'],'maximumOptionsPerSpell':1,'combinationException':'Empowered-Spell'},'Due metamagie al livello 3, una aggiuntiva al 10 e al 17. Una per magia, eccetto la combinazione consentita da Incantesimo Potenziato.'),
      'Sorcerous Restoration':(103,'Ripristino Stregonesco',{'when':'finish-short-rest','recoverExpendedSorceryPoints':4,'cannotExceedMaximum':True},'Al livello 20 il riposo breve restituisce quattro punti spesi, entro il massimo.')
    }
    for e in entities:
        if e['kind']!='class-feature' or e['relations'].get('classId')!=CLASS:continue
        if e['name']=='Subclass Feature':
            e['mechanics']['concreteAlternativeIds']=[f['id'] for f in added if f['kind']=='subclass-feature' and f['mechanics']['level']==e['mechanics']['level']];e['fieldSources']['concreteAlternativeIds']=[0]
        elif e['name'] in core:
            pages,it,effect,summary=core[e['name']];e.update(nameIt=it,summaryIt=summary,translation={'language':'it','status':'assistant-translation'})
            e['sources'].append(source(pages,e['name']));e['mechanics']['effect']=effect;e['fieldSources']['effect']=[len(e['sources'])-1];e['verification'].update(complete=True,missingFields=[])
    for sub in ['draconic','wild-magic']:
        e=by_id['phb2014:subclass:'+sub];fs=[f for f in added if f['kind']=='subclass-feature' and f['relations']['subclassId']==e['id']]
        e['relations']['featureIds']=[f['id'] for f in fs];e['summaryIt']=' '.join(f['summaryIt'] for f in fs)
        missing=['featureEffects:'+f['id'] for f in fs if not f['verification']['complete']];e['verification'].update(complete=not missing,missingFields=missing)
    return entities
