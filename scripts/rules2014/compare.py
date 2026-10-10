"""Read-only, reproducible comparison with current JSON catalogs.

OCR is never accepted as a verified correction. Cross-catalog overlays are not
duplicates; spell aliases preserve renamed SRD spells and local namespace IDs.
"""
from collections import Counter
import json
from pathlib import Path

from pdf_sources import ROOT, sha256, write_json, WORK
from spell_extract import normalized

FILES=['character-options.json','character-equipment.json','character-rules.json','wizard-catalog.json','database.json']
SHORT={'str':'strength','dex':'dexterity','con':'constitution','int':'intelligence','wis':'wisdom','cha':'charisma'}
SPELL_ALIASES={
 "Bigby's Hand":'Arcane Hand',"Drawmij's Instant Summons":'Instant Summons',"Evard's Black Tentacles":'Black Tentacles',
 "Leomund's Secret Chest":'Secret Chest',"Leomund's Tiny Hut":'Tiny Hut',"Melf's Acid Arrow":'Acid Arrow',
 "Mordenkainen's Faithful Hound":'Faithful Hound',"Mordenkainen's Magnificent Mansion":'Magnificent Mansion',
 "Mordenkainen's Private Sanctum":'Private Sanctum',"Mordenkainen's Sword":'Arcane Sword',
 "Nystul's Magic Aura":"Arcanist's Magic Aura","Otiluke's Resilient Sphere":'Resilient Sphere',
 "Otiluke's Freezing Sphere":'Freezing Sphere',
 "Otto's Irresistible Dance":'Irresistible Dance',"Rary's Telepathic Bond":'Telepathic Bond',
 "Tasha's Hideous Laughter":'Hideous Laughter',"Tenser's Floating Disk":'Floating Disk',
}
GEAR_ALIASES={'arrows-20':'arrow','blowgun-needles-50':'blowgun-needle','crossbow-bolts-20':'crossbow-bolt',
 'sling-bullets-20':'sling-bullet','ball-bearings-bag-of-1-000':'ball-bearings-bag-of-1000','potion-of-healing':'potion-of-healing',
 'healer-s-kit':'healers-kit','climber-s-kit':'climbers-kit','alchemist-s-fire-flask':'alchemists-fire-flask',
 'pick-miner-s':'pick-miners','clothes-traveler-s':'clothes-travelers','scale-merchant-s':'scale-merchants',
 'caltrops-bag-of-20':'caltrops','spikes-iron-10':'spike-iron'}


def identity_names(e):
    names=[e.get('index',''),e.get('name',''),*e.get('aliases',[])]
    if e.get('kind')=='spell':
        names.append(SPELL_ALIASES.get(e['name'],''))
    if e.get('kind')=='gear':
        names.append(GEAR_ALIASES.get(e['index'],''))
    return {normalized(n) for n in names if isinstance(n,str) and n}


def match(e,pool):
    wanted=identity_names(e)
    return next((entry for entry in pool if wanted & identity_names(entry)),None)


def snapshot(data_dir):
    return {name:sha256(data_dir/name) for name in FILES if (data_dir/name).exists()}


def load_current(data_dir):
    return {name:json.loads((data_dir/name).read_text(encoding='utf-8')) if (data_dir/name).exists() else {} for name in FILES}


def discrepancy(e,typ,field,current,verified,impact,proposal,*,severity='review',catalog=None,sources=None):
    return {'entityId':e['id'],'kind':e['kind'],'name':e['name'],'type':typ,'severity':severity,'field':field,
            'catalog':catalog,'currentValue':current,'verifiedValue':verified,'sources':sources or e['sources'],
            'verification':e['verification'],'consequenceIt':impact,'proposedCorrectionIt':proposal}


def compare(database,data_dir=ROOT/'public'/'data'):
    before=snapshot(data_dir)
    catalogs=load_current(data_dir)
    o=catalogs['character-options.json']; q=catalogs['character-equipment.json']; r=catalogs['character-rules.json']; w=catalogs['wizard-catalog.json']; d=catalogs['database.json']
    # Same precedence as withWizardCatalog(). The original nested references are
    # retained for auditing, but an overlay is not counted twice.
    subclasses={x['index']:x for x in o.get('subclasses',[])}
    for x in w.get('subclasses',[]):
        subclasses[x['index']]={**subclasses.get(x['index'],{}),**x}
    pools={'class':o.get('classes',[]),'subclass':list(subclasses.values()),'race':o.get('races',[]),
           'subrace':o.get('subraces',[]),'race-variant':o.get('races',[]),'background':o.get('backgrounds',[]),'background-variant':o.get('backgrounds',[]),'feat':o.get('feats',[]),
           'class-level':[x for x in o.get('levels',[]) if not x.get('subclass')],
           'skill':r.get('skills',[]),'condition':r.get('conditions',[]),
           'weapon':q.get('equipment',[]),'armor':q.get('equipment',[]),'tool':q.get('equipment',[]),
           'gear':q.get('equipment',[])+q.get('magicItems',[]),'equipment-pack':q.get('equipment',[]),
           'weapon-property':q.get('weaponProperties',[]),'spell':o.get('spells',[])}
    issues=[];matches=[]; checks=0
    for filename,catalog in catalogs.items():
        for array,entries in catalog.items():
            if not isinstance(entries,list): continue
            keys=Counter(str(x.get('index') or x.get('id')) for x in entries if isinstance(x,dict) and (x.get('index') or x.get('id')))
            for key,count in keys.items():
                if count>1:
                    issues.append({'entityId':f'current:{array}:{key}','type':'duplicate-within-array','severity':'error','field':'id',
                      'catalog':filename+':'+array,'currentValue':{'id':key,'count':count},'verifiedValue':None,'sources':[],
                      'consequenceIt':'La ricerca per identificatore può scegliere una voce diversa dalla prevista.',
                      'proposedCorrectionIt':'Confrontare le copie e consolidarle senza confondere sovrapposizioni tra file diversi.'})
    for e in database['entities']:
        if e['kind'] not in pools: continue
        pool=pools[e['kind']]; current=match(e,pool)
        if current is None:
            # Identity evidence is distinct from metadata verification.
            if e['kind']=='spell' and e['verification']['identity']=='ocr-candidate':
                continue
            elsewhere=match(e,d.get('englishSpells',[])) if e['kind']=='spell' else None
            issues.append(discrepancy(e,'missing-in-creation-catalog','identity',None,{'index':e['index'],'name':e['name']},
                'La voce non è disponibile nel catalogo strutturato della creazione del personaggio.'+(' È presente nel catalogo inglese generale.' if elsewhere else ''),
                'Preparare un’aggiunta separata con fonte, traduzione e relazioni; completare i campi ancora da verificare.',
                severity='gap',catalog='creation:'+e['kind']))
            continue
        matches.append({'referenceId':e['id'],'currentId':current.get('id',current.get('index')),'kind':e['kind']})
        if e['kind']!='spell' and current.get('name') and normalized(current['name'])!=normalized(e['name']):
            issues.append(discrepancy(e,'denomination-difference','name',current.get('name'),e['name'],
                'Il catalogo usa un nome abbreviato o una diversa indicazione della confezione; l’identità è stata riconosciuta.',
                'Conservare nome originale e alias senza modificare l’identificatore; per l’equipaggiamento esplicitare anche la quantità.',severity='info'))
        if current.get('nameIt') and e.get('nameIt') and normalized(current['nameIt'])!=normalized(e['nameIt']):
            issues.append(discrepancy(e,'translation-difference','nameIt',current['nameIt'],e['nameIt'],
                'Nomi diversi possono influire su ricerca e visualizzazione; non provano una traduzione errata.',
                'Mantenere alias e verificare la traduzione ufficiale: il nome italiano del riferimento è una traduzione propria.'))
        if e['kind']=='spell':
            if normalized(current['name'])!=normalized(e['name']):
                issues.append(discrepancy(e,'recognized-name-alias','name',current['name'],e['name'],
                  'Il nome SRD omette spesso il nome proprio del mago; senza alias il confronto genera falsi mancanti.',
                  'Conservare entrambi i nomi come alias e un solo identificatore canonico.',severity='info'))
            # Only individual passage reviews can supply verified corrections.
            for key,oldkey in [('level','level'),('school','school'),('ritual','ritual'),('concentration','concentration'),('components','components')]:
                old=current.get(oldkey)
                if isinstance(old,dict):old=old.get('index')
                new=e['mechanics'].get(key)
                if new is not None and old is not None and old!=new:
                    verified=e['verification']['mechanics']=='verified-fields'
                    issues.append(discrepancy(e,'mechanical-difference' if verified else 'ocr-candidate-difference',key,old,new if verified else {'candidateValue':new,'verified':False},
                        'La differenza influenza filtri e requisiti del lancio.' if verified else 'Possibile differenza nei filtri o nel lancio; il valore OCR non è utilizzabile come correzione.',
                        'Preparare una correzione riferita al passaggio verificato.' if verified else 'Leggere o renderizzare la pagina citata e verificare i rimandi.',severity='error' if verified else 'review'))
            continue
        m=e['mechanics']; fields=[]
        if e['kind']=='class':
            fields=[('hitDie',current.get('hit_die'),m['hitDie']),('castingAbility',current.get('castingAbility'),m['castingAbility'])]
            fields.append(('savingThrowAbilities',sorted(SHORT.get(x['index'],x['index']) for x in current.get('saving_throws',[])),sorted(m['savingThrowAbilities'])))
            fields.append(('abilityScoreImprovementLevels',current.get('abilityScoreImprovementLevels'),m['abilityScoreImprovementLevels']))
            choices=current.get('proficiency_choices',[])
            if choices:fields.append(('skillChoices.choose',choices[0].get('choose'),m['skillChoices']['choose']))
        elif e['kind']=='background':
            actual=sorted(x['index'].removeprefix('skill-') for x in current.get('starting_proficiencies',[]) if x['index'].startswith('skill-'))
            fields.extend([('skillProficiencies',actual,sorted(m['skillProficiencies'])),('startingGold',current.get('starting_gold'),m['startingGold']),
                           ('languageChoice.choose',current.get('language_options',{}).get('choose',0),m['languageChoice']['choose'])])
        elif e['kind']=='subclass':
            minimum=current.get('minimumLevel')
            if minimum is None:
                minimum=min((f['level'] for f in o.get('features',[]) if f.get('subclass',{}).get('index')==current['index']),default=None)
            fields.append(('minimumLevel',minimum,m['minimumLevel']))
        elif e['kind'] in ['race','subrace']:
            fields=[('fixedAbilityBonuses',current.get('fixedAbilityBonuses'),m['fixedAbilityBonuses'])]
            if e['kind']=='race': fields.extend([('speed',current.get('speed'),m['speed']['value']),('size',current.get('size'),m['size'])])
        elif e['kind'] in ['weapon','armor','tool','gear','equipment-pack']:
            fields=[('cost',current.get('cost'),m['cost'])]
            weight=m.get('weightLb') if 'weightLb' in m else m.get('weight',{}).get('value')
            # Source dashes are unknown, not an asserted zero.
            if weight is not None:fields.append(('weight',current.get('weight'),weight))
            if e['kind']=='weapon':
                dmg=current.get('damage') or {}
                fields.extend([('damage.dice',dmg.get('damage_dice'),m['damage']['dice']),('damage.type',dmg.get('damage_type',{}).get('index'),m['damage']['type'])])
                actual=sorted(x['index'] for x in current.get('properties',[]) if x['index']!='monk')
                fields.append(('properties',actual,sorted(m['properties'])))
                if m['range']:
                    range_field='throw_range' if m['weaponRange']=='melee' and 'thrown' in m['properties'] else 'range'
                    fields.extend([(range_field+'.normal',current.get(range_field,{}).get('normal'),m['range']['normal']),(range_field+'.long',current.get(range_field,{}).get('long'),m['range']['long'])])
            if e['kind']=='armor':
                actual=current.get('armor_class',{})
                fields.extend([('armorClass.base',actual.get('base'),m['armorClass']['base']),('armorClass.dexBonus',actual.get('dex_bonus'),m['armorClass']['dexBonus']),
                    ('strengthMinimumToAvoidSpeedPenalty',current.get('str_minimum'),m['strengthMinimumToAvoidSpeedPenalty']),('stealthDisadvantage',current.get('stealth_disadvantage'),m['stealthDisadvantage'])])
        elif e['kind']=='class-level':
            fields=[('proficiencyBonus',current.get('prof_bonus'),m['proficiencyBonus'])]
            spell=current.get('spellcasting',{})
            if e['relations']['classId'].endswith(':warlock'):
                expected=[0]*9; expected[m['pactSlots']['level']-1]=m['pactSlots']['count']
            else:expected=m['spellSlots']
            fields.append(('spellSlots',[spell.get('spell_slots_level_'+str(i),0) for i in range(1,10)],expected))
            for key,old in [('cantripsKnown','cantrips_known'),('spellsKnown','spells_known')]:
                if key in m:fields.append((key,spell.get(old,0),m[key]))
            specific=current.get('class_specific',{})
            for key,old in [('rages','rage_count'),('rageDamageBonus','rage_damage_bonus'),('kiPoints','ki_points'),('sorceryPoints','sorcery_points'),('invocationsKnown','invocations_known'),('unarmoredMovementBonusFt','unarmored_movement')]:
                if key in m:
                    actual=specific.get(old)
                    if key=='invocationsKnown':actual=spell.get(old,specific.get(old))
                    # SRD uses 9999 as a documented unlimited-rage sentinel.
                    if key=='rages' and actual==9999:actual='unlimited'
                    fields.append((key,actual,m[key]))
        for field,old,new in fields:
            checks+=1
            if old!=new:
                batch_ambiguous=e['kind']=='gear' and field=='cost' and m.get('purchaseQuantity',1)>1 and not current.get('quantity')
                issues.append(discrepancy(e,'missing-mechanical-field' if old is None else 'mechanical-difference',field,old,new,
                    'Il prezzo della fonte riguarda '+str(m['purchaseQuantity'])+' pezzi, mentre il catalogo non specifica la quantità della confezione.' if batch_ambiguous else 'Il valore riguarda competenze, progressione, equipaggiamento o disponibilità delle risorse.',
                    'Chiarire unità e confezione prima di correggere: costo e peso potrebbero riferirsi a quantità diverse.' if batch_ambiguous else 'Confrontare la fonte indicata e preparare una modifica mirata del catalogo, senza applicarla in questa fase.',
                    severity='review' if batch_ambiguous else 'gap' if old is None else 'error'))
        if 'relations' in e:
            for relation,target in e['relations'].items():
                ref=next((x for x in database['entities'] if x['id']==target),None) if isinstance(target,str) else None
                field={'classId':'class','raceId':'race','parentBackgroundId':'parent'}.get(relation)
                if field and ref and current.get(field,{}).get('index')!=ref['index']:
                    issues.append(discrepancy(e,'missing-or-wrong-relation',field,current.get(field),{'index':ref['index']},
                        'La voce può essere assegnata all’origine sbagliata o esclusa dai filtri.',
                        'Aggiungere o correggere il riferimento al genitore verificato.',severity='error'))
    # Additional rule tables consumed by the app, independently verified in PHB.
    references={e['index']:e for e in database['entities'] if e['kind']=='rule' and e['sources'][0]['book']=='phb'}
    table_checks=[]
    for e in [x for x in database['entities'] if x['kind']=='advancement']:
        level=e['mechanics']['level']
        actual=next((x.get('minimumXP') for x in r.get('experienceThresholds',{}).get('levels',[]) if x['level']==level),None)
        table_checks.append((e,'minimumXP',actual,e['mechanics']['minimumXP']))
    modifier=references['ability-modifier']
    for score in range(1,31):
        actual=next((x.get('modifier') for x in r.get('abilityModifierTable',[]) if x['score']==score),None)
        table_checks.append((modifier,'abilityModifierTable.'+str(score),actual,(score-10)//2))
    proficiency=references['proficiency']
    for level,bonus in enumerate(proficiency['mechanics']['byCharacterLevel'],1):
        actual=next((x.get('bonus') for x in r.get('proficiencyByCharacterLevel',[]) if x['level']==level),None)
        table_checks.append((proficiency,'proficiencyByCharacterLevel.'+str(level),actual,bonus))
    generation=references['score-generation']; old=r.get('abilityScoreGeneration',{}); new=generation['mechanics']
    table_checks.extend([(generation,'standardArray',old.get('standardArray'),new['standardArray']),
        (generation,'pointBuy.budget',old.get('pointBuy',{}).get('budget'),new['pointBuy']['budget'])])
    for score,cost in new['pointBuy']['costs'].items():
        actual=next((x.get('cost') for x in old.get('pointBuy',{}).get('costs',[]) if x['score']==int(score)),None)
        table_checks.append((generation,'pointBuy.costs.'+score,actual,cost))
    for e,field,old,new in table_checks:
        checks+=1
        if old!=new:
            issues.append(discrepancy(e,'mechanical-difference',field,old,new,'Il dato influenza creazione e avanzamento del personaggio.',
                'Preparare una correzione della tabella usando la fonte verificata.',severity='error' if old is not None else 'gap',catalog='character-rules.json'))
    reference_subclasses=[e for e in database['entities'] if e['kind']=='subclass']
    extras=[]
    for entry in subclasses.values():
        if any(match(e,[entry]) for e in reference_subclasses):continue
        status=entry.get('status'); classification='unearthed-arcana' if status in ['ua','archived-ua'] else 'additional-source-unavailable' if entry.get('sources') else 'unrecognized-provenance'
        extras.append({'id':entry.get('index'),'name':entry['name'],'classification':classification,'declaredSources':entry.get('sources',[]),'editions':entry.get('editions'),
                       'actionIt':'Conservare in un catalogo distinto dal PHB; la fonte non è verificabile con i manuali disponibili.'})
    revised=[]
    for filename,catalog in catalogs.items():
        for key,entries in catalog.items():
            if not isinstance(entries,list):continue
            for entry in entries:
                if not isinstance(entry,dict):continue
                edition=str(entry.get('ruleset',''))
                if '2024' in edition:
                    revised.append({'catalog':filename+':'+key,'id':entry.get('id',entry.get('index')),'ruleset':edition})
    unmatched=[]
    scoped=[('english-spells',d.get('englishSpells',[]),'spell'),
            ('weapons',[x for x in q.get('equipment',[]) if x.get('weapon_category')],'weapon'),
            ('armor',[x for x in q.get('equipment',[]) if x.get('armor_category')],'armor'),
            ('backgrounds',o.get('backgrounds',[]),'background'),('feats',o.get('feats',[]),'feat')]
    for label,entries,kind in scoped:
        reference=[e for e in database['entities'] if e['kind']==kind]
        for entry in entries:
            if any(match(e,[entry]) for e in reference):continue
            explicit_homebrew=entry.get('homebrew') is True or 'homebrew' in str(entry.get('ruleset','')).casefold()
            unmatched.append({'catalog':label,'id':entry.get('index',entry.get('id')),'name':entry.get('name'),
                              'classification':'declared-homebrew' if explicit_homebrew else 'not-recognized-in-current-PHB-inventory',
                              'declaredRuleset':entry.get('ruleset'),'sourceUrl':entry.get('sourceUrl'),
                              'actionIt':'Verificare la provenienza: l’assenza nell’inventario non dimostra homebrew o un’altra edizione.'})
    matched_ids={m['referenceId']:m['currentId'] for m in matches}
    for issue in issues:
        issue['currentEntityId']=matched_ids.get(issue['entityId'])
    after=snapshot(data_dir)
    if before!=after:raise RuntimeError('Current catalogs changed during comparison; no reproducible snapshot.')
    return {'schemaVersion':1,'edition':'2014','inputSHA256':before,'readOnlyVerified':True,'comparedMechanicalFields':checks,
            'matches':matches,'discrepancies':issues,'additionalCatalogContent':extras,'explicitRevisedRecords':revised,
            'unmatchedCatalogRecords':unmatched,
            'deferredComparisons':[{'catalog':'database.json:creatures','count':len(d.get('creatures',[])),'reason':'MM stat block inventory not yet extracted'},
                                   {'catalog':'character-equipment.json:magicItems','count':len(q.get('magicItems',[])),'reason':'DMG magic item inventory not yet extracted'}],
            'limitationsIt':['Incantesimi OCR: discrepanze da verificare, non valori corretti.',
              'Testi lunghi, condizioni espresse solo in prosa e formule hardcoded non sono confrontati semanticamente.',
              'Il catalogo generale contiene ulteriori incantesimi e mostri: la provenienza di ogni extra resta da classificare.',
              'Una voce valida per entrambe le edizioni non prova una contaminazione; occorre verificare la variante effettivamente usata.']}


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--reference',type=Path,default=WORK/'reference.json');parser.add_argument('--data-dir',type=Path,default=ROOT/'public'/'data');parser.add_argument('--output',type=Path,default=WORK/'comparison.json')
    args=parser.parse_args()
    if args.output.resolve().is_relative_to((ROOT/'public'/'data').resolve()):
        parser.error('Comparison output must remain separate from public/data.')
    result=compare(json.loads(args.reference.read_text(encoding='utf-8')),args.data_dir);write_json(args.output,result)
    print('Compared fields:',result['comparedMechanicalFields'],'findings:',len(result['discrepancies']))
