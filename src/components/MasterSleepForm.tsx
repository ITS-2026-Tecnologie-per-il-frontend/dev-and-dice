import { useId, useState } from 'react'
import type { Ability } from '../utils/Combat'
import type { CharacterSheet } from '../utils/CharacterSheets'
import type { Catalog } from '../utils/Catalog'
import type { CreationData } from '../utils/PlayerCreation'
import { combatAbilityInfo, requiresAdditionalSpellAction, type UseOption } from '../domain/dnd/CombatActions'
import { SleepReview } from './SleepReview'
import { sleepAllocation, sleepCandidates, sleepDice, validSleepRoll } from '../domain/dnd/Sleep'

export function MasterSleepForm({ability,owner,participants,abilities,data,catalog,options,optionId,error,inCombat,onApply}:{
    ability:Ability;owner:CharacterSheet;participants:{id:number;description:string;sheet?:CharacterSheet}[];abilities:Ability[];data?:CreationData;catalog:Catalog;options:UseOption[];optionId?:string;error:string;inCombat:boolean;onApply:(ability:Ability,packets:undefined,confirmed:boolean)=>boolean|void
}) {
    const id=useId(),[selectedOption,setSelectedOption]=useState(optionId??''),[roll,setRoll]=useState(''),[area,setArea]=useState<number[]>([]),[confirmed,setConfirmed]=useState(false)
    const [review,setReview]=useState(false),[preferred,setPreferred]=useState<number[]>([])
    const [executionId,setExecutionId]=useState(()=>crypto.randomUUID())
    const option=options.find(o=>o.id===selectedOption)??options.find(o=>o.id===optionId),count=sleepDice(option?.id??''),total=Number(roll),valid=validSleepRoll(total,count)
    const candidates=sleepCandidates(participants,abilities,data).map((target,index)=>({...target,name:participants[index].description}))
    const selected=sleepAllocation(candidates,area,total,preferred).selected
    const missing=candidates.some(t=>area.includes(t.id)&&t.hitPoints===undefined&&!t.unavailableReason)
    const additional=inCombat&&requiresAdditionalSpellAction(owner,ability,catalog)
    return <form className="action-roll-form master-action-form" aria-label={`Lancio: ${ability.name}`} onSubmit={event=>{
        event.preventDefault()
        if(!option||!valid||missing||error)return
        if(!review){setPreferred(selected);setReview(true);return}
        if(additional&&!confirmed)return
        const applied=onApply({...ability,instantaneous:false,damageEnabled:false,requirementsConfirmed:true,resolutionEffects:undefined,useOption:option.id,targets:selected.map(id=>({id,damage:'0',resolved:true})),execution:{id:executionId,phase:'resolving',option:option.id,cost:option.cost??1}},undefined,confirmed)
        if(applied!==false){setExecutionId(crypto.randomUUID());setRoll('');setArea([]);setConfirmed(false);setPreferred([]);setReview(false)}
    }}>
        <fieldset>{review?<div className="combat-request combat-request--review master-spell-review">
            <p className="ability-casting-summary">{option?.label} · {count}d8</p>
            <SleepReview review={{candidates,area,selected}} total={total} area={area} selected={selected} disabled={!!error} onChange={(area,selected)=>{setArea(area);setPreferred(selected)}}/>
        </div>:<><details className="player-action-description" open><summary>Descrizione dell’azione</summary><p className="combat-request-description">{ability.description??combatAbilityInfo(ability,catalog).entry?.description}</p></details><label>Risorsa<select aria-label="Risorsa" required value={option?.id??''} onChange={event=>{setSelectedOption(event.target.value);setRoll('');setArea([])}}>
            {options.map(o=><option key={o.id} value={o.id} disabled={o.remaining!==null&&o.remaining<(o.cost??1)}>{o.label}{o.remaining!==null?` · ${o.remaining} rimasti`:''}</option>)}
        </select></label>
        <div className="player-sleep-roll"><label htmlFor={id}>Sonno · tira {count}d8 e inserisci la somma<input id={id} type="number" inputMode="numeric" min={count} max={count*8} step="1" required placeholder="Solo il totale dei dadi" value={roll} onChange={event=>{setRoll(event.target.value);setArea([])}}/></label>
            <p className="library-help">Nessun modificatore da aggiungere. Non sono danni: il totale è la riserva di PF che puoi influenzare.</p>
            {roll&&!valid&&<p role="status">Inserisci un numero intero tra {count} e {count*8}.</p>}
            {valid&&<p className="ability-casting-summary" role="status">Riserva di Sonno: <strong>{total} PF</strong></p>}
        </div>
        <fieldset className="ability-targets" aria-label="Creature nell’area di Sonno"><legend>Creature nell’area di Sonno</legend>
            <p className="library-help">Indica le creature che si trovano nell’area, compresi gli alleati. Si addormentano in base al totale dei dadi, dai PF più bassi.</p>
            <div className="ability-target-list">{participants.map(target=><div className="ability-target" key={target.id}><label className="ability-check"><input type="checkbox" checked={area.includes(target.id)} onChange={event=>setArea(current=>event.target.checked?[...current,target.id]:current.filter(id=>id!==target.id))}/>{target.id===ability.ownerId?`Tu (${target.description})`:target.description}</label></div>)}</div>
        </fieldset>
        </>}
        {missing&&<p role="alert">Completa i PF delle creature nell’area prima di usare Sonno.</p>}
        {review&&additional&&<label className="ability-check"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Confermo un’altra azione valida per lanciare un incantesimo.</label>}
        {error&&<p role="alert">{error}</p>}
        <button className="play-primary" disabled={!valid||missing||!!error||!option||option.remaining!==null&&option.remaining<(option.cost??1)||review&&additional&&!confirmed}>{review?'Usa':'Calcola'}</button>
        {review&&<button type="button" className="sort-turns" onClick={()=>setReview(false)}>Modifica lancio</button>}
        </fieldset>
    </form>
}
