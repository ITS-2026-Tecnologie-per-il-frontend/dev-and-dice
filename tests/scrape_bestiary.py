"""Esegui con python3 tests/scrape_bestiary.py."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'scripts'))
script = root / 'scripts/scrape_bestiary.py'
spec = importlib.util.spec_from_file_location('scrape_bestiary', script)
scraper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scraper)

scores = ''.join(f'<tr><td>{name}</td><td>10</td><td>+0</td></tr>' for name in scraper.SCORES)
entry = {
    'id': 1, 'name': 'Mostro &amp; test', 'slug': 'test',
    'permalink': scraper.SOURCE + 'mostri/test/',
    'description': f'''<h3>Sfida</h3><p>1/4 (50 PE)</p><h3>Taglia</h3><p>Media</p>
<h2>Tipo</h2><p>Umanoide</p><h2>Allineamento</h2><p>Neutrale</p><table>{scores}</table>
<h3>Classe Armatura</h3><p>12 (cuoio)</p><h3>Punti Ferita</h3><p>18 (4d8)</p><h3>Velocità</h3><p>9 m</p>
<h3>Tratto</h3><p>Questo testo narrativo deve essere conservato nel JSON.</p>
<h2>Azioni</h2><h3>Morso</h3><p>+4 a colpire, CD 12, danni 2d6 + 2.</p>
<h2>Reazioni</h2><h3>Parata</h3><p>Un'altra descrizione.</p>''',
}
creature, abilities = scraper.parse_creature(entry)
assert creature['name'] == 'Mostro & test'
assert creature['armorClass'] == 12 and creature['hitPoints'] == 18
assert creature['challengeRating'] == '1/4'
assert creature['abilityScores']['dexterity'] == {'score': 10, 'modifier': 0}
assert [ability['category'] for ability in abilities] == ['trait', 'action', 'reaction']
assert abilities[1]['facts'] == {'attackBonuses': [4], 'saveDCs': [12], 'diceRolls': ['2d6 + 2']}
assert all(ability['durationRounds'] is None for ability in abilities)
assert 'testo narrativo' in abilities[0]['description']
assert 'Caratteristica' not in abilities[0]['description']
assert 'forza | 10 | +0' in creature['description']
assert scraper.ability_facts('−2 al colpire')['attackBonuses'] == [-2]
variable = {**entry, 'description': entry['description'].replace('18 (4d8)', 'Metà dei punti ferita del suo evocatore')}
assert scraper.parse_creature(variable)[0]['hitPoints'] is None
npc = {**entry, 'permalink': scraper.SOURCE + 'personaggi-non-giocanti/test/'}
assert scraper.parse_creature(npc)[0]['isNpc'] is True

with TemporaryDirectory() as directory:
    source = Path(directory) / 'invalid.json'
    output = Path(directory) / 'catalog.json'
    source.write_text(json.dumps({'total': 2, 'entries': [entry]}))
    output.write_text('previous valid catalog')
    result = subprocess.run([sys.executable, str(script), '--input', str(source), '--output', str(output)], capture_output=True)
    assert result.returncode != 0
    assert output.read_text() == 'previous valid catalog'
    result = subprocess.run([sys.executable, str(root / 'scripts/build_database.py'), '--spell-input', str(source), '--output', str(output)], capture_output=True)
    assert result.returncode != 0
    assert output.read_text() == 'previous valid catalog'

catalog = json.loads((root / 'public/data/dungeonedraghi-bestiary.json').read_text())
assert len(catalog['creatures']) == 321
assert sum(creature['isNpc'] for creature in catalog['creatures']) == 21
aboleth = next(creature for creature in catalog['creatures'] if creature['name'] == 'Aboleth')
assert (aboleth['armorClass'], aboleth['hitPoints']) == (17, 135)
accolito = next(creature for creature in catalog['creatures'] if creature['name'] == 'Accolito')
assert (accolito['challengeRating'], accolito['hitPoints']) == ('1/4', 9)
lookup = {ability['id']: ability for ability in catalog['abilities']}
assert len(lookup) == len(catalog['abilities'])
for creature in catalog['creatures']:
    assert all(lookup[ability_id]['creatureId'] == creature['id'] for ability_id in creature['abilityIds'])
assert all(ability['description'].strip() for ability in catalog['abilities'])
assert 'OPEN GAME LICENSE Version 1.0a' in catalog['license']['text']
from build_database import parse_spell, italian_duration, build_database

spell = {
    'id': 100, 'name': 'Luce di prova', 'slug': 'luce',
    'permalink': 'https://dungeonedraghi.it/compendio/incantesimi/luce/',
    'description': '<h2>Nome Inglese</h2><p>Light</p><h2>Livello</h2><p>Trucchetto</p>'
        '<h2>Scuola di Magia</h2><p>Invocazione</p><h2>Rituale</h2><p>No</p>'
        '<h2>Tempo di Lancio</h2><p>1 azione</p><h2>Gittata</h2><p>Contatto</p>'
        '<h2>Componenti</h2><p>V, M</p><h2>Durata</h2><p>1 ora</p>'
        '<h2>Effetto</h2><p>Una descrizione completa.</p><h3>Opzione</h3><p>Un dettaglio da conservare.</p>',
}
parsed = parse_spell(spell)
assert parsed['level'] == 0
assert parsed['durationInfo']['rounds'] == 600
assert parsed['sections']['Effetto'] == 'Una descrizione completa.'
assert 'Un dettaglio da conservare.' in parsed['description']
assert italian_duration('Concentrazione, fino a 10 minuti')['rounds'] == 100
assert italian_duration('Istantanea')['rounds'] == 0
assert italian_duration('Fino a dissolvimento')['rounds'] is None
wikidot = json.loads((root / 'public/data/wikidot-spells.json').read_text())
database = build_database(catalog, {'total': 1, 'entries': [spell]}, wikidot)
assert database['spells'][0]['englishName'] == 'Light'
assert len(database['spellIndex']) == len(wikidot['spells']) - 1
assert not any(item['name'] == 'Light' for item in database['spellIndex']), 'The translated spell must be excluded from the English fallback index'
assert database['licenses'][0]['id'] == 'OGL-1.0a'
live = json.loads((root / 'public/data/database.json').read_text())
assert len(live['creatures']) == 321 and len(live['spells']) == 319
assert all(item['description'].strip() for table in ['creatures', 'abilities', 'spells'] for item in live[table])
assert all('description' not in item for item in live['spellIndex'])
assert all(spell['sourceUrl'].startswith('https://dungeonedraghi.it/compendio/incantesimi/') for spell in live['spells'])
print('Bestiary and database checks passed: full descriptions and source licenses')
