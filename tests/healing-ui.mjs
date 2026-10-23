// Run: node tests/healing-ui.mjs — 2014 Cure Wounds, player → Master → persisted HP.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {resolutionPlan,assertPacketPlan,resolveTarget,defenseProfile} from '../src/domain/dnd/CombatResolution.ts'
import {combatTargeting,targetTypeError} from '../src/domain/dnd/CombatTargets.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'healing-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'healing-isolated-test-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true})
const master=await browser.newContext({viewport:{width:1600,height:1050}}),player=await browser.newContext({viewport:{width:390,height:950}}),page=await player.newPage(),dm=await master.newPage(),errors=[]
for(const p of [page,dm]){p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message))}
async function api(user,path,method='GET',data){const r=await user.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function renewed(p){await p.getByRole('button',{name:'Impostazioni',exact:true}).click();await p.getByRole('radio',{name:/^Rinnovata/}).check();await p.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
try {
 await api(master,'/register','POST',{username:'HealingMaster',password:'test-password-123'})
 await api(player,'/register','POST',{username:'HealingPlayer',password:'test-password-123'})
 const {catalog}=await combatRules(),cure=templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:cure-wounds'))
 const caster={...newCharacterSheet(),name:'Guaritore',kind:'PG',characterClass:'Chierico',level:'5',wisdom:'16',intelligence:'20',hitPoints:'8',armorClass:'13',abilities:[cure],playerDetails:{maxHitPoints:'30','slots.1.total':'3','slots.1.used':'0','slots.2.total':'3','slots.2.used':'0'}}
 const ally={...newCharacterSheet(),name:'Alleato',kind:'PG',race:'Umano',hitPoints:'10',armorClass:'14',playerDetails:{maxHitPoints:'20',temporaryHitPoints:'4','rules2014.concentration':'test-concentration','combat.resistances':'fuoco'}}
 const construct={...newCharacterSheet(),name:'Golem',kind:'Mostro',race:'Construct',hitPoints:'10',armorClass:'15',playerDetails:{maxHitPoints:'30'}}
 const undead={...construct,id:crypto.randomUUID(),name:'Scheletro',race:'Undead'},unknown={...construct,id:crypto.randomUUID(),name:'Sconosciuto',race:''}
 const plan=resolutionPlan(caster,cure,catalog,'slot:1'),upcast=resolutionPlan(caster,cure,catalog,'slot:2'),profile=defenseProfile(ally,undefined,[],2),packet=raw=>[{targetId:2,damage:[],healingRoll:raw}]
 assert.equal(plan.healing.modifier,3);assert.equal(plan.healing.dice,'1d8');assert.equal(upcast.healing.dice,'2d8')
 assert.equal(resolveTarget(plan,packet(8),profile).healing,10,'Capped at missing HP')
 assert.equal(resolveTarget(plan,packet(1),profile).healing,4,'Correct casting ability, once')
 assert.equal(resolveTarget(upcast,packet(2),profile).healing,5,'Modifier added once when upcast')
 assert.equal(resolveTarget({...plan,healing:{...plan.healing,modifier:-5}},packet(1),profile).healing,0,'Negative totals never cause damage')
 assert.equal(resolveTarget(plan,packet(4),{...profile,hitPoints:20}).healing,0)
 assert.equal(resolveTarget(plan,packet(4),{...profile,hitPoints:0}).healing,7,'Healing works at zero HP')
 assert.equal(resolveTarget(plan,packet(4),{...profile,maxHitPoints:undefined}).healing,null,'Missing maximum requires correction')
 for(const bad of [[],packet(0),packet(9),[{targetId:2,damage:[]}],packet(1).concat(packet(1))])assert.throws(()=>assertPacketPlan(plan,bad,1))
 assert.throws(()=>assertPacketPlan({...plan,healing:undefined},packet(4),1),'Unexpected healing dice rejected')
 const rule=combatTargeting(cure,catalog,caster,'slot:1')
 for(const type of ['construct','undead',undefined])assert(targetTypeError(rule,type))
 assert.equal(targetTypeError(rule,'humanoid'),undefined)
 assert.equal(resolutionPlan({...caster,playerDetails:{...caster.playerDetails,'rules.edition':'2024'}},cure,catalog,'slot:1'),undefined,'2014 healing never leaks into 2024')
 let game=await api(master,'/play/games','POST',{name:'Guarigione QA'}),path='/play/games/'+game.id
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:caster});game=await api(master,path)
 for(const sheet of [ally,construct,undead,unknown]){await api(master,'/play/characters','POST',{sheet});game=await api(master,path+'/characters','POST',{characterId:sheet.id,revision:game.revision})}
 const turn=(sheet,index)=>({id:index+1,sheet,description:sheet.name,initiative:String(20-index),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:sheet.playerDetails?.temporaryHitPoints??''})
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[caster,ally,construct,undead,unknown],state:{turns:[caster,ally,construct,undead,unknown].map(turn),abilities:[],combat:{activeId:1,round:1}}})
 for(const p of [page,dm]){await p.goto(base+'/games/'+game.id);await renewed(p)}
 await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 const choices=await api(player,path+'/actions'),action=choices.actions.find(a=>a.name===cure.name)
 async function badProposal(packets){const r=await player.request.post(base+'/api'+path+'/requests',{data:{id:crypto.randomUUID(),revision:choices.revision,key:action.key,option:'slot:1',cost:1,mode:'none',damageEnabled:false,packets}});assert.equal(r.status(),400,await r.text())}
 for(const id of [3,4,5])await badProposal([{targetId:id,damage:[],healingRoll:4}])
 await badProposal([{targetId:2,damage:[],healingRoll:9}])
 await page.getByRole('button',{name:cure.name+' · Usa',exact:true}).click()
 const form=page.getByRole('form',{name:'Proposta: '+cure.name,exact:true})
 await form.waitFor()
 assert.equal(await form.getByText(cure.name,{exact:true}).count(),0,'No duplicated spell name')
 for(const label of ['Costo','Risoluzione'])assert.equal(await form.getByLabel(label,{exact:true}).count(),0)
 for(const name of ['Golem','Scheletro','Sconosciuto'])assert(await form.getByRole('checkbox',{name,exact:true}).isDisabled())
 assert(await form.getByRole('button',{name:'Invia al Master',exact:true}).isDisabled(),'A healing target is required')
 await form.getByRole('checkbox',{name:'Alleato',exact:true}).check()
 const raw=form.getByLabel('Guarigione tirata',{exact:true}),resource=form.getByRole('combobox',{name:'Risorsa',exact:true})
 assert.equal(await form.getByRole('img',{name:'d8',exact:true}).count(),1)
 assert.equal(await form.getByLabel('Modificatore di guarigione',{exact:true}).innerText(),'+3')
 await raw.fill('9');assert(await form.getByRole('button',{name:'Invia al Master',exact:true}).isDisabled())
 await resource.selectOption('slot:2');await raw.fill('10')
 await form.getByRole('status',{name:'Totale guarigione',exact:true}).getByText('13',{exact:true}).waitFor()
 await resource.selectOption('slot:1');await raw.fill('8')
 for(const width of [1600,390,320])for(const colorScheme of ['light','dark']){
  await page.setViewportSize({width,height:950});await page.emulateMedia({colorScheme})
  assert(await form.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Healing form fits at '+width)
  assert(await form.locator('.ability-target-list').first().evaluate(e=>e.scrollHeight<=e.clientHeight+1),'The healing target block grows without internal scrolling at '+width)
  await form.screenshot({path:join(root,`healing-form-${colorScheme}-${width}.png`)})
 }
 const sent=page.waitForResponse(r=>r.url().endsWith('/requests')&&r.request().method()==='POST')
 await form.getByRole('button',{name:'Invia al Master',exact:true}).click();const response=await sent;assert(response.ok(),await response.text())
 game=await api(master,path)
 assert.equal(game.characters.find(c=>c.id===caster.id).sheet.playerDetails['slots.1.used'],'0','Proposal spends nothing')
 assert.equal(game.combatRequests.find(r=>r.status==='pending').targets[0].resolution.healing,10)
 await dm.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 const notification=dm.locator('.combat-request').filter({has:dm.getByRole('heading',{name:cure.name,exact:true})})
 await notification.getByText('PF da curare a Alleato:',{exact:true}).waitFor()
 await notification.getByText('Guarigione',{exact:true}).waitFor()
 assert.equal(await notification.getByLabel(/Danni finali/).count(),0)
 await notification.getByRole('button',{name:'Approva azione',exact:true}).evaluate(button=>{button.click();button.click()})
 await notification.getByText('Approvata',{exact:true}).waitFor()
 game=await api(master,path)
 assert.equal(game.state.turns[1].hitPoints,'20');assert.equal(game.characters.find(c=>c.id===ally.id).sheet.hitPoints,'20')
 assert.equal(game.characters.find(c=>c.id===ally.id).sheet.playerDetails.temporaryHitPoints,'4')
 assert.equal(game.characters.find(c=>c.id===caster.id).sheet.playerDetails['slots.1.used'],'1')
 assert.equal(game.state.turns[1].concentrationChecks?.length??0,0,'Healing never prompts concentration checks')
 await dm.getByRole('button',{name:'Chiudi azioni',exact:true}).click()
 await dm.getByRole('button',{name:cure.name+' · Usa',exact:true}).click()
 const masterForm=dm.getByRole('form',{name:'Lancio: '+cure.name,exact:true})
 const masterCard=dm.locator('#'+await masterForm.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," ability-row ")][1]').getAttribute('id'))
 await masterForm.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:2')
 await masterForm.getByRole('checkbox',{name:'Tu (Guaritore)',exact:true}).check()
 await masterForm.getByLabel('Guarigione tirata',{exact:true}).fill('10')
 await masterForm.getByRole('button',{name:'Calcola esiti',exact:true}).click()
 const review=masterCard.getByRole('region',{name:'Esiti: '+cure.name,exact:true})
 await review.getByText('PF da curare a Guaritore:',{exact:true}).waitFor()
 await review.getByRole('button',{name:'Modifica tiri',exact:true}).click()
 assert.equal(await masterForm.getByLabel('Guarigione tirata',{exact:true}).inputValue(),'10')
 await masterForm.getByRole('button',{name:'Calcola esiti',exact:true}).click()
 assert(await review.getByRole('button',{name:'Applica cura',exact:true}).isDisabled(),'Another action spell in the same turn requires confirmation')
 await review.getByRole('checkbox',{name:/Confermo un’altra azione valida/}).check()
 await review.getByRole('button',{name:'Applica cura',exact:true}).click()
 await review.waitFor({state:'detached'});await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(master,path)
 assert.equal(game.state.turns[0].hitPoints,'21');assert.equal(game.characters.find(c=>c.id===caster.id).sheet.hitPoints,'21')
 assert.equal(game.characters.find(c=>c.id===caster.id).sheet.playerDetails['slots.2.used'],'1')
 await dm.reload();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 assert.equal((await api(master,path)).state.turns[0].hitPoints,'21','Healing persists across reload')
 assert.deepEqual(errors,[])
 console.log('PASS healing: dice/modifier/upcast, typed targets, forged requests, player and Master forms, approvals, capped HP, temporary HP, no concentration checks, once-only slots and persistence')
}catch(error){await page.screenshot({path:join(root,'healing-player-failure.png'),fullPage:true});await dm.screenshot({path:join(root,'healing-master-failure.png'),fullPage:true});console.error('Browser errors',errors);throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
