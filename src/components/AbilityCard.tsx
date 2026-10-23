import type { ComponentProps, ReactNode } from 'react'
import { damageNames, type SpellEffectDetails, type WeaponEffectDetails } from '../domain/dnd/CombatResolution'
import { signedBonus } from '../utils/CharacterSheets'
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
            return <div className="ability-target" key={candidate.id}>
                <label className="ability-check"><input type="checkbox" aria-label={checkboxLabel?.(candidate)} checked={picked} disabled={!!candidate.unavailableReason&&!picked||disabled&&!(tooMany&&picked)||!picked&&(disableNewTargets||maximum!==null&&selected.size>=maximum)} onChange={event=>onChange(candidate.id,event.target.checked)}/>{candidate.id===ownerId?`Tu (${candidate.name})`:candidate.name}</label>
                {candidate.unavailableReason&&<span className="library-help">{candidate.unavailableReason}</span>}
                {picked&&renderSelected?.(candidate)}
            </div>
        })}</div>
    </fieldset>
}

export function WeaponEffectSummary({effects}:{effects?:WeaponEffectDetails[]}) {
    if(!effects?.length)return null
    return <div className="ability-weapon-effects" aria-label="Potenziamento applicato">{effects.map((effect,index)=><dl key={index}>
        <div><dt>Bersaglio</dt><dd>{effect.targetName}</dd></div>
        <div><dt>Oggetto</dt><dd>{effect.itemName}</dd></div>
        <div><dt>Effetto sull’arma</dt><dd>
            {effect.magical&&<span>L’arma è magica.</span>}
            {effect.attackBonus!==0&&<span>{signedBonus(effect.attackBonus)} ai tiri per colpire.</span>}
            {effect.damageBonus!==0&&<span>{signedBonus(effect.damageBonus)} ai danni dell’arma.</span>}
            {effect.extraDamage&&<span>+ {effect.extraDamage.dice} danni ({damageNames[effect.extraDamage.type]}).</span>}
            {effect.damageDice&&<span>Dado dei danni: {effect.damageDice}.</span>}
            {effect.castingModifier!==undefined&&<span>Caratteristica da incantatore: {signedBonus(effect.castingModifier)}.</span>}
        </dd></div>
    </dl>)}</div>
}

export function SpellEffectSummary({effects}:{effects?:SpellEffectDetails[]}) {
    if(!effects?.length)return null
    return <div className="ability-weapon-effects" aria-label="Effetto applicato">{effects.map((effect,index)=><dl key={index}>
        <div><dt>Bersaglio</dt><dd>{effect.targetName}</dd></div>
        {effect.armorClassBefore!==undefined&&effect.armorClassBonus!==undefined&&effect.armorClass!==undefined?<div className="ability-effect-total"><dt>CA temporanea</dt><dd><output aria-label={`CA temporanea di ${effect.targetName}`}><span className="ability-ac-formula">{effect.armorClassBefore} {signedBonus(effect.armorClassBonus)} = </span><strong>{effect.armorClass}</strong></output><small>CA prima + bonus incantesimo</small></dd></div>:effect.armorClass!==undefined&&<div className="ability-effect-total"><dt>CA risultante</dt><dd><output aria-label={`CA risultante di ${effect.targetName}`}>{effect.armorClass}</output></dd></div>}
        <div><dt>Effetto</dt><dd>{effect.description.map(text=><span key={text}>{text}</span>)}</dd></div>
    </dl>)}</div>
}
