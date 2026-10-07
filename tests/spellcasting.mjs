import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newCharacterSheet, parseCharacterSheets } from '../src/utils/CharacterSheets.ts'
import { enableCreation, spellRules, spellSelection } from '../src/utils/PlayerCreation.ts'
import { spellProfile, spellRowState, grantedSpells } from '../src/utils/Spellcasting.ts'
import { parseCatalog, sheetWithCombatAbilities } from '../src/utils/Catalog.ts'
const json = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))
const data = { ...json('character-options'), ...json('character-equipment'), skills: json('character-rules').skills }
const catalog = parseCatalog(json('database'))
const create = (id, level = 1, edition = '2014', extra = {}) => enableCreation({ ...newCharacterSheet(), name: 'Test', level: String(level), intelligence: '16', wisdom: '16', charisma: '16', playerDetails: { 'creation.class': id, 'rules.edition': edition, ...extra } }, data)
const wizard = create('wizard', 3)
assert.equal(spellProfile(wizard, data).preparedLimit, 6)
assert.equal(spellProfile(wizard, data, '2024').preparedLimit, 6)
assert.equal(spellProfile(create('wizard', 1), data).preparedLimit, 4)
assert.equal(spellProfile({ ...create('wizard', 1), intelligence: '10' }, data).preparedLimit, 1)
assert.equal(spellProfile({ ...create('wizard', 1), intelligence: '10' }, data, '2024').preparedLimit, 4)
assert.equal(spellRules(create('paladin'), data).maxLevel, 0)
assert.equal(spellRules(create('paladin', 1, '2024'), data).maxLevel, 1)
assert.equal(spellRules(create('ranger', 1, '2024'), data).preparedLimit, 2)
assert.equal(spellRules(create('ranger', 1, '2014'), data).maxLevel, 0)
assert.equal(spellRules(create('sorcerer', 3, '2014'), data).known, 4)
assert.equal(spellRules(create('sorcerer', 3, '2024'), data).known, 6)
for (const cls of data.classes) for (const edition of ['2014', '2024']) for (let level = 1; level <= 20; level++) {
    const profile = spellProfile(create(cls.index, level), data, edition)
    assert.ok(Number.isInteger(profile.cantrips) && profile.cantrips >= 0)
    assert.ok(Number.isInteger(profile.maxLevel) && profile.maxLevel >= 0 && profile.maxLevel <= 9)
}
const details = { 'spell.0.0.name': 'Light', 'spell.1.0.name': 'Magic Missile', 'spell.1.0.prepared': 'true', 'spell.1.1.name': 'Shield', 'spell.1.2.name': 'Detect Magic' }
const prepared = { ...wizard, playerDetails: { ...wizard.playerDetails, ...details } }
const ready = sheetWithCombatAbilities(prepared, catalog)
assert.ok(ready.abilities.some((x) => x.name === 'Luce'))
assert.ok(ready.abilities.some((x) => x.name === 'Dardo Incantato'))
assert.ok(!ready.abilities.some((x) => x.name === 'Scudo'))
assert.ok(!ready.abilities.some((x) => x.name === 'Individuazione del Magico'), 'Unprepared wizard rituals remain in the book, not the direct combat spell list')
for (const cls of ['bard', 'ranger', 'sorcerer', 'warlock']) {
    const sheet = create(cls, 5)
    sheet.playerDetails['spell.1.0.name'] = 'Cure Wounds'
    assert.equal(spellRowState(sheet, 1, 0).canToggle, false)
    assert.equal(spellRowState(sheet, 1, 0).available, true)
}
const external = { ...prepared, playerDetails: { ...prepared.playerDetails, 'spell.1.1.source': 'item', 'spell.1.1.available': 'true', 'spell.2.0.name': 'Darkness', 'spell.2.0.source': 'racial' } }
assert.ok(sheetWithCombatAbilities(external, catalog).abilities.some((x) => x.name === 'Scudo'))
assert.equal(spellSelection(external, data).spells, 2, 'Racial and item spells do not count as class spells')
assert.equal(spellSelection(external, data).extra, 2)
external.playerDetails['spell.1.1.available'] = 'false'
assert.ok(!sheetWithCombatAbilities(external, catalog).abilities.some((x) => x.name === 'Scudo'))
const life = create('cleric', 1, '2014', { 'creation.subclass': 'life' })
assert.equal(grantedSpells(life, data).length, 2)
life.playerDetails['spell.1.0.name'] = 'Bless'
life.playerDetails['spell.1.0.prepared'] = 'true'
assert.equal(spellSelection(life, data).prepared, 0, 'Domain spells are always prepared outside the normal limit')
assert.ok(sheetWithCombatAbilities(life, catalog).abilities.some((x) => x.name === 'Benedizione'))
const tiefling = create('fighter', 5, '2014', { 'creation.race': 'tiefling' })
assert.equal(grantedSpells(tiefling, data).length, 3)
assert.equal(spellSelection(tiefling, data).spells, 0)
assert.ok(sheetWithCombatAbilities(tiefling, catalog).abilities.some((x) => x.name === 'Oscurità'))
assert.equal(grantedSpells(create('fighter', 1, '2024', { 'creation.race': 'tiefling' }), data).length, 2)
const warlock = create('warlock', 11)
warlock.playerDetails['spell.6.0.name'] = 'Eyebite'
assert.equal(spellRowState(warlock, 6, 0).available, true)
assert.equal(spellSelection(warlock, data).spells, 0, 'Mystic Arcanum has its own selection, not pact slots or known-spell count')
warlock.playerDetails['spell.6.1.name'] = 'Circle of Death'
assert.ok(spellSelection(warlock, data).issues.some((x) => x.includes('massimo uno')))
assert.equal(spellRowState(create('warlock', 10), 6, 0).available, false)
assert.equal(spellRules(create('warlock', 17), data).maxLevel, 5)
assert.deepEqual(spellRules(create('warlock', 17), data).arcanumLevels, [6, 7, 8, 9])
const spent = { ...prepared, playerDetails: { ...prepared.playerDetails, 'slots.1.used': '4', 'slots.2.used': '2' } }
assert.equal(spellRowState(spent, 1, 0).available, true, 'Expending slots must not remove a prepared spell')
assert.deepEqual(parseCharacterSheets(JSON.stringify([external]))[0], external)

const lore = create('bard', 6, '2014', { 'creation.subclass': 'lore' })
lore.playerDetails['spell.1.0.name'] = 'Shield'
lore.playerDetails['spell.1.0.source'] = 'lore'
assert.equal(spellSelection(lore, data).spells, 0, 'Additional Magical Secrets are outside the known-spell limit')
assert.equal(spellSelection(lore, data).extra, 1)
assert.equal(spellRowState(lore, 1, 0).available, true)
const mountain = create('druid', 9, '2014', { 'creation.subclass': 'land', 'creation.land': 'mountain' })
assert.equal(grantedSpells(mountain, data).length, 8)
assert.ok(grantedSpells(mountain, data).some((x) => x.index === 'lightning-bolt'))
const tropical = create('druid', 9, '2024', { 'creation.subclass': 'land', 'creation.land': 'tropical' })
assert.equal(grantedSpells(tropical, data).length, 6)
const draconic = create('sorcerer', 9, '2024', { 'creation.subclass': 'draconic' })
assert.equal(grantedSpells(draconic, data).length, 10)
assert.ok(grantedSpells(draconic, data).some((x) => x.index === 'legend-lore'))
assert.ok(!grantedSpells(draconic, data).some((x) => x.index === 'hold-monster'))
assert.equal(grantedSpells(create('cleric', 1, '2024', { 'creation.subclass': 'life' }), data).length, 0)
assert.equal(grantedSpells(create('cleric', 3, '2024', { 'creation.subclass': 'life' }), data).length, 4)
assert.equal(grantedSpells(create('wizard', 1, '2024', { 'creation.race': 'gnome', 'creation.subrace': 'rock-gnome' }), data).length, 2)
const known = create('bard', 1, '2024')
known.playerDetails['spell.1.0.name'] = 'Cure Wounds'
known.playerDetails['spell.1.0.available'] = 'false'
assert.equal(spellRowState(known, 1, 0).checked, true, 'Changing a source back to a known class spell must restore automatic availability')
assert.equal(spellSelection(known, data).prepared, 1)
assert.equal(spellProfile(create('wizard', 14), data, '2024').preparedLimit, 18)
assert.equal(spellProfile(create('cleric', 14), data, '2024').preparedLimit, 17)
assert.equal(spellProfile(create('paladin', 4), data, '2024').changePolicy, 'one-per-long-rest')
assert.equal(spellProfile(create('cleric', 4), data, '2024').changePolicy, 'long-rest')

console.log('Spellcasting checks passed: both editions, all classes/levels, preparation, combat filtering, racial/item grants and pact magic')
