// Run: node tests/combat-requests.mjs (isolated archive; no application accounts touched).
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/index.mjs'
import { combatRules } from '../server/combat-requests.mjs'
import { newCharacterSheet } from '../src/utils/CharacterSheets.ts'
import { enableCreation } from '../src/utils/PlayerCreation.ts'
import { templateFromCatalog } from '../src/utils/Catalog.ts'

const dataDir=await mkdtemp(join(tmpdir(),'dev-and-dice-actions-'))
const config={dataDir,production:false,sessionSecret:'combat-requests-isolated-session-secret'}
let server,base
async function start(){server=(await createApp(config)).listen(0);await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`}
await start()
async function api(user,path,method='GET',body) {
    const response=await fetch(base+path,{method,headers:{...(user?{Cookie:user.cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]}
}
async function account(username) {const result=await api(null,'/api/register','POST',{username,password:'test-password-123'});assert.equal(result.status,201);return result}
const ok=result=>{assert.equal(result.status,200,JSON.stringify(result.body));return result.body}
try {
    const master=await account('ActionMaster'),player=await account('ActionPlayer'),other=await account('ActionOther'),outsider=await account('ActionOutsider')
    const {data,catalog}=await combatRules()
    const template=id=>templateFromCatalog(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:'+id))
    const wizard=enableCreation({...newCharacterSheet(),name:'Maga',level:'5',strength:'10',dexterity:'14',constitution:'14',intelligence:'16',wisdom:'12',charisma:'10',
        playerDetails:{'creation.class':'wizard','creation.race':'human'}},data)
    wizard.playerDetails={...wizard.playerDetails,'spell.2.0.name':'Raggio Rovente','spell.2.0.index':'scorching-ray','spell.2.0.source':'class','spell.2.0.prepared':'true',
        'spell.1.0.name':'Dardo Incantato','spell.1.0.index':'magic-missile','spell.1.0.source':'class','spell.1.0.prepared':'true',
        'spell.0.0.name':'Dardo di Fuoco','spell.0.0.index':'fire-bolt','spell.0.0.source':'class',
        'spell.3.0.name':'Palla di Fuoco','spell.3.0.index':'fireball','spell.3.0.source':'class','spell.3.0.prepared':'true'}
    wizard.abilities=[{name:'Protezione di prova',duration:'1 minuto',remainingTurns:10,description:'Azione personalizzata: effetto manuale senza danni.'}]
    const game=(await api(master,'/api/play/games','POST',{name:'Richieste QA'})).body,path='/api/play/games/'+game.id
    ok(await api(player,'/api/play/invites/'+game.inviteToken+'/join','POST',{sheet:wizard}))
    const ally={...newCharacterSheet(),name:'Alleata',hitPoints:'30',playerDetails:{temporaryHitPoints:'5','rules2014.concentration':'test-concentration'}}
    ok(await api(other,'/api/play/invites/'+game.inviteToken+'/join','POST',{sheet:ally}))
    const monster={...newCharacterSheet(),name:'Orco',kind:'Mostro',hitPoints:'30',playerDetails:{secret:'PRIVATE MONSTER SHEET'}}
    const turn=(id,sheet)=>({id,description:sheet.name,initiative:'10',hitPoints:sheet.hitPoints,armorClass:sheet.armorClass,temporaryHitPoints:sheet.playerDetails?.temporaryHitPoints??'',sheet})
    let state={turns:[turn(1,wizard),turn(2,ally),turn(3,monster)],abilities:[],combat:{activeId:1,round:1}}
    async function current(user=master){return ok(await api(user,path))}
    async function save(stateOverride=state){const now=await current();const result=ok(await api(master,path+'/state','PUT',{revision:now.revision,state:stateOverride,sheets:now.characters.map(record=>record.sheet).concat(now.characters.some(record=>record.id===monster.id)?[]:[monster])}));state=result.state;return result}
    await save()
    async function proposal(name,extra={}) {
        const choices=ok(await api(player,path+'/actions')),action=choices.actions.find(action=>action.name===name)
        assert(action,'Missing action '+name)
        const option=action.options.find(option=>option.remaining===null||option.remaining>=(option.cost??action.cost))
        return {id:crypto.randomUUID(),revision:choices.revision,key:action.key,option:option.id,cost:option.cost??action.cost,mode:'automatic',damageEnabled:true,
            targets:[{id:3,roll:'',hit:true,damageRoll:'2 + 3 = 5',damage:'5'}],...extra}
    }
    async function submit(body) {return api(player,path+'/requests','POST',body)}
    async function decide(body,decision='approve',extra={}) {const now=await current();return api(master,path+'/requests/'+body.id+'/'+decision,'POST',{revision:now.revision,confirmed:true,targets:body.targets.map(({id,damage})=>({id,damage})),...extra})}
    const names={ray:template('scorching-ray').name,missile:template('magic-missile').name,bolt:template('fire-bolt').name,fireball:template('fireball').name}
    const choices=ok(await api(player,path+'/actions'))
    assert.deepEqual(choices.actions.find(action=>action.name===names.ray).entry,JSON.parse(JSON.stringify(catalog.abilities.find(entry=>entry.data.referenceId==='phb2014:spell:scorching-ray'))),'Player actions retain the complete catalog entry used by the Master detail')
    assert.deepEqual(Object.keys(choices.targets[2]).sort(),['id','name'])
    assert(!JSON.stringify(choices).includes('PRIVATE MONSTER'))
    assert.equal((await api(outsider,path+'/actions')).status,404)
    assert.equal((await api(master,path+'/actions')).status,403)
    assert.equal((await api(other,path+'/actions')).status,409)

    const miss=await proposal(names.ray,{mode:'attack',targets:[{id:3,roll:'7 (d20 2 + 5)',hit:false,damageRoll:'',damage:'0'}]})
    assert.equal((await api(other,path+'/requests','POST',miss)).status,409,'Direct submissions cannot impersonate the active character')
    assert.equal((await submit({...miss,targets:[{...miss.targets[0],id:99999}]})).status,400)
    for (const invalid of [{...miss,characterId:ally.id},{...miss,cost:0},{...miss,option:'free'},{...miss,targets:[{...miss.targets[0],roll:''}]},{...miss,targets:[{...miss.targets[0],damage:'5'}]},{...miss,targets:[...miss.targets,...miss.targets]}]) assert([400,409].includes((await submit(invalid)).status))
    const before=await current(),beforeSheet=before.characters.find(record=>record.id===wizard.id)
    const concurrent=await Promise.all([submit(miss),submit(miss)])
    concurrent.forEach(ok)
    assert.equal((await current()).combatRequests.length,1,'Retry/double-click creates one request')
    assert.deepEqual((await current()).characters,before.characters,'Proposal never spends resources or applies damage')
    assert.equal((await api(other,path)).body.combatRequests.length,0,'Other players cannot see this request')
    assert.equal((await api(player,path+'/requests/'+miss.id+'/approve','POST',{revision:before.revision})).status,403)
    assert.equal((await api(outsider,path+'/requests/'+miss.id+'/approve','POST',{})).status,404)
    assert.equal((await decide(miss,'approve',{confirmed:false})).status,400)
    assert.equal((await decide(miss,'approve',{targets:[{id:3,damage:'7'}]})).status,400,'A missed attack cannot deal damage')
    const double=await Promise.all([decide(miss),decide(miss)])
    double.forEach(ok)
    let now=await current(),spent=now.characters.find(record=>record.id===wizard.id)
    assert.equal(Number(spent.sheet.playerDetails['slots.2.used']),Number(beforeSheet.sheet.playerDetails['slots.2.used']??0)+1,'An approved miss spends exactly one slot')
    assert.equal(now.state.turns[2].hitPoints,'30')
    assert(!now.state.abilities.some(ability=>ability.name===names.ray),'Instantaneous effects do not become timers')
    assert.equal((await decide(miss,'reject')).status,409)
    ok(await submit(miss));assert.equal((await current()).revision,now.revision,'Post-approval retries remain idempotent')

    // Advance using the normal Master snapshot; clear spell-per-turn history as TurnsTracker does.
    async function newTurn() {
        now=await current();state=now.state
        const sheets=now.characters.map(record=>record.id===wizard.id?{...record.sheet,playerDetails:{...record.sheet.playerDetails,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}}:record.sheet)
        const result=ok(await api(master,path+'/state','PUT',{revision:now.revision,sheets,state:{...state,combat:{activeId:1,round:state.combat.round+1}}}));state=result.state
    }
    await newTurn()
    const area=await proposal(names.fireball,{mode:'save',targets:[{id:2,roll:'TS fallito: 8',hit:true,damageRoll:'8d6 = 20',damage:'20'},{id:3,roll:'TS superato: 18',hit:true,damageRoll:'8d6 = 20',damage:'10'}]})
    ok(await submit(area))
    assert.equal((await decide(area,'approve',{targets:[{id:2,damage:'9'},{id:2,damage:'9'}]})).status,400)
    now=ok(await decide(area,'approve',{targets:[{id:2,damage:'12'},{id:3,damage:'10'}]}))
    assert.equal(now.state.turns[1].temporaryHitPoints,'0');assert.equal(now.state.turns[1].hitPoints,'23')
    assert.deepEqual(now.state.turns[1].concentrationChecks,[10]);assert.equal(now.state.turns[2].hitPoints,'20')
    assert.equal(now.characters.find(record=>record.id===ally.id).sheet.hitPoints,'23','Canonical sheets and combat HP agree')
    assert.equal(now.combatRequests.find(request=>request.id===area.id).targets[0].damage,'12','Approved damage is visible to the requester')
    const changes=ok(await api(other,path+'/notifications'))
    assert(changes.items.some(change=>change.actorRole==='master'&&change.changes.some(field=>field.path[0]==='hitPoints')))

    await newTurn()
    const rejected=await proposal(names.missile);ok(await submit(rejected));const unchanged=(await current()).characters
    ok(await decide(rejected,'reject'));ok(await decide(rejected,'reject'));assert.deepEqual((await current()).characters,unchanged)
    const changedId={...rejected,option:'cantrip'};assert.equal((await submit(changedId)).status,409)
    const stale=await proposal(names.missile);ok(await submit(stale));await newTurn()
    assert.equal((await current(player)).combatRequests.find(request=>request.id===stale.id).status,'stale')
    assert.equal((await decide(stale)).status,409);ok(await decide(stale,'reject'))
    const edited=await proposal(names.missile);ok(await submit(edited))
    let record=(await current(player)).character
    record=ok(await api(player,'/api/play/characters/'+wizard.id,'PUT',{revision:record.revision,sheet:{...record.sheet,notes:'changed'}}))
    ok(await api(player,'/api/play/characters/'+wizard.id,'PUT',{revision:record.revision,sheet:{...record.sheet,notes:''}}))
    assert.equal((await decide(edited)).status,409,'ABA edits invalidate pending approvals')
    const persistent=await proposal('Protezione di prova',{mode:'none',damageEnabled:false,targets:[]})
    ok(await submit(persistent))
    await new Promise(resolve=>server.close(resolve));await start()
    ok(await submit(persistent));now=ok(await decide(persistent))
    assert(now.state.abilities.some(ability=>ability.name==='Protezione di prova'&&ability.active&&ability.remainingTurns===10))
    const archive=JSON.parse(await readFile(join(dataDir,'games.json'),'utf8'))
    assert.equal(archive.games[0].combatRequests.find(request=>request.id===persistent.id).status,'approved')
    assert.equal((await current(player)).combatRequests.filter(request=>request.id===persistent.id).length,1)
    await new Promise(resolve=>server.close(resolve));await start();ok(await decide(persistent));assert.equal((await current()).revision,now.revision)
    await newTurn()
    record=(await current(player)).character
    record=ok(await api(player,'/api/play/characters/'+wizard.id,'PUT',{revision:record.revision,sheet:{...record.sheet,playerDetails:{...record.sheet.playerDetails,'slots.2.used':'3','slots.3.used':'1'}}}))
    const upcast=await proposal(names.ray,{mode:'attack',targets:[{id:3,roll:'19',hit:true,damageRoll:'2d6 = 4',damage:'4'}]})
    assert.equal(upcast.option,'slot:3','An exhausted lower slot falls back to an available higher slot')
    ok(await submit(upcast));now=ok(await decide(upcast))
    assert.equal(now.characters.find(record=>record.id===wizard.id).sheet.playerDetails['slots.3.used'],'2','The last higher-level slot is spent once')
    const exhaustedChoices=ok(await api(player,path+'/actions')),exhausted=exhaustedChoices.actions.find(action=>action.name===names.ray)
    assert.equal((await submit({...upcast,id:crypto.randomUUID(),revision:exhaustedChoices.revision,key:exhausted.key,option:'slot:2'})).status,409)
    const cantrip=await proposal(names.bolt,{mode:'attack',targets:[{id:3,roll:'3',hit:false,damageRoll:'',damage:'0'}]})
    ok(await submit(cantrip));const slotsBefore=(await current(player)).character.sheet.playerDetails
    now=ok(await decide(cantrip));const slotsAfter=now.characters.find(record=>record.id===wizard.id).sheet.playerDetails
    for(const level of [1,2,3]) assert.equal(slotsAfter[`slots.${level}.used`],slotsBefore[`slots.${level}.used`],'Cantrips never consume a slot')
    await newTurn()
    record=(await current(player)).character
    record=ok(await api(player,'/api/play/characters/'+wizard.id,'PUT',{revision:record.revision,sheet:{...record.sheet,playerDetails:{...record.sheet.playerDetails,
        'spell.1.1.name':'Identificare','spell.1.1.index':'identify','spell.1.1.source':'class','spell.1.1.prepared':'true'}}}))
    const ritual=await proposal(template('identify').name,{mode:'none',damageEnabled:false,targets:[],option:'ritual'})
    ok(await submit(ritual));assert.equal((await current()).combatRequests.find(request=>request.id===ritual.id).prolonged,true)
    assert.equal((await decide(ritual,'approve',{confirmed:false})).status,400)
    const ritualBefore=(await current(player)).character.sheet.playerDetails['slots.1.used']
    now=ok(await decide(ritual));assert.equal(now.characters.find(record=>record.id===wizard.id).sheet.playerDetails['slots.1.used'],ritualBefore)
    record=(await current(player)).character
    ok(await api(player,'/api/play/characters/'+wizard.id,'PUT',{revision:record.revision,sheet:{...record.sheet,abilities:[...record.sheet.abilities,{...template('scorching-ray'),spellLevel:0,castingSource:'free',resourceCost:0,ruleId:'phb2014:class-feature:barbarian-1-rage'}]}}))
    const tampered=ok(await api(player,path+'/actions')).actions.find(action=>action.name===names.ray)
    assert.equal(tampered.cost,1)
    assert(!tampered.options.some(option=>['free','cantrip'].includes(option.id)),'Extra player JSON cannot grant free casting or lower a catalog spell level')
    record=(await current(player)).character
    ok(await api(player,'/api/play/characters/'+wizard.id,'PUT',{revision:record.revision,sheet:{...record.sheet,abilities:[...record.sheet.abilities,template('scorching-ray')],playerDetails:{...record.sheet.playerDetails,'rules.edition':'2024'}}}))
    const mismatched=ok(await api(player,path+'/actions')).actions.find(action=>action.name===names.ray)
    assert.match(mismatched.error,/2014/,'2014 action metadata cannot silently execute as 2024 rules')
    console.log('PASS combat requests: identity, privacy, proposals, attack miss cost, atomic/idempotent approval, area damage, temporary HP, concentration, rejection, stale/ABA, persistence and restart')
} finally {await new Promise(resolve=>server.close(resolve));await rm(dataDir,{recursive:true,force:true})}
