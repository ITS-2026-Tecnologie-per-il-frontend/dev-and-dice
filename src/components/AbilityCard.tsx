import type { ComponentProps, ReactNode } from 'react'
import { HelpTooltip } from './HelpTooltip'

export function AbilityCard(props:ComponentProps<'div'>) {
    return <div {...props} className="ability-row"/>
}

export function AbilityMetadata({duration,owner,ownerLabel}:{duration:string;owner:string;ownerLabel:string}) {
    return <dl className="ability-metadata">
        <div><dt>Durata</dt><dd>{duration}</dd></div>
        <div><dt>{ownerLabel}</dt><dd>{owner}</dd></div>
    </dl>
}

export function AbilityTargets({candidates,ownerId,selectedIds,maximum,summary,disabled=false,disableNewTargets=false,label='Bersagli del danno',checkboxLabel,onChange,renderSelected}: {
    candidates:{id:number;name:string;unavailableReason?:string}[];ownerId?:number|null;selectedIds:number[];maximum:number|null;summary?:string;disabled?:boolean;disableNewTargets?:boolean;label?:string;
    checkboxLabel?:(candidate:{id:number;name:string})=>string;onChange:(id:number,checked:boolean)=>void;renderSelected?:(candidate:{id:number;name:string})=>ReactNode
}) {
    const selected=new Set(selectedIds),tooMany=maximum!==null&&selected.size>maximum
    const owner=candidates.find(candidate=>candidate.id===ownerId)
    return <fieldset className="ability-targets" aria-label={label}>
        <legend><span>{label}</span><HelpTooltip label="Aiuto sui bersagli del danno">Scegli le creature coinvolte. Risolvi attacchi, tiri salvezza e difese, poi inserisci il danno finale per ogni bersaglio: 0 se non subisce danni.</HelpTooltip></legend>
        {summary&&<p className="library-help">{summary}{maximum!==null&&` Selezionati: ${selected.size}/${maximum}.`}</p>}
        {tooMany&&<p role="alert">Troppi bersagli: correggi la selezione prima di procedere.</p>}
        <div className="ability-target-list">{candidates.filter(candidate=>candidate.id!==ownerId).concat(owner?[owner]:[]).map(candidate=>{
            const picked=selected.has(candidate.id)
            const row=<div className="ability-target" key={candidate.id}>
                <label className="ability-check"><input type="checkbox" aria-label={checkboxLabel?.(candidate)} checked={picked} disabled={!!candidate.unavailableReason&&!picked||disabled&&!(tooMany&&picked)||!picked&&(disableNewTargets||maximum!==null&&selected.size>=maximum)} onChange={event=>onChange(candidate.id,event.target.checked)}/>{candidate.name}</label>
                {candidate.unavailableReason&&<span className="library-help">{candidate.unavailableReason}</span>}
                {picked&&renderSelected?.(candidate)}
            </div>
            return candidate.id===ownerId ? <details className="ability-self-target" key={candidate.id} open={picked}><summary>Includi te stesso{picked?' · selezionato':''}</summary>{row}</details> : row
        })}</div>
    </fieldset>
}
