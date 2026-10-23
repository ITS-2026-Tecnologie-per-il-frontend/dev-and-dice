// Run: node tests/catalog-windows-ui.mjs. Isolated API data; emulate an older Windows checkout in HTTP responses.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { createApp } from '../server/index.mjs'

const root = resolve(import.meta.dirname, '..')
const artifacts = join(root, '.test-runtime.local')
await mkdir(artifacts, { recursive: true })
const directory = await mkdtemp(join(artifacts, 'windows-catalog-'))
const server = (await createApp({ dataDir: directory, production: false, sessionSecret: 'windows-catalog-isolated-test-secret-long-enough' })).listen(0, '127.0.0.1')
await once(server, 'listening')
const frontend = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: `http://127.0.0.1:${server.address().port}`, changeOrigin: false } } } })
await frontend.listen()
const base = `http://127.0.0.1:${frontend.httpServer.address().port}`
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const errors = []
let wizardRequests = 0
async function api(path, method = 'GET', data) {
    const response = await context.request.fetch(base + '/api' + path, { method, data })
    assert(response.ok(), await response.text())
    return response.json()
}
async function openGame(game, corrupt) {
    const page = await context.newPage()
    page.setDefaultTimeout(20000)
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/data/rules2014/**', async route => {
        const pathname = new URL(route.request().url()).pathname
        let body = await readFile(join(root, 'public', pathname), 'utf8')
        if (pathname.endsWith('/data/wizard-catalog.json')) {
            wizardRequests++
            if (corrupt) body = body.replace('"subclasses"', '"changedSubclasses"')
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: body.replace(/\r?\n/g, '\r\n') })
    })
    await page.goto(base + '/games/' + game.id)
    await page.getByRole('button', { name: 'Impostazioni', exact: true }).click()
    await page.getByRole('radio', { name: /^Originale/ }).check()
    await page.getByRole('button', { name: 'Torna al tavolo', exact: true }).click()
    return page
}
try {
    await api('/register', 'POST', { username: 'WindowsCatalogQA', password: 'test-password-123' })
    const game = await api('/play/games', 'POST', { name: 'Catalogo Windows' })
    const broken = await openGame(game, true)
    await broken.getByText(/Catalogo non disponibile: Impronta non valida: data\/wizard-catalog.json/).waitFor()
    assert.equal(await broken.getByRole('button', { name: '+ Crea personaggio guidato', exact: true }).isDisabled(), true)
    assert.equal(await broken.getByRole('button', { name: '+ Crea personaggio casuale', exact: true }).isDisabled(), true)
    await broken.close()

    const page = await openGame(game, false)
    const guided = page.getByRole('button', { name: '+ Crea personaggio guidato', exact: true })
    const random = page.getByRole('button', { name: '+ Crea personaggio casuale', exact: true })
    await guided.click() // Auto-waits for the catalog and proves the control is usable.
    const tutorial = page.getByRole('dialog', { name: 'Creazione del personaggio', exact: true })
    await tutorial.waitFor()
    await tutorial.getByRole('button', { name: 'Cancella la bozza del personaggio', exact: true }).click()
    await tutorial.waitFor({ state: 'hidden' })

    await random.click()
    const dialog = page.getByRole('dialog', { name: 'Personaggio casuale', exact: true })
    await dialog.getByRole('combobox', { name: /^Classe/ }).selectOption('fighter')
    await dialog.getByRole('combobox', { name: /^Razza/ }).selectOption('human')
    await dialog.getByRole('button', { name: 'Genera veloce', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.locator('.character-list .character-open').first().waitFor()
    await page.getByText('Sessione sincronizzata', { exact: true }).waitFor()
    const saved = await api('/play/games/' + game.id)
    assert.equal(saved.characters.length, 1, 'Random generation saves the character to the session')
    assert(saved.characters[0].sheet.name)
    assert.equal(await guided.isEnabled(), true)
    assert.equal(await random.isEnabled(), true)
    assert.equal(await page.getByText(/Catalogo non disponibile/).count(), 0)
    assert(wizardRequests >= 2, 'Both failures and successful loading consumed the Windows catalog')
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(artifacts, 'catalog-windows-buttons.png'), fullPage: true })
    console.log('PASS: corrupt catalogs stay blocked; CRLF catalogs enable guided creation and random generation, with the character saved to the Master session.')
} catch (error) {
    for (const page of context.pages()) {
        console.error(await page.locator('dialog[open]').evaluateAll(dialogs => dialogs.map(dialog => dialog.outerHTML.slice(0, 5000))))
        await page.screenshot({ path: join(artifacts, 'catalog-windows-failure.png'), fullPage: true })
    }
    throw error
} finally {
    await browser.close()
    await frontend.close()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
}

