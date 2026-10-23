// Run: node tests/bless-attack-ui.mjs — isolated Master weapon attack with Bless.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {resolutionPlan} from '../src/domain/dnd/CombatResolution.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
import {addInventoryItem,ownedInventoryItems,setInventoryReference} from '../src/utils/Inventory.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'bless-attack-')),server=(await createApp({dataDir:dir,production:false,sessionSecret:'bless-attack-isolated-test-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1600,height:1050}}),page=await context.newPage(),errors=[]
page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message))
async function api(path,method='GET',data){const response=await context.request.fetch(base+'/api'+path,{method,data});assert(response.ok(),await response.text());return response.json()}
try{
 await api('/register','POST',{username:'BlessAttackMaster',password:'test-password-123'})
 const {data,catalog}=await combatRules(),bless=templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:bless'))
 let actor={...newCharacterSheet(),name:'Baldur',dexterity:'14',strength:'10',hitPoints:'22',armorClass:'12',playerDetails:{proficiencyBonus:'3','proficiency.Armi semplici':'true','attacks.0.1':'5','attacks.0.2':'1d4+2','attacks.0.3':'Perforante'}}
 actor=addInventoryItem(actor,data,'Pugnale','dagger','1');actor=setInventoryReference(actor,'attacks.0.0',ownedInventoryItems(actor)[0].id)
 const target={...newCharacterSheet(),name:'Ragno Gigante',kind:'Mostro',hitPoints:'20',armorClass:'14'}
 let game=await api('/play/games','POST',{name:'Benedizione attacco QA'}),path='/play/games/'+game.id
 const turn=(sheet,i)=>({id:i+1,sheet,description:sheet.name,initiative:String(20-i),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})
 const source={...bless,id:0,ownerId:1,active:true,remainingTurns:10,targets:[{id:1,damage:'0',resolved:true}],resolutionEffects:resolutionPlan(actor,bless,catalog,'slot:1').effects}
 game=await api(path+'/state','PUT',{revision:game.revision,sheets:[actor,target],state:{turns:[actor,target].map(turn),abilities:[source],combat:{activeId:1,round:1}}})
 await page.goto(base+'/games/'+game.id)
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('radio',{name:/^Rinnovata/}).check();await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()
 const blessed=page.getByLabel('Stati di Baldur',{exact:true}).getByText('Benedetto',{exact:true}),blessedTarget=page.getByLabel('Stati di Ragno Gigante',{exact:true}).getByText('Benedetto',{exact:true})
 await blessed.waitFor();assert.equal(await blessedTarget.count(),0,'Only an actual recipient gets the Bless pill')
 assert.deepEqual(await blessed.evaluate(element=>{const style=getComputedStyle(element);return [style.borderTopWidth,style.borderRadius,style.fontSize]}),['1px','999px','12px'],'Interactive status retains the compact pill appearance')
 await blessed.hover()
 const statusHelp=page.getByRole('tooltip')
 await statusHelp.getByText(/Aggiungi 1d4 ai tiri per colpire e ai tiri salvezza/).waitFor()
 await statusHelp.getByText(/Origine: Benedizione · Baldur/).waitFor()
 await statusHelp.screenshot({path:join(root,'blessed-status-tooltip.png')})
 await page.keyboard.press('Escape');await statusHelp.waitFor({state:'detached'})
 await blessed.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await statusHelp.waitFor()
 await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Pugnale · Usa',exact:true}).click()
 const form=page.getByRole('form',{name:'Attacco: Pugnale',exact:true}),die=form.getByLabel('Tiro per colpire (inserisci solo il numero del dado)',{exact:true}),bonus=form.getByLabel('Benedizione · d4 (bonus, 0 per non usarlo)',{exact:true}),total=form.getByRole('status',{name:'Totale tiro per colpire',exact:true}),outcome=form.getByRole('status',{name:'Esito tiro per colpire',exact:true}),damage=form.getByLabel('Tira danni',{exact:true})
 await form.getByRole('checkbox',{name:'Ragno Gigante',exact:true}).check()
 const modifier=form.getByRole('button',{name:'Modificatore al tiro per colpire dalla scheda',exact:true})
 await modifier.hover()
 const tooltip=page.getByRole('tooltip')
 await tooltip.getByText('Destrezza (14)',{exact:true}).waitFor();await tooltip.getByText('Competenza con Pugnale',{exact:true}).waitFor()
 assert.deepEqual(await tooltip.locator('dd').allTextContents(),['+2','+3'],'The tooltip identifies the actual ability and proficiency contributions')
 await tooltip.getByText('+5',{exact:true}).waitFor()
 await tooltip.screenshot({path:join(root,'attack-modifier-tooltip.png')})
 await page.keyboard.press('Escape');await tooltip.waitFor({state:'detached'})
 await modifier.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await tooltip.waitFor()
 await page.keyboard.press('Escape');await die.fill('10')
 assert.equal(await total.innerText(),'Totale: —','Missing bonus dice do not produce a misleading subtotal')
 await bonus.fill('2');assert.equal(await total.innerText(),'Totale: 17','The displayed total includes the Bless d4')
 assert.equal(await outcome.innerText(),'Colpito · CA 14','The outcome is available before entering damage')
 await damage.fill('3');await form.getByText('Danni a Ragno Gigante: 5',{exact:true}).waitFor()
 for(const width of [1600,390,320]){
  await page.setViewportSize({width,height:1050})
  await blessed.scrollIntoViewIfNeeded();await blessed.dispatchEvent('click');await statusHelp.waitFor()
  const statusPopup=await statusHelp.boundingBox();assert(statusPopup.x>=0&&statusPopup.x+statusPopup.width<=width,'Status details fit at '+width)
  await page.keyboard.press('Escape');await bonus.scrollIntoViewIfNeeded()
  const b=await bonus.boundingBox(),t=await total.boundingBox(),o=await outcome.boundingBox(),d=await form.locator('.player-damage-caption').boundingBox()
  assert(t.y>=b.y+b.height,'Total follows all bonus dice at '+width)
  assert(o.y>=t.y+t.height&&d.y>=o.y+o.height+12,'Outcome follows total; damage is visually separated at '+width)
  assert(await form.evaluate(element=>element.scrollWidth<=element.clientWidth+1),'Attack fields fit at '+width)
  await page.keyboard.press('Escape')
  await modifier.scrollIntoViewIfNeeded();await modifier.dispatchEvent('click');await tooltip.waitFor()
  const popup=await tooltip.boundingBox();assert(popup.x>=0&&popup.x+popup.width<=width,'Modifier details fit at '+width)
  await page.keyboard.press('Escape')
 }
 await form.screenshot({path:join(root,'bless-attack-total-320.png')})
 await bonus.fill('0');assert.equal(await total.innerText(),'Totale: 15','An unused optional die contributes zero')
 await bonus.fill('5');assert.equal(await bonus.inputValue(),'0','Values above d4 are rejected')
 await die.fill('1');await bonus.fill('4');assert.equal(await total.innerText(),'Totale: 10');assert.equal(await outcome.innerText(),'Mancato · CA 14','Bless does not turn a natural one into a hit')
 await die.fill('10');await bonus.fill('2');await damage.fill('3')
 await form.getByRole('button',{name:'Applica danni',exact:true}).click();await page.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(path);assert.equal(game.state.turns[1].hitPoints,'15','The attack applies the same damage shown in the preview')
 game=await api(path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(record=>record.sheet),state:{...game.state,abilities:game.state.abilities.map(ability=>ability.id===source.id?{...ability,targets:[{id:1,damage:'0',resolved:true},{id:2,damage:'0',resolved:true}]}:ability)}})
 await blessedTarget.waitFor();assert.equal(await blessed.count(),1,'A multi-target blessing has one pill per recipient')
 game=await api(path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(record=>record.sheet),state:{...game.state,abilities:game.state.abilities.map(ability=>ability.id===source.id?{...ability,active:false,remainingTurns:0}:ability)}})
 await blessed.waitFor({state:'detached'});await blessedTarget.waitFor({state:'detached'})
 await page.reload();assert.equal(await page.getByText('Benedetto',{exact:true}).count(),0,'Ending the effect removes all pills, including after reload')
 assert.deepEqual(errors,[])
 console.log('PASS Bless attack: final d20+modifier+d4 total, missing/unused bonus, natural one, outcome before damage, clear damage section, responsive layout and applied damage')
}catch(error){await page.screenshot({path:join(root,'bless-attack-failure.png'),fullPage:true});throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
