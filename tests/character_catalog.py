"""Controlli offline dei cataloghi per la creazione del personaggio."""
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from export_character_data import build, export, italian_text

DATA = ROOT / 'public/data'
options = json.loads((DATA / 'character-options.json').read_text(encoding='utf-8'))
equipment = json.loads((DATA / 'character-equipment.json').read_text(encoding='utf-8'))
rules = json.loads((DATA / 'character-rules.json').read_text(encoding='utf-8'))
manifest = json.loads((DATA / 'character-catalog.json').read_text(encoding='utf-8'))
for filename, info in manifest['files'].items():
    body = (DATA / filename).read_bytes()
    assert len(body) == info['bytes'], filename
    assert hashlib.sha256(body).hexdigest() == info['sha256'], filename

records = [entry for document in [options, equipment, rules] for value in document.values()
           if isinstance(value, list) for entry in value if isinstance(entry, dict) and str(entry.get('id', '')).startswith('srd2014:')]
registry = {entry['id']: entry for entry in records}
assert len(registry) == len(records), 'Identifiers must be unique across files'

def check_references(value):
    if isinstance(value, list):
        for item in value: check_references(item)
    elif isinstance(value, dict):
        if str(value.get('url', '')).startswith('/api/2014/'):
            assert value['id'] in registry, value
            assert registry[value['id']]['url'] == value['url'], value
        for item in value.values(): check_references(item)

for document in [options, equipment, rules]: check_references(document)
assert not rules['referenceAudit']['unresolvedUrls']
assert len(options['classes']) == len(options['subclasses']) == 12
assert len(options['races']) == 9 and len(options['subraces']) == 4
assert all(entry['ruleset'] == 'dnd5e-2014' for entry in records)
for cls in options['classes']:
    progression = [registry[key] for key in cls['levelIds']]
    assert [row['level'] for row in progression] == list(range(1, 21))
    assert all(row['class']['id'] == cls['id'] for row in progression)
    assert cls['hitPoints']['hitDie'] == f'1d{cls["hit_die"]}'
fighter = next(entry for entry in options['classes'] if entry['index'] == 'fighter')
assert fighter['abilityScoreImprovementLevels'] == [4, 6, 8, 12, 14, 16, 19]
assert next(entry for entry in options['classes'] if entry['index'] == 'wizard')['castingAbility'] == 'intelligence'
dragonborn = next(entry for entry in options['races'] if entry['index'] == 'dragonborn')
assert dragonborn['fixedAbilityBonuses'] == {'strength': 2, 'charisma': 1}
assert 'Draconato' in dragonborn['aliases']
halfelf = next(entry for entry in options['races'] if entry['index'] == 'half-elf')
assert halfelf['fixedAbilityBonuses'] == {'charisma': 2}
choices = halfelf['abilityBonusChoices']
assert choices['choose'] == 2
assert {choice['ability_score']['index'] for choice in choices['from']['options']} == {'str', 'dex', 'con', 'int', 'wis'}
hill = next(entry for entry in options['subraces'] if entry['index'] == 'hill-dwarf')
assert hill['inheritParentRace'] and hill['fixedAbilityBonuses'] == {'wisdom': 1}

formulas = {row['id']: row for row in rules['formulas']}
def evaluate(value, variables):
    if isinstance(value, (int, float)): return value
    if 'var' in value: return variables[value['var']]
    args = [evaluate(item, variables) for item in value['args']]
    operation = value['op']
    if operation == 'add': return sum(args)
    if operation == 'subtract': return args[0] - args[1]
    if operation == 'multiply': return math.prod(args)
    if operation == 'divide': return args[0] / args[1]
    if operation == 'floor': return math.floor(args[0])
    if operation == 'min': return min(args)
    if operation == 'max': return max(args)
    raise AssertionError(operation)

def calculate(key, **variables): return evaluate(formulas[key]['expression'], variables)
assert calculate('abilityModifier', score=9) == -1, 'Negative modifiers must round down'
assert calculate('abilityModifier', score=20) == 5
assert calculate('skillBonus', abilityModifier=3, proficiencyBonus=3, proficiencyMultiplier=2, otherBonus=0) == 9
assert calculate('skillBonus', abilityModifier=-1, proficiencyBonus=3, proficiencyMultiplier=0.5, otherBonus=0) == 0
assert calculate('cappedArmorDexterity', dexterityModifier=-2, dexterityCap=2) == -2
assert calculate('barbarianUnarmoredAC', dexterityModifier=2, constitutionModifier=3, shieldBonus=2, otherBonus=0) == 17
assert calculate('monkUnarmoredAC', dexterityModifier=2, wisdomModifier=3, otherBonus=0) == 15
assert formulas['monkUnarmoredAC']['conditions']['usingShield'] is False
assert calculate('spellSaveDC', proficiencyBonus=3, castingAbilityModifier=4, otherBonus=0) == 15
assert calculate('higherLevelHitPointGain', chosenHitDieValue=2, constitutionModifier=-3) == 1
assert calculate('constitutionHitPointAdjustment', characterLevel=8, newConstitutionModifier=4, oldConstitutionModifier=3) == 8
assert {formulas[key]['stackingGroup'] for key in ['unarmoredAC', 'armorAC', 'barbarianUnarmoredAC', 'monkUnarmoredAC']} == {'base-armor-class'}
for effect in rules['effectRules']:
    assert effect['ownerId'] in registry
assert next(entry for entry in equipment['equipment'] if entry['index'] == 'shield')['armor_class']['base'] == 2
assert len(rules['skills']) == 18
assert len({row['id'] for row in rules['italianRules']}) == len(rules['italianRules'])
assert all('sourceUrls' in row and row['sourceUrls'] for row in rules['formulas'])
text = italian_text('<h2>Tratto</h2><p>Primo paragrafo.</p><table><tr><th>Livello</th><th>Bonus</th></tr><tr><td>1</td><td>+2</td></tr></table>')
assert text['tables'][0]['rows'] == [['Livello', 'Bonus'], ['1', '+2']]
assert 'Primo paragrafo.' in text['description']

snapshot = ROOT / 'character-source.local/srd-snapshot.json'
if snapshot.exists():
    raw = json.loads(snapshot.read_text(encoding='utf-8'))
    broken = deepcopy(raw)
    broken['collections']['Classes'].pop()
    with TemporaryDirectory() as directory:
        output = Path(directory)
        previous = output / 'character-options.json'
        previous.write_text('previous valid data', encoding='utf-8')
        try: export(broken, output)
        except ValueError: pass
        else: raise AssertionError('An incomplete export must fail')
        assert previous.read_text(encoding='utf-8') == 'previous valid data'
    broken = deepcopy(raw)
    broken['collections']['Levels'][0]['class']['url'] = '/api/2014/classes/nonexistent'
    try: build(broken)
    except ValueError: pass
    else: raise AssertionError('Dangling references must fail')
print('Character catalog checks passed: hashes, links, level progressions, racial choices, calculation edge cases and safe export')
