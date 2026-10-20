import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadCandidateCreationData } from '../src/domain/dnd/VerifiedDatabase.ts'
import { activateCreationData, activeCatalog, catalogForSheet, concentrationSave } from '../src/domain/dnd/ActiveRules.ts'
import { combatAbilityInfo, combatUseOptions, spendCombatUse, resolvedAbility, resolveCombatDamage } from '../src/domain/dnd/CombatActions.ts'
import { parseCatalog, sheetWithCombatAbilities } from '../src/utils/Catalog.ts'
import { withWizardCatalog } from '../src/utils/PlayerCreation.ts'
import { spellEdition } from '../src/utils/Spellcasting.ts'

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

// Requests contain proposals only; canonical sheets and Master-configured actions are read again at approval.
export function actionContext(db,game,user,rules) {
  const member=game.players.find(player=>player.userId===user)
  const record=db.characters.find(record=>record.id===member?.characterId && record.ownerId===user && record.gameId===game.id)
  if (!record) fail(403,'Le richieste sono riservate al giocatore del personaggio.')
  const owners=game.state.turns.filter(turn=>turn.sheet?.id===record.id)
  if (owners.length!==1 || game.state.combat?.activeId!==owners[0].id) fail(409,'Puoi proporre un’azione soltanto durante il tuo turno.')
  const owner=owners[0],catalog=catalogForSheet(rules.data,rules.catalog,record.sheet)
  const templates=sheetWithCombatAbilities(record.sheet,catalog).abilities
  const actions=templates.map((template,index)=>{
    // Player-owned sheet rows cannot grant Master-only casting/resource overrides through extra JSON keys.
    template=Object.fromEntries(['name','duration','catalogId','remainingTurns','timed','description','expiresAt','repeatSave','ruleId','concentration','spellLevel'].filter(key=>Object.hasOwn(template,key)).map(key=>[key,template[key]]))
    const entry=catalog.abilities.find(entry=>entry.id===template.catalogId)
    if (typeof entry?.data.level==='number') template.spellLevel=entry.data.level
    if (typeof entry?.data.referenceId==='string') template.ruleId=entry.data.referenceId
    const existing=game.state.abilities.find(ability=>ability.ownerId===owner.id &&
      (template.catalogId ? template.catalogId===ability.catalogId : template.name===ability.name))
    const ability={...template,...existing,id:existing?.id ?? 0,ownerId:owner.id,active:existing?.active ?? false,remainingTurns:existing?.remainingTurns ?? template.remainingTurns ?? 0}
    let options=[],error=''
    try {
      if (ability.execution || ability.active && (ability.timed===false || ability.remainingTurns>0)) throw new Error('Questa abilità è già in esecuzione.')
      if (spellEdition(record.sheet)==='2024' && ability.ruleId?.includes('2014:')) throw new Error('Questa voce usa regole 2014.')
      options=combatUseOptions(record.sheet,ability,catalog,rules.data)
    } catch(cause) {error=cause.message}
    const info=combatAbilityInfo(ability,catalog),mechanics=info.entry?.data.mechanics ?? {},effect=object(mechanics.effect)?mechanics.effect:{}
    // ponytail: resolution mode is a suggestion for legacy/custom entries; the Master confirms the actual rolls and effects.
    const mode=effect.attack || String(mechanics.kind).includes('attack') ? 'attack' : effect.save || mechanics.save || mechanics.savingThrow ? 'save' : info.damage ? 'automatic' : 'none'
    return {key:String(index),ability,options,error,info,mode}
  })
  return {record,owner,catalog,actions}
}

export function actionChoices(context,game,db) {
  return {revision:game.revision,actions:context.actions.map(({key,ability,options,error,info,mode})=>({key,name:ability.name,entry:info.entry,description:ability.description ?? info.entry?.description ?? '',options,error,
    duration:info.instantaneous ? 'Istantanea' : ability.duration==='Personalizzata' ? `${ability.remainingTurns} turni` : ability.duration,remainingTurns:ability.remainingTurns,active:!!ability.execution || ability.active && (ability.timed===false || ability.remainingTurns>0),
    cost:ability.resourceCost ?? 1,damageEnabled:info.damage,mode,prolonged:info.prolonged,ritual:info.ritual})),
    targets:game.state.turns.map(turn=>({id:turn.id,name:db.characters.find(record=>record.id===turn.sheet?.id)?.sheet.name ?? turn.description}))}
}

export function requestProposal(body) {
  if (!object(body) || Object.keys(body).some(key=>!['id','revision','key','option','cost','mode','damageEnabled','targets'].includes(key))
    || !uuid(body.id) || !integer(body.revision) || !text(body.key,10) || !/^\d+$/.test(body.key)
    || !text(body.option,250) || !integer(body.cost) || body.cost<1 || !modes.includes(body.mode) || typeof body.damageEnabled!=='boolean'
    || body.mode==='none' && body.damageEnabled || !Array.isArray(body.targets) || body.targets.length>1000
    || new Set(body.targets.map(target=>target?.id)).size!==body.targets.length
    || !body.targets.every(target=>object(target) && Object.keys(target).every(key=>['id','roll','hit','damageRoll','damage'].includes(key)) && integer(target.id)
      && text(target.roll) && text(target.damageRoll) && typeof target.hit==='boolean' && damage(target.damage)
      && (body.mode!=='attack' || target.roll.trim())
      && (body.damageEnabled && (body.mode!=='attack' || target.hit) ? target.damageRoll.trim() : target.damage==='0' && target.damageRoll===''))
    || (body.damageEnabled || body.mode==='attack' || body.mode==='save') && !body.targets.length) fail(400,'Richiesta non valida: verifica bersagli, tiri e danni (0 se non infligge danni).')
  return structuredClone(body)
}

export function validCombatRequest(entry) {
  if (!object(entry) || !uuid(entry.id) || !uuid(entry.ownerId) || !uuid(entry.characterId) || !text(entry.characterName,160) || !text(entry.actorName,24)
    || !text(entry.actionName,20000) || !text(entry.optionLabel,2000) || typeof entry.prolonged!=='boolean'
    || !text(entry.createdAt,40) || !['pending','approved','rejected'].includes(entry.status)
    || !Array.isArray(entry.targets) || entry.targets.length!==entry.proposal?.targets?.length
    || !entry.targets.every(target=>object(target) && text(target.name,20000) && damage(target.damage)
      && entry.proposal.targets.some(original=>original.id===target.id && original.roll===target.roll && original.hit===target.hit && original.damageRoll===target.damageRoll))) return false
  try {requestProposal(entry.proposal);return entry.id===entry.proposal.id} catch {return false}
}

export function requestStatus(game,entry) {return entry.status==='pending' && entry.proposal.revision!==game.revision ? 'stale' : entry.status}
export function visibleRequests(game,user) {
  const entries=(game.combatRequests??[]).filter(entry=>game.masterId===user || entry.ownerId===user && game.players.some(player=>player.userId===user && player.characterId===entry.characterId))
  // ponytail: like the sheet journal, persisted requests grow for one session; move both journals to paginated DB storage together.
  return [...entries].reverse().filter((entry,index)=>index<20 || requestStatus(game,entry)==='pending').map(entry=>({id:entry.id,characterName:entry.characterName,actorName:entry.actorName,actionName:entry.actionName,
    createdAt:entry.createdAt,status:requestStatus(game,entry),optionLabel:entry.optionLabel,cost:entry.proposal.cost,spendsResources:!['free','cantrip','ritual'].includes(entry.proposal.option),mode:entry.proposal.mode,damageEnabled:entry.proposal.damageEnabled,prolonged:entry.prolonged,
    targets:entry.targets.map(({id,name,roll,hit,damageRoll,damage})=>({id,name,roll,hit,damageRoll,damage})),...(entry.resolvedAt ? {resolvedAt:entry.resolvedAt} : {})}))
}

export function prepareAction(context,proposal,rules) {
  const action=context.actions.find(action=>action.key===proposal.key)
  if (!action || action.error) fail(409,action?.error || 'Azione non più disponibile nella scheda.')
  const option=action.options.find(option=>option.id===proposal.option)
  if (!option || option.cost!==undefined && option.cost!==proposal.cost) fail(400,'Modalità o costo non valido per questa azione.')
  // Validate resources and spell restrictions without persisting any spend during the proposal.
  const ability={...action.ability,requirementsConfirmed:true}
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
  const context=actionContext(db,game,entry.ownerId,rules)
  const {action,ability,sheet,rage}=prepareAction(context,entry.proposal,rules)
  const proposed=entry.proposal.targets
  if (!Array.isArray(body.targets) || body.targets.length!==proposed.length || new Set(body.targets.map(target=>target?.id)).size!==proposed.length
    || !body.targets.every(target=>object(target) && proposed.some(original=>original.id===target.id) && damage(target.damage)
      && (entry.proposal.damageEnabled && (entry.proposal.mode!=='attack' || proposed.find(original=>original.id===target.id).hit) || target.damage==='0'))) fail(400,'Conferma i danni finali di ogni bersaglio.')
  const turns=game.state.turns.map(turn=>{
    const record=db.characters.find(record=>record.gameId===game.id && record.id===turn.sheet?.id)
    const canonical=record?.id===context.record.id ? sheet : record?.sheet
    return canonical ? {...turn,sheet:{...canonical,abilities:turn.sheet.abilities},hitPoints:canonical.hitPoints,temporaryHitPoints:canonical.playerDetails?.temporaryHitPoints ?? ''} : turn
  })
  const resolving={...ability,damageEnabled:entry.proposal.damageEnabled,execution:{id:entry.id,phase:'resolving',option:entry.proposal.option,cost:entry.proposal.cost},targets:body.targets.map(({id,damage})=>({id,damage,resolved:true}))}
  let updated
  try {updated=resolveCombatDamage(resolving,turns)} catch(error) {fail(409,error.message)}
  const sheets=new Map([[sheet.id,sheet]])
  updated=updated.map(turn=>{
    const original=turns.find(original=>original.id===turn.id),amount=Number(body.targets.find(target=>target.id===turn.id)?.damage ?? 0)
    if (amount && turn.sheet) {
      const next={...turn.sheet,hitPoints:turn.hitPoints,playerDetails:{...turn.sheet.playerDetails,temporaryHitPoints:turn.temporaryHitPoints}}
      sheets.set(next.id,{...next,abilities:db.characters.find(record=>record.id===next.id)?.sheet.abilities ?? next.abilities})
      const concentrating=next.playerDetails['rules2014.concentration']
      return {...turn,sheet:next,...(concentrating && spellEdition(next)==='2014' ? {concentrationChecks:[...(original.concentrationChecks ?? []),concentrationSave(rules.data.verified,amount).dc]} : {})}
    }
    return turn
  })
  // A sheet action may not yet have a combat row; never reuse its placeholder ID.
  const existing=game.state.abilities.find(item=>item.ownerId===context.owner.id && (ability.catalogId ? item.catalogId===ability.catalogId : item.name===ability.name))
  const abilities=game.state.abilities.filter(item=>item!==existing).map(item=>(rage || action.info.concentration || ability.concentration) && item.ownerId===context.owner.id && (item.concentration || item.execution?.phase==='casting') ? {...item,active:false,execution:undefined,remainingTurns:0} : item)
  if (!action.info.instantaneous) {
    if (abilities.length>=2000) fail(409,'Limite delle abilità in combattimento raggiunto.')
    const id=existing?.id ?? Math.max(-1,...abilities.map(item=>item.id))+1
    abilities.push(resolvedAbility({...resolving,id,concentration:ability.concentration || action.info.concentration},context.catalog,game.state.combat,updated))
  }
  return {state:{...game.state,turns:updated,abilities},sheets:[...sheets.values()]}
}
