// Run: node tests/turn-advance-ui.mjs
import assert from 'node:assert/strict'
import {mkdir,mkdtemp,rm,writeFile,readFile} from 'node:fs/promises'
import {join,basename,resolve,sep} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {parseCatalog,templateFromCatalog} from '../src/utils/Catalog.ts'
const root=resolve(import.meta.dirname,'../.test-runtime.local');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'turn-advance-'))
const catalog=parseCatalog(JSON.parse(await readFile(new URL('../public/data/database.json',import.meta.url),'utf8')))
const templates=catalog.abilities.filter(e=>typeof e.data.level==='number').slice(0,30).map(templateFromCatalog)
const sheets=Array.from({length:8},(_,i)=>({...newCharacterSheet(),name:'Mago '+(i+1),characterClass:'Mago',level:'9',intelligence:'18',hitPoints:'40',armorClass:'14',initiative:String(20-i),abilities:templates,playerDetails:{'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]','combat.reactionUsed':'false','combat.bonusActionUsed':'false','slots.1.total':'4','slots.2.total':'3','slots.3.total':'3','slots.4.total':'3','slots.5.total':'1'}}))
const state={turns:sheets.map((sheet,id)=>({id,description:sheet.name,initiative:sheet.initiative,hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:'',sheet})),abilities:[{id:1,name:'Effetto di prova',ownerId:0,active:true,duration:'1 minuto',remainingTurns:3},{id:2,name:'TS di prova',ownerId:0,active:true,duration:'1 minuto',remainingTurns:3,repeatSaveRoll:{ability:'wisdom',dc:15,timing:'end',lastRound:1}}],combat:{activeId:0,round:1}}
const frontend=await createServer({plugins:[{name:'count-turn-rows',enforce:'pre',transform(code,id){if(!id.replaceAll(String.fromCharCode(92),'/').endsWith('/src/components/TurnParticipantRow.tsx'))return;return code.replace(/(memo\(function TurnParticipantRow\([^\n]*\{\n)/,line=>line+"    if(globalThis.turnRowRenders)globalThis.turnRowRenders[turn.id]=(globalThis.turnRowRenders[turn.id]??0)+1;\n")}}],logLevel:'error',server:{host:'127.0.0.1',port:0}});await frontend.listen()
const code=`import React,{useState,useMemo}from'react';import{createRoot}from'react-dom/client';import{TurnsTracker}from'/src/components/TurnsTracker.tsx';import'/src/index.css';import'/src/App.css';import'/src/PlayPages.css';import'/src/Theme.css';
function Check(){const[version,setVersion]=useState(0);const [snapshot]=useState({state:${JSON.stringify(state)},sheets:${JSON.stringify(sheets)}});const workspace=useMemo(()=>({...snapshot,storageKey:'turn-profile',onChange:(state,sheets)=>{window.lastSaved={state,sheets};setVersion(v=>v+1)},canRemove:()=>true,remove:async()=>{},onWindDirection:async()=>{},windDirectionPending:[]}),[snapshot,version]);return React.createElement(TurnsTracker,{language:'it',view:new URLSearchParams(location.search).get('view')||'renewed',workspace})}createRoot(document.getElementById('root')).render(React.createElement(Check));`
await writeFile(join(dir,'entry.mjs'),code)
const html=await frontend.transformIndexHtml('/turn-profile',`<div id="root"></div><script type="module" src="/.test-runtime.local/${basename(dir)}/entry.mjs"></script>`)
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000)
await page.route('**/turn-profile*',route=>route.fulfill({contentType:'text/html',body:html}))
try{
 for(const view of ['renewed','original']){
  await page.goto(`http://127.0.0.1:${frontend.httpServer.address().port}/turn-profile?view=${view}`)
  await page.waitForFunction(()=>document.querySelectorAll('.participant-ability').length>10&&!document.querySelector('.participant-ability').disabled)
  await page.locator('.rules-panel').waitFor({state:'attached'})
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
  await page.mouse.click(1,1)
  await page.evaluate(()=>{window.turnRowRenders={}})
  const keys=[]
  for(let i=0;i<4;i++){
   keys.push(cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'p',code:'KeyP',windowsVirtualKeyCode:80}))
   keys.push(cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'p',code:'KeyP',windowsVirtualKeyCode:80}))
   await new Promise(resolve=>setTimeout(resolve,50))
  }
  await Promise.all(keys)
  await page.waitForFunction(()=>window.lastSaved?.state.combat.activeId===4)
  const counts=await page.evaluate(()=>window.turnRowRenders)
  assert((counts[6]??0)<=1&&(counts[7]??0)<=1,`${view}: unrelated rows should stay cached: ${JSON.stringify(counts)}`)
  await page.getByRole('spinbutton',{name:'PF di Mago 1',exact:true}).fill('37')
  await page.waitForFunction(()=>window.lastSaved.state.turns[0].hitPoints==='37')
  await page.getByRole('spinbutton',{name:'PF di Mago 1',exact:true}).press('p')
  assert.equal(await page.evaluate(()=>window.lastSaved.state.combat.activeId),4,'P inside a field must not advance the turn')
  const next=page.getByRole('button',{name:'Turno successivo \u2192',exact:true})
  await next.click();await page.waitForFunction(()=>window.lastSaved.state.combat.activeId===5)
  await page.mouse.click(1,1);await page.keyboard.press('p')
  await page.waitForFunction(()=>window.lastSaved.state.combat.activeId===6)
  await next.click();await page.waitForFunction(()=>window.lastSaved.state.combat.activeId===7)
  await next.click();await page.waitForFunction(()=>window.lastSaved.state.combat.round===2&&window.lastSaved.state.combat.activeId===0)
  const saved=await page.evaluate(()=>window.lastSaved)
  assert.equal(saved.state.abilities[0].remainingTurns,2,'A round boundary decrements the effect exactly once')
  assert.equal(saved.state.turns[0].hitPoints,'37','Cached row handlers preserve the latest HP and turn state')
  await page.evaluate(()=>{for(const flags of [{repeat:true},{isComposing:true}])window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',...flags}))})
  assert.equal(await page.evaluate(()=>window.lastSaved.state.combat.activeId),0)
  await page.mouse.click(1,1);await page.keyboard.press('p')
  const repeat=page.getByRole('dialog',{name:'Tiro salvezza di fine turno',exact:true})
  await repeat.waitFor({state:'visible'})
  await page.keyboard.press('p')
  assert.equal(await page.evaluate(()=>window.lastSaved.state.combat.activeId),0,'A pending end-turn saving throw blocks advancement')
  await repeat.getByRole('button',{name:'Chiudi tiro salvezza di fine turno',exact:true}).click()
  console.log(`PASS ${view}: four rapid presses, cached unrelated rows, latest HP edits, keyboard guards and one duration tick per round`)
  await cdp.detach()
 }
 assert.deepEqual(errors,[])
}finally{await browser.close();await frontend.close();assert(dir.startsWith(root+sep));await rm(dir,{recursive:true,force:true})}
