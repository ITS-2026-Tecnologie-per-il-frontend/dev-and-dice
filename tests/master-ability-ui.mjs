// Run: node tests/master-ability-ui.mjs. Isolated data; Edge on Windows or PLAYWRIGHT_CHANNEL.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { createApp } from '../server/index.mjs'
import { loadCandidateCreationData } from '../src/domain/dnd/VerifiedDatabase.ts'
import { activeCatalog } from '../src/domain/dnd/ActiveRules.ts'
import { templateFromCatalog } from '../src/utils/Catalog.ts'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'

// QA inventory: import from participant -> fixed caster/duration in both layouts;
// manual ownership and timer editing still available; concise Master copy;
// tooltips open/close on hover, hover transfer, keyboard/blur/Escape, touch/outside;
// tooltip stays within viewport and outside sidebar clipping; descriptions still open.
const dataDir=await mkdtemp(join(tmpdir(),'dev-and-dice-ability-help-'))
const app=await createApp({dataDir,production:false,sessionSecret:'ability-help-test-secret-at-least-thirty-two-bytes'})
const server=app.listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}})
await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform==='win32'?'msedge':undefined)})
const artifacts=resolve('handoff.local/master-ability-qa');await mkdir(artifacts,{recursive:true})
async function api(context,path,method='GET',data) {
    const response=await context.request.fetch(base+'/api/play'+path,{method,data})
    assert(response.ok(),await response.text());return response.json()
}
async function switchView(page,name) {
    await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
    await page.getByRole('radio',{name:new RegExp('^'+name)}).check()
    await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()
}
async function tooltipFits(page) {
    const box=await page.getByRole('tooltip').boundingBox(),size=page.viewportSize()
    assert(box && box.x>=0 && box.y>=0 && box.x+box.width<=size.width+1 && box.y+box.height<=size.height+1)
}
try {
    const directory=resolve('public/data/rules2014')
    const verified=await loadCandidateCreationData('runtime',async url=>{const file=join(directory,url.replace('runtime/',''));return {ok:existsSync(file),text:async()=>readFileSync(file,'utf8')}})
    const catalog=activeCatalog(verified,'it')
    const template=id=>templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:'+id))
    const context=await browser.newContext({viewport:{width:1440,height:1100}})
    const response=await context.request.post(base+'/api/register',{data:{username:'AbilityHelpQA',password:'test-password-123'}})
    assert(response.ok(),await response.text())
    let game=await api(context,'/games','POST',{name:'Il tavolo del Master'})
    const sheets=['Gaglio','Goblin'].map((name,index)=>({...newCharacterSheet(),name,kind:'PNG',hitPoints:'30',armorClass:'15',initiative:'12',playerDetails:{maxHitPoints:'30','slots.1.total':'4','slots.1.used':'0'},abilities:index===0 ? [template('magic-missile'),template('bless')] : []}))
    for(const sheet of sheets) {
        await api(context,'/characters','POST',{sheet})
        game=await api(context,`/games/${game.id}/characters`,'POST',{characterId:sheet.id,revision:game.revision})
    }
    await api(context,`/games/${game.id}/state`,'PUT',{revision:game.revision,sheets,state:{turns:sheets.map((sheet,id)=>({id,description:sheet.name,initiative:sheet.initiative,hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:'',sheet})),abilities:[],combat:null}})
    const page=await context.newPage(),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto(base+'/games/'+game.id)
    const importSpell=page.getByRole('button',{name:'Dardo Incantato · Usa',exact:true})
    await importSpell.waitFor();await importSpell.click()
    const missile=page.locator('#ability-0')
    await missile.locator('.ability-metadata').waitFor()
    for(const view of ['Originale','Rinnovata']) {
        await switchView(page,view)
        assert.equal(await missile.getByRole('combobox',{name:'Proprietario di Dardo Incantato',exact:true}).count(),0)
        await missile.locator('.ability-metadata').getByText('Gaglio',{exact:true}).waitFor()
        await missile.locator('.ability-metadata').getByText('Istantanea',{exact:true}).waitFor()
        assert.equal(await missile.getByText(/conferma con il DM|vanno risolti con il DM/).count(),0)
        await missile.screenshot({path:join(artifacts,view.toLowerCase()+'.png')})
    }
    const help=missile.getByRole('button',{name:'Aiuto sui bersagli del danno',exact:true})
    await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
    const beforeHelp=await api(context,`/games/${game.id}`)
    await help.hover();await page.getByRole('tooltip').waitFor();await tooltipFits(page)
    assert((await page.getByRole('tooltip').innerText()).includes('Risolvi attacchi'))
    assert(!/\bDM\b/.test(await page.getByRole('tooltip').innerText()))
    await page.screenshot({path:join(artifacts,'hover-desktop.png')})
    await page.getByRole('tooltip').hover()
    await page.waitForTimeout(160)
    assert(await page.getByRole('tooltip').isVisible(),'The pointer can move onto the help text')
    await missile.getByRole('checkbox',{name:'Prevede danni',exact:true}).hover()
    await page.getByRole('tooltip').waitFor({state:'detached'})
    await help.press('Tab');await page.keyboard.press('Shift+Tab')
    await page.getByRole('tooltip').waitFor()
    await page.keyboard.press('Escape');await page.getByRole('tooltip').waitFor({state:'detached'})
    assert.equal(await help.evaluate(element=>element===document.activeElement),true,'Escape keeps keyboard focus on the help button')
    await page.keyboard.press('Tab')
    assert.equal((await api(context,`/games/${game.id}`)).revision,beforeHelp.revision,'Reading help must not change game state')
    await missile.getByRole('button',{name:'Descrizione su Dardo Incantato',exact:true}).click()
    await page.locator('dialog.info-dialog[open]').waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'Benedizione · Usa',exact:true}).click()
    const bless=page.locator('#ability-1')
    await bless.locator('.ability-metadata').waitFor()
    await bless.getByText('Gestisci durata',{exact:true}).click()
    await bless.getByRole('combobox',{name:'Durata abilità 2',exact:true}).selectOption('10 minuti')
    assert.equal(await bless.getByRole('spinbutton',{name:'Turni rimanenti di Benedizione',exact:true}).inputValue(),'100')
    await switchView(page,'Originale')
    await page.getByRole('button',{name:'Aggiungi abilità',exact:true}).click()
    const manual=page.locator('#ability-2')
    await manual.getByRole('combobox',{name:'Nome abilità 3',exact:true}).fill('Effetto personalizzato')
    const owner=manual.getByRole('combobox',{name:'Proprietario di Effetto personalizzato',exact:true})
    await owner.selectOption('1');await owner.selectOption('0')
    assert.equal(await owner.inputValue(),'0','Manual entries can still choose and correct their owner')
    await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
    const mobile=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,storageState:await context.storageState()})
    const mobilePage=await mobile.newPage();mobilePage.on('pageerror',error=>errors.push(error.message))
    await mobilePage.goto(base+'/games/'+game.id);await switchView(mobilePage,'Rinnovata')
    const mobileHelp=mobilePage.locator('#ability-0').getByRole('button',{name:'Aiuto sui bersagli del danno',exact:true})
    await mobileHelp.tap();await mobilePage.getByRole('tooltip').waitFor();await tooltipFits(mobilePage)
    await mobilePage.screenshot({path:join(artifacts,'touch-help.png')})
    await mobileHelp.tap();await mobilePage.getByRole('tooltip').waitFor({state:'detached'})
    await mobileHelp.tap();await mobilePage.getByRole('tooltip').waitFor()
    await mobilePage.locator('#ability-0').getByRole('combobox',{name:'Modalità di Dardo Incantato',exact:true}).tap()
    await mobilePage.getByRole('tooltip').waitFor({state:'detached'})
    await mobilePage.keyboard.press('Escape')
    assert(await mobilePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    await mobilePage.locator('#ability-0').screenshot({path:join(artifacts,'mobile.png')})
    await mobilePage.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'})
    await mobileHelp.tap();await mobilePage.getByRole('tooltip').waitFor();await tooltipFits(mobilePage)
    await mobilePage.screenshot({path:join(artifacts,'touch-dark.png')})
    assert.deepEqual(errors,[])
    console.log('PASS: fixed caster/duration from character import, both layouts; manual owner/timer edits; Master copy; hover/keyboard/Escape/touch tooltip lifecycle and viewport; spell descriptions; help never changes game state')
} finally {
    await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))
    assert(resolve(dataDir).startsWith(join(resolve(tmpdir()),'dev-and-dice-ability-help-')))
    await rm(dataDir,{recursive:true,force:true})
}
