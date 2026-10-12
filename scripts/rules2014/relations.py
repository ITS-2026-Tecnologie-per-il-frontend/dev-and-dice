"""Explicit references, including quantity units for ammunition purchase packs."""


def progression_status(entities):
    """Dependency checks certify each event independently, never all subclasses as one grant."""
    by_id={e['id']:e for e in entities}
    dependent=[e for e in entities if e.get('relations',{}).get('dependencyIds')]
    intrinsic={e['id']:[f for f in e['verification']['missingFields'] if not f.startswith('dependencyIncomplete:')] for e in dependent}
    for e in dependent:
        if e['verification']['mechanics']!='verified-fields' and 'mechanics-not-verified' not in intrinsic[e['id']]:intrinsic[e['id']].append('mechanics-not-verified')
    for e in dependent:e['verification'].update(complete=not intrinsic[e['id']],missingFields=intrinsic[e['id']])
    # ponytail: fixed-point scan is O(V*(V+E)) worst case; use topological propagation if this small dependency graph grows.
    for _ in range(len(dependent)+1):
        changed=False
        for e in dependent:
            missing=[*intrinsic[e['id']],*['dependencyIncomplete:'+eid for eid in e['relations']['dependencyIds'] if not by_id[eid]['verification']['complete']]]
            changed |= e['verification']['missingFields']!=missing
            e['verification'].update(complete=not missing,missingFields=missing)
        if not changed:break
    for e in entities:
        if e['kind']=='magic-item':e['reviewScope']=('individual-item-complete' if e['verification']['complete'] else 'individual-item-dependencies-pending')+'; DMG-magic-item-inventory-audit-pending'
    for e in entities:
        if e['kind']=='class-feature' and e.get('progressionEvent')=='selected-subclass-features':
            deps=e['mechanics']['effect']['grantFromSelectedSubclassOnly']
            missing=['concreteAlternativeEffects:'+eid for eid in deps if not by_id[eid]['verification']['complete']]
            e['verification'].update(complete=not missing,missingFields=missing)
    for e in entities:
        if e['kind']=='class-level':
            e.setdefault('relations',{})['featureIds']=[f['id'] for f in entities if f['kind']=='class-feature' and f['relations']['classId']==e['relations']['classId'] and f['mechanics']['level']==e['mechanics']['level']]
            alternatives=[f['id'] for f in entities if f['kind']=='subclass-feature' and f['sources'][0]['book']=='phb' and f['relations']['classId']==e['relations']['classId'] and f['mechanics']['level']==e['mechanics']['level']]
            e['relations']['alternativeSubclassFeatureIds']=alternatives
            missing=[field for field in e['verification']['missingFields'] if field not in ['featureLinks','subclassProgressionAndFeatureEffects'] and not field.startswith(('featureEffect:','subclassFeatureEffect:'))]
            missing.extend('featureEffect:'+eid for eid in e['relations']['featureIds'] if not by_id[eid]['verification']['complete'])
            missing.extend('subclassFeatureEffect:'+eid for eid in alternatives if not by_id[eid]['verification']['complete'])
            e['verification'].update(complete=not missing,missingFields=missing)
    for e in entities:
        if e['kind']!='class':continue
        dependencies=[f for f in entities if f['kind']=='class-feature' and f['relations']['classId']==e['id'] or f['kind']=='subclass' and f['sources'][0]['book']=='phb' and f['relations']['classId']==e['id']]
        missing=[field for field in e['verification']['missingFields'] if field!='fullFeatureEffects' and not field.startswith('featureDependency:')]
        if not dependencies:missing.append('fullFeatureEffects')
        missing.extend('featureDependency:'+f['id'] for f in dependencies if not f['verification']['complete'])
        e['verification'].update(complete=not missing,missingFields=missing)
    return entities


def link_entities(entities):
    for e in entities:
        if e['kind']=='class-feature' and e['name']=='Subclass Feature':
            alternatives=[f for f in entities if f['kind']=='subclass-feature' and f['sources'][0]['book']=='phb' and f['relations']['classId']==e['relations']['classId'] and f['mechanics']['level']==e['mechanics']['level']]
            if not alternatives:raise ValueError('Subclass event without concrete alternatives: '+e['id'])
            e['progressionEvent']='selected-subclass-features'
            e['nameIt']='Privilegi della Sottoclasse';e['translation'].update(status='assistant-translation',language='it')
            e['summaryIt']='A questo livello acquisisci esclusivamente i privilegi della sottoclasse scelta, ciascuno con effetti, scelte e risorse propri; le alternative non sono concesse tutte insieme.'
            e['mechanics']['effect']={'grantFromSelectedSubclassOnly':[f['id'] for f in alternatives]}
            e['relations']['alternativeFeatureIds']=[f['id'] for f in alternatives]
            e['fieldSources']['effect']=[0]
            for f in alternatives:
                e['sources'].append(f['sources'][0]);e['fieldSources']['effect'].append(len(e['sources'])-1)
    by_index={e['index']:e for e in entities if e['kind'] in ['weapon','armor','tool','gear','equipment-pack']}
    aliases={'arrow':'arrows-20','crossbow-bolt':'crossbow-bolts-20','blowgun-needle':'blowgun-needles-50','sling-bullet':'sling-bullets-20',
             'healers-kit':'healer-s-kit','climbers-kit':'climber-s-kit','clothes-travelers':'clothes-traveler-s'}
    for e in entities:
        if e['kind']=='class':
            refs=set()
            equipment=e['mechanics']['startingEquipment']
            rows=[*equipment['fixed'],*(item for choice in equipment['choices'] for group in choice['options'] for item in group)]
            for item in rows:
                if 'index' in item:
                    target=by_index.get(aliases.get(item['index'],item['index']))
                    item['entityId']=target['id'] if target else None
                    item['referenceStatus']='resolved' if target else 'unresolved'
                    if target:
                        item['quantityUnit']='piece' if item['index'] in aliases and target['kind']=='gear' and target['mechanics'].get('purchaseQuantity',1)>1 else 'purchase-unit'
                        refs.add(target['id'])
                    else:
                        e['verification']['missingFields'].append('startingEquipment.reference.'+item['index'])
                else:
                    item['referenceStatus']='category-choice'
            e.setdefault('relations',{})['startingEquipmentIds']=sorted(refs)
            e['relations']['subclassIds']=[s['id'] for s in entities if s['kind']=='subclass' and s.get('relations',{}).get('classId')==e['id']]
            e['relations']['levelIds']=[s['id'] for s in entities if s['kind']=='class-level' and s['relations']['classId']==e['id']]
            e['relations']['featureIds']=[s['id'] for s in entities if s['kind']=='class-feature' and s['relations']['classId']==e['id']]
            e['interpretations'].append({'field':'relations','kind':'derived','method':'Reverse explicit parent references; optional DMG subclasses retain their own source and approval requirement. Equipment indexes mapped to independent table records, with piece versus purchase-unit quantities.'})
        elif e['kind']=='race':
            e['relations']={**e.get('relations',{}),'subraceIds':[s['id'] for s in entities if s['kind']=='subrace' and s['relations']['raceId']==e['id']]}
            e['interpretations'].append({'field':'relations','kind':'derived','method':'Reverse explicit raceId references from verified subrace identities.'})
    return progression_status(entities)
