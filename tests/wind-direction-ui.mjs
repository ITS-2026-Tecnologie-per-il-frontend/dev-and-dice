// Run: node tests/gust-of-wind-ui.mjs. Isolated data; no live characters.
// QA: no empty dice box or premature save, explicit Strength/turn-start guidance,
// shared dagger spacing, Master casting and player approval, concentration/slots,
// no damage, immediate saves without damage, desktop/mobile and both themes.
// Agentation: compact target-save label, all help in ?, keyboard/touch/Escape,
// tooltip within viewport, and help still available while the spell is active.
// Notification: standard circular help, compact targets, dice/manual outcomes,
// readable on desktop/mobile in light/dark themes without horizontal overflow.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdir,mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {sheetWithCombatAbilities,templateFromCatalog} from '../src/utils/Catalog.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'gust-wind-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'gust-wind-browser-check-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true})
const master=await browser.newContext({viewport:{width:1600,height:1400}}),player=await browser.newContext({viewport:{width:390,height:1000},isMobile:true,hasTouch:true}),dm=await master.newPage(),pc=await player.newPage(),errors=[]
for(const page of [dm,pc]){page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message))}
async function api(context,path,method='GET',data){const r=await context.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function renewed(page){await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('radio',{name:/^Rinnovata/}).check();await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
try{
 for(const [context,username] of [[master,'GustMasterQA'],[player,'GustCasterQA']])await api(context,'/register','POST',{username,password:'test-password-123'})
 const {catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
 const sheet=sheetWithCombatAbilities({...newCharacterSheet(),name:'Baldur',characterClass:'Mago',level:'5',intelligence:'16',hitPoints:'30',armorClass:'13',abilities:['gust-of-wind','hold-person'].map(spell),playerDetails:{spellDC:'14','slots.2.total':'3'}},catalog)
 const worg={...newCharacterSheet(),name:'Worg',kind:'Mostro',hitPoints:'30',armorClass:'13',strength:'16'}
 let game=await api(master,'/play/games','POST',{name:'Folata senza dadi al lancio'}),path='/play/games/'+game.id
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet});game=await api(master,path)
 const guard={...worg,id:crypto.randomUUID(),name:'Guardia',strength:'12'}
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[sheet,worg,guard],state:{turns:[sheet,worg,guard].map((sheet,i)=>({id:i+1,sheet,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})),abilities:[],combat:{activeId:1,round:1}}})

 let choices=await api(player,path+'/actions'),action=choices.actions.find(a=>a.resolution?.deferredSave)
 game=await api(player,path+'/requests','POST',{id:crypto.randomUUID(),revision:choices.revision,key:action.key,option:'slot:2',cost:1,mode:'none',damageEnabled:false,packets:[{targetId:2,damage:[]}]})
 let request=game.combatRequests[0]
 game=await api(master,path+'/requests/'+request.id+'/approve','POST',{revision:game.revision,confirmed:true,targets:[{id:2,damage:'0'}]})
 await pc.goto(base+'/games/'+game.id);await renewed(pc)
 await pc.getByRole('button',{name:'Folata di Vento · In esecuzione',exact:true}).click()
 const playerButton=pc.getByRole('button',{name:'Cambia direzione (usa azione bonus)',exact:true})
 await playerButton.click()
 const playerForm=pc.getByRole('form',{name:'Cambia direzione di Folata di Vento',exact:true})
 await playerForm.getByRole('checkbox',{name:'Worg',exact:true}).uncheck()
 await playerForm.getByRole('checkbox',{name:'Guardia',exact:true}).check()
 assert.equal(await playerForm.locator('input:not([type=checkbox])').count(),0)
 await playerForm.screenshot({path:join(root,'wind-direction-player-mobile-light.png'),animations:'disabled'})
 await pc.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'})
 assert(await pc.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await playerForm.screenshot({path:join(root,'wind-direction-player-mobile-dark.png'),animations:'disabled'})
 const duration=game.state.abilities.find(a=>a.active).remainingTurns
 await playerForm.getByRole('button',{name:'Invia al Master',exact:true}).click()
 await pc.getByText('Hai un’azione in attesa del Master.',{exact:true}).waitFor()
 assert(await playerButton.isDisabled())
 game=await api(master,path)
 assert.equal(game.combatRequests[0].windDirection,true)
 assert.deepEqual(game.combatRequests[0].wind.selected,[3])
 assert.equal(game.characters[0].sheet.playerDetails['combat.bonusActionUsed'],undefined)
 await dm.goto(base+'/games/'+game.id);await renewed(dm)
 await dm.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 const review=dm.locator('.combat-request--review').first()
 await review.getByText('Cambio direzione · azione bonus',{exact:true}).waitFor()
 await review.getByLabel('TS Forza di Guardia · solo d20',{exact:true}).fill('12')
 await review.getByRole('button',{name:'Approva azione',exact:true}).click()
 await review.getByText('Approvata',{exact:true}).waitFor()
 assert.equal(await review.locator('input,select,form').count(),0,'Approved notifications contain a read-only receipt')
 assert.equal(await review.getByRole('button',{name:'Salva bersagli e tiri salvezza',exact:true}).count(),0)
 game=await api(master,path)
 assert.equal(game.characters[0].sheet.playerDetails['combat.bonusActionUsed'],'true')
 assert.equal(game.characters[0].sheet.playerDetails['slots.2.used'],'1')
 assert.equal(game.state.abilities.find(a=>a.active).remainingTurns,duration)
 assert.deepEqual(game.state.abilities.find(a=>a.active).targets.map(t=>t.id),[3])
 assert.equal((await api(player,path)).rollRequests.length,0)
 await pc.reload();await pc.getByRole('button',{name:'Folata di Vento · In esecuzione',exact:true}).click()
 await pc.getByText('Hai già usato l’azione bonus in questo turno.',{exact:true}).waitFor();assert(await playerButton.isDisabled())
 await dm.keyboard.press('Escape')
 await dm.getByRole('button',{name:'Folata di Vento · In esecuzione',exact:true}).click()
 const area=dm.getByRole('group',{name:'Creature nella linea di vento',exact:true})
 const row=id=>dm.locator('.turn-row[data-reorder-id="'+id+'"]')
 const next=dm.getByRole('button',{name:'Turno successivo →',exact:true})
 const sync=()=>dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 const caster=()=>dm.getByRole('button',{name:'Dettagli di Baldur',exact:true}).click()
 const originalResources=JSON.stringify(game.characters[0].sheet.playerDetails)
 let notifications=JSON.stringify(game.combatRequests)
 const masterDirection=dm.getByRole('button',{name:'Cambia direzione (usa azione bonus)',exact:true})
 assert(await masterDirection.isDisabled(),'Master also sees the direction button, blocked by the caster bonus action already spent')
 await area.getByRole('checkbox',{name:'Worg',exact:true}).check();await sync()
 game=await api(master,path)
 assert.equal(JSON.stringify(game.characters[0].sheet.playerDetails),originalResources,'Master can change membership even with the caster bonus action spent')
 assert.equal(JSON.stringify(game.combatRequests),notifications,'Changing membership leaves approved notification receipts unchanged')
 assert.equal(await row(2).locator('.wind-start-save').count(),0,'No immediate save on selection')
 await next.click();await sync()
 await row(2).getByRole('button',{name:'Tira TS Forza di Worg per Folata di Vento',exact:true}).waitFor()
 assert((await row(2).getAttribute('class')).includes('turn-needs-resolution'))
 assert.equal((await api(master,path)).state.combat.activeId,2)
 await next.click()
 const saveDialog=dm.getByRole('dialog',{name:'Tiro salvezza di inizio turno',exact:true})
 await saveDialog.waitFor()
 assert.equal((await api(master,path)).state.combat.activeId,2,'Pending start-turn save blocks advancing')
 await dm.keyboard.press('Escape')
 await row(2).getByRole('button',{name:'Tira TS Forza di Worg per Folata di Vento',exact:true}).click()
 await saveDialog.getByLabel('Tiro salvezza Forza di Worg',{exact:true}).fill('10')
 await saveDialog.getByRole('button',{name:/Registra/}).click()
 await saveDialog.getByRole('button',{name:'Conferma tiro salvezza',exact:true}).click()
 await saveDialog.waitFor({state:'hidden'});await sync()
 await row(2).getByText(/TS fallito.*spingi la creatura/).waitFor()
 game=await api(master,path)
 assert.equal(game.state.combat.activeId,2,'Resolving wind keeps the creature on its own turn')
 assert.equal(game.state.abilities.find(a=>a.active).windSave.turn.success,false)
 assert(game.state.abilities.find(a=>a.active).concentration)
 assert.equal(game.characters[0].sheet.playerDetails['slots.2.used'],'1')
 await dm.reload();await row(2).getByText(/TS fallito.*spingi la creatura/).waitFor()
 assert.equal(await row(2).locator('.wind-start-save').count(),0,'Reload preserves a resolved save')
 await next.click();await sync()
 await row(3).getByRole('button',{name:'TS superato',exact:true}).click();await sync()
 game=await api(master,path);assert.equal(game.state.combat.activeId,3)
 assert(game.state.abilities.find(a=>a.active),'Success does not end the source spell')
 await next.click();await sync()
 await caster();await masterDirection.click()
 const directionForm=dm.getByRole('form',{name:'Cambia direzione di Folata di Vento',exact:true})
 assert.equal(await masterDirection.count(),0,'The direction button hides while its form is open')
 assert.equal(await directionForm.locator('input:not([type=checkbox])').count(),0,'Changing direction does not resolve immediate saves')
 const confirmed=dm.waitForResponse(r=>r.url().endsWith('/wind-direction')&&r.request().method()==='POST')
 await directionForm.getByRole('button',{name:'Conferma cambio direzione',exact:true}).click()
 const response=await confirmed;assert(response.ok(),await response.text())
 await masterDirection.waitFor();assert(await masterDirection.isDisabled())
 game=await api(master,path)
 assert.equal(game.characters[0].sheet.playerDetails['combat.bonusActionUsed'],'true','Master direction uses the caster bonus action')
 assert.equal(game.characters[0].sheet.playerDetails['slots.2.used'],'1')
 assert.equal(game.combatRequests[0].status,'approved','The Master applies direction directly')
 assert.equal(JSON.stringify(game.combatRequests.slice(1)),notifications,'Previous approved notifications stay unchanged')
 notifications=JSON.stringify(game.combatRequests)
 await api(master,path+'/wind-direction','POST',response.request().postDataJSON())
 assert.equal(await row(1).locator('.wind-start-save').count(),0)
 await area.getByRole('checkbox',{name:'Tu (Baldur)',exact:true}).check();await sync()
 assert.equal((await api(master,path)).characters[0].sheet.playerDetails['combat.bonusActionUsed'],'true','Free area editing remains available after using direction')
 assert.equal(await row(1).locator('.wind-start-save').count(),0,'Entering the line mid-turn does not trigger a retroactive save')
 await next.click();await sync()
 await row(2).getByRole('button',{name:'TS superato',exact:true}).click();await sync()
 await caster();await area.getByRole('checkbox',{name:'Guardia',exact:true}).uncheck();await sync()
 await next.click();await sync()
 assert.equal(await row(3).locator('.wind-start-save').count(),0,'Leaving before turn start prevents the save')
 await caster();await area.getByRole('checkbox',{name:'Guardia',exact:true}).check();await sync()
 assert.equal(await row(3).locator('.wind-start-save').count(),0,'Entering during the current turn waits until the next own turn')
 await next.click();await sync()
 await row(1).getByRole('button',{name:'TS fallito',exact:true}).click();await sync()
 for(const [width,colorScheme] of [[1600,'light'],[390,'dark']]){
   await dm.setViewportSize({width,height:1100});await dm.emulateMedia({colorScheme,reducedMotion:'reduce'})
   assert(await dm.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await area.screenshot({path:join(root,`wind-area-master-${width}-${colorScheme}.png`),animations:'disabled'})
 }
 await next.click();await sync()
 await row(2).getByRole('button',{name:'TS fallito',exact:true}).waitFor()
 await row(2).screenshot({path:join(root,'wind-start-turn-row-mobile.png'),animations:'disabled'})
 await caster()
 await dm.locator('.ability-row').filter({has:dm.getByRole('group',{name:'Creature nella linea di vento',exact:true})}).getByRole('button',{name:'Termina effetto',exact:true}).click();await sync()
 assert.equal(await row(2).locator('.wind-start-save').count(),0,'Ending concentration clears pending wind saves')
 game=await api(master,path)
 assert.equal(game.characters[0].sheet.playerDetails['slots.2.used'],'1')
 assert(game.state.turns.every(t=>t.hitPoints==='30'))
 assert.equal(JSON.stringify(game.combatRequests),notifications)
 assert.deepEqual(errors,[])
 console.log('PASS Wind direction UI: player and Master forms, selected targets, immutable player notifications, free Master area edits, start-turn saves, roll/manual outcomes, re-entry/reload/concentration, mobile light/dark and desktop')
}catch(error){console.error('UI errors',errors,'Master alerts',await dm.getByRole('alert').allTextContents().catch(()=>[]));await dm.screenshot({path:join(root,'wind-direction-master-failure.png')}).catch(()=>{});await pc.screenshot({path:join(root,'wind-direction-player-failure.png')}).catch(()=>{});throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
