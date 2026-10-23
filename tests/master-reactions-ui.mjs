// Run: node tests/master-reactions-ui.mjs — shared Master/player choices and offline character reactions.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {sheetFromCatalog,templateFromCatalog} from '../src/utils/Catalog.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'master-reactions-')),server=(await createApp({dataDir:dir,production:false,sessionSecret:'master-reaction-ui-isolated-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),master=await browser.newContext({viewport:{width:1600,height:1050}}),player=await browser.newContext({viewport:{width:1600,height:1050}}),stranger=await browser.newContext()
const page=await master.newPage(),pp=await player.newPage(),errors=[];for(const p of [page,pp]){p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message))}
async function api(c,path,method='GET',data){const r=await c.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function until(fn){for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}assert.fail('Condition did not become true')}
async function view(p){await p.getByRole('button',{name:'Impostazioni',exact:true}).click();await p.getByRole('radio',{name:/^Rinnovata/}).check();await p.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
const realNow=Date.now;let offset=0
try{
 await api(master,'/register','POST',{username:'ReactionProxyMaster',password:'test-password-123'});await api(player,'/register','POST',{username:'ReactionProxyPlayer',password:'test-password-123'});await api(stranger,'/register','POST',{username:'ReactionStranger',password:'test-password-123'})
 const {catalog}=await combatRules(),shield=templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:shield'))
 const spider=sheetFromCatalog(catalog.creatures.find(e=>/ragno gigante/i.test(e.name)),catalog)
 const mage=name=>({...newCharacterSheet(),name,characterClass:'Mago',level:'5',hitPoints:'22',armorClass:'12',abilities:[shield],playerDetails:{'slots.1.total':'4','slots.2.total':'3'}})
 const offline=mage('Mago senza app'),aster=mage('Aster')
 let game=await api(master,'/play/games','POST',{name:'Reazioni Master QA'}),path='/play/games/'+game.id
 const turn=(sheet,id)=>({id,sheet,description:sheet.name,initiative:String(20-id),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[spider,offline],state:{turns:[turn(spider,0),turn(offline,1)],abilities:[],combat:{activeId:0,round:1}}})
 await page.goto(base+'/games/'+game.id);await view(page)
 const card=page.locator('.ability-row').filter({has:page.locator('input[value="Morso"]')})
 async function saved(){await page.waitForFunction(id=>!Object.keys(localStorage).some(key=>key.startsWith('dev-and-dice.game-draft.')&&key.endsWith('.'+id)),game.id);await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()}
 async function bite(name){
  await page.getByRole('button',{name:'Morso · Usa',exact:true}).click();await card.getByRole('checkbox',{name:`Bersaglio ${name} di Morso`,exact:true}).check();await card.getByRole('checkbox',{name:'Confermo requisiti e bersagli',exact:true}).check();await card.getByRole('button',{name:'Usa',exact:true}).click()
  await card.getByLabel(`Danno finale a ${name} da Morso`,{exact:true}).fill('9');await card.getByRole('combobox',{name:`Esito di Morso su ${name}`,exact:true}).selectOption('hit');await saved();await card.getByRole('button',{name:'Concludi uso e applica danni',exact:true}).click()
 }
 await bite(offline.name)
 const offlinePanel=page.getByRole('region',{name:'Reazione di '+offline.name,exact:true});await offlinePanel.waitFor()
 await offlinePanel.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:2')
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===offline.id).sheet.hitPoints,'22','Even with no player accounts, the attack waits for the Master reaction')
 await offlinePanel.screenshot({path:join(root,'master-reaction-panel.png')})
 await offlinePanel.getByRole('button',{name:'Usa la reazione',exact:true}).click();await offlinePanel.waitFor({state:'detached'})
 await card.getByText(/La reazione ha modificato la CA: Mago senza app: 12 → 17/).waitFor();await saved()
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===offline.id).sheet.playerDetails['slots.2.used'],'1');assert.equal(game.reactionWindows.filter(w=>w.status==='used').length,1)
 await card.getByRole('combobox',{name:`Esito di Morso su ${offline.name}`,exact:true}).selectOption('miss');await saved();await card.getByRole('button',{name:'Concludi uso e applica danni',exact:true}).click();await saved()
 // A linked player's window is the same authoritative opportunity on both clients.
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:aster});game=await api(master,path)
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(c=>c.sheet),state:{...game.state,turns:[...game.state.turns,turn(aster,2)]}})
 await page.reload();await pp.goto(base+'/games/'+game.id);await view(pp)
 const panel=page.getByRole('region',{name:'Reazione di Aster',exact:true}),popup=pp.getByRole('dialog',{name:'Puoi usare una reazione',exact:true})
 await api(master,path+'/reactions','POST',{revision:game.revision,event:{kind:'hit',label:'Prova rinuncia del Master',targetIds:[2],actorId:0}})
 await panel.waitFor();await popup.waitFor();await panel.getByRole('button',{name:'Non usare la reazione',exact:true}).click();await panel.waitFor({state:'detached'});await popup.waitFor({state:'detached'})
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===aster.id).sheet.playerDetails['slots.2.used'],undefined,'The Master can decline for the player without spending a slot')
 const opened=await api(master,path+'/reactions','POST',{revision:game.revision,event:{kind:'hit',label:'Attacco su Aster',targetIds:[2],actorId:0}})
 const window=opened.game.reactionWindows.find(w=>w.groupId===opened.groupId)
 assert(window.expiresAt-window.serverNow<=30000&&window.expiresAt-window.serverNow>29000)
 await panel.waitFor();await popup.waitFor()
 const denied=await stranger.request.get(base+'/api'+path+'/reactions/'+window.id+'/actions');assert.equal(denied.status(),404,'An outsider cannot inspect a session or its reaction choices')
 await new Promise(r=>setTimeout(r,1200));assert(Number((await panel.getByRole('timer').innerText()).replace(/\D/g,''))<30)
 await panel.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:2')
 await until(async()=>((await api(master,path)).reactionWindows.find(w=>w.id===window.id)?.expiresAt??0)>window.expiresAt)
 await until(async()=>Number((await popup.getByRole('timer').innerText()).replace(/\D/g,''))>=29)
 const renewed=(await api(master,path)).reactionWindows.find(w=>w.id===window.id).expiresAt
 await new Promise(r=>setTimeout(r,1100));await popup.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:2')
 await until(async()=>((await api(master,path)).reactionWindows.find(w=>w.id===window.id)?.expiresAt??0)>renewed)
 await until(async()=>Number((await panel.getByRole('timer').innerText()).replace(/\D/g,''))>=29)
 for(const width of [390,320]){await page.setViewportSize({width,height:900});assert(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Master form fits '+width)}
 await page.setViewportSize({width:1600,height:1050})
 await panel.getByRole('button',{name:'Usa la reazione',exact:true}).click();await panel.waitFor({state:'detached'});await popup.waitFor({state:'detached'})
 game=await api(master,path);let sheet=game.characters.find(c=>c.id===aster.id).sheet
 assert.equal(sheet.playerDetails['slots.2.used'],'1');assert.equal(sheet.playerDetails['combat.reactionUsed'],'true')
 assert.equal(game.combatRequests.filter(r=>r.characterId===aster.id).length,1,'A proxy cast creates one normal request owned by the character player')
 assert((await api(player,path)).combatRequests.some(r=>r.characterId===aster.id&&r.actorName==='ReactionProxyMaster'),'The player sees the Master cast in their own action history')
 const late=await player.request.post(base+'/api'+path+'/requests',{data:{id:randomUUID(),revision:game.revision,key:window.actionKeys[0],reactionId:window.id,option:'slot:2',cost:1,mode:'none',damageEnabled:false,packets:[{targetId:2,damage:[]}]}});assert.equal(late.status(),409,'A late player response cannot use the Master-resolved reaction twice')
 // An unattended window really resumes the attack, with no reaction or slot spent.
 sheet={...sheet,playerDetails:{...sheet.playerDetails,'combat.reactionUsed':'false'}}
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(c=>c.id===aster.id?sheet:c.sheet),state:{...game.state,abilities:game.state.abilities.filter(a=>!(a.ownerId===2&&a.ruleId==='phb2014:spell:shield'))}})
 await pp.close();await page.reload();await bite('Aster');await panel.waitFor()
 Date.now=()=>realNow()+offset;offset=31000
 await panel.waitFor({state:'detached'});await card.waitFor({state:'detached'});await saved()
 game=await api(master,path);sheet=game.characters.find(c=>c.id===aster.id).sheet
 assert.equal(sheet.hitPoints,'13','Damage resumes only after the shared 30-second window expires');assert.equal(sheet.playerDetails['slots.2.used'],'1');assert.equal(sheet.playerDetails['combat.reactionUsed'],'false')
 assert.equal(game.reactionWindows.at(-1).status,'expired')
 const expired=await master.request.post(base+'/api'+path+'/reactions/'+game.reactionWindows.at(-1).id+'/activity',{data:{}});assert.equal(expired.status(),409,'The Master cannot revive an expired timer')
 assert.deepEqual(errors,[])
 console.log('PASS Master reactions: characters without app, direct Shield, shared countdown resets, single player/Master decision, authorization, responsive form, timeout resumes damage without spending resources')
}catch(e){await page.screenshot({path:join(root,'master-reaction-failure.png'),fullPage:true});throw e}
finally{Date.now=realNow;await browser.close();await frontend.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
