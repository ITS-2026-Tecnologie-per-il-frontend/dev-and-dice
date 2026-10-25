import {useEffect,useId,useRef,useState} from 'react'
import {playApi,type Game} from '../utils/PlayApi'
import type {ReadyCommand,ReadiedAction} from '../domain/dnd/Readied'
import {sleepAllocation,sleepDice,validSleepRoll,type SleepReviewData} from '../domain/dnd/Sleep'
import {SleepReview} from './SleepReview'
type Actor={id:number;name:string;canPrepare:boolean;prepareBlockedReason?:string;canReact:boolean;additionalActionRequired:boolean;options:{id:string;label:string;remaining:number|null;cost?:number}[];targets:{id:number;name:string}[];sleepers:number[];held:{id:number;name:string;readied:ReadiedAction;option:string;targetName?:string}[];candidates?:SleepReviewData['candidates']}
type Choices={revision:number;actors:Actor[]}
export function ReadiedActions({game,onUpdate,disabled=false}:{game:Game;onUpdate:(game:Game)=>void;disabled?:boolean}){
 const [choices,setChoices]=useState<Choices>(),[actorId,setActorId]=useState<number>(),[kind,setKind]=useState<'prepare-sleep'|'prepare-wake'>('prepare-sleep'),[trigger,setTrigger]=useState(''),[option,setOption]=useState(''),[targetId,setTargetId]=useState(''),[confirmed,setConfirmed]=useState(false)
 const [release,setRelease]=useState<{actor:Actor;held:Actor['held'][number]}>(),[roll,setRoll]=useState(''),[area,setArea]=useState<number[]>([]),[review,setReview]=useState(false),[preferred,setPreferred]=useState<number[]>([]),[immune,setImmune]=useState<number[]>([])
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[retry,setRetry]=useState(0)
 const attempt=useRef<{signature:string;id:string}|undefined>(undefined)
 const releaseId=useId()
 useEffect(()=>{let active=true;playApi<Choices>('/games/'+game.id+'/readied-actions').then(c=>{if(active){setChoices(c);setLoadError('')}}).catch(e=>{if(active)setLoadError(e.message)});return()=>{active=false}},[game.id,game.revision,game.requestsRevision,retry])
 const actor=choices?.actors.find(a=>a.id===actorId)??choices?.actors.find(a=>a.canPrepare)??choices?.actors[0]
 const chosenOption=actor?.options.find(o=>o.id===option)??actor?.options.find(o=>o.remaining===null||o.remaining>=(o.cost??1))
 const releaseActor=choices?.actors.find(a=>a.id===release?.actor.id)??release?.actor
 const count=sleepDice(release?.held.option??''),total=Number(roll),valid=validSleepRoll(total,count)
 const rollError=roll.trim()&&!valid?`Inserisci un numero intero tra ${count} e ${count*8}: è l’intervallo possibile per ${count}d8.`:undefined
 const currentHeld=choices?.actors.find(a=>a.id===release?.actor.id)?.held.find(h=>h.id===release?.held.id)
 const releaseBlockedReason=!release?undefined:disabled?'Attendi la sincronizzazione della sessione prima di inviare.':!currentHeld?'Questa preparazione è scaduta o è stata interrotta.':!releaseActor?.canReact?'La reazione non è disponibile: è già stata usata oppure il personaggio non può reagire.':game.combatRequests.some(r=>r.status==='pending'&&r.readyCommand?.effectId===release.held.id)?'La richiesta di rilascio è già in attesa del Master.':undefined
 const candidates=(releaseActor?.candidates??[]).map(t=>({...t,...(immune.includes(t.id)?{unavailableReason:'Immune a Sonno (conferma del Master).'}:{})})),selected=sleepAllocation(candidates,area,total,preferred).selected
 const missing=candidates.some(t=>area.includes(t.id)&&t.hitPoints===undefined&&!t.unavailableReason)
 async function send(command:ReadyCommand,decision?:unknown){
  if(busy||disabled||!choices)return
  setBusy(true);setError('')
  const signature=JSON.stringify({command,decision})
  if(attempt.current?.signature!==signature)attempt.current={signature,id:crypto.randomUUID()}
  try{const latest=await playApi<Choices>('/games/'+game.id+'/readied-actions');setChoices(latest);const next=await playApi<Game>('/games/'+game.id+'/readied-actions','POST',{id:attempt.current.id,revision:latest.revision,command,decision});onUpdate(next);attempt.current=undefined;setRelease(undefined);setTrigger('');setConfirmed(false);setRetry(n=>n+1)}catch(e){setError(e instanceof Error?e.message:'Operazione non riuscita.')}finally{setBusy(false)}
 }
 function openRelease(actor:Actor,held:Actor['held'][number]){setRelease({actor,held});setRoll('');setArea([]);setPreferred([]);setImmune([]);setReview(false);setError('')}
 return <section id="readied-actions" className="readied-actions" aria-label="Azioni preparate"><h3>Azioni preparate</h3>
  <p className="library-help">Fino all’inizio del tuo prossimo turno. Il Master verifica l’evento e la portata prima del rilascio.</p>
  {!choices&&<p>Caricamento…</p>}
  {game.combatRequests.filter(r=>r.status==='pending'&&r.readyCommand).map(r=><p key={r.id} role="status">{r.actionName} · in attesa del Master.</p>)}
  {choices?.actors.map(a=>a.held.filter(h=>h.id!==release?.held.id).map(h=><div className="readied-held" key={h.id} aria-label={`${h.name} di ${a.name}`}><strong>{h.name} · {a.name}</strong><p>Quando: {h.readied.trigger}</p>{h.targetName&&<p>Bersaglio: {h.targetName}</p>}<p className="library-help">{h.readied.kind==='sleep'?'Slot già consumato · concentrazione richiesta.':'Azione già utilizzata.'} Il rilascio usa la reazione.</p><div className="play-actions"><button type="button" disabled={disabled||busy||!a.canReact||game.combatRequests.some(r=>r.status==='pending'&&r.readyCommand?.effectId===h.id)} onClick={()=>h.readied.kind==='sleep'?openRelease(a,h):void send({kind:'release',actorId:a.id,effectId:h.id})}>{h.readied.kind==='sleep'?'Rilascia Sonno':'Evento avvenuto · Sveglia'}</button><button type="button" className="sort-turns" disabled={disabled||busy} onClick={()=>void send({kind:'cancel',actorId:a.id,effectId:h.id})}>Abbandona</button></div></div>))}
  {release&&<form aria-label="Rilascia Sonno preparato" className="action-roll-form readied-release" onSubmit={e=>{e.preventDefault();if(!valid||releaseBlockedReason||review&&missing)return;if(game.role==='master'&&!review){setReview(true);return}void send({kind:'release',actorId:release.actor.id,effectId:release.held.id,sleepRoll:total,area},game.role==='master'?{sleepArea:area,sleepTargets:selected,sleepImmune:immune}:undefined)}}>
   <header className="readied-release-heading"><h4>Rilascia Sonno</h4><p>{release.actor.name}</p></header>
   <dl className="readied-release-event"><dt>Evento preparato</dt><dd>{release.held.readied.trigger}</dd></dl>
   <p className="library-help">{release.actor.options.find(o=>o.id===release.held.option)?.label??'Slot incantesimo'} già consumato. Il rilascio usa la tua reazione.</p>
   <fieldset disabled={disabled||busy||!!releaseBlockedReason}>
   {review?<div className="combat-request combat-request--review master-spell-review"><SleepReview review={{candidates,area,selected}} total={total} area={area} selected={selected} immuneIds={immune} disabled={busy} onImmunityChange={(id,value)=>setImmune(current=>value?[...current,id]:current.filter(t=>t!==id))} onChange={(area,selected)=>{setArea(area);setPreferred(selected)}}/><button type="button" className="play-secondary" onClick={()=>setReview(false)}>Modifica dadi e area</button></div>:<>
    <div className="readied-release-roll"><label htmlFor={releaseId}>Totale dei {count}d8</label><p id={releaseId+'-help'} className="library-help">Tira {count}d8 e somma i risultati. Totale possibile: da {count} a {count*8}.</p><input id={releaseId} aria-label={`Sonno · tira ${count}d8 e inserisci la somma`} aria-describedby={releaseId+'-help'+(rollError?' '+releaseId+'-error':'')} aria-invalid={!!rollError} type="number" min={count} max={count*8} step="1" required placeholder="Somma dei dadi" value={roll} onChange={e=>setRoll(e.target.value)}/>{rollError&&<p id={releaseId+'-error'} className="readied-release-error" role="alert">{rollError}</p>}{valid&&<p className="readied-release-reserve" role="status">Riserva di Sonno: <strong>{total} PF</strong></p>}<p className="library-help">Nessun modificatore da aggiungere. Questo totale non infligge danni.</p></div>
    <fieldset className="ability-targets readied-release-targets"><legend>Creature nell’area di Sonno</legend><p className="library-help">Indica chi si trova nell’area, anche tra gli alleati. Il Master confermerà chi si addormenta.</p><div className="ability-target-list">{releaseActor?.targets.map(t=><label className="ability-check" key={t.id}><input type="checkbox" checked={area.includes(t.id)} onChange={e=>setArea(current=>e.target.checked?[...current,t.id]:current.filter(id=>id!==t.id))}/>{t.id===release.actor.id?`Tu (${t.name})`:t.name}</label>)}</div><p className="library-help">{area.length} {area.length===1?'creatura indicata':'creature indicate'}</p></fieldset>
   </>}
   <p className="library-help">Invia soltanto quando l’evento preparato è avvenuto. Non consumerai un altro slot.</p>
   {!valid&&!roll.trim()&&<p className="library-help">Inserisci il totale dei dadi per continuare.</p>}
   {review&&missing&&<p className="readied-release-error" role="alert">Completa i PF delle creature nell’area o verifica le loro immunità prima di usare la reazione.</p>}
   <button className="play-primary" disabled={!valid||!!releaseBlockedReason||review&&missing}>{busy?'Invio in corso…':game.role==='master'?review?'Usa reazione':'Calcola':'Invia reazione al Master'}</button>
   </fieldset>
   {releaseBlockedReason&&<p className="readied-release-error" role="status">{releaseBlockedReason}</p>}
   {error&&<p className="readied-release-error" role="alert">{error}</p>}
   <button type="button" className="play-secondary readied-release-close" disabled={busy} onClick={()=>setRelease(undefined)}>Chiudi rilascio</button>
  </form>}
  {actor&&<details className="readied-prepare"><summary>Prepara Sonno o un risveglio</summary><form aria-label="Prepara un’azione" onSubmit={e=>{e.preventDefault();void send(kind==='prepare-sleep'?{kind,actorId:actor.id,trigger,option:chosenOption?.id}:{kind,actorId:actor.id,trigger,targetId:Number(targetId)},game.role==='master'?{additionalActionConfirmed:confirmed}:undefined)}}><fieldset disabled={disabled||busy}>
   {game.role==='master'&&<label>Personaggio<select aria-label="Personaggio dell’azione preparata" value={actor.id} onChange={e=>{setActorId(Number(e.target.value));setOption('');setTargetId('');setConfirmed(false)}}>{choices?.actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
   <label>Azione da preparare<select aria-label="Azione da preparare" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="prepare-sleep">Sonno</option><option value="prepare-wake">Svegliare una creatura</option></select></label>
   {kind==='prepare-sleep'?<><label>Risorsa<select required aria-label="Risorsa preparazione" value={chosenOption?.id??''} onChange={e=>setOption(e.target.value)}>{actor.options.map(o=><option key={o.id} value={o.id} disabled={o.remaining!==null&&o.remaining<(o.cost??1)}>{o.label} · {o.remaining??'illimitati'} rimasti</option>)}</select></label><p className="library-help">Lo slot viene consumato ora. Trattenere Sonno richiede concentrazione e interrompe quella precedente. I dadi si tirano al rilascio.</p></>:<label>Creatura da svegliare<select aria-label="Creatura da svegliare" required value={targetId} onChange={e=>setTargetId(e.target.value)}><option value="">Scegli…</option>{actor.targets.filter(t=>t.id!==actor.id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
   <label>Evento che attiva la reazione<input aria-describedby="readied-trigger-help" required maxLength={500} value={trigger} placeholder="Es. quando il goblin attraversa la porta" onChange={e=>setTrigger(e.target.value)}/></label>
   <p id="readied-trigger-help" className="library-help">Scrivi un evento percepibile. Questa frase non attiva un trigger automatico: quando l’evento avviene, premi «Rilascia Sonno» o «Evento avvenuto · Sveglia». Il Master verifica e approva.</p>
   {game.role==='master'&&actor.additionalActionRequired&&<label className="ability-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confermo un’altra azione valida per preparare questa azione.</label>}
   <button disabled={!actor.canPrepare||!trigger.trim()||kind==='prepare-sleep'&&!chosenOption||kind==='prepare-wake'&&!targetId||game.role==='master'&&actor.additionalActionRequired&&!confirmed}>{game.role==='master'?'Prepara':'Invia preparazione al Master'}</button>
  </fieldset></form>{!actor.canPrepare&&<p role="status" className="library-help">{actor.prepareBlockedReason??'Puoi preparare un’azione soltanto nel tuo turno e se puoi agire.'}</p>}</details>}
  {(loadError||!release&&error)&&<p role="alert">{loadError||error} <button type="button" className="sort-turns" onClick={()=>{setError('');setRetry(n=>n+1)}}>Aggiorna</button></p>}
 </section>
}
