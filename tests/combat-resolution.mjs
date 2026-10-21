// Run: node tests/combat-resolution.mjs — rule boundaries plus isolated authenticated API.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,rm,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {createApp} from '../server/index.mjs'
import {combatRules,validCombatRequest,recordResolutionRoll,visibleRequests,pendingSavingThrows,actionContext,prepareAction,requestProposal,createRequestResolution,applyCombatRequest} from '../server/combat-requests.mjs'
import {defenseProfile,resolveTarget,assertPacketPlan,validPackets,activeEffects,resolutionPlan,packetTargets} from '../src/domain/dnd/CombatResolution.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'

const base={edition:'2014',kind:'attack',damageTypes:['fire'],damageHint:'1d10',attackBonus:5,maximumPackets:1,sharedDamage:false,magical:true,effects:[],notes:[]}
const defender={...newCharacterSheet(),name:'Difensore',armorClass:'14',dexterity:'14',playerDetails:{'combat.resistances':'fuoco','save.dexterity':'2'}}
const packet=(die,amount=11)=>({targetId:2,die,damage:[{type:'fire',amount}]})
for(const edition of ['2014','2024']) {
 const p={...base,edition},profile=defenseProfile(defender,'dexterity',[],2)
 assert.equal(resolveTarget(p,[packet(9)],profile).damage,5,'An AC tie hits, then resistance rounds down')
 assert.equal(resolveTarget(p,[packet(8)],profile).damage,0,'A miss causes zero damage')
 assert.equal(resolveTarget({...p,attackBonus:100},[packet(1)],profile).damage,0,'A natural 1 misses')
 assert.equal(resolveTarget(p,[packet(20)],profile).damage,null,'The critical needs extra dice, not a doubled total')
 assert.equal(resolveTarget(p,[packet(20)],profile,{critical:{'0:fire':6}}).damage,8,'Extra dice precede resistance')
 const rays={...p,maximumPackets:3},noResistance={...profile,resistances:[]}
 const partial=resolveTarget(rays,[packet(9,3),packet(20,7)],noResistance)
 assert.equal(partial.packets[0].damage,3);assert.equal(partial.packets[1].damage,null);assert.equal(partial.damage,null)
 assert(partial.packets[1].steps[0].endsWith('dadi critici da inserire'),'A pending critical must not show its base damage as a final result')
 const completed=resolveTarget(rays,[packet(9,3),packet(20,7)],noResistance,{critical:{'1:fire':6}})
 assert.equal(completed.packets[1].damage,13);assert.equal(completed.damage,16,'Each ray keeps its own damage, then the target total includes only that ray’s critical dice')
 assert.match(completed.packets[1].steps[0],/7 \+ 6 \(critico\) → 13/)
 assert.equal(resolveTarget(p,[packet(15)],{...profile,resistances:[...profile.resistances,...profile.resistances],vulnerabilities:[{type:'fire',when:'always',source:'Test'}]}).damage,10,'Resistance does not stack and is applied before vulnerability')
 assert.equal(resolveTarget(p,[packet(15)],{...profile,immunities:[{type:'fire',when:'always',source:'Test'}]}).damage,0)
 const save={...p,kind:'save',save:{ability:'dexterity',dc:13,onSuccess:'half'},sharedDamage:true,maximumPackets:null}
 const savePacket={targetId:2,damage:[{type:'fire',amount:21}]}
 assert.equal(resolveTarget(save,[savePacket],profile).damage,null,'The caster cannot supply the defender save')
 assert.equal(resolveTarget(save,[savePacket],profile,{save:11}).damage,5,'A successful save halves before resistance')
 assert.equal(resolveTarget({...save,save:{ability:'dexterity',dc:13,onSuccess:'none'}},[savePacket],profile,{save:11}).damage,0)
 assert.equal(resolveTarget(save,[savePacket],{...profile,saveBonus:30},{save:1}).save.success,true,'A natural 1 is not an automatic failed save')
 assert.equal(resolveTarget(save,[savePacket],{...profile,saveBonus:-30},{save:20}).save.success,false,'A natural 20 is not an automatic successful save')
 const mixed={...p,damageTypes:['fire','slashing']}
 assert.equal(resolveTarget(mixed,[{targetId:2,die:15,damage:[{type:'fire',amount:11},{type:'slashing',amount:7}]}],profile).damage,12,'Different damage types are processed separately')
 assert.throws(()=>assertPacketPlan(save,[savePacket,{...savePacket,targetId:3,damage:[{type:'fire',amount:20}]}],null),'Area damage uses one shared roll')
 assert.equal(resolveTarget(p,[packet(15)],{...profile,armorClass:undefined}).damage,null)
 assert.equal(resolveTarget({...p,magical:null},[packet(15)],{...profile,resistances:[{type:'fire',when:'nonmagical',source:'Test'}]}).damage,null)
 for(const die of [0,21,1.5])assert.equal(validPackets([packet(die)]),false)
}
const buff={id:1,name:'Protezione',ruleId:'test-shield',ownerId:1,active:true,duration:'1 minuto',remainingTurns:10,targets:[{id:2,damage:'0',resolved:true}],resolutionEffects:[{kind:'ac',amount:2,trigger:'always'}]}
assert.equal(defenseProfile(defender,undefined,[buff,{...buff,id:2}],2).armorClass,16,'The same spell cannot stack its AC bonus')
assert.equal(defenseProfile(defender,undefined,[buff],1).armorClass,14,'A targeted buff does not also affect its caster')
assert.equal(activeEffects([{...buff,active:false},{...buff,id:2,sourceEffectId:1}]).length,0,'Linked effects end with their source')

const rules=await combatRules(),template=id=>templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
const magicSheet={...newCharacterSheet(),level:'5',playerDetails:{spellAttackBonus:'5',spellDC:'13'}}
assert.equal(resolutionPlan({...magicSheet,characterClass:'Mago'},template('scorching-ray'),rules.catalog).attackAbility,'intelligence')
assert.equal(resolutionPlan({...magicSheet,characterClass:'Mago',playerDetails:{...magicSheet.playerDetails,castingAbility:'Saggezza'}},template('scorching-ray'),rules.catalog).attackAbility,'wisdom','An explicit casting attribute is respected without changing the attack total')
const gust=resolutionPlan(magicSheet,template('gust-of-wind'),rules.catalog,'slot:2')
assert.equal(gust.kind,'none','Gust of Wind has no immediate saving throw when cast')
assert.equal(gust.save,undefined);assert.deepEqual(gust.damageTypes,[])
assert.deepEqual(gust.deferredSave,{ability:'strength',dc:13,trigger:'start-own-turn-in-line',pushFt:15})
assert.equal(resolveTarget(gust,[{targetId:2,damage:[]}],defenseProfile(defender,undefined,[],2)).save,undefined,'No save is requested prematurely')
const acid=resolutionPlan(magicSheet,template('acid-splash'),rules.catalog)
assert.equal(acid.save.onSuccess,'none','Acid Splash deals no damage on a successful save')
assert.equal(acid.damageHint,'2d6','Cantrip dice follow character level')
const bless=resolutionPlan(magicSheet,template('bless'),rules.catalog),bane=resolutionPlan(magicSheet,template('bane'),rules.catalog)
assert.equal(bless.effects[0].sign,1);assert.equal(bane.effects[0].sign,-1)
const profile=defenseProfile(defender,'dexterity',[],2),savePlan={...base,kind:'save',save:{ability:'dexterity',dc:13,onSuccess:'half'},maximumPackets:null,sharedDamage:true}
const blessing={id:10,label:'Benedizione',sides:4,sign:1,consume:false},curse={id:11,label:'Anatema',sides:4,sign:-1,consume:false}
assert.equal(resolveTarget(base,[packet(9)],{...profile,attackMode:'disadvantage'}).packets[0].needsSecondDie,true)
assert.equal(resolveTarget(base,[packet(9)],{...profile,attackMode:'disadvantage'},{attacks:{0:8}}).damage,0)
assert.equal(resolveTarget(base,[packet(8)],{...profile,attackMode:'advantage'},{attacks:{0:9}}).damage,5)
assert.equal(resolveTarget(base,[packet(8)],{...profile,attackDice:[blessing]}).damage,null)
assert.equal(resolveTarget(base,[packet(8)],{...profile,attackDice:[blessing]},{attackBonuses:{'0:10':1}}).damage,5)
assert.equal(resolveTarget(base,[packet(9)],{...profile,attackDice:[blessing]},{attackBonuses:{'0:10':0}}).damage,5,'A positive optional die can be declined')
assert.throws(()=>resolveTarget(base,[packet(9)],{...profile,attackDice:[curse]},{attackBonuses:{'0:11':0}}),'Bane cannot be declined')
const savePacket={targetId:2,damage:[{type:'fire',amount:21}]}
assert.equal(resolveTarget(savePlan,[savePacket],{...profile,saveMode:'advantage'},{save:1,saveSecond:11}).damage,5)
assert.equal(resolveTarget(savePlan,[savePacket],{...profile,automaticSaveFailure:true}).damage,10,'Paralysis needs no Strength/Dexterity die')
assert.equal(resolveTarget({...base,kind:'automatic',ruleId:'phb2014:spell:magic-missile'},[{targetId:2,damage:[{type:'force',amount:4}]}],{...profile,spellImmunities:['phb2014:spell:magic-missile']}).damage,0)
const casterId=crypto.randomUUID(),playerId=crypto.randomUUID(),masterId=crypto.randomUUID(),characterId=crypto.randomUUID()
const proposal={id:crypto.randomUUID(),revision:0,key:'0',option:'free',cost:1,mode:'save',damageEnabled:true,packets:[savePacket],targets:packetTargets([savePacket])}
const archived={id:proposal.id,ownerId:casterId,characterId:crypto.randomUUID(),characterName:'Maga',actorName:'Caster',actionName:'Fiammata',optionLabel:'Gratuita',prolonged:false,createdAt:new Date().toISOString(),status:'pending',proposal,targets:proposal.targets.map(t=>({...t,name:'Difensore'})),resolution:{plan:savePlan,targets:[{id:2,characterId,profile,rolls:{}}]}}
assert(validCombatRequest(archived));assert(validCombatRequest(JSON.parse(JSON.stringify(archived))),'Snapshots survive JSON persistence')
for(const change of [e=>e.resolution.targets[0].profile.resistances=null,e=>e.resolution.plan.damageTypes=['invented'],e=>e.resolution.plan.attackAbility=['intelligence'],e=>e.resolution.plan.attackAbility='invented',e=>e.resolution.targets[0].rolls.save=21,e=>e.resolution.targets.push(e.resolution.targets[0])]) {const bad=structuredClone(archived);change(bad);assert.equal(validCombatRequest(bad),false)}
const game={revision:0,masterId,players:[{userId:casterId,characterId:archived.characterId},{userId:playerId,characterId}],combatRequests:[archived]}
assert.equal(visibleRequests(game,casterId)[0].targets[0].resolution,undefined)
assert.equal(visibleRequests(game,masterId)[0].targets[0].resolution.damage,null)
assert.equal(visibleRequests(game,masterId)[0].characterId,archived.characterId,'Action details identify their owner by ID rather than a potentially shared name')
assert.equal(pendingSavingThrows({},game,playerId)[0].ability,'dexterity');assert.equal(pendingSavingThrows({},game,playerId)[0].dc,undefined)
assert.throws(()=>recordResolutionRoll({},game,casterId,archived,{targetId:2,kind:'save',value:11}),e=>e.status===403)
recordResolutionRoll({},game,playerId,archived,{targetId:2,kind:'save',value:11})
recordResolutionRoll({},game,playerId,archived,{targetId:2,kind:'save',value:11})
assert.equal(archived.rollsRevision,1,'Retries do not change the stored dice')
assert.throws(()=>recordResolutionRoll({},game,playerId,archived,{targetId:2,kind:'save',value:12}),e=>e.status===409)
assert.equal(visibleRequests(game,masterId)[0].targets[0].resolution.damage,5)
assert.equal(pendingSavingThrows({},game,playerId).length,0)
assert(validCombatRequest(archived))
assert.equal(game.revision,0,'Recording dice does not invalidate other pending requests')
// Run approval directly too: this needs no listener and exercises the same transaction logic.
const gameId=crypto.randomUUID(),mage={...magicSheet,name:'Maga',characterClass:'Mago',abilities:['hold-person','bless','resistance','fireball'].map(template),playerDetails:{...magicSheet.playerDetails,'slots.1.total':'20','slots.2.total':'20','slots.3.total':'20'}},victim={...defender,id:characterId,name:'Difensore',wisdom:'10',charisma:'10',hitPoints:'50'}
const db={characters:[{id:mage.id,ownerId:casterId,gameId,sheet:mage},{id:victim.id,ownerId:playerId,gameId,sheet:victim}]}
const table={id:gameId,masterId,revision:0,players:[{userId:casterId,characterId:mage.id},{userId:playerId,characterId:victim.id}],state:{turns:[mage,victim].map((sheet,i)=>({id:i+1,sheet,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,temporaryHitPoints:'',armorClass:sheet.armorClass})),abilities:[],combat:{activeId:1,round:1}}}
function propose(spellId,packets) {
 const context=actionContext(db,table,casterId,rules),action=context.actions.find(a=>a.ability.name===template(spellId).name),option=action.options.find(o=>o.id.startsWith('slot:'))??action.options[0],plan=resolutionPlan(context.record.sheet,action.ability,context.catalog,option.id)
 const proposal=requestProposal({id:crypto.randomUUID(),revision:table.revision,key:action.key,option:option.id,cost:option.cost??1,mode:plan.kind,damageEnabled:!!plan.damageTypes.length,packets})
 prepareAction(context,proposal,rules)
 const entry={...archived,id:proposal.id,characterId:mage.id,actionName:action.ability.name,proposal,targets:proposal.targets.map(t=>({...t,name:'Difensore'})),resolution:createRequestResolution(db,table,context,action,proposal,rules)}
 assert(validCombatRequest(entry));return entry
}
function approve(entry,damage='0',extra={}) {
 const result=applyCombatRequest(db,table,entry,rules,{confirmed:true,targets:[{id:2,damage}],...extra})
 table.state=result.state;for(const sheet of result.sheets)db.characters.find(r=>r.id===sheet.id).sheet=sheet
 table.revision++
 for(const r of db.characters)r.sheet={...r.sheet,playerDetails:{...r.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}}
 return result
}
const held=propose('hold-person',[{targetId:2,damage:[]}])
recordResolutionRoll(db,table,playerId,held,{targetId:2,kind:'save',value:1})
assert.throws(()=>applyCombatRequest(db,table,held,rules,{confirmed:true,targets:[{id:2,damage:'0'}],effects:true}),e=>e.status===400)
approve(held)
const paralysis=table.state.abilities.find(a=>a.resolutionEffects?.some(e=>e.condition==='paralyzed'))
assert(paralysis?.sourceEffectId!==undefined,'A failed save creates a condition linked to concentration')
assert.equal(actionContext(db,{...table,state:{...table.state,combat:{activeId:2,round:1}}},playerId,rules,true).canPropose,false,'Paralysis prevents taking actions')
const fire=propose('fireball',[{targetId:2,damage:[{type:'fire',amount:21}]}])
assert.equal(fire.resolution.targets[0].profile.automaticSaveFailure,true)
assert.equal(pendingSavingThrows(db,{...table,combatRequests:[fire]},playerId).length,0)
const failedDamage=visibleRequests({...table,combatRequests:[fire]},masterId)[0].targets[0].resolution.damage
assert.equal(failedDamage,10,'Automatic failure still applies the target resistance')
approve(fire,'10')
assert.equal(db.characters[1].sheet.hitPoints,'40')
assert(activeEffects(table.state.abilities).some(a=>a.id===paralysis.id),'An instantaneous spell does not break concentration')
const blessingEntry=propose('bless',[{targetId:2,damage:[]}]);approve(blessingEntry)
assert.equal(activeEffects(table.state.abilities).some(a=>a.id===paralysis.id),false,'A new concentration spell ends linked conditions')
assert.equal(activeEffects(table.state.abilities).filter(a=>a.resolutionEffects?.some(e=>e.kind==='roll-bonus')).length,1,'Bless creates one parent effect, without duplicate children')
const bonusSave=propose('fireball',[{targetId:2,damage:[{type:'fire',amount:21}]}])
recordResolutionRoll(db,table,playerId,bonusSave,{targetId:2,kind:'save',value:10})
const bonusPrompt=pendingSavingThrows(db,{...table,combatRequests:[bonusSave]},playerId)[0]
assert.equal(bonusPrompt.kind,'bonus-save')
recordResolutionRoll(db,table,playerId,bonusSave,{targetId:2,kind:'bonus-save',effectId:bonusPrompt.effectId,value:1})
assert.equal(visibleRequests({...table,combatRequests:[bonusSave]},masterId)[0].targets[0].resolution.damage,5)
assert(validCombatRequest(JSON.parse(JSON.stringify(bonusSave))))
approve(bonusSave,'5')
assert.equal(db.characters[1].sheet.hitPoints,'35')


// Catalog monsters may exist only in combat; they are not archived player characters.
const worg={...newCharacterSheet(),name:'Worg',kind:'Mostro',armorClass:'13',dexterity:'14',hitPoints:'30',playerDetails:{temporaryHitPoints:'3'}}
table.state.turns.push({id:3,sheet:worg,description:worg.name,initiative:'10',hitPoints:'30',temporaryHitPoints:'3',armorClass:'13'})
const monsterEntry=propose('fireball',[{targetId:3,damage:[{type:'fire',amount:21}]}])
recordResolutionRoll(db,table,masterId,monsterEntry,{targetId:3,kind:'save',value:11})
const legacyProposal=requestProposal({...monsterEntry.proposal,packets:undefined,mode:'automatic',targets:[{id:3,roll:'',hit:true,damageRoll:'5',damage:'5'}]})
const legacyEntry={...monsterEntry,proposal:legacyProposal,resolution:undefined,targets:legacyProposal.targets.map(t=>({...t,name:'Worg'}))}
for(const [entry,damage,expectedHP] of [[legacyEntry,'5','28'],[monsterEntry,'10','23']]) {
 const result=applyCombatRequest(db,table,entry,rules,{confirmed:true,targets:[{id:3,damage}]})
 const monsterTurn=result.state.turns.find(t=>t.id===3)
 assert.equal(monsterTurn.hitPoints,expectedHP)
 assert.equal(monsterTurn.sheet.hitPoints,expectedHP)
 assert.equal(monsterTurn.temporaryHitPoints,'0')
 assert.equal(monsterTurn.sheet.playerDetails.temporaryHitPoints,'0')
 assert(!result.sheets.some(s=>s.id===worg.id),'Combat-only monsters must not be saved as archived characters')
 assert(result.sheets.every(s=>db.characters.some(r=>r.id===s.id&&r.gameId===table.id)),'Every returned sheet can be saved by the approval endpoint')
 assert.equal(table.state.turns.find(t=>t.id===3).hitPoints,'30','Preparation must not mutate the saved combat state')
}

if(process.argv.includes('--rules-only')) {console.log('PASS local resolution: both editions, typed defenses, saves, advantage, bonus dice, critical dice, owned prompts, privacy, snapshot validation and idempotent recording');process.exit(0)}

const runtimeRoot=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(runtimeRoot,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(runtimeRoot,'dev-and-dice-resolution-'))
let server,baseURL
async function start(){server=(await createApp({dataDir:dir,production:false,sessionSecret:'resolution-test-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening');baseURL=`http://127.0.0.1:${server.address().port}`}
async function api(user,path,method='GET',body){const response=await fetch(baseURL+path,{method,headers:{...(user?{cookie:user.cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]}}
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body}
async function account(username){const r=await api(null,'/api/register','POST',{username,password:'test-password-123'});assert.equal(r.status,201);return r}
try {
 await start()
 const master=await account('ResolutionMaster'),caster=await account('ResolutionCaster'),player=await account('ResolutionDefender')
 const rules=await combatRules(),spell=id=>templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
 const wizard={...newCharacterSheet(),name:'Maga',characterClass:'Mago',level:'5',hitPoints:'30',armorClass:'12',intelligence:'16',abilities:['fire-bolt','fireball','scorching-ray','hold-person','shield-of-faith','protection-from-energy','magic-missile'].map(spell),playerDetails:{spellAttackBonus:'5',spellDC:'13','slots.1.total':'10','slots.2.total':'10','slots.3.total':'10'}}
 const hero={...defender,hitPoints:'50',playerDetails:{...defender.playerDetails,temporaryHitPoints:'3'}}
 const monster={...newCharacterSheet(),kind:'Mostro',name:'Guardiano',hitPoints:'100',armorClass:'14',dexterity:'14',wisdom:'10',playerDetails:{'monster.resistances':'fuoco','monster.savingThrows':'Dex +2'}}
 const created=await api(master,'/api/play/games','POST',{name:'Risoluzione'});assert.equal(created.status,201)
 let game=created.body,path='/api/play/games/'+game.id
 ok(await api(caster,'/api/play/invites/'+game.inviteToken+'/join','POST',{sheet:wizard}));ok(await api(player,'/api/play/invites/'+game.inviteToken+'/join','POST',{sheet:hero}))
 game=ok(await api(master,path))
 const turn=(id,sheet)=>({id,sheet,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,temporaryHitPoints:sheet.playerDetails?.temporaryHitPoints??'',armorClass:sheet.armorClass})
 game=ok(await api(master,path+'/state','PUT',{revision:game.revision,sheets:[wizard,hero,monster],state:{turns:[turn(1,wizard),turn(2,hero),turn(3,monster)],abilities:[],combat:{activeId:1,round:1}}}))
 async function current(user=master){return ok(await api(user,path))}
 async function send(spellId,packets,extra={}) {
  const choices=ok(await api(caster,path+'/actions')),action=choices.actions.find(a=>a.name===spell(spellId).name),option=action.options.find(o=>o.id.startsWith('slot:'))??action.options[0],plan=option.resolution??action.resolution
  assert(plan,'Missing structured resolution for '+spellId)
  const body={id:crypto.randomUUID(),revision:choices.revision,key:action.key,option:option.id,cost:1,mode:plan.kind,damageEnabled:plan.damageTypes.length>0,packets,...extra}
  return {body,response:await api(caster,path+'/requests','POST',body)}
 }
 async function decide(id,targets,extra={}) {const now=await current();return api(master,path+'/requests/'+id+'/approve','POST',{revision:now.revision,confirmed:true,targets,...extra})}
 async function roll(user,id,targetId,value,extra={}){const now=await current();return api(user,path+'/requests/'+id+'/roll','POST',{revision:now.revision,targetId,kind:'save',value,...extra})}
 async function nextRound(){const now=await current(),sheets=now.characters.map(r=>({...r.sheet,playerDetails:{...r.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}}));return ok(await api(master,path+'/state','PUT',{revision:now.revision,sheets,state:{...now.state,combat:{activeId:1,round:now.state.combat.round+1}}}))}
 const area=await send('fireball',[{targetId:2,damage:[{type:'fire',amount:21}]},{targetId:3,damage:[{type:'fire',amount:21}]}])
 const publicGame=ok(area.response),id=area.body.id
 assert(!Object.hasOwn(publicGame.combatRequests[0],'resolution'));assert(!Object.hasOwn(publicGame.combatRequests[0].targets[0],'resolution'),'No target outcome or defenses leak to the caster')
 assert.equal((await current()).state.turns[1].hitPoints,'50','A proposal never changes HP')
 const saves=(await current(player)).rollRequests
 assert.equal(saves.length,1);assert.equal(saves[0].ability,'dexterity');assert(!Object.hasOwn(saves[0],'dc'))
 assert.equal((await roll(caster,id,2,11)).status,403,'The caster cannot roll for another character')
 assert.equal((await roll(player,id,3,2)).status,403,'A player cannot roll for a monster')
 assert.equal((await decide(id,[{id:2,damage:'5'},{id:3,damage:'10'}])).status,409,'All required saves must be resolved')
 ok(await roll(player,id,2,11));ok(await roll(player,id,2,11));assert.equal((await roll(player,id,2,12)).status,409,'A repeated save cannot overwrite the first roll')
 ok(await roll(master,id,3,2))
 let review=(await current()).combatRequests.find(r=>r.id===id)
 assert.equal(review.targets[0].resolution.damage,5);assert.equal(review.targets[1].resolution.damage,10)
 ok(await decide(id,[{id:2,damage:'5'},{id:3,damage:'10'}]))
 game=await current();assert.equal(game.state.turns[1].hitPoints,'48');assert.equal(game.state.turns[1].temporaryHitPoints,'0');assert.equal(game.state.turns[2].hitPoints,'90')
 assert.equal((await current(player)).rollRequests.length,0)
 await nextRound()
 const critical=await send('fire-bolt',[{targetId:3,die:20,damage:[{type:'fire',amount:11}]}]);ok(critical.response)
 assert.equal((await current()).combatRequests[0].targets[0].resolution.damage,null)
 assert.equal((await roll(caster,critical.body.id,3,6,{kind:'critical',packet:0,type:'fire'})).status,403)
 ok(await roll(master,critical.body.id,3,6,{kind:'critical',packet:0,type:'fire'}))
 assert.equal((await current()).combatRequests[0].targets[0].resolution.damage,8)
 ok(await decide(critical.body.id,[{id:3,damage:'8'}]));assert.equal((await current()).state.turns[2].hitPoints,'82')
 await nextRound()
 const protection=await send('shield-of-faith',[{targetId:3,damage:[]}]);ok(protection.response);ok(await decide(protection.body.id,[{id:3,damage:'0'}]))
 await nextRound()
 const bolt=await send('fire-bolt',[{targetId:3,die:9,damage:[{type:'fire',amount:11}]}]);ok(bolt.response)
 assert.equal((await current()).combatRequests[0].targets[0].resolution.damage,0,'A targeted active AC bonus changes the hit check')
 ok(await decide(bolt.body.id,[{id:3,damage:'0'}]))
 await nextRound()
 const wrong=await send('fireball',[{targetId:3,damage:[{type:'cold',amount:10}]}]);assert.equal(wrong.response.status,400,'A client cannot forge damage types')
 const wrongArea=await send('fireball',[{targetId:2,damage:[{type:'fire',amount:10}]},{targetId:3,damage:[{type:'fire',amount:11}]}]);assert.equal(wrongArea.response.status,400)
 const tooMany=await send('scorching-ray',Array.from({length:4},()=>({targetId:3,die:15,damage:[{type:'fire',amount:5}]})));assert.equal(tooMany.response.status,400)
 const pending=await send('fireball',[{targetId:2,damage:[{type:'fire',amount:11}]}]);ok(pending.response)
 await new Promise(resolve=>server.close(resolve));await start()
 assert.equal((await current(player)).rollRequests.length,1,'Pending owned saves survive restart')
 const stateBefore=(await current()).state
 await nextRound()
 assert.equal((await roll(player,pending.body.id,2,10)).status,409,'Stale requests cannot accept rolls')
 assert.equal((await current()).state.turns[1].hitPoints,stateBefore.turns[1].hitPoints)
 console.log('PASS resolution: edition separation, per-hit packets, typed defenses, area damage, natural 1/20, owned saves, privacy, critical dice, active AC, atomic HP and persistence')
} finally {if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
