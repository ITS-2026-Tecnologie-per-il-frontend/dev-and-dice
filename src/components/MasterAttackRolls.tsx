import {ActionButton} from './ActionButton'
import {conditionsFor} from '../domain/dnd/CombatConditions'
import {ReactionContext} from './ReactionContext'
import { useContext, useLayoutEffect, useRef, useState } from 'react'
import type { Ability } from '../utils/Combat'
import type { CharacterSheet } from '../utils/CharacterSheets'
import type { Catalog } from '../utils/Catalog'
import type { CreationData } from '../utils/PlayerCreation'
import { inventoryEquipment, inventoryFieldValue, referencedInventoryItem } from '../utils/Inventory'
import { defenseProfile, resolutionPlan, resolveTarget, damageNames, type DamageType, type DefenseProfile, type ResolutionPlan, type ResolutionRolls, type TargetResolution } from '../domain/dnd/CombatResolution'
import { combatTargeting } from '../domain/dnd/CombatTargets'
import { AbilityTargets } from './AbilityCard'
import { AttackRollFields, DamageRollFields } from './AttackRollFields'
import { FinalDamageField } from './CombatRolls'

const validRollNumber=(value:string)=>/^\d*$/.test(value)&&Number.isSafeInteger(Number(value))

export function MasterAttackRolls({ability,owner,plan,participants,abilities,catalog,catalogForOwner,data,onApply}:{
    ability:Ability;owner:CharacterSheet;plan:ResolutionPlan;participants:{id:number;description:string;sheet?:CharacterSheet}[];abilities:Ability[];catalog:Catalog;catalogForOwner?:(id:number|null)=>Catalog;data:CreationData;
    onApply:(targets:NonNullable<Ability['targets']>,resolution?:TargetResolution)=>boolean|void
}) {
    const {before:beforeReaction}=useContext(ReactionContext),[waiting,setWaiting]=useState(false),[reactionError,setReactionError]=useState('')
    const applyLatest=useRef<()=>boolean|void>(()=>false)
    const [targetId,setTargetId]=useState<number|undefined>(ability.targets?.[0]?.id),[die,setDie]=useState(''),[automatic,setAutomatic]=useState(false)
    const [damage,setDamage]=useState<Partial<Record<DamageType,string>>>({}),[rolls,setRolls]=useState<ResolutionRolls>({}),[override,setOverride]=useState<{value:string;calculated:string}>()
    const [attackMode,setAttackMode]=useState<NonNullable<DefenseProfile['attackMode']>|''>(''),[criticalDistance,setCriticalDistance]=useState<''|'close'|'far'>('')
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
    const conditionalCritical=plan.edition==='2014'&&targetId!==undefined&&conditionsFor(active,targetId).some(c=>['Addormentato','Privo di sensi','Paralizzato'].includes(c))
    const needsCriticalDistance=conditionalCritical&&!criticalDistance
    const reviewAttack=!!profile?.reviewAttack,needsAttackReview=!automatic&&reviewAttack&&!attackMode
    if(profile&&reviewAttack&&attackMode){profile.attackMode=attackMode;profile.reviewAttack=false}
    // ponytail: an explicit Master ruling skips the attack roll only. It is an ordinary
    // hit, never a fabricated natural 20; condition-based criticals use the explicit distance ruling.
    let result:TargetResolution|undefined,proposal:TargetResolution|undefined,error=''
    try {
        if(ready&&profile){
            const attackPlan=automatic?{...plan,kind:'automatic' as const}:plan
            const packets=[{targetId:targetId!,...(automatic?{}:{die:Number(die)}),damage:plan.damageTypes.map(type=>({type,amount:Number(damage[type]??0)}))}]
            result=resolveTarget(attackPlan,packets,profile,{...rolls,criticalHit:conditionalCritical&&criticalDistance==='close'})
            // Keep unresolved context visible; propose the arithmetic from known defenses without inventing missing dice.
            proposal=result.damage===null?resolveTarget(attackPlan,packets,{...profile,reviewAttack:false,reviewDamage:false},{...rolls,criticalHit:conditionalCritical&&criticalDistance==='close'}):result
        }
    }
    catch(cause){error=cause instanceof Error?cause.message:'Verifica i risultati dei dadi.'}
    const packet=result?.packets[0],complete=ready&&plan.damageTypes.every(type=>damage[type]!==undefined&&damage[type]!=='')
    const calculated=proposal?.damage===null||proposal?.damage===undefined?'':String(proposal.damage)
    const finalDamage=override?.calculated===calculated?override.value:calculated
    const validFinal=finalDamage!==''&&validRollNumber(finalDamage)
    const missingDice=!!packet&&(packet.needsCritical.length>0||packet.needsSecondDie||!!packet.needsBonusDice?.length)
    const canApply=!!target&&!!result&&!error&&complete&&validFinal&&!missingDice&&!needsAttackReview&&!needsCriticalDistance
    useLayoutEffect(()=>{applyLatest.current=()=>canApply?onApply([{id:targetId!,damage:String(Number(finalDamage)),resolved:true}],result):false})
    function reset(){setDie('');setDamage({});setRolls({});setOverride(undefined);setAttackMode('');setCriticalDistance('')}
    function numberInput(label:string,value:number|undefined,change:(value:number|undefined)=>void,max?:number) {
        return <label>{label}<input aria-label={label} type="text" inputMode="numeric" pattern={max===20?'([1-9]|1[0-9]|20)':'[0-9]+'} required value={value??''} onChange={e=>{const value=e.target.value;if(validRollNumber(value)&&(max===undefined||Number(value)<=max))change(value===''?undefined:Number(value))}}/></label>
    }
    return <form className="action-roll-form master-action-form master-attack-form" aria-label={`Attacco: ${ability.name}`} onSubmit={async event=>{
        event.preventDefault()
        if(working.current||!canApply||targetId===undefined)return
        working.current=true
        setWaiting(true);setReactionError('')
        try{
            if(packet?.hit===true&&!await beforeReaction({kind:'hit',label:`${ability.name}: un attacco ti ha colpito.`,targetIds:[targetId],actorId:ability.ownerId??undefined})){working.current=false;return}
            if(applyLatest.current()===false)working.current=false
        }catch(error){setReactionError(error instanceof Error?error.message:'Reazione non disponibile.');working.current=false}finally{setWaiting(false)}
    }}>
        <fieldset disabled={waiting}><legend>{ability.name}</legend>
            <details className="player-action-description" open><summary>{plan.weaponEnhancements?.length?'Valori di base dell’arma':'Descrizione dell’azione'}</summary><p className="combat-request-description">{ability.description}</p></details>
            <AbilityTargets candidates={participants.map(p=>({id:p.id,name:p.description}))} ownerId={ability.ownerId} selectedIds={targetId===undefined?[]:[targetId]} maximum={1} summary={targeting.summary}
                onChange={(id,checked)=>{setTargetId(checked?id:undefined);reset()}} renderSelected={()=> <fieldset className="player-roll-packet"><legend>Dadi richiesti</legend>
                    <label className="ability-check"><input type="checkbox" checked={automatic} onChange={e=>{setAutomatic(e.target.checked);reset()}}/>Colpisce automaticamente (senza d20)</label>
                    {!automatic&&reviewAttack&&<div className="master-attack-context"><label>Modalità del tiro<select aria-label="Modalità del tiro" required value={attackMode} onChange={event=>{setAttackMode(event.target.value as typeof attackMode);setRolls({});setOverride(undefined)}}><option value="">Scegli la modalità…</option><option value="normal">Normale</option><option value="advantage">Con vantaggio</option><option value="disadvantage">Con svantaggio</option></select></label><p className="library-help">Verifica distanza, visibilità e condizioni prima di applicare l’attacco. Contro un bersaglio Prono: vantaggio entro 1,5 m, svantaggio oltre; considera gli altri effetti.</p></div>}
                    {conditionalCritical&&<div className="master-attack-context"><label>Distanza dal bersaglio<select aria-label="Distanza per il critico da condizione" required value={criticalDistance} onChange={event=>{setCriticalDistance(event.target.value as typeof criticalDistance);setRolls({});setOverride(undefined)}}><option value="">Scegli la distanza…</option><option value="close">Entro 1,5 m: il colpo a segno è critico</option><option value="far">Oltre 1,5 m: nessun critico automatico</option></select></label><p className="library-help">Contro un bersaglio paralizzato o privo di sensi, ogni colpo a segno entro 1,5 m è critico.</p></div>}
                    {!automatic&&<AttackRollFields showTotal={false} plan={plan} value={die} onChange={value=>{setDie(value);setDamage({});setRolls({});setOverride(undefined)}}/>}
                    {ready&&<>
                        {!automatic&&profile?.attackMode&&profile.attackMode!=='normal'&&numberInput(`Secondo d20 · ${profile.attackMode==='advantage'?'vantaggio':'svantaggio'}`,rolls.attacks?.[0],value=>{setRolls(r=>({...r,attacks:{0:value!}}));setOverride(undefined)},20)}
                        {!automatic&&profile?.attackDice?.map(bonus=><div key={bonus.id}>{numberInput(`${bonus.label} · d${bonus.sides} (${bonus.sign===1?'bonus, 0 per non usarlo':'penalità'})`,rolls.attackBonuses?.[`0:${bonus.id}`],value=>{setRolls(r=>({...r,attackBonuses:{...r.attackBonuses,[`0:${bonus.id}`]:value!}}));setOverride(undefined)},bonus.sides)}</div>)}
                        <div className="master-attack-hit-summary">{!automatic&&<p className="ability-casting-summary" role="status" aria-label="Totale tiro per colpire">Totale: <strong>{packet?.total??'—'}</strong></p>}
                        {result&&<p className="master-attack-outcome" role="status" aria-label="Esito tiro per colpire">{automatic?'Colpito per decisione del Master':needsAttackReview?'Verifica modalità del tiro':packet?.needsSecondDie||packet?.needsBonusDice?.length?'Completa i dadi richiesti':packet?.critical?'Colpo critico':packet?.hit===true?'Colpito':packet?.hit===false?'Mancato':'Esito da verificare'}{!automatic&&result.armorClass!==undefined?` · CA ${result.armorClass}`:''}</p>}
                        </div><div className="master-attack-damage">
                            <DamageRollFields label="Tira danni" plan={plan} values={damage} onChange={(type,value)=>{setDamage(d=>({...d,[type]:value}));setOverride(undefined)}}/>
                            {packet?.critical&&plan.damageTypes.map(type=><div key={type}>{numberInput(`Dadi aggiuntivi del critico · ${damageNames[type]}`,rolls.critical?.[`0:${type}`],value=>{setRolls(r=>({...r,critical:{...r.critical,[`0:${type}`]:value!}}));setOverride(undefined)})}</div>)}
                            {complete&&result&&<div className="master-attack-result" aria-live="polite">
                                <FinalDamageField target={{id:targetId!,name:target?.description??'Bersaglio'}} result={proposal} value={finalDamage} calculated={calculated} disabled={waiting} onChange={value=>{if(validRollNumber(value))setOverride(value===calculated?undefined:{value,calculated})}}/>
                                {calculated!==''&&<p className="library-help">{profile?.reviewDamage?'Totale proposto con le difese riconosciute':needsCriticalDistance?'Totale provvisorio':'Totale calcolato'}: <strong>{calculated}</strong>. Puoi correggerlo o ripristinarlo.</p>}
                                {needsAttackReview&&<p className="library-help" role="status">Scegli la modalità del tiro per completare la verifica dell’attacco.</p>}
                                <details><summary>Dettagli del calcolo</summary><ul>{[...result.notes,...plan.notes,...(packet?.steps??[])].map((note,i)=><li key={i}>{note}</li>)}</ul></details>
                            </div>}
                        </div>
                    </>}
                </fieldset>}/>
            {target&&!target.sheet&&<p role="alert">Collega la scheda del bersaglio per calcolare l’attacco.</p>}
            {error&&<p role="alert">{error}</p>}
            {reactionError&&<p role="alert">{reactionError}</p>}
            {waiting&&<p role="status">Attendo le reazioni prima di applicare i danni…</p>}
            <ActionButton className="sort-turns" disabled={waiting||!canApply} disabledReason={waiting?'Attendi la risoluzione delle reazioni.':!target?'Seleziona un bersaglio.':needsAttackReview?'Scegli la modalità del tiro per colpire.':needsCriticalDistance?'Indica la distanza dal bersaglio per verificare il colpo critico.':!ready?'Inserisci un d20 valido, da 1 a 20.':error||(!result?'Completa i dati della difesa del bersaglio.':!complete?'Inserisci i dadi dei danni per ogni tipo richiesto.':!validFinal?'Inserisci un danno finale intero maggiore o uguale a zero.':'Completa i dadi aggiuntivi o critici richiesti.')} type="submit">Applica danni</ActionButton>
        </fieldset>
    </form>
}
