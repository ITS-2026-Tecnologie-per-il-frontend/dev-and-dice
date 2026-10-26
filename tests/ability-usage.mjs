// Run: node tests/ability-usage.mjs — card labels use turn resources, never casting duration.
import assert from 'node:assert/strict'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createServer} from 'vite'
import {combatRules} from '../server/combat-requests.mjs'
import {combatAbilityInfo} from '../src/domain/dnd/CombatActions.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const vite=await createServer({logLevel:'error',server:{middlewareMode:true,hmr:false,ws:false,watch:null}})
try {
 const {AbilityUsage}=await vite.ssrLoadModule('/src/components/AbilityCard.tsx'),{catalog}=await combatRules()
 for(const [id,expected] of [
  ['mending',['Azione','Concentrazione durante il lancio']],
  ['fire-bolt',['Azione']],
  ['magic-weapon',['Azione bonus','Concentrazione']],
  ['shield',['Reazione']],
  ['bless',['Azione','Concentrazione']],
 ]) {
  const ability=templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:'+id))
  const html=renderToStaticMarkup(createElement(AbilityUsage,combatAbilityInfo(ability,catalog)))
  assert.deepEqual([...html.matchAll(/<span>([^<]+)<\/span>/g)].map(match=>match[1]),expected,id)
 }
 console.log('PASS ability usage: action, bonus action, reaction, effect concentration and concentration during prolonged casting')
} finally {await vite.close()}
