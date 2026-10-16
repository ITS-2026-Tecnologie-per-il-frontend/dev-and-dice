// Run: node tests/performance-ui.mjs [report path] [--production] [--profile] [--master] (build first).
// Isolated data; Chromium CPU throttled 4x. Timings are diagnostic; assertions check behavior and redundant work.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import express from 'express'
import { createApp } from '../server/index.mjs'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'

const sheetSource=process.argv.find(arg=>arg.startsWith('--sheet-source='))?.slice('--sheet-source='.length)
const dir=await mkdtemp(join(tmpdir(),'dev-and-dice-perf-'))
const app=await createApp({dataDir:dir,production:false,sessionSecret:'performance-test-secret-at-least-thirty-two-bytes'})
if(process.argv.includes('--production')) {app.use(express.static(resolve('dist')));app.get('/games/:id',(_req,res)=>res.sendFile(resolve('dist/index.html')))}
const server=app.listen(0)
await once(server,'listening')
const frontend=await createServer({plugins:[{name:'performance-render-counts',enforce:'pre',async transform(code,id){if(!id.includes('/src/components/'))return;if(sheetSource&&id.split('?')[0].endsWith('/src/components/PlayerSheet.tsx'))code=await readFile(sheetSource,'utf8');return code.replace(/^(?:export (?:default )?)?function (CharacterSheets|PlayerSheetLayout|PlayerSheet|SheetField|CharacterEditor|SheetChanges|InventoryEditor|RulesPanel|WizardAdvancement)\([^\n]*\{\n/gm,(line,name)=>line+`if(globalThis.perfQA) globalThis.perfQA.renders['${name}']=(globalThis.perfQA.renders['${name}']||0)+1;\n`)}}],logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}})
let browser
try {
    await frontend.listen()
    const url=`http://127.0.0.1:${process.argv.includes('--production') ? server.address().port : frontend.httpServer.address().port}`
    browser=await chromium.launch({headless:true})
    const master=await browser.newContext(),player=await browser.newContext({viewport:{width:1440,height:1000}})
    async function api(context,path,method='GET',data) {
        const response=await context.request.fetch(url+path,{method,data})
        assert(response.ok(),await response.text());return response.json()
    }
    for(const [context,username] of [[master,'PerfMaster'],[player,'PerfPlayer']]) await api(context,'/api/register','POST',{username,password:'performance-password-123'})
    const game=await api(master,'/api/play/games','POST',{name:'Performance QA'})
    const sheet={...newCharacterSheet(),name:'Mago QA',level:'5',characterClass:'Mago',hitPoints:'25',armorClass:'12',strength:'10',dexterity:'14',constitution:'14',intelligence:'18',wisdom:'12',charisma:'10',playerDetails:{'sheet.template':'wizard-pdf','creation.class':'wizard',...(process.argv.includes('--master') ? {classFeatures:'Privilegio QA (livello 2)\nPuoi usare una azione bonus.\n\nAltro privilegio (livello 6)\nDescrizione conservata.'} : {})}}
    await api(player,'/api/play/invites/'+game.inviteToken+'/join','POST',{sheet})
    for(let n=0;n<25;n++) {
        const record=await api(master,'/api/play/characters/'+sheet.id)
        await api(master,'/api/play/characters/'+sheet.id,'PUT',{revision:record.revision,sheet:{...record.sheet,notes:'Nota '+n}})
    }
    if(process.argv.includes('--master')) {
        const page=await master.newPage(),errors=[]
        await page.setViewportSize({width:1440,height:1000})
        page.on('pageerror',error=>errors.push(error.message))
        page.on('console',message=>{if(message.type()==='error'&&message.text().includes('same key'))errors.push(message.text())})
        await page.addInitScript(()=>{
            window.perfQA={renders:{},inputs:[]}
            document.addEventListener('input',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>window.perfQA.inputs.push(performance.now()-start)))},true)
        })
        await page.goto(url+'/games/'+game.id)
        await page.getByRole('button',{name:'Apri scheda di Mago QA',exact:true}).click()
        const dialog=page.locator('.player-sheet-dialog[open]'),fields=dialog.locator('.player-wizard-privilege textarea'),field=fields.first()
        await field.waitFor();await dialog.locator('.inventory-editor').waitFor();await page.evaluate(()=>document.fonts.ready)
        await field.fill('');await field.pressSequentially('Testo\n\nNuova riga',{delay:0})
        assert.equal(await field.inputValue(),'Testo\n\nNuova riga','Blank lines and generated headings must not rewrite the focused textarea')
        await field.press('Control+Home');await field.press('Delete')
        assert.equal(await field.inputValue(),'esto\n\nNuova riga','Deleting at the start keeps the caret in place')
        await field.screenshot({path:'/tmp/dev-and-dice-master-privileges-editing.png'})
        await field.fill('Privilegio ripetuto (livello 2)\nPuoi usare una azione bonus.')
        await fields.nth(1).fill('Privilegio ripetuto (livello 6)\nPuoi usare una azione bonus.')
        await field.fill('Privilegio rinominato (livello 2)\nPuoi usare una azione bonus.')
        assert.equal(await dialog.locator('.pdf-ability-card').count(),2,'Repeated privilege names must not leave duplicate cards after an edit')
        await field.fill('Privilegio QA (livello 2)\nPuoi usare una azione bonus.')
        await fields.nth(1).fill('Altro privilegio (livello 6)\nDescrizione conservata.')
        await field.blur()
        const cdp=await master.newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
        if(process.argv.includes('--profile')) {await cdp.send('Profiler.enable');await cdp.send('Profiler.start')}
        await page.evaluate(()=>{window.perfQA.inputs=[];window.perfQA.renders={}})
        await field.press('Control+End');await field.pressSequentially('abcdefgh',{delay:60,timeout:120000});await page.waitForTimeout(150)
        const typing=await page.evaluate(()=>window.perfQA)
        await field.screenshot({path:'/tmp/dev-and-dice-master-privileges.png'})
        assert.equal(await field.inputValue(),'Privilegio QA (livello 2)\nPuoi usare una azione bonus.abcdefgh')
        assert.equal(await fields.nth(1).inputValue(),'Altro privilegio (livello 6)\nDescrizione conservata.')
        const report={role:'master',cpu:4,typing:{samples:typing.inputs.length,median:typing.inputs.toSorted((a,b)=>a-b)[Math.floor(typing.inputs.length/2)],p95:typing.inputs.toSorted((a,b)=>a-b)[Math.floor(typing.inputs.length*.95)],renders:typing.renders}}
        for(const phase of ['rapid','backspace','delete']) {
            await field.press(phase==='delete' ? 'Home' : 'Control+End')
            await page.evaluate(()=>{window.perfQA.inputs=[];window.perfQA.renders={}})
            const start=performance.now(),before=await field.inputValue()
            if(phase==='rapid')await field.pressSequentially('Scrittura veloce senza pause!',{delay:0,timeout:120000})
            else for(let n=0;n<10;n++)await field.press(phase==='delete' ? 'Delete' : 'Backspace')
            const elapsed=performance.now()-start
            await page.waitForTimeout(150)
            const result=await page.evaluate(()=>window.perfQA),values=result.inputs.toSorted((a,b)=>a-b)
            report[phase]={samples:values.length,elapsed,median:values[Math.floor(values.length/2)],p95:values[Math.floor(values.length*.95)],renders:result.renders}
            assert.equal(await field.inputValue(),phase==='rapid' ? before+'Scrittura veloce senza pause!' : phase==='backspace' ? before.slice(0,-10) : before.slice(0,before.indexOf('\n')+1)+before.slice(before.indexOf('\n')+11),'Fast typing and deletion keep every character and the caret position')
        }
        await field.fill('Privilegio QA (livello 2)\nPuoi usare una azione bonus.abcdefgh')
        if(process.argv.includes('--profile')) {const {profile}=await cdp.send('Profiler.stop');await writeFile((process.argv[2]??'/tmp/dev-and-dice-perf.json')+'.cpuprofile',JSON.stringify(profile))}
        console.log(JSON.stringify(report,null,2))
        if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n')
        if(!sheetSource&&!process.argv.includes('--production'))assert.equal(typing.renders.PlayerSheetLayout??0,0,'Master privilege edits must not render the whole sheet')
        const info=dialog.getByRole('button',{name:'Altro su Privilegio QA',exact:true})
        await info.click()
        const detail=page.getByRole('dialog',{name:'Privilegio QA',exact:true})
        await detail.getByText('Puoi usare una azione bonus.abcdefgh',{exact:true}).waitFor()
        await detail.screenshot({path:'/tmp/dev-and-dice-master-privilege-detail.png'})
        await page.keyboard.press('Escape');await detail.waitFor({state:'hidden'})
        assert(await info.evaluate(element=>element===document.activeElement),'Closing details restores trigger focus')
        await info.click();await detail.getByText('Puoi usare una azione bonus.abcdefgh',{exact:true}).waitFor()
        await detail.getByRole('button',{name:'Chiudi dettagli',exact:true}).click();await detail.waitFor({state:'hidden'})
        await fields.nth(1).fill('Privilegio aggiornato (livello 6)\nSecondo testo.')
        await dialog.locator('.player-wizard-extra > summary').click()
        const full=dialog.locator('[data-field="classFeatures"] textarea')
        assert((await full.inputValue()).includes('azione bonus.abcdefgh'))
        assert((await full.inputValue()).includes('Secondo testo.'))
        await full.fill('')
        await dialog.locator('.player-sheet-settings > summary').filter({hasText:'Opzioni di compilazione'}).click()
        await dialog.getByRole('button',{name:'Attiva creazione guidata',exact:true}).click()
        const automatic=await field.inputValue()
        await page.evaluate(()=>{window.perfQA.renders={}})
        const override=(automatic ? automatic+' ' : 'Privilegio automatico (livello 2)\n')+'PROVA_OVERRIDE'
        await field.fill(override)
        assert.equal(await field.inputValue(),override)
        if(!sheetSource&&!process.argv.includes('--production'))assert.equal(await page.evaluate(()=>window.perfQA.renders.PlayerSheetLayout??0),0,'The first automatic-field override must also skip the full layout')
        await dialog.getByRole('button',{name:'Ripristina i campi generati (annulla le loro modifiche manuali)',exact:true}).click()
        assert(!(await full.inputValue()).includes('PROVA_OVERRIDE'),'Reset uses the latest text and removes the override')
        await dialog.getByRole('button',{name:'Passa a compilazione manuale',exact:true}).click()
        const final='Privilegio QA (livello 2)\nPuoi usare una azione bonus. Ultimo carattere!\n\nAltro privilegio (livello 6)\nTesto con accenti: città.'
        await full.fill(final)
        assert.equal(await field.inputValue(),'Privilegio QA (livello 2)\nPuoi usare una azione bonus. Ultimo carattere!')
        assert.equal(await fields.nth(1).inputValue(),'Altro privilegio (livello 6)\nTesto con accenti: città.')
        await dialog.locator('[data-field="name"] input').fill('Nome Master aggiornato')
        const saved=page.waitForResponse(response=>response.url().endsWith('/state')&&response.request().method()==='PUT'&&response.ok())
        await dialog.getByRole('button',{name:'Salva scheda',exact:true}).click();await saved
        const record=await api(master,'/api/play/characters/'+sheet.id)
        assert.equal(record.sheet.name,'Nome Master aggiornato')
        assert.equal(record.sheet.playerDetails.classFeatures,final,'Master saves the last typed character and preserves all feature levels')
        const randomButton=page.getByRole('button',{name:'+ Crea personaggio casuale',exact:true}),random=page.getByRole('dialog',{name:'Personaggio casuale',exact:true})
        await randomButton.click()
        await random.waitFor()
        await random.getByRole('combobox').first().selectOption('wizard')
        await page.keyboard.press('Escape');await random.waitFor({state:'hidden'})
        assert(await randomButton.evaluate(element=>element===document.activeElement),'Escape restores the random-character trigger focus')
        await randomButton.click()
        assert.equal(await random.getByRole('combobox').first().inputValue(),'wizard','Reopening the lazy dialog preserves its selections')
        await random.getByRole('button',{name:'Annulla',exact:true}).click();await random.waitFor({state:'hidden'})
        assert.deepEqual(errors,[])
        console.log('PASS: Master privilege typing, other levels, full-text synchronization, consecutive edits and immediate save.')
    } else {
    const page=await player.newPage(),errors=[],requests=[]
    page.on('pageerror',error=>errors.push(error.message))
    page.on('request',request=>{if(request.url().includes('/api/'))requests.push({url:new URL(request.url()).pathname,method:request.method()})})
    await page.addInitScript(()=>{
        window.perfQA={renders:{},inputs:[],clicks:[]}
        for(const [event,key] of [['input','inputs'],['click','clicks']]) document.addEventListener(event,()=>{
            const start=performance.now()
            requestAnimationFrame(()=>requestAnimationFrame(()=>window.perfQA[key].push(performance.now()-start)))
        },true)
    })
    console.log('QA: seeded, loading page');await page.goto(url+'/games/'+game.id)
    const name=page.locator('.player-paper [data-field="name"] input')
    await name.waitFor();console.log('QA: sheet loaded');await page.locator('.inventory-editor').waitFor();await page.evaluate(()=>document.fonts.ready);console.log('QA: fonts ready')
    const cdp=await player.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
    await cdp.send('Performance.enable');const metricsBefore=await cdp.send('Performance.getMetrics');if(process.argv.includes('--profile')) {await cdp.send('Profiler.enable');await cdp.send('Profiler.start')}
    await page.evaluate(()=>{window.perfQA.renders={};window.perfQA.inputs=[]})
    requests.length=0
    await name.fill('Mago QA ')
    await name.pressSequentially('abcdefgh',{delay:60,timeout:120000})
    await page.waitForTimeout(150)
    console.log('QA: typing complete');const typing=await page.evaluate(()=>({...window.perfQA}))
    const typingRequests=requests.filter(r=>r.method!=='GET')
    const {profile}=process.argv.includes('--profile') ? await cdp.send('Profiler.stop') : {profile:{nodes:[],samples:[]}};const metricsAfter=await cdp.send('Performance.getMetrics');await writeFile((process.argv[2]??'/tmp/dev-and-dice-perf.json')+'.cpuprofile',JSON.stringify(profile));console.log('QA metrics',metricsAfter.metrics.filter(m=>['ScriptDuration','LayoutDuration','RecalcStyleDuration','TaskDuration'].includes(m.name)).map(m=>({name:m.name,ms:1000*(m.value-metricsBefore.metrics.find(b=>b.name===m.name).value)})))
    console.log('QA DOM',await page.locator('*').count());const counts=new Map()
    for(const id of profile.samples??[])counts.set(id,(counts.get(id)||0)+1)
    const hot=profile.nodes.filter(n=>n.callFrame.url.includes('/src/')).map(n=>({name:n.callFrame.functionName,file:n.callFrame.url.split('/src/')[1].split('?')[0],samples:counts.get(n.id)||0})).sort((a,b)=>b.samples-a.samples).slice(0,15)
    assert.equal(await name.inputValue(),'Mago QA abcdefgh')
    assert.deepEqual(typingRequests,[],'Typing must not send edits before Save')
    if(!sheetSource&&!process.argv.includes('--production'))assert.equal(typing.renders.PlayerSheetLayout??0,0,'Prose edits must not render the entire sheet')
    await page.screenshot({path:'/tmp/dev-and-dice-perf-sheet.png'})
    const bell=page.getByRole('button',{name:/^Notifiche:/}),dialog=page.getByRole('dialog',{name:'Notifiche e storico delle schede',exact:true})
    const openings=[]
    for(let n=0;n<5;n++) {
        requests.length=0
        await page.evaluate(()=>{window.perfQA.clicks=[];window.perfQA.renders={}})
        console.log('QA: opening',n);await bell.click()
        await dialog.locator('li[data-notification-id]').first().waitFor()
        await page.waitForTimeout(150)
        openings.push({...(await page.evaluate(()=>({paint:window.perfQA.clicks[0],renders:window.perfQA.renders}))),fetches:requests.filter(r=>r.url.endsWith('/notifications')).length})
        if(n>0) {
            assert.equal(openings[n].fetches,0,'Unchanged notification revisions reuse the first page')
            assert.equal(await dialog.locator('li[data-notification-id]').count(),20,'Reopening resets pagination to the first page')
            assert.equal(await dialog.locator('.play-notifications-body').evaluate(element=>element.scrollTop),0)
        }
        if(n===0) {
            assert.equal(await dialog.locator('li[data-notification-id]').count(),20)
            await dialog.getByRole('button',{name:'Mostra precedenti',exact:true}).click()
            await page.waitForFunction(()=>document.querySelectorAll('#sheet-notifications li[data-notification-id]').length===25)
            await page.screenshot({path:'/tmp/dev-and-dice-perf-notifications.png'})
        }
        await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
        assert(await bell.evaluate(element=>element===document.activeElement),'Escape restores trigger focus')
    }
    assert.equal(await name.inputValue(),'Mago QA abcdefgh','Opening notifications preserves the text draft')
    await bell.click();await dialog.locator('li[data-notification-id]').first().waitFor()
    await dialog.getByRole('button',{name:'Segna come letta',exact:true}).first().click()
    await page.getByRole('button',{name:'Notifiche: 24 non lette',exact:true}).waitFor()
    await page.keyboard.press('Escape')
    // A remote edit invalidates the cached page through the existing two-second polling.
    const record=await api(master,'/api/play/characters/'+sheet.id)
    await api(master,'/api/play/characters/'+sheet.id,'PUT',{revision:record.revision,sheet:{...record.sheet,notes:'Nuova modifica remota'}})
    await page.getByRole('button',{name:'Notifiche: 25 non lette',exact:true}).waitFor()
    await bell.click();await dialog.getByText('Nuova modifica remota',{exact:true}).waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await name.inputValue(),'Mago QA abcdefgh','Polling and notification actions preserve unsaved text')
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0))
    await bell.click();await dialog.locator('li[data-notification-id]').first().waitFor()
    assert(await dialog.evaluate(element=>{const r=element.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}),'The notification panel fits the mobile width')
    await page.screenshot({path:'/tmp/dev-and-dice-perf-notifications-mobile.png'})
    await page.keyboard.press('Escape')
    // Resolve the intentional remote-edit conflict before the independent immediate-save check.
    page.once('dialog',dialog=>dialog.accept())
    await page.getByRole('button',{name:'Ricarica scheda',exact:true}).click()
    await page.waitForFunction(()=>document.querySelector('.player-paper [data-field="name"] input')?.value==='Mago QA')
    // No debounce: the latest character must already be in the draft when Save is clicked.
    await page.setViewportSize({width:1440,height:1000})
    const playerName=page.locator('.player-paper [data-field="playerName"] input')
    await playerName.fill('Giocatore aggiornato')
    await name.fill('Nome intermedio');await name.fill('Mago QA');assert.equal(await name.inputValue(),'Mago QA','Text can return to the original layout value')
    await name.fill('Nome definitivo')
    await page.getByRole('spinbutton',{name:'Valore Forza',exact:true}).fill('16')
    assert.equal(await name.inputValue(),'Nome definitivo','Mechanical edits retain the latest prose')
    assert.equal(await playerName.inputValue(),'Giocatore aggiornato','Switching between text fields retains both edits')
    const tabs=page.locator('.player-sheet-session > .player-sheet-controls > .player-sheet-tabs [role="tab"]')
    await tabs.nth(1).click()
    const story=page.locator('.player-paper [data-field="backgroundStory"] textarea')
    await story.fill('Storia con accenti: città, perché.\nSeconda riga.')
    await story.press('Home');await story.pressSequentially('Una ')
    await page.getByRole('button',{name:'Salva personaggio',exact:true}).click()
    await page.waitForFunction(()=>!document.querySelector('.play-editor-actions button')?.disabled)
    assert.equal(await page.locator('.play-editor-actions [role=alert]').count(),0,await page.locator('.play-editor-actions').innerText())
    const saved=await api(player,'/api/play/characters/'+sheet.id)
    assert.equal(saved.sheet.name,'Nome definitivo')
    assert.equal(saved.sheet.strength,'16')
    assert.equal(saved.sheet.playerDetails.playerName,'Giocatore aggiornato')
    assert.equal(saved.sheet.playerDetails.backgroundStory,'Storia con accenti: città, perché.\nUna Seconda riga.','Saving immediately after typing includes the last character')
    await tabs.first().click();assert.equal(await name.inputValue(),'Nome definitivo','Page changes show the saved text')
    const metrics=metricsAfter.metrics.filter(m=>['ScriptDuration','LayoutDuration','RecalcStyleDuration','TaskDuration'].includes(m.name)).map(m=>({name:m.name,ms:1000*(m.value-metricsBefore.metrics.find(b=>b.name===m.name).value)}))
    const report={metrics,environment:`${process.argv.includes('--production') ? 'Production build' : 'Vite development, React StrictMode'}, Chromium headless, 1440x1000, CPU 4x`,typing:{samples:typing.inputs.length,median:typing.inputs.toSorted((a,b)=>a-b)[Math.floor(typing.inputs.length/2)],p95:typing.inputs.toSorted((a,b)=>a-b)[Math.floor(typing.inputs.length*.95)],renders:typing.renders,mutations:typingRequests.length,hot},openings,errors}
    console.log(JSON.stringify(report,null,2))
    if(process.argv[2]) await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n')
    assert.deepEqual(errors,[])
    }
} finally {
    await browser?.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})
}
