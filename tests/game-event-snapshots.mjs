// node tests/game-event-snapshots.mjs — no server, accounts or live data.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {combatRules} from '../server/combat-requests.mjs'
import {captureGame,recordGameEvents,gameSnapshot,stateSnapshot,eventChanges,spellOpportunities,restoreSpellEvent,visibleGameEvents} from '../server/game-events.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const rules=await combatRules(),fireball=templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:fireball'))
function fixture(){
 const id=randomUUID(),masterId=randomUUID(),caster={...newCharacterSheet(),name:'Aster',hitPoints:'25',abilities:[fireball],playerDetails:{}},bench={...newCharacterSheet(),name:'Fuori combattimento',hitPoints:'10'},spider={...newCharacterSheet(),name:'Ragno Gigante',kind:'PNG',hitPoints:'26',playerDetails:{}},worg={...newCharacterSheet(),name:'Worg',kind:'PNG',hitPoints:'14'}
 const game={id,masterId,players:[],state:{turns:[caster,spider,worg].map((sheet,id)=>({id,sheet,description:sheet.name,hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})),abilities:[],combat:{activeId:0,round:1}},events:[],combatRequests:[]},db={characters:[caster,bench].map(sheet=>({id:sheet.id,gameId:id,ownerId:masterId,sheet}))}
 return {game,db}
}
const actor={userId:randomUUID(),username:'Master'}
function hp(game,index,value){game.state.turns[index].hitPoints=String(value);game.state.turns[index].sheet.hitPoints=String(value)}
function command(db,game,mutate,{spell=false,after=()=>{}}={}){
 const before=captureGame(db,game),start=structuredClone(game.state),id=randomUUID()
 mutate();const end=structuredClone(game.state)
 game.state.actionEvents=[{id,actorId:0,name:spell?fireball.name:'Pugnale',ruleId:spell?fireball.ruleId:undefined,option:spell?'slot:3':'free',phase:'resolved',before:start,after:end}]
 after();recordGameEvents(db,game,before,actor,rules);return id
}
{
 const {db,game}=fixture(),snapshot=gameSnapshot(db,game)
 assert.equal(snapshot.sheets.length,4,'Both saved sheets (including the bench) and encounter-only creatures are captured')
 assert.deepEqual(eventChanges(stateSnapshot(game.state),{...snapshot,sheets:snapshot.sheets.filter(s=>s.id!==db.characters[1].id)}),[])
 const id=command(db,game,()=>{hp(game,1,23);game.state.turns[0].sheet.playerDetails['combat.actionUses']='1'})
 assert.equal(game.events.length,1,'A dagger attack creates only its action event')
 assert.equal(game.eventBoundary,id)
 assert(game.events[0].changes.some(c=>c.scope==='sheet'&&c.id===game.state.turns[1].sheet.id&&c.path[0]==='hitPoints'&&c.before==='26'&&c.after==='23'))
 assert(game.events[0].changes.every(c=>c.path.length),'No phantom sheet deletions')
 assert(visibleGameEvents(db,game,game.masterId)[0].changes.some(c=>c.subject==='Ragno Gigante'&&c.label==='PF'))
 const before=captureGame(db,game);recordGameEvents(db,game,before,actor,rules);assert.equal(game.events.length,1,'An unchanged save adds nothing')
}
for(const spell of [false,true]){
 const {db,game}=fixture(),target=db.characters[1].sheet
 game.state.turns.push({id:3,sheet:target,description:target.name,hitPoints:'10',temporaryHitPoints:''})
 const id=command(db,game,()=>hp(game,3,7),{spell})
 assert.equal(game.events.length,1,'Saved target with idle encounter-only creatures produces just one event')
 assert(game.events[0].changes.every(c=>c.id===target.id),'Idle Spider and Worg create no changes')
 if(spell)assert(spellOpportunities(game).some(t=>t.eventId===id))
}
for(const [label,mutate,expected] of [
 ['danni',g=>hp(g,1,20),'hitPoints'],['cura',g=>hp(g,1,30),'hitPoints'],
 ['PF temporanei',g=>{g.state.turns[1].temporaryHitPoints='7';g.state.turns[1].sheet.playerDetails.temporaryHitPoints='7'},'temporaryHitPoints'],
 ['condizione',g=>g.state.abilities.push({id:8,ownerId:1,name:'Prono',active:true,timed:false,remainingTurns:0}),null],
 ['turno',g=>{g.state.combat.activeId=1},null]
 ]){
 const {db,game}=fixture(),before=captureGame(db,game);mutate(game);recordGameEvents(db,game,before,actor,rules)
 assert.equal(game.events.length,1,label+' must remain visible')
 assert(game.events[0].changes.some(c=>expected?c.path.at(-1)===expected:c.scope===(label==='turno'?'combat':'ability')))
}
{
 const {db,game}=fixture();game.state.turns[2].hitPoints='12';game.state.turns[2].temporaryHitPoints='5'
 const id=command(db,game,()=>hp(game,1,17),{spell:true})
 assert.equal(game.events.length,1,'A spell has no following phantom event')
 assert(spellOpportunities(game).some(t=>t.eventId===id),'Encounter creatures must not close Counterspell immediately')
 const inverse=restoreSpellEvent(db,game,id)
 assert.equal(inverse.state.turns[1].hitPoints,'26','Counterspell restores encounter-only HP')
 assert.equal(inverse.sheets.length,2,'Encounter-only creatures are not submitted as saved character records')
 assert.equal(inverse.state.turns[2].hitPoints,'12','Unrelated encounter HP overrides survive the inverse')
 assert.equal(inverse.state.turns[2].temporaryHitPoints,'5')
 hp(game,1,16);assert.throws(()=>restoreSpellEvent(db,game,id),/modificato/,'A later real damage edit cannot be overwritten')
}
{
 const {db,game}=fixture();command(db,game,()=>hp(game,1,23),{after:()=>hp(game,2,12)})
 assert.equal(game.events.length,2,'A genuinely separate edit after the action keeps its own event')
 assert(game.events[1].changes.some(c=>c.id===game.state.turns[2].sheet.id&&c.after==='12'))
}
{
 const {db,game}=fixture();command(db,game,()=>{game.state.turns.splice(1,1)})
 assert.equal(game.events.length,1,'Removing an encounter-only creature is recorded once')
 assert(game.events[0].changes.some(c=>c.scope==='sheet'&&c.after===null))
 const before=captureGame(db,game);game.state.turns.push({id:9,sheet:{...newCharacterSheet(),name:'Nuova creatura',kind:'PNG'},hitPoints:'10',temporaryHitPoints:''});recordGameEvents(db,game,before,actor,rules)
 assert.equal(game.events.length,2,'A real addition is not filtered out')
}
{
 const {db,game}=fixture(),entry={id:randomUUID(),characterId:db.characters[0].id,actorName:'Giocatore',characterName:'Aster',actionName:'Pugnale',optionLabel:'Arma',status:'pending',proposal:{option:'free',damageEnabled:true},targets:[{id:1,name:'Ragno Gigante',damage:'3'}]}
 game.combatRequests=[entry];const before=captureGame(db,game);hp(game,1,23);entry.status='approved';recordGameEvents(db,game,before,actor,rules)
 assert.equal(game.events.length,1,'A player approval keeps its actual encounter-only damage in the same event')
 assert(game.events[0].changes.some(c=>c.id===game.state.turns[1].sheet.id&&c.after==='23'))
}
console.log('PASS event snapshots: encounter-only creatures, one attack/spell/approval event, real damage/healing/temp HP/conditions/turns/additions/removals, names, unchanged saves, independent edits and safe Counterspell inverse')
