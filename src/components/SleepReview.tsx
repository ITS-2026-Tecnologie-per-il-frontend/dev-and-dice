import { sleepAllocation, sleepTargetReason, type SleepReviewData } from '../domain/dnd/Sleep'

export function SleepReview({review,total,area,selected,disabled,onChange,immuneIds=[],onImmunityChange}:{review:SleepReviewData;total:number;area:number[];selected:number[];disabled:boolean;immuneIds?:number[];onImmunityChange?:(id:number,immune:boolean)=>void;onChange:(area:number[],selected:number[])=>void}) {
    const included=new Set(area),sleepers=new Set(selected)
    const remaining=total-review.candidates.filter(t=>sleepers.has(t.id)).reduce((sum,t)=>sum+(t.hitPoints??0),0)
    const missing=review.candidates.some(t=>included.has(t.id)&&t.hitPoints===undefined&&!t.unavailableReason)
    return <section className={`sleep-review${onImmunityChange?' sleep-review-immunities':''}`} aria-label="Risoluzione di Sonno">
        <dl className="sleep-budget" aria-live="polite">
            <div><dt>Riserva tirata</dt><dd>{total}<small> PF</small></dd></div>
            <div><dt>PF utilizzati</dt><dd>{total-remaining}</dd></div>
            <div><dt>PF restanti</dt><dd>{remaining}</dd></div>
        </dl>
        <p className="sleep-guidance">Correggi le creature nell’area. Chi si addormenta viene calcolato dai PF più bassi; puoi cambiare la scelta tra creature a pari PF.</p>
        {onImmunityChange&&<p className="sleep-guidance">Per un’immunità non già rilevata dalla scheda, spunta «Immune a Sonno» nella riga della creatura. Vale per questo lancio: la creatura resta nell’area, ma non si addormenta e non consuma riserva.</p>}
        {missing&&<p role="alert">Completa i PF delle creature nell’area prima di approvare Sonno.</p>}
        <fieldset disabled={disabled}><legend>Area ed esito</legend>
            <div className="sleep-table-heading" aria-hidden="true"><span>Creatura / PF attuali</span><span>Nell’area</span><span>Si addormenta</span>{onImmunityChange&&<span>Immune a Sonno</span>}</div>
            {review.candidates.slice().sort((a,b)=>Number(included.has(b.id))-Number(included.has(a.id))||(a.hitPoints??Infinity)-(b.hitPoints??Infinity)||a.id-b.id).map(target=>{
                const inside=included.has(target.id),picked=sleepers.has(target.id)
                const next=sleepAllocation(review.candidates,area,total,picked?[...selected.filter(id=>id!==target.id),...area.filter(id=>id!==target.id),target.id]:[target.id,...selected]).selected
                const changeable=inside&&next.includes(target.id)!==picked
                const reason=target.unavailableReason??(target.hitPoints===undefined?'PF da completare':changeable?'Parità di PF: puoi cambiare la scelta.':inside&&!picked?sleepTargetReason(target,remaining):undefined)
                return <div className="sleep-creature" key={target.id} data-asleep={picked||undefined}>
                    <div className="sleep-creature-name"><strong>{target.name??'Creatura'}</strong><span>{target.hitPoints===undefined?'PF non disponibili':`${target.hitPoints} PF attuali`}</span>{reason&&<small>{reason}</small>}</div>
                    <label><input type="checkbox" aria-label={`Nell’area: ${target.name}`} checked={inside} onChange={event=>{const nextArea=event.target.checked?[...area,target.id]:area.filter(id=>id!==target.id);onChange(nextArea,sleepAllocation(review.candidates,nextArea,total,selected).selected)}}/><span className="sleep-mobile-label">Nell’area</span></label>
                    <label><input type="checkbox" aria-label={`Si addormenta: ${target.name}`} checked={picked} disabled={!changeable} onChange={()=>onChange(area,next)}/><span className="sleep-mobile-label">Si addormenta</span></label>
                    {onImmunityChange&&<label><input type="checkbox" aria-label={`Immune a Sonno: ${target.name}`} checked={immuneIds.includes(target.id)} onChange={event=>onImmunityChange(target.id,event.target.checked)}/><span className="sleep-mobile-label">Immune a Sonno</span></label>}
                </div>
            })}
        </fieldset>
        <p className="sleep-outcome" role="status">{selected.length?`${selected.length} ${selected.length===1?'creatura si addormenta':'creature si addormentano'}.`:'Nessuna creatura si addormenta.'} Durata: 1 minuto, senza concentrazione.</p>
    </section>
}
