"""PHB PDF 90–94 read; progression 91 and archetypes 94 inspected on renders.

PH-Errata PDF 2 changes companion commands separately in errata.py.
"""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:ranger'
HUNTER='phb2014:subclass:hunter'
STAGES={3:("Hunter's Prey",'Preda del Cacciatore'),7:('Defensive Tactics','Tattiche Difensive'),
        11:('Multiattack','Multiattacco'),15:("Superior Hunter's Defense",'Difesa Superiore del Cacciatore')}
OPTIONS=[
 (3,'Colossus Slayer','Uccisore di Colossi',{'trigger':'weapon-attack-hits-creature-below-its-hit-point-maximum','additionalDamage':'1d8','maximumUses':'once-per-turn'},'Un colpo con un’arma contro una creatura già ferita aggiunge 1d8, una sola volta per turno, anche fuori dal tuo turno.'),
 (3,'Giant Killer','Uccisore di Giganti',{'trigger':'Large-or-larger-creature-within-5-ft-hits-or-misses-self-with-an-attack','requires':'see-triggering-creature','activation':'reaction','attack':'immediately-attack-triggering-creature'},'Se una creatura Grande o più grande entro cinque piedi ti colpisce o manca con un attacco e la vedi, puoi reagire attaccandola subito.'),
 (3,'Horde Breaker','Spezzare l’Orda',{'trigger':'make-weapon-attack-on-own-turn','maximumUses':'once-per-own-turn','additionalAttack':'same-weapon-against-different-creature-within-5-ft-of-original-target-and-weapon-range'},'Una volta nel tuo turno, effettuando un attacco con arma puoi attaccare con la stessa arma un altro bersaglio entro cinque piedi dal primo e a portata.'),
 (7,'Escape the Horde','Sfuggire all’Orda',{'enemyOpportunityAttackRolls':'disadvantage'},'Gli attacchi di opportunità contro di te hanno svantaggio.'),
 (7,'Multiattack Defense','Difesa dal Multiattacco',{'trigger':'creature-hits-self-with-attack','armorClassBonus':4,'against':'subsequent-attacks-from-same-creature','expires':'end-of-current-turn'},'Dopo che una creatura ti colpisce, ottieni CA +4 contro i suoi attacchi successivi fino alla fine del turno corrente.'),
 (7,'Steel Will','Volontà d’Acciaio',{'saveAdvantageAgainst':'frightened'},'Hai vantaggio ai TS contro l’essere spaventato.'),
 (11,'Volley','Raffica',{'activation':'action','attack':'ranged-weapon-attack-against-any-number-of-creatures','targetsWithinFtOfPoint':10,'pointMust':'visible-and-within-weapon-range','requiresAmmunitionForEachTarget':True,'separateAttackRollPerTarget':True,'usesAttackAction':False},'Con un’azione attacchi a distanza creature entro dieci piedi da un punto visibile a portata dell’arma. Servono munizioni e un tiro distinto per ogni bersaglio; non è l’azione Attaccare.'),
 (11,'Whirlwind Attack','Attacco Turbinante',{'activation':'action','attack':'melee-attack-against-any-number-of-creatures-within-5-ft-of-self','separateAttackRollPerTarget':True,'usesAttackAction':False},'Con un’azione effettui un attacco in mischia contro ciascuna creatura scelta entro cinque piedi, tirando separatamente; non è l’azione Attaccare.'),
 (15,'Evasion','Elusione',{'trigger':'Dexterity-save-to-take-half-damage','successfulSaveDamageMultiplier':0,'failedSaveDamageMultiplier':0.5},'Quando un TS Destrezza normalmente dimezza il danno, il successo lo annulla e il fallimento lo dimezza.'),
 (15,'Stand Against the Tide','Resistere alla Marea',{'trigger':'hostile-creature-misses-self-with-melee-attack','activation':'reaction','forces':'repeat-same-attack-against-chosen-other-creature','excludedTarget':'attacker-itself'},'Quando un nemico ti manca in mischia, puoi reagire costringendolo a ripetere lo stesso attacco contro un’altra creatura scelta, diversa dall’attaccante.'),
 (15,'Uncanny Dodge','Schivata Prodigiosa',{'trigger':'visible-attacker-hits-self-with-attack','activation':'reaction','attackDamageMultiplier':0.5},'Puoi reagire a un attacco che ti colpisce da un attaccante visibile per dimezzarne il danno.'),
]


def apply_ranger_reviews(entities):
    by_id={e['id']:e for e in entities};added=[]
    for tier,name,it,effect,summary in OPTIONS:
        origin=f'phb2014:subclass-feature:hunter-{tier}-'+slug(STAGES[tier][0])
        e=record('class-option','hunter-'+slug(name),name,it,94,
           {'optionType':'hunter-choice','tier':tier,'prerequisites':{},'effect':effect,
            'selectionOrigins':[{'originId':origin,'classId':CLASS,'minimumClassLevel':tier,'subclassId':HUNTER}]},summary)
        e['relations']={'classId':CLASS,'subclassId':HUNTER,'parentFeatureId':origin};added.append(e)
    for tier,(name,it) in STAGES.items():
        e=record('subclass-feature',f'hunter-{tier}-'+slug(name),name,it,94,
          {'level':tier,'effect':{'choose':1,'choiceIds':[e['id'] for e in added if e['kind']=='class-option' and e['mechanics']['tier']==tier]}},
          'Scegli un solo privilegio fra le opzioni di questo livello; le altre opzioni non vengono concesse automaticamente.')
        e['relations']={'classId':CLASS,'subclassId':HUNTER};added.append(e)
    companion={'eligible':{'type':'beast','maximumSize':'Medium','maximumCR':0.25,'previouslySeenRequired':False,'flightOrSwimRestriction':False},
       'addCharacterProficiencyBonusTo':['armor-class','attack-rolls','damage-rolls','proficient-saving-throws','proficient-skills'],
       'maximumHitPoints':'max(normal-maximum,4*rangerLevel)','initiative':'ranger-initiative','moveCommand':'verbal-on-own-turn-no-action',
       'actionCommand':['Attack','Dash','Disengage','Dodge','Help'],'uncommandedAction':'none',
       'reactionNeedsCommand':'not-explicitly-stated','independentWhenIncapacitatedOrAbsent':'not-stated','hitDiceShortRestExplicit':False,
       'rangerExtraAttackWhenCommandingAttack':'one-weapon-attack-by-ranger-if-has-Extra-Attack',
       'favoredTerrainStealthAtNormalPaceWhenParty':'only-ranger-and-beast',
       'replacementAfterDeath':{'bondingHours':8,'requires':'another-nonhostile-beast','sameOrDifferentKind':True}}
    rows=[
      (3,"Ranger's Companion",'Compagno Animale',companion,'Scegli una bestia Media o più piccola, GS fino a un quarto; aggiunge la tua competenza a CA, attacchi, danni e competenze elencate. PF massimi almeno quattro per livello da ranger. Prima stampa: comando delle azioni con la tua azione, inclusa Schivata; senza comando non agisce. Il rimpiazzo dopo morte richiede otto ore con una bestia non ostile.'),
      (7,'Exceptional Training','Addestramento Eccezionale',{'activation':'bonus-action-on-own-turn','requires':'beast-does-not-attack-this-turn','commandActions':['Dash','Disengage','Dodge','Help'],'attacksMagicalForNonmagicalResistanceOrImmunity':False},'Nel tuo turno, se la bestia non attacca, puoi comandare Scatto, Disimpegno, Schivata o Aiuto con azione bonus. Le errata rimuovono Schivata e aggiungono attacchi considerati magici contro resistenze e immunità.'),
      (11,'Bestial Fury','Furia Bestiale',{'trigger':'command-beast-to-take-Attack-action','beastAttacks':2,'mayChoosePrintedMultiattackInstead':False},'Quando comandi l’azione Attaccare, la bestia può attaccare due volte. Il ricorso al Multiattacco stampato viene aggiunto dalle errata.'),
      (15,'Share Spells','Condividere Incantesimi',{'trigger':'cast-spell-targeting-self','mayAlsoAffect':'own-beast-companion-within-30-ft','requiresSpellRangeSelf':False},'Una magia lanciata che bersaglia te stesso può influenzare anche il compagno entro trenta piedi; non è richiesto che la gittata sia Personale.'),
    ]
    for tier,name,it,effect,summary in rows:
        e=record('subclass-feature',f'beast-master-{tier}-'+slug(name),name,it,94,{'level':tier,'effect':effect},summary)
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:beast-master'};added.append(e)
    entities.extend(added)
    styles=['archery','defense','dueling','two-weapon-fighting']
    for index in styles:
        e=by_id['phb2014:class-option:fighter-'+index]
        e['mechanics']['selectionOrigins'].append({'originId':'phb2014:class-feature:ranger-2-fighting-style','classId':CLASS,'minimumClassLevel':2})
        e['sources'].append(source(92,'Fighting Style'));e['fieldSources']['selectionOrigins'].append(len(e['sources'])-1)
    progression=[{'rangerLevel':n,**{k:by_id[f'phb2014:class-level:ranger-{n}']['mechanics'][k] for k in ['spellSlots','spellsKnown']}} for n in range(1,21)]
    core={
      'Favored Enemy':(92,'Nemico Prescelto',{'choose':1,'choiceTypes':['aberration','beast','celestial','construct','dragon','elemental','fey','fiend','giant','monstrosity','ooze','plant','undead'],'alternative':'two-humanoid-races','advantageOn':['wisdom-survival-tracking-favored-enemy','intelligence-recall-favored-enemy'],'languageChoice':'one-spoken-by-selected-enemy-if-any','selectionLevels':[1,6,14],'encountersGuideChoice':True},'Scegli un tipo di nemico o due razze umanoidi: vantaggio a Sopravvivenza per le tracce e prove Intelligenza per le informazioni. Impari una loro lingua se ne parlano; aggiungi scelte ai livelli 6 e 14.'),
      'Natural Explorer':(92,'Esploratore Naturale',{'chooseTerrain':1,'terrainChoices':['arctic','coast','desert','forest','grassland','mountain','swamp','underdark'],'selectionLevels':[1,6,10],'terrainRelatedIntelligenceOrWisdomCheck':'double-proficiency-only-if-using-proficient-skill','travelBenefitsRequireHours':1,'groupTravel':['difficult-terrain-does-not-slow','cannot-become-lost-except-magically'],'alertWhileDoingOtherTravelActivities':True,'normalPaceStealthRequires':'travel-alone','forageFoodMultiplier':2,'trackingReveals':['exact-number','sizes','time-since-passage']},'Un terreno prescelto permette competenza doppia alle prove Intelligenza o Saggezza pertinenti se già competente. Viaggi di almeno un’ora beneficiano di terreno, orientamento e vigilanza; da solo puoi essere furtivo a passo normale, trovi doppio cibo e dettagli delle tracce.'),
      'Fighting Style':(92,'Stile di Combattimento',{'choose':1,'optionIds':['phb2014:class-option:fighter-'+s for s in styles],'mayChooseKnownStyleAgain':False},'Scegli Tiro con l’Arco, Difesa, Duellare o Combattere con Due Armi, senza ripetere uno stile già conosciuto.'),
      'Spellcasting':([91,92,93],'Incantesimi',{'ability':'wisdom','list':'ranger','progression':progression,'spellSlotScope':'your-spells','slotRecovery':['long-rest'],'replaceKnownSpellOnRangerLevelGain':1,'replacementList':'ranger','replacementLevelLimit':'highest-slot-in-ranger-class-table','saveDC':'8+proficiencyBonus+wisdomModifier','attackModifier':'proficiencyBonus+wisdomModifier','focusGranted':False,'ritualCastingGranted':False},'Dal livello 2 conosci magie da ranger e usi Saggezza. Quantità e livello seguono la tabella della classe; sostituisci una magia salendo di livello da ranger. Slot recuperati dopo riposo lungo; questo privilegio 2014 non concede focus né rituali.'),
      'Ranger Archetype':(93,'Archetipo del Ranger',{'chooseSubclass':1,'subclassIds':[HUNTER,'phb2014:subclass:beast-master'],'featureLevels':[3,7,11,15]},'Scegli Cacciatore o Signore delle Bestie; privilegi ai livelli 3, 7, 11 e 15.'),
      'Primeval Awareness':(93,'Consapevolezza Primordiale',{'activation':'action','cost':'one-ranger-spell-slot','durationMinutes':'spent-slot-level','radiusMiles':1,'radiusMilesInFavoredTerrain':6,'detectsPresenceOf':['aberration','celestial','dragon','elemental','fey','fiend','undead'],'revealsLocationOrNumber':False},'Un’azione e uno slot da ranger rivelano la presenza di sette tipi di creature entro un miglio, fino a sei nel terreno prescelto, per un minuto per livello dello slot. Non fornisce posizione né quantità.'),
      'Extra Attack':(93,'Attacco Extra',{'attackActionAttacks':2,'requires':'own-turn'},'Effettui due attacchi con l’azione Attaccare nel tuo turno.'),
      'Land’s Stride':(93,'Passo della Terra',{'nonmagicalDifficultTerrainExtraMovementCost':0,'nonmagicalPlants':'do-not-slow-or-deal-thorn-spine-damage','saveAdvantageAgainst':'magically-created-or-manipulated-plants-impeding-movement'},'Superi terreno difficile e piante non magiche senza costo aggiuntivo o danno da spine. Hai vantaggio ai TS contro piante magicamente create o manipolate per ostacolare il movimento.'),
      'Hide in Plain Sight':(93,'Nascondersi in Piena Vista',{'camouflageMinutes':1,'requires':'natural-camouflage-materials','hideAgainst':'solid-surface-at-least-as-tall-and-wide-as-self','dexterityStealthBonus':10,'requiresStillAndNoActions':True,'mustReapplyAfter':['movement','action','reaction']},'Un minuto e materiali naturali preparano una mimetizzazione: contro una superficie solida abbastanza grande ottieni Furtività +10 restando fermo e senza azioni. Movimento, azione o reazione richiedono nuova preparazione.'),
      'Vanish':(93,'Scomparire',{'hideActivation':'bonus-action-on-own-turn','nonmagicalTrackingPossible':False,'exception':'choose-to-leave-trail'},'Puoi Nasconderti con azione bonus nel tuo turno e non sei rintracciabile con mezzi non magici salvo lasciare volontariamente tracce.'),
      'Feral Senses':(93,'Sensi Ferini',{'unseenTargetAttackDisadvantageFromNotSeeing':False,'invisibleCreatureLocationRadiusFt':30,'locationRequires':['target-not-hidden-from-self','self-not-blinded','self-not-deafened']},'Non subisci lo svantaggio agli attacchi causato dal non vedere il bersaglio. Individui creature invisibili entro trenta piedi se non nascoste da te e se non sei accecato né assordato.'),
      'Foe Slayer':(93,'Sterminatore di Nemici',{'maximumUses':'once-per-own-turn','target':'favored-enemy','addWisdomModifierToChoice':['attack-roll','damage-roll'],'decisionTiming':'before-or-after-roll-but-before-effects'},'Una volta nel tuo turno aggiungi Saggezza a un tiro di attacco o danno contro un nemico prescelto, prima o dopo il tiro ma prima degli effetti; nessun minimo è specificato.'),
    }
    for e in entities:
        if e['kind']!='class-feature' or e['relations']['classId']!=CLASS:continue
        if e['name']=='Subclass Feature':
            e['mechanics']['concreteAlternativeIds']=[f['id'] for f in added if f['kind']=='subclass-feature' and f['mechanics']['level']==e['mechanics']['level']];e['fieldSources']['concreteAlternativeIds']=[0];continue
        if e['name'] not in core:continue
        pages,it,effect,summary=core[e['name']]
        e.update(nameIt=it,summaryIt=summary,translation={'language':'it','status':'assistant-translation'})
        e['sources'].append(source(pages,e['name']));e['mechanics']['effect']=dict(effect);e['fieldSources']['effect']=[len(e['sources'])-1]
        if e['name']=='Spellcasting':e['sources'][-1]['verification']='read-local-render'
        e['verification'].update(complete=True,missingFields=[])
    for sub in ['hunter','beast-master']:
        e=by_id['phb2014:subclass:'+sub];fs=[f for f in added if f['kind']=='subclass-feature' and f['relations']['subclassId']==e['id']]
        e['relations']['featureIds']=[f['id'] for f in fs];e['summaryIt']=' '.join(f['summaryIt'] for f in fs)
        e['verification'].update(complete=True,missingFields=[])
    return entities
