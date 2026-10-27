import {ActionButton} from './ActionButton'
import { useId, useRef, useState } from 'react'
import { AbilityTargets } from './AbilityCard'
import { WindReview } from './WindReview'
import type { ResolutionPlan } from '../domain/dnd/CombatResolution'
import type { WindReview as WindData, WindSave, WindDirectionChoice } from '../utils/PlayApi'

type Props={choice:WindDirectionChoice;candidates:{id:number;name:string}[];ownerId:number|null;disabled?:boolean;direct?:boolean;review?:WindData;plan?:ResolutionPlan;casterName?:string;onSubmit:(selected:number[],id:string,saves:Record<string,WindSave>)=>Promise<void>}

export function WindDirectionForm({choice,candidates,ownerId,disabled=false,direct=false,review,plan,casterName,onSubmit}:Props) {
    const [open,setOpen]=useState(false),[selected,setSelected]=useState(choice.selected),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false)
    const [saves,setSaves]=useState<Record<string,WindSave>>({})
    const missingSave=selected.some(id=>saves[id]?.mode==='manual'&&saves[id]?.success===undefined)
    const working=useRef(false),attempt=useRef<{signature:string;id:string}>(undefined),hint=useId()
    const blocked=disabled||!choice.canUse
    async function submit(){
        if(working.current||blocked||missingSave)return
        working.current=true;setBusy(true);setError('')
        const signature=JSON.stringify({selected,saves})
        if(attempt.current?.signature!==signature)attempt.current={signature,id:crypto.randomUUID()}
        try{await onSubmit(selected,attempt.current.id,saves);setOpen(false);setSent(true);attempt.current=undefined}
        catch(cause){setError(cause instanceof Error?cause.message:'Cambio direzione non riuscito.')}
        finally{working.current=false;setBusy(false)}
    }
    return <div className="wind-direction-controls">
        {!open&&<ActionButton type="button" className="sort-turns" disabled={blocked||busy} disabledReason={busy?'Cambio direzione in invio.':disabled?'Attendi la sincronizzazione della sessione.':choice.reason} aria-expanded={open} aria-describedby={choice.reason?hint:undefined} onClick={()=>{setSelected(choice.selected);setSaves({});setSent(false);setError('');setOpen(true)}}>Cambia direzione (usa azione bonus)</ActionButton>}
        {choice.reason&&<p id={hint} className="library-help">{choice.reason}</p>}
        {open&&<form className="action-roll-form master-action-form" aria-label="Cambia direzione di Folata di Vento" onSubmit={event=>{event.preventDefault();void submit()}}><fieldset disabled={blocked||busy}>
            <p>{direct?"Seleziona le creature nella nuova linea. Usa l’azione bonus del lanciatore.":"Seleziona le creature nella nuova linea. Il Master confermerà il cambio direzione e registrerà i tiri salvezza all’inizio dei loro turni."}</p>
            {direct&&review&&plan?<WindReview purpose="direction" review={review} plan={plan} casterName={casterName??"Lanciatore"} value={{selected,saves}} onChange={value=>{setSelected(value.selected);setSaves(value.saves)}}/>:<AbilityTargets candidates={candidates} ownerId={ownerId} selectedIds={selected} maximum={null} label="Bersagli nella nuova direzione" onChange={(id,checked)=>setSelected(current=>checked?[...current,id]:current.filter(value=>value!==id))}/>}
            <ActionButton type="submit" className="sort-turns" disabled={blocked||busy||missingSave} disabledReason={busy?'Cambio direzione in invio.':disabled?'Attendi la sincronizzazione della sessione.':choice.reason??'Indica l’esito di tutti i tiri salvezza manuali selezionati.'}>{busy?'Invio…':direct?'Conferma cambio direzione':'Invia al Master'}</ActionButton>
        </fieldset><ActionButton type="button" className="play-secondary end-combat" disabled={busy} disabledReason={'Cambio direzione in invio: attendi la risposta prima di annullare.'} onClick={()=>{setOpen(false);setError('')}}>Annulla cambio direzione</ActionButton></form>}
        {sent&&<p role="status">{direct?'Direzione cambiata. Azione bonus utilizzata.':'Cambio direzione inviato al Master.'}</p>}
        {error&&<p role="alert">{error}</p>}
    </div>
}
