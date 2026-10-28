import {ActionButton} from './ActionButton'
import {ReactionContext} from './ReactionContext'
import { useContext, useLayoutEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Ability } from '../utils/Combat'
import type { CharacterSheet } from '../utils/CharacterSheets'
import type { Catalog } from '../utils/Catalog'
import type { CreationData } from '../utils/PlayerCreation'
import { combatAbilityInfo, bonusSpellTurnError, requiresAdditionalSpellAction, type UseOption } from '../domain/dnd/CombatActions'
import { assertPacketPlan, directBenefit, weaponCandidates, type WeaponChoice, defenseProfile, resolutionPlan, resolveTarget, packetTargets, damageNames, type ResolutionRolls, type TargetResolution, type ResolutionPlan } from '../domain/dnd/CombatResolution'
import { combatTargeting, creatureType, wearingArmor, assertTargetTypes } from '../domain/dnd/CombatTargets'
import { inventoryEquipment, inventoryFieldValue, referencedInventoryItem } from '../utils/Inventory'
import { ActionRollForm, ResolutionDetails, FinalDamageField, MasterCriticalRolls, MasterResolutionRolls, MasterSavingRolls, type RollSubmission, type ResolutionReview, type RequestDecision } from './CombatRolls'

const validNumber=(value:string)=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))
export type ResolvedDamagePackets={resolution?:TargetResolution;weaponChoice?:WeaponChoice;id:number;damage:number[];healing?:number;temporaryHitPoints?:number;keepTemporaryHitPoints?:boolean;effects?:import('../domain/dnd/CombatResolution').EffectSpec[]}[]

export function MasterSpellRolls({ability,owner,participants,abilities,catalog,catalogForOwner,data,options,optionId,error,children,onApply,inCombat=false}:{
    inCombat?:boolean;ability:Ability;owner:CharacterSheet;participants:{id:number;description:string;sheet?:CharacterSheet}[];abilities:Ability[];catalog:Catalog;catalogForOwner?:(id:number|null)=>Catalog;data:CreationData;options:UseOption[];optionId?:string;error:string;children:ReactNode;
    onApply:(ability:Ability,damagePackets:ResolvedDamagePackets,additionalActionConfirmed?:boolean)=>boolean|void
}) {
    // PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 274, Scorching Ray:
    // keep each ray separate; the versioned resolver handles hits and defenses.
    // PHB 2014, same PDF, pp. 242–243, Fireball: one area damage roll,
    // a Dexterity save for each target, half damage on success.
    const {before:beforeReaction}=useContext(ReactionContext),[waiting,setWaiting]=useState(false),[reactionError,setReactionError]=useState('')
    const applyLatest=useRef<()=>void>(()=>{})
    const [draft,setDraft]=useState<RollSubmission>(),[rolls,setRolls]=useState<Record<number,ResolutionRolls>>({}),[overrides,setOverrides]=useState<Record<number,string>>({})
    const [edited,setEdited]=useState<RollSubmission>(),[properties,setProperties]=useState<Pick<ResolutionPlan,'magical'|'damageTypeOverride'>>({magical:true})
    const [weapons,setWeapons]=useState<Record<number,WeaponChoice>>({})
    const [additionalActionConfirmed,setAdditionalActionConfirmed]=useState(false)
    const additionalActionRequired=inCombat&&requiresAdditionalSpellAction(owner,ability,catalog)
    const decisionId=useId()
    const working=useRef(false),[executionId]=useState(()=>crypto.randomUUID())
    const info=combatAbilityInfo(ability,catalog,data)
    const action={name:ability.name,description:ability.description??info.entry?.description??'',group:'Incantesimi' as const,cost:ability.resourceCost??1,error:error||(inCombat?bonusSpellTurnError(owner,info):undefined)||'',
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
        if(draft){if(plan.temporaryHitPoints&&draft.packets.some(packet=>packet.targetId!==ability.ownerId))throw new Error('Vita Falsata si applica soltanto al lanciatore.');assertPacketPlan(plan,draft.packets,combatTargeting(ability,catalog,owner,draft.option).maximum);assertTargetTypes(combatTargeting(ability,catalog,owner,draft.option),participants,draft.packets.map(p=>p.targetId))}
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
    const finalDamage=(id:number,result:TargetResolution)=>overrides[id]??(result.damage===null?'':String(result.damage))
    useLayoutEffect(()=>{applyLatest.current=()=>{
            if(!draft)return
            const targets=results.map(({id,result})=>({id,damage:finalDamage(id,result!),resolved:true}))
            const damagePackets=results.map(({id,result})=>({id,resolution:result!,...(plan.temporaryHitPoints?{temporaryHitPoints:result!.temporaryHitPoints!,keepTemporaryHitPoints:draft.packets[0].keepTemporaryHitPoints}:{}),...(plan.healing?{healing:result!.healing!}:{}),effects:result!.packets.flatMap(packet=>packet.effects),damage:Number(finalDamage(id,result!))===result!.damage?result!.packets.map(packet=>packet.damage!):[Number(finalDamage(id,result!))]}))
            const applied=onApply({...ability,useOption:draft.option,requirementsConfirmed:true,targets,execution:ability.execution??{id:executionId,phase:'resolving',option:draft.option,cost:draft.cost}},damagePackets,additionalActionConfirmed)
            working.current=false
            if(applied!==false){setDraft(undefined);setEdited(undefined);setRolls({});setOverrides({});setAdditionalActionConfirmed(false)}
    }})
    if(!draft)return <ActionRollForm action={action} targets={participants.map(p=>({id:p.id,name:p.description,creatureType:creatureType(p.sheet),wearingArmor:p.sheet?wearingArmor(p.sheet):undefined}))} ownerId={ability.ownerId} blockedReason={error||'Conferma di disporre di un’altra azione valida per il lancio.'} canSubmit={!error&&(!directBenefit(plan)||!additionalActionRequired||additionalActionConfirmed)} disabled={false} label={`Lancio: ${ability.name}`} className="master-action-form master-spell-form" initialOption={optionId} initialDraft={edited} weaponSelection={{itemsForTarget:(id,effect)=>weaponCandidates(participants.find(participant=>participant.id===id)?.sheet,data,abilities,effect,owner.id),value:weapons,onChange:(id,choice)=>setWeapons(current=>({...current,[id]:choice}))}} submitLabel={directBenefit(plan)?"Applica potenziamento":"Calcola esiti"} onSubmit={draft=>{
        const plan=action.options.find(option=>option.id===draft.option)?.resolution
        if(!plan)throw new Error('Modalità di lancio non disponibile.')
        if(plan.temporaryHitPoints&&draft.packets.some(packet=>packet.targetId!==ability.ownerId))throw new Error('Vita Falsata si applica soltanto al lanciatore.')
        assertPacketPlan(plan,draft.packets,combatTargeting(ability,catalog,owner,draft.option).maximum)
        assertTargetTypes(combatTargeting(ability,catalog,owner,draft.option),participants,draft.packets.map(p=>p.targetId))
        packetTargets(draft.packets)
        if(draft.packets.some(packet=>!participants.some(p=>p.id===packet.targetId&&p.sheet)))throw new Error('Collega la scheda di ogni bersaglio prima di risolvere l’attacco.')
        if(directBenefit(plan)){
            const targets=packetTargets(draft.packets).map(target=>({...target,damage:'0',resolved:true}))
            const effects=plan.effects.map(effect=>effect.kind==='resistance'&&draft.effectChoice?{...effect,types:plan.effectChoices?.filter(type=>type===draft.effectChoice)??[]}:effect)
            const applied=onApply({...ability,resolutionEffects:effects,instantaneous:false,damageEnabled:false,useOption:draft.option,requirementsConfirmed:true,targets,execution:ability.execution??{id:executionId,phase:'resolving',option:draft.option,cost:draft.cost}},targets.map(target=>({id:target.id,damage:[0],...(plan.weaponEffect?{weaponChoice:weapons[target.id]}:{})})),additionalActionConfirmed)
            if(applied!==false){setWeapons({});setAdditionalActionConfirmed(false)}
        }else setDraft(draft)
    }}>{children}{directBenefit(plan)&&additionalActionRequired&&<label className="combat-request-check"><input type="checkbox" checked={additionalActionConfirmed} onChange={event=>setAdditionalActionConfirmed(event.target.checked)}/>Confermo un’altra azione valida per lanciare un incantesimo (es. Azione Impetuosa 2014)</label>}</ActionRollForm>
    const complete=(!additionalActionRequired||additionalActionConfirmed)&&!reviewError&&results.length>0&&results.every(({id,result})=>result&&(!result.save||result.save.success!==undefined&&!result.save.needsSecondDie&&!result.save.needsBonusDice?.length)&&!result.packets.some(packet=>packet.needsCritical.length||packet.needsSecondDie||packet.needsBonusDice?.length)&&validNumber(finalDamage(id,result)))
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
            if(!draft.damageEnabled)return null
            const result=target.resolution!,calculated=result.damage===null?'':String(result.damage)
            return <FinalDamageField target={target} result={result} value={finalDamage(target.id,result)} calculated={calculated} disabled={false} formId={decisionId} onChange={value=>setOverrides(current=>{
                const next={...current};if(calculated!==''&&value!==''&&Number(value)===Number(calculated))delete next[target.id];else next[target.id]=value;return next
            })}/>
        }}/>
        <MasterResolutionRolls request={summary} disabled={false} onDecide={recordRoll}/>
        {reviewError&&<p role="alert">{reviewError}</p>}
        {reactionError&&<p role="alert">{reactionError}</p>}
        {waiting&&<p role="status">Attendo le reazioni prima di applicare gli esiti…</p>}
        <form id={decisionId} className="combat-request-decision" aria-label={`Conferma: ${ability.name}`} onSubmit={async event=>{
            event.preventDefault()
            if(working.current||!complete)return
            working.current=true
            setWaiting(true);setReactionError('')
            try{
                const ids=results.filter(r=>r.result?.packets.some(p=>p.hit===true)).map(r=>r.id)
                const missile=plan.ruleId==='phb2014:spell:magic-missile'
                if((missile||ids.length)&&!await beforeReaction({kind:missile?'magic-missile':'hit',label:`${ability.name}: puoi reagire prima dei danni.`,targetIds:missile?results.map(r=>r.id):ids,actorId:ability.ownerId??undefined})){working.current=false;return}
                applyLatest.current()
            }catch(error){setReactionError(error instanceof Error?error.message:'Reazione non disponibile.');working.current=false}finally{setWaiting(false)}
        }}><fieldset disabled={waiting}>{additionalActionRequired&&<label className="combat-request-check"><input type="checkbox" checked={additionalActionConfirmed} onChange={event=>setAdditionalActionConfirmed(event.target.checked)}/>Confermo un’altra azione valida per lanciare un incantesimo (es. Azione Impetuosa 2014)</label>}<div className="play-actions">
            <ActionButton className="play-primary" type="submit" disabled={waiting||!complete} disabledReason={waiting?'Attendi la risoluzione delle reazioni.':additionalActionRequired&&!additionalActionConfirmed?'Conferma di disporre di un’altra azione valida per il lancio.':reviewError||(!results.length?'Seleziona almeno un bersaglio.':results.some(({result})=>!result)?'Completa i tiri richiesti per ogni bersaglio.':results.some(({result})=>result?.save&&(result.save.success===undefined||result.save.needsSecondDie||result.save.needsBonusDice?.length))?'Completa i tiri salvezza e gli eventuali dadi aggiuntivi.':results.some(({result})=>result?.packets.some(packet=>packet.needsCritical.length||packet.needsSecondDie||packet.needsBonusDice?.length))?'Completa i dadi critici e i dadi aggiuntivi richiesti.':'Inserisci un danno finale valido per ogni bersaglio.')}>{plan.temporaryHitPoints?'Applica PF temporanei':plan.healing?'Applica cura':draft.damageEnabled?'Applica danni':'Applica esiti'}</ActionButton>
            <button className="play-secondary" type="button" onClick={()=>{setEdited(draft);setDraft(undefined);setRolls({});setOverrides({});setProperties({magical:true});working.current=false}}>Modifica tiri</button>
        </div></fieldset></form>
    </section>
}
