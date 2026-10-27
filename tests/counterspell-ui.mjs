// node tests/counterspell-ui.mjs - isolated API + real Master/player UI.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdir,mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true})
const dir=await mkdtemp(join(tmpdir(),'counterspell-ui-')),server=(await createApp({dataDir:dir,production:false,sessionSecret:'counterspell-isolated-browser-secret'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),master=await browser.newContext({viewport:{width:1440,height:1000}}),player=await browser.newContext({viewport:{width:1440,height:1000}}),enemy=await browser.newContext(),dm=await master.newPage(),pc=await player.newPage(),errors=[]
for(const p of [dm,pc]){p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message))}
async function api(c,path,method='GET',data){const r=await c.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function view(p){await p.getByRole('button',{name:'Impostazioni',exact:true}).click();await p.getByRole('radio',{name:/^Rinnovata/}).check();await p.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
async function shots(p,locator,name){for(const width of [1440,390])for(const theme of ['light','dark']){await p.setViewportSize({width,height:1000});await p.emulateMedia({colorScheme:theme});await locator.scrollIntoViewIfNeeded();await locator.screenshot({path:join(root,`${name}-${theme}-${width}.png`)});assert(await locator.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal clipping')}await p.setViewportSize({width:1440,height:1000});await p.emulateMedia({colorScheme:'light'})}
try{
 for(const [c,username] of [[master,'CounterMaster'],[player,'CounterPlayer'],[enemy,'CounterEnemy']])await api(c,'/register','POST',{username,password:'isolated-password'})
 const {catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
 const caster={...newCharacterSheet(),name:'Aster',characterClass:'Mago',level:'11',intelligence:'18',hitPoints:'25',abilities:[spell('counterspell')],playerDetails:{'slots.3.total':'3','slots.5.total':'2','rules2014.concentration':'test:held'}},foe={...newCharacterSheet(),name:'Baldur',characterClass:'Mago',level:'11',intelligence:'18',hitPoints:'25',abilities:[spell('fireball')],playerDetails:{'slots.5.total':'2'}}
 let game=await api(master,'/play/games','POST',{name:'Controincantesimo QA'});await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:caster});await api(enemy,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:foe});const path='/play/games/'+game.id
 const state={turns:[caster,foe].map((sheet,id)=>({id,sheet,description:sheet.name,initiative:String(20-id),hitPoints:sheet.hitPoints,armorClass:'12',temporaryHitPoints:''})),abilities:[{id:100,ownerId:0,ruleId:'test:held',name:'Concentrazione precedente',active:true,concentration:true,duration:'1 minuto',remainingTurns:10}],combat:{activeId:1,round:1}}
 async function reset(){game=await api(master,path);game=await api(master,path+'/state','PUT',{revision:game.revision,state,sheets:[caster,foe]})}
 await reset();await dm.goto(base+'/games/'+game.id);await view(dm);await dm.getByRole('button',{name:'Dettagli di Aster',exact:true}).click();await dm.getByRole('button',{name:'Controincantesimo · Usa',exact:true}).click()
 let form=dm.getByRole('form',{name:'Lancio: Controincantesimo',exact:true});await form.waitFor()
 assert.equal(await form.getByRole('checkbox').count(),1,'Only the specific reaction requirement is editable')
 assert.equal(await form.getByRole('combobox',{name:/Origine del lancio/}).count(),0)
 await form.getByRole('combobox',{name:'Lancio da interrompere',exact:true}).selectOption('manual:1');await form.getByLabel('Livello del lancio avversario',{exact:true}).fill('3')
 assert.equal(await form.getByLabel('Risultato del d20 di Controincantesimo',{exact:true}).count(),0,'Automatic interruption never asks for a die')
 await shots(dm,form,'counterspell-master-automatic')
 await form.getByLabel('Livello del lancio avversario',{exact:true}).fill('5');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Usa Controincantesimo',exact:true}).locator('..').hover();await dm.getByRole('tooltip').getByText(/Inserisci i d20 richiesti/).waitFor();await dm.keyboard.press('Escape');await form.getByLabel('Risultato del d20 di Controincantesimo',{exact:true}).fill('10');await form.getByText('Totale 14 contro CD 15 · Controincantesimo fallito',{exact:true}).waitFor()
 await form.getByRole('button',{name:'Dettaglio modificatore di Controincantesimo',exact:true}).hover();await dm.getByRole('tooltip').getByText('Intelligenza: +4',{exact:true}).waitFor();await dm.keyboard.press('Escape')
 await shots(dm,form,'counterspell-master-check')
 await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Usa Controincantesimo',exact:true}).click();await form.getByText('Controincantesimo fallito',{exact:true}).waitFor()
 game=await api(master,path);assert.equal(game.characters.find(c=>c.sheet.name==='Aster').sheet.playerDetails['slots.3.used'],'1');assert.equal(game.characters.find(c=>c.sheet.name==='Aster').sheet.playerDetails['combat.reactionUsed'],'true');assert(game.state.abilities.find(a=>a.id===100).active)
 await reset()
 // An actual pending upcast Fireball is the source, and its identity/level stay hidden in player choices.
 const actions=await api(enemy,path+'/actions'),action=actions.actions.find(a=>a.name==='Palla di Fuoco'),sourceId=crypto.randomUUID()
 await api(enemy,path+'/requests','POST',{id:sourceId,revision:actions.revision,key:action.key,option:'slot:5',cost:1,mode:'save',damageEnabled:true,packets:[{targetId:0,damage:[{type:'fire',amount:30}]}]})
 const choices=await api(player,path+'/counterspell?actorId=0');assert(choices.targets.every(t=>t.level===undefined&&t.name===undefined))
 await pc.goto(base+'/games/'+game.id);await view(pc);await pc.getByRole('button',{name:'Controincantesimo · Usa',exact:true}).click()
 form=pc.getByRole('form',{name:'Lancio: Controincantesimo',exact:true});await form.getByRole('combobox',{name:'Lancio da interrompere',exact:true}).selectOption('request:'+sourceId)
 assert.equal(await form.getByLabel('Livello del lancio avversario',{exact:true}).count(),0)
 assert.equal(await form.getByLabel('Risultato del d20 di Controincantesimo',{exact:true}).count(),0)
 await form.getByRole('checkbox').check();await shots(pc,form,'counterspell-player-proposal');const posted=pc.waitForResponse(r=>r.url().endsWith('/counterspell')&&r.request().method()==='POST');await form.getByRole('button',{name:'Usa Controincantesimo · invia al Master',exact:true}).click();assert((await posted).ok())
 game=await api(master,path);let request=game.combatRequests.find(r=>r.counterspell&&r.status==='pending');assert(request);assert.equal(game.characters.find(c=>c.sheet.name==='Aster').sheet.playerDetails['slots.3.used'],undefined)
 const premature=await master.request.post(base+'/api'+path+'/requests/'+sourceId+'/approve',{data:{revision:game.revision,confirmed:true,targets:[{id:0,damage:'30'}]}});assert.equal(premature.status(),409,'Cannot apply the original while Counterspell is pending')
 await dm.reload();await dm.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 const review=dm.locator('.counterspell-review').filter({has:dm.getByRole('heading',{name:'Controincantesimo',exact:true})}).first();await review.waitFor()
 await review.getByText('Livello del lancio avversario: 5',{exact:true}).waitFor();await review.getByLabel('Risultato del d20 di Controincantesimo',{exact:true}).fill('11');await review.getByRole('checkbox').check();await shots(dm,review,'counterspell-master-review')
 await review.getByRole('button',{name:'Approva Controincantesimo',exact:true}).click();await review.getByText('Incantesimo interrotto',{exact:true}).waitFor()
 game=await api(master,path);request=game.combatRequests.find(r=>r.id===request.id);assert(request.counterspell.result.success)
 assert.equal(game.combatRequests.find(r=>r.id===sourceId).counteredBy,request.id)
 assert.equal(game.characters.find(c=>c.sheet.name==='Aster').sheet.hitPoints,'25','The interrupted Fireball deals no damage')
 for(const [name,slot] of [['Aster','3'],['Baldur','5']])assert.equal(game.characters.find(c=>c.sheet.name===name).sheet.playerDetails['slots.'+slot+'.used'],'1')
 const duplicate=await api(master,path+'/requests/'+request.id+'/approve','POST',{revision:game.revision,confirmed:true,die:11});assert.equal(duplicate.characters.find(c=>c.sheet.name==='Aster').sheet.playerDetails['slots.3.used'],'1','Repeated approval never spends twice')
 await dm.reload();game=await api(master,path);assert(game.combatRequests.find(r=>r.id===request.id).counterspell.result.success,'Outcome persists after reload')
 await reset();await dm.reload();await pc.reload()
 const opened=await api(master,path+'/reactions','POST',{revision:game.revision,event:{kind:'other',label:'Baldur sta lanciando un incantesimo: verifica portata e visibilità.',targetIds:[],actorId:1}})
 const window=opened.game.reactionWindows.find(w=>w.status==='pending'&&w.characterName==='Aster');assert(window)
 const popup=pc.getByRole('dialog',{name:'Puoi usare una reazione',exact:true});await popup.waitFor()
 const popupForm=popup.getByRole('form',{name:'Lancio: Controincantesimo',exact:true})
 await popupForm.getByRole('combobox',{name:'Lancio da interrompere',exact:true}).selectOption('manual:1');await popupForm.getByRole('checkbox').check()
 const submitted=pc.waitForResponse(r=>r.url().endsWith('/counterspell')&&r.request().method()==='POST');await popupForm.getByRole('button',{name:'Usa Controincantesimo · invia al Master',exact:true}).click();assert((await submitted).ok())
 game=await api(master,path);const popupRequest=game.combatRequests.find(r=>r.counterspell&&r.status==='pending');assert.equal(game.reactionWindows.find(w=>w.id===window.id).status,'submitted')
 game=await api(master,path+'/requests/'+popupRequest.id+'/approve','POST',{revision:game.revision,confirmed:true,level:3})
 assert.equal(game.reactionWindows.find(w=>w.id===window.id).status,'used')
 await popup.waitFor({state:'detached'})
 assert.deepEqual(errors,[]);console.log('PASS Counterspell UI/API: dedicated Master/player forms, hidden levels, conditional dice, modifier tooltip, failure resources, approval, source blocking/cancellation, idempotence, reload, mobile/light/dark')
}catch(error){await dm.screenshot({path:join(root,'counterspell-master-failure.png'),fullPage:true}).catch(()=>{});await pc.screenshot({path:join(root,'counterspell-player-failure.png'),fullPage:true}).catch(()=>{});throw error}finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
