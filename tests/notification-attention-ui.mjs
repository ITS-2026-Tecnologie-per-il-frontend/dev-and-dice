// Run: node tests/notification-attention-ui.mjs
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdir,mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'

const root=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(root,{recursive:true})
const dir=await mkdtemp(join(root,'notification-attention-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'notification-attention-test-secret-long-enough'})).listen(0,'127.0.0.1');await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}});await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true}),errors=[]
async function api(context,path,method='GET',data){const response=await context.request.fetch(base+'/api'+path,{method,data});assert(response.ok(),await response.text());return response.json()}
try{
 const master=await browser.newContext({viewport:{width:1600,height:1000}}),player=await browser.newContext()
 for(const [context,username] of [[master,'AttentionMaster'],[player,'AttentionPlayer']])await api(context,'/register','POST',{username,password:'test-password-123'})
 const sheet={...newCharacterSheet(),name:'Maga',hitPoints:'20',armorClass:'12',abilities:[{name:'Segnale',duration:'Senza conteggio',description:'Un gesto per segnalare la propria presenza.'}]}
 let game=await api(master,'/play/games','POST',{name:'Notifiche da aprire'}),path='/play/games/'+game.id
 await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet});game=await api(master,path)
 game=await api(master,path+'/state','PUT',{revision:game.revision,sheets:[sheet],state:{turns:[{id:1,sheet,description:sheet.name,hitPoints:'20',armorClass:'12',temporaryHitPoints:'',initiative:'10'}],abilities:[],combat:{activeId:1,round:1}}})
 const page=await master.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/games/'+game.id)
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('radio',{name:/^Rinnovata/}).check();await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()
 const bell=page.getByRole('button',{name:/^Notifiche:/}),actions=page.getByRole('button',{name:/^Azioni dei giocatori:/})
 async function attention(button,expected,count){await page.waitForFunction(([element,expected,count])=>element.hasAttribute('data-new')===expected&&element.querySelector('.play-notification-count')?.textContent===String(count),[await button.elementHandle(),expected,count])}
 async function edit(hp){const current=(await api(player,path)).character;return api(player,'/play/characters/'+current.id,'PUT',{revision:current.revision,sheet:{...current.sheet,hitPoints:String(hp)}})}
 async function close(label){await page.getByRole('button',{name:label,exact:true}).click()}
 async function propose(){const choices=await api(player,path+'/actions'),action=choices.actions.find(a=>a.name==='Segnale'),option=action.options[0],id=crypto.randomUUID();await api(player,path+'/requests','POST',{id,revision:choices.revision,key:action.key,option:option.id,cost:option.cost??action.cost,mode:action.mode,damageEnabled:action.damageEnabled,targets:[]});return id}
 async function reject(id){const now=await api(master,path);return api(master,path+'/requests/'+id+'/reject','POST',{revision:now.revision})}
 await attention(bell,false,0);await attention(actions,false,0)
 await edit(19);await attention(bell,true,1)
 assert.equal(await bell.getAttribute('aria-description'),'Nuove notifiche da aprire')
 await bell.click();await close('Chiudi notifiche');await attention(bell,false,1)
 await page.reload();await attention(bell,false,1)
 const first=(await api(master,path+'/notifications')).items[0]
 await edit(18);await api(master,path+'/notifications/'+first.id+'/read','POST')
 await attention(bell,true,1) // A new item replaces an old one without increasing the badge.
 await bell.click();await attention(bell,false,1)
 await edit(17)
 await attention(bell,false,2);await close('Chiudi notifiche')
 const feed=await api(master,path+'/notifications'),third=feed.items[0],second=feed.items[1]
 await api(master,path+'/notifications/'+third.id+'/read','POST');await attention(bell,false,1)
 await api(master,path+'/notifications/'+second.id+'/read','POST');await attention(bell,false,0)
 const beforeReject=(await api(player,path)).notifications.newestUnreadRevision
 await api(master,path+'/notifications/'+third.id+'/reject','POST',{revision:(await api(master,path)).revision})
 const playerNotice=(await api(player,path)).notifications
 assert(playerNotice.unreadCount>0&&playerNotice.newestUnreadRevision>beforeReject,'A rejection is a new notification for the player')
 await attention(bell,false,0)
 const firstAction=await propose();await attention(actions,true,1)
 await actions.click();await close('Chiudi azioni');await attention(actions,false,1)
 await page.reload();await attention(actions,false,1)
 await reject(firstAction);await edit(16);await attention(bell,true,1)
 const secondAction=await propose();await attention(actions,true,1)
 for(const [theme,width] of [['dark',1600],['dark',390],['light',1600]]){
  await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await page.setViewportSize({width,height:1000});await page.mouse.move(0,0)
  await page.locator('.combat-management-tools').scrollIntoViewIfNeeded()
  await page.waitForFunction(e=>getComputedStyle(e).backgroundColor==='rgb(216, 175, 69)',await actions.elementHandle())
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.locator('.combat-management-tools').screenshot({path:join(root,`notification-gold-${theme}-${width}.png`)})
 }
 await actions.click();await attention(actions,false,1);await attention(bell,true,1)
 await reject(secondAction);await propose()
 const newest=(await api(master,path)).newestPendingRequest
 await page.waitForFunction(([key,newest])=>Number(localStorage.getItem(key))===newest,[`dev-and-dice.notification-opened.v1.${game.id}.master.actions`,newest])
 await attention(actions,false,1)
 await close('Chiudi azioni');await attention(actions,false,1)
 await page.reload();await attention(actions,false,1);await attention(bell,true,1)
 // A denied storage write must still clear attention for the current visit.
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('dev-and-dice.notification-opened.'))throw new Error('Storage unavailable');return original.call(this,key,value)}})
 await bell.click();await close('Chiudi notifiche');await attention(bell,false,1)
 // Exercise the real action cards with a long history, keeping the page-anchored layout.
 const source=(await api(master,path)).combatRequests[0]
 await page.route('**/api'+path,async route=>{
  const response=await route.fetch(),game=await response.json()
  game.combatRequests=[{...source,additionalActionRequired:true},...Array.from({length:80},(_,index)=>({...source,id:`history-${index}`,status:'rejected'}))]
  await route.fulfill({response,json:game})
 })
 await page.reload()
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900})
  await actions.scrollIntoViewIfNeeded();await actions.click()
  const dialog=page.locator('#combat-requests'),body=dialog.locator('.play-notifications-body')
  assert.equal(await dialog.locator('.combat-request-feed > li').count(),81)
  await dialog.evaluate(element=>window.scrollTo({top:element.getBoundingClientRect().top+scrollY-100,behavior:'instant'}))
  const bounds=await body.boundingBox(),pageScroll=await page.evaluate(()=>scrollY)
  assert(await body.evaluate(element=>element.scrollHeight>element.clientHeight),'Long action histories scroll internally')
  await page.mouse.move(bounds.x+bounds.width/2,Math.min(bounds.y+100,800))
  await page.mouse.wheel(0,500)
  await page.waitForFunction(()=>document.querySelector('#combat-requests .play-notifications-body').scrollTop>0)
  const down=await body.evaluate(element=>element.scrollTop)
  await page.mouse.wheel(0,-400)
  await page.waitForFunction(down=>document.querySelector('#combat-requests .play-notifications-body').scrollTop<down,down)
  assert.equal(await page.evaluate(()=>scrollY),pageScroll,'Wheel input inside the feed keeps the underlying table in place')
  const geometry=await dialog.evaluate(element=>({top:element.getBoundingClientRect().top+scrollY,pageHeight:document.documentElement.scrollHeight,pageY:scrollY,direction:scrollY<document.documentElement.scrollHeight-innerHeight-10?300:-300}))
  await page.mouse.move(2,2);await page.mouse.wheel(0,geometry.direction)
  await page.waitForFunction(before=>scrollY!==before,geometry.pageY)
  assert(Math.abs(await dialog.evaluate(element=>element.getBoundingClientRect().top+scrollY)-geometry.top)<=1,'The blurred table can scroll while the notification stays anchored in the document')
  assert(Math.abs(await page.evaluate(()=>document.documentElement.scrollHeight)-geometry.pageHeight)<=2,'The blur does not enlarge the underlying page')
  // Leaving the viewport must preserve edits, including when inspecting an old action.
  const confirmation=dialog.getByRole('checkbox',{name:/Confermo un/})
  await confirmation.check()
  const last=dialog.locator('.combat-request-feed > li').last()
  await last.scrollIntoViewIfNeeded()
  await last.getByRole('button',{name:/Dettagli su/}).click()
  const details=page.getByRole('dialog',{name:'Segnale',exact:true})
  await details.waitFor({state:'visible'})
  await details.getByRole('button',{name:'Chiudi dettagli',exact:true}).click()
  await confirmation.scrollIntoViewIfNeeded()
  assert(await confirmation.isChecked(),'Scrolling offscreen and back preserves the pending decision draft')
  assert(await body.evaluate(element=>element.scrollWidth<=element.clientWidth+1),'Action cards and the edited decision fit the feed width')
  await dialog.screenshot({path:join(root,`notification-scroll-${width}.png`)})
  await page.keyboard.press('Escape')
  await dialog.waitFor({state:'hidden'})
  assert(await actions.evaluate(button=>document.activeElement===button),'Escape restores focus to the action notification button')
 }
 // The appearance preference applies immediately, persists, and syncs across tabs.
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
 const blur=page.getByRole('checkbox',{name:/Sfocatura dello sfondo/})
 assert(await blur.isChecked(),'Background blur remains enabled by default')
 await blur.uncheck()
 const settings=page.getByRole('dialog',{name:'Impostazioni del Master',exact:true})
 assert(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth+1),'Notification settings fit mobile width')
 await settings.screenshot({path:join(root,'notification-settings-mobile.png')})
 await close('Torna al tavolo');await actions.click()
 assert.equal(await page.locator('#root').evaluate(element=>getComputedStyle(element).filter),'none')
 await close('Chiudi azioni');await page.reload()
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
 assert(!await blur.isChecked(),'The saved preference survives reload')
 await close('Torna al tavolo');await actions.click()
 assert.equal(await page.locator('#root').evaluate(element=>getComputedStyle(element).filter),'none')
 const peer=await master.newPage()
 try{
  await peer.goto(base+'/games/'+game.id)
  await peer.getByRole('button',{name:'Impostazioni',exact:true}).click()
  await peer.getByRole('checkbox',{name:/Sfocatura dello sfondo/}).check()
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('root')).filter==='blur(6px)')
 }finally{await peer.close()}
 await close('Chiudi azioni')
 assert.deepEqual(errors,[])
 console.log('PASS notification attention: independent feeds, persistent opening receipts, same-count replacements, arrivals while open, read/reject cursors, storage failure, gold in both themes/mobile and bidirectional scrolling through 81 action cards and persistent blur settings synced across tabs')
}finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
