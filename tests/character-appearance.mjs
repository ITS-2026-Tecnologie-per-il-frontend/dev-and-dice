import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { newCharacterSheet, parseCharacterSheets, turnFromSheet } from '../src/utils/CharacterSheets.ts'
import { appearanceFields } from '../src/utils/CharacterAppearance.ts'
import { characterFieldValue, updateCharacterField, withWizardCatalog } from '../src/utils/PlayerCreation.ts'

const legacy = {
    ...newCharacterSheet(), name: 'Mago di prova', characterClass: 'Mago',
    playerDetails: { age: '37', height: '178 cm', weight: '72 kg', skin: 'Olivastra', eyes: 'Verdi', hair: 'Rossi', appearance: 'Un mantello blu e un viso lentigginoso.' },
}
for (const { key, legacy: oldKey } of appearanceFields) {
    assert.equal(characterFieldValue(legacy,key),legacy.playerDetails[oldKey],'Existing tutorial drafts must populate sheet fields')
    const edited = updateCharacterField(legacy,key,'Valore modificato')
    assert.equal(characterFieldValue(edited,key),'Valore modificato')
    assert.equal(characterFieldValue(edited,oldKey),'Valore modificato','Legacy access must see the edited value')
    assert.equal(characterFieldValue(updateCharacterField(edited,key,''),key),'','Clearing must not restore a legacy value')
    assert.equal(edited.playerDetails[oldKey],undefined)
    assert.equal(legacy.playerDetails[key],undefined,'Reading/editing must not mutate original saved data')
}
assert.equal(characterFieldValue(legacy,'appearanceDescription'),legacy.playerDetails.appearance)
assert.equal(characterFieldValue(updateCharacterField(legacy,'appearanceDescription',''),'appearanceDescription'),'')
const canonical = appearanceFields.reduce((sheet,{legacy: oldKey}) => updateCharacterField(sheet,oldKey,legacy.playerDetails[oldKey]),legacy)
assert.deepEqual(turnFromSheet(canonical,1).sheet.playerDetails,canonical.playerDetails)

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
    const { PlayerSheet } = await server.ssrLoadModule('/src/components/PlayerSheet.tsx')
    const json = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'))
    const data = withWizardCatalog({...json('character-options'),...json('character-equipment'),skills:json('character-rules').skills},json('wizard-catalog'))
    for (const source of [legacy,canonical]) {
        const sheet = {...source,playerDetails:{...source.playerDetails,'tutorial.active':'true','tutorial.step':'7'}}
        const html = renderToStaticMarkup(createElement(PlayerSheet,{sheet,creationData:data,onChange:()=>{}}))
        for (const {legacy: oldKey} of appearanceFields) assert.ok(html.includes(`value="${legacy.playerDetails[oldKey]}"`),`Tutorial must show ${oldKey} from both old and current sheets`)
        assert.ok(html.includes(legacy.playerDetails.appearance),'Tutorial must retain old appearance descriptions')
    }
    for (const template of ['generic','wizard','wizard-pdf']) for (const source of [legacy,canonical]) {
        const sheet = parseCharacterSheets(JSON.stringify([{...source,playerDetails:{...source.playerDetails,'sheet.template':template}}]))[0]
        const html = renderToStaticMarkup(createElement(PlayerSheet,{sheet,exportPage:1,onChange:()=>{}}))
        for (const {legacy: oldKey} of appearanceFields) assert.ok(html.includes(`value="${legacy.playerDetails[oldKey]}"`),`${template} page two must show ${oldKey} from both tutorial and manual creation`)
        assert.ok(html.includes(legacy.playerDetails.appearance),`${template} must retain the appearance description`)
    }
} finally { await server.close() }
console.log('Appearance checks passed: existing drafts, shared edits, clearing, persistence, combat and actual second-page rendering for all three templates.')
