"""PHB PDF 52–56 read; PDF 54 progression checked on the rendered page.

Song of Rest first printing and PH-Errata PDF 1 remain separate. Spell choices
grant eligibility, not automatic knowledge of every spell in the class lists.
"""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:bard'


def apply_bard_reviews(entities):
    by_id={e['id']:e for e in entities}
    progression=[{'bardLevel':n,**{k:by_id[f'phb2014:class-level:bard-{n}']['mechanics'][k]
                 for k in ['spellSlots','spellsKnown','cantripsKnown','bardicInspirationDie','songOfRestDie']}}
                 for n in range(1,21)]
    secret={'choose':2,'spellListScope':'any-class','maximumSpellLevel':'highest-slot-in-bard-class-table',
            'mayChooseCantrips':True,'countsAsBardSpell':True}
    rows=[
      ('lore',3,'Bonus Proficiencies','Competenze Bonus',[55],{'chooseSkillProficiencies':3,'from':'all-skills'},'Scegli tre competenze aggiuntive in abilità.'),
      ('lore',3,'Cutting Words','Parole Taglienti',[55,56],{'activation':'reaction','cost':{'pool':'bardic-inspiration','uses':1},
       'target':'visible-creature-within-60-ft','subtract':'one-bardic-inspiration-die','eligibleRolls':['attack-roll','ability-check','damage-roll'],
       'decisionTiming':'after-roll-before-success-failure-or-damage','targetImmuneIf':['cannot-hear-caster','immune-to-charmed']},
       'Con una reazione spendi un uso di Ispirazione e sottrai il dado a un attacco, prova o tiro del danno di una creatura visibile entro sessanta piedi. Decidi dopo il tiro ma prima dell’esito o del danno; chi non ti sente o è immune all’essere affascinato non è influenzato.'),
      ('lore',6,'Additional Magical Secrets','Segreti Magici Aggiuntivi',[56],{**secret,'countsAgainstBardSpellsKnown':False},
       'Impari due magie da liste di qualsiasi classe, anche trucchetti, entro il livello consentito dalla tabella del bardo. Contano come magie da bardo ma si aggiungono al numero conosciuto della tabella.'),
      ('lore',14,'Peerless Skill','Abilità Impareggiabile',[56],{'cost':{'pool':'bardic-inspiration','uses':1},'trigger':'self-makes-ability-check',
       'add':'one-bardic-inspiration-die','decisionTiming':'after-own-roll-before-DM-states-success-or-failure'},
       'Spendi un uso di Ispirazione per aggiungere il dado a una tua prova di caratteristica, anche dopo il tiro ma prima che il DM dichiari l’esito.'),
      ('valor',3,'Bonus Proficiencies','Competenze Bonus',[56],{'armorProficiencies':['medium','shields'],'weaponProficiencies':['martial']},
       'Ottieni competenza in armature medie, scudi e armi da guerra.'),
      ('valor',3,'Combat Inspiration','Ispirazione in Combattimento',[56],{'extends':'bardic-inspiration-die-granted-to-other-creature','chooseOne':[
       {'addTo':'weapon-damage-roll-just-made'},
       {'activation':'recipient-reaction','addTo':'armor-class-against-one-attack','decisionTiming':'after-seeing-attack-roll-before-hit-or-miss'}]},
       'Chi riceve il tuo dado può aggiungerlo a un tiro di danno con un’arma, oppure usare la propria reazione per aumentare la CA contro un singolo attacco, dopo il tiro ma prima di sapere se colpisce.'),
      ('valor',6,'Extra Attack','Attacco Extra',[56],{'attackActionAttacks':2,'requires':'own-turn','stacksWithOtherExtraAttack':False},
       'Quando effettui l’azione Attaccare nel tuo turno puoi attaccare due volte; Attacco Extra non si somma alle altre classi.'),
      ('valor',14,'Battle Magic','Magia da Battaglia',[56],{'trigger':'use-action-to-cast-bard-spell','grants':{'activation':'bonus-action','weaponAttacks':1}},
       'Dopo aver usato l’azione per lanciare una magia da bardo, puoi effettuare un attacco con un’arma come azione bonus.'),
    ]
    added=[]
    for sub,level,name,it,pages,effect,summary in rows:
        e=record('subclass-feature',f'{sub}-{level}-'+slug(name),name,it,pages,{'level':level,'effect':effect},summary)
        if name=='Extra Attack':
            e['sources'].append(source(165,'Extra Attack; Multiclassing'));e['fieldSources']['effect'].append(1)
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub}
        added.append(e)
    entities.extend(added)
    core={
      'Spellcasting':([53,54],'Incantesimi',{'ability':'charisma','list':'bard','progression':progression,
       'spellSlotScope':'your-spells','slotRecovery':['long-rest'],'replaceKnownSpellOnBardLevelGain':1,
       'replacementList':'bard','replacementLevelLimit':'highest-slot-in-bard-class-table',
       'saveDC':'8+proficiencyBonus+charismaModifier','attackModifier':'proficiencyBonus+charismaModifier',
       'ritualRequires':['known-bard-spell','ritual-tag'],'focus':'musical-instrument'},
       'Conosci magie dalla lista del bardo e usi Carisma per CD e attacchi. Recuperi gli slot dopo riposo lungo; a ogni nuovo livello da bardo puoi sostituire una magia conosciuta entro il livello della tabella di classe. I rituali devono essere conosciuti e avere il tag rituale.'),
      'Bardic Inspiration':([54,55],'Ispirazione Bardica',{'activation':'bonus-action-on-own-turn',
       'target':'one-other-creature-within-60-ft-that-hears-caster','durationMinutes':10,'maximumDiceHeldByRecipient':1,
       'addToOneRoll':['ability-check','attack-roll','saving-throw'],'decisionTiming':'after-d20-before-DM-states-success-or-failure',
       'dieLostWhen':'rolled','dieByBardLevel':{'1':'1d6','5':'1d8','10':'1d10','15':'1d12'},
       'resource':{'maximum':'max(1,charismaModifier)','recoveryBeforeBard5':['long-rest'],'recoveryFromBard5':['short-rest','long-rest']}},
       'Un’azione bonus concede a un’altra creatura che ti sente entro sessanta piedi un dado utilizzabile entro dieci minuti su una prova, attacco o TS. Decide dopo il d20 e prima dell’esito; può possedere un solo dado. Dado e recupero migliorano con i livelli da bardo.'),
      'Jack of All Trades':([55],'Tuttofare',{'addTo':'ability-check-without-already-including-proficiency-bonus',
       'bonus':'floor(proficiencyBonus/2)'},'Alle prove che non includono già il bonus di competenza aggiungi metà del bonus, arrotondata in basso.'),
      'Song of Rest':([55],'Canto di Riposo',{'during':'short-rest','beneficiaries':'self-and-friendly-creatures-who-hear-performance',
       'trigger':'regain-hit-points-at-end-of-short-rest','requiresSpendingHitDice':False,
       'additionalHealingByBardLevel':{'2':'1d6','9':'1d8','13':'1d10','17':'1d12'}},
       'Musica o parole durante il riposo breve concedono PF aggiuntivi a te e agli amici che ti sentono e recuperano PF al termine. La prima stampa non impone la spesa di dadi vita; il dado cresce ai livelli 9, 13 e 17.'),
      'Bard College':([55],'Collegio Bardico',{'chooseSubclass':1,'subclassIds':['phb2014:subclass:lore','phb2014:subclass:valor'],'featureLevels':[3,6,14]},
       'Scegli Sapienza o Valore; ricevi i privilegi ai livelli 3, 6 e 14.'),
      'Expertise':([55],'Maestria',{'choose':2,'from':'already-proficient-skills','proficiencyMultiplier':2,'additionalSelectionAtBardLevel':10},
       'Scegli due abilità in cui sei competente e raddoppi la competenza nelle relative prove. Al livello 10 scegli altre due abilità.'),
      'Font of Inspiration':([55],'Fonte di Ispirazione',{'resource':'bardic-inspiration','regainAllWhen':['short-rest','long-rest']},
       'Recuperi tutti gli usi di Ispirazione dopo riposo breve o lungo.'),
      'Countercharm':([55],'Controfascino',{'activation':'action','expires':'end-of-own-next-turn','radiusFt':30,
       'beneficiaries':'self-and-friendly-creatures-that-hear-caster','saveAdvantageAgainst':['frightened','charmed'],
       'endsEarlyIf':['incapacitated','silenced','voluntarily-ended-no-action']},
       'Un’azione avvia una performance fino alla fine del tuo prossimo turno: tu e gli amici entro trenta piedi che ti sentono avete vantaggio ai TS contro paura e fascino. Termina se sei incapacitato, silenziato o decidi di interromperla.'),
      'Magical Secrets':([55],'Segreti Magici',{**secret,'countsAgainstBardSpellsKnown':True,'grantLevels':[10,14,18]},
       'Ai livelli 10, 14 e 18 scegli ogni volta due magie da qualsiasi classe, anche trucchetti, entro il limite della tabella del bardo. Sono magie da bardo e sono già incluse nel totale conosciuto della tabella.'),
      'Superior Inspiration':([55],'Ispirazione Superiore',{'trigger':'roll-initiative','requires':'zero-bardic-inspiration-uses-remaining','regainUses':1},
       'Se tiri iniziativa senza usi di Ispirazione ne recuperi uno.'),
    }
    for e in entities:
        if e['kind']!='class-feature' or e['relations']['classId']!=CLASS:continue
        if e['name']=='Subclass Feature':
            e['mechanics']['concreteAlternativeIds']=[f['id'] for f in added if f['mechanics']['level']==e['mechanics']['level']]
            e['fieldSources']['concreteAlternativeIds']=[0]
            continue
        if e['name'] not in core:continue
        pages,it,effect,summary=core[e['name']]
        e.update(nameIt=it,summaryIt=summary,translation={'language':'it','status':'assistant-translation'})
        e['sources'].append(source(pages,e['name']));e['mechanics']['effect']=dict(effect)
        e['fieldSources']['effect']=[len(e['sources'])-1]
        e['verification'].update(complete=True,missingFields=[])
        if e['name']=='Spellcasting':e['sources'][-1]['verification']='read-local-render'
        if e['name']=='Expertise' and e['mechanics']['level']==10:
            e['mechanics']['effect']['additionalSelectionAtBardLevel']=None
    for sub in ['lore','valor']:
        parent=by_id['phb2014:subclass:'+sub]
        fs=[f for f in added if f['relations']['subclassId']==parent['id']]
        parent['relations']['featureIds']=[f['id'] for f in fs]
        parent['mechanics']['featureLevels']=[3,6,14];parent['fieldSources']['featureLevels']=[0]
        parent['verification'].update(complete=True,missingFields=[])
        parent['summaryIt']=' '.join(f['summaryIt'] for f in fs)
    return entities
