// Run: node tests/master-spell-ui.mjs — shared player form, Master resources and per-ray resolution.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'master-spell-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'master-spell-isolated-test-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1600,height:1050}}),page=await context.newPage(),errors=[]
page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000)
async function api(path,method='GET',data){const r=await context.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function view(name){await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('radio',{name:new RegExp('^'+name)}).check();await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
try {
 await api('/register','POST',{username:'MasterSpellQA',password:'test-password-123'})
 const {catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:'+id))
 const ray=spell('scorching-ray'),bolt=spell('fire-bolt'),fireball=spell('fireball')
 const owner={...newCharacterSheet(),name:'Maga',kind:'PNG',characterClass:'Mago',level:'5',hitPoints:'30',armorClass:'13',abilities:[ray,bolt,fireball],playerDetails:{spellAttackBonus:'7',spellDC:'15','slots.4.total':'1','slots.4.used':'0','slots.5.total':'1','slots.5.used':'0','slots.2.total':'3','slots.2.used':'0','slots.3.total':'1','slots.3.used':'0'}}
 const foe={...newCharacterSheet(),name:'Worg',kind:'PNG',hitPoints:'40',armorClass:'15',dexterity:'14',playerDetails:{'combat.resistances':'fuoco',temporaryHitPoints:'3','rules2014.concentration':'phb2014:spell:bless'}}
 const goblin={...newCharacterSheet(),name:'Goblin',kind:'PNG',hitPoints:'30',armorClass:'12',dexterity:'12'}
 let game=await api('/play/games','POST',{name:'Raggi del Master'}),path='/play/games/'+game.id
 for(const sheet of [owner,foe,goblin]){await api('/play/characters','POST',{sheet});game=await api(path+'/characters','POST',{characterId:sheet.id,revision:game.revision})}
 game=await api(path+'/state','PUT',{revision:game.revision,sheets:[owner,foe,goblin],state:{turns:[owner,foe,goblin].map((sheet,id)=>({id,sheet,description:sheet.name,initiative:String(20-id),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:sheet.playerDetails?.temporaryHitPoints??''})),abilities:[],combat:null}})
 await page.goto(base+'/games/'+game.id);await view('Rinnovata')
 await page.getByRole('button',{name:bolt.name+' · Usa',exact:true}).click()
 await page.getByRole('button',{name:ray.name+' · Usa',exact:true}).click()
 const card=page.locator('#ability-1'),form=card.getByRole('form',{name:'Lancio: '+ray.name,exact:true})
 await form.waitFor()
 assert.equal(await card.getByRole('button',{name:'Usa',exact:true}).count(),0,'Only the shared form starts the spell')
 assert.equal(await card.getByRole('checkbox',{name:/Confermo requisiti|Prevede danni|Esito e danno confermati/}).count(),0)
 const origin=card.getByRole('combobox',{name:'Origine del lancio di '+ray.name,exact:true})
 assert.equal(await origin.inputValue(),'class')
 await origin.selectOption('free');assert.equal(await form.getByRole('combobox',{name:'Risorsa',exact:true}).count(),0)
 await origin.selectOption('class')
 const resource=form.getByRole('combobox',{name:'Risorsa',exact:true})
 await resource.selectOption('slot:2')
 await form.getByRole('checkbox',{name:'Worg',exact:true}).check()
 await form.getByRole('button',{name:'Aggiungi colpo a Worg',exact:true}).click()
 await form.getByRole('checkbox',{name:'Goblin',exact:true}).check()
 const dice=form.getByLabel('Tiro per colpire (inserisci solo il numero del dado)',{exact:true}),damage=form.getByLabel('Danni tirati',{exact:true})
 await dice.nth(0).fill('15');await damage.nth(0).fill('7')
 const drag=card.getByRole('button',{name:/Trascina per riordinare/})
 await drag.focus();await drag.press('ArrowUp')
 assert.equal(await page.locator('.ability-row').first().getAttribute('id'),'ability-1','Arrow keys still reorder the original card')
 assert.equal(await dice.nth(0).inputValue(),'15','Reordering keeps the shared form draft')
 const close=card.getByRole('button',{name:'Elimina '+ray.name,exact:true}),box=await card.boundingBox(),closeBox=await close.boundingBox(),dragBox=await drag.boundingBox()
 assert(closeBox.x>dragBox.x&&Math.abs(closeBox.y-dragBox.y)<2&&closeBox.x+closeBox.width<=box.x+box.width,'Close stays top right and move stays top left')
 assert(await form.getByRole('button',{name:'Aggiungi colpo a Worg',exact:true}).isDisabled(),'The base slot permits three rays')
 await resource.selectOption('slot:3');await form.getByRole('button',{name:'Aggiungi colpo a Worg',exact:true}).click();assert.equal(await dice.count(),4,'Higher slots add a ray')
 await resource.selectOption('slot:2');assert.equal(await dice.count(),3,'Lowering the slot trims excess rays')
 for(const [index,die,amount]of[[0,'15','7'],[1,'20','7'],[2,'1','8']]){await dice.nth(index).fill(die);await damage.nth(index).fill(amount)}
 for(const width of [1600,390,320])for(const colorScheme of ['light','dark']){
  await page.setViewportSize({width,height:1050});await page.emulateMedia({colorScheme})
  assert(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'The Master card fits at '+width)
  await form.locator('.player-roll-packet').first().screenshot({path:join(root,`master-spell-${colorScheme}-${width}.png`)})
 }
 await form.getByRole('button',{name:'Calcola esiti',exact:true}).click()
 const review=card.getByRole('region',{name:'Esiti: '+ray.name,exact:true})
 assert.equal((await api(path)).characters.find(c=>c.id===owner.id).sheet.playerDetails['slots.2.used'],'0','Preview does not spend slots')
 assert(await review.getByRole('button',{name:'Applica danni',exact:true}).isDisabled(),'A critical requires its extra dice')
 const critical=review.getByLabel('Dadi aggiuntivi del critico · Worg · colpo 2 · Fuoco',{exact:true})
 await critical.fill('12');assert.equal(await critical.inputValue(),'12','Critical dice remain editable after entering a value')
 await critical.fill('5')
 await critical.locator('xpath=ancestor::form[1]').getByRole('button',{name:'Registra tiro',exact:true}).click()
 await critical.waitFor({state:'detached'})
 const finalWorg=review.getByLabel('Danni finali a Worg',{exact:true}),finalGoblin=review.getByLabel('Danni finali a Goblin',{exact:true})
 assert.equal(await finalWorg.inputValue(),'9');assert.equal(await finalGoblin.inputValue(),'0')
 assert.equal(await review.locator('.combat-critical-icon').count(),1,'The Master uses the notification critical badge')
 assert.equal(await review.locator('.combat-miss-icon').count(),1,'The Master uses the notification missed-hit badge')
 assert.deepEqual(await review.locator('.combat-result-stats').first().locator('dt').allTextContents(),['Totale per colpire','CA del bersaglio','Danni del colpo'])
 assert.equal(await review.locator('.combat-result-details').count(),3,'Each hit has the same independent calculation details as a player notification')
 await finalWorg.fill('0');await review.getByRole('button',{name:'Ripristina danni calcolati a Worg',exact:true}).click()
 assert.equal(await finalWorg.inputValue(),'9','The shared notification field restores the calculated damage')
 assert(await finalWorg.evaluate(input=>input===document.activeElement),'Reset keeps focus on the damage field')
 assert.equal(await review.evaluate(root=>root.querySelectorAll('form form').length),0,'Critical rolls never create nested forms')
 for(const width of [1600,390,320])for(const colorScheme of ['light','dark']){
  await page.setViewportSize({width,height:1050});await page.emulateMedia({colorScheme})
  assert(await review.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Notification-style review fits at '+width)
  await review.locator('.combat-result').first().screenshot({path:join(root,`master-spell-review-${colorScheme}-${width}.png`)})
 }
 await review.getByRole('button',{name:'Modifica tiri',exact:true}).click()
 assert.equal(await dice.nth(0).inputValue(),'15');assert.equal(await dice.nth(1).inputValue(),'20');assert.equal(await damage.nth(2).inputValue(),'8','Returning to the shared form preserves all rolls')
 await form.getByRole('button',{name:'Calcola esiti',exact:true}).click();await critical.fill('5');await critical.locator('xpath=ancestor::form[1]').getByRole('button',{name:'Registra tiro',exact:true}).click();await critical.waitFor({state:'detached'})
 await review.getByRole('button',{name:'Applica danni',exact:true}).evaluate(button=>{button.click();button.click()})
 await card.waitFor({state:'detached'});await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(path)
 assert.equal(game.characters.find(c=>c.id===owner.id).sheet.playerDetails['slots.2.used'],'1','All rays spend one slot, exactly once')
 assert.equal(game.characters.find(c=>c.id===owner.id).sheet.playerDetails['slots.3.used'],'0')
 assert.equal(game.state.turns[1].hitPoints,'34','Each ray applies resistance before temporary HP')
 assert.equal(game.state.turns[1].temporaryHitPoints,'0')
 assert.equal(game.state.turns[2].hitPoints,'30','A natural one deals no damage')
 assert.deepEqual(game.state.turns[1].concentrationChecks,[10,10],'Each damaging ray causes its own concentration check')
 await page.reload();await page.getByRole('button',{name:ray.name+' · Usa',exact:true}).click()
 await page.getByRole('form',{name:'Lancio: '+ray.name,exact:true}).waitFor()
 const reopened=page.locator('.ability-row').filter({has:page.getByRole('form',{name:'Lancio: '+ray.name,exact:true})})
 await reopened.getByRole('button',{name:'Elimina '+ray.name,exact:true}).click();await reopened.waitFor({state:'detached'})
 assert.equal((await api(path)).characters.find(c=>c.id===owner.id).sheet.playerDetails['slots.2.used'],'1','Closing the form spends nothing')
 await page.setViewportSize({width:1600,height:1050})
 await page.getByRole('button',{name:fireball.name+' · Usa',exact:true}).click()
 const areaForm=page.getByRole('form',{name:'Lancio: '+fireball.name,exact:true}),areaCard=page.locator('.ability-row').filter({has:areaForm})
 assert.equal(await areaCard.getByRole('combobox',{name:'Origine del lancio di '+fireball.name,exact:true}).inputValue(),'class')
 assert.equal(await areaCard.getByRole('button',{name:'Elimina '+fireball.name,exact:true}).count(),1)
 assert.equal(await areaCard.getByRole('button',{name:/Trascina per riordinare/}).count(),1)
 await areaForm.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:4')
 await areaForm.getByRole('checkbox',{name:'Worg',exact:true}).check();await areaForm.getByRole('checkbox',{name:'Goblin',exact:true}).check()
 assert.equal(await areaForm.getByLabel('Danni tirati',{exact:true}).count(),1,'The Master rolls area damage once')
 assert.equal(await areaForm.locator('.player-shared-damage').getByRole('img',{name:'d6',exact:true}).count(),2)
 assert.equal(await areaForm.locator('.combat-dice-result').textContent(),'8 + 1','A higher slot shows base dice plus additional dice without a redundant multiplier')
 await areaForm.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:5')
 assert.equal(await areaForm.locator('.combat-dice-result').textContent(),'8 + 2','Two higher levels add two dice')
 await areaForm.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:4')
 await areaForm.getByLabel('Danni tirati',{exact:true}).fill('21')
 await areaForm.getByRole('button',{name:'Calcola esiti',exact:true}).click()
 const areaReview=page.getByRole('region',{name:'Esiti: '+fireball.name,exact:true})
 assert(await areaReview.getByRole('button',{name:'Applica danni',exact:true}).isDisabled(),'Missing saving throws block application')
 assert.equal((await api(path)).characters.find(c=>c.id===owner.id).sheet.playerDetails['slots.4.used'],'0','Saving throw preview spends no slot')
 for(const [name,die,expected]of[['Worg','2','10'],['Goblin','18','10']]){
  const target=areaReview.getByRole('region',{name:'Riepilogo di '+name,exact:true}),save=target.getByLabel('Tiro salvezza Destrezza di '+name,{exact:true})
  await save.fill(die);await save.locator('xpath=ancestor::form[1]').getByRole('button',{name:'Registra tiro',exact:true}).click()
  await save.waitFor({state:'detached'})
  assert.equal(await target.getByLabel('Danni finali a '+name,{exact:true}).inputValue(),expected,'Each save uses its target bonus and defenses')
 }
 assert.equal(await areaReview.locator('form form').count(),0)
 for(const width of [1600,390,320])for(const colorScheme of ['light','dark']){
  await page.setViewportSize({width,height:1050});await page.emulateMedia({colorScheme})
  assert(await areaReview.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Area review fits at '+width)
 }
 await areaReview.getByRole('button',{name:'Modifica tiri',exact:true}).click()
 assert.equal(await areaForm.getByLabel('Danni tirati',{exact:true}).inputValue(),'21','Editing preserves the shared damage roll')
 assert.equal(await areaForm.getByRole('combobox',{name:'Risorsa',exact:true}).inputValue(),'slot:4')
 for(const width of [390,320]){
  await page.setViewportSize({width,height:1050})
  assert(await areaForm.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'The area form fits at '+width)
  await areaForm.locator('.player-shared-damage').screenshot({path:join(root,`master-area-damage-${width}.png`)})
 }
 await areaForm.getByRole('button',{name:'Calcola esiti',exact:true}).click()
 for(const [name,die]of[['Worg','2'],['Goblin','18']]){
  const save=areaReview.getByLabel('Tiro salvezza Destrezza di '+name,{exact:true})
  await save.fill(die);await save.locator('xpath=ancestor::form[1]').getByRole('button',{name:'Registra tiro',exact:true}).click();await save.waitFor({state:'detached'})
 }
 await areaReview.getByRole('button',{name:'Applica danni',exact:true}).evaluate(button=>{button.click();button.click()})
 await areaReview.waitFor({state:'detached'});await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(path)
 assert.equal(game.characters.find(c=>c.id===owner.id).sheet.playerDetails['slots.4.used'],'1','Area damage spends the higher slot exactly once')
 assert.equal(game.state.turns[1].hitPoints,'24','Failed save then resistance applies the correct area damage')
 assert.equal(game.state.turns[2].hitPoints,'20','Successful save halves area damage')
 assert.deepEqual(errors,[])
 console.log('PASS Master spell form: shared player fields, source, close/move, upcasting limits, preserved rolls, per-hit miss/critical/resistance/concentration, single atomic slot use, area saves and upcasting, persistence, mobile and themes')
}catch(error){await page.screenshot({path:join(root,'master-spell-failure.png'),fullPage:true});console.error('UI errors',errors,'alerts',await page.getByRole('alert').allTextContents());throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
