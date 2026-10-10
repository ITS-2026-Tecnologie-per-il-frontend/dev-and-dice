"""Integrity checks run before a local reference artifact is written."""
from collections import Counter


def validate(database):
    errors=[]
    entities=database['entities']
    ids=Counter(e['id'] for e in entities)
    errors.extend('Duplicate ID: '+i for i,n in ids.items() if n>1)
    manifest=database['sources']
    for e in entities:
        if e['edition']!='2014':
            errors.append('Wrong edition: '+e['id'])
        v=e['verification']
        if v['complete'] and (v['missingFields'] or v['mechanics']!='verified-fields'):
            errors.append('False completion: '+e['id'])
        for s in e['sources']:
            book=s['book']
            if book not in manifest or manifest[book].get('review',{}).get('edition')!='2014':
                errors.append('Unverified or revised source: '+e['id'])
                continue
            if s['filename']!=manifest[book]['filename']:
                errors.append('Wrong source filename: '+e['id'])
            for page in s['pdfPages']:
                if not isinstance(page,int) or not 1<=page<=manifest[book]['pageCount']:
                    errors.append('Invalid page: '+e['id'])
        for field,refs in e['fieldSources'].items():
            if field not in e['mechanics'] or any(i<0 or i>=len(e['sources']) for i in refs):
                errors.append('Invalid field provenance: '+e['id']+':'+field)
        for key,value in e.get('relations',{}).items():
            for target in value if isinstance(value,list) else [value]:
                if target not in ids:
                    errors.append('Dangling relation: '+e['id']+':'+key+':'+str(target))
        def check_nested(value, path):
            if isinstance(value,dict):
                for key,item in value.items(): check_nested(item,path+'.'+key)
            elif isinstance(value,list):
                for n,item in enumerate(value): check_nested(item,path+'.'+str(n))
            elif isinstance(value,str) and value.startswith(('phb2014:','dmg2014:','mm2014:')) and value not in ids:
                errors.append('Dangling mechanical reference: '+e['id']+':'+path+':'+value)
        check_nested(e['mechanics'],'mechanics')
        if e['kind']=='equipment-pack':
            for c in e['mechanics']['contents']:
                if c['entityId'] not in ids:
                    errors.append('Dangling pack content: '+e['id']+':'+c['entityId'])
        if e['kind']=='class':
            equipment=e['mechanics']['startingEquipment']
            selected=[*equipment['fixed'],*(item for choice in equipment['choices'] for group in choice['options'] for item in group)]
            for item in selected:
                if item.get('entityId') is not None and item['entityId'] not in ids:
                    errors.append('Dangling starting equipment: '+e['id']+':'+item['entityId'])
                if not isinstance(item['quantity'],int) or item['quantity']<1:
                    errors.append('Invalid equipment quantity: '+e['id'])
        if e['kind']=='class-level':
            slots=e['mechanics']['spellSlots']
            if len(slots)!=9 or any(not isinstance(n,int) or n<0 for n in slots):
                errors.append('Invalid spell slots: '+e['id'])
    levels=[e for e in entities if e['kind']=='class-level']
    by_class=Counter(e['relations']['classId'] for e in levels)
    for c in [e for e in entities if e['kind']=='class']:
        actual=sorted(e['mechanics']['level'] for e in levels if e['relations']['classId']==c['id'])
        if actual!=list(range(1,21)):
            errors.append('Class progression incomplete: '+c['id'])
    return errors
