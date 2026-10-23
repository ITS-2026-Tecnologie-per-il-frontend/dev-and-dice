// Run: node tests/master-attack-ui.mjs. Isolated Master session and data.
// QA: shared d20/damage fields, no redundant controls, Master-only automatic hit,
// normal/missed/critical hits, resistances and temporary HP, one application,
// persistence, both views, light/dark and mobile without overflow or JS errors.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {sheetWithCombatAbilities} from '../src/utils/Catalog.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'master-attack-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'master-attack-ui-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1600,height:1050}}),page=await context.newPage(),errors=[]
page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000)
async function api(path,method='GET',data){const r=await context.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function view(name){await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('radio',{name:new RegExp('^'+name)}).check();await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
try {
 await api('/register','POST',{username:'MasterAttackQA',password:'test-password-123'})
 const {catalog}=await combatRules()
 const owner=sheetWithCombatAbilities({...newCharacterSheet(),name:'Baldur',hitPoints:'30',armorClass:'13',strength:'14',dexterity:'14',playerDetails:{'attacks.0.0':'Pugnale','attacks.0.1':'5','attacks.0.2':'1d4+2','attacks.0.3':'Perforante'}},catalog)
 const foe={...newCharacterSheet(),name:'Worg',kind:'PNG',hitPoints:'30',armorClass:'15',playerDetails:{'combat.resistances':'perforante',temporaryHitPoints:'1'}}
 let game=await api('/play/games','POST',{name:'Attacchi del Master'}),path='/play/games/'+game.id
 for(const sheet of [owner,foe]){await api('/play/characters','POST',{sheet});game=await api(path+'/characters','POST',{characterId:sheet.id,revision:game.revision})}
 await api(path+'/state','PUT',{revision:game.revision,sheets:[owner,foe],state:{turns:[owner,foe].map((sheet,id)=>({id,sheet,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:sheet.playerDetails?.temporaryHitPoints??''})),abilities:[],combat:null}})
 await page.goto(base+'/games/'+game.id);await view('Rinnovata')
 const form=page.getByRole('form',{name:'Attacco: Pugnale',exact:true})
 async function open(){await page.getByRole('button',{name:'Pugnale · Usa',exact:true}).click();await form.waitFor();await form.getByRole('checkbox',{name:'Worg',exact:true}).check()}
 async function apply(){await form.getByRole('button',{name:'Applica danni',exact:true}).evaluate(button=>{button.click();button.click()});await form.waitFor({state:'detached'});await page.getByText('Sessione sincronizzata',{exact:true}).waitFor();return api(path)}
 await open()
 for(const mode of ['Originale','Rinnovata']){
  await view(mode)
  assert.equal(await form.getByRole('combobox').count(),0)
  assert.equal(await form.getByRole('checkbox',{name:/Effetto istantaneo|Prevede danni|Confermo|Esito e danno/}).count(),0)
  assert(await form.getByRole('button',{name:'Applica danni',exact:true}).isDisabled())
 }
 const d20=form.getByLabel('Tiro per colpire (inserisci solo il numero del dado)',{exact:true}),dmg=form.getByLabel('Tira danni',{exact:true})
 assert.equal(await dmg.count(),0)
 await d20.fill('27');assert.equal(await d20.inputValue(),'20');assert.equal(await d20.getAttribute('type'),'text')
 await d20.fill('16');await dmg.fill('3')
 await form.getByRole('status',{name:'Totale tiro per colpire',exact:true}).getByText('Totale: 21',{exact:true}).waitFor()
 await form.getByText('Colpito · CA 15',{exact:true}).waitFor();await form.getByText('Danni a Worg: 2',{exact:true}).waitFor()
 await form.screenshot({path:join(root,'master-attack-normal-desktop.png')})
 game=await apply();assert.equal(game.state.turns[1].hitPoints,'29');assert.equal(game.state.turns[1].temporaryHitPoints,'0','Resistance and temporary HP apply exactly once')
 await open();await d20.fill('1')
 await form.getByRole('checkbox',{name:'Colpisce automaticamente (senza d20)',exact:true}).check()
 assert.equal(await d20.count(),0,'Automatic hit needs no fabricated die')
 await dmg.fill('3');await form.getByText('Colpito per decisione del Master',{exact:true}).waitFor();await form.getByText('Danni a Worg: 2',{exact:true}).waitFor()
 assert.equal(await form.getByLabel(/Dadi aggiuntivi del critico/).count(),0,'Automatic hit is not a critical')
 for(const colorScheme of ['light','dark']){
  await page.setViewportSize({width:390,height:1000});await page.emulateMedia({colorScheme,reducedMotion:'reduce'})
  await form.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await form.screenshot({path:join(root,`master-attack-automatic-mobile-${colorScheme}.png`)})
 }
 game=await apply();assert.equal(game.state.turns[1].hitPoints,'27','Automatic hit still applies resistance')
 await page.setViewportSize({width:1600,height:1050});await page.reload();await open()
 assert.equal(await form.getByRole('checkbox',{name:'Colpisce automaticamente (senza d20)',exact:true}).isChecked(),false,'The override does not leak into the next attack')
 await d20.fill('1');await dmg.fill('3');await form.getByText('Mancato · CA 15',{exact:true}).waitFor();await form.getByText('Danni a Worg: 0',{exact:true}).waitFor()
 game=await apply();assert.equal(game.state.turns[1].hitPoints,'27')
 await open();await d20.fill('20');await dmg.fill('3')
 assert(await form.getByRole('button',{name:'Applica danni',exact:true}).isDisabled(),'Critical dice are required')
 await form.getByLabel('Dadi aggiuntivi del critico · Perforante',{exact:true}).fill('4')
 await form.getByText('Colpo critico · CA 15',{exact:true}).waitFor();await form.getByText('Danni a Worg: 4',{exact:true}).waitFor()
 await form.screenshot({path:join(root,'master-attack-critical-desktop.png')})
 game=await apply();assert.equal(game.state.turns[1].hitPoints,'23','Critical dice double; the flat modifier is added once before resistance')
 await page.reload();await page.getByRole('button',{name:'Pugnale · Usa',exact:true}).waitFor();assert.equal((await api(path)).characters.find(c=>c.id===foe.id).sheet.hitPoints,'23')
 assert.deepEqual(errors,[])
 console.log('PASS Master attacks: shared player fields, no redundant checks, optional automatic hit, natural miss/critical, modifiers/resistance/temporary HP, single application, persistence, both views and mobile themes')
} catch(error){await page.screenshot({path:join(root,'master-attack-failure.png')});console.error('UI errors',errors,'alerts',await page.getByRole('alert').allTextContents());throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
