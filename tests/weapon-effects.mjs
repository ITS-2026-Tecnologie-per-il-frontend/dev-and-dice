import {resetTurnEconomy} from '../src/domain/dnd/TurnEconomy.ts'
// Run: node tests/weapon-effects.mjs — isolated rules and approval transactions; no live accounts.
import assert from 'node:assert/strict'
import {combatRules,actionContext,actionChoices,prepareAction,requestProposal,createRequestResolution,applyCombatRequest,visibleRequests,validCombatRequest} from '../server/combat-requests.mjs'
import {weaponEffectDetails,resolutionPlan,weaponProfile,weaponDisplayName,damageBonusText,resolveTarget,defenseProfile,validWeaponEnchantments} from '../src/domain/dnd/CombatResolution.ts'
import {combatAbilityInfo} from '../src/domain/dnd/CombatActions.ts'
import {newCharacterSheet,findSheetCombatAbility,importSheetAbility} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
import {addInventoryItem,setInventoryReference,ownedInventoryItems,separateInventoryItem,reconcileInventory} from '../src/utils/Inventory.ts'
import {validateState} from '../server/games.mjs'
const rules=await combatRules(),{data,catalog}=rules
assert.equal(combatAbilityInfo({ruleId:'phb2014:subclass-feature:war-1-war-priest',duration:'Senza conteggio',remainingTurns:0},catalog,data).unit,'bonus-action','Verified class feature activation is preserved even without a catalog entry')
const spell=id=>templateFromCatalog(catalog.abilities.find(a=>a.data.referenceId==='phb2014:spell:'+id))
const dagger={...newCharacterSheet(),name:'Baldur',strength:'10',dexterity:'16',armorClass:'13',hitPoints:'30',playerDetails:{'attacks.0.0':'Pugnale','attacks.0.1':'5','attacks.0.2':'1d4+3','attacks.0.3':'Perforante'}}
const attack={...dagger.abilities[0],id:0,name:'Pugnale',ruleId:'sheet-attack:0',ownerId:2,active:false,duration:'Senza conteggio',remainingTurns:0,timed:false}
const weaponContext={data,active:[]}
let plan=resolutionPlan(dagger,attack,catalog,'free',weaponContext)
assert.deepEqual(plan.damageTypes,['piercing']);assert.equal(plan.magical,false,'A standard dagger is nonmagical without prompting the Master')
assert.equal(plan.damageBonuses.piercing,3)
assert.equal(plan.attackAbility,'dexterity','A known finesse weapon reports the attribute actually selected by its profile')
assert.equal(weaponProfile({...dagger,strength:'16'},0,data).attackAbility,undefined,'Equal finesse modifiers do not invent which attribute the player chose')
assert.equal(weaponProfile({...dagger,playerDetails:{...dagger.playerDetails,'attacks.0.0':'Mace'}},0,data).attackAbility,'strength')
assert.equal(weaponProfile({...dagger,playerDetails:{...dagger.playerDetails,'attacks.0.0':'Longbow'}},0,data).attackAbility,'dexterity')
const defender={...newCharacterSheet(),armorClass:'13',playerDetails:{'combat.resistances':'fuoco'}}
const profile=defenseProfile(defender,undefined,[],3)
assert.equal(resolveTarget(plan,[{targetId:3,die:13,damage:[{type:'piercing',amount:2}]}],profile).damage,5,'Only dice are entered; the flat damage bonus is added once')
const conditionalHit=[{targetId:3,die:13,damage:[{type:'piercing',amount:2}]}]
assert.equal(resolveTarget(plan,conditionalHit,profile,{criticalHit:true}).damage,null,'A condition-based critical requires its additional dice')
assert.equal(resolveTarget(plan,conditionalHit,profile,{criticalHit:true,critical:{'0:piercing':2}}).damage,7,'A condition-based critical adds dice and the modifier once')
assert.equal(resolveTarget(plan,[{...conditionalHit[0],die:1}],profile,{criticalHit:true,critical:{'0:piercing':2}}).damage,0,'A critical ruling never turns a natural miss into a hit')
assert.equal(resolveTarget({...plan,kind:'automatic',weaponName:undefined},conditionalHit,profile,{criticalHit:true}).packets[0].critical,false,'An effect without an attack is not a critical hit')

assert.equal(resolveTarget({...plan,damageTypes:['untyped'],magical:null},[{targetId:3,die:2,damage:[{type:'untyped',amount:4}]}],{...profile,reviewDamage:true}).damage,0,'A known miss never needs weapon properties')
let owned=addInventoryItem(dagger,data,'Pugnale','dagger','2')
const id=ownedInventoryItems(owned)[0].id
owned=setInventoryReference(owned,'attacks.0.0',id)
const separated=separateInventoryItem(owned,id)
assert.deepEqual(ownedInventoryItems(separated).map(i=>Number(i.quantity)),[1,1])
assert.equal(separated.playerDetails['inventory.ref.attacks.0.0'],id)
assert.equal(new Set(ownedInventoryItems(separated).map(i=>i.id)).size,2)
assert.equal(ownedInventoryItems(owned)[0].quantity,'2','Splitting does not mutate the source')
const generated={...owned,playerDetails:{...owned.playerDetails,'creation.enabled':'true','inventory.0.source':'initial:weapon','inventory.0.generated':'test'}}
assert.equal(ownedInventoryItems(reconcileInventory(generated,data)).length,1,'Reading inventory preserves existing starting grants')
const mage={...newCharacterSheet(),name:'Maga',characterClass:'Mago',level:'5',wisdom:'16',abilities:['magic-weapon','elemental-weapon','shillelagh'].map(spell),playerDetails:{'slots.2.total':'10','slots.3.total':'10',castingAbility:'Saggezza'}}
const known= combatAbilityInfo({...spell('magic-weapon'),instantaneous:true,damageEnabled:true},catalog)
assert.equal(known.damage,false,'Known weapon spells ignore stale damage flags')
assert.equal(known.instantaneous,false,'Magic Weapon has a duration even with a stale instantaneous flag')
const weaponSpell=resolutionPlan(mage,spell('magic-weapon'),catalog,'slot:2')
assert.equal(weaponSpell.kind,'none');assert.equal(weaponSpell.weaponEffect.attackBonus,1);assert.equal(weaponSpell.weaponEffect.damageBonus,1)
assert.equal(resolutionPlan(mage,spell('magic-weapon'),catalog,'slot:4').weaponEffect.attackBonus,2)
assert.equal(resolutionPlan(mage,spell('elemental-weapon'),catalog,'slot:5').weaponEffect.extraDamage.dice,'2d4')
assert.equal(resolutionPlan(mage,spell('shillelagh'),catalog,'cantrip').weaponEffect.castingModifier,3)
const source={id:1,name:'Arma magica',ruleId:'phb2014:spell:magic-weapon',ownerId:1,active:true,timed:true,remainingTurns:600,duration:'1 ora',weaponEffects:[{characterId:owned.id,itemId:id,magical:true,attackBonus:1,damageBonus:1}]}
const details=weaponEffectDetails(source.weaponEffects,[owned])[0]
assert.equal(details.targetName,'Baldur');assert.equal(details.itemName,'Pugnale')
assert.equal(details.damageBonus,1);assert.equal(details.attackBonus,1)
assert(!('characterId' in details)&&!('itemId' in details),'Player summaries expose only the affected object and its effect')
assert.equal(weaponEffectDetails([{...source.weaponEffects[0],damageBonus:2,attackBonus:2}],[owned])[0].damageBonus,2,'Summaries use the actual applied bonus')
assert.equal(weaponEffectDetails(source.weaponEffects,[])[0].itemName,'Arma non disponibile','Missing inventory is explicit')
plan=resolutionPlan(owned,attack,catalog,'free',{data,active:[source]})
assert.equal(plan.magical,true);assert.equal(plan.attackBonus,6);assert.equal(plan.damageBonuses.piercing,4)
assert.equal(plan.attackBonusSources.reduce((sum,source)=>sum+source.amount,0),6,'Attack modifier provenance sums to the applied modifier')
assert(plan.attackBonusSources.some(source=>source.name==='Arma magica'&&source.amount===1),'The tooltip keeps the spell attack bonus separate')
const manualAttack=resolutionPlan({...owned,playerDetails:{...owned.playerDetails,'attacks.0.1':'-1','creation.override.attacks.0.1':'true'}},attack,catalog,'free',{data,active:[source]})
assert.equal(manualAttack.attackBonus,0);assert.deepEqual(manualAttack.attackBonusSources,[{name:'Modificatore indicato nella scheda',amount:-1},{name:'Arma magica',amount:1}],'A manual override keeps its actual provenance instead of inventing proficiency')
assert.equal(weaponDisplayName(plan,[{id:1,name:'Aster'}]),'Pugnale - magica (Arma magica - Aster)')
assert.deepEqual(plan.damageBonusSources.piercing,[{name:'arma',amount:3},{name:'Arma magica',amount:1}])
const example={...owned,playerDetails:{...owned.playerDetails,'attacks.0.2':'1d4+2'}}
const explained=resolutionPlan(example,attack,catalog,'free',{data,active:[source]})
const six=resolveTarget(explained,[{targetId:3,die:12,damage:[{type:'piercing',amount:3}]}],profile)
assert.equal(six.damage,6)
assert.equal(resolveTarget(explained,[{targetId:3,die:20,damage:[{type:'piercing',amount:3}]}],profile,{critical:{'0:piercing':3}}).damage,9,'A critical adds only the additional die; the spell bonus is applied once')
assert.match(six.packets[0].steps[0],/3 \+ 2 \(arma\) \+ 1 \(Arma magica\).*6/,'Damage explains the original weapon bonus and spell bonus separately')
assert.equal(damageBonusText({...explained,damageBonusSources:undefined},'piercing'),'+ 3','Legacy totals do not invent sources')
assert.equal(damageBonusText({...explained,damageBonuses:{piercing:-3}},'piercing'),'− 3','Manual overrides do not reuse inconsistent source components')
assert.equal(weaponDisplayName(resolutionPlan(example,attack,catalog,'free',{data,active:[{...source,remainingTurns:0}]}),[{id:1,name:'Aster'}]),undefined,'Expiry restores the original displayed name')
assert.equal(example.playerDetails['attacks.0.0'],'Pugnale','Enhancements never rename the saved weapon')
assert.equal(weaponProfile(owned,0,data,[{...source,active:false}]).magical,false)
assert.equal(weaponProfile(owned,0,data,[{...source,remainingTurns:0}]).attackBonus,5)
const elemental={...source,weaponEffects:[{...source.weaponEffects[0],damageBonus:0,extraDamage:{type:'fire',dice:'1d4'}}]}
plan=resolutionPlan(owned,attack,catalog,'free',{data,active:[elemental]})
assert.deepEqual(plan.damageTypes,['piercing','fire'])
assert.equal(resolveTarget(plan,[{targetId:3,die:13,damage:[{type:'piercing',amount:2},{type:'fire',amount:3}]}],profile).damage,6,'Typed extra damage uses its own resistance')
assert.equal(resolveTarget(plan,[{targetId:3,die:20,damage:[{type:'piercing',amount:2},{type:'fire',amount:3}]}],profile,{critical:{'0:piercing':2,'0:fire':3}}).damage,10,'Critical dice do not double flat bonuses')
assert.equal(resolveTarget({...plan,damageBonuses:{piercing:-3}},[{targetId:3,die:20,damage:[{type:'piercing',amount:1}]}],profile,{critical:{'0:piercing':2}}).damage,0,'Negative modifiers are applied after all critical dice, before clamping damage to zero')
assert(!validWeaponEnchantments([{...source.weaponEffects[0],itemId:''}]))
const gameId=crypto.randomUUID(),caster=crypto.randomUUID(),player=crypto.randomUUID(),master=crypto.randomUUID()
const db={characters:[{id:mage.id,ownerId:caster,gameId,sheet:mage},{id:owned.id,ownerId:player,gameId,sheet:owned}]}
const turn=(id,sheet)=>({id,sheet,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})
const game={id:gameId,revision:0,masterId:master,players:[{userId:caster,characterId:mage.id},{userId:player,characterId:owned.id}],state:{turns:[turn(1,mage),turn(2,owned)],abilities:[],combat:{activeId:1,round:1}}}
function proposal(spellId,targetId=2) {
 const context=actionContext(db,game,caster,rules),action=context.actions.find(a=>a.ability.name===spell(spellId).name),option=action.options.find(o=>o.id.startsWith('slot:'))??action.options[0]
 const proposal=requestProposal({id:crypto.randomUUID(),revision:game.revision,key:action.key,option:option.id,cost:1,mode:'none',damageEnabled:false,packets:[{targetId,damage:[]}]})
 prepareAction(context,proposal,rules)
 const entry={id:proposal.id,ownerId:caster,characterId:mage.id,characterName:mage.name,actorName:'Caster',actionName:action.ability.name,createdAt:new Date().toISOString(),status:'pending',prolonged:false,optionLabel:option.label,proposal,targets:proposal.targets.map(t=>({...t,name:'Baldur'})),resolution:createRequestResolution(db,game,context,action,proposal,rules)}
 assert(validCombatRequest(entry));return entry
}
const importedSource={...spell('magic-weapon'),id:99,ownerId:1,active:true,remainingTurns:600}
assert.equal(findSheetCombatAbility([importedSource],mage.abilities[0],1,0)?.id,99,'Approved casts without a sheet index match their original spell')
assert.equal(importSheetAbility([importedSource],mage,1,0,100).length,1,'Opening an approved cast must not import a duplicate')
assert.equal(findSheetCombatAbility([{...importedSource,id:100,sheetAbilityIndex:0,active:false},importedSource],mage.abilities[0],1,0)?.id,99,'The active cast wins over an older inactive configuration')
const entry=proposal('magic-weapon')
const beforeApproval=structuredClone(db.characters[0].sheet)
db.characters[0].sheet={...beforeApproval,playerDetails:{...beforeApproval.playerDetails,'combat.bonusActionUsed':'true'}}
assert.throws(()=>applyCombatRequest(db,game,entry,rules,{confirmed:true,targets:[{id:2,damage:'0'}]}),/già usato l’azione bonus/,'Approval revalidates canonical state after proposal')
assert.equal(db.characters[0].sheet.playerDetails['slots.2.used'],beforeApproval.playerDetails['slots.2.used'],'A rejected approval spends no slot')
db.characters[0].sheet=beforeApproval

assert.equal(entry.resolution.weaponChoices[0].items[0].quantity,2)
assert.equal(visibleRequests({...game,combatRequests:[entry]},caster)[0].weaponChoices,undefined,'Another character inventory never leaks to the caster')
assert.equal(visibleRequests({...game,combatRequests:[entry]},master)[0].weaponChoices[0].items[0].id,id)
const body={confirmed:true,targets:[{id:2,damage:'0'}]}
assert.throws(()=>applyCombatRequest(db,game,entry,rules,body),e=>e.status===400)
assert.throws(()=>applyCombatRequest(db,game,entry,rules,{...body,weapons:[{targetId:2,itemId:'not-owned'}]}),e=>e.status===400)
const result=applyCombatRequest(db,game,entry,rules,{...body,weapons:[{targetId:2,itemId:id}]})
assert.deepEqual(ownedInventoryItems(result.sheets.find(s=>s.id===owned.id)).map(i=>Number(i.quantity)),[1,1])
assert.equal(result.sheets.find(s=>s.id===mage.id).playerDetails['slots.2.used'],'1')
assert.equal(result.state.abilities[0].weaponEffects[0].itemId,id)
assert.deepEqual(validateState(JSON.parse(JSON.stringify(result.state))).abilities[0].weaponEffects,result.state.abilities[0].weaponEffects,'Weapon bindings persist across JSON/state validation')
game.state=result.state;game.revision++
for(const sheet of result.sheets)db.characters.find(r=>r.id===sheet.id).sheet=sheet
const currentSource=game.state.abilities[0]
const legacyDuplicate={...currentSource,id:100,sheetAbilityIndex:0,active:false}
const duplicateGame={...game,state:{...game.state,abilities:[legacyDuplicate,...game.state.abilities]}}
assert.equal(actionContext(db,duplicateGame,caster,rules,true).actions.find(action=>action.ability.ruleId===currentSource.ruleId).ability.id,currentSource.id,'Player previews select the active cast over a legacy inactive duplicate')
game.state.combat.activeId=2
const choices=actionChoices(actionContext(db,game,player,rules),game,db),daggerAction=choices.actions.find(a=>a.name==='Pugnale')
assert.equal(daggerAction.resolution.magical,true);assert.equal(daggerAction.resolution.attackBonus,6)
assert.equal(daggerAction.resolution.damageBonuses.piercing,4)
assert.equal(daggerAction.displayName,`Pugnale - magica (${spell('magic-weapon').name} - Maga)`)
const attackContext=actionContext(db,game,player,rules),attackAction=attackContext.actions.find(a=>a.ability.name==='Pugnale')
const attackProposal=requestProposal({id:crypto.randomUUID(),revision:game.revision,key:attackAction.key,option:'free',cost:1,mode:'attack',damageEnabled:true,packets:[{targetId:1,die:12,damage:[{type:'piercing',amount:3}]}]})
const archived={...entry,id:attackProposal.id,ownerId:player,characterId:owned.id,actionName:'Pugnale',proposal:attackProposal,targets:attackProposal.targets.map(target=>({...target,name:'Maga'})),resolution:createRequestResolution(db,game,attackContext,attackAction,attackProposal,rules)}
assert(validCombatRequest(JSON.parse(JSON.stringify(archived))),'Weapon provenance survives request persistence')
const invalid=structuredClone(archived);invalid.resolution.plan.damageBonusSources.piercing[0].amount='2'
assert(!validCombatRequest(invalid),'Persisted damage source amounts must be integers')
const invalidCaster=structuredClone(archived);invalidCaster.resolution.plan.weaponEnhancements[0].casterId={}
assert(!validCombatRequest(invalidCaster),'Malformed caster metadata is rejected')
game.state.abilities[0].active=false
assert.equal(actionChoices(actionContext(db,game,player,rules),game,db).actions.find(a=>a.name==='Pugnale').resolution.magical,false)
assert.equal(actionChoices(actionContext(db,game,player,rules),game,db).actions.find(a=>a.name==='Pugnale').displayName,undefined)

// Enchanting the caster's own stacked weapon must preserve the slot spend.
let self=addInventoryItem(db.characters[0].sheet,data,'Pugnale','dagger','2')
const selfId=ownedInventoryItems(self)[0].id
self=setInventoryReference(self,'attacks.0.0',selfId)
self={...self,playerDetails:{...self.playerDetails,...resetTurnEconomy,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}}
db.characters[0].sheet=self;game.state.turns[0].sheet=self;game.state.combat.activeId=1;game.state.combat.round++
const selfEntry=proposal('magic-weapon',1)
const selfResult=applyCombatRequest(db,game,selfEntry,rules,{confirmed:true,targets:[{id:1,damage:'0'}],weapons:[{targetId:1,itemId:selfId}]})
assert.equal(selfResult.sheets.find(s=>s.id===mage.id).playerDetails['slots.2.used'],'2')
assert.deepEqual(ownedInventoryItems(selfResult.sheets.find(s=>s.id===mage.id)).map(i=>Number(i.quantity)),[1,1])
const elementalEntry=proposal('elemental-weapon')
assert.throws(()=>applyCombatRequest(db,game,elementalEntry,rules,{...body,weapons:[{targetId:2,itemId:id}]}),e=>e.status===400)
assert.throws(()=>applyCombatRequest(db,game,elementalEntry,rules,{...body,weapons:[{targetId:2,itemId:id,damageType:'necrotic'}]}),e=>e.status===400)
const elementalResult=applyCombatRequest(db,game,elementalEntry,rules,{...body,weapons:[{targetId:2,itemId:id,damageType:'fire'}]})
const enhanced=elementalResult.state.abilities.find(a=>a.ruleId==='phb2014:spell:elemental-weapon')
assert.equal(enhanced.weaponEffects[0].extraDamage.type,'fire')
assert.equal(elementalResult.sheets.find(s=>s.id===mage.id).playerDetails['slots.3.used'],'1')
assert.equal(ownedInventoryItems(elementalResult.sheets.find(s=>s.id===owned.id)).length,2,'An already separated weapon is not split again')
const otherId=ownedInventoryItems(elementalResult.sheets.find(s=>s.id===owned.id)).find(i=>i.id!==id).id
let second=setInventoryReference(elementalResult.sheets.find(s=>s.id===owned.id),'attacks.1.0',otherId)
second={...second,playerDetails:{...second.playerDetails,'attacks.1.1':'5','attacks.1.2':'1d4+3'}}
assert.equal(weaponProfile(second,1,data,[enhanced]).magical,false,'Only the selected physical weapon is enchanted')
assert.equal(weaponProfile(second,0,data,[enhanced]).magical,true)
// The rules edition is a hard boundary, even if an imported catalog entry has copied mechanics.
assert.equal(resolutionPlan({...mage,playerDetails:{...mage.playerDetails,'rules.edition':'2024'}},spell('magic-weapon'),catalog,'slot:2'),undefined)
console.log('PASS weapons: catalog defaults, separate Type column, dice-only bonuses, misses, typed enchantments, duration, inventory split, private Master choice, approval and persistence')
