// node tests/turn-economy.mjs
import assert from 'node:assert/strict'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {recordTurnAction,resetTurnEconomy,turnActionUses,turnActionSlots,turnActionCapacity} from '../src/domain/dnd/TurnEconomy.ts'
import {spendCombatUse,bonusSpellTurnError,combatAbilityInfo,combatUseRequirements} from '../src/domain/dnd/CombatActions.ts'
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

const context={abilities:[],ownerId:1,combat:{activeId:1,round:1}},feature={...ability,section:'bonus'}
assert.match(combatUseRequirements(sheet,feature,catalog,undefined,{...context,combat:{activeId:2,round:1}}).error,/turno/)
assert.match(combatUseRequirements(bonus,feature,catalog,undefined,context).error,/già usato/)
const incapacitated={...ability,active:true,timed:false,targets:[{id:1}],resolutionEffects:[{kind:'condition',condition:'incapacitated',trigger:'always'}]}
assert.match(combatUseRequirements(sheet,feature,catalog,undefined,{...context,abilities:[incapacitated]}).error,/incapacitato/)
const priorSpell={...sheet,playerDetails:{...sheet.playerDetails,...resetTurnEconomy,'rules2014.spellsThisTurn':'[{"level":1,"unit":"action"}]'}}
assert.equal(combatUseRequirements(priorSpell,feature,catalog,undefined,context).error,undefined,'Non-spell bonuses are not subject to the bonus-spell restriction')
assert.match(bonusSpellTurnError({...sheet,playerDetails:{'rules2014.spellsThisTurn':'[{"level":2,"unit":"bonus-action"}]'}},{level:1,unit:'action'}),/soltanto un trucchetto/)
assert.equal(bonusSpellTurnError({...sheet,playerDetails:{'rules2014.spellsThisTurn':'[{"level":2,"unit":"bonus-action"}]'}},{level:0,unit:'action'}),undefined)
const priestCatalog={abilities:[{id:'priest',name:'Sacerdote di Guerra',description:'',type:'ability',data:{mechanics:{effect:{activation:'bonus-action',trigger:'use-Attack-action'}}}}]}
const priest={...ability,catalogId:'priest',requirementsConfirmed:true},fresh={...sheet,playerDetails:{...sheet.playerDetails,...resetTurnEconomy}}
assert.equal(combatAbilityInfo(priest,priestCatalog).unit,'bonus-action')
assert.match(combatUseRequirements(fresh,priest,priestCatalog,undefined,context).error,/prima.*Attaccare/)
assert.match(combatUseRequirements(recordTurnAction(fresh,'action'),priest,priestCatalog,undefined,context).error,/prima.*Attaccare/,'Using an action on a spell is not the Attack action')
const attacked=recordTurnAction(fresh,'action',fresh,true)
assert.equal(attacked.playerDetails['combat.attackActionUsed'],'true')
assert.equal(combatUseRequirements(attacked,priest,priestCatalog,undefined,context).error,undefined)
assert.equal(recordTurnAction(fresh,'bonus-action',fresh,true).playerDetails['combat.attackActionUsed'],'false','A bonus attack is not an Attack action')
assert.equal(combatUseRequirements(recordTurnAction(sheet,'action'),priest,priestCatalog,undefined,context).manualChecks.length,1,'Legacy ambiguous actions require a Master ruling')
assert.throws(()=>spendCombatUse(fresh,priest,priestCatalog,undefined,'free',1,context),/prima.*Attaccare/)
assert.equal(turnActionUses(spendCombatUse(attacked,priest,priestCatalog,undefined,'free',1,context),'bonus-action'),1)
const wolfCatalog={abilities:[{id:'wolf',name:'Lupo',description:'',type:'ability',data:{mechanics:{effect:{activation:'bonus-action-on-own-turn',requires:'raging',trigger:'hit-Large-or-smaller-creature-with-melee-weapon-attack'}}}}]}
const wolf={...ability,catalogId:'wolf'}
assert.equal(combatAbilityInfo(wolf,wolfCatalog).unit,'bonus-action')
assert.match(combatUseRequirements(fresh,wolf,wolfCatalog,undefined,context).error,/Ira/)
const raging={...fresh,playerDetails:{...fresh.playerDetails,'rules2014.raging':'true'}}
assert.equal(combatUseRequirements(raging,wolf,wolfCatalog,undefined,context).manualChecks.length,1)
assert.throws(()=>spendCombatUse(raging,wolf,wolfCatalog,undefined,'free',1,context),/Conferma/)
assert.equal(turnActionUses(spendCombatUse(raging,{...wolf,requirementsConfirmed:true},wolfCatalog,undefined,'free',1,context),'bonus-action'),1)
assert.match(combatUseRequirements({...fresh,playerDetails:{'combat.spellsThisTurn':'broken'}},feature,catalog,undefined,context).error,/Cronologia/)
console.log('PASS turn economy: ordinary actions, spell history, bonus/reaction use, legacy saves, Extra Attack, grants, non-stacking, restrictions, expiry and owner resets')
