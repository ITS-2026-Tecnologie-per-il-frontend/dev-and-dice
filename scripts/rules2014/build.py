"""Build an isolated, auditable 2014 reference without changing public/data."""
from __future__ import annotations
import argparse
from collections import Counter
import json
from pathlib import Path
import sqlite3
from contextlib import closing

from pdf_sources import ROOT, WORK, extract, load_pages, write_json
import curated
import core_rules
import combat
import gear
from class_details import apply_equipment, class_features, dmg_options, supplemental_rules
from feature_reviews import apply_feature_reviews
from spell_extract import extract_spells
from spell_reviews import apply_reviews
from spell_lists import extract_lists
from compare import compare
from validate import validate
from relations import link_entities


def load_reviews(manifest):
    reviews=json.loads(Path(__file__).with_name('source_reviews.json').read_text(encoding='utf-8'))
    for book,entry in manifest.items():
        review=reviews[book]
        entry['review']={**review,'status':'verified-local-copy' if entry.get('sha256')==review['sha256'] else 'source-changed-requires-review'}
        if entry['review']['status']!='verified-local-copy' and book!='srd521-it':
            raise ValueError('Missing, unreadable or changed source: '+entry['filename']+'. Review edition and page references before rebuilding.')
    return manifest


def build_entities(pages):
    classes=curated.classes();apply_equipment(classes)
    features=apply_feature_reviews(class_features(classes))
    levels=core_rules.progressions()
    for level in levels:
        level['relations']['featureIds']=[f['id'] for f in features if f['relations']['classId']==level['relations']['classId'] and f['mechanics']['level']==level['mechanics']['level']]
        level['verification']['missingFields'].remove('featureLinks')
        # Events are linked, but subclass tables and all effect semantics are not.
        level['verification']['missingFields'].append('subclassProgressionAndFeatureEffects')
    entities=[*classes,*curated.subclasses(),*curated.races(),*curated.subraces(),*curated.race_variants(),
              *curated.backgrounds(),*curated.background_variants(),*curated.weapons(),*curated.armor(),*curated.tools(),
              *curated.feats(),*core_rules.skills(),*core_rules.conditions(),*core_rules.rules(),*levels,*features,
              *core_rules.advancement(),*combat.actions(),*combat.properties(),*combat.additional_rules(),
              *gear.gear(),*gear.packs(),*dmg_options(),*supplemental_rules()]
    for e in entities:
        # Nulls that reflect ambiguity cannot be advertised as a complete rule.
        if e['index']=='long-rest':
            e['verification'].update(complete=False,missingFields=['hitDiceRecovery.minimum-in-this-printing'])
    inventory=json.loads(Path(__file__).with_name('spell_names.json').read_text(encoding='utf-8'))
    spells=extract_spells(pages,inventory['names'],{'FINO STEEO':'Find Steed'})
    if len(spells)!=361 or len({s['id'] for s in spells})!=361:
        raise ValueError('Spell inventory changed: review extraction and headings; do not silently declare coverage.')
    for spell in spells:
        # Each expected spelling was reconciled against the PHB heading inventory,
        # but the mechanical headers remain candidates until individually reviewed.
        spell['verification']['identity']='heading-inventory-matched'
    apply_reviews(spells)
    entities.extend(spells)
    return link_entities(entities)


def coverage(database):
    entities=database['entities']
    expected={'class':12,'subclass':40,'race':9,'subrace':9,'race-variant':1,'background':13,'background-variant':5,
              'weapon':37,'armor':13,'tool':37,'feat':42,'class-level':240,'skill':18,'condition':15,'spell':361,
              'gear':len(gear.ROWS.splitlines()),'equipment-pack':7,'weapon-property':11,'action':10,'advancement':20}
    categories=[]
    for kind in sorted({e['kind'] for e in entities}):
        entries=[e for e in entities if e['kind']==kind and e['sources'][0]['book']=='phb']
        count=len(entries)
        categories.append({'kind':kind,'expectedIdentities':expected.get(kind),'extractedIdentities':count,
          'verifiedMechanicalRecords':sum(e['verification']['mechanics']=='verified-fields' for e in entries),
          'completeRecords':sum(e['verification']['complete'] for e in entries),
          'categoryComplete':False,
          'missingFields':dict(sorted(Counter(f for e in entries for f in e['verification']['missingFields']).items())),
          'status':'partial' if any(not e['verification']['complete'] for e in entries) or kind not in expected else 'inventory-and-records-verified-category-audit-pending',
          'expectedIds':[e['id'] for e in entries]})
    return {'edition':'2014','overallComplete':False,'categories':categories,
      'additionalExtracted':{'DMG-subclasses':2,'DMG-rules':1,'MM-rules':4},
      'individuallyReviewedSpells':14,
      'spellDescriptionsPending':sum(e['kind']=='spell' and e['verification']['mechanics']!='verified-fields' for e in entities),
      'pendingScopes':[
        {'book':'phb','category':'subclass-features-and-choices','pdfPages':[50,120],'status':'partial-inventory','remaining':'Nomi dei singoli privilegi, liste concesse, invocazioni, manovre, metamagia, discipline, terreni e relativi effetti.'},
        {'book':'phb','category':'spell-effects-materials-and-upcast','pdfPages':[212,290],'status':'pending-semantic-review','remaining':'347 passaggi ancora da leggere integralmente; 14 incantesimi revisionati, di cui Magic Missile conserva un’interpretazione aperta. Liste di classe degli altri incantesimi: candidati OCR.'},
        {'book':'phb','category':'vehicles-mounts-services-tradegoods','pdfPages':[156,162],'status':'inventory-pending'},
        {'book':'phb','category':'languages-alignments-personality-tables','pdfPages':[123,142],'status':'inventory-pending'},
        {'book':'phb','category':'remaining-adventuring-rules','pdfPages':[182,200],'status':'partial-inventory'},
        {'book':'phb','category':'appendices-deities-planes-creatures','pdfPages':[294,312],'status':'inventory-pending'},
        {'book':'dmg','category':'magic-items-treasure-and-optional-rules','pdfPages':[129,321],'status':'inventory-pending','remaining':'Oggetti magici, tesori, creazione, veleni, armi da fuoco/esplosivi, opzioni di campagna e combattimento.'},
        {'book':'mm','category':'monster-stat-blocks-npc-beasts','pdfPages':[13,353],'status':'inventory-pending','remaining':'Statistiche, tratti, azioni, reazioni, azioni leggendarie, tana e varianti; non importati dal database attuale.'}],
      'sourceLimitations':{book:{'status':entry['status'],'textEmptyPdfPages':entry.get('emptyPdfPages',[]),
        'noteIt':'Pagina priva di testo estraibile non equivale a pagina assente: può contenere un’illustrazione o richiedere ispezione visiva.'} for book,entry in database['sources'].items()},
      'missingSources':['Errata complete e ufficiali successive alle stampe locali','Supplementi citati dal catalogo maghi e fonti UA non presenti in MANUALI'],
      'cautionIt':'CompleteRecords riguarda i campi del modello attuale. Nessuna categoria è dichiarata completa finché inventario e rimandi non ricevono un audit finale.'}


def sqlite_export(path,database):
    # No destructive deletion: replace only the dedicated generated tables.
    with closing(sqlite3.connect(path)) as db, db:
        db.execute('CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, kind TEXT NOT NULL, edition TEXT NOT NULL CHECK(edition="2014"), name TEXT NOT NULL, name_it TEXT, complete INTEGER NOT NULL, payload_json TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS sources (book TEXT PRIMARY KEY, payload_json TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS relations (entity_id TEXT REFERENCES entities(id), role TEXT NOT NULL, target_id TEXT REFERENCES entities(id), PRIMARY KEY(entity_id,role,target_id))')
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('DELETE FROM relations');db.execute('DELETE FROM entities');db.execute('DELETE FROM sources')
        db.executemany('INSERT INTO entities VALUES (?,?,?,?,?,?,?)',[(e['id'],e['kind'],e['edition'],e['name'],e['nameIt'],int(e['verification']['complete']),json.dumps(e,ensure_ascii=False,sort_keys=True)) for e in database['entities']])
        db.executemany('INSERT INTO sources VALUES (?,?)',[(k,json.dumps(v,ensure_ascii=False,sort_keys=True)) for k,v in database['sources'].items()])
        rows=[]
        for e in database['entities']:
            for role,value in e.get('relations',{}).items():
                rows.extend((e['id'],role,target) for target in value if isinstance(value,list)) if isinstance(value,list) else rows.append((e['id'],role,value))
        db.executemany('INSERT INTO relations VALUES (?,?,?)',rows)


def report(work,database,cov,comparison):
    counts=Counter(x['type'] for x in comparison['discrepancies'])
    lines=['# Riferimento locale D&D 2014 — estrazione e confronto','',
      '**Stato: parziale.** Inventari principali del PHB censiti; effetti degli incantesimi e dei privilegi, alcune categorie PHB e i cataloghi DMG/MM restano da verificare. Nessuna categoria è dichiarata completa.',
      '',f"Entità: {len(database['entities'])}. Campi meccanici confrontati: {comparison['comparedMechanicalFields']}. Database applicativo: invariato (SHA-256 registrati).",'',
      '## Copertura','', '| Categoria | Inventario atteso | Identità/eventi estratti | Record con alcuni campi verificati | Record completi nel modello |','|---|---:|---:|---:|---:|']
    for c in cov['categories']:
        lines.append(f"| {c['kind']} | {c['expectedIdentities'] if c['expectedIdentities'] is not None else 'da censire'} | {c['extractedIdentities']} | {c['verifiedMechanicalRecords']} | {c['completeRecords']} |")
    lines+=['','Sono stati letti integralmente 14 incantesimi; altri 347 conservano metadati OCR da verificare. L’inventario non rende verificati tempi, componenti, durate, effetti o relazioni di classe.',
      'I 249 eventi di progressione comprendono etichette generiche derivate per i privilegi di sottoclasse. Per 99 eventi gli effetti sono strutturati; negli altri è verificato il livello, non il comportamento completo.',
      '','## Fonti e stampa','']
    for s in database['sources'].values():
        review=s['review']; evidence=', '.join('PDF '+str(e['pdfPage'])+' '+e['section'] for e in review['evidence'])
        lines.append(f"- `{s['filename']}`: edizione {review['edition']}, {review['role']}; {evidence}. {review['notesIt']}")
    lines+=['','## Differenze dell’SRD italiano','',
      '- SRD italiano PDF 84, Lottatore: due benefici; PHB PDF 168 ne include un terzo assente nel supporto SRD. La causa editoriale richiede una fonte di errata ulteriore; non ripristinarlo automaticamente.',
      '- SRD italiano PDF 99, Riposo lungo: almeno un dado vita recuperato; PHB PDF 187 non esplicita quel minimo. È una differenza di stampa.',
      '- SRD italiano PDF 7, Eredità infernale: recupero dopo riposo lungo; PHB PDF 44 usa una volta al giorno.',
      '- Il supporto italiano è SRD 5.1: non contiene il catalogo completo del PHB. Il compatto SRD 5.2.1 è escluso.',
      '', '## Risultati del confronto','']
    lines += [f'- {k}: {n}.' for k,n in sorted(counts.items())]
    lines+=['',f"Contenuti aggiuntivi nel catalogo sottoclassi: {len(comparison['additionalCatalogContent'])}; vedi `comparison.json`. UA e supplementi sono distinti dagli errori.",
      f"Record del catalogo generale/armi non riconosciuti dall’inventario PHB attuale: {len(comparison['unmatchedCatalogRecords'])}; provenienza da verificare. Oggetti magici e mostri hanno un confronto ancora rinviato.",
      '', 'Ogni discrepanza riporta identificatore, campo, valore attuale, valore di riferimento o candidato, pagine, conseguenza e proposta. Le differenze di traduzione restano da verificare.',
      '', '## Lavoro ancora necessario','']
    lines+=['- Liste incantesimi: `Trap the Soul` (PHB PDF 212) non ha una descrizione corrispondente nel corpus; la voce resta irrisolta. `Destructive Smite` (lista paladino, PDF 210) è associato a `Destructive Wave` soltanto come candidato, con nome OCR originale conservato.']
    lines += [f"- {x['book']} / {x['category']}: {x['status']}. {x.get('remaining','Inventario delle voci e verifica delle meccaniche da completare.')}" for x in cov['pendingScopes']]
    lines+=['','Pagine senza testo e fonti mancanti sono elencate in `coverage.json`; non sono state interpretate come assenza di regole.',
      '', '## Artefatti','',
      '- `reference.json`: entità, campi, relazioni e provenienza; `reference.sqlite`: copia interrogabile, non usata dall’app.',
      '- `comparison.json`: confronto ripetibile e hash dei cinque cataloghi di ingresso.',
      '- `coverage.json`: inventario e campi mancanti; `spell-list-candidates.json`: relazioni OCR e righe irrisolte.',
      '- `source-manifest.json`: impronte e revisione dei manuali; `validation.json`: controlli di integrità.',
      '', 'Vedi `scripts/rules2014/README.md` per rigenerazione, schema, limiti e verifiche. Cache e output restano locali e separati da `public/data`.']
    (work/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--skip-spell-lists',action='store_true');args=parser.parse_args()
    manifest=extract();manifest=load_reviews(manifest);write_json(WORK/'source-manifest.json',manifest)
    database={'schemaVersion':1,'edition':'2014','status':'partial-reference-not-runtime-database','sources':manifest,'entities':build_entities(load_pages('phb'))}
    errors=validate(database);write_json(WORK/'validation.json',{'errors':errors,'passed':not errors})
    if errors:raise ValueError('\n'.join(errors))
    write_json(WORK/'reference.json',database);sqlite_export(WORK/'reference.sqlite',database)
    spells=[e for e in database['entities'] if e['kind']=='spell']
    if not args.skip_spell_lists:
        lists=extract_lists(spells);write_json(WORK/'spell-list-candidates.json',lists)
    comparison=compare(database);cov=coverage(database)
    write_json(WORK/'review-queue.json',[{'entityId':e['id'],'kind':e['kind'],'name':e['name'],'missingFields':e['verification']['missingFields'],
                                      'sources':e['sources'],'mechanicalStatus':e['verification']['mechanics']} for e in database['entities'] if not e['verification']['complete']])
    write_json(WORK/'comparison.json',comparison);write_json(WORK/'coverage.json',cov);report(WORK,database,cov,comparison)
    print('Reference:',len(database['entities']),'entities; compared fields:',comparison['comparedMechanicalFields'],'findings:',len(comparison['discrepancies']))
    print(WORK/'REPORT.md')


if __name__=='__main__':main()
