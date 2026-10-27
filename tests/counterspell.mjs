// node tests/counterspell.mjs - PHB 2014 PDF 55,116,194,229.
import assert from 'node:assert/strict'
import {counterspellModifier,resolveCounterspell,validCounterspellSnapshot} from '../src/domain/dnd/Counterspell.ts'
import {counterspellChoices,createCounterspellEntry,applyCounterspell} from '../server/counterspell.mjs'
import {combatRules,actionContext,requestProposal,prepareAction,createRequestResolution,validCombatRequest,requestStatus,visibleRequests} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
import {validateState} from '../server/games.mjs'
assert.equal(resolveCounterspell(3,3,undefined).automatic,true)
assert.equal(resolveCounterspell(5,5,undefined).success,true)
assert.equal(resolveCounterspell(3,0,undefined).automatic,true)
assert.equal(resolveCounterspell(3,5,4,{die:11}).success,true)
assert.equal(resolveCounterspell(3,5,4,{die:10}).success,false)
assert.equal(resolveCounterspell(3,9,-10,{die:20}).success,false,'A natural 20 is not an automatic success')
assert.equal(resolveCounterspell(3,4,20,{die:1}).success,true,'A natural 1 is not an automatic failure')
assert.equal(resolveCounterspell(3,5,4,{die:2,secondDie:11,rollMode:'advantage'}).success,true)
assert.equal(resolveCounterspell(3,5,4,{die:2,secondDie:11,rollMode:'disadvantage'}).success,false)
assert.throws(()=>resolveCounterspell(3,5,4,{die:12,bonus:2}),/provenienza/)
assert.throws(()=>resolveCounterspell(3,5,4,{die:0}),/d20/)
const ordinary={...newCharacterSheet(),characterClass:'Mago',level:'11',intelligence:'18'}
assert.equal(counterspellModifier(ordinary).total,4,'No default proficiency on this ability check')
assert.equal(counterspellModifier({...ordinary,playerDetails:{'creation.subclass':'abjuration'}}).total,8)
assert.equal(counterspellModifier({...ordinary,characterClass:'Bardo',charisma:'18'}).total,6)
assert.throws(()=>counterspellModifier({...ordinary,playerDetails:{'rules.edition':'2024'}}),/2014/)
const rules=await combatRules(),spell=id=>templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
const master=crypto.randomUUID(),user=crypto.randomUUID(),enemyUser=crypto.randomUUID(),gid=crypto.randomUUID()
const caster={...ordinary,name:'Aster',abilities:[spell('counterspell')],playerDetails:{'slots.3.total':'3','slots.5.total':'2','rules2014.concentration':'test:existing'}}
const enemy={...ordinary,id:crypto.randomUUID(),name:'Baldur',abilities:[spell('fireball')],playerDetails:{'slots.5.total':'2'}}
let db,game,source
function reset(){
 db={characters:[{id:caster.id,ownerId:user,gameId:gid,sheet:structuredClone(caster)},{id:enemy.id,ownerId:enemyUser,gameId:gid,sheet:structuredClone(enemy)}]}
 game={id:gid,masterId:master,revision:0,players:[{userId:user,characterId:caster.id},{userId:enemyUser,characterId:enemy.id}],combatRequests:[],reactionWindows:[],state:{combat:{activeId:1,round:1},abilities:[{id:100,ownerId:0,name:'Concentrazione precedente',ruleId:'test:existing',active:true,concentration:true,duration:'1 minuto',remainingTurns:10}],turns:[caster,enemy].map((sheet,id)=>({id,description:sheet.name,sheet:structuredClone(sheet),initiative:'10',hitPoints:'20',armorClass:'12',temporaryHitPoints:''}))}}
 const context=actionContext(db,game,enemyUser,rules),action=context.actions.find(a=>a.ability.ruleId==='phb2014:spell:fireball')
 const proposal=requestProposal({id:crypto.randomUUID(),revision:0,key:action.key,option:'slot:5',cost:1,mode:'save',damageEnabled:true,packets:[{targetId:0,damage:[{type:'fire',amount:30}]}]})
 prepareAction(context,proposal,rules)
 source={id:proposal.id,ownerId:enemyUser,characterId:enemy.id,characterName:enemy.name,actorName:'Enemy',actionName:action.ability.name,optionLabel:'Slot 5',createdAt:new Date().toISOString(),status:'pending',prolonged:false,proposal,targets:proposal.targets.map(t=>({...t,name:'Aster'})),resolution:createRequestResolution(db,game,context,action,proposal,rules)}
 game.combatRequests.push(source)
}
function proposal(option='slot:3'){return {id:crypto.randomUUID(),revision:game.revision,actorId:0,targetKey:'request:'+source.id,option,requirementsConfirmed:true}}
function commit(result){game.state=validateState(result.state);for(const sheet of result.sheets)db.characters.find(c=>c.id===sheet.id).sheet=sheet;game.revision++}
reset()
const choices=counterspellChoices(db,game,user,0,rules)
assert.equal(choices.blockedReason,undefined,'A reaction can be used outside the caster turn')
assert(choices.targets.some(t=>t.key==='request:'+source.id))
assert(choices.targets.every(t=>t.actorId!==0&&t.name===undefined&&t.level===undefined),'No hidden spell name or level leaks to the player')
assert.equal(counterspellChoices(db,game,master,0,rules).targets.find(t=>t.requestId===source.id).level,5,'Use the actual casting slot, not the spell base level')
assert.throws(()=>counterspellChoices(db,game,enemyUser,0,rules),/disponibile/)
let entry=createCounterspellEntry(db,game,user,'Player',proposal(),rules)
assert(validCombatRequest(entry));assert(validCounterspellSnapshot(entry.counterspell))
assert.equal(db.characters[0].sheet.playerDetails['slots.3.used'],undefined,'A proposal consumes no resources')
assert.throws(()=>applyCounterspell(db,game,entry,rules,{die:11}),/Conferma/)
assert.throws(()=>applyCounterspell(db,game,entry,rules,{confirmed:true}),/d20/)
assert.equal(source.status,'pending','Invalid rolls do not change the source')
let result=applyCounterspell(db,game,entry,rules,{confirmed:true,die:11});commit(result)
assert(result.counterspell.result.success);assert.equal(source.status,'approved');assert.equal(source.counteredBy,entry.id)
assert.equal(db.characters[0].sheet.playerDetails['slots.3.used'],'1');assert.equal(db.characters[0].sheet.playerDetails['combat.reactionUsed'],'true')
assert.equal(db.characters[1].sheet.playerDetails['slots.5.used'],'1','The interrupted spell still spends its slot')
assert(game.state.abilities.find(a=>a.id===100).active,'Counterspell preserves the reactor concentration')
assert(!game.state.abilities.some(a=>a.ruleId==='phb2014:spell:fireball'&&a.active),'An interrupted spell applies no effect')
assert.match(counterspellChoices(db,game,user,0,rules).blockedReason,/reazione/)
assert.equal(visibleRequests(game,enemyUser,db,rules).find(r=>r.id===source.id).resolution,undefined,'An interrupted source has no damage/effect preview')
reset();entry=createCounterspellEntry(db,game,user,'Player',proposal(),rules);result=applyCounterspell(db,game,entry,rules,{confirmed:true,die:10});commit(result)
assert(!result.counterspell.result.success);assert.equal(source.status,'pending');assert.equal(requestStatus(game,source),'pending','The original spell remains approvable after a failed counterspell')
assert.equal(db.characters[0].sheet.playerDetails['slots.3.used'],'1');assert.equal(db.characters[1].sheet.playerDetails['slots.5.used'],undefined)
reset();entry=createCounterspellEntry(db,game,user,'Player',proposal('slot:5'),rules);result=applyCounterspell(db,game,entry,rules,{confirmed:true});assert(result.counterspell.result.automatic)
reset();assert.throws(()=>createCounterspellEntry(db,game,user,'Player',{...proposal(),targetKey:'manual:0'},rules),/disponibile/)
reset();db.characters[1].sheet.abilities.push(spell('counterspell'));game.state.turns[1].sheet.abilities=db.characters[1].sheet.abilities
const first=createCounterspellEntry(db,game,user,'Player',proposal(),rules);game.combatRequests.push(first)
const second=createCounterspellEntry(db,game,enemyUser,'Enemy',{id:crypto.randomUUID(),revision:game.revision,actorId:1,targetKey:'request:'+first.id,option:'slot:5',requirementsConfirmed:true},rules)
result=applyCounterspell(db,game,second,rules,{confirmed:true});commit(result)
assert.equal(first.counteredBy,second.id,'A pending Counterspell can itself be interrupted')
assert.equal(db.characters[0].sheet.playerDetails['slots.3.used'],'1');assert.equal(db.characters[1].sheet.playerDetails['slots.5.used'],'1')
assert.equal(requestStatus(game,source),'pending','Countering the counterspell preserves the original casting')
reset();db.characters[1].sheet.abilities.push(spell('counterspell'));db.characters[1].sheet.playerDetails['slots.3.total']='2';game.state.turns[1].sheet.abilities=db.characters[1].sheet.abilities
const parent=createCounterspellEntry(db,game,user,'Player',proposal('slot:5'),rules);game.combatRequests.push(parent)
const child=createCounterspellEntry(db,game,enemyUser,'Enemy',{id:crypto.randomUUID(),revision:game.revision,actorId:1,targetKey:'request:'+parent.id,option:'slot:3',requirementsConfirmed:true},rules)
result=applyCounterspell(db,game,child,rules,{confirmed:true,die:10});commit(result)
assert(!result.counterspell.result.success);assert.equal(requestStatus(game,parent),'pending');assert(validCombatRequest(parent),'A pending parent remains persistable after a nested failed reaction')
assert.equal(requestStatus(game,source),'pending');result=applyCounterspell(db,game,parent,rules,{confirmed:true});assert(result.counterspell.result.success,'The parent counterspell can still resolve after a failed nested reaction')
reset();game.combatRequests=[]
const mending=spell('mending');db.characters[1].sheet.abilities.push(mending);game.state.turns[1].sheet.abilities=db.characters[1].sheet.abilities;db.characters[1].sheet.playerDetails['rules2014.concentration']='phb2014:spell:mending'
game.state.abilities.push({...mending,id:200,ownerId:1,active:true,remainingTurns:1,execution:{id:crypto.randomUUID(),phase:'casting',option:'cantrip',cost:1,remaining:1}})
entry=createCounterspellEntry(db,game,user,'Player',{...proposal(),targetKey:'ability:200'},rules);result=applyCounterspell(db,game,entry,rules,{confirmed:true});commit(result)
assert(!game.state.abilities.find(a=>a.id===200).execution,'An interrupted long casting cannot complete later')
assert.equal(db.characters[1].sheet.playerDetails['rules2014.concentration'],'');assert.equal(db.characters[1].sheet.playerDetails['slots.5.used'],undefined)
reset();db.characters[0].sheet.playerDetails['rules.edition']='2024';assert.throws(()=>counterspellChoices(db,game,user,0,rules),/2014/)
console.log('PASS Counterspell 2014: automatic/upcast/check/tie/natural rolls, advantage, modifiers, hidden levels, ownership, resources, concentration, source cancellation and failed-interruption resume')
