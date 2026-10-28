import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { newTutorial, changeTutorialOrigin, tutorialChoices, tutorialIssues, parseTutorialDraft, tutorialStepOrder, tutorialSteps } from '../src/utils/CharacterTutorial.ts'
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
        const activeStep=step===4||step===5?1:step
        const nav=markup.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0]
        assert.equal((nav.match(/<button\b/g)||[]).length,7,'Only the seven current steps are navigable')
        assert.ok(!nav.includes('Competenze e lingue')&&!nav.includes('Equipaggiamento'),'Retired steps stay out of navigation')
        assert.equal((nav.match(/aria-current="step"/g)||[]).length,1)
        assert.ok(markup.includes(`max="7" value="${tutorialStepOrder.indexOf(activeStep)+1}"`))
        const ids=new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((m)=>m[1]))
        assert.equal([...markup.matchAll(/\bid="([^"]+)"/g)].length,ids.size,'No duplicate IDs')
        for (const [,references] of markup.matchAll(/aria-(?:describedby|labelledby)="([^"]+)"/g)) for (const id of references.split(' ')) assert.ok(ids.has(id),`Missing accessible description ${id}`)
        const issues=tutorialIssues(current,data,activeStep)
        const primary=markup.match(/<button[^>]+class="tutorial-primary"[^>]*>/)?.[0]
        assert.equal(primary.includes('disabled=""'),issues.length>0,'Continue/save keeps the original validation')
        assert.ok(markup.includes('Salva e riprendi più tardi') && markup.includes('Cancella'))
        return markup
    }
    for (const sheet of cases) for (let step=0;step<tutorialSteps.length;step++) render(sheet,step)
    const dragonborn=changeTutorialOrigin(newTutorial(),data,'race','dragonborn')
    const ancestry=render(dragonborn,2)
    assert.ok(ancestry.includes('Discendenza Draconica') && ancestry.includes('name="choice.trait.draconic-ancestry.ancestry"'))
    assert.ok(!render(dragonborn,4).includes('Draconic Ancestry'), 'Draconic ancestry belongs to origins, not competencies')
    assert.deepEqual(tutorialStepOrder.slice(0,3),[0,2,1], 'Origins precedes class and level in the visible flow')
    let organized=newTutorial()
    for (const [kind,value] of [['edition','2014'],['race','human'],['class','wizard'],['background','acolyte']]) organized=changeTutorialOrigin(organized,data,kind,value)
    const backgroundChoices=tutorialChoices(organized,data,2),classChoices=tutorialChoices(organized,data,1)
    assert.ok(backgroundChoices.some(({path,choice})=>path==='choice.background.acolyte.language' && choice.type==='languages'))
    assert.ok(backgroundChoices.some(({path,choice})=>path.startsWith('choice.background.acolyte.equipment.') && choice.type==='equipment'))
    assert.ok(classChoices.some(({path,choice})=>path==='choice.class.wizard.proficiency.0' && choice.type==='proficiencies'))
    assert.ok(classChoices.some(({path})=>path.startsWith('choice.class.wizard.equipment.')))
    assert.ok(!tutorialChoices(organized,data,4).some(({path})=>path.startsWith('choice.class.') || path.startsWith('choice.background.')))
    assert.ok(render(organized,2).includes('name="choice.background.acolyte.language.0"'), 'Background languages render in Origins')
    assert.ok(render(organized,2).includes('1 × Comune'), 'Language choice options render using Italian names')
    assert.ok(render(organized,2).includes('Lingue di origine: Comune'), 'Fixed race languages render using Italian names')
    const classPage=render(organized,1)
    assert.ok(classPage.includes('name="choice.class.wizard.proficiency.0.0"'), 'Class proficiencies render in Class and level')
    assert.ok(classPage.includes('Competenze di abilità: Mago'), 'The class skill category is shown in its choice title')
    assert.ok(classPage.includes('Dotazione iniziale') && classPage.includes('Inventario'), 'Equipment and inventory render in Class and level')
    assert.ok(render(organized,4).includes('Dotazione iniziale') && render(organized,5).includes('Dotazione iniziale'), 'Previous competency/equipment drafts resume in Class and level')
    const toolRef={index:'thieves-tools',name:'Thieves’ Tools',nameIt:'Attrezzi da ladro'}
    const toolChoice={choose:1,type:'proficiencies',desc:'Scegli una competenza: attrezzi',from:{option_set_type:'options_array',options:[{option_type:'reference',item:toolRef}]}}
    const toolData={...data,backgrounds:data.backgrounds.map((background)=>background.index==='acolyte'?{...background,proficiencies:[toolRef],proficiency_choices:toolChoice}:background)}
    const toolDraft=changeTutorialOrigin(newTutorial(),toolData,'background','acolyte')
    const toolDetails={...toolDraft.playerDetails,'choice.background.acolyte.proficiency.0.0':'0','tutorial.step':'2'}
    const toolMarkup=renderToStaticMarkup(createElement(CharacterTutorial,{sheet:{...toolDraft,playerDetails:toolDetails},data:toolData,onChange(){}},actions))
    assert.ok(toolMarkup.includes('Attrezzi, strumenti o veicoli: Attrezzi da ladro'), 'The background preview includes fixed tool proficiencies')
    assert.ok(toolMarkup.includes('name="choice.background.acolyte.proficiency.0.0"'), 'Background tool choices render in Origins')
    const blank=render(newTutorial(),0)
    const nameInput=[...blank.matchAll(/<input\b[^>]*>/g)].find(([tag])=>tag.includes('name="name"'))?.[0]
    assert.ok(nameInput?.includes('aria-invalid="true"') && nameInput.includes('aria-describedby='))
    assert.ok(blank.includes('Obbligatorio') && blank.includes('Facoltativo'))
    const languages=render(rules2024,2)
    for (const key of ['tutorial.language.0','tutorial.language.1','additionalTraits','tutorial.rules2024']) assert.ok(tutorialFieldFeedback(tutorialIssues(rules2024,data,2),rules2024,data,2)[key]?.length)
    assert.ok(languages.includes('aria-invalid="true"'))
    const summary=render(wizard,8)
    assert.equal((summary.match(/aria-label="Modifica /g)||[]).length,8,'Every summary topic links to its own step')
    assert.ok(summary.includes('Valori calcolati') && summary.includes('Aspetto e personalità') && summary.includes(wizard.playerDetails['appearance.Occhi']))
    const composed=renderToStaticMarkup(createElement(PlayerSheet,{sheet:wizard,creationData:data,onChange(){}},actions))
    assert.ok(composed.includes('character-tutorial') && composed.includes('Salva e riprendi più tardi'),'Random review receives the same footer actions through PlayerSheet')
    const loading=renderToStaticMarkup(createElement(PlayerSheet,{sheet:wizard,onChange(){}},actions))
    assert.ok(loading.includes('Caricamento delle opzioni') && loading.includes('Salva e riprendi più tardi') && loading.includes('Cancella'),'Draft actions remain accessible before the catalog loads')
    console.log('Tutorial interface passed: 54 step renders, seven-step navigation, background tool proficiencies, unchanged validation/schema, summary links, 2014/2024, legacy drafts and random review.')
} finally {await server.close()}
