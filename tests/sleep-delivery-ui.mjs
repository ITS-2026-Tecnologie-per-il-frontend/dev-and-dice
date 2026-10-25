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
try{
 const master=(await api(null,'/api/register','POST',{username:'SleepMaster',password:'isolated-test-password'})).cookie,player=(await api(null,'/api/register','POST',{username:'SleepPlayer',password:'isolated-test-password'})).cookie
 const {catalog}=await combatRules(),spell=templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:sleep'))
 const sheet={...newCharacterSheet(),name:'Maga',characterClass:'Mago',level:'9',hitPoints:'30',abilities:[spell],playerDetails:{'slots.1.total':'4','slots.1.used':'4','slots.2.total':'3','slots.2.used':'2'}}
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
 assert.equal(request.sleepRoll,40);assert.equal(request.sleepReview.candidates.find(t=>t.id===1).hitPoints,6)
 assert.equal(request.sleepReview.candidates.length,2);assert.deepEqual(request.sleepReview.area,[1]);assert.deepEqual(request.sleepReview.selected,[1])
 const approved=(await api(master,path+'/requests/'+request.id+'/approve','POST',{revision:masterView.revision,confirmed:true,sleepArea:[0,1],sleepTargets:[1,0],targets:[{id:1,damage:'0'}]})).json
 assert.deepEqual(approved.combatRequests.find(r=>r.id===request.id).sleepReview.selected,[1,0])
 assert.deepEqual(approved.state.abilities.find(a=>a.ruleId===spell.ruleId).targets.map(t=>t.id),[1,0])
 assert.equal(approved.state.turns[0].sheet.playerDetails['slots.2.used'],'3')
 const after=(await api(player,path)).json
 assert.equal(after.combatRequests[0].sleepReview,undefined)
 assert.deepEqual(after.combatRequests[0].targets.filter(t=>t.asleep).map(t=>t.id),[0,1])
 const archived=JSON.parse(await readFile(join(dataDir,'games.json'),'utf8')).games[0].combatRequests[0]
 assert.deepEqual(archived.sleepReview.area,[0,1]);assert.deepEqual(archived.sleepReview.selected,[1,0])
 assert.deepEqual(errors,[])
 console.log('PASS Sleep real browser/API: preserved legacy form, slot 2/40, visible retry error, request delivery, private Master review, approval, one slot spent and saved active targets')
}finally{await page.unrouteAll({behavior:'wait'});await browser.close();await frontend.close();await new Promise(r=>backend.close(r));await rm(dir,{recursive:true,force:true});await rm(dataDir,{recursive:true,force:true})}
