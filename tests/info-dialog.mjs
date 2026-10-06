import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

registerHooks({ load(url, context, nextLoad) {
    if (!url.endsWith('/src/components/InfoButton.tsx')) return nextLoad(url, context)
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText }
} })
const { InfoButton } = await import('../src/components/InfoButton.tsx')
const database = JSON.parse(readFileSync(new URL('../public/data/database.json', import.meta.url), 'utf8'))
const creature = database.creatures.find((entry) => entry.name === 'Aboleth')
const props = { name: creature.name, entry: { type: 'creature', data: creature, description: creature.description, label: 'Mostro', sourceUrl: creature.sourceUrl } }
const markup = renderToStaticMarkup(createElement(InfoButton, props))
assert.ok(markup.includes('info-scores'))
assert.ok(markup.includes('21 (+5)'))
assert.ok(markup.indexOf('Dati principali') < markup.indexOf('info-ability-sections'))
assert.ok(!markup.includes('<details') && !markup.includes('Scheda completa e abilità'), 'Creature sections must be visible without opening a dropdown')
assert.ok(markup.includes('Nube di Muco'), 'The complete creature description must remain accessible')
const panels = [...markup.matchAll(/<section class="info-section info-panel"[^>]*><h3>(.*?)<\/h3><p class="info-description">([\s\S]*?)<\/p><\/section>/g)]
assert.deepEqual(panels.map((panel) => panel[1]), ['Abilità', 'Azioni', 'Azioni leggendarie'])
assert.ok(panels[0][2].includes('Nube di Muco') && !panels[0][2].includes('Multiattacco'))
assert.ok(panels[1][2].includes('Multiattacco') && !panels[1][2].includes('Risucchio Psichico'))
assert.ok(panels[2][2].includes('Risucchio Psichico') && panels[2][2].includes('può effettuare 3 azioni leggendarie'), 'Legendary instructions must stay with the legendary actions')
const descriptionMarkup = panels.map((panel) => panel[2]).join('\n')
assert.ok(!descriptionMarkup.includes('Classe Armatura'))
assert.ok(!descriptionMarkup.includes('135 (18d10 + 36)'))
assert.ok(!descriptionMarkup.includes('Caratteristica | Punteggio | Modificatore'))
assert.ok(!descriptionMarkup.includes('Forza | 21 | +5'))
assert.ok(descriptionMarkup.includes('Nube di Muco'))
assert.ok(markup.includes('135 (18d10 + 36)'), 'Statistics must remain visible above the description')
const initiativeMarkup = renderToStaticMarkup(createElement(InfoButton, { ...props, fields: { initiativeModifier: '-1', initiative: '17' } }))
assert.ok(initiativeMarkup.includes('Modificatore iniziativa</dt><dd>-1</dd>'))
assert.ok(initiativeMarkup.includes('Iniziativa inserita</dt><dd>17</dd>'), 'The rolled initiative and the reference modifier must both be visible')
const variant = database.creatures.find((entry) => entry.name === 'Mezzodrago Rosso Veterano')
const variantMarkup = renderToStaticMarkup(createElement(InfoButton, { name: variant.name, entry: { ...props.entry, data: variant, description: variant.description } }))
assert.ok(variantMarkup.includes('I mezzi draghi ottengono vista cieca'), 'Different variant rules must not be removed as duplicate statistics')
const spell = database.spells[0]
const spellMarkup = renderToStaticMarkup(createElement(InfoButton, { name: spell.name, entry: { ...props.entry, type: 'ability', data: spell, description: spell.description } }))
assert.ok(spellMarkup.includes('info-prose'))
assert.equal(spellMarkup.split(spell.sections.Effetto).length, 2, 'Spell effects should be rendered once in their own section')
console.log('Info dialog checks passed: stat grid, modifiers, readable sections and full descriptions')
