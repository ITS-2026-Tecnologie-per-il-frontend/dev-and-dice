#!/usr/bin/env python3
"""Esporta i metadati dell'indice incantesimi Wikidot senza dipendenze esterne."""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import math
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

from json_utils import write_json

SOURCE = 'https://dnd5e.wikidot.com/spells'
USER_AGENT = 'DevAndDiceCatalog/1.0'


def duration_metadata(duration):
    text = duration.strip().lower()
    concentration = 'concentration' in text
    text = re.sub(r'^concentration\s*,?\s*', '', text)
    maximum = text.startswith('up to ')
    text = re.sub(r'^up to\s+', '', text)
    if text == 'instantaneous':
        return {'kind': 'instantaneous', 'rounds': 0, 'concentration': concentration}
    match = re.fullmatch(r'(\d+)\s+(rounds?|seconds?|minutes?|hours?|days?)', text)
    if match:
        amount, unit = int(match[1]), match[2].rstrip('s')
        seconds = amount * {'round': 6, 'second': 1, 'minute': 60, 'hour': 3600, 'day': 86400}[unit]
        return {'kind': 'maximum' if maximum else 'fixed', 'rounds': math.ceil(seconds / 6), 'concentration': concentration}
    # Le durate alternative e condizionali richiedono una scelta del giocatore.
    return {'kind': 'conditional', 'rounds': None, 'concentration': concentration}


class SpellsParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.level = None
        self.table = False
        self.cells = []
        self.cell = None
        self.link = None
        self.sup = False
        self.ritual = False
        self.spells = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        tab = re.fullmatch(r'wiki-tab-0-([0-9])', attrs.get('id', ''))
        if tag == 'div' and tab:
            self.level = int(tab[1])
        if tag == 'table' and 'wiki-content-table' in attrs.get('class', '').split() and self.level is not None:
            self.table = True
        if not self.table:
            return
        if tag == 'tr':
            self.cells, self.link, self.ritual = [], None, False
        elif tag == 'td':
            self.cell = []
        elif tag == 'sup' and self.cell is not None:
            self.sup = True
        elif tag == 'a' and self.cell is not None and not self.cells:
            href = urljoin(SOURCE, attrs.get('href', ''))
            if urlparse(href).netloc == urlparse(SOURCE).netloc and unquote(urlparse(href).path).startswith('/spell:'):
                self.link = href
        elif tag == 'br' and self.cell is not None:
            self.cell.append(' ')

    def handle_data(self, data):
        if self.cell is not None:
            if self.sup:
                if len(self.cells) == 2 and data.strip() == 'R':
                    self.ritual = True
            else:
                self.cell.append(data)

    def handle_endtag(self, tag):
        if tag == 'sup':
            self.sup = False
        if tag == 'td' and self.cell is not None:
            self.cells.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        if tag == 'tr' and self.table and self.cells:
            if len(self.cells) != 6 or not self.link or not all(self.cells):
                raise ValueError(f'Riga incantesimo inattesa: {self.cells!r}')
            name, school, casting_time, spell_range, duration, components = self.cells
            self.spells.append({
                'id': unquote(urlparse(self.link).path).removeprefix('/spell:'),
                'name': name, 'level': self.level, 'school': school,
                'castingTime': casting_time, 'range': spell_range,
                'duration': duration, 'durationInfo': duration_metadata(duration),
                'components': [item.strip() for item in components.split(',')],
                'ritual': self.ritual, 'playtest': '(UA)' in name, 'sourceUrl': self.link,
            })
        if tag == 'table':
            self.table = False


def parse_spells(html):
    parser = SpellsParser()
    parser.feed(html)
    parser.close()
    spells = parser.spells
    if not spells or {spell['level'] for spell in spells} != set(range(10)):
        raise ValueError('Indice incompleto: attese tutte le fasce di livello da 0 a 9. JSON precedente conservato.')
    if len({spell['id'] for spell in spells}) != len(spells):
        raise ValueError('Identificativi duplicati: controllare la struttura del sito.')
    return spells


def fetch_text(url):
    request = Request(url, headers={'User-Agent': USER_AGENT})
    with urlopen(request, timeout=30) as response:
        if urlparse(response.url).netloc != urlparse(SOURCE).netloc:
            raise ValueError('Redirect verso un dominio inatteso.')
        body = response.read(2_000_001)
        if len(body) > 2_000_000:
            raise ValueError('Pagina troppo grande.')
        return body.decode(response.headers.get_content_charset() or 'utf-8')


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--html', type=Path, help='Leggi una copia HTML locale invece di accedere al sito')
    cli.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/data/wikidot-spells.json')
    args = cli.parse_args()
    try:
        if args.html:
            html = args.html.read_text(encoding='utf-8')
        else:
            robots_url = urljoin(SOURCE, '/robots.txt')
            robots = RobotFileParser(robots_url)
            robots.parse(fetch_text(robots_url).splitlines())
            if not robots.can_fetch(USER_AGENT, SOURCE):
                raise ValueError('robots.txt non consente questa richiesta.')
            html = fetch_text(SOURCE)
        spells = parse_spells(html)
        catalog = {
            'schemaVersion': 1, 'source': SOURCE,
            'exportedAt': datetime.now(timezone.utc).isoformat(),
            'scope': 'spell-index-metadata', 'roundSeconds': 6,
            'spells': spells,
        }
        write_json(args.output, catalog)
        print(f'Esportati {len(spells)} incantesimi in {args.output}')
    except (OSError, ValueError) as error:
        cli.exit(1, f'Esportazione fallita: {error}\n')


if __name__ == '__main__':
    main()
