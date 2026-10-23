// Run: node tests/hold-person-ui.mjs — Hold Person targeting, conditions and end-of-turn saves.
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
const dir=await mkdtemp(join(root,'hold-person-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'hold-person-isolated-test-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1600,height:1050}}),page=await context.newPage(),errors=[]
page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000)
async function api(path,method='GET',data){const r=await context.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function view(name){await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('radio',{name:new RegExp('^'+name)}).check();await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
try {
 await api('/register','POST',{username:'HoldPersonQA',password:'test-password-123'})
 const {catalog}=await combatRules(),hold=templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:hold-person'))
 const mage={...newCharacterSheet(),name:'Maga',kind:'PG',characterClass:'Mago',level:'5',hitPoints:'30',armorClass:'13',abilities:[hold],playerDetails:{spellDC:'15','slots.2.total':'3','slots.3.total':'3'}}
 const guard={...newCharacterSheet(),name:'Guardia',kind:'PNG',race:'Umanoide medio',wisdom:'12',hitPoints:'30',armorClass:'14',playerDetails:{'rules2014.concentration':'test-concentration'}}
 const immune={...newCharacterSheet(),name:'Guardia immune',kind:'Mostro',race:'Medium humanoid',wisdom:'10',hitPoints:'30',armorClass:'14',playerDetails:{'monster.conditionImmunities':'paralyzed'}}
 const beast={...newCharacterSheet(),name:'Ragno gigante',kind:'Mostro',race:'Bestia grande',hitPoints:'30',armorClass:'14'}
 const unknown={...newCharacterSheet(),name:'Creatura sconosciuta',kind:'PNG',hitPoints:'30',armorClass:'14'}
 let game=await api('/play/games','POST',{name:'Blocca Persone QA'}),path='/play/games/'+game.id
 for(const sheet of [mage,guard,immune,beast,unknown]){await api('/play/characters','POST',{sheet});game=await api(path+'/characters','POST',{characterId:sheet.id,revision:game.revision})}
 game=await api(path+'/state','PUT',{revision:game.revision,sheets:[mage,guard,immune,beast,unknown],state:{turns:[mage,guard,immune,beast,unknown].map((sheet,id)=>({id,sheet,description:sheet.name,initiative:String(20-id),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})),abilities:[{id:40,name:'Concentrazione della guardia',ownerId:1,active:true,concentration:true,duration:'1 minuto',remainingTurns:10,ruleId:'test-concentration'}],combat:{activeId:0,round:1}}})
 await page.goto(base+'/games/'+game.id);await view('Rinnovata')
 await page.getByRole('button',{name:hold.name+' · Usa',exact:true}).click()
 const form=page.getByRole('form',{name:'Lancio: '+hold.name,exact:true})
 await form.waitFor()
 assert(await form.getByRole('checkbox',{name:'Ragno gigante',exact:true}).isDisabled(),'A beast cannot be selected for Hold Person')
 assert(await form.getByRole('checkbox',{name:'Creatura sconosciuta',exact:true}).isDisabled(),'An unknown type requires Master configuration')
 assert.equal(await form.getByLabel('Danni tirati',{exact:true}).count(),0)
 await form.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:3')
 await form.getByRole('checkbox',{name:'Guardia',exact:true}).check();await form.getByRole('checkbox',{name:'Guardia immune',exact:true}).check()
 await form.getByRole('button',{name:'Calcola esiti',exact:true}).click()
 const review=page.getByRole('region',{name:'Esiti: '+hold.name,exact:true})
 assert.equal(await review.getByLabel(/Danni finali a/).count(),0,'Hold Person never requests damage')
 for(const name of ['Guardia','Guardia immune']){
  const save=review.getByLabel('Tiro salvezza Saggezza di '+name,{exact:true})
  await save.fill('1');await save.locator('xpath=ancestor::form[1]').getByRole('button',{name:'Registra tiro',exact:true}).click();await save.waitFor({state:'detached'})
 }
 await review.getByRole('button',{name:'Applica esiti',exact:true}).click()
 await review.waitFor({state:'detached'});await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 const guardRow=page.locator('.turn-row[data-reorder-id="1"]'),immuneRow=page.locator('.turn-row[data-reorder-id="2"]')
 await guardRow.getByText('Paralizzato',{exact:true}).waitFor()
 await guardRow.getByRole('button',{name:'Paralizzato',exact:true}).hover()
 const statusHelp=page.getByRole('tooltip')
 await statusHelp.getByText(/Non puoi muoverti, parlare, compiere azioni/).waitFor()
 await statusHelp.getByText(/Origine: Blocca Persone · Maga/).waitFor()
 await statusHelp.getByText('TS Saggezza · CD 15 a fine turno.',{exact:true}).waitFor()
 assert(!(await statusHelp.innerText()).includes('· Guardia'),'The target is not mistaken for the original caster')
 await page.keyboard.press('Escape');await statusHelp.waitFor({state:'detached'})
 assert.equal(await immuneRow.getByText('Paralizzato',{exact:true}).count(),0,'Immunity prevents paralysis')
 game=await api(path)
 assert.equal(game.characters.find(c=>c.id===guard.id).sheet.playerDetails['rules2014.concentration'],'','The target loses its own concentration')
 assert.equal(game.state.abilities.find(a=>a.id===40).active,false)
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.3.used'],'1')
 const child=game.state.abilities.find(a=>a.repeatSaveRoll)
 const parent=game.state.abilities.find(a=>a.id===child.sourceEffectId)
 assert.deepEqual(child.repeatSaveRoll,{ability:'wisdom',dc:15,timing:'end'})
 await page.locator('.turn-row[data-reorder-id="0"]').getByText('Concentrazione',{exact:true}).waitFor()
 assert.equal(child.name,'Paralizzato - '+hold.name)
 assert.equal(await guardRow.getAttribute('class').then(c=>c.includes('turn-needs-resolution')),false,'No repeat is due before this target turn')
 const next=page.getByRole('button',{name:/^Turno successivo/}).first()
 await next.click()
 await guardRow.getByText(/TS Saggezza.*fine turno/).waitFor()
 const identity=await guardRow.locator('.master-participant-identity').boundingBox(),status=await guardRow.locator('.turn-statuses').boundingBox()
 assert(status.x>=identity.x+identity.width-1&&status.y<identity.y+identity.height,'The status sits beside the participant identity instead of adding a new row')
 assert((await guardRow.getAttribute('class')).includes('turn-needs-resolution'),'The active target row highlights its required end-of-turn save')
 assert.equal(await page.getByRole('dialog',{name:'Tiro salvezza di fine turno',exact:true}).count(),0,'The save is not rolled at turn start')
 for(const width of [1600,390,320])for(const colorScheme of ['light','dark']){
  await page.setViewportSize({width,height:1050});await page.emulateMedia({colorScheme})
  assert(await guardRow.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Status pills and reminder fit at '+width)
  await guardRow.screenshot({path:join(root,`hold-person-row-${colorScheme}-${width}.png`)})
 }
 await page.emulateMedia({reducedMotion:'reduce'})
 assert.equal(await guardRow.evaluate(e=>getComputedStyle(e).animationName),'none','Reduced motion keeps a static gold indication')
 await next.click()
 const dialog=page.getByRole('dialog',{name:'Tiro salvezza di fine turno',exact:true})
 await dialog.waitFor()
 assert.equal((await api(path)).state.combat.activeId,1,'Advancing waits for the required save')
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
 assert.equal((await api(path)).state.combat.activeId,1,'Closing the dialog does not skip a required save')
 await next.click()
 let save=dialog.getByLabel('Tiro salvezza Saggezza di Guardia',{exact:true})
 await save.fill('1');await save.locator('xpath=ancestor::form[1]').getByRole('button',{name:'Registra tiro',exact:true}).click();await save.waitFor({state:'detached'})
 await dialog.getByText('TS fallito',{exact:true}).waitFor()
 await dialog.screenshot({path:join(root,'hold-person-repeat-mobile.png')})
 await dialog.getByRole('button',{name:'Conferma tiro salvezza',exact:true}).click();await dialog.waitFor({state:'hidden'})
 await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(path);assert.equal(game.state.combat.activeId,2);assert.equal(game.state.abilities.find(a=>a.id===child.id).repeatSaveRoll.lastRound,1)
 await guardRow.getByText('Paralizzato',{exact:true}).waitFor()
 await page.reload();await guardRow.getByText('Paralizzato',{exact:true}).waitFor()
 for(let i=0;i<4;i++){await next.click();await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()}
 await guardRow.getByText(/TS Saggezza.*fine turno/).waitFor()
 await next.click();await dialog.waitFor()
 save=dialog.getByLabel('Tiro salvezza Saggezza di Guardia',{exact:true})
 await save.fill('20');await save.locator('xpath=ancestor::form[1]').getByRole('button',{name:'Registra tiro',exact:true}).click();await save.waitFor({state:'detached'})
 await dialog.getByText('TS riuscito',{exact:true}).waitFor()
 await dialog.getByRole('button',{name:'Conferma tiro salvezza',exact:true}).evaluate(button=>{button.click();button.click()})
 await dialog.waitFor({state:'hidden'});await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(path);assert.equal(game.state.combat.activeId,2,'Double click resolves and advances exactly once')
 assert.equal(game.state.abilities.find(a=>a.id===child.id),undefined,'The last successful save removes the condition row')
 assert.equal(game.state.abilities.find(a=>a.id===parent.id),undefined,'No affected targets means the spell row closes')
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['rules2014.concentration'],'')
 assert.equal(await page.locator('.turn-row[data-reorder-id="0"]').getByText('Concentrazione',{exact:true}).count(),0)
 assert.equal(await guardRow.getByText('Paralizzato',{exact:true}).count(),0,'A successful repeat removes its condition')
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.3.used'],'1','Repeating a save never spends another slot')
 game=await api(path)
 game=await api(path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(c=>c.id===mage.id?{...c.sheet,playerDetails:{...c.sheet.playerDetails,'rules2014.concentration':hold.ruleId}}:c.sheet),state:{...game.state,combat:{activeId:4,round:2},abilities:[...game.state.abilities.filter(a=>a.id!==parent.id&&a.id!==child.id),...[parent,child].map(a=>({...a,active:true,remainingTurns:1,expiryRound:3}))]}})
 await page.reload();await guardRow.getByText('Paralizzato',{exact:true}).waitFor()
 await next.click();await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await guardRow.getByText('Paralizzato',{exact:true}).waitFor({state:'detached'})
 game=await api(path)
 assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['rules2014.concentration'],'','Expiration clears caster concentration')
 assert.equal(game.state.abilities.find(a=>a.id===child.sourceEffectId),undefined,'Expired Hold Person is removed from combat')
 game=await api(path)
 game=await api(path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(c=>c.id===mage.id?{...c.sheet,playerDetails:{...c.sheet.playerDetails,'rules2014.concentration':hold.ruleId}}:c.sheet),state:{...game.state,combat:{activeId:1,round:3},abilities:[...game.state.abilities.filter(a=>a.id!==parent.id&&a.id!==child.id),...[parent,child].map(a=>({...a,active:true,remainingTurns:8,expiryRound:11,...(a.id===child.id?{repeatSaveRoll:undefined}:{})}))]}})
 await page.reload();await guardRow.getByText(/TS Saggezza.*fine turno/).waitFor()
 await next.click();await dialog.waitFor()
 assert.equal(await dialog.getByLabel('CD del tiro salvezza ripetuto',{exact:true}).inputValue(),'','A legacy effect asks for its original DC')
 await dialog.getByRole('button',{name:'Non ripetere il TS: mantieni l’effetto',exact:true}).click()
 await dialog.waitFor({state:'hidden'});await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(path);assert.equal(game.state.combat.activeId,2)
 assert.equal(game.state.abilities.find(a=>a.id===child.id).repeatSaveRoll.dc,undefined,'Declining a legacy save never fabricates a DC')
 assert.equal(game.state.abilities.find(a=>a.id===child.id).active,true,'The target may decline the optional repeat and remain paralyzed')
 await page.setViewportSize({width:1600,height:1050})
 await page.getByRole('button',{name:'Dettagli di Creatura sconosciuta',exact:true}).click()
 assert(await page.getByText('Dettagli creatura',{exact:true}).evaluate(summary=>summary.parentElement.open),'Unknown creature details start expanded')
 await page.getByRole('combobox',{name:'Tipo di creatura di Creatura sconosciuta',exact:true}).selectOption('humanoid')
 await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 assert.equal((await api(path)).characters.find(c=>c.id===unknown.id).sheet.playerDetails['creature.type'],'humanoid')
 await page.reload();await page.getByRole('button',{name:'Dettagli di Creatura sconosciuta',exact:true}).click()
 assert.equal(await page.getByRole('combobox',{name:'Tipo di creatura di Creatura sconosciuta',exact:true}).count(),0,'The field stays hidden when the type is known after reload')
 assert.equal(await page.getByText('Dettagli creatura',{exact:true}).count(),0)
 assert.equal((await api(path)).characters.find(c=>c.id===unknown.id).sheet.playerDetails['creature.type'],'humanoid','The explicit type remains saved')
 assert.deepEqual(errors,[])
 console.log('PASS Hold Person: creature types, immunity, concentration loss, status pills, end-turn save timing, cancel, failure/success, single advancement, persistence, mobile and reduced motion')
}catch(error){await page.screenshot({path:join(root,'hold-person-failure.png'),fullPage:true});console.error('UI errors',errors,'alerts',await page.getByRole('alert').allTextContents());throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
