"""PHB PDF 77–82 read, progression 78 and ki table/disciplines 81–82 rendered.

The actual PDF already includes the final Deflect Missiles sentence quoted by
PH-Errata PDF 1, but supplies no explicit returned-missile range. Keep that open.
"""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:monk'
ELEMENTS='phb2014:subclass:four-elements'
DISCIPLE='phb2014:subclass-feature:four-elements-3-disciple-of-the-elements'
SPELL_DISCIPLINES=[
 ('Breath of Winter','Soffio dell’Inverno',17,6,'cone-of-cold',False),
 ('Clench of the North Wind','Stretta del Vento del Nord',6,3,'hold-person',False),
 ('Eternal Mountain Defense','Difesa della Montagna Eterna',11,5,'stoneskin',True),
 ('Fist of Four Thunders','Pugno dei Quattro Tuoni',3,2,'thunderwave',False),
 ('Flames of the Phoenix','Fiamme della Fenice',11,4,'fireball',False),
 ('Gong of the Summit','Gong della Vetta',6,3,'shatter',False),
 ('Mist Stance','Posizione della Nebbia',11,4,'gaseous-form',True),
 ('Ride the Wind','Cavalcare il Vento',11,4,'fly',True),
 ('River of Hungry Flame','Fiume di Fiamme Affamate',17,5,'wall-of-fire',False),
 ('Rush of the Gale Spirits','Impeto degli Spiriti della Burrasca',3,2,'gust-of-wind',False),
 ('Sweeping Cinder Strike','Colpo di Cenere Travolgente',3,2,'burning-hands',False),
 ('Wave of Rolling Earth','Onda di Terra Rotolante',17,6,'wall-of-stone',False),
]


def apply_monk_reviews(entities):
    by_id={e['id']:e for e in entities};added=[]
    def discipline(name,it,level,cost,effect,summary):
        missing=['spellDescription:'+effect['spellId']] if effect.get('spellId') and not by_id[effect['spellId']]['verification']['complete'] else []
        e=record('class-option','monk-'+slug(name),name,it,82,{'optionType':'monk-discipline','minimumMonkLevel':level,'baseKiCost':cost,
          'prerequisites':{},'effect':effect,'selectionOrigins':[{'originId':DISCIPLE,'classId':CLASS,'minimumClassLevel':level,'subclassId':ELEMENTS}]},summary,missing=missing)
        e['sources'][0]['verification']='read-local-render';e['sources'].append(source(81,'Casting Elemental Spells'));e['fieldSources']['effect']=[0,1]
        e['relations']={'classId':CLASS,'subclassId':ELEMENTS,'parentFeatureId':DISCIPLE}
        if effect.get('spellId'):e['relations']['grantedSpellIds']=[effect['spellId']]
        added.append(e)
    for name,it,level,cost,spell,self_only in SPELL_DISCIPLINES:
        discipline(name,it,level,cost,{'spellId':'phb2014:spell:'+spell,'targetSelfOnly':self_only,'materialComponentsRequired':False,'usesSpellCastingTimeAndOtherRules':True},
          f'Con {cost} punti ki lanci la magia collegata senza materiali, rispettandone le altre regole.'+(' Bersaglia soltanto te stesso.' if self_only else ''))
    discipline('Elemental Attunement','Sintonia Elementale',3,0,{'activation':'action','rangeFt':None,'rangePrinting':'nearby',
       'chooseOne':[{'effect':'harmless-instantaneous-elemental-sensory-effect'}, {'effect':'instantaneously-light-or-snuff-candle-torch-small-campfire'},
       {'effect':'chill-or-warm-nonliving-material','maximumWeightLb':1,'durationHours':1},
       {'effect':'crude-shape-earth-fire-water-mist','maximumCubeSideFt':1,'durationMinutes':1}]},
       'Con un’azione produci un effetto elementale innocuo, accendi o spegni una piccola fiamma, cambi temperatura di una libbra di materiale per un’ora o modelli un cubo di un piede per un minuto. La prima stampa dice nelle vicinanze; l’erratum precisa trenta piedi.')
    discipline('Fangs of the Fire Snake','Zanne del Serpente di Fuoco',3,1,{'trigger':'take-Attack-action-on-own-turn','unarmedStrikeReachBonusFt':10,
       'duration':'that-action-and-rest-of-current-turn','unarmedStrikeDamageType':'fire-instead-of-bludgeoning',
       'optionalAdditionalKiOnHit':1,'additionalDamageIfPaid':'1d10','additionalDamageType':'fire'},
       'Spendendo un ki con l’azione Attaccare estendi di dieci piedi i colpi senz’armi e li rendi di fuoco per il turno. Ogni colpo può ricevere 1d10 fuoco aggiuntivo pagando un altro ki quando colpisce.')
    discipline('Fist of Unbroken Air','Pugno dell’Aria Indomita',3,2,{'activation':'action','target':'one-creature-within-30-ft','save':'strength',
       'damage':'3d10','damageType':'bludgeoning','additionalDamagePerExtraKi':'1d10',
       'failedSaveMay':{'pushAwayMaximumFt':20,'knockProne':True},'successfulSave':{'damage':'half','pushOrProne':False},'isSpell':False},
       'Un’azione e due ki infliggono 3d10 contundenti con TS Forza; ogni ki extra aggiunge 1d10. Se fallisce puoi spingere fino a venti piedi e rendere prono; il successo dimezza e impedisce entrambi gli effetti. Non è un incantesimo.')
    discipline('Shape the Flowing River','Modellare il Fiume Fluente',3,1,{'activation':'action','rangeFt':120,'maximumAreaSideFt':30,
       'effects':['water-to-ice','ice-to-water','reshape-ice'],'maximumChangeDimension':'half-largest-area-dimension',
       'mayTrapOrInjureCreatures':False},'Con un’azione e un ki cambi ghiaccio e acqua entro centoventi piedi, in un’area fino a trenta per lato. Modelli ghiaccio con variazioni fino a metà del lato maggiore, senza intrappolare o ferire creature.')
    discipline('Water Whip','Frusta d’Acqua',3,2,{'activation':'bonus-action','target':'visible-creature-within-30-ft','save':'dexterity',
       'damage':'3d10','damageType':'bludgeoning','additionalDamagePerExtraKi':'1d10','failedSaveChooseOne':['prone','pull-up-to-25-ft-closer'],
       'successfulSave':{'damage':'half','pullOrProne':False},'isSpell':False},'Due ki e un’azione bonus nella prima stampa infliggono 3d10 contundenti con TS Destrezza; i ki extra aggiungono 1d10. Puoi rendere prono o tirare di venticinque piedi chi fallisce; il successo dimezza senza movimento. Le errata richiedono un’azione.')
    rows=[
      ('open-hand',3,'Open Hand Technique','Tecnica della Mano Aperta',[80],{'trigger':'hit-with-one-Flurry-of-Blows-attack','chooseOne':[
       {'save':'dexterity','failure':'prone'},{'save':'strength','failure':'push-up-to-15-ft-away'},
       {'effect':'target-cannot-take-reactions','expires':'end-of-own-next-turn','saveRequired':False}]},'Ogni colpo di Raffica può imporre caduta con TS Destrezza, spinta fino a quindici piedi con TS Forza oppure blocco delle reazioni fino alla fine del tuo prossimo turno senza TS.'),
      ('open-hand',6,'Wholeness of Body','Integrità del Corpo',[80,81],{'activation':'action','healsSelf':'3*monkLevel','resource':{'uses':1,'recovery':['long-rest']}},'Un’azione cura tre PF per livello da monaco su te stesso, una volta per riposo lungo.'),
      ('open-hand',11,'Tranquility','Tranquillità',[81],{'trigger':'finish-long-rest','spellEffects':'phb2014:spell:sanctuary','expires':'start-of-own-next-long-rest','canEndEarlyBySpellRules':True,'saveDC':'8+proficiencyBonus+wisdomModifier'},'Al termine del riposo lungo ricevi Santuario fino all’inizio del prossimo riposo lungo, con CD basata su Saggezza e competenza; valgono le condizioni di interruzione della magia.'),
      ('open-hand',17,'Quivering Palm','Palmo Tremante',[81],{'trigger':'hit-creature-with-unarmed-strike','kiCost':3,'maximumDurationDays':'monkLevel',
       'maximumAffectedCreatures':1,'detonateActivation':'action','detonateRequires':'same-plane-as-target','save':'constitution','failedSave':'target-zero-hp',
       'successfulSaveDamage':'10d10','damageType':'necrotic','endHarmlesslyRequiresAction':False},'Dopo un colpo senz’armi tre ki preparano vibrazioni su una sola creatura per giorni pari al livello da monaco. Una tua azione sullo stesso piano le fa fare TS Costituzione: fallimento zero PF, successo 10d10 necrotici. Puoi terminarle innocuamente senza azione.'),
      ('shadow',3,'Shadow Arts','Arti dell’Ombra',[81],{'activation':'action','kiCostPerSpell':2,'spellIds':['phb2014:spell:'+s for s in ['darkness','darkvision','pass-without-trace','silence']],
       'materialComponentsRequired':False,'additionalCantripIfNotAlreadyKnown':'phb2014:spell:minor-illusion'},'Due ki e un’azione lanciano Oscurità, Scurovisione, Passare senza Tracce o Silenzio senza materiali. Impari Illusione Minore se non già conosciuta.'),
      ('shadow',6,'Shadow Step','Passo nell’Ombra',[81],{'activation':'bonus-action','origin':'dim-light-or-darkness','destination':'visible-unoccupied-space-in-dim-light-or-darkness',
       'maximumDistanceFt':60,'advantageOn':'first-melee-attack-before-end-of-current-turn'},'Da luce fioca o oscurità ti teletrasporti con azione bonus fino a sessanta piedi verso uno spazio visibile non occupato altrettanto oscuro. Vantaggio al primo attacco in mischia entro fine turno.'),
      ('shadow',11,'Cloak of Shadows','Manto delle Ombre',[81],{'activation':'action','requires':'dim-light-or-darkness','effect':'invisible','endsWhen':['make-attack','cast-spell','in-bright-light']},'Un’azione in luce fioca o oscurità ti rende invisibile finché non attacchi, lanci una magia o ti trovi in luce intensa.'),
      ('shadow',17,'Opportunist','Opportunista',[81],{'trigger':'creature-within-5-ft-is-hit-by-another-creature-attack','activation':'reaction','attack':'one-melee-attack-against-hit-creature'},'Quando qualcun altro colpisce una creatura entro cinque piedi, puoi reagire con un attacco in mischia contro la creatura colpita.'),
    ]
    for sub,level,name,it,pages,effect,summary in rows:
        e=record('subclass-feature',f'{sub}-{level}-'+slug(name),name,it,pages,{'level':level,'effect':effect},summary)
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub};added.append(e)
    choices=[e['id'] for e in added if e['kind']=='class-option']
    for level in [3,6,11,17]:
        effect={'initialDisciplineId':'phb2014:class-option:monk-elemental-attunement' if level==3 else None,'chooseAdditionalDiscipline':1,
          'replacementOnLearning':1,'replacementMayBeAnyKnownDiscipline':True,'disciplineIds':choices,'maximumKnownByMonkLevel':{'3':2,'6':3,'11':4,'17':5},
          'spellCasting':{'materialComponentsRequired':False,'usesCastingTimeAndOtherSpellRules':True,'upcastMinimumMonkLevel':5,
             'extraKiPerExtraSpellLevel':1,'upcastRequires':'spell-has-enhanced-higher-level-effect','maximumKiPerSpellByMonkLevel':{'5':3,'9':4,'13':5,'17':6},
             'capAppliesToNonspellDisciplines':False}}
        e=record('subclass-feature',f'four-elements-{level}-disciple-of-the-elements','Disciple of the Elements','Discepolo degli Elementi',[81,82],{'level':level,'effect':effect},
           'Apprendi una disciplina e puoi sostituirne una conosciuta; al livello 3 ricevi anche Sintonia Elementale. Magie senza materiali, potenziabili dal 5 se previsto dal loro testo. Il limite totale di ki per magia cresce da tre a sei; non limita le discipline che non sono incantesimi.')
        e['sources'][0]['verification']='read-local-render';e['relations']={'classId':CLASS,'subclassId':ELEMENTS};added.append(e)
    entities.extend(added)
    core={
      'Unarmored Defense':(79,'Difesa Senza Armatura',{'requires':['no-armor','no-shield'],'armorClass':'10+dexterityModifier+wisdomModifier'},'Senza armatura né scudo, CA pari a dieci più Destrezza e Saggezza.'),
      'Martial Arts':([78,79],'Arti Marziali',{'requires':['unarmed-or-only-monk-weapons','no-armor','no-shield'],
       'monkWeaponChoices':['shortsword','simple-melee-without-heavy-or-two-handed-property'],'mayUseDexterityInsteadOfStrengthFor':['attack-roll','damage-roll'],
       'mayReplaceDamageDieByMonkLevel':{'1':'1d4','5':'1d6','11':'1d8','17':'1d10'},
       'bonusUnarmedStrikeTrigger':'own-turn-Attack-action-with-unarmed-strike-or-monk-weapon','bonusUnarmedStrikes':1},'Senza armatura o scudo e usando colpi senz’armi o armi da monaco, puoi usare Destrezza, il dado delle Arti Marziali e un colpo senz’armi bonus dopo l’azione Attaccare. Armi ammesse: spada corta e armi semplici da mischia prive di Pesante e Due Mani.'),
      'Ki':(79,'Ki',{'maximum':'monkLevel','recovery':['short-rest','long-rest'],'minimumRestMeditationMinutes':30,'saveDC':'8+proficiencyBonus+wisdomModifier',
       'options':{'flurryOfBlows':{'kiCost':1,'activation':'bonus-action','timing':'immediately-after-own-turn-Attack-action','unarmedStrikes':2},
       'patientDefense':{'kiCost':1,'activation':'bonus-action-on-own-turn','action':'Dodge'},
       'stepOfTheWind':{'kiCost':1,'activation':'bonus-action-on-own-turn','chooseAction':['Dash','Disengage'],'jumpDistanceMultiplierForTurn':2}}},'Ki pari al livello da monaco, recuperato dopo riposo breve o lungo con almeno trenta minuti di meditazione. Un punto alimenta Raffica di due colpi dopo Attaccare, Schivata bonus oppure Scatto/Disimpegno bonus con salto doppio nel turno.'),
      'Unarmored Movement':([78,79],'Movimento Senza Armatura',{'requires':['no-armor','no-shield'],'speedBonusFtByMonkLevel':{'2':10,'6':15,'10':20,'14':25,'18':30},
       'fromMonk9':'move-along-vertical-surfaces-and-across-liquids-on-own-turn-without-falling-during-move'},'Senza armatura né scudo, la velocità aumenta da dieci a trenta piedi. Dal livello 9 percorri superfici verticali e liquidi nel tuo turno senza cadere durante il movimento.'),
      'Monastic Tradition':(79,'Tradizione Monastica',{'chooseSubclass':1,'subclassIds':['phb2014:subclass:'+s for s in ['open-hand','shadow','four-elements']],'featureLevels':[3,6,11,17]},'Scegli Mano Aperta, Ombra o Quattro Elementi; privilegi ai livelli 3, 6, 11 e 17.'),
      'Deflect Missiles':(79,'Deviare Proiettili',{'activation':'reaction','trigger':'hit-by-ranged-weapon-attack','damageReduction':'1d10+dexterityModifier+monkLevel',
       'catchRequires':['damage-reduced-to-zero','missile-fits-one-hand','at-least-one-free-hand'],
       'returnAttack':{'kiCost':1,'timing':'same-reaction','kind':'ranged-attack-with-caught-weapon-or-ammunition','proficient':True,'countsAsMonkWeapon':True,'explicitRangeFt':None}},'Una reazione riduce il danno di un attacco con arma a distanza di 1d10 più Destrezza e livello da monaco. A zero puoi afferrare un proiettile piccolo con una mano libera, e con un ki contrattaccare nella stessa reazione con competenza e arma da monaco. Il PDF non specifica la gittata del contrattacco.'),
      'Slow Fall':(79,'Caduta Lenta',{'activation':'reaction-when-falling','fallingDamageReduction':'5*monkLevel'},'Una reazione alla caduta riduce i danni di cinque per livello da monaco.'),
      'Extra Attack':(80,'Attacco Extra',{'attackActionAttacks':2,'requires':'own-turn'},'Con l’azione Attaccare nel tuo turno effettui due attacchi.'),
      'Stunning Strike':(80,'Colpo Stordente',{'trigger':'hit-another-creature-with-melee-weapon-attack','kiCost':1,'save':'constitution','failure':'stunned','expires':'end-of-own-next-turn'},'Dopo un colpo con attacco con arma in mischia spendi un ki: TS Costituzione o stordito fino alla fine del tuo prossimo turno.'),
      'Ki-Empowered Strikes':(80,'Colpi Potenziati dal Ki',{'unarmedStrikesMagicalFor':'resistance-and-immunity-to-nonmagical-attacks-and-damage'},'I colpi senz’armi contano come magici contro resistenze e immunità ad attacchi e danni non magici.'),
      'Evasion':(80,'Elusione',{'trigger':'Dexterity-save-to-take-half-damage','successfulSaveDamageMultiplier':0,'failedSaveDamageMultiplier':0.5},'Se un TS Destrezza normalmente dimezza il danno, il successo lo annulla e il fallimento lo dimezza.'),
      'Stillness of Mind':(80,'Quiete della Mente',{'activation':'action','endsEffects':1,'effectMust':'cause-self-charmed-or-frightened'},'Un’azione termina un effetto che ti rende affascinato o spaventato; non concede azioni quando un altro effetto le vieta.'),
      'Purity of Body':(80,'Purezza del Corpo',{'immunities':['disease','poison']},'Sei immune a malattie e veleno.'),
      'Tongue of the Sun and Moon':(80,'Lingua del Sole e della Luna',{'understands':'all-spoken-languages','understoodBy':'any-creature-that-understands-a-language','understandsWrittenLanguagesGranted':False},'Comprendi tutte le lingue parlate e sei compreso da chi capisce una lingua. Non è concessa lettura universale.'),
      'Diamond Soul':(80,'Anima Adamantina',{'savingThrowProficiency':'all','failedSaveReroll':{'kiCost':1,'mustUseSecondRoll':True}},'Ottieni competenza in tutti i TS e puoi spendere un ki dopo un fallimento per ritirare, usando il secondo risultato.'),
      'Timeless Body':(80,'Corpo Senza Tempo',{'oldAgeFrailty':False,'magicalAgingPossible':False,'canDieOfOldAge':True,'needsFoodOrWater':False},'Non subisci fragilità dell’età né invecchiamento magico e non hai bisogno di cibo o acqua, ma puoi morire di vecchiaia.'),
      'Empty Body':(80,'Corpo Vuoto',{'invisibility':{'activation':'action','kiCost':4,'durationMinutes':1,'resistanceTo':'all-damage-except-force','concentrationRequired':False},
       'astralProjection':{'spellId':'phb2014:spell:astral-projection','kiCost':8,'materialComponentsRequired':False,'mayTakeOtherCreatures':False,'usesSpellCastingTime':True}},'Con un’azione e quattro ki diventi invisibile per un minuto e resisti a tutti i danni salvo forza. Otto ki lanciano Proiezione Astrale senza materiali e senza altri passeggeri, rispettando il suo tempo di lancio.'),
      'Perfect Self':(80,'Perfezione Interiore',{'trigger':'roll-initiative-with-zero-ki-remaining','regainKi':4},'Se tiri iniziativa senza ki ne recuperi quattro.'),
    }
    for e in entities:
        if e['kind']!='class-feature' or e['relations']['classId']!=CLASS:continue
        if e['name']=='Subclass Feature':
            e['mechanics']['concreteAlternativeIds']=[f['id'] for f in added if f['kind']=='subclass-feature' and f['mechanics']['level']==e['mechanics']['level']];e['fieldSources']['concreteAlternativeIds']=[0];continue
        if e['name'] not in core:continue
        pages,it,effect,summary=core[e['name']]
        e.update(nameIt=it,summaryIt=summary,translation={'language':'it','status':'assistant-translation'})
        e['sources'].append(source(pages,e['name']));e['mechanics']['effect']=effect;e['fieldSources']['effect']=[len(e['sources'])-1]
        missing=['returnAttackRangeInterpretation'] if e['name']=='Deflect Missiles' else []
        e['verification'].update(complete=not missing,missingFields=missing)
        if e['name']=='Deflect Missiles':
            e['interpretations'].append({'field':'effect.returnAttack.explicitRangeFt','kind':'not-stated-in-local-printing','method':'PDF 79 render contains the proficiency/monk-weapon sentence already; no 20/60 range is printed. No range imported from another printing or edition.'})
            e['sourceDifferences']=[{'field':'effect.returnAttack.explicitRangeFt','thisPrintingValue':None,'otherSource':source([35,36],'Deviare Proiettili','srd51-it'),'otherValue':{'normal':6,'long':18,'unit':'m'},'verification':'read-local-text','status':'verified-2014-SRD-difference-not-an-editorial-erratum','appliedToPHBPrinting':False}]
    for sub in ['open-hand','shadow','four-elements']:
        e=by_id['phb2014:subclass:'+sub];fs=[f for f in added if f['kind']=='subclass-feature' and f['relations']['subclassId']==e['id']]
        e['relations']['featureIds']=[f['id'] for f in fs];e['summaryIt']=' '.join(f['summaryIt'] for f in fs)
        missing=['discipline:'+f['id'] for f in added if f['kind']=='class-option' and not f['verification']['complete']] if sub=='four-elements' else []
        e['verification'].update(complete=not missing,missingFields=missing)
    return entities
