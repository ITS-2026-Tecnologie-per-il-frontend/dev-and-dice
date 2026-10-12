"""Generate a new immutable candidate database from a verified live-data backup.

Never changes public/data, source catalogs or application activation. Unknown
legacy content is retained with its provenance; OCR cannot become a correction.
"""
from __future__ import annotations

import argparse
import copy
from collections import Counter
from contextlib import closing, nullcontext
import hashlib
import json
from pathlib import Path
import sqlite3

from backup import verify_backup, digest, safe_member
from build import sqlite_export, coverage
from compare import compare, match
from errata import load_errata, corrected_reference, application_queue
from pdf_sources import ROOT, WORK, write_json
from validate import validate

OUTPUT = ROOT / 'rules-database.local' / '2014'
# Explicitly reviewed integration scopes. Expanding this requires adapter/tests.
SUPPORTED_CLASSES = {'phb2014:class:warlock','phb2014:class:fighter','phb2014:class:rogue','phb2014:class:barbarian','phb2014:class:druid','phb2014:class:bard','phb2014:class:paladin','phb2014:class:ranger','phb2014:class:monk','phb2014:class:wizard','phb2014:class:cleric','phb2014:class:sorcerer'}
SUPPORTED_OPTIONS = {'eldritch-invocation','pact-boon','fighting-style','fighter-maneuver','totem-choice','hunter-choice','monk-discipline','wizard-choice', 'metamagic', 'sorcerer-choice'}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def record_ref(e):
    return {'index':e['index'], 'name':e['name'], **({'nameIt':e['nameIt']} if e['nameIt'] else {})}


def legacy_edition(record):
    editions = record.get('editions')
    if editions:
        return {'status':'declared', 'editions':editions}
    return {'status':'not-verified', 'editions':[]}


def merge_catalogs(catalogs, reference):
    result = copy.deepcopy(catalogs)
    options = result['character-options.json']
    log, mapping, additions, creatures, magic_items, unresolved = [], [], [], [], [], []
    entities = reference['entities']
    by_id = {e['id']:e for e in entities}
    # An explicit, reviewed mapping: this is not a generic snake_case conversion.
    # Existing formulas, overlays and extension fields remain untouched.
    for e in entities:
        if e['kind']!='class-level' or e['relations']['classId']!='phb2014:class:warlock':
            continue
        level = e['mechanics']['level']
        hits = [x for x in options['levels'] if x.get('class',{}).get('index')=='warlock'
                and x.get('level')==level and not x.get('subclass')]
        if len(hits)!=1:
            raise ValueError('Ambiguous/missing legacy warlock progression: '+str(level))
        current = hits[0]
        field = 'invocations_known'
        old = current.get('class_specific',{}).get(field)
        correct = e['mechanics']['invocationsKnown']
        if e['verification']['mechanics']!='verified-fields' or 'invocationsKnown' not in e['fieldSources']:
            raise ValueError('Unverified invocation count')
        if old != correct:
            current.setdefault('class_specific',{})[field] = correct
            log.append({'operation':'correct','catalog':'character-options.json','array':'levels',
                        'currentId':current['index'],'referenceId':e['id'],'field':'class_specific.'+field,
                        'before':old,'after':correct,'sources':[e['sources'][i] for i in e['fieldSources']['invocationsKnown']],
                        'consequenceIt':'Il limite delle invocazioni segue la tabella verificata, non cresce ai livelli 4 e 6.'})
        mapping.append({'referenceId':e['id'],'catalog':'character-options.json','array':'levels',
                        'currentId':current['index'],'operation':'correct' if old!=correct else 'keep'})
    for e in entities:
        if e['kind']=='magic-item':
            if not e['verification']['complete'] or e['verification']['mechanics']!='verified-fields':
                unresolved.append({'referenceId':e['id'],'reason':'magic-item-incomplete; no automatic integration','missingFields':e['verification']['missingFields'],'completeReferenceRecord':False})
            else:
                magic_items.append(e)
                log.append({'operation':'add','catalog':'verified-magic-items-2014.json','array':'magicItems','currentId':e['index'],'referenceId':e['id'],'before':None,'after':e,'sources':e['sources']})
                mapping.append({'referenceId':e['id'],'catalog':'verified-magic-items-2014.json','array':'magicItems','currentId':e['index'],'operation':'add'})
                current=match(e,result['character-equipment.json'].get('magicItems',[]))
                if current is not None:
                    before=copy.deepcopy(current.get('verifiedRules2014'))
                    current['verifiedRules2014']={'referenceId':e['id'],'mechanics':e['mechanics'],'sources':e['sources']}
                    log.append({'operation':'enrich','catalog':'character-equipment.json','array':'magicItems','currentId':current['index'],'referenceId':e['id'],'field':'verifiedRules2014','before':before,'after':current['verifiedRules2014'],'sources':e['sources']})
                    mapping.append({'referenceId':e['id'],'catalog':'character-equipment.json','array':'magicItems','currentId':current['index'],'operation':'enrich'})
        if e['kind']=='creature':
            if not e['verification']['complete'] or e['verification']['mechanics']!='verified-fields':
                unresolved.append({'referenceId':e['id'],'reason':'creature-stat-block-incomplete; no automatic integration',
                                   'missingFields':e['verification']['missingFields'],'completeReferenceRecord':False})
            else:
                creatures.append(e)
                log.append({'operation':'add','catalog':'verified-creatures-2014.json','array':'creatures',
                            'currentId':e['index'],'referenceId':e['id'],'before':None,'after':e,'sources':e['sources']})
                mapping.append({'referenceId':e['id'],'catalog':'verified-creatures-2014.json','array':'creatures',
                                'currentId':e['index'],'operation':'add'})
        array = {'class':'classes','race':'races','subrace':'subraces','subclass':'subclasses','background':'backgrounds','spell':'spells','feat':'feats'}.get(e['kind'])
        if array:
            current = match(e, options.get(array,[]))
            if current:
                mapping.append({'referenceId':e['id'],'catalog':'character-options.json','array':array,
                                'currentId':current['index'],'operation':'keep'})
                if e['kind'] in ['race','subrace','background','spell','feat'] and e['verification']['complete'] and e['verification']['mechanics']=='verified-fields':
                    previous=copy.deepcopy(current.get('verifiedRules2014'))
                    current['verifiedRules2014']={'referenceId':e['id'],'mechanics':e['mechanics'],'sources':e['sources']}
                    log.append({'operation':'enrich','catalog':'character-options.json','array':array,'currentId':current['index'],
                                'referenceId':e['id'],'field':'verifiedRules2014','before':previous,'after':current['verifiedRules2014'],'sources':e['sources']})
                    mapping[-1]['operation']='enrich'
            elif e['kind']=='subclass' and e['verification']['complete'] and e['relations']['classId'] in SUPPORTED_CLASSES:
                # Do not add incomplete subclass identities as usable options.
                added = {**record_ref(e),'class':record_ref(by_id[e['relations']['classId']]),
                         'minimumLevel':e['mechanics']['minimumLevel'],'editions':['2014'],
                         'desc':[e['summaryIt']],'sources':[s['filename'] for s in e['sources']],
                         'verifiedRules2014':{'referenceId':e['id'],'mechanics':e['mechanics'],'sources':e['sources']}}
                options['subclasses'].append(added)
                mapping.append({'referenceId':e['id'],'catalog':'character-options.json','array':array,'currentId':e['index'],'operation':'add'})
                log.append({'operation':'add','catalog':'character-options.json','array':array,'currentId':e['index'],
                            'referenceId':e['id'],'before':None,'after':added,'sources':e['sources']})
            elif e['kind'] in ['spell','background','subrace','feat'] and e['verification']['complete'] and e['verification']['mechanics']=='verified-fields':
                m=e['mechanics']
                added={**record_ref(e),'desc':[e['summaryIt']],'editions':['2014'],
                       'verifiedRules2014':{'referenceId':e['id'],'mechanics':m,'sources':e['sources']}}
                if e['kind']=='spell':
                    added.update(level=m['level'],classes=[record_ref(by_id[i]) for i in e['relations']['classIds']],
                                 school={'index':m['school'],'name':m['school'].title()},ritual=m['ritual'],
                                 concentration=m['concentration'],components=m['components'],casting_time=m['castingTime'],
                                 range=m['range'],duration=m['duration'])
                elif e['kind']=='subrace':
                    added.update(race=record_ref(by_id[e['relations']['raceId']]),fixedAbilityBonuses=m['fixedAbilityBonuses'])
                    if 'speedOverrideFt' in m:added['speed']=m['speedOverrideFt']
                elif e['kind']=='background':
                    added.update(starting_gold=m['startingGold'],feature={'name':m['feature']['name'],'desc':[m['feature']['summaryIt']]},
                                 starting_proficiencies=[{**record_ref(by_id['phb2014:skill:'+i]),'index':'skill-'+i} for i in m['skillProficiencies']])
                    if m['languageChoice']['choose']:
                        added['language_options']={'choose':m['languageChoice']['choose'],'type':'languages','from':{'option_set_type':'options_array'}}
                    # Structured choices and narrative gear remain in verifiedRules2014;
                    # converting them into fixed grants would silently choose for the user.
                options.setdefault(array,[]).append(added)
                mapping.append({'referenceId':e['id'],'catalog':'character-options.json','array':array,'currentId':e['index'],'operation':'add'})
                log.append({'operation':'add','catalog':'character-options.json','array':array,'currentId':e['index'],'referenceId':e['id'],'before':None,'after':added,'sources':e['sources']})
            elif not current:
                unresolved.append({'referenceId':e['id'],'reason':'missing-in-legacy-catalog; adapter/remaining fields require review',
                                   'missingFields':e['verification']['missingFields'],'completeReferenceRecord':e['verification']['complete']})
        if e['kind']=='subclass-feature' and e['relations']['classId'] in SUPPORTED_CLASSES:
            if not e['verification']['complete'] or e['verification']['mechanics']!='verified-fields':
                unresolved.append({'referenceId':e['id'],'reason':'subclass feature incomplete; no automatic integration',
                                   'missingFields':e['verification']['missingFields'],'completeReferenceRecord':False})
                continue
            subclass = by_id[e['relations']['subclassId']]
            cls = by_id[e['relations']['classId']]
            if not subclass['verification']['complete']:
                unresolved.append({'referenceId':e['id'],'reason':'parent subclass dependencies incomplete',
                                   'missingFields':subclass['verification']['missingFields'],'completeReferenceRecord':True})
                continue
            existing = next((x for x in options['features'] if x.get('class',{}).get('index')==cls['index']
                             and x.get('subclass',{}).get('index')==subclass['index']
                             and x.get('level')==e['mechanics']['level'] and match(e,[x])),None)
            if existing:
                # Preserve readable existing text and fields, attach verified facts.
                previous=copy.deepcopy(existing.get('verifiedRules2014'))
                existing['verifiedRules2014']={'referenceId':e['id'],'mechanics':e['mechanics'],'sources':e['sources']}
                log.append({'operation':'enrich','catalog':'character-options.json','array':'features','currentId':existing['index'],
                            'referenceId':e['id'],'field':'verifiedRules2014','before':previous,'after':existing['verifiedRules2014'],'sources':e['sources']})
                current_id=existing['index']
            else:
                added={**record_ref(e),'index':e['id'].split(':')[0]+'-'+e['index'],'class':record_ref(by_id[e['relations']['classId']]),
                       'subclass':record_ref(subclass),'level':e['mechanics']['level'],'desc':[e['summaryIt']],
                       'editions':['2014'],'verifiedRules2014':{'referenceId':e['id'],'mechanics':e['mechanics'],'sources':e['sources']}}
                options['features'].append(added)
                log.append({'operation':'add','catalog':'character-options.json','array':'features','currentId':added['index'],
                            'referenceId':e['id'],'before':None,'after':added,'sources':e['sources']})
                current_id=added['index']
            mapping.append({'referenceId':e['id'],'catalog':'character-options.json','array':'features','currentId':current_id,
                            'operation':'enrich' if existing else 'add'})
        if e['kind']=='class-option':
            if not e['verification']['complete'] or e['verification']['mechanics']!='verified-fields' or e['mechanics'].get('optionType') not in SUPPORTED_OPTIONS:
                unresolved.append({'referenceId':e['id'],'reason':'incomplete or unsupported option; no automatic integration',
                                   'missingFields':e['verification']['missingFields'],'completeReferenceRecord':e['verification']['complete']})
                continue
            additions.append(e)
            log.append({'operation':'add','catalog':'verified-options-2014.json','array':'options',
                        'currentId':e['index'],'referenceId':e['id'],'before':None,'after':e,'sources':e['sources']})
            mapping.append({'referenceId':e['id'],'catalog':'verified-options-2014.json','array':'options',
                            'currentId':e['index'],'operation':'add'})
    # Only these individually read errata authorize a correction to an otherwise
    # incomplete spell. Other OCR fields and effects stay unverified.
    for correction in reference.get('editorialChangeLog',[]):
        if correction['field']!='school' or correction['verification']!='verified-official-erratum':
            continue
        e=by_id[correction['entityId']]
        current=match(e,options['spells'])
        if current is None:
            continue
        verified={'index':correction['correctedValue'],'name':correction['correctedValue'].title()}
        if current.get('school',{}).get('index')!=verified['index']:
            old=copy.deepcopy(current.get('school'))
            current['school']=verified
            log.append({'operation':'correct','catalog':'character-options.json','array':'spells',
                        'currentId':current['index'],'referenceId':e['id'],'field':'school',
                        'before':old,'after':verified,'sources':correction['sources'],
                        'consequenceIt':'La scuola segue le errata ufficiali; gli altri campi OCR non sono promossi a verificati.'})
    # Choices live in a separate typed catalog: putting all invocations into the
    # ordinary feature array would grant every invocation to every warlock.
    result['verified-options-2014.json']={'schemaVersion':1,'edition':'2014','options':additions,
                                         'policy':'selected-options-only; apply prerequisites and verified choice limits'}
    result['verified-creatures-2014.json']={'schemaVersion':1,'edition':'2014','creatures':creatures,
                                          'policy':'reviewed-stat-blocks-only; legacy-bestiary-preserved-unverified'}
    result['verified-magic-items-2014.json']={'schemaVersion':1,'edition':'2014','magicItems':magic_items,
        'policy':'individually-reviewed-items; explicit-variants-and-attunement; legacy-catalog-preserved-unverified'}
    creation_options=[e for e in entities if e['kind'] in ['feat','race-variant','background-variant','weapon-property']
                      and e['verification']['complete'] and e['verification']['mechanics']=='verified-fields']
    result['verified-creation-options-2014.json']={'schemaVersion':1,'edition':'2014','creationOptions':creation_options,
        'policy':'optional-feats-and-variants-are-explicit-selections; replacement-fields-do-not-stack-with-base-fields'}
    for e in creation_options:
        log.append({'operation':'add','catalog':'verified-creation-options-2014.json','array':'creationOptions','currentId':e['index'],'referenceId':e['id'],'before':None,'after':e,'sources':e['sources']})
        mapping.append({'referenceId':e['id'],'catalog':'verified-creation-options-2014.json','array':'creationOptions','currentId':e['index'],'operation':'add'})
    equipment=[e for e in entities if e['kind'] in ['weapon','armor','tool','gear','equipment-pack']
               and e['verification']['complete'] and e['verification']['mechanics']=='verified-fields']
    result['verified-equipment-2014.json']={'schemaVersion':1,'edition':'2014','equipment':equipment,
        'policy':'reviewed-PHB-equipment; purchase-quantities-and-piece-quantities-distinct; unknown-weight-is-not-zero'}
    for e in equipment:
        current=match(e,result['character-equipment.json'].get('equipment',[]))
        if current is not None:
            m=e['mechanics'];weight=m.get('weightLb',m.get('weight',{}).get('value'))
            corrected_weight=weight is not None and current.get('weight')!=weight
            if corrected_weight:
                field='weightLb' if 'weightLb' in m else 'weight'
                if not e['fieldSources'].get(field):raise ValueError('Unverified equipment weight')
                before=copy.deepcopy(current.get('weight'));current['weight']=weight
                log.append({'operation':'correct','catalog':'character-equipment.json','array':'equipment','currentId':current['index'],
                    'referenceId':e['id'],'field':'weight','before':before,'after':weight,'sources':e['sources'],
                    'consequenceIt':'Il peso del candidato segue il valore verificato; il catalogo operativo resta immutato.'})
            mapping.append({'referenceId':e['id'],'catalog':'character-equipment.json','array':'equipment','currentId':current['index'],'operation':'correct' if corrected_weight else 'keep'})
        else:
            m=e['mechanics'];weight=m.get('weightLb',m.get('weight',{}).get('value'))
            # New entries retain the complete typed record; dashes stay absent weights.
            added={**record_ref(e),'cost':m['cost'],'desc':[e['summaryIt']],
                   'verifiedRules2014':{'referenceId':e['id'],'mechanics':m,'sources':e['sources']}}
            if weight is not None:added['weight']=weight
            result['character-equipment.json']['equipment'].append(added)
            log.append({'operation':'add','catalog':'character-equipment.json','array':'equipment','currentId':e['index'],'referenceId':e['id'],'before':None,'after':added,'sources':e['sources']})
            mapping.append({'referenceId':e['id'],'catalog':'character-equipment.json','array':'equipment','currentId':e['index'],'operation':'add'})
        log.append({'operation':'add','catalog':'verified-equipment-2014.json','array':'equipment','currentId':e['index'],
                    'referenceId':e['id'],'before':None,'after':e,'sources':e['sources']})
        mapping.append({'referenceId':e['id'],'catalog':'verified-equipment-2014.json','array':'equipment','currentId':e['index'],'operation':'add'})
    return result, log, mapping, unresolved


def audit_records(catalogs, changes, id_map, backup_files):
    audit=[]
    for filename,catalog in sorted(catalogs.items()):
        if not isinstance(catalog,dict):
            continue
        for array,entries in sorted(catalog.items()):
            if not isinstance(entries,list):
                continue
            seen=set()
            for ordinal,entry in enumerate(entries):
                if not isinstance(entry,dict):
                    continue
                identifier=str(entry.get('index',entry.get('id',ordinal)))
                # Explicitly include scope for records whose indexes are scoped.
                scoped=(entry.get('class',{}).get('index'),entry.get('subclass',{}).get('index'),identifier)
                if scoped in seen:
                    raise ValueError('Duplicate in new catalog: '+filename+':'+array+':'+identifier)
                seen.add(scoped)
                operations=[c for c in changes if c['catalog']==filename and c['array']==array and c['currentId']==identifier]
                refs=[x['referenceId'] for x in id_map if x['catalog']==filename and x['array']==array and x['currentId']==identifier]
                added=any(c['operation']=='add' for c in operations)
                origin={'type':'verified-manual-reference'} if added else {
                    'type':'backup-existing-database-with-reviewed-changes' if operations else 'backup-existing-database',
                    'sha256':backup_files.get('public/data/'+filename,{}).get('sha256')}
                audit.append({'recordId':filename+':'+array+':'+str(ordinal), 'catalog':filename,'array':array,
                              'currentId':identifier,'operation':operations[-1]['operation'] if operations else 'keep',
                              'referenceIds':refs,'edition':legacy_edition(entry),
                              'origin':origin,
                              'verification':'verified-added-record' if added else 'reviewed-fields-only' if operations else 'retained-existing-not-fully-reverified',
                              'payload':entry})
    return audit


def verify_release(directory):
    directory=Path(directory)
    manifest=json.loads((directory/'RELEASE.json').read_text(encoding='utf-8'))
    for rel,expected in manifest['files'].items():
        if digest(safe_member(directory,rel).read_bytes())!=expected:
            raise ValueError('Candidate release drift: '+rel)
    with closing(sqlite3.connect(directory/'database.sqlite')) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Candidate SQLite integrity failure')
    return manifest


def creation_gap_audit(baseline,reference,mapping):
    by_id={e['id']:e for e in reference['entities']}
    rows=[]
    for gap in baseline['discrepancies']:
        if gap['type']!='missing-in-creation-catalog':continue
        e=by_id[gap['entityId']]
        destinations=[m for m in mapping if m['referenceId']==e['id']]
        rows.append({'referenceId':e['id'],'kind':e['kind'],'name':e['name'],'sources':e['sources'],
                     'verification':e['verification'],'destinations':destinations,
                     'decision':'integrated-isolated-candidate' if destinations else 'confirmed-identity-incomplete-no-automatic-addition' if not e['verification']['complete'] else 'confirmed-addition-requires-variant-or-choice-adapter',
                     'isErrorInExistingDatabase':False,
                     'reasonIt':'L’assenza dal catalogo di creazione è una lacuna di disponibilità, non un errore delle regole. Varianti e opzioni non sono concessioni automatiche.'})
    return {'schemaVersion':1,'initialGapCount':len(rows),'decisions':dict(Counter(r['decision'] for r in rows)),'entries':rows}


def build_candidate(backup, original=None, output=OUTPUT):
    backup=Path(backup).resolve()
    snapshot=verify_backup(backup)
    output=Path(output).resolve()
    if not output.is_relative_to(ROOT/'rules-database.local'):
        raise ValueError('Candidate output must stay inside rules-database.local')
    source_files={i['path']:i for i in snapshot['files']}
    files={i['path']:safe_member(backup/'files',i['path']).read_bytes()
           for i in snapshot['files'] if i['path'].startswith('public/data/')}
    actual=sorted(p.relative_to(ROOT).as_posix() for p in (ROOT/'public/data').rglob('*') if p.is_file())
    if sorted(files)!=actual or any((ROOT/rel).read_bytes()!=raw for rel,raw in files.items()):
        raise ValueError('Live catalogs changed since backup; create a new verified backup before merging')
    original=original or json.loads((WORK/'reference.json').read_text(encoding='utf-8'))
    errata,queue=load_errata()
    reference=corrected_reference(original,errata)
    errors=validate(reference)
    if errors:
        raise ValueError('\n'.join(errors))
    catalogs={Path(rel).name:json.loads(raw.decode('utf-8-sig')) for rel,raw in files.items() if rel.endswith('.json')}
    merged,changes,mapping,pending=merge_catalogs(catalogs,reference)
    audit=audit_records(merged,changes,mapping,source_files)
    baseline_dir=OUTPUT/'candidate-5234848b05f3a8cca0e2'
    if baseline_dir.exists():
        verify_release(baseline_dir)
        baseline=json.loads((baseline_dir/'comparison-before.json').read_text(encoding='utf-8'))
        gap_audit=creation_gap_audit(baseline,reference,mapping)
        gap_audit['baselineReleaseId']=baseline_dir.name
        gap_audit['baselineComparisonSHA256']=digest((baseline_dir/'comparison-before.json').read_bytes())
    else:
        gap_audit=creation_gap_audit(compare(original,backup/'files/public/data'),reference,mapping)
        gap_audit['baselineReleaseId']=None
    # Release identity comes from input bytes and deterministic reviewed records.
    generator_hashes={p.name:digest(p.read_bytes()) for p in sorted(Path(__file__).parent.glob('*.py'))}
    for name in ['inventory_audit.json','spell_names.json','spell_list_reviews.json','source_reviews.json','schema.ts']:
        generator_hashes[name]=digest(Path(__file__).with_name(name).read_bytes())
    generator_hashes['src/domain/dnd/VerifiedDatabase.ts']=digest((ROOT/'src/domain/dnd/VerifiedDatabase.ts').read_bytes())
    backup_hash=digest((backup/'BACKUP.json').read_bytes())
    key=digest(encoded({'inputs':{p:digest(b) for p,b in files.items()},'reference':reference,'catalogs':merged,
                        'generators':generator_hashes,'backupManifestSHA256':backup_hash,'creationGapAudit':gap_audit}))[:20]
    output.mkdir(parents=True,exist_ok=True)
    release=output/('candidate-'+key)
    if release.exists():
        if not (release/'RELEASE.json').is_file():
            raise ValueError('Incomplete earlier candidate retained for inspection: '+str(release))
        verify_release(release)
        return release
    # Publish readiness by writing RELEASE.json last. Creating the immutable
    # directory in place avoids directory moves denied by Windows file watchers.
    # An interrupted build has no RELEASE.json and is never accepted as a release.
    release.mkdir()
    with nullcontext(release) as stage:
        assert stage.is_relative_to(output) and release.is_relative_to(output)
        data=stage/'data';data.mkdir()
        for rel,raw in files.items():
            if not rel.endswith('.json'):
                (data/Path(rel).name).write_bytes(raw)
        for filename,content in merged.items():
            (data/filename).write_bytes(encoded(content))
        before=compare(original,backup/'files/public/data')
        after=compare(reference,data)
        write_json(stage/'original-reference.json',original)
        write_json(stage/'verified-reference.json',reference)
        write_json(stage/'changes.json',changes)
        write_json(stage/'id-map.json',mapping)
        write_json(stage/'record-audit.json',audit)
        write_json(stage/'pending-integration.json',pending)
        write_json(stage/'creation-gap-audit.json',gap_audit)
        write_json(stage/'comparison-before.json',before)
        write_json(stage/'comparison-after.json',after)
        write_json(stage/'coverage.json',coverage(reference))
        write_json(stage/'inventory-audit.json',json.loads(Path(__file__).with_name('inventory_audit.json').read_text(encoding='utf-8')))
        write_json(stage/'supporting-printing-log.json',reference.get('supportingPrintingLog',[]))
        write_json(stage/'errata-review-queue.json',application_queue(queue,reference))
        write_json(stage/'spell-list-editorial-resolutions.json',reference['spellListEditorialResolutions'])
        write_json(stage/'validation.json',{'passed':True,'referenceErrors':errors,'liveCatalogsUnchanged':True,
                                           'runtimeActivated':False,'allCategoriesComplete':False})
        sqlite_export(stage/'database.sqlite',reference)
        with closing(sqlite3.connect(stage/'database.sqlite')) as db,db:
            db.execute('CREATE TABLE catalog_records (record_id TEXT PRIMARY KEY, catalog TEXT, collection TEXT, current_id TEXT, operation TEXT, payload_json TEXT, audit_json TEXT)')
            db.executemany('INSERT INTO catalog_records VALUES (?,?,?,?,?,?,?)',[(a['recordId'],a['catalog'],a['array'],a['currentId'],a['operation'],json.dumps(a['payload'],ensure_ascii=False),json.dumps({k:v for k,v in a.items() if k!='payload'},ensure_ascii=False)) for a in audit])
            db.execute('CREATE TABLE changes (ordinal INTEGER PRIMARY KEY, payload_json TEXT NOT NULL)')
            db.executemany('INSERT INTO changes VALUES (?,?)',[(i,json.dumps(c,ensure_ascii=False)) for i,c in enumerate(changes)])
        (stage/'MIGRATION.md').write_text(
            '# Migrazione separata dalla costruzione\n\n'
            'Stato: candidato parziale. Il programma continua a usare public/data; questa release non viene attivata.\n\n'
            '1. Verificare RELEASE.json e backup.py --verify; esportare anche le schede dal browser.\n'
            '2. Provare il caricamento con loadCandidateCreationData di src/domain/dnd/VerifiedDatabase.ts in un ambiente isolato.\n'
            '3. Esaminare changes.json, pending-integration.json, record-audit.json e coverage.json. '
            'I record esistenti conservati non sono tutti verificati sui manuali. Le 32 invocazioni sono scelte, non privilegi automaticamente concessi.\n'
            '4. Per una futura attivazione, fare un nuovo backup e fermare i processi; sostituire il catalogo o configurare il loader '
            'come operazione distinta. Non cambiare gli identificatori senza usare id-map.json.\n'
            '5. In caso di regressione, fermare i processi e ripristinare public/data dal backup verificato; '
            'non modificare server/data per cambiare le regole. Le release restano immutabili.\n',encoding='utf-8')
        cov=coverage(reference)
        complete_categories=[c['kind'] for c in cov['categories'] if c['categoryComplete']]
        unresolved=[e for e in reference['entities'] if not e['verification']['complete']]
        summary=[
            '# Nuovo database D&D 2014 integrato','',
            '**Candidato isolato, non attivato.** Inventari PHB sottoposti ad audit; contenuti pertinenti DMG/MM revisionati negli scope dichiarati. Il riferimento complessivo resta parziale per le questioni esplicite sotto: non sono promosse interpretazioni a fatti.','',
            f'Backup originale immutabile: `{backup}`. Release `{release.name}`.',
            f'Entità: {len(reference["entities"])}; complete nel modello: {cov["recordCounts"]["complete"]}; aperte o dipendenti: {len(unresolved)}.',
            f'Cataloghi legacy conservati: {len(catalogs)}; record tracciati: {len(audit)}; operazioni: {len(changes)}.',
            f'Correzioni editoriali: {len(reference["editorialChangeLog"])}; conferme di testo già conforme: {len(reference.get("editorialConfirmationLog",[]))}.','',
            '## Inventari e contenuti','',
            'Dodici classi, quaranta sottoclassi PHB e due DMG; 249 eventi base, 220 privilegi di sottoclasse e 124 opzioni. Manovre separate dalle origini della selezione: Adepto Marziale non impone Maestro di Battaglia.',
            'Warlock: 2 invocazioni al livello 4, 3 al livello 6. Cavaliere Mistico e Mistificatore Arcano: slot di quarto livello ai livelli 19 e 20 verificati sui render. Originali ed errata della sostituzione libera e di Attacco Finto distinti.',
            'Nove razze PHB, nove sottorazze, variante umana, tredici background e cinque varianti. Esempi DMG aasimar ed eladrin richiedono DM e restano distinti da supplementi/2024. 338 suggerimenti di personalità, 88 specialità, sedici lingue e cento cianfrusaglie.',
            'Tutte le 361 descrizioni degli incantesimi lette: 357 complete, quattro questioni aperte. Liste separate: 844 collegamenti originali, 845 nella vista corretta.',
            'Equipaggiamento: 277 armi, armature, attrezzi e merci; sette dotazioni. Quantità delle confezioni, veicoli, animali, servizi, spese e tabelle verificate. Trentasette armi da equipaggiamento: il colpo senz’armi è una regola distinta.',
            f'Creature: {sum(e["kind"]=="creature" for e in reference["entities"])} blocchi, {cov["reviewedCreatureScope"]["completeStatBlocks"]} completi. Inventario delle 89 bestie individuali del MM, sei sciami separati, forme dei famigli e della Luna, evocazioni e dipendenze degli oggetti. Lo scope non è l’intero bestiario del MM.',
            f'Oggetti DMG: 276 record/famiglie, {cov["reviewedMagicItemScope"]["completeRecords"]} completi; proprietà, sintonia, consumabili, cariche, quattro oggetti senzienti e otto record artefatti. Mazzo delle Illusioni revisionato con 34 carte e figure; non concede statistiche di combattimento reali.',
            'Tesori: 28 tabelle, assegnazione, varianti e sottotabelle. Ricompense: sette benedizioni, sette doni consumabili, ventisei benefici epici. Nessuna concessione automatica del DM.',
            'Regole: avventura e combattimento PHB, geometria delle aree, TS, collaborazione, nascondersi, concentrazione, recuperi e multiclassamento; DMG veleni, malattie, follia, opzioni di combattimento, trappole, ambiente, piani, incontri, oggetti, assedi, inseguimenti, attività tra avventure e punti magia. Appendici PHB: nove pantheon con 195 voci, sedici Piani Esterni e 31 rimandi di creature.',
            'Chiarimenti SAC su Trance e Fortunato distinti dalle errata. Deviare Proiettili: gittata 20/60 piedi esplicita in SRD ufficiale inglese 5.1 PDF 27, conservata nel supporting-printing-log.json separato dalla prima stampa e dalle errata. SRD italiano 5.1 concorda; 2024 escluso.',
            f'Categorie PHB certificate nello scope dell’audit: {", ".join(complete_categories)}. Identità firmate e pagine in inventory-audit.json; altri scope e dipendenze in coverage.json.','',
            '## Confronto e integrazione','',
            f'Differenze prima: {dict(Counter(x["type"] for x in before["discrepancies"]))}.',
            f'Differenze dopo: {dict(Counter(x["type"] for x in after["discrepancies"]))}.',
            f'Lacune iniziali: {gap_audit["initialGapCount"]}; decisioni: {gap_audit["decisions"]}.',
            'changes.json e id-map.json conservano le operazioni e gli ID; record-audit.json distingue ogni record, origine e stato. Dati legacy non riconosciuti conservati senza attribuzione inventata di edizione o provenienza.',
            'public/data invariato, verificato byte per byte prima e dopo il merge; backup e release precedenti non modificati. Adattatore isolato dal loader operativo.','',
            '## Questioni aperte','',
        ]
        summary.extend(f'- `{e["id"]}`: {", ".join(e["verification"]["missingFields"])}.' for e in unresolved)
        summary.extend(['','Le voci dipendenti non sono ulteriori passaggi da leggere: richiedono la risoluzione della questione originaria. Fonti mancanti di supplementi/UA e tabelle narrative o mostri estranei allo scope non sono certificati. Nessuna di queste voci entra automaticamente nei cataloghi verificati.','',
            '## Verifica e migrazione','',
            'Integrità JSON/SQLite, riferimenti, fonti e provenienza dei campi sono controllati durante la generazione. Test Python, test Node dell’adattatore, schema TypeScript e build sono riproducibili seguendo scripts/rules2014/README.md; l’attestazione dell’esecuzione sulla release è nel rapporto della ripresa.',
            'Seguire MIGRATION.md della release e RESTORE.md del backup. Attivazione distinta, nuovo backup prima di cambiare il loader; ripristino reversibile. Nessun commit o push nella ripresa.'])
        (stage/'REPORT.md').write_text('\n'.join(summary)+'\n',encoding='utf-8')
        # Check again after all processing; a live change invalidates the build.
        if any((ROOT/rel).read_bytes()!=raw for rel,raw in files.items()):
            raise ValueError('Live catalogs changed during merge')
        payloads={p.relative_to(stage).as_posix():digest(p.read_bytes()) for p in sorted(stage.rglob('*')) if p.is_file()}
        write_json(stage/'RELEASE.json',{'schemaVersion':1,'releaseId':key,'status':'partial-candidate-not-active',
                                      'editionPolicy':'2014-reference-with-separate-unverified-legacy-content',
                                      'backup':backup.as_posix(),'backupManifestSHA256':backup_hash,
                                      'generatorSHA256':generator_hashes,
                                      'files':payloads,'sourceCatalogSHA256':{p:digest(b) for p,b in files.items()},
                                      'runtimeActivated':False})
        verify_release(stage)
    verify_release(release)
    return release


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--backup',type=Path)
    parser.add_argument('--verify',type=Path)
    args=parser.parse_args()
    if args.verify:
        verify_release(args.verify)
        print('Candidate release integrity: OK')
    else:
        if args.backup is None:
            parser.error('--backup is required when building a candidate')
        print('New candidate database:',build_candidate(args.backup))


if __name__=='__main__':
    main()
