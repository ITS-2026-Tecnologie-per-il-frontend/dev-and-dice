"""Explicit references, including quantity units for ammunition purchase packs."""


def link_entities(entities):
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
            e['relations']={'subraceIds':[s['id'] for s in entities if s['kind']=='subrace' and s['relations']['raceId']==e['id']]}
            e['interpretations'].append({'field':'relations','kind':'derived','method':'Reverse explicit raceId references from verified subrace identities.'})
    return entities
