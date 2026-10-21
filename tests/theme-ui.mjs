// Run: node tests/theme-ui.mjs. Uses isolated accounts and storage, never live game data.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { createApp } from '../server/index.mjs'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'

// QA: reversible themes; immediate cross-page/tab persistence; independent Master view;
// unchanged game revision and live inputs; player settings; keyboard; 375px + landscape;
// light/dark OS; invalid and denied storage; screenshots; print keeps its own paper colors.
const activeTheme = process.env.THEME_TEST_THEME === 'dragons' ? 'dragons' : 'fantasy'
const themeRadio = activeTheme === 'dragons' ? /^Fantasy\/draghi/ : /^Fantasy\s+Legno/
const dataDir = await mkdtemp(join(tmpdir(), 'dev-and-dice-theme-'))
const app = await createApp({ dataDir, production:false, sessionSecret:'theme-test-secret-at-least-thirty-two-bytes' })
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const frontend = await createServer({ logLevel:'error', server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}} })
await frontend.listen()
const base = `http://127.0.0.1:${frontend.httpServer.address().port}`
const browser = await chromium.launch({ headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) })
const output = resolve('reports/theme-ui')
await mkdir(output,{recursive:true})
async function api(context,path,method='GET',data) {
    const response=await context.request.fetch(base+'/api'+path,{method,data})
    assert(response.ok(),await response.text())
    return response.json()
}
async function theme(page,value) {
    await page.getByRole('combobox',{name:'Stile',exact:true}).selectOption(value)
    await page.waitForFunction(value=>document.documentElement.dataset.theme===value,value)
}
async function fit(page,width,height) {
    await page.setViewportSize({width,height})
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}x${height} on ${page.url()}`)
}
try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light',reducedMotion:'reduce'})
    await api(context,'/register','POST',{username:'TavernMaster',password:'test-password-123'})
    const game=await api(context,'/play/games','POST',{name:'La locanda del Drago Rosso'})
    const sheet={...newCharacterSheet(),name:'Thora Braciardente',kind:'PG',characterClass:'Guerriero',level:'3',hitPoints:'24',armorClass:'16'}
    await api(context,'/play/characters','POST',{sheet})
    const page=await context.newPage(), errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto(base)
    await page.getByRole('heading',{name:'Il tuo tavolo',exact:true}).waitFor()
    assert.equal(await page.locator('html').getAttribute('data-theme'),'minimal')
    await page.screenshot({path:join(output,'minimal-home.png'),fullPage:true})
    await theme(page,activeTheme)
    const themeInk=await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--text-h').trim())
    assert.equal(themeInk,activeTheme === 'dragons' ? '#f3eee3' : '#302317')
    await page.screenshot({path:join(output,`${activeTheme}-home.png`),fullPage:true})
    await page.reload()
    await page.getByRole('heading',{name:'Il tuo tavolo',exact:true}).waitFor()
    assert.equal(await page.getByRole('combobox',{name:'Stile',exact:true}).inputValue(),activeTheme)
    const tab=await context.newPage()
    await tab.goto(base)
    await tab.getByRole('combobox',{name:'Stile',exact:true}).waitFor()
    await theme(page,'minimal')
    await tab.waitForFunction(()=>document.documentElement.dataset.theme==='minimal')
    await theme(tab,activeTheme)
    await page.waitForFunction(value=>document.documentElement.dataset.theme===value,activeTheme)
    await tab.close()
    for (const [w,h] of [[375,812],[812,375],[768,1024],[1440,1000]]) await fit(page,w,h)
    await fit(page,375,812)
    await page.screenshot({path:join(output,`${activeTheme}-mobile.png`),fullPage:true})
    await fit(page,1440,1000)
    await page.goto(`${base}/games/${game.id}`)
    await page.locator('.master-original').waitFor()
    const before=await api(context,`/play/games/${game.id}`)
    await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
    await page.getByRole('radio',{name:/^Minimal/}).check()
    await page.getByRole('radio',{name:/^Rinnovata/}).check()
    await page.getByRole('radio',{name:themeRadio}).check()
    await page.screenshot({path:join(output,`${activeTheme}-settings.png`)})
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('dialog[open]').count(),0)
    await page.locator('.master-renewed').waitFor()
    const after=await api(context,`/play/games/${game.id}`)
    assert.equal(after.revision,before.revision)
    assert.deepEqual(after.state,before.state)
    await page.screenshot({path:join(output,`${activeTheme}-master.png`),fullPage:true})
    for (const [w,h] of [[375,812],[812,375],[1440,1000]]) await fit(page,w,h)
    await theme(page,'minimal')
    await page.locator('.master-renewed').waitFor()
    await theme(page,activeTheme)
    await page.emulateMedia({colorScheme:'dark'})
    assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--text-h').trim()),themeInk)
    await page.goto(base+'/trackers')
    await page.locator('.master-renewed').waitFor()
    if (activeTheme === 'fantasy') assert.notEqual(await page.locator('.master-renewed').evaluate(el=>getComputedStyle(el).backgroundImage),'none','Standalone tracker navigation needs a readable paper surface')
    await page.screenshot({path:join(output,`${activeTheme}-trackers.png`),fullPage:true})
    for (const [w,h] of [[375,812],[1440,1000]]) await fit(page,w,h)
    await page.goto(base)
    await page.getByRole('button',{name:'Crea sessione',exact:true}).click()
    await page.getByRole('textbox',{name:'Nome della sessione',exact:true}).fill('Bozza da conservare')
    await theme(page,'minimal')
    await theme(page,activeTheme)
    assert.equal(await page.getByRole('textbox',{name:'Nome della sessione',exact:true}).inputValue(),'Bozza da conservare')
    const player=await browser.newContext({viewport:{width:1440,height:1000}})
    await api(player,'/register','POST',{username:'TavernPlayer',password:'test-password-123'})
    await api(player,`/play/invites/${game.inviteToken}/join`,'POST',{sheet:{...newCharacterSheet(),name:'Aramil',kind:'PG',hitPoints:'18'}})
    const playerPage=await player.newPage()
    playerPage.on('pageerror',error=>errors.push(error.message))
    await playerPage.goto(`${base}/games/${game.id}`)
    await playerPage.getByRole('button',{name:'Impostazioni della scheda',exact:true}).click()
    await playerPage.getByRole('radio',{name:themeRadio}).check()
    await playerPage.keyboard.press('Escape')
    await playerPage.locator('.play-player-notes textarea').fill('Un indizio dietro il bancone')
    await theme(playerPage,'minimal')
    await theme(playerPage,activeTheme)
    assert.equal(await playerPage.locator('.play-player-notes textarea').inputValue(),'Un indizio dietro il bancone')
    await playerPage.screenshot({path:join(output,`${activeTheme}-player.png`),fullPage:true})
    for (const [w,h] of [[375,812],[812,375],[1440,1000]]) await fit(playerPage,w,h)
    await playerPage.emulateMedia({media:'print'})
    assert.notEqual(await playerPage.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--text-h').trim()),themeInk)
    const denied=await context.newPage()
    await denied.addInitScript(()=>{
        const write=Storage.prototype.setItem
        // ponytail: deny app writes only; blocking Vite storage prevents the test page from loading.
        Storage.prototype.setItem=function(key,value){if(key.startsWith('dev-and-dice.'))throw new DOMException('Storage unavailable','QuotaExceededError');return write.call(this,key,value)}
    })
    await denied.goto(base)
    await theme(denied,'minimal')
    await denied.getByRole('status').filter({hasText:'Lo stile è cambiato'}).waitFor()
    await theme(denied,activeTheme)
    assert.equal(await denied.getByRole('combobox',{name:'Stile',exact:true}).inputValue(),activeTheme)
    const anonymous=await browser.newContext({viewport:{width:375,height:812}})
    const login=await anonymous.newPage()
    await login.addInitScript(()=>localStorage.setItem('dev-and-dice.theme.v1','invalid'))
    await login.goto(base+'/login')
    await login.getByRole('heading',{name:'Bentornato',exact:true}).waitFor()
    assert.equal(await login.locator('html').getAttribute('data-theme'),'minimal')
    await login.getByRole('textbox',{name:'Nome utente',exact:true}).fill('BozzaUtente')
    await theme(login,activeTheme)
    assert.equal(await login.getByRole('textbox',{name:'Nome utente',exact:true}).inputValue(),'BozzaUtente')
    await fit(login,375,812)
    await login.screenshot({path:join(output,`${activeTheme}-login.png`),fullPage:true})
    assert.deepEqual(errors,[])
    console.log(activeTheme+': PASS: reversible themes, reload and cross-tab persistence, independent Master view, unchanged game and unsaved inputs, player settings, Escape, mobile/landscape, OS dark, print, invalid and denied storage. Screenshots: reports/theme-ui/')
} finally {
    await browser.close()
    await frontend.close()
    server.closeAllConnections()
    await new Promise(resolve=>server.close(resolve))
    assert(resolve(dataDir).startsWith(resolve(tmpdir())+sep+'dev-and-dice-theme-'))
    await rm(dataDir,{recursive:true,force:true})
}
