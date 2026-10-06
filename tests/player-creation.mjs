import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newCharacterSheet, parseCharacterSheets } from '../src/utils/CharacterSheets.ts'
import { abilityKeys, applyCreation, creationChoices, enableCreation, optionsFor, resolveChoice, resetCreationOverrides, spellRules, spellSelection } from '../src/utils/PlayerCreation.ts'

const json = (file) => JSON.parse(readFileSync(new URL(`../public/data/${file}.json`, import.meta.url), 'utf8'))
const data = { ...json('character-options'), ...json('character-equipment'), skills: json('character-rules').skills }
function create(characterClass, race = 'human', subrace = '', level = 1) {
    return enableCreation({ ...newCharacterSheet(), name: 'Test PG', level: String(level), ...Object.fromEntries(abilityKeys.map((key) => [key, '10'])), playerDetails: { 'creation.class': characterClass, 'creation.race': race, 'creation.subrace': subrace } }, data)
}
function edit(sheet, changes, base = {}) {
    return applyCreation({ ...sheet, ...base, playerDetails: { ...sheet.playerDetails, ...changes } }, data)
}
const dwarf = create('fighter', 'dwarf', 'hill-dwarf')
assert.equal(dwarf.constitution, '12')
assert.equal(dwarf.wisdom, '11')
assert.equal(dwarf.hitPoints, '12', 'Fighter hit die + Constitution + dwarven toughness')
assert.equal(dwarf.speed, '7.5 m')
assert.equal(dwarf.playerDetails['save.constitution'], '3')
assert.deepEqual(applyCreation(dwarf, data), dwarf, 'Recomputation must be idempotent')
const elf = edit(dwarf, { 'creation.race': 'elf', 'creation.subrace': 'high-elf' })
assert.equal(elf.constitution, '10', 'Old racial bonus must be removed')
assert.equal(elf.dexterity, '12')
assert.equal(elf.intelligence, '11')
assert.equal(elf.playerDetails['skill.Percezione.proficient'], 'true')
assert.equal(elf.playerDetails.passivePerception, '12')
assert.equal(elf.hitPoints, '10')
assert.deepEqual(parseCharacterSheets(JSON.stringify([elf]))[0], elf, 'Persist every creation choice and base score')
assert.equal(enableCreation(edit(elf, { 'creation.enabled': 'false' }), data).dexterity, '12', 'Re-enabling must not double-add racial bonuses')
const injured = edit(dwarf, {}, { hitPoints: '3', level: '2' })
assert.equal(injured.hitPoints, '3', 'Changing level must preserve damage')
assert.equal(injured.playerDetails.maxHitPoints, '20')
const manual = edit(dwarf, { maxHitPoints: '99', 'creation.override.maxHitPoints': 'true' }, { level: '5' })
assert.equal(manual.playerDetails.maxHitPoints, '99')
assert.equal(resetCreationOverrides(manual, data).playerDetails.maxHitPoints, '44')
const wizard = create('wizard', 'human')
assert.equal(wizard.playerDetails['save.intelligence.proficient'], 'true')
assert.equal(wizard.playerDetails.spellDC, '10')
assert.equal(spellRules(wizard, data).known, 6)
assert.equal(spellRules(wizard, data).cantrips, 3)
assert.ok(spellRules(wizard, data).spells.every((x) => x.level <= 1 && x.classes.some((c) => c.index === 'wizard')))
assert.equal(spellRules(create('paladin'), data).maxLevel, 0)
assert.equal(spellRules(create('paladin', 'human', '', 2), data).maxLevel, 1)
const warlock = create('warlock', 'human', '', 3)
assert.equal(warlock.playerDetails['slots.1.total'], '0')
assert.equal(warlock.playerDetails['slots.2.total'], '2')
assert.ok(spellRules(warlock, data).spells.some((x) => x.level === 1), 'Pact casters can learn lower-level spells')
const changedClass = edit(dwarf, { 'creation.class': 'wizard' })
assert.equal(changedClass.playerDetails['save.strength.proficient'], 'false')
assert.equal(changedClass.playerDetails['save.intelligence.proficient'], 'true')
assert.equal(changedClass.playerDetails['proficiency.Pesanti'], 'false')
const halfElf = edit(create('rogue', 'half-elf'), { 'choice.race.half-elf.ability.0': '0', 'choice.race.half-elf.ability.1': '0' })
assert.equal(halfElf.strength, '11', 'One ability cannot receive both half-elf choices')
assert.equal(halfElf.charisma, '12')
const acolyte = edit(wizard, { 'creation.background': 'acolyte', 'choice.background.acolyte.language.0': '1' })
assert.equal(acolyte.playerDetails['skill.Religione.proficient'], 'true')
assert.equal(acolyte.playerDetails['coins.MO'], '15')
assert.ok(creationChoices(acolyte, data).filter((x) => x.choice.type === 'languages').every((x) => optionsFor(x.choice, data).length > 0), 'Resource-list language choices must resolve offline')
// Fighter leather + longbow + 20 arrows bundle, then two martial weapons.
const equipped = edit(create('fighter'), { 'choice.class.fighter.equipment.0.0': '1', 'choice.class.fighter.equipment.1.0': '1', 'choice.class.fighter.equipment.1.0.option.1.nested.0': '0', 'choice.class.fighter.equipment.1.0.option.1.nested.1': '0', 'creation.armor': 'leather-armor', 'creation.base.dexterity': '7' })
assert.ok(equipped.playerDetails.equipment.includes('20 × Arrow'))
assert.equal(equipped.armorClass, '10', 'Negative Dexterity must decrease light armor AC')
assert.ok(equipped.playerDetails['attacks.0.0'], 'Starting weapons generate attacks')
for (const choice of creationChoices(equipped, data).filter((x) => x.choice.type === 'equipment')) {
    assert.ok(resolveChoice(choice.choice, choice.path, equipped.playerDetails, data).every((x) => data.equipment.some((e) => e.index === x.ref.index)), 'Never grant magic items from equipment categories')
}
const mediumChoice = { choose: 1, type: 'equipment', from: { option_set_type: 'equipment_category', equipment_category: { index: 'medium-armor' } } }
assert.ok(optionsFor(mediumChoice, data).every((x) => data.equipment.some((e) => e.index === x.of.index)))
const rangerArmor = edit(create('ranger'), { 'choice.class.ranger.equipment.0.0': '0', 'creation.armor': 'scale-mail', 'creation.base.dexterity': '7' })
assert.equal(rangerArmor.armorClass, '13', 'Medium armor keeps a negative Dexterity modifier')
assert.equal(edit(rangerArmor, { 'creation.base.dexterity': '20' }).armorClass, '16', 'Medium armor caps positive Dexterity at +2')
const overriddenCA = edit(rangerArmor, { 'creation.override.base.armorClass': 'true' }, { armorClass: '21' })
assert.equal(edit(overriddenCA, { 'creation.base.dexterity': '20' }).armorClass, '21', 'Manual armor class must survive recalculation')
const highElfChoice = creationChoices(elf, data).find((x) => x.choice.type === 'racial-spells')
assert.ok(highElfChoice)
assert.ok(edit(elf, { [`${highElfChoice.path}.0`]: '0' }).playerDetails.racialSpells.includes('Intelligenza'))
assert.ok(create('fighter', 'tiefling', '', 3).playerDetails.racialSpells.includes('2° livello'))
const draconic = edit(create('sorcerer'), { 'creation.subclass': 'draconic' })
assert.equal(draconic.armorClass, '13')
assert.equal(draconic.playerDetails.maxHitPoints, '7')
const spellOverflow = edit(warlock, Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`spell.1.${i}.name`, 'Hex'])))
assert.ok(spellSelection(spellOverflow, data).issues.some((x) => x.includes('Troppi incantesimi')))
const expertise = edit(elf, { 'skill.Percezione.expertise': 'true' })
assert.equal(expertise.playerDetails['skill.Percezione'], '4', 'Expertise doubles proficiency, not the ability modifier')
assert.equal(expertise.playerDetails.passivePerception, '14')
const originalManual = { ...newCharacterSheet(), name: 'Legacy PG', dexterity: '10', armorClass: '19', playerDetails: { maxHitPoints: '32', 'skill.Percezione': '7' } }
assert.deepEqual(applyCreation(originalManual, data), originalManual, 'No automatic migration of existing sheets')
for (const characterClass of data.classes) {
    for (const level of [1, 5, 20]) {
        const sheet = create(characterClass.index, 'human', '', level)
        assert.equal(sheet.playerDetails.proficiencyBonus, String(2 + Math.floor((level - 1) / 4)))
        assert.ok(Number.isSafeInteger(Number(sheet.playerDetails.maxHitPoints)))
        assert.deepEqual(applyCreation(sheet, data), sheet)
    }
}
console.log('Player creation checks passed: race changes, HP, overrides, persistence, equipment bundles, spell progression and all classes.')
