import {useEffect,useState} from 'react'
import {playApi,type Game} from '../utils/PlayApi'
import {NotificationPopover} from './NotificationPopover'

type Event={id:string;sequence:number;createdAt:string;actorName:string;characterName?:string;label:string;kind?:'action'|'spell'|'reaction'|'turn'|'state';parentId?:string;countered:boolean;option?:string;result?:string;targets?:{id:number;name:string;result?:string}[];changes:{subject:string;label:string;before:string;after:string}[]}
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
        <p>Le azioni più recenti sono in cima. Apri le modifiche per vedere cosa è cambiato. {game.role==='player'&&'I dettagli riservati al Master sono nascosti.'}</p>
        {error&&<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Riprova</button></p>}
        <ol className="play-notification-list game-event-list">{page?.events.map(event=><GameEventCard key={event.id} event={event} parentSequence={page.events.find(e=>e.id===event.parentId)?.sequence}/>)}</ol>
        {!busy&&page?.events.length===0&&<p>Nessun evento registrato.</p>}
        {busy&&<p role="status">Caricamento del registro…</p>}
        {!!page?.events.length&&page.events.at(-1)!.sequence>1&&<button type="button" disabled={busy} onClick={()=>void older()}>Eventi precedenti</button>}
    </NotificationPopover>
}

function eventOption(option:string|undefined) {
    if(!option||option==='free')return undefined
    const slot=/^slot:([1-9])$/.exec(option)
    if(slot)return `Slot di ${slot[1]}° livello`
    return ({cantrip:'Trucchetto',pact:'Slot del Patto',ritual:'Rituale',mastery:'Maestria negli incantesimi',signature:'Incantesimo caratteristico'} as Record<string,string>)[option]??option
}

function GameEventCard({event,parentSequence}:{event:Event;parentSequence?:number}) {
    const targets=event.targets??[],directed=!!event.characterName&&targets.length>0
    const state=event.kind==='state'||event.kind==='turn'
    const kind=event.kind==='spell'?'Incantesimo':event.kind==='reaction'?'Reazione':event.kind==='turn'?'Turno':state?'Modifica':'Azione'
    const groups=new Map<string,Event['changes']>()
    for(const change of event.changes){
        const group=groups.get(change.subject)??[]
        group.push(change);groups.set(change.subject,group)
    }
    const option=eventOption(event.option)
    const title=state?`${event.actorName} · ${event.label}`:event.characterName?`${event.characterName} · ${event.label}`:event.label
    return <li id={'event-'+event.id} data-event-kind={event.kind??'action'}>
        <div className="game-event-meta"><span className="game-event-kind">{kind}</span><span>#{event.sequence}</span><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('it-IT')}</time><span className="game-event-author">Registrato da {event.actorName}</span></div>
        {directed?<h3 className="game-event-action" aria-label={`${event.characterName} usa ${event.label} su ${targets.map(t=>t.name).join(', ')}`}>
            <span className="game-event-person">{event.characterName}</span>
            <span className="game-event-direction"><span className="game-event-action-name">{event.label}</span><span className="game-event-arrow" aria-hidden="true"/></span>
            <span className="game-event-target-names">{targets.map(t=><span className="game-event-person" key={t.id}>{t.name}</span>)}</span>
        </h3>:<h3 className="game-event-title">{title}</h3>}
        {option&&<p className="game-event-option">{option}</p>}
        {event.countered&&<p className="counterspell-outcome">Lancio interrotto da Controincantesimo.</p>}
        {event.result&&<p className="game-event-result">{event.result}</p>}
        {targets.some(t=>t.result)&&<ul className="game-event-outcomes" aria-label="Esito sui bersagli">{targets.filter(t=>t.result).map(t=><li key={t.id}><strong>{t.name}</strong><p>{t.result}</p></li>)}</ul>}
        {!directed&&targets.length>0&&<p className="game-event-subjects">Bersagli: {targets.map(t=>t.name).join(', ')}</p>}
        {event.parentId&&<p className="library-help">Conseguenza dell’evento <a href={'#event-'+event.parentId}>{parentSequence??'collegato'}</a>.</p>}
        {event.changes.length>0&&<details className="game-event-changes" open={state}><summary>Modifiche applicate <span>({event.changes.length})</span></summary><div className="game-event-change-groups">{[...groups].map(([subject,changes])=><section className="game-event-change-group" key={subject}>
            <h4>{subject}</h4><dl>{changes.map((change,i)=><div key={i}><dt>{change.label}</dt><dd>{change.before===change.after?<span>{change.after==='Aggiornato'?'Stato aggiornato':change.after}</span>:<><span className="game-event-before">{change.before}</span><span className="game-event-change-arrow" aria-label="diventa"> → </span><strong>{change.after}</strong></>}</dd></div>)}</dl>
        </section>)}</div></details>}
    </li>
}