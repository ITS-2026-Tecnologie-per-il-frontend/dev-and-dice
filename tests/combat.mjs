import assert from 'node:assert/strict'
import { newCharacterSheet, parseCharacterSheets, turnFromSheet, abilitiesFromSheet, initiativeBonus } from '../src/utils/CharacterSheets.ts'
import { sortByInitiative, nextCombatTurn, durationTurns, advanceAbilityDurations, activateAbility, removeParticipantAbilities } from '../src/utils/Combat.ts'

const participants = [
    { id: 0, initiative: '-2' },
    { id: 1, initiative: '9' },
    { id: 2, initiative: '20' },
    { id: 3, initiative: '9' },
]
const ordered = sortByInitiative(participants)
assert.deepEqual(ordered.map(({ id }) => id), [2, 1, 3, 0])
assert.equal(participants[0].id, 0, 'Sorting must not mutate the original list')
assert.deepEqual(nextCombatTurn(ordered, { activeId: 2, round: 1 }), { activeId: 1, round: 1 })
assert.deepEqual(nextCombatTurn(ordered, { activeId: 0, round: 1 }), { activeId: 2, round: 2 })
assert.deepEqual(nextCombatTurn([ordered[0]], { activeId: 2, round: 1 }), { activeId: 2, round: 2 })
assert.equal(nextCombatTurn([], { activeId: 2, round: 1 }), null)
// Removing the active participant advances using the old order, then removes it.
const next = nextCombatTurn(ordered, { activeId: 3, round: 1 })
assert.ok(ordered.filter(({ id }) => id !== 3).some(({ id }) => id === next.activeId))
assert.deepEqual(Object.values(durationTurns), [10, 100, 600, 4800, 14400, 0])
const abilities = [
    { id: 0, name: 'Scudo', ownerId: 2, duration: '1 minuto', remainingTurns: 10, active: true },
    { id: 1, name: 'Luce', ownerId: null, duration: '1 ora', remainingTurns: 1, active: true },
    { id: 2, name: 'Scaduta', ownerId: 1, duration: '1 minuto', remainingTurns: 0, active: true },
]
const elapsed = advanceAbilityDurations(abilities)
assert.deepEqual(elapsed.map(({ remainingTurns }) => remainingTurns), [9, 0, 0])
assert.equal(abilities[0].remainingTurns, 10, 'Countdown must not mutate the original abilities')
assert.equal(elapsed[0].ownerId, 2, 'Countdown must preserve the owner')
const sheet = { ...newCharacterSheet(), name: 'Aria', hitPoints: '32', armorClass: '16', initiative: '14', wisdom: '18', notes: 'Arco lungo' }
assert.deepEqual(parseCharacterSheets(JSON.stringify([sheet])), [sheet])
assert.deepEqual(parseCharacterSheets(null), [])
assert.throws(() => parseCharacterSheets('{broken'))
assert.throws(() => parseCharacterSheets(JSON.stringify([{ id: 'incomplete' }])))
assert.throws(() => parseCharacterSheets(JSON.stringify([sheet, sheet])))
assert.throws(() => parseCharacterSheets(JSON.stringify([{ ...sheet, wisdom: 'Infinity' }])))
assert.throws(() => parseCharacterSheets(JSON.stringify([{ ...sheet, name: '   ' }])))
const imported = turnFromSheet(sheet, 42)
assert.equal(imported.description, 'Aria')
assert.equal(imported.initiative, '14')
for (const kind of ['Mostro', 'PNG']) assert.equal(turnFromSheet({ ...sheet, kind }, 43).initiative, '', 'Monster and NPC initiative must be entered for each combat, including saved sheets')
assert.equal(initiativeBonus({ ...sheet, dexterity: '14' }), '+2')
assert.equal(initiativeBonus({ ...sheet, dexterity: '9' }), '-1')
assert.equal(initiativeBonus({ ...sheet, dexterity: '10' }), '+0')
assert.equal(initiativeBonus(sheet), '')
assert.equal(initiativeBonus(), '')
assert.equal(imported.armorClass, '16')
assert.equal(imported.sheet.wisdom, '18')
assert.equal(imported.sheet.notes, 'Arco lungo')
imported.hitPoints = '10'
imported.sheet.notes = 'Note del combattimento'
assert.equal(sheet.hitPoints, '32', 'Combat damage must not change the saved sheet')
assert.equal(sheet.notes, 'Arco lungo', 'Combat details must be copied independently')
assert.notEqual(turnFromSheet(sheet, 43).id, imported.id, 'Repeated imports need distinct combat identities')
const sheetWithAbilities = { ...sheet, abilities: [
    { name: 'Scudo', duration: '1 minuto' },
    { name: 'Luce', duration: '1 ora' },
] }
assert.deepEqual(parseCharacterSheets(JSON.stringify([sheetWithAbilities])), [sheetWithAbilities])
const { abilities: _legacyAbilities, ...legacySheet } = sheet
assert.deepEqual(parseCharacterSheets(JSON.stringify([legacySheet]))[0].abilities, [], 'Old saved sheets must still load')
assert.throws(() => parseCharacterSheets(JSON.stringify([{ ...sheet, abilities: null }])))
assert.throws(() => parseCharacterSheets(JSON.stringify([{ ...sheet, abilities: [{ name: 'Scudo', duration: '__proto__' }] }])))
assert.throws(() => parseCharacterSheets(JSON.stringify([{ ...sheet, abilities: [{ name: ' ', duration: '1 minuto' }] }])))
const importedAbilities = abilitiesFromSheet(sheetWithAbilities, 42, 5)
assert.deepEqual(importedAbilities.map(({ id, ownerId, remainingTurns, active }) => ({ id, ownerId, remainingTurns, active })), [
    { id: 5, ownerId: 42, remainingTurns: 10, active: false },
    { id: 6, ownerId: 42, remainingTurns: 600, active: false },
])
assert.deepEqual(advanceAbilityDurations(importedAbilities), importedAbilities, 'Inactive abilities must not count down')
const activated = activateAbility(importedAbilities[0])
assert.equal(activated.active, true)
assert.equal(activated.remainingTurns, 10)
assert.equal(importedAbilities[0].active, false, 'Activation must not mutate the old state')
assert.deepEqual(activateAbility(activated), activated, 'Repeated activation must never toggle off or reset duration')
const counted = advanceAbilityDurations([activated])[0]
assert.equal(counted.remainingTurns, 9)
assert.deepEqual(activateAbility(counted), counted, 'Repeated activation after a round must not refill the duration')
assert.equal(activateAbility({ ...importedAbilities[0], ownerId: null }).active, false)
assert.equal(activateAbility({ ...importedAbilities[0], remainingTurns: 0 }).active, false)
assert.equal(activateAbility({ ...importedAbilities[0], name: ' ' }).active, false)
const secondImport = abilitiesFromSheet(sheetWithAbilities, 43, 7)
assert.equal(secondImport[0].ownerId, 43)
assert.equal(new Set([...importedAbilities, ...secondImport].map(({ id }) => id)).size, 4)
const snapshot = turnFromSheet(sheetWithAbilities, 42)
snapshot.sheet.abilities[0].name = 'Modificata'
assert.equal(sheetWithAbilities.abilities[0].name, 'Scudo', 'Sheet ability templates must remain independent of combat')
const removalSample = [
    { ...activated, id: 50, ownerId: 42, remainingTurns: 5 },
    { ...importedAbilities[1], id: 51, ownerId: 42 },
    { ...activated, id: 52, ownerId: 43, remainingTurns: 3 },
    { ...activated, id: 53, ownerId: null, remainingTurns: 2 },
]
const kept = removeParticipantAbilities(removalSample, [42], false)
assert.equal(kept.length, 4)
assert.deepEqual(kept.map(({ ownerId }) => ownerId), [null, null, 43, null])
assert.equal(kept[0].active, true, 'Keeping abilities must preserve activation')
assert.equal(kept[0].remainingTurns, 5, 'Keeping abilities must preserve the remaining duration')
assert.equal(advanceAbilityDurations(kept)[0].remainingTurns, 4, 'Kept active abilities must still count down')
assert.equal(removalSample[0].ownerId, 42, 'Removal must not mutate the old state')
assert.deepEqual(removeParticipantAbilities(removalSample, [42], true).map(({ id }) => id), [52, 53])
assert.deepEqual(removeParticipantAbilities(removalSample, [42, 43], true).map(({ id }) => id), [53])
assert.deepEqual(removeParticipantAbilities(removalSample, [], true), removalSample)
console.log('Combat, ability and character sheet checks passed')
