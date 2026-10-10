"""Individual PHB passages read in full; Italian summaries and typed effects.

Only these reviews may promote OCR fields. No mechanical data are copied from
the application catalog. Class lists were read on PDF 208–212.
"""
from curated import source
from spell_reviews_batch import ROWS as BATCH_ROWS

ROWS = [
 ('Counterspell','Controincantesimo',229,3,'abjuration','reaction','60 feet',['S'],'Instantaneous',False,False,['sorcerer','warlock','wizard'],None,None,
  {'trigger':'see-creature-within-60-ft-casting-spell','automaticCounterMaximumLevel':'slot-used','higherSpellCheck':{'ability':'castingAbility','DC':'10+target-spell-level'},'success':'target-spell-fails-no-effect'},
  {'kind':'automatic-counter-threshold','threshold':'slot-level'},'Interrompi il lancio visibile: se il livello supera lo slot usato, serve una prova della caratteristica da incantatore contro CD 10 più livello della magia.'),
 ('Cure Wounds','Cura Ferite',231,1,'evocation','action','Touch',['V','S'],'Instantaneous',False,False,['bard','cleric','druid','paladin','ranger'],None,None,
  {'target':'touched-creature','healing':'1d8+castingAbilityModifier','excludedCreatureTypes':['undead','construct']},
  {'kind':'per-slot-above-base','base':1,'healingAdditionalDice':'1d8'},'La creatura toccata recupera 1d8 più il modificatore da incantatore; non funziona su non morti e costrutti.'),
 ('Detect Magic','Individuazione del Magico',232,1,'divination','action','Self',['V','S'],'Concentration, up to 10 minutes',True,True,['bard','cleric','druid','paladin','ranger','sorcerer','wizard'],None,None,
  {'senseRadiusFt':30,'auraInspection':'action-on-visible-magical-creature-or-object','learnSchoolIfAny':True,'blockedBy':{'stoneFt':1,'commonMetalInches':1,'lead':'thin-sheet','woodOrDirtFt':3}},
  {'kind':'not-stated'},'Percepisci la magia vicina; un’azione rivela aura e scuola di un bersaglio visibile. Alcuni materiali bloccano il rilevamento.'),
 ('Eldritch Blast','Deflagrazione Occulta',238,0,'evocation','action','120 feet',['V','S'],'Instantaneous',False,False,['warlock'],None,None,
  {'target':'creature-per-beam','attack':'ranged-spell','damagePerBeam':'1d10','damageType':'force','beamsByCharacterLevel':{'1':1,'5':2,'11':3,'17':4},'separateAttackRolls':True,'canSplitTargets':True},
  {'kind':'character-level-scaling'},'Ogni raggio richiede un attacco separato e infligge 1d10 forza; aumentano i raggi ai livelli totali 5, 11 e 17.'),
 ('Fireball','Palla di Fuoco',[242,243],3,'evocation','action','150 feet',['V','S','M'],'Instantaneous',False,False,['sorcerer','wizard'],'Una piccola sfera di guano di pipistrello e zolfo',None,
  {'area':{'shape':'sphere','radiusFt':20,'center':'point-in-range'},'save':'dexterity','damage':'8d6','damageType':'fire','successfulSave':'half','spreadsAroundCorners':True,'ignites':'flammable-objects-not-worn-or-carried'},
  {'kind':'per-slot-above-base','base':3,'damageAdditionalDice':'1d6'},'Una sfera di raggio 20 piedi infligge 8d6 fuoco, dimezzati con TS di Destrezza. Le fiamme aggirano gli angoli e incendiano oggetti infiammabili non portati.'),
 ('Goodberry','Bacche Benefiche',247,1,'transmutation','action','Touch',['V','S','M'],'Instantaneous',False,False,['druid','ranger'],'Un ramoscello di vischio',None,
  {'maximumBerries':10,'eatActivation':'action','healingPerBerry':1,'nourishmentDaysPerBerry':1,'potencyHours':24},
  {'kind':'not-stated'},'Crei fino a dieci bacche: mangiarne una usa un’azione, cura un PF e nutre per un giorno. Perdono efficacia dopo 24 ore.'),
 ('Healing Word','Parola Guaritrice',251,1,'evocation','bonus-action','60 feet',['V'],'Instantaneous',False,False,['bard','cleric','druid'],None,None,
  {'target':'one-visible-creature','healing':'1d4+castingAbilityModifier','excludedCreatureTypes':['undead','construct']},
  {'kind':'per-slot-above-base','base':1,'healingAdditionalDice':'1d4'},'Una creatura visibile recupera 1d4 più il modificatore da incantatore; usa un’azione bonus e non funziona su non morti o costrutti.'),
 ('Identify','Identificare',253,1,'divination','minute','Touch',['V','S','M'],'Instantaneous',True,False,['bard','wizard'],'Una perla da almeno 100 mo e una piuma di gufo',100,
  {'touchThroughoutCasting':True,'objectInformation':['properties','use','attunement-requirement','charges','affecting-spells','creating-spell-if-any'],'creatureInformation':['affecting-spells']},
  {'kind':'not-stated'},'Mantieni il contatto durante il lancio: conosci proprietà e uso di un oggetto magico, oppure gli incantesimi che agiscono sulla creatura toccata.'),
 ('Mage Armor','Armatura Magica',257,1,'abjuration','action','Touch',['V','S','M'],'8 hours',False,False,['sorcerer','wizard'],'Un frammento di cuoio conciato',None,
  {'target':'willing-creature-not-wearing-armor','baseArmorClass':'13+dexterityModifier','endsWhen':['target-dons-armor','caster-dismisses-with-action']},
  {'kind':'not-stated'},'La CA base del bersaglio consenziente senza armatura diventa 13 più Destrezza; termina se indossa armatura o la congedi con un’azione.'),
 ('Magic Missile','Dardo Incantato',258,1,'evocation','action','120 feet',['V','S'],'Instantaneous',False,False,['sorcerer','wizard'],None,None,
  {'darts':3,'damagePerDart':'1d4+1','damageType':'force','target':'visible-creature-per-dart','automaticHit':True,'simultaneous':True,'canSplitTargets':True,'damageRollInterpretation':None},
  {'kind':'per-slot-above-base','base':1,'additionalDarts':1},'Tre dardi colpiscono simultaneamente creature visibili a scelta, infliggendo ciascuno 1d4 più 1 forza. Il numero di tiri del danno resta da interpretare con le regole generali.'),
 ('Misty Step','Passo Velato',261,2,'conjuration','bonus-action','Self',['V'],'Instantaneous',False,False,['sorcerer','warlock','wizard'],None,None,
  {'teleportMaximumFt':30,'destination':'visible-unoccupied-space'},
  {'kind':'not-stated'},'Ti teletrasporti fino a 30 piedi in uno spazio libero che puoi vedere, usando un’azione bonus.'),
 ('Revivify','Rinascita',273,3,'conjuration','action','Touch',['V','S','M'],'Instantaneous',False,False,['cleric','paladin'],'Diamanti per un valore di 300 mo',300,
  {'diedWithinMinutes':1,'returnsWithHitPoints':1,'cannotRestore':['death-from-old-age','missing-body-parts'],'materialConsumed':True},
  {'kind':'not-stated'},'Una creatura morta da non oltre un minuto torna con un PF; i diamanti vengono consumati. Non rimedi a vecchiaia o parti del corpo mancanti.'),
 ('Shield','Scudo',276,1,'abjuration','reaction','Self',['V','S'],'1 round',False,False,['sorcerer','wizard'],None,None,
  {'triggerChoice':['hit-by-attack','targeted-by-magic-missile'],'armorClassBonus':5,'includesTriggeringAttack':True,'preventsDamageFrom':'magic-missile','expires':'start-of-next-turn'},
  {'kind':'not-stated'},'Con una reazione ottieni +5 alla CA anche contro il colpo scatenante, fino al prossimo turno, e annulli i danni di Dardo Incantato.'),
 ('Sleep','Sonno',277,1,'enchantment','action','90 feet',['V','S','M'],'1 minute',False,False,['bard','sorcerer','wizard'],'Sabbia fine, petali di rosa oppure un grillo',None,
  {'hitPointBudget':'5d8','radiusFt':20,'center':'point-in-range','order':'ascending-current-hit-points','skipAlreadyUnconscious':True,'requires':'target-hit-points-at-most-remaining-budget','condition':'unconscious','endsEarlyWhen':['damage','another-creature-wakes-with-action'],'excludedCreatureTypes':['undead'],'excludesImmunity':'charmed'},
  {'kind':'per-slot-above-base','base':1,'budgetAdditionalDice':'2d8'},'Spendi un totale di 5d8 PF sui bersagli in ordine crescente di PF attuali; non morti e immuni all’essere affascinati sono esclusi.'),
]


CLASS_PAGES={'bard':[208,209],'cleric':[208,209],'druid':[209],'paladin':[209,210],'ranger':[210],
             'sorcerer':[210,211],'warlock':[211],'wizard':[211,212]}


def apply_reviews(spells):
    by_name={s['name']:s for s in spells}
    for name,it,pages,level,school,activation,rng,components,duration,ritual,conc,classes,material,cost,effect,upcast,summary in [*ROWS,*BATCH_ROWS]:
        s=by_name[name]
        s['nameIt']=it;s['translation']={'status':'assistant-translation','language':'it'}
        s['summaryIt']=summary
        quantity,unit=activation if isinstance(activation,tuple) else (1,activation)
        s['mechanics'].update(level=level,school=school,castingTime=str(quantity)+' '+unit.replace('-',' '),casting={'quantity':quantity,'unit':unit},
          range=rng,components=components,duration=duration,ritual=ritual,concentration=conc,
          materialIt=material,materialCostGP=cost,materialCostStatus='minimum-stated' if cost is not None else 'no-cost-specified' if material else 'not-applicable',
          materialConsumed=effect.get('materialConsumed',False) if material else None,
          materialConsumptionStatus='explicitly-consumed' if effect.get('materialConsumed') else 'not-stated' if material else 'not-applicable',
          effect=effect,upcast=upcast,classes=classes)
        s['sources']=[source(pages,name)]
        s['sources'].append({**source(sorted({page for cls in classes for page in CLASS_PAGES[cls]}),'Spell Lists'),'verification':'read-local-render'})
        s['fieldSources']={k:[0] for k in s['mechanics']};s['fieldSources']['classes']=[1]
        if material and not effect.get('materialConsumed'):
            s['sources'].append(source(204,'Components'))
            s['fieldSources']['materialConsumed']=[0,2]
            s['interpretations'].append({'field':'materialConsumed','kind':'derived','method':'No consumption specified in this spell; apply general component rule, PHB PDF 204.'})
        s['relations']={'classIds':['phb2014:class:'+cls for cls in classes]}
        s['verification'].update(identity='verified',mechanics='verified-fields',complete=name!='Magic Missile',missingFields=['effect.damageRollInterpretation'] if name=='Magic Missile' else [])
        s['extraction']['requiresReview']=name=='Magic Missile'
        s['extraction']['fieldStatus']={k:'verified' for k in s['mechanics']}
        s['extraction']['fieldStatus']['effect.damageRollInterpretation']='interpretation-pending' if name=='Magic Missile' else 'not-applicable'
    return spells
