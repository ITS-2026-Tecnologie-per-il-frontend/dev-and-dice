// Run: node tests/sleep-state.mjs — PHB 2014 PDF 277 / 293, isolated sleep lifecycle.
import assert from 'node:assert/strict'
import {applySleepConditions,wakeSleep,wakeWithAction,sleepingTargets} from '../src/domain/dnd/Sleep.ts'
import {settleCombatEffects,conditionsFor,isIncapacitated,conditionHelp} from '../src/domain/dnd/CombatConditions.ts'
import {activeEffects,defenseProfile} from '../src/domain/dnd/CombatResolution.ts'
import {advanceCombatAbilities} from '../src/utils/Combat.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {combatRules,actionContext,prepareAction,requestProposal,applyCombatRequest} from '../server/combat-requests.mjs'
import {openReactions} from '../server/reactions.mjs'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
import {validateState} from '../server/games.mjs'
const rules=await combatRules(),shield=templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:shield'))
const caster={...newCharacterSheet(),name:'Aster',hitPoints:'20',abilities:[{name:'Colpo di prova',duration:'Senza conteggio',remainingTurns:0,description:'Infligge danni, da risolvere manualmente.'}],playerDetails:{'slots.1.total':'2'}}
const baldur={...newCharacterSheet(),name:'Baldur',hitPoints:'13',abilities:[shield],playerDetails:{'slots.1.total':'2','temporaryHitPoints':'5','rules2014.concentration':'phb2014:spell:bless'}}
const noryn={...newCharacterSheet(),name:'Noryn',hitPoints:'74'}
const turns=[caster,baldur,noryn].map((sheet,id)=>({id,description:sheet.name,sheet,initiative:'10',hitPoints:sheet.hitPoints,armorClass:'12',temporaryHitPoints:sheet.playerDetails?.temporaryHitPoints??''}))
const sleep={id:1,name:'Sonno',ruleId:'phb2014:spell:sleep',ownerId:0,active:true,duration:'1 minuto',remainingTurns:10,timed:true,targets:[{id:1,damage:'0',resolved:true}]}
const bless={id:2,name:'Benedizione',ruleId:'phb2014:spell:bless',ownerId:1,active:true,duration:'1 minuto',remainingTurns:10,timed:true,concentration:true,resolutionEffects:[{kind:'roll-bonus',sides:4,rolls:['save'],trigger:'always'}],targets:[{id:2,damage:'0',resolved:true}]}
const combat={round:4,activeId:0},settled=settleCombatEffects([sleep,bless],turns,combat)
assert(isIncapacitated([sleep],1),'Previously approved casts block actions even before hydration')
assert.deepEqual(conditionsFor(settled.abilities,1).sort(),['Addormentato','Prono'])
assert.deepEqual(conditionsFor(settled.abilities,0),[])
assert.deepEqual(conditionsFor(settled.abilities,2),[])
assert.equal(settled.turns[1].sheet.playerDetails['rules2014.concentration'],'')
assert(!activeEffects(settled.abilities).some(a=>a.id===bless.id),'Unconsciousness ends concentration')
assert(settled.abilities.some(a=>a.conditionOrigin==='Sonno · Aster'))
assert.deepEqual(applySleepConditions(settled.abilities,turns,combat),settled.abilities,'Hydration never duplicates prone')
for(const ability of ['strength','dexterity'])assert(defenseProfile(baldur,ability,settled.abilities,1).automaticSaveFailure)
assert(!defenseProfile(baldur,'wisdom',settled.abilities,1).automaticSaveFailure)
const defense=defenseProfile(baldur,undefined,settled.abilities,1)
assert(defense.grantsAttackAdvantage&&defense.reviewAttack)
assert(defense.notes.some(t=>t.includes('1,5')),'Unknown attacker distance requires an explicit Master review')
assert(conditionHelp('Addormentato','2014').some(t=>t.includes('azioni bonus')))
assert(conditionHelp('Addormentato','2014').some(t=>t.includes('danni')))
const awakened=wakeSleep(settled.abilities,[1])
assert.deepEqual(conditionsFor(awakened,1),['Prono'])
assert(!isIncapacitated(awakened,1))
assert.deepEqual(sleepingTargets(awakened),[])
const actionWake=wakeWithAction(settled.abilities,settled.turns,0,1)
assert.equal(actionWake.sheet.playerDetails['combat.actionUsed'],'true')
assert.deepEqual(conditionsFor(actionWake.abilities,1),['Prono'])
assert.throws(()=>wakeWithAction(settled.abilities,turns,1,1))
assert.throws(()=>wakeWithAction(settled.abilities,turns.map(t=>t.id===0?{...t,sheet:actionWake.sheet}:t),0,1),/già utilizzata/)
const multiple=applySleepConditions([{...sleep,targets:[...sleep.targets,{id:2,damage:'0',resolved:true}]}],turns,combat)
assert.deepEqual(sleepingTargets(wakeSleep(multiple,[1])),[2])
let expired=settled.abilities
for(let round=5;round<=14;round++)expired=advanceCombatAbilities(expired,{round:round-1,activeId:2},{round,activeId:0})
assert(!sleepingTargets(expired).length)
assert.deepEqual(conditionsFor(expired,1),['Prono'],'The prone fall outlasts the spell')
validateState({turns:settled.turns,abilities:settled.abilities,combat})
const gameId=crypto.randomUUID(),ownerId=crypto.randomUUID(),otherId=crypto.randomUUID(),masterId=crypto.randomUUID()
const db={characters:[{id:caster.id,ownerId,gameId,sheet:caster},{id:baldur.id,ownerId:otherId,gameId,sheet:baldur}]}
const game={id:gameId,masterId,revision:0,players:[{userId:ownerId,characterId:caster.id},{userId:otherId,characterId:baldur.id}],combatRequests:[],state:{turns,abilities:[sleep,bless],combat}}
assert(actionContext(db,game,otherId,rules,true).blockedReason)
assert.throws(()=>actionContext(db,{...game,state:{...game.state,combat:{...combat,activeId:1}}},otherId,rules),/incapacitato/)
openReactions(db,game,rules,{kind:'hit',targetIds:[1],label:'Colpo',actorId:0})
assert.equal(game.reactionWindows.length,0,'Sleeping creatures receive no reaction prompt')
const context=actionContext(db,game,ownerId,rules),action=context.actions.find(a=>a.ability.name==='Colpo di prova')
const proposal=requestProposal({id:crypto.randomUUID(),revision:0,key:action.key,option:'free',cost:1,mode:'automatic',damageEnabled:true,targets:[{id:1,roll:'',hit:true,damageRoll:'2',damage:'2'}]})
prepareAction(context,proposal,rules)
const entry={ownerId,characterId:caster.id,proposal,targets:proposal.targets}
const applied=applyCombatRequest(db,game,entry,rules,{confirmed:true,targets:[{id:1,damage:'2'}]})
assert.equal(applied.state.turns[1].hitPoints,'13','Temporary PF absorb all of this damage')
assert.equal(applied.state.turns[1].temporaryHitPoints,'3')
assert.equal(applied.sheets.find(s=>s.id===baldur.id).playerDetails['rules2014.concentration'],'','Waking cannot restore the concentration ended by sleep')
assert.deepEqual(conditionsFor(applied.state.abilities,1),['Prono'],'Damage still wakes when entirely absorbed by temporary PF')
const sleepTemplate=templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:sleep'))
caster.abilities.push(sleepTemplate)
game.state.abilities=[{...sleep,catalogId:sleepTemplate.catalogId,active:false,remainingTurns:0,resolutionEffects:[{kind:'condition',condition:'unconscious',trigger:'always'}]},{id:9,name:'Prono',ownerId:1,active:false,duration:'Senza conteggio',remainingTurns:0,timed:false,resolutionEffects:[{kind:'condition',condition:'prone',trigger:'always'}]}]
const recastContext=actionContext(db,game,ownerId,rules),recast=recastContext.actions.find(a=>a.ability.ruleId===sleep.ruleId)
const nextProposal=requestProposal({id:crypto.randomUUID(),revision:0,key:recast.key,option:'slot:1',cost:1,mode:'none',damageEnabled:false,sleepRoll:40,targets:[{id:1,roll:'',hit:false,damageRoll:'',damage:'0'}]})
const next=applyCombatRequest(db,game,{ownerId,characterId:caster.id,proposal:nextProposal,targets:nextProposal.targets},rules,{confirmed:true,sleepArea:[1],sleepTargets:[1],targets:[{id:1,damage:'0'}]})
assert.deepEqual(conditionsFor(next.state.abilities,1).sort(),['Addormentato','Prono'],'A new cast also causes a fresh fall prone after a previous cast ended')
console.log('PASS Sleep state: approved target only, hover provenance, unconscious actions/reactions/saves, concentration, independent prone, waking action, temporary-PF damage and ten-round expiration')
