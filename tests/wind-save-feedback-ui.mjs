// Run: node tests/wind-save-feedback-ui.mjs — save feedback survives the updated request remount.
import assert from 'node:assert/strict'
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {combatRules} from '../server/combat-requests.mjs'
import {resolutionPlan,defenseProfile} from '../src/domain/dnd/CombatResolution.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true})
const dir=await mkdtemp(join(root,'wind-feedback-')),frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0}});await frontend.listen()
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000)
try{
 const {catalog,data}=await combatRules(),spell=templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:gust-of-wind'))
 const sheet={...newCharacterSheet(),name:'Maga',characterClass:'Mago',level:'5',abilities:[spell],playerDetails:{spellDC:'15'}},target={...newCharacterSheet(),name:'Guardia',strength:'16'}
 const plan=resolutionPlan(sheet,spell,catalog,'slot:2'),profile=defenseProfile(target,'strength',[],2,undefined,data)
 const request={id:crypto.randomUUID(),characterId:sheet.id,characterName:sheet.name,actorName:'Giocatore',actionName:spell.name,createdAt:new Date().toISOString(),status:'approved',optionLabel:'Slot di 2° livello',cost:1,spendsResources:true,mode:'none',damageEnabled:false,prolonged:false,targets:[],resolution:plan,rollsRevision:0,wind:{editable:true,candidates:[{id:2,name:target.name,sheetId:target.id,profile}],selected:[2],saves:{2:{mode:'dice',die:10}}}}
 const game={id:crypto.randomUUID(),role:'master',name:'Feedback salvataggio',revision:1,requestsRevision:0,combatRequests:[request],characters:[{id:sheet.id,sheet}],state:{turns:[],abilities:[],combat:null}}
 const entry=join(dir,'check.mjs')
 await writeFile(entry,`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{MasterCombatRequests}from'/src/components/CombatRequests.tsx';import'/src/index.css';import'/src/PlayPages.css';
 function Check(){const[game,setGame]=useState(${JSON.stringify(game)});return React.createElement(MasterCombatRequests,{game,disabled:false,onDecide:async(id,decision,body)=>{await new Promise(r=>setTimeout(r,250));window.savedDraft=body;setGame(current=>({...current,combatRequests:current.combatRequests.map(request=>({...request,rollsRevision:request.rollsRevision+1,wind:{...request.wind,...body.wind}}))}));}})}createRoot(document.getElementById('root')).render(React.createElement(Check));`)
 const base=`http://127.0.0.1:${frontend.httpServer.address().port}`
 const html=await frontend.transformIndexHtml('/wind-save-check',`<div id="root"></div><script type="module" src="/${relative(join(import.meta.dirname,'..'),entry)}"></script>`)
 await page.route('**/wind-save-check',route=>route.fulfill({contentType:'text/html',body:html}))
 await page.goto(base+'/wind-save-check');await page.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 const dialog=page.getByRole('dialog',{name:'Azioni dei giocatori',exact:true}),field=dialog.getByLabel('TS Forza di Guardia · solo d20',{exact:true})
 await field.fill('12');await dialog.getByRole('button',{name:'Salva bersagli e tiri salvezza',exact:true}).click()
 await dialog.getByRole('button',{name:'Salvataggio…',exact:true}).waitFor()
 await dialog.getByRole('status').filter({hasText:/^Bersagli e tiri salvezza salvati alle/}).waitFor()
 assert.equal(await field.inputValue(),'12','Saved values survive the request revision remount')
 assert.deepEqual(await page.evaluate(()=>window.savedDraft.wind),{selected:[2],saves:{2:{mode:'dice',die:12}}})
 await dialog.getByRole('button',{name:'Salva bersagli e tiri salvezza',exact:true}).waitFor()
 await dialog.screenshot({path:join(root,'wind-save-feedback.png')})
 assert.deepEqual(errors,[])
 console.log('PASS Wind save feedback: pending label, submitted values, success confirmation and persistence across the request remount')
}catch(error){console.error('Browser errors',errors);throw error}finally{await browser.close();await frontend.close();await rm(dir,{recursive:true,force:true})}
