// node tests/turn-economy.mjs
import assert from 'node:assert/strict'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {recordTurnAction,resetTurnEconomy,turnActionUses,turnActionSlots,turnActionCapacity} from '../src/domain/dnd/TurnEconomy.ts'
import {spendCombatUse,bonusSpellTurnError} from '../src/domain/dnd/CombatActions.ts'
import {validEffectSpecs} from '../src/domain/dnd/CombatResolution.ts'
const sheet={...newCharacterSheet(),name:'Baldur',playerDetails:{'rules2014.attackActionAttacks':'2'}}
assert.deepEqual(turnActionSlots(sheet,[],1).map(s=>s.used),[false,false,false])
const catalog={abilities:[]}
const ability={id:1,name:'Attacco',duration:'Senza conteggio',remainingTurns:0,ownerId:1,active:false,targets:[]}
let spent=spendCombatUse(sheet,ability,catalog,undefined,'free')
assert.equal(turnActionUses(spent,'action'),1,'Ordinary non-spell actions must be recorded')
spent=recordTurnAction(sheet,'action',sheet,true)
spent=recordTurnAction(spent,'action',spent,true)
assert.equal(turnActionUses(spent,'action'),1,'Extra Attack shares one action')
assert.equal(spent.playerDetails['combat.attackActionRemaining'],'0')
const bonusSpell={level:2,unit:'bonus-action'}
assert.match(bonusSpellTurnError({...sheet,playerDetails:{'rules2014.spellsThisTurn':'broken'}},bonusSpell),/Cronologia/)
assert.equal(bonusSpellTurnError(spent,bonusSpell),undefined,'A weapon action does not block a bonus spell')
assert.equal(bonusSpellTurnError({...sheet,playerDetails:{'rules2014.spellsThisTurn':'[{"level":0,"unit":"action"}]'}},bonusSpell),undefined)
assert.match(bonusSpellTurnError({...sheet,playerDetails:{'rules2014.spellsThisTurn':'[{"level":1,"unit":"action"}]'}},bonusSpell),/trucchetto/)
assert.equal(bonusSpellTurnError({...sheet,playerDetails:{'rules.edition':'2024','rules2014.spellsThisTurn':'[{"level":1,"unit":"action"}]'}},bonusSpell),undefined,'Never apply a 2014 restriction to revised rules')
const bonus=spendCombatUse(sheet,{...ability,section:'bonus'},catalog,undefined,'free')
assert.equal(turnActionUses(bonus,'bonus-action'),1)
assert.equal(turnActionUses(bonus,'action'),0)
assert.throws(()=>spendCombatUse(bonus,{...ability,section:'bonus'},catalog,undefined,'free'),/azione bonus/)
const reaction=spendCombatUse(sheet,{...ability,section:'reaction'},catalog,undefined,'free')
assert.equal(turnActionUses(reaction,'reaction'),1)
assert.throws(()=>spendCombatUse(reaction,{...ability,section:'reaction'},catalog,undefined,'free'),/reazione/)
const afterCast=recordTurnAction({...sheet,playerDetails:{...sheet.playerDetails,'combat.spellsThisTurn':'[{"unit":"action"}]'}},'action',sheet)
assert.equal(turnActionUses(afterCast,'action'),1,'Spell history and counters must not double count a cast')
const old={...sheet,playerDetails:{'rules2014.spellsThisTurn':'[{"unit":"action"},{"unit":"action"}]','combat.reactionUsed':'true'}}
assert.equal(turnActionUses(old,'action'),2,'Existing sessions retain approved additional casts')
assert.equal(turnActionUses(old,'reaction'),1)
const grant={kind:'action-grant',unit:'action',amount:1,trigger:'always',restriction:'Solo un attacco con arma.'}
assert(validEffectSpecs([grant]))
for(const invalid of [{...grant,unit:'movement'},{...grant,amount:0},{...grant,amount:1000},{...grant,restriction:3}])assert(!validEffectSpecs([invalid]))
const effect={...ability,id:2,name:'Velocità',ruleId:'phb2014:spell:haste',active:true,timed:false,targets:[{id:1,damage:'0',resolved:true}],resolutionEffects:[grant]}
let slots=turnActionSlots(afterCast,[effect],1)
assert.deepEqual(slots.map(s=>[s.unit,s.used]),[['action',true],['action',false],['bonus-action',false],['reaction',false]])
assert.equal(slots[1].source,'Velocità');assert.equal(slots[1].restriction,grant.restriction)
assert.equal(turnActionSlots(afterCast,[effect,{...effect,id:3}],1).length,4,'Repeated casts of the same spell do not stack grants')
assert.equal(turnActionSlots(afterCast,[effect],2).length,3,'A grant belongs to its target, not every participant')
assert.equal(turnActionSlots(afterCast,[{...effect,active:false}],1).length,3,'An ended grant no longer offers an action')
assert.equal(turnActionSlots(sheet,[{...effect,resolutionEffects:[]}],1).length,4,'Older manually resolved Haste casts grant their action too')
assert.equal(turnActionCapacity({...sheet,playerDetails:{'rules.edition':'2024'}},[{...effect,resolutionEffects:[]}],1,'action'),1,'Legacy 2014 Haste never supplies revised-edition rules')
const extras=['bonus-action','reaction'].map((unit,index)=>({...effect,id:10+index,ruleId:'custom:'+unit,resolutionEffects:[{...grant,unit}]}))
assert.equal(turnActionSlots(sheet,extras,1).length,5,'The model handles additional bonuses and reactions too')
for(const unit of ['bonus-action','reaction']){
 const context={abilities:extras,ownerId:1},feature={...ability,section:unit==='bonus-action'?'bonus':'reaction'}
 const one=spendCombatUse(sheet,feature,catalog,undefined,'free',1,context),two=spendCombatUse(one,feature,catalog,undefined,'free',1,context)
 assert.equal(turnActionUses(two,unit),2,'A real grant permits consuming its second box')
 assert.throws(()=>spendCombatUse(two,feature,catalog,undefined,'free',1,context))
}

const instantCatalog={abilities:[{id:'surge',name:'Azione impetuosa',type:'ability',data:{mechanics:{casting:{unit:'none'},duration:'Instantaneous',effect:{target:'self',actionGrants:[{unit:'action',amount:1}]}}}}]}
const surge=spendCombatUse(sheet,{...ability,name:'Azione impetuosa',catalogId:'surge'},instantCatalog,undefined,'free')
assert.equal(turnActionUses(surge,'action'),0,'Granting an extra action is not itself necessarily an action')
assert.equal(turnActionSlots(surge,[],1).length,4,'An instantaneous self grant survives the disappearance of its card')
assert.equal(turnActionCapacity(surge,[],1,'action'),2)
assert.equal(turnActionSlots(surge,[],1)[1].temporary,true,'Instantaneous grants expire rather than refresh each turn')
const reset={...surge,playerDetails:{...reaction.playerDetails,...resetTurnEconomy,'combat.spellsThisTurn':'[]','rules2014.spellsThisTurn':'[]'}}
assert.deepEqual(turnActionSlots(reset,[],1).map(s=>s.used),[false,false,false])
assert.doesNotThrow(()=>turnActionSlots({...sheet,playerDetails:{'combat.spellsThisTurn':'broken','combat.actionUses':'invalid'}},[],1))
console.log('PASS turn economy: ordinary actions, spell history, bonus/reaction use, legacy saves, Extra Attack, grants, non-stacking, restrictions, expiry and owner resets')
