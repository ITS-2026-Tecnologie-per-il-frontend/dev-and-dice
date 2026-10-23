// Run: node tests/mending-ui.mjs. Uses an isolated session and real 2014 spell catalog.
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

// QA: no redundant idle status; static cantrip mode; no object spell damage controls;
// normal damage/slot controls retained; compact target list; minute-long casting,
// interruption and completion without slot/HP changes; legacy in-flight damage; both views/mobile.
const dataDir=await mkdtemp(join(tmpdir(),'dev-and-dice-mending-'))
const app=await createApp({dataDir,production:false,sessionSecret:'mending-test-secret-at-least-thirty-two-bytes'})
const server=app.listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}})
await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform==='win32'?'msedge':undefined)})
const artifacts=resolve('handoff.local/mending-qa');await mkdir(artifacts,{recursive:true})
async function api(context,path,method='GET',data) {
    const response=await context.request.fetch(base+'/api/play'+path,{method,data})
    assert(response.ok(),await response.text());return response.json()
}
try {
    const directory=resolve('public/data/rules2014')
    const verified=await loadCandidateCreationData('runtime',async url=>{const file=join(directory,url.replace('runtime/',''));return {ok:existsSync(file),text:async()=>readFileSync(file,'utf8')}})
    const catalog=activeCatalog(verified,'it')
    const spell=id=>catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:'+id)
    const action=(id,index)=>({...templateFromCatalog(spell(id)),id:index,ownerId:0,active:false})
    const context=await browser.newContext({viewport:{width:1440,height:1100}})
    const registration=await context.request.post(base+'/api/register',{data:{username:'MendingQA',password:'test-password-123'}})
    assert(registration.ok(),await registration.text())
    let game=await api(context,'/games','POST',{name:'Riparare - prova'})
    const sheets=['Gaglio','Fauce Gorgogliante','Cacciatore Invisibile'].map(name=>({...newCharacterSheet(),name,kind:'PNG',hitPoints:'30',armorClass:'15',initiative:'12',playerDetails:{maxHitPoints:'30','slots.1.total':'4','slots.1.used':'1','slots.2.total':'3','slots.2.used':'1'}}))
    for(const sheet of sheets) {
        await api(context,'/characters','POST',{sheet})
        game=await api(context,`/games/${game.id}/characters`,'POST',{characterId:sheet.id,revision:game.revision})
    }
    const mending={...action('mending',0),damageEnabled:true,instantaneous:false,targets:[{id:1,damage:'99',resolved:true}]}
    const state={turns:sheets.map((sheet,id)=>({id,description:sheet.name,initiative:sheet.initiative,hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:'',sheet})),abilities:[mending,action('fire-bolt',1),action('scorching-ray',2)],combat:null}
    await api(context,`/games/${game.id}/state`,'PUT',{revision:game.revision,sheets,state})
    const page=await context.newPage(),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto(base+'/games/'+game.id)
    await page.getByText('Caricamento del catalogo…',{exact:true}).waitFor({state:'hidden'})
    const row=page.locator('#ability-0')
    await row.waitFor()
    await row.getByText('Ripara un oggetto toccato, senza infliggere danni. Tempo di lancio: 1 minuto.',{exact:true}).waitFor()
    for(const view of ['Originale','Rinnovata']) {
        await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
        await page.getByRole('radio',{name:new RegExp('^'+view)}).check()
        await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()
        assert.equal(await row.getByRole('status').filter({hasText:/^Usa$/}).count(),0)
        assert.equal(await row.getByRole('combobox',{name:'Origine del lancio di Riparare',exact:true}).count(),0)
        assert.equal(await row.getByRole('combobox',{name:'Modalità di Riparare',exact:true}).count(),0)
        await row.getByText('Trucchetto · senza slot',{exact:true}).waitFor()
        assert.equal(await row.getByRole('checkbox',{name:'Prevede danni',exact:true}).count(),0)
        assert.equal(await row.getByRole('group',{name:'Bersagli del danno',exact:true}).count(),0)
        await row.getByText('Ripara un oggetto toccato, senza infliggere danni. Tempo di lancio: 1 minuto.',{exact:true}).waitFor()
        await row.screenshot({path:join(artifacts,view.toLowerCase()+'.png')})
    }
    const damage=page.locator('#ability-1').getByRole('group',{name:'Bersagli del danno',exact:true})
    assert.equal(await damage.getByRole('checkbox').count(),3,'Self is directly selectable alongside the other creatures')
    assert((await damage.boundingBox()).height<240,'Damage target selection should remain compact')
    await damage.screenshot({path:join(artifacts,'damage-targets.png')})
    assert.equal(await page.locator('#ability-1').getByRole('combobox',{name:'Modalità di Dardo di Fuoco',exact:true}).count(),0)
    await page.locator('#ability-2').getByRole('combobox',{name:'Modalità di Raggio Rovente',exact:true}).waitFor()
    await row.getByRole('checkbox',{name:/Confermo oggetto a contatto/}).check()
    await row.getByRole('button',{name:'Usa',exact:true}).click()
    await row.getByRole('button',{name:'Completa lancio',exact:true}).waitFor()
    await row.getByRole('button',{name:'Interrompi lancio senza consumo',exact:true}).click()
    await row.getByRole('button',{name:'Usa',exact:true}).waitFor()
    await row.getByRole('checkbox',{name:/Confermo oggetto a contatto/}).check()
    await row.getByRole('button',{name:'Usa',exact:true}).click()
    await row.getByRole('button',{name:'Completa lancio',exact:true}).click()
    await row.waitFor({state:'detached'})
    await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
    let saved=await api(context,`/games/${game.id}`)
    assert(saved.state.turns.every(turn=>turn.hitPoints==='30'))
    for(const key of ['slots.1.used','slots.2.used']) assert.equal(saved.characters[0].sheet.playerDetails[key],'1')
    // A saved pre-fix execution with stale damage targets must also resolve without harm.
    const legacy={...mending,id:3,execution:{id:crypto.randomUUID(),phase:'resolving',option:'cantrip',cost:1}}
    await api(context,`/games/${game.id}/state`,'PUT',{revision:saved.revision,sheets:saved.characters.map(character=>character.sheet),state:{...saved.state,abilities:[...saved.state.abilities,legacy]}})
    await page.reload()
    await page.locator('#ability-3').getByRole('button',{name:'Concludi uso',exact:true}).click()
    await page.locator('#ability-3').waitFor({state:'detached'})
    await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
    saved=await api(context,`/games/${game.id}`)
    assert(saved.state.turns.every(turn=>turn.hitPoints==='30'),'Legacy Mending targets must not deal damage')
    // Restore an idle card to inspect the same simplified controls on a small phone.
    await api(context,`/games/${game.id}/state`,'PUT',{revision:saved.revision,sheets:saved.characters.map(character=>character.sheet),state:{...saved.state,abilities:[...saved.state.abilities,mending]}})
    await page.setViewportSize({width:375,height:812});await page.reload()
    await page.locator('#ability-0').waitFor();await page.locator('#ability-0').scrollIntoViewIfNeeded()
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    await page.locator('#ability-0').screenshot({path:join(artifacts,'mobile.png')})
    assert.deepEqual(errors,[])
    console.log('PASS: Mending has no damage targets or redundant cantrip menus; compact damage list; both views/mobile; full casting/cancel flow; no slots/HP spent; stale saved executions corrected')
} finally {
    await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))
    assert(resolve(dataDir).startsWith(join(resolve(tmpdir()),'dev-and-dice-mending-')))
    await rm(dataDir,{recursive:true,force:true})
}
