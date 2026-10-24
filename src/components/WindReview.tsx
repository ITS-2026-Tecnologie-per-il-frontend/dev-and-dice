import { resolveTarget, saveNames, type ResolutionPlan, type TargetResolution } from '../domain/dnd/CombatResolution'
import { signedBonus } from '../utils/CharacterSheets'
import type { WindReview as Review, WindSave } from '../utils/PlayApi'

export function WindReview({review,plan,casterName,value,onChange,purpose='cast'}:{purpose?:'cast'|'direction';review:Review;plan:ResolutionPlan;casterName:string;value:Pick<Review,'selected'|'saves'>;onChange:(value:Pick<Review,'selected'|'saves'>)=>void}) {
    const save=plan.deferredSave!
    function patch(id:number,values:WindSave){onChange({...value,saves:{...value.saves,[id]:values}})}
    function input(label:string,current:number|undefined,change:(n:number|undefined)=>void,d20=false,caption=label) {
        return <label>{caption}<input aria-label={label} type="text" inputMode="numeric" pattern={d20?'([1-9]|1[0-9]|20)':'[0-9]+'} value={current??''} onChange={e=>{if(/^\d*$/.test(e.target.value)&&Number.isSafeInteger(Number(e.target.value)))change(e.target.value===''?undefined:d20?Math.min(20,Number(e.target.value)):Number(e.target.value))}}/></label>
    }
    return <fieldset className="wind-review" aria-label="Bersagli e tiri salvezza" disabled={!review.editable}>
        <p className="wind-save-dc">CD di {casterName}: <strong>{save.dc??'da verificare nella scheda'}</strong><span>Resiste se d20 + bonus TS ≥ CD.</span></p>
        <p className="library-help">Seleziona le creature nella linea. Registra il TS all’inizio di ogni loro turno: {purpose==='direction'?'puoi confermare il cambio direzione senza inserire dadi.':'puoi approvare il lancio senza inserire dadi.'}</p>
        {review.candidates.map(candidate=>{
            const selected=value.selected.includes(candidate.id),roll=value.saves[candidate.id]??{mode:'dice' as const},profile=candidate.profile
            let result:TargetResolution|undefined,error=''
            if(selected)try{result=resolveTarget({...plan,kind:'save',save:{ability:save.ability,dc:save.dc,onSuccess:'none'}},[{targetId:candidate.id,damage:[]}],profile,roll.mode==='manual'?{saveOutcome:roll.success}:{save:roll.die,saveSecond:roll.secondDie,saveBonuses:roll.bonuses})}catch(cause){error=cause instanceof Error?cause.message:'Verifica il tiro.'}
            return <div className="wind-target" key={candidate.id}>
                <div className="wind-target-heading"><label className="combat-request-check"><input type="checkbox" checked={selected} onChange={e=>{const saves={...value.saves};if(!e.target.checked)delete saves[candidate.id];onChange({selected:e.target.checked?[...value.selected,candidate.id]:value.selected.filter(id=>id!==candidate.id),saves})}}/>{candidate.name}</label>
                    {selected&&<label className="combat-request-check wind-manual"><input type="checkbox" checked={roll.mode==='manual'} onChange={e=>patch(candidate.id,e.target.checked?{mode:'manual'}:{mode:'dice'})}/>Esito manuale</label>}
                </div>
                {selected&&<div className="wind-target-save">
                    {roll.mode==='manual'?<label>Esito di {candidate.name}<select aria-label={`Esito di ${candidate.name}`} required value={roll.success===undefined?'':String(roll.success)} onChange={e=>patch(candidate.id,{mode:'manual',success:e.target.value===''?undefined:e.target.value==='true'})}><option value="">Scegli l’esito…</option><option value="true">Resiste</option><option value="false">Non resiste</option></select></label>:<>
                        {profile.automaticSaveFailure?<p>Fallimento automatico per le condizioni del bersaglio.</p>:<>
                            {input(`TS ${saveNames[save.ability]} di ${candidate.name} · solo d20`,roll.die,die=>patch(candidate.id,{...roll,die}),true,`TS ${saveNames[save.ability]} · solo d20`)}
                            <p className="library-help">Bonus TS: {signedBonus(profile.saveBonus)||'da verificare'} · CD {save.dc??'da verificare'}{roll.die!==undefined&&result?.save?.success===undefined&&(profile.saveBonus===undefined||save.dc===undefined)?' · Completa i dati mancanti nella scheda o scegli l’esito manuale.':''}</p>
                            {profile.saveMode&&profile.saveMode!=='normal'&&input(`Secondo d20 di ${candidate.name} · ${profile.saveMode==='advantage'?'vantaggio':'svantaggio'}`,roll.secondDie,secondDie=>patch(candidate.id,{...roll,secondDie}),true)}
                            {profile.saveDice?.map(bonus=><div key={bonus.id}>{input(`${bonus.label} · TS di ${candidate.name} · d${bonus.sides}`,roll.bonuses?.[bonus.id],n=>{const bonuses={...roll.bonuses};if(n===undefined)delete bonuses[bonus.id];else bonuses[bonus.id]=n;patch(candidate.id,{...roll,bonuses})})}</div>)}
                        </>}
                    </>}
                    <div className="wind-target-result">{result?.save?.total!==undefined&&<p>Totale<span className="play-sr-only"> TS di {candidate.name}</span>: <strong>{result.save.total}</strong></p>}
                    <p role="status" data-outcome={result?.save?.success===undefined?'waiting':result.save.success?'success':'failure'}><span className="play-sr-only">{candidate.name}: </span>{result?.save?.success===undefined?'TS da risolvere':result.save.success?'Resiste':`Non resiste · spinta di ${save.pushFt*0.3} m lungo la linea`}</p></div>
                    {error&&<p role="alert">{error}</p>}
                </div>}
            </div>
        })}
    </fieldset>
}

export function WindSummary({review,plan,casterName}:{review:Review;plan:ResolutionPlan;casterName:string}) {
    const save=plan.deferredSave!
    return <section className="wind-review-summary" aria-label="Bersagli e tiri salvezza confermati">
        <p>CD di {casterName}: <strong>{save.dc??'da verificare'}</strong></p>
        {!review.selected.length&&<p>Nessuna creatura nella linea.</p>}
        <ul>{review.selected.map(id=>{
            const candidate=review.candidates.find(c=>c.id===id)
            if(!candidate)return null
            const roll=review.saves[id]??{mode:'dice' as const}
            let result:TargetResolution|undefined
            try{result=resolveTarget({...plan,kind:'save',save:{ability:save.ability,dc:save.dc,onSuccess:'none'}},[{targetId:id,damage:[]}],candidate.profile,roll.mode==='manual'?{saveOutcome:roll.success}:{save:roll.die,saveSecond:roll.secondDie,saveBonuses:roll.bonuses})}catch{/* Incomplete historical rolls remain a pending save in the receipt. */}
            return <li key={id}><strong>{candidate.name}</strong>{roll.mode==='dice'&&<span> · Bonus TS {signedBonus(candidate.profile.saveBonus)||'da verificare'}{roll.die!==undefined&&` · d20 ${roll.die}`}{result?.save?.total!==undefined&&` · Totale ${result.save.total}`}</span>}<p role="status">{candidate.name}: {result?.save?.success===undefined?'TS da risolvere all’inizio del turno':result.save.success?'Resiste':`Non resiste · spinta di ${save.pushFt*0.3} m lungo la linea`}</p></li>
        })}</ul>
    </section>
}
