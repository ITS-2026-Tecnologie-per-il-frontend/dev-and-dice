import assert from 'node:assert/strict'
import { creatureAbilitySections, formatWeight, inventoryTotalWeight, newCharacterSheet, parseCharacterSheets, turnFromSheet } from '../src/utils/CharacterSheets.ts'
import { validateSheet } from '../server/games.mjs'

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
for (const [quantity, weight, total] of [
    ['3', '1.25', '3.75'], ['', '1.25', '1.25'], ['  ', '1,25', '1.25'],
    ['0', '1.25', '0'], ['3', '0', '0'], ['3', '0.1', '0.3'], ['3', '', ''],
    ['-1', '2', ''], ['1.5', '2', ''], ['3', '-2', ''], ['3', 'testo', ''], ['3', '1e308', ''],
]) assert.equal(inventoryTotalWeight(quantity, weight), total, `Inventory total for quantity ${quantity} and weight ${weight}`)
for (const [weight, display] of [['0.45359237','0,45'], ['1,239','1,24'], ['1234.567','1234,57'], ['0.004','0'], ['0','0'], ['1.2','1,2'], ['',''], ['  ','  '], ['invalid','invalid'], ['Infinity','Infinity']]) {
    assert.equal(formatWeight(weight), display)
}
assert.equal(formatWeight(inventoryTotalWeight('100', '0.004')), '0,4', 'Round after calculating totals, keeping small item weights')
for (const section of Object.keys(creatureAbilitySections)) {
    const monster={...oldSheet,kind:'Mostro',abilities:[{name:'Morso',duration:'Senza conteggio',description:'Attacco in mischia',section}],playerDetails:{'monster.size':'Grande','monster.languages':'Goblin'}}
    assert.deepEqual(parseCharacterSheets(JSON.stringify([monster]))[0],monster)
    assert.deepEqual(validateSheet(monster),monster,'The server retains creature sections and custom statistics')
}
for (const section of ['invalid',42,null]) {
    const monster={...oldSheet,abilities:[{name:'Morso',duration:'Senza conteggio',section}]}
    assert.throws(()=>parseCharacterSheets(JSON.stringify([monster])))
    assert.throws(()=>validateSheet(monster))
}
console.log('Player sheet checks passed: persistence, combat HP, data validation and automatic inventory weights')
