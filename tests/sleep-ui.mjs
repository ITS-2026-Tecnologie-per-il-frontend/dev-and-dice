// Run: node tests/sleep-ui.mjs — isolated browser check of the player's Sleep form.
import assert from 'node:assert/strict'
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {newCharacterSheet} from '../src/utils/CharacterSheets.ts'
const root=join(import.meta.dirname,'..','.test-runtime.local');await mkdir(root,{recursive:true})
const dir=await mkdtemp(join(root,'sleep-ui-')),frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0}});await frontend.listen()
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:400,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
try{
 const game={id:crypto.randomUUID(),role:'player',revision:1,requestsRevision:0,combatRequests:[],character:{sheet:{...newCharacterSheet(),name:'Maga'}}}
 const choices={revision:1,canPropose:true,ownerId:0,targets:[{id:0,name:'Maga'},{id:1,name:'Goblin'},{id:2,name:'Baldur'},{id:3,name:'Worg'},{id:4,name:'Zombie'}],actions:[{key:'0',name:'Sonno',entry:{id:'sleep',data:{edition:'2014',referenceId:'phb2014:spell:sleep'}},description:'Sonno magico',group:'Incantesimi',spellLevel:1,duration:'1 minuto',remainingTurns:10,active:false,cost:1,mode:'automatic',damageEnabled:true,options:[1,2,3].map(level=>({id:`slot:${level}`,label:`Slot ${level}`,cost:1,remaining:3,targeting:{kind:'area',maximum:null}})),sleepTargets:[{id:0,hitPoints:30},{id:1,hitPoints:6},{id:2,hitPoints:13},{id:3,hitPoints:18},{id:4,hitPoints:2,unavailableReason:'I non morti non sono influenzati da Sonno.'}]}]}
 await page.route('**/api/play/games/*/actions*',route=>route.fulfill({json:choices}))
 let proposal
 await page.route('**/api/play/games/*/requests',async route=>{proposal=route.request().postDataJSON();await route.fulfill({json:game})})
 const entry=join(dir,'check.mjs')
 await writeFile(entry,`import React from'react';import{createRoot}from'react-dom/client';import{PlayerCombatActions}from'/src/components/CombatRequests.tsx';import'/src/index.css';import'/src/App.css';import'/src/PlayPages.css';createRoot(document.getElementById('root')).render(React.createElement(PlayerCombatActions,{game:${JSON.stringify(game)},renewed:true,onUpdate:()=>{}}));`)
 const html=await frontend.transformIndexHtml('/sleep-check',`<main class="play-player-page player-page-renewed"><aside class="play-player-sidebar"><div id="root"></div></aside></main><script type="module" src="/${relative(join(import.meta.dirname,'..'),entry)}"></script>`)
 await page.route('**/sleep-check',route=>route.fulfill({contentType:'text/html',body:html}))
 await page.goto(`http://127.0.0.1:${frontend.httpServer.address().port}/sleep-check`)
 await page.getByRole('button',{name:'Sonno · Usa',exact:true}).click()
 const roll=page.getByLabel('Sonno · tira 5d8 e inserisci la somma'),group=page.getByRole('group',{name:'Bersagli di Sonno',exact:true})
 await roll.waitFor()
 assert(await group.getByRole('checkbox',{name:/Goblin/}).isDisabled())
 assert(await page.getByRole('button',{name:'Invia al Master',exact:true}).isDisabled())
 assert.equal(await page.getByLabel('Risoluzione',{exact:true}).count(),0)
 await roll.fill('4');assert(await group.getByRole('checkbox',{name:/Goblin/}).isDisabled())
 await roll.fill('22')
 assert(await group.getByRole('checkbox',{name:/Maga/}).isDisabled())
 assert(await group.getByRole('checkbox',{name:/Zombie/}).isDisabled())
 await group.getByRole('checkbox',{name:/Goblin/}).check()
 assert(await group.getByRole('checkbox',{name:/Worg/}).isDisabled())
 await group.getByRole('checkbox',{name:/Baldur/}).check()
 await page.getByText('Riserva: 22 PF · utilizzati: 19 · restanti: 3 PF',{exact:true}).waitFor()
 await group.getByRole('checkbox',{name:/Goblin/}).uncheck()
 assert(await group.getByRole('checkbox',{name:/Goblin/}).isEnabled())
 await page.getByLabel('Risorsa',{exact:true}).selectOption('slot:2')
 const second=page.getByLabel('Sonno · tira 7d8 e inserisci la somma')
 assert.equal(await second.inputValue(),'')
 assert.equal(await group.getByRole('checkbox',{checked:true}).count(),0)
 await second.fill('56');assert(await group.getByRole('checkbox',{name:/Maga/}).isEnabled())
 await page.getByLabel('Risorsa',{exact:true}).selectOption('slot:3')
 await page.getByLabel('Sonno · tira 9d8 e inserisci la somma').fill('22')
 await group.getByRole('checkbox',{name:/Goblin/}).check()
 await group.getByRole('checkbox',{name:/Baldur/}).check()
 await page.screenshot({path:join(root,'sleep-player-mobile.png'),fullPage:true})
 await page.getByRole('button',{name:'Invia al Master',exact:true}).click()
 await page.waitForFunction(()=>!document.querySelector('#player-sleep-total'))
 assert.equal(proposal.sleepRoll,22);assert.equal(proposal.option,'slot:3');assert.equal(proposal.mode,'none');assert.equal(proposal.damageEnabled,false)
 assert.deepEqual(proposal.targets.map(t=>t.id),[1,2]);assert.deepEqual(errors,[])
 console.log('PASS Sleep player UI: slot scaling, bounds, disabled targets, shared budget, deselection, reset and submitted dice')
}finally{await page.unrouteAll({behavior:'wait'});await browser.close();await frontend.close();await rm(dir,{recursive:true,force:true})}
