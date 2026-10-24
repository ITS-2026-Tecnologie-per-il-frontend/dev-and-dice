// Run: node tests/reaction-performance-ui.mjs
import assert from 'node:assert/strict'
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises'
import {join,resolve,basename} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {combatRules,actionContext,actionChoices} from '../server/combat-requests.mjs'
import {openReactions} from '../server/reactions.mjs'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'
const root=resolve(import.meta.dirname,'../.test-runtime.local');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'reaction-performance-'))
const rules=await combatRules(),spells=rules.catalog.abilities.filter(e=>typeof e.data.level==='number'),shield=spells.find(e=>e.data.referenceId==='phb2014:spell:shield')
const abilities=[...spells.filter(e=>e!==shield).slice(0,39),shield].map(templateFromCatalog)
const db={characters:Array.from({length:8},(_,i)=>({id:'character-'+i,ownerId:'master',gameId:'game',sheet:{...newCharacterSheet(),id:'character-'+i,name:'Mago '+i,characterClass:'Mago',level:'9',intelligence:'18',hitPoints:'40',armorClass:'14',abilities,playerDetails:{'slots.1.total':'4','slots.2.total':'3','slots.3.total':'3','slots.4.total':'3','slots.5.total':'1'}}}))}
const game={id:'game',masterId:'master',role:'master',characters:db.characters,players:[],revision:1,requestsRevision:1,combatRequests:[],state:{turns:db.characters.map((r,id)=>({id,sheet:r.sheet,description:r.sheet.name})),abilities:[],combat:{activeId:0,round:1}}}
openReactions(db,game,rules,{kind:'hit',label:'Attacco in arrivo',targetIds:game.state.turns.map(t=>t.id),actorId:99})
assert.equal(game.reactionWindows.length,8)
assert(game.reactionWindows.every(w=>w.actionKeys.every(key=>key!=='0')),'The fixture exercises canonical keys after unrelated abilities')
const choices={}
for(const window of game.reactionWindows){
 const full=actionContext(db,game,window.ownerId,rules,true,window.characterId)
 const reactions=actionContext(db,game,window.ownerId,rules,true,window.characterId,{unit:'reaction'})
 assert.deepEqual(reactions.actions,full.actions.filter(a=>a.info.unit==='reaction'),'Early filtering preserves canonical keys, resource errors and resolution plans')
 const expected=actionChoices({...full,actions:full.actions.filter(a=>window.actionKeys.includes(a.key))},game,db)
 const selected=actionContext(db,game,window.ownerId,rules,true,window.characterId,{keys:new Set(window.actionKeys)})
 assert.deepEqual(actionChoices(selected,game,db),expected,'Only requested reactions are prepared with identical choices')
 choices[window.id]=expected
}
game.reactionWindows=game.reactionWindows.map(w=>({...w,serverNow:Date.now()}))
const frontend=await createServer({plugins:[{name:'count-reaction-form-renders',enforce:'pre',transform(code,id){
 if(!id.replaceAll(String.fromCharCode(92),'/').endsWith('/src/components/CombatRolls.tsx'))return
 return code.replace("    const [optionId,setOptionId]",'    globalThis.reactionFormRenders=(globalThis.reactionFormRenders??0)+1;\n    const [optionId,setOptionId]')
}}],logLevel:'error',server:{host:'127.0.0.1',port:0}});await frontend.listen()
await writeFile(join(dir,'entry.mjs'),`import React,{useState,useContext,memo}from'react';import{createRoot}from'react-dom/client';import{ReactionProvider}from'/src/components/ReactionPrompt.tsx';import{ReactionContext}from'/src/components/ReactionContext.ts';import'/src/index.css';import'/src/App.css';import'/src/PlayPages.css';import'/src/Theme.css';
const initial=${JSON.stringify(game)};const Probe=memo(function(){const {paused}=useContext(ReactionContext);window.probeRenders=(window.probeRenders??0)+1;return React.createElement('p',null,paused?'In pausa':'In gioco')});const child=React.createElement(Probe);
function Check(){const role=new URLSearchParams(location.search).get('role');const [game,setGame]=useState({...initial,role,reactionWindows:[]});window.refreshReaction=()=>setGame(g=>({...g,requestsRevision:g.requestsRevision+1,reactionWindows:g.reactionWindows.map(w=>({...w,serverNow:Date.now()}))}));return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>{window.openStarted=performance.now();setGame(g=>({...g,reactionWindows:(role==='master'?initial.reactionWindows:initial.reactionWindows.slice(0,1)).map(w=>({...w,expiresAt:Date.now()+30000,serverNow:Date.now()}))}));}},'Apri finestre'),React.createElement(ReactionProvider,{game,onUpdate:setGame,disabled:false,userId:'master'},child))}createRoot(document.getElementById('root')).render(React.createElement(Check));`)
const html=await frontend.transformIndexHtml('/reaction-performance',`<div id="root"></div><script type="module" src="/.test-runtime.local/${basename(dir)}/entry.mjs"></script>`)
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000)
let requests=0
await page.route('**/api/play/games/game/reactions/*/actions',route=>{requests++;return route.fulfill({json:choices[route.request().url().split('/').at(-2)]})})
await page.route('**/reaction-performance*',route=>route.fulfill({contentType:'text/html',body:html}))
try{
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
 for(const role of ['master','player']){
  requests=0
  await page.goto(`http://127.0.0.1:${frontend.httpServer.address().port}/reaction-performance?role=${role}`)
  await page.getByText('In gioco',{exact:true}).waitFor()
  await page.evaluate(()=>{window.reactionFormRenders=0;window.probeRenders=0})
  await page.getByRole('button',{name:'Apri finestre',exact:true}).click()
  const surface=role==='master'?page.locator('.reaction-master-panels'):page.getByRole('dialog',{name:'Puoi usare una reazione',exact:true})
  await surface.waitFor()
  const opening=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(Math.round(performance.now()-window.openStarted))))))
  if(role==='master'){
   assert.equal(await page.locator('.reaction-master-panel').count(),8)
   assert.equal(requests,0,'Closed Master panels must not request every character action list')
   assert.equal(await page.getByRole('form',{includeHidden:true}).count(),0,'Closed Master panels must not mount hidden roll forms')
   await page.getByRole('button',{name:'Apri reazione \u00b7 Mago 0',exact:true}).click()
  }
  const form=page.getByRole('form',{name:'Reazione: Scudo',exact:true});await form.waitFor()
  assert.equal(requests,1,'Only the visible reaction loads its choices')
  const renders=await page.evaluate(()=>window.reactionFormRenders)
  const tick=await surface.getByRole('timer').first().innerText()
  await page.waitForFunction(old=>document.querySelector('[role="timer"]').textContent!==old,tick)
  assert.equal(await page.evaluate(()=>window.reactionFormRenders),renders,'The countdown must not rerender the roll form')
  const probes=await page.evaluate(()=>window.probeRenders)
  await page.evaluate(()=>window.refreshReaction())
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(()=>window.probeRenders),probes,'Polling reaction activity must not broadcast a new combat context')
  assert.equal(await page.evaluate(()=>window.reactionFormRenders),renders,'Polling must preserve the unchanged roll form')
  assert.equal(requests,1,'An unchanged game revision must not refetch reaction choices')
  if(role==='master'){
   // Programmatic selection avoids renewing the isolated fixture through an activity API.
   await form.getByRole('combobox',{name:'Risorsa',exact:true}).evaluate(select=>{select.value='slot:2';select.dispatchEvent(new Event('change',{bubbles:true}))})
   await page.getByRole('button',{name:'Chiudi reazione \u00b7 Mago 0',exact:true}).click()
   await page.getByRole('button',{name:'Apri reazione \u00b7 Mago 0',exact:true}).click()
   assert.equal(await form.getByRole('combobox',{name:'Risorsa',exact:true}).inputValue(),'slot:2','Collapsing keeps the selected spell slot')
  }
  console.log(`PASS ${role}: ${opening} ms to paint (4x CPU), one visible form, stable countdown and polling`)
 }
 assert.deepEqual(errors,[])
}finally{await browser.close();await frontend.close();await rm(dir,{recursive:true,force:true})}
