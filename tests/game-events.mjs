// node tests/game-events.mjs — isolated server and browser; no production data.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,rm,mkdir,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
import {combatAvailability,spendCombatUse} from '../src/domain/dnd/CombatActions.ts'
import {captureGame,recordGameEvents,spellOpportunities,restoreSpellEvent} from '../server/game-events.mjs'
const rules=await combatRules(),spell=id=>templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
const dir=await mkdtemp(join(tmpdir(),'game-events-')),server=(await createApp({dataDir:dir,production:false,sessionSecret:'isolated-events-test-secret'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),master=await browser.newContext({viewport:{width:1440,height:1000}}),player=await browser.newContext({viewport:{width:1440,height:1000}}),dm=await master.newPage(),pc=await player.newPage(),errors=[]
const shots=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(shots,{recursive:true})
for(const p of [dm,pc]){p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message))}
async function api(c,path,method='GET',data){const r=await c.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function renewed(p){await p.getByRole('button',{name:'Impostazioni',exact:true}).click();await p.getByRole('radio',{name:/^Rinnovata/}).check();await p.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
let game,path
async function save(state,sheets){game=await api(master,path);game=await api(master,path+'/state','PUT',{revision:game.revision,state,sheets});return game}
async function closeWindows(){game=await api(master,path);for(const w of game.reactionWindows??[])if(w.status==='pending')await api(master,path+'/reactions/'+w.id+'/decline','POST');game=await api(master,path)}
// Move only the isolated archive's timestamps to test expiration without sleeping 30 seconds.
async function expirePopups(){const file=join(dir,'games.json'),db=JSON.parse(await readFile(file,'utf8'));for(const g of db.games)for(const w of g.reactionWindows??[])if(w.status==='pending'){w.expiresAt=Date.now()-60000;for(const key of Object.keys(w.actionExpiresAt??{}))w.actionExpiresAt[key]=w.expiresAt};await writeFile(file,JSON.stringify(db))}
try{
 await api(master,'/register','POST',{username:'EventsMaster',password:'isolated-password'});await api(player,'/register','POST',{username:'EventsPlayer',password:'isolated-password'})
 const caster={...newCharacterSheet(),name:'Aster',characterClass:'Mago',level:'11',intelligence:'18',hitPoints:'25',armorClass:'12',abilities:[spell('counterspell'),spell('false-life')],playerDetails:{'slots.3.total':'4','slots.1.total':'2'}},foe={...newCharacterSheet(),name:'NPC Mago',kind:'PNG',characterClass:'Mago',level:'11',intelligence:'18',hitPoints:'30',armorClass:'13',abilities:[spell('fireball')],playerDetails:{'slots.3.total':'4'}}
 game=await api(master,'/play/games','POST',{name:'Eventi QA'});await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:caster});path='/play/games/'+game.id
 const initial={turns:[caster,foe].map((sheet,id)=>({id,sheet,description:sheet.name,initiative:String(20-id),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})),abilities:[],combat:{activeId:1,round:1}}
 await save(initial,[caster,foe])
 let choices=await api(player,path+'/actions?preview=1');assert.match(choices.actions.find(a=>a.name==='Controincantesimo').availabilityReason,/Nessun evento/);assert.match(choices.actions.find(a=>a.name==='Vita Falsata').availabilityReason,/turno/)
 await pc.goto(base+'/games/'+game.id);await renewed(pc)
 let source=pc.getByRole('button',{name:'Controincantesimo · Non disponibile',exact:true});await source.waitFor();assert(await source.isDisabled());await source.scrollIntoViewIfNeeded();await pc.keyboard.press('Tab');await source.locator('..').focus();await pc.getByRole('tooltip').getByText(/Nessun evento disponibile/).waitFor();await pc.keyboard.press('Escape')
 await dm.goto(base+'/games/'+game.id);await renewed(dm);await dm.getByRole('button',{name:'Dettagli di Aster',exact:true}).click();const blocked=dm.getByRole('button',{name:'Controincantesimo · Non disponibile',exact:true});await blocked.waitFor();await blocked.click();assert(await blocked.isEnabled());await dm.getByRole('form',{name:'Lancio: Controincantesimo',exact:true}).waitFor()
 await dm.screenshot({path:join(shots,'event-availability-master.png'),fullPage:true})
 // A direct Master/NPC cast is grouped with its damage and resource expenditure.
 game=await api(master,path)
 async function cast(){
  await closeWindows();const before=structuredClone(game.state);delete before.actionEvents
  const id=crypto.randomUUID(),state=structuredClone(game.state),actor=game.characters.find(c=>c.id===foe.id).sheet,target=game.characters.find(c=>c.id===caster.id).sheet
  const ability={...spell('fireball'),id:8,ownerId:1,active:false,remainingTurns:0,requirementsConfirmed:true,targets:[{id:0,damage:'9',resolved:true}]}
  const spent=spendCombatUse(actor,ability,rules.catalog,rules.data,'slot:3',1,{abilities:state.abilities,ownerId:1,combat:state.combat}),hurt={...target,hitPoints:'16'}
  state.turns=state.turns.map(t=>t.id===0?{...t,sheet:hurt,hitPoints:'16'}:{...t,sheet:spent})
  state.actionEvents=[...(state.actionEvents??[]),{id,actorId:1,name:ability.name,ruleId:ability.ruleId,option:'slot:3',phase:'resolved',before,after:structuredClone({turns:state.turns,abilities:state.abilities,combat:state.combat})}].slice(-30)
  await save(state,[hurt,spent]);assert(game.spellOpportunities.some(t=>t.key==='event:'+id));assert(game.reactionWindows.some(w=>w.event.castKey==='event:'+id&&w.status==='pending'),'Automatic spell reaction popup')
  return id
 }
 const unreadBefore=(await api(player,path)).notifications.unreadCount
 const castId=await cast(),sequence=game.eventSequence,requestCount=game.combatRequests.length
 assert.equal((await api(player,path)).notifications.unreadCount,unreadBefore,'A direct Master action creates no unread notification')
 // Reading/configuring a form does not invalidate the cast, including while the popup is open.
 const configured=structuredClone(game.state);configured.abilities.push({...spell('false-life'),id:44,ownerId:0,active:false,remainingTurns:600,targets:[]})
 await save(configured,game.characters.map(c=>c.sheet));assert.equal(game.eventSequence,sequence);assert(game.spellOpportunities.some(t=>t.eventId===castId));assert.equal(game.combatRequests.length,requestCount,'Direct Master cast creates no approval notification')
 await expirePopups();game=await api(master,path);assert(game.spellOpportunities.some(t=>t.eventId===castId),'Case A: expiration alone keeps the cast available')
 const privateChoice=await api(player,path+'/counterspell?actorId=0');assert(privateChoice.targets.some(t=>t.key==='event:'+castId));assert(privateChoice.targets.every(t=>t.name===undefined&&t.level===undefined))
 await pc.reload();await pc.getByRole('button',{name:'Impostazioni',exact:true}).click();await pc.getByRole('radio',{name:/^Originale/}).check();await pc.getByRole('button',{name:'Torna al tavolo',exact:true}).click();await pc.getByRole('button',{name:'Scegli azione',exact:true}).click();await pc.getByRole('combobox',{name:'Azione',exact:true}).selectOption({label:'Controincantesimo'});await pc.getByRole('form',{name:'Lancio: Controincantesimo',exact:true}).waitFor();await renewed(pc)
 await pc.getByRole('button',{name:'Controincantesimo · Usa',exact:true}).click();const form=pc.getByRole('form',{name:'Lancio: Controincantesimo',exact:true});await form.waitFor();await form.getByRole('checkbox').check();await form.screenshot({path:join(shots,'event-counterspell-player.png')})
 const posted=pc.waitForResponse(r=>r.url().endsWith('/counterspell')&&r.request().method()==='POST');await form.getByRole('button',{name:'Usa Controincantesimo · invia al Master',exact:true}).click();assert((await posted).ok())
 game=await api(master,path);const pending=game.combatRequests.find(e=>e.status==='pending'&&e.counterspell);assert(pending)
 const approval={revision:game.revision,confirmed:true};const responses=await Promise.all([master.request.post(base+'/api'+path+'/requests/'+pending.id+'/approve',{data:approval}),master.request.post(base+'/api'+path+'/requests/'+pending.id+'/approve',{data:approval})]);assert(responses.every(r=>r.ok()),'Concurrent duplicate approvals are idempotent')
 game=await api(master,path);let aster=game.characters.find(c=>c.id===caster.id).sheet,npc=game.characters.find(c=>c.id===foe.id).sheet
 assert.equal(aster.hitPoints,'25','Applied damage is safely undone');assert.equal(aster.playerDetails['slots.3.used'],'1');assert.equal(npc.playerDetails['slots.3.used'],'1','Source slot is never refunded');assert.equal(npc.playerDetails['combat.actionUses'],'1');assert(!game.spellOpportunities.some(t=>t.eventId===castId))
 const log=await api(master,path+'/events'),publicLog=await api(player,path+'/events');assert(log.events.some(e=>e.id===castId&&e.countered));assert(log.events.some(e=>e.parentId===castId));assert.equal(log.events.find(e=>e.id===castId).label,'Palla di Fuoco');assert.equal(publicLog.events.find(e=>e.id===castId).label,'Lancio di incantesimo');assert(publicLog.events.every(e=>e.changes.every(c=>c.subject!=='NPC Mago')));assert(log.events.every((e,i,all)=>!i||e.sequence<all[i-1].sequence))
 await dm.reload();await dm.getByRole('button',{name:'Registro degli eventi',exact:true}).click();const journal=dm.getByRole('dialog',{name:'Registro degli eventi',exact:true});await journal.getByRole('heading',{name:'NPC Mago · Palla di Fuoco'}).waitFor();await journal.screenshot({path:join(shots,'event-journal-master.png')});await dm.getByRole('button',{name:'Chiudi registro degli eventi',exact:true}).click()
 // Master can resolve the same registered opportunity directly, while its popup is open.
 async function nextRound(){
  await closeWindows();game=await api(master,path);const state=structuredClone(game.state);state.combat.round++
  const sheets=game.characters.map(c=>({...c.sheet,playerDetails:{...c.sheet.playerDetails,'combat.reactionUsed':'false','combat.reactionUses':'0','combat.actionUsed':'false','combat.actionUses':'0','combat.spellsThisTurn':'[]','rules2014.spellsThisTurn':'[]'}}))
  await save(state,sheets)
 }
 await nextRound();const masterCast=await cast(),masterIntent={id:crypto.randomUUID(),revision:game.revision,actorId:0,targetKey:'event:'+masterCast,option:'slot:3',requirementsConfirmed:true,decision:{confirmed:true}}
 game=await api(master,path+'/counterspell','POST',masterIntent);assert.equal(game.characters.find(c=>c.id===caster.id).sheet.hitPoints,'25');assert.equal(game.characters.find(c=>c.id===caster.id).sheet.playerDetails['slots.3.used'],'2');assert.equal(game.combatRequests.find(e=>e.id===masterIntent.id).status,'approved')
 await nextRound();const second=await cast();await expirePopups();game=await api(master,path)
 const staleId=crypto.randomUUID();game=await api(player,path+'/counterspell','POST',{id:staleId,revision:game.revision,actorId:0,targetKey:'event:'+second,option:'slot:3',requirementsConfirmed:true});game=await api(master,path)
 const unrelated=game.characters.map(c=>c.id===foe.id?{...c.sheet,hitPoints:'29'}:c.sheet);await save(game.state,unrelated);assert(!game.spellOpportunities.some(t=>t.eventId===second),'Case B: a real independent modification closes the cast')
 const staleApproval=await master.request.post(base+'/api'+path+'/requests/'+staleId+'/approve',{data:{revision:game.revision,confirmed:true}});assert.equal(staleApproval.status(),409);assert.equal((await api(master,path)).characters.find(c=>c.id===caster.id).sheet.playerDetails['slots.3.used'],'2','Invalidated reactions never spend a slot')
 const denied=await player.request.post(base+'/api'+path+'/counterspell',{data:{id:crypto.randomUUID(),revision:game.revision,actorId:0,targetKey:'event:'+second,option:'slot:3',requirementsConfirmed:true}});assert.equal(denied.status(),409)
 await pc.reload();await pc.getByRole('button',{name:'Controincantesimo · Non disponibile',exact:true}).waitFor();await pc.setViewportSize({width:390,height:844});await pc.screenshot({path:join(shots,'event-availability-player-mobile.png'),fullPage:true})
 // Pure inverse guards cover temporary HP, conditions and unrelated fields too.
 const isolated={characters:structuredClone(game.characters).map(c=>({...c,gameId:game.id}))},testGame={...game,masterId:game.characters.find(c=>c.id===foe.id).ownerId,players:game.characters.filter(c=>c.id===caster.id).map(c=>({userId:c.ownerId,characterId:c.id})),state:structuredClone(game.state),events:[],eventSequence:0,combatRequests:[],reactionWindows:[]};delete testGame.eventBoundary;testGame.state.actionEvents=[]
 const old=structuredClone(testGame.state),before=captureGame(isolated,testGame),testId=crypto.randomUUID(),target=isolated.characters.find(c=>c.id===caster.id).sheet,enemy=isolated.characters.find(c=>c.id===foe.id).sheet,originalHP=target.hitPoints
 target.hitPoints='4';target.playerDetails.temporaryHitPoints='6';enemy.playerDetails['slots.3.used']='4';enemy.playerDetails['wizard.resource.test.remaining']='0';enemy.playerDetails['combat.actionUses']='1'
 testGame.state.turns=testGame.state.turns.map(t=>({...t,sheet:isolated.characters.find(c=>c.id===t.sheet.id).sheet,hitPoints:isolated.characters.find(c=>c.id===t.sheet.id).sheet.hitPoints,temporaryHitPoints:t.id===0?'6':''}))
 testGame.state.abilities.push({id:400,ownerId:0,name:'Condizione del lancio',active:true,timed:false,duration:'Senza conteggio',remainingTurns:0,resolutionEffects:[{kind:'condition',condition:'unconscious',trigger:'always'}]})
 const end=structuredClone(testGame.state);delete end.actionEvents
 testGame.state.actionEvents=[{id:testId,actorId:1,name:'Palla di Fuoco',ruleId:'phb2014:spell:fireball',option:'slot:3',phase:'resolved',before:old,after:end}]
 recordGameEvents(isolated,testGame,before,{userId:'test',username:'Master'},rules);assert(spellOpportunities(testGame).some(t=>t.eventId===testId))
 target.notes='Unrelated note survives';const inverse=restoreSpellEvent(isolated,testGame,testId);assert.equal(inverse.sheets.find(s=>s.id===target.id).hitPoints,originalHP);assert.equal(inverse.sheets.find(s=>s.id===target.id).notes,target.notes);assert.equal(inverse.sheets.find(s=>s.id===target.id).playerDetails.temporaryHitPoints,undefined);assert(!inverse.state.abilities.some(a=>a.id===400));assert.equal(inverse.sheets.find(s=>s.id===foe.id).playerDetails['slots.3.used'],'4');assert.equal(inverse.sheets.find(s=>s.id===foe.id).playerDetails['wizard.resource.test.remaining'],'0')
 target.hitPoints='3';assert.throws(()=>restoreSpellEvent(isolated,testGame,testId),/modificato/,'A changed delta cannot be overwritten');assert.equal(target.hitPoints,'3')
 assert.match(combatAvailability(caster,{...spell('counterspell'),id:9,ownerId:0,active:false,remainingTurns:0},rules.catalog,rules.data,{abilities:[],ownerId:0,combat:initial.combat,reactionAvailable:false}),/Nessun evento/)
 // Two gameplay operations batched in one save retain distinct boundaries.
 const waking={...testGame,state:{...testGame.state,abilities:[]},events:[{id:testId,cast:{actorId:1},changes:[{scope:'ability',id:400,path:[],before:testGame.state.abilities.find(a=>a.id===400),after:null}]}],eventBoundary:testId};assert.equal(spellOpportunities(waking,0).length,0,'Damage that wakes a sleeping target cannot retroactively enable its reaction')
 const batched=structuredClone(testGame),batchedDb=structuredClone(isolated);batched.events=[];batched.eventSequence=0;delete batched.eventBoundary;batched.state.actionEvents=[];batched.combatRequests=[];batched.reactionWindows=[]
 const captured=captureGame(batchedDb,batched),start=structuredClone(batched.state),afterCast=structuredClone(batched.state),batchId=crypto.randomUUID();batched.state.actionEvents=[{id:batchId,actorId:1,name:'Palla di Fuoco',ruleId:'phb2014:spell:fireball',option:'slot:3',phase:'resolved',before:start,after:afterCast}];batched.state.combat.round++
 recordGameEvents(batchedDb,batched,captured,{userId:'test',username:'Master'},rules);assert(!spellOpportunities(batched).some(t=>t.eventId===batchId),'A following turn change in the same save closes the opportunity')
 assert.deepEqual(errors,[]);console.log('PASS events: server ordering, direct Master/NPC journal, private player view, accessible role-specific cards, automatic popup, time-independent window, configuration immunity, safe inverse, unique consumption, concurrent approval, persistence and next-event closure')
}catch(error){await dm.screenshot({path:join(shots,'events-master-failure.png'),fullPage:true}).catch(()=>{});await pc.screenshot({path:join(shots,'events-player-failure.png'),fullPage:true}).catch(()=>{});throw error}finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
