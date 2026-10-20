import { InfoButton } from './InfoButton'
import { memo, useEffect, useRef, useState, type FormEvent } from 'react'
import { playApi, type ActionChoices, type CombatRequest, type CombatTarget, type Game, type PlayerGame } from '../utils/PlayApi'
import { NotificationPopover } from './NotificationPopover'

const modeLabels={attack:'Tiro per colpire',save:'Tiro salvezza',automatic:'Colpo / effetto automatico',none:'Senza danni'}
const statusLabels={pending:'In attesa del Master',approved:'Approvata',rejected:'Rifiutata',stale:'Superata: turno o dati cambiati'}
const message=(error:unknown)=>error instanceof Error ? error.message : 'Operazione non riuscita.'

function RequestDescription({request}:{request:CombatRequest}) {
    return <><p>{request.characterName} · {request.actorName} · <time dateTime={request.createdAt}>{new Date(request.createdAt).toLocaleString('it-IT')}</time></p>
        <p>{modeLabels[request.mode]} · {request.optionLabel}{request.spendsResources?` · costo ${request.cost}`:''}</p>
        {request.prolonged&&<p>Tempo di lancio prolungato: approvare soltanto dopo il completamento.</p>}
        <ul>{request.targets.map(target=><li key={target.id}><strong>{target.name||'Partecipante'}</strong>{target.roll&&<> · {request.mode==='save'?'TS':'Tiro'}: {target.roll}</>}{request.mode==='attack'&&<> · {target.hit?'Colpito':'Mancato'}</>}{request.damageEnabled&&<> · Danni tirati: {target.damageRoll||'—'} · Danni finali: {target.damage}</>}</li>)}</ul>
        <p role="status">{statusLabels[request.status]}</p></>
}

function ReviewRequest({request,disabled,onDecide}:{request:CombatRequest;disabled:boolean;onDecide:(id:string,decision:'approve'|'reject',body:unknown)=>Promise<void>}) {
    const [damages,setDamages]=useState(()=>request.targets.map(target=>({id:target.id,damage:target.damage}))),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
    const working=useRef(false)
    async function decide(decision:'approve'|'reject') {
        if (working.current) return
        working.current=true;setBusy(true);setError('')
        try {await onDecide(request.id,decision,{confirmed,targets:damages})} catch(error) {setError(message(error))} finally {working.current=false;setBusy(false)}
    }
    const pending=request.status==='pending',stale=request.status==='stale'
    return <article className="combat-request"><h3>{request.actionName}</h3><RequestDescription request={request}/>
        {(pending||stale)&&<form onSubmit={event=>{event.preventDefault();void decide('approve')}}>
            <fieldset disabled={disabled||busy}><legend>Decisione del Master</legend>
                {pending&&<>{request.damageEnabled&&damages.map((target,index)=><label key={target.id}>Danni finali a {request.targets.find(original=>original.id===target.id)?.name}<input type="number" min="0" step="1" required disabled={request.mode==='attack'&&!request.targets[index].hit} value={target.damage} onChange={event=>setDamages(current=>current.map(item=>item.id===target.id?{...item,damage:event.target.value}:item))}/></label>)}
                <label className="combat-request-check"><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Confermo requisiti, bersagli, tiri, difese e danni finali; gli eventuali tempi di lancio sono completati. Risolvo manualmente gli altri effetti.</label></>}
                <div className="play-actions">{pending&&<button disabled={!confirmed} type="submit">Approva azione</button>}<button type="button" className="play-secondary" onClick={()=>void decide('reject')}>Rifiuta azione</button></div>
            </fieldset>
        </form>}{error&&<p role="alert">{error}</p>}</article>
}

export const MasterCombatRequests=memo(function MasterCombatRequests({game,disabled,onDecide}:{game:Game;disabled:boolean;onDecide:(id:string,decision:'approve'|'reject',body:unknown)=>Promise<void>}) {
    const [open,setOpen]=useState(false)
    const pending=game.combatRequests.filter(request=>request.status==='pending').length
    return <NotificationPopover id="combat-requests" title="Azioni dei giocatori" label={`Azioni dei giocatori: ${pending} in attesa`} closeLabel="Chiudi azioni" iconPath="M14 3h7v7L10 21l-7-7L14 3ZM13 4l7 7M3 21l3-3M3 14l7 7" count={pending} open={open} onOpenChange={setOpen}>
        <p>Ogni azione richiede approvazione esplicita. Le modifiche ordinarie alla scheda seguono le notifiche della campanella.</p>
        {!game.combatRequests.length&&<p>Nessuna azione proposta.</p>}
        <ol className="play-notification-list">{game.combatRequests.map(request=><li key={request.id} data-unread={request.status==='pending'}><ReviewRequest request={request} disabled={disabled} onDecide={onDecide}/></li>)}</ol>
        {disabled&&<p>Concludi il salvataggio della sessione prima di approvare o rifiutare un’azione.</p>}
    </NotificationPopover>
})

export function PlayerCombatActions({game,onUpdate}:{game:PlayerGame;onUpdate:(game:Game)=>void}) {
    const [open,setOpen]=useState(false),[choices,setChoices]=useState<ActionChoices>(),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false)
    const [key,setKey]=useState(''),[optionId,setOptionId]=useState(''),[cost,setCost]=useState(1),[mode,setMode]=useState<CombatRequest['mode']>('none'),[damageEnabled,setDamageEnabled]=useState(false),[targets,setTargets]=useState<CombatTarget[]>([])
    const working=useRef(false),attempt=useRef<{signature:string;body:unknown}>(undefined)
    const action=choices?.actions.find(action=>action.key===key),option=action?.options.find(option=>option.id===optionId)
    const pending=game.combatRequests.some(request=>request.status==='pending'),stale=choices && choices.revision!==game.revision
    useEffect(()=>{
        if (!open) return
        let active=true
        playApi<ActionChoices>('/games/'+game.id+'/actions').then(choices=>{if(active)setChoices(choices)}).catch(error=>{if(active)setError(message(error))}).finally(()=>{if(active)setLoading(false)})
        return ()=>{active=false}
    },[open,game.id,retry])
    function refreshActions() {setLoading(true);setError('');setChoices(undefined);setKey('');setTargets([]);setRetry(current=>current+1)}
    function select(key:string) {
        const action=choices?.actions.find(action=>action.key===key),option=action?.options.find(option=>option.remaining===null || option.remaining>=(option.cost??action.cost)) ?? action?.options[0]
        setKey(key);setOptionId(option?.id??'');setCost(option?.cost??action?.cost??1);setMode(action?.mode??'none');setDamageEnabled(action?.damageEnabled??false);setTargets([]);setError('')
    }
    function patch(id:number,values:Partial<CombatTarget>) {setTargets(current=>current.map(target=>target.id===id?{...target,...values}:target))}
    function changeMode(mode:CombatRequest['mode']) {setMode(mode);setTargets([]);if(mode==='none')setDamageEnabled(false)}
    async function submit(event:FormEvent) {
        event.preventDefault()
        if (working.current||!choices) return
        working.current=true;setBusy(true);setError('')
        const proposal={revision:choices.revision,key,option:optionId,cost:option?.cost??cost,mode,damageEnabled,targets:targets.map(({id,roll,hit,damageRoll,damage})=>({id,roll,hit,damageRoll,damage}))}
        const signature=JSON.stringify(proposal)
        if (attempt.current?.signature!==signature) attempt.current={signature,body:{id:crypto.randomUUID(),...proposal}}
        try {onUpdate(await playApi<Game>('/games/'+game.id+'/requests','POST',attempt.current.body));attempt.current=undefined;setKey('');setTargets([])} catch(error) {setError(message(error))} finally {working.current=false;setBusy(false)}
    }
    return <section className="play-player-actions" aria-labelledby="player-actions"><h2 id="player-actions">Le tue azioni</h2><p>Proponi un’azione nel tuo turno. Risorse ed effetti si applicano quando il Master approva.</p>
        <button type="button" className="play-secondary" aria-expanded={open} onClick={()=>{if(!open)refreshActions();setOpen(current=>!current)}}>{open?'Chiudi scelta azione':'Scegli azione'}</button>
        {open&&<>{loading&&<p role="status">Caricamento delle azioni…</p>}{stale&&<p role="status">La sessione è cambiata. Aggiorna le azioni prima di proporne una.</p>}{!loading&&<button type="button" className="play-secondary" disabled={busy} onClick={refreshActions}>Aggiorna azioni</button>}
            {pending&&<p role="status">Hai un’azione in attesa del Master.</p>}
            {choices&&<form onSubmit={event=>void submit(event)}><fieldset disabled={busy||pending||!!stale||loading}><legend>Proposta al Master</legend>
                <label>Azione<select aria-label="Azione" value={key} required onChange={event=>select(event.target.value)}><option value="">Scegli un’azione…</option>{choices.actions.map(action=><option key={action.key} value={action.key} disabled={!!action.error}>{action.name}{action.error?' · '+action.error:''}</option>)}</select></label>
                {!choices.actions.length&&<p>Nessuna azione disponibile: controlla attacchi, abilità e incantesimi salvati nella scheda.</p>}
                {action&&<><details><summary>Descrizione dell’azione</summary><p className="combat-request-description">{action.description||'Risoluzione da confermare con il Master.'}</p></details>
                    <InfoButton label="Descrizione" entry={action.entry} name={action.name} description={action.description} fields={{duration:action.duration,remainingTurns:action.remainingTurns,active:action.active,owner:game.character.sheet.name}}/>
                    <label>Risorsa<select aria-label="Risorsa" required value={optionId} onChange={event=>{const option=action.options.find(option=>option.id===event.target.value);setOptionId(event.target.value);setCost(option?.cost??action.cost)}}>{action.options.map(option=><option key={option.id} value={option.id} disabled={option.remaining!==null&&option.remaining<(option.cost??cost)}>{option.label}{option.remaining!==null?` · ${option.remaining} rimasti`:''}</option>)}</select></label>
                    {option&&!['free','cantrip','ritual'].includes(option.id)&&<label>Costo<input type="number" min="1" step="1" required readOnly={option.cost!==undefined} value={option.cost??cost} onChange={event=>setCost(Number(event.target.value))}/></label>}
                    <label>Risoluzione<select aria-label="Risoluzione" value={mode} onChange={event=>changeMode(event.target.value as CombatRequest['mode'])}>{Object.entries(modeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                    {mode!=='none'&&<label className="combat-request-check"><input type="checkbox" checked={damageEnabled} onChange={event=>{setDamageEnabled(event.target.checked);setTargets(current=>current.map(target=>({...target,damage:'0',damageRoll:''})))}}/>L’azione può infliggere danni</label>}
                    <p>Per più attacchi allo stesso bersaglio, indica tutti i tiri e somma i danni. Il Master conferma esiti, resistenze e altri effetti.</p>
                    <fieldset><legend>Bersagli{mode==='none'?' (facoltativi)':''}</legend>{choices.targets.map(target=><label className="combat-request-check" key={target.id}><input type="checkbox" checked={targets.some(selected=>selected.id===target.id)} onChange={event=>setTargets(current=>event.target.checked?[...current,{...target,roll:'',hit:false,damageRoll:'',damage:'0'}]:current.filter(selected=>selected.id!==target.id))}/>{target.name||'Partecipante'}</label>)}</fieldset>
                    {targets.map(target=><fieldset key={target.id}><legend>{target.name||'Partecipante'}</legend>
                        {(mode==='attack'||mode==='save')&&<label>{mode==='attack'?'Tiro per colpire (totale, con modificatori)':'Tiro salvezza / esito (anche da risolvere col Master)'}<input maxLength={500} required={mode==='attack'} value={target.roll} onChange={event=>patch(target.id,{roll:event.target.value})}/></label>}
                        {mode==='attack'&&target.roll.trim()&&<label className="combat-request-check"><input type="checkbox" checked={target.hit} onChange={event=>patch(target.id,{hit:event.target.checked,damageRoll:'',damage:'0'})}/>Almeno un attacco ha colpito (da confermare col Master)</label>}
                        {damageEnabled&&(mode!=='attack'||target.hit)&&<><label>Tiro dei danni<input required maxLength={500} placeholder="Es. 2d6: 4 + 3 = 7" value={target.damageRoll} onChange={event=>patch(target.id,{damageRoll:event.target.value})}/></label><label>Danni finali proposti<input required type="number" min="0" step="1" value={target.damage} onChange={event=>patch(target.id,{damage:event.target.value})}/></label></>}
                    </fieldset>)}
                    {(action.prolonged||optionId==='ritual')&&<p>Il Master potrà approvare solo dopo il completamento del lancio. Un lancio interrotto va rifiutato e non consuma risorse.</p>}
                    <button disabled={!option||!targets.length&&(damageEnabled||mode==='attack'||mode==='save')||option?.remaining!==null&&(option?.remaining??0)<(option?.cost??cost)}>Invia al Master</button>
                </>}
            </fieldset></form>}
        </>}{error&&<p role="alert">{error}</p>}
        <div className="combat-request-history" aria-live="polite">{game.combatRequests.map(request=><article className="combat-request" key={request.id}><h3>{request.actionName}</h3><RequestDescription request={request}/></article>)}</div>
    </section>
}
