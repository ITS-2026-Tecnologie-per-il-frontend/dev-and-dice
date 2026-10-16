import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createApp } from '../server/index.mjs'

test('registration stores password hashes and sessions protect trackers', async (t) => {
  const dataDir = await mkdtemp(join(os.tmpdir(), 'dev-and-dice-auth-'))
  const app = await createApp({
    dataDir,
    production: false,
    sessionSecret: 'test-session-secret-that-is-at-least-32-bytes',
  })
  const server = app.listen(0)
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const baseUrl = `http://127.0.0.1:${address.port}`

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    await rm(dataDir, { recursive: true, force: true })
  })

  const anonymous = await fetch(`${baseUrl}/api/me`)
  assert.equal(anonymous.status, 401)

  const registration = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Avventuriero', password: 'una-password-lunga' }),
  })
  assert.equal(registration.status, 201)
  const registrationBody = await registration.json()
  assert.equal(registrationBody.user.username, 'Avventuriero')
  const registrationCookie = registration.headers.get('set-cookie')?.split(';', 1)[0]
  assert.ok(registrationCookie)
  assert.match(registration.headers.get('set-cookie') ?? '', /HttpOnly/i)

  const me = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: registrationCookie } })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).user.id, registrationBody.user.id)

  const users = JSON.parse(await readFile(join(dataDir, 'users.json'), 'utf8'))
  assert.equal(users.length, 1)
  assert.notEqual(users[0].passwordHash, 'una-password-lunga')
  assert.match(users[0].passwordHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/)
  assert.equal(Object.hasOwn(users[0], 'password'), false)

  const shortPassword = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Breve', password: '1234567' }),
  })
  assert.equal(shortPassword.status, 400)

  const eightCharacterPassword = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'OttoChar', password: '12345678' }),
  })
  assert.equal(eightCharacterPassword.status, 201)

  const duplicate = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'avventuriero', password: 'un-altra-password' }),
  })
  assert.equal(duplicate.status, 409)

  const badPassword = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Avventuriero', password: 'password-sbagliata' }),
  })
  assert.equal(badPassword.status, 401)

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'avventuriero', password: 'una-password-lunga' }),
  })
  assert.equal(login.status, 200)
  const loginCookie = login.headers.get('set-cookie')?.split(';', 1)[0]
  assert.ok(loginCookie)

  const logout = await fetch(`${baseUrl}/api/logout`, {
    method: 'POST',
    headers: { Cookie: loginCookie },
  })
  assert.equal(logout.status, 200)
  const loggedOut = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: loginCookie } })
  assert.equal(loggedOut.status, 401)
})

test('development login survives reloads and backend restarts through the Vite proxy', async (t) => {
  const dataDir = await mkdtemp(join(os.tmpdir(), 'dev-and-dice-auth-restart-'))
  const options = { dataDir, production: false, sessionSecret: null }
  let app = await createApp(options)
  let server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  const frontend = await createServer({
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: `http://127.0.0.1:${port}` } } },
  })
  t.after(async () => {
    await frontend.close()
    await new Promise(resolve => server.close(resolve))
    await rm(dataDir, { recursive: true, force: true })
  })
  await frontend.listen()
  const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
  const headers = { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }
  const body = JSON.stringify({ username: 'Reload', password: 'test-password-reload' })
  const registration = await fetch(`${origin}/api/register`, { method: 'POST', headers, body })
  assert.equal(registration.status, 201, await registration.text())
  const cookie = registration.headers.get('set-cookie')?.split(';', 1)[0]
  assert.ok(cookie)
  const me = () => fetch(`${origin}/api/me`, { headers: { Cookie: cookie } })
  assert.equal((await me()).status, 200, 'Reload restores the authenticated user')

  await new Promise(resolve => server.close(resolve))
  app = await createApp(options)
  server = app.listen(port, '127.0.0.1')
  await once(server, 'listening')
  assert.equal((await me()).status, 200, 'A backend restart keeps existing cookies valid')

  const login = await fetch(`${origin}/api/login`, { method: 'POST', headers, body })
  assert.equal(login.status, 200, await login.text())
  for (const extra of [
    { Origin: 'https://attacker.invalid' },
    { Origin: 'null' },
    { 'Sec-Fetch-Site': 'cross-site' },
    { Origin: 'https://attacker.invalid', 'X-Forwarded-Host': 'attacker.invalid' },
  ]) {
    const rejected = await fetch(`${origin}/api/login`, { method: 'POST', headers: { ...headers, ...extra }, body })
    assert.equal(rejected.status, 403, 'The proxy must still reject foreign origins')
  }
  await assert.rejects(createApp({ dataDir, production: true, sessionSecret: null }), /SESSION_SECRET/)
})
