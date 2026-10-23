// Run: node tests/manual-attack-reaction-ui.mjs — monster attacks using manual resolution still allow Shield.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {sheetFromCatalog,templateFromCatalog} from '../src/utils/Catalog.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'manual-reactions-')),server=(await createApp({dataDir:dir,production:false,sessionSecret:'reaction-ui-isolated-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),master=await browser.newContext({viewport:{width:1600,height:1050}}),player=await browser.newContext({viewport:{width:1600,height:1050}})
const page=await master.newPage(),pp=await player.newPage(),errors=[];for(const p of [page,pp]){p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message))}
async function api(c,path,method='GET',data){const r=await c.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function view(p){await p.getByRole('button',{name:'Impostazioni',exact:true}).click();await p.getByRole('radio',{name:/^Rinnovata/}).check();await p.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
try{
 await api(master,'/register','POST',{username:'ManualAttackMaster',password:'test-password-123'});await api(player,'/register','POST',{username:'ManualAttackPlayer',password:'test-password-123'})
 const {catalog}=await combatRules(),shield=templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:shield'))
 const spider=sheetFromCatalog(catalog.creatures.find(e=>/ragno gigante/i.test(e.name)),catalog)
 const mage={...newCharacterSheet(),name:'Aster',characterClass:'Mago',level:'5',hitPoints:'22',armorClass:'12',abilities:[shield],playerDetails:{'slots.1.total':'4'}}
 let game=await api(master,'/play/games','POST',{name:'Reazioni attacchi manuali QA'}),path='/play/games/'+game.id
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:mage});game=await api(master,path)
 const turn=(sheet,id)=>({id,sheet,description:sheet.name,initiative:String(20-id),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[spider,mage],state:{turns:[turn(spider,0),turn(mage,1)],abilities:[],combat:{activeId:0,round:1}}})
 await page.goto(base+'/games/'+game.id);await view(page);await pp.goto(base+'/games/'+game.id);await view(pp)
 const card=page.locator('.ability-row').filter({has:page.locator('input[value="Morso"]')})
 async function saved(){await page.waitForFunction(id=>!Object.keys(localStorage).some(key=>key.startsWith('dev-and-dice.game-draft.')&&key.endsWith('.'+id)),game.id);await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()}
 async function bite(){
  await page.getByRole('button',{name:'Morso · Usa',exact:true}).click()
  await card.getByRole('checkbox',{name:'Bersaglio Aster di Morso',exact:true}).check()
  await card.getByRole('checkbox',{name:'Confermo requisiti e bersagli',exact:true}).check()
  await card.getByRole('button',{name:'Usa',exact:true}).click()
 }
 await bite()
 const finish=card.getByRole('button',{name:'Concludi uso e applica danni',exact:true})
 assert(await finish.isDisabled(),'An unresolved attack cannot skip its hit/miss decision')
 await card.getByRole('combobox',{name:'Esito di Morso su Aster',exact:true}).selectOption('miss');await saved()
 const missedSave=page.waitForResponse(r=>r.url().endsWith('/state')&&r.request().method()==='PUT')
 await finish.click();assert((await missedSave).ok());await saved()
 game=await api(master,path);assert.equal(game.reactionWindows.length,0,'A missed attack offers no Shield reaction');assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'22')
 await bite();await card.getByLabel('Danno finale a Aster da Morso',{exact:true}).fill('9');await card.getByRole('combobox',{name:'Esito di Morso su Aster',exact:true}).selectOption('hit');await saved()
 await finish.click()
 const popup=pp.getByRole('dialog',{name:'Puoi usare una reazione',exact:true});await popup.waitFor()
 await popup.getByRole('button',{name:'Usa la reazione · invia al Master',exact:true}).click();await popup.waitFor({state:'detached'})
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'22','The monster attack waits before applying damage')
 const request=game.combatRequests.find(r=>r.actionName==='Scudo'&&r.status==='pending')
 game=await api(master,path+'/requests/'+request.id+'/approve','POST',{revision:game.revision,confirmed:true,targets:[{id:1,damage:'0'}]})
 await card.getByText(/La reazione ha modificato la CA: Aster: 12 → 17/).waitFor();await saved()
 assert.equal(await card.getByLabel('Danno finale a Aster da Morso',{exact:true}).inputValue(),'','A previous damage decision is cleared after the AC changes')
 assert(await finish.isDisabled(),'The Master must recheck whether the attack still hits')
 await card.screenshot({path:join(root,'manual-attack-shield-recheck.png')})
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'22');assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.1.used'],'1')
 await card.getByRole('combobox',{name:'Esito di Morso su Aster',exact:true}).selectOption('miss');await saved()
 const finalSave=page.waitForResponse(r=>r.url().endsWith('/state')&&r.request().method()==='PUT');await finish.click();assert((await finalSave).ok());await saved()
 game=await api(master,path);assert.equal(game.characters.find(c=>c.id===mage.id).sheet.hitPoints,'22');assert.equal(game.characters.find(c=>c.id===mage.id).sheet.playerDetails['slots.1.used'],'1','Rechecking does not spend another reaction or spell slot')
 assert.equal(game.reactionWindows.filter(w=>w.status==='used').length,1)
 assert.deepEqual(errors,[])
 console.log('PASS manual monster attacks: hit/miss decision, reaction before damage, Shield AC update, mandatory outcome recheck, no damage on miss and single slot use')
}catch(e){await page.screenshot({path:join(root,'manual-reaction-failure.png'),fullPage:true});throw e}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
