// node tests/turn-sync-ui.mjs — failed save, preserved draft, explicit retry, player polling.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
const dir=await mkdtemp(join(tmpdir(),'turn-sync-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'isolated-turn-sync-test-secret'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),master=await browser.newContext(),player=await browser.newContext(),dm=await master.newPage(),pc=await player.newPage()
dm.setDefaultTimeout(20000);pc.setDefaultTimeout(20000)
async function api(context,path,method='GET',data){const r=await context.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
try{
 await api(master,'/register','POST',{username:'SyncMaster',password:'isolated-password'});await api(player,'/register','POST',{username:'SyncPlayer',password:'isolated-password'})
 const sheets=['Aster','Baldur','Noryn'].map(name=>({...newCharacterSheet(),name,hitPoints:'20'}))
 let game=await api(master,'/play/games','POST',{name:'Turn sync regression'})
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:sheets[0]});const path='/play/games/'+game.id;game=await api(master,path)
 const state={turns:sheets.map((sheet,id)=>({id,description:sheet.name,sheet,initiative:String(20-id),hitPoints:'20',armorClass:'12',temporaryHitPoints:''})),abilities:[],combat:{activeId:1,round:1}}
 await api(master,path+'/state','PUT',{revision:game.revision,state,sheets})
 await dm.goto(base+'/games/'+game.id);await pc.goto(base+'/games/'+game.id)
 const current=pc.locator('.play-player-turns [aria-current="step"]'),next=dm.getByRole('button',{name:'Turno successivo →',exact:true})
 await current.getByText('Baldur',{exact:true}).waitFor()
 let failSave=true,attempts=0
 await dm.route('**/state',route=>{if(route.request().method()!=='PUT')return route.continue();attempts++;return failSave?route.fulfill({status:502,contentType:'text/html',body:'Backend unavailable'}):route.continue()})
 await next.click()
 const alert=dm.locator('.combat-sync-error')
 await alert.getByText('Combattimento non sincronizzato',{exact:true}).waitFor()
 assert(await next.isDisabled(),'Failed saves must prevent further local turn advances')
 assert.equal((await api(master,path)).state.combat.activeId,1,'Server keeps the last confirmed turn')
 await current.getByText('Baldur',{exact:true}).waitFor()
 const draft=await dm.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('dev-and-dice.game-draft.')&&!k.endsWith('.library')))))
 assert.equal(draft.state.combat.activeId,2,'The unsaved turn remains recoverable without reloading')
 await dm.setViewportSize({width:390,height:844})
 await mkdir('.test-runtime.local',{recursive:true});await alert.screenshot({path:'.test-runtime.local/turn-sync-error-mobile.png'})
 assert(await alert.evaluate(e=>e.scrollWidth<=e.clientWidth),'The recovery notice must fit on mobile')
 failSave=false
 await alert.getByRole('button',{name:'Riprova salvataggio del combattimento',exact:true}).click()
 await dm.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('dev-and-dice.game-draft.')&&!k.endsWith('.library')))
 await current.getByText('Noryn',{exact:true}).waitFor()
 assert.equal((await api(master,path)).state.combat.activeId,2)
 assert.equal(await alert.count(),0);assert(await next.isEnabled());assert.equal(attempts,2)
 console.log('PASS turn synchronization: non-JSON save failure, preserved draft, nearby recovery notice, blocked advancement, successful retry and player update')
}finally{await browser.close();await frontend.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
