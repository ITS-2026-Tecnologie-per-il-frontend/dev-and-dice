import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'
import { newCharacterSheet, parseCharacterSheets } from '../src/utils/CharacterSheets.ts'
import { playerTemplate } from '../src/utils/PlayerTemplates.ts'
import { characterFieldValue } from '../src/utils/PlayerCreation.ts'
import { playerBarbarianCharacter, updatePlayerBarbarian } from '../src/barbarian/player.ts'
const layouts = await Promise.all([1,2,3].map(async n=>JSON.parse(await readFile(new URL(`../src/barbarian/page${n}.json`,import.meta.url),'utf8'))))
let sheet = {...newCharacterSheet(),name:'Barbaro QA',characterClass:'Barbaro',level:'5',hitPoints:'20',strength:'14',dexterity:'12',constitution:'14',intelligence:'10',wisdom:'10',charisma:'10'}
assert.equal(playerTemplate(sheet),'barbarian-pdf')
assert.equal(playerTemplate({...sheet,characterClass:' barbarian '}),'barbarian-pdf')
assert.equal(playerTemplate({...sheet,characterClass:'Personalizzata',playerDetails:{'creation.class':'barbarian'}}),'barbarian-pdf')
assert.equal(playerTemplate({...sheet,playerDetails:{'sheet.template':'generic'}}),'generic')
assert.equal(playerTemplate({...sheet,characterClass:'Guerriero',playerDetails:{'sheet.template':'barbarian-pdf'}}),'generic')
const field = id => layouts.flatMap(p=>p.fields).find(f=>`${f.group}.${f.key}`===id)
const edit = (id,value) => {sheet=updatePlayerBarbarian(sheet,field(id),value)}
edit('abilities.strength','18');assert.equal(sheet.strength,'18');assert.equal(playerBarbarianCharacter(sheet,layouts).abilities.strengthModifier,'+4')
edit('checks.skill.Atletica',true);assert.equal(sheet.playerDetails['skill.Atletica.proficient'],'true')
edit('equipment.bag.0.name','Corda');edit('equipment.bag.0.quantity','2');assert.equal(sheet.playerDetails['inventory.0.2'],'2')
edit('equipment.slot.Testa.name','Elmo del clan');edit('equipment.slot.Testa.description','Piume rosse');edit('checks.slot.Testa.active',true)
assert.equal(characterFieldValue(sheet,'worn.Testa'),'Elmo del clan');assert.equal(playerBarbarianCharacter(sheet,layouts).checks['slot.Testa.active'],true)
edit('features.path.0','Totem del lupo');assert(sheet.playerDetails.classFeatures.includes('(livello 3)'))
edit('checks.exhaustion.3',true);assert.equal(sheet.playerDetails.exhaustion,'3')
assert.deepEqual(parseCharacterSheets(JSON.stringify([sheet]))[0],sheet)
const fighter={...newCharacterSheet(),name:'Guerriero QA',characterClass:'Guerriero',level:'1'}
const browser=await chromium.launch({headless:true})
try {
 const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/me',r=>r.fulfill({json:{user:{id:'template-test',username:'Template QA'}}}))
 await page.addInitScript(sheets=>{if(!localStorage.getItem('dev-and-dice.character-sheets.v1')) localStorage.setItem('dev-and-dice.character-sheets.v1',JSON.stringify(sheets))},[sheet,fighter])
 await page.goto(process.env.BARBARIAN_URL ?? 'http://localhost:5173/trackers')
 await page.getByRole('button',{name:'Apri scheda di Barbaro QA',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Barbaro QA',exact:true}),picker=dialog.getByLabel('Modello della scheda')
 await dialog.locator('[data-page="1"]').waitFor();assert.equal(await picker.locator('option[value="barbarian-pdf"]').count(),1)
 await dialog.getByRole('spinbutton',{name:'Forza',exact:true}).fill('19')
 await picker.selectOption('generic');assert.equal(await dialog.getByRole('spinbutton',{name:'Forza',exact:true}).inputValue(),'19')
 await picker.selectOption('barbarian-pdf');await dialog.locator('[data-page="1"]').waitFor()
 await dialog.getByRole('tab',{name:'3. Equipaggiamento indossato',exact:true}).click()
 assert.equal(await dialog.getByRole('textbox',{name:'Nome slot Testa',exact:true}).inputValue(),'Elmo del clan')
 await dialog.getByRole('textbox',{name:'Descrizione slot Testa',exact:true}).fill('Acciaio del clan')
 assert(await dialog.getByRole('checkbox',{name:'Attivo slot Testa',exact:true}).isChecked())
 await dialog.getByRole('button',{name:'Salva scheda',exact:true}).click()
 await page.reload();await page.getByRole('button',{name:'Apri scheda di Barbaro QA',exact:true}).click();await dialog.locator('[data-page="1"]').waitFor()
 assert.equal(await picker.inputValue(),'barbarian-pdf');assert.equal(await dialog.getByRole('spinbutton',{name:'Forza',exact:true}).inputValue(),'19')
 await dialog.getByRole('tab',{name:'3. Equipaggiamento indossato',exact:true}).click();assert.equal(await dialog.getByRole('textbox',{name:'Descrizione slot Testa',exact:true}).inputValue(),'Acciaio del clan')
 // Intercept only the native print dialog; retain the real export preparation pipeline.
 await page.addInitScript(()=>{window.print=()=>{}})
 await dialog.getByRole('button',{name:'Esporta scheda in PDF',exact:true}).click()
 await page.locator('.character-print-frame').waitFor()
 const frame=page.frames().find(f=>f.parentFrame()), result=await frame.waitForFunction(()=>document.querySelectorAll('.barbarian-page').length===3 && !document.querySelector('input,textarea,select'))
 await result.dispose();assert.equal(await frame.locator('.barbarian-page').count(),3)
 assert((await frame.locator('body').textContent()).includes('Elmo del clan'))
 const output=new URL('../.pdf-fidelity/barbaro/',import.meta.url).pathname;await mkdir(output,{recursive:true})
 await dialog.screenshot({path:`${output}player-template.png`})
 // Print the isolated document with its original named page formats.
 const printPage=await context.newPage();await printPage.goto('http://localhost:5173/');await printPage.setContent(await frame.content());await printPage.evaluate(()=>document.fonts.ready)

 await printPage.pdf({path:`${output}player-template.pdf`,preferCSSPageSize:true,printBackground:true})
 execFileSync('python3',['-c',`import fitz,sys
p=fitz.open(sys.argv[1]);assert len(p)==3,len(p)
for i,page in enumerate(p):
 assert abs(page.rect.width-595.2)<.5 and abs(page.rect.height-[841.92,841.92,793.68][i])<.5
 assert 'Barbaro QA' in page.get_text() and len(page.get_images())==0
assert 'Elmo del clan' in p[2].get_text()
pix=p[2].get_pixmap(matrix=fitz.Matrix(4,4),clip=fitz.Rect(530,93,535,98));assert sum(pix.samples)/len(pix.samples)<160`,`${output}player-template.pdf`])
 await dialog.getByRole('button',{name:'Chiudi scheda',exact:true}).click();await page.getByRole('button',{name:'Apri scheda di Guerriero QA',exact:true}).click()
 assert.equal(await page.getByLabel('Modello della scheda').locator('option[value="barbarian-pdf"]').count(),0)
 assert.deepEqual(errors,[])
 console.log('PASS: Barbarian class gating, shared stats/inventory/slots, template switch, save/reload, real three-page export, original print dimensions and checked marker.')
} finally {await browser.close()}
