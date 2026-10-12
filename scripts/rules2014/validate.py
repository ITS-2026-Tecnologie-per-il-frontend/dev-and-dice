"""Integrity checks run before a local reference artifact is written."""
from collections import Counter
import re
from curated import ABILITIES


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
        if not e['sources'] or not e['id'].startswith(e['sources'][0]['book']+'2014:'):
            errors.append('Source namespace mismatch: '+e['id'])
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
            if field not in e['mechanics'] or not refs or any(i<0 or i>=len(e['sources']) for i in refs):
                errors.append('Invalid field provenance: '+e['id']+':'+field)
        if v['mechanics']=='verified-fields':
            errors.extend('Missing field provenance: '+e['id']+':'+f for f in sorted(set(e['mechanics'])-set(e['fieldSources'])))
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
        if e['kind']=='magic-item':
            m=e['mechanics']
            if m.get('category') not in ['armor','weapon','wondrous','potion','ring','rod','scroll','staff','wand'] or m.get('rarity') not in ['common','uncommon','rare','very-rare','legendary','varies','artifact'] or type(m.get('requiresAttunement'))!=bool or not isinstance(m.get('effect'),dict) or not e.get('summaryIt'):
                errors.append('Invalid magic item: '+e['id'])
            variants=m.get('effect',{}).get('variants',[])
            if variants and len({v['index'] for v in variants})!=len(variants):errors.append('Duplicate magic item variant: '+e['id'])
        if e['kind']=='creature':
            m=e['mechanics']
            if set(m.get('abilities',{}))!=set(ABILITIES) or any(type(v)!=int or not 1<=v<=30 for v in m.get('abilities',{}).values()):
                errors.append('Invalid creature abilities: '+e['id'])
            dice=re.fullmatch(r'(\d+)d(\d+)([+-]\d+)?',m.get('hitPoints',{}).get('dice',''))
            confirmed_original=(e['id']=='mm2014:creature:horned-devil' and m.get('hitPoints')=={'average':178,'dice':'17d10+55'} and any(a.get('field')=='hitPoints' and a.get('renderConfirmedValue')==m['hitPoints'] and a.get('status')=='confirmed-first-printing-arithmetic-inconsistency' for a in e.get('sourceAnomalies',[])))
            if not confirmed_original and (not dice or (int(dice[1])*(int(dice[2])+1)//2+int(dice[3] or 0))!=m['hitPoints']['average']):
                errors.append('Creature HP dice/average mismatch: '+e['id'])
            if 'walk' not in m.get('speedFt',{}) or any(type(v)!=int or v<0 for v in m.get('speedFt',{}).values()):
                errors.append('Invalid creature movement: '+e['id'])
            actions=m.get('actions',[])
            if len({a['index'] for a in actions})!=len(actions):errors.append('Duplicate creature action: '+e['id'])
            for a in [*actions,*m.get('reactions',[]),*m.get('legendaryActions',[])]:
                if not a.get('summaryIt') or a.get('kind') not in ['melee-weapon-attack','ranged-weapon-attack','melee-or-ranged-weapon-attack','melee-spell-attack','ranged-spell-attack','multiattack','special']:
                    errors.append('Invalid creature action: '+e['id'])
                if a.get('kind') in ['ranged-weapon-attack','melee-or-ranged-weapon-attack','ranged-spell-attack']:
                    r=a.get('rangeFt',{})
                    if not isinstance(r,dict) or set(r)!={'normal','long'} or any(type(v)!=int or v<=0 for v in r.values()) or r['long']<r['normal']:
                        errors.append('Invalid creature ranged attack: '+e['id'])
                attacks=a.get('effect',{}).get('attacks',[])+[x for choice in a.get('effect',{}).get('attackAlternatives',[]) for x in choice]
                for attack in attacks:
                    if not any(x['index']==attack['actionIndex'] and x['kind'] in ['melee-weapon-attack','ranged-weapon-attack','melee-or-ranged-weapon-attack','melee-spell-attack','ranged-spell-attack'] for x in actions):
                        errors.append('Dangling multiattack component: '+e['id'])
                remaining=a.get('effect',{}).get('remainingAttacks',{})
                if remaining and (type(remaining.get('count'))!=int or remaining['count']<1 or not remaining.get('eachActionIndexChoice') or any(not any(x['index']==i and x['kind'].endswith('-attack') for x in actions) for i in remaining['eachActionIndexChoice'])):
                    errors.append('Invalid remaining multiattack choices: '+e['id'])
        if e['kind']=='class-option' and e['mechanics'].get('optionType') in ['fighting-style','fighter-maneuver','totem-choice','hunter-choice','monk-discipline','wizard-choice', 'metamagic', 'sorcerer-choice']:
            m=e['mechanics']
            if m.get('prerequisites')!={} or not m.get('selectionOrigins'):
                errors.append('Effects and selection origins not separated: '+e['id'])
        if e['id']=='phb2014:subclass-feature:eldritch-knight-3-spellcasting':
            rows=e['mechanics']['effect']['progression']
            if [r['fighterLevel'] for r in rows]!=list(range(3,21)) or any(len(r['spellSlots'])!=9 for r in rows):
                errors.append('Invalid Eldritch Knight progression: '+e['id'])
            if any(r['spellSlots'][3] != (1 if r['fighterLevel']>=19 else 0) for r in rows):
                errors.append('Eldritch Knight fourth-level slots differ from reviewed render: '+e['id'])
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
