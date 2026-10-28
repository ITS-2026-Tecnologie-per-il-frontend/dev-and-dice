import {createCounterspellWindow,counterspellWindowOpen,validCounterspellWindow} from '../src/domain/dnd/CounterspellTiming.ts'
import {settleCombatEffects,isIncapacitated} from '../src/domain/dnd/CombatConditions.ts'
import {openReactions} from './reactions.mjs'
import {randomUUID} from 'node:crypto'
import {isDeepStrictEqual as same} from 'node:util'
import {combatAbilityInfo} from '../src/domain/dnd/CombatActions.ts'
import {sheetWithCombatAbilities} from '../src/utils/Catalog.ts'
import {catalogForSheet} from '../src/domain/dnd/ActiveRules.ts'

const clone=value=>value===undefined?null:structuredClone(value)
const uuid=value=>typeof value==='string'&&/^[a-f\d-]{36}$/i.test(value)
const fail=message=>{throw Object.assign(new Error(message),{status:409})}
const active=a=>a.active&&(a.timed===false||a.remainingTurns>0)||!!a.execution
function sheetView(sheet){
 const {id,notes:_notes,...fields}=sheet
 if(fields.playerDetails)fields.playerDetails=Object.fromEntries(Object.entries(fields.playerDetails).filter(([key,value])=>value!==''&&!['portrait','notes'].includes(key)))
 return {id,...fields}
}
export function stateSnapshot(state){
 return {sheets:state.turns.flatMap(t=>t.sheet?[sheetView({...t.sheet,hitPoints:t.hitPoints,playerDetails:{...t.sheet.playerDetails,temporaryHitPoints:t.temporaryHitPoints}})]:[]),
  turns:state.turns.map(t=>t.sheet?{id:t.id,sheetId:t.sheet.id,concentrationChecks:t.concentrationChecks}:{id:t.id,description:t.description,initiative:t.initiative,hitPoints:t.hitPoints,armorClass:t.armorClass,temporaryHitPoints:t.temporaryHitPoints}),
  abilities:state.abilities.filter(active).map(a=>{const {requirementsConfirmed:_requirementsConfirmed,description:_description,sheetAbilityIndex:_sheetAbilityIndex,...effect}=a;if(effect.execution&&!effect.active)delete effect.targets;return effect}),combat:clone(state.combat)}
}
export function gameSnapshot(db,game){
 const snapshot=stateSnapshot(game.state)
 // Include encounter-only creatures; persistent sheets take precedence over their combat copies.
 snapshot.sheets=[...new Map([...snapshot.sheets,...db.characters.filter(r=>r.gameId===game.id).map(r=>sheetView(r.sheet))].map(sheet=>[sheet.id,sheet])).values()]
 return snapshot
}
export function eventChanges(before,after){
 const changes=[]
 for(const [collection,scope] of [['sheets','sheet'],['turns','turn'],['abilities','ability']]){
  const previous=new Map((before[collection]??[]).map(v=>[v.id,v])),next=new Map((after[collection]??[]).map(v=>[v.id,v]))
  for(const id of new Set([...previous.keys(),...next.keys()])){
   const a=previous.get(id),b=next.get(id)
   if(scope!=='sheet'||!a||!b){if(!same(a,b))changes.push({scope,id,path:[],before:clone(a),after:clone(b)});continue}
   for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
    if(key==='id')continue
    const paths=key==='playerDetails'?[...new Set([...Object.keys(a[key]??{}),...Object.keys(b[key]??{})])].map(k=>[key,k]):[[key]]
    for(const path of paths){const value=o=>path.reduce((v,k)=>v?.[k],o);if(!same(value(a),value(b)))changes.push({scope,id,path,before:clone(value(a)),after:clone(value(b))})}
   }
  }
 }
 if(!same(before.combat,after.combat))changes.push({scope:'combat',id:'combat',path:[],before:clone(before.combat),after:clone(after.combat)})
 return changes
}
function castInfo(db,game,actorId,ruleId,name,option,rules){
 const turn=game.state.turns.find(t=>t.id===actorId),record=db.characters.find(r=>r.id===turn?.sheet?.id&&r.gameId===game.id)
 if(!record)return undefined
 const catalog=catalogForSheet(rules.data,rules.catalog,record.sheet),ability=sheetWithCombatAbilities(record.sheet,catalog).abilities.find(a=>ruleId?a.ruleId===ruleId:a.name===name)
 if(!ability)return undefined
 const info=combatAbilityInfo(ability,catalog,rules.data)
 if(info.level===undefined)return undefined
 return {actorId,casterName:record.sheet.name,name:ability.name,ruleId:ability.ruleId,level:/^slot:[1-9]$/.test(option)?Number(option.slice(5)):option==='pact'?Number(record.sheet.playerDetails?.['rules2014.pact.level'])||undefined:info.level,option,concentration:info.concentration}
}
export function spellOpportunities(game,actorId,accepted){
 const result=[]
 for(const event of game.events??[]){
  if(!event.cast||event.counteredBy||!counterspellWindowOpen(event.counterspellWindow,event.id===game.eventBoundary,Date.now(),accepted?.counterspell?.target.eventId===event.id?accepted.createdAt:undefined))continue
  let priorAbilities=structuredClone(game.state.abilities)
  for(const c of event.changes)if(c.scope==='ability'){priorAbilities=priorAbilities.filter(a=>a.id!==c.id);if(c.before)priorAbilities.push(c.before)}
  const unavailableActors=game.state.turns.filter(t=>isIncapacitated(priorAbilities,t.id)).map(t=>t.id)
  result.push({...event.cast,key:'event:'+event.id,eventId:event.id,window:event.counterspellWindow,unavailableActors})
 }
 for(const entry of game.combatRequests??[])if(entry.status==='pending'&&!entry.counteredBy&&entry.castInfo&&counterspellWindowOpen(entry.counterspellWindow,(entry.eventBoundary??null)===(game.eventBoundary??null),Date.now(),accepted?.counterspell?.target.requestId===entry.id?accepted.createdAt:undefined))result.push({...entry.castInfo,key:'request:'+entry.id,requestId:entry.id,window:entry.counterspellWindow})
 return actorId===undefined?result:result.filter(t=>!t.unavailableActors?.includes(actorId))
}
export function spellCastForKey(game,key){
 if(key?.startsWith('ability:')){const ability=game.state.abilities.find(a=>a.id===Number(key.slice(8)));return game.events?.find(e=>e.id===ability?.execution?.id)}
 const id=key?.slice(key.indexOf(':')+1)
 return key?.startsWith('event:')?game.events?.find(e=>e.id===id):key?.startsWith('request:')?game.combatRequests?.find(e=>e.id===id):undefined
}
export function renewSpellWindow(game,key,now=Date.now()){
 const cast=spellCastForKey(game,key)
 if(!cast)return undefined
 cast.counterspellWindow??=createCounterspellWindow(game.counterspellSettings,now)
 cast.counterspellWindow.expiresAt=now+cast.counterspellWindow.seconds*1000
 for(const alias of [...(game.events??[]),...(game.combatRequests??[])])if(alias.id===cast.id)alias.counterspellWindow={...cast.counterspellWindow}
 return cast.counterspellWindow
}

function append(game,event,dependent=false){
 const previous=(game.events??[]).find(e=>e.id===event.id)
 if(previous){
  // Completing the same cast adds effects to its original event, without opening a new window.
  const merged=new Map(previous.changes.map(c=>[JSON.stringify([c.scope,c.id,c.path]),c]))
  for(const c of event.changes){const key=JSON.stringify([c.scope,c.id,c.path]),old=merged.get(key);merged.set(key,old?{...c,before:old.before}:c)}
  previous.changes=[...merged.values()];if(event.targets)previous.targets=event.targets;return
 }
 event.sequence=(game.eventSequence??0)+1;game.eventSequence=event.sequence
 ;(game.events??=[]).push(event)
 if(!dependent)game.eventBoundary=event.id
}
export function recordGameEvents(db,game,before,actor,rules){
 const after=gameSnapshot(db,game),changes=eventChanges(before.snapshot,after),requests=game.combatRequests??[]
 const base={actorId:actor.userId,actorName:actor.username??'Master',createdAt:new Date().toISOString()}
 for(const entry of requests)if(!before.requests.has(entry.id)&&entry.status==='pending'){
  const owner=game.state.turns.find(t=>t.sheet?.id===entry.characterId)
  const cast=owner&&castInfo(db,game,owner.id,undefined,entry.actionName,entry.proposal.option,rules)
  if(cast){entry.counterspellWindow=createCounterspellWindow(game.counterspellSettings);entry.castInfo=cast;entry.eventBoundary=game.eventBoundary??null;if(!entry.proposal.counterspell)openReactions(db,game,rules,{kind:'spell',actorId:cast.actorId,requestId:entry.id,castKey:'request:'+entry.id,label:cast.casterName+' sta lanciando un incantesimo.',targetIds:[]},entry.id)}
 }
 const approved=requests.filter(e=>e.status==='approved'&&before.requests.get(e.id)!=='approved')
 const commands=(game.state.actionEvents??[]).filter(e=>!before.commands.has(e.id)||e.phase!==before.commands.get(e.id))
 let accounted=false
 let cursor=before.snapshot
 const supplement=state=>{const settled=settleCombatEffects(state.abilities,state.turns,state.combat),snapshot=stateSnapshot({...state,...settled});snapshot.sheets=[...new Map([...before.snapshot.sheets.filter(sheet=>db.characters.some(r=>r.gameId===game.id&&r.id===sheet.id)||!before.snapshot.turns.some(t=>t.sheetId===sheet.id)),...snapshot.sheets].map(sheet=>[sheet.id,sheet])).values()];return snapshot}
 const recordState=delta=>{if(delta.length)append(game,{...base,id:randomUUID(),kind:delta.some(c=>c.scope==='combat')?'turn':'state',label:delta.some(c=>c.scope==='combat')?'Cambio del turno o del combattimento':'Modifica dello stato',changes:delta})}
 for(const command of commands){
  const prior=supplement(command.before),end=supplement(command.after),existing=(game.events??[]).find(e=>e.id===command.id)
  if(existing?.counteredBy)fail('Il lancio è stato interrotto: non puoi applicarne nuovamente gli effetti.')
  if(!existing)recordState(eventChanges(cursor,prior))
  const cast=castInfo(db,game,command.actorId,command.ruleId,command.name,command.option,rules)
  append(game,{...base,id:command.id,kind:cast?'spell':'action',label:command.name,characterName:game.state.turns.find(t=>t.id===command.actorId)?.description??'',cast,...(cast?{counterspellWindow:existing?.counterspellWindow??createCounterspellWindow(game.counterspellSettings)}:{}),targets:command.targets,changes:eventChanges(prior,end),option:command.option})
  if(cast&&!existing)openReactions(db,game,rules,{kind:'spell',actorId:cast.actorId,castKey:'event:'+command.id,unavailableActors:spellOpportunities(game).find(t=>t.eventId===command.id)?.unavailableActors,label:cast.casterName+' sta lanciando un incantesimo.',targetIds:[]},command.id)
  cursor=end;accounted=true
 }
 if(commands.length)recordState(eventChanges(cursor,after))
 if(approved.length){
  const entry=approved.find(e=>e.proposal.counterspell)??approved.find(e=>!e.counteredBy)??approved[0],source=entry.counterspell?.target
  const owner=game.state.turns.find(t=>t.sheet?.id===entry.characterId),cast=!entry.counterspell&&owner?castInfo(db,game,owner.id,undefined,entry.actionName,entry.proposal.option,rules):undefined
  let actionChanges=changes
  for(const interrupted of approved.filter(e=>e.id!==entry.id&&e.counteredBy)){
   const owner=game.state.turns.find(t=>t.sheet?.id===interrupted.characterId),cast=owner?castInfo(db,game,owner.id,undefined,interrupted.actionName,interrupted.proposal.option,rules):undefined
   const sourceChanges=changes.filter(c=>c.scope==='sheet'&&c.id===interrupted.characterId)
   append(game,{...base,actorName:interrupted.actorName,id:interrupted.id,kind:'spell',label:interrupted.actionName,characterName:interrupted.characterName,cast,counteredBy:interrupted.counteredBy,changes:sourceChanges})
   actionChanges=actionChanges.filter(c=>!sourceChanges.includes(c))
  }
  append(game,{...base,actorName:entry.actorName,approvedBy:actor.username,id:entry.id,result:entry.counterspell?.result?(entry.counterspell.result.success?'Incantesimo interrotto':'Controincantesimo fallito'):entry.counteredBy?'Incantesimo interrotto':undefined,kind:entry.counterspell?'reaction':cast?'spell':'action',label:entry.actionName,characterName:entry.characterName,option:entry.optionLabel,cast,...(cast?{counterspellWindow:entry.counterspellWindow??createCounterspellWindow(game.counterspellSettings)}:{}),targets:entry.targets.map(t=>({id:t.id,name:t.name,result:[t.roll?`Tiro: ${t.roll}`:'',t.hit===undefined?'':t.hit?'Colpito':'Mancato',entry.proposal.damageEnabled?`Danni finali: ${t.damage}`:'Effetto applicato'].filter(Boolean).join(' · ')})),requestId:entry.id,parentId:source?.eventId??source?.requestId??(entry.proposal.reactionId?game.reactionWindows?.find(w=>w.id===entry.proposal.reactionId)?.event.requestId:undefined),changes:actionChanges},!!source||!!entry.proposal.reactionId)
  accounted=true
 }
 if(changes.length&&!accounted)append(game,{...base,id:randomUUID(),kind:changes.some(c=>c.scope==='combat')?'turn':'state',label:changes.some(c=>c.scope==='combat')?'Cambio del turno o del combattimento':'Modifica dello stato',changes})
 // ponytail: snapshots are only an outbox until this atomic save; persist deltas in the journal.
 delete game.state.actionEvents
}
export function captureGame(db,game){return {snapshot:gameSnapshot(db,game),requests:new Map((game.combatRequests??[]).map(e=>[e.id,e.status])),commands:new Map((game.state.actionEvents??[]).map(e=>[e.id,e.phase]))}}
export function validGameEvents(game){
 return (game.events===undefined||Array.isArray(game.events)&&new Set(game.events.map(e=>e.id)).size===game.events.length&&game.events.every((e,i)=>uuid(e.id)&&(e.counterspellWindow===undefined||validCounterspellWindow(e.counterspellWindow))&&e.sequence===(game.events[i-1]?.sequence??0)+1&&Number.isSafeInteger(e.sequence)&&typeof e.label==='string'&&Array.isArray(e.changes)&&e.changes.every(c=>['sheet','turn','ability','combat'].includes(c.scope)&&Array.isArray(c.path)&&c.path.length<=2&&c.path.every(k=>typeof k==='string'&&!['__proto__','constructor','prototype'].includes(k)))))&&(game.eventSequence===undefined||Number.isSafeInteger(game.eventSequence))&&(game.eventBoundary===undefined||uuid(game.eventBoundary))
}
const labels={abilities:'Abilità e incantesimi',strength:'Forza',dexterity:'Destrezza',constitution:'Costituzione',intelligence:'Intelligenza',wisdom:'Saggezza',charisma:'Carisma',level:'Livello','rules2014.raging':'Ira',hitPoints:'PF',armorClass:'CA',initiative:'Iniziativa',speed:'Velocità',temporaryHitPoints:'PF temporanei',temporaryAC:'CA temporanea','temporaryHitPoints.source':'Origine dei PF temporanei','rules2014.concentration':'Concentrazione','combat.actionUses':'Azioni usate','combat.bonusActionUses':'Azioni bonus usate','combat.reactionUses':'Reazioni usate',name:'Nome'}
function fieldLabel(path){const key=path.at(-1);return labels[key]??(/^slots\.\d\.used$/.test(key)?'Slot di '+key.split('.')[1]+'° usati':/spellsThisTurn/.test(key)?'Incantesimi del turno':/Used$|Uses$/.test(key)?'Utilizzi e azioni':/^inventory\./.test(key)?'Inventario':/^attacks\./.test(key)?'Attacco':/^rules2014.used\./.test(key)?'Risorse consumate':path[0]==='playerDetails'?'Dato della scheda':'Caratteristica della scheda')}
function textValue(value){if(value===null||value==='')return '—';if(value==='true')return 'Sì';if(value==='false')return 'No';if(typeof value==='boolean')return value?'Sì':'No';if(typeof value==='object')return Array.isArray(value)?`${value.length} elementi`:value.name??(value.activeId!==undefined?`Round ${value.round}`:'Aggiornato');if(typeof value==='string'&&/^[{[]/.test(value)){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?`${parsed.length} elementi`:'Aggiornato'}catch{}}return String(value)}
function changeText(change,side,game){
 const value=change[side]
 if(change.scope==='combat'&&value)return `Round ${value.round} · ${game.state.turns.find(t=>t.id===value.activeId)?.description??'Partecipante '+value.activeId}`
 if(change.scope==='ability')return value?.execution?'Lancio in corso':value?.active?`${value.name} · ${value.timed===false?'senza conteggio':value.remainingTurns+' round'}`:'Non attivo'
 return textValue(value)
}
export function visibleGameEvents(db,game,user,before=Infinity){
 const master=user===game.masterId,own=db.characters.filter(r=>r.gameId===game.id&&r.ownerId===user).map(r=>r.id),ownTurns=game.state.turns.filter(t=>own.includes(t.sheet?.id)).map(t=>t.id)
 return [...(game.events??[])].reverse().filter(e=>e.sequence<before).slice(0,50).map(e=>({id:e.id,sequence:e.sequence,createdAt:e.createdAt,actorName:e.actorName,kind:e.kind,label:!master&&e.cast&&!own.includes(game.state.turns.find(t=>t.id===e.cast.actorId)?.sheet?.id)?'Lancio di incantesimo':e.label,characterName:e.characterName,parentId:e.parentId,countered:!!e.counteredBy,option:master?e.option:undefined,result:e.result,targets:e.targets?.map(t=>({id:t.id,name:t.name,...(master?{result:t.result}:{})})),
  changes:e.changes.filter(c=>master||c.scope==='sheet'&&own.includes(c.id)||c.scope==='ability'&&[c.before,c.after].some(a=>a&&(ownTurns.includes(a.ownerId)||a.targets?.some(t=>ownTurns.includes(t.id))))).map(c=>({subject:c.scope==='sheet'?db.characters.find(r=>r.id===c.id)?.sheet.name??game.state.turns.find(t=>t.sheet?.id===c.id)?.sheet?.name??(c.after??c.before)?.name??'Personaggio':c.scope==='ability'?(c.after??c.before)?.name??'Effetto':c.scope==='combat'?'Combattimento':'Partecipante',label:c.scope==='sheet'?fieldLabel(c.path):c.scope==='ability'?'Effetto':c.scope==='combat'?'Turno':'Stato',before:changeText(c,'before',game),after:changeText(c,'after',game)}))}))
}
export function restoreSpellEvent(db,game,id,accepted){
 const event=(game.events??[]).find(e=>e.id===id)
 if(!event?.cast||event.counteredBy||!counterspellWindowOpen(event.counterspellWindow,game.eventBoundary===event.id,Date.now(),accepted?.counterspell?.target.eventId===id?accepted.createdAt:undefined))fail('Un altro evento ha chiuso la possibilità di interrompere questo lancio.')
 const casterSheetId=game.state.turns.find(t=>t.id===event.cast.actorId)?.sheet?.id
 const reversible=event.changes.filter(c=>!(c.scope==='sheet'&&c.id===casterSheetId&&(/^(slots\..*\.used|rules2014\.used\.|wizard\.resource\.|combat\.|rules2014\.spellsThisTurn|rules2014\.concentration)/.test(c.path.at(-1))))&&!(c.scope==='ability'&&c.before?.ownerId===event.cast.actorId&&c.before.concentration&&!c.after?.active))
 const current=gameSnapshot(db,game)
 function value(c){const list=c.scope==='sheet'?current.sheets:c.scope==='ability'?current.abilities:c.scope==='turn'?current.turns:undefined;const item=list?list.find(v=>v.id===c.id):current.combat;return c.path.reduce((v,k)=>v?.[k],item)??null}
 for(const c of reversible)if(!same(value(c),c.after))fail('Un effetto è stato modificato: annullamento non applicato, nessun dato sovrascritto.')
 const state=structuredClone(game.state),sheets=new Map([...state.turns.flatMap(t=>t.sheet?[{...t.sheet,hitPoints:t.hitPoints,playerDetails:{...t.sheet.playerDetails,temporaryHitPoints:t.temporaryHitPoints}}]:[]),...db.characters.filter(r=>r.gameId===game.id).map(r=>r.sheet)].map(sheet=>[sheet.id,structuredClone(sheet)]))
 for(const c of reversible){
  if(c.scope==='sheet'&&c.path.length){const sheet=sheets.get(c.id);if(!sheet)fail('Personaggio non più disponibile.');let target=sheet;for(const key of c.path.slice(0,-1))target=target[key]??={};const key=c.path.at(-1);if(c.before===null)delete target[key];else target[key]=clone(c.before)}
  else if(c.scope==='sheet')fail('Il lancio modifica le schede partecipanti: serve una risoluzione manuale.')
  else if(c.scope==='ability'){state.abilities=state.abilities.filter(a=>a.id!==c.id);if(c.before)state.abilities.push(clone(c.before))}
  else if(c.scope==='turn'){if(!c.before)state.turns=state.turns.filter(t=>t.id!==c.id);else {const turn=state.turns.find(t=>t.id===c.id);if(!turn)fail('Partecipante non più disponibile.');if(c.before.sheetId){turn.concentrationChecks=clone(c.before.concentrationChecks)??undefined}else Object.assign(turn,c.before)}}
  else if(c.scope==='combat')fail('Il combattimento è cambiato: annullamento automatico non disponibile.')
 }
 if(event.cast.concentration&&sheets.has(casterSheetId))sheets.get(casterSheetId).playerDetails['rules2014.concentration']=''
 state.turns=state.turns.map(t=>{const sheet=sheets.get(t.sheet?.id);return sheet?{...t,sheet,hitPoints:sheet.hitPoints,temporaryHitPoints:sheet.playerDetails?.temporaryHitPoints??'',armorClass:sheet.armorClass}:t})
 return {state,sheets:[...sheets.values()].filter(sheet=>db.characters.some(r=>r.gameId===game.id&&r.id===sheet.id)),event}
}
