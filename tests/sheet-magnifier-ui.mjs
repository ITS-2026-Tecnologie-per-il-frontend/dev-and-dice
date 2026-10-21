// Run: node tests/sheet-magnifier-ui.mjs; set PLAYWRIGHT_CHANNEL=msedge for installed Edge.
import assert from 'node:assert/strict'
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join,relative,isAbsolute} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'

const root=join(import.meta.dirname,'..'),runtime=join(root,'.test-runtime.local')
await mkdir(runtime,{recursive:true})
const dir=await mkdtemp(join(runtime,'sheet-magnifier-'))
await writeFile(join(dir,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>')
await writeFile(join(dir,'fixture.jsx'),`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{PlayerSheet}from'/src/components/PlayerSheet.tsx';import{newCharacterSheet}from'/src/utils/CharacterSheets.ts';import{ThemeProvider}from'/src/theme/ThemeProvider.tsx';import'/src/PlayPages.css';
function Fixture(){const[sheet,setSheet]=useState({...newCharacterSheet(),name:'Mira lente',characterClass:'Mago',level:'5',hitPoints:'30',armorClass:'12',playerDetails:{'sheet.template':'wizard-pdf',playerName:'Valore attuale'}});return <><style>{'body{margin:16px;--bg:#fff;--text:#444;--text-h:#111;--border:#ccc}main{width:700px;max-width:100%}dialog{width:750px;max-width:calc(100% - 64px);height:80vh;overflow:auto}button{min-height:44px}'}</style><button onClick={()=>document.getElementById('magnifier-fixture-dialog').showModal()}>Apri finestra</button><main><PlayerSheet sheet={sheet} onChange={setSheet} settingsInDialog/></main><dialog id="magnifier-fixture-dialog" aria-label="Scheda nella finestra"><button onClick={()=>document.getElementById('magnifier-fixture-dialog').close()}>Chiudi finestra</button><PlayerSheet sheet={sheet} onChange={setSheet} settingsInDialog/></dialog></>};createRoot(document.getElementById('root')).render(<ThemeProvider><Fixture/></ThemeProvider>);
`)
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0}})
await frontend.listen()
let browser
try{
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})})
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
    page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`http://127.0.0.1:${frontend.httpServer.address().port}/${relative(root,dir).replaceAll('\\','/')}/index.html`,{waitUntil:'domcontentloaded',timeout:30000})
    const source=page.locator('main .player-paper'),lens=page.locator('.sheet-magnifier')
    const name=source.getByRole('textbox',{name:'Nome del personaggio',exact:true})
    await name.fill('Mira aggiornata')
    await page.waitForFunction(()=>{const p=document.querySelector('main .player-paper');return p&&p.getBoundingClientRect().width<p.offsetWidth})
    async function hold(target=name){
        await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();const point={x:box.x+Math.min(30,box.width/2),y:box.y+box.height/2}
        await page.mouse.move(point.x,point.y);await page.mouse.down({button:'right'});await lens.waitFor({state:'visible'});await page.waitForTimeout(350);return point
    }
    async function gone(){await lens.waitFor({state:'detached'})}
    await name.click();assert.equal(await lens.count(),0,'Normal left clicks keep editing unchanged')
    const point=await hold()
    assert.equal(await lens.locator('input').first().inputValue(),'Mira aggiornata','The lens reads live input values')
    assert.equal(await lens.getAttribute('aria-hidden'),'true')
    assert(await lens.evaluate(e=>e.inert&&getComputedStyle(e).pointerEvents==='none'),'The snapshot cannot edit or intercept the source')
    assert.equal(await lens.locator('[id],[name]').count(),0,'The snapshot introduces no duplicate IDs or form names')
    const first=await lens.boundingBox()
    assert(first.width>=480&&first.height>=360,'The enlarged lens provides a wider viewing area')
    await page.mouse.move(point.x+60,point.y+40)
    await page.waitForFunction(x=>Math.abs(document.querySelector('.sheet-magnifier').getBoundingClientRect().x-x-60)<1,first.x)
    const geometry=await page.evaluate(()=>{
        const source=document.querySelector('main .player-paper'),copy=document.querySelector('.sheet-magnifier-content')
        return {ratio:copy.getBoundingClientRect().width/source.getBoundingClientRect().width,viewport:innerWidth,right:document.querySelector('.sheet-magnifier').getBoundingClientRect().right}
    })
    assert(Math.abs(geometry.ratio-2)<0.01,'The zoom accounts for the fitted sheet scale')
    assert(geometry.right<=geometry.viewport)
    await page.screenshot({path:join(runtime,'sheet-magnifier-desktop.png')})
    await page.mouse.up({button:'right'});await gone()
    await name.click({button:'right'})
    await lens.waitFor({state:'visible'})
    const pinnedPosition=await lens.boundingBox(),nameBox=await name.boundingBox()
    await page.mouse.move(nameBox.x+nameBox.width/2+40,nameBox.y+nameBox.height/2+20)
    await page.waitForFunction(x=>Math.abs(document.querySelector('.sheet-magnifier').getBoundingClientRect().x-x-40)<1,pinnedPosition.x)
    assert(await lens.isVisible(),'A short click keeps the lens open while moving without buttons held')
    await page.mouse.move(1400,900)
    assert(await lens.isVisible(),'The pinned lens stays open when leaving the sheet')
    await name.click({button:'right'});await gone()
    await page.mouse.move(nameBox.x+50,nameBox.y+5)
    assert.equal(await lens.count(),0,'The second right click closes the lens until explicitly reopened')
    await hold();await page.keyboard.press('Escape');await gone();await page.mouse.up({button:'right'})
    await hold();await page.mouse.move(1400,900);await gone();await page.mouse.up({button:'right'})
    await hold();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await gone();await page.mouse.up({button:'right'})
    await hold();await page.getByRole('tab',{name:/^2\./}).filter({visible:true}).first().focus();await page.keyboard.press('ArrowRight');await gone();await page.mouse.up({button:'right'})
    await page.locator('main').getByRole('tab').first().click()
    await page.getByRole('button',{name:'Apri finestra',exact:true}).click()
    const dialog=page.getByRole('dialog',{name:'Scheda nella finestra',exact:true}),dialogName=dialog.getByRole('textbox',{name:'Nome del personaggio',exact:true})
    await hold(dialogName)
    assert(await lens.evaluate(e=>e.matches(':popover-open')&&!!e.closest('dialog[open]')),'The lens remains visible in the native dialog top layer')
    await page.keyboard.press('Escape');await gone();assert(await dialog.isVisible(),'Closing the lens preserves the character dialog')
    await page.mouse.up({button:'right'});await dialog.getByRole('button',{name:'Chiudi finestra',exact:true}).click()
    await page.setViewportSize({width:800,height:650})
    await hold();await page.screenshot({path:join(runtime,'sheet-magnifier-unscaled.png')});await page.mouse.up({button:'right'});await gone()
    assert.equal(await name.inputValue(),'Mira aggiornata','Magnifying never modifies the original data')
    assert.deepEqual(errors,[])
    console.log('PASS sheet magnifier: enlarged window, right-click toggle and held-button modes, live values, 2x fitted scale, cursor tracking, release/outside/Escape/blur/page cleanup, native dialogs and unscaled sheets; no edits or duplicate IDs')
}finally{
    await browser?.close();await frontend.close()
    const target=relative(runtime,dir);assert(target&&!target.startsWith('..')&&!isAbsolute(target))
    await rm(dir,{recursive:true,force:true})
}
