// Run: node tests/sleep.mjs — isolated 2014 Sleep targeting and proposal checks.
import assert from 'node:assert/strict'
import {combatRules,actionContext,actionChoices,requestProposal,prepareAction,createSleepReview,applyCombatRequest,validCombatRequest,visibleRequests} from '../server/combat-requests.mjs'
import {sleepDice,validSleepRoll,sleepTargetReason} from '../src/domain/dnd/Sleep.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
assert.equal(sleepDice('slot:1'),5)
assert.equal(sleepDice('slot:2'),7)
assert.equal(sleepDice('slot:9'),21)
assert(validSleepRoll(5,5));assert(validSleepRoll(40,5))
for(const roll of [undefined,0,4,41,5.5,NaN])assert(!validSleepRoll(roll,5))
assert.equal(sleepTargetReason({id:1,hitPoints:10},10),undefined)
assert(sleepTargetReason({id:1,hitPoints:11},10))
assert(sleepTargetReason({id:1},10))
assert(sleepTargetReason({id:1,hitPoints:0},10))
const rules=await combatRules(),spell=templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:sleep'))
const gameId=crypto.randomUUID(),casterId=crypto.randomUUID()
const mage={...newCharacterSheet(),name:'Maga',characterClass:'Mago',level:'5',hitPoints:'20',abilities:[spell],playerDetails:{'slots.1.total':'3','slots.2.total':'3'}}
const targets=[{name:'Goblin',hitPoints:'6'},{name:'Baldur',hitPoints:'13'},{name:'Worg',hitPoints:'18'},{name:'Zombie',hitPoints:'2',playerDetails:{'creature.type':'undead'}},{name:'Immune',hitPoints:'2',playerDetails:{'combat.conditionImmunities':'charmed'}},{name:'Elfo',race:'Elf',hitPoints:'2',playerDetails:{'creation.race':'elf'}},{name:'Svenuto',hitPoints:'2'},{name:'Senza PF',hitPoints:''}].map(t=>({...newCharacterSheet(),...t}))
const db={characters:[{id:mage.id,ownerId:casterId,gameId,sheet:mage}]}
const game={id:gameId,masterId:crypto.randomUUID(),revision:0,players:[{userId:casterId,characterId:mage.id}],combatRequests:[],state:{turns:[mage,...targets].map((sheet,id)=>({id,sheet,description:sheet.name,hitPoints:sheet.hitPoints})),abilities:[{id:1,ownerId:7,name:'Privo di sensi',active:true,timed:false,remainingTurns:0,resolutionEffects:[{kind:'condition',condition:'unconscious',trigger:'always'}]}],combat:{activeId:0,round:1}}}
const context=actionContext(db,game,casterId,rules),action=context.actions.find(a=>a.ability.ruleId===spell.ruleId),choices=actionChoices(context,game,db).actions.find(a=>a.key===action.key)
assert.equal(choices.sleepTargets,undefined,'Player previews reveal no target PF or immunity')
function proposal(ids,roll=22,option='slot:1',extra={}){return requestProposal({id:crypto.randomUUID(),revision:0,key:action.key,option,cost:1,mode:'none',damageEnabled:false,sleepRoll:roll,targets:ids.map(id=>({id,roll:'',hit:false,damageRoll:'',damage:'0'})),...extra})}
prepareAction(context,proposal([1,2]),rules)
prepareAction(context,proposal([2,1]),rules)
prepareAction(context,proposal([],7,'slot:2'),rules)
prepareAction(context,proposal([1,2,3,4,5,6,7,8]),rules)
assert.throws(()=>prepareAction(context,proposal([999]),rules))
assert.throws(()=>prepareAction(context,{...proposal([1]),sleepRoll:undefined},rules))
for(const roll of [6,57])assert.throws(()=>prepareAction(context,proposal([1],roll,'slot:2'),rules))
assert.throws(()=>prepareAction(context,proposal([1],22,'slot:1',{damageEnabled:true,mode:'automatic',targets:[{id:1,roll:'',hit:false,damageRoll:'2',damage:'2'}]}),rules))
assert.throws(()=>requestProposal({...proposal([]),sleepRoll:'22'}))
assert.equal(db.characters[0].sheet.playerDetails['slots.1.used'],undefined,'Preview and validation spend no resources')
const draft=proposal([1,2,3,4,5,6,7,8]),review=createSleepReview(context,draft)
for(const id of [4,5,6,7])assert(review.candidates.find(t=>t.id===id).unavailableReason)
assert.equal(review.candidates.find(t=>t.id===1).hitPoints,6)
const entry={id:draft.id,ownerId:casterId,characterId:mage.id,characterName:mage.name,actorName:'Player',actionName:spell.name,optionLabel:'Slot 1',prolonged:false,createdAt:new Date().toISOString(),status:'pending',proposal:draft,targets:draft.targets.map(t=>({...t,name:game.state.turns.find(turn=>turn.id===t.id).description})),sleepReview:review}
game.combatRequests=[entry]
assert(validCombatRequest(entry));assert(validCombatRequest(JSON.parse(JSON.stringify(entry))))
assert.equal(visibleRequests(game,casterId)[0].sleepReview,undefined)
assert.equal(visibleRequests(game,game.masterId)[0].sleepReview.candidates.length,8)
const body={confirmed:true,targets:draft.targets.map(t=>({id:t.id,damage:'0'}))}
assert.throws(()=>applyCombatRequest(db,game,entry,rules,body),/Conferma i bersagli/)
for(const selected of [[1,2,3],[4],[5],[6],[7],[8],[999],[1,1]])assert.throws(()=>applyCombatRequest(db,game,entry,rules,{...body,sleepTargets:selected}))
const applied=applyCombatRequest(db,game,entry,rules,{...body,sleepTargets:[1,2]})
assert.deepEqual(applied.sleepReview.selected,[1,2])
assert.deepEqual(applied.state.abilities.find(a=>a.ruleId===spell.ruleId).targets.map(t=>t.id),[1,2])
assert(applied.state.turns.every((turn,i)=>turn.hitPoints===game.state.turns[i].hitPoints),'Sleep never deals damage')
const empty=applyCombatRequest(db,game,entry,rules,{...body,sleepTargets:[]})
assert(!empty.state.abilities.some(a=>a.ruleId===spell.ruleId),'No active cast with no sleepers')
entry.sleepReview=applied.sleepReview;entry.status='approved'
assert(validCombatRequest(JSON.parse(JSON.stringify(entry))))
assert.deepEqual(visibleRequests(game,casterId)[0].targets.filter(t=>t.asleep).map(t=>t.id),[1,2])
assert.equal(visibleRequests(game,casterId)[0].sleepReview,undefined)
console.log('PASS Sleep 2014: private Master defenses, unrestricted player area, Master budget/immunity validation, persisted selections and active targets')
