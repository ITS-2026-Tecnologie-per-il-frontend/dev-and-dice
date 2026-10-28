import {defaultCounterspellSettings} from '../src/domain/dnd/CounterspellTiming.ts'
import {renewSpellWindow,spellCastForKey} from './game-events.mjs'
import {turnActionCapacity,turnActionUses} from '../src/domain/dnd/TurnEconomy.ts'
import {randomUUID} from 'node:crypto'
import {spendCombatUse} from '../src/domain/dnd/CombatActions.ts'
import {actionContext, createRequestResolution, resolveRequestTarget} from './combat-requests.mjs'

const fail=(status,message)=>{throw Object.assign(new Error(message),{status})}
export const reactionDeadline=(window,key)=>window.actionExpiresAt?.[key]??window.expiresAt
export const reactionKeys=window=>window.actionKeys.filter(key=>reactionDeadline(window,key)>Date.now())
export const reactionOpen=window=>window.status==='submitted'||window.status==='pending'&&window.expiresAt>Date.now()
export function visibleReactions(game,user){
  return (game.reactionWindows??[]).filter(w=>game.masterId===user||w.ownerId===user).map(w=>({id:w.id,groupId:w.groupId,characterId:w.characterId,characterName:w.characterName,event:w.event,actionKeys:w.status==='pending'?reactionKeys(w):w.actionKeys,actionExpiresAt:w.actionExpiresAt,actionSeconds:w.actionSeconds,expiresAt:w.expiresAt,serverNow:Date.now(),status:w.status==='pending'&&w.expiresAt<=Date.now()?'expired':w.status,requestId:w.requestId}))
}
export function assertReactionAction(window,action,context){
  if(reactionDeadline(window,action.key)<=Date.now())fail(409,'La finestra di questa reazione è già conclusa.')
  if(!matches(action,window.event,context.owner.id)||window.actionIds[action.key]!==(action.ability.ruleId??action.ability.catalogId??action.ability.name))fail(409,'La reazione non è più disponibile per questo evento.')
}
export function validReactionWindows(windows){
  return Array.isArray(windows)&&windows.length<=1200&&windows.every(w=>w&&['id','groupId','ownerId','characterId'].every(k=>typeof w[k]==='string'&&/^[a-f\d-]{36}$/i.test(w[k]))&&typeof w.characterName==='string'&&w.characterName.length<=160&&w.event&&['hit','magic-missile','spell','damage','fall','other'].includes(w.event.kind)&&typeof w.event.label==='string'&&w.event.label.length<=500&&Array.isArray(w.event.targetIds)&&w.event.targetIds.every(Number.isSafeInteger)&&Array.isArray(w.actionKeys)&&w.actionKeys.every(k=>typeof k==='string'&&/^\d+$/.test(k))&&w.actionIds&&typeof w.actionIds==='object'&&Number.isSafeInteger(w.expiresAt)&&['actionExpiresAt','actionSeconds'].every(field=>w[field]===undefined||w[field]&&typeof w[field]==='object'&&!Array.isArray(w[field])&&Object.entries(w[field]).every(([key,value])=>w.actionKeys.includes(key)&&Number.isSafeInteger(value)&&value>0&&(field!=='actionSeconds'||value<=3600)))&&['pending','submitted','used','declined'].includes(w.status))
}
export function reactionWindow(game,user,id,key,acceptedId){
  const window=game.reactionWindows?.find(w=>w.id===id&&(w.ownerId===user||game.masterId===user))
  if(!window)fail(403,'Reazione non disponibile per questo giocatore.')
  if(!(window.status==='submitted'&&window.requestId===acceptedId&&acceptedId)&&(window.status!=='pending'||(key===undefined?window.expiresAt:reactionDeadline(window,key))<=Date.now()))fail(409,'La finestra di reazione è già conclusa.')
  return window
}
function matches(action,event,ownerId){
  if(action.info.unit!=='reaction'||action.error||action.ability.ruleId==='phb2014:spell:counterspell'&&event.unavailableActors?.includes(ownerId))return false
  const effect=action.info.entry?.data.mechanics?.effect??{}
  const triggers=effect.triggerChoice??[effect.trigger]
  if(event.kind==='other')return true // The Master explicitly verifies unmodelled triggers and distances.
  if(event.kind==='hit')return event.targetIds.includes(ownerId)&&triggers.includes('hit-by-attack')
  if(event.kind==='magic-missile')return event.targetIds.includes(ownerId)&&triggers.includes('targeted-by-magic-missile')
  if(event.kind==='spell')return ownerId!==event.actorId&&triggers.includes('see-creature-within-60-ft-casting-spell')
  if(event.kind==='damage')return event.targetIds.includes(ownerId)&&triggers.includes('damaged-by-visible-creature-within-60-ft')
  return event.kind==='fall'&&triggers.includes('caster-or-creature-within-60-ft-falls')
}
export function openReactions(db,game,rules,event,groupId=randomUUID()){
  if(!game.state.combat)return groupId
  for(const record of db.characters.filter(r=>r.gameId===game.id&&(r.ownerId===game.masterId||game.players.some(p=>p.userId===r.ownerId&&p.characterId===r.id)))){
    const owners=game.state.turns.filter(t=>t.sheet?.id===record.id)
    if(owners.length!==1||turnActionUses(record.sheet,'reaction')>=turnActionCapacity(record.sheet,game.state.abilities,owners[0]?.id,'reaction'))continue
    // These events can only trigger a reaction from the attacked/damaged participant.
    if(['hit','magic-missile','damage'].includes(event.kind)&&!event.targetIds.includes(owners[0].id))continue
    if(event.kind==='spell'&&owners[0].id===event.actorId)continue
    const context=actionContext(db,game,record.ownerId,rules,true,record.id,{unit:'reaction'})
    if(context.blockedReason)continue
    const keys=context.actions.filter(action=>matches(action,event,context.owner.id)&&action.options.some(option=>{
      try{spendCombatUse(context.record.sheet,{...action.ability,requirementsConfirmed:true,targets:[]},context.catalog,rules.data,option.id,option.cost??1,{abilities:context.weaponContext.active,ownerId:context.owner.id});return true}catch{return false}
    })).map(a=>a.key)
    const existing=game.reactionWindows?.find(w=>w.groupId===groupId&&w.characterId===record.id)
    if(!keys.length&&!existing)continue
    const window=existing??{id:randomUUID(),groupId,ownerId:record.ownerId,characterId:context.record.id,characterName:context.record.sheet.name,event,actionKeys:[],actionIds:{},status:'pending',expiresAt:0}
    if(event.castKey)window.event.castKey=event.castKey
    if(window.status==='pending')for(const key of keys){
      const action=context.actions.find(a=>a.key===key)
      if(window.actionKeys.includes(key))continue
      window.actionKeys.push(key);window.actionIds[key]=action.ability.ruleId??action.ability.catalogId??action.ability.name
      const timing=action.ability.ruleId==='phb2014:spell:counterspell'?spellCastForKey(game,event.castKey)?.counterspellWindow:undefined
      const seconds=action.ability.ruleId==='phb2014:spell:counterspell'?timing?.seconds??(game.counterspellSettings??defaultCounterspellSettings).seconds:30
      ;(window.actionSeconds??={})[key]=seconds
      ;(window.actionExpiresAt??={})[key]=timing?.expiresAt??Date.now()+seconds*1000
      window.expiresAt=Math.max(window.expiresAt,window.actionExpiresAt[key])
    }
    if(!existing)(game.reactionWindows??=[]).push(window)

  }
  // ponytail: retain the last 200 closed prompts, plus every open one; use a history table if a permanent audit is needed.
  game.reactionWindows=(game.reactionWindows??[]).filter((w,i,list)=>reactionOpen(w)||i>=list.length-200)
  game.requestsRevision=(game.requestsRevision??0)+1
  return groupId
}
export function renewReactionWindow(game,window,key){
 const keys=key===undefined?reactionKeys(window):[key],now=Date.now()
 if(window.status!=='pending'||window.expiresAt<=now||!keys.length||keys.some(k=>!window.actionKeys.includes(k)||reactionDeadline(window,k)<=now))fail(409,'La finestra di questa reazione è già conclusa.')
 for(const k of keys){
  const counterspell=window.actionIds[k]==='phb2014:spell:counterspell',cast=counterspell?renewSpellWindow(game,window.event.castKey,now):undefined
  const deadline=cast?.expiresAt??now+(window.actionSeconds?.[k]??30)*1000
  for(const sibling of game.reactionWindows??[]){
   if(sibling.status!=='pending')continue
   if(sibling!==window&&(!counterspell||!window.event.castKey||sibling.event.castKey!==window.event.castKey))continue
   for(const siblingKey of sibling.actionKeys)if(sibling===window&&siblingKey===k||counterspell&&sibling.actionIds[siblingKey]==='phb2014:spell:counterspell'&&reactionDeadline(sibling,siblingKey)>now)(sibling.actionExpiresAt??={})[siblingKey]=deadline
   sibling.expiresAt=Math.max(...sibling.actionKeys.map(s=>reactionDeadline(sibling,s)))
  }
 }
}
export function finishReaction(db,game,entry,rules){
  const window=game.reactionWindows?.find(w=>w.requestId===entry.id)
  if(!window)return
  window.status=entry.status==='approved'?'used':'declined'
  const owner=game.state.turns.find(t=>t.sheet?.id===entry.characterId),record=db.characters.find(r=>r.id===entry.characterId)
  if(entry.status==='approved'&&record&&turnActionUses(record.sheet,'reaction')>=turnActionCapacity(record.sheet,game.state.abilities,owner?.id,'reaction'))for(const sibling of game.reactionWindows??[])if(sibling.characterId===entry.characterId&&sibling.status==='pending')sibling.status='declined'
  const ids=new Set([window.event.requestId,...(game.reactionWindows??[]).filter(w=>w.groupId===window.groupId&&w.status==='submitted').map(w=>w.requestId)])
  for(const source of game.combatRequests??[]){
    if(!ids.has(source.id)||!source.resolution||source.status!=='pending')continue
    const context=actionContext(db,game,source.ownerId,rules,true,source.proposal.reactionId?source.characterId:undefined),action=context.actions.find(a=>a.key===source.proposal.key)
    if(!action)continue
    const next=createRequestResolution(db,game,context,action,source.proposal,rules)
    for(const target of next.targets)target.rolls=source.resolution.targets.find(t=>t.id===target.id)?.rolls??{}
    source.resolution=next;source.reviewedRevision=game.revision;source.reactionReviewed=true;source.rollsRevision=(source.rollsRevision??0)+1
  }
}
export function requestReactionEvent(entry,context){
  if(entry.resolution?.plan.ruleId==='phb2014:spell:magic-missile')return {kind:'magic-missile',label:`${entry.actionName}: puoi reagire prima dei danni.`,targetIds:entry.proposal.targets.map(t=>t.id),actorId:context.owner.id,requestId:entry.id}
  if(entry.resolution?.plan.kind==='attack'){
    const targetIds=entry.proposal.targets.filter(t=>resolveRequestTarget(entry,t.id).packets.some(p=>p.hit===true)).map(t=>t.id)
    if(targetIds.length)return {kind:'hit',label:`${entry.actionName}: un attacco ti ha colpito.`,targetIds,actorId:context.owner.id,requestId:entry.id}
  }
}
