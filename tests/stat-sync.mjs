import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newCharacterSheet, turnFromSheet, patchSheetStats, syncTurnStats, parseCharacterSheets, clampCurrentHitPointsToMaximum } from '../src/utils/CharacterSheets.ts'
import { hitPointsAfterDamage } from '../src/utils/Combat.ts'
import { applyCreation, enableCreation } from '../src/utils/PlayerCreation.ts'

const original = { ...newCharacterSheet(), name: 'Aria', hitPoints: '32', armorClass: '16', initiative: '14', abilities: [{ name: 'Scudo', duration: '1 minuto' }], playerDetails: { maxHitPoints: '40', temporaryHitPoints: '5', 'spell.1.0.name': 'Scudo' } }
const turn = { ...turnFromSheet(original, 42), damage: '7' }
const fromCard = patchSheetStats(original, { hitPoints: hitPointsAfterDamage(turn.hitPoints, turn.damage), armorClass: '18', initiative: '17' })
assert.equal(fromCard.hitPoints, '25')
assert.equal(fromCard.playerDetails.maxHitPoints, '40', 'Damage changes current HP, not maximum HP')
assert.equal(fromCard.playerDetails.temporaryHitPoints, '5', 'Editing current HP does not modify other PDF fields')
assert.equal(original.hitPoints, '32', 'Synchronization must create a new sheet instead of mutating a stale reference')
assert.deepEqual(parseCharacterSheets(JSON.stringify([fromCard]))[0], fromCard, 'Card changes must remain valid for browser persistence')
const synced = syncTurnStats(turn, fromCard)
assert.equal(synced.hitPoints, fromCard.hitPoints)
assert.equal(synced.sheet.hitPoints, synced.hitPoints)
assert.equal(synced.armorClass, '18')
assert.equal(synced.initiative, '17')
const editedPdf = { ...fromCard, name: 'Aria aggiornata', hitPoints: '28', armorClass: '19', initiative: '20', dexterity: '18', abilities: [] }
const back = syncTurnStats(synced, editedPdf)
assert.equal(back.id, 42)
assert.equal(back.description, editedPdf.name)
assert.equal(back.hitPoints, '28')
assert.equal(back.armorClass, '19')
assert.equal(back.initiative, '20')
assert.equal(back.sheet.dexterity, '18')
assert.equal(back.sheet.abilities, turn.sheet.abilities, 'Updating statistics must not shift imported ability indexes or reset ability templates')
for (const kind of ['Mostro', 'PNG']) {
    const creature = { ...original, kind }
    const imported = turnFromSheet(creature, 43)
    assert.equal(imported.initiative, '')
    assert.equal(imported.sheet.initiative, '', 'Initial monster initiative must be consistent between its card and combat sheet')
    assert.equal(syncTurnStats(imported, { ...creature, initiative: '12' }).initiative, '12', 'A manually entered monster initiative must be synchronized without being reset')
}
for (const invalid of [{ hitPoints: 'NaN' }, { armorClass: '15.5' }, { initiative: 'Infinity' }]) assert.equal(patchSheetStats(original, invalid), null)
const reducedMaximum = clampCurrentHitPointsToMaximum({ ...original, playerDetails: { ...original.playerDetails, maxHitPoints: '30' } })
assert.equal(reducedMaximum.playerDetails.maxHitPoints, '30', 'Clamping current HP must preserve the configured maximum')
assert.equal(reducedMaximum.hitPoints, '30', 'Current HP above the new maximum must be clamped')
assert.equal(clampCurrentHitPointsToMaximum({ ...original, hitPoints: '25', playerDetails: { ...original.playerDetails, maxHitPoints: '30' } }).hitPoints, '25', 'Current HP below the new maximum must remain unchanged')
assert.equal(clampCurrentHitPointsToMaximum({ ...original, hitPoints: '45', playerDetails: { ...original.playerDetails, maxHitPoints: '35' } }).hitPoints, '35', 'Current HP above a reduced maximum must be clamped')
assert.equal(clampCurrentHitPointsToMaximum({ ...original, hitPoints: '45' }).hitPoints, '40', 'Leaving the maximum field clamps current HP even when the maximum is unchanged')
assert.equal(clampCurrentHitPointsToMaximum({ ...original, hitPoints: '45', playerDetails: { ...original.playerDetails, maxHitPoints: '' } }).hitPoints, '45', 'An empty maximum must not alter current HP')
const json = (file) => JSON.parse(readFileSync(new URL(`../public/data/${file}.json`, import.meta.url), 'utf8'))
const data = { ...json('character-options'), ...json('character-equipment'), skills: json('character-rules').skills }
const automatic = enableCreation({ ...original, level: '1', constitution: '10', dexterity: '10', playerDetails: { 'creation.class': 'fighter', 'creation.race': 'human' } }, data)
const overridden = patchSheetStats(automatic, { armorClass: '22', hitPoints: '3', initiative: '11' })
const recalculated = applyCreation(overridden, data)
assert.equal(recalculated.armorClass, '22', 'PDF automatic rules must preserve AC entered in the combat card')
assert.equal(recalculated.hitPoints, '3', 'Recalculation must preserve combat damage')
assert.equal(recalculated.initiative, '11')
console.log('Stat synchronization checks passed: both directions, persistence, HP, manual AC, initiative and ability identity')
