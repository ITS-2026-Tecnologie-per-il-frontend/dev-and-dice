// node tests/readied-sleep.mjs — isolated PHB 2014 PDF 194/204/277 lifecycle and boundaries.
import assert from 'node:assert/strict'
import {combatRules,actionContext,actionChoices,applyCombatRequest,createSleepReview,requestProposal,prepareAction} from '../server/combat-requests.mjs'
import {readyChoices,readyEntry,applyReadyCommand} from '../server/readied-actions.mjs'
import {validReadyCommand,validReadiedAction} from '../src/domain/dnd/Readied.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
import {sleepingTargets} from '../src/domain/dnd/Sleep.ts'
import {settleCombatEffects} from '../src/domain/dnd/CombatConditions.ts'
import {advanceCombatAbilities} from '../src/utils/Combat.ts'
import {validateState} from '../server/games.mjs'
const rules=await combatRules(),spell=templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:sleep'))
const user=crypto.randomUUID(),master=crypto.randomUUID(),gid=crypto.randomUUID()
const caster={...newCharacterSheet(),name:'Aster',characterClass:'Mago',level:'5',hitPoints:'20',abilities:[spell],playerDetails:{'slots.1.total':'4','slots.2.total':'3'}}
const targets=['Baldur','Noryn'].map(name=>({...newCharacterSheet(),name,hitPoints:'10'}))
let db,game
function reset(){db={characters:[{id:caster.id,ownerId:user,gameId:gid,sheet:structuredClone(caster)}]};game={id:gid,masterId:master,revision:0,players:[{userId:user,characterId:caster.id}],combatRequests:[],state:{combat:{activeId:0,round:1},abilities:[],turns:[caster,...targets].map((sheet,id)=>({id,description:sheet.name,sheet:structuredClone(sheet),initiative:'10',hitPoints:sheet.hitPoints,armorClass:'12',temporaryHitPoints:''}))}}}
function commit(result){game.state=validateState(result.state);for(const s of result.sheets){const r=db.characters.find(r=>r.id===s.id);if(r)r.sheet=s}game.revision++}
function command(c,body={}){const entry=readyEntry(db,game,user,'Tester',crypto.randomUUID(),c,rules);const result=applyReadyCommand(db,game,entry,rules,body);commit(result);return result}
reset()
assert.equal(readyChoices(db,game,user,rules).actors[0].prepareBlockedReason,undefined)
game.state.combat.activeId=1
assert.equal(readyChoices(db,game,user,rules).actors[0].canPrepare,false)
assert.match(readyChoices(db,game,user,rules).actors[0].prepareBlockedReason,/turno di Baldur/)
game.state.combat=undefined
assert.match(readyChoices(db,game,user,rules).actors[0].prepareBlockedReason,/avviare il combattimento/)
reset()
const prep={kind:'prepare-sleep',actorId:0,option:'slot:2',trigger:'Quando il goblin entra'}
db.characters[0].sheet.abilities=[]
game.state.turns[0].sheet=db.characters[0].sheet
assert.deepEqual(readyChoices(db,game,user,rules).actors[0].options,[],'Slots alone must not grant preparation of an unknown spell')
assert.throws(()=>readyEntry(db,game,master,'Master',crypto.randomUUID(),prep,rules),/Sonno non è disponibile/)
reset()
const proposed=readyEntry(db,game,user,'Tester',crypto.randomUUID(),prep,rules)
assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],undefined,'Proposal spends nothing')
assert.deepEqual(sleepingTargets(game.state.abilities),[])
commit(applyReadyCommand(db,game,proposed,rules))
let held=game.state.abilities.find(a=>a.readied)
assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],'1')
assert.equal(db.characters[0].sheet.playerDetails['rules2014.concentration'],'phb2014:readied:sleep')
assert.deepEqual(sleepingTargets(game.state.abilities),[],'Preparation has no sleep effect')
assert(readyChoices(db,game,user,rules).actors[0].held.length===1)
assert.throws(()=>readyEntry(db,game,crypto.randomUUID(),'Other',crypto.randomUUID(),prep,rules),e=>e.status===403)
// Release out of turn: current targets are chosen now, slot is not paid again.
game.state.combat={activeId:1,round:1}
const released=command({kind:'release',actorId:0,effectId:held.id,area:[1,2],sleepRoll:20},{sleepArea:[1,2],sleepTargets:[2],sleepImmune:[1]})
assert.deepEqual(sleepingTargets(game.state.abilities),[2])
assert.equal(game.state.abilities.find(a=>a.ruleId===spell.ruleId).expiryOwnerId,1,'Released duration follows the release turn, not the earlier preparation turn')
assert.deepEqual(released.sleepReview.immuneIds,[1])
assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],'1')
assert.equal(db.characters[0].sheet.playerDetails['combat.reactionUsed'],'true')
assert.equal(db.characters[0].sheet.playerDetails['rules2014.concentration'],'')
assert.throws(()=>command({kind:'release',actorId:0,effectId:held.id,area:[1],sleepRoll:20}),/scaduta|interrotta/)
// Cancel and concentration loss both retain the slot cost.
reset();command(prep);held=game.state.abilities.find(a=>a.readied)
command({kind:'cancel',actorId:0,effectId:held.id});assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],'1');assert.equal(readyChoices(db,game,user,rules).actors[0].held.length,0)
reset();command(prep);held=game.state.abilities.find(a=>a.readied)
game.state.abilities=game.state.abilities.map(a=>({...a,remainingTurns:0,active:false}));game.state.combat={activeId:1,round:1}
assert.throws(()=>command({kind:'release',actorId:0,effectId:held.id,area:[1],sleepRoll:20}),/scaduta|interrotta/)
reset();command(prep);held=game.state.abilities.find(a=>a.readied)
game.state.abilities=advanceCombatAbilities(game.state.abilities,{activeId:1,round:1},{activeId:0,round:2});assert.equal(readyChoices(db,game,user,rules).actors[0].held.length,0,'Expires at next own turn')
reset();command(prep)
const incapacitated={id:100,name:'Stordito',ownerId:0,active:true,timed:false,duration:'Senza conteggio',remainingTurns:0,resolutionEffects:[{kind:'condition',condition:'stunned',trigger:'always'}]}
const interrupted=settleCombatEffects([...game.state.abilities,incapacitated],game.state.turns,game.state.combat)
assert(!interrupted.abilities.find(a=>a.readied).active,'Incapacitation breaks the held spell')
assert.equal(interrupted.turns[0].sheet.playerDetails['rules2014.concentration'],'')
assert.equal(interrupted.turns[0].sheet.playerDetails['slots.2.used'],'1')
// A prepared wake uses a reaction even on the sleeping target's turn.
reset();game.state.abilities=settleCombatEffects([{...spell,id:10,ownerId:2,active:true,remainingTurns:10,targets:[{id:1,damage:'0',resolved:true}]}],game.state.turns,game.state.combat).abilities
command({kind:'prepare-wake',actorId:0,targetId:1,trigger:'Quando inizia il turno di Baldur'});held=game.state.abilities.find(a=>a.readied)
assert.equal(db.characters[0].sheet.playerDetails['combat.actionUsed'],'true')
game.state.combat={activeId:1,round:1};command({kind:'release',actorId:0,effectId:held.id})
assert.deepEqual(sleepingTargets(game.state.abilities),[]);assert.equal(db.characters[0].sheet.playerDetails['combat.reactionUsed'],'true')
assert(game.state.abilities.some(a=>a.name==='Prono'&&a.ownerId===1&&a.active))
// Independent normal casts do not replace existing sleepers or their duration.
reset()
function normal(target){const context=actionContext(db,game,user,rules),action=context.actions.find(a=>a.ability.ruleId===spell.ruleId);assert.equal(action.error,'');const proposal=requestProposal({id:crypto.randomUUID(),revision:game.revision,key:action.key,option:'slot:1',cost:1,mode:'none',damageEnabled:false,sleepRoll:10,targets:[{id:target,roll:'',hit:false,damageRoll:'',damage:'0'}]});prepareAction(context,proposal,rules);const entry={id:proposal.id,ownerId:user,characterId:caster.id,proposal,sleepReview:createSleepReview(context,proposal)};commit(applyCombatRequest(db,game,entry,rules,{confirmed:true,targets:[{id:target,damage:'0'}],sleepArea:[target],sleepTargets:[target],additionalActionConfirmed:true}));}
normal(1);const first=game.state.abilities.find(a=>a.ruleId===spell.ruleId);normal(2)
assert.equal(game.state.abilities.filter(a=>a.ruleId===spell.ruleId&&a.active).length,2);assert.deepEqual(sleepingTargets(game.state.abilities).sort(),[1,2]);assert(game.state.abilities.some(a=>a.id===first.id&&a.active))
const casts=actionChoices(actionContext(db,game,user,rules),game,db).actions.find(a=>a.name==='Sonno').sleepCasts
assert.equal(casts.length,2);assert.deepEqual(casts.map(c=>c.targets[0]).sort(),['Baldur','Noryn'])
for(const invalid of [{kind:'release',actorId:0,effectId:1,area:[1,1],sleepRoll:20},{...prep,trigger:''},{...prep,option:'free'},{kind:'release',actorId:0,effectId:1,evil:true}])assert(!validReadyCommand(invalid))
assert(!validReadiedAction({kind:'sleep',trigger:'',targetId:1}))
console.log('PASS Sonno: independent casts, prepared spell slot/concentration/release/expiry, prepared wake reaction, manual immunity, ownership and malformed commands')
