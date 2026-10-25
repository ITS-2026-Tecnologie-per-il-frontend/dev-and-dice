// Run: node tests/sleep-delivery-ui.mjs — real browser/API delivery, isolated accounts/archive.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const dataDir=await mkdtemp(join(tmpdir(),'sleep-delivery-')),root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true})
const dir=await mkdtemp(join(root,'sleep-delivery-'))
const backend=(await createApp({dataDir,production:false,sessionSecret:'sleep-delivery-isolated-secret'})).listen(0,'127.0.0.1');await once(backend,'listening')
const base=`http://127.0.0.1:${backend.address().port}`
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:base}}}});await frontend.listen()
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
async function api(cookie,path,method='GET',body){const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const json=await r.json();assert(r.ok,`${method} ${path}: ${r.status} ${JSON.stringify(json)}`);return {json,cookie:r.headers.get('set-cookie')?.split(';')[0]}}
let masterContext
try{
 const master=(await api(null,'/api/register','POST',{username:'SleepMaster',password:'isolated-test-password'})).cookie,player=(await api(null,'/api/register','POST',{username:'SleepPlayer',password:'isolated-test-password'})).cookie
 const {catalog}=await combatRules(),spell=templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:sleep'))
 const sheet={...newCharacterSheet(),name:'Maga',characterClass:'Mago',level:'9',hitPoints:'30',abilities:[spell],playerDetails:{'rules2014.spellsThisTurn':JSON.stringify([{level:2,unit:'action'}]),'slots.1.total':'4','slots.1.used':'4','slots.2.total':'3','slots.2.used':'2'}}
 const game=(await api(master,'/api/play/games','POST',{name:'Sleep delivery'})).json,path='/api/play/games/'+game.id
 await api(player,'/api/play/invites/'+game.inviteToken+'/join','POST',{sheet})
 const target={...newCharacterSheet(),name:'Goblin',kind:'Mostro',hitPoints:'6',armorClass:'12'}
 const state={turns:[sheet,target].map((sheet,id)=>({id,sheet,description:sheet.name,hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:'',initiative:'10'})),abilities:[],combat:{activeId:0,round:1}}
 const current=(await api(master,path)).json
 await api(master,path+'/state','PUT',{revision:current.revision,state,sheets:[sheet,target]})
 const playerGame=(await api(player,path)).json
 await page.context().addCookies([{name:player.split('=')[0],value:player.slice(player.indexOf('=')+1),domain:'127.0.0.1',path:'/'}])
 const entry=join(dir,'check.mjs')
 await writeFile(entry,`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{PlayerCombatActions}from'/src/components/CombatRequests.tsx';function Check(){const[game,setGame]=useState(${JSON.stringify(playerGame)});window.refreshGame=()=>setGame(current=>({...current,requestsRevision:current.requestsRevision+1}));return React.createElement(PlayerCombatActions,{game,renewed:true,onUpdate:setGame})}createRoot(document.getElementById('root')).render(React.createElement(Check));`)
 const html=await frontend.transformIndexHtml('/sleep-delivery',`<div id="root"></div><script type="module" src="/${relative(join(import.meta.dirname,'..'),entry)}"></script>`)
 await page.route('**/sleep-delivery',r=>r.fulfill({contentType:'text/html',body:html}))
 let legacy=true
 await page.route('**/api/play/games/*/actions*',async route=>{const response=await route.fetch(),choices=await response.json();if(legacy){legacy=false;choices.actions.find(a=>a.name==='Sonno').entry.data.referenceId='legacy:sleep'}await route.fulfill({response,json:choices})})
 await page.goto(`http://127.0.0.1:${frontend.httpServer.address().port}/sleep-delivery`)
 await page.getByRole('button',{name:'Sonno · Usa',exact:true}).click()
 assert.equal(await page.getByLabel('Risoluzione',{exact:true}).inputValue(),'automatic')
 assert(await page.getByRole('checkbox',{name:'L’azione può infliggere danni',exact:true}).isChecked())
 await page.evaluate(()=>window.refreshGame())
 await page.getByLabel('Sonno · tira 7d8 e inserisci la somma').fill('40')
 await page.getByRole('checkbox',{name:'Goblin',exact:true}).check()
 let unavailable=true
 await page.route('**/api/play/games/*/requests',async route=>{if(unavailable){unavailable=false;await route.fulfill({status:503,json:{error:'Invio temporaneamente non disponibile.'}})}else await route.continue()})
 await page.getByRole('button',{name:'Invia al Master',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Invio temporaneamente non disponibile.'}).waitFor()
 assert.equal(await page.getByLabel('Sonno · tira 7d8 e inserisci la somma').inputValue(),'40')
 assert(await page.getByRole('checkbox',{name:'Goblin',exact:true}).isChecked())
 const received=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/requests'))
 await page.getByRole('button',{name:'Invia al Master',exact:true}).click()
 const response=await received
 assert.equal(response.status(),200,await response.text())
 await page.getByText('In attesa del Master',{exact:true}).first().waitFor()
 const masterView=(await api(master,path)).json,request=masterView.combatRequests.find(r=>r.actionName==='Sonno')
 assert(request,'The real Master receives the request')
 assert.equal(request.additionalActionRequired,true,'Sleep shows a previously used action before approval')
 assert.equal(masterView.state.turns[0].sheet.playerDetails['slots.2.used'],'2','A pending proposal spends no slot')
 assert.equal(JSON.parse(masterView.state.turns[0].sheet.playerDetails['rules2014.spellsThisTurn']).length,1,'Pending Sleep is not counted as an executed cast')
 assert.equal(request.sleepRoll,40);assert.equal(request.sleepReview.candidates.find(t=>t.id===1).hitPoints,6)
 assert.equal(request.sleepReview.candidates.length,2);assert.deepEqual(request.sleepReview.area,[1]);assert.deepEqual(request.sleepReview.selected,[1])
 masterContext=await browser.newContext()
 await masterContext.addCookies([{name:master.split('=')[0],value:master.slice(master.indexOf('=')+1),domain:'127.0.0.1',path:'/'}])
 const masterPage=await masterContext.newPage();masterPage.on('pageerror',e=>errors.push(e.message))
 let legacyReview=true,suppressActionWarning=true
 await masterPage.route('**/api/play/games/'+game.id,async route=>{
  const response=await route.fetch(),gameView=await response.json()
  if(legacyReview)for(const r of gameView.combatRequests)if(r.sleepReview)r.sleepReview={candidates:r.sleepReview.candidates.filter(t=>r.targets.some(p=>p.id===t.id)).map(({name:_name,...t})=>t),selected:[]}
  if(suppressActionWarning)for(const r of gameView.combatRequests)r.additionalActionRequired=false
  await route.fulfill({response,json:gameView})
 })
 await masterPage.goto(`http://127.0.0.1:${frontend.httpServer.address().port}/games/${game.id}`)
 await masterPage.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 const masterReview=masterPage.getByRole('region',{name:'Risoluzione di Sonno',exact:true})
 await masterReview.waitFor()
 assert.equal(await masterReview.getByRole('checkbox',{name:/^Nell’area:/}).count(),1)
 assert(await masterReview.getByRole('checkbox',{name:'Nell’area: Goblin',exact:true}).isChecked(),'Legacy candidate names come from the original targets')
 legacyReview=false
 await masterReview.getByRole('checkbox',{name:'Nell’area: Maga',exact:true}).waitFor({timeout:6500})
 assert.equal(await masterReview.getByRole('checkbox',{name:/^Nell’area:/}).count(),2,'Same-revision enriched notifications replace the cached review')
 assert(!await masterReview.getByRole('checkbox',{name:'Nell’area: Maga',exact:true}).isChecked(),'New candidates preserve the original area proposal')
 await masterReview.getByRole('checkbox',{name:'Nell’area: Maga',exact:true}).check()
 assert(await masterReview.getByRole('checkbox',{name:'Si addormenta: Maga',exact:true}).isChecked())
 const actionConfirmation=masterPage.getByRole('checkbox',{name:/Confermo un’altra azione valida/})
 assert.equal(await actionConfirmation.count(),0)
 suppressActionWarning=false
 await actionConfirmation.waitFor({timeout:6500})
 assert(await masterPage.getByRole('button',{name:'Approva azione',exact:true}).isDisabled(),'Additional-action confirmation is required before approval')
 assert(await masterReview.getByRole('checkbox',{name:'Nell’area: Maga',exact:true}).isChecked(),'Updating requirements preserves Master area edits')
 await actionConfirmation.check()
 const confirmation=masterPage.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/approve'))
 await masterPage.getByRole('button',{name:'Approva azione',exact:true}).click()
 const confirmationResponse=await confirmation
 assert.equal(confirmationResponse.status(),200,await confirmationResponse.text())
 const approved=await confirmationResponse.json()
 assert.deepEqual(approved.combatRequests.find(r=>r.id===request.id).sleepReview.selected,[1,0])
 assert.deepEqual(approved.state.abilities.find(a=>a.ruleId===spell.ruleId).targets.map(t=>t.id),[1,0])
 assert.equal(approved.state.turns[0].sheet.playerDetails['slots.2.used'],'3')
 assert.equal(JSON.parse(approved.state.turns[0].sheet.playerDetails['rules2014.spellsThisTurn']).length,2,'Only approval records the second cast')
 const after=(await api(player,path)).json
 assert.equal(after.combatRequests[0].sleepReview,undefined)
 assert.deepEqual(after.combatRequests[0].targets.filter(t=>t.asleep).map(t=>t.id),[0,1])
 const archived=JSON.parse(await readFile(join(dataDir,'games.json'),'utf8')).games[0].combatRequests[0]
 assert.deepEqual(archived.sleepReview.area.slice().sort((a,b)=>a-b),[0,1]);assert.deepEqual(archived.sleepReview.selected,[1,0])
 assert.deepEqual(errors,[])
 console.log('PASS Sleep real browser/API: preserved legacy form, slot 2/40, visible retry error, request delivery, same-revision Master review refresh, legacy names, approval, one slot spent and saved active targets')
}finally{await masterContext?.close();await page.unrouteAll({behavior:'wait'});await browser.close();await frontend.close();await new Promise(r=>backend.close(r));await rm(dir,{recursive:true,force:true});await rm(dataDir,{recursive:true,force:true})}
