#!/usr/bin/env python3
"""Crea il database JSON locale con schede, abilità e incantesimi SRD descritti."""
import argparse
from datetime import datetime, timezone
from html import unescape
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
from scrape_bestiary import StatBlocks, download, normalized
from scrape_wikidot import duration_metadata
from sync_spells import sync_spells

DATA = Path(__file__).resolve().parents[1] / 'public/data'
SPELL_SOURCE = 'https://dungeonedraghi.it/compendio/incantesimi/'
SPELL_FIELDS = ['Nome Inglese', 'Livello', 'Scuola di Magia', 'Rituale', 'Tempo di Lancio', 'Gittata', 'Componenti', 'Durata', 'Effetto']


def italian_duration(duration):
    text = duration.casefold()
    replacements = {'concentrazione': 'concentration', 'fino a': 'up to', 'istantanea': 'instantaneous',
                    'secondi': 'seconds', 'secondo': 'second', 'minuti': 'minutes', 'minuto': 'minute',
                    'ore': 'hours', 'ora': 'hour', 'giorni': 'days', 'giorno': 'day'}
    for original, replacement in replacements.items():
        text = re.sub(r'\b' + original + r'\b', replacement, text)
    return duration_metadata(text)


def parse_spell(entry):
    if not entry['permalink'].startswith(SPELL_SOURCE):
        raise ValueError('Incantesimo proveniente da una sezione inattesa')
    parser = StatBlocks()
    parser.feed(entry['description'])
    sections, heading = {}, None
    for tag, value in parser.blocks:
        if tag.startswith('h'):
            heading = value
            sections.setdefault(heading, [])
        elif heading:
            sections[heading].append(' | '.join(value) if tag == 'row' else value)
    fields = {key: '\n\n'.join(value) for key, value in sections.items()}
    if not all(fields.get(key) for key in SPELL_FIELDS):
        raise ValueError(f'Incantesimo incompleto: {entry["name"]}')
    level = re.match(r'^\d+', fields['Livello'])
    level = int(level[0]) if level else 0 if normalized(fields['Livello']).startswith('trucchetto') else None
    if level is None or not 0 <= level <= 9:
        raise ValueError(f'Livello non riconosciuto: {entry["name"]}')
    return {
        'id': f'dungeonedraghi:spell:{entry["id"]}', 'name': unescape(entry['name']),
        'englishName': fields['Nome Inglese'], 'level': level, 'school': fields['Scuola di Magia'],
        'ritual': normalized(fields['Rituale']) in ['si', 'sì'], 'castingTime': fields['Tempo di Lancio'],
        'range': fields['Gittata'], 'components': fields['Componenti'],
        'duration': fields['Durata'], 'durationInfo': italian_duration(fields['Durata']),
        'description': '\n\n'.join(' | '.join(value) if tag == 'row' else value for tag, value in parser.blocks),
        'sections': fields, 'sourceUrl': entry['permalink'], 'language': 'it', 'licenseId': 'OGL-1.0a',
    }


def build_database(bestiary, raw_spells, wikidot):
    if bestiary.get('scope') != 'creature-statistics-and-full-descriptions' or not bestiary.get('license', {}).get('text'):
        raise ValueError('Rigenera prima il bestiario con descrizioni e licenza')
    entries = raw_spells['entries']
    if not entries or len(entries) != raw_spells['total'] or len({entry['id'] for entry in entries}) != len(entries):
        raise ValueError('Catalogo incantesimi incompleto o con duplicati')
    if wikidot.get('scope') != 'spell-index-metadata':
        raise ValueError('Indice Wikidot inatteso')
    spells = sorted((parse_spell(entry) for entry in entries), key=lambda spell: spell['name'].casefold())
    creatures, abilities = bestiary['creatures'], bestiary['abilities']
    lookup = {ability['id']: ability for ability in abilities}
    if len(lookup) != len(abilities) or any(
        ability_id not in lookup or lookup[ability_id]['creatureId'] != creature['id']
        for creature in creatures for ability_id in creature['abilityIds']
    ):
        raise ValueError('Collegamenti tra creature e abilità non validi')
    database = {
        'schemaVersion': 1, 'generatedAt': datetime.now(timezone.utc).isoformat(), 'roundSeconds': 6,
        'sources': [
            {'url': bestiary['source'], 'exportedAt': bestiary['exportedAt'], 'content': 'Creature e abilità con testi completi SRD'},
            {'url': SPELL_SOURCE, 'content': 'Incantesimi SRD italiani con testi completi'},
            {'url': wikidot['source'], 'exportedAt': wikidot['exportedAt'], 'content': 'Solo metadati, senza descrizioni complete'},
        ],
        'licenses': [{**bestiary['license'], 'appliesTo': 'Open Game Content in creatures, abilities and Italian SRD spells; images, Product Identity and the Wikidot index excluded'}],
        'creatures': creatures, 'abilities': abilities, 'spells': spells, 'spellIndex': wikidot['spells'],
    }
    options = json.loads((DATA / 'character-options.json').read_text(encoding='utf-8'))
    return sync_spells(database, wikidot, options)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--spell-input', type=Path, help='Risposta locale del catalogo italiano nel formato {total, entries}')
    cli.add_argument('--output', type=Path, default=DATA / 'database.json')
    args = cli.parse_args()
    try:
        bestiary = json.loads((DATA / 'dungeonedraghi-bestiary.json').read_text(encoding='utf-8'))
        wikidot = json.loads((DATA / 'wikidot-spells.json').read_text(encoding='utf-8'))
        raw = json.loads(args.spell_input.read_text(encoding='utf-8')) if args.spell_input else download('incantesimi')
        database = build_database(bestiary, raw, wikidot)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output.with_suffix(args.output.suffix + '.tmp')
        temporary.write_text(json.dumps(database, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temporary.replace(args.output)
        print(f'Database creato: {len(database["creatures"])} creature, {len(database["abilities"])} abilità, {len(database["spells"])} incantesimi descritti, {len(database["spellIndex"])} voci Wikidot')
    except (OSError, ValueError, KeyError, TypeError, StopIteration) as error:
        cli.exit(1, f'Creazione fallita; database precedente conservato: {error}\n')


if __name__ == '__main__':
    main()
