// Run: node tests/combat-packet-limits-ui.mjs (PLAYWRIGHT_CHANNEL=msedge uses installed Edge).
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {mkdir,mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {createServer} from 'vite'
import {createApp} from '../server/index.mjs'
import {combatRules} from '../server/combat-requests.mjs'
import {newCharacterSheet,turnFromSheet} from '../src/utils/CharacterSheets.ts'
import {templateFromCatalog} from '../src/utils/Catalog.ts'

const root=join(import.meta.dirname,'..','.test-runtime.local')
await mkdir(root,{recursive:true})
const dir=await mkdtemp(join(root,'packet-limits-'))
const server=(await createApp({dataDir:dir,production:false,sessionSecret:'packet-limits-test-secret-long-enough'})).listen(0,'127.0.0.1')
await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}})
await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})})
async function api(context,path,method='GET',data){const response=await context.request.fetch(base+'/api'+path,{method,data});assert(response.ok(),await response.text());return response.json()}
try {
    const master=await browser.newContext(),player=await browser.newContext({viewport:{width:1440,height:1000}})
    for(const [context,username] of [[master,'LimitsMaster'],[player,'LimitsPlayer']])await api(context,'/register','POST',{username,password:'packet-test-password'})
    const {catalog}=await combatRules(),spell=id=>templateFromCatalog(catalog.abilities.find(e=>e.data.referenceId==='phb2014:spell:'+id))
    const sheet={...newCharacterSheet(),name:'Maga limiti',characterClass:'Mago',level:'5',hitPoints:'30',armorClass:'12',abilities:['scorching-ray','magic-missile','fire-bolt','fireball'].map(spell),playerDetails:{spellAttackBonus:'5',spellDC:'13','slots.1.total':'4','slots.2.total':'3','slots.3.total':'3'}}
    let game=await api(master,'/play/games','POST',{name:'Limiti globali dei colpi'}),path='/play/games/'+game.id
    await api(player,'/play/invites/'+game.inviteToken+'/join','POST',{sheet})
    game=await api(master,path)
    const sheets=[sheet,...['Bersaglio A','Bersaglio B','Bersaglio C','Bersaglio D'].map(name=>({...newCharacterSheet(),name,kind:'PNG',hitPoints:'100',armorClass:'12'}))]
    await api(master,path+'/state','PUT',{revision:game.revision,sheets,state:{turns:sheets.map((s,id)=>turnFromSheet(s,id)),abilities:[],combat:{activeId:0,round:1}}})
    const page=await player.newPage(),errors=[]
    page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
    await page.goto(base+'/games/'+game.id)
    await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
    await page.getByRole('radio',{name:/^Rinnovata/}).check()
    await page.getByRole('button',{name:'Torna al tavolo',exact:true}).click()
    const inspector=page.getByRole('complementary',{name:'Azioni ed effetti del tuo personaggio',exact:true})
    for(const width of [1440,390])for(const id of ['scorching-ray','magic-missile']) {
        await page.setViewportSize({width,height:1000});await page.reload()
        await inspector.getByRole('button',{name:spell(id).name+' · Usa',exact:true}).click()
        const form=inspector.getByRole('form',{name:'Proposta: '+spell(id).name,exact:true})
        const target=name=>form.getByRole('checkbox',{name:'Bersaglio '+name,exact:true})
        const add=name=>form.getByRole('button',{name:'Aggiungi colpo a Bersaglio '+name,exact:true})
        await target('A').check();await add('A').click();await add('A').click()
        await form.getByText('Colpi assegnati: 3/3.',{exact:false}).waitFor()
        for(const name of ['B','C','D'])assert(await target(name).isDisabled(),'New targets must not bypass the total hit limit')
        assert(await add('A').isDisabled());assert(await target('A').isEnabled(),'Selected targets remain removable')
        assert.equal(await form.locator('.player-roll-packet').count(),3)
        await form.getByRole('button',{name:'Rimuovi colpo 2',exact:true}).click()
        assert(await target('B').isEnabled(),'Removing a hit restores one free hit')
        await target('B').check()
        assert(await target('C').isDisabled());assert(await add('A').isDisabled());assert(await add('B').isDisabled())
        await target('A').uncheck()
        assert.equal(await form.locator('.player-roll-packet').count(),1,'Deselecting a target releases all its hits')
        await target('A').check();await target('C').check()
        assert(await target('D').isDisabled(),'Three distinct targets also exhaust the shared budget')
        const resource=form.getByRole('combobox',{name:'Risorsa',exact:true})
        const baseSlot=id==='scorching-ray'?'slot:2':'slot:1',higherSlot=id==='scorching-ray'?'slot:3':'slot:2'
        await resource.selectOption(higherSlot)
        assert(await target('D').isEnabled(),'A higher slot provides one additional hit')
        await target('D').check();await form.getByText('Colpi assegnati: 4/4.',{exact:false}).waitFor()
        assert(await add('A').isDisabled())
        await resource.selectOption(baseSlot)
        assert.equal(await form.locator('.player-roll-packet').count(),3,'A lower slot removes excess hits immediately')
        assert(await target('D').isDisabled());assert(!await target('D').isChecked())
        assert(await add('A').isDisabled())
        if(id==='scorching-ray')for(const input of await form.getByLabel('Tiro per colpire (inserisci solo il numero del dado)',{exact:true}).all())await input.fill('15')
        for(const input of await form.getByLabel('Danni tirati',{exact:true}).all())await input.fill('6')
        const sent=page.waitForResponse(r=>r.url().endsWith('/requests')&&r.request().method()==='POST')
        await form.getByRole('button',{name:'Invia al Master',exact:true}).click()
        const response=await sent;assert(response.ok(),await response.text())
        game=await api(master,path)
        const pending=game.combatRequests.find(r=>r.status==='pending')
        assert.equal(pending.packets.length,3,'Only the allowed hits reach the server')
        await api(master,path+'/requests/'+pending.id+'/reject','POST',{revision:game.revision})
    }
    // Area spells have no shared hit cap: each selected creature keeps its damage packet.
    await page.reload();await inspector.getByRole('button',{name:spell('fireball').name+' · Usa',exact:true}).click()
    const area=inspector.getByRole('form',{name:'Proposta: '+spell('fireball').name,exact:true})
    for(const name of ['A','B','C','D'])await area.getByRole('checkbox',{name:'Bersaglio '+name,exact:true}).check()
    assert.equal(await area.getByLabel('Danni tirati',{exact:true}).count(),1)
    assert.deepEqual(errors,[])
    console.log('PASS global hit limits: Scorching Ray and Magic Missile; same/multiple targets, removal, slot changes, valid submission, unlimited area targets; desktop and mobile')
} finally {
    await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))
    // dir is created by mkdtemp directly inside this test runtime root.
    assert(dir.startsWith(root+join('/')))
    await rm(dir,{recursive:true,force:true})
}
