import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
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
