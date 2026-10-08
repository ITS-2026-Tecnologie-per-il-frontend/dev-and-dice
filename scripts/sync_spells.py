#!/usr/bin/env python3
"""Confronta Wikidot inglese con gli incantesimi italiani, senza traduzioni automatiche."""
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import unicodedata
from json_utils import write_json

DATA = Path(__file__).resolve().parents[1] / 'public/data'
# Varianti SRD e refusi verificati: nessun confronto approssimativo tra nomi.
ALIASES = {
    'Antypathy/Sympathy': 'Antipathy/Sympathy',
    'Arcanist’s Magic Aura': "Nystul's Magic Aura",
    'Tiny Hut': "Leomund's Tiny Hut",
    'Teleporation Circle': 'Teleportation Circle',
    'Irresistible Dance': "Otto's Irresistible Dance",
    'Floating Disk': "Tenser's Floating Disk",
    'Instant Summons': "Drawmij's Instant Summons",
    'Acid Arrow': "Melf's Acid Arrow",
    'Guardian Spirits': 'Spirit Guardians',
    'Telepathic Bond': "Rary's Telepathic Bond",
    'Levitation': 'Levitate',
    'Arcane Hand': "Bigby's Hand",
    'Mirage Arcana': 'Mirage Arcane',
    'Purify Food and Water': 'Purify Food and Drink',
    'Magnificient Mansion': "Mordenkainen's Magnificent Mansion",
    'Magnificent Mansion': "Mordenkainen's Magnificent Mansion",
    'Hideous Laughter': "Tasha's Hideous Laughter",
    'Private Sanctum': "Mordenkainen's Private Sanctum",
    'Secret Chest': "Leomund's Secret Chest",
    'Faithful Hound': "Mordenkainen's Faithful Hound",
    'Freezing Sphere': "Otiluke's Freezing Sphere",
    'Resilient Sphere': "Otiluke's Resilient Sphere",
    'Arcane Sword': "Mordenkainen's Sword",
    'Black Tentacles': "Evard's Black Tentacles",
    'True Sight': 'True Seeing',
}


def normalized(name):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', name.casefold()))


ALIASES = {normalized(name): normalized(target) for name, target in ALIASES.items()}


def spell_key(name):
    key = normalized(name)
    return ALIASES.get(key, key)


def index_spells(spells, name_field):
    result = {}
    for spell in spells:
        if not isinstance(spell.get(name_field), str) or not spell[name_field].strip():
            raise ValueError(f'Nome incantesimo mancante: {spell.get("id")}')
        key = spell_key(spell[name_field])
        if key in result:
            raise ValueError(f'Confronto ambiguo: {spell[name_field]}')
        result[key] = spell
    return result


def sync_spells(database, wikidot, options):
    if wikidot.get('scope') != 'spell-index-metadata' or not wikidot.get('spells'):
        raise ValueError('Indice Wikidot assente o inatteso')
    italian = [spell for spell in database['spells'] if spell.get('language') == 'it']
    if not italian:
        raise ValueError('Catalogo italiano assente')
    translations = index_spells(italian, 'englishName')
    english_index = index_spells(wikidot['spells'], 'name')
    if len({spell['id'] for spell in wikidot['spells']}) != len(english_index):
        raise ValueError('Identificativi Wikidot duplicati')
    srd = index_spells(options['spells'], 'name')
    english, matched, missing, discrepancies = [], [], [], []
    for original in wikidot['spells']:
        spell = {**original, 'language': 'en'}
        key = spell_key(spell['name'])
        translated = translations.get(key)
        if translated and translated['level'] != spell['level']:
            discrepancies.append({'englishId': spell['id'], 'italianId': translated['id'], 'englishLevel': spell['level'], 'italianLevel': translated['level']})
        spell['translationStatus'] = 'available' if translated else 'missing'
        if translated:
            spell['italianId'] = translated['id']
            matched.append({'englishId': spell['id'], 'englishName': spell['name'], 'italianId': translated['id'], 'italianName': translated['name']})
        else:
            missing.append({'englishId': spell['id'], 'englishName': spell['name'], 'level': spell['level'], 'playtest': spell['playtest'], 'sourceUrl': spell['sourceUrl']})
        reference = srd.get(key)
        if reference and reference['level'] == spell['level']:
            spell['description'] = '\n\n'.join(reference['desc'])
            spell['sections'] = {'Effect': spell['description']}
            if reference.get('higher_level'):
                spell['sections']['At Higher Levels'] = '\n\n'.join(reference['higher_level'])
            spell['srdData'] = reference
            spell['descriptionSourceUrl'] = reference['sourceUrl']
            spell['licenseIds'] = options['licenseIds']
            spell['descriptionStatus'] = 'open-license-srd'
        else:
            spell['descriptionStatus'] = 'source-link-only'
        english.append(spell)
    comparison = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'englishCount': len(english), 'italianCount': len(italian),
        'matchedCount': len(matched), 'missingItalianCount': len(missing),
        'matching': 'Exact normalized English name with reviewed SRD aliases; UA variants kept separate.',
        'matched': matched, 'missingItalian': missing, 'levelDiscrepancies': discrepancies,
        'italianWithoutEnglishMatch': [{'italianId': spell['id'], 'italianName': spell['name'], 'englishName': spell['englishName']}
                                      for spell in italian if spell_key(spell['englishName']) not in english_index],
    }
    sources = [source for source in database.get('sources', []) if source['url'] != options['source']]
    sources.append({'url': options['source'], 'content': 'English SRD spell descriptions and structured data', 'licenseIds': options['licenseIds']})
    return {**database, 'sources': sources, 'generatedAt': comparison['generatedAt'], 'englishSpells': english,
            'spellIndex': [spell for spell in english if spell['translationStatus'] == 'missing'],
            'spellComparison': comparison}


def main():
    try:
        database = json.loads((DATA / 'database.json').read_text(encoding='utf-8'))
        wikidot = json.loads((DATA / 'wikidot-spells.json').read_text(encoding='utf-8'))
        options = json.loads((DATA / 'character-options.json').read_text(encoding='utf-8'))
        result = sync_spells(database, wikidot, options)
        write_json(DATA / 'database.json', result)
        report = result['spellComparison']
        print(f"English: {report['englishCount']}; Italian: {report['italianCount']}; matched: {report['matchedCount']}; missing Italian: {report['missingItalianCount']}")
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(f'Sincronizzazione fallita; database precedente conservato: {error}')


if __name__ == '__main__':
    main()
