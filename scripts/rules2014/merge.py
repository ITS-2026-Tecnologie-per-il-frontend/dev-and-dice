"""Generate a new immutable candidate database from a verified live-data backup.

Never changes public/data, source catalogs or application activation. Unknown
legacy content is retained with its provenance; OCR cannot become a correction.
"""
from __future__ import annotations

import argparse
import copy
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
    log, mapping, additions, unresolved = [], [], [], []
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
        array = {'class':'classes','race':'races','subrace':'subraces','subclass':'subclasses','background':'backgrounds','spell':'spells'}.get(e['kind'])
        if array:
            current = match(e, options.get(array,[]))
            if current:
                mapping.append({'referenceId':e['id'],'catalog':'character-options.json','array':array,
                                'currentId':current['index'],'operation':'keep'})
            elif e['kind']=='subclass' and e['verification']['complete'] and e['relations']['classId']=='phb2014:class:warlock':
                # Do not add incomplete subclass identities as usable options.
                added = {**record_ref(e),'class':record_ref(by_id[e['relations']['classId']]),
                         'minimumLevel':e['mechanics']['minimumLevel'],'editions':['2014'],
                         'desc':[e['summaryIt']],'sources':[s['filename'] for s in e['sources']],
                         'verifiedRules2014':{'referenceId':e['id'],'mechanics':e['mechanics'],'sources':e['sources']}}
                options['subclasses'].append(added)
                mapping.append({'referenceId':e['id'],'catalog':'character-options.json','array':array,'currentId':e['index'],'operation':'add'})
                log.append({'operation':'add','catalog':'character-options.json','array':array,'currentId':e['index'],
                            'referenceId':e['id'],'before':None,'after':added,'sources':e['sources']})
            elif not current:
                unresolved.append({'referenceId':e['id'],'reason':'missing-in-legacy-catalog; adapter/remaining fields require review',
                                   'missingFields':e['verification']['missingFields'],'completeReferenceRecord':e['verification']['complete']})
        if e['kind']=='subclass-feature' and e['verification']['complete']:
            subclass = by_id[e['relations']['subclassId']]
            existing = next((x for x in options['features'] if x.get('class',{}).get('index')=='warlock'
                             and x.get('subclass',{}).get('index')==subclass['index']
                             and x.get('level')==e['mechanics']['level'] and match(e,[x])),None)
            if existing:
                # Preserve readable existing text and fields, attach verified facts.
                existing['verifiedRules2014']={'referenceId':e['id'],'mechanics':e['mechanics'],'sources':e['sources']}
                log.append({'operation':'enrich','catalog':'character-options.json','array':'features','currentId':existing['index'],
                            'referenceId':e['id'],'field':'verifiedRules2014','before':None,'after':existing['verifiedRules2014'],'sources':e['sources']})
                current_id=existing['index']
            else:
                added={**record_ref(e),'index':'phb2014-'+e['index'],'class':record_ref(by_id[e['relations']['classId']]),
                       'subclass':record_ref(subclass),'level':e['mechanics']['level'],'desc':[e['summaryIt']],
                       'editions':['2014'],'verifiedRules2014':{'referenceId':e['id'],'mechanics':e['mechanics'],'sources':e['sources']}}
                options['features'].append(added)
                log.append({'operation':'add','catalog':'character-options.json','array':'features','currentId':added['index'],
                            'referenceId':e['id'],'before':None,'after':added,'sources':e['sources']})
                current_id=added['index']
            mapping.append({'referenceId':e['id'],'catalog':'character-options.json','array':'features','currentId':current_id,
                            'operation':'enrich' if existing else 'add'})
        if e['kind']=='class-option':
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
    # Release identity comes from input bytes and deterministic reviewed records.
    generator_hashes={p.name:digest(p.read_bytes()) for p in sorted(Path(__file__).parent.glob('*.py'))}
    backup_hash=digest((backup/'BACKUP.json').read_bytes())
    key=digest(encoded({'inputs':{p:digest(b) for p,b in files.items()},'reference':reference,'catalogs':merged,
                        'generators':generator_hashes,'backupManifestSHA256':backup_hash}))[:20]
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
        write_json(stage/'comparison-before.json',before)
        write_json(stage/'comparison-after.json',after)
        write_json(stage/'coverage.json',coverage(reference))
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
        (stage/'REPORT.md').write_text(
            '# Nuovo database D&D 2014 integrato\n\n**Stato: parziale; non attivato.**\n\n'
            f'Backup: `{backup}`.\n\n'
            f'Cataloghi conservati: {len(catalogs)}; record di catalogo tracciati: {len(audit)}; '
            f'operazioni: {len(changes)}; correzioni editoriali nella vista verificata: {len(reference["editorialChangeLog"])}.\n\n'
            'Invocazioni del warlock corrette a 2 al livello 4 e 3 al livello 6. '
            'La sorgente indipendente core_rules.py conserva i valori ad ogni rigenerazione.\n\n'
            'Sono aggiunti i patroni PHB mancanti e i relativi privilegi verificati. '
            'Le liste ampliate permettono la scelta senza concedere automaticamente gli incantesimi.\n\n'
            'Originali ed errata restano distinti in original-reference.json e verified-reference.json. '
            'I candidati OCR non correggono i cataloghi e le aggiunte ancora incomplete sono in pending-integration.json.\n\n'
            'Restano da completare le altre classi/sottoclassi, i passaggi degli incantesimi ancora non revisionati, '
            'categorie PHB residue e cataloghi DMG/MM. Nessuna categoria globale e dichiarata completa.\n',encoding='utf-8')
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
