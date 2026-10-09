import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { randomCharacter } from '../src/utils/RandomCharacter.ts'
import { newTutorial, tutorialStep, tutorialIssues } from '../src/utils/CharacterTutorial.ts'
import { applyCreation, withWizardCatalog } from '../src/utils/PlayerCreation.ts'

// Exercise the component's real event handlers. This does not simulate a browser DOM.
registerHooks({
    resolve(specifier,context,next) {
        if (specifier==='react' && context.parentURL?.endsWith('/components/CharacterTutorial.tsx')) return {url:'test:tutorial-hooks',shortCircuit:true}
        if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) for (const extension of ['.ts','.tsx']) {
            const url=new URL(specifier+extension,context.parentURL)
            if (existsSync(fileURLToPath(url))) return next(url.href,context)
        }
        return next(specifier,context)
    },
    load(url,context,next) {
        if (url==='test:tutorial-hooks') return {format:'module',shortCircuit:true,source:`
            export const useMemo=create=>create(); export const useId=()=>"tutorial-test";
            export const useRef=()=>({current:null}); export const useEffect=()=>{};
        `}
        if (url.endsWith('.css')) return {format:'module',shortCircuit:true,source:''}
        if (url.endsWith('.tsx')) return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText}
        return next(url,context)
    },
})
const {CharacterTutorial}=await import('../src/components/CharacterTutorial.tsx')
const json=name=>JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'))
const data=withWizardCatalog({...json('character-options'),...json('character-equipment'),skills:json('character-rules').skills},json('wizard-catalog'))
let sheet=newTutorial(),nodes=[]
function render() {
    nodes=[]
    function visit(node) {if (Array.isArray(node)) {node.forEach(visit);return} if (!node || typeof node!=='object') return;nodes.push(node);visit(node.props?.children)}
    visit(CharacterTutorial({sheet,data,onChange(next){sheet=applyCreation(next,data)}}))
}
function button(text) {return nodes.find(node=>node.type==='button' && node.props.children===text)}
function change(name,value) {nodes.find(node=>node.props?.name===name).props.onChange({target:{value}});render()}
render()
assert.equal(button('Continua').props.disabled,true)
change('name','Elara');change('rules.edition','2014')
assert.equal(button('Continua').props.disabled,false)
button('Continua').props.onClick();render()
assert.equal(tutorialStep(sheet),1)
button('Indietro').props.onClick();render()
assert.equal(tutorialStep(sheet),0)
assert.equal(sheet.name,'Elara')
sheet=randomCharacter(data,{characterClass:'wizard',race:'human'},()=>.42)
sheet={...sheet,playerDetails:{...sheet.playerDetails,'tutorial.step':'8'}};render()
const before=JSON.stringify({...sheet,playerDetails:{...sheet.playerDetails,'tutorial.step':'2'}})
nodes.find(node=>node.props?.['aria-label']==='Modifica origine e background').props.onClick();render()
assert.equal(tutorialStep(sheet),2)
assert.equal(JSON.stringify(sheet),before,'Summary navigation changes only the saved step')
const nav=nodes.find(node=>node.type==='nav')
nav.props.children.props.children[6].props.children.props.onClick();render()
assert.equal(tutorialStep(sheet),6)
const root='spell.1.0',name=sheet.playerDetails[`${root}.name`]
function spellToggle() {
    return nodes.find(node=>node.type==='label' && node.props.children?.[1]?.type==='span' && node.props.children[1].props.children===name).props.children[0]
}
assert.equal(spellToggle().props.checked,true)
spellToggle().props.onChange();render()
assert.ok(!sheet.playerDetails[`${root}.name`])
spellToggle().props.onChange();render()
assert.equal(sheet.playerDetails[`${root}.name`],name)
assert.equal(sheet.playerDetails[`${root}.source`],'class')
const prepare=nodes.find(node=>node.props?.name===`${root}.prepared`)
prepare.props.onChange({target:{checked:true}});render()
assert.equal(sheet.playerDetails[`${root}.prepared`],'true')
assert.deepEqual(tutorialIssues(sheet,data,6),[])
console.log('Tutorial events passed: inline field edits, Continue/Back, summary correction, nine-step navigation, spell removal/reselection and preparation; original sheet data retained.')
