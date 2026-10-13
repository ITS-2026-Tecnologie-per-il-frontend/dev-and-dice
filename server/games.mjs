import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import express from 'express'
import { rateLimit } from 'express-rate-limit'

const fields = 'name kind race characterClass level hitPoints armorClass initiative speed strength dexterity constitution intelligence wisdom charisma notes'.split(' ')
const numeric = 'hitPoints armorClass initiative strength dexterity constitution intelligence wisdom charisma'.split(' ')
const durations = ['1 minuto','10 minuti','1 ora','8 ore','24 ore','Personalizzata','Senza conteggio']
const object = value => !!value && typeof value === 'object' && !Array.isArray(value)
const idPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error }
const integer = value => Number.isSafeInteger(value) && value >= 0
const validNotes = value => object(value) && typeof value.text === 'string' && value.text.length <= 20_000 && integer(value.revision)

export function validateSheet(sheet) {
  if (!object(sheet) || !idPattern.test(sheet.id) || !fields.every(key => typeof sheet[key] === 'string')
      || !['PG','Mostro','PNG'].includes(sheet.kind) || !sheet.name.trim() || sheet.name.length > 160
      || !numeric.every(key => sheet[key] === '' || sheet[key].trim() && Number.isSafeInteger(Number(sheet[key])))
      || !Array.isArray(sheet.abilities) || sheet.abilities.length > 1000
      || !sheet.abilities.every(ability => object(ability) && typeof ability.name === 'string' && durations.includes(ability.duration)
        && (ability.remainingTurns === undefined || integer(ability.remainingTurns))
        && ['catalogId','description','ruleId','repeatSave'].every(key=>ability[key]===undefined||typeof ability[key]==='string')
        && ['timed','concentration'].every(key=>ability[key]===undefined||typeof ability[key]==='boolean')
        && (ability.expiresAt===undefined||['start','end'].includes(ability.expiresAt)))
      || sheet.catalogId!==undefined&&typeof sheet.catalogId!=='string'
      || sheet.playerDetails !== undefined && (!object(sheet.playerDetails) || !Object.entries(sheet.playerDetails).every(([key,value]) =>
        !['__proto__','constructor','prototype'].includes(key) && typeof value === 'string'))) fail(400, 'Scheda non valida: verifica nome, statistiche e abilità.')
  const allowed = new Set([...fields,'id','abilities','playerDetails','catalogId'])
  if (Object.keys(sheet).some(key => !allowed.has(key))) fail(400, 'La scheda contiene campi non consentiti.')
  if (sheet.playerDetails?.portrait && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z\d+/=]+$/.test(sheet.playerDetails.portrait)) fail(400, 'Il ritratto deve essere un’immagine PNG, JPEG o WebP.')
  return structuredClone(sheet)
}

function validateState(state) {
  if (!object(state) || !Array.isArray(state.turns) || !Array.isArray(state.abilities) || state.turns.length > 1000 || state.abilities.length > 2000) fail(400, 'Combattimento non valido.')
  const ids = state.turns.map(turn => turn.id)
  if (new Set(ids).size !== ids.length || !state.turns.every(turn => object(turn) && integer(turn.id)
    && ['description','initiative','hitPoints','armorClass','temporaryHitPoints'].every(key => typeof turn[key] === 'string')
    && ['initiative','hitPoints','armorClass','temporaryHitPoints'].every(key => turn[key] === '' || turn[key].trim() && Number.isSafeInteger(Number(turn[key]))))) fail(400, 'Partecipanti non validi.')
  for (const turn of state.turns) if (turn.sheet) validateSheet(turn.sheet)
  if (state.combat !== null && (!object(state.combat) || !ids.includes(state.combat.activeId) || !Number.isSafeInteger(state.combat.round) || state.combat.round < 1)) fail(400, 'Turno attuale non valido.')
  if (new Set(state.abilities.map(ability => ability.id)).size !== state.abilities.length || !state.abilities.every(ability => object(ability) && integer(ability.id)
    && typeof ability.name === 'string' && durations.includes(ability.duration) && integer(ability.remainingTurns) && typeof ability.active === 'boolean'
    && (ability.ownerId === null || ids.includes(ability.ownerId)))) fail(400, 'Abilità del combattimento non valide.')
  return structuredClone(state)
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
  function view(db,game,user) {
    const result = summary(game,user)
    if (result.role === 'master') {
      const characters = db.characters.filter(character => character.gameId === game.id)
      const state = structuredClone(game.state)
      state.turns = state.turns.map(turn => {
        const record = characters.find(character => character.id === turn.sheet?.id)
        return record ? { ...turn, description:record.sheet.name, hitPoints:record.sheet.hitPoints, armorClass:record.sheet.armorClass,
          temporaryHitPoints:record.sheet.playerDetails?.temporaryHitPoints ?? '', sheet:{...record.sheet,abilities:turn.sheet.abilities} } : turn
      })
      return { ...result, inviteToken:game.inviteToken, characters, state }
    }
    const participant = game.players.find(player => player.userId === user)
    return { ...result, character:db.characters.find(character => character.id === participant.characterId),
      notes:participant.notes ?? {text:'',revision:0},
      effects:game.state.abilities.filter(ability => ability.active && (ability.timed === false || ability.remainingTurns > 0)
        && game.state.turns.some(turn => turn.id === ability.ownerId && turn.sheet?.id === participant.characterId)).map(ability => ({
          name:ability.name, duration:ability.duration, remainingTurns:ability.remainingTurns, timed:ability.timed !== false,
          concentration:ability.concentration === true,
          ...(typeof ability.description === 'string' ? {description:ability.description} : {}),
          ...(['start','end'].includes(ability.expiresAt) ? {expiresAt:ability.expiresAt} : {}),
          ...(typeof ability.repeatSave === 'string' ? {repeatSave:ability.repeatSave} : {}),
        })),
      turns:game.state.turns.map(turn => ({ name:db.characters.find(character => character.id === turn.sheet?.id)?.sheet.name ?? turn.description, current:game.state.combat?.activeId === turn.id })) }
  }
  function createCharacter(db, user, sheet, gameId = null, legacyId) {
    sheet = validateSheet(sheet)
    if (db.characters.some(character => character.id === sheet.id)) fail(409, 'Questo identificativo è già presente. Nessuna scheda è stata sovrascritta.')
    const record = { id:sheet.id, ownerId:user, gameId, revision:1, sheet, ...(legacyId ? {legacyId} : {}) }
    db.characters.push(record)
    return record
  }

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
    record.sheet = sheet; record.revision++
    const game = db.games.find(game => game.id === record.gameId)
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
    record.gameId=null;record.revision++
    const ids=game.state.turns.filter(turn=>turn.sheet?.id===record.id).map(turn=>turn.id)
    game.state.turns=game.state.turns.filter(turn=>!ids.includes(turn.id));game.state.abilities=game.state.abilities.filter(ability=>!ids.includes(ability.ownerId))
    if(ids.includes(game.state.combat?.activeId))game.state.combat=game.state.turns.length?{...game.state.combat,activeId:game.state.turns[0].id}:null
    game.revision++
    return view(db,game,req.userId)
  })))
  router.put('/games/:id/state', async (req,res) => res.json(await write(db => {
    const game = gameFor(db,req.params.id,req.userId)
    if (game.masterId !== req.userId) fail(403, 'La gestione del combattimento è riservata al Master.')
    checkRevision(game,req.body?.revision)
    const state = validateState(req.body?.state), sheets = req.body?.sheets
    if (!Array.isArray(sheets) || sheets.length > 500 || new Set(sheets.map(sheet => sheet.id)).size !== sheets.length) fail(400, 'Elenco delle schede non valido.')
    for (const original of sheets) {
      const sheet = validateSheet(original), record = db.characters.find(character => character.id === sheet.id)
      if (!record) createCharacter(db,req.userId,sheet,game.id)
      else {
        if (record.gameId !== game.id) fail(403, 'Questo personaggio non appartiene alla sessione.')
        if (record.sheet.kind === 'PG' && record.ownerId !== req.userId && sheet.kind !== 'PG') fail(400, 'Il personaggio del giocatore deve restare un PG.')
        if (JSON.stringify(record.sheet) !== JSON.stringify(sheet)) {record.sheet = sheet;record.revision++}
      }
    }
    for (const turn of state.turns) if (turn.sheet) {
      const record = db.characters.find(character => character.id === turn.sheet.id)
      if (record && record.gameId !== game.id || !record && turn.sheet.kind === 'PG') fail(403, 'Personaggio estraneo alla sessione.')
      if (record) {turn.sheet = {...record.sheet,abilities:turn.sheet.abilities};turn.hitPoints=record.sheet.hitPoints;turn.armorClass=record.sheet.armorClass;turn.description=record.sheet.name}
    }
    // Removing a card must not delete another user's character or its membership.
    game.state = state; game.revision++
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
