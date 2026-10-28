// Isolated UI fixtures: no game archive or real account is read or changed.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'

const event=(overrides)=>({id:'attack',sequence:6,createdAt:'2026-10-28T16:58:55Z',actorName:'admin',kind:'action',characterName:'Gaglio',label:'Pugnale',option:'free',countered:false,targets:[{id:1,name:'Prisma',result:'Colpito · Danni (Perforante): 3 · Danni finali: 3'}],changes:[{subject:'Gaglio',label:'Azioni usate',before:'0',after:'1'},{subject:'Prisma',label:'PF',before:'101',after:'98'},{subject:'Partecipante',label:'Stato',before:'Aggiornato',after:'Aggiornato'}],...overrides})
const events=[event({}),event({id:'multi',sequence:5,kind:'spell',characterName:'Aster',label:'Palla di Fuoco',option:'slot:3',targets:[{id:1,name:'Prisma',result:'Tiro salvezza superato · Danni finali: 4'},{id:2,name:'Cacciatore Invisibile',result:'Danni finali: 8'}]}),event({id:'state',sequence:4,kind:'state',characterName:undefined,label:'Modifica dello stato',targets:[],option:undefined,changes:[{subject:'Prisma',label:'PF',before:'98',after:'100'}]}),event({id:'self',sequence:3,kind:'spell',label:'Scudo',option:'slot:1',targets:[],changes:[]}),event({id:'reaction',sequence:2,kind:'reaction',characterName:'Aster',label:'Controincantesimo',countered:true,parentId:'multi',targets:[{id:1,name:'Prisma'}],changes:[]})]
const fixtureEntry='/__event-log-fixture.tsx'
const app=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{
 name:'event-log-fixtures',
 resolveId(id){if(id===fixtureEntry)return id},
 load(id){if(id===fixtureEntry)return `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {GameEventLog} from '/src/components/GameEventLog.tsx';
import '/src/index.css';import '/src/App.css';import '/src/PlayPages.css';
createRoot(document.getElementById('root')).render(React.createElement(GameEventLog,{game:{id:'fixture',role:'master'}}));
`},
 configureServer(server){server.middlewares.use('/__event-log-test',async(_req,res,next)=>{
  try{
   res.setHeader('Content-Type','text/html')
   res.end(await server.transformIndexHtml('/__event-log-test',`<!doctype html><html lang="it"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root" style="min-height:100vh;text-align:left;padding:16px;box-sizing:border-box"></div><script type="module" src="${fixtureEntry}"></script></body></html>`))
  }catch(error){next(error)}
 })}
}]})
let browser
try{
 await app.listen();browser=await chromium.launch({headless:true})
 const base=`http://127.0.0.1:${app.httpServer.address().port}`,shots=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(shots,{recursive:true})
 for(const [width,colorScheme] of [[1100,'light'],[390,'light'],[390,'dark']]){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme}),page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  let fail=false
  await page.route('**/api/play/games/fixture/events*',route=>fail?route.fulfill({status:500,json:{error:'Errore di prova'}}):route.fulfill({json:{events:route.request().url().includes('before=')?[event({id:'older',sequence:1,label:'Attacco precedente'})]:events,sequence:6}}))
  await page.goto(base+'/__event-log-test')
  await page.getByRole('button',{name:'Registro degli eventi',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Registro degli eventi',exact:true}),card=dialog.locator('#event-attack')
  await card.getByRole('heading',{name:'Gaglio usa Pugnale su Prisma',exact:true}).waitFor()
  assert.equal(await card.locator('.game-event-arrow').count(),1)
  assert.equal(await card.locator('.game-event-option').count(),0,'Internal free option is not displayed')
  assert.equal(await card.locator('details').getAttribute('open'),null,'Action details start collapsed')
  await card.locator('summary').focus();await page.keyboard.press('Enter')
  assert.equal(await card.locator('details').getAttribute('open'),'')
  await card.getByRole('heading',{name:'Prisma',exact:true}).waitFor()
  assert.match((await card.locator('dl').allTextContents()).join(' '),/101.*98/)
  assert(!(await card.innerText()).includes('Aggiornato → Aggiornato'))
  await card.locator('summary').click();await page.keyboard.press('Tab')
  await dialog.locator('#event-multi').getByRole('heading',{name:'Aster usa Palla di Fuoco su Prisma, Cacciatore Invisibile',exact:true}).waitFor()
  assert.equal(await dialog.locator('#event-state details').getAttribute('open'),'')
  await dialog.locator('#event-self').getByRole('heading',{name:'Gaglio · Scudo',exact:true}).waitFor()
  assert.equal(await dialog.locator('#event-self .game-event-option').innerText(),'Slot di 1° livello')
  await dialog.locator('#event-reaction').getByRole('link',{name:'5',exact:true}).waitFor()
  assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dialog must fit narrow screens')
  assert(await card.locator('h3').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Attack title must fit')
  await dialog.screenshot({path:join(shots,`event-log-${width}-${colorScheme}.png`)})
  await dialog.getByRole('button',{name:'Eventi precedenti',exact:true}).click();await dialog.locator('#event-older').waitFor()
  assert.equal(await dialog.locator('#event-attack').count(),1)
  await dialog.getByRole('button',{name:'Chiudi registro degli eventi',exact:true}).click()
  fail=true;await page.getByRole('button',{name:'Registro degli eventi',exact:true}).click();await dialog.getByRole('alert').waitFor()
  fail=false;await dialog.getByRole('button',{name:'Riprova',exact:true}).click();await dialog.getByRole('alert').waitFor({state:'hidden'})
  assert.deepEqual(errors,[])
  await context.close()
 }
 console.log('Event log UI: directed titles, multiple targets, grouped details, keyboard, pagination, retry, mobile and dark theme passed.')
}finally{await browser?.close();await app.close()}