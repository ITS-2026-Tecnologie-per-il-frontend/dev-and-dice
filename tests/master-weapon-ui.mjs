import {resetTurnEconomy} from '../src/domain/dnd/TurnEconomy.ts'
// Run: node tests/master-weapon-ui.mjs — isolated accounts and game, never live data.
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
import {addInventoryItem,setInventoryReference,ownedInventoryItems} from '../src/utils/Inventory.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'master-weapon-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'master-weapon-test-isolated-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true})
const master=await browser.newContext({viewport:{width:1600,height:1050}}),player=await browser.newContext({viewport:{width:390,height:950}}),dm=await master.newPage(),page=await player.newPage(),errors=[]
for(const p of [dm,page]){p.setDefaultTimeout(20000);p.on('pageerror',error=>errors.push(error.message))}
async function api(user,path,method='GET',data){const r=await user.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function renewed(p){await p.getByRole('button',{name:'Impostazioni',exact:true}).click();await p.getByRole('radio',{name:/^Rinnovata/}).check();await p.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
try {
 await api(master,'/register','POST',{username:'MasterWeaponQA',password:'test-password-123'})
 await api(player,'/register','POST',{username:'CasterWeaponQA',password:'test-password-123'})
 const {data,catalog}=await combatRules(),spell=templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:magic-weapon'))
 let caster={...newCharacterSheet(),name:'Aster',characterClass:'Mago',level:'5',abilities:[{...spell,instantaneous:true,damageEnabled:true},templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:shield')),templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:fire-bolt'))],playerDetails:{'slots.2.total':'3','slots.2.used':'0'}}
 caster=addInventoryItem(caster,data,'Pugnale di Aster','dagger','1')
 const ownDagger=ownedInventoryItems(caster)[0].id
 let target={...newCharacterSheet(),name:'Baldur',dexterity:'14',strength:'10',hitPoints:'20',armorClass:'13',playerDetails:{'attacks.0.1':'4','attacks.0.2':'1d4+2','attacks.0.3':'Perforante'}}
 target=addInventoryItem(target,data,'Pugnale','dagger','2')
 const dagger=ownedInventoryItems(target)[0].id
 target=setInventoryReference(target,'attacks.0.0',dagger)
 target=addInventoryItem(target,data,'Spada già magica','longsword','1')
 const magical=ownedInventoryItems(target).find(item=>item.id!==dagger)
 target={...target,playerDetails:{...target.playerDetails,[`inventory.${magical.row}.magical`]:'true'}}
 let game=await api(master,'/play/games','POST',{name:'Potenziamenti QA'}),path='/play/games/'+game.id
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:caster})
 await api(master,'/play/characters','POST',{sheet:target});game=await api(master,path)
 game=await api(master,path+'/characters','POST',{revision:game.revision,characterId:target.id})
 const turn=(sheet,i)=>({id:i+1,sheet,description:sheet.name,initiative:String(20-i),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[caster,target],state:{turns:[caster,target].map(turn),abilities:[],combat:{activeId:1,round:1}}})
 const available=await api(player,path+'/actions'),action=available.actions.find(action=>action.name===spell.name)
 assert.equal(action.unit,'bonus-action');assert.equal(action.concentration,true)
 assert.equal(available.actions.find(a=>a.entry?.data.referenceId==='phb2014:spell:shield').unit,'reaction')
 assert.equal(available.actions.find(a=>a.entry?.data.referenceId==='phb2014:spell:fire-bolt').unit,'action')
 assert.equal(available.actions.find(a=>a.entry?.data.referenceId==='phb2014:spell:fire-bolt').concentration,false)
 assert.equal(action.damageEnabled,false,'Casting a known weapon enchantment deals no damage despite stale sheet flags')
 game=await api(player,path+'/requests','POST',{id:crypto.randomUUID(),revision:available.revision,key:action.key,option:'slot:2',cost:1,mode:'none',damageEnabled:false,packets:[{targetId:2,damage:[]}]})
 const request=game.combatRequests.find(request=>request.status==='pending')
 game=await api(master,path+'/requests/'+request.id+'/approve','POST',{revision:game.revision,confirmed:true,targets:[{id:2,damage:'0'}],weapons:[{targetId:2,itemId:dagger}]})
 assert.equal(game.state.abilities[0].sheetAbilityIndex,undefined,'Fixture reproduces player-approved casts without a sheet index')
 for(const p of [dm,page]){await p.goto(base+'/games/'+game.id);await renewed(p)}
 await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 const availableMaster=dm.locator('.master-available-abilities')
 assert.equal(await availableMaster.getByRole('button',{name:spell.name+' · In esecuzione',exact:true}).count(),1)
 assert.equal(await availableMaster.getByRole('link',{name:new RegExp('^'+spell.name+' ·')}).count(),0,'The separate unindexed badge is removed')
 await availableMaster.getByRole('button',{name:spell.name+' · In esecuzione',exact:true}).click()
 const card=dm.locator('.ability-row').filter({has:dm.getByRole('button',{name:'Termina effetto',exact:true})})
 assert.equal(await card.count(),1,'Opening the matched source does not import a duplicate combat card')
 await page.getByRole('button',{name:spell.name+' · In esecuzione',exact:true}).click()
 const summary=page.getByLabel('Riepilogo: '+spell.name,{exact:true})
 await summary.getByText('Approvata',{exact:true}).waitFor()
 for(const container of [card,page.locator('.ability-row').filter({has:summary})]){
  const usage=container.getByLabel('Utilizzo dell’abilità',{exact:true})
  assert.deepEqual(await usage.locator('span').allTextContents(),['Azione bonus','Concentrazione'])
  const trigger=usage.getByRole('button',{name:'Requisiti: Azione bonus',exact:true})
  await trigger.hover()
  const tooltip=container.page().getByRole('tooltip')
  await tooltip.getByText(/Vale in entrambi gli ordini/).waitFor()
  await tooltip.getByText(/Richiede concentrazione/).waitFor()
  await container.page().keyboard.press('Escape');await tooltip.waitFor({state:'detached'})
 }
 for(const view of [card,summary]){
  const effect=view.getByLabel('Potenziamento applicato',{exact:true})
  for(const text of ['Baldur','Pugnale','L’arma è magica.','+1 ai tiri per colpire.','+1 ai danni dell’arma.'])await effect.getByText(text,{exact:true}).waitFor()
  assert.equal(await effect.locator('details').count(),0,'Applied target, item and benefits are immediately visible')
 }
 for(const width of [1600,390,320]){
  await dm.setViewportSize({width,height:1050})
  assert(await card.getByLabel('Potenziamento applicato',{exact:true}).evaluate(element=>element.scrollWidth<=element.clientWidth+1),'Effect details fit at '+width)
 }
 await card.screenshot({path:join(root,'master-weapon-active-320.png')})
 await summary.screenshot({path:join(root,'player-weapon-active-390.png')})
 await card.getByRole('button',{name:'Termina effetto',exact:true}).click()
 await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await summary.waitFor({state:'detached'})
 assert.equal(await page.getByLabel('Nome abilità '+spell.name,{exact:true}).count(),0,'An ended spell is removed from the player in-use cards')
 assert(await page.getByRole('button',{name:spell.name+' · Non disponibile',exact:true}).isDisabled(),'Unavailable player cards cannot open another cast')
 game=await api(master,path);game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(r=>({...r.sheet,playerDetails:{...r.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]',...resetTurnEconomy}})),state:{...game.state,combat:{activeId:1,round:2}}});await page.reload()
 await page.getByRole('button',{name:spell.name+' · Usa',exact:true}).click()
 const playerForm=page.getByRole('form',{name:'Proposta: '+spell.name,exact:true})
 await playerForm.getByRole('checkbox',{name:'Tu (Aster)',exact:true}).check()
 assert(await playerForm.getByRole('checkbox',{name:'Baldur',exact:true}).isDisabled(),'Self uses the same target limit for the player')
 await playerForm.getByRole('checkbox',{name:'Tu (Aster)',exact:true}).uncheck()
 game=await api(master,path)
 assert.equal(game.state.abilities.length,1,'Consulting a cast never creates a second copy')
 const sheets=game.characters.map(record=>({...record.sheet,playerDetails:{...record.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]',...resetTurnEconomy}}))
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets,state:{...game.state,combat:{activeId:1,round:2},abilities:game.state.abilities.map(ability=>({...ability,instantaneous:true,damageEnabled:true}))}})
 await dm.reload();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 assert.equal(await availableMaster.getByRole('button',{name:spell.name+' · Usa',exact:true}).count(),1)
 await availableMaster.getByRole('button',{name:spell.name+' · Usa',exact:true}).click()
 const form=dm.getByRole('form',{name:'Lancio: '+spell.name,exact:true})
 await form.waitFor()
 const usage=form.locator('..').locator('..').getByLabel('Utilizzo dell’abilità',{exact:true})
 await usage.getByText('Azione bonus',{exact:true}).waitFor()
 assert(await usage.evaluate(element=>element.getBoundingClientRect().bottom<=element.closest('.ability-row').querySelector('.player-action-description').getBoundingClientRect().top),'Usage information precedes the action description')
 // A previous leveled action spell blocks casting, but must not freeze configuration.
 await dm.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('dev-and-dice.game-draft.')&&!k.endsWith('.library')))
 game=await api(master,path)
 const usedSpellSheets=game.characters.map(r=>r.id===caster.id?{...r.sheet,playerDetails:{...r.sheet.playerDetails,'combat.actionUsed':'true','combat.actionUses':'1','combat.spellsThisTurn':'[{"level":1,"unit":"action","slot":true}]','rules2014.spellsThisTurn':'[{"level":1,"unit":"action","slot":true}]'}}:r.sheet)
 await api(master,path+'/state','PUT',{revision:game.revision,state:game.state,sheets:usedSpellSheets});await dm.reload();await availableMaster.getByRole('button',{name:spell.name+' · Non disponibile',exact:true}).click()
 await form.getByRole('alert').filter({hasText:/trucchetto/}).waitFor()
 await form.getByRole('checkbox',{name:'Baldur',exact:true}).check();await form.getByRole('combobox',{name:'Arma di Baldur',exact:true}).selectOption(dagger)
 assert(await form.getByRole('button',{name:'Applica potenziamento',exact:true}).isDisabled(),'A leveled action spell must block the bonus cast, with a visible reason')
 await dm.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('dev-and-dice.game-draft.')&&!k.endsWith('.library')))
 game=await api(master,path)
 const attackSheets=game.characters.map(r=>r.id===caster.id?{...r.sheet,playerDetails:{...r.sheet.playerDetails,'combat.spellsThisTurn':'[]','rules2014.spellsThisTurn':'[]'}}:r.sheet)
 await api(master,path+'/state','PUT',{revision:game.revision,state:game.state,sheets:attackSheets});await dm.reload();await availableMaster.getByRole('button',{name:spell.name+' · Usa',exact:true}).click();await form.waitFor()
 assert.equal(await form.getByRole('alert').count(),0,'An action spent on a weapon attack permits the bonus spell')
 for(const label of ['Effetto istantaneo','Prevede danni','Confermo requisiti e bersagli'])assert.equal(await form.getByRole('checkbox',{name:label,exact:true}).count(),0)
 assert.equal(await form.getByLabel('Danni tirati',{exact:true}).count(),0)
 assert.equal(await form.getByRole('combobox',{name:'Origine del lancio di '+spell.name,exact:true}).count(),1)
 await form.getByRole('combobox',{name:'Risorsa',exact:true}).selectOption('slot:2')
 await form.getByRole('checkbox',{name:'Tu (Aster)',exact:true}).check()
 await form.getByRole('combobox',{name:'Arma di Aster',exact:true}).selectOption(ownDagger)
 assert(await form.getByRole('checkbox',{name:'Baldur',exact:true}).isDisabled())
 await form.getByRole('checkbox',{name:'Tu (Aster)',exact:true}).uncheck()
 await form.getByRole('checkbox',{name:'Baldur',exact:true}).check()
 assert.equal(await form.getByRole('combobox',{name:'Arma di Aster',exact:true}).count(),0,'Only the selected target has weapon controls')
 const review=form,apply=form.getByRole('button',{name:'Applica potenziamento',exact:true})
 assert(await apply.isDisabled(),'Choose a compatible physical weapon before applying')
 const weapons=review.getByRole('combobox',{name:'Arma di Baldur',exact:true})
 assert.equal(await weapons.getByRole('option',{name:/Spada già magica/}).count(),0,'An already magical weapon is excluded')
 await weapons.selectOption(dagger)
 assert.equal(await dm.getByRole('region',{name:'Esiti: '+spell.name,exact:true}).count(),0,'Weapon selection has no second confirmation form')
 for(const width of [1600,390,320]){await dm.setViewportSize({width,height:1050});assert(await review.evaluate(element=>element.scrollWidth<=element.clientWidth+1),'The weapon configuration fits at '+width)}
 await review.screenshot({path:join(root,'master-weapon-selection-320.png')})
 assert.equal((await api(master,path)).characters.find(record=>record.id===caster.id).sheet.playerDetails['slots.2.used'],'1','Preview does not spend a slot')
 await apply.evaluate(button=>{button.click();button.click()})
 await review.waitFor({state:'detached'});await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(master,path)
 const enchantment=game.state.abilities.find(ability=>ability.ruleId===spell.ruleId&&ability.active)
 assert(enchantment.active);assert(enchantment.concentration);assert.equal(enchantment.remainingTurns,600)
 assert.equal(enchantment.weaponEffects[0].itemId,dagger)
 assert.equal(enchantment.instantaneous,false);assert.equal(enchantment.damageEnabled,false)
 assert.equal(game.characters.find(record=>record.id===caster.id).sheet.playerDetails['slots.2.used'],'2','The Master spends exactly one slot')
 assert.equal(game.characters.find(record=>record.id===caster.id).sheet.playerDetails['rules2014.concentration'],spell.ruleId)
 assert.equal(game.state.turns[1].hitPoints,'20','Enchanting does not apply damage')
 assert.equal(ownedInventoryItems(game.characters.find(record=>record.id===target.id).sheet).length,3,'Existing separated inventory is preserved')
 await dm.reload();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 assert.equal(await availableMaster.getByRole('button',{name:spell.name+' · In esecuzione',exact:true}).count(),1,'Reload preserves one coherent badge')
 await availableMaster.getByRole('button',{name:spell.name+' · In esecuzione',exact:true}).click()
 await dm.getByRole('button',{name:'Termina effetto',exact:true}).click()
 await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(master,path)
 const reset=game.characters.map(record=>({...record.sheet,playerDetails:{...record.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]',...resetTurnEconomy}}))
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:reset,state:{...game.state,combat:{activeId:1,round:3}}})
 await dm.reload();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await availableMaster.getByRole('button',{name:spell.name+' · Usa',exact:true}).click()
 await form.getByRole('checkbox',{name:'Tu (Aster)',exact:true}).check()
 await form.getByRole('combobox',{name:'Arma di Aster',exact:true}).selectOption(ownDagger)
 await form.getByRole('button',{name:'Applica potenziamento',exact:true}).click()
 await form.waitFor({state:'detached'});await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(master,path)
 assert.equal(game.state.abilities.find(ability=>ability.active).weaponEffects[0].itemId,ownDagger,'The Master enchants the caster’s own weapon in one form')
 assert.equal(game.characters.find(record=>record.id===caster.id).sheet.playerDetails['slots.2.used'],'3','Self-targeting spends exactly one slot')
 await dm.getByLabel('Potenziamento applicato',{exact:true}).getByText('Pugnale di Aster',{exact:true}).waitFor()
 assert.deepEqual(errors,[])
 console.log('PASS Master weapon spells: canonical no-damage duration, no redundant flags/confirmation, indexed/unindexed badge matching, player cleanup, eligible weapon selection, persistent enchantment, concentration and once-only slot spend')
}catch(error){await dm.screenshot({path:join(root,'master-weapon-failure.png'),fullPage:true});await page.screenshot({path:join(root,'player-weapon-failure.png'),fullPage:true});console.error(errors);throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
