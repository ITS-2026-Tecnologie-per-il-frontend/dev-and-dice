// Run: node tests/wind-save-feedback-ui.mjs — approved wind notifications are immutable receipts.
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
 const dialog=page.getByRole('dialog',{name:'Azioni dei giocatori',exact:true})
 await dialog.getByText('Approvata',{exact:true}).waitFor()
 const summary=dialog.getByRole('region',{name:'Bersagli e tiri salvezza confermati',exact:true})
 await summary.getByText('CD di Maga: 15',{exact:false}).waitFor()
 await summary.getByText('Guardia: Non resiste · spinta di 4.5 m lungo la linea',{exact:true}).waitFor()
 assert.equal(await dialog.locator('input,select,form').count(),0,'No editable controls survive approval, even if a legacy payload says editable:true')
 assert.equal(await dialog.getByRole('button',{name:'Salva bersagli e tiri salvezza',exact:true}).count(),0)
 assert.equal(await page.evaluate(()=>window.savedDraft),undefined)
 await dialog.screenshot({path:join(root,'wind-approved-receipt.png')})
 assert.deepEqual(errors,[])
 console.log('PASS Approved Wind receipt: historical CD, dice, bonuses and outcome, no editable controls or save button')
}catch(error){console.error('Browser errors',errors);throw error}finally{await browser.close();await frontend.close();await rm(dir,{recursive:true,force:true})}
