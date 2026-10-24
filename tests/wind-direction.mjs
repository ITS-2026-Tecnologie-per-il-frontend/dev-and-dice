// node tests/wind-direction.mjs — isolated rule/approval checks, no live data.
import assert from 'node:assert/strict'
import {combatRules,actionContext,actionChoices,requestProposal,createRequestResolution,applyCombatRequest,createWindDirectionRequest,validCombatRequest,visibleRequests,recordResolutionRoll} from '../server/combat-requests.mjs'
import {bonusActionUsed,spendBonusAction,spendCombatUse,combatAbilityInfo} from '../src/domain/dnd/CombatActions.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog,sheetWithCombatAbilities} from '../src/utils/Catalog.ts'
import {validateState} from '../server/games.mjs'
const rules=await combatRules(),spell=templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:gust-of-wind'))
const masterId=crypto.randomUUID(),playerId=crypto.randomUUID(),gameId=crypto.randomUUID()
const mage=sheetWithCombatAbilities({...newCharacterSheet(),name:'Maga',characterClass:'Mago',level:'5',hitPoints:'30',abilities:[spell],playerDetails:{'slots.2.total':'3',spellDC:'15'}},rules.catalog),guard={...newCharacterSheet(),name:'Guardia',hitPoints:'30'}
const db={characters:[{id:mage.id,ownerId:playerId,gameId,sheet:mage}]}
const game={id:gameId,masterId,revision:0,players:[{userId:playerId,characterId:mage.id}],combatRequests:[],state:{turns:[mage,guard].map((sheet,i)=>({id:i+1,sheet,description:sheet.name,hitPoints:'30',armorClass:'10',temporaryHitPoints:'',initiative:'10'})),abilities:[],combat:{activeId:1,round:1}}}
const context=actionContext(db,game,playerId,rules),action=context.actions.find(a=>a.ability.ruleId===spell.ruleId)
const proposal=requestProposal({id:crypto.randomUUID(),revision:0,key:action.key,option:'slot:2',cost:1,mode:'none',damageEnabled:false,packets:[{targetId:2,damage:[]}]})
const cast={id:proposal.id,ownerId:playerId,characterId:mage.id,characterName:mage.name,actorName:'Giocatore',actionName:spell.name,optionLabel:'Slot 2',createdAt:new Date().toISOString(),status:'pending',prolonged:false,proposal,targets:proposal.targets.map(t=>({...t,name:guard.name})),resolution:createRequestResolution(db,game,context,action,proposal,rules)}
game.combatRequests.push(cast)
function commit(entry,result){for(const sheet of result.sheets)db.characters.find(r=>r.id===sheet.id).sheet=sheet;game.state=validateState(result.state);entry.resolution.wind=result.wind;entry.status='approved';game.revision++}
commit(cast,applyCombatRequest(db,game,cast,rules,{confirmed:true,targets:[{id:2,damage:'0'}]}))
const effect=game.state.abilities.find(a=>a.active),original=structuredClone(effect),before=structuredClone(db.characters[0].sheet)
const command=()=>({id:crypto.randomUUID(),revision:game.revision,effectId:effect.id,selected:[1]})
const choices=()=>actionChoices(actionContext(db,game,playerId,rules,true),game,db).actions.find(a=>a.name===spell.name)
assert(choices().windDirection.canUse)
assert.throws(()=>createWindDirectionRequest(db,game,crypto.randomUUID(),command(),rules,'Intruso'),e=>e.status===403)
game.state.combat.activeId=2
assert(!choices().windDirection.canUse)
assert.throws(()=>createWindDirectionRequest(db,game,playerId,command(),rules,'Giocatore'),e=>e.status===409)
game.state.combat.activeId=1
const body=command(),entry=createWindDirectionRequest(db,game,playerId,body,rules,'Giocatore')
assert(validCombatRequest(entry));game.combatRequests.push(entry)
assert.equal(createWindDirectionRequest(db,game,playerId,body,rules,'Giocatore'),entry,'Retries return the same pending request')
assert.deepEqual(db.characters[0].sheet,before,'Proposing spends nothing')
assert(!choices().windDirection.canUse,'Pending direction request blocks another proposal')
assert.equal(visibleRequests(game,playerId)[0].wind,undefined,'Defenses and save outcomes stay private')
assert.equal(visibleRequests(game,masterId)[0].spendsResources,false)
assert.deepEqual(entry.resolution.wind.saves,{},'Old saves are not reused for new direction')
entry.status='rejected';assert(choices().windDirection.canUse);assert(!bonusActionUsed(db.characters[0].sheet))
const next=createWindDirectionRequest(db,game,masterId,command(),rules,'Master');game.combatRequests.push(next)
const approved=applyCombatRequest(db,game,next,rules,{confirmed:true,wind:{selected:[2],saves:{2:{mode:'dice',die:12}}},targets:[{id:2,damage:'0'}]})
commit(next,approved)
assert(bonusActionUsed(db.characters[0].sheet));assert(!choices().windDirection.canUse)
assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],'1')
assert.equal(db.characters[0].sheet.playerDetails['combat.spellsThisTurn'],before.playerDetails['combat.spellsThisTurn'],'Redirect is not another spell cast')
assert.deepEqual({...game.state.abilities[0],targets:original.targets},original,'Duration, concentration and effect identity stay unchanged')
assert.equal(next.resolution.wind.saves[2].die,12)
assert(game.state.turns.every(t=>t.hitPoints==='30'))
assert.throws(()=>createWindDirectionRequest(db,game,playerId,command(),rules,'Giocatore'),e=>e.status===409)
assert.throws(()=>recordResolutionRoll(db,game,masterId,next,{kind:'wind',wind:{selected:[2],saves:{2:{mode:'dice',die:15}}}},rules),e=>e.status===409,'Approved direction results cannot be edited')
assert.equal(next.resolution.wind.saves[2].die,12)
assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],'1','Recording later saves spends nothing')
assert(bonusActionUsed({...before,playerDetails:{'combat.spellsThisTurn':'[{"level":1,"unit":"bonus-action"}]'}}),'Legacy bonus spell history is recognized')
const bonus={...templateFromCatalog(rules.catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:healing-word')),id:10,ownerId:1,active:false,castingSource:'free',targets:[{id:1,damage:'0',resolved:true}]}
assert.equal(combatAbilityInfo(bonus,rules.catalog).unit,'bonus-action')
const spent=spendCombatUse({...before,playerDetails:{'combat.spellsThisTurn':'[]','rules2014.spellsThisTurn':'[]'}},bonus,rules.catalog,rules.data,'free')
assert(bonusActionUsed(spent));assert.throws(()=>spendBonusAction(spent),/azione bonus/)
assert.throws(()=>spendCombatUse(spendBonusAction(before),bonus,rules.catalog,rules.data,'free'),/azione bonus/,'Direction and other bonus abilities share the same budget')
db.characters[0].sheet={...before,playerDetails:{...before.playerDetails,'combat.bonusActionUsed':'false','combat.spellsThisTurn':'[]','rules2014.spellsThisTurn':'[]'}}
assert(choices().windDirection.canUse,'Reset at the next own turn restores availability')
game.state.abilities[0].active=false
assert.equal(choices().windDirection,undefined)
assert.throws(()=>createWindDirectionRequest(db,game,playerId,command(),rules,'Giocatore'),e=>e.status===409)
game.state.abilities[0].active=true;db.characters[0].ownerId=masterId;game.players=[]
const own=createWindDirectionRequest(db,game,masterId,command(),rules,'Master')
assert.equal(own.ownerId,masterId);assert(validCombatRequest(own))
assert.equal(applyCombatRequest(db,game,own,rules,{confirmed:true,targets:[{id:1,damage:'0'}]}).sheets[0].playerDetails['combat.bonusActionUsed'],'true','Master-owned casters use the same approval logic')
console.log('PASS wind direction: own turn, shared bonus action, approval/rejection/retries, private saves, Master and player ownership, no extra slot or duration reset')
