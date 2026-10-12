"""PHB PDF 113–120 read, progression 114 and schools 117–120 rendered.

Keep spellbook, school modifiers and their spell dependencies separate. The
Restore Life timing inside Master Transmuter remains an unresolved reading.
"""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:wizard'
SCHOOLS={s:('evocation' if s=='evocation' else 'wizard-'+s) for s in ['abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation']}
SAVANT_PAGES={'abjuration':116,'conjuration':117,'divination':117,'enchantment':118,'evocation':118,'illusion':119,'necromancy':119,'transmutation':120}


def apply_wizard_reviews(entities):
    by_id={e['id']:e for e in entities};added=[]
    rows=[
      ('abjuration',2,'Arcane Ward','Interdizione Arcana',116,{'createTrigger':'cast-abjuration-spell-of-level-one-or-higher','creationRequiresAction':False,
       'maximumHP':'2*wizardLevel+intelligenceModifier','expires':'finish-long-rest','creationMaximum':'once-before-next-long-rest',
       'damage':'ward-takes-damage-instead-of-self-and-excess-reaches-self','distinctFromTemporaryHitPoints':True,
       'atZero':'magic-remains-but-cannot-absorb-damage','rechargeTrigger':'cast-abjuration-spell-of-level-one-or-higher','rechargeHP':'2*spellLevel'},'Lanciando un’abiurazione di almeno primo livello crei una protezione con PF pari a due volte il livello da mago più Intelligenza. Assorbe danno con eccedenza su di te; a zero rimane e si cura di due PF per livello delle successive abiurazioni. Non è un pool di PF temporanei; creazione una volta fino al riposo lungo.'),
      ('abjuration',6,'Projected Ward','Interdizione Proiettata',116,{'trigger':'visible-creature-within-30-ft-takes-damage','activation':'reaction','uses':'own-Arcane-Ward-HP','excessDamage':'affected-creature'},'Reagisci ai danni di una creatura visibile entro trenta piedi usando i PF della tua interdizione; l’eccedenza resta sulla creatura.'),
      ('abjuration',10,'Improved Abjuration','Abiurazione Migliorata',116,{'trigger':'ability-check-as-part-of-casting-abjuration-spell','add':'proficiencyBonus','examples':['phb2014:spell:counterspell','phb2014:spell:dispel-magic']},'Aggiungi competenza alle prove di caratteristica previste dal lancio di abiurazioni, come Controincantesimo e Dissolvi Magie.'),
      ('abjuration',14,'Spell Resistance','Resistenza agli Incantesimi',117,{'savingThrowAdvantageAgainst':'spells','damageResistanceTo':'damage-from-spells'},'Vantaggio ai TS contro incantesimi e resistenza ai loro danni, non a qualsiasi effetto magico.'),
      ('conjuration',2,'Minor Conjuration','Evocazione Minore',117,{'activation':'action','targetLocationChoice':['own-hand','visible-unoccupied-ground-within-10-ft'],
       'object':'inanimate-form-of-previously-seen-nonmagical-object','maximumSideFt':3,'maximumWeightLb':10,'visiblyMagical':True,'dimLightRadiusFt':5,
       'durationHours':1,'endsEarlyWhen':['use-feature-again','object-takes-any-damage']},'Un’azione crea un oggetto inanimato nella mano o a terra entro dieci piedi: forma non magica già vista, massimo tre piedi e dieci libbre. Visibilmente magico con luce fioca di cinque piedi, dura un’ora o fino a danno o nuovo uso.'),
      ('conjuration',6,'Benign Transposition','Trasposizione Benigna',117,{'activation':'action','teleportMaximumFt':30,'destination':'visible-unoccupied-space',
       'alternativeSwapWith':'willing-Small-or-Medium-creature-in-range','resource':{'maximumUses':1,'recovery':['long-rest','cast-conjuration-spell-of-level-one-or-higher']}},'Un’azione ti teletrasporta entro trenta piedi verso uno spazio libero visibile o scambia il posto con una creatura Piccola o Media consenziente. Recuperi dopo riposo lungo o lanciando un’evocazione di almeno primo livello.'),
      ('conjuration',10,'Focused Conjuration','Evocazione Focalizzata',117,{'whileConcentratingOn':'conjuration-spell','damageBreaksConcentration':False,'otherConcentrationEndConditions':'unchanged'},'Il danno non interrompe la concentrazione sulle evocazioni; le altre condizioni di interruzione restano valide.'),
      ('conjuration',14,'Durable Summons','Evocazioni Resistenti',117,{'beneficiaries':'any-creature-summoned-or-created-with-conjuration-spell','temporaryHitPoints':30},'Ogni creatura che evochi o crei con un’evocazione riceve trenta PF temporanei.'),
      ('divination',2,'Portent','Portento',117,{'rollWhen':'finish-long-rest','d20Count':2,'replaceRollChoices':['attack-roll','saving-throw','ability-check'],
       'roller':'self-or-visible-creature','decisionTiming':'before-roll','maximumReplacementsPerTurn':1,'eachForetellingRollUses':1,'unusedLostWhen':'finish-long-rest'},'Dopo riposo lungo registra due d20: ciascuno può sostituire un attacco, prova o TS tuo o di una creatura visibile prima del tiro, una sola sostituzione per turno. I risultati inutilizzati scadono al nuovo riposo lungo.'),
      ('divination',6,'Expert Divination','Divinazione Esperta',117,{'trigger':'cast-divination-spell-of-level-two-or-higher-using-slot','recoverSlots':1,'mustBe':'already-expended-slot-lower-than-cast-spell-level','maximumRecoveredLevel':5},'Lanciando una divinazione dal secondo livello con uno slot recuperi uno slot speso di livello inferiore alla magia, massimo quinto.'),
      ('divination',10,'The Third Eye','Il Terzo Occhio',[117,118],{'activation':'action','choose':1,'choiceIds':[],
       'expiresWhen':['incapacitated','short-rest','long-rest'],'resource':{'uses':1,'recovery':['short-rest','long-rest']}},'Un’azione sceglie un beneficio percettivo fino a incapacità o prossimo riposo. Puoi riattivarlo dopo riposo breve o lungo.'),
      ('divination',14,'Greater Portent','Portento Superiore',118,{'portentD20Count':3,'replacesOriginalCount':2},'Registri tre d20 di Portento invece di due; restano le altre regole del privilegio.'),
      ('enchantment',2,'Hypnotic Gaze','Sguardo Ipnotico',118,{'activation':'action','target':'visible-creature-within-5-ft-that-sees-or-hears-self','save':'wisdom','saveDC':'wizard-spell-save-DC',
       'failure':{'charmedBySelf':True,'speed':0,'incapacitated':True,'visiblyDazed':True},'expires':'end-of-own-next-turn','extend':'own-action-on-subsequent-turns',
       'endsIf':['self-more-than-5-ft-from-target','target-neither-sees-nor-hears-self','target-takes-damage'],
       'afterEffectEndsOrInitialSaveSucceeds':'cannot-target-same-creature-again-until-own-long-rest'},'Un’azione ipnotizza una creatura visibile entro cinque piedi che ti percepisce: TS Saggezza o affascinata, incapacitata e ferma fino al tuo prossimo fine turno. Mantieni con azioni, senza danni o allontanamento; dopo fine o successo iniziale devi riposare a lungo per usarlo sulla stessa creatura.'),
      ('enchantment',6,'Instinctive Charm','Fascino Istintivo',118,{'trigger':'visible-creature-within-30-ft-makes-attack-roll-against-self','activation':'reaction','requires':'another-creature-within-attack-range',
       'decisionTiming':'before-knowing-hit-or-miss','save':'wisdom','saveDC':'wizard-spell-save-DC','failure':'attacker-targets-closest-creature-excluding-self-and-attacker',
       'equalDistance':'attacker-chooses-target','successfulSave':'cannot-affect-this-attacker-again-until-own-long-rest','unaffectedIf':'cannot-be-charmed'},'Una reazione prima dell’esito tenta di deviare un attacco da un avversario visibile entro trenta piedi. TS Saggezza o bersaglia il più vicino diverso da te e da sé; parità scelta dall’attaccante. Serve un altro bersaglio a portata; immuni al fascino esclusi e un successo blocca ulteriori tentativi fino al riposo lungo.'),
      ('enchantment',10,'Split Enchantment','Ammaliamento Diviso',118,{'trigger':'cast-enchantment-spell-of-level-one-or-higher-targeting-only-one-creature','mayAddTargets':1},'Quando lanci un ammaliamento dal primo livello che bersaglia una sola creatura puoi aggiungerne una seconda.'),
      ('enchantment',14,'Alter Memories','Alterare Ricordi',118,{'trigger':'cast-enchantment-spell-charming-one-or-more-creatures','chooseCreatures':1,'targetUnawareOfCharm':True,
       'optionalMemoryErase':{'activation':'action-once-before-spell-expires','save':'intelligence','saveDC':'wizard-spell-save-DC','failureForgetMaximumHours':'max(1,1+charismaModifier)',
        'mayChooseLess':True,'maximumActualTime':'duration-of-own-enchantment-spell'}},'Puoi rendere una creatura inconsapevole di essere affascinata dalla tua magia. Prima della scadenza una tua azione tenta di cancellare fino a uno più Carisma ore di ricordi, minimo uno ma non oltre la durata della magia, con TS Intelligenza.'),
      ('evocation',2,'Sculpt Spells','Plasmare Incantesimi',118,{'trigger':'cast-evocation-spell-affecting-other-visible-creatures','maximumChosen':'1+spellLevel',
       'chosenAutomaticallySucceedOnSpellSaves':True,'chosenDamageIfNormallyHalfOnSuccess':0},'Scegli altre creature visibili influenzate dalla tua invocazione, fino a una più il livello della magia. Superano automaticamente i TS e non subiscono danni se normalmente il successo li dimezza.'),
      ('evocation',6,'Potent Cantrip','Trucchetto Potente',118,{'trigger':'creature-succeeds-on-save-against-own-cantrip','damageMultiplier':0.5,'otherCantripEffectsApply':False},'Il successo al TS contro un tuo trucchetto dimezza il danno anziché annullarlo, senza gli altri effetti. Non trasforma in danno un attacco mancato.'),
      ('evocation',10,'Empowered Evocation','Invocazione Potenziata',118,{'trigger':'cast-wizard-evocation-spell','addIntelligenceModifierTo':'damage-roll','numberOfDamageRolls':'not-explicit-in-local-printing'},'Aggiungi Intelligenza al tiro del danno di una tua invocazione da mago. Le errata precisano un solo tiro del danno.'),
      ('evocation',14,'Overchannel','Sovraccaricare',119,{'trigger':'cast-damaging-wizard-spell','minimumSpellLevel':0,'maximumSpellLevel':5,'effect':'maximum-spell-damage',
       'firstUseBeforeLongRestBacklash':0,'secondUseBacklashPerSpellLevel':'2d12','furtherUseExtraDicePerSpellLevel':1,'damageType':'necrotic',
       'backlashWhen':'immediately-after-casting','ignores':['damage-resistance','damage-immunity'],'counterReset':'finish-long-rest'},'Massimizzi il danno di una magia da mago fino al quinto livello. Primo uso gratuito fino al riposo lungo; il secondo infligge 2d12 necrotici per livello della magia, poi un dado in più per ogni ulteriore uso, ignorando resistenze e immunità. Le errata escludono trucchetti.'),
      ('illusion',2,'Improved Minor Illusion','Illusione Minore Migliorata',119,{'learnCantrip':'phb2014:spell:minor-illusion','ifAlreadyKnown':'choose-another-wizard-cantrip',
       'countsAgainstCantripLimit':False,'minorIllusionMayCreateSoundAndImageTogether':True},'Impari Illusione Minore, o un altro trucchetto da mago se la conosci; non occupa il limite. Illusione Minore può produrre suono e immagine insieme.'),
      ('illusion',6,'Malleable Illusions','Illusioni Malleabili',119,{'trigger':'own-illusion-spell-duration-one-minute-or-longer','activation':'action','requires':'see-illusion','change':'nature-within-normal-spell-parameters'},'Un’azione cambia un’illusione che vedi di una tua magia di durata almeno un minuto, entro i suoi normali parametri.'),
      ('illusion',10,'Illusory Self','Sé Illusorio',119,{'trigger':'creature-makes-attack-roll-against-self','activation':'reaction','attackAutomaticallyMissesSelf':True,'resource':{'uses':1,'recovery':['short-rest','long-rest']}},'Una reazione interpone un duplicato contro un attacco, che ti manca automaticamente. Recupero dopo riposo breve o lungo.'),
      ('illusion',14,'Illusory Reality','Realtà Illusoria',119,{'spell':'own-illusion-of-level-one-or-higher','chooseObject':'one-inanimate-nonmagical-object-part-of-illusion',
       'activation':'bonus-action-on-own-turn-while-spell-ongoing','objectRemainsRealMinutes':1,'mayDealDamageOrDirectlyHarm':False},'Con un’azione bonus durante una tua illusione di almeno primo livello rendi reale per un minuto un oggetto inanimato non magico che ne fa parte; non può infliggere danni né ferire direttamente.'),
      ('necromancy',2,'Grim Harvest','Mietitura Macabra',119,{'trigger':'kill-one-or-more-creatures-with-spell-of-level-one-or-higher','maximumUses':'once-per-turn',
       'healing':'2*spellLevel','ifNecromancyHealing':'3*spellLevel','excludedKills':['construct','undead']},'Una volta per turno, uccidendo con una magia dal primo livello recuperi due PF per suo livello, tre se necromanzia. Costrutti e non morti non danno questo beneficio.'),
      ('necromancy',6,'Undead Thralls','Servitori Non Morti',120,{'addToSpellbookIfMissing':'phb2014:spell:animate-dead','animateDeadAdditionalCorpseOrBones':1,
       'anyUndeadCreatedWithNecromancySpell':{'additionalMaximumHP':'wizardLevel','additionalWeaponDamage':'character-proficiencyBonus'}},'Aggiungi Animare Morti al libro e con quella magia crei un servitore aggiuntivo. Ogni non morto creato con necromanzia ha PF massimi aumentati del livello da mago e aggiunge competenza ai danni con armi.'),
      ('necromancy',10,'Inured to Undeath','Avvezzo alla Non Morte',120,{'damageResistance':'necrotic','hitPointMaximumCanBeReduced':False},'Resisti ai necrotici e i tuoi PF massimi non possono essere ridotti.'),
      ('necromancy',14,'Command Undead','Comandare Non Morti',120,{'activation':'action','target':'visible-undead-within-60-ft','save':'charisma','saveDC':'wizard-spell-save-DC',
       'successfulSave':'cannot-use-feature-on-target-again','failure':'friendly-and-obeys-until-feature-used-again','targetIntelligence8OrHigher':'advantage-on-save',
       'failedTargetIntelligence12OrHigher':'repeat-save-at-end-of-each-hour-until-success'},'Un’azione tenta di controllare un non morto visibile entro sessanta piedi con TS Carisma: successo lo rende immune ai tuoi ulteriori tentativi, fallimento lo rende amico e obbediente fino al nuovo uso. Intelligenza almeno otto dà vantaggio, almeno dodici permette ripetizione ogni ora.'),
      ('transmutation',2,'Minor Alchemy','Alchimia Minore',120,{'object':'one-nonmagical-object-entirely-made-of-one-eligible-material','materialChoices':['wood','stone-not-gemstone','iron','copper','silver'],
       'maximumCubicFtPer10Minutes':1,'expiresAfterHours':1,'endsOn':'lose-concentration-as-on-spell'},'Trasformi un oggetto non magico interamente di legno, pietra non preziosa, ferro, rame o argento in un altro di quei materiali. Un piede cubo per dieci minuti; torna originale dopo un’ora o perdita della concentrazione.'),
      ('transmutation',6,"Transmuter's Stone",'Pietra del Trasmutatore',120,{'creationHours':8,'beneficiary':'creature-in-possession-including-creator','choose':1,'choiceIds':[],
       'changeChoiceTrigger':'cast-transmutation-spell-of-level-one-or-higher-while-carrying-stone','newStoneDisablesPrevious':True},'Otto ore creano una pietra che offre un beneficio a chi la possiede. Puoi cambiarlo lanciando una trasmutazione dal primo livello con la pietra su di te; crearne un’altra disattiva la precedente.'),
      ('transmutation',10,'Shapechanger','Mutaforma',120,{'addToSpellbookIfMissing':'phb2014:spell:polymorph','freeCasting':{'target':'self-only','maximumBeastCR':1,'spellSlotRequired':False,'resource':{'uses':1,'recovery':['short-rest','long-rest']}}},'Aggiungi Metamorfosi al libro. Una volta per riposo breve o lungo la lanci senza slot, solo su te stesso e in bestia di GS massimo uno; i lanci normali restano possibili.'),
      ('transmutation',14,'Master Transmuter','Maestro Trasmutatore',120,{'activation':'action-consume-own-stone','stoneDestroyed':True,'cannotRemakeUntil':'finish-long-rest','chooseOne':[
       {'index':'major-transformation','nonmagicalObjectMaximumCubeSideFt':5,'newObject':'nonmagical-similar-size-and-mass-equal-or-lower-value','handlingMinutes':10},
       {'index':'panacea','target':'creature-touched-by-stone','removes':['all-curses','diseases','poisons'],'healing':'all-hit-points'},
       {'index':'restore-life','spellId':'phb2014:spell:raise-dead','target':'creature-touched-by-stone','spellSlotRequired':False,'spellbookRequired':False,'materialComponentsWaived':False,'castingTimeInterpretation':None},
       {'index':'restore-youth','target':'willing-creature-touched-by-stone','apparentAgeReductionYears':'3d10','minimumApparentAgeYears':13,'extendsLifespan':False}]},'Consumi la pietra e scegli trasformazione di un oggetto con dieci minuti di manipolazione, cura totale e rimozione di maledizioni/malattie/veleni, Rianimare Morti senza slot o libro, oppure ringiovanimento apparente. Nessuna esenzione dei materiali è concessa per Rianimare Morti; l’interazione del tempo di lancio con l’azione di consumo resta da interpretare.'),
    ]
    for school,sub in SCHOOLS.items():
        rows.append((school,2,school.title()+' Savant','Sapiente della Scuola '+by_id['phb2014:subclass:'+sub]['nameIt'],SAVANT_PAGES[school],
          {'copySpellSchool':school,'copyingGoldMultiplier':0.5,'copyingTimeMultiplier':0.5},'Tempo e oro per copiare nel libro magie della tua scuola sono dimezzati. Non dimezza il costo dei materiali quando lanci una magia.'))
    for school,level,name,it,pages,effect,summary in rows:
        sub=SCHOOLS[school];missing=['restoreLifeCastingTimeInterpretation'] if name=='Master Transmuter' else []
        e=record('subclass-feature',f'{sub}-{level}-'+slug(name),name,it,pages,{'level':level,'effect':effect},summary,missing=missing)
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub};added.append(e)
        if missing:e['interpretations'].append({'field':'effect.chooseOne.2.castingTimeInterpretation','kind':'unresolved-specific-vs-general-timing','method':'PHB PDF 120 specifies an action to consume the stone; PDF 271 specifies one hour for Raise Dead. Materials are not waived. No unsupported automatic timing selected.'})
    eye_origin='phb2014:subclass-feature:wizard-divination-10-the-third-eye'
    stone_origin='phb2014:subclass-feature:wizard-transmutation-6-transmuter-s-stone'
    choices=[
      ('third-eye-darkvision','Scurovisione',eye_origin,10,'divination',118,{'darkvisionFt':60}),
      ('third-eye-ethereal-sight','Vista Eterea',eye_origin,10,'divination',118,{'seeIntoEtherealPlaneFt':60}),
      ('third-eye-greater-comprehension','Comprensione Superiore',eye_origin,10,'divination',118,{'canRead':'any-language'}),
      ('third-eye-see-invisibility','Vedere Invisibilità',eye_origin,10,'divination',118,{'seeInvisibleCreaturesAndObjectsFt':10,'requires':'line-of-sight'}),
      ('stone-darkvision','Pietra: Scurovisione',stone_origin,6,'transmutation',120,{'darkvisionFt':60}),
      ('stone-speed','Pietra: Velocità',stone_origin,6,'transmutation',120,{'speedBonusFt':10,'requires':'unencumbered'}),
      ('stone-constitution-saves','Pietra: TS Costituzione',stone_origin,6,'transmutation',120,{'savingThrowProficiency':'constitution'}),
    ]
    choices.extend(('stone-resist-'+d,'Pietra: Resistenza '+it,stone_origin,6,'transmutation',120,{'damageResistance':d}) for d,it in [('acid','Acido'),('cold','Freddo'),('fire','Fuoco'),('lightning','Fulmine'),('thunder','Tuono')])
    for index,it,origin,level,school,page,effect in choices:
        e=record('class-option','wizard-'+index,it,it,page,{'optionType':'wizard-choice','prerequisites':{},'effect':effect,
          'selectionOrigins':[{'originId':origin,'classId':CLASS,'minimumClassLevel':level,'subclassId':'phb2014:subclass:'+SCHOOLS[school]}]},'Beneficio selezionabile singolarmente nel privilegio collegato; durata, portatore e sostituzione seguono quel privilegio.')
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+SCHOOLS[school],'parentFeatureId':origin};added.append(e)
    for f in added:
        if f['id'] in [eye_origin,stone_origin]:f['mechanics']['effect']['choiceIds']=[e['id'] for e in added if e['kind']=='class-option' and e['relations']['parentFeatureId']==f['id']]
    entities.extend(added)
    progression=[{'wizardLevel':n,**{k:by_id[f'phb2014:class-level:wizard-{n}']['mechanics'][k] for k in ['spellSlots','cantripsKnown']}} for n in range(1,21)]
    casting=by_id['phb2014:class-feature:wizard-1-spellcasting']
    casting['mechanics']['effect']={'ability':'intelligence','list':'wizard','progression':progression,'spellSlotScope':'your-spells','slotRecovery':['long-rest'],
       'initialSpellbook':{'choose':6,'spellLevel':1,'classList':'wizard'},'addOnWizardLevelGain':2,'preparedLimit':'max(1,wizardLevel+intelligenceModifier)',
       'preparedFrom':'own-spellbook','preparationLevelLimit':'wizard-class-table','changePreparation':'finish-long-rest','preparationMinutes':'sum-prepared-spell-levels',
       'ritualRequires':['wizard-spell-in-own-spellbook','ritual-tag'],'ritualRequiresPrepared':False,'focus':'arcane-focus',
       'copySpell':{'minimumSpellLevel':1,'eligibility':'level-for-which-you-have-spell-slots','hoursPerSpellLevel':2,'goldPerSpellLevel':50},
       'copyOwnBookOrPreparedSpellsToReplacementBook':{'hoursPerSpellLevel':1,'goldPerSpellLevel':10,'lostBookOtherSpellsMustBeFoundAgain':True},
       'cantripsStoredInSpellbookExplicit':'not-stated-in-local-printing'}
    casting['sources'].append(source([114,115],'Spellcasting and Your Spellbook'));casting['sources'][-1]['verification']='read-local-render'
    casting['fieldSources']['effect']=[len(casting['sources'])-1];casting['verification'].update(complete=True,missingFields=[])
    casting.update(nameIt='Incantesimi',summaryIt='Magie preparate con Intelligenza dal libro, entro la tabella del mago; sei magie di primo iniziali e due per nuovo livello da mago. Copia di nuove magie: due ore e cinquanta mo per livello; copie del proprio libro o delle magie preparate perdute: un’ora e dieci mo. Ritualizza dal libro senza preparare, usando focus arcano.',translation={'language':'it','status':'assistant-translation'})
    tradition=by_id['phb2014:class-feature:wizard-2-arcane-tradition']
    tradition['mechanics']['effect']={'chooseSubclass':1,'subclassIds':['phb2014:subclass:'+s for s in SCHOOLS.values()],'featureLevels':[2,6,10,14]}
    tradition['fieldSources']['effect']=[0];tradition.update(nameIt='Tradizione Arcana',summaryIt='Scegli una delle otto scuole del PHB, con privilegi ai livelli 2, 6, 10 e 14.',translation={'language':'it','status':'assistant-translation'})
    tradition['verification'].update(complete=True,missingFields=[])
    for e in entities:
        if e['kind']=='class-feature' and e['relations']['classId']==CLASS and e['name']=='Subclass Feature':
            e['mechanics']['concreteAlternativeIds']=[f['id'] for f in added if f['kind']=='subclass-feature' and f['mechanics']['level']==e['mechanics']['level']];e['fieldSources']['concreteAlternativeIds']=[0]
    for school,sub in SCHOOLS.items():
        e=by_id['phb2014:subclass:'+sub];fs=[f for f in added if f['kind']=='subclass-feature' and f['relations']['subclassId']==e['id']]
        e['relations']['featureIds']=[f['id'] for f in fs];e['summaryIt']=' '.join(f['summaryIt'] for f in fs)
        missing=['featureEffects:'+f['id'] for f in fs if not f['verification']['complete']]
        e['verification'].update(complete=not missing,missingFields=missing)
    return entities
