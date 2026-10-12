"""PHB race chapter read, PDF 18–25 and 27–44. First-printing lore only.

Alignment suggestions are narrative, never character restrictions. Official
removal/replacement of lore is encoded separately in errata.py.
"""
from curated import source, record

# index, trait PDF pages, cultural adulthood, life expectancy value/qualifier,
# short Italian paraphrase of the original passage (not a forced alignment).
RACES=[
 ('dwarf',[21],50,350,'average','Cresci come un umano, ma la società nanica ti considera giovane fino a cinquant’anni; la vita media è circa 350 anni. La cultura descritta privilegia ordine, equità e bene comune.'),
 ('elf',[24],100,750,'can-reach','La maturazione fisica è simile a quella umana; l’età adulta culturale arriva intorno a cento anni, con una vita che può raggiungere 750. La prima stampa suggerisce libertà e bene, presentando i drow come eccezione.'),
 ('halfling',[29],20,150,'about','Diventi adulto verso vent’anni e normalmente vivi circa un secolo e mezzo. Le comunità descritte favoriscono gentilezza, tradizione e solidarietà.'),
 ('human',[32],None,100,'usually-less-than','La maturità arriva negli ultimi anni dell’adolescenza; la vita dura generalmente meno di un secolo. Non è suggerito un allineamento particolare.'),
 ('dragonborn',[35],15,80,'about','Lo sviluppo è rapido: a tre anni è paragonabile a quello di un umano di dieci; diventi adulto a quindici e vivi circa ottanta. Il testo originale descrive scelte morali marcate, spesso orientate al bene.'),
 ('gnome',[37,38],40,None,'range-350-to-almost-500','Maturi fisicamente come un umano; l’assunzione dei ruoli adulti è attesa intorno ai quarant’anni. Puoi vivere da 350 a quasi 500 anni. L’indole descritta è spesso buona, con orientamenti sociali diversi.'),
 ('half-elf',[40],20,180,'often-exceeds','Diventi adulto intorno ai vent’anni e spesso superi 180 anni di vita. La descrizione originale sottolinea autonomia, libertà personale e creatività.'),
 ('half-orc',[42],14,75,'rarely-exceeds','Maturi un po’ prima degli umani, intorno ai quattordici anni, e raramente superi 75 anni. La prima stampa descrive tendenze caotiche e l’influenza della cultura orca, senza vincolare il personaggio.'),
 ('tiefling',[44],None,None,'human-plus-a-few-years','Maturi come un umano e vivi qualche anno in più. La prima stampa indica indipendenza e tendenze caotiche; l’eredità infernale non impone un carattere malvagio.'),
]
SUBRACE_SUMMARIES={
 'hill-dwarf':'I sensi e la resistenza del nano delle colline si traducono in Saggezza +1 e un PF massimo aggiuntivo per ogni livello del personaggio.',
 'mountain-dwarf':'Il nano delle montagne è robusto e abituato a terreni difficili: Forza +2 e competenza nelle armature leggere e medie.',
 'high-elf':'L’elfo alto coltiva mente e magia: Intelligenza +1, addestramento in quattro armi elfiche, un trucchetto da mago con Intelligenza e una lingua aggiuntiva.',
 'wood-elf':'L’elfo dei boschi combina Saggezza +1, addestramento nelle armi elfiche e velocità base di 35 piedi; può tentare di nascondersi anche con oscuramento leggero dovuto a fenomeni naturali.',
 'dark-elf':'Nella prima stampa i drow sono presentati come elfi dell’Underdark con capelli chiari e una cultura legata a Lolth, dalla quale alcuni avventurieri si allontanano. Carisma +1, scurovisione di 120 piedi, sensibilità al sole, tre competenze in armi e magie basate su Carisma.',
 'lightfoot-halfling':'Il piedelesto è incline ai viaggi e ai rapporti con altre comunità: Carisma +1 e possibilità di nascondersi usando una creatura di almeno una taglia maggiore come copertura.',
 'stout-halfling':'Il tozzo è più resistente: Costituzione +1, vantaggio ai TS contro veleno e resistenza ai relativi danni.',
 'forest-gnome':'Lo gnomo delle foreste usa inganno e rapporti con gli animali: Destrezza +1, Illusione Minore con Intelligenza e comunicazione di idee semplici con bestie Piccole o Minuscole tramite suoni e gesti.',
 'rock-gnome':'Lo gnomo delle rocce unisce inventiva e resistenza: Costituzione +1, conoscenze specialistiche di Storia e competenza da inventore. Può creare fino a tre piccoli congegni temporanei con materiali recuperabili.',
}
ANCESTRY=[
 ('black','acid','line','dexterity'),('blue','lightning','line','dexterity'),('brass','fire','line','dexterity'),
 ('bronze','lightning','line','dexterity'),('copper','acid','line','dexterity'),('gold','fire','cone','dexterity'),
 ('green','poison','cone','constitution'),('red','fire','cone','dexterity'),('silver','cold','cone','constitution'),('white','cold','cone','constitution'),
]


def apply_race_reviews(entities):
    by_id={e['id']:e for e in entities}
    for index,pages,adult,life,qualifier,summary in RACES:
        e=by_id['phb2014:race:'+index]
        e['mechanics']['age']={'adulthoodYears':adult,'adulthoodBasis':'cultural' if index in ['dwarf','elf','gnome'] else 'physical',
                               'lifespanYears':life,'lifespanQualifier':qualifier,'ageLimitsEnforced':False}
        e['mechanics']['alignmentDescription']={'binding':False,'status':'first-printing-narrative-suggestion'}
        e['summaryIt']=summary+' Queste indicazioni d’età e allineamento non limitano la creazione del personaggio.'
        e['sources'].append(source(pages,e['name']+' Traits; Age and Alignment'))
        for field in ['age','alignmentDescription']:e['fieldSources'][field]=[len(e['sources'])-1]
        missing=[f for f in e['verification']['missingFields'] if f not in ['age','alignmentDescription']]
        if index=='elf':missing.append('traits.trance.longRestDurationInterpretation')
        e['verification'].update(complete=not missing,missingFields=missing)
    dwarf=by_id['phb2014:race:dwarf']
    traits={t['index']:t['mechanics'] for t in dwarf['mechanics']['traits']}
    traits['stonecunning']['consideredProficientForCheck']=True
    traits['dwarven-combat-training']['sourceWeaponNames']=['battleaxe','handaxe','throwing hammer','warhammer']
    dwarf['interpretations'].append({'field':'traits.dwarven-combat-training.weaponProficiencies',
      'kind':'derived-name-normalization','method':'Canonical light-hammer ID retained; original printed throwing hammer preserved in sourceWeaponNames. PH-Errata PDF 1 confirms the matching name; editorial labels remain separate.'})
    draconic=by_id['phb2014:race:dragonborn']['mechanics']['traits'][0]['mechanics']
    draconic['choices']=[{'index':index,'damageType':damage,'saveAbility':save,
                        'area':{'shape':'line','widthFt':5,'lengthFt':30} if shape=='line' else {'shape':'cone','lengthFt':15}}
                        for index,damage,shape,save in ANCESTRY]
    draconic['usesSameChoiceFor']='breath-weapon-and-damage-resistance'
    by_id['phb2014:race:dragonborn']['sources'][0]['verification']='read-local-render'
    for index,summary in SUBRACE_SUMMARIES.items():
        e=by_id['phb2014:subrace:'+index];e['summaryIt']=summary
        missing=[f for f in e['verification']['missingFields'] if f!='descriptiveTraits']
        e['verification'].update(complete=not missing,missingFields=missing)
    drow=by_id['phb2014:subrace:dark-elf']
    drow['mechanics']['appearanceAndCulturePrinting']='original-Lolth-Underdark-description'
    drow['fieldSources']['appearanceAndCulturePrinting']=[0]
    drow['mechanics']['requiresDMApprovalInWorld']=True;drow['fieldSources']['requiresDMApprovalInWorld']=[0]
    sensitivity=drow['mechanics']['sunlightSensitivity']
    sensitivity.pop('when')
    sensitivity.update(attackDisadvantageIfAny=['self-in-direct-sunlight','attack-target-in-direct-sunlight'],
      sightPerceptionDisadvantageIfAny=['self-in-direct-sunlight','perceived-creature-or-object-in-direct-sunlight'])
    tinker=by_id['phb2014:subrace:rock-gnome']['mechanics']['tinker']
    tinker.update(size='Tiny',dismantleActivation='action',materialsReclaimedWhen='dismantled',
      maintainForNext24HoursRequiresHours=1,
      optionEffects={
        'clockwork-toy':{'represents':'animal-monster-or-person','whenPlacedOnGround':{'movementFtPerOwnTurn':5,'direction':'random','makesAppropriateNoises':True}},
        'fire-starter':{'activation':'action','ignites':['candle','torch','campfire']},
        'music-box':{'trigger':'opened','plays':'one-song-at-moderate-volume','endsWhen':['song-ends','closed']}})
    rock=by_id['phb2014:subrace:rock-gnome'];rock['sources'][0]['verification']='read-local-render'
    rock['mechanics']['historyProficiencyMultiplier']['appliesWithoutExistingHistoryProficiency']=True
    rock['optionSummariesIt']={
        'clockwork-toy':'Un animaletto, mostro o personaggio meccanico; sul terreno percorre cinque piedi in direzione casuale a ogni tuo turno ed emette versi adeguati.',
        'fire-starter':'Un’azione produce una fiammella per accendere candela, torcia o falò.',
        'music-box':'Aprendolo parte una melodia a volume moderato; finisce al termine del brano o chiudendo il carillon.'}
    entities.extend(dmg_example_origins())
    # Grants are reviewed independently from their still-pending spell descriptions.
    for e in entities:
        if e['kind'] not in ['race','subrace']:continue
        grants=[]
        for t in e['mechanics'].get('traits',[]):grants.extend(t['mechanics'].get('grants',[]))
        raw=e['mechanics'].get('spellGrants',[])
        grants.extend(raw.get('grants',[]) if isinstance(raw,dict) else raw)
        for grant in grants:
            grant['spellId']='phb2014:spell:'+grant['spell']
            grant['levelBasis']='total-character-level'
        if grants:e.setdefault('relations',{})['grantedSpellIds']=[g['spellId'] for g in grants]
    return entities


def dmg_example_origins():
    """Design examples in the DMG, distinct from Volo/Mordenkainen/2024 races."""
    aasimar=record('race','aasimar-dmg-example','Aasimar (DMG example)','Aasimar (esempio DMG)',[287,288],
       {'requiresDMApproval':True,'designExample':True,'fixedAbilityBonuses':{'wisdom':1,'charisma':2},
        'size':'Medium','speedFt':30,'languages':['common','celestial'],'darkvisionFt':60,
        'age':{'maturity':'same-as-human','lifespan':'a-few-years-longer-than-human','numericMaximum':None,'numericMaximumStatus':'not-stated'},
        'alignmentSuggestionIt':'Spesso buono per eredità celeste, ma può scegliere il male; nessun vincolo automatico.',
        'traits':[{'index':'celestial-resistance','nameIt':'Resistenza Celestiale','mechanics':{'damageResistance':['necrotic','radiant']}},
            {'index':'celestial-legacy','nameIt':'Retaggio Celestiale','mechanics':{'castingAbility':'charisma','grants':[
                {'spell':'light','minimumLevel':1,'atWill':True},
                {'spell':'lesser-restoration','minimumLevel':3,'uses':1,'recovery':'long-rest'},
                {'spell':'daylight','minimumLevel':5,'slotLevel':3,'uses':1,'recovery':'long-rest'}]}}]},
       'Esempio opzionale DMG: Saggezza uno, Carisma due; Medio, trenta piedi, Comune e Celestiale, scurovisione sessanta piedi, resistenza a necrotico e radiante. Luce, Ristorare Inferiore dal terzo e Luce Diurna dal quinto, questi ultimi una volta per riposo lungo con Carisma. Età umana con vita di qualche anno più lunga, senza massimo numerico.',book='dmg',optional=True)
    eladrin=record('subrace','eladrin-dmg-example','Eladrin (DMG example)','Eladrin (esempio DMG)',287,
       {'requiresDMApproval':True,'designExample':True,'fixedAbilityBonuses':{'intelligence':1},
        'weaponProficiencies':['longsword','shortsword','shortbow','longbow'],
        'spellGrants':{'grants':[{'spell':'misty-step','minimumLevel':1,'uses':1,'recovery':['short-rest','long-rest']}],
            'castingAbility':None,'castingAbilityStatus':'not-stated-not-required-by-this-spell'}},
       'Sottorazza opzionale DMG che eredita i tratti dell’elfo: Intelligenza uno e competenze in spade lunga e corta, archi corto e lungo. Passo Velato una volta, recuperato al riposo breve o lungo. Non è la successiva versione con stagioni e effetti aggiuntivi.',book='dmg',optional=True)
    eladrin['relations']={'raceId':'phb2014:race:elf'}
    for e in [aasimar,eladrin]:e['reviewScope']='DMG-character-design-example; campaign-approval-required; not-supplement-or-revised-2024'
    return [aasimar,eladrin]
