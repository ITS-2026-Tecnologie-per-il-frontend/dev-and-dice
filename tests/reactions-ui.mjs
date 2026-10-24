// Run: node tests/reactions-ui.mjs — isolated server, two accounts, reaction timing and attack recalculation.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {resolutionPlan,spellEffectDetails} from '../src/domain/dnd/CombatResolution.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
import {addInventoryItem,ownedInventoryItems,setInventoryReference} from '../src/utils/Inventory.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'reactions-')),server=(await createApp({dataDir:dir,production:false,sessionSecret:'reaction-ui-isolated-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),master=await browser.newContext({viewport:{width:1600,height:1050}}),player=await browser.newContext({viewport:{width:1600,height:1050}})
const attackPlayer=await browser.newContext()
const page=await master.newPage(),pp=await player.newPage(),errors=[];for(const p of [page,pp]){p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message))}
async function api(c,path,method='GET',data){const r=await c.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function view(p){await p.getByRole('button',{name:'Impostazioni',exact:true}).click();await p.getByRole('radio',{name:/^Rinnovata/}).check();await p.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100))}assert.fail('Condition did not become true')}
const realNow=Date.now;let offset=0
try{
 await api(attackPlayer,'/register','POST',{username:'ReactionAttacker',password:'test-password-123'})
 await api(master,'/register','POST',{username:'ReactionMaster',password:'test-password-123'});await api(player,'/register','POST',{username:'ReactionPlayer',password:'test-password-123'})
 const {data,catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
 let attacker={...newCharacterSheet(),name:'Baldur',characterClass:'Mago',level:'5',abilities:[spell('magic-missile')],dexterity:'14',hitPoints:'22',armorClass:'12',playerDetails:{'slots.1.total':'4','attacks.0.1':'5','attacks.0.2':'1d4+2','attacks.0.3':'Perforante'}}
 attacker=addInventoryItem(attacker,data,'Pugnale','dagger','1');attacker=setInventoryReference(attacker,'attacks.0.0',ownedInventoryItems(attacker)[0].id)
 const mage={...newCharacterSheet(),name:'Aster',characterClass:'Mago',level:'5',dexterity:'14',hitPoints:'22',armorClass:'12',abilities:[spell('shield'),spell('counterspell')],playerDetails:{'slots.1.total':'4','slots.2.total':'3','slots.3.total':'2'}}
 const shield={...spell('shield'),id:50,ownerId:1,active:true,targets:[{id:1,damage:'0',resolved:true}],resolutionEffects:resolutionPlan(mage,spell('shield'),catalog,'slot:1').effects}
 const ward={...shield,id:51,ruleId:'test:ward',name:'Altra protezione',resolutionEffects:[{kind:'ac',amount:2,trigger:'always'}]}
 const stacked=spellEffectDetails(shield,[{id:1,name:'Aster',sheet:mage}],[ward],data)[0]
 assert.equal(spellEffectDetails({...shield,id:ward.id},[{id:1,name:'Aster',sheet:mage}],[ward],data)[0].armorClassBefore,14,'A new cast placeholder ID must not hide an unrelated existing effect')
 assert.deepEqual([stacked.armorClassBefore,stacked.armorClassBonus,stacked.armorClass],[14,5,19],'The preview includes existing AC effects exactly once')
 assert.deepEqual(spellEffectDetails(shield,[{id:1,name:'Aster',sheet:mage}],[ward,shield],data)[0],stacked,'An active summary does not count Shield twice')
 let game=await api(master,'/play/games','POST',{name:'Reazioni QA'}),path='/play/games/'+game.id
 await api(attackPlayer,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:attacker})
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:mage});game=await api(master,path)
 const turn=(sheet,id)=>({id,sheet,description:sheet.name,initiative:String(20-id),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[attacker,mage],state:{turns:[turn(attacker,0),turn(mage,1)],abilities:[],combat:{activeId:0,round:1}}})
 await page.goto(base+'/games/'+game.id);await view(page);await pp.goto(base+'/games/'+game.id);await view(pp)
 await pp.getByRole('button',{name:'Scudo · Usa',exact:true}).click()
 const shieldForm=pp.getByRole('form',{name:'Proposta: Scudo',exact:true})
 await shieldForm.getByText('Si applica solo a te stesso.',{exact:true}).waitFor();assert.equal(await shieldForm.getByRole('checkbox').count(),0)
 await page.getByRole('button',{name:'Pugnale · Usa',exact:true}).click()
 const attack=page.getByRole('form',{name:'Attacco: Pugnale',exact:true})
 await attack.getByRole('checkbox',{name:'Aster',exact:true}).check();await attack.getByLabel('Tiro per colpire (inserisci solo il numero del dado)',{exact:true}).fill('10');await attack.getByLabel('Tira danni',{exact:true}).fill('3')
 await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await attack.getByRole('button',{name:'Applica danni',exact:true}).click()
 const popup=pp.getByRole('dialog',{name:'Puoi usare una reazione',exact:true});await popup.waitFor();await popup.getByRole('button',{name:'Usa la reazione · invia al Master',exact:true}).waitFor()
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'22','Damage waits for the reaction')
 const window=game.reactionWindows.find(w=>w.status==='pending');assert(window)
 assert.deepEqual(await popup.getByRole('combobox',{name:'Reazione',exact:true}).locator('option').allTextContents(),['Scudo'],'Only reactions with the actual triggering event are offered')
 assert.equal(await popup.getByRole('checkbox').count(),0,'Shield never offers another target')
 await new Promise(r=>setTimeout(r,1200));assert(Number((await popup.getByRole('timer').innerText()).replace(/\D/g,''))<30)
 await popup.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:2')
 await until(async()=>((await api(master,path)).reactionWindows.find(w=>w.id===window.id)?.expiresAt??0)>window.expiresAt)
 assert(Number((await popup.getByRole('timer').innerText()).replace(/\D/g,''))>=29,'Interaction restarts the inactivity countdown')
 for(const width of [390,320]){await pp.setViewportSize({width,height:900});assert(await popup.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Popup fits at '+width);const bounds=await popup.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width,'Popup stays inside the viewport')}
 await popup.screenshot({path:join(root,'shield-reaction-popup.png')})
 await popup.getByRole('button',{name:'Usa la reazione · invia al Master',exact:true}).click();await popup.waitFor({state:'detached'})
 game=await api(master,path);const request=game.combatRequests.find(r=>r.actionName==='Scudo'&&r.status==='pending');assert(request)
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.2.used'],undefined,'Submitting alone does not spend the slot')
 await page.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 const notification=page.getByRole('dialog',{name:'Azioni dei giocatori',exact:true}).locator('.combat-request--review').filter({has:page.getByRole('heading',{name:'Scudo',exact:true})})
 const ac=notification.getByLabel('CA temporanea di Aster',{exact:true})
 await ac.waitFor();assert.equal(await ac.innerText(),'12 +5 = 17')
 await notification.getByText('Fino all’inizio del prossimo turno del bersaglio, incluso l’attacco scatenante.',{exact:true}).waitFor()
 assert.equal(await notification.getByText('Dettagli del calcolo',{exact:true}).count(),0,'No empty calculation disclosure')
 assert.equal(await notification.getByText(/^Verifiche del Master/).count(),0,'No obsolete generic warning for the supported Shield effect')
 await notification.screenshot({path:join(root,'shield-master-notification.png')})
 await page.getByRole('button',{name:'Chiudi azioni',exact:true}).click()
 // The normal Master approval remains in force. Approval is safe while the attack form waits.
 const resumedSave=page.waitForResponse(r=>r.url().endsWith('/state')&&r.request().method()==='PUT')
 game=await api(master,path+'/requests/'+request.id+'/approve','POST',{revision:game.revision,confirmed:true,targets:[{id:1,damage:'0'}]})
 await until(async()=>{const g=await api(master,path);return g.state.abilities.some(a=>a.ruleId==='phb2014:spell:shield'&&a.active)&&!await attack.getByText('Attendo le reazioni prima di applicare i danni…',{exact:true}).count()})
 assert((await resumedSave).ok(),'The resumed attack saves successfully')
 await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'22','Shield applies to the triggering attack: 15 misses AC 17')
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.2.used'],'1');assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['combat.reactionUsed'],'true')
 let opened=await api(master,path+'/reactions','POST',{revision:game.revision,event:{kind:'other',label:'Verifica reazioni',targetIds:[]}});assert(!opened.game.reactionWindows.some(w=>w.groupId===opened.groupId),'One reaction until the next own turn')
 // Advance to the owner: refresh the reaction and expire Shield at turn start.
 await page.getByRole('button',{name:/^Turno successivo/}).first().click();await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(master,path);assert.equal(game.state.combat.activeId,1);assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['combat.reactionUsed'],'false');assert(!game.state.abilities.some(a=>a.ruleId==='phb2014:spell:shield'&&a.active&&a.remainingTurns>0))
 // Other reactions are available through the Master signal, with their descriptions and normal forms.
 opened=await api(master,path+'/reactions','POST',{revision:game.revision,event:{kind:'other',label:'Verifica condizioni nella descrizione',targetIds:[]}});await popup.waitFor();await popup.getByRole('combobox',{name:'Reazione',exact:true}).locator('option').filter({hasText:'Controincantesimo'}).waitFor({state:'attached'})
 assert((await popup.getByRole('combobox',{name:'Reazione',exact:true}).locator('option').allTextContents()).includes('Controincantesimo'))
 const expiring=opened.game.reactionWindows.find(w=>w.groupId===opened.groupId)
 const renewed=await master.request.post(base+'/api'+path+'/reactions/'+expiring.id+'/activity',{data:{}});assert.equal(renewed.status(),200,'The Master can interact with the shared reaction countdown')
 // Advance only the isolated server clock: the production 30-second deadline stays unchanged.
 Date.now=()=>realNow()+offset;offset=31000
 await popup.waitFor({state:'detached'});game=await api(master,path)
 assert.equal(game.reactionWindows.find(w=>w.id===expiring.id).status,'expired')
 const late=await player.request.post(base+'/api'+path+'/reactions/'+expiring.id+'/activity',{data:{}});assert.equal(late.status(),409,'An expired opportunity cannot be revived')
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.2.used'],'1','Expiration consumes no resources')
 // A player-proposed attack must be blocked during the reaction and refreshed afterwards.
 await page.getByRole('button',{name:/^Turno successivo/}).first().click();await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await until(async()=>{game=await api(master,path);return game.state.combat.activeId===0})
 async function proposeHit(spellName,packets){
  const choices=await api(attackPlayer,path+'/actions'),action=choices.actions.find(a=>a.name===spellName),option=action.options.find(o=>o.id==='free'||o.id==='slot:1')
  await api(attackPlayer,path+'/requests','POST',{id:crypto.randomUUID(),revision:choices.revision,key:action.key,option:option.id,cost:1,mode:option.resolution.kind,damageEnabled:true,packets})
  game=await api(master,path);return game.combatRequests.findLast(r=>r.actionName===spellName&&r.status==='pending')
 }
 async function shieldReaction(source){
  game=await api(master,path);const win=game.reactionWindows.find(w=>w.event.requestId===source.id&&w.status==='pending');assert(win)
  const choices=await api(player,path+'/actions?preview=1'),action=choices.actions.find(a=>a.name==='Scudo')
  const proposed=await api(player,path+'/requests','POST',{id:crypto.randomUUID(),revision:choices.revision,key:action.key,reactionId:win.id,option:'slot:1',cost:1,mode:'none',damageEnabled:false,packets:[{targetId:1,damage:[]}]})
  const req=proposed.combatRequests.findLast(r=>r.actionName==='Scudo'&&r.status==='pending')
  game=await api(master,path+'/requests/'+req.id+'/approve','POST',{revision:proposed.revision,confirmed:true,targets:[{id:1,damage:'0'}]})
  const refreshed=game.combatRequests.find(r=>r.id===source.id);assert.equal(refreshed.status,'pending','The triggering request is refreshed without rerolling')
  const duplicate=await api(master,path+'/requests/'+req.id+'/approve','POST',{revision:game.revision,confirmed:true,targets:[{id:1,damage:'0'}]});assert.equal(duplicate.revision,game.revision,'Duplicate approval never spends twice')
  return refreshed
 }
 let source=await proposeHit('Pugnale',[{targetId:1,die:10,damage:[{type:'piercing',amount:3}]}])
 const early=await master.request.post(base+'/api'+path+'/requests/'+source.id+'/approve',{data:{revision:game.revision,confirmed:true,targets:[{id:1,damage:'5'}]}});assert.equal(early.status(),409,'Damage cannot bypass an open reaction window')
 source=await shieldReaction(source);assert.equal(source.targets[0].resolution.damage,0)
 game=await api(master,path+'/requests/'+source.id+'/approve','POST',{revision:game.revision,confirmed:true,targets:[{id:1,damage:'5'}]})
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'22','An old damage preview cannot bypass Shield')
 assert.equal(game.combatRequests.find(r=>r.id===source.id).targets[0].damage,'0','The Master history also records the damage after Shield')
 // Read API approvals into the browser before driving the next turn.
 await page.reload();await page.getByRole('button',{name:/^Turno successivo/}).first().waitFor()
 // Recover at the next own turn, then verify Shield against all Magic Missile darts.
 for(let i=0;i<2;i++){
  const desired=i===0?1:0;await page.getByRole('button',{name:/^Turno successivo/}).first().click()
  await until(async()=>{game=await api(master,path);return game.state.combat.activeId===desired});await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 }
 source=await proposeHit('Dardo Incantato',Array.from({length:3},()=>({targetId:1,damage:[{type:'force',amount:4}]})))
 source=await shieldReaction(source);assert.equal(source.targets[0].resolution.damage,0,'Shield prevents every Magic Missile dart')
 game=await api(master,path+'/requests/'+source.id+'/approve','POST',{revision:game.revision,confirmed:true,targets:[{id:1,damage:'15'}]})
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'22');assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.1.used'],'2')
 // Master spell form: a timeout resumes the original spell automatically, without using Shield.
 for(let i=0;i<2;i++){
  await page.reload();await page.getByRole('button',{name:/^Turno successivo/}).first().waitFor()
  const saved=page.waitForResponse(r=>r.url().endsWith('/state')&&r.request().method()==='PUT')
  await page.getByRole('button',{name:/^Turno successivo/}).first().click();assert((await saved).ok())
  await page.waitForFunction(id=>!Object.keys(localStorage).some(key=>key.startsWith('dev-and-dice.game-draft.')&&key.endsWith('.'+id)),game.id)
  await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 }
 await page.reload();await page.getByRole('button',{name:'Dardo Incantato · Usa',exact:true}).click()
 const missileForm=page.getByRole('form',{name:'Lancio: Dardo Incantato',exact:true})
 await missileForm.getByRole('checkbox',{name:'Aster',exact:true}).check()
 await missileForm.getByRole('button',{name:'Aggiungi colpo a Aster',exact:true}).click();await missileForm.getByRole('button',{name:'Aggiungi colpo a Aster',exact:true}).click()
 for(const input of await missileForm.getByLabel('Danni tirati',{exact:true}).all())await input.fill('4')
 await missileForm.getByRole('button',{name:'Calcola esiti',exact:true}).click()
 await page.waitForFunction(id=>!Object.keys(localStorage).some(key=>key.startsWith('dev-and-dice.game-draft.')&&key.endsWith('.'+id)),game.id)
 const savedMissile=page.waitForResponse(r=>r.url().endsWith('/state')&&r.request().method()==='PUT',{timeout:60000}).catch(error=>error)
 await page.getByRole('form',{name:'Conferma: Dardo Incantato',exact:true}).getByRole('button',{name:'Applica danni',exact:true}).click()
 await popup.waitFor();await popup.getByRole('button',{name:'Usa la reazione · invia al Master',exact:true}).waitFor()
 offset+=31000
 const savedResult=await savedMissile;if(savedResult instanceof Error)throw savedResult
 assert(savedResult.ok(),'The spell resumes automatically when the reaction timer expires')
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'7','All three darts apply when no reaction is chosen')
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.1.used'],'2','Timeout does not spend a reaction spell slot')
 assert.deepEqual(errors,[])
 console.log('PASS reactions: self-only Shield, out-of-turn popup, server deadline/reset, generic reactions, timeout, permissions, one reaction, start-turn recovery, Master approval and triggering attack recalculation')
}catch(e){console.error(e);await pp.screenshot({path:join(root,'reaction-player-failure.png'),fullPage:true});await page.screenshot({path:join(root,'reaction-master-failure.png'),fullPage:true});throw e}
finally{Date.now=realNow;await browser.close();await frontend.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
