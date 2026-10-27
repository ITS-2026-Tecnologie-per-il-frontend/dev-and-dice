import {counterspellId,counterspellModifier,resolveCounterspell,validCounterspellIntent} from '../src/domain/dnd/Counterspell.ts'
import {actionContext,requestStatus,requestProposal,prepareAction} from './combat-requests.mjs'
import {spendCombatUse} from '../src/domain/dnd/CombatActions.ts'
import {isIncapacitated} from '../src/domain/dnd/CombatConditions.ts'
import {turnActionCapacity,turnActionUses} from '../src/domain/dnd/TurnEconomy.ts'
import {spellEdition} from '../src/utils/Spellcasting.ts'
import {reactionWindow} from './reactions.mjs'
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})}
const slotLevel=id=>/^slot:[3-9]$/.test(id??'')?Number(id.slice(5)):undefined
function actorContext(db,game,user,actorId,rules){
 const turn=game.state.turns.find(t=>t.id===actorId),record=db.characters.find(r=>r.id===turn?.sheet?.id&&r.gameId===game.id)
 if(!record||user!==game.masterId&&(record.ownerId!==user||!game.players.some(p=>p.userId===user&&p.characterId===record.id)))fail(403,'Personaggio non disponibile.')
 if(spellEdition(record.sheet)!=='2014')fail(409,'Questo form di Controincantesimo usa le regole 2014.')
 const context=actionContext(db,game,record.ownerId,rules,true,record.id,{unit:'reaction'}),action=context.actions.find(a=>a.ability.ruleId===counterspellId)
 if(!action)fail(409,'Controincantesimo non disponibile nella scheda.')
 if(context.owner?.id!==actorId)fail(409,'La scheda deve comparire una sola volta nel combattimento.')
 return {context,action,record,turn}
}
function levelOf(action,option){return /^slot:[1-9]$/.test(option??'')?Number(option.slice(5)):action.info.level}
export function counterspellTargets(db,game,actorId,rules){
 const targets=[]
 for(const entry of game.combatRequests??[]){
  if(entry.status!=='pending'||requestStatus(game,entry)!=='pending'||entry.proposal.readyCommand||entry.proposal.windDirection!==undefined)continue
  const caster=game.state.turns.find(t=>t.sheet?.id===entry.characterId)
  if(!caster||caster.id===actorId)continue
  try{
   const context=actionContext(db,game,entry.ownerId,rules,true,entry.characterId,{keys:new Set([entry.proposal.key])}),action=context.actions.find(a=>a.key===entry.proposal.key)
   if(action?.info.level===undefined)continue
   targets.push({key:'request:'+entry.id,actorId:caster.id,casterName:caster.description,name:entry.actionName,level:levelOf(action,entry.proposal.option),requestId:entry.id})
  }catch{continue}
 }
 for(const ability of game.state.abilities){
  if(ability.ownerId===actorId||ability.execution?.phase!=='casting')continue
  const caster=game.state.turns.find(t=>t.id===ability.ownerId),record=db.characters.find(r=>r.id===caster?.sheet?.id&&r.gameId===game.id)
  if(!caster||!record)continue
  try{
   const context=actionContext(db,game,record.ownerId,rules,true,record.id),action=context.actions.find(a=>a.ability.ruleId===ability.ruleId||a.ability.catalogId===ability.catalogId)
   if(action?.info.level===undefined)continue
   targets.push({key:'ability:'+ability.id,actorId:caster.id,casterName:caster.description,name:ability.name,level:levelOf(action,ability.execution.option),abilityId:ability.id})
  }catch{continue}
 }
 for(const caster of game.state.turns)if(caster.id!==actorId&&!targets.some(t=>t.actorId===caster.id))targets.push({key:'manual:'+caster.id,actorId:caster.id,casterName:caster.description})
 return targets
}
export function counterspellChoices(db,game,user,actorId,rules,reactionId,ignoreId){
 const {action,record,turn}=actorContext(db,game,user,actorId,rules)
 const window=reactionId?reactionWindow(game,user,reactionId):undefined
 if(window&&(window.characterId!==record.id||!window.actionKeys.includes(action.key)))fail(403,'Controincantesimo non previsto da questa reazione.')
 const pending=game.combatRequests?.some(e=>e.id!==ignoreId&&e.characterId===record.id&&requestStatus(game,e)==='pending'&&(!!e.proposal.counterspell||!!e.proposal.reactionId))
 const blockedReason=!game.state.combat?'Avvia il combattimento prima di usare una reazione.':isIncapacitated(game.state.abilities,actorId)?'Il personaggio non pu\u00f2 agire mentre \u00e8 incapacitato.':turnActionUses(record.sheet,'reaction')>=turnActionCapacity(record.sheet,game.state.abilities,actorId,'reaction')?'Hai gi\u00e0 usato la reazione: si recupera all\u2019inizio del tuo prossimo turno.':pending?'Hai gi\u00e0 una reazione in attesa del Master.':action.error||undefined
 const targets=counterspellTargets(db,game,turn.id,rules).filter(t=>(window?.event.actorId===undefined||t.actorId===window.event.actorId)&&(!window?.event.requestId||t.requestId===window.event.requestId))
 return {revision:game.revision,ownerId:actorId,blockedReason,modifier:counterspellModifier(record.sheet,rules.data),options:action.options.filter(o=>slotLevel(o.id)),targets:targets.map(t=>user===game.masterId?t:{key:t.key,actorId:t.actorId,casterName:t.casterName})}
}
export function createCounterspellEntry(db,game,user,actorName,body,rules){
 const {id,revision,actorId,targetKey,option,requirementsConfirmed,reactionId}=body??{}
 if(!validCounterspellIntent({actorId,targetKey,requirementsConfirmed})||!/^slot:[3-9]$/.test(option??''))fail(400,'Conferma lanciatore, lancio da interrompere, slot e requisiti.')
 const {context,action,record}=actorContext(db,game,user,actorId,rules),choices=counterspellChoices(db,game,user,actorId,rules,reactionId,id)
 if(choices.blockedReason)fail(409,choices.blockedReason)
 const window=reactionId?reactionWindow(game,user,reactionId):undefined
 const target=counterspellTargets(db,game,actorId,rules).find(t=>t.key===targetKey)
 if(!target||window?.event.actorId!==undefined&&window.event.actorId!==target.actorId||window?.event.requestId&&target.requestId!==window.event.requestId)fail(409,'Il lancio da interrompere non \u00e8 pi\u00f9 disponibile per questa reazione.')
 if(window?.event.kind!=='spell'&&window?.event.kind!=='other'&&window)fail(409,'Controincantesimo richiede una creatura che sta lanciando un incantesimo.')
 const resource=action.options.find(o=>o.id===option)
 if(!resource)fail(400,'Slot non disponibile per Controincantesimo.')
 try{spendCombatUse(record.sheet,{...action.ability,requirementsConfirmed:true,targets:[]},context.catalog,rules.data,option,1,{abilities:game.state.abilities,ownerId:actorId,combat:game.state.combat})}catch(e){fail(409,e.message)}
 const proposal=requestProposal({id,revision,key:action.key,option,cost:1,mode:'none',damageEnabled:false,targets:[{id:target.actorId,roll:'',hit:false,damageRoll:'',damage:'0'}],counterspell:{actorId,targetKey,requirementsConfirmed},...(reactionId?{reactionId}:{})})
 return {id,ownerId:record.ownerId,characterId:record.id,characterName:record.sheet.name,actorName,actionName:action.ability.name,optionLabel:resource.label,prolonged:false,createdAt:new Date().toISOString(),status:'pending',proposal,targets:[{...proposal.targets[0],name:target.casterName}],counterspell:{edition:'2014',actorId,target,slotLevel:slotLevel(option),modifier:choices.modifier}}
}
export function applyCounterspell(db,game,entry,rules,decision={}){
 if(!decision||typeof decision!=='object'||Array.isArray(decision))fail(400,'Decisione del Master non valida.')
 if(decision.confirmed!==true)fail(400,'Conferma che vedi la creatura entro 18 metri mentre lancia e puoi eseguire la componente somatica.')
 const intent=entry.proposal.counterspell,{context,action,record}=actorContext(db,game,game.masterId,intent.actorId,rules)
 if(!game.state.combat||isIncapacitated(game.state.abilities,intent.actorId))fail(409,'Il personaggio non pu\u00f2 usare questa reazione.')
 const target=counterspellTargets(db,game,intent.actorId,rules).find(t=>t.key===intent.targetKey)
 if(!target)fail(409,'Il lancio da interrompere non \u00e8 pi\u00f9 disponibile.')
 if(decision.spellName!==undefined&&(typeof decision.spellName!=='string'||decision.spellName.length>200))fail(400,'Nome dell’incantesimo non valido.')
 if(target.name===undefined&&decision.spellName?.trim())target.name=decision.spellName.trim()
 const level=target.level??decision.level,modifier=counterspellModifier(record.sheet,rules.data)
 let result,sheet
 try{
  result=resolveCounterspell(slotLevel(entry.proposal.option),level,modifier.total,decision)
  sheet=spendCombatUse(record.sheet,{...action.ability,requirementsConfirmed:true,targets:[]},context.catalog,rules.data,entry.proposal.option,1,{abilities:game.state.abilities,ownerId:intent.actorId,combat:game.state.combat})
 }catch(e){fail(409,e.message)}
 const sheets=[sheet],nextRevision=game.revision+1
 let abilities=game.state.abilities
 const source=target.requestId?game.combatRequests.find(e=>e.id===target.requestId):undefined
 let interruptedSheet
 if(result.success&&source){
  const sourceContext=actionContext(db,game,source.ownerId,rules,true,source.characterId,{keys:new Set([source.proposal.key])}),sourceAction=sourceContext.actions.find(a=>a.key===source.proposal.key),prepared=source.counterspell?{sheet:spendCombatUse(sourceContext.record.sheet,{...sourceAction.ability,requirementsConfirmed:true,targets:[]},sourceContext.catalog,rules.data,source.proposal.option,source.proposal.cost,{abilities:game.state.abilities,ownerId:target.actorId,combat:game.state.combat}),action:sourceAction,ability:sourceAction.ability}:prepareAction(sourceContext,source.proposal,rules)
  interruptedSheet=prepared.sheet
  if(prepared.action.info.concentration||prepared.ability.concentration){
   interruptedSheet={...interruptedSheet,playerDetails:{...interruptedSheet.playerDetails,'rules2014.concentration':''}}
   abilities=abilities.map(a=>a.ownerId===target.actorId&&a.concentration?{...a,active:false,remainingTurns:0,execution:undefined}:a)
  }
  sheets.push(interruptedSheet)
 }
 if(result.success&&target.abilityId!==undefined){
  const sourceAbility=abilities.find(a=>a.id===target.abilityId),sourceRecord=db.characters.find(r=>r.id===game.state.turns.find(t=>t.id===target.actorId)?.sheet?.id&&r.gameId===game.id)
  if(!sourceAbility||!sourceRecord)fail(409,'Il lancio prolungato non \u00e8 pi\u00f9 disponibile.')
  // PHB 2014 PDF 203: an unfinished long casting loses concentration, not a completed-cast slot.
  interruptedSheet={...sourceRecord.sheet,playerDetails:{...sourceRecord.sheet.playerDetails,'rules2014.concentration':''}}
  sheets.push(interruptedSheet)
  abilities=abilities.map(a=>a.id===sourceAbility.id?{...a,active:false,remainingTurns:0,execution:undefined}:a)
 }
 // Only mutate source history after every resource check succeeded.
 if(source){
  if(result.success){
   source.status='approved';source.resolvedAt=new Date().toISOString();source.counteredBy=entry.id;source.targets=source.targets.map(t=>({...t,damage:'0'}))
   if(source.counterspell){
    const original=game.combatRequests.find(r=>r.id===source.counterspell.target.requestId)
    if(original?.status==='pending'&&original.resolution){original.reviewedRevision=nextRevision;original.reactionReviewed=true}
    for(const window of game.reactionWindows??[])if(window.requestId===source.id)window.status='used'
   }
  }
  else if(source.resolution){source.reviewedRevision=nextRevision;source.reactionReviewed=true}
 }
 if(result.success&&source)for(const window of game.reactionWindows??[])if(window.event.requestId===source.id&&window.requestId!==entry.id){window.status='declined';const child=game.combatRequests.find(e=>e.id===window.requestId);if(child?.status==='pending'){child.status='rejected';child.resolvedAt=new Date().toISOString()}}
 // A resolved nested reaction changes the revision, not the validity of its pending parent casts.
 for(const id of counterspellRelatedCastIds(game,target)){
  const original=game.combatRequests.find(r=>r.id===id)
  if(original?.status==='pending'&&(original.resolution||original.counterspell)){
   original.reviewedRevision=nextRevision
   if(original.resolution)original.reactionReviewed=true
  }
 }
 for(const window of game.reactionWindows??[])if(window.characterId===record.id&&window.status==='pending')window.status='used'
 const snapshot={edition:'2014',actorId:intent.actorId,target,slotLevel:result.slotLevel,modifier,result}
 return {state:{...game.state,abilities,turns:game.state.turns.map(t=>{const updated=sheets.find(s=>s.id===t.sheet?.id);return updated?{...t,sheet:{...updated,abilities:t.sheet.abilities}}:t})},sheets,targets:entry.targets,counterspell:snapshot}
}

export function counterspellRelatedCastIds(game,target){
 const ids=new Set();let id=target.requestId
 while(id&&!ids.has(id)){ids.add(id);id=game.combatRequests.find(e=>e.id===id)?.counterspell?.target.requestId}
 return ids
}
