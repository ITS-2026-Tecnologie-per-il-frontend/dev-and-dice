import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'
import { enableCreation } from '../src/utils/PlayerCreation.ts'

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
            for (const extension of ['.ts', '.tsx']) {
                const url = new URL(specifier + extension, context.parentURL)
                if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
            }
        }
        return nextResolve(specifier, context)
    },
    load(url, context, nextLoad) {
        if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export {}' }
        if (!url.includes('/src/') || !url.endsWith('.tsx')) return nextLoad(url, context)
        return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext } }).outputText }
    },
})
const { CreationChoices, CreationStatus } = await import('../src/components/PlayerCreation.tsx')
const { PlayerSheet } = await import('../src/components/PlayerSheet.tsx')
const json = (file) => JSON.parse(readFileSync(new URL(`../public/data/${file}.json`, import.meta.url), 'utf8'))
const data = { ...json('character-options'), ...json('character-equipment'), skills: json('character-rules').skills }
const sheet = enableCreation({ ...newCharacterSheet(), name: 'Guerriero', strength: '15', dexterity: '10', constitution: '14', level: '1', playerDetails: {
    'creation.class': 'fighter', 'creation.race': 'human',
    'choice.class.fighter.equipment.1.0': '1',
    'choice.class.fighter.equipment.1.0.option.1.nested.0': '0',
} }, data)
const markup = renderToStaticMarkup(createElement(CreationChoices, { sheet, data, change() {} }))
assert.ok(markup.includes('Equipaggiamento iniziale'))
assert.ok(markup.includes('Dettaglio della scelta'))
assert.ok(markup.includes('Armatura indossata'))
assert.ok(!markup.includes('Vorpal'), 'Nested weapon categories must not offer magical items')
assert.ok(renderToStaticMarkup(createElement(CreationStatus, { sheet, enable() {}, disable() {} })).includes('Calcoli automatici attivi'))
const legacy = { ...newCharacterSheet(), name: 'PG precedente', race: 'Razza personale', characterClass: 'Classe personale' }
const legacyMarkup = renderToStaticMarkup(createElement(PlayerSheet, { sheet: legacy, onChange() {} }))
assert.ok(legacyMarkup.includes('Razza personale') && legacyMarkup.includes('Classe personale'), 'Legacy inputs must remain visible while catalogs load')
assert.ok(legacyMarkup.includes('player-paper-viewport'), 'Keep the existing reference sheet layout')
console.log('Creation UI checks passed: recursive equipment choices, mundane-only weapons and legacy manual fields.')
