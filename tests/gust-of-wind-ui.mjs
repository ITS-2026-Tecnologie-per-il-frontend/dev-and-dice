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
async function help(page,scope,{touch=false,screenshot}={}){
 const label='Tiro salvezza su Forza per il bersaglio',button=scope.getByRole('button',{name:'Aiuto: '+label,exact:true})
 await scope.getByText(label,{exact:true}).waitFor()
 const style=await button.evaluate(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,radius:s.borderRadius,padding:s.padding}})
 assert.equal(style.background,'rgba(0, 0, 0, 0)','Help must not inherit the primary green button background')
 assert.equal(style.radius,'50%');assert.equal(style.padding,'0px')
 assert.equal(await scope.getByText('1d20 su Forza',{exact:true}).count(),0,'The explanation stays out of the form')
 if(touch)await button.tap()
 else{await button.focus();if(await button.getAttribute('aria-expanded')!=='true')await button.press('Enter')}
 const tooltip=page.getByRole('tooltip');await tooltip.getByText('1d20 su Forza',{exact:true}).waitFor()
 await tooltip.getByText(/Al lancio non devi inserire dadi/).waitFor();await tooltip.getByText(/Se fallisce, viene spinta di 4.5 m/).waitFor()
 const box=await tooltip.boundingBox(),size=page.viewportSize();assert(box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1)
 if(screenshot)await page.screenshot({path:join(root,screenshot),animations:'disabled'})
 await page.keyboard.press('Escape');await tooltip.waitFor({state:'detached'})
}
try{
 for(const [context,username] of [[master,'GustMasterQA'],[player,'GustCasterQA']])await api(context,'/register','POST',{username,password:'test-password-123'})
 const {catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
 const sheet=sheetWithCombatAbilities({...newCharacterSheet(),name:'Baldur',characterClass:'Mago',level:'5',intelligence:'16',hitPoints:'30',armorClass:'13',abilities:['gust-of-wind','hold-person'].map(spell),playerDetails:{spellDC:'14','slots.2.total':'3'}},catalog)
 const worg={...newCharacterSheet(),name:'Worg',kind:'Mostro',hitPoints:'30',armorClass:'13',strength:'16'}
 let game=await api(master,'/play/games','POST',{name:'Folata senza dadi al lancio'}),path='/play/games/'+game.id
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet});game=await api(master,path)
 const guard={...worg,id:crypto.randomUUID(),name:'Guardia',strength:'12'}
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[sheet,worg,guard],state:{turns:[sheet,worg,guard].map((sheet,i)=>({id:i+1,sheet,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})),abilities:[],combat:{activeId:1,round:1}}})
 await dm.goto(base+'/games/'+game.id);await renewed(dm)
 await dm.getByRole('button',{name:'Folata di Vento · Usa',exact:true}).click()
 const cast=dm.getByRole('form',{name:'Lancio: Folata di Vento',exact:true})
 assert.equal(await cast.locator(':scope > fieldset > legend').count(),0,'The Master form does not repeat the spell heading')
 await cast.getByRole('group',{name:'Parametri di Folata di Vento',exact:true}).waitFor()
 assert.equal(await cast.locator('xpath=ancestor::div[contains(@class,"ability-row")]').locator('.ability-name input').inputValue(),'Folata di Vento','The Master card keeps its spell title')
 await help(dm,cast)
 assert.equal(await cast.getByText('Dadi richiesti',{exact:true}).count(),0)
 assert.equal(await cast.getByRole('checkbox',{name:/Confermo|Prevede danni|Effetto istantaneo/}).count(),0,'No redundant confirmations for the Master')
 assert.equal(await cast.locator('input:not([type=checkbox])').count(),0,'No d20 or damage is required to cast')
 await cast.getByRole('checkbox',{name:'Worg',exact:true}).check()
 await cast.getByRole('checkbox',{name:'Guardia',exact:true}).check()
 await cast.getByRole('checkbox',{name:'Guardia',exact:true}).uncheck()
 for(const [width,colorScheme] of [[1600,'light'],[390,'dark']]){
  await dm.setViewportSize({width,height:1400});await dm.emulateMedia({colorScheme,reducedMotion:'reduce'})
  assert(await dm.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await cast.screenshot({path:join(root,`gust-master-${width}-${colorScheme}.png`),animations:'disabled'})
  await help(dm,cast,{screenshot:`gust-master-help-${width}-${colorScheme}.png`})
 }
 const cardId=await cast.locator('xpath=ancestor::div[contains(@class,"ability-row")]').getAttribute('id')
 const card=dm.locator('[id="'+cardId+'"]')
 await cast.getByRole('button',{name:'Lancia incantesimo',exact:true}).click()
 await card.getByRole('button',{name:'Termina effetto',exact:true}).waitFor();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await help(dm,card)
 game=await api(master,path);assert.equal(game.characters[0].sheet.playerDetails['slots.2.used'],'1');assert(game.state.abilities.some(a=>a.ruleId==='phb2014:spell:gust-of-wind'&&a.active&&a.concentration))
 assert.deepEqual(game.state.abilities.find(a=>a.ruleId==='phb2014:spell:gust-of-wind').targets.map(t=>t.id),[2],'Casting retains the selected creatures')
 const area=card.getByRole('group',{name:'Creature nella linea di vento',exact:true})
 assert(await area.getByRole('checkbox',{name:'Worg',exact:true}).isChecked())
 await area.getByRole('checkbox',{name:'Guardia',exact:true}).check()
 await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 assert.deepEqual((await api(master,path)).state.abilities.find(a=>a.ruleId==='phb2014:spell:gust-of-wind').targets.map(t=>t.id),[2,3])
 await area.getByRole('checkbox',{name:'Guardia',exact:true}).uncheck()
 await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 assert.equal((await api(master,path)).characters[0].sheet.playerDetails['slots.2.used'],'1','Area updates do not cast or spend resources')
 await card.getByRole('button',{name:'Termina effetto',exact:true}).click();await cast.getByRole('button',{name:'Lancia incantesimo',exact:true}).waitFor();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await pc.goto(base+'/games/'+game.id);await renewed(pc)
 await pc.getByRole('button',{name:'Folata di Vento · Usa',exact:true}).click()
 const proposal=pc.getByRole('form',{name:'Proposta: Folata di Vento',exact:true})
 assert.equal(await proposal.locator(':scope > fieldset > legend').count(),0,'The action name is already in the card heading')
 assert.equal(await proposal.getByRole('group',{name:'Parametri di Folata di Vento',exact:true}).evaluate(e=>getComputedStyle(e).borderTopWidth),'0px','No redundant outer frame')
 assert.equal(await proposal.locator('xpath=ancestor::div[contains(@class,"ability-row")]').getByRole('textbox',{name:'Nome abilità Folata di Vento',exact:true}).inputValue(),'Folata di Vento','The card title remains visible')
 await proposal.getByRole('checkbox',{name:'Worg',exact:true}).check()
 await pc.setViewportSize({width:1600,height:1000});await proposal.screenshot({path:join(root,'gust-player-no-outer-frame-desktop.png'),animations:'disabled'});await pc.setViewportSize({width:390,height:1000})
 await help(pc,proposal,{touch:true,screenshot:'gust-player-mobile-help.png'})
 assert.equal(await proposal.getByText('Dadi richiesti',{exact:true}).count(),0)
 assert.equal(await proposal.locator('input:not([type=checkbox])').count(),0)
 await proposal.screenshot({path:join(root,'gust-player-mobile.png'),animations:'disabled'})
 const sent=pc.waitForResponse(r=>r.url().endsWith('/requests')&&r.request().method()==='POST')
 await pc.route('**/requests',route=>route.continue({postData:JSON.stringify({...route.request().postDataJSON(),mode:'save'})}))
 await proposal.getByRole('button',{name:'Invia al Master',exact:true}).click();const response=await sent;assert(response.ok(),await response.text())
 const legacyBody=response.request().postDataJSON()
 assert.equal((await api(player,path)).rollRequests.length,0,'Gust must not request a saving throw at cast time')
 // Reproduce the live failure: a Master save makes the proposal stale and locks
 // its inputs. Reopening must validate current data and then restore all controls.
 game=await api(master,path)
 const caster=game.characters[0].sheet
 await api(master,path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(c=>c.id===caster.id?{...c.sheet,playerDetails:{...c.sheet.playerDetails,spellDC:'15'}}:c.sheet),state:game.state})
 await dm.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 const review=dm.locator('.combat-request').filter({has:dm.getByRole('heading',{name:'Folata di Vento',exact:true})})
 await review.getByText('Superata: turno o dati cambiati',{exact:true}).waitFor()
 assert(await review.getByRole('checkbox',{name:'Worg',exact:true}).isDisabled())
 await review.getByText(/Aggiorna la richiesta per ricontrollare turno/).waitFor()
 await review.screenshot({path:join(root,'gust-review-stale.png'),animations:'disabled'})
 const reopened=dm.waitForResponse(r=>r.url().endsWith('/roll')&&r.request().postDataJSON()?.kind==='wind-refresh')
 await review.getByRole('button',{name:'Aggiorna richiesta',exact:true}).click()
 const reopenedResponse=await reopened;assert(reopenedResponse.ok(),await reopenedResponse.text())
 await review.getByText('In attesa del Master',{exact:true}).waitFor()
 assert(await review.getByRole('checkbox',{name:'Worg',exact:true}).isEnabled())
 await review.getByText('CD di Baldur: 15',{exact:false}).waitFor()
 assert.equal((await api(master,path)).characters[0].sheet.playerDetails['slots.2.used'],'1','Refreshing does not cast or spend another slot')
 await help(dm,review)
 await review.getByRole('checkbox',{name:'Worg',exact:true}).uncheck()
 await review.getByRole('checkbox',{name:'Guardia',exact:true}).check()
 await review.getByLabel('TS Forza di Guardia · solo d20',{exact:true}).fill('14')
 await review.getByText('Totale TS di Guardia: 15',{exact:true}).waitFor()
 await review.getByRole('status').filter({hasText:'Guardia: Resiste'}).waitFor()
 await review.getByLabel('TS Forza di Guardia · solo d20',{exact:true}).fill('13')
 await review.getByText('Totale TS di Guardia: 14',{exact:true}).waitFor()
 await review.getByRole('status').filter({hasText:'Guardia: Non resiste'}).waitFor()
 await review.getByLabel('TS Forza di Guardia · solo d20',{exact:true}).fill('11')
 await review.getByText('Totale TS di Guardia: 12',{exact:true}).waitFor()
 await review.getByRole('status').filter({hasText:'Guardia: Non resiste'}).waitFor()
 await review.getByRole('checkbox',{name:'Baldur',exact:true}).check()
 const baldur=review.locator('.wind-target').filter({has:dm.getByRole('checkbox',{name:'Baldur',exact:true})})
 await baldur.getByRole('checkbox',{name:'Esito manuale',exact:true}).check()
 assert(await review.getByRole('button',{name:'Approva azione',exact:true}).isDisabled(),'A manual outcome must be chosen explicitly')
 await baldur.getByRole('combobox',{name:'Esito di Baldur',exact:true}).selectOption('true')
 await baldur.getByText('Baldur: Resiste',{exact:true}).waitFor()
 assert.equal(await review.getByText('Decisione del Master',{exact:true}).count(),0,'Only one section heading is needed')
 for(const [width,colorScheme] of [[1600,'light'],[1600,'dark'],[390,'light'],[390,'dark']]){
  await dm.setViewportSize({width,height:1400});await dm.emulateMedia({colorScheme,reducedMotion:'reduce'})
  await help(dm,review,{screenshot:`gust-review-help-${width}-${colorScheme}.png`})
  const bounds=await review.boundingBox()
  assert(bounds.x>=0&&bounds.x+bounds.width<=width+1,'The notification fits the viewport')
  assert(await review.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'The notification has no horizontal overflow')
  const targetBoxes=await review.locator('.wind-target').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,selected:e.querySelector('input').checked})))
  assert(targetBoxes.every(t=>t.height<=(t.selected?230:52)),'Target rows remain compact, including the manual outcome')
  await review.screenshot({path:join(root,`gust-review-${width}-${colorScheme}.png`),animations:'disabled'})
 }
 await review.getByRole('button',{name:'Approva azione',exact:true}).click();await review.getByText('Approvata',{exact:true}).waitFor()
 game=await api(master,path);assert.equal(game.characters[0].sheet.playerDetails['slots.2.used'],'2');assert.equal(game.state.turns[1].hitPoints,'30');assert.equal(game.combatRequests[0].resolution.kind,'none')
 assert.deepEqual(game.combatRequests[0].wind.selected,[3,1])
 assert.equal(game.combatRequests[0].wind.saves[3].die,11)
 assert.equal(game.combatRequests[0].resolution.deferredSave.dc,15)
 await api(player,path+'/requests','POST',legacyBody)
 assert.equal((await api(master,path)).characters[0].sheet.playerDetails['slots.2.used'],'2','A retry from the stale preview is idempotent')
 const forbidden=await player.request.post(base+'/api'+path+'/requests/'+game.combatRequests[0].id+'/roll',{data:{revision:game.revision,kind:'wind',wind:{selected:[2],saves:{2:{mode:'manual',success:true}}}}})
 assert.equal(forbidden.status(),403,'A player cannot decide save outcomes')
 assert.equal(await review.locator('form,input,select').count(),0,'Approval closes the form and leaves only a receipt')
 assert.equal(await review.getByRole('button',{name:'Salva bersagli e tiri salvezza',exact:true}).count(),0)
 const immutable=await master.request.post(base+'/api'+path+'/requests/'+game.combatRequests[0].id+'/roll',{data:{revision:game.revision,kind:'wind',wind:{selected:[],saves:{}}}})
 assert.equal(immutable.status(),409,'Approved area and rolls cannot be altered through the API')
 await dm.reload();await dm.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 await review.getByRole('status').filter({hasText:'Baldur: Resiste'}).waitFor()
 game=await api(master,path);assert.equal(game.characters[0].sheet.playerDetails['slots.2.used'],'2');assert(game.state.turns.every(t=>t.hitPoints==='30'))
 assert.equal((await api(player,path)).combatRequests[0].wind,undefined)
 await pc.reload();await pc.getByRole('button',{name:spell('hold-person').name+' · Usa',exact:true}).click()
 const hold=pc.getByRole('form',{name:'Proposta: '+spell('hold-person').name,exact:true})
 await hold.getByRole('checkbox',{name:'Worg',exact:true}).check()
 await hold.getByText('Tiro salvezza su Saggezza per il bersaglio',{exact:true}).waitFor()
 assert.equal(await hold.getByText('Dadi richiesti',{exact:true}).count(),0,'An immediate save without damage has no empty dice fieldset either')
 assert.deepEqual(errors,[])
 console.log('PASS Gust of Wind: stale request reopening, editable targets/dice/manual outcomes, current caster DC and equal/below threshold, private results, slots/concentration, desktop/mobile and both themes')
}catch(error){console.error('UI errors',errors,'Master alerts',await dm.getByRole('alert').allTextContents().catch(()=>[]));await dm.screenshot({path:join(root,'gust-master-failure.png')}).catch(()=>{});await pc.screenshot({path:join(root,'gust-player-failure.png')}).catch(()=>{});throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
