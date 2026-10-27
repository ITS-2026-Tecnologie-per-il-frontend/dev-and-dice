// node tests/disabled-buttons-ui.mjs - isolated tooltip and readied-action integration.
import assert from 'node:assert/strict'
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
const root=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(root,{recursive:true})
const dir=await mkdtemp(join(root,'disabled-buttons-'))
const fixture=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{ActionButton}from'/src/components/ActionButton';import{ReadiedActions}from'/src/components/ReadiedActions';
import'/src/index.css';import'/src/Theme.css';import'/src/App.css';import'/src/PlayPages.css';
window.submitCount=0;window.actionCount=0;
function App(){const[blocked,setBlocked]=useState(true);return <main style={{padding:16,maxWidth:360}}>
<form onSubmit={e=>{e.preventDefault();window.submitCount++}}><fieldset disabled={blocked}>
<ActionButton disabled={blocked} disabledReason="Attendi la sincronizzazione della sessione." onClick={()=>window.actionCount++}>Comando di prova</ActionButton></fieldset></form>
<button onClick={()=>setBlocked(v=>!v)}>Sblocca</button>
<ReadiedActions game={{id:'tooltip',role:'master',revision:1,requestsRevision:1,combatRequests:[]}} onUpdate={()=>{}}/>
</main>}createRoot(document.getElementById('root')).render(<App/>);`
await writeFile(join(dir,'fixture.jsx'),fixture)
await writeFile(join(dir,'index.html'),'<html><meta name="viewport" content="width=device-width"><div id="root"></div><script type="module" src="./fixture.jsx"></script></html>')
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0}});await server.listen()
const base=`http://127.0.0.1:${server.httpServer.address().port}/${relative(join(import.meta.dirname,'..'),dir).replaceAll('\\','/')}/index.html`
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:900}}),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const actor={id:0,name:'Aster',canPrepare:false,prepareBlockedReason:'Il turno attivo appartiene a Baldur.',canReact:false,reactBlockedReason:'La reazione di questo turno e gia stata utilizzata.',additionalActionRequired:false,options:[],targets:[],sleepers:[],held:[]}
async function route(p){await p.route('**/api/play/games/tooltip/readied-actions',r=>r.fulfill({json:{revision:1,actors:[actor]}}))}
try{
 await route(page);await page.goto(base)
 const command=page.getByRole('button',{name:'Comando di prova',exact:true}),hint=command.locator('..'),tooltip=page.getByRole('tooltip')
 await hint.hover();await tooltip.waitFor();assert.equal(await tooltip.textContent(),'Attendi la sincronizzazione della sessione.')
 assert(await command.isDisabled());await hint.click();await page.keyboard.press('Enter');await page.keyboard.press('Space')
 assert.deepEqual(await page.evaluate(()=>[window.submitCount,window.actionCount]),[0,0],'Reading the reason must never execute or submit')
 await page.keyboard.press('Escape');await tooltip.waitFor({state:'hidden'})
 await page.keyboard.press('Tab');await hint.focus();await tooltip.waitFor();await page.keyboard.press('Escape');await tooltip.waitFor({state:'hidden'})
 await page.getByRole('button',{name:'Prepara un\u2019azione',exact:true}).click()
 const prepare=page.getByRole('form',{name:'Prepara un\u2019azione',exact:true}).getByRole('button',{name:'Prepara',exact:true})
 await prepare.locator('..').hover();await tooltip.waitFor();assert.equal(await tooltip.textContent(),actor.prepareBlockedReason)
 const bounds=await tooltip.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390,'Tooltip stays inside narrow viewports')
 await page.screenshot({path:join(root,'disabled-button-reason-mobile.png')})
 await page.getByRole('button',{name:'Sblocca',exact:true}).click();await command.click();assert.deepEqual(await page.evaluate(()=>[window.submitCount,window.actionCount]),[1,1])
 actor.canPrepare=true;actor.held=[{id:10,name:'Risveglio preparato',option:'free',readied:{kind:'wake',trigger:'Quando arriva il nemico'}}]
 await page.reload()
 const held=page.getByRole('button',{name:'Evento avvenuto \u00b7 Sveglia',exact:true})
 await held.locator('..').hover();await tooltip.waitFor();assert.equal(await tooltip.textContent(),actor.reactBlockedReason)
 const mobile=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true}),touch=await mobile.newPage();await route(touch);await touch.goto(base)
 await touch.getByRole('button',{name:'Comando di prova',exact:true}).locator('..').tap();await touch.getByRole('tooltip').waitFor()
 assert.equal(await touch.evaluate(()=>window.submitCount),0)
 await touch.touchscreen.tap(380,880);await touch.getByRole('tooltip').waitFor({state:'hidden'});await touch.getByRole('button',{name:'Sblocca',exact:true}).tap();await touch.getByRole('tooltip').waitFor({state:'hidden'})
 await mobile.close();assert.deepEqual(errors,[])
 console.log('PASS disabled buttons: hover, keyboard, touch, Escape, viewport fit, disabled fieldset, no accidental submission, enabled action, exact preparation and reaction reasons')
}finally{await browser.close();await server.close();await rm(dir,{recursive:true,force:true})}
