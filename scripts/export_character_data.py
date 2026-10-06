"""Normalizzazione offline dei cataloghi SRD per una futura autocompilazione."""
from collections import Counter
from copy import deepcopy
import hashlib
import json
import re
from pathlib import Path

from scrape_bestiary import StatBlocks

ROOT = Path(__file__).resolve().parents[1]
API = 'https://www.dnd5eapi.co'
ABILITIES = {'str': 'strength', 'dex': 'dexterity', 'con': 'constitution', 'int': 'intelligence', 'wis': 'wisdom', 'cha': 'charisma'}
NAMES = {
    'Classes': {'barbarian': 'Barbaro', 'bard': 'Bardo', 'cleric': 'Chierico', 'druid': 'Druido', 'fighter': 'Guerriero', 'monk': 'Monaco', 'paladin': 'Paladino', 'ranger': 'Ranger', 'rogue': 'Ladro', 'sorcerer': 'Stregone', 'warlock': 'Warlock', 'wizard': 'Mago'},
    'Races': {'dragonborn': 'Dragonide', 'dwarf': 'Nano', 'elf': 'Elfo', 'gnome': 'Gnomo', 'half-elf': 'Mezzelfo', 'half-orc': 'Mezzorco', 'halfling': 'Halfling', 'human': 'Umano', 'tiefling': 'Tiefling'},
    'Subraces': {'hill-dwarf': 'Nano delle Colline', 'high-elf': 'Elfo Alto', 'lightfoot-halfling': 'Halfling Piedelesto', 'rock-gnome': 'Gnomo delle Rocce'},
    'Ability-Scores': {'str': 'Forza', 'dex': 'Destrezza', 'con': 'Costituzione', 'int': 'Intelligenza', 'wis': 'Saggezza', 'cha': 'Carisma'},
    'Skills': {'acrobatics': 'Acrobazia', 'animal-handling': 'Addestrare animali', 'arcana': 'Arcano', 'athletics': 'Atletica', 'deception': 'Inganno', 'history': 'Storia', 'insight': 'Intuizione', 'intimidation': 'Intimidire', 'investigation': 'Indagare', 'medicine': 'Medicina', 'nature': 'Natura', 'perception': 'Percezione', 'performance': 'Intrattenere', 'persuasion': 'Persuasione', 'religion': 'Religione', 'sleight-of-hand': 'Rapidità di mano', 'stealth': 'Furtività', 'survival': 'Sopravvivenza'},
    'Backgrounds': {'acolyte': 'Accolito'},
    'Feats': {'grappler': 'Lottatore'},
}
KEYS = {
    'Ability-Scores': 'abilityScores', 'Alignments': 'alignments', 'Backgrounds': 'backgrounds', 'Classes': 'classes',
    'Conditions': 'conditions', 'Damage-Types': 'damageTypes', 'Equipment-Categories': 'equipmentCategories',
    'Equipment': 'equipment', 'Feats': 'feats', 'Features': 'features', 'Languages': 'languages', 'Levels': 'levels',
    'Magic-Items': 'magicItems', 'Magic-Schools': 'magicSchools', 'Proficiencies': 'proficiencies', 'Races': 'races', 'Rule-Sections': 'ruleSections',
    'Rules': 'rules', 'Skills': 'skills', 'Spells': 'spells', 'Subclasses': 'subclasses', 'Subraces': 'subraces',
    'Traits': 'traits', 'Weapon-Properties': 'weaponProperties',
}


def identifier(collection, index):
    return f'srd2014:{KEYS[collection]}:{index}'


def italian_text(html):
    # Only the article/tab selected by the downloader reaches this parser.
    html = re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>', '', html, flags=re.S | re.I)
    parser = StatBlocks()
    parser.feed(html)
    sections, tables, current, rows = [], [], None, []
    for tag, value in parser.blocks:
        if tag == 'row':
            rows.append(value)
        else:
            if rows:
                tables.append({'heading': current['heading'] if current else None, 'rows': rows})
                rows = []
            if tag.startswith('h'):
                current = {'heading': value, 'headingLevel': int(tag[1]), 'paragraphs': []}
                sections.append(current)
            else:
                if current is None:
                    current = {'heading': None, 'headingLevel': None, 'paragraphs': []}
                    sections.append(current)
                current['paragraphs'].append(value)
    if rows:
        tables.append({'heading': current['heading'] if current else None, 'rows': rows})
    description = '\n\n'.join(' | '.join(value) if tag == 'row' else value for tag, value in parser.blocks)
    if not description.strip():
        raise ValueError('Testo italiano vuoto')
    return {'description': description, 'sections': sections, 'tables': tables}


def var(name):
    return {'var': name}


def op(name, *arguments):
    return {'op': name, 'args': list(arguments)}


def calculation_rules(collections):
    creation_source = 'https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters'
    rule_url = lambda index: API + '/api/2014/rule-sections/' + index
    feature_url = lambda index: API + '/api/2014/features/' + index
    formulas = []

    def formula(key, expression, sources, requires, **extra):
        formulas.append({'id': key, 'expression': expression, 'sourceUrls': sources,
            'requires': requires, 'ruleset': 'dnd5e-2014', 'derivation': 'structured-interpretation-of-cited-rules', **extra})

    formula('abilityModifier', op('floor', op('divide', op('subtract', var('score'), 10), 2)),
            [rule_url('ability-scores-and-modifiers')], ['score'], validRange={'minimum': 1, 'maximum': 30})
    formula('skillBonus', op('add', var('abilityModifier'), op('floor', op('multiply', var('proficiencyBonus'), var('proficiencyMultiplier'))), var('otherBonus')),
            [rule_url('ability-checks'), rule_url('proficiency-bonus')], ['abilityModifier', 'proficiencyBonus', 'proficiencyMultiplier', 'otherBonus'],
            proficiencyMultipliers={'none': 0, 'half': 0.5, 'proficient': 1, 'expertise': 2},
            notes=['Half proficiency requires an explicit feature and cannot be assumed for untrained skills.', 'Expertise replaces the multiplier; multiple sources never add proficiency twice.'])
    formula('savingThrowBonus', op('add', var('abilityModifier'), op('multiply', var('proficiencyBonus'), var('isProficient')), var('otherBonus')),
            [rule_url('saving-throws'), rule_url('proficiency-bonus')], ['abilityModifier', 'proficiencyBonus', 'isProficient', 'otherBonus'])
    formula('initiative', op('add', var('dexterityModifier'), var('checkBonus')),
            [rule_url('the-order-of-combat'), feature_url('jack-of-all-trades')], ['dexterityModifier', 'checkBonus'],
            notes=['This is the initiative modifier, not the rolled initiative entered in combat.'])
    formula('passivePerception', op('add', 10, var('perceptionBonus'), var('advantageAdjustment')),
            [rule_url('ability-checks')], ['perceptionBonus', 'advantageAdjustment'], advantageAdjustments={'normal': 0, 'advantage': 5, 'disadvantage': -5, 'both': 0})
    formula('spellSaveDC', op('add', 8, var('proficiencyBonus'), var('castingAbilityModifier'), var('otherBonus')),
            [rule_url('casting-a-spell')], ['proficiencyBonus', 'castingAbilityModifier', 'otherBonus'])
    formula('spellAttackBonus', op('add', var('proficiencyBonus'), var('castingAbilityModifier'), var('otherBonus')),
            [rule_url('casting-a-spell')], ['proficiencyBonus', 'castingAbilityModifier', 'otherBonus'])
    formula('unarmoredAC', op('add', 10, var('dexterityModifier'), var('shieldBonus'), var('otherBonus')),
            [rule_url('using-each-ability')], ['dexterityModifier', 'shieldBonus', 'otherBonus'], stackingGroup='base-armor-class')
    formula('armorAC', op('add', var('armorBase'), var('armorDexterityContribution'), var('shieldBonus'), var('otherBonus')),
            [rule_url('using-each-ability')], ['armorBase', 'armorDexterityContribution', 'shieldBonus', 'otherBonus'], stackingGroup='base-armor-class',
            notes=['Use equipment.dex_bonus and max_bonus. A negative Dexterity modifier still applies to light/medium armor. Shield adds +2 rather than replacing base AC.'])
    formula('cappedArmorDexterity', op('min', var('dexterityModifier'), var('dexterityCap')),
            [rule_url('using-each-ability')], ['dexterityModifier', 'dexterityCap'])
    formula('barbarianUnarmoredAC', op('add', 10, var('dexterityModifier'), var('constitutionModifier'), var('shieldBonus'), var('otherBonus')),
            [feature_url('barbarian-unarmored-defense')], ['dexterityModifier', 'constitutionModifier', 'shieldBonus', 'otherBonus'],
            conditions={'wearingArmor': False}, stackingGroup='base-armor-class')
    formula('monkUnarmoredAC', op('add', 10, var('dexterityModifier'), var('wisdomModifier'), var('otherBonus')),
            [feature_url('monk-unarmored-defense')], ['dexterityModifier', 'wisdomModifier', 'otherBonus'],
            conditions={'wearingArmor': False, 'usingShield': False}, stackingGroup='base-armor-class')
    formula('draconicResilienceAC', op('add', 13, var('dexterityModifier'), var('shieldBonus'), var('otherBonus')),
            [feature_url('draconic-resilience')], ['dexterityModifier', 'shieldBonus', 'otherBonus'],
            conditions={'wearingArmor': False, 'subclass': 'draconic'}, stackingGroup='base-armor-class')
    formula('firstLevelHitPoints', op('add', var('hitDieSize'), var('constitutionModifier'), var('otherBonus')),
            ['https://dungeonedraghi.it/compendio/classi/barbaro/'], ['hitDieSize', 'constitutionModifier', 'otherBonus'])
    formula('fixedHitDieGain', op('add', op('floor', op('divide', var('hitDieSize'), 2)), 1),
            ['https://dungeonedraghi.it/compendio/classi/barbaro/'], ['hitDieSize'],
            notes=['The player chooses the fixed value or rolls the hit die. Add Constitution separately, using the chosen edition rules.'])
    formula('higherLevelHitPointGain', op('max', 1, op('add', var('chosenHitDieValue'), var('constitutionModifier'))),
            [creation_source], ['chosenHitDieValue', 'constitutionModifier'])
    formula('constitutionHitPointAdjustment', op('multiply', var('characterLevel'), op('subtract', var('newConstitutionModifier'), var('oldConstitutionModifier'))),
            [creation_source], ['characterLevel', 'newConstitutionModifier', 'oldConstitutionModifier'],
            notes=['Apply the Constitution change retroactively; do not add it a second time when recomputing all level gains.'])
    formula('carryingCapacityPounds', op('multiply', var('strengthScore'), 15, var('sizeMultiplier')),
            [rule_url('using-each-ability')], ['strengthScore', 'sizeMultiplier'])

    level_groups = {}
    for level in collections['Levels']:
        if 'subclass' not in level:
            level_groups.setdefault(level['level'], set()).add(level['prof_bonus'])
    if set(level_groups) != set(range(1, 21)) or any(len(bonuses) != 1 for bonuses in level_groups.values()):
        raise ValueError('Bonus di competenza non coerenti fra le classi')
    return {
        'expressionFormat': {'variable': {'var': 'variableName'}, 'operation': {'op': 'operationName', 'args': []},
            'allowedOperations': ['add', 'subtract', 'multiply', 'divide', 'floor', 'min', 'max'], 'numbers': 'JSON numbers; never evaluate strings as executable code'},
        'formulas': formulas,
        'proficiencyByCharacterLevel': [{'level': level, 'bonus': next(iter(bonuses))} for level, bonuses in sorted(level_groups.items())],
        'abilityModifierTable': [{'score': score, 'modifier': (score - 10) // 2} for score in range(1, 31)],
        'abilityScoreGeneration': {'sourceUrl': creation_source, 'scope': 'mechanical-facts-only-no-copied-prose',
            'standardArray': [15, 14, 13, 12, 10, 8],
            'rolling': {'diceCount': 4, 'dieSides': 6, 'keepHighest': 3, 'repeat': 6, 'assignment': 'player-choice'},
            'pointBuy': {'optional': True, 'budget': 27, 'minimumBeforeRacialBonuses': 8, 'maximumBeforeRacialBonuses': 15,
                'costs': [{'score': score, 'cost': cost} for score, cost in [(8, 0), (9, 1), (10, 2), (11, 3), (12, 4), (13, 5), (14, 7), (15, 9)]]}},
        'experienceThresholds': {'sourceUrl': creation_source,
            'levels': [{'level': level, 'minimumXP': xp} for level, xp in enumerate([0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000], 1)]},
        'automationPolicy': {
            'edition': '2014 / SRD 5.1 only; 2024 species/background bonuses are not interchangeable',
            'abilityScores': 'Keep base scores, race/subrace bonuses, choices and other increases separate; always recompute, never add bonuses to an already modified score.',
            'level': 'Proficiency uses total character level; class/subclass features and slots use the appropriate class level.',
            'armorClass': 'Choose one legal base AC formula. Do not add barbarian, monk, draconic or armor base formulas together.',
            'choices': 'Do not choose skills, languages, ability increases, ancestry, subclass, equipment, expertise or multiclassing for the player.',
            'conditionalEffects': 'Apply only when all prerequisites and conditions are known; preserve advantage/disadvantage as roll states, not flat bonuses.',
            'unknownRules': 'Keep the original description and mark manual review; do not infer universal bonuses from prose.',
            'units': 'Preserve source feet/pounds. Canonical physical conversions are separate from Italian game-grid conversions (5 ft = 1.5 m).',
            'spells': 'Known/prepared spells and expended slots require player choices; descriptive spells are not an automatic effect engine.',
        },
        'applicationOrder': ['selectRuleset', 'baseAbilityScores', 'raceAndSubrace', 'resolvePlayerChoices', 'classAndSubclassByLevel', 'abilityModifiers', 'proficiencyByTotalLevel', 'equipmentAndACFormula', 'derivedStatistics', 'activeConditionalEffects', 'manualOverrides'],
    }


def curated_effects():
    # Explicit interpretations of the referenced descriptions, not unrestricted prose matching.
    def effect(collection, index, effects, requires_choice=False):
        return {'ownerId': identifier(collection, index), 'sourceUrl': API + '/api/2014/' + KEYS[collection] + '/' + index,
                'derivation': 'reviewed-structured-interpretation', 'requiresPlayerChoice': requires_choice, 'effects': effects}
    return [
        effect('Traits', 'darkvision', [{'operation': 'set', 'target': 'darkvisionRangeFeet', 'value': 60}]),
        effect('Traits', 'dwarven-toughness', [{'operation': 'add', 'target': 'maxHitPoints', 'expression': var('characterLevel')}]),
        effect('Traits', 'keen-senses', [{'operation': 'grantProficiency', 'target': 'skill', 'index': 'perception'}]),
        effect('Traits', 'menacing', [{'operation': 'grantProficiency', 'target': 'skill', 'index': 'intimidation'}]),
        effect('Traits', 'hellish-resistance', [{'operation': 'grantResistance', 'damageType': 'fire'}]),
        effect('Traits', 'dwarven-resilience', [{'operation': 'grantResistance', 'damageType': 'poison'}, {'operation': 'advantage', 'target': 'savingThrow', 'against': 'poison'}]),
        effect('Traits', 'fey-ancestry', [{'operation': 'advantage', 'target': 'savingThrow', 'against': 'charmed'}, {'operation': 'immunity', 'against': 'magical-sleep'}]),
        effect('Traits', 'gnome-cunning', [{'operation': 'advantage', 'target': 'savingThrow', 'abilityScores': ['int', 'wis', 'cha'], 'against': 'magic'}]),
        effect('Traits', 'brave', [{'operation': 'advantage', 'target': 'savingThrow', 'against': 'frightened'}]),
        effect('Traits', 'stonecunning', [{'operation': 'setProficiencyMultiplier', 'target': 'skill:history', 'value': 2, 'conditions': {'topic': 'origin-of-stonework'}}]),
        effect('Traits', 'artificers-lore', [{'operation': 'setProficiencyMultiplier', 'target': 'skill:history', 'value': 2, 'conditions': {'topicIn': ['magic-items', 'alchemical-objects', 'technological-devices']}}]),
        effect('Traits', 'breath-weapon', [{'operation': 'derivedDC', 'expression': op('add', 8, var('constitutionModifier'), var('proficiencyBonus'))}, {'operation': 'damageProgression', 'thresholds': [{'level': 1, 'dice': '2d6'}, {'level': 6, 'dice': '3d6'}, {'level': 11, 'dice': '4d6'}, {'level': 16, 'dice': '5d6'}]}, {'operation': 'limitedUse', 'uses': 1, 'recoversOn': ['shortRest', 'longRest']}], True),
        effect('Features', 'barbarian-unarmored-defense', [{'operation': 'baseACAlternative', 'formulaId': 'barbarianUnarmoredAC'}]),
        effect('Features', 'monk-unarmored-defense', [{'operation': 'baseACAlternative', 'formulaId': 'monkUnarmoredAC'}]),
        effect('Features', 'fast-movement', [{'operation': 'add', 'target': 'walkingSpeedFeet', 'value': 10, 'conditions': {'wearingHeavyArmor': False}}]),
        effect('Features', 'primal-champion', [{'operation': 'add', 'target': 'abilityScores', 'abilityScores': ['str', 'con'], 'value': 4}, {'operation': 'setMaximum', 'target': 'abilityScores', 'abilityScores': ['str', 'con'], 'value': 24}]),
        effect('Features', 'jack-of-all-trades', [{'operation': 'setProficiencyMultiplier', 'target': 'abilityChecks', 'value': 0.5, 'conditions': {'alreadyIncludesProficiency': False}}]),
        effect('Features', 'aura-of-protection', [{'operation': 'add', 'target': 'savingThrows', 'expression': op('max', 1, var('charismaModifier')), 'conditions': {'auraOwnerConscious': True, 'inAura': True}, 'stackingGroup': 'aura-of-protection'}]),
        effect('Features', 'draconic-resilience', [{'operation': 'add', 'target': 'maxHitPoints', 'expression': var('sorcererLevel')}, {'operation': 'baseACAlternative', 'formulaId': 'draconicResilienceAC'}]),
        *[effect('Features', index, [{'operation': 'add', 'target': 'armorClass', 'value': 1, 'conditions': {'wearingArmor': True}, 'stackingGroup': 'fighting-style-defense'}], True) for index in ['fighter-fighting-style-defense', 'fighting-style-defense', 'ranger-fighting-style-defense']],
        *[effect('Features', index, [{'operation': 'setProficiencyMultiplier', 'target': 'chosenProficiencies', 'value': 2, 'choose': 2}], True) for index in ['bard-expertise-1', 'bard-expertise-2', 'rogue-expertise-1', 'rogue-expertise-2']],
    ]


def build(raw):
    collections = raw['collections']
    if set(collections) != set(KEYS):
        raise ValueError('Collezioni SRD mancanti o inattese')
    for collection in ['Classes', 'Races', 'Ability-Scores', 'Skills']:
        if {entry['index'] for entry in collections[collection]} != set(NAMES[collection]):
            raise ValueError(f'Catalogo SRD base incompleto: {collection}')
    registry = {}
    for collection, entries in collections.items():
        if not entries or len({entry['index'] for entry in entries}) != len(entries):
            raise ValueError(f'Collezione vuota o con duplicati: {collection}')
        for entry in entries:
            if not entry.get('name') and collection != 'Levels':
                raise ValueError(f'Voce senza nome: {entry["index"]}')
            if entry['url'] in registry or not entry['url'].startswith('/api/2014/'):
                raise ValueError(f'URL duplicato o edizione inattesa: {entry["url"]}')
            registry[entry['url']] = identifier(collection, entry['index'])
    unresolved = set()

    def references(value):
        if isinstance(value, list):
            return [references(item) for item in value]
        if not isinstance(value, dict):
            return value
        result = {key: references(item) for key, item in value.items()}
        if isinstance(result.get('url'), str) and result['url'].startswith('/api/2014/'):
            url = result['url']
            if url in registry:
                result['id'] = registry[url]
            else:
                unresolved.add(url)
                result['referenceStatus'] = 'external-endpoint-or-unresolved'
            result['sourceUrl'] = API + url
        return result

    italian = {entry['name'].casefold(): entry for entry in raw.get('italianHtml', {}).get('entries', [])}
    exports = {}
    for collection, entries in collections.items():
        exports[KEYS[collection]] = []
        for source in entries:
            entry = references(deepcopy(source))
            entry.update({'id': identifier(collection, entry['index']), 'ruleset': 'dnd5e-2014', 'language': 'en', 'licenseId': 'OGL-1.0a'})
            name_it = NAMES.get(collection, {}).get(entry['index'])
            if name_it:
                entry['nameIt'] = name_it
                entry['aliases'] = list(dict.fromkeys([entry.get('name', ''), name_it] + (['Draconato'] if entry['index'] == 'dragonborn' else [])))
                local = italian.get(name_it.casefold())
                if local and collection in ('Classes', 'Races'):
                    entry['localizations'] = {'it': {'name': local['name'], 'sourceUrl': local['sourceUrl'], **italian_text(local['descriptionHtml'])}}
            if collection in ('Races', 'Subraces'):
                entry['fixedAbilityBonuses'] = {ABILITIES[bonus['ability_score']['index']]: bonus['bonus'] for bonus in entry.get('ability_bonuses', [])}
                entry['abilityBonusChoices'] = entry.get('ability_bonus_options')
                entry['inheritParentRace'] = collection == 'Subraces'
                if 'speed' in entry:
                    entry['walkingSpeed'] = {'value': entry['speed'], 'unit': 'ft', 'metricGameGrid': entry['speed'] * 0.3}
            if collection == 'Classes':
                base_levels = [level for level in collections['Levels'] if level['class']['index'] == entry['index'] and 'subclass' not in level]
                if {level['level'] for level in base_levels} != set(range(1, 21)):
                    raise ValueError(f'Progressione classe incompleta: {entry["index"]}')
                entry['levelIds'] = [identifier('Levels', level['index']) for level in sorted(base_levels, key=lambda level: level['level'])]
                entry['savingThrowAbilities'] = [ABILITIES[ability['index']] for ability in entry['saving_throws']]
                entry['castingAbility'] = ABILITIES.get(entry.get('spellcasting', {}).get('spellcasting_ability', {}).get('index'))
                entry['abilityScoreImprovementLevels'] = [level['level'] for level in base_levels if any('ability-score-improvement' in feature['index'] for feature in level['features'])]
                entry['hitPoints'] = {'hitDie': f'1d{entry["hit_die"]}', 'firstLevelBase': entry['hit_die'], 'fixedHigherLevelBase': entry['hit_die'] // 2 + 1, 'addAbilityModifier': 'constitution', 'higherLevelMethod': 'player-choice-fixed-or-roll'}
            if collection == 'Skills':
                entry['abilityField'] = ABILITIES[entry['ability_score']['index']]
                entry['playerDetailsKeys'] = {'bonus': f'skill.{name_it}', 'proficient': f'skill.{name_it}.proficient', 'expertise': f'skill.{name_it}.expertise'}
            if collection == 'Features':
                entry['automationStatus'] = 'manual-unless-explicit-effect-rule-or-structured-field'
            exports[KEYS[collection]].append(entry)

    effects = curated_effects()
    ids = set(registry.values())
    if any(effect['ownerId'] not in ids for effect in effects):
        raise ValueError('Regola di effetto collegata a una voce inesistente')
    if unresolved:
        raise ValueError('Riferimenti mancanti: ' + ', '.join(sorted(unresolved)))
    rules = calculation_rules(collections)
    rules['effectRules'] = effects
    rules['referenceAudit'] = {'unresolvedUrls': sorted(unresolved), 'policy': 'References without id retain their API URL and are not silently treated as resolved.'}
    rules['italianRules'] = [{'id': 'dungeonedraghi:rule:' + entry['sourceUrl'].split('/regole/', 1)[1].strip('/').replace('/', ':'), 'name': entry['name'],
        'sourceUrl': entry['sourceUrl'], 'language': 'it', 'ruleset': 'dnd5e-2014', 'licenseId': 'OGL-1.0a', **italian_text(entry['descriptionHtml'])}
        for entry in raw.get('italianHtml', {}).get('rules', [])]
    creation_keys = ['classes', 'subclasses', 'levels', 'features', 'races', 'subraces', 'traits', 'backgrounds', 'feats', 'proficiencies', 'languages', 'alignments', 'spells']
    equipment_keys = ['equipment', 'equipmentCategories', 'magicItems', 'weaponProperties', 'damageTypes']
    rule_keys = ['abilityScores', 'skills', 'conditions', 'rules', 'ruleSections', 'magicSchools']
    common = {'schemaVersion': 1, 'ruleset': 'dnd5e-2014', 'srdVersion': '5.1', 'retrievedAt': raw['retrievedAt'], 'source': 'https://github.com/5e-bits/5e-database', 'licenseIds': ['OGL-1.0a', 'MIT-5e-database']}
    documents = {
        'character-options.json': {**common, **{key: exports[key] for key in creation_keys}},
        'character-equipment.json': {**common, **{key: exports[key] for key in equipment_keys}},
        'character-rules.json': {**common, **{key: exports[key] for key in rule_keys}, **rules},
        'wiki-character-index.json': {'schemaVersion': 1, **raw.get('wikiIndexes', {'sources': [], 'entries': []}),
            'scope': 'Index names and URLs only. Editions, settings, UA/homebrew and mechanical compatibility are not verified; never auto-apply.'},
    }
    manifest = {**common, 'files': {}, 'coverage': {key: len(value) for key, value in exports.items()},
        'sources': [{'url': 'https://github.com/5e-bits/5e-database/tree/main/src/2014/en', 'content': 'Complete downloaded 2014 SRD collections, English text and structured mechanics'},
                    {'url': 'https://dungeonedraghi.it/compendio/classi/', 'content': 'Italian SRD class pages'},
                    {'url': 'https://dungeonedraghi.it/compendio/razze/', 'content': 'Italian SRD race pages'},
                    {'url': 'https://dungeonedraghi.it/regole/', 'content': 'Italian rule articles discovered recursively from the rules index'},
                    {'url': 'https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters', 'content': 'Verified mechanical facts for ability generation, XP and hit point calculations; no copied narrative text'},
                    {'url': 'https://dnd5e.wikidot.com/', 'content': 'Additional player-option index names/URLs; no non-SRD full descriptions'}],
        'licenses': [{'id': 'OGL-1.0a', 'textFile': 'ogl-1.0a.txt', 'sourceUrl': 'https://dungeonedraghi.it/licenza-ogl/', 'appliesTo': 'SRD 5.1 mechanics and descriptions, including cited Italian translations; images and Product Identity excluded'},
                     {'id': 'MIT-5e-database', 'textFile': 'srd-database-license.txt', 'sourceUrl': 'https://github.com/5e-bits/5e-database/blob/main/LICENSE.md', 'appliesTo': 'Database structure and source repository software'}],
        'limitations': ['SRD coverage only: one background, one feat and one subclass per class; commercial expansions are not included.',
                        'Wikidot extra options are metadata only, not mechanically validated.', 'Automated calculations are described in data; the current player-sheet UI does not yet apply these catalogs.',
                        '2014 rules; no inferred 2024 bonuses.', 'Fields requiring choices or conditional context must never be silently autofilled.'],
        'downloadErrors': raw.get('italianHtml', {}).get('errors', []),
        'italianCoverage': {'options': len(italian), 'rulePages': len(rules['italianRules'])},
        'wikiIndexCounts': dict(Counter(entry['kind'] for entry in raw.get('wikiIndexes', {}).get('entries', []))),
        'expressionFormat': 'See character-rules.json; safe JSON operation tree, not executable strings',
        'integration': {'existingCatalog': 'database.json stays separate; current monster and combat data are unchanged', 'playerSheet': 'Base field mapping uses strength/dexterity/constitution/intelligence/wisdom/charisma; see skill.playerDetailsKeys for saved skill fields'},
    }
    return documents, manifest


def export(raw, destination):
    documents, manifest = build(raw)
    if 'OPEN GAME LICENSE Version 1.0a' not in (ROOT / 'public/data/ogl-1.0a.txt').read_text(encoding='utf-8'):
        raise ValueError('Licenza OGL mancante')
    if 'MIT License' not in raw['repositoryLicense']:
        raise ValueError('Licenza del database sorgente mancante')
    staged = {}
    for filename, document in documents.items():
        body = json.dumps(document, ensure_ascii=False, indent=2) + '\n'
        json.loads(body)
        staged[filename] = body
        manifest['files'][filename] = {'bytes': len(body.encode('utf-8')), 'sha256': hashlib.sha256(body.encode('utf-8')).hexdigest()}
    staged['srd-database-license.txt'] = raw['repositoryLicense']
    staged['character-catalog.json'] = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
    destination.mkdir(parents=True, exist_ok=True)
    # Validate everything before replacing any artifact; publish the manifest last.
    for filename, body in staged.items():
        temporary = destination / (filename + '.tmp')
        temporary.write_bytes(body.encode('utf-8'))
    for filename in staged:
        (destination / (filename + '.tmp')).replace(destination / filename)
    print('Cataloghi personaggio esportati: ' + ', '.join(f'{key}={count}' for key, count in manifest['coverage'].items()), flush=True)
    return manifest
