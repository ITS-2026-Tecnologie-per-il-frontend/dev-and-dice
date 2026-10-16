// Run: node tests/combat-requests-ui.mjs — real browser, two accounts, isolated API/Vite.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { createApp } from '../server/index.mjs'
import { combatRules } from '../server/combat-requests.mjs'
import { templateFromCatalog } from '../src/utils/Catalog.ts'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'

const dataDir=await mkdtemp(join(tmpdir(),'dev-and-dice-actions-ui-'))
const server=(await createApp({dataDir,production:false,sessionSecret:'combat-request-ui-isolated-secret-long-enough'})).listen(0)
await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}})
await frontend.listen()
const url=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),errors=[]
async function api(context,path,method='GET',data) {const response=await context.request.fetch(url+path,{method,data});assert(response.ok(),await response.text());return response.json()}
async function waitUntil(check) {for(let count=0;count<150;count++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100))}assert.fail('Expected browser state did not arrive')}
try {
    const master=await browser.newContext({viewport:{width:1440,height:1000}}),player=await browser.newContext({viewport:{width:1440,height:1000}})
    for(const [context,username] of [[master,'BrowserMaster'],[player,'BrowserPlayer']]) await api(context,'/api/register','POST',{username,password:'test-password-123'})
    const {catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:'+id))
    const bolt=spell('fire-bolt'),missile=spell('magic-missile')
    const sheet={...newCharacterSheet(),name:'Maga UI',level:'1',characterClass:'Mago',hitPoints:'15',armorClass:'12',abilities:[bolt,missile,{name:'Protezione UI',duration:'1 minuto',remainingTurns:10}],
        playerDetails:{'creation.class':'wizard','sheet.template':'wizard-pdf','slots.1.total':'2','slots.1.used':'0'}}
    const game=await api(master,'/api/play/games','POST',{name:'Azioni browser'}),path='/api/play/games/'+game.id
    await api(player,'/api/play/invites/'+game.inviteToken+'/join','POST',{sheet})
    const monster={...newCharacterSheet(),name:'Orco UI',kind:'Mostro',hitPoints:'30',armorClass:'13'}
    let now=await api(master,path)
    const turn=(id,sheet)=>({id,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:'',sheet})
    await api(master,path+'/state','PUT',{revision:now.revision,sheets:[sheet,monster],state:{turns:[turn(1,sheet),turn(2,monster)],abilities:[],combat:{activeId:1,round:1}}})
    const masterPage=await master.newPage(),playerPage=await player.newPage()
    for(const page of [masterPage,playerPage]) {page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message))}
    await Promise.all([masterPage.goto(url+'/games/'+game.id),playerPage.goto(url+'/games/'+game.id)])
    const actions=playerPage.getByRole('region',{name:'Le tue azioni'}),reviews=masterPage.locator('.play-combat-requests')
    await actions.getByRole('button',{name:'Scegli azione',exact:true}).click()
    await actions.getByLabel('Azione',{exact:true}).selectOption({label:bolt.name})
    await actions.getByLabel('Risoluzione',{exact:true}).selectOption('attack')
    await actions.getByRole('checkbox',{name:'Orco UI',exact:true}).check()
    assert.equal(await actions.getByLabel('Tiro dei danni',{exact:true}).count(),0,'Damage comes after the attack roll and hit confirmation')
    await actions.getByLabel('Tiro per colpire (totale, con modificatori)',{exact:true}).fill('18 = 13 + 5')
    await actions.getByRole('checkbox',{name:'Almeno un attacco ha colpito',exact:false}).check()
    await actions.getByLabel('Tiro dei danni',{exact:true}).fill('1d10 = 9')
    await actions.getByLabel('Danni finali proposti',{exact:true}).fill('9')
    await playerPage.setViewportSize({width:390,height:844})
    assert(await playerPage.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),'The open action form must fit a phone screen')
    await actions.screenshot({path:'/tmp/dev-and-dice-combat-actions-form-mobile.png'})
    await playerPage.setViewportSize({width:1440,height:1000})
    await actions.getByRole('button',{name:'Invia al Master',exact:true}).dblclick()
    await actions.getByText('In attesa del Master',{exact:true}).waitFor()
    now=await api(master,path);assert.equal(now.state.turns[1].hitPoints,'30');assert.equal(now.combatRequests.length,1)
    await reviews.getByText(/Azioni dei giocatori/).click()
    const review=reviews.locator('.combat-request').filter({has:masterPage.getByRole('heading',{name:bolt.name,exact:true})})
    await review.getByText('In attesa del Master',{exact:true}).waitFor()
    assert(await review.getByRole('button',{name:'Approva azione'}).isDisabled())
    await review.getByLabel('Danni finali a Orco UI',{exact:true}).fill('4')
    await review.getByRole('checkbox',{name:'Confermo requisiti',exact:false}).check()
    await review.getByRole('button',{name:'Approva azione',exact:true}).dblclick()
    await review.getByText('Approvata',{exact:true}).waitFor()
    await actions.getByText('Approvata',{exact:true}).waitFor()
    now=await api(master,path);assert.equal(now.state.turns[1].hitPoints,'26');assert.equal(now.characters.find(record=>record.id===sheet.id).sheet.playerDetails['slots.1.used'],'0')
    await actions.getByRole('button',{name:'Aggiorna azioni',exact:true}).click()
    await actions.getByLabel('Azione',{exact:true}).selectOption({label:missile.name})
    await actions.getByLabel('Risoluzione',{exact:true}).selectOption('automatic')
    await actions.getByRole('checkbox',{name:'Orco UI',exact:true}).check()
    assert.equal(await actions.getByLabel('Tiro per colpire (totale, con modificatori)').count(),0,'Automatic hit does not require an attack roll')
    await actions.getByLabel('Tiro dei danni',{exact:true}).fill('3d4 + 3 = 10')
    await actions.getByLabel('Danni finali proposti',{exact:true}).fill('10')
    await actions.getByRole('button',{name:'Invia al Master',exact:true}).click()
    await actions.getByText('In attesa del Master',{exact:true}).waitFor()
    const rejected=reviews.locator('.combat-request').filter({has:masterPage.getByRole('heading',{name:missile.name,exact:true})})
    await rejected.getByRole('button',{name:'Rifiuta azione',exact:true}).click()
    await actions.getByText('Rifiutata',{exact:true}).waitFor()
    now=await api(master,path);assert.equal(now.state.turns[1].hitPoints,'26');assert.equal(now.characters.find(record=>record.id===sheet.id).sheet.playerDetails['slots.1.used'],'0')
    await actions.getByLabel('Azione',{exact:true}).selectOption({label:'Protezione UI'})
    await actions.getByRole('button',{name:'Invia al Master',exact:true}).click()
    await actions.getByText('In attesa del Master',{exact:true}).waitFor()
    now=await api(master,path)
    await api(master,path+'/state','PUT',{revision:now.revision,sheets:now.characters.map(record=>record.sheet),state:{...now.state,combat:{activeId:2,round:1}}})
    await actions.getByText('Superata: turno o dati cambiati',{exact:true}).waitFor()
    await reviews.getByText('Superata: turno o dati cambiati',{exact:true}).waitFor()
    const stale=reviews.locator('.combat-request').filter({has:masterPage.getByRole('heading',{name:'Protezione UI',exact:true})})
    assert.equal(await stale.getByRole('button',{name:'Approva azione',exact:true}).count(),0)
    await actions.getByRole('button',{name:'Aggiorna azioni',exact:true}).click()
    await actions.getByRole('alert').filter({hasText:'soltanto durante il tuo turno'}).waitFor()
    // A decision response delayed by the network must not overwrite a new local Master draft.
    await stale.getByRole('button',{name:'Rifiuta azione',exact:true}).click()
    now=await api(master,path)
    await api(master,path+'/state','PUT',{revision:now.revision,sheets:now.characters.map(record=>record.sheet),state:{...now.state,combat:{activeId:1,round:2}}})
    await waitUntil(async()=>await masterPage.getByText('Round 2 · Tocca a Maga UI',{exact:true}).count()>0)
    await actions.getByRole('button',{name:'Aggiorna azioni',exact:true}).click()
    await actions.getByLabel('Azione',{exact:true}).selectOption({label:'Protezione UI'})
    await actions.getByRole('button',{name:'Invia al Master',exact:true}).click()
    const pendingReview=reviews.locator('.combat-request').filter({hasText:'In attesa del Master'})
    await pendingReview.getByRole('checkbox',{name:'Confermo requisiti',exact:false}).check()
    let releaseResponse,started
    const release=new Promise(resolve=>{releaseResponse=resolve}),received=new Promise(resolve=>{started=resolve})
    await masterPage.route('**/requests/*/approve',async route=>{const response=await route.fetch();started();await release;await route.fulfill({response})})
    await pendingReview.getByRole('button',{name:'Approva azione',exact:true}).click()
    await received
    await masterPage.getByRole('button',{name:'Turno successivo →',exact:true}).click()
    await waitUntil(()=>masterPage.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('dev-and-dice.game-draft.')&&!key.endsWith('.library')&&JSON.parse(localStorage.getItem(key)).state?.combat?.activeId===2)))
    releaseResponse()
    await masterPage.getByRole('alert').filter({hasText:'Decisione salvata. Hai iniziato altre modifiche'}).waitFor()
    assert.equal((await api(master,path)).state.combat.activeId,1,'The unsaved draft must not silently overwrite an approved action')
    masterPage.once('dialog',dialog=>dialog.accept())
    await masterPage.getByRole('button',{name:'Ricarica dati del server',exact:true}).click()
    await actions.getByRole('article').filter({has:playerPage.getByRole('heading',{name:'Protezione UI',exact:true})}).getByText('Approvata',{exact:true}).waitFor()
    await masterPage.unroute('**/requests/*/approve')
    for(const width of [390,768]) {
        await playerPage.setViewportSize({width,height:844})
        await masterPage.setViewportSize({width,height:844})
        for(const page of [playerPage,masterPage]) assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),'No horizontal overflow at '+width)
    }
    await actions.screenshot({path:'/tmp/dev-and-dice-combat-actions-mobile.png'})
    await reviews.screenshot({path:'/tmp/dev-and-dice-combat-reviews-mobile.png'})
    await playerPage.reload();await playerPage.getByText('Approvata',{exact:true}).first().waitFor()
    assert.deepEqual(errors,[])
    console.log('PASS browser: attack flow, corrected approval, double clicks, cantrip, automatic-hit rejection, no-damage effects, turn changes, local draft/approval race, reload and mobile layout')
} catch(error) {
    for(const context of browser.contexts()) for(const page of context.pages()) {
        console.error(page.url(),(await page.locator('body').innerText()).slice(-6000))
        await page.screenshot({path:'/tmp/dev-and-dice-actions-failure-'+browser.contexts().indexOf(context)+'.png'})
    }
    console.error(errors);throw error
} finally {await browser.close();await frontend.close();await new Promise(resolve=>server.close(resolve));await rm(dataDir,{recursive:true,force:true})}
