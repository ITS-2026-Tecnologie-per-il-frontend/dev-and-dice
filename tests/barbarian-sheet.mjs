import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { emptyCharacter, parseCharacter } from '../src/barbarian/model.ts'
const pages = await Promise.all([1,2,3].map(async n => JSON.parse(await readFile(new URL(`../src/barbarian/page${n}.json`,import.meta.url),'utf8'))))
const output = new URL('../.pdf-fidelity/barbaro/',import.meta.url).pathname
await mkdir(output,{recursive:true})
const empty = emptyCharacter(pages)
assert.deepEqual(parseCharacter(JSON.stringify(empty),pages),empty)
for (const patch of [{version:2},{checks:{...empty.checks, 'save.strength':'true'}},{abilities:{...empty.abilities,strength:'31'}},{combat:{...empty.combat,hitDice:'d20'}},{combat:{...empty.combat,currentHP:'NaN'}},{combat:{...empty.combat,currentHP:'  '}},{appearance:{...empty.appearance,age:'0xFF'}}]) assert.throws(()=>parseCharacter(JSON.stringify({...empty,...patch}),pages))
for (const data of pages) {
 const keys=data.fields.map(f=>`${f.group}.${f.key}`)
 assert.equal(new Set(keys).size,keys.length)
 for (const field of data.fields) { const [x,y,w,h]=field.box;assert(x>=0 && y>=0 && w>0 && h>0 && x+w<=data.width && y+h<=data.height,`${field.label} must fit`) }
 for (const ornament of data.ornaments) {
  const svg=await readFile(new URL(`../public${ornament.src}`,import.meta.url),'utf8')
  assert(!/<(?:image|text)\b/i.test(svg),'SVG ornaments must contain geometry only')
 }
}
const browser=await chromium.launch({headless:true})
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 const page=await context.newPage()
 page.setDefaultTimeout(5000)
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto(process.env.BARBARIAN_URL ?? 'http://127.0.0.1:5174/schede/barbaro')
 await page.locator('[data-page="3"]').waitFor()
 await page.locator('[data-page="1"]').getByRole('textbox',{name:'Nome del personaggio',exact:true}).fill('Conan')
 await page.getByRole('spinbutton',{name:'Forza',exact:true}).fill('18')
 await page.getByRole('textbox',{name:'Tratti caratteriali',exact:true}).fill('Coraggioso.\nProteggo il clan.')
 await page.getByRole('textbox',{name:'Nome oggetto magico 1',exact:true}).fill('Ascia del tuono')
 await page.getByRole('spinbutton',{name:'Quantità nello zaino 1',exact:true}).fill('2')
 // Exercise every visible field through user input, including reversibility for all toggles.
 for (const layout of pages) { for (const field of layout.fields) {
  const locator=page.locator(`[data-field=${JSON.stringify(`${field.group}.${field.key}`)}]`).first()
  if (field.kind==='checkbox') {await locator.check();assert(await locator.isChecked());await locator.uncheck();assert(!await locator.isChecked())}
  else if (field.kind==='select') {await locator.selectOption(field.options[0]);await locator.selectOption(field.initial)}
  else {const old=await locator.inputValue();await locator.fill(field.kind==='number'?String(field.min??1):'Prova');assert.equal(await locator.inputValue(),field.kind==='number'?String(field.min??1):'Prova');await locator.fill(old)}
 }
 console.log(`Checked page ${pages.indexOf(layout)+1}: ${layout.fields.length} controls`)}
 await page.getByRole('textbox',{name:'Nome slot Testa',exact:true}).fill('Elmo del clan')
 await page.getByRole('checkbox',{name:'Attivo slot Testa',exact:true}).check()
 await page.getByRole('button',{name:'Salva',exact:true}).click();await page.reload();await page.locator('[data-page="3"]').waitFor()
 assert.equal(await page.getByRole('spinbutton',{name:'Forza',exact:true}).inputValue(),'18')
 assert.equal(await page.getByRole('textbox',{name:'Nome slot Testa',exact:true}).inputValue(),'Elmo del clan')
 assert(await page.getByRole('checkbox',{name:'Attivo slot Testa',exact:true}).isChecked())
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Esporta JSON',exact:true}).click();const download=await downloadEvent;await download.saveAs(`${output}character-roundtrip.json`)
 const exported=JSON.parse(await readFile(`${output}character-roundtrip.json`,'utf8'));assert.equal(exported.identity.name,'Conan');assert.equal(exported.equipment['slot.Testa.name'],'Elmo del clan')
 await page.getByRole('button',{name:'Carica JSON',exact:true}).click().catch(()=>{})
 await page.locator('input[type="file"]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')})
 await page.getByRole('status').filter({hasText:'non è stata modificata'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Nome slot Testa',exact:true}).inputValue(),'Elmo del clan')
 await page.locator('input[type="file"]').setInputFiles({name:'version.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});await page.getByRole('status').filter({hasText:'non è stata modificata'}).waitFor()
 await page.locator('input[type="file"]').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.alloc(2_000_001)});await page.getByRole('status').filter({hasText:'2 MB'}).waitFor()
 await page.locator('input[type="file"]').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.getByRole('status').filter({hasText:'JSON caricato'}).waitFor()
 // Print must not silently cut off a long description.
 await page.getByRole('textbox',{name:'Descrizione slot Testa',exact:true}).fill('Una descrizione molto lunga '.repeat(200))
 await page.getByRole('button',{name:'Stampa / PDF',exact:true}).click();await page.getByRole('status').filter({hasText:'supera lo spazio'}).waitFor()
 await page.getByRole('textbox',{name:'Descrizione slot Testa',exact:true}).fill('Acciaio, piume rosse.')
 // Use the actual toolbar print button; inspect an intercepted browser print call.
 await page.evaluate(()=>{window.print=()=>{document.body.dataset.printInvoked='true'}})
 await page.getByRole('button',{name:'Stampa / PDF',exact:true}).click();assert.equal(await page.locator('body').getAttribute('data-print-invoked'),'true');await page.getByRole('status').filter({hasText:'pronta per la stampa'}).waitFor()
 await page.getByRole('combobox',{name:'Zoom della scheda'}).selectOption('2');assert(Math.abs((await page.locator('[data-page="1"]').boundingBox()).width-1190.4)<1);await page.getByRole('combobox',{name:'Zoom della scheda'}).selectOption('fit')
 await page.mouse.move(0,0);await page.screenshot({path:`${output}desktop-filled.png`})
 await page.emulateMedia({media:'print'});assert.notEqual(await page.getByRole('checkbox',{name:'Attivo slot Testa',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','Checked equipment must remain visible in print');await page.emulateMedia({media:null})
 await page.pdf({path:`${output}barbaro-filled.pdf`,preferCSSPageSize:true,printBackground:true})
 await page.setViewportSize({width:390,height:844});await page.pdf({path:`${output}barbaro-mobile-print.pdf`,preferCSSPageSize:true,printBackground:true});await page.screenshot({path:`${output}mobile-filled.png`})
 const fit=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,toolbar:document.querySelector('.barbarian-toolbar').getBoundingClientRect().right}))
 assert(fit.width<=fit.viewport && fit.toolbar<=fit.viewport,'Mobile view must not overflow horizontally')
 assert.deepEqual(errors,[])
 execFileSync('python3',['-c',`import fitz, sys
for path in sys.argv[1:]:
 doc=fitz.open(path)
 assert len(doc)==3, (path,len(doc))
 for i,p in enumerate(doc):
  assert abs(p.rect.width-595.2)<.5 and abs(p.rect.height-([841.92,841.92,793.68][i]))<.5
  assert 'Conan' in p.get_text() and 'Esporta JSON' not in p.get_text() and len(p.get_images())==0
 pix=doc[2].get_pixmap(matrix=fitz.Matrix(4,4),clip=fitz.Rect(530,93,535,98))
 assert sum(pix.samples)/len(pix.samples)<160, 'Active equipment marker missing from PDF'`,`${output}barbaro-filled.pdf`,`${output}barbaro-mobile-print.pdf`])
 // Fresh context: exact 144-DPI screenshots of the unfilled PDF replica.
 const visual=await browser.newContext({viewport:{width:1191,height:1684}});const vp=await visual.newPage()
 await vp.goto(process.env.BARBARIAN_URL ?? 'http://127.0.0.1:5174/schede/barbaro');await vp.locator('[data-page="3"]').waitFor()
 for (let index=0;index<3;index++) {
  const height=Math.ceil(pages[index].height*2);await vp.setViewportSize({width:1191,height})
  await vp.reload();await vp.locator('[data-page="3"]').waitFor()
  await vp.addStyleTag({content:`.barbarian-toolbar{display:none}.barbarian-document{padding:0;display:block}.barbarian-page-slot{display:none;width:1191px!important;height:${height}px!important;box-shadow:none;margin:0!important}.barbarian-page-slot:has([data-page="${index+1}"]){display:block}.barbarian-scale{transform:scale(2)!important}`})
  await vp.mouse.move(1190,height-1);await vp.screenshot({path:`${output}page-${String(index+1).padStart(3,'0')}-html.png`})
 }
 await visual.close();await context.close()
 console.log(`PASS: ${pages.flatMap(p=>p.fields).length} controls, all checkbox cycles, JSON roundtrip/rejection, persistence, print/overflow, mobile, three visual baselines. No renderer errors.`)
} finally {await browser.close()}
