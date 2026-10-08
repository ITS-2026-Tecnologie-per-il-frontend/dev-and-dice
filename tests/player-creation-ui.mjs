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
const creationDiviner = {...specialist('wizard-divination',2),playerDetails:{...specialist('wizard-divination',2).playerDetails,'tutorial.active':'true','wizard.portent.0':'14','wizard.portent.1':'14','wizard.portent.0.used':'true','wizard.portent.1.used':'true','choice.class.wizard.proficiency.0.0':'2'}}
const creationPortentMarkup = renderToStaticMarkup(createElement(WizardSubclassFeatures,{sheet:creationDiviner,data:expanded,onChange(){}}))
assert.ok(creationPortentMarkup.includes('Due risultati uguali sono validi'))
assert.equal((creationPortentMarkup.match(/value="14"/g)||[]).length,2)
assert.ok(!creationPortentMarkup.includes('disabled=""') && !creationPortentMarkup.includes('Usa questo risultato') && !creationPortentMarkup.includes('Consuma un uso'),'Creation can edit dice and cannot spend gameplay resources')
const duplicateSkillMarkup = renderToStaticMarkup(createElement(CreationChoices,{sheet:{...creationDiviner,playerDetails:{...creationDiviner.playerDetails,'creation.background':'acolyte'}},data:expanded,change(){},section:'choices'}))
assert.ok(duplicateSkillMarkup.includes('Questa abilità è già concessa'))
assert.ok(duplicateSkillMarkup.includes('Intuizione'))
const wizardSheetMarkup = renderToStaticMarkup(createElement(PlayerSheet,{sheet:specialist('wizard-abjuration'),onChange(){}}))
for (const text of ['Modello della scheda','MAGO','Equipaggiamento indossato','Incantesimi preferiti','Privilegi della tradizione arcana','Slot incantesimo','templates/Mago.pdf']) assert.ok(wizardSheetMarkup.includes(text),`Missing wizard template field: ${text}`)
assert.equal((wizardSheetMarkup.match(/role="tab"/g)||[]).length,4)
const genericWizardMarkup = renderToStaticMarkup(createElement(PlayerSheet,{sheet:{...specialist('wizard-abjuration'),playerDetails:{...specialist('wizard-abjuration').playerDetails,'sheet.template':'generic'}},onChange(){}}))
assert.equal((genericWizardMarkup.match(/role="tab"/g)||[]).length,3)
assert.ok(!genericWizardMarkup.includes('Incantesimi preferiti'))
console.log('Template UI checks passed: class selection, four tabs, reference PDF and explicit generic override.')
const leftStart = wizardSheetMarkup.indexOf('player-wizard-left')
const middleStart = wizardSheetMarkup.indexOf('player-wizard-middle')
const rightStart = wizardSheetMarkup.indexOf('player-wizard-right')
assert.ok(leftStart < middleStart && middleStart < rightStart)
const leftColumn = wizardSheetMarkup.slice(leftStart,middleStart)
const middleColumn = wizardSheetMarkup.slice(middleStart,rightStart)
assert.equal((leftColumn.match(/>Percezione passiva</g)||[]).length,1,'Passive perception must appear once in the wizard layout')
assert.ok(leftColumn.includes('Linguaggi, tratti e privilegi aggiuntivi'))
assert.ok(middleColumn.includes('Punti ferita attuali') && middleColumn.includes('Incantesimi preferiti'))
assert.ok(!middleColumn.includes('Equipaggiamento'),'Equipment must not displace the favourite spells')
assert.ok(wizardSheetMarkup.indexOf('Slot incantesimo',rightStart) > rightStart)
assert.ok(wizardSheetMarkup.includes('Regole e campi aggiuntivi'),'The extra wizard controls must remain accessible')
assert.equal(readFileSync(new URL('../public/templates/mago-equipaggiamento.jpg',import.meta.url)).subarray(0,2).toString('hex'),'ffd8','The original worn-equipment drawing must be included in the build')
console.log('Wizard layout checks passed: PDF column order, one perception field, combat/favourites, privileges/slots and original drawing.')
const pdfCopyMarkup = renderToStaticMarkup(createElement(PlayerSheet, { sheet: { ...specialist('wizard-abjuration'), playerDetails: { ...specialist('wizard-abjuration').playerDetails, 'sheet.template': 'wizard-pdf' } }, onChange() {} }))
assert.ok(pdfCopyMarkup.includes('player-paper-wizard-pdf'))
assert.ok(!wizardSheetMarkup.includes('player-paper-wizard-pdf'), 'Keep the original wizard appearance available')
const copyWithoutDefenses = pdfCopyMarkup.replace(/<div class="player-wizard-defenses">.*?<\/label><\/div><\/div>/, '').replace(/<section class="player-wizard-tradition-uses">.*?<\/section>/, '').replace(/<input\b[^>]*aria-label="Componente [MSV], incantesimo preferito \d+"[^>]*>/g, '')
assert.deepEqual(copyWithoutDefenses.match(/<(?:input|textarea|select)\b[^>]*>/g), wizardSheetMarkup.match(/<(?:input|textarea|select)\b[^>]*>/g), 'The copy must preserve the original controls alongside the new defense fields')
assert.ok(pdfCopyMarkup.includes('player-wizard-no-armor') && pdfCopyMarkup.includes('player-wizard-no-shield'))
assert.ok(!wizardSheetMarkup.includes('player-wizard-defenses'), 'Only the PDF-style copy adds the defense fields')
assert.ok(pdfCopyMarkup.includes('player-wizard-tradition-uses') && !wizardSheetMarkup.includes('player-wizard-tradition-uses'), 'The copy adds the tradition use counters alongside the existing limited-trait table')
assert.equal((pdfCopyMarkup.match(/aria-label="Componente [MSV], incantesimo preferito \d+"/g) || []).length, 21, 'Each of the seven favourite spells needs its three component markers')
const favouriteMarkup = renderToStaticMarkup(createElement(PlayerSheet, { sheet: { ...specialist('wizard-abjuration'), playerDetails: { ...specialist('wizard-abjuration').playerDetails, 'sheet.template': 'wizard-pdf', 'favoriteSpell.0.components': 'V, S, Muschio e sale', 'favoriteSpell.0.name': 'Incantesimo di prova', 'favoriteSpell.0.effect': 'Descrizione conservata' } }, onChange() {} }))
assert.ok(/aria-label="Componente S, incantesimo preferito 1" checked=""/.test(favouriteMarkup) && /aria-label="Componente V, incantesimo preferito 1" checked=""/.test(favouriteMarkup), 'Existing component abbreviations must populate the markers')
assert.ok(!/aria-label="Componente M, incantesimo preferito 1" checked=""/.test(favouriteMarkup), 'Component markers must not match letters inside notes')
assert.ok(favouriteMarkup.includes('value="V, S, Muschio e sale"') && favouriteMarkup.includes('Descrizione conservata'), 'Keep the existing notes and effect editable')
assert.equal((pdfCopyMarkup.match(/class="player-wizard-score-base"/g) || []).length, 6, 'Each primary ability needs its base badge')
assert.ok(!wizardSheetMarkup.includes('player-wizard-score-base'), 'Keep the original wizard ability blocks unchanged')
const baseBadgeSheet = { ...specialist('wizard-abjuration'), strength: '14', playerDetails: { ...specialist('wizard-abjuration').playerDetails, 'sheet.template': 'wizard-pdf', 'creation.base.strength': '12' } }
const baseBadgeMarkup = renderToStaticMarkup(createElement(PlayerSheet, { sheet: baseBadgeSheet, onChange() {} }))
assert.ok(baseBadgeMarkup.includes('aria-label="Valore base Forza">12<small>Base</small>'), 'The base badge must exclude automatic bonuses')
const manualBaseMarkup = renderToStaticMarkup(createElement(PlayerSheet, { sheet: { ...baseBadgeSheet, playerDetails: { ...baseBadgeSheet.playerDetails, 'creation.enabled': 'false' } }, onChange() {} }))
assert.ok(manualBaseMarkup.includes('aria-label="Valore base Forza">14<small>Base</small>'), 'Manual sheets use the current score as their base')
const defenseMarkup = renderToStaticMarkup(createElement(PlayerSheet, { sheet: { ...specialist('wizard-abjuration'), playerDetails: { ...specialist('wizard-abjuration').playerDetails, 'sheet.template': 'wizard-pdf', unarmoredAC: '13', unshieldedAC: '15', hitDice: '1d6', 'arcaneTradition.total': '3', 'arcaneTradition.used': '1' } }, onChange() {} }))
assert.ok(/player-wizard-no-armor.*?value="13"/.test(defenseMarkup) && /player-wizard-no-shield.*?value="15"/.test(defenseMarkup), 'The small shields must display the saved values')
assert.ok(/player-wizard-tradition-uses.*?value="3".*?value="1"/.test(defenseMarkup), 'The tradition counters must display their saved totals and uses')
assert.ok(defenseMarkup.includes('class="player-wizard-hit-die">d6<img'), 'The die badge abbreviates 1d6 without changing the stored value')
assert.ok(pdfCopyMarkup.includes('src="/templates/cornicetonda.svg"'), 'The PDF-style copy must use the supplied die frame')
assert.ok(!wizardSheetMarkup.includes('player-wizard-hit-die-frame'), 'The original wizard template keeps its existing die badge')
assert.equal((pdfCopyMarkup.match(/aria-label="Indebolimento: livello /g) || []).length, 6)
assert.ok(!wizardSheetMarkup.includes('player-wizard-exhaustion-levels'), 'The original wizard template must keep its existing controls')
const exhaustedMarkup = renderToStaticMarkup(createElement(PlayerSheet, { sheet: { ...specialist('wizard-abjuration'), playerDetails: { ...specialist('wizard-abjuration').playerDetails, 'sheet.template': 'wizard-pdf', exhaustion: '3' } }, onChange() {} }))
assert.equal((exhaustedMarkup.match(/aria-label="Indebolimento: livello \d+" aria-pressed="true"/g) || []).length, 3, 'The circles must reflect the saved exhaustion level')
const slotMarkup = renderToStaticMarkup(createElement(PlayerSheet, { sheet: { ...baseBadgeSheet, playerDetails: { ...baseBadgeSheet.playerDetails,
    'slots.1.total': '4', 'slots.1.used': '2', 'slots.9.total': '2',
    'spell.0.0.name': 'Light', 'spell.1.0.name': 'Shield', 'spell.1.0.prepared': 'true',
    'spell.1.1.name': 'Detect Magic', 'spell.1.1.prepared': 'false',
    'spell.1.2.name': 'Gift', 'spell.1.2.source': 'racial', 'spell.1.2.prepared': 'true',
} }, onChange() {} }))
assert.equal((slotMarkup.match(/aria-label="Slot livello \d, (?:totali|lanciati): \d"/g) || []).length, 44, 'Both grids must reproduce all circles in the PDF')
assert.equal((slotMarkup.match(/aria-label="Slot livello 1, totali: \d" aria-pressed="true"/g) || []).length, 4)
assert.equal((slotMarkup.match(/aria-label="Slot livello 1, lanciati: \d" aria-pressed="true"/g) || []).length, 2)
assert.ok(slotMarkup.includes('aria-label="Conteggio totale livello 9">2</small>'), 'Customized counts beyond the PDF grid must remain visible')
assert.ok(slotMarkup.includes('aria-label="Incantesimi preparati">1</output>') && slotMarkup.includes('aria-label="Trucchetti conosciuti">1</output>'), 'Counters must reflect the spell selections, excluding unprepared spells and racial grants')
assert.ok(slotMarkup.includes('Modifica conteggi'), 'Keep the original numeric slot fields available')
const combatSvg = readFileSync(new URL('../public/templates/mago-combattimento.svg', import.meta.url), 'utf8')
const pdfCss = readFileSync(new URL('../src/WizardPdf.css', import.meta.url), 'utf8')
for (const [, icon] of pdfCss.matchAll(/mago-combattimento\.svg#([a-z0-9-]+)/g)) assert.ok(combatSvg.includes(`<view id="${icon}"`), `Missing combat icon: ${icon}`)
const headerSvg = readFileSync(new URL('../public/templates/mago-testata.svg', import.meta.url), 'utf8')
for (const [, frame] of pdfCss.matchAll(/mago-testata\.svg#([a-z0-9-]+)/g)) assert.ok(headerSvg.includes(`<view id="${frame}"`), `Missing wizard header frame: ${frame}`)
assert.ok(!/<text\b/i.test(readFileSync(new URL('../public/templates/mago-scudo-vuoto.svg', import.meta.url), 'utf8')), 'Small shield backgrounds must not repeat their HTML labels')
console.log('PDF appearance checks passed: selectable copy, unchanged layout and original appearance preserved.')
