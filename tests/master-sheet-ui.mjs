// Run: node tests/master-sheet-ui.mjs — synchronized spell deletion and nonblocking Master rule warnings.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {removeSheetAbility,sheetWithCombatAbilities,templateFromCatalog} from '../src/utils/Catalog.ts'
import {spellSelection} from '../src/utils/PlayerCreation.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'master-sheet-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'master-sheet-isolated-test-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1600,height:1050}}),page=await context.newPage(),errors=[]
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message))
async function api(path,method='GET',data){const response=await context.request.fetch(base+'/api'+path,{method,data});assert(response.ok(),await response.text());return response.json()}
try {
 const {catalog,data}=await combatRules(),spells=['cure-wounds','shield','magic-missile'].map(id=>templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id)))
 const [cure,shield,missile]=spells
 const sheet={...newCharacterSheet(),name:'Mago QA',kind:'PG',characterClass:'Mago',level:'1',intelligence:'10',strength:'10',hitPoints:'10',armorClass:'12',abilities:[...spells,{name:'Abilità personalizzata',duration:'1 minuto'}],playerDetails:{'creation.enabled':'false','creation.class':'wizard','sheet.template':'generic',maxHitPoints:'20','slots.1.total':'3','slots.1.used':'1','spell.rows.1':'4','spell.1.0.name':'Cure Wounds','spell.1.0.index':'cure-wounds','spell.1.0.prepared':'true','spell.1.0.source':'class','spell.1.0.learned':'copied','spell.1.0.note':'Nota della magia eliminata','wizard.mastery.1':'spell.1.0','favoriteSpell.0.name':'Preferito manuale','favoriteSpell.0.effect':'Conserva questa nota','spell.1.1.name':shield.name,'spell.1.1.index':'shield','spell.1.1.prepared':'true','spell.1.1.source':'class','spell.1.1.learned':'copied','spell.1.2.name':missile.name,'spell.1.2.index':'magic-missile','spell.1.2.prepared':'true','spell.1.2.source':'class','spell.1.2.learned':'copied','spell.1.3.name':'','spell.1.3.note':'Appunto in una riga vuota'}}
 const original=JSON.stringify(sheet),cleaned=removeSheetAbility(sheet,0,catalog)
 assert.equal(JSON.stringify(sheet),original,'Deleting never mutates the original')
 assert(!cleaned.abilities.some(a=>a.catalogId===cure.catalogId))
 assert(!Object.keys(cleaned.playerDetails).some(k=>k.startsWith('spell.1.0.')))
 assert.equal(cleaned.playerDetails['wizard.mastery.1'],undefined)
 assert.equal(cleaned.playerDetails['favoriteSpell.0.effect'],'Conserva questa nota')
 assert.equal(cleaned.playerDetails['spell.1.3.note'],'Appunto in una riga vuota')
 assert.equal(cleaned.playerDetails['slots.1.used'],'1','Deleting never refunds slots')
 assert(!sheetWithCombatAbilities(cleaned,catalog).abilities.some(a=>a.catalogId===cure.catalogId),'The deleted spell never reappears from its sheet row')
 const selected=spellSelection(cleaned,data)
 assert(selected.issues.some(issue=>issue.includes('2/1')),'Other preparation issues remain visible')
 assert(!selected.issues.some(issue=>issue.includes('non appartengono')||issue.includes('non riconosciute')),'The removed off-list spell stops producing warnings')
 const removedCustom=removeSheetAbility(sheet,3,catalog)
 assert.deepEqual(removedCustom.playerDetails,sheet.playerDetails,'Deleting a nonspell preserves spell rows')
 await api('/register','POST',{username:'MasterSheetQA',password:'test-password-123'})
 let game=await api('/play/games','POST',{name:'Scheda del Master QA'}),path='/play/games/'+game.id
 await api('/play/characters','POST',{sheet});game=await api(path+'/characters','POST',{characterId:sheet.id,revision:game.revision})
 game=await api(path+'/state','PUT',{revision:game.revision,sheets:[sheet],state:{turns:[{id:0,sheet,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,temporaryHitPoints:'',armorClass:sheet.armorClass}],abilities:[{...cure,id:20,ownerId:0,sheetAbilityIndex:0,active:false,remainingTurns:0},{...shield,id:21,ownerId:0,sheetAbilityIndex:1,active:true,timed:true,remainingTurns:3}],combat:null}})
 await page.goto(base+'/games/'+game.id)
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('radio',{name:/^Rinnovata/}).check();await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()
 await page.locator('.combat-tracker').getByText('Caricamento del catalogo…',{exact:true}).waitFor({state:'hidden'})
 await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 const available=page.locator('.master-available-abilities')
 const row=page.locator('.turn-row').first(),dialog=page.getByRole('dialog',{name:sheet.name,exact:true})
 await row.getByRole('button',{name:'Dettagli di '+sheet.name,exact:true}).dblclick()
 const warnings=dialog.getByRole('status',{name:'Avvisi sulle regole',exact:true})
 await warnings.getByText(/Come Master puoi comunque salvare/).waitFor()
 await dialog.getByRole('button',{name:'Elimina '+cure.name+' dalla scheda',exact:true}).click()
 await warnings.getByText(/2\/1/).waitFor()
 assert.equal(await dialog.locator('.sheet-spells').getByText(cure.name,{exact:true}).count(),0,'The removed spell disappears from both lists immediately')
 const savedResponse=page.waitForResponse(r=>r.url().endsWith('/state')&&r.request().method()==='PUT')
 await dialog.getByRole('button',{name:'Salva scheda',exact:true}).click();await dialog.waitFor({state:'hidden'})
 const response=await savedResponse;assert(response.ok(),await response.text())
 await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(path)
 let saved=game.characters.find(c=>c.id===sheet.id).sheet
 assert(!saved.abilities.some(a=>a.catalogId===cure.catalogId))
 assert(!Object.keys(saved.playerDetails).some(k=>k.startsWith('spell.1.0.')))
 assert.equal(saved.playerDetails['slots.1.used'],'1')
 assert.equal(await available.getByRole('button',{name:new RegExp('^'+cure.name+' ·')}).count(),0,'Removed spells disappear from the Master launcher immediately')
 assert.equal(await page.locator('#ability-20').count(),0,'An inactive imported card cannot keep a removed spell launchable')
 assert.equal(game.state.abilities.find(a=>a.id===21).sheetAbilityIndex,1,'Ongoing effects retain stable sheet indices')
 await row.getByRole('button',{name:'Dettagli di '+sheet.name,exact:true}).dblclick()
 await warnings.getByText(/2\/1/).waitFor()
 assert.equal(await dialog.getByRole('button',{name:'Elimina '+cure.name+' dalla scheda',exact:true}).count(),0)
 // Rule warnings never waive invalid numeric data.
 const strength=dialog.getByRole('spinbutton',{name:'Valore Forza',exact:true})
 await strength.fill('31')
 await dialog.getByRole('button',{name:'Salva scheda',exact:true}).click()
 await dialog.getByRole('alert').getByText(/Forza deve essere un intero tra 1 e 30/).waitFor()
 assert(await dialog.isVisible())
 assert.equal((await api(path)).characters.find(c=>c.id===sheet.id).sheet.strength,'10')
 await strength.fill('10')
 await dialog.getByRole('button',{name:'Salva scheda',exact:true}).click();await dialog.waitFor({state:'hidden'})
 await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await page.reload();await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 assert.equal(await available.getByRole('button',{name:new RegExp('^'+cure.name+' ·')}).count(),0,'Retired turn templates do not return after reload')
 assert.equal(await page.locator('#ability-20').count(),0)
 await row.getByRole('button',{name:'Dettagli di '+sheet.name,exact:true}).dblclick();await warnings.waitFor()
 assert.equal(await dialog.getByRole('button',{name:'Elimina '+cure.name+' dalla scheda',exact:true}).count(),0)
 await dialog.getByRole('button',{name:'Chiudi scheda',exact:true}).click()
 // Updates arriving from another tab/player must also ignore the archived combat copy.
 game=await api(path)
 const record=game.characters.find(c=>c.id===sheet.id),withoutShield=removeSheetAbility(record.sheet,record.sheet.abilities.findIndex(a=>a.catalogId===shield.catalogId),catalog)
 await api('/play/characters/'+sheet.id,'PUT',{revision:record.revision,sheet:withoutShield})
 await available.getByRole('button',{name:new RegExp('^'+shield.name+' ·')}).waitFor({state:'hidden'})
 assert(await page.locator('#ability-21').isVisible(),'A removed spell can still manage its already active effect')
 assert.equal((await api(path)).state.abilities.find(a=>a.id===21).active,true)
 assert.deepEqual(errors,[])
 console.log('PASS Master sheet: synchronized spell/ability removal, aliases and references, preserved notes/resources, nonblocking rule warnings, numeric validation, launcher synchronization, active effect preservation and persistence')
}catch(error){await page.screenshot({path:join(root,'master-sheet-failure.png'),fullPage:true});console.error('Browser errors',errors);throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
