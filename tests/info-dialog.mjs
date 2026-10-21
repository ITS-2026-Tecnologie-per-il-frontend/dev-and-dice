import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

registerHooks({ resolve(specifier,context,nextResolve) {
    if(specifier==='react'&&context.parentURL?.endsWith('/src/components/InfoButton.tsx'))return {url:'test:info-react',shortCircuit:true}
    return nextResolve(specifier,context)
},load(url, context, nextLoad) {
    if(url==='test:info-react')return {format:'module',shortCircuit:true,source:`export {useEffect,useId,useRef} from ${JSON.stringify(import.meta.resolve('react'))}; export function useState(initial) {return [globalThis.infoDialogOpen??initial,()=>{}]}`}
    if (!url.endsWith('/src/components/InfoButton.tsx')) return nextLoad(url, context)
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText }
} })
const { InfoButton } = await import('../src/components/InfoButton.tsx')
const database = JSON.parse(readFileSync(new URL('../public/data/database.json', import.meta.url), 'utf8'))
const creature = database.creatures.find((entry) => entry.name === 'Aboleth')
const props = { name: creature.name, entry: { type: 'creature', data: creature, description: creature.description, label: 'Mostro', sourceUrl: creature.sourceUrl } }
const closed=renderToStaticMarkup(createElement(InfoButton,props))
assert(closed.includes('Altro su Aboleth')&&!closed.includes('Nube di Muco'),'Closed dialogs keep their trigger without building details')
globalThis.infoDialogOpen=true
const markup = renderToStaticMarkup(createElement(InfoButton, props))
assert.ok(markup.includes('info-scores'))
assert.ok(markup.includes('21 (+5)'))
assert.ok(markup.indexOf('Dati principali') < markup.indexOf('info-ability-sections'))
assert.ok(!markup.includes('<details') && !markup.includes('Scheda completa e abilità'), 'Creature sections must be visible without opening a dropdown')
assert.ok(markup.includes('Nube di Muco'), 'The complete creature description must remain accessible')
const panels = [...markup.matchAll(/<section class="info-section info-panel"[^>]*><h3>(.*?)<\/h3><p class="info-description">([\s\S]*?)<\/p><\/section>/g)]
assert.deepEqual(panels.map((panel) => panel[1]), ['Abilità', 'Azioni leggendarie', 'Azioni'])
const columns = [...markup.matchAll(/<div class="info-ability-column">([\s\S]*?)<\/div>/g)]
assert.equal(columns.length, 2)
assert.ok(columns[0][1].includes('<h3>Abilità</h3>') && columns[0][1].includes('<h3>Azioni leggendarie</h3>') && !columns[0][1].includes('<h3>Azioni</h3>'), 'Legendary actions must follow abilities in an independent column')
assert.ok(columns[1][1].includes('<h3>Azioni</h3>'))
assert.ok(panels[0][2].includes('Nube di Muco') && !panels[0][2].includes('Multiattacco'))
assert.ok(panels[2][2].includes('Multiattacco') && !panels[2][2].includes('Risucchio Psichico'))
assert.ok(panels[1][2].includes('Risucchio Psichico') && panels[1][2].includes('può effettuare 3 azioni leggendarie'), 'Legendary instructions must stay with the legendary actions')
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
const reference = JSON.parse(readFileSync(new URL('../public/data/rules2014/verified-reference.json', import.meta.url), 'utf8'))
for (const [name, index] of [['Protezione dal Bene e dal Male', 'protection-from-evil-and-good'], ['Palla di Fuoco', 'fireball'], ['Dardo Incantato', 'magic-missile']]) {
    const spell = database.spells.find(spell => spell.name === name)
    const verified = reference.entities.find(entity => entity.id === 'phb2014:spell:' + index)
    const html = renderToStaticMarkup(createElement(InfoButton, { name, fields: { duration: 'Senza conteggio' }, entry: { ...props.entry, type: 'ability', data: { ...spell, edition: '2014', mechanics: verified.mechanics, ruleSources: 'Manuale · PDF 204', aliases: ['Hidden alias'], referenceId: verified.id }, description: spell.description } }))
    const primary = html.match(/aria-label="Dati principali">([\s\S]*?)<\/section>/)[1]
    assert.deepEqual([...primary.matchAll(/<dt>(.*?)<\/dt>/g)].map(match => match[1]), ['Tempo di lancio', 'Componenti', 'Durata', 'Gittata', 'Livello', 'Rituale', 'Scuola', 'Concentrazione', 'Tipo', 'Danno', 'Effetto'])
    assert(primary.includes('<div class="info-wide"><dt>Effetto</dt>'), 'Even a short effect spans the whole grid')
    assert(!primary.includes('<div class="info-wide"><dt>Componenti'), 'Long material requirements keep their place in the first row')
    assert.equal(html.split(spell.sections.Effetto).length, 2, 'The effect is never repeated below the summary')
    assert(!html.includes('Hidden alias') && !html.includes(verified.id), 'Implementation metadata must not fill the spell detail')
    assert(html.indexOf('Effetto</dt>') < html.indexOf('Altri dettagli e fonti'))
    assert(primary.includes(`Concentrazione</dt><dd>${verified.mechanics.concentration ? 'Sì' : 'No'}</dd>`))
    assert(primary.includes(`Durata</dt><dd>${spell.duration}</dd>`), 'The spell duration takes precedence over the tracker timer label')
    if (index === 'fireball') assert(primary.includes('Tipo</dt><dd>Fuoco</dd>') && primary.includes('8d6 fuoco per creatura') && primary.includes('Slot superiori: +1d6'))
    if (index === 'magic-missile') assert(primary.includes('Danno</dt><dd>1d4 + 1 forza per dardo') && primary.includes('Da verificare con il DM'), 'Per-dart damage and the unresolved interpretation must retain their meaning')
    if (index === 'protection-from-evil-and-good') assert(primary.includes('Danno</dt><dd>Nessuno</dd>'))
}
const revised = renderToStaticMarkup(createElement(InfoButton, { name: 'Palla di Fuoco 2024', entry: { ...props.entry, type: 'ability', data: { id: 'fireball', level: 3, edition: '2024', referenceId: 'phb2014:spell:fireball' }, description: 'Un effetto differente.' } }))
assert(revised.includes('Da verificare: sintesi del danno non disponibile per questa edizione.') && !revised.includes('8d6 fuoco'), 'A 2024 spell never borrows a 2014 damage summary')
console.log('Info dialog checks passed: ordered spell fields, full-width effect without duplicates, concentration/damage, secondary sources, creature statistics and full descriptions')
