// Run: node --experimental-strip-types tests/keyboard-shortcut.mjs
import assert from 'node:assert/strict'
import { defaultNextTurnShortcut, parseKeyboardShortcut, shortcutFromEvent, matchesShortcut, shortcutLabel } from '../src/utils/KeyboardShortcut.ts'

const key=(key,extra={})=>({key,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,repeat:false,isComposing:false,defaultPrevented:false,...extra})
assert.deepEqual(parseKeyboardShortcut(null),defaultNextTurnShortcut)
assert(matchesShortcut(key('p'),defaultNextTurnShortcut))
assert(matchesShortcut(key('P'),defaultNextTurnShortcut),'Caps Lock does not change the chosen letter')
for(const extra of [{repeat:true},{isComposing:true},{defaultPrevented:true},{altKey:true},{ctrlKey:true},{shiftKey:true},{metaKey:true}])assert(!matchesShortcut(key('p',extra),defaultNextTurnShortcut))
assert(!matchesShortcut(key('n'),defaultNextTurnShortcut))
const custom=shortcutFromEvent(key('Enter',{ctrlKey:true,shiftKey:true}))
assert.deepEqual(parseKeyboardShortcut(JSON.stringify(custom)),custom)
assert(matchesShortcut(key('Enter',{ctrlKey:true,shiftKey:true}),custom))
assert.equal(shortcutLabel(defaultNextTurnShortcut),'P')
assert.equal(shortcutLabel(custom),'Ctrl + Shift + Enter')
assert.equal(shortcutLabel(custom,true),'Control+Shift+Enter')
assert.equal(shortcutLabel(shortcutFromEvent(key(' '))),'Spazio')
for(const modifier of ['Control','Alt','Shift','Meta','Dead','Unidentified'])assert.equal(shortcutFromEvent(key(modifier)),null)
for(const raw of ['{bad','{}','[]','null',JSON.stringify({...custom,key:'Control'}),JSON.stringify({...custom,key:''}),JSON.stringify({...custom,ctrlKey:'true'})])assert.throws(()=>parseKeyboardShortcut(raw))
assert(matchesShortcut(key('p'),parseKeyboardShortcut(JSON.stringify({...defaultNextTurnShortcut,unused:'ignored'}))),'Unknown saved fields never break matching')
console.log('Keyboard shortcut: defaults, configuration, persistence, modifiers and repeat/composition checks passed')
