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
 assert.deepEqual(errors,[])
 console.log('PASS notification attention: independent feeds, persistent opening receipts, same-count replacements, arrivals while open, read/reject cursors, storage failure and gold in both themes/mobile')
}finally{await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
