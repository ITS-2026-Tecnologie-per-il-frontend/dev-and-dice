"""Individual DMG diseases, poisons and optional madness; PDF 258–261 read/rendered."""
from curated import record


def hazards():
    poisons=[
      ('assassins-blood','Assassin’s Blood','Sangue dell’Assassino','ingested',150,10,{'failureDamage':'1d12','successDamage':'half','failureConditions':['poisoned'],'durationHours':24},'TS Costituzione dieci: d12 veleno e avvelenato ventiquattro ore; successo dimezza solo il danno.'),
      ('burnt-othur-fumes','Burnt Othur Fumes','Fumi di Othur Bruciato','inhaled',500,13,{'failureDamage':'3d6','successDamage':'none','repeat':{'timing':'start-own-turn-after-initial-failure','failureDamage':'1d6','endsAfterSuccesses':3,'requiresConsecutive':False}},'TS Costituzione tredici: fallimento iniziale 3d6 veleno; poi ripeti a inizio turno, d6 a ogni fallimento. Tre successi terminano, senza requisito consecutivo.'),
      ('carrion-crawler-mucus','Carrion Crawler Mucus','Muco di Verme Iena','contact',200,13,{'failureConditions':['poisoned'],'whilePoisoned':['paralyzed'],'durationMinutes':1,'repeat':'end-own-turn-success-ends','harvestFrom':'dead-or-incapacitated-carrion-crawler'},'TS Costituzione tredici o avvelenato e paralizzato un minuto; ripeti a fine turno per terminare. Raccolto da verme iena morto o incapacitato.'),
      ('drow-poison','Drow Poison','Veleno Drow','injury',200,13,{'failureConditions':['poisoned'],'durationHours':1,'failureByAtLeast':{'margin':5,'whilePoisoned':['unconscious'],'wakesOn':['damage','another-creature-action-shake']},'usualManufacture':'drow-far-from-sunlight'},'TS Costituzione tredici o avvelenato un’ora. Fallimento di almeno cinque aggiunge incoscienza: danno o azione altrui per scuotere risveglia, senza annullare veleno.'),
      ('essence-of-ether','Essence of Ether','Essenza di Etere','inhaled',300,15,{'failureConditions':['poisoned'],'whilePoisoned':['unconscious'],'durationHours':8,'wakesOn':['damage','another-creature-action-shake']},'TS Costituzione quindici o avvelenato e incosciente otto ore; danno o azione altrui per scuotere risveglia.'),
      ('malice','Malice','Malizia','inhaled',250,15,{'failureConditions':['poisoned'],'whilePoisoned':['blinded'],'durationHours':1},'TS Costituzione quindici o avvelenato un’ora e accecato mentre avvelenato.'),
      ('midnight-tears','Midnight Tears','Lacrime di Mezzanotte','ingested',1500,17,{'onset':'next-stroke-of-midnight-unless-neutralized-before','failureDamage':'9d6','successDamage':'half'},'Nessun effetto fino a mezzanotte, se non neutralizzato: TS Costituzione diciassette, 9d6 veleno dimezzati con successo.'),
      ('oil-of-taggit','Oil of Taggit','Olio di Taggit','contact',400,13,{'failureConditions':['poisoned'],'whilePoisoned':['unconscious'],'durationHours':24,'wakesOn':['damage']},'TS Costituzione tredici o avvelenato e incosciente ventiquattro ore; si risveglia subendo danni. Non è prevista la sola azione per scuotere.'),
      ('pale-tincture','Pale Tincture','Tintura Pallida','ingested',250,16,{'failureDamage':'1d6','failureConditions':['poisoned'],'successDamage':'none','repeat':{'intervalHours':24,'failureDamage':'1d6','endsAfterSuccesses':7,'requiresConsecutive':False},'damageFromThisPoisonCannotBeHealedUntilEnded':True},'TS Costituzione sedici o d6 veleno e avvelenato. Ripeti ogni ventiquattro ore con d6 per fallimento; sette successi terminano. Questi danni non guariscono con alcun mezzo finché non termina.'),
      ('purple-worm-poison','Purple Worm Poison','Veleno di Verme Purpureo','injury',2000,19,{'failureDamage':'12d6','successDamage':'half','harvestFrom':'dead-or-incapacitated-purple-worm'},'Da verme purpureo morto o incapacitato: TS Costituzione diciannove, 12d6 veleno dimezzati con successo.'),
      ('serpent-venom','Serpent Venom','Veleno di Serpente','injury',200,11,{'failureDamage':'3d6','successDamage':'half','harvestFrom':'dead-or-incapacitated-giant-poisonous-snake'},'Da serpente velenoso gigante morto o incapacitato: TS Costituzione undici, 3d6 veleno dimezzati con successo.'),
      ('torpor','Torpor','Torpore','ingested',600,15,{'failureConditions':['poisoned'],'whilePoisoned':['incapacitated'],'durationHoursDice':'4d6'},'TS Costituzione quindici o avvelenato e incapacitato per 4d6 ore.'),
      ('truth-serum','Truth Serum','Siero della Verità','ingested',150,11,{'failureConditions':['poisoned'],'durationHours':1,'whilePoisonedEffect':'cannot-knowingly-speak-a-lie','spellAnalogyId':'phb2014:spell:zone-of-truth','spellAnalogyDoesNotReplacePoisonSave':True},'TS Costituzione undici o avvelenato un’ora; in tale stato non può mentire consapevolmente. Il paragone con Zona di Verità non sostituisce il TS del veleno.'),
      ('wyvern-poison','Wyvern Poison','Veleno di Viverna','injury',1200,15,{'failureDamage':'7d6','successDamage':'half','harvestFrom':'dead-or-incapacitated-wyvern'},'Da viverna morta o incapacitata: TS Costituzione quindici, 7d6 veleno dimezzati con successo.'),
    ]
    result=[]
    for i,n,it,delivery,cost,dc,effect,summary in poisons:
        e=record('rule','poison-'+i,n,it,[258,259],{'ruleType':'poison','delivery':delivery,'suggestedCostGPPerDose':cost,'doseQuantity':1,'saveAbility':'constitution','saveDC':dc,'damageType':'poison','effect':effect},summary,book='dmg')
        e['relations']={'deliveryRuleId':'dmg2014:rule:poison-delivery'}
        result.append(e)
    result.append(record('rule','poison-delivery','Poison Types and Harvesting','Uso e Raccolta dei Veleni',[258,259],{
      'types':{'contact':{'trigger':'exposed-skin-touches','potentUntil':['touched','washed-off']},'ingested':{'trigger':'swallow-entire-dose','delivery':['food','liquid'],'partialDose':'DM-may-reduce-effect-no-fixed-rule'},'inhaled':{'trigger':'released-in-five-ft-cube','cubeSideFt':5,'cloudDissipates':'immediately','holdingBreathProtects':False},'injury':{'trigger':'piercing-or-slashing-damage-from-coated-object','potentUntil':['delivered-through-wound','washed-off']}},
      'harvesting':{'requires':'dead-or-incapacitated-poisonous-creature','minutesDice':'1d6','ability':'intelligence','skill':'nature','DC':20,'kitProficiencyIfNoNature':'poisoners-kit','successDoses':1,'failureDoses':0,'failureByFiveOrMore':'exposed-to-creatures-poison'},
      'crafting':{'basicPoison':'PHB-crafting-with-poisoners-kit-proficiency','otherPoisons':'DM-discretion-ingredients-may-require-adventure'},'prices':'suggested-single-dose-not-guaranteed-availability'
    },'Contatto solo pelle esposta, ingerito dose intera, inalato cubo cinque piedi anche trattenendo respiro, ferita richiede danno perforante o tagliente. Raccolta d6 minuti da creatura morta o incapacitata: Intelligenza Natura venti, competenza strumenti se manca Natura; successo una dose, fallimento di cinque espone. Prezzi suggeriti, disponibilità del DM.',book='dmg'))
    # The local DMG already prints the revised delivery wording: confirmation, not an invented original/erratum conflict.
    delivery=result[-1]
    delivery['interpretations'].append({'field':'types','kind':'source-comparison','method':'Local DMG PDF 258 already agrees with DMG-Errata.pdf PDF 2; no differing first-print wording inferred.'})
    diseases=[
      ('cackle-fever','Cackle Fever','Febbre del Riso',{'targets':['humanoid'],'immune':['gnome'],'onsetHoursDice':'1d4','exhaustionLevels':1,'exhaustionCannotBeRemovedUntilCured':True,'stress':{'examples':['combat','damage','fear','nightmare'],'saveDC':13,'failureDamage':'1d10-psychic','failureCondition':'incapacitated','durationMinutes':1,'repeat':'end-own-turn-success-ends'},'contagion':{'trigger':'humanoid-starts-own-turn-within-ten-ft-of-infected-creature-laughing','saveDC':10,'failure':'infected','successImmunityToThisCreatureHours':24},'longRest':{'initialDC':13,'success':'subtract-1d6-from-rest-and-stress-save-DCs','endsAtDC':0,'afterFailedSaves':3,'failureConsequence':'indefinite-madness','requiresConsecutive':False}},'Umanoidi salvo gnomi: dopo d4 ore esaurimento persistente. Stress TS tredici o d10 psichici e incapacità un minuto, ripetuto a fine turno. Riso contagioso entro dieci a inizio turno, TS dieci; successo immunità alla singola fonte ventiquattro ore. Riposo lungo TS tredici ridotto d6 per successo fino a zero e guarigione; tre fallimenti portano follia indefinita.'),
      ('sewer-plague','Sewer Plague','Peste delle Fogne',{'targets':['humanoid'],'exposure':['bite-from-carrier','contact-contaminated-filth'],'infectionSaveDC':11,'onsetDaysDice':'1d4','exhaustionLevels':1,'hitDiceHealingMultiplier':0.5,'longRestHPRecovery':0,'longRest':{'saveDC':11,'failureExhaustionChange':1,'successExhaustionChange':-1,'successCuresIfExhaustionBelow':1}},'Contatto con rifiuti infetti o morso del portatore: TS Costituzione undici. Dopo d4 giorni un esaurimento, metà guarigione dei dadi vita e nessun PF dal riposo lungo. A fine riposo TS undici, fallimento aumenta esaurimento, successo lo riduce; sotto uno dopo successo guarisce.'),
      ('sight-rot','Sight Rot','Marciume della Vista',{'targets':['beast','humanoid'],'exposure':'drink-tainted-water','infectionSaveDC':15,'onsetDays':1,'initialSightAttackAndCheckPenalty':-1,'afterEachLongRestPenaltyChange':-1,'blindAtPenalty':-5,'restoreSightSpellExamples':['phb2014:spell:lesser-restoration','phb2014:spell:heal'],'eyebright':{'requires':'herbalism-kit-proficiency-and-rare-flower','hoursPerDose':1,'application':'eyes-before-long-rest','oneDose':'prevents-worsening-after-that-rest','dosesToCure':3}},'Acqua contaminata: bestia o umanoide TS Costituzione quindici. Dopo un giorno attacchi e prove visive meno uno; ogni riposo peggiora fino a meno cinque e cecità. Eufrasia, competenza erborista e un’ora producono dose: prima del riposo blocca peggioramento, tre dosi curano. Vista recuperabile con magie indicate.'),
    ]
    for i,n,it,effect,summary in diseases:
        e=record('rule','disease-'+i,n,it,258,{'ruleType':'disease','saveAbility':'constitution','effect':effect},summary,book='dmg')
        if i=='cackle-fever':e['relations']={'madnessRuleId':'dmg2014:rule:madness'}
        result.append(e)
    result.append(madness())
    for e in result:e['sources'][0]['verification']='read-local-render'
    return [*result,*environment_hazards(),*trap_rules(),*dungeon_hazards()]


def dungeon_hazards():
    rows=[
      ('dungeon-doors','Dungeon doors','Porte dei dungeon',[104,105],
       {'stuckDoorCheck':'strength-DC-set-by-DM','lockedDoorPick':{'ability':'dexterity','requires':['thieves-tools','thieves-tools-proficiency'],'dc':'DM'},
        'otherOpeningMethods':['strength-force','damage-object','knock-or-similar'],
        'barredDoor':'action-lift-bar-from-barred-side-no-lock-to-pick','secretDoorDetection':'passive-or-active-wisdom-perception-DM-DC',
        'secretDoorOpeningMechanism':'intelligence-investigation-if-not-obvious-DM-DC','concealedDoor':'usually-no-check-if-revealed-by-looking-in-right-place',
        'portcullisWinchActivation':'action','portcullisForce':'strength-check-DC-by-DM-size-weight-thickness'},
       'Porte bloccate: Forza; serrature: Destrezza con arnesi da scasso competenti. Sbarre si sollevano dal lato interno con azione. Percezione individua porte segrete e Investigazione può spiegarne il meccanismo; una porta semplicemente coperta si rivela normalmente senza tiro. Verricello di saracinesca: azione.'),
      ('dungeon-hazard-detection','Detecting dungeon hazards','Individuare pericoli nei dungeon',[106],
       {'visibleHazard':'no-check','hiddenHazard':'DM-check','identifyBenignLookingHazard':{'ability':'intelligence','skill':'nature','dc':'DM'},'severity':'compare-trap-damage-to-party-level'},
       'Un pericolo visibile non richiede prova; uno nascosto o una muffa dall’aspetto innocuo può richiedere individuazione o Intelligenza Natura con CD del DM.'),
      ('brown-mold','Brown mold','Muffa marrone',[106],
       {'ruleType':'environmental-hazard','typicalPatchSquareFt':10,'frigidRadiusFt':30,'trigger':'first-move-within-five-ft-per-turn-or-start-own-turn-there',
        'save':{'ability':'constitution','dc':12},'damage':{'average':22,'dice':'4d10','type':'cold'},'successDamage':'half',
        'fireImmune':True,'fireSourceWithinFt':5,'fireExpansion':'additional-ten-ft-square-centered-on-fire-source',
        'destroyedBy':'effect-dealing-cold-damage'},
       'Muffa di solito larga dieci piedi, gelo entro trenta. Entrare per la prima volta nel turno entro cinque piedi o iniziare lì: Costituzione dodici, 4d10 freddo dimezzati con successo. Il fuoco la espande anziché danneggiarla; un effetto di danno da freddo la distrugge.'),
      ('green-slime','Green slime','Melma verde',[106],
       {'ruleType':'environmental-hazard','patchSquareFt':5,'blindsightFt':30,'dropsWhen':'movement-below','otherMovement':False,
        'avoidDrop':{'requiresAwareOfSlime':True,'ability':'dexterity','dc':10},'ifUnaware':'cannot-avoid-drop',
        'creatureContactDamage':{'average':5,'dice':'1d10','type':'acid'},'repeat':'start-own-turn-until-scraped-off-or-destroyed',
        'woodMetalDamagePerRound':{'average':11,'dice':'2d10','type':'acid'},'nonmagicalWoodMetalScraper':'destroyed',
        'destroyedBy':['sunlight','disease-curing-effect','cold-damage','fire-damage','radiant-damage']},
       'Melma di cinque piedi, vista cieca trenta; cade sui movimenti sottostanti. Chi la conosce può evitarla con Destrezza dieci. Contatto infligge d10 acido e lo ripete a inizio turno; legno e metallo subiscono 2d10 per round e attrezzi non magici usati per raschiarla vengono distrutti. Luce solare, cura malattie e danno freddo, fuoco o radiante la eliminano.'),
      ('dungeon-webs','Dungeon webs','Ragnatele dei dungeon',[106],
       {'ruleType':'environmental-hazard','difficultTerrain':True,'trigger':'first-entry-per-turn-or-start-own-turn',
        'save':{'ability':'dexterity','dc':12},'failureCondition':'restrained','escapeActivation':'action',
        'escapeChecks':[{'ability':'strength','skill':'athletics','dc':12},{'ability':'dexterity','skill':'acrobatics','dc':12}],
        'per10FtCube':{'AC':10,'HP':15,'vulnerability':['fire'],'immunities':['bludgeoning','piercing','psychic']}},
       'Terreno difficile; entrare per la prima volta nel turno o iniziare lì richiede Destrezza dodici o trattiene. Azione per Atletica o Acrobazia dodici. Ogni cubo dieci piedi ha CA dieci, quindici PF, vulnerabilità al fuoco e immunità a contundente, perforante e psichico; distinto da Ragnatela incantesimo.'),
      ('yellow-mold','Yellow mold','Muffa gialla',[106],
       {'ruleType':'environmental-hazard','patchSquareFt':5,'trigger':'touch','sporeCubeFt':10,
        'save':{'ability':'constitution','dc':15},'failureDamage':{'average':11,'dice':'2d10','type':'poison'},'failureCondition':'poisoned','durationMinutes':1,
        'whilePoisoned':{'trigger':'start-own-turn','damage':{'average':5,'dice':'1d10','type':'poison'}},
        'repeatSave':'end-own-turn-success-ends','destroyedBy':['sunlight','any-fire-damage']},
       'Toccare la muffa di cinque piedi libera spore in un cubo di dieci. Costituzione quindici o 2d10 veleno e avvelenato un minuto; durante questo stato d10 a inizio turno, con nuovo TS a fine turno. Sole o qualsiasi danno da fuoco distrugge la chiazza.'),
    ]
    return [record('rule',i,n,it,pages,{'requiresDMAdjudication':True,**m},summary,book='dmg') for i,n,it,pages,m,summary in rows]


def environment_hazards():
    rows=[
      ('weather','Weather','Tempo atmosferico',[110],
       {'tables':{'temperature':[{'low':1,'high':14,'change':'normal-for-season'},{'low':15,'high':17,'changeFahrenheitDice':'1d4','multiplier':-10},{'low':18,'high':20,'changeFahrenheitDice':'1d4','multiplier':10}],
           'wind':[{'low':1,'high':12,'intensity':'none'},{'low':13,'high':17,'intensity':'light'},{'low':18,'high':20,'intensity':'strong'}],
           'precipitation':[{'low':1,'high':12,'intensity':'none'},{'low':13,'high':17,'intensity':'light'},{'low':18,'high':20,'intensity':'heavy'}]},
        'die':20,'DMChoosesOrRolls':True,'adjustForTerrainAndSeason':True},
       'Il DM sceglie o tira separatamente temperatura, vento e precipitazioni; il cambiamento termico è d4 volte dieci gradi Fahrenheit, adattato a stagione e terreno.'),
      ('extreme-cold','Extreme cold','Freddo estremo',[111],
       {'temperatureMaximumFahrenheit':0,'exposureSave':{'ability':'constitution','dc':10,'timing':'end-each-hour','failureExhaustionLevels':1},
        'automaticSuccessIf':['cold-resistance','cold-immunity','cold-weather-gear','natural-cold-climate-adaptation']},
       'A zero Fahrenheit o meno, esposizione: TS Costituzione dieci ogni ora o un indebolimento. Protezioni invernali, adattamento naturale e resistenza o immunità al freddo danno successo automatico.'),
      ('extreme-heat','Extreme heat','Caldo estremo',[111],
       {'temperatureMinimumFahrenheit':100,'requires':['exposure','no-access-to-drinkable-water'],
        'save':{'ability':'constitution','timing':'end-each-hour','firstHourDC':5,'DCPerAdditionalHour':1,'failureExhaustionLevels':1},
        'disadvantageIf':['medium-armor','heavy-armor','heavy-clothing'],'automaticSuccessIf':['fire-resistance','fire-immunity','natural-hot-climate-adaptation']},
       'A cento Fahrenheit o più, chi è esposto senza acqua potabile tira Costituzione ogni ora: CD cinque, poi uno in più per ora; fallire indebolisce. Armature medie/pesanti e vestiti pesanti danno svantaggio; adattamento o difese dal fuoco danno successo automatico.'),
      ('strong-wind','Strong wind','Vento forte',[111],
       {'disadvantage':['ranged-weapon-attacks','wisdom-perception-hearing'],'extinguishesOpenFlames':True,'dispersesFog':True,
        'nonmagicalFlying':'must-land-at-end-own-turn-or-fall','desertSandstorm':'DM-may-impose-sight-perception-disadvantage'},
       'Vento forte penalizza armi a distanza e percezione uditiva, spegne fiamme scoperte e disperde nebbia. Nel volo non magico bisogna atterrare a fine turno o cadere; sabbia può ostacolare la vista.'),
      ('heavy-precipitation','Heavy precipitation','Precipitazioni intense',[111],
       {'rainAndSnow':'lightly-obscured','disadvantage':['wisdom-perception-sight'],'rainAlso':['extinguishes-open-flames','wisdom-perception-hearing-disadvantage']},
       'Pioggia o neve intense rendono l’area leggermente oscurata e penalizzano la percezione visiva. La pioggia penalizza anche l’udito e spegne le fiamme scoperte.'),
      ('high-altitude','High altitude','Alta quota',[111],
       {'requiresBreathing':True,'minimumAltitudeFt':10000,'travelHoursMultiplier':2,'acclimationDays':30,
        'acclimationAboveAltitudeFt':20000,'aboveLimitRequiresNativeEnvironment':True},
       'Chi respira e viaggia da diecimila piedi di quota conta ogni ora come due. Trenta giorni permettono acclimatazione; oltre ventimila è possibile soltanto per creature native di quell’ambiente.'),
      ('desecrated-ground','Desecrated ground','Terreno profanato',[111],
       {'undeadStandingHere':'advantage-all-saving-throws','normalSensesDetect':False,
        'detectionSpellId':'phb2014:spell:detect-evil-and-good','purification':{'holyWaterVialSquareSideFt':10,'spellId':'phb2014:spell:hallow','spellAreaOnly':True}},
       'Non rilevabile con sensi normali; Individuazione del Bene e del Male lo rivela. Non morti sul terreno hanno vantaggio a tutti i TS. Una fiala d’acqua santa purifica un quadrato di dieci piedi; Santificare purifica la propria area.'),
      ('frigid-water','Frigid water','Acqua gelida',[111],
       {'safeMinutes':'constitution-score','eachAdditionalMinuteSave':{'ability':'constitution','dc':10,'failureExhaustionLevels':1},
        'automaticSuccessIf':['cold-resistance','cold-immunity','natural-ice-cold-water-adaptation']},
       'Immersione sicura per minuti pari al punteggio di Costituzione, poi TS dieci ogni minuto o indebolimento. Adattamento all’acqua gelida e difese dal freddo danno successo automatico; i soli abiti invernali non sono elencati.'),
      ('quicksand','Quicksand','Sabbie mobili',[111],
       {'typicalSquareSideFt':10,'typicalDepthFt':10,'entrySinkingFt':'1d4+1','entryCondition':'restrained','sinkingAtStartOwnTurnFt':'1d4',
        'selfEscape':{'activation':'action','ability':'strength','dc':'10+feet-sunk','requiresNotFullySubmerged':True},
        'helpEscape':{'activation':'action','ability':'strength','dc':'5+target-feet-sunk','requiresWithinReach':True},'fullySubmerged':'cannot-breathe-use-PHB-suffocation'},
       'Entrando si affonda d4 più uno piedi e si è trattenuti; a inizio turno altro d4. Azione e prova Forza: CD dieci più profondità per liberarsi, cinque più profondità per soccorrere qualcuno entro portata. Completamente sommersi non si respira.'),
      ('razorvine','Razorvine','Vegetazione tagliente',[111],
       {'wallDimensionsFt':{'height':10,'width':10,'thickness':5},'armorClass':11,'hitPoints':25,'damageImmunities':['bludgeoning','piercing','psychic'],
        'firstDirectContactEachTurn':{'saveAbility':'dexterity','saveDC':10,'failureDamage':{'average':5,'dice':'1d10','type':'slashing'},'successDamage':'none'},'spottingCheckRequired':False},
       'Siepe tagliente: CA undici, venticinque PF, immune ai danni indicati. Al primo contatto diretto del turno TS Destrezza dieci o d10 taglienti; il contatto non infligge danno se il tiro riesce.'),
      ('slippery-ice','Slippery ice','Ghiaccio scivoloso',[111],
       {'difficultTerrain':True,'firstMoveOntoEachTurn':{'checkAbility':'dexterity','checkSkill':'acrobatics','dc':10,'failureCondition':'prone'},'spottingCheckRequired':False},
       'Terreno difficile; entrando per la prima volta nel turno serve Destrezza (Acrobazia) dieci o si cade proni. È una prova, non un tiro salvezza.'),
      ('thin-ice','Thin ice','Ghiaccio sottile',[112],
       {'squareSideFt':10,'weightTolerance':{'dice':'3d10','multiplierLb':10},'breaksWhen':'total-weight-exceeds-tolerance','allCreaturesOnBrokenArea':'fall-through'},
       'Ogni quadrato di dieci piedi regge 3d10 volte dieci libbre; superare, non eguagliare, quel peso rompe il ghiaccio e fa precipitare tutte le creature sull’area.'),
      ('foraging','Foraging','Raccolta di cibo e acqua',[112],
       {'allowedPaces':['normal','slow'],'checkAbility':'wisdom','checkSkill':'survival','dcByAvailability':{'abundant':10,'limited':15,'very-little':20},
        'eachCharacterChecksSeparately':True,'failureFindsNothing':True,'successFoodLb':'1d6+wisdomModifier','successWaterGallons':'separate-1d6+wisdomModifier','minimumYieldNotStated':True},
       'A passo normale o lento, ciascun raccoglitore tira Sopravvivenza separatamente. CD dieci/quindici/venti secondo disponibilità; riuscire trova d6 più Saggezza libbre di cibo e un tiro separato per galloni d’acqua. Nessun minimo di raccolto inventato.'),
      ('creature-food-water','Creature food and water','Sostentamento delle creature',[112],
       {'foodLbAndWaterGallonsPerDay':{'Tiny':0.25,'Small':1,'Medium':1,'Large':4,'Huge':16,'Gargantuan':64},'hotWeatherWaterMultiplier':2,'PHBCharacterRequirementsSeparate':True},
       'Fabbisogno quotidiano di creature per taglia: un quarto, uno, uno, quattro, sedici o sessantaquattro libbre di cibo e altrettanti galloni d’acqua; col caldo acqua doppia. Le regole PHB dei personaggi restano distinte.'),
      ('wilderness-navigation','Wilderness navigation','Orientamento nelle terre selvagge',[112,113],
       {'checkAbility':'wisdom','checkSkill':'survival','followingPath':'normally-no-lost-risk',
        'dcByTerrain':{'forest-jungle-swamp-mountains-or-overcast-open-sea-without-land':15,'arctic-desert-hills-or-clear-open-sea-without-land':10,'grassland-meadow-farmland':5},
        'paceModifiers':{'slow':5,'normal':0,'fast':-5},'advantageIf':['accurate-map','visible-sun-or-stars'],
        'failure':'wrong-direction-and-lost','retryAfterHoursDice':'1d6'},
       'Il navigatore tira Sopravvivenza con CD cinque, dieci o quindici secondo il terreno. Passo lento più cinque, veloce meno cinque; mappa accurata o astri visibili danno vantaggio. Fallire devia il gruppo, ripetizione dopo d6 ore.')]
    result=[]
    for i,name,it,pages,effect,summary in rows:
        e=record('rule',i,name,it,pages,{'ruleType':'environment-hazard','effect':effect,'requiresDMEnvironment':True},summary,book='dmg')
        if i in ['weather','foraging','creature-food-water','wilderness-navigation']:e['sources'][0]['verification']='read-local-render'
        result.append(e)
    return result


def madness():
    short=[
      (1,20,{'condition':'paralyzed','endsOn':'any-damage'},'Paralizzato; termina con qualsiasi danno.'),
      (21,30,{'condition':'incapacitated','behavior':['scream','laugh','weep']},'Incapacitato, grida, ride o piange.'),
      (31,40,{'condition':'frightened','eachRound':'use-action-and-movement-to-flee-fear-source'},'Spaventato, usa azione e movimento per fuggire dalla fonte.'),
      (41,50,{'cannot':['normal-speech','spellcasting']},'Farfuglia senza poter parlare normalmente o lanciare incantesimi.'),
      (51,60,{'eachRoundAction':'attack-nearest-creature'},'Ogni round usa azione per attaccare la creatura più vicina.'),
      (61,70,{'hallucinations':True,'disadvantage':['ability-checks']},'Allucinazioni e svantaggio alle prove di caratteristica.'),
      (71,75,{'behavior':'obey-any-order-not-obviously-self-destructive'},'Segue ordini di chiunque salvo evidente autodistruzione.'),
      (76,80,{'behavior':'urge-to-eat-strange-substances'},'Impulso a mangiare sostanze insolite.'),
      (81,90,{'condition':'stunned'},'Stordito.'),(91,100,{'condition':'unconscious'},'Incosciente.'),
    ]
    long=[
      (1,10,{'behavior':'compulsively-repeat-specific-activity'},'Ripete compulsivamente una certa attività.'),
      (11,20,{'hallucinations':True,'disadvantage':['ability-checks']},'Allucinazioni e svantaggio alle prove di caratteristica.'),
      (21,30,{'paranoia':True,'disadvantage':['wisdom-checks','charisma-checks']},'Paranoia, svantaggio alle prove di Saggezza e Carisma.'),
      (31,40,{'revulsion':'usually-madness-source','spellAnalogy':'antipathy-effect','spellId':'phb2014:spell:antipathy-sympathy','openInterpretation':'repeated-save-negative-scope'},'Repulsione come effetto antipatia; resta distinta la questione aperta sui TS ripetuti della magia.'),
      (41,45,{'behavior':'imagines-effects-of-DM-chosen-potion','grantsRealPotionEffect':False},'Immagina di essere sotto effetto di una pozione scelta; non la ottiene realmente.'),
      (46,55,{'luckyCharm':'person-or-object','disadvantageBeyondFt':30,'disadvantage':['attack-rolls','ability-checks','saving-throws']},'Amuleto o persona fortunata; oltre trenta piedi svantaggio a tiri di attacco, prove e TS.'),
      (56,65,{'conditionChancePercent':{'blinded':25,'deafened':75}},'Accecato nel venticinque percento dei casi, altrimenti assordato.'),
      (66,75,{'disadvantage':['attack-rolls','ability-checks','saving-throws'],'onlyInvolvingAbilities':['strength','dexterity']},'Tremori: svantaggio a tiri di attacco, prove e TS che coinvolgono Forza o Destrezza.'),
      (76,85,{'amnesia':'other-people-and-events-before-madness','retains':['identity','racial-traits','class-features']},'Amnesia di persone ed eventi precedenti; conserva identità, tratti razziali e privilegi.'),
      (86,90,{'trigger':'takes-damage','saveAbility':'wisdom','saveDC':15,'failureSpellId':'phb2014:spell:confusion','failureDurationMinutes':1},'Dopo danno TS Saggezza quindici o effetto da TS fallito contro Confusione per un minuto.'),
      (91,95,{'cannot':['speech']},'Perde la capacità di parlare.'),
      (96,100,{'condition':'unconscious','damageOrJostlingCannotWake':True},'Incosciente; scuotere o infliggere danno non risveglia.'),
    ]
    indefinite=[(1,15,'Si affida all’ubriachezza per sentirsi lucido.'),(16,25,'Trattiene ogni cosa trovata.'),(26,30,'Imita identità, aspetto e modi di una persona nota.'),(31,35,'Mente ed esagera per attirare interesse.'),(36,45,'Insegue un obiettivo ignorando ogni altra cosa.'),(46,50,'È indifferente a ciò che lo circonda.'),(51,55,'Sente di essere continuamente giudicato.'),(56,70,'Si considera superiore a tutti in ogni aspetto.'),(71,80,'Crede di essere braccato e sorvegliato da potenti nemici.'),(81,85,'Si fida solo di un amico che soltanto lui può vedere.'),(86,95,'Ride delle situazioni serie.'),(96,100,'Prova piacere nell’uccidere persone.')]
    tables={'short':{'duration':'1d10-minutes','rows':[{'minimum':a,'maximum':b,'effect':v,'summaryIt':s} for a,b,v,s in short]},'long':{'duration':'1d10-times-ten-hours','rows':[{'minimum':a,'maximum':b,'effect':v,'summaryIt':s} for a,b,v,s in long]},'indefinite':{'duration':'until-cured','rows':[{'minimum':a,'maximum':b,'effect':{'characterFlaw':s},'summaryIt':s} for a,b,s in indefinite]}}
    return record('rule','madness','Madness','Follia',[259,260,261],{'requiresDMApproval':True,'optionalSpellReplacement':'DM-may-replace-specific-PHB-insanity-effects-not-automatic','usualSaveAbilities':['wisdom','charisma'],'optionalSanitySaveReplaces':True,'tables':tables,'curing':{'suppressesSpellId':'phb2014:spell:calm-emotions','shortLongCureSpellId':'phb2014:spell:lesser-restoration','indefiniteCureSpellId':'phb2014:spell:greater-restoration','sourceDependentSpellIds':['phb2014:spell:remove-curse','phb2014:spell:dispel-evil-and-good']},'pendingDependencies':['antipathy-long-term-row-repeated-save-interpretation']},'Opzione del DM: follia breve d10 minuti, lunga d10 volte dieci ore, indefinita fino a cura con nuovo difetto. Tabelle d100 distinte. Calmare Emozioni sopprime; Ristorare Inferiore cura breve/lunga, Superiore indefinita; altre magie dipendono dalla fonte. Una riga lunga rinvia all’antipatia ancora interpretativamente aperta.',book='dmg',optional=True,missing=['long-table.antipathy-repeated-save-interpretation'])


def trap_rules():
    framework=record('rule','trap-resolution','Traps in play','Risoluzione delle trappole',[121,122,123],
        {'ruleType':'trap-framework','requiresDMApproval':True,'types':['mechanical','magical-device','spell-trap'],
         'activeDetection':'wisdom-perception','passingDetection':'passive-wisdom-perception',
         'possibleDisarmSequence':['intelligence-investigation','dexterity-with-thieves-tools'],
         'magicalAlternativeCheck':'intelligence-arcana-same-DC-any-character',
         'dispelMagic':'description-specific-most-not-all-magic-traps','obviousRevealingAction':'no-check-required',
         'DCAndAttackBonusByDanger':{'setback':{'saveDC':[10,11],'attackBonus':[3,5]},'dangerous':{'saveDC':[12,15],'attackBonus':[6,8]},'deadly':{'saveDC':[16,20],'attackBonus':[9,12]}},
         'damageSeverityRuleId':'dmg2014:rule:improvised-damage','complexTraps':'roll-initiative-and-repeat-actions-on-own-turn-as-described'},
        'Il DM definisce innesco, rilevazione, disattivazione ed effetto. Percezione attiva o passiva rileva, Indagare può precedere strumenti da scasso; Arcano è alternativa per trappole magiche. Una manovra evidentemente efficace non richiede tiro. Trappole complesse agiscono in iniziativa.',book='dmg',optional=True)
    framework['sources'][0]['verification']='read-local-render'
    rows=[
      ('collapsing-roof','Collapsing Roof','Soffitto crollante',123,'mechanical',
       {'trigger':'trip-wire-or-action-knock-support-beam','tripWireHeightInches':3,'spotDC':10,
        'disarm':{'ability':'dexterity','tool':'thieves-tools','dc':15,'alternative':'edged-weapon-or-tool-with-disadvantage','failureTriggers':True},
        'effect':{'area':'beneath-unstable-ceiling','saveAbility':'dexterity','saveDC':15,'failureDamage':{'average':22,'dice':'4d10','type':'bludgeoning'},'successDamage':'half','after':'rubble-difficult-terrain'},'visibleBadCeiling':'obvious-collapse-risk'},
       'Filo a tre pollici, Percezione dieci e strumenti Destrezza quindici. Fallire innesca; anche abbattere un sostegno con azione. TS Destrezza quindici per 4d10 contundenti dimezzabili, poi macerie come terreno difficile.'),
      ('falling-net','Falling Net','Rete cadente',123,'mechanical',
       {'trigger':'trip-wire','tripWireHeightInches':3,'spotDC':10,
        'disarm':{'ability':'dexterity','tool':'thieves-tools','dc':15,'alternative':'edged-weapon-or-tool-with-disadvantage','failureTriggers':True},
        'effect':{'squareSideFt':10,'allTargetsCondition':'restrained','saveAbility':'strength','saveDC':10,'failureAdditionalCondition':'prone'},
        'escape':{'activation':'action','ability':'strength','dc':10,'target':'self-or-another-within-reach'},
        'net':{'armorClass':10,'hitPoints':20,'slashingDamageToDestroy5FtSquareSection':5}},
       'Rete su quadrato dieci piedi: tutti trattenuti, anche proni se falliscono Forza dieci. Azione e prova Forza dieci libera sé o qualcuno entro portata. Cinque danni taglienti a CA dieci distruggono una sezione, distinta dai venti PF dell’intera rete.'),
      ('fire-breathing-statue','Fire-Breathing Statue','Statua che sputa fuoco',123,'magical-device',
       {'triggerWeightLb':{'comparison':'greater-than','value':20},'spotDC':15,'magicAuraSchool':'evocation',
        'effect':{'coneLengthFt':30,'saveAbility':'dexterity','saveDC':13,'failureDamage':{'average':22,'dice':'4d10','type':'fire'},'successDamage':'half'},
        'bypass':'wedge-pressure-plate','dispelMagicDC':13,'dispelOutcome':'destroys-trap'},
       'Oltre venti libbre sulla piastra innescano cono trenta piedi, TS Destrezza tredici e 4d10 fuoco dimezzabili. Bloccare la piastra impedisce innesco; Dissolvi Magie CD tredici distrugge la trappola.'),
      ('simple-pit','Simple Pit','Fossa semplice',123,'mechanical',
       {'trigger':'step-on-covered-cloth','spotDC':10,'usualDepthFt':10,'deeperDepthPossible':True,'damage':'PHB-falling-by-actual-depth'},
       'Telo camuffato sopra una buca, CD dieci per rilevarlo. Camminarci fa cadere; di solito dieci piedi ma il DM determina profondità e danno da caduta.'),
      ('hidden-pit','Hidden Pit','Fossa nascosta',123,'mechanical',
       {'trigger':'step-on-trapdoor','detection':{'wisdom-perception':15,'intelligence-investigation-confirmation':15},'usualDepthFtChoices':[10,20],
        'deeperDepthPossible':True,'damage':'PHB-falling-by-actual-depth','bypass':['wedge-cover','arcane-lock-or-similar']},
       'Botola simile al pavimento, Percezione quindici suggerisce la zona non calpestata, Indagare quindici conferma. Solitamente dieci o venti piedi. Un cuneo o magia adatta può mantenerla chiusa.'),
      ('locking-pit','Locking Pit','Fossa con chiusura', [123,124],'mechanical',
       {'inheritsRuleId':'dmg2014:rule:trap-hidden-pit','coverClosesAfterFall':True,
        'openCover':{'ability':'strength','dc':20,'alternative':'smash-with-DM-object-statistics'},
        'insideDisarm':{'ability':'dexterity','tool':'thieves-tools','dc':15,'requires':['reachable-mechanism','can-see']},'possibleHiddenOpeningMechanism':'DM'},
       'Fossa nascosta con botola che si richiude. Forza venti per forzarla oppure romperla con statistiche del DM. Dall’interno Destrezza e strumenti quindici disattivano la molla soltanto se si vede e si raggiunge.'),
      ('spiked-pit','Spiked Pit','Fossa con spuntoni',124,'mechanical',
       {'baseTrapChosenFromRuleIds':['dmg2014:rule:trap-simple-pit','dmg2014:rule:trap-hidden-pit','dmg2014:rule:trap-locking-pit'],
        'additionalToFallingDamage':{'average':11,'dice':'2d10','type':'piercing'},
        'optionalPoisonAfterSpikePiercingDamage':{'saveAbility':'constitution','saveDC':13,'failureDamage':{'average':22,'dice':'4d10','type':'poison'},'successDamage':'half'}},
       'Variante delle fosse: aggiunge 2d10 perforanti al danno da caduta. Se il DM ha avvelenato gli spuntoni, dopo quei danni TS Costituzione tredici per 4d10 veleno dimezzabili.'),
      ('poison-darts','Poison Darts','Dardi avvelenati',124,'mechanical',
       {'triggerWeightLb':{'comparison':'greater-than','value':20},'spotHolesDC':15,'identifyPlate':{'ability':'intelligence','skill':'investigation','dc':15},
        'bypass':['wedge-pressure-plate','plug-dart-holes'],'dartCount':4,
        'eachDart':{'attackBonus':8,'targetSelection':'random-within-ten-ft-of-plate','visionRelevant':False,'noTarget':'no-hit',
            'hitDamage':{'average':2,'dice':'1d4','type':'piercing'},'additionalSave':{'ability':'constitution','dc':15,'failureDamage':{'average':11,'dice':'2d10','type':'poison'},'successDamage':'half'}}},
       'Oltre venti libbre attivano quattro dardi +8, ciascuno verso bersaglio casuale entro dieci piedi senza requisito visivo. Un colpo fa d4 perforanti e TS Costituzione quindici per 2d10 veleno dimezzabili. Piastra bloccata o fori tappati impediscono il tiro.'),
      ('poison-needle','Poison Needle','Ago avvelenato',124,'mechanical',
       {'trigger':'open-without-proper-key-or-failed-lock-picking','needleReachInches':3,'detect':{'ability':'intelligence','skill':'investigation','dc':20},
        'disarm':{'ability':'dexterity','tool':'thieves-tools','dc':15},
        'effect':{'attackRollRequired':False,'automaticDamage':[{'amount':1,'type':'piercing'},{'average':11,'dice':'2d10','type':'poison'}],
            'saveAbility':'constitution','saveDC':15,'failureCondition':'poisoned','durationHours':1,'successfulSavePreventsDamage':False}},
       'Ago entro tre pollici: un perforante e 2d10 veleno automatici, poi Costituzione quindici evita soltanto avvelenato per un’ora. Indagare venti rileva, strumenti Destrezza quindici disarmano; scasso fallito lo attiva.'),
      ('rolling-sphere','Rolling Sphere','Sfera rotolante',124,'mechanical',
       {'triggerWeightLb':{'comparison':'at-least','value':20},'diameterFt':10,'spotDC':15,'identifyPlateOrDoor':{'ability':'intelligence','skill':'investigation','dc':15},
        'bypass':'wedge-pressure-plate','initiativeBonus':8,'movementFtPerTurn':60,'movement':'straight-line; gentle-curves-possible-not-sharp-corners',
        'creatureSpace':'may-cross-as-difficult-terrain','when':'sphere-enters-creature-space-or-creature-enters-moving-sphere-space',
        'saveAbility':'dexterity','saveDC':15,'failureDamage':{'average':55,'dice':'10d10','type':'bludgeoning'},'failureCondition':'prone','successDamage':'none',
        'stopsAt':'wall-or-similar-barrier','slow':{'activation':'action','withinFt':5,'ability':'strength','dc':20,'successSpeedReductionFt':15,'speedZero':'stops-no-longer-threat'}},
       'Da venti libbre incluso, sfera diametro dieci piedi: iniziativa +8, sessanta piedi al turno. Entrando negli spazi mentre rotola: TS Destrezza quindici o 10d10 contundenti e prono, nessun danno su successo. Forza venti con azione entro cinque piedi la rallenta di quindici fino a fermarla.'),
      ('annihilation-sphere','Sphere of Annihilation trap','Trappola della Sfera Annientatrice',124,'magical-device',
       {'mouthDiameterFt':2,'darkness':'magical-impenetrable','detect':{'ability':'intelligence','skill':'arcana','dc':20},
        'magicItemId':'dmg2014:magic-item:sphere-of-annihilation','canControlOrMoveSphere':False,'otherSphereStatistics':'same-as-item'},
       'Bocca oscura di due piedi con sfera annientatrice immobile e incontrollabile, altrimenti come l’oggetto. Arcano venti identifica il pericolo. L’eventuale attrazione magica è una variante separata, non un effetto automatico.')]
    result=[framework]
    for i,name,it,pages,nature,effect,summary in rows:
        e=record('rule','trap-'+i,name,it,pages,{'ruleType':'trap','requiresDMApproval':True,'nature':nature,'effect':effect},summary,book='dmg',optional=True)
        e['sources'][0]['verification']='read-local-render';result.append(e)
    result.append(record('rule','trap-annihilation-sympathy','Sympathy trap variant','Attrazione della trappola annientatrice',124,
        {'ruleType':'trap-variant','requiresDMApproval':True,'baseRuleId':'dmg2014:rule:trap-annihilation-sphere',
         'spellId':'phb2014:spell:antipathy-sympathy','aspect':'sympathy','dispelMagicDC':18,'dispelRemoves':'attraction-enchantment-not-sphere'},
        'Variante del DM: attrazione come Simpatia per creature specificate; Dissolvi Magie CD diciotto elimina l’attrazione, non la sfera. Conserva la questione interpretativa del tiro ripetuto dell’incantesimo.',book='dmg',optional=True,
        missing=['sympathy-repeat-save-scope-interpretation']))
    return result
