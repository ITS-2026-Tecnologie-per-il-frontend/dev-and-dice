"""Esegui con python3 tests/scrape_wikidot.py."""
import importlib.util
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

sys.dont_write_bytecode = True

script = Path(__file__).resolve().parents[1] / 'scripts/scrape_wikidot.py'
spec = importlib.util.spec_from_file_location('scrape_wikidot', script)
scraper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scraper)

assert scraper.duration_metadata('Concentration, up to 1 minute') == {
    'kind': 'maximum', 'rounds': 10, 'concentration': True,
}
assert scraper.duration_metadata('Concentration up to 1 round')['rounds'] == 1
assert scraper.duration_metadata('8 Hours')['rounds'] == 4800
assert scraper.duration_metadata('10 days')['rounds'] == 144000
assert scraper.duration_metadata('7 seconds')['rounds'] == 2
assert scraper.duration_metadata('Instantaneous')['rounds'] == 0
for duration in ['Instantaneous or 1 hour', 'Until dispelled', 'Special', 'Until dispelled or triggered']:
    assert scraper.duration_metadata(duration)['rounds'] is None

html = ''.join(f'''<div id="wiki-tab-0-{level}"><table class="wiki-content-table">
<tr><th>Spell Name</th><th>School</th></tr>
<tr><td><a href="/spell:test-{level}">Shield &amp; Light</a></td>
<td>Abjuration<sup>D</sup></td><td>1 Action<sup>R</sup></td>
<td>Self</td><td>Concentration, up to 1 minute</td><td>V, S</td></tr>
</table></div>''' for level in range(10))
spells = scraper.parse_spells(html)
assert len(spells) == 10
assert spells[0]['name'] == 'Shield & Light'
assert spells[0]['level'] == 0 and spells[-1]['level'] == 9
assert spells[0]['school'] == 'Abjuration'
assert spells[0]['ritual'] is True
assert spells[0]['castingTime'] == '1 Action'
assert spells[0]['components'] == ['V', 'S']
assert spells[0]['sourceUrl'] == 'https://dnd5e.wikidot.com/spell:test-0'

with TemporaryDirectory() as directory:
    source = Path(directory) / 'invalid.html'
    output = Path(directory) / 'catalog.json'
    source.write_text('<html>Pagina non disponibile</html>')
    output.write_text('previous valid catalog')
    result = subprocess.run([sys.executable, str(script), '--html', str(source), '--output', str(output)], capture_output=True)
    assert result.returncode != 0
    assert output.read_text() == 'previous valid catalog', 'A failed scrape must preserve the previous export'

print('Wikidot scraper checks passed')
