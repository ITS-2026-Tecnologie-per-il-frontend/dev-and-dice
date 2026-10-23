import {useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react'
import {playApi,type ActionChoices,type Game,type MasterGame,type ReactionEvent,type ReactionWindow} from '../utils/PlayApi'
import {ReactionContext} from './ReactionContext'
import {ActionRollForm} from './CombatRolls'

const message=(error:unknown)=>error instanceof Error?error.message:'Operazione non riuscita.'

export function ReactionProvider({game,userId,onUpdate,disabled,children}:{game:Game;userId:string;onUpdate:(game:Game)=>void;disabled:boolean;children:ReactNode}){
    const current=useRef(game),alive=useRef(true)
    const snapshot=useRef('')
    useLayoutEffect(()=>{current.current=game})
    useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
    async function before(event:ReactionEvent){
        if(current.current.role!=='master'||!current.current.characters.some(record=>record.ownerId!==userId))return true
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
    </ReactionContext>
}

export function MasterReactionControls({game,disabled}:{game:Game;disabled:boolean}){
    const {before}=useContext(ReactionContext),[busy,setBusy]=useState(false),[error,setError]=useState('')
    if(game.role!=='master')return null
    const pending=game.reactionWindows?.filter(w=>w.status==='pending'||w.status==='submitted')??[]
    return <div className="reaction-master-tools"><button type="button" className="play-secondary" disabled={disabled||busy||!!pending.length||!game.state.combat} onClick={async()=>{
        setBusy(true);setError('')
        try{await before({kind:'other',targetIds:[],label:'Il Master segnala una possibile reazione: verifica la condizione di attivazione nella descrizione.'})}catch(error){setError(message(error))}finally{setBusy(false)}
    }}>Segnala una reazione</button>{!!pending.length&&<p role="status">Reazioni in attesa: {pending.map(w=>`${w.characterName}${w.status==='submitted'?' (richiesta inviata al Master)':''}`).join(', ')}. Risolvi le richieste nelle notifiche prima di proseguire.</p>}{error&&<p role="alert">{error}</p>}</div>
}

function ReactionDialog({window,game,onUpdate}:{window:ReactionWindow;game:Game;onUpdate:(game:Game)=>void}){
    const dialog=useRef<HTMLDialogElement>(null),[choices,setChoices]=useState<ActionChoices>(),[key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
    const [remaining,setRemaining]=useState(30),deadline=useRef(0),working=useRef(false),activity=useRef<Promise<void>>(Promise.resolve()),lastActivity=useRef(0)
    useLayoutEffect(()=>{deadline.current=performance.now()+Math.max(0,window.expiresAt-window.serverNow)},[window.expiresAt,window.serverNow])
    useEffect(()=>{dialog.current?.showModal()},[])
    useEffect(()=>{let active=true;void playApi<ActionChoices>(`/games/${game.id}/actions?preview=1`).then(next=>{if(active){setChoices(next);setKey(current=>current||next.actions.find(a=>window.actionKeys.includes(a.key))?.key||'')}}).catch(e=>{if(active)setError(message(e))});return()=>{active=false}},[game.id,game.revision,window.actionKeys])
    async function decline(){
        if(working.current)return
        working.current=true;setBusy(true)
        try{await activity.current;onUpdate(await playApi<Game>(`/games/${game.id}/reactions/${window.id}/decline`,'POST',{}))}catch(e){setError(message(e))}finally{working.current=false;setBusy(false)}
    }
    useEffect(()=>{const timer=setInterval(()=>{const seconds=Math.max(0,Math.ceil((deadline.current-performance.now())/1000));setRemaining(seconds);if(!seconds&&!working.current)void decline()},250);return()=>clearInterval(timer)})
    function interact(){
        if(busy||working.current||deadline.current<=performance.now()||performance.now()-lastActivity.current<200)return
        lastActivity.current=performance.now()
        deadline.current=performance.now()+30000;setRemaining(30)
        activity.current=activity.current.catch(()=>{}).then(async()=>{
            const next=await playApi<Game>(`/games/${game.id}/reactions/${window.id}/activity`,'POST',{});onUpdate(next)
        }).catch(e=>setError(message(e)))
    }
    const action=choices?.actions.find(a=>a.key===key)
    return <dialog ref={dialog} className="reaction-dialog play-player-actions" aria-labelledby="reaction-heading" onCancel={event=>{event.preventDefault();void decline()}} onPointerDownCapture={interact} onKeyDownCapture={interact} onInputCapture={interact}>
        <div className="dialog-header"><h2 id="reaction-heading">Puoi usare una reazione</h2><button type="button" className="play-secondary" aria-label="Non usare la reazione" disabled={busy} onClick={()=>void decline()}>×</button></div>
        <p>{window.event.label}</p>
        <div className="reaction-countdown"><strong role="timer" aria-label="Tempo rimasto per reagire">{remaining} s</strong><progress max={30} value={remaining} aria-label="Tempo rimasto"/></div>
        <p className="library-help">Hai 30 secondi di inattività. Interagire con questa finestra fa ripartire il timer. Alla scadenza prosegui senza usare la reazione.</p>
        <label>Reazione<select aria-label="Reazione" disabled={busy} value={key} onChange={event=>setKey(event.target.value)}>{choices?.actions.filter(a=>window.actionKeys.includes(a.key)).map(a=><option value={a.key} key={a.key}>{a.name}</option>)}</select></label>
        {choices&&action&&<ActionRollForm key={action.key} action={action} targets={choices.targets} ownerId={choices.ownerId} canSubmit={true} disabled={busy} label={`Reazione: ${action.name}`} submitLabel="Usa la reazione · invia al Master" onSubmit={async draft=>{
            if(working.current)return
            working.current=true;setBusy(true)
            try{
                await activity.current
                const next=await playApi<Game>(`/games/${game.id}/requests`,'POST',{id:crypto.randomUUID(),revision:choices.revision,key:action.key,reactionId:window.id,...draft})
                onUpdate(next)
            }finally{working.current=false;setBusy(false)}
        }}/> }
        {error&&<p role="alert">{error}</p>}
        <button type="button" className="play-secondary" disabled={busy} onClick={()=>void decline()}>Non usare la reazione</button>
    </dialog>
}
