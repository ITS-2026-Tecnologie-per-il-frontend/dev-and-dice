import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { newTutorial, changeTutorialOrigin, tutorialIssues, parseTutorialDraft, tutorialSteps } from '../src/utils/CharacterTutorial.ts'
import { randomCharacter } from '../src/utils/RandomCharacter.ts'
import { withWizardCatalog } from '../src/utils/PlayerCreation.ts'
import { tutorialReview, tutorialFieldFeedback } from '../src/utils/TutorialReview.ts'

const json=(name)=>JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'))
const data=withWizardCatalog({...json('character-options'),...json('character-equipment'),skills:json('character-rules').skills},json('wizard-catalog'))
function seeded(seed) {return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32}}
const wizard=randomCharacter(data,{characterClass:'wizard',race:'human'},seeded(42))
const advanced=randomCharacter(data,{characterClass:'wizard',race:'elf',level:17},seeded(43))
const ranger=randomCharacter(data,{characterClass:'ranger',race:'human'},seeded(44))
const rules2024=changeTutorialOrigin(wizard,data,'edition','2024')
const legacy={...wizard,playerDetails:Object.fromEntries(Object.entries(wizard.playerDetails).filter(([key])=>!/^spell\..*\.index$/.test(key)))}
const cases=[newTutorial(),wizard,advanced,ranger,rules2024,legacy]
for (const sheet of cases) {
    const before=JSON.stringify(sheet),review=tutorialReview(sheet,data)
    assert.equal(review.length,9)
    review.forEach((issues,step)=>assert.deepEqual(issues,tutorialIssues(sheet,data,step),'Progress must reuse existing rules, including final validation'))
    assert.equal(JSON.stringify(sheet),before,'Review cannot change saved data')
    assert.deepEqual(parseTutorialDraft(before),sheet,'Existing drafts retain the same schema')
}
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try {
    const {CharacterTutorial}=await server.ssrLoadModule('/src/components/CharacterTutorial.tsx')
    const {PlayerSheet}=await server.ssrLoadModule('/src/components/PlayerSheet.tsx')
    const actions=createElement('div',null,createElement('button',{type:'button'},'Salva e riprendi più tardi'),createElement('button',{type:'button'},'Cancella'))
    function render(sheet,step) {
        const current={...sheet,playerDetails:{...sheet.playerDetails,'tutorial.step':String(step)}}
        const markup=renderToStaticMarkup(createElement(CharacterTutorial,{sheet:current,data,onChange(){}},actions))
        const nav=markup.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0]
        assert.equal((nav.match(/<button\b/g)||[]).length,9,'All nine steps, including previous ones, stay accessible')
        assert.equal((nav.match(/aria-current="step"/g)||[]).length,1)
        assert.ok(markup.includes(`max="9" value="${step+1}"`))
        const ids=new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((m)=>m[1]))
        assert.equal([...markup.matchAll(/\bid="([^"]+)"/g)].length,ids.size,'No duplicate IDs')
        for (const [,references] of markup.matchAll(/aria-(?:describedby|labelledby)="([^"]+)"/g)) for (const id of references.split(' ')) assert.ok(ids.has(id),`Missing accessible description ${id}`)
        const issues=tutorialIssues(current,data,step)
        const primary=markup.match(/<button[^>]+class="tutorial-primary"[^>]*>/)?.[0]
        assert.equal(primary.includes('disabled=""'),issues.length>0,'Continue/save keeps the original validation')
        assert.ok(markup.includes('Salva e riprendi più tardi') && markup.includes('Cancella'))
        return markup
    }
    for (const sheet of cases) for (let step=0;step<tutorialSteps.length;step++) render(sheet,step)
    const blank=render(newTutorial(),0)
    const nameInput=[...blank.matchAll(/<input\b[^>]*>/g)].find(([tag])=>tag.includes('name="name"'))?.[0]
    assert.ok(nameInput?.includes('aria-invalid="true"') && nameInput.includes('aria-describedby='))
    assert.ok(blank.includes('Obbligatorio') && blank.includes('Facoltativo'))
    const languages=render(rules2024,4)
    for (const key of ['tutorial.language.0','tutorial.language.1','additionalTraits','tutorial.rules2024']) assert.ok(tutorialFieldFeedback(tutorialIssues(rules2024,data,4),rules2024,data,4)[key]?.length)
    assert.ok(languages.includes('aria-invalid="true"'))
    const summary=render(wizard,8)
    assert.equal((summary.match(/aria-label="Modifica /g)||[]).length,8,'Every summary topic links to its own step')
    assert.ok(summary.includes('Valori calcolati') && summary.includes('Aspetto e personalità') && summary.includes(wizard.playerDetails['appearance.Occhi']))
    const composed=renderToStaticMarkup(createElement(PlayerSheet,{sheet:wizard,creationData:data,onChange(){}},actions))
    assert.ok(composed.includes('character-tutorial') && composed.includes('Salva e riprendi più tardi'),'Random review receives the same footer actions through PlayerSheet')
    const loading=renderToStaticMarkup(createElement(PlayerSheet,{sheet:wizard,onChange(){}},actions))
    assert.ok(loading.includes('Caricamento delle opzioni') && loading.includes('Salva e riprendi più tardi') && loading.includes('Cancella'),'Draft actions remain accessible before the catalog loads')
    console.log('Tutorial interface passed: 54 step renders, unchanged validation/schema, error references, nine-step navigation, summary links, 2014/2024, legacy drafts and random review.')
} finally {await server.close()}
