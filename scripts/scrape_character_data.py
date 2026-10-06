#!/usr/bin/env python3
"""Scarica ed esporta opzioni e regole SRD 5.1 per le schede dei PG."""
import argparse
from datetime import datetime, timezone
import json
from html import unescape, escape
from html.parser import HTMLParser
from pathlib import Path
import sys
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://dungeonedraghi.it'
API = BASE + '/wp-json/wc/store/v1/'
USER_AGENT = 'DevAndDiceCharacterCatalog/1.0'
SRD_RAW = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/'
SRD_COLLECTIONS = ['Ability-Scores', 'Alignments', 'Backgrounds', 'Classes', 'Conditions', 'Damage-Types',
                   'Equipment-Categories', 'Equipment', 'Feats', 'Features', 'Languages', 'Levels',
                   'Magic-Items', 'Magic-Schools', 'Proficiencies', 'Races', 'Rule-Sections', 'Rules', 'Skills',
                   'Spells', 'Subclasses', 'Subraces', 'Traits', 'Weapon-Properties']


def fetch(url, timeout=45, retries=3):
    allowed = {urlparse(BASE).netloc, 'raw.githubusercontent.com', 'dnd5e.wikidot.com'}
    if urlparse(url).netloc not in allowed:
        raise ValueError('Dominio inatteso')
    for attempt in range(retries):
        try:
            with urlopen(Request(url, headers={'User-Agent': USER_AGENT}), timeout=timeout) as response:
                if urlparse(response.url).netloc not in allowed:
                    raise ValueError('Redirect esterno inatteso')
                body = response.read(15_000_001)
                if len(body) > 15_000_000:
                    raise ValueError('Risposta troppo grande')
                return body.decode(response.headers.get_content_charset() or 'utf-8'), dict(response.headers)
        except (TimeoutError, URLError, HTTPError) as error:
            if isinstance(error, HTTPError) and error.code not in (429, 500, 502, 503, 504):
                raise
            if attempt == retries - 1:
                raise
            print(f'Richiesta da riprovare ({attempt + 1}/{retries}): {url}', flush=True)
            time.sleep(2 * (attempt + 1))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def download(cache):
    robots = RobotFileParser()
    robots.parse(fetch(BASE + '/robots.txt')[0].splitlines())

    def get(url):
        if not robots.can_fetch(USER_AGENT, url):
            raise ValueError(f'Richiesta non consentita da robots.txt: {url}')
        body, headers = fetch(url)
        time.sleep(0.5)
        return json.loads(body), {key.lower(): value for key, value in headers.items()}

    snapshot = {'schemaVersion': 1, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'categories': {}, 'pages': []}
    for slug in ['classi', 'razze', 'background', 'talenti', 'armature', 'armi', 'equipaggiamento', 'oggetti-magici']:
        target = cache / f'{slug}.json'
        if target.exists():
            snapshot['categories'][slug] = json.loads(target.read_text(encoding='utf-8'))
            print(f'Cache: {slug}', flush=True)
            continue
        categories, _ = get(API + 'products/categories?' + urlencode({'per_page': 100, 'search': slug}))
        category = next((item for item in categories if item['slug'] == slug), None)
        if not category:
            print(f'Categoria non presente: {slug}', flush=True)
            continue
        entries, expected, page, pages = [], None, 1, 1
        while page <= pages:
            rows, headers = get(API + 'products?' + urlencode({'category': category['id'], 'per_page': 100, 'page': page, '_fields': 'id,name,slug,permalink,description,categories,attributes'}))
            total, pages = int(headers['x-wp-total']), int(headers['x-wp-totalpages'])
            if expected is not None and total != expected:
                raise ValueError('Il catalogo è cambiato durante il download')
            expected = total
            entries.extend(rows)
            print(f'{slug}: pagina {page}/{pages}, {len(entries)}/{total} voci', flush=True)
            page += 1
        raw = {'total': expected, 'entries': entries}
        if len(entries) != expected or len({entry['id'] for entry in entries}) != expected:
            raise ValueError(f'Categoria incompleta: {slug}')
        write_json(target, raw)
        snapshot['categories'][slug] = raw

    target = cache / 'pages.json'
    if target.exists():
        snapshot['pages'] = json.loads(target.read_text(encoding='utf-8'))
    else:
        entries, page, pages, expected = [], 1, 1, None
        while page <= pages:
            rows, headers = get(BASE + '/wp-json/wp/v2/pages?' + urlencode({'per_page': 100, 'page': page, '_fields': 'id,slug,link,title,content'}))
            total, pages = int(headers['x-wp-total']), int(headers['x-wp-totalpages'])
            if expected is not None and total != expected:
                raise ValueError('Le pagine sono cambiate durante il download')
            expected = total
            entries.extend(rows)
            print(f'Regole: pagina {page}/{pages}', flush=True)
            page += 1
        if len(entries) != expected or len({entry['id'] for entry in entries}) != expected:
            raise ValueError('Elenco pagine incompleto')
        snapshot['pages'] = [entry for entry in entries if '/regole/' in entry['link']]
        write_json(target, snapshot['pages'])
    write_json(cache / 'snapshot.json', snapshot)
    return snapshot


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links, self.current, self.parts = [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.current, self.parts = dict(attrs).get('href'), []

    def handle_data(self, data):
        if self.current is not None:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self.current is not None:
            name = ' '.join(''.join(self.parts).split())
            if name:
                self.links.append((self.current, name))
            self.current = None


class ArticleContent(HTMLParser):
    def __init__(self, product=False):
        super().__init__(convert_charrefs=True)
        self.product, self.root_tag, self.depth, self.parts, self.done = product, None, 0, [], False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if self.root_tag is None and not self.done:
            selected = values.get('id') == 'tab-description' if self.product else tag == 'article' or 'entry-content' in values.get('class', '').split()
            if selected:
                self.root_tag, self.depth = tag, 1
                return
        elif self.depth:
            if tag == self.root_tag:
                self.depth += 1
            self.parts.append(self.get_starttag_text())

    def handle_endtag(self, tag):
        if not self.depth:
            return
        if tag == self.root_tag:
            self.depth -= 1
        if self.depth:
            self.parts.append(f'</{tag}>')
        else:
            self.done = True

    def handle_data(self, data):
        if self.depth:
            self.parts.append(escape(data))


def download_italian_html(cache, indexes, refresh=False):
    target = cache / 'italian-html.json'
    # These URLs also appear in the characteristics index. Seed them directly
    # so an unavailable navigation page does not hide the underlying rules.
    seeds = [BASE + '/regole/caratteristiche/' + slug + '/' for slug in [
        'introduzione', 'punteggi-e-modificatori', 'vantaggio-e-svantaggio', 'bonus-di-competenza',
        'prove-di-caratteristica', 'ispirazione', 'uso-delle-caratteristiche']]
    result = None
    if target.exists() and not refresh:
        result = json.loads(target.read_text(encoding='utf-8'))
        completed = {entry['sourceUrl'] for entry in result['rules']} | {entry['url'] for entry in result['errors']}
        if all(url in completed for url in seeds):
            return result
    robots = RobotFileParser()
    robots.parse(fetch(BASE + '/robots.txt', timeout=15, retries=1)[0].splitlines())
    result = result or {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'entries': [], 'rules': [], 'errors': []}

    def get(url):
        if not robots.can_fetch(USER_AGENT, url):
            raise ValueError('robots.txt non consente la pagina')
        body = fetch(url, timeout=20, retries=2)[0]
        time.sleep(0.5)
        return body

    for entry in indexes['entries']:
        if entry['language'] != 'it':
            continue
        url = entry['sourceUrl']
        if any(existing['sourceUrl'] == url for existing in result['entries']):
            continue
        print(f'Pagina italiana: {entry["name"]}', flush=True)
        try:
            body = get(url)
            parser = ArticleContent(product=True)
            parser.feed(body)
            if not parser.done or not parser.parts:
                raise ValueError('Descrizione della scheda non individuata')
            result['entries'].append({**entry, 'descriptionHtml': ''.join(parser.parts)})
        except (OSError, ValueError) as error:
            result['errors'].append({'url': url, 'error': str(error)})

    queue = [BASE + '/regole/', *seeds]
    seen = {entry['sourceUrl'] for entry in result['rules']} | {entry['url'] for entry in result['errors']}
    while queue:
        url = queue.pop(0)
        if url in seen:
            continue
        if len(seen) >= 150:
            raise ValueError('Numero inatteso di pagine di regole; verificare il perimetro')
        seen.add(url)
        print(f'Regola italiana: {url}', flush=True)
        try:
            body = get(url)
            parser = ArticleContent()
            parser.feed(body)
            if not parser.done or not parser.parts:
                raise ValueError('Contenuto della regola non individuato')
            content = ''.join(parser.parts)
            title = re.search(r'<h1[^>]*>(.*?)</h1>', content, re.S)
            title = unescape(re.sub('<[^>]+>', '', title[1])).strip() if title else urlparse(url).path.rstrip('/').split('/')[-1]
            result['rules'].append({'name': title, 'sourceUrl': url, 'descriptionHtml': content})
            links = Links()
            links.feed(content)
            for href, _ in links.links:
                link = urljoin(url, href).split('#')[0].split('?')[0]
                if urlparse(link).netloc == urlparse(BASE).netloc and urlparse(link).path.startswith('/regole/') and link not in seen and link not in queue:
                    queue.append(link)
        except (OSError, ValueError) as error:
            result['errors'].append({'url': url, 'error': str(error)})
    write_json(target, result)
    return result


def download_secondary(cache, refresh=False):
    target = cache / 'wiki-indexes.json'
    if target.exists() and not refresh:
        return json.loads(target.read_text(encoding='utf-8'))
    result = {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'sources': [], 'entries': []}
    for origin, paths in [(BASE, ['/compendio/classi/', '/compendio/razze/']), ('https://dnd5e.wikidot.com', ['/'])]:
        source = {'url': origin, 'status': 'unavailable', 'scope': 'index-links-and-names-only'}
        try:
            print(f'Indice wiki: {origin}', flush=True)
            robots = RobotFileParser()
            robots.parse(fetch(origin + '/robots.txt', timeout=12, retries=1)[0].splitlines())
            for path in paths:
                url = origin + path
                if not robots.can_fetch(USER_AGENT, url):
                    raise ValueError('Indice non consentito da robots.txt')
                parser = Links()
                parser.feed(fetch(url, timeout=12, retries=1)[0])
                for href, name in parser.links:
                    link = urljoin(url, href).split('#')[0]
                    if urlparse(link).netloc != urlparse(origin).netloc:
                        continue
                    key = urlparse(link).path
                    category = None
                    if origin == BASE:
                        if key.startswith('/compendio/classi/') and key != '/compendio/classi/': category = 'class'
                        if key.startswith('/compendio/razze/') and key != '/compendio/razze/': category = 'race'
                    else:
                        if key.startswith('/lineage:') or key.startswith('/race:'): category = 'race'
                        elif key.startswith('/background:'): category = 'background'
                        elif key.startswith('/feat:'): category = 'feat'
                        elif key.startswith('/subclass:'): category = 'subclass'
                        elif key.strip('/') in ['artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard', 'blood-hunter']: category = 'class'
                    if category:
                        result['entries'].append({'name': name, 'kind': category, 'sourceUrl': link,
                            'language': 'it' if origin == BASE else 'en', 'ruleset': 'unverified-variant',
                            'scope': 'index-metadata', 'autoApply': False})
                time.sleep(0.5)
            source['status'] = 'downloaded'
        except (OSError, ValueError) as error:
            source['error'] = str(error)
            print(f'Indice non disponibile: {origin}: {error}', flush=True)
        result['sources'].append(source)
    result['entries'] = list({entry['sourceUrl']: entry for entry in result['entries']}.values())
    write_json(target, result)
    return result


def download_srd(cache, refresh=False):
    snapshot = {'schemaVersion': 1, 'source': '5e-bits/5e-database', 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'collections': {}}
    for collection in SRD_COLLECTIONS:
        target = cache / f'srd-{collection}.json'
        if target.exists() and not refresh:
            entries = json.loads(target.read_text(encoding='utf-8'))
        else:
            entries = json.loads(fetch(SRD_RAW + f'5e-SRD-{collection}.json')[0])
            if not isinstance(entries, list) or not entries:
                raise ValueError(f'Collezione SRD non valida: {collection}')
            write_json(target, entries)
            time.sleep(0.5)
        snapshot['collections'][collection] = entries
        print(f'SRD {collection}: {len(entries)} voci', flush=True)
    snapshot['repositoryLicense'] = fetch('https://raw.githubusercontent.com/5e-bits/5e-database/main/LICENSE.md')[0]
    snapshot['wikiIndexes'] = download_secondary(cache, refresh)
    snapshot['italianHtml'] = download_italian_html(cache, snapshot['wikiIndexes'], refresh)
    write_json(cache / 'srd-snapshot.json', snapshot)
    return snapshot


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--cache', type=Path, default=ROOT / 'character-source.local')
    cli.add_argument('--input', type=Path, help='Snapshot locale per esportare senza rete')
    cli.add_argument('--download-only', action='store_true')
    cli.add_argument('--source', choices=['italian', 'srd'], default='srd')
    cli.add_argument('--refresh', action='store_true', help='Riscarica i dati invece di riutilizzare le risposte nella cache')
    cli.add_argument('--output', type=Path, default=ROOT / 'public/data')
    args = cli.parse_args()
    try:
        raw = json.loads(args.input.read_text(encoding='utf-8')) if args.input else (download_srd(args.cache, args.refresh) if args.source == 'srd' else download(args.cache))
        if args.download_only:
            print('Snapshot pronto', flush=True)
        else:
            from export_character_data import export
            if 'collections' not in raw:
                raise ValueError('Per esportare usa --source srd o uno snapshot SRD con --input')
            export(raw, args.output)
    except (OSError, ValueError, KeyError, TypeError) as error:
        cli.exit(1, f'Esportazione fallita; cataloghi precedenti conservati: {error}\n')


if __name__ == '__main__':
    main()
