// Run: node tests/master-view-ui.mjs (PLAYWRIGHT_CHANNEL=msedge can reuse an installed Edge).
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { createApp } from '../server/index.mjs'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'

// Coverage: initial Original; reversible settings switch; saved per-account preference;
// shared combat, HP and effects; independent selection; library/rules/sheet access;
// filtered ability deletion; mobile return/next turn; unnamed participant; denied storage.
const dataDir = await mkdtemp(join(tmpdir(), 'dev-and-dice-master-view-'))
const app = await createApp({ dataDir, production:false, sessionSecret:'master-view-test-secret-at-least-thirty-two-bytes' })
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const frontend = await createServer({ logLevel:'error', server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}} })
await frontend.listen()
const base = `http://127.0.0.1:${frontend.httpServer.address().port}`
const browser = await chromium.launch({ headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) })
async function api(context, path, method='GET', data) {
    const response = await context.request.fetch(base+'/api'+path, {method,data})
    assert(response.ok(), await response.text())
    return response.json()
}
async function changeView(page, name) {
    await page.getByRole('button', {name:'Impostazioni',exact:true}).click()
    await page.getByRole('radio', {name:new RegExp('^'+name)}).check()
    await page.getByRole('button', {name:'Torna al tavolo',exact:true}).click()
}
async function fit(page, width, height) {
    await page.setViewportSize({width,height})
    const dimensions = await page.evaluate(() => ({viewport:innerWidth,page:document.documentElement.scrollWidth}))
    assert(dimensions.page <= dimensions.viewport, `Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`)
}
try {
    const context = await browser.newContext({viewport:{width:1600,height:1000}})
    const account = await api(context, '/register', 'POST', {username:'MasterViewTest',password:'test-password-123'})
    let game = await api(context, '/play/games', 'POST', {name:'La miniera'})
    const sheets = ['Aramil','Thora','Goblin'].map((name,index) => ({...newCharacterSheet(),name,kind:'Mostro',level:'1',hitPoints:'24',armorClass:'15',initiative:String(18-index*3),playerDetails:{maxHitPoints:'32'},abilities:[{name:'Schivata',duration:'Senza conteggio'}]}))
    for (const sheet of sheets) {
        await api(context, '/play/characters', 'POST', {sheet})
        game = await api(context, `/play/games/${game.id}/characters`, 'POST', {characterId:sheet.id,revision:game.revision})
    }
    const state = {turns:sheets.map((sheet,id)=>({id,description:sheet.name,initiative:sheet.initiative,hitPoints:sheet.hitPoints,temporaryHitPoints:'',armorClass:sheet.armorClass,sheet})),abilities:[{id:0,name:'Effetto Aramil',duration:'1 minuto',remainingTurns:7,active:true,ownerId:0},{id:1,name:'Effetto Thora',duration:'1 minuto',remainingTurns:5,active:true,ownerId:1}],combat:null}
    game = await api(context, `/play/games/${game.id}/state`, 'PUT', {revision:game.revision,state,sheets})
    const page = await context.newPage(), errors=[]
    page.on('pageerror', error=>errors.push(error.message))
    await page.goto(`${base}/games/${game.id}`)
    await page.locator('.master-original').waitFor()
    assert.equal(await page.locator('.turn-row').count(),3)
    const before = await api(context, `/play/games/${game.id}`)
    await changeView(page, 'Rinnovata')
    await page.locator('.master-renewed').waitFor()
    const after = await api(context, `/play/games/${game.id}`)
    assert.equal(after.revision,before.revision,'Changing presentation must not write game state')
    assert.deepEqual(after.state,before.state)
    await page.reload()
    await page.locator('.master-renewed').waitFor()
    await page.getByRole('button',{name:'Inizia combattimento',exact:true}).click()
    await page.getByText('Round 1 · Tocca a Aramil',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Dettagli di Thora',exact:true}).click()
    assert.equal(await page.locator('#master-detail-name').innerText(),'Thora')
    assert.equal(await page.locator('.turn-row[aria-current="step"] .master-participant-name strong').innerText(),'Aramil')
    await page.getByRole('spinbutton',{name:'PF temporanei di Thora',exact:true}).fill('4')
    await page.getByRole('spinbutton',{name:'Danni o cura per Thora',exact:true}).fill('5')
    await page.getByRole('button',{name:'Applica danni a Thora',exact:true}).click()
    assert.equal(await page.getByRole('spinbutton',{name:'PF di Thora',exact:true}).inputValue(),'23')
    await page.locator('.combat-controls').getByRole('button',{name:/Turno successivo/}).click()
    await changeView(page,'Originale')
    await page.locator('.master-original').waitFor()
    assert.equal(await page.getByRole('spinbutton',{name:'PF di Thora',exact:true}).inputValue(),'23')
    await page.getByText('Round 1 · Tocca a Thora',{exact:true}).waitFor()
    assert.equal(await page.locator('.ability-row').count(),2)
    await changeView(page,'Rinnovata')
    assert.equal(await page.locator('#master-detail-name').innerText(),'Thora')
    await page.getByRole('button',{name:'Schede e creature',exact:true}).click()
    await page.locator('.character-library-content').waitFor()
    assert.equal(await page.locator('.character-card').count(),3)
    await page.getByRole('button',{name:'Regole',exact:true}).click()
    await page.locator('.master-rules-area .rules-panel[open]').waitFor()
    await page.getByRole('button',{name:/^Tavolo/}).click()
    await page.getByRole('button',{name:'Apri scheda completa',exact:true}).click()
    await page.locator('.character-library dialog[open]').waitFor()
    await page.getByRole('button',{name:'Chiudi scheda',exact:true}).click()
    await page.getByRole('button',{name:'Cancella le abilità di questo partecipante',exact:true}).click()
    await page.getByRole('button',{name:'Tutte le abilità',exact:true}).click()
    assert.equal(await page.locator('.ability-row').count(),1,'Only the selected participant abilities should be removed')
    await page.getByRole('button',{name:'Partecipante',exact:true}).click()
    for (const [width,height] of [[1280,800],[1024,768],[768,1024],[375,812],[812,375]]) await fit(page,width,height)
    await fit(page,375,812)
    await page.getByRole('button',{name:'Dettagli di Goblin',exact:true}).click()
    const detailTop = await page.locator('.master-inspector').evaluate(element=>element.getBoundingClientRect().top)
    assert(detailTop>=-2 && detailTop<100,'Mobile selection should reveal the inspector')
    await page.getByRole('button',{name:'Torna ai partecipanti',exact:true}).click()
    await page.locator('.master-mobile-combat-bar').getByRole('button',{name:'Turno successivo',exact:true}).click()
    await page.getByText('Round 1 · Tocca a Goblin',{exact:true}).waitFor()
    await fit(page,1600,1000)
    await page.getByRole('button',{name:'Termina combattimento',exact:true}).click()
    await page.getByRole('button',{name:'Aggiungi PG o mostro',exact:true}).click()
    await page.getByRole('spinbutton',{name:'Iniziativa del turno 4',exact:true}).fill('1')
    await page.getByRole('button',{name:'Inizia combattimento',exact:true}).click()
    await page.getByRole('alert').filter({hasText:'Inserisci il nome del partecipante'}).waitFor()
    await page.getByRole('combobox',{name:'Nome del partecipante selezionato',exact:true}).fill('Lupo')
    await page.getByRole('button',{name:'Inizia combattimento',exact:true}).click()
    await page.getByText('Round 1 · Tocca a Aramil',{exact:true}).waitFor()
    await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
    await page.goto(base+'/trackers')
    await page.locator('.master-renewed').waitFor()
    await page.goto(`${base}/games/${game.id}`)
    await page.locator('.master-renewed').waitFor()
    const denied = await context.newPage()
    await denied.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable','QuotaExceededError') } })
    await denied.goto(`${base}/games/${game.id}`)
    await denied.getByRole('button',{name:'Impostazioni',exact:true}).click()
    await denied.getByRole('radio',{name:/^Originale/}).check()
    await denied.getByText('La vista è cambiata, ma la preferenza non è stata salvata nel browser.',{exact:true}).waitFor()
    await denied.close()
    const other = await browser.newContext()
    await api(other,'/register','POST',{username:'OtherMasterView',password:'test-password-123'})
    const otherPage = await other.newPage()
    await otherPage.goto(base+'/trackers')
    await otherPage.locator('.master-original').waitFor()
    assert(account.user.id)
    assert.deepEqual(errors,[])
    console.log('PASS: Original/Rinnovata, per-account persistence, shared combat/HP/effects, participant selection, scoped ability removal, tools, mobile controls, unnamed participant and storage failure')
} finally {
    await browser.close()
    await frontend.close()
    server.closeAllConnections()
    await new Promise(resolve=>server.close(resolve))
    assert(resolve(dataDir).startsWith(resolve(tmpdir())+'\\dev-and-dice-master-view-') || resolve(dataDir).startsWith(resolve(tmpdir())+'/dev-and-dice-master-view-'))
    await rm(dataDir,{recursive:true,force:true})
}
