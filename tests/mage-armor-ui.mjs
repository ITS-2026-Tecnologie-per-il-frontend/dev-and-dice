// Run: node tests/mage-armor-ui.mjs — isolated game, shared benefit forms and 2014 Mage Armor.
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {resolutionPlan,directBenefit,defenseProfile,validEffectSpecs,spellEffectDetails} from '../src/domain/dnd/CombatResolution.ts'
import {combatTargeting,assertTargetTypes} from '../src/domain/dnd/CombatTargets.ts'
import {settleCombatEffects} from '../src/domain/dnd/CombatConditions.ts'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
import {addInventoryItem,ownedInventoryItems,setInventoryReference} from '../src/utils/Inventory.ts'
const {data,catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:'+id)),mageArmor=spell('mage-armor')
const caster={...newCharacterSheet(),name:'Aster',kind:'PG',characterClass:'Mago',level:'5',dexterity:'14',hitPoints:'20',armorClass:'12',abilities:[{...mageArmor,instantaneous:true,damageEnabled:true}],playerDetails:{'slots.1.total':'4','slots.1.used':'0'}}
let ally={...newCharacterSheet(),name:'Baldur',dexterity:'14',hitPoints:'20',armorClass:'12'}
ally=addInventoryItem(ally,data,'Scudo','shield','1');ally=setInventoryReference(ally,'shield',ownedInventoryItems(ally)[0].id)
let armored={...newCharacterSheet(),name:'Corazzato',dexterity:'14',hitPoints:'20',armorClass:'16'}
armored=addInventoryItem(armored,data,'Cotta di maglia','chain-mail','1');armored=setInventoryReference(armored,'armor',ownedInventoryItems(armored)[0].id)
const plan=resolutionPlan(caster,mageArmor,catalog,'slot:1'),rule=combatTargeting(mageArmor,catalog,caster,'slot:1')
assert(directBenefit(plan));assert(validEffectSpecs(plan.effects));assert.equal(rule.maximum,1);assert(rule.requiresUnarmored)
assert(directBenefit(resolutionPlan(caster,spell('magic-weapon'),catalog,'slot:2')),'Existing weapon enchantments retain their direct form')
assert(directBenefit(resolutionPlan(caster,spell('bless'),catalog,'slot:1')),'Verified creature benefits share the form by mechanics')
assert.throws(()=>assertTargetTypes(rule,[{id:3,sheet:armored}],[3]),/armatura/)
const source={...mageArmor,id:1,ownerId:1,active:true,remainingTurns:4800,resolutionEffects:plan.effects,targets:[{id:1,damage:'0'}]}
assert.equal(defenseProfile(caster,undefined,[source],1,false,data).armorClass,15,'Alternative base AC, never a flat +13')
assert.equal(defenseProfile({...caster,armorClass:'18'},undefined,[source],1,false,data).armorClass,18,'Keep a better alternative AC')
assert.equal(defenseProfile(ally,undefined,[{...source,targets:[{id:2,damage:'0'}]}],2,false,data).armorClass,17,'A shield can be used with Mage Armor')
assert.equal(defenseProfile(caster,undefined,[source,{...source,id:2}],1,false,data).armorClass,15,'Duplicate base formulas do not stack')
assert.equal(defenseProfile(armored,undefined,[source],1,false,data).armorClass,16,'Worn armor prevents the benefit')
const armorDetails=spellEffectDetails(source,[{id:1,name:'Aster',sheet:caster}],[],data)[0]
assert.equal(armorDetails.armorClass,15,'The effect preview includes its numeric resulting AC')
assert.equal(spellEffectDetails({...source,targets:[{id:2,damage:'0'}]},[{id:2,name:'Baldur',sheet:ally}],[],data)[0].armorClass,17,'The preview includes a shield')
assert.equal(spellEffectDetails(source,[{id:1,name:'Aster',sheet:{...caster,dexterity:''}}],[],data)[0].armorClass,undefined,'Unknown Dexterity never invents a numeric outcome')
const synchronized=settleCombatEffects([source],[{id:1,sheet:caster}]).turns[0].sheet
assert.equal(synchronized.armorClass,'12','The permanent base AC is preserved')
assert.equal(synchronized.playerDetails.temporaryAC,'15','The sheet stores the effective temporary AC')
assert.equal(settleCombatEffects([source],[{id:1,sheet:synchronized}]).turns[0].sheet,synchronized,'Synchronizing twice is idempotent')
assert.equal(settleCombatEffects([],[{id:1,sheet:synchronized}]).turns[0].sheet.playerDetails.temporaryAC,'','Ending the effect clears the generated value')
const manual={...caster,playerDetails:{...caster.playerDetails,temporaryAC:'14'}}
const manualBuff=settleCombatEffects([source],[{id:1,sheet:manual}]).turns[0].sheet
assert.equal(settleCombatEffects([],[{id:1,sheet:manualBuff}]).turns[0].sheet.playerDetails.temporaryAC,'14','An existing manual temporary AC is restored')
const bonus={...source,ruleId:'phb2014:spell:shield-of-faith',resolutionEffects:[{kind:'ac',amount:2,trigger:'always'}]}
const bonusSheet=settleCombatEffects([bonus],[{id:1,sheet:caster}]).turns[0].sheet
assert.equal(bonusSheet.playerDetails.temporaryAC,'14')
assert.equal(defenseProfile(bonusSheet,undefined,[bonus],1).armorClass,14,'A synchronized bonus is never counted twice')
assert.equal(settleCombatEffects([source],[{id:1,sheet:{...synchronized,dexterity:'16'}}]).turns[0].sheet.playerDetails.temporaryAC,'16','Changes to Dexterity update the temporary AC')
const ended=settleCombatEffects([source],[{id:1,sheet:{...caster,playerDetails:{...caster.playerDetails,armor:'Cotta di maglia'}}}]).abilities
assert.equal(ended[0].active,false);assert.equal(settleCombatEffects(ended,[{id:1,sheet:caster}]).abilities[0].active,false,'Removing armor never restores an ended cast')
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true,mode:0o700})
const dir=await mkdtemp(join(root,'mage-armor-')),server=(await createApp({dataDir:dir,production:false,sessionSecret:'mage-armor-isolated-test-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),master=await browser.newContext({viewport:{width:1600,height:1050}}),player=await browser.newContext({viewport:{width:390,height:950}}),dm=await master.newPage(),page=await player.newPage(),errors=[]
for(const p of [dm,page]){p.setDefaultTimeout(20000);p.on('pageerror',error=>errors.push(error.message))}
async function api(user,path,method='GET',body){const response=await user.request.fetch(base+'/api'+path,{method,data:body});assert(response.ok(),await response.text());return response.json()}
async function renewed(p){await p.getByRole('button',{name:'Impostazioni',exact:true}).click();await p.getByRole('radio',{name:/^Rinnovata/}).check();await p.getByRole('button',{name:'Torna al tavolo',exact:true}).click()}
try{
 await api(master,'/register','POST',{username:'MageArmorMaster',password:'test-password-123'});await api(player,'/register','POST',{username:'MageArmorPlayer',password:'test-password-123'})
 let game=await api(master,'/play/games','POST',{name:'Armatura magica QA'}),path='/play/games/'+game.id
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet:caster})
 for(const sheet of [ally,armored]){await api(master,'/play/characters','POST',{sheet});game=await api(master,path);game=await api(master,path+'/characters','POST',{revision:game.revision,characterId:sheet.id})}
 const turn=(sheet,i)=>({id:i+1,sheet,description:sheet.name,initiative:String(20-i),hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:''})
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[caster,ally,armored],state:{turns:[caster,ally,armored].map(turn),abilities:[],combat:{activeId:1,round:1}}})
 // Reproduce a cast saved before temporary AC synchronization, without touching live data.
 const storedFile=join(dir,'games.json'),before=await readFile(storedFile,'utf8'),legacy=JSON.parse(before)
 legacy.games.find(saved=>saved.id===game.id).state.abilities=[{...source,targets:source.targets.map(target=>({...target,resolved:true}))}]
 const legacyText=JSON.stringify(legacy)
 await writeFile(storedFile,legacyText)
 const legacyMaster=await api(master,path),legacyPlayer=await api(player,path)
 assert.equal(legacyMaster.state.turns[0].sheet.playerDetails.temporaryAC,'15','Reading an old active cast calculates the row’s temporary AC immediately')
 assert.equal(legacyMaster.characters.find(record=>record.id===caster.id).sheet.playerDetails.temporaryAC,'15','The Master’s full sheet receives the same derived value')
 assert.equal(legacyPlayer.character.sheet.playerDetails.temporaryAC,'15','The player’s sheet also receives the old cast benefit')
 assert.equal(legacyMaster.characters.find(record=>record.id===caster.id).sheet.armorClass,'12','Read normalization preserves permanent AC')
 assert.equal(legacyMaster.revision,game.revision,'Reading never advances the game revision')
 assert.equal(legacyPlayer.character.sheet.playerDetails['slots.1.used'],'0','Reading an existing cast never spends another slot')
 assert.equal(await readFile(storedFile,'utf8'),legacyText,'Read normalization does not mutate saved game data')
 await writeFile(storedFile,before)
 const choices=await api(player,path+'/actions'),action=choices.actions.find(action=>action.name===mageArmor.name)
 const rejected=await player.request.post(base+'/api'+path+'/requests',{data:{id:crypto.randomUUID(),revision:choices.revision,key:action.key,option:'slot:1',cost:1,mode:'none',damageEnabled:false,packets:[{targetId:3,damage:[]}]}})
 assert.equal(rejected.status(),400,'A forged armored target is rejected by the server')
 for(const p of [dm,page]){await p.goto(base+'/games/'+game.id);await renewed(p)}
 await page.getByRole('button',{name:mageArmor.name+' · Usa',exact:true}).click()
 const proposal=page.getByRole('form',{name:'Proposta: '+mageArmor.name,exact:true})
 assert(await proposal.getByRole('checkbox',{name:'Corazzato',exact:true}).isDisabled())
 await proposal.getByRole('checkbox',{name:'Tu (Aster)',exact:true}).check()
 assert.equal(await proposal.getByRole('combobox',{name:/Arma di/}).count(),0)
 for(const name of ['Costo','Risoluzione'])assert.equal(await proposal.getByLabel(name,{exact:true}).count(),0)
 await proposal.getByRole('button',{name:'Invia al Master',exact:true}).click()
 game=await api(master,path)
 const oldRequest=JSON.parse(await readFile(storedFile,'utf8'))
 for(const target of oldRequest.games.find(saved=>saved.id===game.id).combatRequests.at(-1).resolution.targets)delete target.effectDetails
 await writeFile(storedFile,JSON.stringify(oldRequest))
 game=await api(master,path)
 assert.equal(game.combatRequests.find(request=>request.status==='pending').targets[0].resolution.effectDetails.armorClass,15,'Requests saved before numeric previews also show the result')
 const pendingRequest=game.combatRequests.find(request=>request.status==='pending'),revision=game.revision
 for(let save=0;save<2;save++)game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(record=>record.sheet),state:game.state})
 assert.equal(game.revision,revision,'Autosaving an unchanged projected session must not invalidate player proposals')
 assert.equal(game.combatRequests.find(request=>request.id===pendingRequest.id).status,'pending')
 // A genuine change still locks approval; the Master explicitly revalidates the benefit.
 const changed=game.characters.map(record=>record.id===caster.id?{...record.sheet,speed:'35'}:record.sheet)
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:changed,state:game.state})
 assert.equal(game.combatRequests.find(request=>request.id===pendingRequest.id).status,'stale')
 const denied=await player.request.post(base+'/api'+path+'/requests/'+pendingRequest.id+'/roll',{data:{revision:game.revision,kind:'refresh'}})
 assert.equal(denied.status(),403,'Only the Master can refresh a stale proposal')
 const wrongTurn=await api(master,path+'/state','PUT',{revision:game.revision,sheets:game.characters.map(record=>record.sheet),state:{...game.state,combat:{...game.state.combat,activeId:2}}})
 const invalid=await master.request.post(base+'/api'+path+'/requests/'+pendingRequest.id+'/roll',{data:{revision:wrongTurn.revision,kind:'refresh'}})
 assert.equal(invalid.status(),409,'Refresh never bypasses the caster’s turn')
 game=await api(master,path+'/state','PUT',{revision:wrongTurn.revision,sheets:wrongTurn.characters.map(record=>record.sheet),state:{...wrongTurn.state,combat:{...wrongTurn.state.combat,activeId:1}}})
 await dm.reload();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await dm.getByRole('button',{name:/^Azioni dei giocatori:/}).click()
 const notice=dm.locator('.combat-request').filter({has:dm.getByRole('heading',{name:mageArmor.name,exact:true})})
 await notice.getByText('Superata: turno o dati cambiati',{exact:true}).waitFor()
 assert.equal(await notice.getByRole('button',{name:'Approva azione',exact:true}).count(),0,'A stale request cannot be approved without revalidation')
 await notice.getByRole('button',{name:'Aggiorna richiesta',exact:true}).click()
 await notice.getByRole('button',{name:'Approva azione',exact:true}).waitFor()
 game=await api(master,path)
 assert.equal(game.characters.find(record=>record.id===caster.id).sheet.playerDetails['slots.1.used'],'0','Refreshing never applies the effect or spends a slot')
 await notice.getByText('CA base: 13 + modificatore di Destrezza (+2) = 15.',{exact:true}).waitFor()
 assert.equal(await notice.getByLabel('CA risultante di Aster',{exact:true}).textContent(),'15','The Master sees the resulting AC before approval')
 await notice.screenshot({path:join(root,'mage-armor-request-result.png')})
 await notice.getByRole('button',{name:'Approva azione',exact:true}).click()
 await notice.getByText('Approvata',{exact:true}).waitFor()
 await page.getByRole('button',{name:mageArmor.name+' · In esecuzione',exact:true}).click()
 const summary=page.getByLabel('Riepilogo: '+mageArmor.name,{exact:true})
 await summary.getByText('CA base: 13 + modificatore di Destrezza (+2) = 15.',{exact:true}).waitFor()
 await dm.getByRole('button',{name:'Chiudi azioni',exact:true}).click()
 game=await api(master,path)
 assert.equal(game.characters.find(record=>record.id===caster.id).sheet.playerDetails.temporaryAC,'15')
 assert.equal(await dm.getByRole('spinbutton',{name:'CA di Aster',exact:true}).inputValue(),'15','The turn row displays the effective AC')
 await dm.getByRole('button',{name:'Apri scheda completa',exact:true}).click()
 const dialog=dm.getByRole('dialog').filter({has:dm.getByLabel('CA temporanea',{exact:true})})
 assert.equal(await dialog.getByLabel('CA temporanea',{exact:true}).inputValue(),'15','The full sheet displays the effective temporary AC')
 assert.equal(await dialog.getByLabel('CA',{exact:true}).inputValue(),'12','The full sheet preserves permanent AC')
 await dialog.getByRole('button',{name:'Salva scheda',exact:true}).click()
 assert.equal(game.state.abilities[0].concentration,false);assert.equal(game.state.abilities[0].remainingTurns,4800)
 const available=dm.locator('.master-available-abilities')
 await available.getByRole('button',{name:mageArmor.name+' · In esecuzione',exact:true}).click()
 await dm.getByRole('button',{name:'Termina effetto',exact:true}).click();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 game=await api(master,path)
 assert.equal(game.characters.find(record=>record.id===caster.id).sheet.playerDetails.temporaryAC,'','Ending the cast clears the full sheet')
 assert.equal(await dm.getByRole('spinbutton',{name:'CA di Aster',exact:true}).inputValue(),'12','The row returns to base AC')
 const reset=game.characters.map(record=>({...record.sheet,playerDetails:{...record.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}}))
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:reset,state:{...game.state,combat:{activeId:1,round:2}}})
 await dm.reload();await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 await available.getByRole('button',{name:mageArmor.name+' · Usa',exact:true}).click()
 const form=dm.getByRole('form',{name:'Lancio: '+mageArmor.name,exact:true})
 for(const name of ['Effetto istantaneo','Prevede danni','Confermo requisiti e bersagli'])assert.equal(await form.getByRole('checkbox',{name,exact:true}).count(),0)
 assert.equal(await form.getByRole('combobox',{name:'Origine del lancio di '+mageArmor.name,exact:true}).count(),1)
 assert(await form.getByRole('checkbox',{name:'Corazzato',exact:true}).isDisabled())
 await form.getByRole('checkbox',{name:'Baldur',exact:true}).check()
 for(const width of [1600,390,320]){await dm.setViewportSize({width,height:1050});assert(await form.evaluate(element=>element.scrollWidth<=element.clientWidth+1))}
 await form.screenshot({path:join(root,'mage-armor-form-320.png')})
 await form.getByRole('button',{name:'Applica potenziamento',exact:true}).click();await form.waitFor({state:'detached'});await dm.getByText('Sessione sincronizzata',{exact:true}).waitFor()
 const applied=dm.locator('.ability-row').filter({has:dm.getByRole('button',{name:'Termina effetto',exact:true})}).getByLabel('Effetto applicato',{exact:true})
 await applied.getByText('Baldur',{exact:true}).waitFor();await applied.getByText('CA base: 13 + modificatore di Destrezza (+2) = 15.',{exact:true}).waitFor()
 await applied.screenshot({path:join(root,'mage-armor-active-320.png')})
 game=await api(master,path)
 const active=game.state.abilities.find(ability=>ability.active)
 assert.equal(active.resolutionEffects[0].kind,'ac-base');assert.equal(active.targets[0].id,2)
 assert.equal(game.characters.find(record=>record.id===caster.id).sheet.playerDetails['slots.1.used'],'2','One slot for each successful cast')
 assert.equal(defenseProfile(ally,undefined,[active],2,false,data).armorClass,17)
 assert.equal(game.characters.find(record=>record.id===ally.id).sheet.playerDetails.temporaryAC,'17','Shield bonus is included in the saved temporary AC')
 assert.equal(await dm.getByRole('spinbutton',{name:'CA di Baldur',exact:true}).inputValue(),'17')
 let worn=game.characters.find(record=>record.id===ally.id).sheet
 worn=addInventoryItem(worn,data,'Cotta di maglia','chain-mail','1')
 worn=setInventoryReference(worn,'armor',ownedInventoryItems(worn).find(item=>item.catalog==='chain-mail').id)
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[worn],state:game.state})
 assert.equal(game.state.abilities.find(ability=>ability.id===active.id).active,false,'Equipping armor ends the persisted source')
 assert.equal(game.characters.find(record=>record.id===ally.id).sheet.playerDetails.temporaryAC,'','Equipping armor clears generated temporary AC')
 assert.deepEqual(errors,[])
 console.log('PASS Mage Armor: shared benefit category, player and direct Master forms, unarmored validation, base AC and shield, summaries, duration, no concentration, slot spend and armor termination')
}catch(error){await dm.screenshot({path:join(root,'mage-armor-master-failure.png'),fullPage:true});await page.screenshot({path:join(root,'mage-armor-player-failure.png'),fullPage:true});throw error}
finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
