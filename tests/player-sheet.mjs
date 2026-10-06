import assert from 'node:assert/strict'
import { newCharacterSheet, parseCharacterSheets, turnFromSheet } from '../src/utils/CharacterSheets.ts'

const oldSheet = { ...newCharacterSheet(), name: 'Personaggio precedente', kind: 'PG' }
assert.deepEqual(parseCharacterSheets(JSON.stringify([oldSheet])), [oldSheet], 'Existing sheets must load without player details')
const sheet = {
    ...oldSheet,
    hitPoints: '24',
    playerDetails: {
        playerName: 'Giocatore', maxHitPoints: '30', 'save.strength.proficient': 'true',
        'skill.Arcano.expertise': 'true', 'inventory.0.0': 'Spada', 'inventory.0.1': '1.5',
        'spell.1.0.name': 'Scudo', 'spell.1.0.prepared': 'true', 'slots.1.total': '4', 'slots.1.used': '1',
    },
}
assert.deepEqual(parseCharacterSheets(JSON.stringify([sheet])), [sheet], 'All three pages must survive saving and reloading')
const turn = turnFromSheet(sheet, 7)
assert.equal(turn.hitPoints, '24', 'Combat must use current HP, not maximum HP')
assert.deepEqual(turn.sheet.playerDetails, sheet.playerDetails, 'Player details must survive adding the sheet to combat')
for (const playerDetails of [null, [], { level: 5 }, { proficient: true }]) {
    assert.throws(() => parseCharacterSheets(JSON.stringify([{ ...oldSheet, playerDetails }])), 'Invalid new fields must not silently corrupt saved sheets')
}
console.log('Player sheet checks passed: legacy compatibility, three-page persistence, combat HP and data validation')
