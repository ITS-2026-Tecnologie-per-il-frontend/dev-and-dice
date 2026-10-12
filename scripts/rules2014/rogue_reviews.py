"""PHB PDF 95–99 read in full; PDF 99 table inspected on render.

Original printing only. PH-Errata.pdf PDF 2 is applied in the distinct view.
"""
from curated import record, source
from spell_extract import slug
from fighter_reviews import EK_KNOWN, EK_SLOTS

CLASS='phb2014:class:rogue'
CORE=[
 ('Expertise','Maestria',97,{'chooseByRogueLevel':{'1':2,'6':2},'initialAlternatives':['two-proficient-skills','one-proficient-skill-and-thieves-tools'],
   'level6ChoicesFrom':['proficient-skills','proficient-thieves-tools'],'proficiencyMultiplier':2},
  'Raddoppi la competenza nelle prove delle due competenze scelte; al livello 6 ne scegli altre due. Al primo livello scegli due abilità oppure un’abilità e gli arnesi da scasso.'),
 ('Sneak Attack','Attacco Furtivo',[96,97],{'maximumUsesPerTurn':1,'requiresWeapon':['finesse','ranged'],
   'extraDamageDiceByRogueLevel':{str(n):str((n+1)//2)+'d6' for n in range(1,21)},
   'requiresAny':[{'advantage':True},{'anotherEnemyOfTargetWithinFt':5,'enemyNotIncapacitated':True,'noDisadvantage':True}],
   'target':'one-hit-creature'},'Una volta per turno un colpo con arma accurata o a distanza può infliggere i dadi extra della progressione: serve vantaggio, oppure un altro nemico capace entro cinque piedi dal bersaglio e nessuno svantaggio.'),
 ('Thieves’ Cant','Gergo Ladresco',97,{'secretCommunication':'only-known-to-other-speakers','conversationTimeMultiplier':4,
   'alsoUnderstands':'secret-simple-signs-and-symbols'},'Nascondi messaggi nel dialogo con chi conosce il gergo, impiegando quattro volte il tempo normale; comprendi anche segni e simboli segreti.'),
 ('Cunning Action','Azione Scaltra',97,{'activation':'bonus-action-on-own-turn-in-combat','actionChoices':['dash','disengage','hide']},
  'Nel tuo turno in combattimento puoi usare l’azione bonus per Scattare, Disimpegnarti o Nasconderti.'),
 ('Roguish Archetype','Archetipo Ladresco',97,{'choose':1,'subclassIds':['phb2014:subclass:'+s for s in ['thief','assassin','arcane-trickster']],
   'featureLevels':[3,9,13,17]},'Scegli Ladro, Assassino o Mistificatore Arcano; i privilegi arrivano ai livelli 3, 9, 13 e 17.'),
 ('Uncanny Dodge','Schivata Prodigiosa',97,{'activation':'reaction','trigger':'visible-attacker-hits-self-with-attack','attackDamageMultiplier':0.5},
  'Con la reazione dimezzi i danni di un attacco che ti colpisce se ne vedi l’attaccante.'),
 ('Evasion','Elusione',97,{'requires':'effect-allows-dexterity-save-for-half-damage','successfulSaveDamageMultiplier':0,'failedSaveDamageMultiplier':0.5},
  'Per gli effetti che consentono un TS Destrezza per dimezzare i danni, un successo li annulla e un fallimento li dimezza.'),
 ('Reliable Talent','Talento Affidabile',97,{'requires':'ability-check-that-adds-proficiency-bonus','minimumD20Result':10},
  'Nelle prove di caratteristica che aggiungono competenza tratti i risultati del d20 inferiori a dieci come dieci.'),
 ('Blindsense','Percezione Cieca',97,{'requires':'able-to-hear','detectsLocation':['hidden-creature','invisible-creature'],'radiusFt':10},
  'Se puoi sentire conosci la posizione delle creature nascoste o invisibili entro dieci piedi.'),
 ('Slippery Mind','Mente Sfuggente',97,{'savingThrowProficiency':'wisdom'},'Ottieni competenza nei TS Saggezza.'),
 ('Elusive','Inafferrabile',97,{'requires':'not-incapacitated','attackRollAdvantageAgainstSelf':False},
  'Finché non sei incapacitato nessun tiro per colpire contro di te può avere vantaggio.'),
 ('Stroke of Luck','Colpo di Fortuna',98,{'resource':{'uses':1,'recovery':['short-rest','long-rest']},
   'alternatives':[{'trigger':'own-attack-misses-target-within-range','result':'hit'},{'trigger':'failed-ability-check','d20Result':20}]},
  'Trasformi un attacco mancato contro un bersaglio nella gittata in un colpo, oppure il d20 di una prova fallita in venti. Recuperi l’uso con riposo breve o lungo.'),
]


def extra_records():
    # Identical slot/known-spell values independently confirmed on the PDF 99 render.
    casting={'spellList':'wizard','castingAbility':'intelligence','slotRecovery':['long-rest'],'slotSpells':'known-spells',
      'spellSaveDC':'8+proficiencyBonus+intelligenceModifier','spellAttackModifier':'proficiencyBonus+intelligenceModifier',
      'initialCantrips':{'fixedSpellId':'phb2014:spell:mage-hand','chooseAdditionalWizardCantrips':2},
      'initialKnownSpells':{'choose':3,'level':1,'enchantmentOrIllusionRequired':2},'restrictedSchools':['enchantment','illusion'],
      'newUnrestrictedSpellAtRogueLevels':[8,14,20],'replaceKnownSpellsPerRogueLevelGain':1,
      'unrestrictedReplacementForSpellLearnedAtLevels':[8,14,20],'newSpellMaximumLevel':'highest-available-slot',
      'progression':[{'rogueLevel':n,'cantripsKnown':3 if n<10 else 4,'spellsKnown':EK_KNOWN[n-3],
                     'spellSlots':list(EK_SLOTS[n-3])+[0]*5} for n in range(3,21)]}
    rows=[
      ('thief',3,'Fast Hands','Mani Veloci',98,{'activation':'cunning-action-bonus-action',
       'choices':['dexterity-sleight-of-hand-check','thieves-tools-disarm-trap','thieves-tools-open-lock','use-object-action'],
       'excludes':'magic-item-activation'},'Con l’azione bonus di Azione Scaltra puoi usare Rapidità di Mano, arnesi da scasso per serrature o trappole, oppure Usare un Oggetto. L’attivazione di oggetti magici è esclusa dal DMG.'),
      ('thief',3,'Second-Story Work','Lavoro al Secondo Piano',98,{'climbingExtraMovementCost':0,'runningJumpExtraFt':'dexterityModifier'},
       'Arrampicarti non costa movimento extra; un salto con rincorsa aumenta del modificatore di Destrezza in piedi.'),
      ('thief',9,'Supreme Sneak','Furtività Suprema',98,{'checkAdvantage':'dexterity-stealth','requires':'move-no-more-than-half-speed-on-same-turn'},
       'Hai vantaggio alle prove di Furtività se nel medesimo turno ti muovi al massimo di metà velocità.'),
      ('thief',13,'Use Magic Device','Usare Oggetti Magici',98,{'ignoredMagicItemUseRequirements':['class','race','level']},
       'Per usare oggetti magici ignori i requisiti di classe, razza e livello.'),
      ('thief',17,"Thief's Reflexes",'Riflessi da Ladro',98,{'trigger':'first-round-of-combat','requires':'not-surprised',
       'turnInitiatives':['own-initiative','own-initiative-minus-10']},'Se non sei sorpreso hai due turni nel primo round, alla tua iniziativa e a quella meno dieci.'),
      ('assassin',3,'Bonus Proficiencies','Competenze Bonus',98,{'toolProficiencyIds':['phb2014:tool:disguise-kit','phb2014:tool:poisoners-kit']},
       'Ottieni competenza nei trucchi per camuffarsi e nella borsa da avvelenatore.'),
      ('assassin',3,'Assassinate','Assassinare',98,{'attackAdvantageAgainst':'creature-has-not-yet-taken-turn-in-combat',
       'automaticCriticalOnHitAgainst':'surprised-creature'},'Hai vantaggio contro chi non ha ancora svolto un turno nel combattimento; i colpi contro creature sorprese sono critici.'),
      ('assassin',9,'Infiltration Expertise','Maestria nelle Infiltrazioni',98,{'createFalseIdentityDays':7,'costGP':25,
       'cannotImpersonateExistingPerson':True,'beliefLastsUntil':'obvious-reason-to-disbelieve'},
       'In sette giorni e con venticinque mo costruisci un’identità inventata, credibile finché non emerge una ragione evidente per dubitarne.'),
      ('assassin',13,'Impostor','Impostore',98,{'studyHours':3,'studyRequires':['speech','writing','mannerisms'],
       'casualObserverCannotDistinguish':True,'advantageWhenSuspiciousObserver':'charisma-deception-check-to-avoid-detection'},
       'Tre ore di studio di voce, scrittura e comportamento consentono un’imitazione indistinguibile per osservatori casuali e vantaggio all’Inganno contro quelli sospettosi.'),
      ('assassin',17,'Death Strike','Colpo Mortale',98,{'trigger':'attack-hits-surprised-creature','save':'constitution',
       'saveDC':'8+dexterityModifier+proficiencyBonus','failedSaveAttackDamageMultiplier':2},
       'Un bersaglio sorpreso che colpisci deve superare un TS Costituzione contro CD otto più Destrezza e competenza, oppure subisce il doppio dei danni dell’attacco.'),
      ('arcane-trickster',3,'Spellcasting','Incantesimi',99,casting,
       'Impari Mano Magica e magie dalla lista del mago, usando Intelligenza. Scelte, scuole, sostituzioni e slot con recupero lungo seguono la tabella collegata.'),
      ('arcane-trickster',3,'Mage Hand Legerdemain','Prestidigitazione con Mano Magica',99,{'spellId':'phb2014:spell:mage-hand',
       'mayMakeHandInvisible':True,'additionalTasks':['stow-in-carried-or-worn-container','retrieve-from-carried-or-worn-container','thieves-tools-open-lock-and-disarm-trap-at-range'],
       'unnoticedTaskCheck':{'self':'dexterity-sleight-of-hand','opposedBy':'target-wisdom-perception'},'additionalControlActivation':'cunning-action-bonus-action'},
       'La mano può essere invisibile, riporre o recuperare oggetti da contenitori trasportati e usare arnesi da scasso a distanza. Rapidità di Mano contrapposta a Percezione nasconde il compito; Azione Scaltra può controllarla.'),
      ('arcane-trickster',9,'Magical Ambush','Imboscata Magica',99,{'requires':'hidden-from-target-when-casting-spell-on-it',
       'targetDisadvantage':'all-saves-against-that-spell-this-turn'},'Una creatura da cui sei nascosto al lancio ha svantaggio ai TS contro quella magia effettuati nel turno corrente.'),
      ('arcane-trickster',13,'Versatile Trickster','Mistificatore Versatile',99,{'activation':'bonus-action-on-own-turn',
       'target':'creature-within-5-ft-of-mage-hand','attackAdvantageAgainstTarget':True,'expires':'end-of-current-turn'},
       'Un’azione bonus nel tuo turno usa la mano per distrarre una creatura entro cinque piedi dalla mano: hai vantaggio ai tiri per colpirla fino alla fine del turno.'),
      ('arcane-trickster',17,'Spell Thief','Ladro di Incantesimi',99,{'activation':'reaction','trigger':'creature-casts-spell-targeting-self-or-including-self-in-area',
       'timing':'immediately-after-casting','saveAbility':'target-casting-ability','saveDC':'own-spell-save-DC',
       'failedSave':'negate-spell-effect-against-self','stealRequires':{'minimumSpellLevel':1,'maximumSpellLevel':'available-own-slots','wizardListRequired':False},
       'knowledgeAndCasterSpellProhibitionHours':8,'stolenSpellUses':'own-spell-slots','resource':{'uses':1,'recovery':['long-rest']}},
       'Con una reazione subito dopo il lancio imponi un TS nella caratteristica da incantatore: il fallimento annulla l’effetto su di te. Se la magia è di almeno primo livello e puoi lanciarne il livello, la conosci per otto ore e il lanciatore non può usarla. Recuperi l’uso con riposo lungo.'),
    ]
    result=[]
    for sub,level,name,it,page,effect,summary in rows:
        e=record('subclass-feature',sub+'-'+str(level)+'-'+slug(name),name,it,page,{'level':level,'effect':effect},summary)
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub}
        if name=='Spellcasting':
            e['sources'].append(source(99,'Arcane Trickster Spellcasting table'));e['sources'][-1]['verification']='read-local-render'
            e['fieldSources']['effect']=[0,1]
        if name=='Fast Hands':
            e['sources'].append(source(142,'Activating an Item','dmg'));e['fieldSources']['effect']=[0,1]
        result.append(e)
    return result


def apply_rogue_reviews(entities):
    added=extra_records();entities.extend(added)
    for e in entities:
        if e['kind']=='subclass' and e['relations']['classId']==CLASS:
            features=[f for f in added if f['relations']['subclassId']==e['id']]
            e['relations']['featureIds']=[f['id'] for f in features]
            e['mechanics'].update(choices=[],spellGrants=[])
            e['sources'].append(source([98,99],'Roguish Archetypes'))
            e['fieldSources'].update(choices=[1],spellGrants=[1])
            e['summaryIt']='Archetipo con privilegi nei record collegati; le magie del Mistificatore Arcano sono scelte da apprendere.'
            e['verification'].update(complete=True,missingFields=[])
        if e['kind']=='class-feature' and e['relations']['classId']==CLASS:
            if e['name']=='Subclass Feature':
                e['relations']['concreteAlternativeIds']=[f['id'] for f in added if f['mechanics']['level']==e['mechanics']['level']]
                continue
            row=next((row for row in CORE if row[0]==e['name']),None)
            if row:
                _,it,pages,effect,summary=row
                e['nameIt']=it;e['translation']['status']='assistant-translation';e['summaryIt']=summary
                e['mechanics']['effect']=effect
                e['sources'].append(source(pages,e['name']));e['fieldSources']['effect']=[len(e['sources'])-1]
                e['verification'].update(complete=True,missingFields=[])
    return entities
