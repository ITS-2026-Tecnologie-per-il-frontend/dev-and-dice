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

const { WizardSpellcasting } = await import('../src/components/WizardSpellcasting.tsx')
const wizard = enableCreation({ ...newCharacterSheet(), name: 'Mago', level: '20', intelligence: '16', playerDetails: { 'creation.class': 'wizard', 'creation.subclass': 'evocation' } }, data)
const wizardMarkup = renderToStaticMarkup(createElement(WizardSpellcasting, { sheet: wizard, data, onChange() {} }))
for (const text of ['Copia nel libro', 'Recupero Arcano', 'Spell Mastery', 'Signature Spells', 'Attiva Overchannel', 'Conferma lancio', 'Riposo breve']) assert.ok(wizardMarkup.includes(text), `Missing wizard control: ${text}`)
assert.equal(renderToStaticMarkup(createElement(WizardSpellcasting, { sheet, data, onChange() {} })), '', 'Wizard controls must not appear for other classes')
console.log('Wizard UI checks passed: book, recovery, advanced spell choices, casting and class gating.')
const { WizardAdvancement } = await import('../src/components/WizardSpellcasting.tsx')
const advancementMarkup = renderToStaticMarkup(createElement(WizardAdvancement, { sheet: wizard, onChange() {} }))
assert.ok(advancementMarkup.includes('Conferma avanzamento'))
assert.ok(advancementMarkup.includes('Già incluso nella scheda'))
assert.ok(wizardMarkup.includes('Ricostruisci dai preparati') && wizardMarkup.includes('Cantrip Formulas'))
const { withWizardCatalog } = await import('../src/utils/PlayerCreation.ts')
const { WizardSubclassFeatures } = await import('../src/components/WizardSubclassFeatures.tsx')
const expanded = withWizardCatalog(data,json('wizard-catalog'))
const specialist = (id,level=14) => enableCreation({ ...newCharacterSheet(),name:'Specialista',kind:'PG',level:String(level),intelligence:'16',playerDetails:{ 'creation.class':'wizard','creation.subclass':id } },expanded)
for (const subclass of expanded.subclasses.filter((x) => x.features)) {
    const rendered = renderToStaticMarkup(createElement(WizardSubclassFeatures,{ sheet:specialist(subclass.index),data:expanded,onChange(){} }))
    assert.ok(rendered.includes('Privilegi'))
    for (const feature of subclass.features.filter((x) => !x.choice)) assert.ok(rendered.includes(feature.name.replaceAll('&','&amp;').replaceAll("'",'&#x27;')), `Missing feature UI: ${feature.name}`)
}
const portentMarkup = renderToStaticMarkup(createElement(WizardSubclassFeatures,{sheet:specialist('wizard-divination'),data:expanded,onChange(){}}))
assert.equal((portentMarkup.match(/Usa questo risultato/g)||[]).length,3)
const choicesMarkup = renderToStaticMarkup(createElement(WizardSubclassFeatures,{sheet:specialist('wizard-mage-of-prismari-ua'),data:expanded,onChange(){}}))
for (const tier of [6,10,14]) assert.ok(choicesMarkup.includes(`Privilegio scelto al livello ${tier}`))
assert.equal(renderToStaticMarkup(createElement(WizardSubclassFeatures,{sheet,data:expanded,onChange(){}})),'')
console.log('Subclass UI checks passed: all 25 reviewed traditions, resources, Portent and Strixhaven choices.')
const wizardSheetMarkup = renderToStaticMarkup(createElement(PlayerSheet,{sheet:specialist('wizard-abjuration'),onChange(){}}))
for (const text of ['Modello della scheda','MAGO','Equipaggiamento indossato','Incantesimi preferiti','Privilegi della tradizione arcana','Slot incantesimo','templates/Mago.pdf']) assert.ok(wizardSheetMarkup.includes(text),`Missing wizard template field: ${text}`)
assert.equal((wizardSheetMarkup.match(/role="tab"/g)||[]).length,4)
const genericWizardMarkup = renderToStaticMarkup(createElement(PlayerSheet,{sheet:{...specialist('wizard-abjuration'),playerDetails:{...specialist('wizard-abjuration').playerDetails,'sheet.template':'generic'}},onChange(){}}))
assert.equal((genericWizardMarkup.match(/role="tab"/g)||[]).length,3)
assert.ok(!genericWizardMarkup.includes('Incantesimi preferiti'))
console.log('Template UI checks passed: class selection, four tabs, reference PDF and explicit generic override.')
