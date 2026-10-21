"""python tests/spell-damage.py — editorial coverage, damage semantics and edition boundaries."""
import copy
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from audit_spell_damage import BASE, CATALOG, NO_DAMAGE, OUTPUT, REFERENCE, REVIEW, VARIABLE, build, report, summary

reference = json.loads(REFERENCE.read_text(encoding='utf-8'))
catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
saved = json.loads(OUTPUT.read_text(encoding='utf-8'))
assert saved == build(reference, catalog), 'The saved database must be reproducible from its sources'
assert (ROOT / 'reports/spell-damage.md').read_text(encoding='utf-8') == report(saved)
assert not (set(BASE) & NO_DAMAGE or VARIABLE & NO_DAMAGE or VARIABLE & set(BASE))
spells = [entity for entity in reference['entities'] if entity['kind'] == 'spell']
assert len(spells) == 361
assert all(entity['index'] in set(BASE) | NO_DAMAGE | VARIABLE | set(REVIEW) for entity in spells), 'New PHB spells require an explicit review'
assert len(saved['records']) == 574 and len(saved['bindings']) == 893
assert all(key in saved['records'] for key in saved['bindings'].values())
assert all(saved['bindings'][spell['id']] in saved['records'] for spell in catalog['spells'] + catalog['englishSpells'])
records = saved['records']
def damage(index):
    return records['2014:phb2014:spell:' + index]['summary']

# Dice used for HP, healing, protection, buffs or duration must never become damage.
for index in ['cure-wounds', 'healing-word', 'false-life', 'aid', 'heroes-feast', 'sleep', 'color-spray', 'bless', 'resistance', 'protection-from-energy', 'mending', 'time-stop']:
    assert damage(index) == 'Nessuno', index
assert '1d4 + 1 forza per dardo' in damage('magic-missile') and '+1 dardo' in damage('magic-missile')
assert records['2014:phb2014:spell:magic-missile']['status'] == 'review'
assert '2d6 fuoco per raggio' in damage('scorching-ray') and '+1 raggio' in damage('scorching-ray')
assert '8d6 fuoco' in damage('fireball') and 'metà con successo' in damage('fireball') and 'oltre il 3°' in damage('fireball')
assert '5°: 2d10; 11°: 3d10; 17°: 4d10' in damage('fire-bolt')
assert '4 al 17°; ogni raggio resta 1d10' in damage('eldritch-blast')
assert '4d4 acido iniziali e 2d4' in damage('melf-s-acid-arrow') and 'senza danno successivo' in damage('melf-s-acid-arrow')
assert 'il danno continuato resta 1d12' in damage('witch-bolt')
assert 'il danno continuato resta 1d6' in damage('searing-smite')
assert 'non evita o dimezza' in damage('feeblemind'), 'The Intelligence save is not a damage save'
assert 'non riduce i danni' in damage('heat-metal'), 'Dropping the hot object is not a damage save'
assert 'inizio' not in damage('guardian-of-faith').lower(), 'The guardian does not hit merely at turn start'
assert 'Inizio turno' in damage('hunger-of-hadar') and 'Fine turno' in damage('hunger-of-hadar')
assert 'al primo ingresso in un turno' in damage('spirit-guardians')
assert 'senza TS' in damage('wall-of-fire') and 'metà con successo' in damage('wall-of-fire')
assert '+2d6 alla comparsa e +1d6 all’aria gelida' in damage('wall-of-ice'), 'Verified mechanics take precedence over the old Italian translation'
assert 'attacco' in damage('animate-dead') and 'Variabile' in damage('animate-dead')
assert '5 freddo' in damage('armor-of-agathys') and '20 radioso' in damage('guardian-of-faith'), 'Fixed damage need not contain dice'
assert '2 danni da forza per ogni piede' in damage('etherealness'), 'Conditional ejection damage must not become None or be converted to the wrong unit'

for key, row in records.items():
    assert row['status'] in {'known', 'none', 'review'} and row['summary'].strip()
    if row['status'] == 'none':
        assert row['summary'] == 'Nessuno'
    if row['status'] == 'review':
        assert 'Da verificare' in row['summary']
assert sum(key.startswith('unclassified:') for key in records) == 213
assert all(row['status'] == 'review' for key, row in records.items() if key.startswith('unclassified:'))

# Same-name 2024 spells and unrevised additions must not inherit a 2014 answer.
revised = copy.deepcopy(catalog)
revised['englishSpells'].append({'id': 'test-2024-fireball', 'name': 'Fireball', 'edition': '2024'})
revised_data = build(reference, revised)
assert revised_data['bindings']['test-2024-fireball'] == '2024:test-2024-fireball'
assert revised_data['records']['2024:test-2024-fireball']['status'] == 'review'
assert '8d6' not in revised_data['records']['2024:test-2024-fireball']['summary']
revised['englishSpells'][-1].update(edition='2014', ruleset='dnd5e-2024')
assert build(reference, revised)['bindings']['test-2024-fireball'] == '2024:test-2024-fireball', 'A revised ruleset marker must block 2014 inheritance even with stale metadata'
assert summary({'index': 'new-spell', 'mechanics': {'effect': {'healing': '9d12'}}})['status'] == 'review'
assert saved['bindings']['dungeonedraghi:spell:6914'] == saved['bindings']['fireball'], 'Translations share one reviewed record'
print('Spell damage checks passed: complete inventory, reproducible data, initial/ongoing/per-hit damage, slot/character scaling, no-damage cases, unresolved sources and edition isolation')
