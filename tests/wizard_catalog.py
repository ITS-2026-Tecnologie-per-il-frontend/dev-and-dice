"""Run: python tests/wizard_catalog.py (stdlib only; no network)."""
import html
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from scrape_wizard import parse_wizard

catalog = json.loads((Path(__file__).resolve().parents[1] / 'public/data/wizard-catalog.json').read_text())
rows = ['<tr><th>School</th><th>Source</th></tr>']
status = 'published'
for item in catalog['subclasses']:
    if item['status'] != status:
        status = item['status']
        rows.append(f"<tr><td>{'Archived Unearthed Arcana' if status == 'archived-ua' else 'Unearthed Arcana'}</td></tr>")
    source = html.escape('\n'.join(item['sources']))
    if item['referenceUrl']: source = f'<a href="{html.escape(item["referenceUrl"], quote=True)}">{source}</a>'
    rows.append(f'<tr><td><a href="{item["sourceUrl"]}">{html.escape(item["name"])}</a></td><td>{source}</td></tr>')
levels = ['<tr><th>Level</th></tr>']
for row in catalog['levels']:
    cells = [str(row['level']) + 'th', f"+{row['proficiencyBonus']}", row['features'], str(row['cantrips']), *[str(slot) if slot else '-' for slot in row['slots']]]
    levels.append('<tr>' + ''.join('<td>' + html.escape(cell) + '</td>' for cell in cells) + '</tr>')
page = '<table>' + ''.join(levels) + '</table><table>' + ''.join(rows) + '</table>'
assert parse_wizard(page, catalog) == catalog
assert len(catalog['subclasses']) == 26
assert sum(x['status'] == 'published' for x in catalog['subclasses']) == 13
assert sum(x['status'] == 'ua' for x in catalog['subclasses']) == 1
assert sum(x['status'] == 'archived-ua' for x in catalog['subclasses']) == 12
for broken in ['', page.replace('School', 'Missing'), page.replace('20th', 'Missing'), page.replace(catalog['subclasses'][0]['sourceUrl'], 'javascript:alert(1)')]:
    try: parse_wizard(broken)
    except ValueError: pass
    else: raise AssertionError('Invalid page accepted')
print('Wizard catalog checks passed: all 26 entries, categories, links, 20 levels, deterministic extraction and invalid-page rejection.')

features = [f for s in catalog['subclasses'] for f in s.get('features', [])]
assert len(features) == 129
assert len({f['index'] for f in features}) == 129
for subclass in catalog['subclasses']:
    if subclass['index'] == 'evocation': continue
    assert subclass['features']
    assert len((' '.join(f['name'] + ' ' + ' '.join(f['desc']) for f in subclass['features'])).split()) < 200
    for f in subclass['features']:
        assert f['subclass']['index'] == subclass['index']
        assert 2 <= f['level'] <= 14
        assert f['activation'] in ('active', 'passive')
        assert f['sourceUrl'] == subclass['sourceUrl']
assert next(f for f in features if f['name'] == 'Manifest Mind' and f['subclass']['index'] == 'wizard-order-of-scribes')['level'] == 6
assert next(f for f in features if f['name'] == 'Manifest Mind' and f['subclass']['index'] == 'wizard-order-of-scribes-ua')['level'] == 10
print('129 reviewed subclass features validated, with distinct published/UA progression.')
