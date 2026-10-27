// node tests/sidebar-abilities-ui.mjs — isolated Master sidebar, active effects and one uncast form.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet,currentArmorClass} from '../src/utils/CharacterSheets.ts'
import {resolutionPlan} from '../src/domain/dnd/CombatResolution.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const dir=await mkdtemp(join(tmpdir(),'sidebar-abilities-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'isolated-sidebar-abilities-secret'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000}}),pc=await browser.newContext(),page=await ctx.newPage(),errors=[]
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message))
async function api(context,path,method='GET',data){const r=await context.request.fetch(base+'/api'+path,{method,data});assert(r.ok(),await r.text());return r.json()}
async function synced(){await page.waitForFunction(()=>!Object.keys(localStorage).some(k=>k.startsWith('dev-and-dice.game-draft.')&&!k.endsWith('.library')))}
async function shots(locator,name){await mkdir('.test-runtime.local',{recursive:true});for(const width of [1440,390])for(const theme of ['light','dark']){await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme});await locator.scrollIntoViewIfNeeded();await locator.screenshot({path:'.test-runtime.local/'+name+'-'+theme+'-'+width+'.png'});assert(await locator.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Card must fit without horizontal clipping')}await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light'})}
try{
 await api(ctx,'/register','POST',{username:'SidebarMaster',password:'isolated-password'});await api(pc,'/register','POST',{username:'SidebarPlayer',password:'isolated-password'})
 const {catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(a=>a.data.referenceId==='phb2014:spell:'+id)),armor=spell('mage-armor'),sleep=spell('sleep'),life=spell('false-life')
 const caster={...newCharacterSheet(),name:'Aster',characterClass:'Mago',level:'5',hitPoints:'20',abilities:[armor,sleep,life],playerDetails:{'slots.1.total':'4'}},baldur={...newCharacterSheet(),name:'Baldur',dexterity:'14',hitPoints:'20',armorClass:'12'}
 let game=await api(ctx,'/play/games','POST',{name:'Sidebar abilities regression'});await api(pc,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:caster});const path='/play/games/'+game.id;game=await api(ctx,path)
 const state={turns:[caster,baldur].map((sheet,id)=>({id,description:sheet.name,sheet,initiative:String(20-id),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})),abilities:[{...armor,id:10,ownerId:0,active:true,remainingTurns:4800,resolutionEffects:resolutionPlan(caster,armor,catalog,'slot:1').effects,targets:[{id:1,damage:'0',resolved:true}]},{...sleep,id:11,ownerId:0,active:true,remainingTurns:10,targets:[{id:1,damage:'0',resolved:true}]},{id:13,name:'Scatto improvvisato',ownerId:1,active:true,duration:'1 minuto',remainingTurns:10},{id:15,name:'Risveglio preparato',ruleId:'phb2014:readied:wake',ownerId:1,active:false,duration:'Personalizzata',remainingTurns:0,readied:{kind:'wake',trigger:'Quando serve'}}],combat:{activeId:0,round:1}}
 game=await api(ctx,path+'/state','PUT',{revision:game.revision,state,sheets:[caster,baldur]})
 await page.goto(base+'/games/'+game.id);await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('radio',{name:/^Rinnovata/}).check();await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()
 const sidebar=page.getByRole('complementary',{name:'Dettagli e abilità del tavolo',exact:true}),armorCard=page.locator('#ability-10'),sleepCard=page.locator('#ability-11')
 await armorCard.waitFor();assert.equal(await armorCard.getAttribute('data-compact-active'),'true');assert.equal(await sidebar.locator('.master-active-effects').count(),0)
 const budget=sidebar.getByRole('list',{name:'Azioni del turno',exact:true})
 assert.equal(await budget.locator('li').count(),3);assert.equal(await budget.locator('[data-used=true]').count(),0)
 const playerPage=await pc.newPage();await playerPage.goto(base+'/games/'+game.id);await playerPage.getByRole('button',{name:'Impostazioni',exact:true}).click();await playerPage.getByRole('radio',{name:/^Rinnovata/}).check();await playerPage.getByRole('button',{name:'Torna al tavolo',exact:true}).click()
 const playerBudget=playerPage.getByRole('list',{name:'Azioni del turno',exact:true});await playerBudget.waitFor();assert.equal(await playerBudget.locator('[data-used=true]').count(),0)
 await shots(sidebar.locator('.master-participant-detail'),'sidebar-participant-details')
 await armorCard.getByText('Aster',{exact:true}).waitFor();await armorCard.getByText('Baldur',{exact:false}).first().waitFor()
 assert.equal(currentArmorClass((await api(ctx,path)).characters.find(c=>c.sheet.name==='Baldur').sheet),'15')
 await armorCard.getByRole('button',{name:'Descrizione su '+armor.name,exact:true}).click();await page.getByRole('dialog',{name:armor.name,exact:true}).waitFor();await page.getByRole('button',{name:'Chiudi dettagli',exact:true}).click()
 await shots(armorCard,'sidebar-active-armor')
 await armorCard.getByRole('button',{name:'Sposta '+armor.name+' giù',exact:true}).click();await synced()
 const ordered=(await api(ctx,path)).state.abilities.filter(a=>a.ownerId===0&&a.active).map(a=>a.id);assert.deepEqual(ordered,[11,10])
 await sleepCard.getByRole('button',{name:'Lancia di nuovo',exact:true}).click()
 const sleepForm=page.getByRole('form',{name:'Lancio: '+sleep.name,exact:true})
 await sleepForm.getByLabel('Sonno · tira 5d8 e inserisci la somma').fill('20')
 const discarded=await sleepForm.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," ability-row ")][1]').getAttribute('id')
 await sidebar.getByRole('button',{name:life.name+' · Usa',exact:true}).click()
 const lifeForm=page.getByRole('form',{name:'Lancio: '+life.name,exact:true});await lifeForm.waitFor();await synced()
 assert.equal(await sleepForm.count(),0);assert.equal(await page.locator('#'+discarded).count(),0)
 game=await api(ctx,path);assert(!game.state.abilities.some(a=>'ability-'+a.id===discarded));assert.equal(game.characters.find(c=>c.sheet.name==='Aster').sheet.playerDetails['slots.1.used'],undefined)
 assert(game.state.abilities.some(a=>a.id===10&&a.active));assert(game.state.abilities.some(a=>a.id===11&&a.active));assert.equal(await sidebar.locator('.ability-row:not([data-compact-active])').count(),1)
 await lifeForm.getByLabel('PF temporanei tirati',{exact:true}).fill('4');const keep=lifeForm.getByRole('combobox',{name:'PF temporanei da mantenere',exact:true});if(await keep.count())await keep.selectOption('new')
 await lifeForm.getByRole('button',{name:'Calcola esiti',exact:true}).click();await page.getByRole('region',{name:'Esiti: '+life.name,exact:true}).getByRole('button',{name:'Applica PF temporanei',exact:true}).click();await synced()
 game=await api(ctx,path);assert.equal(game.characters.find(c=>c.sheet.name==='Aster').sheet.playerDetails['slots.1.used'],'1');assert.equal(game.characters.find(c=>c.sheet.name==='Aster').sheet.playerDetails.temporaryHitPoints,'8')
 assert.equal(await sidebar.locator('.ability-row:not([data-compact-active])').count(),0,'A completed cast becomes compact, with no stale configuration form')
 await budget.locator('[data-unit=action][data-used=true]').waitFor();await playerBudget.locator('[data-unit=action][data-used=true]').waitFor()
 await shots(budget,'turn-budget-action-used')
 game=await api(ctx,path)
 const extra={id:999,name:'Privilegio di prova',ownerId:0,active:true,timed:true,duration:'1 minuto',remainingTurns:10,targets:[{id:0,damage:'0',resolved:true}],resolutionEffects:[{kind:'action-grant',unit:'action',amount:1,trigger:'always',restriction:'Azione aggiuntiva di prova.'}]}
 const counterSheets=game.characters.map(c=>c.sheet.name==='Aster'?{...c.sheet,playerDetails:{...c.sheet.playerDetails,'combat.bonusActionUsed':'true','combat.bonusActionUses':'1','combat.reactionUsed':'true','combat.reactionUses':'1'}}:c.sheet)
 await api(ctx,path+'/state','PUT',{revision:game.revision,state:{...game.state,abilities:[...game.state.abilities,extra]},sheets:counterSheets});await page.reload();await budget.locator('li').nth(3).waitFor();await playerBudget.locator('li').nth(3).waitFor()
 assert.equal(await budget.locator('[data-used=true]').count(),3);assert.equal(await playerBudget.locator('[data-used=true]').count(),3)
 assert.deepEqual(await budget.locator('li').evaluateAll(items=>items.map(el=>el.dataset.unit)),['action','action','bonus-action','reaction'])
 assert.match(await budget.locator('li').nth(1).getAttribute('title'),/Privilegio di prova/)
 await shots(budget,'turn-budget-extra-action');await playerPage.setViewportSize({width:390,height:1000});await playerBudget.screenshot({path:'.test-runtime.local/turn-budget-player-390.png'})
 assert(await playerBudget.evaluate(el=>el.scrollWidth<=el.clientWidth+1))
 await page.getByRole('button',{name:'Turno successivo →',exact:true}).click();await synced()
 await page.getByRole('button',{name:'Dettagli di Aster',exact:true}).click();assert.equal(await budget.locator('[data-used=true]').count(),3,'Other turns must not recover the reaction')
 await page.getByRole('button',{name:'Turno successivo →',exact:true}).click();await synced();await playerBudget.locator('[data-used=false]').nth(3).waitFor()
 assert.equal(await budget.locator('[data-used=true]').count(),0,'The owner’s turn refreshes all action indicators')
 assert.equal(await playerBudget.locator('[data-used=true]').count(),0)

 await page.getByRole('button',{name:'Tutte le abilità',exact:true}).click()
 const all=sidebar.locator('.master-active-effects');await all.getByRole('region',{name:'Effetti di Aster',exact:true}).waitFor();await all.getByRole('region',{name:'Effetti di Baldur',exact:true}).waitFor()
 assert.equal(await page.getByRole('region',{name:'Azioni preparate',exact:true}).count(),0)
 await shots(all,'sidebar-effects-by-character')
 await all.getByRole('region',{name:'Effetti di Aster',exact:true}).getByRole('button',{name:new RegExp('^'+armor.name)}).click();await armorCard.waitFor()
 assert.equal(await sidebar.locator('.master-active-effects').count(),0)
 await armorCard.getByRole('button',{name:'Termina effetto',exact:true}).click();await armorCard.waitFor({state:'detached'});await synced()
 game=await api(ctx,path);assert.equal(currentArmorClass(game.characters.find(c=>c.sheet.name==='Baldur').sheet),'12');assert(game.state.abilities.some(a=>a.id===11&&a.active),'Ending one effect must preserve the others')
 await sleepCard.getByRole('button',{name:'Termina effetto',exact:true}).click();await sleepCard.waitFor({state:'detached'});await synced()
 game=await api(ctx,path);assert(!game.state.abilities.some(a=>a.ruleId===sleep.ruleId&&a.active));assert(game.state.abilities.some(a=>a.conditionOrigin&&a.ownerId===1&&a.active),'Waking does not remove prone')
 await page.getByRole('button',{name:'Dettagli di Baldur',exact:true}).click()
 const availableBaldur=sidebar.locator('.master-available-abilities')
 for(const name of ['Prono','Risveglio preparato'])assert.equal(await availableBaldur.getByText(new RegExp('^'+name+' ·')).count(),0,'Conditions and preparations must not appear as usable abilities')
 await availableBaldur.getByText('Scatto improvvisato · In esecuzione',{exact:true}).waitFor()
 await page.locator('#ability-13').getByRole('button',{name:'Lancia di nuovo',exact:true}).click()
 const custom=sidebar.locator('.ability-row:not([data-compact-active])')
 assert.equal(await custom.getByRole('combobox',{name:/^Nome abilità/}).inputValue(),'Scatto improvvisato','A custom ability must not become an unrelated catalog spell on recast')
 await custom.getByRole('button',{name:'Elimina Scatto improvvisato',exact:true}).click();await synced()
 assert((await api(ctx,path)).state.abilities.some(a=>a.id===13&&a.active))
 // Regression: active wind controls stay compact outside the casting form.
 game=await api(ctx,path)
 const wind=spell('gust-of-wind')
 await api(ctx,path+'/state','PUT',{revision:game.revision,state:{...game.state,combat:{activeId:0,round:1},abilities:[...game.state.abilities,{...wind,id:90,ownerId:0,active:true,remainingTurns:10,concentration:true,targets:[]}]},sheets:game.characters.map(c=>c.sheet)})
 await page.reload();await page.getByRole('button',{name:'Dettagli di Aster',exact:true}).click()
 const windCard=page.locator('#ability-90'),manage=windCard.locator('details').filter({has:page.locator('summary').getByText('Gestisci direzione e bersagli',{exact:true})})
 await windCard.waitFor()
 assert.deepEqual(await windCard.locator(':scope > *').evaluateAll(nodes=>nodes.slice(1,4).map(el=>el.matches('.ability-metadata')?'duration':el.matches('details')?el.querySelector('summary').textContent:'usage')),['duration','Gestisci durata','usage'])
 await manage.locator('summary').click()
 const direction=manage.getByRole('button',{name:'Cambia direzione (usa azione bonus)',exact:true}),area=manage.getByRole('group',{name:'Creature nella linea di vento',exact:true})
 assert(await direction.evaluate(el=>el.parentElement.previousElementSibling.matches('.ability-targets')),'Change direction follows current targets')
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000})
  const size=await area.getByRole('checkbox').first().boundingBox()
  assert.equal(size.width,16);assert.equal(size.height,16)
  assert.equal(await area.locator('.ability-check').first().evaluate(el=>getComputedStyle(el).display),'flex')
 }
 await area.getByRole('checkbox').first().check();await synced()
 assert.equal((await api(ctx,path)).state.abilities.find(a=>a.id===90).targets.length,1)
 await shots(windCard,'sidebar-active-wind')
 await direction.click();await manage.getByRole('group',{name:'Bersagli nella nuova direzione',exact:true}).waitFor()
 assert(!await area.isVisible())
 await manage.getByRole('button',{name:'Annulla cambio direzione',exact:true}).click();await area.waitFor()
 assert.deepEqual(errors,[])
 console.log('PASS sidebar: Master/player action budgets, additional actions and owner-turn reset; compact cards, ordering, one configuration, casts, grouped effects and termination')
}catch(error){await page.screenshot({path:'.test-runtime.local/sidebar-failure.png',fullPage:true}).catch(()=>{});throw error}finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
