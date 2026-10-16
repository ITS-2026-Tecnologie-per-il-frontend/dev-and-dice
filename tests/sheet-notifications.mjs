// Run: node tests/sheet-notifications.mjs (isolated server and temporary storage).
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/index.mjs'

const dataDir=await mkdtemp(join(tmpdir(),'dev-and-dice-notifications-')),options={dataDir,production:false,sessionSecret:'notifications-test-secret-longer-than-thirty-two-bytes'}
let server,base
async function start(){const app=await createApp(options);server=app.listen(0);await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`}
async function request(cookie,path,method='GET',body){const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]}}
async function account(username){const result=await request(null,'/api/register','POST',{username,password:'test-password-123'});assert.equal(result.status,201);return result}
const api=(user,path,method,body)=>request(user?.cookie,'/api/play'+path,method,body)
const sheet=name=>({id:randomUUID(),abilities:[],name,kind:'PG',race:'',characterClass:'',level:'1',hitPoints:'12',armorClass:'12',initiative:'10',speed:'9 m',strength:'14',dexterity:'14',constitution:'14',intelligence:'10',wisdom:'10',charisma:'10',notes:'',playerDetails:{'slots.2.total':'2','slots.2.used':'0'}})
try {
    await start()
    const master=await account('NotifyMaster'),player=await account('NotifyPlayer'),other=await account('NotifyOther'),outsider=await account('NotifyOutsider')
    const game=(await api(master,'/games','POST',{name:'Notifiche QA'})).body,path='/games/'+game.id
    const original=sheet('Kara'),otherSheet=sheet('Nora')
    for(const [user,character] of [[player,original],[other,otherSheet]])assert.equal((await api(user,'/invites/'+game.inviteToken+'/join','POST',{sheet:character})).status,200)
    const get=async()=>{const result=await api(master,path);assert.equal(result.status,200);return result.body}
    const history=async(user=master,cursor='')=>{const result=await api(user,path+'/notifications'+cursor);assert.equal(result.status,200);return result.body}
    const timeline=async(user=player,cursor='')=>{const result=await api(user,path+'/history'+cursor);assert.equal(result.status,200);return result.body}
    async function edit(user,updates) {
        const record=(await api(user,'/characters/'+original.id)).body
        const result=await api(user,'/characters/'+original.id,'PUT',{revision:record.revision,sheet:{...record.sheet,...updates},actorName:'Forged author'})
        assert.equal(result.status,200,JSON.stringify(result.body));return result.body
    }
    assert.deepEqual((await get()).notifications,{revision:0,unreadCount:0})
    assert.deepEqual((await history()).items,[])
    assert.equal((await api(null,path+'/notifications')).status,401)
    assert.equal((await api(outsider,path+'/notifications')).status,404)
    assert.equal((await api(null,path+'/history')).status,401)
    assert.equal((await api(outsider,path+'/history')).status,404)
    assert.equal((await api(master,path+'/history')).status,403)
    assert.deepEqual((await timeline()).items,[])
    // Optional journal fields keep pre-feature archives readable without changing their sheets.
    const file=join(dataDir,'games.json'),legacy=JSON.parse(await readFile(file,'utf8'))
    for(const game of legacy.games){delete game.sheetChanges;delete game.notificationRevision}
    await writeFile(file,JSON.stringify(legacy))
    await edit(player,{strength:'18',playerDetails:{...original.playerDetails,'custom.field.with.dots':'added'}})
    const first=(await history()).items[0]
    assert.equal(first.actorName,'NotifyPlayer');assert.equal(first.actorRole,'player');assert.equal(first.status,'applied');assert(first.canReject&&!first.read)
    assert.equal(first.changes.find(change=>change.path[0]==='strength').before,'14')
    assert.equal(first.changes.find(change=>change.path[1]==='custom.field.with.dots').before,null)
    assert.equal((await get()).characters.find(record=>record.id===original.id).sheet.strength,'18','Player changes apply before any Master action')
    assert.deepEqual((await history(player)).items,[],'Players do not receive their own applied edits')
    assert.equal((await timeline()).items[0].id,first.id,'Own edits remain available in the separate full history')
    assert.equal((await timeline()).items[0].canReject,false)
    for(const route of ['/history/','/HISTORY'])assert.equal((await api(player,path+route)).body.items[0].id,first.id,'History routing preserves its scope with trailing slash or case variants')
    assert.equal((await api(player,path)).body.notifications.unreadCount,0,'Own edits do not affect the player bell count')
    assert.equal((await api(player,path+'/notifications/'+first.id+'/read','POST')).status,404,'Hidden own edits cannot be fetched through read receipts')
    assert.deepEqual((await history(other)).items,[],'Other players cannot read someone else’s sheet history')
    assert.equal((await api(other,path+'/notifications/'+first.id+'/read','POST')).status,404)
    assert.equal((await api(player,path+'/notifications/'+first.id+'/reject','POST',{revision:(await get()).revision})).status,403)
    // Reading is idempotent and does not change the combat revision.
    const beforeRead=await get()
    for(let i=0;i<2;i++)assert.equal((await api(master,path+'/notifications/'+first.id+'/read','POST')).status,200)
    assert.equal((await get()).revision,beforeRead.revision);assert.equal((await get()).notifications.unreadCount,0)
    // The Master’s combat snapshot changes HP/slots independently; rejecting Strength preserves both.
    let current=await get()
    const sheets=current.characters.map(record=>record.id===original.id?{...record.sheet,hitPoints:'7',playerDetails:{...record.sheet.playerDetails,'slots.2.used':'1'}}:record.sheet)
    const state={turns:[{id:0,description:'Kara',hitPoints:'7',armorClass:'12',initiative:'10',temporaryHitPoints:'',sheet:sheets.find(sheet=>sheet.id===original.id)}],abilities:[],combat:{activeId:0,round:1}}
    assert.equal((await api(master,path+'/state','PUT',{revision:current.revision,sheets,state})).status,200)
    const masterEvent=(await history(player)).items[0]
    const beforeTimeline=(await api(player,path)).body.notifications
    assert((await timeline()).items.some(entry=>entry.actorRole==='master'))
    assert.deepEqual((await api(player,path)).body.notifications,beforeTimeline,'Reading the full history never marks notifications as read')
    assert.equal(masterEvent.actorRole,'master');assert.equal(masterEvent.actorName,'NotifyMaster');assert.equal(masterEvent.canReject,false);assert.equal(masterEvent.read,false)
    const timelineRevision=(await timeline()).revision
    assert.equal((await api(player,path+'/notifications/'+masterEvent.id+'/read','POST')).status,200)
    assert.equal((await timeline()).revision,timelineRevision,'Notification reads must not invalidate history pagination')
    assert.equal((await api(master,path+'/notifications/'+masterEvent.id+'/reject','POST',{revision:(await get()).revision})).status,404)
    assert.equal((await api(master,path+'/notifications/'+first.id+'/reject','POST',{revision:beforeRead.revision})).status,409)
    current=await get()
    const rejected=await api(master,path+'/notifications/'+first.id+'/reject','POST',{revision:current.revision})
    assert.equal(rejected.status,200,JSON.stringify(rejected.body))
    const restored=rejected.body.characters.find(record=>record.id===original.id).sheet
    assert.equal(restored.strength,'14');assert.equal(restored.hitPoints,'7');assert.equal(restored.playerDetails['slots.2.used'],'1');assert(!Object.hasOwn(restored.playerDetails,'custom.field.with.dots'))
    assert.equal(rejected.body.state.turns[0].sheet.strength,'14');assert.equal(rejected.body.state.turns[0].hitPoints,'7')
    assert.equal((await history(player)).items.find(entry=>entry.id===first.id).status,'rejected');assert.equal((await history(player)).items.find(entry=>entry.id===first.id).read,false)
    const duplicate=await api(master,path+'/notifications/'+first.id+'/reject','POST',{revision:current.revision})
    assert.equal(duplicate.status,200);assert.equal(duplicate.body.revision,rejected.body.revision,'A duplicate rejection cannot apply the inverse twice')
    // Same-field changes, including ABA (18 -> 19 -> 18), block the whole inverse atomically.
    await edit(player,{strength:'18',wisdom:'13'})
    const conflicting=(await history()).items[0]
    await edit(master,{strength:'19'});await edit(master,{strength:'18'})
    current=await get()
    const blocked=await api(master,path+'/notifications/'+conflicting.id+'/reject','POST',{revision:current.revision})
    assert.equal(blocked.status,409);assert.match(blocked.body.error,/successivamente/)
    assert.equal((await get()).characters.find(record=>record.id===original.id).sheet.wisdom,'13','Conflicts do not partially revert a related edit')
    assert.equal((await get()).revision,current.revision)
    assert(!(await history(player)).items.some(entry=>entry.id===conflicting.id),'A failed rejection never exposes the player’s own edit')
    // Missing and empty keys differ; the server never interprets dots as nested paths.
    let record=await edit(player,{playerDetails:{...restored.playerDetails,empty:''}})
    const empty=(await history()).items[0]
    assert.equal((await api(master,path+'/notifications/'+empty.id+'/reject','POST',{revision:(await get()).revision})).status,200)
    assert(!Object.hasOwn((await api(player,'/characters/'+original.id)).body.sheet.playerDetails,'empty'))
    const countBefore=(await history()).revision
    record=(await api(player,'/characters/'+original.id)).body
    assert.equal((await api(player,'/characters/'+original.id,'PUT',{revision:record.revision,sheet:record.sheet})).status,200)
    assert.equal((await history()).revision,countBefore,'No-op saves create no notifications')
    const abilities=[{name:'Fiuto',duration:'Senza conteggio'},{name:'Morso',duration:'Senza conteggio'}]
    await edit(player,{abilities})
    const listEdit=(await history()).items[0]
    assert.deepEqual(listEdit.changes[0].path,['abilities'],'Ability lists stay one field until rows have stable identities')
    await edit(master,{abilities:abilities.toReversed()})
    assert.equal((await api(master,path+'/notifications/'+listEdit.id+'/reject','POST',{revision:(await get()).revision})).status,409,'A later reorder cannot be overwritten by undoing an earlier list edit')
    assert.equal((await api(player,'/characters/'+original.id)).body.sheet.abilities[0].name,'Morso')
    const privateNotes='PRIVATE NOTES NEVER ENTER THE JOURNAL'
    assert.equal((await api(player,path+'/notes','PUT',{text:privateNotes,revision:0})).status,200)
    assert(!JSON.stringify(await history()).includes(privateNotes))
    // Pagination preserves the complete journal across restarts; read receipts remain per recipient.
    for(let n=0;n<23;n++)await edit(player,{notes:'Modifica '+n})
    let page=await history(),ids=[]
    assert.equal(page.items.length,20);assert(page.next)
    do {ids.push(...page.items.map(entry=>entry.id));page=page.next?await history(master,'?before='+page.next):null} while(page)
    assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,31)
    const playerHistory=await history(player)
    assert(playerHistory.items.every(entry=>entry.actorRole==='master'||entry.status==='rejected'),'Filter before pagination: only Master changes and rejections appear for players')
    assert.equal(playerHistory.next,null,'Many hidden own edits cannot create empty pages in the player feed')
    assert.equal((await api(player,path+'/notifications?before='+listEdit.id)).status,400,'An own-edit cursor cannot bypass the filter')
    assert.equal((await api(master,path+'/notifications?before='+randomUUID())).status,400)
    let full=await timeline(),timelineIds=[]
    assert.equal(full.items.length,20);assert(full.next)
    do {timelineIds.push(...full.items.map(entry=>entry.id));full=full.next?await timeline(player,'?before='+full.next):null} while(full)
    assert.deepEqual(timelineIds,ids,'The personal history contains every own and Master edit in time order, across pages')
    assert.equal((await api(player,path+'/history?before='+randomUUID())).status,400)
    const persisted=await history()
    const persistedTimeline=await timeline()
    await new Promise(resolve=>server.close(resolve));await start()
    assert.deepEqual(await history(),persisted,'Events, authors and statuses survive a server restart')
    assert.deepEqual(await timeline(),persistedTimeline,'The complete personal history survives restart')
    const nora=(await api(other,'/characters/'+otherSheet.id)).body
    assert.equal((await api(other,'/characters/'+otherSheet.id,'PUT',{revision:nora.revision,sheet:{...nora.sheet,wisdom:'16'}})).status,200)
    assert.equal((await timeline(other)).items.length,1)
    assert((await timeline(other)).items.every(entry=>entry.characterId===otherSheet.id),'Other players see only their own character’s full history')
    assert(!(await timeline()).items.some(entry=>entry.characterId===otherSheet.id))
    // Once the character leaves, old-session rejections cannot affect it or its new session.
    const last=(await history()).items.find(entry=>entry.characterId===original.id)
    assert.equal((await api(player,path+'/leave','POST')).status,200)
    assert.equal((await api(master,path+'/notifications/'+last.id+'/reject','POST',{revision:(await get()).revision})).status,409)
    assert.equal((await api(player,path+'/notifications')).status,404)
    assert.equal((await api(player,path+'/history')).status,404)
    const disk=JSON.parse(await readFile(file,'utf8'))
    assert.equal(disk.games[0].sheetChanges.length,32)
    console.log('PASS: automatic edits, trusted authors, role privacy, filtered notifications, complete personal history, read receipts, targeted atomic rollback, independent slots/HP, ABA conflicts, idempotency, legacy archives, pagination and restart.')
} finally {if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(dataDir,{recursive:true,force:true})}
