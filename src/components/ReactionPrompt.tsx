import {useContext,useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react'
import {playApi,type ActionChoices,type Game,type MasterGame,type ReactionEvent,type ReactionWindow} from '../utils/PlayApi'
import {ReactionContext} from './ReactionContext'
import {ActionRollForm} from './CombatRolls'
import {ReviewRequest} from './CombatRequests'
import {directBenefit} from '../domain/dnd/CombatResolution'

const message=(error:unknown)=>error instanceof Error?error.message:'Operazione non riuscita.'

export function ReactionProvider({game,onUpdate,disabled,children}:{game:Game;userId:string;onUpdate:(game:Game)=>void;disabled:boolean;children:ReactNode}){
    const current=useRef(game),alive=useRef(true)
    const snapshot=useRef('')
    useLayoutEffect(()=>{current.current=game})
    useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
    async function before(event:ReactionEvent){
        if(current.current.role!=='master'||!current.current.characters.length)return true
        if(disabled)throw new Error('Attendi il salvataggio della sessione prima di risolvere l’evento.')
        const {game:next,groupId}=await playApi<{game:MasterGame;groupId:string}>(`/games/${game.id}/reactions`,'POST',{revision:current.current.revision,event})
        onUpdate(next)
        if(!next.reactionWindows?.some(w=>w.groupId===groupId))return true
        {
            let updated:Game=next
            while(alive.current&&updated.reactionWindows?.some(w=>w.groupId===groupId&&(w.status==='pending'||w.status==='submitted'))){
                await new Promise(resolve=>setTimeout(resolve,500))
                if(!alive.current)return false
                updated=await playApi<Game>(`/games/${game.id}`);onUpdate(updated)
            }
            // Resume only after the tracker and its forms commit the authoritative snapshot.
            if(updated.role==='master'){
                const expected=JSON.stringify({state:updated.state,sheets:updated.characters.map(c=>c.sheet)}),start=performance.now()
                while(alive.current&&snapshot.current!==expected){
                    if(performance.now()-start>5000)throw new Error('Attendi la sincronizzazione della sessione e riprova: nessun danno applicato.')
                    await new Promise(resolve=>requestAnimationFrame(resolve))
                }
            }
            return alive.current
        }
    }
    const pending=game.reactionWindows?.filter(w=>w.status==='pending'||w.status==='submitted')??[]
    return <ReactionContext value={{paused:!!pending.length,before,ready:value=>{snapshot.current=value}}}>
        {children}
        {game.role==='player'&&pending.find(w=>w.status==='pending')&&<ReactionDialog key={pending.find(w=>w.status==='pending')!.id} window={pending.find(w=>w.status==='pending')!} game={game} onUpdate={onUpdate}/>}
        {game.role==='master'&&!!pending.length&&<aside className="reaction-master-panels" aria-label="Reazioni da risolvere">{pending.map(window=>{
            if(window.status==='pending')return <ReactionDialog key={window.id} window={window} game={game} onUpdate={onUpdate} disabled={disabled}/>
            const request=game.combatRequests.find(r=>r.id===window.requestId)
            return <section key={window.id} className="reaction-master-panel"><h2>Reazione di {window.characterName}</h2><p>Scelta confermata. Il timer è fermo: completa la risoluzione prima di proseguire.</p>{request&&<ReviewRequest request={request} disabled={disabled} onDecide={async(id,decision,body)=>onUpdate(await playApi<Game>(`/games/${game.id}/requests/${id}/${decision}`,'POST',{...body as object,revision:current.current.revision}))}/>}</section>
        })}</aside>}
    </ReactionContext>
}

export function MasterReactionControls({game,disabled}:{game:Game;disabled:boolean}){
    const {before}=useContext(ReactionContext),[busy,setBusy]=useState(false),[error,setError]=useState('')
    if(game.role!=='master')return null
    const pending=game.reactionWindows?.filter(w=>w.status==='pending'||w.status==='submitted')??[]
    return <div className="reaction-master-tools"><button type="button" className="play-secondary" disabled={disabled||busy||!!pending.length||!game.state.combat} onClick={async()=>{
        setBusy(true);setError('')
        try{await before({kind:'other',targetIds:[],label:'Il Master segnala una possibile reazione: verifica la condizione di attivazione nella descrizione.'})}catch(error){setError(message(error))}finally{setBusy(false)}
    }}>Segnala una reazione</button>{!!pending.length&&<p role="status">Reazioni in attesa: {pending.map(w=>`${w.characterName}${w.status==='submitted'?' (richiesta inviata al Master)':''}`).join(', ')}. Scegli nel pannello delle reazioni o attendi il giocatore.</p>}{error&&<p role="alert">{error}</p>}</div>
}

function ReactionDialog({window,game,onUpdate,disabled=false}:{window:ReactionWindow;game:Game;onUpdate:(game:Game)=>void;disabled?:boolean}){
    const heading=useId(),panel=useRef<HTMLElement>(null),isMaster=game.role==='master'
    const dialog=useRef<HTMLDialogElement>(null),[choices,setChoices]=useState<ActionChoices>(),[key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
    const [remaining,setRemaining]=useState(30),deadline=useRef(0),working=useRef(false),activity=useRef<Promise<void>>(Promise.resolve()),lastActivity=useRef(0)
    useLayoutEffect(()=>{deadline.current=performance.now()+Math.max(0,window.expiresAt-window.serverNow)},[window.expiresAt,window.serverNow])
    useEffect(()=>{dialog.current?.showModal();panel.current?.scrollIntoView({block:'nearest'})},[])
    useEffect(()=>{let active=true;void playApi<ActionChoices>(`/games/${game.id}/reactions/${window.id}/actions`).then(next=>{if(active){setChoices(next);setKey(current=>current||next.actions[0]?.key||'')}}).catch(e=>{if(active)setError(message(e))});return()=>{active=false}},[game.id,game.revision,window.id])
    async function decline(){
        if(working.current)return
        working.current=true;setBusy(true)
        try{await activity.current;onUpdate(await playApi<Game>(`/games/${game.id}/reactions/${window.id}/decline`,'POST',{}))}catch(e){setError(message(e))}finally{working.current=false;setBusy(false)}
    }
    // The server expires the shared window; a stale timer on either client must not decline the other client's renewed window.
    useEffect(()=>{const timer=setInterval(()=>setRemaining(Math.max(0,Math.ceil((deadline.current-performance.now())/1000))),250);return()=>clearInterval(timer)},[])
    function interact(){
        if(busy||working.current||deadline.current<=performance.now()||performance.now()-lastActivity.current<200)return
        lastActivity.current=performance.now()
        deadline.current=performance.now()+30000;setRemaining(30)
        activity.current=activity.current.catch(()=>{}).then(async()=>{
            const next=await playApi<Game>(`/games/${game.id}/reactions/${window.id}/activity`,'POST',{});onUpdate(next)
        }).catch(e=>setError(message(e)))
    }
    const action=choices?.actions.find(a=>a.key===key)
    const content=<>
        <div className="dialog-header"><h2 id={heading}>{isMaster?`Reazione di ${window.characterName}`:'Puoi usare una reazione'}</h2>{!isMaster&&<button type="button" className="play-secondary" aria-label="Non usare la reazione" disabled={busy} onClick={()=>void decline()}>×</button>}</div>
        <p>{window.event.label}</p>
        <div className="reaction-countdown"><strong role="timer" aria-label="Tempo rimasto per reagire">{remaining} s</strong><progress max={30} value={remaining} aria-label="Tempo rimasto"/></div>
        <p className="library-help">{isMaster?'Puoi scegliere al posto del giocatore. Il timer è condiviso: ogni interazione qui o nel popup del giocatore lo riporta a 30 secondi. Alla scadenza si prosegue senza usare la reazione.':'Hai 30 secondi di inattività. Interagire con questa finestra fa ripartire il timer. Alla scadenza prosegui senza usare la reazione.'}</p>
        <label>Reazione<select aria-label="Reazione" disabled={busy} value={key} onChange={event=>setKey(event.target.value)}>{choices?.actions.filter(a=>window.actionKeys.includes(a.key)).map(a=><option value={a.key} key={a.key}>{a.name}</option>)}</select></label>
        {choices&&action&&<ActionRollForm key={action.key} action={action} targets={choices.targets} ownerId={choices.ownerId} canSubmit={true} disabled={busy||disabled} label={`Reazione: ${action.name}`} submitLabel={isMaster?'Usa la reazione':'Usa la reazione · invia al Master'} onSubmit={async draft=>{
            if(working.current)return
            working.current=true;setBusy(true)
            try{
                await activity.current
                const id=crypto.randomUUID()
                let next=await playApi<Game>(`/games/${game.id}/requests`,'POST',{id,revision:choices.revision,key:action.key,reactionId:window.id,...draft})
                onUpdate(next)
                const request=next.combatRequests.find(r=>r.id===id)
                if(isMaster&&request&&directBenefit(request.resolution)&&!request.resolution?.weaponEffect&&!request.additionalActionRequired&&request.targets.every(t=>typeof t.resolution?.damage==='number')){
                    next=await playApi<Game>(`/games/${game.id}/requests/${id}/approve`,'POST',{revision:next.revision,confirmed:true,targets:request.targets.map(t=>({id:t.id,damage:String(t.resolution!.damage)}))});onUpdate(next)
                }
            }finally{working.current=false;setBusy(false)}
        }}/> }
        {error&&<p role="alert">{error}</p>}
        <button type="button" className="play-secondary" disabled={busy} onClick={()=>void decline()}>Non usare la reazione</button>
    </>
    return isMaster?<section ref={panel} className="reaction-master-panel play-player-actions" aria-labelledby={heading} onPointerDownCapture={interact} onKeyDownCapture={interact} onInputCapture={interact}>{content}</section>:<dialog ref={dialog} className="reaction-dialog play-player-actions" aria-labelledby={heading} onCancel={event=>{event.preventDefault();void decline()}} onPointerDownCapture={interact} onKeyDownCapture={interact} onInputCapture={interact}>{content}</dialog>
}
