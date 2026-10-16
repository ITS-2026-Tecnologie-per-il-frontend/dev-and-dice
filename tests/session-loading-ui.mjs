// Run: node tests/session-loading-ui.mjs — stalled HTTP headers/body, retry, saved player session.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer as httpServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { createApp } from '../server/index.mjs'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'

const dataDir=await mkdtemp(join(tmpdir(),'dev-and-dice-loading-'))
const app=await createApp({dataDir,production:false,sessionSecret:'loading-test-secret-at-least-thirty-two-bytes'})
let path='',stall=null,requests=0
const server=httpServer((req,res)=>{
    if (req.url===path && req.method==='GET') {
        requests++
        if (stall==='headers') return
        if (stall==='body') {res.setHeader('Content-Type','application/json');res.write('{"id":');return}
    }
    app(req,res)
}).listen(0)
await once(server,'listening')
const frontend=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:`http://127.0.0.1:${server.address().port}`,changeOrigin:false}}}})
await frontend.listen()
const base=`http://127.0.0.1:${frontend.httpServer.address().port}`,browser=await chromium.launch({headless:true})
async function api(context,path,method='GET',data) {const response=await context.request.fetch(base+path,{method,data});assert(response.ok(),await response.text());return response.json()}
try {
    const master=await browser.newContext(),player=await browser.newContext(),errors=[]
    for(const [context,username] of [[master,'LoadingMaster'],[player,'LoadingPlayer']]) await api(context,'/api/register','POST',{username,password:'test-password-123'})
    const game=await api(master,'/api/play/games','POST',{name:'Sessione salvata'})
    const sheet={...newCharacterSheet(),name:'Personaggio salvato',level:'1',hitPoints:'12',notes:'Testo da conservare'}
    await api(player,'/api/play/invites/'+game.inviteToken+'/join','POST',{sheet})
    path='/api/play/games/'+game.id
    const page=await player.newPage();page.on('pageerror',error=>errors.push(error.message))
    for(const mode of ['headers','body']) {
        stall=mode;requests=0
        await page.goto(base+'/games/'+game.id)
        await page.getByText('Caricamento della sessione…',{exact:true}).waitFor()
        await page.getByRole('alert').filter({hasText:'Il server non ha risposto entro 15 secondi'}).waitFor({timeout:18000})
        assert(requests<=3,'Polling must not accumulate requests while the current read is stalled')
        stall=null
        await page.getByRole('button',{name:'Riprova caricamento',exact:true}).click()
        await page.locator('.play-player-page').waitFor({timeout:10000})
        await page.getByRole('heading',{name:'Personaggio salvato',exact:true}).waitFor()
        assert.equal(await page.getByText('Caricamento della sessione…',{exact:true}).count(),0)
        assert.equal((await api(player,path)).character.sheet.notes,'Testo da conservare')
    }
    const masterPage=await master.newPage();masterPage.on('pageerror',error=>errors.push(error.message))
    await masterPage.goto(base+'/games/'+game.id);await masterPage.locator('.play-master-page').waitFor()
    const writes=await page.evaluate(async()=>{
        const {playApi}=await import('/src/utils/PlayApi.ts'),original=window.fetch,calls=[]
        window.fetch=async(url,options)=>{
            if (url==='/api/play/timeout-check') {calls.push({method:options.method,hasSignal:!!options.signal});return new Response('{}',{headers:{'Content-Type':'application/json'}})}
            return original(url,options)
        }
        try {for(const method of ['POST','PUT','DELETE'])await playApi('/timeout-check',method,{})} finally {window.fetch=original}
        return calls
    })
    assert(writes.every(call=>!call.hasSignal),'Read deadlines must not cancel writes with an ambiguous save outcome')
    assert.deepEqual(errors,[])
    console.log('PASS: stalled headers and JSON body time out, explicit retry loads the player session, polling stays bounded, saved data and Master access preserved')
} finally {await browser.close();await frontend.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dataDir,{recursive:true,force:true})}
