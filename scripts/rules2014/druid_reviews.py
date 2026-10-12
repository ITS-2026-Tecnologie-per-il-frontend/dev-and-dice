"""PHB PDF 65–70 read in full, including Archdruid continuation on PDF 69.

Progression and eight Circle of the Land tables inspected on PDF 66/69 renders.
Spell grants verify list membership, not unreviewed descriptions.
"""
from curated import record, source
from spell_extract import slug

CLASS='phb2014:class:druid'
LAND='phb2014:subclass:land'
MOON='phb2014:subclass:moon'
ELEMENTALS=['mm2014:creature:'+kind+'-elemental' for kind in ['air','earth','fire','water']]
LAND_SPELLS={
 'arctic':['Hold Person','Spike Growth','Sleet Storm','Slow','Freedom of Movement','Ice Storm','Commune with Nature','Cone of Cold'],
 'coast':['Mirror Image','Misty Step','Water Breathing','Water Walk','Control Water','Freedom of Movement','Conjure Elemental','Scrying'],
 'desert':['Blur','Silence','Create Food and Water','Protection from Energy','Blight','Hallucinatory Terrain','Insect Plague','Wall of Stone'],
 'forest':['Barkskin','Spider Climb','Call Lightning','Plant Growth','Divination','Freedom of Movement','Commune with Nature','Tree Stride'],
 'grassland':['Invisibility','Pass without Trace','Daylight','Haste','Divination','Freedom of Movement','Dream','Insect Plague'],
 'mountain':['Spider Climb','Spike Growth','Lightning Bolt','Meld into Stone','Stone Shape','Stoneskin','Passwall','Wall of Stone'],
 'swamp':['Darkness',"Melf's Acid Arrow",'Water Walk','Stinking Cloud','Freedom of Movement','Locate Creature','Insect Plague','Scrying'],
 'underdark':['Spider Climb','Web','Gaseous Form','Stinking Cloud','Greater Invisibility','Stone Shape','Cloudkill','Insect Plague'],
}
TERRAIN_IT=dict(zip(LAND_SPELLS,['Artico','Costa','Deserto','Foresta','Prateria','Montagna','Palude','Sottosuolo'],strict=True))


def apply_druid_reviews(entities):
    by_id={e['id']:e for e in entities}
    choices={land:[{'druidLevel':3+2*(i//2),'spellId':'phb2014:spell:'+slug(name),
                   'alwaysPrepared':True,'countsAgainstPreparedLimit':False,'countsAsDruidSpell':True}
                  for i,name in enumerate(names)] for land,names in LAND_SPELLS.items()}
    rows=[
      ('land',2,'Bonus Cantrip','Trucchetto Bonus',69,{'choose':1,'fromList':'druid-cantrips','additionalToBaseClass':True},'Impari un trucchetto da druido aggiuntivo a scelta.'),
      ('land',2,'Natural Recovery','Recupero Naturale',69,{'trigger':'finish-short-rest','resource':{'uses':1,'recovery':['long-rest']},
       'recoverSlotLevelBudget':'ceil(druidLevel/2)','maximumRecoverableSlotLevel':5},'Durante un riposo breve recuperi slot per un valore totale fino a metà del livello da druido arrotondata in alto; nessuno slot dal sesto livello. Riutilizzabile dopo riposo lungo.'),
      ('land',2,'Circle Spells','Incantesimi del Circolo',69,{'chooseTerrain':1,'landChoices':choices,
       'terrainNamesIt':TERRAIN_IT,'unlocksAtDruidLevels':[3,5,7,9],'listMembershipReview':'read-local-render',
       'spellDescriptionsVerifiedByThisReview':False},'Scegli il territorio d’iniziazione; le coppie di magie arrivano ai livelli 3, 5, 7 e 9. Sono sempre preparate, senza occupare il limite giornaliero, e contano come magie da druido anche se provengono da altre liste.'),
      ('land',6,"Land's Stride",'Andatura sul Territorio',70,{'ignoresMovementCost':'nonmagical-difficult-terrain',
       'nonmagicalPlants':'no-slowing-and-no-damage-from-thorns-spines-or-similar',
       'saveAdvantageAgainst':'magically-created-or-manipulated-plants-that-impede-movement'},'Terreno difficile e piante non magiche non ti rallentano; spine e simili non ti danneggiano. Hai vantaggio ai TS contro piante magiche che ostacolano il movimento.'),
      ('land',10,"Nature's Ward",'Protezione della Natura',70,{'cannotBeCharmedOrFrightenedBy':['elemental','fey'],
       'immunity':['poison','disease']},'Elementali e folletti non possono affascinarti o spaventarti; sei immune a veleno e malattie.'),
      ('land',14,"Nature's Sanctuary",'Santuario della Natura',70,{'trigger':'beast-or-plant-attacks-self',
       'attackerAwareBeforeAttack':True,'save':'wisdom','saveDC':'druid-spell-save-DC',
       'failure':'choose-another-target-or-attack-automatically-misses','successImmunityHours':24},'Prima di attaccarti una bestia o pianta fa TS Saggezza: se fallisce sceglie un altro bersaglio o manca automaticamente; se riesce è immune per ventiquattro ore.'),
      ('moon',2,'Combat Wild Shape','Forma Selvatica da Combattimento',70,{'wildShapeActivation':'bonus-action-on-own-turn',
       'whileWildShapedHealing':{'activation':'bonus-action','cost':'one-spell-slot','healing':'slotLevel*d8'}},'Puoi trasformarti con un’azione bonus nel tuo turno. Mentre sei trasformato, un’azione bonus e uno slot recuperano 1d8 PF per livello dello slot.'),
      ('moon',2,'Circle Forms','Forme del Circolo',70,{'maximumBeastCRByDruidLevel':{str(level):1 if level<6 else level//3 for level in range(2,21)},
       'swimmingAndFlyingLimits':'unchanged-base-Wild-Shape','previouslySeenRequired':True},'Il limite è GS 1 dal livello 2; dal livello 6 è il livello da druido diviso tre arrotondato in basso. Restano i vincoli di nuoto, volo e bestia già vista.'),
      ('moon',6,'Primal Strike','Colpo Primordiale',70,{'beastFormAttacksCountAsMagicalFor':'overcoming-resistance-and-immunity-to-nonmagical-attacks-and-damage'},'Gli attacchi in forma di bestia contano come magici per superare resistenze e immunità agli attacchi e danni non magici.'),
      ('moon',10,'Elemental Wild Shape','Forma Selvatica Elementale',70,{'wildShapeUsesCost':2,'simultaneousExpenditure':True,
       'formIds':ELEMENTALS,'baseBeastCRAndMovementLimitsApply':False},'Spendi simultaneamente due usi di Forma Selvatica per diventare un elementale dell’aria, terra, fuoco o acqua.'),
      ('moon',14,'Thousand Forms','Mille Forme',70,{'spellId':'phb2014:spell:alter-self','atWill':True,'consumesSpellSlot':False},'Puoi lanciare Alterare Se Stesso a volontà; componenti, durata e concentrazione seguono l’incantesimo.'),
    ]
    added=[]
    for sub,level,name,it,page,effect,summary in rows:
        missing=[]
        if name=='Elemental Wild Shape' and any(not by_id[i]['verification']['complete'] for i in ELEMENTALS):missing=['formStatistics:water-elemental-releaseOther-rollKind']
        if name=='Thousand Forms' and not by_id['phb2014:spell:alter-self']['verification']['complete']:missing=['spellDescription:alter-self']
        e=record('subclass-feature',f'{sub}-{level}-'+slug(name),name,it,page,{'level':level,'effect':effect},summary,missing=missing)
        e['relations']={'classId':CLASS,'subclassId':'phb2014:subclass:'+sub}
        if name=='Circle Spells':e['sources'][0]['verification']='read-local-render'
        added.append(e)
    entities.extend(added)
    core={
      'Druidic':(67,'Druidico',{'language':'druidic','hiddenMessages':{'knowsLanguage':'automatically-spots','otherSpotCheck':{'ability':'wisdom','skill':'perception','dc':15},'otherDecipher':'requires-magic'}},'Conosci il Druidico e riconosci automaticamente i messaggi nascosti; gli altri li notano con Percezione CD 15 ma non li decifrano senza magia.'),
      'Spellcasting':(67,'Incantesimi',{'ability':'wisdom','list':'druid','preparation':'max(1,druidLevel+wisdomModifier)',
       'preparedSpellLevels':'available-class-spell-slots','changePreparation':'finish-long-rest','preparationMinutes':'sum-prepared-spell-levels',
       'cantripsByDruidLevel':{str(level):2 if level<4 else 3 if level<10 else 4 for level in range(1,21)},
       'saveDC':'8+proficiencyBonus+wisdomModifier','attackModifier':'proficiencyBonus+wisdomModifier',
       'spellSlotRecovery':['long-rest'],'ritualRequires':['druid-spell','ritual-tag','prepared'],'focus':'druidic-focus'},'Prepari magie da druido usando Saggezza; puoi cambiare la lista dopo un riposo lungo. Rituali solo se preparati e con tag rituale; un focus druidico serve per i materiali secondo le regole generali.'),
      'Druid Circle':(68,'Circolo Druidico',{'chooseSubclass':1,'subclassIds':[LAND,MOON],'featureLevels':[2,6,10,14]},'Scegli il Circolo della Terra o della Luna; ricevi privilegi ai livelli 2, 6, 10 e 14.'),
      'Timeless Body':(68,'Corpo Senza Tempo',{'biologicalAgingYearsPerElapsedYears':{'biological':1,'elapsed':10}},'Il corpo invecchia di un anno ogni dieci trascorsi.'),
      'Beast Spells':(68,'Incantesimi Bestiali',{'whileWildShapedMayCast':'druid-spells','allowedComponents':['V','S'],'mayProvideMaterialComponents':False},'In Forma Selvatica puoi fornire componenti verbali e somatiche delle magie da druido, ma non materiali.'),
      'Archdruid':([68,69],'Arcidruido',{'wildShapeUses':'unlimited','ignoreDruidSpellComponents':['V','S'],
       'ignoreMaterialOnlyIf':['no-cost','not-consumed'],'componentBenefitForms':['normal','Wild-Shape']},'Forma Selvatica illimitata. In entrambe le forme ignori verbali, somatiche e solo i materiali senza costo e non consumati delle magie da druido.'),
    }
    for e in entities:
        if e['kind']!='class-feature' or e['relations']['classId']!=CLASS:continue
        if e['name']=='Subclass Feature':
            e['mechanics']['concreteAlternativeIds']=[f['id'] for f in added if f['mechanics']['level']==e['mechanics']['level']]
            e['fieldSources']['concreteAlternativeIds']=[0]
            continue
        if e['name'] not in core:continue
        page,it,effect,summary=core[e['name']]
        e.update(nameIt=it,summaryIt=summary,translation={'language':'it','status':'assistant-translation'})
        e['sources'].append(source(page,e['name']));e['mechanics']['effect']=effect
        e['fieldSources']['effect']=[len(e['sources'])-1]
        e['verification'].update(complete=True,missingFields=[])
    for sub in ['land','moon']:
        parent=by_id['phb2014:subclass:'+sub]
        fs=[f for f in added if f['relations']['subclassId']==parent['id']]
        parent['relations']['featureIds']=[f['id'] for f in fs]
        parent['mechanics']['featureLevels']=sorted({f['mechanics']['level'] for f in fs})
        parent['fieldSources']['featureLevels']=[0]
        missing=['featureEffects:'+f['id'] for f in fs if not f['verification']['complete']]
        parent['verification'].update(complete=not missing,missingFields=missing)
        parent['summaryIt']=' '.join(f['summaryIt'] for f in fs)
    return entities
