// Run: node tests/gust-of-wind.mjs — no server or live characters.
import assert from 'node:assert/strict'
import {combatRules,actionContext,actionChoices,prepareAction,requestProposal,createRequestResolution,applyCombatRequest,validCombatRequest,visibleRequests,recordResolutionRoll,pendingSavingThrows,requestStatus} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog,sheetWithCombatAbilities} from '../src/utils/Catalog.ts'
import {resolveTarget} from '../src/domain/dnd/CombatResolution.ts'
const rules=await combatRules(),spell=templateFromCatalog(rules.catalog.abilities.find(a=>a.data.referenceId==='phb2014:spell:gust-of-wind'))
const gameId=crypto.randomUUID(),masterId=crypto.randomUUID(),casterId=crypto.randomUUID(),playerId=crypto.randomUUID()
const mage=sheetWithCombatAbilities({...newCharacterSheet(),name:'Maga',characterClass:'Mago',level:'5',hitPoints:'30',armorClass:'12',abilities:[spell],playerDetails:{'slots.2.total':'3',spellDC:'14'}},rules.catalog)
const ally={...newCharacterSheet(),name:'Guardia',hitPoints:'30',armorClass:'13',strength:'16'},worg={...newCharacterSheet(),name:'Worg',kind:'Mostro',hitPoints:'30',armorClass:'13',strength:'12'}
const db={characters:[{id:mage.id,ownerId:casterId,gameId,sheet:mage},{id:ally.id,ownerId:playerId,gameId,sheet:ally}]}
const game={id:gameId,masterId,revision:0,players:[{userId:casterId,characterId:mage.id},{userId:playerId,characterId:ally.id}],combatRequests:[],state:{turns:[mage,ally,worg].map((sheet,i)=>({id:i+1,sheet,description:sheet.name,hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:'',initiative:'10'})),abilities:[],combat:{activeId:1,round:1}}}
const context=actionContext(db,game,casterId,rules),action=context.actions.find(a=>a.ability.ruleId===spell.ruleId)
assert.equal(actionChoices(context,game,db).actions.find(a=>a.name===spell.name).mode,'none')
const proposal=requestProposal({id:crypto.randomUUID(),revision:0,key:action.key,option:'slot:2',cost:1,mode:'save',damageEnabled:false,packets:[{targetId:2,damage:[]}]})
prepareAction(context,proposal,rules);assert.equal(proposal.mode,'none','A stale pre-update save preview is safely normalized without losing any dice')
const entry={id:proposal.id,ownerId:casterId,characterId:mage.id,characterName:mage.name,actorName:'Caster',actionName:spell.name,optionLabel:'Slot 2',createdAt:new Date().toISOString(),status:'pending',prolonged:false,proposal,targets:proposal.targets.map(t=>({...t,name:ally.name})),resolution:createRequestResolution(db,game,context,action,proposal,rules)}
game.combatRequests.push(entry)
assert(validCombatRequest(entry));assert(validCombatRequest(JSON.parse(JSON.stringify(entry))))
assert.equal(visibleRequests(game,casterId)[0].wind,undefined,'Target defenses and Master choices stay private')
assert.equal(visibleRequests(game,masterId)[0].wind.candidates.length,3)
assert.equal(pendingSavingThrows(db,game,playerId).length,0,'No saving throw is forced at casting time')
recordResolutionRoll(db,game,masterId,entry,{kind:'wind',wind:{selected:[2],saves:{2:{mode:'dice',die:10}}}},rules)
const originalProposal=JSON.stringify(entry.proposal),refresh={kind:'wind-refresh'}
game.revision++
assert.equal(requestStatus(game,entry),'stale');assert.equal(visibleRequests(game,masterId)[0].wind.editable,false)
assert.throws(()=>recordResolutionRoll(db,game,casterId,entry,refresh,rules),e=>e.status===403)
game.state.combat.activeId=2
assert.throws(()=>recordResolutionRoll(db,game,masterId,entry,refresh,rules),e=>e.status===409,'Reopening cannot bypass the caster’s turn')
game.state.combat.activeId=1
db.characters[0].sheet={...mage,playerDetails:{...mage.playerDetails,'slots.2.used':'3'}}
assert.throws(()=>recordResolutionRoll(db,game,masterId,entry,refresh,rules),e=>e.status===409,'Reopening checks remaining slots without spending them')
db.characters[0].sheet={...mage,playerDetails:{...mage.playerDetails,spellDC:'15'}}
const removed=game.state.turns.splice(1,1)[0]
assert.throws(()=>recordResolutionRoll(db,game,masterId,entry,refresh,rules),e=>e.status===409,'A removed original target gives a recoverable error')
game.state.turns.splice(1,0,removed)
recordResolutionRoll(db,game,masterId,entry,refresh,rules)
assert.equal(requestStatus(game,entry),'pending');assert.equal(visibleRequests(game,masterId)[0].wind.editable,true)
assert.equal(entry.resolution.plan.deferredSave.dc,15,'Reopening reads the current caster DC')
assert.deepEqual(entry.resolution.wind.saves,{},'Saves from the old session state must be entered again')
assert.equal(JSON.stringify(entry.proposal),originalProposal,'Player retries still match the immutable proposal')
assert(validCombatRequest(JSON.parse(JSON.stringify(entry))))
const refreshedRolls=entry.rollsRevision
recordResolutionRoll(db,game,masterId,entry,refresh,rules);assert.equal(entry.rollsRevision,refreshedRolls,'Retrying refresh does not reset new edits')
const approve=wind=>applyCombatRequest(db,game,entry,rules,{confirmed:true,wind,targets:wind.selected.map(id=>({id,damage:'0'})),effects:[]})
for(const wind of [{selected:[3],saves:{'3.0':{mode:'dice',die:10}}},{selected:[99],saves:{}},{selected:[3,3],saves:{}},{selected:[3],saves:{3:{mode:'dice',die:21}}},{selected:[3],saves:{3:{mode:'dice',die:10,secondDie:12}}},{selected:[3],saves:{3:{mode:'manual',success:'true'}}},{selected:[3],saves:{3:{mode:'manual'}}},{selected:[3],saves:{3:{mode:'dice',bonuses:{666:1}}}}])assert.throws(()=>approve(wind),e=>e.status===400)
assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],undefined,'Rejected reviews consume no resources')
const result=approve({selected:[3],saves:{3:{mode:'manual',success:false}}})
assert.deepEqual(result.state.abilities[0].targets.map(t=>t.id),[3],'The Master can replace the selected creature')
assert(result.state.abilities[0].active&&result.state.abilities[0].concentration)
assert.equal(result.state.turns[2].hitPoints,'30','Wind never deals HP damage')
assert.equal(result.sheets.find(s=>s.id===mage.id).playerDetails['slots.2.used'],'1')
entry.resolution.wind=result.wind;entry.status='approved';game.state=result.state;game.revision++
for(const sheet of result.sheets)db.characters.find(r=>r.id===sheet.id).sheet=sheet
assert.deepEqual(visibleRequests(game,casterId)[0].targets.map(t=>t.name),['Worg'],'The caster sees corrected recipients without their defenses')
assert(validCombatRequest(JSON.parse(JSON.stringify(entry))))
const body={kind:'wind',wind:{selected:[2,3],saves:{2:{mode:'dice',die:11},3:{mode:'manual',success:true}}}}
assert.throws(()=>recordResolutionRoll(db,game,playerId,entry,body,rules),e=>e.status===403)
recordResolutionRoll(db,game,masterId,entry,body,rules)
assert.deepEqual(game.state.abilities.find(a=>a.ruleId===spell.ruleId&&a.active).targets.map(t=>t.id),[2,3],'Saving new recipients updates the active effect too')
const source=entry.resolution.plan,profile=entry.resolution.wind.candidates.find(c=>c.id===2).profile
const plan={...source,kind:'save',save:{ability:'strength',dc:source.deferredSave.dc,onSuccess:'none'}}
assert.equal(resolveTarget(plan,[{targetId:2,damage:[]}],profile,{save:12}).save.success,true,'A total equal to the caster DC succeeds, with the Strength bonus added')
assert.equal(resolveTarget(plan,[{targetId:2,damage:[]}],profile,{save:11}).save.success,false,'A total below the caster DC fails')
assert.equal(resolveTarget({...plan,save:{...plan.save,dc:30}},[{targetId:2,damage:[]}],profile,{save:20}).save.success,false,'Natural 20 is not automatic success on a save')
assert.equal(resolveTarget(plan,[{targetId:2,damage:[]}],{...profile,saveBonus:30},{save:1}).save.success,true,'Natural 1 is not automatic failure on a save')
assert.equal(resolveTarget(plan,[{targetId:2,damage:[]}],{...profile,automaticSaveFailure:true},{saveOutcome:true}).save.success,true,'Explicit Master decisions override dice requirements')
recordResolutionRoll(db,game,masterId,entry,{...body,wind:{selected:[2],saves:{2:{mode:'dice',die:4}}}},rules)
assert.equal(entry.resolution.wind.saves[2].die,4,'A later turn can replace the previous save')
assert.deepEqual(game.state.abilities.find(a=>a.ruleId===spell.ruleId&&a.active).targets.map(t=>t.id),[2],'Removing a recipient removes it from the active effect')
assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],'1','Updating saves never spends a second slot')
assert(validCombatRequest(JSON.parse(JSON.stringify(entry))));assert.equal(game.state.turns[1].hitPoints,'30')
game.state.abilities[0].active=false
assert.equal(visibleRequests(game,masterId)[0].wind.editable,false)
assert.throws(()=>recordResolutionRoll(db,game,masterId,entry,body,rules),e=>e.status===409)
assert.throws(()=>recordResolutionRoll(db,game,masterId,entry,refresh,rules),e=>e.status===409,'Reopening never reactivates an approved or expired cast')
// Reproduce an approved wind notification retaining the caster's ended Bless die.
const copy=structuredClone({db,game}),testDb=copy.db,testGame=copy.game
testDb.characters[0].sheet=structuredClone(mage)
const bless=templateFromCatalog(rules.catalog.abilities.find(a=>a.data.referenceId==='phb2014:spell:bless'))
const blessing={...bless,id:80,ownerId:1,active:true,concentration:true,remainingTurns:10,targets:[{id:2,damage:'0',resolved:true}],resolutionEffects:[{kind:'roll-bonus',rolls:['save','attack'],sides:4,trigger:'always'}]}
testGame.state.abilities=[blessing];testGame.state.combat.activeId=1
const testContext=actionContext(testDb,testGame,casterId,rules),testAction=testContext.actions.find(a=>a.ability.ruleId===spell.ruleId)
const testProposal={...proposal,id:crypto.randomUUID(),revision:testGame.revision}
const testEntry={...entry,id:testProposal.id,status:'pending',proposal:testProposal,reviewedRevision:testGame.revision,resolution:createRequestResolution(testDb,testGame,testContext,testAction,testProposal,rules)}
testGame.combatRequests=[testEntry]
assert.equal(testEntry.resolution.wind.candidates.find(c=>c.id===2).profile.saveDice,undefined,'A caster replacing their own Bless with wind must not preview the ended d4')
blessing.ownerId=3
testEntry.resolution=createRequestResolution(testDb,testGame,testContext,testAction,testProposal,rules)
assert.equal(testEntry.resolution.wind.candidates.find(c=>c.id===2).profile.saveDice[0].id,80,'Bless from another caster remains available')
const savedWind={selected:[2],saves:{2:{mode:'dice',die:12,bonuses:{80:2}}}}
const withBless=applyCombatRequest(testDb,testGame,testEntry,rules,{confirmed:true,wind:savedWind,targets:[{id:2,damage:'0'}],effects:[]})
testEntry.resolution.wind=withBless.wind;testEntry.status='approved';testGame.state=withBless.state
for(const sheet of withBless.sheets)testDb.characters.find(r=>r.id===sheet.id).sheet=sheet
assert(testGame.state.abilities.find(a=>a.id===80).active,'Casting wind preserves another caster’s Bless')
testGame.state.abilities.find(a=>a.id===80).active=false
recordResolutionRoll(testDb,testGame,masterId,testEntry,{kind:'wind',wind:savedWind},rules)
assert.equal(testEntry.resolution.wind.candidates.find(c=>c.id===2).profile.saveDice,undefined,'Saving an older review refreshes effects that have ended')
assert.deepEqual(testEntry.resolution.wind.saves[2].bonuses,{},'An expired known d4 is removed without rejecting the remaining valid save')
assert.equal(savedWind.saves[2].bonuses[80],2,'Normalization does not mutate the submitted input')
assert.equal(testEntry.resolution.wind.saves[2].die,12,'The actual d20 is retained')
const currentProfile=testEntry.resolution.wind.candidates.find(c=>c.id===2).profile
assert.equal(resolveTarget({...testEntry.resolution.plan,kind:'save',save:{ability:'strength',dc:14,onSuccess:'none'}},[{targetId:2,damage:[]}],currentProfile,{save:12,saveBonuses:testEntry.resolution.wind.saves[2].bonuses}).save.total,15,'The new total is d20 12 + Strength 3, without the expired +2')
assert.throws(()=>recordResolutionRoll(testDb,testGame,masterId,testEntry,{kind:'wind',wind:{selected:[2],saves:{2:{mode:'dice',die:12,bonuses:{666:2}}}}},rules),e=>e.status===400,'Unknown bonus IDs still cannot be injected')
console.log('PASS Gust review: concentration replacement, other-caster Bless, expired bonus cleanup, stale preview normalization, strict validation, no slot/HP duplication and persistence')
