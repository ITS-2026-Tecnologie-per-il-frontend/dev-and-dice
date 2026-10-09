#!/usr/bin/env python3
"""Esporta elenco delle tradizioni arcane e progressione dalla pagina Wizard (2014)."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from json_utils import write_json
from scrape_wikidot import fetch_text, USER_AGENT

SOURCE = 'https://dnd5e.wikidot.com/wizard'


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.table, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == 'table': self.table = []
        if tag == 'tr' and self.table is not None: self.row = []
        if tag in ('td', 'th') and self.row is not None: self.cell = {'text': '', 'href': None}
        if tag == 'a' and self.cell is not None: self.cell['href'] = dict(attrs).get('href')

    def handle_data(self, text):
        if self.cell is not None: self.cell['text'] += text

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.cell['text'] = self.cell['text'].strip()
            self.row.append(self.cell)
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.table.append(self.row)
            self.row = None
        if tag == 'table' and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def parse_wizard(html, previous=None):
    parser = Tables()
    parser.feed(html)
    traditions = next((t for t in parser.tables if any(r and r[0]['text'] == 'School' for r in t)), None)
    progression = next((t for t in parser.tables if any(r and r[0]['text'] == 'Level' for r in t)), None)
    if not traditions or not progression: raise ValueError('Tabelle del mago non trovate.')
    subclasses, status = [], 'published'
    for row in traditions:
        if len(row) == 1:
            status = 'archived-ua' if row[0]['text'] == 'Archived Unearthed Arcana' else 'ua'
        elif len(row) == 2 and row[0]['href']:
            name, source = row
            url = urljoin(SOURCE, name['href'])
            if urlparse(url).scheme != 'https' or urlparse(url).netloc != 'dnd5e.wikidot.com': raise ValueError('Collegamento di sottoclasse non valido.')
            if source['href'] and urlparse(urljoin(SOURCE, source['href'])).scheme != 'https': raise ValueError('Collegamento della fonte non valido.')
            slug = name['href'].split(':')[-1]
            subclasses.append({'index': 'evocation' if slug == 'evocation' else 'wizard-' + slug,
                'name': name['text'], 'class': {'index': 'wizard', 'name': 'Wizard'},
                'minimumLevel': 2, 'editions': ['2014', '2024'] if slug == 'evocation' else ['2014'],
                'status': status, 'sources': source['text'].splitlines(),
                'sourceUrl': url, 'referenceUrl': urljoin(SOURCE, source['href']) if source['href'] else None,
                'automationStatus': 'implemented' if slug == 'evocation' else 'manual-subclass-features'})
    if previous:
        reviewed = {s['index']: s for s in previous.get('subclasses', [])}
        for subclass in subclasses:
            old = reviewed.get(subclass['index'], {})
            if old.get('sourceUrl') == subclass['sourceUrl'] and old.get('features'):
                subclass['features'] = old['features']
                subclass['automationStatus'] = old['automationStatus']
    levels = []
    for row in progression:
        if len(row) == 13 and row[0]['text'][:1].isdigit():
            number = int(''.join(c for c in row[0]['text'] if c.isdigit()))
            levels.append({'level': number, 'proficiencyBonus': int(row[1]['text']), 'features': row[2]['text'],
                'cantrips': int(row[3]['text']), 'slots': [int(c['text']) if c['text'].isdigit() else 0 for c in row[4:]]})
    if len(levels) != 20 or [r['level'] for r in levels] != list(range(1, 21)): raise ValueError('Progressione incompleta.')
    if len(subclasses) < 13 or len({s['index'] for s in subclasses}) != len(subclasses): raise ValueError('Elenco sottoclassi incompleto o duplicato.')
    return {'schemaVersion': 1, 'source': SOURCE, 'ruleset': 'dnd5e-2014', 'scope': 'class-progression-subclass-index-and-reviewed-feature-summaries' if any(s.get('features') for s in subclasses) else 'class-progression-and-subclass-index-metadata',
        'multiclassRequirements': {'intelligence': 13}, 'subclassFeatureLevels': [2, 6, 10, 14], 'levels': levels, 'subclasses': subclasses}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--input', type=Path)
    cli.add_argument('--output', type=Path, default=Path('public/data/wizard-catalog.json'))
    args = cli.parse_args()
    try:
        if args.input: html = args.input.read_text(encoding='utf-8')
        else:
            robots = RobotFileParser(urljoin(SOURCE, '/robots.txt'))
            robots.parse(fetch_text(robots.url).splitlines())
            if not robots.can_fetch(USER_AGENT, SOURCE): raise ValueError('robots.txt non consente la richiesta.')
            html = fetch_text(SOURCE)
        previous = json.loads(args.output.read_text(encoding='utf-8')) if args.output.exists() else None
        result = parse_wizard(html, previous)
        write_json(args.output, result)
        print(f"Esportate {len(result['subclasses'])} sottoclassi e {len(result['levels'])} livelli in {args.output}")
    except (OSError, ValueError) as error: cli.exit(1, f'Esportazione fallita: {error}\n')


if __name__ == '__main__': main()
