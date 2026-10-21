import { useRef, useState } from 'react'
import type { Ability } from '../utils/Combat'
import type { CharacterSheet } from '../utils/CharacterSheets'
import type { Catalog } from '../utils/Catalog'
import type { CreationData } from '../utils/PlayerCreation'
import { inventoryEquipment, inventoryFieldValue, referencedInventoryItem } from '../utils/Inventory'
import { defenseProfile, resolutionPlan, resolveTarget, damageNames, type DamageType, type ResolutionPlan, type ResolutionRolls, type TargetResolution } from '../domain/dnd/CombatResolution'
import { combatTargeting } from '../domain/dnd/CombatTargets'
import { AbilityTargets } from './AbilityCard'
import { AttackRollFields, DamageRollFields } from './AttackRollFields'

const validRollNumber=(value:string)=>/^\d*$/.test(value)&&Number.isSafeInteger(Number(value))

export function MasterAttackRolls({ability,owner,plan,participants,abilities,catalog,catalogForOwner,data,onApply}:{
    ability:Ability;owner:CharacterSheet;plan:ResolutionPlan;participants:{id:number;description:string;sheet?:CharacterSheet}[];abilities:Ability[];catalog:Catalog;catalogForOwner?:(id:number|null)=>Catalog;data:CreationData;
    onApply:(targets:NonNullable<Ability['targets']>)=>boolean|void
}) {
    const [targetId,setTargetId]=useState<number|undefined>(ability.targets?.[0]?.id),[die,setDie]=useState(''),[automatic,setAutomatic]=useState(false)
    const [damage,setDamage]=useState<Partial<Record<DamageType,string>>>({}),[rolls,setRolls]=useState<ResolutionRolls>({}),[override,setOverride]=useState('')
    const working=useRef(false),target=participants.find(p=>p.id===targetId),validDie=/^([1-9]|1[0-9]|20)$/.test(die),ready=automatic||validDie
    const targeting=combatTargeting(ability,catalog,owner,'free')
    const active=abilities.map(effect=>{
        if(effect.resolutionEffects)return effect
        const sheet=participants.find(p=>p.id===effect.ownerId)?.sheet
        const known=sheet&&resolutionPlan(sheet,effect,catalogForOwner?.(effect.ownerId)??catalog,effect.useOption)
        return known&&!known.effectChoices?.length?{...effect,resolutionEffects:known.effects.filter(e=>e.trigger==='always')}:effect
    })
    const armor=target?.sheet&&inventoryEquipment(referencedInventoryItem(target.sheet,'armor'),target.sheet,data)
    const profile=target?.sheet?defenseProfile(target.sheet,undefined,active,target.id,armor?.armor_category==='Heavy'?true:armor||!inventoryFieldValue(target.sheet,'armor')?false:undefined,data):undefined
    const actor=defenseProfile(owner,undefined,active,ability.ownerId!,undefined,data)
    if(profile){
        profile.attackDice=actor.attackDice
        profile.reviewAttack=profile.reviewAttack||actor.reviewAttack
        profile.attackMode=actor.attackDisadvantage&&profile.grantsAttackAdvantage?'normal':actor.attackDisadvantage?'disadvantage':profile.grantsAttackAdvantage?'advantage':'normal'
    }
    // ponytail: an explicit Master ruling skips the attack roll only. It is an ordinary
    // hit, never a fabricated natural 20; typed damage still uses the shared resolver.
    let result:TargetResolution|undefined,error=''
    try {result=ready&&profile?resolveTarget(automatic?{...plan,kind:'automatic'}:plan,[{targetId:targetId!,...(automatic?{}:{die:Number(die)}),damage:plan.damageTypes.map(type=>({type,amount:Number(damage[type]??0)}))}],profile,rolls):undefined}
    catch(cause){error=cause instanceof Error?cause.message:'Verifica i risultati dei dadi.'}
    const packet=result?.packets[0],complete=ready&&plan.damageTypes.every(type=>damage[type]!==undefined&&damage[type]!=='')
    const finalDamage=result?.damage===null?override:result?.damage===undefined?'':String(result.damage)
    const validFinal=finalDamage!==''&&validRollNumber(finalDamage)
    function reset(){setDie('');setDamage({});setRolls({});setOverride('')}
    function numberInput(label:string,value:number|undefined,change:(value:number|undefined)=>void,max?:number) {
        return <label>{label}<input aria-label={label} type="text" inputMode="numeric" pattern={max===20?'([1-9]|1[0-9]|20)':'[0-9]+'} required value={value??''} onChange={e=>{const value=e.target.value;if(validRollNumber(value)&&(max===undefined||Number(value)<=max))change(value===''?undefined:Number(value))}}/></label>
    }
    return <form className="action-roll-form master-action-form master-attack-form" aria-label={`Attacco: ${ability.name}`} onSubmit={event=>{
        event.preventDefault()
        if(working.current||targetId===undefined||!complete||!validFinal)return
        working.current=true
        if(onApply([{id:targetId,damage:finalDamage,resolved:true}])===false)working.current=false
    }}>
        <fieldset><legend>{ability.name}</legend>
            <details className="player-action-description" open><summary>Descrizione dell’azione</summary><p className="combat-request-description">{ability.description}</p></details>
            <AbilityTargets candidates={participants.map(p=>({id:p.id,name:p.description}))} ownerId={ability.ownerId} selectedIds={targetId===undefined?[]:[targetId]} maximum={1} summary={targeting.summary}
                onChange={(id,checked)=>{setTargetId(checked?id:undefined);reset()}} renderSelected={()=> <fieldset className="player-roll-packet"><legend>Dadi richiesti</legend>
                    <label className="ability-check"><input type="checkbox" checked={automatic} onChange={e=>{setAutomatic(e.target.checked);reset()}}/>Colpisce automaticamente (senza d20)</label>
                    {!automatic&&<AttackRollFields plan={plan} value={die} onChange={value=>{setDie(value);setDamage({});setRolls({});setOverride('')}}/>}
                    {ready&&<>
                        {!automatic&&profile?.attackMode&&profile.attackMode!=='normal'&&numberInput(`Secondo d20 · ${profile.attackMode==='advantage'?'vantaggio':'svantaggio'}`,rolls.attacks?.[0],value=>{setRolls(r=>({...r,attacks:{0:value!}}));setOverride('')},20)}
                        {!automatic&&profile?.attackDice?.map(bonus=><div key={bonus.id}>{numberInput(`${bonus.label} · d${bonus.sides} (${bonus.sign===1?'bonus, 0 per non usarlo':'penalità'})`,rolls.attackBonuses?.[`0:${bonus.id}`],value=>{setRolls(r=>({...r,attackBonuses:{...r.attackBonuses,[`0:${bonus.id}`]:value!}}));setOverride('')},bonus.sides)}</div>)}
                        <DamageRollFields plan={plan} values={damage} onChange={(type,value)=>{setDamage(d=>({...d,[type]:value}));setOverride('')}}/>
                        {packet?.critical&&plan.damageTypes.map(type=><div key={type}>{numberInput(`Dadi aggiuntivi del critico · ${damageNames[type]}`,rolls.critical?.[`0:${type}`],value=>{setRolls(r=>({...r,critical:{...r.critical,[`0:${type}`]:value!}}));setOverride('')})}</div>)}
                        {complete&&result&&<div className="master-attack-result" aria-live="polite">
                            <p>{automatic?'Colpito per decisione del Master':packet?.needsSecondDie||packet?.needsBonusDice?.length?'Completa i dadi richiesti':packet?.critical?'Colpo critico':packet?.hit===true?'Colpito':packet?.hit===false?'Mancato':'Esito da verificare'}{!automatic&&result.armorClass!==undefined?` · CA ${result.armorClass}`:''}</p>
                            {result.damage!==null?<p>Danni a {target?.description}: <strong>{result.damage}</strong></p>:!packet?.needsCritical.length&&!packet?.needsSecondDie&&!packet?.needsBonusDice?.length&&<label>Danni finali a {target?.description}<input aria-label={`Danni finali a ${target?.description}`} type="text" inputMode="numeric" pattern="[0-9]+" required value={override} onChange={e=>{if(validRollNumber(e.target.value))setOverride(e.target.value)}}/><span className="library-help">Dati incompleti: inserisci la tua decisione.</span></label>}
                            <details><summary>Dettagli del calcolo</summary><ul>{[...result.notes,...plan.notes,...(packet?.steps??[])].map((note,i)=><li key={i}>{note}</li>)}</ul></details>
                        </div>}
                    </>}
                </fieldset>}/>
            {target&&!target.sheet&&<p role="alert">Collega la scheda del bersaglio per calcolare l’attacco.</p>}
            {error&&<p role="alert">{error}</p>}
            <button className="sort-turns" disabled={!target||!complete||!validFinal} type="submit">Applica danni</button>
        </fieldset>
    </form>
}
