"""PHB PDF 107–112 read in full: warlock features, patrons, pacts, 32 invocations.

Facts and original-printing behavior only. Reviewed errata are applied separately.
An expanded patron list permits selection; it does not automatically teach spells.
"""
from curated import record, source
from spell_extract import slug

CLASS = 'phb2014:class:warlock'
RESTS = ['short-rest', 'long-rest']


def cast(spell, *, slot=False, uses=None, self_only=False, no_material=False, level=None):
    return {'spellId': 'phb2014:spell:' + slug(spell), 'expendsSpellSlot': slot,
            'atWill': uses is None, 'resource': {'uses': uses, 'recovery': ['long-rest']} if uses else None,
            'selfOnly': self_only, 'ignoresMaterialComponents': no_material, 'castAtLevel': level}


# Name, Italian, page, minimum level, required pact/cantrip, independently read effect.
INVOCATIONS = [
 ('Agonizing Blast','Deflagrazione Agonizzante',111,2,None,'eldritch-blast',{'spellId':'phb2014:spell:eldritch-blast','damageBonusPerHit':'charismaModifier'}),
 ('Armor of Shadows','Armatura delle Ombre',111,2,None,None,cast('Mage Armor',self_only=True,no_material=True)),
 ('Ascendant Step','Passo Ascendente',111,9,None,None,cast('Levitate',self_only=True,no_material=True)),
 ('Beast Speech','Voce delle Bestie',111,2,None,None,cast('Speak with Animals')),
 ('Beguiling Influence','Influenza Ammaliante',111,2,None,None,{'skillProficiencies':['deception','persuasion']}),
 ('Bewitching Whispers','Sussurri Ammalianti',111,7,None,None,cast('Compulsion',slot=True,uses=1)),
 ('Book of Ancient Secrets','Libro degli Antichi Segreti',111,2,'pact-of-the-tome',None,
  {'initialRituals':{'choose':2,'spellLevel':1,'lists':'any-class','ritualRequired':True},'notAgainstSpellsKnown':True,
   'requiresBookInHand':True,'initialSpellsCastOnlyAsRitualUnlessKnownSeparately':True,'knownWarlockRitualsAllowed':True,
   'copyRitualMaximumLevel':'ceil(warlockLevel/2)','copyHoursPerSpellLevel':2,'copyCostGPPerSpellLevel':50}),
 ('Chains of Carceri','Catene di Carceri',111,15,'pact-of-the-chain',None,
  {**cast('Hold Monster',no_material=True),'targetTypes':['celestial','fiend','elemental'],'repeatSameTargetRequires':'long-rest'}),
 ("Devil's Sight",'Vista del Diavolo',111,2,None,None,{'normalVisionInDarknessFt':120,'includesMagicalDarkness':True}),
 ('Dreadful Word','Parola Terrificante',111,7,None,None,cast('Confusion',slot=True,uses=1)),
 ('Eldritch Sight','Vista Occulta',111,2,None,None,cast('Detect Magic')),
 ('Eldritch Spear','Lancia Occulta',112,2,None,'eldritch-blast',{'spellId':'phb2014:spell:eldritch-blast','rangeFt':300}),
 ('Eyes of the Rune Keeper','Occhi del Custode delle Rune',112,2,None,None,{'canRead':'all-writing'}),
 ('Fiendish Vigor','Vigore Immondo',112,2,None,None,cast('False Life',self_only=True,no_material=True,level=1)),
 ('Gaze of Two Minds','Sguardo di Due Menti',112,2,None,None,
  {'activation':'action','target':'touched-willing-humanoid','duration':'until-end-of-next-turn','maintenance':'action-on-subsequent-turns',
   'maintenanceRequires':'same-plane','usesTargetSenses':True,'includesSpecialSenses':True,'ownSensesConditions':['blinded','deafened']}),
 ('Lifedrinker','Succhiavita',112,12,'pact-of-the-blade',None,
  {'trigger':'hit-creature-with-pact-weapon','additionalDamage':'max(1,charismaModifier)','damageType':'necrotic'}),
 ('Mask of Many Faces','Maschera dei Mille Volti',112,2,None,None,cast('Disguise Self')),
 ('Master of Myriad Forms','Maestro delle Molte Forme',112,15,None,None,cast('Alter Self')),
 ('Minions of Chaos','Servitori del Caos',112,9,None,None,cast('Conjure Elemental',slot=True,uses=1)),
 ('Mire the Mind','Impantanare la Mente',112,5,None,None,cast('Slow',slot=True,uses=1)),
 ('Misty Visions','Visioni Nebbiose',112,2,None,None,cast('Silent Image',no_material=True)),
 ('One with Shadows','Tuttuno con le Ombre',112,5,None,None,
  {'activation':'action','requiresLight':['dim','darkness'],'condition':'invisible','endsWhen':['move','take-action','take-reaction']}),
 ('Otherworldly Leap','Balzo Ultraterreno',112,9,None,None,cast('Jump',self_only=True,no_material=True)),
 ('Repelling Blast','Deflagrazione Respingente',112,2,None,'eldritch-blast',
  {'trigger':'eldritch-blast-hit-creature','optionalPushMaximumFt':10,'direction':'straight-away-from-caster'}),
 ('Sculptor of Flesh','Scultore della Carne',112,7,None,None,cast('Polymorph',slot=True,uses=1)),
 ('Sign of Ill Omen','Segno del Cattivo Presagio',112,5,None,None,cast('Bestow Curse',slot=True,uses=1)),
 ('Thief of Five Fates','Ladro dei Cinque Fati',112,2,None,None,cast('Bane',slot=True,uses=1)),
 ('Thirsting Blade','Lama Assetata',112,5,'pact-of-the-blade',None,
  {'attackActionAttacks':2,'weapon':'pact-weapon','requiresTurn':'own','doesNotStackWithExtraAttack':True}),
 ('Visions of Distant Realms','Visioni di Reami Lontani',112,15,None,None,cast('Arcane Eye')),
 ('Voice of the Chain Master','Voce del Maestro della Catena',112,2,'pact-of-the-chain',None,
  {'familiarTelepathyRange':'same-plane','familiarSenseRange':'same-plane','canSpeakThroughFamiliarWhileUsingSenses':True,'voice':'own'}),
 ('Whispers of the Grave','Sussurri della Tomba',112,9,None,None,cast('Speak with Dead')),
 ('Witch Sight','Vista Stregonesca',112,15,None,None,
  {'rangeFt':30,'requires':'line-of-sight','seeTrueFormOf':['shapechanger','creature-concealed-by-illusion-or-transmutation']}),
]

PATRON_SPELLS = {
 'archfey': (109, [['Faerie Fire','Sleep'],['Calm Emotions','Phantasmal Force'],['Blink','Plant Growth'],
                  ['Dominate Beast','Greater Invisibility'],['Dominate Person','Seeming']]),
 'fiend': (110, [['Burning Hands','Command'],['Blindness/Deafness','Scorching Ray'],['Fireball','Stinking Cloud'],
                ['Fire Shield','Wall of Fire'],['Flame Strike','Hallow']]),
 'great-old-one': (111, [['Dissonant Whispers',"Tasha's Hideous Laughter"],['Detect Thoughts','Phantasmal Force'],
                       ['Clairvoyance','Sending'],['Dominate Beast',"Evard's Black Tentacles"],['Dominate Person','Telekinesis']]),
}

PATRON_FEATURES = [
 ('archfey',1,'Fey Presence','Presenza Fatata',110,
  {'activation':'action','area':{'shape':'cube','sideFt':10,'origin':'self'},'save':'wisdom','DC':'warlockSpellSaveDC',
   'failedSaveConditionChoice':['charmed','frightened'],'expires':'end-of-next-turn','resource':{'uses':1,'recovery':RESTS}},
  'Con un’azione le creature in un cubo di dieci piedi effettuano un TS di Saggezza: scegli fascino o paura fino al termine del prossimo turno.'),
 ('archfey',6,'Misty Escape','Fuga Nebbiosa',110,
  {'activation':'reaction','trigger':'take-damage','teleportFt':60,'destination':'visible-unoccupied-space','condition':'invisible',
   'endsWhen':['start-of-next-turn','attack','cast-spell'],'resource':{'uses':1,'recovery':RESTS}},
  'Quando subisci danni puoi reagire teletrasportandoti e diventando invisibile; attaccare o lanciare magie termina l’invisibilità.'),
 ('archfey',10,'Beguiling Defenses','Difese Ammalianti',110,
  {'immunity':['charmed'],'activation':'reaction','trigger':'another-creature-attempts-charm','save':'wisdom','DC':'warlockSpellSaveDC',
   'failedSaveCondition':'charmed','durationMinutes':1,'endsWhen':'target-takes-damage'},
  'Sei immune al fascino e puoi reagire a un tentativo di affascinarti rivolgendo il fascino contro la creatura responsabile.'),
 ('archfey',14,'Dark Delirium','Delirio Oscuro',110,
  {'activation':'action','target':'one-visible-creature','rangeFt':60,'save':'wisdom','DC':'warlockSpellSaveDC',
   'conditionChoice':['charmed','frightened'],'durationMinutes':1,'concentration':True,'endsWhen':'target-takes-damage',
   'targetPerceivesOnly':['self','caster','illusion'],'resource':{'uses':1,'recovery':RESTS}},
  'Una creatura può essere intrappolata in un’illusione, affascinata o spaventata. Richiede concentrazione e termina se subisce danni.'),
 ('fiend',1,"Dark One's Blessing",'Benedizione dell’Oscuro',110,
  {'trigger':'reduce-hostile-creature-to-zero-hit-points','temporaryHitPoints':'max(1,charismaModifier+warlockLevel)'},
  'Ridurre una creatura ostile a zero PF concede PF temporanei pari a Carisma più livello da warlock, minimo uno.'),
 ('fiend',6,"Dark One's Own Luck",'Fortuna dell’Oscuro',110,
  {'trigger':['ability-check','saving-throw'],'bonusDie':'1d10','chooseWhen':'after-initial-roll-before-effects',
   'resource':{'uses':1,'recovery':RESTS}},'Puoi aggiungere un d10 a una prova o un TS dopo il tiro iniziale e prima dei suoi effetti.'),
 ('fiend',10,'Fiendish Resilience','Resilienza Immonda',110,
  {'chooseDamageTypeAfter':RESTS,'resistance':'chosen-damage-type','lastsUntil':'next-choice',
   'ignoredByDamageFrom':['magical-weapons','silver-weapons']},
  'Dopo un riposo scegli una resistenza ai danni; le armi magiche o argentate la ignorano secondo questa capacità.'),
 ('fiend',14,'Hurl Through Hell','Scagliare all’Inferno',110,
  {'trigger':'hit-creature-with-attack','activation':'no-separate-action','targetTemporarilyRemoved':True,
   'returns':'end-of-caster-next-turn','returnSpace':'previous-or-nearest-unoccupied','damage':'10d10','damageType':'psychic',
   'damageExcludesCreatureType':'fiend','resource':{'uses':1,'recovery':['long-rest']}},
  'Un bersaglio colpito scompare fino al termine del prossimo turno; al ritorno subisce 10d10 psichici se non è un immondo.'),
 ('great-old-one',1,'Awakened Mind','Mente Risvegliata',111,
  {'communication':'telepathic-utterances-to-target','target':'visible-creature','rangeFt':30,'sharedLanguageRequired':False,
   'targetMustUnderstandAtLeastOneLanguage':True},
  'Puoi comunicare telepaticamente verso una creatura visibile entro trenta piedi che comprenda almeno un linguaggio.'),
 ('great-old-one',6,'Entropic Ward','Protezione Entropica',111,
  {'activation':'reaction','trigger':'creature-attacks-self','incomingAttackDisadvantage':True,
   'onMiss':'next-attack-against-attacker-has-advantage','benefitExpires':'end-of-next-turn','resource':{'uses':1,'recovery':RESTS}},
  'Imponi svantaggio a un attacco contro di te; se manca, il tuo prossimo attacco contro quella creatura può avere vantaggio.'),
 ('great-old-one',10,'Thought Shield','Scudo dei Pensieri',111,
  {'thoughtReadingRequiresConsent':True,'damageResistance':['psychic'],'psychicReflection':'same-damage-as-actually-taken'},
  'Proteggi i pensieri, resisti ai danni psichici e chi te li infligge subisce lo stesso ammontare che subisci tu.'),
 ('great-old-one',14,'Create Thrall','Creare un Servitore',111,
  {'activation':'action','target':'touched-incapacitated-humanoid','condition':'charmed',
   'endsWhen':['remove-curse','charmed-condition-removed','feature-used-again'],'telepathyRange':'same-plane'},
  'Affascini un umanoide incapacitato toccato e comunichi telepaticamente sullo stesso piano; fascino non significa controllo completo.'),
]


def extra_records():
    result = []
    for name, italian, page, level, pact, cantrip, effect in INVOCATIONS:
        prerequisites = {'minimumWarlockLevelForSelection': level}
        if pact:
            prerequisites['pactOptionId'] = 'phb2014:class-option:' + pact
        if cantrip:
            prerequisites['knownCantripId'] = 'phb2014:spell:' + cantrip
        e = record('class-option', slug(name), name, italian, page,
                   {'optionType': 'eldritch-invocation', 'prerequisites': prerequisites, 'effect': effect},
                   'Invocazione selezionabile rispettando i prerequisiti; il suo effetto è rappresentato nei campi meccanici.')
        e['relations'] = {'classId': CLASS, 'parentFeatureId': 'phb2014:class-feature:warlock-2-eldritch-invocations'}
        if effect.get('spellId'):
            e['relations']['spellId'] = effect['spellId']
        if pact:
            e['relations']['pactOptionId'] = prerequisites['pactOptionId']
        if name == 'Thirsting Blade':
            e['sources'].append(source(165, 'Extra Attack: multiclassing'))
            e['fieldSources']['effect'].append(1)
        if level==2:
            e['sources'].append(source(108,'Eldritch Invocations: acquired at warlock level 2'))
            e['fieldSources']['prerequisites'].append(len(e['sources'])-1)
            e['interpretations'].append({'field':'prerequisites.minimumWarlockLevelForSelection','kind':'derived',
                'method':'No explicit higher-level prerequisite in this invocation; the parent feature starts at warlock level 2.'})
        result.append(e)
    pacts = [
        ('Pact of the Chain','Patto della Catena',[108],
         {'learnSpell':'phb2014:spell:find-familiar','canCastAsRitual':True,'notAgainstSpellsKnown':True,
          'additionalFamiliarForms':['imp','pseudodragon','quasit','sprite'],
          'familiarAttack':'forgo-one-own-attack-during-attack-action-to-allow-one-familiar-attack'}),
        ('Pact of the Blade','Patto della Lama',[108,109],
         {'createActivation':'action','createLocation':'empty-hand','createdForms':'any-melee-weapon','proficiencyWhileWielding':True,
          'magicalForResistanceAndImmunity':True,'disappearsWhen':['over-5-ft-away-for-1-minute','feature-used-again','dismissed','death'],
          'dismissRequiresAction':False,'bindMagicWeaponRitualHours':1,'ritualMayBeDuringShortRest':True,
          'cannotBind':['artifact','sentient-weapon'],'boundWeaponStorage':'extradimensional-space',
          'bindingEnds':['death','bind-another-weapon','one-hour-unbinding-ritual'],'storedWeaponOnUnbinding':'appears-at-feet'}),
        ('Pact of the Tome','Patto del Tomo',[109],
         {'cantripChoice':{'choose':3,'lists':'any-class'},'requiresBookOnPerson':True,'notAgainstCantripsKnown':True,
          'replaceLostBookCeremonyHours':1,'ceremonyMayBeDuring':RESTS,'ceremonyDestroysPreviousBook':True,'bookDestroyedOnDeath':True}),
    ]
    for name, italian, pages, effect in pacts:
        e = record('class-option', slug(name), name, italian, pages,
                   {'optionType':'pact-boon','prerequisites':{'minimumWarlockLevelForSelection':3},'effect':effect},
                   'Scegli un solo dono del patto al terzo livello; effetti e condizioni sono nei campi meccanici.')
        e['relations'] = {'classId':CLASS,'parentFeatureId':'phb2014:class-feature:warlock-3-pact-boon'}
        if effect.get('learnSpell'):
            e['relations']['spellId'] = effect['learnSpell']
        result.append(e)
    for patron, level, name, italian, page, effect, summary in PATRON_FEATURES:
        e = record('subclass-feature', patron + '-' + slug(name), name, italian, page,
                   {'level':level,'effect':effect}, summary)
        e['relations'] = {'classId':CLASS,'subclassId':'phb2014:subclass:'+patron}
        result.append(e)
    return result


def apply_warlock_reviews(entities):
    entities.extend(extra_records())
    options = [e for e in entities if e['kind']=='class-option' and e['mechanics']['optionType']=='eldritch-invocation']
    pact_ids = ['phb2014:class-option:pact-of-the-' + ending for ending in ['chain','blade','tome']]
    for e in entities:
        if e['kind']=='subclass' and e['index'] in PATRON_SPELLS:
            page, rows = PATRON_SPELLS[e['index']]
            e['mechanics']['expandedSpellChoices'] = [
                {'spellLevel':level,'spellIds':['phb2014:spell:'+slug(name) for name in names],
                 'automaticallyKnown':False} for level,names in enumerate(rows,1)]
            e['mechanics']['choices'] = []
            e['sources'].append(source(page,'Expanded Spell List'))
            e['fieldSources']['expandedSpellChoices'] = [len(e['sources'])-1]
            e['fieldSources']['choices'] = [0]
            features = [f for f in entities if f['kind']=='subclass-feature' and f['relations']['subclassId']==e['id']]
            e['relations']['featureIds'] = [f['id'] for f in features]
            e['relations']['expandedSpellIds'] = [sid for row in e['mechanics']['expandedSpellChoices'] for sid in row['spellIds']]
            e['verification'].update(complete=True, missingFields=[])
            e['summaryIt'] = 'Patrono con quattro privilegi verificati e lista ampliata: gli incantesimi devono essere scelti, non sono imparati automaticamente.'
        if e['kind']!='class-feature' or e['relations']['classId']!=CLASS:
            continue
        effect, page = None, 108
        if e['name']=='Otherworldly Patron':
            effect = {'choose':1,'subclassIds':['phb2014:subclass:'+x for x in PATRON_SPELLS],'featureLevels':[1,6,10,14]}
        elif e['name']=='Pact Magic':
            effect = {'knownSpells':'warlock-class-table','knownCantrips':'warlock-class-table','spellList':'warlock',
                      'spellSlots':'pact-pool-class-table','slotLevelsAreEqual':True,'slotRecovery':RESTS,
                      'replaceKnownSpellsPerWarlockLevelGain':1,'replacementMaximumLevel':'pact-slot-level',
                      'castingAbility':'charisma','spellSaveDC':'8+proficiencyBonus+charismaModifier',
                      'spellAttackModifier':'proficiencyBonus+charismaModifier','focus':'arcane-focus'}
        elif e['name']=='Eldritch Invocations':
            effect = {'knownCount':'warlock-class-table','replacePerWarlockLevelGain':1,'mustMeetPrerequisites':True,
                      'mayMeetPrerequisiteAtSameTimeAsLearning':True,'choiceIds':[x['id'] for x in options]}
        elif e['name']=='Pact Boon':
            effect = {'choose':1,'choiceIds':pact_ids}
        elif e['name']=='Mystic Arcanum':
            page=109
            spell_level = {11:6,13:7,15:8,17:9}[e['mechanics']['level']]
            effect = {'choose':1,'spellList':'warlock','spellLevel':spell_level,'expendsSpellSlot':False,
                      'resource':{'usesPerChosenSpell':1,'recovery':['long-rest']}}
        elif e['name']=='Eldritch Master':
            page=109
            effect = {'activationMinutes':1,'recover':'all-expended-pact-magic-slots','resource':{'uses':1,'recovery':['long-rest']}}
        elif e['name']=='Subclass Feature':
            matching=[f['id'] for f in entities if f['kind']=='subclass-feature' and f['relations']['classId']==CLASS
                      and f['mechanics']['level']==e['mechanics']['level']]
            e['relations']['concreteAlternativeIds']=matching
            continue
        if effect is not None:
            e['mechanics']['effect']=effect
            e['sources'].append(source(page,e['name']))
            if e['name']=='Eldritch Invocations':
                e['sources'].append(source(111,'Eldritch Invocations prerequisites'))
            e['fieldSources']['effect']=list(range(1,len(e['sources'])))
            e['summaryIt']='Privilegio del warlock: scelte, formule e recupero sono definiti nei campi meccanici.'
            e['verification'].update(complete=True,missingFields=[])
            # Proper Italian names, never pretend they are official localization.
            e['nameIt']={'Otherworldly Patron':'Patrono Ultraterreno','Pact Magic':'Magia del Patto',
                         'Eldritch Invocations':'Invocazioni Occulte','Pact Boon':'Dono del Patto',
                         'Mystic Arcanum':'Arcanum Mistico','Eldritch Master':'Maestro dell’Occulto'}[e['name']]
            e['translation']['status']='assistant-translation'
    return entities
