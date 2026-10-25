import {recordTurnAction,turnActionCapacity,turnActionUses} from '../src/domain/dnd/TurnEconomy.ts'
import {actionContext,validCombatRequest} from './combat-requests.mjs'
import {validReadyCommand} from '../src/domain/dnd/Readied.ts'
import {activeEffects} from '../src/domain/dnd/CombatResolution.ts'
import {spendCombatUse,resolvedAbility} from '../src/domain/dnd/CombatActions.ts'
import {isIncapacitated,settleCombatEffects} from '../src/domain/dnd/CombatConditions.ts'
import {sleepCandidates,sleepAllocation,sleepDice,validSleepRoll,sleepingTargets,wakeSleep} from '../src/domain/dnd/Sleep.ts'
import {spellEdition} from '../src/utils/Spellcasting.ts'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
// PHB 2014 PDF 194 (Ready), 204 (Concentration), 277 (Sleep).
const sleepId='phb2014:spell:sleep'
function actorContext(db,game,actorId,user,rules){
 const turn=game.state.turns.find(t=>t.id===actorId),record=db.characters.find(r=>r.id===turn?.sheet?.id&&r.gameId===game.id)
 if(!record||user!==game.masterId&&record.ownerId!==user)fail('Personaggio non disponibile.',403)
 if(game.state.turns.filter(t=>t.sheet?.id===record.id).length!==1)fail('La scheda compare più volte nel combattimento.')
 return {turn,record,context:actionContext(db,game,record.ownerId,rules,true,record.id)}
}
// ponytail: derive choices from the bounded encounter; cache/index by actor for large battles.
export function readyChoices(db,game,user,rules){
 const active=activeEffects(settleCombatEffects(game.state.abilities,game.state.turns,game.state.combat).abilities)
 return {revision:game.revision,actors:game.state.turns.flatMap(turn=>{
  const record=db.characters.find(r=>r.id===turn.sheet?.id&&r.gameId===game.id)
  if(!record||user!==game.masterId&&(record.ownerId!==user||!game.players.some(p=>p.userId===user&&p.characterId===record.id))||spellEdition(record.sheet)!=='2014')return []
  const {context}=actorContext(db,game,turn.id,user,rules),sleep=context.actions.find(a=>a.ability.ruleId===sleepId)
  const prepareBlockedReason=context.canPropose?undefined:context.blockedReason??(game.state.combat?`È il turno di ${game.state.turns.find(t=>t.id===game.state.combat.activeId)?.description??'un’altra creatura'}. Puoi preparare l’azione quando inizia il turno di ${record.sheet.name}.`:'Il Master deve avviare il combattimento prima di preparare un’azione.')
  return [{id:turn.id,name:record.sheet.name,canPrepare:!!game.state.combat&&context.canPropose,prepareBlockedReason,additionalActionRequired:actionUsed(record.sheet),canReact:!!game.state.combat&&!isIncapacitated(active,turn.id)&&turnActionUses(record.sheet,'reaction')<turnActionCapacity(record.sheet,active,turn.id,'reaction'),options:sleep?.options.filter(o=>/^slot:[1-9]$/.test(o.id))??[],targets:game.state.turns.map(t=>({id:t.id,name:t.description})),sleepers:sleepingTargets(active).filter(id=>id!==turn.id),held:active.filter(a=>a.ownerId===turn.id&&a.readied).map(a=>({id:a.id,name:a.name,readied:a.readied,option:a.useOption,targetName:game.state.turns.find(t=>t.id===a.readied.targetId)?.description})),...(user===game.masterId?{candidates:sleepCandidates(game.state.turns,active,rules.data).map((t,i)=>({...t,name:game.state.turns[i].description}))}:{})}]
 })}
}
function actionUsed(sheet){
 const history=JSON.parse(sheet.playerDetails?.['rules2014.spellsThisTurn']??sheet.playerDetails?.['combat.spellsThisTurn']??'[]')
 if(!Array.isArray(history))fail('Cronologia delle azioni non valida.')
 return sheet.playerDetails?.['combat.actionUsed']==='true'||history.some(c=>c.unit==='action')
}
export function readyEntry(db,game,user,actorName,id,command,rules){
 if(!validReadyCommand(command))fail('Azione preparata non valida.',400)
 const {turn,record,context}=actorContext(db,game,command.actorId,user,rules)
 const held=activeEffects(game.state.abilities).find(a=>a.id===command.effectId&&a.ownerId===turn.id&&a.readied)
 const releaseSleep=command.kind==='release'&&held?.readied.kind==='sleep'
 const wakeTarget=command.targetId??held?.readied.targetId
 const area=command.kind==='cancel'?[]:releaseSleep?command.area??[]:command.kind==='prepare-wake'||held?.readied.kind==='wake'?wakeTarget===undefined?[]:[wakeTarget]:[]
 if(!area.every(id=>game.state.turns.some(t=>t.id===id)))fail('Bersaglio non disponibile.',400)
 const targets=area.map(id=>({id,roll:'',hit:false,damageRoll:'',damage:'0'}))
 const entry={id,ownerId:record.ownerId,characterId:record.id,characterName:record.sheet.name,actorName,actionName:command.kind==='prepare-sleep'?'Prepara Sonno':command.kind==='prepare-wake'?'Prepara risveglio':command.kind==='cancel'?'Abbandona azione preparata':releaseSleep?'Sonno · rilascio':'Risveglio · reazione',optionLabel:command.kind==='prepare-sleep'?context.actions.find(a=>a.ability.ruleId===sleepId)?.options.find(o=>o.id===command.option)?.label??'Slot incantesimo':command.kind==='release'?'Reazione · nessun altro slot':'Azione',createdAt:new Date().toISOString(),status:'pending',prolonged:false,proposal:{id,revision:game.revision,key:'0',option:command.kind==='prepare-sleep'?command.option:'free',cost:1,mode:'none',damageEnabled:false,targets,readyCommand:command,...(releaseSleep?{sleepRoll:command.sleepRoll}:{})},targets:targets.map(t=>({...t,name:game.state.turns.find(p=>p.id===t.id).description}))}
 if(releaseSleep)entry.sleepReview={candidates:sleepCandidates(game.state.turns,game.state.abilities,rules.data).map((t,i)=>({...t,name:game.state.turns[i].description})),area,selected:sleepAllocation(sleepCandidates(game.state.turns,game.state.abilities,rules.data),area,command.sleepRoll).selected}
 if(!validCombatRequest(entry))fail('Richiesta di azione preparata non valida.',400)
 // Validate without spending or applying anything when the player merely proposes.
 applyReadyCommand(db,game,entry,rules,{additionalActionConfirmed:true},true)
 return entry
}
export function applyReadyCommand(db,game,entry,rules,body={},preview=false){
 if(!body||typeof body!=='object'||Array.isArray(body))fail('Decisione non valida.',400)
 if(body.additionalActionConfirmed!==undefined&&typeof body.additionalActionConfirmed!=='boolean')fail('Conferma dell’azione aggiuntiva non valida.',400)
 const c=entry.proposal.readyCommand
 if(!validReadyCommand(c))fail('Azione preparata non valida.',400)
 const {turn,record,context}=actorContext(db,game,c.actorId,entry.ownerId,rules),combat=game.state.combat
 if(spellEdition(record.sheet)!=='2014'||!combat&&c.kind!=='cancel')fail('Le azioni preparate richiedono un combattimento 2014.')
 let abilities=settleCombatEffects(game.state.abilities,game.state.turns,combat).abilities,sheet=record.sheet,sleepReview
 const held=activeEffects(abilities).find(a=>a.id===c.effectId&&a.ownerId===turn.id&&a.readied)
 const close=a=>({...a,active:false,remainingTurns:0})
 const finish=()=>{
  const updated=game.state.turns.map(t=>t.id===turn.id?{...t,sheet:{...sheet,abilities:t.sheet.abilities}}:t)
  const settled=settleCombatEffects(abilities,updated,combat)
  return {state:{...game.state,...settled},sheets:settled.turns.filter(t=>t.sheet&&t.sheet!==game.state.turns.find(old=>old.id===t.id)?.sheet).map(t=>t.sheet),...(sleepReview?{sleepReview}:{}),targets:entry.targets.map(t=>({id:t.id,damage:'0'}))}
 }
 if(c.kind==='cancel'){
  if(!held)fail('L’azione preparata non è più disponibile.')
  abilities=abilities.map(a=>a.id===held.id?close(a):a)
  if(held.concentration)sheet={...sheet,playerDetails:{...sheet.playerDetails,'rules2014.concentration':''}}
  return finish()
 }
 if(isIncapacitated(abilities,turn.id))fail('Chi è incapacitato non può preparare o usare reazioni.')
 if(c.kind.startsWith('prepare-')){
  if(combat.activeId!==turn.id)fail('Prepara l’azione nel turno del personaggio.')
  if(actionUsed(sheet)&&!preview&&body.additionalActionConfirmed!==true)fail('Conferma un’altra azione valida per preparare questa azione.')
  let template={name:'Risveglio preparato',ruleId:'phb2014:readied:wake'},concentration=false
  if(c.kind==='prepare-sleep'){
   const action=context.actions.find(a=>a.ability.ruleId===sleepId)
   if(!action||action.error)fail(action?.error??'Sonno non è disponibile.')
   template={...action.ability,name:'Sonno preparato',ruleId:'phb2014:readied:sleep'}
   // The spell is cast now: its slot, components and spell-per-turn restrictions apply now.
   sheet=spendCombatUse(sheet,{...action.ability,requirementsConfirmed:true,targets:[]},context.catalog,rules.data,c.option,1)
   concentration=true
   abilities=abilities.map(a=>a.ownerId===turn.id&&(a.concentration||a.execution?.phase==='casting')?{...close(a),execution:undefined}:a)
  }else if(c.targetId!==undefined&&(c.targetId===turn.id||!game.state.turns.some(t=>t.id===c.targetId)))fail('Scegli un’altra creatura presente nel combattimento.')
  if(abilities.length>=2000)fail('Limite degli effetti raggiunto.')
  const id=Math.max(-1,...abilities.map(a=>a.id))+1
  abilities.push({...template,id,ownerId:turn.id,active:true,execution:undefined,targets:[],resolutionEffects:[],duration:'Personalizzata',remainingTurns:1,timed:true,concentration,useOption:c.option??'free',expiresAt:'start',expiryOwnerId:turn.id,expiryRound:combat.round+1,readied:{kind:concentration?'sleep':'wake',trigger:c.trigger.trim(),...(!concentration&&c.targetId!==undefined?{targetId:c.targetId}:{})}})
  if(!concentration)sheet=recordTurnAction(sheet,'action')
  sheet={...sheet,playerDetails:{...sheet.playerDetails,'combat.actionUsed':'true',...(concentration?{'rules2014.concentration':'phb2014:readied:sleep'}:{})}}
  return finish()
 }
 if(!held)fail('L’azione preparata è scaduta o è stata interrotta.')
 if(turnActionUses(sheet,'reaction')>=turnActionCapacity(sheet,abilities,turn.id,'reaction'))fail('Hai già usato la reazione.')
 if(held.readied.kind==='sleep'){
  if(c.targetId!==undefined)fail('Sonno richiede la selezione dell’area, non un bersaglio di risveglio.',400)
  if(sheet.playerDetails?.['rules2014.concentration']!=='phb2014:readied:sleep'||!held.concentration)fail('La concentrazione su Sonno preparato è terminata.')
  const dice=sleepDice(held.useOption??'')
  if(!validSleepRoll(c.sleepRoll,dice)||!Array.isArray(c.area)||!c.area.every(id=>game.state.turns.some(t=>t.id===id)))fail('Inserisci totale dei d8 e creature nell’area.',400)
  const candidates=sleepCandidates(game.state.turns,abilities,rules.data).map((t,i)=>({...t,name:game.state.turns[i].description})),area=body.sleepArea??c.area,immuneIds=body.sleepImmune??[]
  if(!Array.isArray(area)||new Set(area).size!==area.length||!area.every(id=>candidates.some(t=>t.id===id))||!Array.isArray(immuneIds)||new Set(immuneIds).size!==immuneIds.length||!immuneIds.every(id=>candidates.some(t=>t.id===id)))fail('Area o immunità non valide.',400)
  const effective=candidates.map(t=>immuneIds.includes(t.id)?{...t,unavailableReason:'Immune a Sonno (conferma del Master).'}:t)
  if(!preview&&effective.some(t=>area.includes(t.id)&&t.hitPoints===undefined&&!t.unavailableReason))fail('Completa i PF delle creature nell’area.')
  const selected=sleepAllocation(effective,area,c.sleepRoll,body.sleepTargets??[]).selected
  if(body.sleepTargets!==undefined&&(!Array.isArray(body.sleepTargets)||new Set(body.sleepTargets).size!==body.sleepTargets.length||body.sleepTargets.length!==selected.length||body.sleepTargets.some(id=>!selected.includes(id))))fail('Conferma chi si addormenta, dai PF più bassi.')
  sleepReview={candidates:effective,area,selected,immuneIds}
  if(!preview&&selected.length){
   if(abilities.length>=2000)fail('Limite degli effetti raggiunto.')
   const original=context.actions.find(a=>a.ability.ruleId===sleepId)?.ability
   if(!original)fail('La definizione di Sonno non è disponibile.')
   abilities.push({...resolvedAbility({...original,id:Math.max(-1,...abilities.map(a=>a.id))+1,ownerId:turn.id,active:false,execution:undefined,readied:undefined,resolutionEffects:undefined,concentration:false,useOption:held.useOption,targets:selected.map(id=>({id,damage:'0',resolved:true}))},context.catalog,combat,game.state.turns),expiryOwnerId:combat.activeId,expiryRound:combat.round+10})
  }
 }else{
  if(c.area!==undefined||c.sleepRoll!==undefined)fail('Il risveglio non richiede dadi.',400)
  const targetId=c.targetId??held.readied.targetId
  if(held.readied.targetId!==undefined&&targetId!==held.readied.targetId)fail('Il risveglio è stato preparato per un’altra creatura.')
  if(targetId===undefined)fail('Scegli la creatura da svegliare quando usi la reazione.',400)
  if(targetId===turn.id||!game.state.turns.some(t=>t.id===targetId)||!sleepingTargets(abilities).includes(targetId))fail('Il bersaglio non è più addormentato o non è disponibile.')
  abilities=wakeSleep(abilities,[targetId])
 }
 abilities=abilities.map(a=>a.id===held.id?close(a):a)
 sheet=recordTurnAction(sheet,'reaction')
 sheet={...sheet,playerDetails:{...sheet.playerDetails,'combat.reactionUsed':'true',...(held.concentration?{'rules2014.concentration':''}:{})}}
 return finish()
}
