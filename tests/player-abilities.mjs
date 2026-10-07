import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pdfAbilities, pdfCombatAbilities } from '../src/utils/PlayerAbilities.ts'
import { newCharacterSheet, parseCharacterSheets, importSheetAbility } from '../src/utils/CharacterSheets.ts'
import { activateAbility, advanceAbilityDurations } from '../src/utils/Combat.ts'
import { parseCatalog, sheetWithCombatAbilities, sheetWithCombatSpells } from '../src/utils/Catalog.ts'

const options = JSON.parse(readFileSync(new URL('../public/data/character-options.json', import.meta.url), 'utf8'))
const catalog = parseCatalog(JSON.parse(readFileSync(new URL('../public/data/database.json', import.meta.url), 'utf8')))
const feature = (id) => options.features.find((entry) => entry.index === id)
const block = (entry) => `${entry.name} (livello ${entry.level ?? 1})\n${entry.desc.join('\n')}`
const sheet = { ...newCharacterSheet(), name: 'Guerriero', playerDetails: {
    classFeatures: [feature('second-wind'), feature('action-surge-1-use'), feature('fighter-fighting-style-defense')].map(block).join('\n\n'),
    racialTraits: options.traits.filter((entry) => ['darkvision', 'dwarven-resilience'].includes(entry.index)).map(block).join('\n\n'),
    additionalTraits: 'Scatto magico\nCome azione bonus puoi muoverti di 3 metri.\n\nPrivilegio misterioso\nQuesto effetto dipende dal DM.',
} }
const results = pdfAbilities(sheet)
assert.ok(results.find((entry) => entry.name === 'Second Wind').activation === 'active')
assert.ok(results.find((entry) => entry.name === 'Action Surge (1 use)').activation === 'active')
assert.ok(results.find((entry) => entry.name === 'Scatto magico').activation === 'active')
assert.ok(results.find((entry) => entry.name === 'Darkvision').activation === 'passive')
assert.ok(!pdfCombatAbilities(sheet).some((entry) => entry.name === 'Fighting Style: Defense'), 'Choices made during character creation are not combat activations')
assert.ok(results.find((entry) => entry.name === 'Privilegio misterioso').activation === 'review')
const rageSheet = { ...sheet, playerDetails: { classFeatures: block(feature('rage')) } }
assert.equal(pdfCombatAbilities(rageSheet)[0].remainingTurns, 10, 'Rage has a reviewed duration of one minute')
const unknownTimer = { ...sheet, playerDetails: { classFeatures: 'Potere\nAs an action, heal a creature. You regain uses after a rest of 1 hour.' } }
assert.equal(pdfCombatAbilities(unknownTimer)[0].timed, false, 'Rest and resource costs must not be interpreted as effect durations')
const negated = { ...sheet, playerDetails: { classFeatures: "Divieto\nYou cannot use your reaction. Non puoi usare una azione bonus." } }
assert.equal(pdfAbilities(negated)[0].activation, 'review', 'Negated actions must not imply activation')
const review = results.find((entry) => entry.activation === 'review')
const confirmed = { ...sheet, playerDetails: { ...sheet.playerDetails, [review.key]: 'include' } }
assert.ok(pdfCombatAbilities(confirmed).some((entry) => entry.name === review.name))
const wind = results.find((entry) => entry.name === 'Second Wind')
const excluded = { ...sheet, playerDetails: { ...sheet.playerDetails, [wind.key]: 'exclude' } }
assert.ok(!pdfCombatAbilities(excluded).some((entry) => entry.name === 'Second Wind'))
const timed = { ...sheet, playerDetails: { ...sheet.playerDetails, [`${wind.key}.duration`]: 'Personalizzata', [`${wind.key}.turns`]: '3' } }
assert.equal(pdfCombatAbilities(timed).find((entry) => entry.name === 'Second Wind').remainingTurns, 3)
assert.deepEqual(parseCharacterSheets(JSON.stringify([confirmed]))[0], confirmed, 'Classification overrides must survive persistence')
const combat = sheetWithCombatAbilities(sheet, catalog)
assert.ok(combat.abilities.some((entry) => entry.name === 'Second Wind' && entry.description.includes('bonus action')))
assert.ok(!sheetWithCombatSpells(sheet, catalog).abilities.length, 'PDF features must stay in the abilities column, separate from magic')
assert.equal(sheet.abilities.length, 0, 'Reading PDF privileges must not duplicate them in saved manual templates')
const windIndex = combat.abilities.findIndex((entry) => entry.name === 'Second Wind')
const imported = importSheetAbility([], combat, 42, windIndex, 1)
const active = activateAbility(imported[0])
assert.equal(active.active, true)
assert.equal(active.timed, false)
assert.deepEqual(advanceAbilityDurations([active]), [active])
assert.ok(!pdfCombatAbilities({ ...sheet, kind: 'Mostro' }).length)
console.log('PDF ability checks passed: activation rules, passive traits, manual review, durations and untimed activation')
