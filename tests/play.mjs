import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/index.mjs'

const dataDir=await mkdtemp(join(tmpdir(),'dev-and-dice-play-'))
const options={dataDir,production:false,sessionSecret:'play-test-secret-longer-than-thirty-two-bytes'}
let app=await createApp(options),server=app.listen(0)
await once(server,'listening')
let base=`http://127.0.0.1:${server.address().port}`
async function request(cookie,path,method='GET',body,extra={}) {
    const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)})
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]}
}
async function account(username){const result=await request(null,'/api/register','POST',{username,password:'test-password-123'});assert.equal(result.status,201);return result}
const sheet=(name,kind='PG')=>({id:randomUUID(),abilities:[],name,kind,race:'',characterClass:'Barbaro',level:'1',hitPoints:'12',armorClass:'12',initiative:'10',speed:'9 m',strength:'14',dexterity:'14',constitution:'14',intelligence:'10',wisdom:'10',charisma:'10',notes:'',playerDetails:{}})
const api=(user,path,method,body,extra)=>request(user?.cookie,'/api/play'+path,method,body,extra)
try {
    const master=await account('MasterQA'),player=await account('PlayerQA'),other=await account('OtherQA'),secondMaster=await account('MasterTwoQA')
    assert.equal((await api(null,'/home')).status,401)
    const original=sheet('Kara'),created=await api(player,'/characters','POST',{sheet:original,ownerId:master.body.user.id})
    assert.equal(created.status,201);assert.equal(created.body.ownerId,player.body.user.id)
    assert.equal((await api(other,'/characters/'+original.id)).status,404)
    assert.equal((await api(other,'/characters/'+original.id,'PUT',{revision:1,sheet:{...original,name:'Attacco'}})).status,404)
    assert.equal((await api(player,'/characters/'+original.id,'PUT',{revision:1,sheet:{...original,ownerId:master.body.user.id}})).status,400)
    assert.equal((await api(player,'/characters','POST',{sheet:{...sheet('Non valido'),strength:'NaN'}})).status,400)
    assert.equal((await api(player,'/characters','POST',{sheet:sheet('CSRF')},{Origin:'https://attacker.invalid','Sec-Fetch-Site':'cross-site'})).status,403)
    const first=await api(master,'/games','POST',{name:'La miniera'}),second=await api(secondMaster,'/games','POST',{name:'Il castello'})
    assert.equal(first.status,201);assert.equal(first.body.role,'master')
    assert.match(first.body.inviteToken,/^[A-Za-z\d_-]{43}$/)
    assert.notEqual(first.body.inviteToken,second.body.inviteToken)
    const game=first.body,game2=second.body
    assert.equal((await api(other,'/games/'+game.id)).status,404)
    assert.equal((await api(other,'/invites/not-a-real-link')).status,404)
    assert.equal((await api(other,'/invites/'+game.inviteToken+'/join','POST',{characterId:original.id})).status,404)
    assert.equal((await api(player,'/invites/'+game.inviteToken+'/join','POST',{characterId:original.id})).status,200)
    assert.equal((await api(player,'/invites/'+game.inviteToken+'/join','POST',{characterId:original.id})).status,200)
    assert.equal((await api(player,'/invites/'+game2.inviteToken+'/join','POST',{characterId:original.id})).status,409)
    assert.equal((await api(player,'/characters/'+original.id,'DELETE')).status,409)
    const otherSheet=sheet('Nora')
    await api(other,'/characters','POST',{sheet:otherSheet})
    const race=await Promise.all([game,game2].map(game=>api(other,'/invites/'+game.inviteToken+'/join','POST',{characterId:otherSheet.id})))
    assert.deepEqual(race.map(result=>result.status).sort(),[200,409],'Concurrent joins reserve a character atomically')
    const inline=sheet('Arin')
    assert.equal((await api(secondMaster,'/invites/'+game.inviteToken+'/join','POST',{sheet:inline})).status,200,'A Master of another game can join as a player and create there')
    let current=(await api(master,'/games/'+game.id)).body
    assert.equal(current.characters.filter(record=>record.id===original.id).length,1)
    const npc=sheet('Il drago segreto','Mostro');npc.notes='PRIVATE MASTER SECRET';npc.hitPoints='200'
    const turn=(id,sheet)=>({id,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:'',sheet})
    const effect=(id,ownerId,name,extra={})=>({id,ownerId,name,duration:'1 minuto',remainingTurns:10,active:true,...extra})
    const state={turns:[turn(1,original),turn(2,npc)],abilities:[
        effect(1,1,'Protezione',{description:'Bonus sul tuo personaggio',concentration:true,expiresAt:'end',repeatSave:'Ripeti il tiro salvezza',secret:'PRIVATE EFFECT METADATA'}),
        effect(2,2,'PRIVATE ENEMY EFFECT'),effect(3,1,'Non attiva',{active:false}),effect(4,1,'Scaduta',{remainingTurns:0}),
        effect(5,1,'Effetto continuo',{duration:'Senza conteggio',remainingTurns:0,timed:false}),
    ],combat:{activeId:1,round:1}}
    let saved=await api(master,'/games/'+game.id+'/state','PUT',{revision:current.revision,sheets:current.characters.map(record=>record.sheet),state})
    assert.equal(saved.status,200)
    const projection=(await api(player,'/games/'+game.id)).body
    assert.equal(projection.role,'player');assert.equal(projection.character.id,original.id)
    assert.deepEqual(projection.turns,[{name:'Kara',current:true},{name:'Il drago segreto',current:false}])
    for(const key of ['state','characters','inviteToken','players','masterId'])assert(!Object.hasOwn(projection,key),key)
    assert(!JSON.stringify(projection).includes('PRIVATE MASTER SECRET'))
    assert.deepEqual(projection.effects,[{name:'Protezione',duration:'1 minuto',remainingTurns:10,timed:true,concentration:true,description:'Bonus sul tuo personaggio',expiresAt:'end',repeatSave:'Ripeti il tiro salvezza'},
        {name:'Effetto continuo',duration:'Senza conteggio',remainingTurns:0,timed:false,concentration:false}])
    assert(!JSON.stringify(projection).includes('PRIVATE ENEMY EFFECT'));assert(!JSON.stringify(projection).includes('PRIVATE EFFECT METADATA'))
    assert.deepEqual(projection.notes,{text:'',revision:0},'Existing memberships need no migration')
    const notesPath='/games/'+game.id+'/notes',privateNotes={text:'PRIVATE PLAYER SECRET\nIndizi personali',revision:0}
    assert.equal((await api(null,notesPath,'PUT',privateNotes)).status,401)
    assert.equal((await api(master,notesPath,'PUT',privateNotes)).status,403)
    assert.equal((await api(player,'/games/'+game2.id+'/notes','PUT',privateNotes)).status,404)
    assert.equal((await api(player,notesPath,'PUT',{...privateNotes,userId:secondMaster.body.user.id})).status,400)
    assert.equal((await api(player,notesPath,'PUT',{text:'x'.repeat(20001),revision:0})).status,400)
    assert.equal((await api(player,notesPath,'PUT',{text:{bad:true},revision:0})).status,400)
    const notes=await api(player,notesPath,'PUT',privateNotes)
    assert.equal(notes.status,200);assert.deepEqual(notes.body,{...privateNotes,revision:1})
    assert.equal((await api(player,notesPath,'PUT',{text:'Stale overwrite',revision:0})).status,409)
    assert.deepEqual((await api(player,'/games/'+game.id)).body.notes,notes.body)
    assert.equal((await api(master,'/games/'+game.id)).body.revision,saved.body.revision,'Private notes do not change combat revisions')
    assert(!JSON.stringify((await api(master,'/games/'+game.id)).body).includes('PRIVATE PLAYER SECRET'))
    assert(!JSON.stringify((await api(master,'/characters/'+original.id)).body).includes('PRIVATE PLAYER SECRET'))
    assert.deepEqual((await api(secondMaster,'/games/'+game.id)).body.notes,{text:'',revision:0})
    assert(!JSON.stringify((await api(secondMaster,'/games/'+game.id)).body).includes('PRIVATE PLAYER SECRET'))
    assert.equal((await api(player,'/games/'+game.id+'/state','PUT',{revision:saved.body.revision,state,sheets:[]})).status,403)
    assert.equal((await api(player,'/games/'+game.id,'DELETE')).status,403)
    const record=projection.character,edited={...record.sheet,hitPoints:'7',notes:'Note del giocatore'}
    assert.equal((await api(player,'/characters/'+record.id,'PUT',{revision:record.revision,sheet:edited})).status,200)
    assert.equal((await api(player,'/characters/'+record.id,'PUT',{revision:record.revision,sheet:original})).status,409)
    assert.equal((await api(master,'/games/'+game.id+'/state','PUT',{revision:saved.body.revision,state,sheets:current.characters.map(record=>record.sheet)})).status,409)
    current=(await api(master,'/games/'+game.id)).body
    assert.equal(current.state.turns[0].hitPoints,'7');assert.equal(current.characters.find(record=>record.id===original.id).sheet.notes,'Note del giocatore')
    assert.equal((await api(master,'/games/'+game.id+'/state','PUT',{revision:current.revision,state:{...state,turns:[turn(1,otherSheet)],abilities:[]},sheets:current.characters.map(record=>record.sheet)})).status,race[1].status===200?403:200)
    assert.equal((await api(master,'/characters/'+original.id,'DELETE')).status,403)
    const owned=sheet('Scheda del Master')
    await api(master,'/characters','POST',{sheet:owned})
    current=(await api(master,'/games/'+game.id)).body
    assert.equal((await api(player,'/games/'+game.id+'/characters','POST',{revision:current.revision,characterId:owned.id})).status,403)
    const added=await api(master,'/games/'+game.id+'/characters','POST',{revision:current.revision,characterId:owned.id})
    assert.equal(added.status,200)
    assert.equal((await api(master,'/games/'+game.id+'/characters/'+original.id+'/remove','POST',{revision:added.body.revision})).status,403)
    assert.equal((await api(master,'/games/'+game.id+'/characters/'+owned.id+'/remove','POST',{revision:added.body.revision})).status,200)
    assert.equal((await api(master,'/characters/'+owned.id)).body.gameId,null)
    const home=(await api(player,'/home')).body
    assert.equal(home.characters.length,1);assert.equal(home.characters[0].gameId,game.id);assert.equal(home.games[0].role,'player')
    const legacy=sheet('Scheda precedente')
    legacy.id='identificativo-del-vecchio-browser'
    const recovered=await api(player,'/import','POST',{sheets:[legacy]})
    assert.equal(recovered.status,200);assert.notEqual(recovered.body.characters[0].id,legacy.id)
    const twice=await api(player,'/import','POST',{sheets:[{...legacy,name:'Non sovrascrivere'}]})
    assert.equal(twice.body.characters[0].id,recovered.body.characters[0].id);assert.equal(twice.body.characters[0].sheet.name,legacy.name)
    assert.equal((await api(player,'/import','POST',{sheets:[sheet('Da non salvare'),{bad:true}]})).status,400)
    assert(!(await api(player,'/home')).body.characters.some(character=>character.sheet.name==='Da non salvare'))
    await new Promise(resolve=>server.close(resolve));app=await createApp(options);server=app.listen(0);await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`
    assert.equal((await api(player,'/characters/'+original.id)).body.sheet.hitPoints,'7','State survives server restart')
    assert.deepEqual((await api(player,'/games/'+game.id)).body.notes,notes.body,'Private notes survive server restart')
    assert.equal((await api(player,'/games/'+game.id+'/leave','POST')).status,200)
    assert.equal((await api(player,'/characters/'+original.id)).body.gameId,null)
    assert.equal((await api(player,'/games/'+game.id)).status,404)
    assert.equal((await api(player,'/invites/'+game2.inviteToken+'/join','POST',{characterId:original.id})).status,200)
    assert.equal((await api(secondMaster,'/games/'+game2.id,'DELETE')).status,200)
    assert.equal((await api(player,'/characters/'+original.id)).body.gameId,null)
    const disk=JSON.parse(await readFile(join(dataDir,'games.json'),'utf8'))
    assert(!JSON.stringify(disk).includes('test-password-123'))
    console.log('PASS: ownership, roles, private notes and conflicts, filtered active effects, unpredictable invites, atomic/concurrent joins, creation in session, restart, safe import and release of characters.')
} finally {await new Promise(resolve=>server.close(resolve));await rm(dataDir,{recursive:true,force:true})}
