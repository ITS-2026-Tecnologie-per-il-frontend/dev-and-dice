import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { loadCandidateCreationData, warlockProgression, optionIssues, invocationSelectionIssues, recoverResource, patronExpandedSpellChoices,
    fighterProgression, fighterSelectionIssues, maneuverResources, eldritchKnightSpellReplacementIssues, selectedSubclassFeaturePlan,
    rogueSneakAttack, rogueSpellcastingProgression, totemSelectionIssues,
    reviewedCreature, familiarStatistics, chainFamiliarAttackPlan, wildShapeIssues, druidCircleSpellGrants, wildShapeResources,
    draconicBreath, racialAbilityBonuses, backgroundTableEntry, backgroundFeatureChoice,
    bardProgression, bardInspirationResource, magicalSecretSelectionIssues,
    paladinOathSpellGrants, paladinResourcePools, paladinSmiteDamage,
    rangerProgression, hunterSelectionIssues, rangerCompanionStatistics,
    monkResources, recoverMonkKi, monkDisciplineSelectionIssues, monkDisciplineSpellUse,
    wizardProgression, wizardChoiceIssues, wizardSpellCopyPlan, wizardOverchannelBacklash,
    clericProgression, clericDomainSpellGrants, preserveLifeAllocation,
    sorcererProgression, metamagicSelectionIssues, sorcererFlexibleCasting, wildMagicTableEntry,
    equipmentPurchase, equipmentPackContents, trinketTableEntry, luckyOwnRollChoice, shortRestHitDieHealing,
    multiclassSpellPools, spellCastPlan, magicItemAttunementPlan, magicItemUsePlan, magicItemResource, featSelectionIssues, combatContestPlan, readiedActionPlan,
    optionalRulePlan, firearmUsePlan, poisonExposurePlan, madnessTableEntry, storedSpellOperation, absorptionRodOperation, spellScrollPlan, spendMagicItemDuration, legendaryCreatureActionPlan, sentientItemConflictPlan, magicItemPropertyTableEntry, supernaturalGiftGrantPlan, supernaturalGiftSpellPlan, treasureTableEntry, treasureCoinPlan, minorElementalConjurationPlan, celestialConjurationPlan, groupConjurationPlan, woodlandConjurationPlan, animalConjurationPlan, singleConjurationPlan, hagCovenSpellPlan, ironFlaskContentsPlan, ironFlaskCapturePlan, deckIllusionPlan, chaseDashPlan, chaseEscapePlan, objectDamagePlan, spellPointSlotPlan, levelHitPointGain } from '../src/domain/dnd/VerifiedDatabase.ts'
import { enableCreation, abilityKeys, spellRules } from '../src/utils/PlayerCreation.ts'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'

const root=resolve('rules-database.local/2014')
const releases=readdirSync(root).filter((x)=>x.startsWith('candidate-')).map((x)=>join(root,x)).filter((p)=>readdirSync(p).includes('RELEASE.json')).sort((a,b)=>statSync(a).mtimeMs-statSync(b).mtimeMs)
const directory=process.argv[2] ? resolve(process.argv[2]) : releases.at(-1)
assert.ok(directory,'Build a candidate database first.')
const fetcher=async (url)=>({ok:true,text:async()=>readFileSync(join(directory,url.replace('candidate/','')),'utf8')})
const data=await loadCandidateCreationData('candidate',fetcher)
assert.ok(data.reviewedEntities.some((e)=>e.index==='supernatural-gifts'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const id='dmg2014:rule:epic-boon-high-magic',grant={edition:'2014',dmApproved:true,classLevels:{wizard:20},existingGiftIds:[]}
    assert.equal(supernaturalGiftGrantPlan(data,id,grant).countsTowardAttunementLimit,false)
    assert.throws(()=>supernaturalGiftGrantPlan(data,id,{...grant,classLevels:{warlock:20}}),/Arcanum/)
    assert.throws(()=>supernaturalGiftGrantPlan(data,id,{...grant,classLevels:{wizard:19}}),/venti/)
    assert.throws(()=>supernaturalGiftGrantPlan(data,id,{...grant,existingGiftIds:[id]}),/volta/)
    assert.throws(()=>supernaturalGiftGrantPlan(data,id,{...grant,classLevels:{invented:20}}))
    assert.equal(supernaturalGiftGrantPlan(data,id,{...grant,classLevels:{wizard:16,cleric:4}}).minimumTotalLevel,20)
    assert.throws(()=>supernaturalGiftGrantPlan(data,id,{...grant,dmApproved:false}))
    const restore='dmg2014:rule:charm-restoration',cast={edition:'2014',dmApproved:true,grantedGiftIds:[restore],used:0,castChoiceIndex:0,inAntimagic:false}
    const greater=supernaturalGiftSpellPlan(data,restore,cast)
    assert.equal(greater.used,4);assert.equal(greater.componentsRequired,false);assert.equal(greater.spendsPersonalSpellSlot,false)
    assert.deepEqual(greater.castingTime,{quantity:1,unit:'action'})
    assert.equal(supernaturalGiftSpellPlan(data,restore,{...cast,used:4,castChoiceIndex:1}).vanishesAtZero,true)
    assert.throws(()=>supernaturalGiftSpellPlan(data,restore,{...cast,used:4}))
    assert.throws(()=>supernaturalGiftSpellPlan(data,restore,{...cast,inAntimagic:true}))
    assert.throws(()=>supernaturalGiftSpellPlan(data,restore,{...cast,grantedGiftIds:[]}))
    const castGift=(index,extra={})=>supernaturalGiftSpellPlan(data,'dmg2014:rule:epic-boon-'+index,{edition:'2014',dmApproved:true,grantedGiftIds:['dmg2014:rule:epic-boon-'+index],used:0,inAntimagic:false,...extra})
    assert.deepEqual(castGift('dimensional-travel').castingTime,{quantity:1,unit:'action'})
    assert.equal(castGift('spell-mastery',{selectedSpellId:'phb2014:spell:shield',canCastSelectedSpell:true}).componentsRequired,true)
    assert.equal(castGift('quick-casting',{selectedSpellId:'phb2014:spell:fireball',canCastSelectedSpell:true}).spendsPersonalSpellSlot,true)
    assert.equal(castGift('quick-casting',{selectedSpellId:'phb2014:spell:fireball',canCastSelectedSpell:true}).castingTime.unit,'bonus-action')
    assert.throws(()=>castGift('quick-casting',{selectedSpellId:'phb2014:spell:misty-step',canCastSelectedSpell:true}))
    assert.throws(()=>castGift('spell-mastery',{selectedSpellId:'phb2014:spell:fireball',canCastSelectedSpell:true}))
    assert.throws(()=>castGift('spell-recall',{selectedSpellId:'phb2014:spell:fireball',canCastSelectedSpell:false}))
}
assert.ok(data.verifiedMagicItems.some(e=>e.index==='deck-of-illusions'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const ctx={edition:'2014',drawWasRandom:true,cardAvailable:true,throwDistanceFt:30}
    const scene=deckIllusionPlan(data,'king-hearts',ctx)
    assert.deepEqual(scene.figures.map(f=>f.quantity),[1,4]);assert.equal(scene.harmless,true)
    assert.equal(scene.grantsCreatureStatistics,false)
    assert.equal(deckIllusionPlan(data,'ace-hearts',{...ctx,redDragonAge:'young'}).figures[0].appearance.size,'Large')
    assert.throws(()=>deckIllusionPlan(data,'ace-hearts',ctx))
    assert.throws(()=>deckIllusionPlan(data,'king-hearts',{...ctx,drawWasRandom:false}))
    assert.throws(()=>deckIllusionPlan(data,'joker-1',{...ctx,cardAvailable:false}))
    assert.throws(()=>deckIllusionPlan(data,'king-hearts',{...ctx,throwDistanceFt:31}))
    assert.throws(()=>deckIllusionPlan(data,'king-hearts',{...ctx,edition:'2024'}))
    assert.throws(()=>deckIllusionPlan(data,'invented',ctx))
    assert.equal(deckIllusionPlan(data,'joker-2',ctx).figures[0].appearance.copy,'deck-owner-appearance')
}
assert.ok(data.verifiedCreatures.some(e=>e.index==='balor'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const dm={edition:'2014',dmApproved:true,nativePlaneConfirmed:true}
    assert.equal(ironFlaskContentsPlan(data,1,dm).creature,null)
    assert.equal(ironFlaskContentsPlan(data,55,{...dm,selectedCreatureId:'mm2014:creature:barlgura'}).creature.mechanics.speedFt.walk,40)
    assert.equal(ironFlaskContentsPlan(data,70,{...dm,selectedCreatureId:'mm2014:creature:bone-devil'}).creature.mechanics.devilRank,'lesser')
    assert.throws(()=>ironFlaskContentsPlan(data,68,{...dm,selectedCreatureId:'mm2014:creature:bone-devil'}))
    assert.throws(()=>ironFlaskContentsPlan(data,61,{...dm,selectedCreatureId:'mm2014:creature:yochlol'}))
    assert.throws(()=>ironFlaskContentsPlan(data,51,{...dm,selectedCreatureId:'mm2014:creature:arcanaloth'}))
    assert.throws(()=>ironFlaskContentsPlan(data,55,{...dm,selectedCreatureId:'mm2014:creature:barlgura',nativePlaneConfirmed:false}))
    assert.throws(()=>ironFlaskContentsPlan(data,55,{...dm,edition:'2024'}))
    assert.throws(()=>ironFlaskContentsPlan(data,1.5,dm))
    const capture={edition:'2014',commandWordAvailable:true,flaskOccupied:false,targetVisible:true,distanceFt:60,currentPlane:'Material',targetNativePlane:'Abyss',previouslyCapturedByThisFlask:true}
    assert.equal(ironFlaskCapturePlan(data,capture).save.advantage,true)
    assert.throws(()=>ironFlaskCapturePlan(data,{...capture,currentPlane:'abyss'}))
    assert.throws(()=>ironFlaskCapturePlan(data,{...capture,flaskOccupied:true}))
    assert.throws(()=>ironFlaskCapturePlan(data,{...capture,distanceFt:NaN}))
    assert.equal(data.verifiedCreatures.find(e=>e.index==='horned-devil').mechanics.hitPoints.dice,'17d10+85')
    assert.deepEqual(data.reviewedEntities.find(e=>e.index==='horned-devil' && e.kind==='creature').mechanics.hitPoints.dice,'17d10+85')
}
assert.ok(data.verifiedMagicItems.some((e)=>e.index==='blackrazor'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const id='dmg2014:magic-item:blackrazor',ctx={edition:'2014',attuned:true,usageRequirementMet:true,property:'haste'}
    assert.throws(()=>magicItemUsePlan(data,id,ctx),/senziente/)
    assert.throws(()=>magicItemUsePlan(data,id,{...ctx,sentientPermission:'suppressed'}))
    const haste=magicItemUsePlan(data,id,{...ctx,sentientPermission:'allowed'})
    assert.equal(haste.concentrationRequired,false);assert.equal(haste.concentrationOwner,'item');assert.equal(haste.spellCaster,'item')
    assert.throws(()=>magicItemResource(data,id,0,'dawn','haste'),/Recupero/)
    const conflict={edition:'2014',dmApproved:true,controlAttemptUsed:false}
    assert.equal(sentientItemConflictPlan(data,id,conflict).controlSaveDC,16)
    assert.equal(sentientItemConflictPlan(data,id,{...conflict,controlAttemptUsed:true}).controlAttemptAllowed,false)
    assert.throws(()=>sentientItemConflictPlan(data,id,{...conflict,dmApproved:false}))
    assert.throws(()=>sentientItemConflictPlan(data,id,{...conflict,edition:'2024'}))
    assert.throws(()=>sentientItemConflictPlan(data,'dmg2014:magic-item:winged-boots',conflict))
    assert.equal(magicItemAttunementPlan(data,'dmg2014:magic-item:moonblade',[],'moon').prerequisites.requiresAlignment,'neutral-good')
    assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:eye-of-vecna',{...ctx,property:'main'}))
    const dm={edition:'2014',dmApproved:true}
    assert.equal(magicItemPropertyTableEntry(data,'magic-item-minor-properties',20,dm).entry.effect.rollAdditionalTimes,2)
    assert.equal(magicItemPropertyTableEntry(data,'magic-item-quirks',10,dm).entry.effect.whileAttunedCannotAttuneOtherItems,true)
    assert.equal(magicItemPropertyTableEntry(data,'artifact-major-detrimental',81,dm).entry.effect.creatureId,'mm2014:creature:wight')
    assert.equal(magicItemPropertyTableEntry(data,'artifact-major-detrimental',81,dm).wholeRuleComplete,false)
    assert.throws(()=>magicItemPropertyTableEntry(data,'artifact-major-detrimental',51,dm))
    assert.throws(()=>magicItemPropertyTableEntry(data,'magic-item-quirks',13,dm))
    assert.throws(()=>magicItemPropertyTableEntry(data,'magic-item-quirks',1,{...dm,dmApproved:false}))
    assert.throws(()=>magicItemPropertyTableEntry(data,'artifact-major-beneficial',1.5,dm))
    const legend={edition:'2014',mode:'legendary',used:1,incapacitated:false,canTakeActions:true,surprised:false,hasHadFirstTurn:true,assumedForm:false,atEndOfAnotherCreatureTurn:true,inLair:false}
    assert.equal(legendaryCreatureActionPlan(data,'mm2014:creature:empyrean',2,legend).used,3)
    assert.throws(()=>legendaryCreatureActionPlan(data,'mm2014:creature:empyrean',2,{...legend,used:2}))
}
assert.ok(data.verifiedCreatures.some((e)=>e.index==='mummy-lord'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const id='mm2014:creature:mummy-lord',ctx={edition:'2014',mode:'legendary',used:0,incapacitated:false,canTakeActions:true,surprised:false,hasHadFirstTurn:true,assumedForm:false,atEndOfAnotherCreatureTurn:true,inLair:false}
    assert.equal(legendaryCreatureActionPlan(data,id,2,ctx).used,2)
    assert.throws(()=>legendaryCreatureActionPlan(data,id,2,{...ctx,used:2}))
    assert.throws(()=>legendaryCreatureActionPlan(data,id,0,{...ctx,assumedForm:true}))
    assert.throws(()=>legendaryCreatureActionPlan(data,id,0,{...ctx,surprised:true,hasHadFirstTurn:false}))
    assert.throws(()=>legendaryCreatureActionPlan(data,id,0,{...ctx,canTakeActions:false}))
    const lair={...ctx,mode:'lair',inLair:true,initiativeCount:20}
    assert.equal(legendaryCreatureActionPlan(data,id,0,lair).used,1)
    assert.throws(()=>legendaryCreatureActionPlan(data,id,0,{...lair,previousLairActionIndex:0}))
    assert.throws(()=>legendaryCreatureActionPlan(data,id,0,{...lair,initiativeCount:19}))
    assert.throws(()=>legendaryCreatureActionPlan(data,id,0,{...lair,inLair:false}))
    assert.equal(legendaryCreatureActionPlan(data,id,1,{...lair,previousLairActionIndex:0}).used,1)
}
assert.ok(data.verifiedMagicItems.some((e)=>e.id==='dmg2014:magic-item:winged-boots'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const boots='dmg2014:magic-item:winged-boots',cloak='dmg2014:magic-item:cloak-of-invisibility'
    assert.equal(spendMagicItemDuration(data,boots,0,1).spentSeconds,60)
    assert.equal(spendMagicItemDuration(data,boots,0,61).spentSeconds,61)
    assert.equal(spendMagicItemDuration(data,cloak,0,61).spentSeconds,120)
    assert.equal(magicItemResource(data,boots,14400,'unused-twelve-hours').used,7200)
    assert.throws(()=>spendMagicItemDuration(data,boots,14400,1))
    const staff='dmg2014:magic-item:staff-of-thunder-and-lightning'
    assert.equal(magicItemResource(data,staff,1,'dawn','lightningStrike').used,0)
    assert.equal(magicItemResource(data,staff,1,undefined,'thunderAndLightning').used,1)
    const ctx={edition:'2014',attuned:true,usageRequirementMet:true,property:'castChoice'}
    assert.equal(magicItemUsePlan(data,'dmg2014:magic-item:wand-of-fireballs',{...ctx,castChoiceIndex:6}).castSpellLevel,9)
    assert.equal(magicItemUsePlan(data,'dmg2014:magic-item:wand-of-fireballs',{...ctx,castChoiceIndex:6}).castSaveDC,15)
    assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:wand-of-fireballs',{...ctx,castChoiceIndex:7}))
    assert.equal(magicItemUsePlan(data,'dmg2014:magic-item:staff-of-the-woodlands',{...ctx,castChoiceIndex:1}).castingTime.unit,'action')
    assert.throws(()=>magicItemResource(data,'dmg2014:magic-item:wand-of-magic-missiles',0))
}
assert.ok(data.verifiedMagicItems.some((e)=>e.id==='dmg2014:magic-item:rod-of-resurrection'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const ctx={edition:'2014',attuned:true,usageRequirementMet:true}
    assert.equal(magicItemResource(data,'dmg2014:magic-item:rod-of-resurrection',5,'dawn').used,4)
    assert.equal(magicItemResource(data,'dmg2014:magic-item:rod-of-resurrection',5,'long-rest').used,5)
    assert.deepEqual(magicItemUsePlan(data,'dmg2014:magic-item:rod-of-resurrection',{...ctx,property:'castChoice',castChoiceIndex:1}).castingTime,{quantity:1,unit:'action'})
    assert.equal(magicItemResource(data,'dmg2014:magic-item:rod-of-lordly-might',1,'dawn','drainLife').used,0)
    const state={lifetimeAbsorbed:49,storedLevels:3},op={kind:'absorb',spellLevel:2,targetsOnlyUser:true,areaOfEffect:false}
    assert.equal(absorptionRodOperation(data,state,op,ctx).absorbed,false)
    assert.deepEqual(state,{lifetimeAbsorbed:49,storedLevels:3})
    assert.equal(absorptionRodOperation(data,state,{...op,spellLevel:1},ctx).state.lifetimeAbsorbed,50)
    assert.equal(absorptionRodOperation(data,state,{...op,spellLevel:1,areaOfEffect:true},ctx).absorbed,false)
    const casting={kind:'cast',slotLevel:3,ownSlotLevels:[1,2,3],spellId:'phb2014:spell:fireball',knownOrPrepared:true}
    const result=absorptionRodOperation(data,{lifetimeAbsorbed:50,storedLevels:3},casting,ctx)
    assert.equal(result.nonmagical,true);assert.equal(result.requiresOrdinaryCastingValidation,true)
    assert.throws(()=>absorptionRodOperation(data,state,{...casting,ownSlotLevels:[1,2]},ctx))
    assert.throws(()=>absorptionRodOperation(data,state,casting,{...ctx,attuned:false}))
    assert.equal(magicItemAttunementPlan(data,'dmg2014:magic-item:robe-of-the-archmagi',[],'robe','white').prerequisites.alignment,'good')
    const scrollCtx={edition:'2014',classLevels:{wizard:1},classIndex:'wizard',mode:'cast'}
    const scroll=spellScrollPlan(data,'phb2014:spell:fireball',scrollCtx)
    assert.equal(scroll.check.dc,13);assert.equal(scroll.parameters.spellSaveDC,15)
    assert.equal(scroll.interruptedCastingPreservesScroll,true)
    assert.throws(()=>spellScrollPlan(data,'phb2014:spell:fireball',{...scrollCtx,mode:'copy'}))
    assert.equal(spellScrollPlan(data,'phb2014:spell:fireball',{...scrollCtx,classLevels:{wizard:5},mode:'copy'}).destruction,'either-check-result')
    assert.throws(()=>spellScrollPlan(data,'phb2014:spell:fireball',{...scrollCtx,classLevels:{fighter:3},classIndex:'fighter'}))
    assert.equal(spellScrollPlan(data,'phb2014:spell:fireball',{...scrollCtx,classLevels:{fighter:3},classIndex:'fighter',subclassIds:['phb2014:subclass:eldritch-knight']}).check.dc,13)
    assert.equal(spellScrollPlan(data,'phb2014:spell:foresight',{...scrollCtx,classLevels:{warlock:17},classIndex:'warlock'}).check,null)
}
assert.ok(data.reviewedEntities.some((e)=>e.id==='dmg2014:rule:poison-delivery'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const ctx={edition:'2014',dmApproved:true,mode:'burst',loadedAmmunition:30,distanceFt:80,shotsAlreadyInActivation:0}
    const burst=firearmUsePlan(data,'automatic-rifle',ctx)
    assert.equal(burst.ammunitionSpent,10);assert.equal(burst.loadedAfter,20);assert.equal(burst.burstEffect.successDamage,'none')
    assert.throws(()=>firearmUsePlan(data,'automatic-rifle',{...ctx,distanceFt:81}))
    assert.throws(()=>firearmUsePlan(data,'automatic-rifle',{...ctx,dmApproved:false}))
    assert.throws(()=>firearmUsePlan(data,'automatic-rifle',{...ctx,edition:'2024'}))
    assert.throws(()=>firearmUsePlan(data,'automatic-rifle',{...ctx,loadedAmmunition:9}))
    assert.throws(()=>firearmUsePlan(data,'pistol',{...ctx,mode:'single',distanceFt:30,shotsAlreadyInActivation:1}))
    assert.equal(firearmUsePlan(data,'laser-rifle',{...ctx,mode:'reload',loadedAmmunition:0}).ammunitionRequired,1)
    assert.equal(firearmUsePlan(data,'pistol',{...ctx,mode:'single',distanceFt:31}).rangeDisadvantage,true)
    assert.throws(()=>firearmUsePlan(data,'pistol',{...ctx,mode:'reload'}))
    assert.throws(()=>firearmUsePlan(data,'laser-rifle',{...ctx,loadedAmmunition:51}))
    const exposure={edition:'2014',delivery:'inhaled',doseFraction:1,exposedSkin:false,inReleasedCube:true,woundDamageType:'other',holdingBreath:true}
    assert.equal(poisonExposurePlan(data,'dmg2014:rule:poison-malice',exposure).exposed,true)
    assert.equal(poisonExposurePlan(data,'dmg2014:rule:poison-malice',{...exposure,inReleasedCube:false}).exposed,false)
    assert.throws(()=>poisonExposurePlan(data,'dmg2014:rule:poison-malice',{...exposure,doseFraction:NaN}))
    const partial=poisonExposurePlan(data,'dmg2014:rule:poison-assassins-blood',{...exposure,delivery:'ingested',doseFraction:0.5})
    assert.equal(partial.partialDoseRequiresDM,true);assert.equal(partial.exposed,false)
    assert.equal(poisonExposurePlan(data,'dmg2014:rule:poison-drow-poison',{...exposure,delivery:'injury'}).exposed,false)
    assert.equal(madnessTableEntry(data,'short',100,ctx).entry.effect.condition,'unconscious')
    assert.equal(madnessTableEntry(data,'long',96,ctx).entry.effect.damageOrJostlingCannotWake,true)
    assert.throws(()=>madnessTableEntry(data,'long',31,ctx))
    assert.throws(()=>madnessTableEntry(data,'short',1,{...ctx,dmApproved:false}))
    assert.throws(()=>madnessTableEntry(data,'short',0,ctx))
    assert.equal(optionalRulePlan(data,'dmg2014:rule:slow-natural-healing',ctx).mechanics.longRestAutomaticHPRecovery,false)
}
assert.ok(data.verifiedMagicItems.some((e)=>e.id==='dmg2014:magic-item:instrument-of-the-bards'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const ctx={edition:'2014',attuned:true,usageRequirementMet:true,property:'castChoice',variantIndex:'anstruth-harp',castChoiceIndex:5}
    const cure=magicItemUsePlan(data,'dmg2014:magic-item:instrument-of-the-bards',ctx)
    assert.equal(cure.spell.index,'cure-wounds');assert.equal(cure.castSpellLevel,5)
    assert.equal(cure.spendsPersonalSpellSlots,false)
    assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:instrument-of-the-bards',{...ctx,castChoiceIndex:7}))
    assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:instrument-of-the-bards',{...ctx,variantIndex:'invented'}))
    const dose={edition:'2014',attuned:false,usageRequirementMet:true}
    const growth=magicItemUsePlan(data,'dmg2014:magic-item:potion-of-growth',dose)
    assert.equal(growth.spellUse,'gain-effect');assert.equal(growth.concentrationRequired,false)
    assert.equal(magicItemUsePlan(data,'dmg2014:magic-item:potion-of-flying',dose).spell,null)
    assert.equal(magicItemUsePlan(data,'dmg2014:magic-item:potion-of-flying',dose).effect.flySpeed,'equal-walking-speed')
    assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:iron-flask',dose))
    assert.equal(reviewedCreature(data,'mm2014:creature:roc').mechanics.hitPoints.average,248)
    assert.ok(wildShapeIssues(data,'mm2014:creature:roc',{edition:'2014',classLevels:{druid:20},previouslySeen:true,subclassId:'phb2014:subclass:moon'}).length)
}
assert.ok(data.verifiedMagicItems.some((e)=>e.id==='dmg2014:magic-item:ring-of-spell-storing'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const ctx={edition:'2014',attuned:true,usageRequirementMet:true}
    const id='dmg2014:magic-item:ring-of-spell-storing',entry={spellId:'phb2014:spell:witch-bolt',slotLevel:3,saveDC:17,attackBonus:9,castingAbility:'charisma'}
    const original=[entry],full=storedSpellOperation(data,id,original,{kind:'store',spell:entry},ctx)
    assert.equal(full.storedSuccessfully,false);assert.equal(full.incomingSpellExpended,true);assert.deepEqual(original,[entry])
    const cast=storedSpellOperation(data,id,original,{kind:'cast',index:0},ctx)
    assert.equal(cast.stored.length,0);assert.equal(original.length,1);assert.equal(cast.casting.attackBonus,9)
    assert.equal(cast.casting.castingAbility,'charisma');assert.equal(cast.casting.slotLevel,3);assert.equal(cast.casting.concentrationRequired,true)
    assert.equal(cast.casting.spendsPersonalSpellSlots,false)
    assert.throws(()=>storedSpellOperation(data,id,[{...entry,slotLevel:NaN}],{kind:'cast',index:0},ctx))
    assert.throws(()=>storedSpellOperation(data,id,[],{kind:'cast',index:0},ctx))
    assert.throws(()=>storedSpellOperation(data,id,original,{kind:'cast',index:0},{...ctx,attuned:false}))
    assert.equal(storedSpellOperation(data,'dmg2014:magic-item:ioun-stone',[],{kind:'store',spell:entry},ctx).maximum,3)
    assert.throws(()=>storedSpellOperation(data,'dmg2014:magic-item:ioun-stone',[],{kind:'store',spell:{...entry,slotLevel:4}},ctx))
    const ring='dmg2014:magic-item:ring-of-elemental-command',choice={...ctx,property:'castChoice',variantIndex:'air',castChoiceIndex:1}
    assert.throws(()=>magicItemUsePlan(data,ring,choice))
    assert.equal(magicItemUsePlan(data,ring,{...choice,additionalPropertiesUnlocked:true}).spell.index,'chain-lightning')
    assert.equal(magicItemUsePlan(data,ring,{...choice,castChoiceIndex:0}).spell.index,'dominate-monster')
    assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:ring-of-shooting-stars',{...ctx,property:'castChoice',castChoiceIndex:0}))
    assert.equal(magicItemUsePlan(data,'dmg2014:magic-item:ring-of-shooting-stars',{...ctx,property:'castChoice',castChoiceIndex:0,inDimLightOrDarkness:true}).spell.index,'dancing-lights')
}
assert.ok(data.reviewedEntities.some((e)=>e.id==='phb2014:rule:trinkets'), 'Required scope missing from candidate; tests must not silently skip.')
{
    assert.equal(trinketTableEntry(data,11).weightLb,1/16)
    assert.equal(trinketTableEntry(data,18).weightLb,1)
    assert.equal(trinketTableEntry(data,37).weightLb,0)
    assert.equal(trinketTableEntry(data,100).weightLb,null)
    for(const roll of [0,101,NaN,1.5])assert.throws(()=>trinketTableEntry(data,roll),/d100/)
    const trinket=trinketTableEntry(data,1);trinket.summaryIt='changed'
    assert.notEqual(trinketTableEntry(data,1).summaryIt,'changed')
}
assert.equal(data.edition,'2014')
assert.ok(data.verifiedCreationOptions.length, 'Required scope missing from candidate; tests must not silently skip.')
{
    assert.equal(data.verifiedCreationOptions.filter((e)=>e.kind==='feat').length,42)
    assert.ok(data.spells.some((e)=>e.index==='hex' && e.classes.some((c)=>c.index==='warlock')))
    assert.ok(data.backgrounds.some((e)=>e.index==='charlatan'))
    assert.ok(data.subraces.some((e)=>e.index==='wood-elf' && e.race.index==='elf'))
    const context={edition:'2014',featsEnabled:true,abilities:Object.fromEntries(abilityKeys.map((a)=>[a,12])),armorProficiencies:[],canCastSpell:false,selected:[]}
    assert.deepEqual(featSelectionIssues(data,'phb2014:feat:alert',context),[])
    assert.ok(featSelectionIssues(data,'phb2014:feat:alert',{...context,featsEnabled:false}).length)
    assert.ok(featSelectionIssues(data,'phb2014:feat:grappler',context).length)
    assert.deepEqual(featSelectionIssues(data,'phb2014:feat:grappler',{...context,abilities:{...context.abilities,strength:13}}),[])
    assert.ok(featSelectionIssues(data,'phb2014:feat:alert',{...context,selected:[{id:'phb2014:feat:alert'}]}).length)
    const elemental={...context,canCastSpell:true,damageType:'fire',selected:[{id:'phb2014:feat:elemental-adept',damageType:'cold'}]}
    assert.deepEqual(featSelectionIssues(data,'phb2014:feat:elemental-adept',elemental),[])
    assert.ok(featSelectionIssues(data,'phb2014:feat:elemental-adept',{...elemental,damageType:'cold'}).length)
}
assert.ok(data.verifiedMagicItems.length, 'Required scope missing from candidate; tests must not silently skip.')
{
    const health='dmg2014:magic-item:amulet-of-health',speed='dmg2014:magic-item:boots-of-speed',shield='dmg2014:magic-item:animated-shield'
    assert.equal(magicItemAttunementPlan(data,health,[],'amulet-one').separateFromIdentification,true)
    assert.throws(()=>magicItemAttunementPlan(data,health,[{instanceId:'existing',referenceId:health}],'amulet-two'),/duplicata/)
    assert.throws(()=>magicItemAttunementPlan(data,health,[1,2,3].map((n)=>({instanceId:String(n),referenceId:'legacy-'+n})),'amulet-two'),/tre oggetti/)
    const context={edition:'2014',attuned:true,usageRequirementMet:true}
    assert.throws(()=>magicItemUsePlan(data,health,{...context,attuned:false}),/Sintonia/)
    assert.throws(()=>magicItemUsePlan(data,shield,context),/comando/)
    assert.ok(magicItemUsePlan(data,shield,{...context,commandWordAvailable:true}))
    assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:ammunition',context),/variante/)
    assert.equal(magicItemUsePlan(data,'dmg2014:magic-item:ammunition',{...context,variantIndex:'ammunition-2'}).selectedVariant.damageBonus,2)
    const levitate=magicItemUsePlan(data,'dmg2014:magic-item:boots-of-levitation',context)
    assert.equal(levitate.componentsRequired,false);assert.equal(levitate.spendsPersonalSpellSlots,false);assert.equal(levitate.concentrationRequired,true)
    assert.deepEqual([magicItemResource(data,speed,300,'dawn').used,magicItemResource(data,speed,300,'long-rest').used],[300,0])
    assert.equal(magicItemResource(data,speed,300).maximum,600)
    assert.equal(magicItemResource(data,'dmg2014:magic-item:bag-of-tricks',3,'dawn').used,0)
    assert.throws(()=>magicItemResource(data,speed,601),/Risorsa/)
    assert.throws(()=>magicItemUsePlan(data,health,{...context,edition:'2024'}),/Edizione/)
    if(data.verifiedMagicItems.some((e)=>e.index==='cube-of-force')) {
        const resource=(name,used,event,roll)=>magicItemResource(data,'dmg2014:magic-item:'+name,used,event,'main',roll)
        assert.throws(()=>resource('cube-of-force',30,'dawn'),/tiro/)
        assert.equal(resource('cube-of-force',30,'dawn',7).used,23)
        assert.equal(resource('cube-of-force',2,'dawn',20).used,0)
        assert.throws(()=>resource('cube-of-force',30,'dawn',21),/Tiro/)
        assert.equal(resource('chime-of-opening',10,'dawn').used,10)
        assert.equal(resource('candle-of-invocation',240*60,'long-rest').used,240*60)
        assert.equal(resource('cloak-of-invisibility',120*60,'unused-twelve-hours').used,60*60)
        assert.equal(resource('cloak-of-invisibility',120*60,'long-rest').used,120*60)
        assert.throws(()=>resource('cloak-of-invisibility',1),/incrementi/)
        const ball=magicItemUsePlan(data,'dmg2014:magic-item:crystal-ball',{...context,variantIndex:'crystal-ball-of-mind-reading',property:'whileScryingAction'})
        assert.equal(ball.concentrationRequired,false)
        assert.equal(ball.spell.index,'detect-thoughts')
        assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:crystal-ball',{...context,variantIndex:'crystal-ball',property:'whileScryingAction'}),/Proprietà/)
    }
    if(data.verifiedMagicItems.some((e)=>e.index==='hammer-of-thunderbolts')) {
        const hammer='dmg2014:magic-item:hammer-of-thunderbolts'
        assert.ok(magicItemUsePlan(data,hammer,{...context,attuned:false}))
        assert.throws(()=>magicItemUsePlan(data,hammer,{...context,attuned:false,property:'conditionalAttunement'}),/Sintonia/)
        assert.equal(magicItemAttunementPlan(data,hammer,[],'hammer').conditionalProperty,'Giants-Bane')
        assert.equal(magicItemResource(data,hammer,5,'dawn','conditionalAttunement',1).used,3)
        const helm=magicItemUsePlan(data,'dmg2014:magic-item:helm-of-brilliance',{...context,property:'castChoice',castChoiceIndex:3})
        assert.equal(helm.spell.index,'wall-of-fire');assert.equal(helm.componentsRequired,true);assert.equal(helm.concentrationRequired,true)
        assert.throws(()=>magicItemUsePlan(data,'dmg2014:magic-item:helm-of-brilliance',{...context,property:'castChoice',castChoiceIndex:4}),/Scelta/)
    }
}
assert.ok(data.reviewedEntities.some((e)=>e.id==='phb2014:rule:creature-space'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const ctx={edition:'2014',hasAttackAction:true,attackerSize:'Medium',targetSize:'Large',distanceFt:5,reachFt:5,freeHands:1,targetIncapacitated:true}
    assert.equal(combatContestPlan(data,'grapple',ctx).automaticSuccess,true)
    assert.equal(combatContestPlan(data,'shove',{...ctx,freeHands:0}).automaticSuccess,true)
    assert.equal(combatContestPlan(data,'grapple',{...ctx,targetIncapacitated:false}).automaticSuccess,false)
    assert.throws(()=>combatContestPlan(data,'grapple',{...ctx,freeHands:0}),/mano/)
    assert.throws(()=>combatContestPlan(data,'shove',{...ctx,targetSize:'Huge'}),/troppo/)
    assert.throws(()=>combatContestPlan(data,'grapple',{...ctx,distanceFt:6}),/portata/)
    assert.throws(()=>combatContestPlan(data,'grapple',{...ctx,edition:'2024'}),/Contesto/)
    const ready={edition:'2014',perceivableTrigger:true,response:'move'}
    assert.equal(readiedActionPlan(data,ready).reactionTiming,'after-trigger-finishes')
    assert.throws(()=>readiedActionPlan(data,{...ready,perceivableTrigger:false}),/evento/)
    const cast={edition:'2014',classLevels:{wizard:3},classIndex:'wizard',knownSpellIds:['phb2014:spell:fire-bolt'],preparedSpellIds:[],mode:'cantrip',components:{canSpeak:true,freeSomaticHand:true,materialHand:false,materialSource:'none',specificMaterialsConfirmed:false},armorProficient:true}
    assert.equal(readiedActionPlan(data,{...ready,response:'spell',spellId:'phb2014:spell:fire-bolt',casting:cast}).holdRequiresConcentration,true)
    assert.throws(()=>readiedActionPlan(data,{...ready,response:'spell',spellId:'phb2014:spell:misty-step',casting:{...cast,mode:'spellcasting-slot',slotLevel:2,remainingSpellSlots:[4,2,0,0,0,0,0,0,0],preparedSpellIds:['phb2014:spell:misty-step']}}),/un’azione/)
}
assert.ok(data.reviewedEntities.find((e)=>e.id==='phb2014:spell:witch-bolt')?.verification.complete, 'Required scope missing from candidate; tests must not silently skip.')
{
    const pool=multiclassSpellPools(data,{ranger:4,wizard:3,warlock:5})
    assert.deepEqual(pool.spellcastingSlots,[4,3,2,0,0,0,0,0,0])
    assert.deepEqual(pool.ownClassMaximumSpellLevel,{ranger:1,wizard:2})
    assert.equal(pool.pactSlots.level,3);assert.equal(pool.pactSlots.count,2)
    assert.deepEqual(multiclassSpellPools(data,{paladin:3,fighter:2}).spellcastingSlots,[3,0,0,0,0,0,0,0,0])
    assert.deepEqual(multiclassSpellPools(data,{fighter:4},['phb2014:subclass:eldritch-knight']).spellcastingSlots,[3,0,0,0,0,0,0,0,0])
    const context={edition:'2014',classLevels:{ranger:4,wizard:3,warlock:5},classIndex:'wizard',knownSpellIds:[],preparedSpellIds:['phb2014:spell:witch-bolt','phb2014:spell:fireball','phb2014:spell:identify'],spellbookIds:['phb2014:spell:detect-magic'],
        mode:'spellcasting-slot',slotLevel:3,remainingSpellSlots:[...pool.spellcastingSlots],remainingPactSlots:2,armorProficient:true,
        components:{canSpeak:true,freeSomaticHand:true,materialHand:true,materialSource:'pouch',specificMaterialsConfirmed:false}}
    const cast=spellCastPlan(data,'phb2014:spell:witch-bolt',context)
    assert.equal(cast.castLevel,3);assert.equal(cast.resultingSlots.spellcasting[2],1)
    assert.equal(context.remainingSpellSlots[2],2)
    assert.throws(()=>spellCastPlan(data,'phb2014:spell:fireball',context),/singola classe/)
    assert.throws(()=>spellCastPlan(data,'phb2014:spell:identify',context),/componenti specifici/)
    assert.throws(()=>spellCastPlan(data,'phb2014:spell:witch-bolt',{...context,armorProficient:false}),/armatura/)
    const pact=spellCastPlan(data,'phb2014:spell:witch-bolt',{...context,mode:'pact-slot'})
    assert.equal(pact.resultingSlots.pact,1);assert.equal(pact.resultingSlots.spellcasting[2],2)
    const ritual=spellCastPlan(data,'phb2014:spell:detect-magic',{...context,mode:'ritual',slotLevel:undefined})
    assert.equal(ritual.ritualAdditionalMinutes,10);assert.equal(ritual.concentrationDuringCasting,true)
    assert.deepEqual(ritual.resultingSlots.spellcasting,pool.spellcastingSlots)
    assert.throws(()=>spellCastPlan(data,'phb2014:spell:witch-bolt',{...context,spellsThisTurn:[{level:1,unit:'bonus-action'}]}),/stesso turno/)
    assert.throws(()=>spellCastPlan(data,'phb2014:spell:witch-bolt',{...context,remainingPactSlots:0,mode:'pact-slot'}),/Patto/)
    assert.throws(()=>spellCastPlan(data,'phb2014:spell:witch-bolt',{...context,components:{...context.components,canSpeak:false}}),/verbali/)
    assert.throws(()=>spellCastPlan(data,'phb2014:spell:magic-missile',{...context,preparedSpellIds:['phb2014:spell:magic-missile']}),/verificat/)
}
assert.ok(data.reviewedEntities.find((e)=>e.id==='phb2014:feat:lucky')?.mechanics.advantageInteraction, 'Required scope missing from candidate; tests must not silently skip.')
{
    const luck=luckyOwnRollChoice(data,[1,15,20],2,'disadvantage',3)
    assert.equal(luck.selectedD20,20);assert.equal(luck.remainingLuckPoints,2);assert.equal(luck.hasDisadvantage,true)
    assert.throws(()=>luckyOwnRollChoice(data,[1,15],1,'disadvantage',3))
    assert.throws(()=>luckyOwnRollChoice(data,[1,15],1,'normal',0))
    assert.throws(()=>luckyOwnRollChoice(data,[1,NaN],1,'normal',3))
}
assert.ok(data.reviewedEntities.find((e)=>e.id==='phb2014:rule:short-rest')?.mechanics.minimumHealingPerDie===0, 'Required scope missing from candidate; tests must not silently skip.')
{
    assert.equal(shortRestHitDieHealing(data,6,1,1).healing,0)
    assert.equal(shortRestHitDieHealing(data,12,12,20).healing,17)
    assert.throws(()=>shortRestHitDieHealing(data,6,7,10))
    assert.throws(()=>shortRestHitDieHealing(data,6,NaN,10))
}
const hasFighter=data.reviewedEntities.some((x)=>x.id==='phb2014:subclass-feature:eldritch-knight-3-spellcasting')
assert.ok(data.reviewedEntities.some((e)=>e.id==='phb2014:subclass-feature:wizard-transmutation-14-master-transmuter'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const low=selectedSubclassFeaturePlan(data,{wizard:2,fighter:1},'phb2014:subclass:wizard-transmutation')
    assert.equal(low.features.length,2)
    assert.equal(low.laterFeaturesCertified,false)
    assert.ok(low.features.every((e)=>e.relations.subclassId===low.subclassId))
    assert.throws(()=>selectedSubclassFeaturePlan(data,{wizard:14},low.subclassId),/verificare/)
    assert.throws(()=>selectedSubclassFeaturePlan(data,{fighter:20},low.subclassId),/livello/)
    assert.ok(selectedSubclassFeaturePlan(data,{wizard:14},'phb2014:subclass:evocation').features.every((e)=>e.relations.subclassId==='phb2014:subclass:evocation'))
    assert.throws(()=>selectedSubclassFeaturePlan(data,{cleric:1},'dmg2014:subclass:death'),/consenso/)
    assert.throws(()=>selectedSubclassFeaturePlan(data,{paladin:3},'dmg2014:subclass:oathbreaker',{dmApproved:true,alignment:'neutral-good'}),/malvagio/)
    assert.equal(selectedSubclassFeaturePlan(data,{paladin:7},'dmg2014:subclass:oathbreaker',{dmApproved:true,alignment:'lawful-evil'}).features.length,4)
    assert.throws(()=>clericDomainSpellGrants(data,'dmg2014:subclass:death',{cleric:9}),/consenso/)
    assert.equal(clericDomainSpellGrants(data,'dmg2014:subclass:death',{cleric:9},{dmApproved:true}).length,10)
    assert.equal(paladinOathSpellGrants(data,{paladin:17},'dmg2014:subclass:oathbreaker',{dmApproved:true,alignment:'neutral-evil'}).length,10)
}
const hasTotems=data.reviewedEntities.some((x)=>x.id==='phb2014:class-option:totem-3-bear')
const hasHunter=data.verifiedOptions.some((x)=>x.mechanics.optionType==='hunter-choice')
const hasMonk=data.verifiedOptions.some((x)=>x.mechanics.optionType==='monk-discipline')
const hasWizardChoices=data.verifiedOptions.some((x)=>x.mechanics.optionType==='wizard-choice')
const hasMetamagic=data.verifiedOptions.some((x)=>x.mechanics.optionType==='metamagic')
assert.ok(data.verifiedEquipment.some((e)=>e.id==='phb2014:gear:mount-camel'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const arrows=equipmentPurchase(data,'phb2014:gear:arrows-20',2)
    assert.equal(arrows.pieces,40);assert.equal(arrows.costCP,200);assert.equal(arrows.weightLb,2)
    assert.equal(equipmentPurchase(data,'phb2014:gear:antitoxin-vial',1).weightLb,null)
    assert.equal(equipmentPurchase(data,'phb2014:gear:service-coach-between-towns',10).costCP,30)
    assert.equal(equipmentPurchase(data,'phb2014:gear:vehicle-rowboat',1).weightLb,100)
    const pack=equipmentPackContents(data,'phb2014:equipment-pack:burglars-pack')
    assert.equal(pack.cost.quantity,16);assert.equal(pack.totalWeightLb,null);assert.ok(pack.missingWeightNames.includes('String'))
    assert.equal(pack.items.find((e)=>e.entityId==='phb2014:gear:ball-bearings-bag-of-1-000').pieces,1000)
    assert.throws(()=>equipmentPurchase(data,'phb2014:gear:arrows-20',NaN))
    assert.throws(()=>equipmentPurchase(data,'phb2014:gear:arrows-20',0))
    assert.throws(()=>equipmentPurchase(data,'phb2014:gear:arrows-20',Number.MAX_SAFE_INTEGER))
    assert.throws(()=>equipmentPackContents(data,'phb2014:gear:arrows-20'))
}
assert.equal(data.verifiedOptions.length,hasMetamagic?124:hasWizardChoices?106:hasMonk?94:hasHunter?77:hasTotems?66:hasFighter?57:35)
assert.equal(data.verifiedOptions.filter((x)=>x.mechanics.optionType==='eldritch-invocation').length,32)
assert.equal(data.verifiedOptions.filter((x)=>x.mechanics.optionType==='pact-boon').length,3)
assert.equal(data.legacyVerification,'preserved-not-fully-reverified')

const expected=[0,2,2,2,3,3,4,4,5,5,5,6,6,6,7,7,7,8,8,8]
for(let level=1;level<=20;level++) {
    const progression=warlockProgression(data,{warlock:level})
    assert.equal(progression.invocationsKnown,expected[level-1])
    const sheet=enableCreation({...newCharacterSheet(),level:String(level),...Object.fromEntries(abilityKeys.map((key)=>[key,'10'])),playerDetails:{'creation.class':'warlock','creation.race':'human'}},data)
    assert.equal(spellRules(sheet,data).maxLevel,progression.pactSlotLevel,'Compatible with the current creation engine')
    assert.equal(Number(sheet.playerDetails[`slots.${progression.pactSlotLevel}.total`]),progression.pactSlots.maximum)
}
const mixed=warlockProgression(data,{warlock:2,wizard:18})
assert.equal(mixed.proficiencyBonus,6,'Total character level affects proficiency')
assert.equal(mixed.pactSlotLevel,1,'Pact slots use warlock class levels')
assert.equal(mixed.invocationsKnown,2)
assert.throws(()=>warlockProgression(data,{warlock:4,wizard:18}),/Livelli/)
const context={edition:'2014',classLevels:{warlock:2,wizard:18},knownCantripIds:[]}
const option=(name)=>data.verifiedOptions.find((x)=>x.id===`phb2014:class-option:${name}`)
assert.ok(optionIssues(option('witch-sight'),context).some((x)=>x.includes('15')),'Character level 20 does not satisfy warlock level 15')
assert.ok(optionIssues(option('agonizing-blast'),context).length)
assert.deepEqual(optionIssues(option('agonizing-blast'),{...context,knownCantripIds:['phb2014:spell:eldritch-blast']}),[])
assert.ok(optionIssues(option('armor-of-shadows'),{...context,edition:'2024'}).length)
assert.ok(optionIssues(option('book-of-ancient-secrets'),{...context,classLevels:{warlock:3}}).length)
assert.deepEqual(optionIssues(option('book-of-ancient-secrets'),{...context,classLevels:{warlock:3},pactOptionId:'phb2014:class-option:pact-of-the-tome'}),[])
assert.ok(optionIssues(option('book-of-ancient-secrets'),{...context,pactOptionId:'phb2014:class-option:pact-of-the-tome'}).some((x)=>x.includes('incoerente')))
assert.ok(invocationSelectionIssues(data,['phb2014:class-option:armor-of-shadows','phb2014:class-option:armor-of-shadows'],context).some((x)=>x.includes('duplicate')))
assert.ok(invocationSelectionIssues(data,['a','b','c'],context).some((x)=>x.includes('limite')))
assert.deepEqual(invocationSelectionIssues(data,['phb2014:class-option:armor-of-shadows','phb2014:class-option:beast-speech'],context),[])
const pact={...warlockProgression(data,{warlock:6}).pactSlots,used:2}
assert.equal(recoverResource(pact,'short-rest').used,0)
assert.equal(pact.used,2,'Resource updates do not mutate the input')
const arcanum={maximum:1,used:1,recovery:['long-rest']}
assert.equal(recoverResource(arcanum,'short-rest').used,1)
assert.equal(recoverResource(arcanum,'long-rest').used,0)
assert.throws(()=>recoverResource({...arcanum,used:2},'long-rest'),/Risorsa/)
const expanded=patronExpandedSpellChoices(data,'phb2014:subclass:archfey',1)
assert.deepEqual(expanded,['phb2014:spell:faerie-fire','phb2014:spell:sleep'])
const chain=option('pact-of-the-chain')
assert.equal(chain.mechanics.effect.familiarAttackUsesReaction,true)
assert.equal(option('pact-of-the-tome').mechanics.effect.cantripsCountAsWarlockSpells,true)
assert.equal(data.spells.find((x)=>x.index==='revivify').school.index,'necromancy')
assert.equal(data.spells.find((x)=>x.index==='mass-heal').school.index,'evocation')
const corrupted=async(url)=>({ok:true,text:async()=>await (await fetcher(url)).text()+(url.endsWith('character-options.json')?' ':'')})
await assert.rejects(loadCandidateCreationData('candidate',corrupted),/Impronta/)
assert.ok(hasFighter, 'Required scope missing from candidate; tests must not silently skip.')
{
    assert.equal(data.verifiedOptions.filter((x)=>x.mechanics.optionType==='fighting-style').length,6)
    assert.equal(data.verifiedOptions.filter((x)=>x.mechanics.optionType==='fighter-maneuver').length,16)
    const ek='phb2014:subclass:eldritch-knight', bm='phb2014:subclass:battle-master'
    const expectedSlots=[[2,0,0,0],[3,0,0,0],[3,0,0,0],[3,0,0,0],[4,2,0,0],[4,2,0,0],[4,2,0,0],[4,3,0,0],[4,3,0,0],[4,3,0,0],[4,3,2,0],[4,3,2,0],[4,3,2,0],[4,3,3,0],[4,3,3,0],[4,3,3,0],[4,3,3,1],[4,3,3,1]]
    for(let level=3;level<=20;level++)assert.deepEqual(fighterProgression(data,{fighter:level},ek).casting.spellSlots,[...expectedSlots[level-3],0,0,0,0,0])
    const mixedFighter=fighterProgression(data,{fighter:3,wizard:17},ek)
    assert.equal(mixedFighter.proficiencyBonus,6)
    assert.deepEqual(mixedFighter.casting.spellSlots,[2,0,0,0,0,0,0,0,0])
    assert.throws(()=>fighterProgression(data,{fighter:2},ek),/livello/)
    assert.throws(()=>fighterProgression(data,{fighter:20,wizard:1},ek),/Livelli/)
    const adept={edition:'2014',classLevels:{wizard:1},knownCantripIds:[],featIds:['phb2014:feat:martial-adept'],selectionOriginId:'phb2014:feat:martial-adept'}
    assert.deepEqual(optionIssues(option('trip-attack'),adept),[],'Martial Adept does not require fighter levels')
    assert.ok(optionIssues(option('trip-attack'),{...adept,featIds:[]}).length)
    assert.deepEqual(fighterSelectionIssues(data,[option('trip-attack').id,option('rally').id],adept),[])
    assert.ok(fighterSelectionIssues(data,[option('trip-attack').id,option('rally').id,option('parry').id],adept).some((x)=>x.includes('limite')))
    assert.ok(fighterSelectionIssues(data,[option('trip-attack').id,option('trip-attack').id],adept).some((x)=>x.includes('duplicate')))
    const battle={...adept,classLevels:{fighter:7},subclassIds:[bm],selectionOriginId:'phb2014:subclass-feature:battle-master-3-combat-superiority',featIds:[]}
    assert.deepEqual(optionIssues(option('trip-attack'),battle),[])
    assert.ok(optionIssues(option('trip-attack'),{...battle,subclassIds:[ek]}).length)
    const maneuvers=data.verifiedOptions.filter((x)=>x.mechanics.optionType==='fighter-maneuver').map((x)=>x.id)
    assert.deepEqual(fighterSelectionIssues(data,maneuvers.slice(0,5),battle),[])
    assert.ok(fighterSelectionIssues(data,maneuvers.slice(0,6),battle).length)
    const style={...battle,classLevels:{fighter:1},selectionOriginId:'phb2014:class-feature:fighter-1-fighting-style'}
    assert.deepEqual(fighterSelectionIssues(data,[option('fighter-defense').id],style),[])
    assert.ok(fighterSelectionIssues(data,[option('fighter-defense').id],{...style,knownStyleIds:[option('fighter-defense').id]}).length)
    const champion={...style,classLevels:{fighter:10},subclassIds:['phb2014:subclass:champion'],selectionOriginId:'phb2014:subclass-feature:champion-10-additional-fighting-style'}
    assert.deepEqual(fighterSelectionIssues(data,[option('fighter-archery').id],champion),[])
    assert.ok(fighterSelectionIssues(data,[option('fighter-archery').id],{...champion,classLevels:{fighter:9}}).length)
    assert.equal(maneuverResources(data,adept)[0].die,'d6')
    for(const [level,die,count] of [[3,'d8',4],[7,'d8',5],[10,'d10',5],[15,'d10',6],[18,'d12',6],[20,'d12',6]]) {
        const pools=maneuverResources(data,{...battle,classLevels:{fighter:level},featIds:adept.featIds})
        assert.deepEqual(pools.map((p)=>[p.die,p.maximum]),[[die,count],['d6',1]],'The feat die keeps its own size')
        assert.ok(pools.every((p)=>recoverResource({...p,used:1},'short-rest').used===0))
    }
    assert.equal(option('feinting-attack').mechanics.effect.advantageExpires,'end-of-own-current-turn')
    assert.deepEqual(eldritchKnightSpellReplacementIssues(data,{fighter:4},'phb2014:spell:find-familiar',3,true),[])
    assert.ok(eldritchKnightSpellReplacementIssues(data,{fighter:4},'phb2014:spell:find-familiar',3,false).some((x)=>x.includes('abiurazione')))
    assert.ok(eldritchKnightSpellReplacementIssues(data,{fighter:4},'phb2014:spell:finger-of-death',3,true).some((x)=>x.includes('Livello')))
    assert.ok(eldritchKnightSpellReplacementIssues(data,{fighter:4},'phb2014:spell:find-steed',3,true).some((x)=>x.includes('mago')))
    assert.throws(()=>eldritchKnightSpellReplacementIssues(data,{fighter:4},'phb2014:spell:find-familiar',4,true),/apprendimento/)
    const pendingData=structuredClone(data)
    const pendingSpell=pendingData.reviewedEntities.find((x)=>x.id==='phb2014:spell:find-familiar')
    pendingSpell.verification.mechanics='ocr-candidate';pendingSpell.verification.complete=false
    assert.ok(eldritchKnightSpellReplacementIssues(pendingData,{fighter:4},pendingSpell.id,3,true).some((x)=>x.includes('verificare')))
}
assert.ok(data.reviewedEntities.some((x)=>x.id==='phb2014:subclass-feature:arcane-trickster-3-spellcasting'), 'Required scope missing from candidate; tests must not silently skip.')
{
    for(let level=1;level<=20;level++) {
        const hit={attackRollState:'advantage',weapon:'ranged',hitCreature:true,alreadyUsedThisTurn:false}
        assert.deepEqual(rogueSneakAttack(data,{rogue:level},hit),{eligible:true,dice:`${Math.ceil(level/2)}d6`,maximumUsesPerTurn:1})
        assert.equal(rogueSneakAttack(data,{rogue:level},{...hit,alreadyUsedThisTurn:true}).eligible,false)
        if(level>=3) {
            const row=rogueSpellcastingProgression(data,{rogue:level})
            assert.equal(row.cantripsKnown,level<10?3:4)
            assert.equal(row.spellSlots[3],level>=19?1:0)
            assert.deepEqual(row.unrestrictedReplacementForSpellLearnedAtLevels,[3,8,14,20])
        }
    }
    const hit={attackRollState:'normal',weapon:'finesse',hitCreature:true,alreadyUsedThisTurn:false,otherEnemyOfTarget:{distanceFt:5,incapacitated:false}}
    assert.equal(rogueSneakAttack(data,{rogue:1,wizard:19},hit).dice,'1d6','Sneak Attack uses rogue levels')
    assert.equal(rogueSneakAttack(data,{rogue:1},hit).eligible,true)
    for(const override of [{attackRollState:'disadvantage'},{weapon:'other'},{hitCreature:false},{otherEnemyOfTarget:{distanceFt:6,incapacitated:false}},{otherEnemyOfTarget:{distanceFt:5,incapacitated:true}}])
        assert.equal(rogueSneakAttack(data,{rogue:1},{...hit,...override}).eligible,false)
    assert.throws(()=>rogueSneakAttack(data,{rogue:1},{...hit,otherEnemyOfTarget:{distanceFt:NaN,incapacitated:false}}),/Distanza/)
    assert.throws(()=>rogueSneakAttack(data,{wizard:1},hit),/ladro/)
    assert.throws(()=>rogueSpellcastingProgression(data,{rogue:2}),/livello/)
    assert.equal(rogueSpellcastingProgression(data,{rogue:3,wizard:17}).proficiencyBonus,6)
    const fast=data.reviewedEntities.find((x)=>x.id==='phb2014:subclass-feature:thief-3-fast-hands')
    assert.equal(fast.mechanics.effect.excludes,'magic-item-activation')
    assert.ok(fast.sources.some((x)=>x.filename==='D&D_5_Master_Original_Handbook.pdf' && x.pdfPages.includes(142)))
    const mageHand=data.reviewedEntities.find((x)=>x.id==='phb2014:spell:mage-hand')
    assert.equal(mageHand.verification.complete,true)
    assert.equal(mageHand.mechanics.effect.maximumCarriedWeightLb,10)
}
assert.ok(hasTotems, 'Required scope missing from candidate; tests must not silently skip.')
{
    assert.equal(data.verifiedOptions.filter((x)=>x.mechanics.optionType==='totem-choice').length,9)
    const totem='phb2014:subclass:totem-warrior'
    const context={edition:'2014',classLevels:{barbarian:14},knownCantripIds:[],subclassIds:[totem]}
    for(const [tier,origin] of [[3,'totem-spirit'],[6,'aspect-of-the-beast'],[14,'totemic-attunement']]) {
        const ctx={...context,selectionOriginId:`phb2014:subclass-feature:totem-warrior-${tier}-${origin}`}
        assert.deepEqual(totemSelectionIssues(data,[option(`totem-${tier}-bear`).id],ctx),[])
        assert.ok(totemSelectionIssues(data,[option(`totem-${tier}-bear`).id,option(`totem-${tier}-eagle`).id],ctx).length)
        assert.ok(totemSelectionIssues(data,[option(`totem-${tier}-bear`).id],{...ctx,classLevels:{barbarian:tier-1,wizard:20-tier+1}}).length)
        assert.ok(totemSelectionIssues(data,[option(`totem-${tier}-bear`).id],{...ctx,subclassIds:['phb2014:subclass:berserker']}).length)
        assert.ok(totemSelectionIssues(data,[option(`totem-${tier}-bear`).id],{...ctx,edition:'2024'}).length)
    }
    assert.equal(option('totem-3-bear').mechanics.effect.damageResistance,'all-except-psychic')
    assert.deepEqual(option('totem-3-eagle').mechanics.effect.requires,['raging','not-heavy-armor'])
    assert.equal(option('totem-14-eagle').mechanics.effect.fallsWhen,'end-of-own-turn-in-air-with-no-other-support')
    const frenzy=data.reviewedEntities.find((x)=>x.id==='phb2014:subclass-feature:berserker-3-frenzy')
    assert.equal(frenzy.mechanics.effect.rageEndExhaustionLevels,1)
    assert.ok(frenzy.mechanics.effect.grants.includes('after-first'))
    const rituals=data.reviewedEntities.filter((x)=>x.kind==='subclass-feature' && x.relations.subclassId===totem).flatMap((x)=>x.mechanics.effect.spellGrants ?? [])
    assert.equal(rituals.length,3)
    assert.ok(rituals.every((r)=>r.ritualOnly && data.reviewedEntities.find((e)=>e.id===r.spellId).verification.complete))
}
assert.ok(data.verifiedCreatures.length, 'Required scope missing from candidate; tests must not silently skip.')
{
    const moonReviewed=data.reviewedEntities.some((e)=>e.id==='phb2014:subclass-feature:moon-2-circle-forms')
    const chainReviewed=data.verifiedCreatures.some((e)=>e.index==='imp')
    assert.deepEqual(data.verifiedCreatures.map((e)=>e.id).sort(),data.reviewedEntities.filter((e)=>e.kind==='creature' && e.verification.complete).map((e)=>e.id).sort())
    const familiar=data.reviewedEntities.find((x)=>x.id==='phb2014:spell:find-familiar')
    assert.equal(familiar.relations.normalFormIds.length,15)
    for(const id of familiar.relations.normalFormIds) {
        const f=familiarStatistics(data,id,'fey')
        assert.equal(f.creature.mechanics.type,'fey')
        assert.equal(f.cannotAttack,true)
        assert.ok(f.creature.mechanics.actions.every((a)=>a.kind==='special'))
        assert.equal(reviewedCreature(data,id).mechanics.type,'beast','Spirit conversion does not mutate creature statistics')
    }
    assert.throws(()=>familiarStatistics(data,'mm2014:creature:brown-bear','fey'),/Forma/)
    assert.throws(()=>familiarStatistics(data,'mm2014:creature:cat','beast'),/Tipo/)
    assert.equal(familiarStatistics(data,'mm2014:creature:octopus','celestial').creature.mechanics.actions[0].index,'ink-cloud')
    if(chainReviewed) {
        const ctx={edition:'2014',classLevels:{warlock:3},knownCantripIds:[],pactOptionId:'phb2014:class-option:pact-of-the-chain'}
        for(const form of ['imp','pseudodragon','quasit','sprite']) {
            const id='mm2014:creature:'+form
            assert.throws(()=>familiarStatistics(data,id,'fiend'),/Patto/)
            assert.ok(familiarStatistics(data,id,'fiend',ctx).creature.mechanics.actions.every((a)=>a.kind==='special'))
            assert.throws(()=>familiarStatistics(data,id,'fiend',{...ctx,classLevels:{warlock:2}}),/livello/)
        }
        const plan=chainFamiliarAttackPlan(data,'mm2014:creature:sprite','shortbow',ctx)
        assert.deepEqual(plan.attack.rangeFt,{normal:40,long:160})
        assert.equal(plan.familiarReactionRequired,true)
        assert.equal(plan.grantsMasterMagicResistance,false)
        assert.equal(plan.attack.effect.onHitSave.saveTotalAtMost,5)
        assert.equal(reviewedCreature(data,'mm2014:creature:pseudodragon').mechanics.actions[1].effect.onHitSave.failureByAtLeast,5)
        assert.equal(reviewedCreature(data,'mm2014:creature:quasit').mechanics.actions[0].attackBonus,4)
        assert.equal(reviewedCreature(data,'mm2014:creature:imp').mechanics.conditionalDamageResistances[0].condition,'nonmagical-attacks-not-silvered')
        assert.throws(()=>chainFamiliarAttackPlan(data,'mm2014:creature:sprite','heart-sight',ctx),/Attacco/)
        assert.throws(()=>chainFamiliarAttackPlan(data,'mm2014:creature:cat','claws',{...ctx,edition:'2024'}),/Patto/)
    }
    assert.deepEqual(reviewedCreature(data,'mm2014:creature:cat').mechanics.sensesFt,{})
    assert.deepEqual(reviewedCreature(data,'mm2014:creature:frog').mechanics.actions,[])
    assert.equal(reviewedCreature(data,'mm2014:creature:sea-horse').mechanics.experiencePoints,0)
    assert.equal(reviewedCreature(data,'mm2014:creature:spider').mechanics.actions[0].effect.additionalDamageSave.successDamage,'none')
    assert.equal(reviewedCreature(data,'mm2014:creature:poisonous-snake').mechanics.actions[0].effect.additionalDamageSave.successDamage,'half')
    assert.deepEqual(reviewedCreature(data,'mm2014:creature:black-bear').mechanics.actions.filter((a)=>a.attackBonus!==undefined).map((a)=>a.attackBonus),[4,4])
    assert.deepEqual(reviewedCreature(data,'mm2014:creature:brown-bear').mechanics.actions.filter((a)=>a.attackBonus!==undefined).map((a)=>a.attackBonus),[6,6])
    const ctx={edition:'2014',classLevels:{druid:2},previouslySeen:true}
    const issues=(name,override={})=>wildShapeIssues(data,`mm2014:creature:${name}`,{...ctx,...override})
    assert.deepEqual(issues('wolf'),[])
    if(data.verifiedCreatures.some((e)=>e.index==='swarm-of-bats'))assert.ok(issues('swarm-of-bats').some((s)=>s.toLowerCase().includes('sciame')))
    assert.ok(issues('wolf',{previouslySeen:false}).length)
    assert.ok(issues('wolf',{classLevels:{druid:1,wizard:19}}).length)
    if(data.verifiedCreatures.some((e)=>e.index==='mammoth')) {
        assert.deepEqual(issues('mammoth',{classLevels:{druid:18},subclassId:'phb2014:subclass:moon'}),[])
        assert.ok(issues('giant-ape',{classLevels:{druid:20},subclassId:'phb2014:subclass:moon'}).length)
        assert.ok(issues('pteranodon',{classLevels:{druid:7},subclassId:'phb2014:subclass:moon'}).length)
        assert.deepEqual(issues('pteranodon',{classLevels:{druid:8},subclassId:'phb2014:subclass:moon'}),[])
    }

    assert.ok(issues('wolf',{edition:'2024'}).length)
    assert.ok(issues('crab').length,'A swimming speed is forbidden even if the creature can also walk')
    assert.deepEqual(issues('crab',{classLevels:{druid:4}}),[])
    assert.ok(issues('owl',{classLevels:{druid:7}}).length)
    assert.deepEqual(issues('owl',{classLevels:{druid:8}}),[])
    assert.ok(issues('black-bear').length)
    assert.deepEqual(issues('black-bear',{classLevels:{druid:4}}),[])
    assert.ok(issues('brown-bear',{classLevels:{druid:4}}).length)
    assert.deepEqual(issues('brown-bear',{classLevels:{druid:8}}),[])
    if(moonReviewed) {
        assert.deepEqual(issues('brown-bear',{classLevels:{druid:2},subclassId:'phb2014:subclass:moon'}),[])
        assert.ok(issues('crab',{classLevels:{druid:2},subclassId:'phb2014:subclass:moon'}).length,'Moon changes CR only; swimming is still forbidden before level 4')
        assert.ok(issues('owl',{classLevels:{druid:7},subclassId:'phb2014:subclass:moon'}).length)
        assert.deepEqual(issues('owl',{classLevels:{druid:8},subclassId:'phb2014:subclass:moon'}),[])
        const elemental=(name,level)=>wildShapeIssues(data,`mm2014:creature:${name}-elemental`,{...ctx,classLevels:{druid:level},subclassId:'phb2014:subclass:moon'})
        for(const name of ['air','earth','fire','water']) {
            assert.ok(elemental(name,9).length)
            assert.deepEqual(elemental(name,10),[])
            assert.deepEqual(wildShapeIssues(data,`mm2014:creature:${name}-elemental`,{...ctx,classLevels:{druid:10},subclassId:'phb2014:subclass:moon',previouslySeen:false}),[],'Seen-beast restriction does not reject the four named elemental forms')
            const c=reviewedCreature(data,`mm2014:creature:${name}-elemental`)
            assert.equal(c.mechanics.conditionalDamageResistances[0].condition,'nonmagical-attacks')
            assert.ok(wildShapeIssues(data,c.id,{...ctx,classLevels:{druid:10},subclassId:'phb2014:subclass:land'}).length)
        }
        assert.equal(reviewedCreature(data,'mm2014:creature:water-elemental').mechanics.actions[2].effect.releaseOther.rollKind,'ability-check')
        assert.equal(wildShapeResources(data,{druid:2}).maximum,2)
        assert.equal(wildShapeResources(data,{druid:2}).durationHours,1)
        assert.equal(wildShapeResources(data,{druid:2},'phb2014:subclass:moon').activation,'bonus-action-on-own-turn')
        assert.equal(wildShapeResources(data,{druid:9},'phb2014:subclass:moon').elementalCost,null)
        assert.equal(wildShapeResources(data,{druid:10},'phb2014:subclass:moon').elementalCost,2)
        assert.equal(wildShapeResources(data,{druid:20}).maximum,'unlimited')
        assert.equal(wildShapeResources(data,{druid:2,wizard:18}).maximum,2,'Archdruid requires druid level 20')
        assert.deepEqual(wildShapeResources(data,{druid:2}).recovery,['short-rest','long-rest'])
        const terrains=['arctic','coast','desert','forest','grassland','mountain','swamp','underdark']
        for(const t of terrains) {
            assert.equal(druidCircleSpellGrants(data,{druid:2},t).length,0)
            assert.equal(druidCircleSpellGrants(data,{druid:3},t).length,2)
            assert.equal(druidCircleSpellGrants(data,{druid:9},t).length,8)
        }
        const grants=druidCircleSpellGrants(data,{druid:3},'swamp')
        assert.ok(grants.some((g)=>g.spellId.includes('acid-arrow')))
        assert.ok(grants.every((g)=>g.alwaysPrepared && !g.countsAgainstPreparedLimit && g.countsAsDruidSpell))
        assert.throws(()=>druidCircleSpellGrants(data,{druid:2},'__proto__'),/Territorio/)
        assert.throws(()=>druidCircleSpellGrants(data,{druid:1},'arctic'),/livello/)
        const alter=data.reviewedEntities.find((e)=>e.id==='phb2014:spell:alter-self')
        assert.equal(alter.verification.complete,true)
        assert.equal(alter.mechanics.effect.options.appearance.statisticsChange,false)
    } else assert.ok(issues('brown-bear',{classLevels:{druid:2},subclassId:'phb2014:subclass:moon'}).length,'Unreviewed subclass exceptions are not guessed')
    assert.throws(()=>issues('unknown'),/verificare/)
    const corruptedCreatures=async(url)=>({ok:true,text:async()=>await (await fetcher(url)).text()+(url.endsWith('verified-creatures-2014.json')?' ':'')})
    await assert.rejects(loadCandidateCreationData('candidate',corruptedCreatures),/Impronta/)
}
assert.ok(data.reviewedEntities.some((e)=>e.id==='phb2014:race:dragonborn' && e.mechanics.age), 'Required scope missing from candidate; tests must not silently skip.')
{
    for(const [level,dice] of [[1,'2d6'],[5,'2d6'],[6,'3d6'],[10,'3d6'],[11,'4d6'],[15,'4d6'],[16,'5d6'],[20,'5d6']]) {
        assert.equal(draconicBreath(data,{fighter:1,wizard:level-1},'black',14).dice,dice)
    }
    const breath=draconicBreath(data,{fighter:1,wizard:19},'black',9)
    assert.equal(breath.saveDC,13,'Constitution 9 modifier is -1; total character level grants +6 proficiency')
    assert.deepEqual(breath.area,{shape:'line',widthFt:5,lengthFt:30})
    assert.equal(breath.saveAbility,'dexterity')
    for(const color of ['green','silver','white'])assert.equal(draconicBreath(data,{fighter:1},color,10).saveAbility,'constitution')
    assert.deepEqual(draconicBreath(data,{fighter:1},'red',10).area,{shape:'cone',lengthFt:15})
    assert.deepEqual(breath.resource.recovery,['short-rest','long-rest'])
    assert.throws(()=>draconicBreath(data,{fighter:1},'purple',10),/Ascendenza/)
    assert.throws(()=>draconicBreath(data,{fighter:1},'red',NaN),/Statistiche/)
    const bonus=(race,extra={})=>racialAbilityBonuses(data,{raceId:`phb2014:race:${race}`,...extra})
    assert.deepEqual(bonus('human'),{strength:1,dexterity:1,constitution:1,intelligence:1,wisdom:1,charisma:1})
    assert.deepEqual(bonus('dwarf',{subraceId:'phb2014:subrace:mountain-dwarf'}),{constitution:2,strength:2})
    assert.deepEqual(bonus('elf',{subraceId:'phb2014:subrace:high-elf'}),{dexterity:2,intelligence:1})
    assert.deepEqual(bonus('half-elf',{chosenAbilities:['strength','wisdom']}),{charisma:2,strength:1,wisdom:1})
    assert.throws(()=>bonus('half-elf',{chosenAbilities:['charisma','wisdom']}),/Scelte/)
    assert.throws(()=>bonus('half-elf',{chosenAbilities:['wisdom','wisdom']}),/duplicate/)
    assert.throws(()=>bonus('half-elf',{chosenAbilities:['wisdom']}),/Scelte/)
    assert.throws(()=>bonus('dwarf'),/sottorazza/)
    assert.throws(()=>bonus('dwarf',{subraceId:'phb2014:subrace:high-elf'}),/incompatibile/)
    const variant={variantId:'phb2014:race-variant:variant-human',chosenAbilities:['strength','dexterity'],variantApproved:true}
    assert.deepEqual(bonus('human',variant),{strength:1,dexterity:1})
    assert.throws(()=>bonus('human',{...variant,variantApproved:false}),/autorizzata/)
    assert.throws(()=>bonus('half-orc',variant),/incompatibile/)
    const elf=data.reviewedEntities.find((e)=>e.id==='phb2014:race:elf')
    const trance=elf.mechanics.traits.find((t)=>t.index==='trance').mechanics.longRestDurationInterpretation
    const hasRuling=elf.sources.some((s)=>s.book==='sac-rulings' && s.role==='official-ruling-not-editorial-erratum')
    assert.equal(elf.verification.complete,hasRuling)
    if(hasRuling)assert.equal(trance.hours,4)
    else assert.ok(elf.verification.missingFields.some((f)=>f.endsWith('longRestDurationInterpretation')))
    assert.ok(data.reviewedEntities.filter((e)=>e.kind==='race').every((e)=>!e.mechanics.alignmentDescription))
}
assert.ok(data.reviewedEntities.some((e)=>e.kind==='background' && e.mechanics.personalityTables), 'Required scope missing from candidate; tests must not silently skip.')
{
    assert.equal(backgroundTableEntry(data,'phb2014:background:acolyte','ideals',4).suggestedAlignmentAspect,'lawful')
    assert.equal(backgroundTableEntry(data,'phb2014:background:guild-artisan','ideals',6).suggestedAlignmentAspect,null)
    assert.equal(backgroundTableEntry(data,'phb2014:background:entertainer','specialty',10).roll,10)
    for(const roll of [0,9,NaN,1.5])assert.throws(()=>backgroundTableEntry(data,'phb2014:background:acolyte','traits',roll))
    assert.throws(()=>backgroundTableEntry(data,'phb2014:background:acolyte','__proto__',1))
    const entry=backgroundTableEntry(data,'phb2014:background:acolyte','traits',1)
    entry.summaryIt='changed'
    assert.notEqual(backgroundTableEntry(data,'phb2014:background:acolyte','traits',1).summaryIt,'changed')
    const retainers=backgroundFeatureChoice(data,'phb2014:background:noble','alternate')
    assert.equal(retainers.effect.retainers,3)
    assert.equal(retainers.effect.type,'commoner')
    const knight=backgroundFeatureChoice(data,'phb2014:background:noble','alternate','phb2014:background-variant:knight')
    assert.equal(knight.effect.commonerRetainers,2)
    assert.equal(knight.effect.nobleSquireRetainers,1)
    assert.throws(()=>backgroundFeatureChoice(data,'phb2014:background:noble','primary','phb2014:background-variant:knight'),/Servitori/)
    assert.equal(backgroundFeatureChoice(data,'phb2014:background:sailor','alternate').effect.blanketLegalImmunity,false)
    assert.throws(()=>backgroundFeatureChoice(data,'phb2014:background:hermit','alternate'),/disponibile/)
    assert.throws(()=>backgroundFeatureChoice(data,'phb2014:background:sailor','alternate','phb2014:background-variant:knight'),/incompatibile/)
    const spells=data.reviewedEntities.filter((e)=>e.kind==='spell' && e.verification.complete)
    for(const s of spells) {
        const legacy=data.spells.find((x)=>x.verifiedRules2014?.referenceId===s.id)
        if(legacy)assert.deepEqual(legacy.verifiedRules2014.mechanics,s.mechanics)
    }
}
assert.ok(data.reviewedEntities.some((e)=>e.id==='phb2014:class-feature:bard-1-spellcasting' && e.mechanics.effect), 'Required scope missing from candidate; tests must not silently skip.')
{
    for(const [level,die] of [[1,'1d6'],[4,'1d6'],[5,'1d8'],[9,'1d8'],[10,'1d10'],[14,'1d10'],[15,'1d12'],[20,'1d12']]) {
        const r=bardInspirationResource(data,{bard:level},9)
        assert.equal(r.die,die)
        assert.equal(r.maximum,1)
        assert.deepEqual(r.recovery,level<5 ? ['long-rest'] : ['short-rest','long-rest'])
    }
    assert.equal(bardInspirationResource(data,{bard:3,wizard:17},20).die,'1d6')
    assert.equal(bardInspirationResource(data,{bard:3},20).maximum,5)
    assert.throws(()=>bardInspirationResource(data,{bard:1},NaN),/Carisma/)
    assert.throws(()=>bardProgression(data,{wizard:20}),/bardo/)
    assert.throws(()=>bardProgression(data,{bard:2},'phb2014:subclass:lore'),/Collegio/)
    assert.equal(bardProgression(data,{bard:6},'phb2014:subclass:lore').additionalMagicalSecretSelections,2)
    assert.equal(bardProgression(data,{bard:6},'phb2014:subclass:valor').additionalMagicalSecretSelections,0)
    assert.equal(bardProgression(data,{bard:10,wizard:10}).maximumBardSpellLevel,5)
    const lore={originId:'phb2014:subclass-feature:lore-6-additional-magical-secrets',subclassId:'phb2014:subclass:lore'}
    assert.deepEqual(magicalSecretSelectionIssues(data,{bard:6},['phb2014:spell:counterspell','phb2014:spell:blink'],lore),[])
    assert.ok(magicalSecretSelectionIssues(data,{bard:6,wizard:14},['phb2014:spell:counterspell','phb2014:spell:mass-heal'],lore).some((s)=>s.includes('superiore')))
    assert.ok(magicalSecretSelectionIssues(data,{bard:6},['phb2014:spell:blink','phb2014:spell:blink'],lore).some((s)=>s.includes('distinti')))
    assert.ok(magicalSecretSelectionIssues(data,{bard:6},['phb2014:spell:blink','phb2014:spell:counterspell'],{...lore,subclassId:'phb2014:subclass:valor'}).some((s)=>s.includes('Sapienza')))
    assert.ok(magicalSecretSelectionIssues(data,{bard:10},['phb2014:spell:blink','phb2014:spell:counterspell'],{originId:'phb2014:class-feature:bard-14-magical-secrets'}).some((s)=>s.includes('insufficiente')))
    assert.deepEqual(magicalSecretSelectionIssues(data,{bard:10},['phb2014:spell:eldritch-blast','phb2014:spell:counterspell'],{originId:'phb2014:class-feature:bard-10-magical-secrets'}),[])
    for(const level of [2,9,13,17])assert.equal(data.reviewedEntities.find((e)=>e.id===`phb2014:class-feature:bard-${level}-song-of-rest`).mechanics.effect.requiresSpendingHitDice,true)
}
assert.ok(data.reviewedEntities.some((e)=>e.id==='phb2014:subclass-feature:devotion-3-oath-spells'), 'Required scope missing from candidate; tests must not silently skip.')
{
    for(const sub of ['devotion','ancients','vengeance']) {
        const id=`phb2014:subclass:${sub}`
        assert.equal(paladinOathSpellGrants(data,{paladin:3},id).length,2)
        assert.equal(paladinOathSpellGrants(data,{paladin:5},id).length,4)
        assert.equal(paladinOathSpellGrants(data,{paladin:17},id).length,10)
        assert.equal(paladinOathSpellGrants(data,{paladin:3,wizard:17},id).length,2)
    }
    assert.throws(()=>paladinOathSpellGrants(data,{paladin:2},'phb2014:subclass:devotion'),/Giuramento/)
    assert.throws(()=>paladinOathSpellGrants(data,{paladin:3},'phb2014:subclass:lore'),/Giuramento/)
    const pools=paladinResourcePools(data,{paladin:3,warlock:17},9)
    assert.equal(pools.layOnHands.maximum,15)
    assert.equal(pools.divineSense.maximum,0)
    assert.equal(pools.channelDivinity.maximum,1)
    assert.equal(pools.cleansingTouch,null)
    assert.equal(paladinResourcePools(data,{paladin:14},9).cleansingTouch.maximum,1)
    assert.equal(paladinResourcePools(data,{paladin:1},6).divineSense.rawMaximum,-1)
    assert.throws(()=>paladinResourcePools(data,{paladin:1},NaN),/Statistiche/)
    for(const [slot,normal,special] of [[1,'2d8','3d8'],[2,'3d8','4d8'],[3,'4d8','5d8'],[4,'5d8','6d8'],[9,'5d8','6d8']]) {
        assert.equal(paladinSmiteDamage(data,{paladin:2,wizard:18},slot,'beast').divineSmite,normal)
        assert.equal(paladinSmiteDamage(data,{paladin:2,wizard:18},slot,'undead').divineSmite,special)
    }
    assert.equal(paladinSmiteDamage(data,{paladin:2,warlock:18},5,'fiend').slotCost,'one-spell-slot')
    assert.equal(paladinSmiteDamage(data,{paladin:11},1,'beast').improvedDivineSmite,'1d8')
    assert.equal(paladinSmiteDamage(data,{paladin:2,wizard:18},1,'beast').improvedDivineSmite,null)
    for(const slot of [0,10,NaN,1.5])assert.throws(()=>paladinSmiteDamage(data,{paladin:2},slot,'beast'))
    const ctx={edition:'2014',classLevels:{paladin:2},selectionOriginId:'phb2014:class-feature:paladin-2-fighting-style',knownCantripIds:[],subclassIds:[],selectedFeatIds:[]}
    assert.deepEqual(fighterSelectionIssues(data,['phb2014:class-option:fighter-dueling'],ctx),[])
    assert.ok(fighterSelectionIssues(data,['phb2014:class-option:fighter-archery'],ctx).length)
    assert.ok(fighterSelectionIssues(data,['phb2014:class-option:fighter-dueling'],{...ctx,classLevels:{paladin:1}}).length)
}
assert.ok(hasHunter, 'Required scope missing from candidate; tests must not silently skip.')
{
    assert.equal(rangerProgression(data,{ranger:3,wizard:17}).proficiencyBonus,6)
    assert.equal(rangerProgression(data,{ranger:3,wizard:17}).maximumRangerSpellLevel,1)
    assert.equal(rangerProgression(data,{ranger:19}).spellsKnown,11)
    assert.throws(()=>rangerProgression(data,{ranger:0}))
    const ctx={edition:'2014',classLevels:{ranger:3,wizard:17},subclassIds:['phb2014:subclass:hunter'],knownCantripIds:[],selectionOriginId:'phb2014:subclass-feature:hunter-3-hunter-s-prey'}
    const colossus='phb2014:class-option:hunter-colossus-slayer',evasion='phb2014:class-option:hunter-evasion'
    assert.deepEqual(hunterSelectionIssues(data,[colossus],ctx),[])
    assert.ok(hunterSelectionIssues(data,[evasion],ctx).length)
    assert.ok(hunterSelectionIssues(data,[colossus,colossus],ctx).length)
    assert.ok(hunterSelectionIssues(data,[colossus],{...ctx,subclassIds:['phb2014:subclass:beast-master']}).length)
    assert.ok(hunterSelectionIssues(data,[colossus],{...ctx,classLevels:{ranger:2,wizard:18}}).length)
    assert.deepEqual(hunterSelectionIssues(data,[evasion],{...ctx,classLevels:{ranger:15},selectionOriginId:'phb2014:subclass-feature:hunter-15-superior-hunter-s-defense'}),[])
    const companion=rangerCompanionStatistics(data,'mm2014:creature:owl',{ranger:3,wizard:17},'phb2014:subclass:beast-master')
    assert.equal(companion.derived.maximumHitPoints,12)
    assert.equal(companion.derived.armorClass,17)
    assert.equal(companion.derived.attackBonuses.talons,9)
    assert.equal(companion.derived.additionalDamageRollBonus,6)
    assert.equal(companion.commands.uncommandedAction,'Dodge')
    assert.equal(companion.commands.reactionNeedsCommand,false)
    assert.equal(companion.creature.mechanics.hitPoints.average,1)
    assert.equal(companion.creature.mechanics.armorClass.value,11)
    companion.creature.mechanics.armorClass.value=99
    assert.equal(reviewedCreature(data,'mm2014:creature:owl').mechanics.armorClass.value,11)
    assert.equal(rangerCompanionStatistics(data,'mm2014:creature:frog',{ranger:3},'phb2014:subclass:beast-master').derived.maximumHitPoints,12)
    assert.equal(rangerCompanionStatistics(data,'mm2014:creature:wolf',{ranger:11},'phb2014:subclass:beast-master').bestialFury.mayChoosePrintedMultiattackInstead,true)
    for(const id of ['black-bear','dire-wolf','water-elemental'])assert.throws(()=>rangerCompanionStatistics(data,'mm2014:creature:'+id,{ranger:3},'phb2014:subclass:beast-master'))
    assert.throws(()=>rangerCompanionStatistics(data,'mm2014:creature:owl',{ranger:3},'phb2014:subclass:hunter'))
    const style={...ctx,classLevels:{ranger:2},selectionOriginId:'phb2014:class-feature:ranger-2-fighting-style'}
    assert.deepEqual(fighterSelectionIssues(data,['phb2014:class-option:fighter-archery'],style),[])
    assert.ok(fighterSelectionIssues(data,['phb2014:class-option:fighter-protection'],style).length)
}
assert.ok(hasMonk, 'Required scope missing from candidate; tests must not silently skip.')
{
    for(const [level,die,move] of [[1,'1d4',0],[5,'1d6',10],[11,'1d8',20],[17,'1d10',25],[20,'1d10',30]]) {
        const m=monkResources(data,{monk:level},16)
        assert.equal(m.martialArtsDie,die);assert.equal(m.unarmoredMovementBonusFt,move)
        assert.equal(m.ki.maximum,level===1 ? 0 : level)
    }
    assert.equal(monkResources(data,{monk:3,wizard:17},16).kiSaveDC,17)
    assert.equal(recoverMonkKi(data,{monk:3},3,'short-rest',29).used,3)
    assert.equal(recoverMonkKi(data,{monk:3},3,'short-rest',30).used,0)
    assert.throws(()=>recoverMonkKi(data,{monk:3},4,'short-rest',30))
    assert.throws(()=>recoverMonkKi(data,{monk:3},2,'short-rest',NaN))
    const ctx={edition:'2014',classLevels:{monk:3,wizard:17},knownCantripIds:[],subclassIds:['phb2014:subclass:four-elements']}
    const attune='phb2014:class-option:monk-elemental-attunement',burn='phb2014:class-option:monk-sweeping-cinder-strike',mountain='phb2014:class-option:monk-eternal-mountain-defense'
    assert.deepEqual(monkDisciplineSelectionIssues(data,[attune,burn],ctx),[])
    assert.ok(monkDisciplineSelectionIssues(data,[burn],ctx).length)
    assert.ok(monkDisciplineSelectionIssues(data,[attune,burn,burn],ctx).length)
    assert.ok(monkDisciplineSelectionIssues(data,[attune,mountain],{...ctx,classLevels:{monk:11}}).length)
    assert.deepEqual(monkDisciplineSelectionIssues(data,[mountain],{...ctx,classLevels:{monk:17}}),[],'The initial attunement can have been replaced on a later learning event')
    assert.equal(monkDisciplineSpellUse(data,burn,ctx,[attune,burn]).kiCost,2)
    assert.throws(()=>monkDisciplineSpellUse(data,burn,ctx,[attune,burn],1))
    const five={...ctx,classLevels:{monk:5}}
    assert.equal(monkDisciplineSpellUse(data,burn,five,[attune,burn],1).spellLevel,2)
    assert.throws(()=>monkDisciplineSpellUse(data,burn,five,[attune,burn],2))
    const six={...ctx,classLevels:{monk:6}},hold='phb2014:class-option:monk-clench-of-the-north-wind'
    assert.equal(monkDisciplineSpellUse(data,hold,six,[hold]).kiCost,3)
    assert.throws(()=>monkDisciplineSpellUse(data,hold,six,[hold],1))
    const seventeen={...ctx,classLevels:{monk:17}}
    assert.equal(monkDisciplineSpellUse(data,mountain,seventeen,[mountain]).materialComponentsRequired,false)
    assert.equal(monkDisciplineSpellUse(data,mountain,seventeen,[mountain]).targetSelfOnly,true)
    assert.throws(()=>monkDisciplineSpellUse(data,mountain,seventeen,[mountain],1),'Stoneskin has no enhanced higher-level effect')
    assert.throws(()=>monkDisciplineSpellUse(data,'phb2014:class-option:monk-water-whip',seventeen,['phb2014:class-option:monk-water-whip']))
    assert.throws(()=>monkDisciplineSpellUse(data,burn,seventeen,[mountain]))
}
assert.ok(hasMetamagic, 'Required scope missing from candidate; tests must not silently skip.')
{
    const row=sorcererProgression(data,{sorcerer:3,cleric:17})
    assert.equal(row.sorceryPoints,3);assert.equal(row.spellsKnown,4);assert.equal(row.metamagicKnown,2);assert.equal(row.proficiencyBonus,6)
    assert.equal(sorcererProgression(data,{sorcerer:1}).sorceryPoints,0)
    const ctx={edition:'2014',classLevels:{sorcerer:3},subclassIds:[],knownCantripIds:[]}
    const quick='phb2014:class-option:sorcerer-quickened-spell',subtle='phb2014:class-option:sorcerer-subtle-spell'
    assert.deepEqual(metamagicSelectionIssues(data,[quick,subtle],ctx),[])
    assert.ok(metamagicSelectionIssues(data,[quick,quick],ctx).length)
    assert.ok(metamagicSelectionIssues(data,[quick],{...ctx,classLevels:{sorcerer:2,cleric:18}}).length)
    const state={points:6,availableSlots:[4,3,3,0,0,0,0,0,0],createdSlots:Array(9).fill(0)}
    const created=sorcererFlexibleCasting(data,{sorcerer:6},state,'create-slot',4)
    assert.equal(created.points,0);assert.equal(created.availableSlots[3],1);assert.equal(created.createdSlots[3],1)
    assert.equal(created.createdSlotsExpire,'finish-long-rest');assert.equal(state.points,6)
    const sacrificed=sorcererFlexibleCasting(data,{sorcerer:6},created,'sacrifice-slot',4)
    assert.equal(sacrificed.points,4);assert.equal(sacrificed.createdSlots[3],0)
    assert.throws(()=>sorcererFlexibleCasting(data,{sorcerer:6},state,'create-slot',5))
    assert.throws(()=>sorcererFlexibleCasting(data,{sorcerer:20},{...state,points:20},'create-slot',6))
    assert.throws(()=>sorcererFlexibleCasting(data,{sorcerer:6},{...state,points:NaN},'create-slot',1))
    assert.throws(()=>sorcererFlexibleCasting(data,{sorcerer:6},{...state,createdSlots:Array(9).fill(1)},'sacrifice-slot',1))
    assert.equal(wildMagicTableEntry(data,7).entry.effect.spellId,'phb2014:spell:fireball')
    assert.equal(wildMagicTableEntry(data,100).entry.effect.recover,'all-expended-sorcery-points')
    assert.equal(wildMagicTableEntry(data,77).completeDependencies,false)
    for(const roll of [0,101,1.5,NaN])assert.throws(()=>wildMagicTableEntry(data,roll))
}
assert.ok(data.reviewedEntities.some((e)=>e.id==='phb2014:subclass-feature:life-2-preserve-life'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const p=clericProgression(data,{cleric:3,wizard:17},16)
    assert.equal(p.preparedLimit,6);assert.equal(p.proficiencyBonus,6);assert.equal(p.spellSlots[2],0)
    assert.equal(p.channelDivinity.maximum,1);assert.equal(p.destroyUndeadMaximumCR,null)
    assert.equal(clericProgression(data,{cleric:6},10).channelDivinity.maximum,2)
    assert.equal(clericProgression(data,{cleric:18},10).channelDivinity.maximum,3)
    assert.equal(clericProgression(data,{cleric:14},10).destroyUndeadMaximumCR,3)
    assert.equal(clericProgression(data,{cleric:1},1).preparedLimit,1)
    assert.throws(()=>clericProgression(data,{cleric:0},10))
    assert.equal(clericDomainSpellGrants(data,'phb2014:subclass:life',{cleric:3,wizard:17}).length,4)
    assert.ok(clericDomainSpellGrants(data,'phb2014:subclass:knowledge',{cleric:1}).some((g)=>g.spellId==='phb2014:spell:identify'))
    assert.throws(()=>clericDomainSpellGrants(data,'phb2014:subclass:evocation',{cleric:20}))
    const t={type:'humanoid',currentHP:0,maximumHP:11,chosenHealing:5}
    assert.equal(preserveLifeAllocation(data,{cleric:2},[t]).unused,5)
    assert.throws(()=>preserveLifeAllocation(data,{cleric:2},[{...t,chosenHealing:6}]))
    assert.throws(()=>preserveLifeAllocation(data,{cleric:2},[{...t,type:'undead'}]))
    assert.throws(()=>preserveLifeAllocation(data,{cleric:2},[t,t,t]))
    assert.throws(()=>preserveLifeAllocation(data,{cleric:2},[{...t,currentHP:NaN}]))
}
assert.ok(hasWizardChoices, 'Required scope missing from candidate; tests must not silently skip.')
{
    const p=wizardProgression(data,{wizard:3,cleric:17},16)
    assert.equal(p.maximumWizardSpellLevel,2);assert.equal(p.preparedLimit,6);assert.equal(p.proficiencyBonus,6)
    assert.equal(wizardProgression(data,{wizard:1},1).preparedLimit,1)
    assert.throws(()=>wizardProgression(data,{wizard:0},10))
    const ctx={edition:'2014',classLevels:{wizard:10},subclassIds:['phb2014:subclass:wizard-divination'],knownCantripIds:[],selectionOriginId:'phb2014:subclass-feature:wizard-divination-10-the-third-eye'}
    const eye='phb2014:class-option:wizard-third-eye-see-invisibility',stone='phb2014:class-option:wizard-stone-speed'
    assert.deepEqual(wizardChoiceIssues(data,[eye],ctx),[])
    assert.ok(wizardChoiceIssues(data,[eye,eye],ctx).length)
    assert.ok(wizardChoiceIssues(data,[stone],ctx).length)
    assert.ok(wizardChoiceIssues(data,[eye],{...ctx,classLevels:{wizard:9}}).length)
    assert.deepEqual(wizardChoiceIssues(data,[stone],{...ctx,classLevels:{wizard:6},subclassIds:['phb2014:subclass:wizard-transmutation'],selectionOriginId:'phb2014:subclass-feature:wizard-transmutation-6-transmuter-s-stone'}),[])
    const fire='phb2014:spell:fireball'
    assert.throws(()=>wizardSpellCopyPlan(data,fire,{wizard:3,cleric:17},'new-spell'))
    assert.equal(wizardSpellCopyPlan(data,fire,{wizard:5},'new-spell').goldGP,150)
    assert.equal(wizardSpellCopyPlan(data,fire,{wizard:5},'new-spell','phb2014:subclass:evocation').goldGP,75)
    assert.equal(wizardSpellCopyPlan(data,fire,{wizard:5},'own-book-or-prepared','phb2014:subclass:evocation').hours,1.5)
    assert.equal(wizardSpellCopyPlan(data,fire,{wizard:5},'new-spell','phb2014:subclass:wizard-conjuration').hours,6)
    assert.equal(wizardSpellCopyPlan(data,'phb2014:spell:blink',{wizard:5},'new-spell').hours,6,'Known class-list level permits copying eligibility without certifying effects')
    assert.equal(wizardSpellCopyPlan(data,'phb2014:spell:blink',{wizard:5},'new-spell','phb2014:subclass:wizard-transmutation').hours,3)
    assert.throws(()=>wizardSpellCopyPlan(data,'phb2014:spell:sanctuary',{wizard:5},'new-spell'))
    assert.throws(()=>wizardSpellCopyPlan(data,'phb2014:spell:mage-hand',{wizard:5},'new-spell'))
    assert.throws(()=>wizardSpellCopyPlan(data,fire,{wizard:5},'invented-mode'))
    const over=(slot,prior,levels={wizard:14})=>wizardOverchannelBacklash(data,levels,'phb2014:subclass:evocation',slot,prior)
    assert.equal(over(5,0).damage,'0');assert.equal(over(5,1).damage,'10d12');assert.equal(over(3,2).damage,'9d12')
    assert.ok(over(1,1).ignoresResistanceAndImmunity)
    for(const level of [0,6,NaN])assert.throws(()=>over(level,0))
    assert.throws(()=>over(1,1,{wizard:13,cleric:7}));assert.throws(()=>over(1,-1))
}

assert.ok(data.reviewedEntities.some((e)=>e.id==='dmg2014:rule:treasure-hoard-17-plus'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const dm={edition:'2014',dmApproved:true},individual='dmg2014:rule:individual-treasure-5-10'
    const average=treasureCoinPlan(data,individual,1,{...dm,mode:'average'})
    assert.deepEqual(average.coins,{cp:1400,ep:35});assert.equal(average.weightLb,28.7)
    assert.deepEqual(treasureCoinPlan(data,individual,30,{...dm,mode:'rolled',diceSums:{cp:4,ep:6}}).coins,{cp:400,ep:60})
    assert.throws(()=>treasureCoinPlan(data,individual,1,{...dm,mode:'rolled',diceSums:{cp:4,ep:7}}))
    assert.throws(()=>treasureCoinPlan(data,individual,1,{...dm,mode:'rolled',diceSums:{cp:4}}))
    assert.throws(()=>treasureCoinPlan(data,individual,1,{...dm,mode:'average',diceSums:{ep:2}}))
    assert.throws(()=>treasureCoinPlan(data,individual,1,{...dm,mode:'rolled',diceSums:{cp:4,ep:2,gp:3}}))
    const hoard=treasureCoinPlan(data,'dmg2014:rule:treasure-hoard-17-plus',1,{...dm,mode:'average'})
    assert.deepEqual(hoard.coins,{gp:42000,pp:28000});assert.deepEqual(hoard.magicItemRolls,[])
    const both=treasureCoinPlan(data,'dmg2014:rule:treasure-hoard-11-16',16,{...dm,mode:'average'})
    assert.equal(both.magicItemRolls.length,2)
    assert.equal(treasureTableEntry(data,'dmg2014:rule:magic-item-table-g',14,{...dm,furtherRolls:[6]}).effect.variantIndex,'onyx-dog')
    assert.equal(treasureTableEntry(data,'dmg2014:rule:magic-item-table-i',76,{...dm,furtherRolls:[12]}).effect.armorId,'phb2014:armor:plate-armor')
    assert.equal(treasureTableEntry(data,'dmg2014:rule:magic-item-table-i',66,dm).effect.variantIndex,'armor-1')
    assert.equal(treasureTableEntry(data,'dmg2014:rule:magic-item-table-f',58,dm).itemGrantAllowed,false)
    assert.equal(treasureTableEntry(data,'dmg2014:rule:magic-item-table-f',1,dm).itemGrantAllowed,true)
    assert.equal(treasureTableEntry(data,'dmg2014:rule:magic-item-table-g',48,dm).itemGrantAllowed,false)
    for(const value of [0,101,2.5,NaN])assert.throws(()=>treasureTableEntry(data,'dmg2014:rule:magic-item-table-a',value,dm))
    assert.throws(()=>treasureTableEntry(data,'dmg2014:rule:magic-item-table-g',14,dm))
    assert.throws(()=>treasureTableEntry(data,'dmg2014:rule:magic-item-table-a',1,{...dm,furtherRolls:[2]}))
    assert.throws(()=>treasureTableEntry(data,'dmg2014:rule:magic-item-table-a',1,{...dm,dmApproved:false}))
    assert.throws(()=>treasureTableEntry(data,'dmg2014:rule:magic-item-table-a',1,{...dm,edition:'2024'}))
    assert.throws(()=>treasureCoinPlan(data,'dmg2014:rule:gems-10',1,{...dm,mode:'average'}))
}

assert.ok(data.verifiedCreatures.some((e)=>e.index==='azer'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const make=(slotLevel,optionIndex,creatureIds)=>minorElementalConjurationPlan(data,{edition:'2014',dmApproved:true,slotLevel,optionIndex,creatureIds})
    assert.equal(make(4,0,['mm2014:creature:azer']).count,1)
    assert.equal(make(5,0,['mm2014:creature:gargoyle']).count,1)
    assert.equal(make(6,0,['mm2014:creature:azer','mm2014:creature:gargoyle']).count,2)
    const small=make(9,3,Array(24).fill('mm2014:creature:smoke-mephit'))
    assert.equal(small.maximumCR,.25);assert.equal(small.count,24);assert.deepEqual(small.appliedOptionalVariants,[])
    assert.throws(()=>make(4,3,Array(8).fill('mm2014:creature:dust-mephit')))
    assert.throws(()=>make(4,0,['mm2014:creature:fire-elemental']))
    assert.throws(()=>make(4,0,['mm2014:creature:giant-rat']))
    assert.throws(()=>make(6,0,['mm2014:creature:azer']))
    assert.throws(()=>make(10,0,['mm2014:creature:azer']))
    assert.throws(()=>make(4,4,['mm2014:creature:azer']))
    assert.throws(()=>make(4,0,[null]))
    for(const context of [{edition:'2024',dmApproved:true},{edition:'2014',dmApproved:false}])
        assert.throws(()=>minorElementalConjurationPlan(data,{...context,slotLevel:4,optionIndex:0,creatureIds:['mm2014:creature:azer']}))
    const gargoyle=reviewedCreature(data,'mm2014:creature:gargoyle')
    assert.equal(gargoyle.mechanics.conditionalDamageResistances[0].condition,'nonmagical-attacks-not-adamantine')
    assert.equal(reviewedCreature(data,'mm2014:creature:azer').mechanics.armorClass.shieldIncluded,true)
    assert.equal(reviewedCreature(data,'mm2014:creature:magmin').mechanics.actions[0].effect.ongoingBurn.damageSubjectInLocalPrinting,'target')
}

assert.ok(data.verifiedCreatures.some((e)=>e.index==='couatl'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const make=(slotLevel,creatureId)=>celestialConjurationPlan(data,{edition:'2014',dmApproved:true,slotLevel,creatureId:'mm2014:creature:'+creatureId})
    assert.equal(make(7,'couatl').maximumCR,4);assert.equal(make(8,'pegasus').maximumCR,4)
    assert.equal(make(9,'unicorn').maximumCR,5)
    assert.throws(()=>make(8,'unicorn'));assert.throws(()=>make(9,'empyrean'))
    assert.throws(()=>make(7,'azer'));assert.throws(()=>make(6,'couatl'));assert.throws(()=>make(7.5,'couatl'))
    assert.throws(()=>celestialConjurationPlan(data,{edition:'2024',dmApproved:true,slotLevel:7,creatureId:'mm2014:creature:couatl'}))
    assert.throws(()=>celestialConjurationPlan(data,{edition:'2014',dmApproved:false,slotLevel:7,creatureId:'mm2014:creature:couatl'}))
    assert.equal(reviewedCreature(data,'mm2014:creature:couatl').mechanics.conditionalDamageImmunities[0].condition,'nonmagical-attacks')
}

assert.ok(data.verifiedCreatures.some((e)=>e.index==='sea-hag'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const make=(slotLevel,optionIndex,creatureIds)=>woodlandConjurationPlan(data,{edition:'2014',dmApproved:true,slotLevel,optionIndex,creatureIds:creatureIds.map((i)=>'mm2014:creature:'+i)})
    assert.equal(make(4,0,['sea-hag']).maximumCR,2)
    assert.equal(make(6,1,Array(4).fill('dryad')).count,4)
    assert.equal(make(8,3,Array(24).fill('pixie')).count,24)
    assert.throws(()=>make(4,0,['faerie-dragon-red']))
    assert.throws(()=>make(4,0,['night-hag']))
    assert.throws(()=>make(4,0,['green-hag']))
    assert.throws(()=>make(4,0,['giant-rat']))
    const animals=animalConjurationPlan(data,{edition:'2014',dmApproved:true,slotLevel:9,optionIndex:3,creatureIds:Array(32).fill('mm2014:creature:giant-rat')})
    assert.equal(animals.count,32);assert.deepEqual(animals.creatures[0].mechanics.additionalCreatureTypes,['fey'])
    assert.equal(reviewedCreature(data,'mm2014:creature:giant-rat').mechanics.additionalCreatureTypes,undefined)
    assert.throws(()=>groupConjurationPlan(data,'phb2014:spell:conjure-fey',{edition:'2014',dmApproved:true,slotLevel:9,optionIndex:0,creatureIds:[]}))
    assert.throws(()=>animalConjurationPlan(data,{edition:'2014',dmApproved:true,slotLevel:3,optionIndex:0,creatureIds:['mm2014:creature:swarm-of-rats']}))
    const partial=data.reviewedEntities.find((e)=>e.index==='night-hag')
    assert.equal(partial.verification.complete,false);assert.equal(partial.mechanics.traits[0].effect.spellSaveDC,14)
    assert.equal(partial.mechanics.traits[0].effect.spellAttackBonus,6);assert.equal(partial.mechanics.actions[0].attackBonus,7)
    assert.throws(()=>reviewedCreature(data,partial.id),'Incomplete innate spell does not certify the whole creature')
    const base={edition:'2014',dmApproved:true,members:[{instanceId:'green',creatureId:'mm2014:creature:green-hag'},{instanceId:'night',creatureId:partial.id},{instanceId:'sea',creatureId:'mm2014:creature:sea-hag'}],mutualDistancesFt:[30,20,10],casterIndex:1,spellId:'phb2014:spell:eyebite',slotLevel:6,sharedSlots:[4,3,3,3,2,1,0,0,0]}
    const cast=hagCovenSpellPlan(data,base)
    assert.equal(cast.saveDC,15);assert.equal(cast.attackBonus,7);assert.equal(cast.castingAbility,'intelligence')
    assert.equal(cast.sharedSlotsAfter[5],0);assert.equal(base.sharedSlots[5],1);assert.equal(cast.slotRecoveryRequiresDMAdjudication,true)
    assert.equal(cast.wholeRuleComplete,false);assert.equal(cast.componentsRequired.includes('V'),true)
    assert.throws(()=>hagCovenSpellPlan(data,{...base,sharedSlots:cast.sharedSlotsAfter}))
    assert.throws(()=>hagCovenSpellPlan(data,{...base,mutualDistancesFt:[31,20,10]}))
    assert.throws(()=>hagCovenSpellPlan(data,{...base,members:[base.members[0],base.members[0],base.members[2]]}))
    assert.throws(()=>hagCovenSpellPlan(data,{...base,sharedSlots:[4,3,3,3,2,3,0,0,0]}))
    assert.throws(()=>hagCovenSpellPlan(data,{...base,slotLevel:7}))
    assert.throws(()=>hagCovenSpellPlan(data,{...base,spellId:'phb2014:spell:magic-missile',slotLevel:1}))
    assert.throws(()=>hagCovenSpellPlan(data,{...base,dmApproved:false}))
    assert.throws(()=>hagCovenSpellPlan(data,{...base,edition:'2024'}))
}
assert.ok(data.verifiedCreatures.some((e)=>e.index==='water-weird'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const one=(spellId,slotLevel,index,extra={})=>singleConjurationPlan(data,'phb2014:spell:'+spellId,{edition:'2014',dmApproved:true,slotLevel,creatureId:'mm2014:creature:'+index,...extra})
    assert.throws(()=>one('conjure-elemental',5,'invisible-stalker',{elementalAreaAppropriate:true}))
    assert.equal(one('conjure-elemental',6,'invisible-stalker',{elementalAreaAppropriate:true}).maximumCR,6)
    assert.equal(one('conjure-elemental',9,'galeb-duhr',{elementalAreaAppropriate:true}).maximumCR,9)
    assert.throws(()=>one('conjure-elemental',5,'salamander'))
    assert.equal(one('conjure-elemental',5,'water-weird',{elementalAreaAppropriate:true}).creature.mechanics.speedFt.walk,0)
    assert.throws(()=>one('conjure-elemental',9,'djinni',{elementalAreaAppropriate:true}))
    assert.throws(()=>one('conjure-elemental',9,'sea-hag',{elementalAreaAppropriate:true}))
    assert.equal(one('conjure-fey',6,'green-hag').maximumCR,6)
    assert.throws(()=>one('conjure-fey',6,'giant-ape'))
    const ape=one('conjure-fey',7,'giant-ape')
    assert.equal(ape.creature.mechanics.type,'fey');assert.equal(ape.sourceFormType,'beast')
    assert.equal(reviewedCreature(data,'mm2014:creature:giant-ape').mechanics.type,'beast')
    assert.throws(()=>one('conjure-fey',9,'night-hag'));assert.throws(()=>one('conjure-fey',9,'faerie-dragon-violet'))
    assert.equal(ape.effect.brokenConcentration.disappears,false)
    assert.equal(ape.effect.brokenConcentration.cannotDismiss,true)
    assert.equal(ape.effect.brokenConcentration.disappearsHoursAfterSummoning,1)
    assert.throws(()=>one('conjure-fey',10,'sea-hag'))
    assert.throws(()=>one('conjure-fey',6,'sea-hag',{edition:'2024'}))
    const salamander=reviewedCreature(data,'mm2014:creature:salamander').mechanics
    assert.equal(salamander.actions[1].rangeFt.long,60)
    assert.equal(salamander.actions[1].effect.twoHandedMeleeDamage.dice,'2d8+4')
    assert.equal(salamander.conditionalDamageResistances[0].condition,'nonmagical-attacks')
    assert.equal(minorElementalConjurationPlan(data,{edition:'2014',dmApproved:true,slotLevel:4,optionIndex:1,creatureIds:Array(2).fill('mm2014:creature:fire-snake')}).count,2)
}
assert.ok(data.verifiedCreatures.some((e)=>e.index==='ultroloth'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const by=(index)=>data.reviewedEntities.find((e)=>e.id==='mm2014:creature:'+index)
    assert.equal(by('arcanaloth').verification.complete,false)
    assert.throws(()=>reviewedCreature(data,'mm2014:creature:arcanaloth'))
    assert.equal(by('arcanaloth').mechanics.traits[0].effect.spellSaveDC,15)
    assert.equal(by('arcanaloth').mechanics.traits[4].effect.spellSaveDC,17)
    const nyca=reviewedCreature(data,'mm2014:creature:nycaloth').mechanics
    assert.equal(nyca.traits[0].effect.spellSaveDC,undefined)
    assert.equal(nyca.optionalVariants[0].effect.addsAction.successChancePercent,50)
    assert.equal(nyca.optionalVariants[0].effect.addsAction.attitude,'acts-as-it-pleases')
    assert.equal(nyca.actions[1].effect.ifTargetCreature.failureOngoingWound.eachFurtherHitOnAlreadyWoundedAdds.dice,'2d4')
    const ultro=reviewedCreature(data,'mm2014:creature:ultroloth').mechanics
    assert.equal(ultro.optionalVariants[0].effect.addsAction.attitude,'ally-of-summoner')
    assert.equal(ultro.optionalVariants[0].effect.addsAction.endsEarlier[2],'summoner-bonus-action-dismiss')
    assert.equal(ultro.actions[2].effect.effectEndsAloneGrantsImmunity,false)
    assert.equal(reviewedCreature(data,'mm2014:creature:dao').mechanics.actions[2].effect.ifTargetCreatureHugeOrSmaller.isSavingThrow,false)
    assert.equal(reviewedCreature(data,'mm2014:creature:marid').mechanics.actions[2].effect.successPushOrProne,false)
    assert.equal(reviewedCreature(data,'mm2014:creature:cambion').mechanics.armorClass.source,'scale-mail')
    assert.equal(reviewedCreature(data,'mm2014:creature:cambion').mechanics.conditionalDamageResistances[0].condition,'nonmagical-attacks')
}
assert.ok(data.verifiedCreatures.some((e)=>e.index==='solar'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const solar=reviewedCreature(data,'mm2014:creature:solar').mechanics
    assert.equal(solar.actions[2].rangeFt.normal,150)
    assert.equal(solar.actions[2].effect.ifTargetCreatureHPAtMost.hitPoints,100)
    assert.equal(solar.actions[3].effect.command.activation,'bonus-action')
    assert.deepEqual(solar.legendaryActions.map((a)=>a.effect.legendaryActionCost),[1,2,3])
    const deva=reviewedCreature(data,'mm2014:creature:deva')
    assert.equal(deva.mechanics.skillBonuses.insight,9)
    assert.equal(data.reviewedEntities.find((e)=>e.id===deva.id).editorialCorrections[0].sources[0].book,'mm-errata')
    assert.equal(reviewedCreature(data,'mm2014:creature:planetar').mechanics.traits.some((t)=>t.index==='divine-awareness'),true)
    const knight=reviewedCreature(data,'mm2014:creature:githyanki-knight').mechanics
    assert.deepEqual(knight.traits[0].effect.componentsRequired,[])
    assert.equal(knight.actions[1].effect.criticalAlternative.chooseInsteadOfDamage,'cut-silver-cord')
    assert.equal(reviewedCreature(data,'mm2014:creature:githzerai-zerth').mechanics.traits[0].effect.castingAbility,'wisdom')
    assert.deepEqual(reviewedCreature(data,'mm2014:creature:xorn').mechanics.conditionalDamageResistances[0],{types:['piercing','slashing'],condition:'nonmagical-attacks-not-adamantine'})
    const succ=reviewedCreature(data,'mm2014:creature:succubus-incubus').mechanics
    assert.equal(succ.actions[1].effect.charmingNewTarget,'ends-previous-charm')
    assert.equal(succ.actions[2].effect.successDamage,'half')
    assert.throws(()=>celestialConjurationPlan(data,{edition:'2014',dmApproved:true,slotLevel:9,creatureId:deva.id}))
    assert.equal(singleConjurationPlan(data,'phb2014:spell:conjure-elemental',{edition:'2014',dmApproved:true,slotLevel:5,creatureId:'mm2014:creature:xorn',elementalAreaAppropriate:true}).maximumCR,5)
}
assert.ok(data.verifiedCreatures.some((e)=>e.index==='gray-slaad'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const gray=reviewedCreature(data,'mm2014:creature:gray-slaad').mechanics
    assert.equal(gray.skillBonuses.perception,7);assert.equal(gray.passivePerception,17)
    assert.equal(gray.traits.some((t)=>t.index==='magic-weapons'),true)
    const green=reviewedCreature(data,'mm2014:creature:green-slaad').mechanics
    assert.equal(green.traits.some((t)=>t.index==='magic-weapons'),false)
    assert.equal(green.actions[4].effect.ignites,'flammable-objects-not-worn-or-carried')
    assert.equal(green.optionalVariants[0].effect.bornElsewhereWithoutContact,'no-control-gem')
    const red=reviewedCreature(data,'mm2014:creature:red-slaad').mechanics.actions[2].effect.ifTargetHumanoid
    const blue=reviewedCreature(data,'mm2014:creature:blue-slaad').mechanics.actions[2].effect.ifTargetHumanoid
    assert.equal(red.save.dc,14);assert.equal(red.failureDisease.birthRounds,1)
    assert.equal(blue.save.dc,15);assert.equal(blue.failureDisease.minimumSpellLevelForGreen,3)
    assert.throws(()=>animalConjurationPlan(data,{edition:'2014',dmApproved:true,slotLevel:3,optionIndex:0,creatureIds:['mm2014:creature:slaad-tadpole']}))
}
assert.equal(data.reviewedEntities.some(e=>e.id==='phb2014:rule:chases'),false,'Chases belongs to the DMG, not the PHB')
assert.ok(data.reviewedEntities.some(e=>e.id==='dmg2014:rule:chases'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const c={edition:'2014',dmApproved:true,constitutionScore:14,previousDashUses:4}
    assert.equal(chaseDashPlan(data,c).checkRequired,false)
    assert.equal(chaseDashPlan(data,{...c,previousDashUses:5}).checkRequired,true)
    assert.equal(chaseDashPlan(data,{...c,constitutionScore:1,previousDashUses:0}).checkRequired,true)
    assert.throws(()=>chaseDashPlan(data,{...c,dmApproved:false}))
    assert.throws(()=>chaseDashPlan(data,{...c,edition:'2024'}))
    assert.throws(()=>chaseDashPlan(data,{...c,previousDashUses:Infinity}))
    const q={edition:'2014',dmApproved:true,outOfLeadPursuerSight:true,stealthTotal:15,pursuerPassivePerception:[11,15]}
    assert.equal(chaseEscapePlan(data,q).escapes,false)
    assert.equal(chaseEscapePlan(data,{...q,stealthTotal:16}).escapes,true)
    assert.equal(chaseEscapePlan(data,{...q,outOfLeadPursuerSight:false,stealthTotal:30}).escapes,false)
    assert.throws(()=>chaseEscapePlan(data,{...q,pursuerPassivePerception:[]}))
    const o={edition:'2014',currentHP:50,resolvedDamage:10,damageType:'bludgeoning',damageThreshold:10,canDamageObject:true}
    assert.deepEqual(objectDamagePlan(data,o),{damage:10,currentHP:40,immune:false,belowThreshold:false})
    assert.equal(objectDamagePlan(data,{...o,resolvedDamage:9}).damage,0)
    assert.equal(objectDamagePlan(data,{...o,damageType:'poison',resolvedDamage:90}).damage,0)
    assert.equal(objectDamagePlan(data,{...o,canDamageObject:false}).damage,0)
    assert.equal(objectDamagePlan(data,{...o,resolvedDamage:100}).currentHP,0)
    assert.throws(()=>objectDamagePlan(data,{...o,damageThreshold:-1}))
    assert.throws(()=>objectDamagePlan(data,{...o,damageType:'Poison'}))
    assert.throws(()=>objectDamagePlan(data,{...o,damageType:'unknown'}))
    const points={edition:'2014',dmApproved:true,effectiveCasterLevel:17,availablePoints:107,slotLevel:9,highSlotsCreatedSinceLongRest:[]}
    assert.equal(spellPointSlotPlan(data,points).remainingPoints,94)
    assert.deepEqual(spellPointSlotPlan(data,points).highSlotsCreatedSinceLongRest,[9])
    assert.throws(()=>spellPointSlotPlan(data,{...points,highSlotsCreatedSinceLongRest:[9]}))
    assert.equal(spellPointSlotPlan(data,{...points,slotLevel:6,highSlotsCreatedSinceLongRest:[9]}).remainingPoints,98)
    assert.throws(()=>spellPointSlotPlan(data,{...points,availablePoints:12}))
    assert.throws(()=>spellPointSlotPlan(data,{...points,effectiveCasterLevel:10}))
    assert.throws(()=>spellPointSlotPlan(data,{...points,availablePoints:108}))
    assert.throws(()=>spellPointSlotPlan(data,{...points,highSlotsCreatedSinceLongRest:[9,9]}))
    assert.throws(()=>spellPointSlotPlan(data,{...points,highSlotsCreatedSinceLongRest:[5]}))
    assert.throws(()=>spellPointSlotPlan(data,{...points,edition:'2024'}))
    assert.throws(()=>spellPointSlotPlan(data,{...points,dmApproved:false}))
    assert.equal(spellPointSlotPlan(data,{...points,effectiveCasterLevel:1,availablePoints:4,slotLevel:1}).remainingPoints,2)
    assert.equal(points.availablePoints,107)
    assert.deepEqual(points.highSlotsCreatedSinceLongRest,[])
}

assert.ok(data.reviewedEntities.some(e=>e.id==='dmg2014:race:aasimar-dmg-example'), 'Required scope missing from candidate; tests must not silently skip.')
{
    const a={raceId:'dmg2014:race:aasimar-dmg-example',dmApproved:true}
    assert.deepEqual(racialAbilityBonuses(data,a),{wisdom:1,charisma:2})
    assert.throws(()=>racialAbilityBonuses(data,{...a,dmApproved:false}))
    const e={raceId:'phb2014:race:elf',subraceId:'dmg2014:subrace:eladrin-dmg-example',dmApproved:true}
    assert.deepEqual(racialAbilityBonuses(data,e),{dexterity:2,intelligence:1})
    assert.throws(()=>racialAbilityBonuses(data,{...e,dmApproved:false}))
    const r=data.reviewedEntities.find(e=>e.id===a.raceId)
    assert.equal('alignmentSuggestionIt' in r.mechanics,false)
}

const hp={edition:'2014',classId:'phb2014:class:wizard',firstCharacterLevel:false,constitutionScore:1,rolledHitDie:1}
assert.equal(levelHitPointGain(data,hp).hitPoints,1)
assert.equal(levelHitPointGain(data,{...hp,constitutionScore:14,rolledHitDie:6}).hitPoints,8)
assert.equal(levelHitPointGain(data,{...hp,rolledHitDie:undefined}).hitPoints,1)
assert.equal(levelHitPointGain(data,{...hp,firstCharacterLevel:true,rolledHitDie:undefined,constitutionScore:14}).hitPoints,8)
assert.throws(()=>levelHitPointGain(data,{...hp,rolledHitDie:7}))
assert.throws(()=>levelHitPointGain(data,{...hp,rolledHitDie:0}))
assert.throws(()=>levelHitPointGain(data,{...hp,firstCharacterLevel:true}))
assert.throws(()=>levelHitPointGain(data,{...hp,constitutionScore:NaN}))
assert.throws(()=>levelHitPointGain(data,{...hp,edition:'2024'}))
assert.throws(()=>levelHitPointGain(data,{...hp,classId:'invented'}))

const deflect=data.reviewedEntities.find(e=>e.id==='phb2014:class-feature:monk-3-deflect-missiles')
assert.ok(deflect?.verification.complete)
assert.deepEqual(deflect.mechanics.effect.returnAttack.explicitRangeFt,{normal:20,long:60})
assert.ok(deflect.sources.some(s=>s.book==='srd51-en' && s.pdfPages.includes(27)))

console.log('Verified candidate: progressions, compatibility, multiclass prerequisites, choices, resources, races, backgrounds, creatures, errata and integrity checks passed.')
