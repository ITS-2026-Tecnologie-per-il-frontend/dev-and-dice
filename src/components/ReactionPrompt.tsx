import {CounterspellForm} from './CounterspellForm'
import {counterspellId} from '../domain/dnd/Counterspell'
import {memo,useCallback,useMemo,useContext,useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react'
import {playApi,type ActionChoices,type Game,type MasterGame,type ReactionEvent,type ReactionWindow} from '../utils/PlayApi'
import {ReactionContext} from './ReactionContext'
import {ActionRollForm,type RollSubmission} from './CombatRolls'
import {ReviewRequest} from './CombatRequests'
import {directBenefit} from '../domain/dnd/CombatResolution'

const message=(error:unknown)=>error instanceof Error?error.message:'Operazione non riuscita.'

type ReactionClock={expiresAt:number;deadline:number}
function syncClock(clock:ReactionClock,expiresAt:number,serverNow:number){
    // Keep the same local deadline across delayed polls and collapsed/expanded panels.
    if(expiresAt<=clock.expiresAt)return
    clock.expiresAt=expiresAt
    clock.deadline=performance.now()+Math.max(0,expiresAt-serverNow)
}


export function ReactionProvider({game,onUpdate,disabled,children}:{game:Game;userId:string;onUpdate:(game:Game)=>void;disabled:boolean;children:ReactNode}){
    const current=useRef({game,onUpdate,disabled}),alive=useRef(true)
    const snapshot=useRef('')
    useLayoutEffect(()=>{current.current={game,onUpdate,disabled}})
    useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
    const before=useCallback(async(event:ReactionEvent)=>{
        const {game,onUpdate,disabled}=current.current
        if(game.role!=='master'||!game.characters.length)return true
        if(disabled)throw new Error('Attendi il salvataggio della sessione prima di risolvere l’evento.')
        const {game:next,groupId}=await playApi<{game:MasterGame;groupId:string}>(`/games/${game.id}/reactions`,'POST',{revision:game.revision,event})
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
    },[])
    const ready=useCallback((value:string)=>{snapshot.current=value},[])
    const pending=game.reactionWindows?.filter(w=>w.status==='pending'||w.status==='submitted')??[]
    const paused=!!pending.length
    const context=useMemo(()=>({paused,before,ready}),[paused,before,ready])
    const playerWindow=game.role==='player'?pending.find(w=>w.status==='pending'):undefined
    return <ReactionContext value={context}>
        {children}
        {playerWindow&&<ReactionDialog key={playerWindow.id} window={playerWindow} game={game} onUpdate={onUpdate}/>}
        {game.role==='master'&&!!pending.length&&<aside className="reaction-master-panels" aria-label="Reazioni da risolvere">{pending.map(window=><ReactionDialog key={window.id} window={window} game={game} onUpdate={onUpdate} disabled={disabled}/>)}</aside>}
    </ReactionContext>
}

export function MasterReactionControls({game,disabled}:{game:Game;disabled:boolean}){
    const {before}=useContext(ReactionContext),[busy,setBusy]=useState(false),[error,setError]=useState('')
    if(game.role!=='master')return null
    const pending=game.reactionWindows?.filter(w=>w.status==='pending'||w.status==='submitted')??[]
    return <div className="reaction-master-tools"><button type="button" className="play-secondary" disabled={disabled||busy||!!pending.length||!game.state.combat} onClick={async()=>{
        setBusy(true);setError('')
        try{await before({kind:'other',targetIds:[],label:'Il Master segnala una possibile reazione: verifica la condizione di attivazione nella descrizione.'})}catch(error){setError(message(error))}finally{setBusy(false)}
    }}>Segnala una reazione</button>{!!pending.length&&<p role="status">Reazioni in attesa: {pending.map(w=>`${w.characterName}${w.status==='submitted'?' (richiesta inviata al Master)':''}`).join(', ')}. Apri una reazione, saltala o attendi il giocatore e la scadenza.</p>}{error&&<p role="alert">{error}</p>}</div>
}

function ReactionDialog({window,game,onUpdate,disabled=false}:{window:ReactionWindow;game:Game;onUpdate:(game:Game)=>void;disabled?:boolean}){
    const heading=useId(),isMaster=game.role==='master',[expanded,setExpanded]=useState(false),[opened,setOpened]=useState(false)
    const dialog=useRef<HTMLDialogElement>(null),[choices,setChoices]=useState<ActionChoices>(),[key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
    const clock=useRef<ReactionClock>({expiresAt:0,deadline:0}),working=useRef(false),activity=useRef<Promise<void>>(Promise.resolve()),lastActivity=useRef(0)
    useLayoutEffect(()=>{syncClock(clock.current,window.expiresAt,window.serverNow)},[window.expiresAt,window.serverNow])
    useEffect(()=>{dialog.current?.showModal()},[])
    const needsChoices=!isMaster||opened
    useEffect(()=>{if(window.status!=='pending'||!needsChoices)return;let active=true;void playApi<ActionChoices>(`/games/${game.id}/reactions/${window.id}/actions`).then(next=>{if(active){setChoices(next);setKey(current=>current||next.actions[0]?.key||'')}}).catch(e=>{if(active)setError(message(e))});return()=>{active=false}},[game.id,game.revision,window.id,window.status,needsChoices])
    async function decline(){
        if(working.current)return
        working.current=true;setBusy(true)
        try{await activity.current;onUpdate(await playApi<Game>(window.status==='submitted'?`/games/${game.id}/requests/${window.requestId}/reject`:`/games/${game.id}/reactions/${window.id}/decline`,'POST',window.status==='submitted'?{revision:game.revision}:{}))}catch(e){setError(message(e))}finally{working.current=false;setBusy(false)}
    }
    function interact(){
        if(window.status!=='pending'||busy||working.current||clock.current.deadline<=performance.now()||performance.now()-lastActivity.current<200)return
        lastActivity.current=performance.now()
        activity.current=activity.current.catch(()=>{}).then(async()=>{
            const next=await playApi<Game>(`/games/${game.id}/reactions/${window.id}/activity`,'POST',{});onUpdate(next)
        }).catch(e=>setError(message(e)))
    }
    const action=choices?.actions.find(a=>a.key===key)
    const latest=useRef({game,onUpdate,choices,action,isMaster,window})
    useLayoutEffect(()=>{latest.current={game,onUpdate,choices,action,isMaster,window}})
    const submitReaction=useCallback(async(draft:RollSubmission)=>{
        const {game,onUpdate,choices,action,isMaster,window}=latest.current
        if(!choices||!action||working.current)return
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
    },[])
    const request=game.combatRequests.find(r=>r.id===window.requestId)
    const content=window.status==='submitted'?<>
        <h2 id={heading}>Reazione di {window.characterName}</h2><p>Scelta confermata. Il timer è fermo: completa la risoluzione prima di proseguire.</p>
        {request&&<ReviewRequest request={request} disabled={disabled||busy} onDecide={async(id,decision,body)=>onUpdate(await playApi<Game>(`/games/${game.id}/requests/${id}/${decision}`,'POST',{...body as object,revision:game.revision}))}/>}</>:<>
        <div className="dialog-header"><h2 id={heading}>{isMaster?`Reazione di ${window.characterName}`:'Puoi usare una reazione'}</h2>{!isMaster&&<button type="button" className="play-secondary" aria-label="Non usare la reazione" disabled={busy} onClick={()=>void decline()}>×</button>}</div>
        <p>{window.event.label}</p>
        <ReactionCountdown window={window} clock={clock} running={!isMaster||expanded} busy={busy} onRestart={interact}/>
        <p className="library-help">{isMaster?'Puoi scegliere al posto del giocatore. Il timer è condiviso: ogni interazione qui o nel popup del giocatore lo riporta a 30 secondi. Alla scadenza si prosegue senza usare la reazione.':'Hai 30 secondi di inattività. Interagire con questa finestra fa ripartire il timer. Alla scadenza prosegui senza usare la reazione.'}</p>
        {!choices&&!error&&<p role="status">Caricamento delle reazioni…</p>}
        <label>Reazione<select aria-label="Reazione" disabled={busy||!choices} value={key} onChange={event=>setKey(event.target.value)}>{choices?.actions.filter(a=>window.actionKeys.includes(a.key)).map(a=><option value={a.key} key={a.key}>{a.name}</option>)}</select></label>
        {choices&&action&&(action.entry?.data.referenceId===counterspellId&&action.entry.data.edition==='2014'?<CounterspellForm game={game} ownerId={choices.ownerId!} reactionId={window.id} onUpdate={onUpdate} disabled={busy||disabled}/>:<ReactionRollForm key={action.key} action={action} targets={choices.targets} ownerId={choices.ownerId} canSubmit={true} disabled={busy||disabled} label={`Reazione: ${action.name}`} submitLabel={isMaster?'Usa la reazione':'Usa la reazione · invia al Master'} onSubmit={submitReaction}/>) }
        {!isMaster&&error&&<p role="alert">{error}</p>}
        <button type="button" className="play-secondary" disabled={busy} onClick={()=>void decline()}>Non usare la reazione</button>
    </>
    return isMaster?<section className="reaction-master-panel play-player-actions" aria-label={`Reazione di ${window.characterName}`}>
        <div className="reaction-master-shortcuts"><button type="button" className="play-secondary" aria-expanded={expanded} aria-controls={`${heading}-panel`} disabled={busy} onClick={()=>{setOpened(true);setExpanded(open=>!open)}}>{expanded?'Chiudi':'Apri'} reazione · {window.characterName}</button><button type="button" className="play-secondary" disabled={busy} onClick={()=>void decline()}>Salta reazione</button></div>
        {!expanded&&<p className="reaction-master-wait">{window.status==='pending'?<><ReactionCountdown window={window} clock={clock} compact/></>:'Scelta inviata · Da approvare'}</p>}
        <div id={`${heading}-panel`} hidden={!expanded} onPointerDownCapture={interact} onKeyDownCapture={interact} onInputCapture={interact}>{opened&&content}</div>
        {error&&<p role="alert">{error}</p>}
    </section>:<dialog ref={dialog} className="reaction-dialog play-player-actions" aria-labelledby={heading} onCancel={event=>{event.preventDefault();void decline()}} onPointerDownCapture={interact} onKeyDownCapture={interact} onInputCapture={interact}>{content}</dialog>
}

// Keep the shared clock independent from the roll fields and their target lists.
function ReactionCountdown({window,clock,busy=false,onRestart,compact=false,running=true}:{window:Pick<ReactionWindow,'expiresAt'|'serverNow'>;clock:{current:ReactionClock};busy?:boolean;onRestart?:()=>void;compact?:boolean;running?:boolean}){
    const [remaining,setRemaining]=useState(30)
    useLayoutEffect(()=>{
        syncClock(clock.current,window.expiresAt,window.serverNow)
        // eslint-disable-next-line react/set-state-in-effect -- Synchronize the renewed server deadline before paint.
        setRemaining(Math.max(0,Math.ceil((clock.current.deadline-performance.now())/1000)))
    },[window.expiresAt,window.serverNow,clock])
    useEffect(()=>{
        if(!running)return
        const tick=()=>setRemaining(Math.max(0,Math.ceil((clock.current.deadline-performance.now())/1000)))
        tick()
        const timer=setInterval(tick,250)
        return()=>clearInterval(timer)
    },[running,clock])
    const timer=<strong role="timer" aria-label="Tempo rimasto per reagire">{remaining} s</strong>
    return compact?<>{timer} · In attesa della scelta</>:<div className="reaction-countdown">{timer}<button type="button" className="play-secondary" aria-label="Riavvia timer" disabled={busy||remaining===0} onClick={onRestart}>Riavvia</button><progress max={30} value={remaining} aria-label="Tempo rimasto"/></div>
}

const ReactionRollForm=memo(ActionRollForm)
