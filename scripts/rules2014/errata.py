"""Official editorial corrections as a separate view; originals stay intact."""
from __future__ import annotations

import argparse
import copy
from pathlib import Path
import re
from urllib.request import Request, urlopen

from pdf_sources import WORK, sha256, write_json

SOURCES = {
    'phb-errata': ('PH-Errata.pdf', 'https://media.wizards.com/2021/dnd/downloads/PH-Errata.pdf',
                   '0c49e2c9c90c9dede38346874c8fda9ff39ce8a715d71aedc5bd1d1e4321014e', '3.0', 5),
    'dmg-errata': ('DMG-Errata.pdf', 'https://media.wizards.com/2021/dnd/downloads/DMG-Errata.pdf',
                   '257679dba5ab5f1d6656b9bc508ad82a5a053ea49d57dbeee6e88a5fe01d6afb', '3.0', 2),
    'mm-errata': ('MM-Errata.pdf', 'https://media.wizards.com/2018/dnd/downloads/MM-Errata.pdf',
                  '94b0049fb762872fba6510f1d6c234de946d962a5ce3f1c15e18e050266410fb', '2.0', 2),
}


def load_errata(download=False):
    from pypdf import PdfReader
    manifest, inventory = {}, []
    folder = WORK / 'errata'
    folder.mkdir(parents=True, exist_ok=True)
    for book, (filename, url, expected, version, count) in SOURCES.items():
        path = folder / filename
        if not path.is_file() and download:
            with urlopen(Request(url, headers={'User-Agent': 'DevAndDice-rules-verification'}), timeout=30) as response:
                raw = response.read()
            if not raw.startswith(b'%PDF'):
                raise ValueError('Not a PDF: ' + url)
            path.write_bytes(raw)
        if not path.is_file() or sha256(path) != expected:
            raise ValueError('Missing or changed official errata: ' + filename + '; run errata.py --download or review the changed copy')
        reader = PdfReader(path)
        pages = [p.extract_text() or '' for p in reader.pages]
        if len(pages) != count or 'Version ' + version not in pages[0]:
            raise ValueError('Unexpected errata version/pages: ' + filename)
        manifest[book] = {'filename': filename, 'url': url, 'sha256': expected, 'pageCount': count,
                         'status': 'text-extracted', 'review': {'edition': '2014', 'version': version,
                         'role': 'official-editorial-corrections', 'status': 'verified-official-copy',
                         'evidence': [{'pdfPage': 1, 'section': 'Version and document introduction'}],
                         'notesIt': 'Errata della quinta edizione originale; non sono regole 2024. Le singole correzioni hanno stati di revisione separati.'}}
        for page, text in enumerate(pages, 1):
            # Heading inventory only. No copyrighted paragraphs enter artifacts.
            for match in re.finditer(r'(?:\[New\]\s*)?([^\n]+?)\s*\(p(?:g)?\.?\s*(\d+)\)', text):
                inventory.append({'book': book, 'section': match[1].strip(), 'pdfPage': page,
                                  'originalPrintedPage': int(match[2]), 'status': 'heading-candidate-not-encoded'})
    return manifest, inventory


def editorial_source(page, section):
    return {'edition': '2014', 'book': 'phb-errata', 'filename': 'PH-Errata.pdf',
            'pdfPages': [page], 'printedPages': None, 'section': section,
            'url': SOURCES['phb-errata'][1], 'verification': 'read-local-text'}


def corrected_reference(original, manifest):
    result = copy.deepcopy(original)
    result['sources'].update(manifest)
    result['rulesVersion'] = '2014-with-reviewed-2021-errata'
    result['status'] = 'partial-corrected-reference-not-runtime-database'
    by_id = {e['id']: e for e in result['entities']}
    changes = []

    def apply(entity_id, field, value, page, section, *, remove=False):
        e = by_id[entity_id]
        parts = field.split('.')
        parent = e['mechanics']
        for key in parts[:-1]:
            parent = parent[int(key)] if isinstance(parent, list) else parent[key]
        key = int(parts[-1]) if isinstance(parent, list) else parts[-1]
        old = copy.deepcopy(parent.get(key)) if isinstance(parent, dict) else copy.deepcopy(parent[key])
        existed = key in parent if isinstance(parent, dict) else True
        if remove:
            parent.pop(key)
        else:
            parent[key] = copy.deepcopy(value)
        src = editorial_source(page, section)
        e['sources'].append(src)
        top = parts[0]
        if top in e['mechanics']:
            e['fieldSources'].setdefault(top, []).append(len(e['sources']) - 1)
        else:
            e['fieldSources'].pop(top, None)
        change = {'entityId': entity_id, 'field': field, 'operation': 'remove' if remove else 'replace' if existed else 'add',
                  'originalValue': old, 'correctedValue': None if remove else value, 'sources': [src],
                  'verification': 'verified-official-erratum'}
        changes.append(change)
        e.setdefault('editorialCorrections', []).append(change)
        if field in e.get('extraction',{}).get('fieldStatus',{}):
            e['extraction']['fieldStatus'][field]='verified-official-erratum'

    apply('phb2014:feat:grappler', 'printingOnlyClause', None, 3, 'Grappler', remove=True)
    apply('phb2014:rule:long-rest', 'hitDiceRecovery.minimum', 1, 4, 'Long Rest')
    apply('phb2014:rule:long-rest', 'minimumSleepHours', 6, 4, 'Long Rest')
    apply('phb2014:rule:short-rest', 'minimumHealingPerDie', 0, 4, 'Short Rest')
    apply('phb2014:weapon-property:ammunition', 'freeHandToLoadOneHandedWeapon', True, 3, 'Ammunition')
    apply('phb2014:weapon-property:heavy', 'attackDisadvantageSizes', ['Small', 'Tiny'], 3, 'Heavy')
    apply('phb2014:weapon-property:reach', 'opportunityReach', 'normal-reach-plus-5-ft-with-this-weapon', 3, 'Reach')
    apply('phb2014:weapon-property:two-handed', 'handsRequiredWhen', 'attacking', 3, 'Two-Handed')
    apply('phb2014:condition:exhaustion', 'raisedFromDeadReductionLevels', 1, 5, 'Exhaustion')
    for i in [1, 2]:
        apply('phb2014:race:tiefling', f'traits.1.mechanics.grants.{i}.recovery', 'long-rest', 1, 'Infernal Legacy')
        apply('phb2014:subrace:dark-elf', f'spellGrants.grants.{i}.recovery', 'long-rest', 1, 'Drow Magic')
    apply('phb2014:race:tiefling', 'traits.1.mechanics.printingNote', None, 1, 'Infernal Legacy', remove=True)
    apply('phb2014:feat:polearm-master', 'bonusActionAttackWeapons', ['glaive', 'halberd', 'quarterstaff', 'spear'], 3, 'Polearm Master')
    apply('phb2014:feat:polearm-master', 'opportunityOnEnteringReachWeapons', ['glaive', 'halberd', 'pike', 'quarterstaff', 'spear'], 3, 'Polearm Master')
    apply('phb2014:feat:polearm-master', 'bonusAttackAbility', 'same-as-primary-attack', 3, 'Polearm Master')
    apply('phb2014:feat:martial-adept', 'superiorityDie', '1d6', 3, 'Martial Adept')
    apply('phb2014:feat:martial-adept', 'addedToExistingSuperiorityDice', True, 3, 'Martial Adept')
    apply('phb2014:spell:revivify', 'school', 'necromancy', 5, 'Revivify')
    apply('phb2014:spell:destructive-wave', 'classes', ['paladin'], 4, 'Paladin Spells')
    by_id['phb2014:spell:destructive-wave'].setdefault('relations',{})['classIds']=['phb2014:class:paladin']
    by_id['phb2014:spell:destructive-wave']['extraction']['fieldStatus']['classes']='verified-official-erratum'
    result['spellListEditorialResolutions']=[
        {'originalName':'Destructive Smite','correctedName':'Destructive Wave','operation':'rename',
         'class':'paladin','originalPdfPage':210,'sources':[editorial_source(4,'Paladin Spells')]},
        {'originalName':'Trap the Soul','operation':'remove','class':'wizard','originalPdfPage':212,
         'sources':[editorial_source(4,'Wizard Spells')]},
    ]
    # A verified correction to one field does not promote an OCR spell description.
    for index in ['mass-cure-wounds', 'mass-heal']:
        apply('phb2014:spell:' + index, 'school', 'evocation', 5, index.replace('-', ' ').title())
    for entity in result['entities']:
        if entity['id'] in ['phb2014:rule:long-rest', 'phb2014:weapon-property:reach']:
            entity['verification'].update(complete=True, missingFields=[])
        if entity['id'] == 'phb2014:rule:long-rest':
            entity['summaryIt'] = 'Otto ore di riposo, almeno sei di sonno salvo eccezioni specifiche; recuperi tutti i PF e meta dei dadi vita, con un minimo di uno.'
        if entity['id'] == 'phb2014:feat:grappler':
            entity['summaryIt'] = 'Vantaggio contro il bersaglio afferrato; un tentativo di immobilizzazione puo rendere trattenuti entrambi. Il terzo beneficio della prima stampa e rimosso dalle errata.'
        if entity['id'] == 'phb2014:weapon-property:reach':
            entity['summaryIt'] = 'La portata aumenta di cinque piedi per gli attacchi e per determinare gli attacchi di opportunita con questa arma.'
    # Concrete warlock records may be added after the original reference expands.
    extra = [
        ('phb2014:class-option:pact-of-the-chain', 'effect.familiarAttackUsesReaction', True, 2, 'Pact of the Chain'),
        ('phb2014:class-option:pact-of-the-tome', 'effect.cantripsCountAsWarlockSpells', True, 2, 'Pact of the Tome'),
        ('phb2014:class-feature:warlock-2-eldritch-invocations', 'effect.levelPrerequisiteUses', 'warlock-level', 2, 'Eldritch Invocations'),
        ('phb2014:class-option:book-of-ancient-secrets', 'effect.initialRitualListsMayDiffer', True, 2, 'Book of Ancient Secrets'),
    ]
    for entity_id, field, value, page, section in extra:
        if entity_id in by_id:
            apply(entity_id, field, value, page, section)
    if by_id['phb2014:spell:find-familiar']['verification']['mechanics']=='verified-fields':
        apply('phb2014:spell:find-familiar', 'effect.carriedItemsLeftBehindWhen', ['zero-hit-points','dismissed-to-pocket-dimension'], 4, 'Find Familiar')
    result['editorialChangeLog'] = changes
    return result


def application_queue(inventory, reference):
    """An encoded field does not mean the whole errata section was implemented."""
    changes=reference.get('editorialChangeLog',[])
    normalize=lambda name: re.sub(r'[^a-z0-9]','',name.lower())
    result=copy.deepcopy(inventory)
    for row in result:
        applied=[c for c in changes if any(s['book']==row['book'] and s['pdfPages']==[row['pdfPage']]
                                         and normalize(s['section'])==normalize(row['section']) for s in c['sources'])]
        row['encodedFields']=[{'entityId':c['entityId'],'field':c['field']} for c in applied]
        row['sectionComplete']=False
        if applied: row['status']='reviewed-fields-encoded; remainder-requires-review'
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    manifest, inventory = load_errata(args.download)
    write_json(WORK / 'errata-manifest.json', manifest)
    write_json(WORK / 'errata-review-queue.json', inventory)
    print('Verified official copies:', len(manifest), '; headings requiring individual application review:', len(inventory))


if __name__ == '__main__':
    main()
