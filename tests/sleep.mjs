// Run: node tests/sleep.mjs — isolated 2014 Sleep targeting and proposal checks.
import assert from 'node:assert/strict'
import {combatRules,actionContext,actionChoices,requestProposal,prepareAction} from '../server/combat-requests.mjs'
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
for(const id of [4,5,6,7])assert(choices.sleepTargets.find(t=>t.id===id).unavailableReason,`Immunity or unconscious target ${id} is excluded`)
assert.equal(choices.sleepTargets.find(t=>t.id===1).hitPoints,6)
function proposal(ids,roll=22,option='slot:1',extra={}){return requestProposal({id:crypto.randomUUID(),revision:0,key:action.key,option,cost:1,mode:'none',damageEnabled:false,sleepRoll:roll,targets:ids.map(id=>({id,roll:'',hit:false,damageRoll:'',damage:'0'})),...extra})}
prepareAction(context,proposal([1,2]),rules)
prepareAction(context,proposal([2,1]),rules)
prepareAction(context,proposal([],7,'slot:2'),rules)
assert.throws(()=>prepareAction(context,proposal([1,2,3]),rules),/riserva/)
for(const id of [4,5,6,7,8,999])assert.throws(()=>prepareAction(context,proposal([id]),rules))
assert.throws(()=>prepareAction(context,{...proposal([1]),sleepRoll:undefined},rules))
for(const roll of [6,57])assert.throws(()=>prepareAction(context,proposal([1],roll,'slot:2'),rules))
assert.throws(()=>prepareAction(context,proposal([1],22,'slot:1',{damageEnabled:true,mode:'automatic',targets:[{id:1,roll:'',hit:false,damageRoll:'2',damage:'2'}]}),rules))
assert.throws(()=>requestProposal({...proposal([]),sleepRoll:'22'}))
assert.equal(db.characters[0].sheet.playerDetails['slots.1.used'],undefined,'Preview and validation spend no resources')
console.log('PASS Sleep 2014: slot dice, valid totals, PF budget, immunity, elves, unconscious, missing PF and server tampering checks')
