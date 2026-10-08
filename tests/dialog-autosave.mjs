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
const pause = () => nodes.find((node) => node.type === 'button' && node.props.children === 'Salva e riprendi più tardi').props.onClick()
fail = true; pause(); render()
assert.equal(sheetDialog.props.ref.current.open,true,'Failed tutorial save keeps the draft open')
assert.equal(progress,null)
assert.equal(stored,libraryBeforeTutorial,'Draft errors must not overwrite the normal library')
fail = false; pause(); render()
assert.equal(sheetDialog.props.ref.current.open,false)
assert.equal(JSON.parse(progress).name,'','Incomplete tutorial can pause without a name')
nodes.find((node) => node.type === 'button' && node.props.className?.includes('tutorial-resume')).props.onClick(); render()
edit({ name:'Bozza ripresa',playerDetails:{'creation.enabled':'true','tutorial.active':'true','tutorial.step':'3','tutorial.method':'points','creation.base.strength':'9.5'} })
await outside()
assert.equal(JSON.parse(progress).playerDetails['tutorial.step'],'3')
assert.equal(JSON.parse(progress).playerDetails['creation.base.strength'],'9.5','Unfinished input survives pause and resume')
assert.equal(stored,libraryBeforeTutorial)
cleanups.forEach((cleanup) => cleanup())
console.log('Tutorial dialog checks passed: separate draft, incomplete input, pause/resume and storage failure recovery.')
