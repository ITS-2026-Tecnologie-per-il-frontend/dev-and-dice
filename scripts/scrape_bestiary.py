#!/usr/bin/env python3
"""Esporta statistiche e metadati delle abilità del bestiario Dungeon e Draghi."""
import argparse
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
import unicodedata
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

from json_utils import write_json

SOURCE = 'https://dungeonedraghi.it/compendio/bestiario/'
API = 'https://dungeonedraghi.it/wp-json/wc/store/v1/'
USER_AGENT = 'DevAndDiceCatalog/1.0'
STATS = {
    'sfida': 'challenge', 'taglia': 'size', 'tipo': 'type', 'allineamento': 'alignment',
    'classe armatura': 'armorClass', 'punti ferita': 'hitPoints', 'velocita': 'speed',
    'tiri salvezza': 'savingThrows', 'abilita': 'skills', 'sensi': 'senses', 'linguaggi': 'languages',
    'resistenze al danno': 'damageResistances', 'resistenze ai danni': 'damageResistances',
    'immunita al danno': 'damageImmunities', 'immunita ai danni': 'damageImmunities',
    'immunita alle condizioni': 'conditionImmunities', 'vulnerabilita al danno': 'damageVulnerabilities',
    'vulnerabilita ai danni': 'damageVulnerabilities',
}
SCORES = {'forza': 'strength', 'destrezza': 'dexterity', 'costituzione': 'constitution',
          'intelligenza': 'intelligence', 'saggezza': 'wisdom', 'carisma': 'charisma'}
SECTIONS = {'azioni': 'action', 'azioni leggendarie': 'legendary', 'reazioni': 'reaction',
            'azioni bonus': 'bonus', 'azioni di tana': 'lair'}


def normalized(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text.casefold()) if not unicodedata.combining(c)).strip()


class StatBlocks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.tag = None
        self.parts = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []
        elif self.row is None and (re.fullmatch(r'h[1-6]', tag) or tag in ('p', 'li')) and self.tag is None:
            self.tag, self.parts = tag, []
        elif tag == 'br':
            if self.cell is not None:
                self.cell.append(' ')
            elif self.tag:
                self.parts.append(' ')

    def handle_data(self, text):
        if self.cell is not None:
            self.cell.append(text)
        elif self.tag:
            self.parts.append(text)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.blocks.append(('row', self.row))
            self.row = None
        elif tag == self.tag:
            text = ' '.join(''.join(self.parts).split())
            if text:
                self.blocks.append((tag, text))
            self.tag = None


def ability_facts(text):
    return {
        'attackBonuses': sorted({int(x.replace('−', '-')) for x in re.findall(r'([+−-]\d+)\s+(?:a|al)\s+colpire', text, re.I)}),
        'saveDCs': sorted({int(x) for x in re.findall(r'\bCD\s*(\d+)\b', text, re.I)}),
        'diceRolls': sorted(set(re.findall(r'\b\d+d\d+(?:\s*[+−-]\s*\d+)?\b', text, re.I))),
    }


def parse_creature(entry):
    url = entry['permalink']
    if not url.startswith(SOURCE) or not entry['name'].strip():
        raise ValueError(f'Voce estranea al bestiario: {url}')
    parser = StatBlocks()
    parser.feed(entry['description'])
    stats, scores, abilities, warnings = {}, {}, [], []
    current = None
    body = []
    section = 'trait'
    creature_id = str(entry['id'])

    def finish_heading():
        if not current:
            return
        tag, title = current
        key = STATS.get(normalized(title))
        text = ' '.join(body)
        if key:
            if key in stats and stats[key] != text:
                warnings.append(f'Campo duplicato con valori diversi: {title}')
            # Usa l'ultimo blocco: alcune schede antepongono note sulle varianti.
            stats[key] = text
        elif normalized(title) not in SECTIONS and body:
            abilities.append({
                'id': f'{creature_id}:ability:{len(abilities)}', 'creatureId': creature_id,
                'name': title, 'category': section, 'durationRounds': None,
                'description': '\n\n'.join(body),
                'facts': ability_facts(text), 'sourceUrl': url,
            })

    for tag, text in parser.blocks:
        if tag == 'row':
            if len(text) >= 2 and normalized(text[0]) in SCORES and re.fullmatch(r'\d+', text[1]):
                key = SCORES[normalized(text[0])]
                value = int(text[1])
                modifier = int(text[2].replace('−', '-')) if len(text) > 2 and re.fullmatch(r'[+−-]?\d+', text[2]) else None
                if key in scores and scores[key]['score'] != value:
                    warnings.append(f'Caratteristica duplicata: {text[0]}')
                scores[key] = {'score': value, 'modifier': modifier}
        elif tag.startswith('h'):
            finish_heading()
            current, body = (tag, text), []
            if normalized(text) in SECTIONS:
                section = SECTIONS[normalized(text)]
        elif current:
            body.append(text)
    finish_heading()

    if not all(stats.get(key) for key in ['size', 'type', 'alignment', 'armorClass', 'hitPoints', 'speed']) or set(scores) != set(SCORES.values()):
        raise ValueError(f'Scheda incompleta: {entry["name"]} ({url})')
    if not stats.get('challenge'):
        warnings.append('Grado di sfida non riportato nella fonte')
    category = url.removeprefix(SOURCE).split('/')[0]
    numeric = {}
    for key in ['armorClass', 'hitPoints']:
        match = re.match(r'^\d+\b', stats[key])
        numeric[key] = int(match[0]) if match else None
    challenge = re.match(r'^(\d+(?:/\d+)?)\b', stats.get('challenge', ''))
    monster = {
        'id': creature_id, 'slug': entry['slug'], 'name': unescape(entry['name']),
        'category': category, 'isNpc': category == 'personaggi-non-giocanti', 'sourceUrl': url,
        'description': '\n\n'.join(' | '.join(value) if tag == 'row' else value for tag, value in parser.blocks),
        'stats': stats, 'abilityScores': scores, 'armorClass': numeric['armorClass'], 'hitPoints': numeric['hitPoints'],
        'challengeRating': challenge[1] if challenge else None,
        'abilityIds': [ability['id'] for ability in abilities], 'warnings': warnings,
    }
    return monster, abilities


def fetch(url):
    if urlparse(url).netloc != urlparse(SOURCE).netloc:
        raise ValueError('Dominio della richiesta inatteso')
    with urlopen(Request(url, headers={'User-Agent': USER_AGENT}), timeout=30) as response:
        if urlparse(response.url).netloc != urlparse(SOURCE).netloc:
            raise ValueError('Dominio del redirect inatteso')
        body = response.read(10_000_001)
        if len(body) > 10_000_000:
            raise ValueError('Risposta troppo grande')
        return body.decode(response.headers.get_content_charset() or 'utf-8'), response.headers


def download(category_slug='bestiario'):
    robots = RobotFileParser()
    robots.parse(fetch('https://dungeonedraghi.it/robots.txt')[0].splitlines())
    categories_url = API + 'products/categories?' + urlencode({'per_page': 100, 'search': category_slug})
    if not robots.can_fetch(USER_AGENT, categories_url):
        raise ValueError('robots.txt non consente la richiesta')
    categories = json.loads(fetch(categories_url)[0])
    category = next(item for item in categories if item['slug'] == category_slug)
    entries, expected, pages = [], None, 1
    page = 1
    while page <= pages:
        url = API + 'products?' + urlencode({
            'category': category['id'], 'per_page': 100, 'page': page,
            '_fields': 'id,name,slug,permalink,description',
        })
        if not robots.can_fetch(USER_AGENT, url):
            raise ValueError('robots.txt non consente la richiesta')
        body, headers = fetch(url)
        total = int(headers['X-WP-Total'])
        pages = int(headers['X-WP-TotalPages'])
        if expected is not None and expected != total:
            raise ValueError('Il catalogo è cambiato durante il download; riprovare')
        expected = total
        entries.extend(json.loads(body))
        print(f'Scaricata pagina {page}/{pages}', flush=True)
        page += 1
        if page <= pages:
            time.sleep(0.5)
    return {'total': expected, 'entries': entries}


def export_catalog(raw):
    entries = raw['entries']
    if not entries or len(entries) != raw['total'] or len({entry['id'] for entry in entries}) != len(entries) or len({entry['permalink'] for entry in entries}) != len(entries):
        raise ValueError('Catalogo incompleto o con duplicati')
    creatures, abilities = [], []
    for entry in entries:
        creature, skills = parse_creature(entry)
        creatures.append(creature)
        abilities.extend(skills)
    creatures.sort(key=lambda creature: creature['name'].casefold())
    return {
        'schemaVersion': 2, 'source': SOURCE, 'retrievalApi': API,
        'exportedAt': datetime.now(timezone.utc).isoformat(),
        'scope': 'creature-statistics-and-full-descriptions',
        'license': {
            'id': 'OGL-1.0a', 'sourceUrl': 'https://dungeonedraghi.it/licenza-ogl/',
            'appliesTo': 'Open Game Content in creature stat blocks and ability descriptions; images and Product Identity excluded',
            'text': (Path(__file__).resolve().parents[1] / 'public/data/ogl-1.0a.txt').read_text(encoding='utf-8'),
        },
        'creatures': creatures, 'abilities': abilities,
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--input', type=Path, help='Copia locale della risposta JSON {total, entries}')
    cli.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/data/dungeonedraghi-bestiary.json')
    args = cli.parse_args()
    try:
        raw = json.loads(args.input.read_text(encoding='utf-8')) if args.input else download()
        catalog = export_catalog(raw)
        write_json(args.output, catalog)
        print(f'Esportate {len(catalog["creatures"])} creature e {len(catalog["abilities"])} abilità in {args.output}')
    except (OSError, ValueError, KeyError, TypeError, StopIteration) as error:
        cli.exit(1, f'Esportazione fallita; catalogo precedente conservato: {error}\n')


if __name__ == '__main__':
    main()
