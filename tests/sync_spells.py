import copy
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from sync_spells import sync_spells, spell_key

root = Path(__file__).resolve().parents[1] / 'public/data'
load = lambda filename: json.loads((root / filename).read_text(encoding='utf-8'))
database, wikidot, options = load('database.json'), load('wikidot-spells.json'), load('character-options.json')
original = copy.deepcopy((database, wikidot, options))
result = sync_spells(database, wikidot, options)
assert (database, wikidot, options) == original, 'Inputs must not be mutated'
assert result['spells'] == database['spells'], 'Italian source data must be preserved'
report = result['spellComparison']
assert report['englishCount'] == report['matchedCount'] + report['missingItalianCount']
assert report['matchedCount'] == report['italianCount'] == 319
assert not report['italianWithoutEnglishMatch']
assert len(result['spellIndex']) == report['missingItalianCount'] == 255
assert all(s['language'] == 'en' and s['translationStatus'] == 'missing' for s in result['spellIndex'])
assert not any(s['name'] == 'Aid' for s in result['spellIndex'])
assert any(s['name'] == 'Booming Blade' for s in result['spellIndex'])
assert sum(s['descriptionStatus'] == 'open-license-srd' for s in result['englishSpells']) == 319
assert all(s.get('licenseIds') and s.get('descriptionSourceUrl') for s in result['englishSpells'] if s.get('description'))
assert spell_key('Arcanist’s Magic Aura') == spell_key("Nystul's Magic Aura")
assert spell_key('Teleporation Circle') == spell_key('Teleportation Circle')
assert spell_key('Fireball (UA)') != spell_key('Fireball'), 'Playtest versions must remain distinct'
assert report['levelDiscrepancies'][0]['englishLevel'] == 6
invalid = {**wikidot, 'spells': wikidot['spells'] + [wikidot['spells'][0]]}
try:
    sync_spells(database, invalid, options)
except ValueError:
    pass
else:
    raise AssertionError('Ambiguous duplicate names must fail before writing')
print('Spell sync checks passed: exact matches, aliases, English fallback, licensed descriptions and source preservation')
