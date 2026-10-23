// Run: node --test tests/dev-startup.mjs
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { waitForApi } from '../scripts/dev.mjs'
import { createApp } from '../server/index.mjs'

async function fixture(t, handler) {
    const server = createServer(handler).listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(async () => {
        server.closeAllConnections()
        await new Promise(resolve => server.close(resolve))
    })
    return { server, base: `http://127.0.0.1:${server.address().port}` }
}

test('startup waits for the Dev & Dice API, including initial connection refusal', async t => {
    const { server, base } = await fixture(t, (_req, res) => res.end(JSON.stringify({ service: 'dev-and-dice', status: 'ready' })))
    const { port } = server.address()
    await new Promise(resolve => server.close(resolve))
    let completed = false
    const waiting = waitForApi(base, { timeout: 2000, interval: 10 }).then(() => { completed = true })
    // Two failed probes cannot start the frontend.
    await new Promise(resolve => setTimeout(resolve, 60))
    assert.equal(completed, false)
    server.listen(port, '127.0.0.1')
    await waiting
    assert.equal(completed, true)
})

test('startup rejects unrelated services, invalid JSON and error responses', async t => {
    let requests = 0
    const { base } = await fixture(t, (_req, res) => {
        requests++
        if (requests === 1) { res.statusCode = 503; res.end('{}') }
        else if (requests === 2) res.end('not json')
        else if (requests === 3) res.end('{"status":"ready","service":"another-app"}')
        else res.end('{"status":"ready","service":"dev-and-dice"}')
    })
    await waitForApi(base, { timeout: 2000, interval: 10 })
    assert.equal(requests, 4)
})

test('startup times out on a stalled health response body', async t => {
    const { base } = await fixture(t, (_req, res) => { res.writeHead(200); res.write('{') })
    await assert.rejects(waitForApi(base, { timeout: 100, interval: 5 }), /backend non è pronto/)
})

test('stopping development cancels the readiness wait', async t => {
    const { base } = await fixture(t, () => {})
    const controller = new AbortController()
    const reason = new Error('Development stopped')
    const waiting = waitForApi(base, { signal: controller.signal, interval: 5 })
    controller.abort(reason)
    await assert.rejects(waiting, error => error === reason)
})

test('real health endpoint is ready without authentication or a session cookie', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'dev-and-dice-readiness-'))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const app = await createApp({ dataDir: directory, production: false, sessionSecret: 'isolated-startup-health-test-secret-long-enough' })
    const { base } = await fixture(t, app)
    await waitForApi(base, { timeout: 2000 })
    const response = await fetch(base + '/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { service: 'dev-and-dice', status: 'ready' })
})
