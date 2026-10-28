import {ReactionCountdown,type ReactionClock,useReactionActivity} from './ReactionCountdown'
import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {playApi,type Game,type CombatRequest} from '../utils/PlayApi'
import {resolveCounterspell,type CounterspellChoices,type CounterspellSnapshot,type CounterspellDecision} from '../domain/dnd/Counterspell'
import {saveNames} from '../domain/dnd/CombatResolution'
import {signedBonus} from '../utils/CharacterSheets'
import {ActionButton} from './ActionButton'
import {HelpTooltip} from './HelpTooltip'
import type {RequestDecision} from './CombatRolls'
import '../Counterspell.css'

const number=(value:string)=>value===''?undefined:Number(value)
function preview(snapshot:CounterspellSnapshot,decision:CounterspellDecision){
    try{return resolveCounterspell(snapshot.slotLevel,snapshot.target.level??decision.level!,snapshot.modifier.total,decision)}catch{return undefined}
}
function resolutionReason(snapshot:CounterspellSnapshot,decision:CounterspellDecision){
    if(snapshot.target.level===undefined&&decision.level===undefined)return 'Indica il livello del lancio avversario, da 0 a 9.'
    try{resolveCounterspell(snapshot.slotLevel,snapshot.target.level??decision.level!,snapshot.modifier.total,decision);return undefined}catch(e){return e instanceof Error?e.message:'Verifica i dati della prova.'}
}
export function CounterspellSummary({snapshot}:{snapshot:CounterspellSnapshot}){
    const result=snapshot.result
    return <div className="counterspell-summary" role="status">
        <p><strong>{snapshot.target.casterName}</strong>{snapshot.target.name&&<> · {snapshot.target.name}</>}</p>
        {result&&<><p><strong>{result.success?'Incantesimo interrotto':'Controincantesimo fallito'}</strong></p>
            {result.automatic?<p>Interruzione automatica: il lancio avversario non supera lo slot usato.</p>:<p>Prova: {result.die}{result.secondDie!==undefined&&<> / {result.secondDie} ({result.rollMode==='advantage'?'vantaggio':'svantaggio'})</>} {signedBonus(result.modifier??0)} {result.bonus?`${signedBonus(result.bonus)} (${result.bonusReason})`:''} = <strong>{result.total}</strong> · CD {result.dc}</p>}
            <p>Slot di {result.slotLevel}° livello e reazione consumati.</p></>}
    </div>
}
export function CounterspellResolution({snapshot,value,onChange}:{snapshot:CounterspellSnapshot;value:CounterspellDecision;onChange:(value:CounterspellDecision)=>void}){
    const level=snapshot.target.level??value.level,needsCheck=level!==undefined&&level>snapshot.slotLevel,result=preview(snapshot,value)
    const update=(patch:Partial<CounterspellDecision>)=>onChange({...value,...patch})
    return <div className="counterspell-resolution">
        <p className="library-help">Livello del lancio avversario riservato al Master durante la richiesta.</p>
        {snapshot.target.level===undefined?<><label>Incantesimo avversario (se noto)<input maxLength={200} value={value.spellName??''} onChange={e=>update({spellName:e.target.value})}/></label><label>Livello del lancio avversario<input aria-label="Livello del lancio avversario" type="number" min="0" max="9" step="1" required value={value.level??''} onChange={e=>update({level:number(e.target.value)})}/></label><p className="library-help">Indica il livello a cui viene lanciato, incluso uno slot superiore. Per un trucchetto usa 0.</p></>:<p>Livello del lancio avversario: <strong>{snapshot.target.level}</strong></p>}
        {level!==undefined&&level<=snapshot.slotLevel&&<p className="counterspell-outcome">Interruzione automatica · nessun tiro richiesto.</p>}
        {needsCheck&&<fieldset className="counterspell-check"><legend>Prova di caratteristica · CD {10+level}</legend>
            <p>Il lanciatore di Controincantesimo tira il d20; il Master ne registra il risultato.</p>
            <div className="counterspell-modifier"><span>Modificatore {snapshot.modifier.ability?`· ${saveNames[snapshot.modifier.ability]}`:''}: <strong>{snapshot.modifier.total===undefined?'da verificare':signedBonus(snapshot.modifier.total)}</strong></span><HelpTooltip label="Dettaglio modificatore di Controincantesimo">{snapshot.modifier.sources.map(s=><p key={s.label}>{s.label}: {signedBonus(s.amount)}</p>)}<p>La competenza non si aggiunge automaticamente. Questa prova non usa il bonus per colpire con incantesimi.</p></HelpTooltip></div>
            {snapshot.modifier.total===undefined&&<label>Modificatore verificato dal Master<input type="number" min="-100" max="100" step="1" required value={value.modifierOverride??''} onChange={e=>update({modifierOverride:number(e.target.value)})}/></label>}
            <label>Modalità della prova<select value={value.rollMode??'normal'} onChange={e=>update({rollMode:e.target.value as CounterspellDecision['rollMode'],die:undefined,secondDie:undefined})}><option value="normal">Normale</option><option value="advantage">Con vantaggio</option><option value="disadvantage">Con svantaggio</option></select></label>
            <label>Risultato del d20<input aria-label="Risultato del d20 di Controincantesimo" type="number" min="1" max="20" step="1" required value={value.die??''} onChange={e=>update({die:number(e.target.value)})}/></label>
            {value.rollMode&&value.rollMode!=='normal'&&<label>Secondo d20<input type="number" min="1" max="20" step="1" required value={value.secondDie??''} onChange={e=>update({secondDie:number(e.target.value)})}/></label>}
            <label>Altri modificatori<input type="number" min="-100" max="100" step="1" value={value.bonus??0} onChange={e=>update({bonus:number(e.target.value)??0})}/></label>
            {!!value.bonus&&<label>Provenienza degli altri modificatori<input required maxLength={300} value={value.bonusReason??''} placeholder="Es. risultato di Guida, penalità o privilegio" onChange={e=>update({bonusReason:e.target.value})}/></label>}
            <p className="library-help">È una prova di caratteristica, senza successo o fallimento automatico con 20 o 1 naturale.</p>
            {result&&<output className="counterspell-outcome">Totale {result.total} contro CD {result.dc} · {result.success?'Incantesimo interrotto':'Controincantesimo fallito'}</output>}
        </fieldset>}
    </div>
}
function Requirements({checked,onChange}:{checked:boolean;onChange:(checked:boolean)=>void}){
    return <label className="ability-check counterspell-requirements"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span>Confermo: vedo la creatura entro 18 metri mentre lancia un incantesimo e posso eseguire la componente somatica.</span></label>
}
export function CounterspellForm({game,ownerId,onUpdate,disabled=false,reactionId}:{game:Game;ownerId:number;onUpdate:(game:Game)=>void;disabled?:boolean;reactionId?:string}){
    const [choices,setChoices]=useState<CounterspellChoices>(),[targetKey,setTargetKey]=useState(''),[option,setOption]=useState(''),[confirmed,setConfirmed]=useState(false),[decision,setDecision]=useState<CounterspellDecision>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[receipt,setReceipt]=useState<CounterspellSnapshot>()
    const attempt=useRef<{signature:string;id:string}>(undefined),working=useRef(false),master=game.role==='master'
    const reactionAvailability=game.reactionWindows?.map(w=>`${w.id}:${w.status}:${w.actionKeys.join(',')}`).join('|'),opportunities=game.spellOpportunities?.map(t=>t.key).join('|'),requestStatuses=game.combatRequests.map(r=>`${r.id}:${r.status}`).join('|')
    const query=`/games/${game.id}/counterspell?actorId=${ownerId}${reactionId?'&reactionId='+encodeURIComponent(reactionId):''}`
    useEffect(()=>{let alive=true;void playApi<CounterspellChoices>(query).then(c=>{if(!alive)return;setChoices(c);setError('');setTargetKey(current=>c.targets.some(t=>t.key===current)?current:c.targets.filter(t=>!t.key.startsWith('manual:')).length===1?c.targets.find(t=>!t.key.startsWith('manual:'))!.key:'');setOption(current=>c.options.some(o=>o.id===current)?current:c.options.find(o=>o.remaining===null||o.remaining>=(o.cost??1))?.id??c.options[0]?.id??'')}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[query,game.revision,requestStatuses,opportunities,game.eventSequence,retry,reactionAvailability])
    const selected=choices?.targets.find(t=>t.key===targetKey),resource=choices?.options.find(o=>o.id===option)
    const popup=game.reactionWindows?.find(w=>w.id===reactionId),live=game.spellOpportunities?.find(t=>t.key===selected?.key)
    const timing=popup?{mode:selected?.window?.mode??'timer',seconds:popup.actionSeconds?.[choices?.actionKey??'']??selected?.window?.seconds??30,expiresAt:popup.actionExpiresAt?.[choices?.actionKey??'']??popup.expiresAt}:live?.window??selected?.window
    const clock=useRef<ReactionClock>({expiresAt:0,deadline:0}),clockKey=useRef(targetKey)
    useLayoutEffect(()=>{if(clockKey.current!==targetKey){clock.current={expiresAt:0,deadline:0};clockKey.current=targetKey}},[targetKey])
    const activity=useReactionActivity(async()=>{
        const target=targetKey||choices?.targets[0]?.key
        if(!target)return
        onUpdate(await playApi<Game>(`/games/${game.id}/counterspell/activity`,'POST',{actorId:ownerId,targetKey:target,...(reactionId?{reactionId}:{})}))
    },!busy&&!disabled&&!!choices?.targets.length,timing?.seconds??30,setError)
    const snapshot:CounterspellSnapshot|undefined=selected&&choices&&resource?{edition:'2014',actorId:ownerId,target:selected,slotLevel:resource.level??Number(resource.id.slice(5)),modifier:choices.modifier}:undefined
    const reason=busy?'Invio di Controincantesimo in corso.':disabled?'Attendi la sincronizzazione della sessione.':!choices?'Attendi il caricamento dei lanci disponibili.':choices.blockedReason??(!selected?'Seleziona la creatura e il lancio da interrompere.':!resource?'Scegli uno slot di almeno 3° livello.':resource.remaining!==null&&resource.remaining<(resource.cost??1)?'Lo slot selezionato è esaurito.':!confirmed?'Conferma visibilità, portata, lancio in corso e componente somatica.':master&&snapshot?resolutionReason(snapshot,decision):undefined)
    async function submit(){
        if(working.current||reason)return
        working.current=true;setBusy(true);setError('')
        try{
            await activity.flush()
            const current=await playApi<CounterspellChoices>(query);setChoices(current)
            const body={actorId:ownerId,targetKey,option,requirementsConfirmed:confirmed,...(reactionId?{reactionId}:{}),...(master?{decision:{...decision,confirmed}}:{})},signature=JSON.stringify(body)
            if(attempt.current?.signature!==signature)attempt.current={signature,id:crypto.randomUUID()}
            const next=await playApi<Game>(`/games/${game.id}/counterspell`,'POST',{...body,id:attempt.current.id,revision:current.revision})
            const completed=next.combatRequests.find(r=>r.id===attempt.current!.id)
            if(completed?.counterspell?.result)setReceipt(completed.counterspell)
            onUpdate(next);attempt.current=undefined;setConfirmed(false)
        }catch(e){setError(e instanceof Error?e.message:'Controincantesimo non riuscito.')}finally{working.current=false;setBusy(false)}
    }
    return <form className="action-roll-form master-action-form counterspell-form" aria-label="Lancio: Controincantesimo" onSubmit={e=>{e.preventDefault();void submit()}} onPointerDownCapture={activity.interact} onKeyDownCapture={activity.interact} onInputCapture={activity.interact} onChangeCapture={activity.interact}>
        <p className="ability-casting-summary">Istantaneo · Nessun danno · Nessuna concentrazione</p>
        <p className="library-help">Non serve preparare un’azione. {timing?.mode==='timer'?`Hai ${timing.seconds} secondi di inattività per questo lancio. Ogni interazione con il form riavvia il timer.`:'Puoi interrompere il lancio fino al prossimo evento indipendente, anche dopo la chiusura del popup.'} Slot e reazione si consumano anche se la prova fallisce.</p>
        {timing&&(!!reactionId||timing.mode==='timer')&&<ReactionCountdown key={targetKey} window={{expiresAt:timing.expiresAt,serverNow:popup?.serverNow??game.serverNow??choices?.serverNow??0}} clock={clock} seconds={timing.seconds} busy={busy||disabled} onRestart={activity.interact}/>}
        {receipt&&<CounterspellSummary snapshot={receipt}/>}
        <fieldset disabled={disabled||busy}>
            <label>Lancio da interrompere<select aria-label="Lancio da interrompere" required value={targetKey} onChange={e=>{setTargetKey(e.target.value);setDecision({});setConfirmed(false);setReceipt(undefined)}}><option value="">Scegli il lancio…</option>{choices?.targets.map(t=><option key={t.key} value={t.key}>{t.casterName} · {t.name??(t.key.startsWith('manual:')?'lancio dichiarato al tavolo':'lancio in corso')}</option>)}</select></label>
            <label>Slot da utilizzare<select aria-label="Slot di Controincantesimo" required value={option} onChange={e=>{setOption(e.target.value);setDecision(current=>({level:current.level,spellName:current.spellName}))}}>{choices?.options.map(o=><option key={o.id} value={o.id} disabled={o.remaining!==null&&o.remaining<(o.cost??1)}>{o.label}{o.remaining!==null?` · ${o.remaining} rimasti`:''}</option>)}</select></label>
            {master&&snapshot&&<CounterspellResolution snapshot={snapshot} value={decision} onChange={setDecision}/>}
            {!master&&<p className="library-help">Il Master verifica il livello del lancio avversario. Se serve una prova, il Master registra il tuo d20; altrimenti l’interruzione è automatica.</p>}
            <Requirements checked={confirmed} onChange={setConfirmed}/>
            <ActionButton className="play-primary" type="submit" disabled={!!reason} disabledReason={reason}>{master?'Usa Controincantesimo':'Usa Controincantesimo · invia al Master'}</ActionButton>
        </fieldset>
        {choices?.blockedReason&&<p role="status">{choices.blockedReason}</p>}
        {error&&<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Aggiorna</button></p>}
    </form>
}
export function CounterspellReview({request,disabled,onDecide}:{request:CombatRequest;disabled:boolean;onDecide:(id:string,decision:RequestDecision,body:unknown)=>Promise<void>}){
    const snapshot=request.counterspell!,[decision,setDecision]=useState<CounterspellDecision>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),working=useRef(false)
    const pending=request.status==='pending',stale=request.status==='stale'
    const reason=busy?'Invio in corso.':disabled?'Attendi la sincronizzazione della sessione.':!decision.confirmed?'Conferma i requisiti della reazione.':resolutionReason(snapshot,decision)
    async function send(action:RequestDecision){
        if(working.current)return;working.current=true;setBusy(true);setError('')
        try{await onDecide(request.id,action,action==='roll'?{kind:'refresh'}:{...decision,confirmed:decision.confirmed})}catch(e){setError(e instanceof Error?e.message:'Operazione non riuscita.')}finally{working.current=false;setBusy(false)}
    }
    return <article className="combat-request combat-request--review counterspell-review"><header className="combat-request-heading"><div><h3>{request.actionName}</h3><p>{request.characterName} · {request.actorName}</p></div><p role="status">{pending?'In attesa del Master':stale?'Da aggiornare':request.status==='approved'?'Approvata':'Rifiutata'}</p></header>
        <p>{request.optionLabel} · Reazione · Nessuna concentrazione</p>
        {request.counteredBy?<p className="counterspell-outcome">Questo Controincantesimo è stato interrotto: slot e reazione consumati, nessuna interruzione applicata al suo bersaglio.</p>:snapshot.result?<CounterspellSummary snapshot={snapshot}/>:<p><strong>Lancio da interrompere:</strong> {snapshot.target.casterName}{snapshot.target.name&&` · ${snapshot.target.name}`}</p>}
        {pending&&<form className="action-roll-form" aria-label="Risolvi Controincantesimo" onSubmit={e=>{e.preventDefault();if(!reason)void send('approve')}}><fieldset disabled={disabled||busy}>
            <CounterspellResolution snapshot={snapshot} value={decision} onChange={setDecision}/><Requirements checked={!!decision.confirmed} onChange={confirmed=>setDecision(d=>({...d,confirmed}))}/>
            <ActionButton type="submit" className="play-primary" disabled={!!reason} disabledReason={reason}>Approva Controincantesimo</ActionButton>
        </fieldset></form>}
        {(pending||stale)&&<div className="play-actions">{stale&&<ActionButton type="button" disabled={disabled||busy} disabledReason="Attendi la sincronizzazione della sessione." onClick={()=>void send('roll')}>Aggiorna richiesta</ActionButton>}<ActionButton type="button" className="play-secondary" disabled={disabled||busy} disabledReason="Attendi la sincronizzazione della sessione." onClick={()=>void send('reject')}>Rifiuta azione</ActionButton></div>}
        {error&&<p role="alert">{error}</p>}
    </article>
}
