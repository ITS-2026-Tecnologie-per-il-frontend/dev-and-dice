import { inventoryEquipment, referencedInventoryItem, inventoryFieldValue } from '../src/utils/Inventory.ts'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadCandidateCreationData } from '../src/domain/dnd/VerifiedDatabase.ts'
import { activateCreationData, activeCatalog, catalogForSheet, concentrationSave } from '../src/domain/dnd/ActiveRules.ts'
import { combatAbilityInfo, combatUseOptions, spendCombatUse, resolvedAbility, resolveCombatDamage, restoreCombatHitPoints, grantCombatTemporaryHitPoints, assessAttack, requiresAdditionalSpellAction } from '../src/domain/dnd/CombatActions.ts'
import { catalogAbilityKind, parseCatalog, sheetWithCombatAbilities } from '../src/utils/Catalog.ts'
import { withWizardCatalog } from '../src/utils/PlayerCreation.ts'
import { spellEdition } from '../src/utils/Spellcasting.ts'
import { resolutionPlan, directBenefit, weaponDisplayName, weaponEffectDetails, spellEffectDetails, weaponCandidates as availableWeapons, enchantWeapon, spellAttackAbility, damageNames, conditionNames, defenseProfile, validPackets, assertPacketPlan, packetTargets, resolveTarget, activeEffects, validEffectSpecs, saveNames, validWeaponEffect } from '../src/domain/dnd/CombatResolution.ts'
import { endIncapacitatedConcentration, settleCombatEffects } from '../src/domain/dnd/CombatConditions.ts'
import { combatTargeting, creatureType, wearingArmor, assertTargetTypes } from '../src/domain/dnd/CombatTargets.ts'

const fail=(status,message)=>{throw Object.assign(new Error(message),{status})}
const object=value=>!!value && typeof value==='object' && !Array.isArray(value)
const text=(value,max=500)=>typeof value==='string' && value.length<=max
const integer=value=>Number.isSafeInteger(value) && value>=0
const uuid=value=>typeof value==='string' && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value)
const modes=['attack','save','automatic','none']
const damage=value=>text(value,20) && /^\d+$/.test(value) && integer(Number(value))
let loaded
export function combatRules() {
  if (!loaded) loaded=(async()=>{
    const root=new URL('../public/data/',import.meta.url)
    const json=async name=>JSON.parse(await readFile(new URL(name+'.json',root),'utf8'))
    const [verified,options,equipment,rules,wizard,raw]=await Promise.all([
      loadCandidateCreationData(fileURLToPath(new URL('rules2014/',root)).replace(/\/$/,''),async path=>{
        try {const content=await readFile(path,'utf8');return {ok:true,text:async()=>content}} catch(error) {if(error.code!=='ENOENT')throw error;return {ok:false}}
      }),...['character-options','character-equipment','character-rules','wizard-catalog','database'].map(json),
    ])
    const legacy=withWizardCatalog({...options,...equipment,skills:rules.skills,experienceThresholds:rules.experienceThresholds,
      legacyCatalogs:{it:{...parseCatalog(raw,'it'),language:'it'},en:{...parseCatalog(raw,'en'),language:'en'}}},wizard)
    return {data:activateCreationData(verified,legacy),catalog:activeCatalog(verified,'it')}
  })().catch(error=>{loaded=undefined;throw error})
  return loaded
}

export function recoverRepeatSaveDCs(game) {
  return game.state.abilities.map(effect=>{
    if(!effect.active||Number.isSafeInteger(effect.repeatSaveRoll?.dc)||effect.sourceEffectId===undefined)return effect
    const parent=game.state.abilities.find(a=>a.id===effect.sourceEffectId)
    if(parent?.ruleId!=='phb2014:spell:hold-person'||!effect.repeatSave)return effect
    const caster=game.state.turns.find(t=>t.id===parent.ownerId)?.sheet?.id
    const targets=parent.targets?.map(t=>t.id)??[]
    // ponytail: legacy effects lack a request ID. Recover only when every matching
    // approved cast agrees on the original DC; ambiguous history stays manual.
    const dcs=new Set((game.combatRequests??[]).filter(entry=>entry.status==='approved'&&entry.characterId===caster
      &&entry.resolution?.plan.ruleId===parent.ruleId&&entry.proposal.option===parent.useOption
      &&entry.proposal.targets.length===targets.length&&entry.proposal.targets.every(t=>targets.includes(t.id))
      &&entry.resolution.targets.some(t=>t.id===effect.ownerId)&&Number.isSafeInteger(entry.resolution.plan.save?.dc))
      .map(entry=>entry.resolution.plan.save.dc))
    if(dcs.size!==1)return effect
    return {...effect,repeatSaveRoll:{ability:'wisdom',timing:'end',...effect.repeatSaveRoll,dc:[...dcs][0]}}
  })
}

// Requests contain proposals only; canonical sheets and Master-configured actions are read again at approval.
export function actionContext(db,game,user,rules,preview=false,characterId) {
  const member=game.players.find(player=>player.userId===user)
  const record=db.characters.find(record=>record.id===(user===game.masterId?characterId:member?.characterId) && record.ownerId===user && record.gameId===game.id)
  if (!record) fail(403,'Le richieste sono riservate al giocatore del personaggio.')
  const owners=game.state.turns.filter(turn=>turn.sheet?.id===record.id)
  const blocked=owners.length===1&&activeEffects(game.state.abilities).some(a=>(a.targets?.length?a.targets.some(t=>t.id===owners[0].id):a.ownerId===owners[0].id)&&a.resolutionEffects?.some(e=>e.kind==='condition'&&['paralyzed','incapacitated','stunned','unconscious'].includes(e.condition)))
  const canPropose=!blocked&&owners.length===1 && game.state.combat?.activeId===owners[0].id
  if (!preview && !canPropose) fail(409,blocked?'Il personaggio non può agire mentre è incapacitato.':'Puoi proporre un’azione soltanto durante il tuo turno.')
  const owner=owners[0],catalog=catalogForSheet(rules.data,rules.catalog,record.sheet)
  const weaponContext={data:rules.data,active:game.state.abilities}
  const templates=sheetWithCombatAbilities(record.sheet,catalog).abilities
  const actions=templates.map((template,index)=>{
    // Player-owned sheet rows cannot grant Master-only casting/resource overrides through extra JSON keys.
    template=Object.fromEntries(['name','duration','catalogId','remainingTurns','timed','description','expiresAt','repeatSave','ruleId','concentration','spellLevel','section'].filter(key=>Object.hasOwn(template,key)).map(key=>[key,template[key]]))
    const entry=catalog.abilities.find(entry=>entry.id===template.catalogId)
    if (typeof entry?.data.level==='number') template.spellLevel=entry.data.level
    if (typeof entry?.data.referenceId==='string') template.ruleId=entry.data.referenceId
    const matches=owner?game.state.abilities.filter(ability=>ability.ownerId===owner.id &&
      (template.catalogId ? template.catalogId===ability.catalogId : template.name===ability.name)):[]
    const existing=matches.find(ability=>!!ability.execution||ability.active&&(ability.timed===false||ability.remainingTurns>0))??matches[0]
    const ability={...template,...existing,id:existing?.id ?? 0,ownerId:owner?.id ?? null,active:existing?.active ?? false,remainingTurns:existing?.remainingTurns ?? template.remainingTurns ?? 0}
    let options=[],error=''
    try {
      if (ability.execution || ability.active && ability.ruleId!=='phb2014:spell:false-life' && !ability.weaponEffects?.length && (ability.timed===false || ability.remainingTurns>0)) throw new Error('Questa abilità è già in esecuzione.')
      if (spellEdition(record.sheet)==='2024' && ability.ruleId?.includes('2014:')) throw new Error('Questa voce usa regole 2014.')
      options=combatUseOptions(record.sheet,ability,catalog,rules.data)
    } catch(cause) {error=cause.message}
    const info=combatAbilityInfo(ability,catalog),mechanics=info.entry?.data.mechanics ?? {},effect=object(mechanics.effect)?mechanics.effect:{}
    // ponytail: resolution mode is a suggestion for legacy/custom entries; the Master confirms the actual rolls and effects.
    const canonicalPlan=resolutionPlan(record.sheet,ability,catalog,undefined,weaponContext)
    const mode=canonicalPlan?.kind??(info.attack || effect.attack || String(mechanics.kind).includes('attack') ? 'attack' : effect.save || mechanics.save || mechanics.savingThrow ? 'save' : info.damage ? 'automatic' : 'none')
    const attackRow=/^sheet-attack:([0-5])$/.exec(ability.ruleId ?? '')
    const attackBonus=attackRow ? record.sheet.playerDetails?.[`attacks.${attackRow[1]}.1`] : undefined
    return {key:String(index),ability,options,error,info,mode,attackBonus,resolution:canonicalPlan}
  }).filter(action=>!action.info.passive)
  return {record,owner,catalog,actions,weaponContext,targets:game.state.turns.map(turn=>({...turn,sheet:db.characters.find(r=>r.gameId===game.id&&r.id===turn.sheet?.id)?.sheet??turn.sheet})),canPropose,blockedReason:blocked?'Il personaggio non può agire mentre è incapacitato.':undefined}
}

function castReceipt(context,game,ability) {
  const entry=(game.combatRequests??[]).findLast(entry=>entry.characterId===context.record.id
    && (entry.resolution?.plan.ruleId&&ability.ruleId?entry.resolution.plan.ruleId===ability.ruleId:entry.actionName===ability.name)
    && ['pending','approved'].includes(requestStatus(game,entry)))
  if(!entry)return undefined
  const benefit=entry.resolution?.plan.temporaryHitPoints,packet=entry.proposal.packets?.[0]
  return {id:entry.id,status:requestStatus(game,entry),createdAt:entry.createdAt,optionLabel:entry.optionLabel,packets:entry.proposal.packets,
    ...(benefit&&packet?{temporaryHitPoints:{roll:packet.temporaryHitPointsRoll,bonus:benefit.bonus,total:packet.temporaryHitPointsRoll+benefit.bonus,keptPrevious:packet.keepTemporaryHitPoints}}:{})}
}

export function actionChoices(context,game,db) {
  return {revision:game.revision,canPropose:context.canPropose,blockedReason:context.blockedReason,ownerId:context.owner?.id ?? null,actions:context.actions.map(({key,ability,options,error,info,mode,attackBonus})=>({key,attackBonus,effects:spellEffectDetails({...ability,resolutionEffects:ability.resolutionEffects??resolutionPlan(context.record.sheet,ability,context.catalog,ability.useOption,context.weaponContext)?.effects},context.targets.map(target=>({...target,name:target.sheet?.name??target.description})),game.state.abilities,context.weaponContext.data),weaponEffects:weaponEffectDetails(ability.weaponEffects??[],game.state.turns.flatMap(turn=>{const sheet=db.characters.find(record=>record.id===turn.sheet?.id)?.sheet??turn.sheet;return sheet?[sheet]:[]})),lastCast:castReceipt(context,game,ability),additionalActionRequired:requiresAdditionalSpellAction(context.record.sheet,ability,context.catalog),displayName:weaponDisplayName(resolutionPlan(context.record.sheet,ability,context.catalog,undefined,context.weaponContext),context.targets.map(caster=>({id:caster.id,name:caster.sheet?.name??caster.description}))),name:ability.name,entry:info.entry,description:ability.description ?? info.entry?.description ?? '',options:options.map(option=>({...option,targeting:combatTargeting(ability,context.catalog,context.record.sheet,option.id),resolution:resolutionPlan(context.record.sheet,ability,context.catalog,option.id,context.weaponContext)})),error,
    spellLevel:info.level,group:info.level!==undefined ? 'Incantesimi' : catalogAbilityKind(info.entry,ability.section,ability.description ?? info.entry?.description).weaponAttack ? 'Attacchi fisici' : 'Abilità attivabili',
    duration:info.instantaneous ? 'Istantanea' : ability.duration==='Personalizzata' ? `${ability.remainingTurns} turni` : ability.duration,remainingTurns:ability.remainingTurns,active:!!ability.execution || ability.active && (ability.timed===false || ability.remainingTurns>0),
    cost:ability.resourceCost ?? 1,resolution:resolutionPlan(context.record.sheet,ability,context.catalog,undefined,context.weaponContext),damageEnabled:info.damage,mode,prolonged:info.prolonged,ritual:info.ritual})),
    targets:context.targets.map(turn=>({id:turn.id,name:turn.sheet?.name??turn.description,creatureType:creatureType(turn.sheet),wearingArmor:turn.sheet?wearingArmor(turn.sheet):undefined}))}

}

export function requestProposal(body) {
  if(object(body)&&body.packets!==undefined) {
    if(!validPackets(body.packets)||body.attackDie!==undefined)fail(400,'Pacchetti di dadi non validi.')
    try {body={...body,targets:packetTargets(body.packets)}} catch(error){fail(400,error.message)}
  }
  if (!object(body) || Object.keys(body).some(key=>!['id','revision','key','option','cost','mode','damageEnabled','targets','attackDie','packets','effectChoice','reactionId'].includes(key))
    || body.reactionId!==undefined&&!uuid(body.reactionId)
    || body.effectChoice!==undefined&&typeof body.effectChoice!=='string'
    || body.attackDie!==undefined && (!Number.isInteger(body.attackDie)||body.attackDie<1||body.attackDie>20||body.mode!=='attack')
    || !uuid(body.id) || !integer(body.revision) || !text(body.key,10) || !/^\d+$/.test(body.key)
    || !text(body.option,250) || !integer(body.cost) || body.cost<1 || !modes.includes(body.mode) || typeof body.damageEnabled!=='boolean'
    || body.mode==='none' && body.damageEnabled || !Array.isArray(body.targets) || body.targets.length>1000
    || new Set(body.targets.map(target=>target?.id)).size!==body.targets.length
    || !body.targets.every(target=>object(target) && Object.keys(target).every(key=>['id','roll','hit','damageRoll','damage'].includes(key)) && integer(target.id)
      && text(target.roll) && text(target.damageRoll) && typeof target.hit==='boolean' && damage(target.damage)
      && (body.mode!=='attack' || target.roll.trim())
      && (body.damageEnabled && (body.mode!=='attack' || body.attackDie!==undefined || body.packets!==undefined || target.hit) ? target.damageRoll.trim() : target.damage==='0' && target.damageRoll===''))
    || (body.damageEnabled || body.mode==='attack' || body.mode==='save') && !body.targets.length) fail(400,'Richiesta non valida: verifica bersagli, tiri e danni (0 se non infligge danni).')
  return structuredClone(body)
}

export function validCombatRequest(entry) {
  if (!object(entry) || !uuid(entry.id) || !uuid(entry.ownerId) || !uuid(entry.characterId) || !text(entry.characterName,160) || !text(entry.actorName,24)
    || entry.reviewedRevision!==undefined&&(!integer(entry.reviewedRevision)||!entry.resolution||!Array.isArray(entry.proposal?.packets))
    || !text(entry.actionName,20000) || !text(entry.optionLabel,2000) || typeof entry.prolonged!=='boolean'
    || !text(entry.createdAt,40) || !['pending','approved','rejected'].includes(entry.status)
    || !Array.isArray(entry.targets) || entry.targets.length!==entry.proposal?.targets?.length
    || !entry.targets.every(target=>object(target) && text(target.name,20000) && (target.armorClass===undefined||Number.isSafeInteger(target.armorClass)) && damage(target.damage)
      && entry.proposal.targets.some(original=>original.id===target.id && original.roll===target.roll && original.hit===target.hit && original.damageRoll===target.damageRoll))) return false
  if (entry.proposal.attackDie!==undefined && (!object(entry.weaponAttack)||!['2014','2024'].includes(entry.weaponAttack.edition)||entry.weaponAttack.modifier!==undefined&&!Number.isSafeInteger(entry.weaponAttack.modifier))) return false
  if(entry.proposal.packets!==undefined&&!validResolutionSnapshot(entry))return false
  if(entry.reactionReviewed!==undefined&&entry.reactionReviewed!==true)return false
  if(entry.reviewedRevision!==undefined&&!entry.resolution.wind&&!directBenefit(entry.resolution.plan)&&!entry.reactionReviewed)return false
  try {requestProposal(entry.proposal);return entry.id===entry.proposal.id} catch {return false}
}

function validResolutionSnapshot(entry) {
  const snapshot=entry.resolution,p=snapshot?.plan,packets=entry.proposal.packets
  if(snapshot?.additionalActionRequired!==undefined&&typeof snapshot.additionalActionRequired!=='boolean')return false
  const strings=v=>Array.isArray(v)&&v.length<=1000&&v.every(s=>text(s,2000))
  const types=v=>Array.isArray(v)&&v.length<=14&&v.every(t=>typeof t==='string'&&Object.hasOwn(damageNames,t))
  const number=v=>v===undefined||Number.isSafeInteger(v)
  const dice=v=>v===undefined||Array.isArray(v)&&v.length<=1000&&v.every(d=>object(d)&&integer(d.id)&&text(d.label,20000)&&integer(d.sides)&&d.sides>=2&&d.sides<=100&&(d.sign===1||d.sign===-1)&&typeof d.consume==='boolean')
  const rolls=v=>object(v)&&(v.saveOutcome===undefined||typeof v.saveOutcome==='boolean')&&Object.keys(v).every(k=>['saveOutcome','save','saveSecond','attacks','saveBonuses','attackBonuses','critical'].includes(k))&&['save','saveSecond'].every(k=>v[k]===undefined||integer(v[k])&&v[k]>=1&&v[k]<=20)
    &&['attacks','saveBonuses','attackBonuses','critical'].every(k=>v[k]===undefined||object(v[k])&&Object.entries(v[k]).every(([key,n])=>/^\d+(?::[a-z\d]+)?$/.test(key)&&integer(n)))
  if(snapshot?.weaponChoices!==undefined&&(!Array.isArray(snapshot.weaponChoices)||snapshot.weaponChoices.length>1000||!snapshot.weaponChoices.every(c=>object(c)&&entry.proposal.targets.some(t=>t.id===c.targetId)&&Array.isArray(c.items)&&c.items.length<=1000&&c.items.every(i=>object(i)&&text(i.id,250)&&text(i.name,20000)&&integer(i.quantity)&&i.quantity>0))))return false
  if(p?.weaponEffect!==undefined&&!validWeaponEffect(p.weaponEffect))return false
  if(p?.temporaryHitPoints!==undefined&&(!object(p.temporaryHitPoints)||p.edition!=='2014'||p.ruleId!=='phb2014:spell:false-life'||p.kind!=='none'||p.damageTypes?.length!==0||p.maximumPackets!==1||p.temporaryHitPoints.dice!=='1d4'||!integer(p.temporaryHitPoints.bonus)||p.temporaryHitPoints.bonus<4||p.temporaryHitPoints.bonus>44||(p.temporaryHitPoints.bonus-4)%5!==0||!integer(p.temporaryHitPoints.current)))return false
  if(p?.healing!==undefined&&(!object(p.healing)||p.edition!=='2014'||p.ruleId!=='phb2014:spell:cure-wounds'||p.kind!=='none'||p.damageTypes?.length!==0||p.maximumPackets!==1||!integer(p.healing.count)||p.healing.count<1||p.healing.count>9||p.healing.sides!==8||p.healing.dice!==`${p.healing.count}d8`||!number(p.healing.modifier)||p.healing.ability!==undefined&&!Object.hasOwn(saveNames,p.healing.ability)))return false
  if(p?.deferredSave!==undefined&&(!object(p.deferredSave)||!Object.hasOwn(saveNames,p.deferredSave.ability)||!number(p.deferredSave.dc)||p.deferredSave.trigger!=='start-own-turn-in-line'||!integer(p.deferredSave.pushFt)||p.deferredSave.pushFt>1000))return false
  if(snapshot?.wind!==undefined&&(!p?.deferredSave||!validateWind(snapshot.wind)||!snapshot.wind.candidates.every(c=>number(c.profile.saveBonus)&&dice(c.profile.saveDice)&&['normal','advantage','disadvantage',undefined].includes(c.profile.saveMode)&&(c.profile.automaticSaveFailure===undefined||typeof c.profile.automaticSaveFailure==='boolean'))))return false
  if(p?.weaponEnhancements!==undefined&&(!Array.isArray(p.weaponEnhancements)||p.weaponEnhancements.length>2000||!p.weaponEnhancements.every(source=>object(source)&&text(source.name,20000)&&(source.casterId===null||integer(source.casterId)))))return false
  if(p?.attackBonusSources!==undefined&&(!Array.isArray(p.attackBonusSources)||p.attackBonusSources.length>4001||!p.attackBonusSources.every(source=>object(source)&&text(source.name,20000)&&Number.isSafeInteger(source.amount))))return false
  if(p?.damageBonusSources!==undefined&&(!object(p.damageBonusSources)||!Object.entries(p.damageBonusSources).every(([type,sources])=>types([type])&&Array.isArray(sources)&&sources.length<=4001&&sources.every(source=>object(source)&&text(source.name,20000)&&Number.isSafeInteger(source.amount)))))return false
  if(p?.weaponName!==undefined&&!text(p.weaponName,20000))return false
  if(p?.attackAbility!==undefined&&(typeof p.attackAbility!=='string'||!Object.hasOwn(saveNames,p.attackAbility)))return false
  if(p?.damageBonuses!==undefined&&(!object(p.damageBonuses)||!Object.entries(p.damageBonuses).every(([k,v])=>types([k])&&Number.isSafeInteger(v))))return false
  if(p?.damageDice!==undefined&&(!object(p.damageDice)||!Object.entries(p.damageDice).every(([k,v])=>types([k])&&text(v,1000))))return false
  if(!object(snapshot)||!object(p)||!['2014','2024'].includes(p.edition)||!modes.includes(p.kind)||!types(p.damageTypes)||!text(p.damageHint,2000)
    ||!number(p.attackBonus)||p.maximumPackets!==null&&(!integer(p.maximumPackets)||p.maximumPackets<1)||p.requiredPackets!==undefined&&(!integer(p.requiredPackets)||p.requiredPackets<1)
    ||typeof p.sharedDamage!=='boolean'||p.magical!==null&&typeof p.magical!=='boolean'||!validEffectSpecs(p.effects)||!strings(p.notes)
    ||p.effectChoices!==undefined&&!types(p.effectChoices)||p.damageTypeOverride!==undefined&&!types([p.damageTypeOverride])
    ||p.save!==undefined&&(!object(p.save)||!Object.hasOwn(saveNames,p.save.ability)||!number(p.save.dc)||!['half','none','review'].includes(p.save.onSuccess))
    ||!Array.isArray(snapshot.targets)||snapshot.targets.length!==entry.proposal.targets.length||new Set(snapshot.targets.map(t=>t?.id)).size!==snapshot.targets.length)return false
  try {
    assertPacketPlan(p,packets,null)
    return snapshot.targets.every(t=>{
      const d=t?.profile
      if(!object(t)||!entry.proposal.targets.some(v=>v.id===t.id)||t.characterId!==undefined&&!uuid(t.characterId)||!object(d)||!rolls(t.rolls)
        ||!number(d.hitPoints)||!number(d.maxHitPoints)||!number(d.armorClass)||!number(d.saveBonus)||!strings(d.notes)||!strings(d.conditionImmunities)||d.spellImmunities!==undefined&&!strings(d.spellImmunities)
        ||!['attackMode','saveMode'].every(k=>d[k]===undefined||['normal','advantage','disadvantage'].includes(d[k]))
        ||!['attackDisadvantage','grantsAttackAdvantage','automaticSaveFailure','reviewDamage','reviewAttack'].every(k=>d[k]===undefined||typeof d[k]==='boolean')||!dice(d.attackDice)||!dice(d.saveDice)
        ||!['resistances','immunities','vulnerabilities'].every(k=>Array.isArray(d[k])&&d[k].length<=1000&&d[k].every(r=>object(r)&&types([r.type])&&['always','nonmagical'].includes(r.when)&&text(r.source,20000))))return false
      if(t.effectDetails!==undefined&&(!object(t.effectDetails)||!text(t.effectDetails.targetName,20000)||!strings(t.effectDetails.description)||!number(t.effectDetails.armorClass)||!number(t.effectDetails.armorClassBefore)||!number(t.effectDetails.armorClassBonus)))return false
      resolveRequestTarget(entry,t.id)
      return true
    })
  }catch{return false}
}

export function requestStatus(game,entry) {return entry.status==='pending' && (entry.reviewedRevision??entry.proposal.revision)!==game.revision ? 'stale' : entry.status}

function windEditable(game,entry) {
  if(!entry.resolution?.wind||!entry.resolution.plan.deferredSave)return false
  if(requestStatus(game,entry)==='pending')return true
  if(entry.status!=='approved')return false
  const latest=[...(game.combatRequests??[])].reverse().find(e=>e.status==='approved'&&e.characterId===entry.characterId&&e.resolution?.plan.ruleId===entry.resolution.plan.ruleId)
  return latest?.id===entry.id&&activeEffects(game.state.abilities).some(a=>a.ruleId===entry.resolution.plan.ruleId&&game.state.turns.some(t=>t.id===a.ownerId&&t.sheet?.id===entry.characterId))
}

function windRolls(save={}) {return save.mode==='manual'?{saveOutcome:save.success}:{save:save.die,saveSecond:save.secondDie,saveBonuses:save.bonuses}}

function validateWind(wind) {
  return object(wind)&&Array.isArray(wind.candidates)&&wind.candidates.length<=1000&&wind.candidates.every(c=>object(c)&&integer(c.id)&&uuid(c.sheetId)&&text(c.name,20000)&&object(c.profile)&&Array.isArray(c.profile.resistances)&&Array.isArray(c.profile.immunities)&&Array.isArray(c.profile.vulnerabilities)&&Array.isArray(c.profile.conditionImmunities)&&Array.isArray(c.profile.notes))
    &&Array.isArray(wind.selected)&&wind.selected.length<=1000&&new Set(wind.selected).size===wind.selected.length&&wind.selected.every(id=>wind.candidates.some(c=>c.id===id))
    &&object(wind.saves)&&Object.keys(wind.saves).length<=1000&&Object.entries(wind.saves).every(([id,s])=>String(Number(id))===id&&wind.selected.includes(Number(id))&&object(s)&&Object.keys(s).every(k=>['mode','die','secondDie','bonuses','success'].includes(k))&&['dice','manual'].includes(s.mode)
      &&(s.mode==='manual'?typeof s.success==='boolean'&&s.die===undefined&&s.secondDie===undefined&&s.bonuses===undefined:s.success===undefined&&[s.die,s.secondDie].every(n=>n===undefined||integer(n)&&n>=1&&n<=20)&&(s.bonuses===undefined||object(s.bonuses)&&Object.keys(s.bonuses).length<=1000&&Object.values(s.bonuses).every(integer))))
}

function reviewWind(db,game,entry,rules,input) {
  if(!entry.resolution?.plan.deferredSave||!entry.resolution.wind)fail(400,'Questa azione non ha un’area di vento da correggere.')
  if(!object(input)||Object.keys(input).some(k=>!['selected','saves'].includes(k)))fail(400,'Bersagli e tiri salvezza non validi.')
  const context=actionContext(db,game,entry.ownerId,rules,true),action=context.actions.find(a=>a.ability.ruleId===entry.resolution.plan.ruleId)
  if(!action)fail(409,'L’incantesimo non è più disponibile.')
  const candidates=createRequestResolution(db,game,context,action,entry.proposal,rules).wind.candidates
  const wind={candidates,selected:input.selected,saves:structuredClone(input.saves)}
  if(!validateWind(wind))fail(400,'Controlla bersagli, d20 da 1 a 20 ed esiti manuali.')
  if(new Set(wind.selected.map(id=>candidates.find(c=>c.id===id).sheetId)).size!==wind.selected.length)fail(400,'La stessa scheda compare in più bersagli.')
  for(const id of wind.selected){
    const profile=candidates.find(c=>c.id===id).profile,rolls=windRolls(wind.saves[id])
    if(rolls.saveSecond!==undefined&&(!profile.saveMode||profile.saveMode==='normal'||rolls.save===undefined))fail(400,'Non è richiesto un secondo d20 per questo bersaglio.')
    for(const key of Object.keys(rolls.saveBonuses??{}))if(!profile.saveDice?.some(d=>String(d.id)===key)){
      // Previously displayed dice can expire between turns; invented dice remain invalid.
      if(!entry.resolution.wind.candidates.find(c=>c.id===id)?.profile.saveDice?.some(d=>String(d.id)===key))fail(400,'Il dado bonus inserito non appartiene agli effetti attivi del bersaglio.')
      delete rolls.saveBonuses[key]
    }
    try{resolveTarget({...entry.resolution.plan,kind:'save',save:{...entry.resolution.plan.deferredSave,onSuccess:'none'}},[{targetId:id,damage:[]}],profile,rolls)}catch(error){fail(400,error.message)}
  }
  // ponytail: keep the latest TS for each creature. A round-by-round log can be
  // added when the table needs to retain every repeated save instead of replacing it.
  return wind
}
export function visibleRequests(game,user) {
  const entries=(game.combatRequests??[]).filter(entry=>game.masterId===user || entry.ownerId===user && game.players.some(player=>player.userId===user && player.characterId===entry.characterId))
  // ponytail: like the sheet journal, persisted requests grow for one session; move both journals to paginated DB storage together.
  return [...entries].reverse().filter((entry,index)=>index<20 || requestStatus(game,entry)==='pending').map(entry=>({id:entry.id,characterId:entry.characterId,characterName:entry.characterName,actorName:entry.actorName,actionName:entry.actionName,
    createdAt:entry.createdAt,status:requestStatus(game,entry),additionalActionRequired:entry.resolution?.additionalActionRequired??false,optionLabel:entry.optionLabel,cost:entry.proposal.cost,spendsResources:!['free','cantrip','ritual'].includes(entry.proposal.option),mode:entry.proposal.mode,damageEnabled:entry.proposal.damageEnabled,prolonged:entry.prolonged,
    ...(entry.proposal.attackDie!==undefined?{attackDie:entry.proposal.attackDie}:{}),
    ...(entry.resolution?{packets:entry.proposal.packets,rollsRevision:entry.rollsRevision??0,...(game.masterId===user?{resolution:{...entry.resolution.plan,attackAbility:entry.resolution.plan.attackAbility??(entry.resolution.plan.kind==='attack'&&!entry.resolution.plan.weaponName&&!/^sheet-attack:/.test(entry.resolution.plan.ruleId??'')?spellAttackAbility(game.state?.turns.find(t=>t.sheet?.id===entry.characterId)?.sheet):undefined)},weaponChoices:entry.resolution.weaponChoices,...(entry.resolution.wind?{wind:{...entry.resolution.wind,editable:windEditable(game,entry)}}:{})}: {})}:{}),
    targets:(entry.resolution?.wind?entry.resolution.wind.selected.map(id=>{const c=entry.resolution.wind.candidates.find(c=>c.id===id);return {id,name:c.name,roll:'',damageRoll:'',damage:'0'}}):entry.targets).map(({id,name,roll,hit,damageRoll,damage,armorClass})=>{
      const base={id,name,roll,damageRoll,damage:(entry.weaponAttack||entry.resolution)&&game.masterId!==user?(entry.proposal.targets.find(target=>target.id===id)?.damage??'0'):damage}
      if(entry.resolution?.wind)return base
      if(entry.resolution){
        if(game.masterId!==user)return base
        const resolution=resolveRequestTarget(entry,id)
        if(!resolution.effectDetails&&(directBenefit(entry.resolution.plan)||entry.resolution.plan.effects.some(effect=>effect.kind==='ac'||effect.kind==='ac-base'))){
          const turn=game.state.turns.find(turn=>turn.id===id)
          resolution.effectDetails=spellEffectDetails({name:entry.actionName,ruleId:entry.resolution.plan.ruleId,targets:[{id,damage:'0',resolved:true}],resolutionEffects:entry.resolution.plan.effects},[{id,name,sheet:turn?.sheet}],game.state.abilities)[0]
        }
        return {...base,resolution}
      }
      if (!entry.weaponAttack) return {...base,hit}
      if (game.masterId!==user) return base
      return {...base,attack:assessAttack(entry.weaponAttack.edition,entry.proposal.attackDie,entry.weaponAttack.modifier,armorClass)}
    }),...(entry.resolvedAt ? {resolvedAt:entry.resolvedAt} : {})}))
}

export function prepareAction(context,proposal,rules) {
  if(context.blockedReason)fail(409,context.blockedReason)
  const action=context.actions.find(action=>action.key===proposal.key)
  if (!action || action.error) fail(409,action?.error || 'Azione non più disponibile nella scheda.')
  if (proposal.attackDie!==undefined && (!/^sheet-attack:[0-5]$/.test(action.ability.ruleId??'')||proposal.mode!=='attack'||!proposal.damageEnabled||proposal.targets.length!==1)) fail(400,'Il d20 separato richiede un attacco con arma e un bersaglio.')
  if(proposal.packets!==undefined) {
    const plan=resolutionPlan(context.record.sheet,action.ability,context.catalog,proposal.option,context.weaponContext)
    // Old previews called Gust of Wind an immediate save. Only this verified,
    // damage-free deferred save can be normalized without discarding dice.
    if(plan?.deferredSave&&proposal.mode==='save'&&!proposal.damageEnabled&&proposal.packets.every(p=>p.die===undefined&&!p.damage.length))proposal.mode=plan.kind
    if(plan?.temporaryHitPoints&&proposal.packets.some(packet=>packet.targetId!==context.owner.id))fail(400,'Vita Falsata si applica soltanto al lanciatore.')
    if(!plan||proposal.mode!==plan.kind||proposal.damageEnabled!==(plan.damageTypes.length>0))fail(400,'La risoluzione deve rispettare l’azione della scheda.')
    try {assertPacketPlan(plan,proposal.packets,combatTargeting(action.ability,context.catalog,context.record.sheet,proposal.option).maximum)}catch(error){fail(400,error.message)}
  }
  if(proposal.packets===undefined){const plan=resolutionPlan(context.record.sheet,action.ability,context.catalog,proposal.option,context.weaponContext);if(plan?.healing||plan?.temporaryHitPoints)fail(400,'Aggiorna le azioni e inserisci i dadi richiesti prima di inviare la richiesta.')}
  const option=action.options.find(option=>option.id===proposal.option)
  if (!option || option.cost!==undefined && option.cost!==proposal.cost) fail(400,'Modalità o costo non valido per questa azione.')
  try {assertTargetTypes(combatTargeting(action.ability,context.catalog,context.record.sheet,proposal.option),context.targets??[],proposal.targets.map(t=>t.id))}catch(error){fail(400,error.message)}
  // Validate resources and spell restrictions without persisting any spend during the proposal.
  const ability={...action.ability,requirementsConfirmed:true,targets:proposal.targets.map(target=>({id:target.id,damage:target.damage,resolved:false}))}
  const rage=ability.ruleId==='phb2014:class-feature:barbarian-1-rage',info=action.info
  if ((info.concentration || ability.concentration) && context.record.sheet.playerDetails?.['rules2014.raging']==='true') fail(409,'Durante l’ira non puoi mantenere concentrazione.')
  let sheet
  try {sheet=spendCombatUse(context.record.sheet,ability,context.catalog,rules.data,option.id,proposal.cost)} catch(error) {fail(409,error.message)}
  if (rage) sheet={...sheet,playerDetails:{...sheet.playerDetails,'rules2014.raging':'true','rules2014.concentration':''}}
  if (info.concentration || ability.concentration) sheet={...sheet,playerDetails:{...sheet.playerDetails,'rules2014.concentration':ability.ruleId ?? ability.catalogId ?? ability.name}}
  return {action,ability,sheet,rage,option}
}

export function applyCombatRequest(db,game,entry,rules,body) {
  if (body?.confirmed!==true) fail(400,'Il Master deve confermare requisiti, tiri, effetti e completamento del lancio.')
  const context=actionContext(db,game,entry.ownerId,rules,!!entry.proposal.reactionId,entry.proposal.reactionId?entry.characterId:undefined)
  const wind=entry.resolution?.wind?reviewWind(db,game,entry,rules,body.wind??{selected:entry.resolution.wind.selected,saves:entry.resolution.wind.saves}):undefined
  if(body.wind!==undefined&&!wind)fail(400,'Questa azione non prevede correzioni dell’area.')
  const proposal=wind?{...entry.proposal,packets:wind.selected.map(targetId=>({targetId,damage:[]})),targets:packetTargets(wind.selected.map(targetId=>({targetId,damage:[]})))}:entry.proposal
  const {action,ability,sheet,rage}=prepareAction(context,proposal,rules)
  if(requiresAdditionalSpellAction(context.record.sheet,ability,context.catalog)&&body.additionalActionConfirmed!==true)fail(409,'Conferma che il personaggio disponga di un’altra azione valida per lanciare questo incantesimo.')
  if(body.additionalActionConfirmed!==undefined&&typeof body.additionalActionConfirmed!=='boolean')fail(400,'Conferma dell’azione aggiuntiva non valida.')
  if(entry.proposal.reactionId&&action.info.unit!=='reaction')fail(409,'Questa azione non è una reazione.')
  const proposed=proposal.targets
  if(entry.reactionReviewed&&body.manualResolution!==true&&entry.resolution&&Array.isArray(body.targets))body={...body,targets:body.targets.map(target=>({...target,damage:String(resolveRequestTarget(entry,target.id).damage??target.damage)}))}
  const enchantments=entry.resolution?.plan.weaponEffect?prepareWeaponEnchantments(db,game,entry,context,rules,body.weapons,sheet):[]
  if(!entry.resolution?.plan.weaponEffect&&body.weapons!==undefined&&(!Array.isArray(body.weapons)||body.weapons.length))fail(400,'Questa azione non modifica armi.')
  if(body.manualResolution!==undefined&&typeof body.manualResolution!=='boolean'||body.effects!==undefined&&(!Array.isArray(body.effects)||new Set(body.effects).size!==body.effects.length||!body.effects.every(id=>proposed.some(t=>t.id===id))))fail(400,'Conferma degli effetti non valida.')
  if(entry.resolution&&!wind&&body.manualResolution!==true&&proposed.some(target=>resolveRequestTarget(entry,target.id).damage===null))fail(409,'Registra i dadi richiesti prima di approvare, oppure conferma una risoluzione manuale.')
  if (!Array.isArray(body.targets) || body.targets.length!==proposed.length || new Set(body.targets.map(target=>target?.id)).size!==proposed.length
    || !body.targets.every(target=>object(target) && proposed.some(original=>original.id===target.id) && damage(target.damage)
      && (entry.proposal.damageEnabled && (entry.proposal.mode!=='attack' || entry.proposal.attackDie!==undefined || entry.resolution || proposed.find(original=>original.id===target.id).hit) || target.damage==='0'))) fail(400,'Conferma i danni finali di ogni bersaglio.')
  const turns=game.state.turns.map(turn=>{
    const record=db.characters.find(record=>record.gameId===game.id && record.id===turn.sheet?.id)
    const canonical=record?.id===context.record.id ? sheet : record?.sheet
    return canonical ? {...turn,sheet:{...canonical,abilities:turn.sheet.abilities},hitPoints:canonical.hitPoints,temporaryHitPoints:canonical.playerDetails?.temporaryHitPoints ?? ''} : turn
  })
  const resolving={...ability,useOption:entry.proposal.option,damageEnabled:entry.proposal.damageEnabled,execution:{id:entry.id,phase:'resolving',option:entry.proposal.option,cost:entry.proposal.cost},targets:body.targets.map(({id,damage})=>({id,damage,resolved:true}))}
  let updated
  try {updated=resolveCombatDamage(resolving,turns,context.catalog)} catch(error) {fail(409,error.message)}
  const sheets=new Map([[sheet.id,sheet]])
  updated=updated.map(turn=>{
    if(entry.resolution?.plan.temporaryHitPoints&&proposed.some(t=>t.id===turn.id)){
      const amount=resolveRequestTarget(entry,turn.id).temporaryHitPoints
      try{if(!entry.proposal.packets[0].keepTemporaryHitPoints)turn=grantCombatTemporaryHitPoints(turn,amount,entry.id)}catch(error){fail(409,error.message)}
      const record=db.characters.find(record=>record.id===turn.sheet?.id&&record.gameId===game.id)
      if(record)sheets.set(record.id,{...turn.sheet,abilities:record.sheet.abilities})
    }
    if(entry.resolution?.plan.healing&&proposed.some(t=>t.id===turn.id)) {
      const amount=resolveRequestTarget(entry,turn.id).healing
      if(typeof amount!=='number')fail(409,'Completa i dati di guarigione prima di approvare.')
      try {turn=restoreCombatHitPoints(turn,amount)}catch(error){fail(409,error.message)}
      const record=db.characters.find(record=>record.id===turn.sheet?.id&&record.gameId===game.id)
      if(record)sheets.set(record.id,{...turn.sheet,abilities:record.sheet.abilities})
    }
    const original=turns.find(original=>original.id===turn.id),amount=Number(body.targets.find(target=>target.id===turn.id)?.damage ?? 0)
    if (amount && turn.sheet) {
      const next={...turn.sheet,hitPoints:turn.hitPoints,playerDetails:{...turn.sheet.playerDetails,temporaryHitPoints:turn.temporaryHitPoints}}
      const record=db.characters.find(record=>record.id===next.id && record.gameId===game.id)
      if (!record && next.kind==='PG') fail(409,'Personaggio non più disponibile.')
      // Catalog monsters persist in combat state; only registered characters have a separate sheet record.
      if (record) sheets.set(next.id,{...next,abilities:record.sheet.abilities})
      const concentrating=next.playerDetails['rules2014.concentration']
      return {...turn,sheet:next,...(concentrating && spellEdition(next)==='2014' ? {concentrationChecks:[...(original.concentrationChecks ?? []),...(entry.resolution&&resolveRequestTarget(entry,turn.id).damage===amount?resolveRequestTarget(entry,turn.id).packets.map(p=>p.damage).filter(n=>n>0):[amount]).map(n=>concentrationSave(rules.data.verified,n).dc)]} : {})}
    }
    return turn
  })
  for(const change of enchantments){
    const next=change.sheet
    const record=db.characters.find(r=>r.id===next.id&&r.gameId===game.id)
    if(record)sheets.set(next.id,{...(sheets.get(next.id)??next),playerDetails:{...(sheets.get(next.id)?.playerDetails??next.playerDetails),...next.playerDetails}})
    updated=updated.map(t=>t.sheet?.id===next.id?{...t,sheet:{...next,abilities:t.sheet.abilities}}:t)
  }
  // A sheet action may not yet have a combat row; never reuse its placeholder ID.
  const existing=game.state.abilities.find(item=>item.id===ability.id&&item.ownerId===context.owner.id && (ability.catalogId ? item.catalogId===ability.catalogId : item.name===ability.name))
  const keepPrevious=!!entry.resolution?.plan.temporaryHitPoints&&entry.proposal.packets[0].keepTemporaryHitPoints
  const abilities=game.state.abilities.filter(item=>keepPrevious||item!==existing).map(item=>((rage || action.info.concentration || ability.concentration) && item.ownerId===context.owner.id && (item.concentration || item.execution?.phase==='casting') || existing&&item.sourceEffectId===existing.id) ? {...item,active:false,execution:undefined,remainingTurns:0} : item)
  if (!keepPrevious&&(!action.info.instantaneous || enchantments.length)) {
    if (abilities.length>=2000) fail(409,'Limite delle abilità in combattimento raggiunto.')
    const id=existing?.id ?? Math.max(-1,...abilities.map(item=>item.id))+1
    abilities.push(resolvedAbility({...resolving,id,...(entry.resolution?.plan.temporaryHitPoints?{temporaryHitPointsSource:entry.id}:{}),...(enchantments.length?{weaponEffects:enchantments.map(c=>c.effect)}:{}),concentration:ability.concentration || action.info.concentration,...(entry.resolution?{resolutionEffects:entry.resolution.plan.effects.filter(effect=>effect.trigger==='always')}: {})},context.catalog,game.state.combat,updated))
  }
  if(entry.resolution) {
    const parent=abilities.find(a=>a.ownerId===context.owner.id&&(ability.catalogId?a.catalogId===ability.catalogId:a.name===ability.name))
    const allowed=Array.isArray(body.effects)?body.effects:undefined
    for(const target of entry.resolution.targets) {
      const result=resolveRequestTarget(entry,target.id)
      if(result.damage===null)continue
      for(const effect of result.packets.flatMap(p=>p.effects).filter(e=>e.kind==='condition'||e.kind==='speed'||e.kind==='roll-bonus'&&e.trigger!=='always')) {
        if(allowed&&!allowed.includes(target.id))continue
        const immunity=target.profile.conditionImmunities
        const conditionAliases={paralyzed:['paralyzed','paralizzato'],restrained:['restrained','trattenuto'],frightened:['frightened','spaventato'],blinded:['blinded','accecato'],poisoned:['poisoned','avvelenato'],prone:['prone','prono']}
        if(effect.condition&&conditionAliases[effect.condition]?.some(name=>immunity.includes(name)))continue
        const id=Math.max(-1,...abilities.map(a=>a.id))+1
        const child={id,name:effect.kind==='condition'?(conditionNames[effect.condition]??effect.condition)+' - '+action.ability.name:action.ability.name+' · '+(effect.kind==='speed'?'velocità −3 m':'dado ai tiri'),ownerId:target.id,active:true,duration:'Personalizzata',remainingTurns:effect.kind==='speed'?1:parent?.remainingTurns??10,timed:true,resolutionEffects:[effect],
          ...(parent?{sourceEffectId:parent.id,...(parent.ruleId==='phb2014:spell:hold-person'?{expiresAt:parent.expiresAt,expiryOwnerId:parent.expiryOwnerId,expiryRound:parent.expiryRound}:{})}:{}),...(effect.kind==='speed'?{expiresAt:'start',expiryOwnerId:context.owner.id,expiryRound:(game.state.combat?.round??1)+1}:{}),
          ...(effect.repeatSave?{repeatSave:'Tiro salvezza su '+saveNames[entry.resolution.plan.save.ability]+' a fine turno',...(entry.resolution.plan.ruleId==='phb2014:spell:hold-person'?{repeatSaveRoll:{ability:entry.resolution.plan.save.ability,dc:entry.resolution.plan.save.dc,timing:'end'}}:{})}:{})}
        abilities.push(child)
      }
    }
    for(const target of entry.resolution.targets)for(const die of [...target.profile.saveDice??[],...target.profile.attackDice??[]]) {
      if(!die.consume)continue
      const used=Number(target.rolls.saveBonuses?.[die.id]??0)>0||Object.entries(target.rolls.attackBonuses??{}).some(([key,value])=>key.endsWith(':'+die.id)&&value>0)
      const effect=abilities.find(a=>a.id===die.id)
      if(used&&effect){effect.active=false;effect.remainingTurns=0}
    }
    if(abilities.length>2000)fail(409,'Limite degli effetti in combattimento raggiunto.')
  }
  const incapacitated=endIncapacitatedConcentration(abilities,updated)
  const settled=settleCombatEffects(incapacitated.abilities,incapacitated.turns)
  for(const turn of settled.turns)if(turn.sheet&&turn.sheet!==updated.find(t=>t.id===turn.id)?.sheet)sheets.set(turn.sheet.id,turn.sheet)
  return {targets:body.targets,state:{...game.state,turns:settled.turns,abilities:settled.abilities},sheets:[...sheets.values()],...(wind?{wind}:{})}
}

function weaponCandidates(db,game,targetId,rules,effect,casterId) {
  const turn=game.state.turns.find(t=>t.id===targetId),record=db.characters.find(r=>r.id===turn?.sheet?.id&&r.gameId===game.id)
  return availableWeapons(record?.sheet??turn?.sheet,rules.data,game.state.abilities,effect,casterId)
}

function prepareWeaponEnchantments(db,game,entry,context,rules,choices,casterSheet) {
  const effect=entry.resolution.plan.weaponEffect,targets=entry.proposal.targets
  if(!Array.isArray(choices)||choices.length!==targets.length||new Set(choices.map(c=>c?.targetId)).size!==targets.length)fail(400,'Scegli l’arma da modificare per ogni bersaglio.')
  return choices.map(choice=>{
    if(!object(choice)||Object.keys(choice).some(k=>!['targetId','itemId','damageType','useCastingAbility'].includes(k))||!targets.some(t=>t.id===choice.targetId)||!weaponCandidates(db,game,choice.targetId,rules,effect,context.record.id).some(i=>i.id===choice.itemId))fail(400,'Arma non valida, già magica o non disponibile per questo incantesimo.')
    const turn=game.state.turns.find(t=>t.id===choice.targetId),record=db.characters.find(r=>r.id===turn.sheet.id&&r.gameId===game.id)
    try{return enchantWeapon(record?.id===casterSheet.id?casterSheet:record?.sheet??turn.sheet,rules.data,game.state.abilities,effect,context.record.id,choice)}catch(error){fail(400,error.message)}
  })
}

export function createRequestResolution(db,game,context,action,proposal,rules) {
  if(proposal.packets===undefined)return undefined
  const plan=resolutionPlan(context.record.sheet,action.ability,context.catalog,proposal.option,context.weaponContext)
  if(plan.effectChoices?.length&&!plan.effectChoices.includes(proposal.effectChoice))fail(400,'Scegli il tipo di protezione previsto dall’incantesimo.')
  if(!plan.effectChoices?.length&&proposal.effectChoice!==undefined)fail(400,'Questa azione non richiede una scelta di protezione.')
  if(plan.effectChoices?.length)plan.effects=plan.effects.map(e=>e.kind==='resistance'?{...e,types:[proposal.effectChoice]}:e)
  // Reuse catalog effects activated through either the player or Master interface.
  const active=game.state.abilities.map(ability=>{
    // D&D_5_Player_Original_Handbook.pdf, PDF 204 (Concentration): deferred saves follow the end of the caster's previous concentration.
    if(plan.deferredSave&&ability.ownerId===context.owner.id&&ability.concentration)return {...ability,active:false,execution:undefined,remainingTurns:0}
    if(ability.resolutionEffects)return ability
    const owner=game.state.turns.find(t=>t.id===ability.ownerId),record=db.characters.find(r=>r.id===owner?.sheet?.id&&r.gameId===game.id)
    if(!record)return ability
    const catalog=catalogForSheet(rules.data,rules.catalog,record.sheet),known=resolutionPlan(record.sheet,ability,catalog,ability.useOption)
    return known&&!known.effectChoices?.length?{...ability,resolutionEffects:known.effects.filter(e=>e.trigger==='always')}:ability
  })
  const targets=(plan.deferredSave?game.state.turns:[]).map(target=>{
    const turn=game.state.turns.find(t=>t.id===target.id),record=db.characters.find(r=>r.gameId===game.id&&r.id===turn?.sheet?.id),sheet=record?.sheet??turn?.sheet
    if(!sheet)return undefined
    const profile=defenseProfile(sheet,plan.deferredSave.ability,active,target.id,undefined,rules.data)
    return {id:target.id,name:record?.sheet.name??turn.description,sheetId:sheet.id,profile}
  }).filter(Boolean)
  return {plan,additionalActionRequired:requiresAdditionalSpellAction(context.record.sheet,action.ability,context.catalog),...(plan.deferredSave?{wind:{candidates:targets,selected:proposal.targets.map(t=>t.id),saves:{}}}:{}),...(plan.weaponEffect?{weaponChoices:proposal.targets.map(target=>({targetId:target.id,items:weaponCandidates(db,game,target.id,rules,plan.weaponEffect,context.record.id)}))}:{}),targets:proposal.targets.map(target=>{
    const turn=game.state.turns.find(t=>t.id===target.id),record=db.characters.find(r=>r.gameId===game.id&&r.id===turn?.sheet?.id),sheet=record?.sheet??turn?.sheet
    if(!sheet)fail(409,'Per risolvere i dadi serve la scheda del bersaglio.')
    const profile=defenseProfile(sheet,plan.save?.ability,active,target.id,inventoryEquipment(referencedInventoryItem(sheet,'armor'),sheet,rules.data)?.armor_category==='Heavy'?true:inventoryEquipment(referencedInventoryItem(sheet,'armor'),sheet,rules.data)?false:!inventoryFieldValue(sheet,'armor')?false:undefined,rules.data)
    const actor=defenseProfile(context.record.sheet,undefined,active,context.owner.id)
    profile.attackDice=actor.attackDice
    if(plan.kind==='attack'&&actor.reviewAttack){profile.reviewAttack=true;profile.notes.push(...actor.notes)}
    profile.attackMode=actor.attackDisadvantage&&profile.grantsAttackAdvantage?'normal':actor.attackDisadvantage?'disadvantage':profile.grantsAttackAdvantage?'advantage':'normal'
    const effectDetails=directBenefit(plan)?spellEffectDetails({...action.ability,targets:[{id:target.id,damage:'0',resolved:true}],resolutionEffects:plan.effects},[{id:target.id,name:record?.sheet.name??turn.description,sheet}],active,rules.data)[0]:undefined
    return {id:target.id,characterId:record?.id,profile,rolls:{},...(effectDetails?{effectDetails}:{})}
  })}
}

export function resolveRequestTarget(entry,id) {
  const target=entry.resolution.targets.find(t=>t.id===id)
  return {...resolveTarget(entry.resolution.plan,entry.proposal.packets.filter(p=>p.targetId===id).map(p=>({...p,damage:p.damage.map(d=>d.type==='untyped'&&entry.resolution.plan.damageTypeOverride?{...d,type:entry.resolution.plan.damageTypeOverride}:d)})),target.profile,target.rolls),...(target.effectDetails?{effectDetails:target.effectDetails}:{})}
}

export function pendingSavingThrows(db,game,user) {
  const member=game.players.find(p=>p.userId===user)
  if(!member)return []
  return (game.combatRequests??[]).filter(e=>requestStatus(game,e)==='pending'&&e.resolution).flatMap(e=>e.resolution.targets.flatMap(t=>{
    const result=resolveRequestTarget(e,t.id),base={requestId:e.id,targetId:t.id,actionName:e.actionName,revision:game.revision}
    const saves=t.characterId===member.characterId&&result.save&&!result.save.automaticFailure?
      result.save.die===undefined?[{...base,kind:'save',ability:result.save.ability,bonus:t.profile.saveBonus}]:result.save.needsSecondDie?[{...base,kind:'save-second',ability:result.save.ability,bonus:t.profile.saveBonus}]:[]:[]
    const attacks=e.ownerId===user?result.packets.flatMap((p,index)=>p.needsSecondDie?[{...base,kind:'attack',packet:index}]:[]):[]
    const bonusSaves=t.characterId===member.characterId?(result.save?.needsBonusDice??[]).map(d=>({...base,kind:'bonus-save',effectId:d.id,label:d.label,sides:d.sides,optional:d.sign===1})):[]
    const bonusAttacks=e.ownerId===user?result.packets.flatMap((p,index)=>(p.needsBonusDice??[]).map(d=>({...base,kind:'bonus-attack',packet:index,effectId:d.id,label:d.label,sides:d.sides,optional:d.sign===1}))):[]
    return [...saves,...attacks,...bonusSaves,...bonusAttacks]
  }))
}

export function recordResolutionRoll(db,game,user,entry,body,rules) {
  if(body?.kind==='wind-refresh'||body?.kind==='refresh') {
    if(game.masterId!==user)fail(403,'Solo il Master può riaprire la richiesta.')
    if(Object.keys(body).some(k=>!['revision','kind'].includes(k)))fail(400,'Aggiornamento della richiesta non valido.')
    if(entry.status!=='pending'||(body.kind==='wind-refresh'?!entry.resolution?.wind:!directBenefit(entry.resolution?.plan)))fail(409,'Puoi aggiornare soltanto un potenziamento o una richiesta di vento ancora da approvare.')
    if(requestStatus(game,entry)==='pending')return
    if(game.combatRequests.some(e=>e.id!==entry.id&&e.ownerId===entry.ownerId&&requestStatus(game,e)==='pending'))fail(409,'Il giocatore ha già un’altra azione in attesa: risolvi prima quella.')
    const context=actionContext(db,game,entry.ownerId,rules)
    if(context.record.id!==entry.characterId||!context.actions.some(a=>a.key===entry.proposal.key&&a.ability.ruleId===entry.resolution.plan.ruleId))fail(409,'La scheda o l’incantesimo sono cambiati: serve una nuova proposta del giocatore.')
    const {action}=prepareAction(context,structuredClone(entry.proposal),rules)
    const resolution=createRequestResolution(db,game,context,action,entry.proposal,rules)
    // Preserve the original proposal for idempotent player retries. Reopening
    // explicitly refreshes defenses/DC and clears saves tied to the old state.
    entry.resolution=resolution;entry.reviewedRevision=game.revision
    entry.rollsRevision=(entry.rollsRevision??0)+1;game.requestsRevision=(game.requestsRevision??0)+1
    return
  }
  if(body?.kind==='wind') {
    if(game.masterId!==user)fail(403,'Solo il Master può correggere l’area e decidere i TS.')
    if(!windEditable(game,entry))fail(409,'L’effetto non è più attivo o la richiesta è stata superata.')
    if(Object.keys(body).some(k=>!['revision','kind','wind'].includes(k)))fail(400,'Correzione dell’area non valida.')
    entry.resolution.wind=reviewWind(db,game,entry,rules,body.wind)
    entry.rollsRevision=(entry.rollsRevision??0)+1;game.requestsRevision=(game.requestsRevision??0)+1
    return
  }
  if(requestStatus(game,entry)!=='pending'||!entry.resolution)fail(409,'La richiesta non è più disponibile per questo tiro.')
  if(!object(body)||Object.keys(body).some(k=>!['revision','targetId','kind','value','packet','type','effectId'].includes(k))||!integer(body.targetId))fail(400,'Tiro non valido.')
  const target=entry.resolution.targets.find(t=>t.id===body.targetId)
  if(!target)fail(404,'Bersaglio non disponibile.')
  const master=game.masterId===user,member=game.players.find(p=>p.userId===user)
  if(!master&&(['attack','bonus-attack'].includes(body.kind)?entry.ownerId!==user:member?.characterId!==target.characterId))fail(403,'Puoi tirare soltanto per il tuo personaggio.')
  let old
  if(body.kind==='save'||body.kind==='save-second') {
    if(!entry.resolution.plan.save||!integer(body.value)||body.value<1||body.value>20)fail(400,'Inserisci il risultato di un d20 per il tiro salvezza.')
    const field=body.kind==='save'?'save':'saveSecond'
    if(field==='saveSecond'&&(!target.profile.saveMode||target.profile.saveMode==='normal'||target.rolls.save===undefined))fail(400,'Non è richiesto un secondo d20.')
    old=target.rolls[field]
    if(old===undefined)target.rolls[field]=body.value
  } else if(body.kind==='attack') {
    const packets=entry.proposal.packets.filter(p=>p.targetId===target.id)
    if(!integer(body.packet)||!packets[body.packet]||entry.resolution.plan.kind!=='attack'||!target.profile.attackMode||target.profile.attackMode==='normal'||!integer(body.value)||body.value<1||body.value>20)fail(400,'Non è richiesto questo d20 aggiuntivo.')
    old=target.rolls.attacks?.[body.packet]
    if(old===undefined)(target.rolls.attacks??={})[body.packet]=body.value
  } else if(body.kind==='bonus-save'||body.kind==='bonus-attack') {
    const attack=body.kind==='bonus-attack',dice=attack?target.profile.attackDice:target.profile.saveDice,bonus=dice?.find(d=>d.id===body.effectId)
    if(!bonus||!integer(body.value)||body.value>bonus.sides||body.value===0&&bonus.sign===-1||attack&&(!integer(body.packet)||!entry.proposal.packets.filter(p=>p.targetId===target.id)[body.packet]))fail(400,'Dado bonus non richiesto o non valido.')
    const field=attack?'attackBonuses':'saveBonuses',key=attack?`${body.packet}:${bonus.id}`:String(bonus.id)
    old=target.rolls[field]?.[key]
    if(old===undefined)(target.rolls[field]??={})[key]=body.value
  } else if(body.kind==='critical') {
    if(!master||!integer(body.value)||!integer(body.packet)||typeof body.type!=='string')fail(403,'I dadi aggiuntivi del critico sono riservati al Master.')
    const result=resolveRequestTarget(entry,target.id).packets[body.packet]
    const packet=entry.proposal.packets.filter(p=>p.targetId===target.id)[body.packet]
    if(!result?.critical||!packet.damage.some(d=>d.type===body.type||d.type==='untyped'&&entry.resolution.plan.damageTypeOverride===body.type))fail(400,'Questo colpo non richiede il dado critico indicato.')
    const key=body.packet+':'+body.type
    old=target.rolls.critical?.[key]
    if(old===undefined)(target.rolls.critical??={})[key]=body.value
  } else if(body.kind==='weapon'||body.kind==='damage-type') {
    if(!master)fail(403,'Le proprietà dell’attacco sono riservate al Master.')
    if(body.kind==='weapon') {
      if(typeof body.value!=='boolean')fail(400,'Specifica se l’arma è magica.')
      old=entry.resolution.plan.magical===null?undefined:entry.resolution.plan.magical
      if(old===undefined)entry.resolution.plan.magical=body.value
    } else {
      if(typeof body.value!=='string'||body.value==='untyped'||!Object.hasOwn(damageNames,body.value)||!entry.resolution.plan.damageTypes.includes('untyped'))fail(400,'Tipo di danno non valido.')
      old=entry.resolution.plan.damageTypeOverride
      if(old===undefined)entry.resolution.plan.damageTypeOverride=body.value
    }
  } else fail(400,'Tipo di tiro non valido.')
  if(old!==undefined&&old!==body.value)fail(409,'Il tiro è già stato registrato. Il Master può correggere la risoluzione finale.')
  if(old===undefined){entry.rollsRevision=(entry.rollsRevision??0)+1;game.requestsRevision=(game.requestsRevision??0)+1}
}
