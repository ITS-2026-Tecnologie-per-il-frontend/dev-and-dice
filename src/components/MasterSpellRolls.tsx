import { useId, useRef, useState, type ReactNode } from 'react'
import type { Ability } from '../utils/Combat'
import type { CharacterSheet } from '../utils/CharacterSheets'
import type { Catalog } from '../utils/Catalog'
import type { CreationData } from '../utils/PlayerCreation'
import { combatAbilityInfo, type UseOption } from '../domain/dnd/CombatActions'
import { assertPacketPlan, defenseProfile, resolutionPlan, resolveTarget, packetTargets, damageNames, type ResolutionRolls, type TargetResolution, type ResolutionPlan } from '../domain/dnd/CombatResolution'
import { combatTargeting } from '../domain/dnd/CombatTargets'
import { inventoryEquipment, inventoryFieldValue, referencedInventoryItem } from '../utils/Inventory'
import { ActionRollForm, ResolutionDetails, FinalDamageField, MasterCriticalRolls, MasterResolutionRolls, MasterSavingRolls, type RollSubmission, type ResolutionReview, type RequestDecision } from './CombatRolls'

const validNumber=(value:string)=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))
export type ResolvedDamagePackets={id:number;damage:number[]}[]

export function MasterSpellRolls({ability,owner,participants,abilities,catalog,catalogForOwner,data,options,optionId,error,children,onApply}:{
    ability:Ability;owner:CharacterSheet;participants:{id:number;description:string;sheet?:CharacterSheet}[];abilities:Ability[];catalog:Catalog;catalogForOwner?:(id:number|null)=>Catalog;data:CreationData;options:UseOption[];optionId?:string;error:string;children:ReactNode;
    onApply:(ability:Ability,damagePackets:ResolvedDamagePackets)=>boolean|void
}) {
    // PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 274, Scorching Ray:
    // keep each ray separate; the versioned resolver handles hits and defenses.
    // PHB 2014, same PDF, pp. 242–243, Fireball: one area damage roll,
    // a Dexterity save for each target, half damage on success.
    const [draft,setDraft]=useState<RollSubmission>(),[rolls,setRolls]=useState<Record<number,ResolutionRolls>>({}),[overrides,setOverrides]=useState<Record<number,string>>({})
    const [edited,setEdited]=useState<RollSubmission>(),[properties,setProperties]=useState<Pick<ResolutionPlan,'magical'|'damageTypeOverride'>>({magical:true})
    const decisionId=useId()
    const working=useRef(false),[executionId]=useState(()=>crypto.randomUUID())
    const info=combatAbilityInfo(ability,catalog)
    const action={name:ability.name,description:ability.description??info.entry?.description??'',group:'Incantesimi' as const,cost:ability.resourceCost??1,error,
        resolution:resolutionPlan(owner,ability,catalog,optionId),options:options.filter(option=>!ability.execution||option.id===ability.execution.option).map(option=>({...option,remaining:ability.execution?null:option.remaining,targeting:combatTargeting(ability,catalog,owner,option.id),resolution:resolutionPlan(owner,ability,catalog,option.id)}))}
    const plan={...(action.options.find(option=>option.id===draft?.option)?.resolution??action.resolution)!,...properties}
    const active=abilities.map(effect=>{
        if(effect.resolutionEffects)return effect
        const sheet=participants.find(p=>p.id===effect.ownerId)?.sheet
        const known=sheet&&resolutionPlan(sheet,effect,catalogForOwner?.(effect.ownerId)??catalog,effect.useOption)
        return known&&!known.effectChoices?.length?{...effect,resolutionEffects:known.effects.filter(e=>e.trigger==='always')}:effect
    })
    const actor=defenseProfile(owner,undefined,active,ability.ownerId!,undefined,data)
    const results:{id:number;name:string;profile:ReturnType<typeof defenseProfile>;result?:TargetResolution}[]=[]
    let reviewError=''
    try {
        if(draft)assertPacketPlan(plan,draft.packets,combatTargeting(ability,catalog,owner,draft.option).maximum)
        if(draft)for(const id of new Set(draft.packets.map(packet=>packet.targetId))) {
            const target=participants.find(p=>p.id===id)
            if(!target?.sheet)throw new Error('Collega la scheda del bersaglio per calcolare l’attacco.')
            const armor=inventoryEquipment(referencedInventoryItem(target.sheet,'armor'),target.sheet,data)
            const profile=defenseProfile(target.sheet,plan.save?.ability,active,id,armor?.armor_category==='Heavy'?true:armor||!inventoryFieldValue(target.sheet,'armor')?false:undefined,data)
            profile.attackDice=actor.attackDice
            profile.reviewAttack=profile.reviewAttack||actor.reviewAttack
            profile.attackMode=actor.attackDisadvantage&&profile.grantsAttackAdvantage?'normal':actor.attackDisadvantage?'disadvantage':profile.grantsAttackAdvantage?'advantage':'normal'
            results.push({id,name:target.description,profile,result:resolveTarget(plan,draft.packets.filter(packet=>packet.targetId===id),profile,rolls[id])})
        }
    }catch(cause){reviewError=cause instanceof Error?cause.message:'Verifica i risultati dei dadi.'}
    if(!draft)return <ActionRollForm action={action} targets={participants.map(p=>({id:p.id,name:p.description}))} ownerId={ability.ownerId} canSubmit={!error} disabled={false} label={`Lancio: ${ability.name}`} className="master-action-form master-spell-form" initialOption={optionId} initialDraft={edited} submitLabel="Calcola esiti" onSubmit={draft=>{
        const plan=action.options.find(option=>option.id===draft.option)?.resolution
        if(!plan)throw new Error('Modalità di lancio non disponibile.')
        assertPacketPlan(plan,draft.packets,combatTargeting(ability,catalog,owner,draft.option).maximum)
        packetTargets(draft.packets)
        if(draft.packets.some(packet=>!participants.some(p=>p.id===packet.targetId&&p.sheet)))throw new Error('Collega la scheda di ogni bersaglio prima di risolvere l’attacco.')
        setDraft(draft)
    }}>{children}</ActionRollForm>
    const finalDamage=(id:number,result:TargetResolution)=>overrides[id]??(result.damage===null?'':String(result.damage))
    const complete=!reviewError&&results.length>0&&results.every(({id,result})=>result&&(!result.save||result.save.success!==undefined&&!result.save.needsSecondDie&&!result.save.needsBonusDice?.length)&&!result.packets.some(packet=>packet.needsCritical.length||packet.needsSecondDie||packet.needsBonusDice?.length)&&validNumber(finalDamage(id,result)))
    const summary:ResolutionReview={id:executionId,status:'pending',resolution:plan,packets:draft.packets,mode:plan.kind,damageEnabled:draft.damageEnabled,
        targets:results.map(({id,name,result})=>({...packetTargets(draft.packets.filter(packet=>packet.targetId===id))[0],name,resolution:result}))}
    async function recordRoll(id:string,decision:RequestDecision,body:unknown) {
        if(id!==executionId||decision!=='roll'||!body||typeof body!=='object'||Array.isArray(body))throw new Error('Tiro non valido.')
        const {targetId,kind,value,packet,type,effectId}=body as Record<string,unknown>
        const target=results.find(target=>target.id===targetId)
        if(!target)throw new Error('Bersaglio non disponibile.')
        if(kind==='weapon'&&typeof value==='boolean') {setProperties(current=>({...current,magical:value}));setOverrides({});return}
        if(kind==='damage-type'&&typeof value==='string'&&value!=='untyped'&&Object.hasOwn(damageNames,value)) {setProperties(current=>({...current,damageTypeOverride:value as NonNullable<ResolutionPlan['damageTypeOverride']>}));setOverrides({});return}
        if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error('Risultati dei dadi non validi.')
        if(kind==='save'||kind==='save-second'||kind==='bonus-save') {
            const save=target.result?.save,bonus=target.profile.saveDice?.find(die=>die.id===effectId)
            if(!save||save.automaticFailure)throw new Error('Tiro salvezza non previsto.')
            if(kind==='bonus-save'?!bonus||value>bonus.sides||value<(bonus.sign===-1?1:0):value<1||value>20||kind==='save-second'&&(!save.needsSecondDie||save.die===undefined))throw new Error('Dado del tiro salvezza non valido.')
            const field=kind==='save'?'save':'saveSecond'
            setRolls(current=>({...current,[target.id]:{...current[target.id],...(kind==='bonus-save'?{saveBonuses:{...current[target.id]?.saveBonuses,[String(effectId)]:value}}:{[field]:value})}}))
            setOverrides(current=>{const next={...current};delete next[target.id];return next})
            return
        }
        if(typeof packet!=='number'||!Number.isInteger(packet)||packet<0||!target.result?.packets[packet])throw new Error('Risultati dei dadi non validi.')
        let key:'critical'|'attacks'|'attackBonuses',index:string|number
        if(kind==='critical'&&typeof type==='string'&&plan.damageTypes.includes(type as typeof plan.damageTypes[number])) {key='critical';index=`${packet}:${type}`}
        else if(kind==='attack'&&value>=1&&value<=20) {key='attacks';index=packet}
        else if(kind==='bonus-attack') {
            const bonus=actor.attackDice?.find(die=>die.id===effectId)
            if(!bonus||value>(bonus.sides)||value<(bonus.sign===-1?1:0))throw new Error('Dado bonus non valido.')
            key='attackBonuses';index=`${packet}:${effectId}`
        } else throw new Error('Tiro non previsto per questo attacco.')
        setRolls(current=>({...current,[target.id]:{...current[target.id],[key]:{...current[target.id]?.[key],[index]:value}}}))
        setOverrides(current=>{const next={...current};delete next[target.id];return next})
    }
    return <section className="combat-request combat-request--review master-spell-review" aria-label={`Esiti: ${ability.name}`}>
        {children&&<div className="master-spell-origin">{children}</div>}
        <ResolutionDetails request={summary} review renderSave={target=><MasterSavingRolls request={summary} target={target} disabled={false} onDecide={recordRoll}/>} renderPacket={(target,index)=><MasterCriticalRolls request={summary} target={target} index={index} disabled={false} onDecide={recordRoll}/>} renderTarget={target=>{
            const result=target.resolution!,calculated=result.damage===null?'':String(result.damage)
            return <FinalDamageField target={target} result={result} value={finalDamage(target.id,result)} calculated={calculated} disabled={false} formId={decisionId} onChange={value=>setOverrides(current=>{
                const next={...current};if(calculated!==''&&value!==''&&Number(value)===Number(calculated))delete next[target.id];else next[target.id]=value;return next
            })}/>
        }}/>
        <MasterResolutionRolls request={summary} disabled={false} onDecide={recordRoll}/>
        {reviewError&&<p role="alert">{reviewError}</p>}
        <form id={decisionId} className="combat-request-decision" aria-label={`Conferma: ${ability.name}`} onSubmit={event=>{
            event.preventDefault()
            if(working.current||!complete)return
            working.current=true
            const targets=results.map(({id,result})=>({id,damage:finalDamage(id,result!),resolved:true}))
            const damagePackets=results.map(({id,result})=>({id,damage:Number(finalDamage(id,result!))===result!.damage?result!.packets.map(packet=>packet.damage!):[Number(finalDamage(id,result!))]}))
            if(onApply({...ability,useOption:draft.option,requirementsConfirmed:true,targets,execution:ability.execution??{id:executionId,phase:'resolving',option:draft.option,cost:draft.cost}},damagePackets)===false)working.current=false
        }}><fieldset><div className="play-actions">
            <button className="play-primary" type="submit" disabled={!complete}>Applica danni</button>
            <button className="play-secondary" type="button" onClick={()=>{setEdited(draft);setDraft(undefined);setRolls({});setOverrides({});setProperties({magical:true});working.current=false}}>Modifica tiri</button>
        </div></fieldset></form>
    </section>
}
