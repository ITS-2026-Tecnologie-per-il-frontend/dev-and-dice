import {useEffect,useState} from 'react'
import {playApi,type Game} from '../utils/PlayApi'
import {NotificationPopover} from './NotificationPopover'

type Event={id:string;sequence:number;createdAt:string;actorName:string;characterName?:string;label:string;parentId?:string;countered:boolean;option?:string;result?:string;targets?:{id:number;name:string;result?:string}[];changes:{subject:string;label:string;before:string;after:string}[]}
type Page={events:Event[];sequence:number}
export function GameEventLog({game}:{game:Game}){
    const [open,setOpen]=useState(false),[page,setPage]=useState<Page>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0)
    const endpoint=`/games/${game.id}/events`
    useEffect(()=>{
        if(!open)return
        let alive=true
        // eslint-disable-next-line react/set-state-in-effect -- Reload the persisted feed when its server sequence changes.
        setBusy(true)
        void playApi<Page>(endpoint).then(value=>{if(alive){setPage(value);setError('')}}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setBusy(false)})
        return()=>{alive=false}
    },[open,endpoint,game.eventSequence,game.revision,game.requestsRevision,retry])
    async function older(){
        if(!page?.events.length||busy)return
        const current=page
        setBusy(true)
        try{const next=await playApi<Page>(endpoint+'?before='+page.events.at(-1)!.sequence);setPage(value=>value===current?{...next,events:[...current.events,...next.events]}:value);setError('')}catch(e){setError(e instanceof Error?e.message:'Registro non disponibile.')}finally{setBusy(false)}
    }
    return <NotificationPopover id="game-event-log" title="Registro degli eventi" label="Registro degli eventi" closeLabel="Chiudi registro degli eventi" iconPath="M5 3h14v18H5zM8 7h8M8 12h8M8 17h5" open={open} onOpenChange={setOpen}>
        <p>Azioni e modifiche confermate, nell’ordine del server. {game.role==='player'&&'I dettagli riservati al Master sono nascosti.'}</p>
        {error&&<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Riprova</button></p>}
        <ol className="play-notification-list game-event-list">{page?.events.map(event=><li key={event.id} id={'event-'+event.id}>
            <p className="game-event-meta">#{event.sequence} · {event.actorName} · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('it-IT')}</time></p>
            <h3>{event.characterName&&<>{event.characterName} · </>}{event.label}</h3>
            {event.countered&&<p className="counterspell-outcome">Lancio interrotto da Controincantesimo.</p>}
            {event.option&&<p>{event.option}</p>}{event.result&&<p>{event.result}</p>}
            {!!event.targets?.length&&<ul>{event.targets.map(t=><li key={t.id}><strong>{t.name}</strong>{t.result&&<> · {t.result}</>}</li>)}</ul>}
            {event.parentId&&<p className="library-help">Conseguenza dell’evento <a href={'#event-'+event.parentId}>{page.events.find(e=>e.id===event.parentId)?.sequence??'collegato'}</a>.</p>}
            {!!event.changes.length&&<details open><summary>Modifiche effettive ({event.changes.length})</summary><ul>{event.changes.map((change,i)=><li key={i}><strong>{change.subject} · {change.label}</strong><span>{change.before} → {change.after}</span></li>)}</ul></details>}
        </li>)}</ol>
        {!busy&&page?.events.length===0&&<p>Nessun evento registrato.</p>}
        {busy&&<p role="status">Caricamento del registro…</p>}
        {!!page?.events.length&&page.events.at(-1)!.sequence>1&&<button type="button" disabled={busy} onClick={()=>void older()}>Eventi precedenti</button>}
    </NotificationPopover>
}
