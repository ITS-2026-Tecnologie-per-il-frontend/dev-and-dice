import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import sessionFileStore from 'session-file-store'
import { rateLimit } from 'express-rate-limit'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scryptAsync = promisify(scrypt)
const usernamePattern = /^[A-Za-z0-9._-]{3,24}$/
const passwordMinLength = 8
const passwordMaxLength = 128
const sessionMaxAge = 7 * 24 * 60 * 60 * 1000
const SessionStore = sessionFileStore(session)

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function makePasswordHash(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, 64)
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`
}

async function verifyPassword(password, passwordHash) {
  const [salt, expectedHex] = passwordHash.split(':')
  if (!salt || !/^[a-f0-9]{128}$/.test(expectedHex ?? '')) return false
  const actual = Buffer.from(await scryptAsync(password, salt, 64))
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function validUserRecord(user) {
  return user !== null
    && typeof user === 'object'
    && typeof user.id === 'string'
    && typeof user.username === 'string'
    && typeof user.usernameKey === 'string'
    && typeof user.passwordHash === 'string'
    && typeof user.createdAt === 'string'
}

export async function createApp({
  dataDir = resolve(projectRoot, 'server', 'data'),
  production = process.env.NODE_ENV === 'production',
  sessionSecret = process.env.SESSION_SECRET,
} = {}) {
  if (production && (!sessionSecret || Buffer.byteLength(sessionSecret) < 32)) {
    throw new Error('In produzione SESSION_SECRET deve contenere almeno 32 byte casuali.')
  }

  const usersFile = resolve(dataDir, 'users.json')
  const sessionsDir = resolve(dataDir, 'sessions')
  await mkdir(sessionsDir, { recursive: true, mode: 0o700 })
  if (!existsSync(usersFile)) {
    await writeFile(usersFile, '[]\n', { flag: 'wx', mode: 0o600 })
  }

  async function loadUsers() {
    const content = await readFile(usersFile, 'utf8')
    let users
    try {
      users = JSON.parse(content)
    } catch (cause) {
      throw new Error('Il file degli utenti non contiene JSON valido.', { cause })
    }
    if (!Array.isArray(users) || !users.every(validUserRecord)) {
      throw new Error('Il file degli utenti ha una struttura non valida.')
    }
    return users
  }

  let usersQueue = Promise.resolve()
  function mutateUsers(callback) {
    const operation = usersQueue.then(async () => {
      const users = await loadUsers()
      const result = await callback(users)
      const temporaryFile = `${usersFile}.${randomUUID()}.tmp`
      try {
        await writeFile(temporaryFile, `${JSON.stringify(users, null, 2)}\n`, { mode: 0o600 })
        await rename(temporaryFile, usersFile)
      } catch (error) {
        try {
          await unlink(temporaryFile)
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') throw cleanupError
        }
        throw error
      }
      return result
    })
    usersQueue = operation.catch(() => {})
    return operation
  }

  function readUsers() {
    return usersQueue.then(loadUsers)
  }

  const app = express()
  const store = new SessionStore({
    path: sessionsDir,
    ttl: Math.floor(sessionMaxAge / 1000),
    retries: 0,
  })
  const secret = sessionSecret ?? randomBytes(32).toString('hex')

  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))
  app.use(session({
    name: 'dev-and-dice.sid',
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: production,
      maxAge: sessionMaxAge,
      path: '/',
    },
  }))

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Troppi tentativi. Riprova tra qualche minuto.' },
  })

  function regenerateSession(req) {
    return new Promise((resolvePromise, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolvePromise())
    })
  }

  function saveSession(req) {
    return new Promise((resolvePromise, reject) => {
      req.session.save((error) => error ? reject(error) : resolvePromise())
    })
  }

  app.post('/api/register', authLimiter, async (req, res, next) => {
    try {
      const { username, password } = req.body ?? {}
      if (typeof username !== 'string' || !usernamePattern.test(username)) {
        throw new HttpError(400, 'Il nome utente deve avere 3-24 caratteri: lettere, numeri, punto, trattino o underscore.')
      }
      if (typeof password !== 'string' || password.length < passwordMinLength || password.length > passwordMaxLength) {
        throw new HttpError(400, `La password deve contenere da ${passwordMinLength} a ${passwordMaxLength} caratteri.`)
      }

      const usernameKey = username.toLocaleLowerCase('en-US')
      const user = await mutateUsers(async (users) => {
        if (users.some((record) => record.usernameKey === usernameKey)) {
          throw new HttpError(409, 'Questo nome utente è già registrato.')
        }
        const record = {
          id: randomUUID(),
          username,
          usernameKey,
          passwordHash: await makePasswordHash(password),
          createdAt: new Date().toISOString(),
        }
        users.push(record)
        return record
      })

      await regenerateSession(req)
      req.session.userId = user.id
      await saveSession(req)
      res.status(201).json({ user: { id: user.id, username: user.username } })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/login', authLimiter, async (req, res, next) => {
    try {
      const { username, password } = req.body ?? {}
      if (typeof username !== 'string' || typeof password !== 'string'
        || username.length > 24 || password.length > passwordMaxLength) {
        throw new HttpError(400, 'Inserisci nome utente e password validi.')
      }
      const usernameKey = username.toLocaleLowerCase('en-US')
      const users = await readUsers()
      const user = users.find((record) => record.usernameKey === usernameKey)
      const dummyHash = await dummyPasswordHash
      const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash)
      if (!user || !valid) throw new HttpError(401, 'Nome utente o password non corretti.')

      await regenerateSession(req)
      req.session.userId = user.id
      await saveSession(req)
      res.json({ user: { id: user.id, username: user.username } })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/me', async (req, res, next) => {
    try {
      if (typeof req.session.userId !== 'string') throw new HttpError(401, 'Accesso richiesto.')
      const users = await readUsers()
      const user = users.find((record) => record.id === req.session.userId)
      if (!user) throw new HttpError(401, 'Accesso richiesto.')
      res.json({ user: { id: user.id, username: user.username } })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/logout', async (req, res, next) => {
    try {
      if (req.session) {
        req.session.userId = undefined
        await saveSession(req)
      }
      req.session.destroy((error) => {
        if (error) return next(error)
        res.clearCookie('dev-and-dice.sid', {
          httpOnly: true,
          sameSite: 'lax',
          secure: production,
          path: '/',
        })
        res.json({ ok: true })
      })
    } catch (error) {
      next(error)
    }
  })

  if (production) {
    app.use(express.static(resolve(projectRoot, 'dist'), { index: false }))
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api/')) return next()
      res.sendFile(resolve(projectRoot, 'dist', 'index.html'))
    })
  }

  app.use((error, req, res, _next) => {
    if (res.headersSent) return
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message })
    }
    if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ error: 'Richiesta non valida.' })
    }
    console.error('Errore durante la richiesta:', error)
    res.status(500).json({ error: 'Errore interno del server.' })
  })

  app.locals.sessionStore = store
  return app
}

const dummyPasswordHash = makePasswordHash(randomBytes(32).toString('hex'))
const launchedFile = process.argv[1] ? resolve(process.argv[1]) : ''
if (launchedFile === fileURLToPath(import.meta.url)) {
  const app = await createApp()
  const port = Number(process.env.PORT ?? 3001)
  app.listen(port, () => {
    console.log(`Dev & Dice server in ascolto sulla porta ${port}`)
  })
}
