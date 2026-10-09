import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'
import { newTutorial, tutorialDraftKey } from '../src/utils/CharacterTutorial.ts'
import { withWizardCatalog } from '../src/utils/PlayerCreation.ts'

const hooks = { values: [], cursor: 0, effects: [] }
globalThis.dialogTestHooks = hooks
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'react' && /\/(CharacterSheets\.tsx|Dialog\.ts)$/.test(context.parentURL ?? '')) return { url: 'test:dialog-hooks', shortCircuit: true }
        if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
            for (const extension of ['.ts', '.tsx']) {
                const url = new URL(specifier + extension, context.parentURL)
                if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
            }
        }
        return nextResolve(specifier, context)
    },
    load(url, context, nextLoad) {
        if (url === 'test:dialog-hooks') return { format: 'module', shortCircuit: true, source: `
            const h = globalThis.dialogTestHooks;
            export function useState(initial) { const i = h.cursor++; if (!(i in h.values)) h.values[i] = typeof initial === 'function' ? initial() : initial; return [h.values[i], value => { h.values[i] = typeof value === 'function' ? value(h.values[i]) : value; }]; }
            export function useRef(initial) { const i = h.cursor++; return h.values[i] ??= { current: initial }; }
            export function useEffect(effect) { h.effects.push(effect); }
            export function useMemo(create) { return create(); }
            export function useCallback(callback) { return callback; }
            export function useImperativeHandle(ref, create) { if (ref) ref.current = create(); }
        ` }
        if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: '' }
        if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
            compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
        }).outputText }
        return nextLoad(url, context)
    },
})
const { CharacterSheets } = await import('../src/components/CharacterSheets.tsx')
const original = { ...newCharacterSheet(), name: 'Aria', hitPoints: '30' }
let stored = JSON.stringify([original]), progress = null, writes = 0, fail = false
const savedEvents = []
globalThis.localStorage = { getItem: (key) => key === tutorialDraftKey ? progress : stored, setItem: (key, value) => {
    if (fail) throw new Error('Quota exceeded')
    if (key === tutorialDraftKey) progress = value
    else { stored = value; writes++ }
}, removeItem: (key) => { if (key === tutorialDraftKey) progress = null } }
const ref = { current: null }
const props = { ref, onAdd() {}, onSaved: (sheet) => savedEvents.push(sheet), combatStarted: false, presentSheetIds: [], catalog: { creatures: [], abilities: [] } }
let nodes = [], sheetDialog, cleanups = []
function render() {
    cleanups.forEach((cleanup) => cleanup()); cleanups = []
    hooks.cursor = 0; hooks.effects = []; nodes = []
    function visit(node) {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) { node.forEach(visit); return }
        nodes.push(node)
        if (node.type === 'dialog') {
            node.props.ref.current ??= { open: false, showModal() { this.open = true }, close() { this.open = false }, getBoundingClientRect: () => ({ left: 10, right: 100, top: 10, bottom: 100 }) }
        }
        visit(node.props?.children)
    }
    visit(CharacterSheets(props))
    sheetDialog = nodes.find((node) => node.type === 'dialog')
    hooks.effects.forEach((effect) => { const cleanup = effect(); if (typeof cleanup === 'function') cleanups.push(cleanup) })
}
function pointer(x, target = sheetDialog.props.ref.current) {
    return { currentTarget: sheetDialog.props.ref.current, target, clientX: x, clientY: x, isPrimary: true, button: 0, pointerId: 1 }
}
async function outside() {
    sheetDialog.props.onPointerDown(pointer(0)); sheetDialog.props.onPointerUp(pointer(0))
    await Promise.resolve(); render()
}
function edit(changes) {
    const player = nodes.find((node) => node.type?.name === 'PlayerSheet')
    player.props.onChange({ ...player.props.sheet, ...changes }); render()
}
render()
ref.current.open(original); render()
await outside()
assert.equal(writes, 0, 'An unchanged sheet must close without writing')
assert.equal(sheetDialog.props.ref.current.open, false)
ref.current.open(original); render()
edit({ hitPoints: '23', playerDetails: { 'spell.1.0.name': 'Shield', 'spell.1.0.prepared': 'true' } })
await outside()
assert.equal(writes, 1)
assert.equal(JSON.parse(stored)[0].hitPoints, '23')
assert.equal(JSON.parse(stored)[0].playerDetails['spell.1.0.prepared'], 'true')
assert.equal(savedEvents.at(-1).hitPoints, '23', 'Autosave must notify combat synchronization')
assert.equal(sheetDialog.props.ref.current.open, false)
ref.current.open(original); render()
edit({ hitPoints: '17' }); fail = true
await outside()
assert.equal(sheetDialog.props.ref.current.open, true, 'A failed save must keep the draft visible')
assert.equal(JSON.parse(stored)[0].hitPoints, '23', 'A failed save must preserve previous storage')
assert.ok(nodes.some((node) => node.props?.role === 'alert' && String(node.props.children).includes('Salvataggio non riuscito')))
fail = false
await outside()
assert.equal(JSON.parse(stored)[0].hitPoints, '17', 'Retry must save the retained draft')
ref.current.open(original); render()
edit({ name: ' ' })
await outside()
assert.equal(sheetDialog.props.ref.current.open, true, 'Invalid edits must not be discarded')
assert.equal(JSON.parse(stored)[0].name, 'Aria')
edit({ name: 'Aria aggiornata', hitPoints: ' ' })
await outside()
assert.equal(sheetDialog.props.ref.current.open, true, 'Whitespace is not a valid numeric statistic')
assert.equal(JSON.parse(stored)[0].hitPoints, '17')
edit({ hitPoints: '18' })
sheetDialog.props.onPointerDown(pointer(50)); sheetDialog.props.onPointerUp(pointer(0))
assert.equal(sheetDialog.props.ref.current.open, true, 'Dragging text from inside to outside must not dismiss')
const child = {}
sheetDialog.props.onPointerDown(pointer(0, child)); sheetDialog.props.onPointerUp(pointer(0, child))
assert.equal(sheetDialog.props.ref.current.open, true, 'A nested dialog event must not save or close the parent')
const beforeCancel = writes
nodes.find((node) => node.type === 'button' && node.props.children === 'Annulla').props.onClick()
assert.equal(writes, beforeCancel, 'Explicit cancel keeps its discard behavior')
render()
ref.current.open(newCharacterSheet()); render()
await outside()
assert.equal(writes, beforeCancel, 'An untouched new blank sheet closes without creating a record')
assert.equal(sheetDialog.props.ref.current.open, false)
const { useDialogDismiss: createDismissHandlers } = await import('../src/utils/Dialog.ts')
hooks.cursor = 1000
const readOnly = createDismissHandlers()
sheetDialog.props.ref.current.open = true
readOnly.onPointerDown(pointer(0)); readOnly.onPointerUp(pointer(0))
assert.equal(sheetDialog.props.ref.current.open, false, 'Read-only dialogs still close on backdrop clicks')
console.log('Dialog autosave checks passed: changed/unchanged drafts, persistence, combat sync, validation, retry, nested dialogs and cancel')
const json = (file) => JSON.parse(readFileSync(new URL(`../public/data/${file}.json`, import.meta.url), 'utf8'))
props.creationData = withWizardCatalog({ ...json('character-options'), ...json('character-equipment'), skills:json('character-rules').skills }, json('wizard-catalog'))
ref.current.open(newTutorial()); render()
const libraryBeforeTutorial = stored
const pause = () => findButton(sheetDialog,'Salva e riprendi più tardi').props.onClick()
const exitPrompt = () => nodes.find((node) => node.type === 'dialog' && node.props['aria-labelledby'] === 'tutorial-exit-heading')
const promptButton = (label) => exitPrompt().props.children[1].props.children.find((node) => node?.type === 'button' && node.props.children === label)
async function outsidePrompt() {
    const prompt = exitPrompt(), element = prompt.props.ref.current
    const event = { currentTarget: element, target: element, clientX: 0, clientY: 0, isPrimary: true, button: 0, pointerId: 2 }
    prompt.props.onPointerDown(event); prompt.props.onPointerUp(event)
    await Promise.resolve(); render()
}
function findButton(node, label) {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) return node.map((child) => findButton(child,label)).find(Boolean) ?? null
    if (node.type === 'button' && node.props.children === label) return node
    return findButton(node.props?.children,label)
}
assert.ok(findButton(sheetDialog,'Salva e riprendi più tardi'), 'The guided sheet must show the pause button at the bottom')
assert.ok(findButton(sheetDialog,'Cancella scheda'), 'The guided sheet must show the discard button at the bottom')
await outside()
assert.equal(sheetDialog.props.ref.current.open, true, 'Clicking outside a guided creation must keep it open')
assert.equal(exitPrompt().props.ref.current.open, true, 'Clicking outside a guided creation must show the required choice')
assert.ok(promptButton('Salva e riprendi più tardi'))
assert.ok(promptButton('Cancella scheda'))
await outsidePrompt()
assert.equal(exitPrompt().props.ref.current.open, false, 'Clicking outside the exit choice must close only that dialog')
assert.equal(sheetDialog.props.ref.current.open, true, 'Closing the exit choice must keep guided creation open')
await outside()
exitPrompt().props.onCancel({ preventDefault() {} })
assert.equal(exitPrompt().props.ref.current.open, true, 'Escape cannot bypass the required choice')
fail = true; promptButton('Salva e riprendi più tardi').props.onClick(); render()
assert.equal(sheetDialog.props.ref.current.open,true,'Failed tutorial save keeps the draft open')
assert.equal(progress,null)
assert.equal(stored,libraryBeforeTutorial,'Draft errors must not overwrite the normal library')
fail = false; pause(); render()
assert.equal(sheetDialog.props.ref.current.open,false)
assert.equal(JSON.parse(progress).name,'','Incomplete tutorial can pause without a name')
nodes.find((node) => node.type === 'button' && node.props.className?.includes('tutorial-resume')).props.onClick(); render()
edit({ name:'Bozza ripresa',playerDetails:{'creation.enabled':'true','tutorial.active':'true','tutorial.step':'3','tutorial.method':'points','creation.base.strength':'9.5'} })
nodes.find((node) => node.type === 'button' && node.props['aria-label'] === 'Chiudi scheda').props.onClick(); render()
assert.equal(sheetDialog.props.ref.current.open,true,'The close button must keep a guided tutorial open')
assert.equal(exitPrompt().props.ref.current.open,true,'The close button must show the same required exit choice')
promptButton('Salva e riprendi più tardi').props.onClick(); render()
assert.equal(JSON.parse(progress).playerDetails['tutorial.step'],'3')
assert.equal(JSON.parse(progress).playerDetails['creation.base.strength'],'9.5','Unfinished input survives pause and resume')
assert.equal(stored,libraryBeforeTutorial)
nodes.find((node) => node.type === 'button' && node.props.className?.includes('tutorial-resume')).props.onClick(); render()
await outside()
promptButton('Cancella scheda').props.onClick(); render()
assert.equal(sheetDialog.props.ref.current.open,false,'Discarding a guided draft closes its sheet')
assert.equal(progress,null,'Discarding a guided draft removes its saved progress')
assert.equal(nodes.find((node) => node.type === 'button' && node.props.children === '+ Crea personaggio guidato').props.disabled,false,'Discarding a draft allows a new guided character')
cleanups.forEach((cleanup) => cleanup())
console.log('Tutorial dialog checks passed: required outside-click choice, pause/resume, discard and storage failure recovery.')

const over={...newCharacterSheet(),name:'Limiti',kind:'PG',level:'3',intelligence:'16',playerDetails:{'creation.class':'wizard'}}
for (const [i,id] of ['acid-arrow','blur','blindness-deafness'].entries()) {
    const spell=props.creationData.spells.find((s) => s.index===id)
    Object.assign(over.playerDetails,{[`spell.2.${i}.name`]:spell.name,[`spell.2.${i}.index`]:id})
}
ref.current.open(over); render()
edit({name:'Limiti da correggere'})
const beforeInvalid=stored
await outside()
assert.equal(sheetDialog.props.ref.current.open,true,'Normal save cannot bypass a spell cap')
assert.equal(stored,beforeInvalid,'Failed cap validation must preserve previous storage')
assert.ok(nodes.some((n) => n.props?.role==='alert' && String(n.props.children).includes('3/2, 1 in eccesso')))
const draft=nodes.find((n) => n.type?.name==='PlayerSheet').props.sheet
assert.ok(draft.playerDetails['spell.2.2.name'],'All excess spells remain available to correct')
edit({playerDetails:{...draft.playerDetails,'spell.2.2.name':''}})
await outside()
assert.equal(sheetDialog.props.ref.current.open,false)
assert.equal(JSON.parse(stored).find((s) => s.id===over.id).name,'Limiti da correggere')
console.log('Normal save spell limits passed: precise excess, no data loss, correction and retry, including manual sheets.')

const loadedRules=props.creationData
delete props.creationData
ref.current.open({...over,id:crypto.randomUUID()}); render()
edit({name:'Catalogo in caricamento'})
await outside()
assert.equal(sheetDialog.props.ref.current.open,true,'A wizard cannot bypass validation by saving before rule data arrives')
assert.ok(nodes.some((n) => n.props?.role==='alert' && String(n.props.children).includes('caricamento delle regole')))
props.creationData=loadedRules
render()
cleanups.forEach((cleanup) => cleanup())
