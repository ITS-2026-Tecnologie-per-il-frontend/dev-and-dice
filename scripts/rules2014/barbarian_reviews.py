"""PHB PDF 47–51 read in full; totems inspected on PDF 51 render.

Ritual spell passages read at PDF 218–219, 225, 278; ritual rules 202–203.
"""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:barbarian'
TOTEM='phb2014:subclass:totem-warrior'
TIERS={3:('Totem Spirit','Spirito Totemico'),6:('Aspect of the Beast','Aspetto della Bestia'),14:('Totemic Attunement','Sintonia Totemica')}
OPTIONS=[
 (3,'bear','Orso',{'requires':'raging','damageResistance':'all-except-psychic'},'Durante l’ira resisti a tutti i danni salvo quelli psichici.'),
 (3,'eagle','Aquila',{'requires':['raging','not-heavy-armor'],'enemyOpportunityAttackRolls':'disadvantage',
  'dashActivation':'bonus-action-on-own-turn'},'Durante l’ira senza armatura pesante gli attacchi di opportunità contro di te hanno svantaggio e puoi Scattare con un’azione bonus nel tuo turno.'),
 (3,'wolf','Lupo',{'requires':'raging','friendsMeleeAttackAdvantageAgainst':'creatures-hostile-to-self-within-5-ft-of-self'},
  'Durante l’ira i tuoi amici hanno vantaggio agli attacchi da mischia contro creature a te ostili entro cinque piedi da te.'),
 (6,'bear','Orso',{'carryMaximumLoadAndLiftMultiplier':2,'strengthCheckAdvantageFor':['push-objects','pull-objects','lift-objects','break-objects']},
  'Raddoppi trasporto, carico massimo e sollevamento; hai vantaggio alle prove di Forza per spingere, tirare, sollevare o rompere oggetti.'),
 (6,'eagle','Aquila',{'clearVisionMiles':1,'fineDetailVisionEquivalentDistanceFt':100,'dimLightPerceptionDisadvantage':False},
  'Vedi fino a un miglio distinguendo dettagli come entro cento piedi; la luce fioca non svantaggia le prove di Percezione.'),
 (6,'wolf','Lupo',{'mayTrackAtTravelPace':'fast','mayMoveStealthilyAtTravelPace':'normal'},
  'Puoi seguire tracce viaggiando a passo veloce e muoverti furtivamente a passo normale.'),
 (14,'bear','Orso',{'requires':'raging','radiusFt':5,'affected':'creatures-hostile-to-self',
  'attackDisadvantageExceptTargets':['self','another-character-with-this-feature'],'unaffectedIfAny':['cannot-see-or-hear-self','immune-to-frightened']},
  'Durante l’ira i nemici entro cinque piedi hanno svantaggio contro altri bersagli, salvo chi ha questo stesso privilegio. Chi non ti percepisce o è immune alla paura è escluso.'),
 (14,'eagle','Aquila',{'requires':'raging','flyingSpeed':'current-walking-speed','fallsWhen':'end-of-own-turn-in-air-with-no-other-support'},
  'Durante l’ira voli alla tua velocità di cammino attuale, ma cadi se termini il turno in aria senza un altro sostegno.'),
 (14,'wolf','Lupo',{'requires':'raging','trigger':'hit-Large-or-smaller-creature-with-melee-weapon-attack',
  'activation':'bonus-action-on-own-turn','effect':'target-prone'},'Durante l’ira un colpo con arma da mischia contro una creatura Grande o più piccola consente di renderla prona con l’azione bonus del tuo turno.'),
]


def extra_records():
    result=[]
    for tier,animal,it,effect,summary in OPTIONS:
        name=TIERS[tier][0]+' ('+animal.title()+')'
        origin='phb2014:subclass-feature:totem-warrior-'+str(tier)+'-'+slug(TIERS[tier][0])
        e=record('class-option','totem-'+str(tier)+'-'+animal,name,TIERS[tier][1]+' ('+it+')',51,
          {'optionType':'totem-choice','tier':tier,'animal':animal,'prerequisites':{},'effect':effect,
           'selectionOrigins':[{'originId':origin,'classId':CLASS,'minimumClassLevel':tier,'subclassId':TOTEM}]},summary)
        e['relations']={'classId':CLASS,'subclassId':TOTEM,'parentFeatureId':origin}
        if tier==6 and animal=='wolf':
            e['sources'].append(source(183,'Travel Pace and Stealth'));e['fieldSources']['effect']=[0,1]
        result.append(e)
    rows=[
      ('berserker',3,'Frenzy','Frenesia',50,{'chooseWhen':'enter-rage','requires':'frenzied-rage',
       'grants':'one-melee-weapon-attack-as-bonus-action-on-each-own-turn-after-first','rageEndExhaustionLevels':1},
       'Scegli la frenesia entrando in ira: dai turni successivi puoi compiere un attacco con arma da mischia come azione bonus. Alla fine dell’ira subisci un livello di indebolimento.'),
      ('berserker',6,'Mindless Rage','Ira Incontenibile',50,{'requires':'raging','conditionImmunities':['charmed','frightened'],
       'existingCharmedOrFrightenedEffects':'suspended-for-rage-duration'},'Durante l’ira sei immune a essere affascinato o spaventato; effetti già presenti sono sospesi per la sua durata.'),
      ('berserker',10,'Intimidating Presence','Presenza Intimidatoria',[50,51],{'activation':'action','target':'visible-creature-within-30-ft-that-sees-or-hears-self',
       'save':'wisdom','saveDC':'8+proficiencyBonus+charismaModifier','failedSaveCondition':'frightened-of-self',
       'expires':'end-of-self-next-turn','extend':'own-action-on-subsequent-turns-until-end-of-next-turn',
       'endsAtTargetTurnEndIfAny':['out-of-line-of-sight','more-than-60-ft-from-self'],'successfulSaveImmunityHours':24},
       'Un’azione tenta di spaventare una creatura visibile entro trenta piedi che ti vede o sente, con TS Saggezza. Mantieni l’effetto con nuove azioni; distanza, visuale e successo del TS ne limitano l’uso.'),
      ('berserker',14,'Retaliation','Ritorsione',51,{'activation':'reaction','trigger':'damaged-by-creature-within-5-ft',
       'attack':'melee-weapon-attack-against-damaging-creature'},'Se una creatura entro cinque piedi ti danneggia puoi attaccarla con un’arma da mischia usando la reazione.'),
      ('totem-warrior',3,'Spirit Seeker','Cercatore di Spiriti',51,{'spellGrants':[{'spellId':'phb2014:spell:'+s,'ritualOnly':True} for s in ['beast-sense','speak-with-animals']]},
       'Puoi lanciare Senso della Bestia e Parlare con gli Animali esclusivamente come rituali, secondo le regole generali.'),
      ('totem-warrior',3,'Totem Spirit','Spirito Totemico',51,{'choose':1,
       'choiceIds':[e['id'] for e in result if e['mechanics']['tier']==3],
       'requiresPhysicalTotem':'fur-feathers-claws-teeth-or-bones-of-animal','mayGainMinorMatchingPhysicalTraits':True,'relatedAnimalAppearanceAllowed':True},
       'Scegli uno spirito totemico e acquisisci o costruisci un oggetto con una parte dell’animale. Tratti fisici minori e un animale affine possono rappresentare la stessa scelta.'),
      ('totem-warrior',6,'Aspect of the Beast','Aspetto della Bestia',51,{'choose':1,
       'choiceIds':[e['id'] for e in result if e['mechanics']['tier']==6],'sameAnimalAsPreviousChoiceRequired':False},
       'Scegli un beneficio dell’animale; puoi mantenere il precedente animale o sceglierne un altro.'),
      ('totem-warrior',10,'Spirit Walker','Viandante Spirituale',51,{'spellGrants':[{'spellId':'phb2014:spell:commune-with-nature','ritualOnly':True}],
       'communicatingSpiritAppearance':'one-animal-chosen-for-totem-spirit-or-aspect-of-beast'},
       'Puoi lanciare Comunione con la Natura solo come rituale; uno spirito di un tuo animale totemico comunica le informazioni.'),
      ('totem-warrior',14,'Totemic Attunement','Sintonia Totemica',51,{'choose':1,
       'choiceIds':[e['id'] for e in result if e['mechanics']['tier']==14],'sameAnimalAsPreviousChoiceRequired':False},
       'Scegli un altro beneficio totemico, indipendentemente dagli animali scelti prima.'),
    ]
    for sub,level,name,it,pages,effect,summary in rows:
        e=record('subclass-feature',sub+'-'+str(level)+'-'+slug(name),name,it,pages,{'level':level,'effect':effect},summary)
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub}
        if 'spellGrants' in effect:
            e['sources'].append(source([202,203],'Rituals'));e['fieldSources']['effect']=[0,1]
        result.append(e)
    return result


def apply_barbarian_reviews(entities):
    added=extra_records();entities.extend(added)
    for e in entities:
        if e['kind']=='subclass' and e['relations']['classId']==CLASS:
            features=[f for f in added if f['kind']=='subclass-feature' and f['relations']['subclassId']==e['id']]
            e['relations']['featureIds']=[f['id'] for f in features]
            e['mechanics'].update(choices=[],spellGrants=[])
            e['sources'].append(source([50,51],'Primal Paths'));i=len(e['sources'])-1
            e['fieldSources'].update(choices=[i],spellGrants=[i])
            e['summaryIt']='Cammino primordiale con effetti, scelte totemiche e magie rituali nei privilegi collegati.'
            e['verification'].update(complete=True,missingFields=[])
        if e['kind']=='class-feature' and e['relations']['classId']==CLASS:
            if e['name']=='Subclass Feature':
                e['relations']['concreteAlternativeIds']=[f['id'] for f in added if f['kind']=='subclass-feature' and f['mechanics']['level']==e['mechanics']['level']]
            elif e['name']=='Primal Path':
                e['nameIt']='Cammino Primordiale';e['translation']['status']='assistant-translation'
                e['mechanics']['effect']={'choose':1,'subclassIds':['phb2014:subclass:berserker',TOTEM],'featureLevels':[3,6,10,14]}
                e['sources'].append(source(49,'Primal Path'));e['fieldSources']['effect']=[len(e['sources'])-1]
                e['summaryIt']='Scegli Berserker o Combattente Totemico; i privilegi del cammino arrivano ai livelli 3, 6, 10 e 14.'
                e['verification'].update(complete=True,missingFields=[])
    return entities
