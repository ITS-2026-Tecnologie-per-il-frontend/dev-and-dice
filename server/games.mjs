import { validWindSave } from '../src/domain/dnd/WindTurns.ts'
import {assertReactionAction,validReactionWindows,visibleReactions,reactionWindow,reactionOpen,openReactions,finishReaction,requestReactionEvent} from './reactions.mjs'
import { settleCombatEffects } from '../src/domain/dnd/CombatConditions.ts'
import { activeEffects, saveNames, validEffectSpecs, validWeaponEnchantments } from '../src/domain/dnd/CombatResolution.ts'
import { spellEdition } from '../src/utils/Spellcasting.ts'
import { integerValue } from '../src/utils/CharacterSheets.ts'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { isDeepStrictEqual } from 'node:util'
import { combatRules, actionContext, actionChoices, requestProposal, validCombatRequest, requestStatus, visibleRequests, prepareAction, applyCombatRequest, createRequestResolution, pendingSavingThrows, recordResolutionRoll, recoverRepeatSaveDCs, createWindDirectionRequest, createSleepReview } from './combat-requests.mjs'

const fields = 'name kind race characterClass level hitPoints armorClass initiative speed strength dexterity constitution intelligence wisdom charisma notes'.split(' ')
const numeric = 'hitPoints armorClass initiative strength dexterity constitution intelligence wisdom charisma'.split(' ')
const durations = ['1 minuto','10 minuti','1 ora','8 ore','24 ore','Personalizzata','Senza conteggio']
const object = value => !!value && typeof value === 'object' && !Array.isArray(value)
const idPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error }
const integer = value => Number.isSafeInteger(value) && value >= 0
const validNotes = value => object(value) && typeof value.text === 'string' && value.text.length <= 20_000 && integer(value.revision)
const valueAt = (sheet,path) => path.reduce((value,key) => object(value) && Object.hasOwn(value,key) ? value[key] : null,sheet)
function sheetChanges(before,after) {
  // ponytail: ability lists are atomic; add stable row IDs before merging inverses across reordered entries.
  const changes=[]
  for (const key of new Set([...Object.keys(before),...Object.keys(after)])) {
    if (key==='id') continue
    const paths=key==='playerDetails' ? [...new Set([...Object.keys(before.playerDetails??{}),...Object.keys(after.playerDetails??{})])].map(field=>[key,field]) : [[key]]
    for (const path of paths) {
      const previous=valueAt(before,path),next=valueAt(after,path)
      if (!isDeepStrictEqual(previous,next)) changes.push({path,before:previous,after:next})
    }
  }
  return changes
}
const samePath = (a,b) => a.length===b.length && a.every((part,index)=>part===b[index])
const validChange = change => object(change) && Array.isArray(change.path)
  && (change.path.length===1 && [...fields,'abilities','catalogId'].includes(change.path[0]) || change.path.length===2 && change.path[0]==='playerDetails' && typeof change.path[1]==='string' && !['__proto__','constructor','prototype'].includes(change.path[1]))
  && ['before','after'].every(key=>Object.hasOwn(change,key) && (change[key]===null || typeof change[key]==='string' || change.path[0]==='abilities' && Array.isArray(change[key])))

export function validateSheet(sheet) {
  if (!object(sheet) || !idPattern.test(sheet.id) || !fields.every(key => typeof sheet[key] === 'string')
      || !['PG','Mostro','PNG'].includes(sheet.kind) || !sheet.name.trim() || sheet.name.length > 160
      || !numeric.every(key => sheet[key] === '' || sheet[key].trim() && Number.isSafeInteger(Number(sheet[key])))
      || !Array.isArray(sheet.abilities) || sheet.abilities.length > 1000
      || !sheet.abilities.every(ability => object(ability) && typeof ability.name === 'string' && durations.includes(ability.duration)
        && (ability.remainingTurns === undefined || integer(ability.remainingTurns))
        && ['catalogId','description','ruleId','repeatSave'].every(key=>ability[key]===undefined||typeof ability[key]==='string')
        && ['timed','concentration'].every(key=>ability[key]===undefined||typeof ability[key]==='boolean')
        && (ability.section===undefined||['trait','action','bonus','reaction','legendary','lair'].includes(ability.section))
        && (ability.spellLevel===undefined || integer(ability.spellLevel) && ability.spellLevel<=9)
        && (ability.expiresAt===undefined||['start','end'].includes(ability.expiresAt)))
      || sheet.catalogId!==undefined&&typeof sheet.catalogId!=='string'
      || sheet.playerDetails !== undefined && (!object(sheet.playerDetails) || !Object.entries(sheet.playerDetails).every(([key,value]) =>
        !['__proto__','constructor','prototype'].includes(key) && typeof value === 'string'))) fail(400, 'Scheda non valida: verifica nome, statistiche e abilità.')
  const allowed = new Set([...fields,'id','abilities','playerDetails','catalogId'])
  if (Object.keys(sheet).some(key => !allowed.has(key))) fail(400, 'La scheda contiene campi non consentiti.')
  if (sheet.playerDetails?.portrait && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z\d+/=]+$/.test(sheet.playerDetails.portrait)) fail(400, 'Il ritratto deve essere un’immagine PNG, JPEG o WebP.')
  return structuredClone(sheet)
}

export function validateState(state) {
  if (!object(state) || !Array.isArray(state.turns) || !Array.isArray(state.abilities) || state.turns.length > 1000 || state.abilities.length > 2000) fail(400, 'Combattimento non valido.')
  const ids = state.turns.map(turn => turn.id)
  if (new Set(ids).size !== ids.length || !state.turns.every(turn => object(turn) && integer(turn.id)
    && ['description','initiative','hitPoints','armorClass','temporaryHitPoints'].every(key => typeof turn[key] === 'string')
    && ['initiative','hitPoints','armorClass','temporaryHitPoints'].every(key => turn[key] === '' || turn[key].trim() && Number.isSafeInteger(Number(turn[key]))))) fail(400, 'Partecipanti non validi.')
  for (const turn of state.turns) if (turn.sheet) validateSheet(turn.sheet)
  if (state.combat !== null && (!object(state.combat) || !ids.includes(state.combat.activeId) || !Number.isSafeInteger(state.combat.round) || state.combat.round < 1)) fail(400, 'Turno attuale non valido.')
  if (new Set(state.abilities.map(ability => ability.id)).size !== state.abilities.length || !state.abilities.every(ability => object(ability) && integer(ability.id)
    && typeof ability.name === 'string' && durations.includes(ability.duration) && integer(ability.remainingTurns) && typeof ability.active === 'boolean'
    && (ability.ownerId === null || ids.includes(ability.ownerId))
    && ['damageEnabled','instantaneous','requirementsConfirmed','timed','concentration'].every(key=>ability[key]===undefined||typeof ability[key]==='boolean')
    && (ability.weaponEffects===undefined||validWeaponEnchantments(ability.weaponEffects))
    && (ability.temporaryHitPointsSource===undefined||typeof ability.temporaryHitPointsSource==='string'&&idPattern.test(ability.temporaryHitPointsSource))
    && (ability.sourceEffectId===undefined||integer(ability.sourceEffectId)&&ability.sourceEffectId!==ability.id)
    && (ability.windSave===undefined||ability.ruleId==='phb2014:spell:gust-of-wind'&&validWindSave(ability.windSave))
    && (ability.repeatSaveRoll===undefined||object(ability.repeatSaveRoll)&&Object.hasOwn(saveNames,ability.repeatSaveRoll.ability)&&ability.repeatSaveRoll.timing==='end'&&(ability.repeatSaveRoll.dc===undefined||Number.isSafeInteger(ability.repeatSaveRoll.dc))&&(ability.repeatSaveRoll.lastRound===undefined||integer(ability.repeatSaveRoll.lastRound)))
    && (ability.resolutionEffects===undefined||validEffectSpecs(ability.resolutionEffects))
    && (ability.useOption===undefined || typeof ability.useOption==='string' && ability.useOption.length<=250)
    && (ability.resourceCost===undefined || integer(ability.resourceCost) && ability.resourceCost>=1)
    && (ability.spellLevel===undefined || integer(ability.spellLevel) && ability.spellLevel<=9)
    && (ability.section===undefined || ['trait','action','bonus','reaction','legendary','lair'].includes(ability.section))
    && (ability.castingSource===undefined || ['class','resource','free'].includes(ability.castingSource))
    && (ability.castingAlternative===undefined || integer(ability.castingAlternative))
    && (ability.targets===undefined || Array.isArray(ability.targets) && ability.targets.length<=ids.length
      && new Set(ability.targets.map(target=>target?.id)).size===ability.targets.length
      && ability.targets.every(target=>object(target) && ids.includes(target.id) && typeof target.damage==='string'
        && (target.damage==='' || target.damage.trim() && integer(Number(target.damage))) && typeof target.resolved==='boolean'))
    && (ability.execution===undefined || object(ability.execution) && idPattern.test(ability.execution.id)
      && ['casting','resolving'].includes(ability.execution.phase) && typeof ability.execution.option==='string' && ability.execution.option.length<=250
      && integer(ability.execution.cost) && ability.execution.cost>=1 && ability.ownerId!==null && !ability.active))) fail(400, 'Abilità del combattimento non valide.')
  const active=new Set(activeEffects(state.abilities).map(a=>a.id))
  return structuredClone({...state,abilities:state.abilities.map(a=>a.sourceEffectId!==undefined&&!active.has(a.id)?{...a,active:false}:a)})
}

export async function gamesRouter({ dataDir, authenticate }) {
  const file = resolve(dataDir, 'games.json')
  try { await writeFile(file, JSON.stringify({ version: 1, characters: [], games: [] }), { flag: 'wx', mode: 0o600 }) }
  catch (error) { if (error.code !== 'EEXIST') throw error }
  async function load() {
    const db = JSON.parse(await readFile(file, 'utf8'))
    if (db.version !== 1 || !Array.isArray(db.characters) || !Array.isArray(db.games)) throw new Error('Archivio delle partite non valido; originale conservato.')
    for (const character of db.characters) {
      validateSheet(character.sheet)
      if (character.id !== character.sheet.id || !idPattern.test(character.ownerId) || !(character.gameId === null || idPattern.test(character.gameId)) || !integer(character.revision)) throw new Error('Personaggio salvato non valido.')
    }
    for (const game of db.games) {
      if (!idPattern.test(game.id) || !idPattern.test(game.masterId) || typeof game.name !== 'string' || !/^[A-Za-z\d_-]{43}$/.test(game.inviteToken) || !Array.isArray(game.players) || !integer(game.revision)) throw new Error('Partita salvata non valida.')
      if (!game.players.every(player => object(player) && idPattern.test(player.userId) && idPattern.test(player.characterId) && (player.notes === undefined || validNotes(player.notes)))) throw new Error('Partecipazione salvata non valida.')
      validateState(game.state)
      if(game.reactionWindows!==undefined&&!validReactionWindows(game.reactionWindows))throw new Error('Finestre di reazione non valide; originale conservato.')
      if (game.requestsRevision!==undefined && !integer(game.requestsRevision) || game.combatRequests!==undefined && (!Array.isArray(game.combatRequests)
        || !game.combatRequests.every(validCombatRequest) || new Set(game.combatRequests.map(entry=>entry.id)).size!==game.combatRequests.length)) throw new Error('Richieste di combattimento non valide; originale conservato.')
      if (game.notificationRevision!==undefined && !integer(game.notificationRevision) || game.sheetChanges!==undefined && (!Array.isArray(game.sheetChanges) || !game.sheetChanges.every(entry=>object(entry)
        && [entry.id,entry.characterId,entry.ownerId,entry.actorId].every(id=>idPattern.test(id)) && typeof entry.actorName==='string' && typeof entry.characterName==='string'
        && ['master','player'].includes(entry.actorRole) && ['applied','rejected'].includes(entry.status) && typeof entry.createdAt==='string'
        && (entry.noticeRevision===undefined||integer(entry.noticeRevision)&&entry.noticeRevision>0) && Array.isArray(entry.readBy) && entry.readBy.every(id=>idPattern.test(id)) && Array.isArray(entry.changes) && entry.changes.length>0 && entry.changes.every(validChange)))) throw new Error('Storico delle modifiche non valido; originale conservato.')
    }
    return db
  }
  await load()
  // ponytail: una coda e un file per una sola istanza Node; passare a un DB transazionale prima di avviare più istanze.
  let queue = Promise.resolve()
  function write(operation) {
    const pending = queue.then(async () => {
      const db = await load(), result = operation(db), temporary = `${file}.${randomUUID()}.tmp`
      try { await writeFile(temporary, JSON.stringify(db), { mode: 0o600 }); await rename(temporary, file) }
      catch (error) { await unlink(temporary).catch(() => {}); throw error }
      return result
    })
    queue = pending.catch(() => {})
    return pending
  }
  const read = () => queue.then(load)
  const router = express.Router()
  router.use(authenticate)
  router.use(rateLimit({windowMs:60_000,limit:240,keyGenerator:req=>req.userId,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Troppe richieste. Attendi un minuto prima di riprovare.'}}))
  // Authenticate before accepting large portraits or a whole combat snapshot.
  router.use(express.json({limit:'32mb'}))
  router.use((_req, res, next) => { res.set('Cache-Control','no-store'); next() })
  const gameFor = (db, id, user) => {
    const game = db.games.find(game => game.id === id)
    if (!game || game.masterId !== user && !game.players.some(player => player.userId === user)) fail(404, 'Sessione non disponibile.')
    return game
  }
  const characterFor = (db, id, user) => {
    const character = db.characters.find(character => character.id === id)
    if (!character || character.ownerId !== user && !db.games.some(game => game.id === character.gameId && game.masterId === user)) fail(404, 'Personaggio non disponibile.')
    return character
  }
  const checkRevision = (record, revision) => { if (record.revision !== revision) fail(409, 'I dati sono cambiati in un’altra schermata. Ricarica prima di salvare; le modifiche aperte sono conservate.') }
  const summary = (game,user) => ({ id:game.id, name:game.name, role:game.masterId === user ? 'master' : 'player', revision:game.revision })
  const visibleChanges = (game,user) => (game.sheetChanges??[]).filter(entry=>game.masterId===user || entry.ownerId===user && (entry.actorId!==user || entry.status==='rejected') && game.players.some(player=>player.userId===user && player.characterId===entry.characterId))
  const notificationSummary = (game,user) => {
    const unread=new Set(visibleChanges(game,user).filter(entry=>!entry.readBy.includes(user)))
    const newestUnreadRevision=(game.sheetChanges??[]).reduce((latest,entry,index)=>unread.has(entry)?Math.max(latest,entry.noticeRevision??index+1):latest,0)
    return {revision:game.notificationRevision??0,unreadCount:unread.size,newestUnreadRevision}
  }
  const canReject = (game,entry) => entry.actorRole==='player' && entry.status==='applied' && game.players.some(player=>player.characterId===entry.characterId && player.userId===entry.ownerId)
  function saveSheet(game,record,sheet,req) {
    const changes=sheetChanges(record.sheet,sheet)
    if (!changes.length) return
    if (game?.players.some(player=>player.characterId===record.id && player.userId===record.ownerId)) {
      // ponytail: store only changed fields; the JSON journal grows with the session. Move it to paginated DB storage with the existing single-file store.
      ;(game.sheetChanges??=[]).push({id:randomUUID(),characterId:record.id,characterName:sheet.name,ownerId:record.ownerId,actorId:req.userId,actorName:req.username,
        actorRole:game.masterId===req.userId?'master':'player',createdAt:new Date().toISOString(),noticeRevision:(game.notificationRevision??0)+1,status:'applied',readBy:[req.userId],changes})
      game.notificationRevision=(game.notificationRevision??0)+1
    }
    record.sheet=sheet;record.revision++
  }
  function view(db,game,user) {
    const result = {...summary(game,user),notifications:notificationSummary(game,user),requestsRevision:game.requestsRevision??0,combatRequests:visibleRequests(game,user),reactionWindows:visibleReactions(game,user)}
    const records=db.characters.filter(character=>character.gameId===game.id)
    const state=structuredClone(game.state)
    state.abilities=recoverRepeatSaveDCs(game)
    state.turns=state.turns.map(turn=>{
      const record=records.find(character=>character.id===turn.sheet?.id)
      return record?{...turn,description:record.sheet.name,hitPoints:record.sheet.hitPoints,armorClass:record.sheet.armorClass,
        temporaryHitPoints:record.sheet.playerDetails?.temporaryHitPoints??'',sheet:{...record.sheet,abilities:turn.sheet.abilities}}:turn
    })
    // Project current effects on reads too: older casts may have no synchronized temporary stats.
    const settled=settleCombatEffects(state.abilities,state.turns)
    state.abilities=settled.abilities;state.turns=settled.turns
    const characters=records.map(record=>{
      const sheet=state.turns.find(turn=>turn.sheet?.id===record.id)?.sheet
      return sheet?{...record,sheet:{...record.sheet,playerDetails:sheet.playerDetails}}:record
    })
    if(result.role==='master'){
      result.newestPendingRequest=(game.combatRequests??[]).reduce((latest,entry,index)=>requestStatus(game,entry)==='pending'?index+1:latest,0)
      return {...result,inviteToken:game.inviteToken,characters,state}
    }
    const participant = game.players.find(player => player.userId === user)
    return { ...result, rollRequests:pendingSavingThrows(db,game,user), character:characters.find(character => character.id === participant.characterId),
      notes:participant.notes ?? {text:'',revision:0},
      effects:activeEffects(state.abilities).filter(ability => ability.active && (ability.timed === false || ability.remainingTurns > 0)
        && state.turns.some(turn => (turn.id === ability.ownerId || ability.targets?.some(target=>target.id===turn.id)) && turn.sheet?.id === participant.characterId)).map(ability => ({
          name:ability.name, duration:ability.duration, remainingTurns:ability.remainingTurns, timed:ability.timed !== false,
          concentration:ability.concentration === true,
          ...(typeof ability.description === 'string' ? {description:ability.description} : {}),
          ...(['start','end'].includes(ability.expiresAt) ? {expiresAt:ability.expiresAt} : {}),
          ...(typeof ability.repeatSave === 'string' ? {repeatSave:ability.repeatSave} : {}),
        })),
      turns:state.turns.map(turn => ({ name:db.characters.find(character => character.id === turn.sheet?.id)?.sheet.name ?? turn.description, current:game.state.combat?.activeId === turn.id })) }
  }
  function createCharacter(db, user, sheet, gameId = null, legacyId) {
    sheet = validateSheet(sheet)
    if (db.characters.some(character => character.id === sheet.id)) fail(409, 'Questo identificativo è già presente. Nessuna scheda è stata sovrascritta.')
    const record = { id:sheet.id, ownerId:user, gameId, revision:1, sheet, ...(legacyId ? {legacyId} : {}) }
    db.characters.push(record)
    return record
  }

  router.get('/games/:id/actions', async (req,res)=>{
    gameFor(await read(),req.params.id,req.userId)
    const rules=await combatRules(),db=await read(),game=gameFor(db,req.params.id,req.userId)
    res.json(actionChoices(actionContext(db,game,req.userId,rules,req.query.preview==='1'),game,db))
  })
  router.post('/games/:id/wind-direction',async(req,res)=>{
    gameFor(await read(),req.params.id,req.userId)
    const rules=await combatRules()
    res.json(await write(db=>{
      const game=gameFor(db,req.params.id,req.userId)
      if((game.reactionWindows??[]).some(reactionOpen))fail(409,'Attendi che siano risolte le reazioni.')
      const master=game.masterId===req.userId
      if(!object(req.body)||Object.keys(req.body).some(k=>!['id','revision','effectId','selected','saves'].includes(k)))fail(400,'Cambio direzione non valido.')
      if(!master&&req.body.saves!==undefined)fail(403,'Solo il Master può inserire i tiri salvezza.')
      const {saves,...command}=req.body
      const entry=createWindDirectionRequest(db,game,req.userId,command,rules,req.username)
      const existing=game.combatRequests?.some(e=>e.id===entry.id)
      if(master&&existing){
        if(entry.status!=='approved'||!isDeepStrictEqual(entry.resolution.wind.saves,saves??{}))fail(409,'Identificativo già usato: il cambio direzione è già stato registrato.')
      }else if(master){
        const result=applyCombatRequest(db,game,entry,rules,{confirmed:true,wind:{selected:command.selected,saves:saves??{}},targets:command.selected.map(id=>({id,damage:'0'}))})
        const state=validateState(result.state)
        for(const sheet of result.sheets){
          const record=db.characters.find(r=>r.id===sheet.id&&r.gameId===game.id)
          if(!record)fail(409,'Personaggio non più disponibile.')
          saveSheet(game,record,validateSheet(sheet),req)
        }
        game.state=state;game.revision++
        entry.resolution.wind=result.wind;entry.status='approved';entry.resolvedAt=new Date().toISOString()
      }
      if(!existing){(game.combatRequests??=[]).push(entry);game.requestsRevision=(game.requestsRevision??0)+1}
      return view(db,game,req.userId)
    }))
  })
  router.post('/games/:id/reactions',async(req,res)=>{
    const rules=await combatRules()
    res.json(await write(db=>{
      const game=gameFor(db,req.params.id,req.userId),event=req.body?.event
      if(game.masterId!==req.userId)fail(403,'Solo il Master può segnalare un evento di reazione.')
      checkRevision(game,req.body?.revision)
      if(!object(event)||!['hit','magic-missile','spell','damage','fall','other'].includes(event.kind)||typeof event.label!=='string'||event.label.length>500||!Array.isArray(event.targetIds)||event.targetIds.length>1000||!event.targetIds.every(id=>game.state.turns.some(t=>t.id===id))||event.actorId!==undefined&&!game.state.turns.some(t=>t.id===event.actorId)||event.requestId!==undefined)fail(400,'Evento di reazione non valido.')
      if((game.reactionWindows??[]).some(reactionOpen))fail(409,'C’è già una reazione da risolvere.')
      const groupId=openReactions(db,game,rules,{kind:event.kind,label:event.label,targetIds:event.targetIds,...(event.actorId===undefined?{}:{actorId:event.actorId})})
      return {game:view(db,game,req.userId),groupId}
    }))
  })
  router.get('/games/:id/reactions/:windowId/actions',async(req,res)=>{
    const rules=await combatRules(),db=await read(),game=gameFor(db,req.params.id,req.userId)
    const window=reactionWindow(game,req.userId,req.params.windowId)
    const context=actionContext(db,game,window.ownerId,rules,true,window.characterId,{keys:new Set(window.actionKeys)})
    if(context.record.id!==window.characterId)fail(409,'Personaggio non più disponibile.')
    const choices=actionChoices(context,game,db)
    res.json({...choices,actions:choices.actions.filter(a=>window.actionKeys.includes(a.key))})
  })
  router.post('/games/:id/reactions/:windowId/:decision',async(req,res)=>{
    if(!['activity','decline'].includes(req.params.decision))fail(400,'Decisione non valida.')
    res.json(await write(db=>{
      const game=gameFor(db,req.params.id,req.userId)
      const existing=game.reactionWindows?.find(w=>w.id===req.params.windowId&&(w.ownerId===req.userId||game.masterId===req.userId))
      if(existing&&req.params.decision==='decline'&&!reactionOpen(existing))return view(db,game,req.userId)
      const window=reactionWindow(game,req.userId,req.params.windowId)
      if(req.params.decision==='activity')window.expiresAt=Date.now()+30000
      else window.status='declined'
      game.requestsRevision=(game.requestsRevision??0)+1
      return view(db,game,req.userId)
    }))
  })
  router.post('/games/:id/requests', async (req,res)=>{
    gameFor(await read(),req.params.id,req.userId)
    const proposal=requestProposal(req.body),rules=await combatRules()
    res.json(await write(db=>{
      const game=gameFor(db,req.params.id,req.userId)
      const duplicate=game.combatRequests?.find(entry=>entry.id===proposal.id)
      if (duplicate) {
        if(duplicate.resolution?.plan.deferredSave&&proposal.mode==='save'&&!proposal.damageEnabled&&proposal.packets?.every(p=>p.die===undefined&&!p.damage.length))proposal.mode='none'
        if ((duplicate.ownerId!==req.userId&&!(game.masterId===req.userId&&duplicate.proposal.reactionId)) || !isDeepStrictEqual(duplicate.proposal,proposal)) fail(409,'Identificativo già usato da un’altra richiesta.')
        return view(db,game,req.userId)
      }
      checkRevision(game,proposal.revision)
      const window=proposal.reactionId?reactionWindow(game,req.userId,proposal.reactionId):undefined
      if(!window&&(game.reactionWindows??[]).some(reactionOpen))fail(409,'Attendi che siano risolte le reazioni prima di proporre un’altra azione.')
      const actorId=window?.ownerId??req.userId
      const context=actionContext(db,game,actorId,rules,!!window,window?.characterId)
      if(window&&context.record.id!==window.characterId)fail(409,'Personaggio non più disponibile.')
      if(window&&!window.actionKeys.includes(proposal.key))fail(403,'Reazione non prevista da questo evento.')
      if (game.combatRequests?.some(entry=>entry.characterId===context.record.id && requestStatus(game,entry)==='pending' && !!entry.proposal.reactionId===!!proposal.reactionId)) fail(409,'Hai già un’azione in attesa di approvazione.')
      if (!proposal.targets.every(target=>game.state.turns.some(turn=>turn.id===target.id))) fail(400,'Bersaglio non disponibile.')
      const targetSheets=proposal.targets.flatMap(target=>game.state.turns.find(turn=>turn.id===target.id)?.sheet?.id ?? [])
      if (new Set(targetSheets).size!==targetSheets.length) fail(400,'La stessa scheda compare in più bersagli: il Master deve correggere i partecipanti duplicati.')
      const {action,option}=prepareAction(context,proposal,rules)
      if(window)assertReactionAction(window,action,context)
      // Snapshot canonical attack/AC values for the Master's review and history; visibleRequests hides them from players.
      const entry={id:proposal.id,ownerId:actorId,characterId:context.record.id,characterName:context.record.sheet.name,actorName:req.username,
        ...(proposal.attackDie!==undefined?{weaponAttack:{edition:spellEdition(context.record.sheet),modifier:integerValue(action.attackBonus)}}:{}),
        ...(proposal.packets!==undefined?{resolution:createRequestResolution(db,game,context,action,proposal,rules)}:{}),
        ...(proposal.sleepRoll!==undefined?{sleepReview:createSleepReview(context,proposal)}:{}),
        actionName:action.ability.name,optionLabel:option.label,prolonged:action.info.prolonged || option.id==='ritual',createdAt:new Date().toISOString(),status:'pending',proposal,
        targets:proposal.targets.map(target=>{const turn=game.state.turns.find(turn=>turn.id===target.id),record=db.characters.find(record=>record.gameId===game.id&&record.id===turn.sheet?.id);return {...target,name:record?.sheet.name ?? turn.description,...(proposal.attackDie!==undefined?{armorClass:integerValue(record?record.sheet.armorClass:turn.armorClass)}:{})}})}
      if (!validCombatRequest(entry)) fail(400,'Testo dell’azione o dei bersagli troppo lungo.')
      ;(game.combatRequests??=[]).push(entry)
      if(window){window.status='submitted';window.requestId=entry.id}
      else {const event=requestReactionEvent(entry,context);if(event)openReactions(db,game,rules,event,entry.id)}
      game.requestsRevision=(game.requestsRevision??0)+1
      return view(db,game,req.userId)
    }))
  })
  router.post('/games/:id/requests/:requestId/roll', async(req,res)=>{
    gameFor(await read(),req.params.id,req.userId)
    const rules=['wind','wind-refresh','refresh'].includes(req.body?.kind)?await combatRules():undefined
    res.json(await write(db=>{
      const game=gameFor(db,req.params.id,req.userId),entry=game.combatRequests?.find(e=>e.id===req.params.requestId)
      if(!entry)fail(404,'Richiesta non disponibile.')
      checkRevision(game,req.body?.revision)
      recordResolutionRoll(db,game,req.userId,entry,req.body,rules)
      return view(db,game,req.userId)
    }))
  })

  router.post('/games/:id/requests/:requestId/:decision', async (req,res)=>{
    const initial=gameFor(await read(),req.params.id,req.userId)
    if (initial.masterId!==req.userId) fail(403,'Solo il Master può approvare o rifiutare un’azione.')
    if (!['approve','reject'].includes(req.params.decision)) fail(400,'Decisione non valida.')
    const rules=await combatRules()
    res.json(await write(db=>{
      const game=gameFor(db,req.params.id,req.userId)
      if (game.masterId!==req.userId) fail(403,'Solo il Master può decidere.')
      const entry=game.combatRequests?.find(entry=>entry.id===req.params.requestId),status=req.params.decision==='approve'?'approved':'rejected'
      if (!entry) fail(404,'Richiesta non disponibile.')
      if (entry.status===status) return view(db,game,req.userId)
      if (entry.status!=='pending') fail(409,'Questa richiesta è già stata conclusa.')
      checkRevision(game,req.body?.revision)
      if (status==='approved') {
        if(entry.proposal.reactionId&&!game.reactionWindows?.some(w=>w.id===entry.proposal.reactionId&&w.requestId===entry.id&&w.ownerId===entry.ownerId&&w.status==='submitted'))fail(409,'La reazione non è più valida.')
        if(!entry.proposal.reactionId&&(game.reactionWindows??[]).some(reactionOpen))fail(409,'Attendi la scelta delle reazioni prima di applicare questa azione.')
        if (requestStatus(game,entry)!=='pending') fail(409,'Turno o dati della sessione cambiati: chiedi al giocatore una nuova richiesta.')
        const result=applyCombatRequest(db,game,entry,rules,req.body)
        const state=validateState(result.state)
        for (const sheet of result.sheets) {
          const record=db.characters.find(record=>record.id===sheet.id && record.gameId===game.id)
          if (!record) fail(409,'Personaggio non più disponibile.')
          saveSheet(game,record,validateSheet(sheet),req)
        }
        game.state=state;game.revision++
        if(result.wind)entry.resolution.wind=result.wind
        if(result.sleepReview)entry.sleepReview=result.sleepReview
        entry.targets=entry.targets.map(target=>({...target,damage:result.targets.find(final=>final.id===target.id)?.damage??target.damage}))
      }
      if(status==='rejected')for(const window of game.reactionWindows??[])if(window.event.requestId===entry.id){window.status='declined';const child=game.combatRequests.find(r=>r.id===window.requestId);if(child?.status==='pending'){child.status='rejected';child.resolvedAt=new Date().toISOString()}}
      entry.status=status;entry.resolvedAt=new Date().toISOString();finishReaction(db,game,entry,rules);game.requestsRevision=(game.requestsRevision??0)+1
      return view(db,game,req.userId)
    }))
  })

  router.get('/home', async (req,res) => {
    const db = await read(), user = req.userId
    res.json({ characters:db.characters.filter(character => character.ownerId === user), games:db.games.filter(game => game.masterId === user || game.players.some(player => player.userId === user)).map(game => summary(game,user)) })
  })
  router.post('/characters', async (req,res) => res.status(201).json(await write(db => createCharacter(db,req.userId,req.body?.sheet))))
  router.get('/characters/:id', async (req,res) => res.json(characterFor(await read(),req.params.id,req.userId)))
  router.put('/characters/:id', async (req,res) => res.json(await write(db => {
    const record = characterFor(db,req.params.id,req.userId)
    checkRevision(record,req.body?.revision)
    const sheet = validateSheet(req.body?.sheet)
    if (sheet.id !== record.id || record.gameId && record.sheet.kind === 'PG' && sheet.kind !== 'PG') fail(400, 'Identità e tipo del personaggio non modificabili nella sessione.')
    const game = db.games.find(game => game.id === record.gameId)
    saveSheet(game,record,sheet,req)
    if (game) game.revision++
    return record
  })))
  router.delete('/characters/:id', async (req,res) => res.json(await write(db => {
    const record = characterFor(db,req.params.id,req.userId)
    if (record.ownerId !== req.userId) fail(403, 'Solo il proprietario può eliminare il personaggio.')
    if (record.gameId) fail(409, 'Il personaggio è in una sessione. Esci dalla sessione o chiudila prima di eliminarlo.')
    db.characters = db.characters.filter(character => character.id !== record.id)
    return {ok:true}
  })))
  router.post('/import', async (req,res) => res.json(await write(db => {
    if (!Array.isArray(req.body?.sheets) || req.body.sheets.length > 500) fail(400, 'Importazione non valida.')
    const imported = []
    for (const original of req.body.sheets) {
      if(typeof original?.id!=='string'||!original.id.trim()||original.id.length>200)fail(400,'Identificativo della scheda precedente non valido.')
      const migrated=validateSheet({...original,id:randomUUID()})
      let record = db.characters.find(character => character.ownerId === req.userId && character.legacyId === original.id)
      if (!record) record = createCharacter(db,req.userId,migrated,null,original.id)
      imported.push(record)
    }
    return {characters:imported}
  })))
  router.post('/games', async (req,res) => res.status(201).json(await write(db => {
    const name = req.body?.name
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) fail(400, 'Inserisci un nome della sessione tra 1 e 100 caratteri.')
    const game = {id:randomUUID(), name:name.trim(), masterId:req.userId, inviteToken:randomBytes(32).toString('base64url'), players:[], revision:1, state:{turns:[],abilities:[],combat:null}}
    db.games.push(game)
    return view(db,game,req.userId)
  })))
  router.get('/games/:id', async (req,res) => {
    const db = await read()
    res.json(view(db,gameFor(db,req.params.id,req.userId),req.userId))
  })
  router.get(['/games/:id/notifications','/games/:id/history'], async (req,res) => {
    const db=await read(),game=gameFor(db,req.params.id,req.userId),history=/\/history\/?$/i.test(req.path)
    const participant=game.players.find(player=>player.userId===req.userId)
    if (history&&!participant) fail(403,'La cronologia personale è riservata al giocatore della scheda.')
    const character=history ? db.characters.find(record=>record.id===participant.characterId && record.ownerId===req.userId && record.gameId===game.id) : undefined
    if (history&&!character) fail(404,'Scheda non disponibile.')
    const entries=(history ? (game.sheetChanges??[]).filter(entry=>entry.ownerId===req.userId && entry.characterId===participant.characterId) : visibleChanges(game,req.userId)).toReversed()
    const before=req.query.before
    if (before!==undefined && (typeof before!=='string' || !entries.some(entry=>entry.id===before))) fail(400,'Pagina dello storico non valida. Riapri le notifiche.')
    const start=before===undefined?0:entries.findIndex(entry=>entry.id===before)+1,items=entries.slice(start,start+20)
    res.json({revision:history ? character.revision : game.notificationRevision??0,items:items.map(entry=>({...entry,read:entry.readBy.includes(req.userId),readBy:undefined,canReject:!history && game.masterId===req.userId && canReject(game,entry)})),next:start+items.length<entries.length?items.at(-1).id:null})
  })
  router.post('/games/:id/notifications/:changeId/read', async (req,res) => res.json(await write(db=>{
    const game=gameFor(db,req.params.id,req.userId),entry=visibleChanges(game,req.userId).find(entry=>entry.id===req.params.changeId)
    if (!entry) fail(404,'Notifica non disponibile.')
    if (!entry.readBy.includes(req.userId)) {entry.readBy.push(req.userId);game.notificationRevision=(game.notificationRevision??0)+1}
    return notificationSummary(game,req.userId)
  })))
  router.post('/games/:id/notifications/:changeId/reject', async (req,res) => res.json(await write(db=>{
    const game=gameFor(db,req.params.id,req.userId)
    if (game.masterId!==req.userId) fail(403,'Solo il Master può rifiutare le modifiche dei giocatori.')
    const entry=(game.sheetChanges??[]).find(entry=>entry.id===req.params.changeId)
    if (!entry || entry.actorRole!=='player') fail(404,'Modifica del giocatore non disponibile.')
    if (entry.status==='rejected') return view(db,game,req.userId)
    checkRevision(game,req.body?.revision)
    const record=db.characters.find(record=>record.id===entry.characterId && record.gameId===game.id && record.ownerId===entry.ownerId)
    if (!record || !canReject(game,entry)) fail(409,'Il personaggio non è più in questa sessione.')
    const subsequent=game.sheetChanges.slice(game.sheetChanges.indexOf(entry)+1).filter(item=>item.characterId===entry.characterId)
    if (entry.changes.some(change=>!isDeepStrictEqual(valueAt(record.sheet,change.path),change.after) || subsequent.some(item=>item.changes.some(later=>samePath(change.path,later.path))))) fail(409,'Ripristino non applicato: uno dei campi è stato modificato successivamente. Controlla lo storico e correggi la scheda manualmente; nessun dato è stato sovrascritto.')
    const restored=structuredClone(record.sheet)
    for (const change of entry.changes) {
      const target=change.path.length===2 ? (restored.playerDetails??={}) : restored,key=change.path.at(-1)
      if (change.before===null) delete target[key]
      else target[key]=structuredClone(change.before)
    }
    record.sheet=validateSheet(restored);record.revision++
    entry.status='rejected';entry.rejectedAt=new Date().toISOString();entry.noticeRevision=(game.notificationRevision??0)+1;entry.readBy=[req.userId]
    game.notificationRevision=(game.notificationRevision??0)+1;game.revision++
    return view(db,game,req.userId)
  })))
  router.put('/games/:id/notes', async (req,res) => res.json(await write(db => {
    const game = gameFor(db,req.params.id,req.userId)
    const player = game.players.find(player => player.userId === req.userId)
    if (!player) fail(403, 'Gli appunti sono privati del giocatore.')
    if (!validNotes(req.body) || Object.keys(req.body).some(key => !['text','revision'].includes(key))) fail(400, 'Appunti non validi: massimo 20.000 caratteri.')
    checkRevision(player.notes ?? {revision:0},req.body.revision)
    // Private notes have their own revision: writing them must not conflict with the Master's combat edits.
    player.notes = {text:req.body.text,revision:req.body.revision + 1}
    return player.notes
  })))
  router.post('/games/:id/characters', async (req,res) => res.json(await write(db => {
    const game=gameFor(db,req.params.id,req.userId)
    if(game.masterId!==req.userId)fail(403,'Solo il Master può aggiungere schede alla sessione.')
    checkRevision(game,req.body?.revision)
    const character=db.characters.find(character=>character.id===req.body?.characterId&&character.ownerId===req.userId)
    if(!character)fail(404,'Scegli una tua scheda disponibile.')
    if(character.gameId)fail(409,'Questa scheda è già in una sessione.')
    character.gameId=game.id;character.revision++;game.revision++
    return view(db,game,req.userId)
  })))
  router.post('/games/:id/characters/:characterId/remove', async (req,res) => res.json(await write(db => {
    const game=gameFor(db,req.params.id,req.userId)
    if(game.masterId!==req.userId)fail(403,'Operazione riservata al Master.')
    checkRevision(game,req.body?.revision)
    const record=db.characters.find(character=>character.id===req.params.characterId&&character.gameId===game.id&&character.ownerId===req.userId)
    if(!record)fail(403,'Il Master può rimuovere soltanto le proprie schede. I personaggi dei giocatori restano ai loro proprietari.')
    const ids=game.state.turns.filter(turn=>turn.sheet?.id===record.id).map(turn=>turn.id)
    if (game.state.abilities.some(ability=>ability.execution && (ids.includes(ability.ownerId) || ability.targets?.some(target=>ids.includes(target.id))))) fail(409,'Concludi o interrompi prima l’utilizzo che coinvolge questa creatura.')
    record.gameId=null;record.revision++
    game.state.turns=game.state.turns.filter(turn=>!ids.includes(turn.id));game.state.abilities=game.state.abilities.filter(ability=>!ids.includes(ability.ownerId))
    for (const ability of game.state.abilities) if (ability.targets) ability.targets=ability.targets.filter(target=>!ids.includes(target.id))
    if(ids.includes(game.state.combat?.activeId))game.state.combat=game.state.turns.length?{...game.state.combat,activeId:game.state.turns[0].id}:null
    game.revision++
    return view(db,game,req.userId)
  })))
  router.put('/games/:id/state', async (req,res) => res.json(await write(db => {
    const game = gameFor(db,req.params.id,req.userId)
    if (game.masterId !== req.userId) fail(403, 'La gestione del combattimento è riservata al Master.')
    checkRevision(game,req.body?.revision)
    if((game.reactionWindows??[]).some(reactionOpen))fail(409,'Risolvi prima le reazioni in attesa di questo evento.')
    const previous=view(db,game,req.userId)
    const before=structuredClone({state:previous.state,sheets:previous.characters.map(record=>record.sheet)})
    const state = validateState(req.body?.state), sheets = req.body?.sheets
    if (!Array.isArray(sheets) || sheets.length > 500 || new Set(sheets.map(sheet => sheet.id)).size !== sheets.length) fail(400, 'Elenco delle schede non valido.')
    for (const original of sheets) {
      const sheet = validateSheet(original), record = db.characters.find(character => character.id === sheet.id)
      if (!record) createCharacter(db,req.userId,sheet,game.id)
      else {
        if (record.gameId !== game.id) fail(403, 'Questo personaggio non appartiene alla sessione.')
        if (record.sheet.kind === 'PG' && record.ownerId !== req.userId && sheet.kind !== 'PG') fail(400, 'Il personaggio del giocatore deve restare un PG.')
        saveSheet(game,record,sheet,req)
      }
    }
    for (const turn of state.turns) if (turn.sheet) {
      const record = db.characters.find(character => character.id === turn.sheet.id)
      if (record && record.gameId !== game.id || !record && turn.sheet.kind === 'PG') fail(403, 'Personaggio estraneo alla sessione.')
      if (record) {turn.sheet = {...record.sheet,abilities:turn.sheet.abilities};turn.hitPoints=record.sheet.hitPoints;turn.armorClass=record.sheet.armorClass;turn.description=record.sheet.name}
    }
    const settled=settleCombatEffects(state.abilities,state.turns)
    for(const turn of settled.turns)if(turn.sheet&&turn.sheet!==state.turns.find(t=>t.id===turn.id)?.sheet) {
      const record=db.characters.find(c=>c.id===turn.sheet.id&&c.gameId===game.id)
      if(record)saveSheet(game,record,turn.sheet,req)
    }
    state.abilities=settled.abilities;state.turns=settled.turns
    // Removing a card must not delete another user's character or its membership.
    game.state=state
    const current=view(db,game,req.userId)
    if(isDeepStrictEqual(before,{state:current.state,sheets:current.characters.map(record=>record.sheet)}))return current
    game.revision++
    return view(db,game,req.userId)
  })))
  router.get('/invites/:token', async (req,res) => {
    const db = await read(), game = db.games.find(game => game.inviteToken === req.params.token)
    if (!game) fail(404, 'Invito non valido o sessione non più disponibile.')
    const joined = game.masterId === req.userId || game.players.some(player => player.userId === req.userId)
    res.json({id:game.id,name:game.name,joined})
  })
  router.post('/invites/:token/join', async (req,res) => res.json(await write(db => {
    const game = db.games.find(game => game.inviteToken === req.params.token)
    if (!game) fail(404, 'Invito non valido o sessione non più disponibile.')
    if (game.masterId === req.userId || game.players.some(player => player.userId === req.userId)) return {id:game.id}
    let record
    if (req.body?.sheet) {
      if (req.body.sheet.kind !== 'PG') fail(400, 'Per partecipare serve un personaggio giocante.')
      record = createCharacter(db,req.userId,req.body.sheet)
    } else record = db.characters.find(character => character.id === req.body?.characterId && character.ownerId === req.userId)
    if (!record) fail(404, 'Scegli un tuo personaggio disponibile.')
    if (record.gameId || record.sheet.kind !== 'PG') fail(409, 'Il personaggio è già in una sessione o non è un PG.')
    record.gameId=game.id;record.revision++
    game.players.push({userId:req.userId,characterId:record.id});game.revision++
    return {id:game.id}
  })))
  router.post('/games/:id/leave', async (req,res) => res.json(await write(db => {
    const game = gameFor(db,req.params.id,req.userId)
    if (game.masterId === req.userId) fail(409, 'Il Master può chiudere la sessione.')
    const player = game.players.find(player => player.userId === req.userId)
    const record = db.characters.find(character => character.id === player.characterId)
    record.gameId=null;record.revision++
    const ids = game.state.turns.filter(turn => turn.sheet?.id === record.id).map(turn => turn.id)
    game.state.turns=game.state.turns.filter(turn => !ids.includes(turn.id))
    game.state.abilities=game.state.abilities.filter(ability => !ids.includes(ability.ownerId))
    for (const ability of game.state.abilities) if (ability.targets) ability.targets=ability.targets.filter(target=>!ids.includes(target.id))
    if (ids.includes(game.state.combat?.activeId)) game.state.combat=game.state.turns.length ? {...game.state.combat,activeId:game.state.turns[0].id} : null
    game.players=game.players.filter(player => player.userId !== req.userId);game.revision++
    return {ok:true}
  })))
  router.delete('/games/:id', async (req,res) => res.json(await write(db => {
    const game=gameFor(db,req.params.id,req.userId)
    if (game.masterId !== req.userId) fail(403, 'Solo il Master può chiudere la sessione.')
    for (const character of db.characters) if (character.gameId === game.id) {character.gameId=null;character.revision++}
    db.games=db.games.filter(item => item.id !== game.id)
    return {ok:true}
  })))
  return router
}
