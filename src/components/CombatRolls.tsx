import {ActionButton} from './ActionButton'
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { playApi, type ActionChoices, type CombatRequest, type CombatTarget, type Game, type PlayerGame } from '../utils/PlayApi'
import { damageNames, saveNames, directBenefit, spellEffectDetails, validPackets, type WeaponChoice, type WeaponEffect, type DamageType, type DamageRoll, type ResolutionPlan, type RollPacket, type TargetResolution } from '../domain/dnd/CombatResolution'
import { signedBonus } from '../utils/CharacterSheets'
import { targetTypeError } from '../domain/dnd/CombatTargets'
import { AbilityTargets, SpellEffectSummary } from './AbilityCard'
import { AttackRollFields, DamageRollFields, HealingRollFields, TemporaryHitPointRollFields, SpellSaveNotice, DiceResult } from './AttackRollFields'

const message=(error:unknown)=>error instanceof Error?error.message:'Operazione non riuscita.'
type Draft={targetId:number;die:string;healingRoll?:string;damage:Partial<Record<DamageType,string>>}
const safeNumber=(value:string)=>/^\d*$/.test(value)&&Number.isSafeInteger(Number(value))

export type RollSubmission={option:string;cost:number;mode:ResolutionPlan['kind'];damageEnabled:boolean;packets:RollPacket[];effectChoice?:string}
type RollAction=Pick<ActionChoices['actions'][number],'name'|'description'|'group'|'cost'|'error'|'options'|'resolution'>

export function PlayerActionRolls({game,choices,action,onUpdate,onSubmitted,formRef}:{game:PlayerGame;choices:ActionChoices;action:ActionChoices['actions'][number];onUpdate:(game:Game)=>void;onSubmitted:()=>void;formRef:RefObject<HTMLFormElement|null>}) {
    const attempt=useRef<{signature:string;body:unknown}>(undefined)
    return <ActionRollForm action={action} targets={choices.targets} ownerId={choices.ownerId} canSubmit={choices.canPropose} blockedReason={choices.blockedReason??'Puoi inviare l’azione soltanto durante il tuo turno.'} disabledReason={game.combatRequests.some(r=>r.status==='pending')?'Hai già una richiesta in attesa del Master.':'La sessione è cambiata: attendi l’aggiornamento del form.'} disabled={game.combatRequests.some(r=>r.status==='pending')||game.revision!==choices.revision} formRef={formRef} id="player-action-proposal" label={`Proposta: ${action.name}`} submitLabel="Invia al Master" onSubmit={async draft=>{
        const body={revision:choices.revision,key:action.key,...draft},signature=JSON.stringify(body)
        if(attempt.current?.signature!==signature)attempt.current={signature,body:{...body,id:crypto.randomUUID()}}
        onUpdate(await playApi<Game>('/games/'+game.id+'/requests','POST',attempt.current.body));attempt.current=undefined;onSubmitted()
    }}/>
}

export function ActionRollForm({action,targets,ownerId,canSubmit,disabled,blockedReason,disabledReason,formRef,id,label,className='',initialOption,initialDraft,children,weaponSelection,submitLabel,onSubmit}:{
    weaponSelection?:{itemsForTarget:(id:number,effect:WeaponEffect)=>{id:string;name:string;quantity:number}[];value:Record<number,WeaponChoice>;onChange:(id:number,choice:WeaponChoice)=>void};
    action:RollAction;targets:ActionChoices['targets'];ownerId:number|null;canSubmit:boolean;disabled:boolean;blockedReason?:string;disabledReason?:string;formRef?:RefObject<HTMLFormElement|null>;id?:string;label:string;className?:string;initialOption?:string;initialDraft?:RollSubmission;children?:ReactNode;submitLabel:string;onSubmit:(draft:RollSubmission)=>void|Promise<void>
}) {
    const [optionId,setOptionId]=useState(()=>initialDraft?.option??initialOption??action.options.find(o=>o.remaining===null||o.remaining>=(o.cost??action.cost))?.id??action.options[0]?.id??'')
    const [rows,setRows]=useState<Draft[]>(()=>initialDraft?.packets.map(packet=>({targetId:packet.targetId,healingRoll:packet.healingRoll===undefined?'':String(packet.healingRoll),die:packet.die===undefined?'':String(packet.die),damage:Object.fromEntries(packet.damage.map(damage=>[damage.type,String(damage.amount)]))}))??[]),[shared,setShared]=useState<Partial<Record<DamageType,string>>>(()=>Object.fromEntries((initialDraft?.packets[0]?.damage??[]).map(damage=>[damage.type,String(damage.amount)]))),[choice,setChoice]=useState(initialDraft?.effectChoice??''),[busy,setBusy]=useState(false),[error,setError]=useState('')
    const [temporaryRoll,setTemporaryRoll]=useState(()=>initialDraft?.packets[0]?.temporaryHitPointsRoll===undefined?'':String(initialDraft.packets[0].temporaryHitPointsRoll)),[keepTemporary,setKeepTemporary]=useState<''|'new'|'current'>(()=>initialDraft?.packets[0]?.keepTemporaryHitPoints===true?'current':initialDraft?.packets[0]?.keepTemporaryHitPoints===false?'new':'')
    const option=action.options.find(o=>o.id===optionId),plan=option?.resolution??action.resolution!,targeting=option?.targeting
    const selfOnly=!!targeting?.selfOnly
    const selectedRows=selfOnly&&ownerId!==null?[{targetId:ownerId,die:'',damage:{}}]:rows
    const optionAvailable=!!option&&(option.remaining===null||option.remaining>=(option.cost??action.cost))
    const invalidTemporary=!!plan.temporaryHitPoints&&(ownerId===null||! /^[1-4]$/.test(temporaryRoll)||plan.temporaryHitPoints.current>0&&!keepTemporary)
    const invalidAttack=plan.kind==='attack'&&rows.some(row=>!/^([1-9]|1[0-9]|20)$/.test(row.die))
    const weaponTargets=plan.weaponEffect&&weaponSelection?rows.map(row=>({id:row.targetId,name:targets.find(target=>target.id===row.targetId)?.name??'',items:weaponSelection.itemsForTarget(row.targetId,plan.weaponEffect!)})):[]
    const invalidWeapon=!!plan.weaponEffect&&!!weaponSelection&&weaponTargets.some(target=>!target.items.some(item=>item.id===weaponSelection.value[target.id]?.itemId)||!!plan.weaponEffect?.extraDamage&&!plan.weaponEffect.extraDamage.choices.some(type=>type===weaponSelection.value[target.id]?.damageType)||!!plan.weaponEffect?.damageDice&&weaponSelection.value[target.id]?.useCastingAbility!==false&&plan.weaponEffect.castingModifier===undefined)
    const submitBlockedReason=busy?'Invio in corso. Attendi la risposta del server.':disabled?disabledReason:action.error||(!canSubmit?blockedReason:!optionAvailable?'La risorsa selezionata non ha utilizzi sufficienti.':invalidWeapon?'Scegli l’arma da potenziare e completa le sue opzioni.':invalidAttack?'Inserisci un d20 da 1 a 20 per ogni attacco.':invalidTemporary?ownerId===null?'Seleziona il personaggio che riceve i PF temporanei.':! /^[1-4]$/.test(temporaryRoll)?'Inserisci il risultato del d4 dei PF temporanei, da 1 a 4.':'Scegli se mantenere i PF temporanei attuali o quelli nuovi.':selectedRows.length===0&&(plan.kind==='attack'||plan.kind==='save'||!!plan.damageTypes.length||!!plan.effects.length||!!plan.weaponEffect||!!plan.healing)?'Seleziona almeno un bersaglio.':plan.healing&&(plan.healing.modifier===undefined||rows.some(row=>!row.healingRoll||Number(row.healingRoll)<plan.healing!.count||Number(row.healingRoll)>plan.healing!.count*plan.healing!.sides))?plan.healing.modifier===undefined?'Completa il modificatore da incantatore nella scheda.':`Inserisci il totale dei dadi di cura, tra ${plan.healing.count} e ${plan.healing.count*plan.healing.sides}.`:plan.maximumPackets!==null&&rows.length>plan.maximumPackets?`Assegna al massimo ${plan.maximumPackets} colpi.`:plan.requiredPackets&&rows.length!==plan.requiredPackets?`Assegna tutti i ${plan.requiredPackets} colpi prima di continuare.`:undefined)
    const hitLimitReached=plan.maximumPackets!==null&&rows.length>=plan.maximumPackets
    const working=useRef(false)
    function patch(index:number,values:Partial<Draft>) {setRows(current=>current.map((row,i)=>i===index?{...row,...values}:row))}
    function addHit(targetId:number) {setRows(current=>plan.maximumPackets!==null&&current.length>=plan.maximumPackets?current:[...current,{targetId,die:'',damage:{}}])}
    function changeOption(id:string) {
        const nextPlan=action.options.find(option=>option.id===id)?.resolution??action.resolution
        setOptionId(id)
        if(nextPlan&&nextPlan.maximumPackets!==null) {
            const maximum=nextPlan.maximumPackets
            setRows(current=>current.length>maximum?current.slice(0,maximum):current)
        }
    }
    async function submit() {
        if(working.current||!canSubmit||disabled||action.error||!optionAvailable||invalidWeapon)return
        const packets:RollPacket[]=plan.temporaryHitPoints?[{targetId:ownerId??-1,damage:[],temporaryHitPointsRoll:Number(temporaryRoll),keepTemporaryHitPoints:keepTemporary==='current'}]:selectedRows.map(row=>({targetId:row.targetId,...(plan.healing?{healingRoll:Number(row.healingRoll)}:{}),...(plan.kind==='attack'?{die:Number(row.die)}:{}),damage:plan.damageTypes.map(type=>({type,amount:Number((plan.sharedDamage?shared:row.damage)[type])}))}))
        if(targeting&&packets.some(packet=>targetTypeError(targeting,targets.find(target=>target.id===packet.targetId)?.creatureType,targets.find(target=>target.id===packet.targetId)?.wearingArmor))){setError('Verifica il tipo dei bersagli selezionati.');return}
        if(!validPackets(packets)){setError('Verifica i risultati dei dadi.');return}
        const body={option:optionId,cost:option.cost??action.cost,mode:plan.kind,damageEnabled:plan.damageTypes.length>0,packets,...(plan.effectChoices?.length?{effectChoice:choice}:{})}
        working.current=true;setBusy(true);setError('')
        try {await onSubmit(body)}catch(error){setError(message(error))}finally{working.current=false;setBusy(false)}
    }
    return <form className={`action-roll-form ${className}`} id={id} ref={formRef} tabIndex={-1} aria-label={label} onSubmit={event=>{event.preventDefault();void submit()}}>
        <fieldset aria-label={`Parametri di ${action.name}`} disabled={busy||disabled}>
            <details className="player-action-description" open><summary>{plan.weaponEnhancements?.length?'Valori di base dell’arma':'Descrizione dell’azione'}</summary><p className="combat-request-description">{action.description}</p></details>
            {children}
            {!(action.options.length===1&&optionId==='free')&&<label>Risorsa<select aria-label="Risorsa" value={optionId} required onChange={event=>changeOption(event.target.value)}>{action.options.map(o=><option value={o.id} key={o.id} disabled={o.remaining!==null&&o.remaining<(o.cost??action.cost)}>{o.label}{o.remaining===null?'':` · ${o.remaining} rimasti`}</option>)}</select></label>}
            {plan.kind==='save'&&<p>Il bersaglio deve effettuare un <strong>tiro salvezza su {saveNames[plan.save!.ability]}</strong>. Lo inserirà il suo giocatore, oppure il Master per una creatura.</p>}
            {plan.kind==='automatic'&&<p>Questa azione non richiede un tiro per colpire. Inserisci soltanto i danni indicati.</p>}
            {plan.deferredSave?<SpellSaveNotice plan={plan}/>:plan.kind==='none'&&!plan.healing&&!plan.temporaryHitPoints&&<p>Questa azione non richiede un tiro per colpire né un tiro dei danni.</p>}
            {plan.effectChoices?.length&&<label>Tipo di protezione<select value={choice} required onChange={event=>setChoice(event.target.value)}><option value="">Scegli il tipo previsto dall’incantesimo…</option>{plan.effectChoices.map(type=><option value={type} key={type}>{damageNames[type]}</option>)}</select></label>}
            {plan.weaponEffect&&<p>Seleziona il personaggio che possiede l’arma da potenziare.</p>}
            {plan.temporaryHitPoints&&<TemporaryHitPointRollFields plan={plan} value={temporaryRoll} keep={keepTemporary} onChange={setTemporaryRoll} onKeep={setKeepTemporary}/>}
            {selfOnly&&<p className="ability-casting-summary">Si applica solo a te stesso.</p>}
            {targeting&&!selfOnly&&!plan.temporaryHitPoints&&<AbilityTargets candidates={targets.map(target=>({...target,unavailableReason:targetTypeError(targeting,target.creatureType,target.wearingArmor)}))} ownerId={ownerId} selectedIds={[...new Set(rows.map(row=>row.targetId))]} maximum={plan.weaponEffect?1:targeting.maximum} disableNewTargets={hitLimitReached} summary={plan.weaponEffect?'Un solo personaggio per questo incantesimo.':targeting.summary} label={plan.healing?'Bersaglio della cura':plan.damageTypes.length?'Bersagli del danno':'Bersagli'}
                onChange={(targetId,checked)=>checked?addHit(targetId):setRows(current=>current.filter(row=>row.targetId!==targetId))}
                renderSelected={candidate=>plan.weaponEffect&&weaponSelection?<WeaponEnchantmentFields effect={plan.weaponEffect} targets={weaponTargets.filter(target=>target.id===candidate.id)} value={weaponSelection.value} onChange={weaponSelection.onChange}/>:plan.healing?<HealingRollFields plan={plan} value={rows.find(row=>row.targetId===candidate.id)?.healingRoll??''} onChange={healingRoll=>{const index=rows.findIndex(row=>row.targetId===candidate.id);patch(index,{healingRoll})}}/>:plan.sharedDamage||plan.kind==='none'?null:plan.kind==='save'&&!plan.damageTypes.length?<SpellSaveNotice plan={plan}/>:<div className="player-packet-rolls">{rows.map((row,index)=>row.targetId!==candidate.id?null:<fieldset key={index} className="player-roll-packet"><legend>{plan.maximumPackets!==1&&plan.maximumPackets!==null?`Colpo ${index+1}`:'Dadi richiesti'}{rows.filter(r=>r.targetId===candidate.id).length>1&&<button className="player-remove-packet" type="button" aria-label={`Rimuovi colpo ${index+1}`} title={`Rimuovi colpo ${index+1}`} onClick={()=>setRows(current=>current.filter((_,i)=>i!==index))}>×</button>}</legend>
                    {plan.kind==='attack'&&<AttackRollFields compact plan={plan} value={row.die} weapon={action.group==='Attacchi fisici'} onChange={die=>patch(index,{die,damage:{}})}/>}
                    {!plan.sharedDamage&&(plan.kind!=='attack'||row.die&&Number(row.die)>=1&&Number(row.die)<=20)&&<DamageRollFields compact plan={plan} values={row.damage} onChange={(type,value)=>patch(index,{damage:{...row.damage,[type]:value}})}/>}
                </fieldset>)}
                    {plan.maximumPackets!==null&&plan.maximumPackets>1&&<ActionButton type="button" disabled={busy||disabled||hitLimitReached} disabledReason={busy?'Invio in corso.':disabled?disabledReason:`Hai già assegnato tutti i ${plan.maximumPackets} colpi disponibili.`} onClick={()=>addHit(candidate.id)}>Aggiungi colpo a {candidate.name}</ActionButton>}
                </div>}/>}
            {rows.length>0&&plan.sharedDamage&&<fieldset className="player-shared-damage"><legend>Danno dell’area</legend><p>Un tiro per tutti i bersagli selezionati.</p><DamageRollFields compact plan={plan} values={shared} onChange={(type,value)=>setShared(current=>({...current,[type]:value}))}/></fieldset>}
            {plan.maximumPackets!==null&&plan.maximumPackets>1&&<p>Colpi assegnati: {rows.length}/{plan.maximumPackets}. Ogni colpo conserva il proprio tiro e i propri danni.</p>}
            {action.error&&<p role="alert">{action.error}</p>}
            <ActionButton className="play-primary" disabled={busy||disabled||!!action.error||!canSubmit||!!submitBlockedReason} disabledReason={submitBlockedReason}>{submitLabel}</ActionButton>
        </fieldset>{error&&<p role="alert">{error}</p>}
    </form>
}

export function SavingThrowRequests({game,onUpdate}:{game:PlayerGame;onUpdate:(game:Game)=>void}) {
    if(!game.rollRequests?.length)return null
    return <section className="play-saving-throws" aria-label="Tiri richiesti"><h2>Tiri richiesti</h2>{game.rollRequests.map(save=><SaveForm key={[save.requestId,save.targetId,save.kind,save.packet,save.effectId].join(':')} game={game} save={save} onUpdate={onUpdate}/>)}</section>
}
function SaveForm({game,save,onUpdate}:{game:PlayerGame;save:NonNullable<PlayerGame['rollRequests']>[number];onUpdate:(game:Game)=>void}) {
    const [die,setDie]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),working=useRef(false)
    const bonus=save.kind==='bonus-save'||save.kind==='bonus-attack'
    const target=game.combatRequests.find(r=>r.id===save.requestId)?.targets.find(t=>t.id===save.targetId)?.name
    const context=save.packet===undefined?'':` · colpo ${save.packet+1}${target?' a '+target:''}`
    const label=(bonus?`${save.label} · tira 1d${save.sides}`:save.kind==='attack'?'Secondo d20 per il tiro per colpire':`Tiro salvezza su ${saveNames[save.ability!]}${save.kind==='save-second'?' · secondo d20':''}`)+context
    function submit(value:number) {
        if(working.current)return
        working.current=true;setBusy(true);setError('')
        void playApi<Game>(`/games/${game.id}/requests/${save.requestId}/roll`,'POST',{revision:game.revision,targetId:save.targetId,kind:save.kind,...(save.packet!==undefined?{packet:save.packet}:{}),...(save.effectId!==undefined?{effectId:save.effectId}:{}),value}).then(onUpdate).catch(e=>setError(message(e))).finally(()=>{working.current=false;setBusy(false)})
    }
    return <form aria-label={`${label} · ${save.actionName}`} onSubmit={event=>{event.preventDefault();submit(Number(die))}}>
        <fieldset disabled={busy}><legend>{save.actionName}</legend><label>{label}{bonus?'':' · inserisci il d20'}<input type="text" inputMode="numeric" pattern={bonus?'[1-4]':'([1-9]|1[0-9]|20)'} required value={die} onChange={event=>{if(safeNumber(event.target.value))setDie(Number(event.target.value)>20?'20':event.target.value)}}/></label>{!bonus&&save.kind!=='attack'&&<p>Bonus della tua scheda: {signedBonus(save.bonus)||'da verificare con il Master'}.</p>}<button type="submit">Invia tiro</button>{bonus&&save.optional&&<button type="button" onClick={()=>submit(0)}>Non usare il dado bonus</button>}</fieldset>{error&&<p role="alert">{error}</p>}
    </form>
}

function D20Roll({value}:{value:number}) {return <DiceResult notation="1d20" value={value}/>}
function DamageDice({rolls,plan}:{rolls:DamageRoll[];plan?:ResolutionPlan}) {
    return rolls.map((roll,i)=>{
        const type=roll.type==='untyped'?plan?.damageTypeOverride??roll.type:roll.type
        return <span className="combat-damage-dice" key={i}><DiceResult notation={plan?.damageDice?.[type]??plan?.damageDice?.[roll.type]??(plan?.damageTypes.length===1?plan.damageHint:'')} value={roll.amount}/> <span>Danni ({damageNames[type]})</span></span>
    })
}

export function WeaponEnchantmentFields({effect,targets,value,onChange}:{effect:WeaponEffect;targets:{id:number;name:string;items:{id:string;name:string;quantity:number}[]}[];value:Record<number,WeaponChoice>;onChange:(id:number,choice:WeaponChoice)=>void}) {
    return <div className="combat-weapon-configuration">{targets.map(target=>{
        const selected=value[target.id]??{itemId:''},item=target.items.find(item=>item.id===selected.itemId)
        return <div key={target.id}><label>Arma di {target.name}<select aria-label={`Arma di ${target.name}`} required value={selected.itemId} onChange={event=>onChange(target.id,{...selected,itemId:event.target.value})}><option value="">Scegli l’arma da modificare…</option>{target.items.map(item=><option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.quantity===1?'esemplare':'esemplari'}</option>)}</select></label>
            {!target.items.length&&<p role="alert">Nessuna arma compatibile. Verifica i collegamenti all’inventario e i requisiti dell’incantesimo.</p>}
            {(item?.quantity??0)>1&&<p>Un esemplare sarà separato automaticamente dagli altri.</p>}
            {effect.extraDamage&&<label>Tipo di danno aggiuntivo a {target.name}<select aria-label={`Tipo di danno aggiuntivo a ${target.name}`} required value={selected.damageType??''} onChange={event=>onChange(target.id,{...selected,damageType:event.target.value as DamageType})}><option value="">Scegli il tipo di danno…</option>{effect.extraDamage.choices.map(type=><option value={type} key={type}>{damageNames[type]}</option>)}</select></label>}
            {effect.damageDice&&<label className="combat-request-check"><input type="checkbox" checked={selected.useCastingAbility!==false} onChange={event=>onChange(target.id,{...selected,useCastingAbility:event.target.checked})}/>Usa la caratteristica da incantatore {effect.castingModifier===undefined?'(da completare)':`(${signedBonus(effect.castingModifier)})`}</label>}
        </div>
    })}</div>
}

export type ResolutionReview=Pick<CombatRequest,'id'|'resolution'|'targets'|'packets'|'mode'|'damageEnabled'|'status'|'wind'>

export function ResolutionDetails({request,review=false,renderTarget,renderPacket,renderSave}:{request:ResolutionReview;review?:boolean;renderSave?:(target:CombatTarget)=>ReactNode;renderTarget?:(target:CombatTarget)=>ReactNode;renderPacket?:(target:CombatTarget,index:number)=>ReactNode}) {
    if(!request.resolution&&!review)return null
    return <div className="combat-resolution-details">{request.resolution?.deferredSave&&<SpellSaveNotice plan={request.resolution}/>} {(request.wind?[]:request.targets).map(target=>{
        const result=target.resolution,attack=target.attack
        const packets=result?.packets??(attack?[attack]:[])
        const calculated=result?.damage??(attack?.hit===false?0:undefined)
        const notes=[...new Set((result?.notes??[]).filter(note=>note.trim()))]
        const targetPackets=request.packets?.filter(p=>p.targetId===target.id)
        const damageRoll=targetPackets?.flatMap(p=>p.damage.map(d=>`${d.amount} ${damageNames[d.type==='untyped'?request.resolution?.damageTypeOverride??d.type:d.type]}`)).join(' + ')??target.damageRoll
        const missingCritical=result?.packets.some(p=>p.needsCritical.length)
        const damageLabel=request.status==='approved'?'Danni applicati':result||calculated!==undefined?'Danni calcolati':'Danni proposti'
        const damageValue=request.status==='approved'?target.damage:result?result.damage??(missingCritical?'Inserisci i dadi del critico':'dati mancanti'):calculated??target.damage
        return <section className="combat-result" key={target.id} aria-label={`Riepilogo di ${target.name}`}>
            <div className="combat-result-heading"><h4>{target.name||'Partecipante'}</h4>{result?.save&&<span className="combat-result-outcome" data-outcome={result.save.success===undefined?'waiting':result.save.success?'success':'failure'}>{result.save.success===undefined?'TS da risolvere':result.save.success?'TS riuscito':'TS fallito'}</span>}</div>
            {(directBenefit(request.resolution)||request.resolution?.effects.some(effect=>effect.kind==='ac'||effect.kind==='ac-base'))&&<SpellEffectSummary effects={result?.effectDetails?[result.effectDetails]:spellEffectDetails({targets:[{id:target.id,damage:'0',resolved:true}],resolutionEffects:request.resolution!.effects},[{id:target.id,name:target.name}])}/>}
            {result?.save&&<dl className="combat-result-stats">
                <div><dt>Tiro salvezza</dt><dd>{saveNames[result.save.ability]}</dd></div><div><dt>Totale</dt><dd>{result.save.total??(result.save.automaticFailure?'Fallimento automatico':'In attesa')}</dd></div><div><dt>CD</dt><dd>{result.save.dc??'Da verificare'}</dd></div>
            </dl>}
            {request.resolution?.temporaryHitPoints&&<p className="combat-result-damage"><span>PF temporanei di {target.name}:</span> <strong>{result?.temporaryHitPoints??'Da verificare'}</strong></p>}
            {request.resolution?.healing&&<p className="combat-result-damage"><span>{request.status==='approved'?'PF recuperati da':'PF da curare a'} {target.name}:</span> <strong>{result?.healing??'Da verificare'}</strong></p>}
            {renderSave?.(target)}
            {packets.map((packet,index)=>{
                if(request.mode!=='attack')return null
                const sent=targetPackets?.[index],die=sent?.die??(index===0?attack?.die:undefined)
                return <div className="combat-result-attack" key={index} aria-label={`Colpo ${index+1} a ${target.name}`}>
                <div className="combat-result-roll-heading"><span>Colpo {index+1}</span><span className="combat-result-outcome" data-outcome={packet.critical?'critical':packet.hit===undefined?'waiting':packet.hit?'hit':'miss'}>{packet.critical&&<svg className="combat-critical-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1 3.2 7.8L23 12l-7.8 3.2L12 23l-3.2-7.8L1 12l7.8-3.2Z" fill="currentColor"/></svg>}{packet.hit===false&&<svg className="combat-miss-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M8 21v-4l-3-2v-4a7 7 0 0 1 14 0v4l-3 2v4Z M10 18v3m4-3v3"/><circle cx="9" cy="11" r="1.2" fill="currentColor"/><circle cx="15" cy="11" r="1.2" fill="currentColor"/><path d="m12 13-1 2h2Z" fill="currentColor"/></svg>}{packet.critical?'Colpo critico':packet.hit===undefined?'Esito da verificare':packet.hit?'Colpito':'Mancato'}</span></div>
                <dl className="combat-result-stats"><div><dt>Totale per colpire</dt><dd>{packet.total??'Da verificare'}</dd></div><div><dt>CA del bersaglio</dt><dd>{result?.armorClass??attack?.armorClass??'Da verificare'}</dd></div>{request.damageEnabled&&<div><dt>Danni del colpo</dt><dd data-pending={'damage' in packet&&packet.damage===null||undefined}>{'damage' in packet?packet.damage??(packet.needsCritical.length?'In attesa del critico':'Da verificare'):packet.hit===false?0:'Da verificare'}</dd></div>}</dl>
                {renderPacket?.(target,index)}
                <details className="combat-result-details" aria-label={`Dettagli del colpo ${index+1} a ${target.name}`}><summary>Dettagli del calcolo</summary>
                    {die!==undefined?<p><span>Tiro inviato</span> <strong><D20Roll value={die}/></strong></p>:!targetPackets&&target.roll&&<p><span>Tiro inviato</span> <strong>{target.roll}</strong></p>}
                    {(request.resolution?.attackBonus??attack?.modifier)!==undefined&&<p><span>Bonus della scheda ({request.resolution?.attackAbility?saveNames[request.resolution.attackAbility]:'caratteristica da verificare'})</span> <strong>{signedBonus(request.resolution?.attackBonus??attack?.modifier)}</strong></p>}
                    {request.damageEnabled&&<p><span>Danni tirati</span> <strong>{sent?<DamageDice rolls={sent.damage} plan={request.resolution}/>:target.damageRoll||'—'}</strong></p>}
                    {'steps' in packet&&packet.steps.length>0&&<ul>{packet.steps.map((step,i)=><li key={i}>{step}</li>)}</ul>}
                    {attack&&<p>Verifica copertura, reazioni e altri effetti.{attack.critical&&<> Per un critico tira due volte i dadi di danno e aggiungi i modificatori una sola volta.</>}</p>}
                </details>
            </div>})}
            {!packets.length&&request.mode==='attack'&&target.hit!==undefined&&<p className="combat-result-outcome" data-outcome={target.hit?'hit':'miss'}>{target.hit?'Colpito':'Mancato'}</p>}
            {renderTarget&&request.status==='pending'?renderTarget(target):request.damageEnabled&&<p className="combat-result-damage"><span>{damageLabel} a {target.name}:</span>{' '}<strong data-pending={request.status!=='approved'&&result?.damage===null||undefined}>{damageValue}</strong></p>}
            {!(request.mode==='attack'&&packets.length>0)&&(target.roll||request.damageEnabled||attack||result?.save||request.resolution?.healing||request.resolution?.temporaryHitPoints||result?.packets.some(packet=>packet.steps.some(step=>step.trim())))&&<details className="combat-result-details"><summary>Dettagli del calcolo</summary>
                {target.roll&&<p><span>Tiro inviato</span> <strong>{targetPackets?.some(p=>p.die!==undefined)?targetPackets.map((p,i)=>p.die!==undefined&&<D20Roll key={i} value={p.die}/>):target.roll}</strong></p>}
                {request.mode==='attack'&&request.resolution?.attackBonus!==undefined&&<p><span>Bonus della scheda ({request.resolution.attackAbility?saveNames[request.resolution.attackAbility]:'caratteristica da verificare'})</span> <strong>{signedBonus(request.resolution.attackBonus)}</strong></p>}
                {attack&&<p><span>Dado / bonus della scheda</span> <strong><D20Roll value={attack.die}/> / {signedBonus(attack.modifier)||'Da verificare'}</strong></p>}
                {result?.save&&<p><span>Dado / bonus del TS</span> <strong>{result.save.die??'In attesa'} / {signedBonus(result.save.bonus)||'Da verificare'}</strong>{result.save.secondDie!==undefined&&<> · secondo d20 {result.save.secondDie}</>}</p>}
                {request.resolution?.temporaryHitPoints&&<p><span>Dado dei PF temporanei</span> <strong><DiceResult notation={request.resolution.temporaryHitPoints.dice} value={targetPackets?.[0]?.temporaryHitPointsRoll}/></strong></p>}
                {request.resolution?.healing&&<p><span>Dadi di guarigione</span> <strong><DiceResult notation={request.resolution.healing.dice} value={targetPackets?.[0]?.healingRoll}/></strong></p>}
                {request.damageEnabled&&<p><span>Danni tirati</span> <strong>{targetPackets?targetPackets.map((p,i)=><DamageDice key={i} rolls={p.damage} plan={request.resolution}/>):damageRoll||'—'}</strong></p>}
                {result?.packets.map((packet,index)=>packet.steps.length>0&&<div key={index}>{result.packets.length>1&&<p>Colpo {index+1}</p>}<ul>{packet.steps.map((step,i)=><li key={i}>{step}</li>)}</ul></div>)}
                {attack&&<p>Verifica copertura, reazioni e altri effetti.{attack.critical&&<> Per un critico tira due volte i dadi di danno e aggiungi i modificatori una sola volta.</>}</p>}
            </details>}
            {notes.length>0&&<details className="combat-result-notes"><summary>Verifiche del Master{notes.length>1?` (${notes.length})`:''}</summary>{notes.map((note,i)=><p key={i}>{note}</p>)}</details>}
        </section>
    })}</div>
}

export function FinalDamageField({target,result,value,calculated,disabled,formId,onChange}:{target:Pick<CombatTarget,'id'|'name'>;result?:TargetResolution;value:string;calculated:string;disabled:boolean;formId?:string;onChange:(value:string)=>void}) {
    const id=useId(),input=useRef<HTMLInputElement>(null)
    const changed=calculated!==''&&(value===''||Number(value)!==Number(calculated))
    return <><div className="combat-result-final"><label htmlFor={id}>Danni finali a {target.name}</label><span className="combat-damage-controls">
        {changed&&<button className="play-secondary combat-damage-reset" type="button" aria-label={`Ripristina danni calcolati a ${target.name}`} title={`Ripristina il valore calcolato (${calculated})`} disabled={disabled} onClick={()=>{onChange(calculated);input.current?.focus()}}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8M3 4v6h6"/></svg></button>}
        <input ref={input} id={id} type="number" form={formId} name={`damage-${target.id}`} autoComplete="off" inputMode="numeric" min="0" step="1" required disabled={disabled} value={value} onChange={event=>onChange(event.target.value)}/>
    </span></div>{result?.damage===null&&<p className="combat-result-incomplete" role="status">{result.packets.some(packet=>packet.needsCritical.length)?'Completa i dadi aggiuntivi del critico per calcolare il totale.':'Calcolo incompleto: completa i dati richiesti o inserisci la decisione del Master.'}</p>}</>
}

export type RequestDecision='approve'|'reject'|'roll'
export function MasterCriticalRolls({request,target,index,disabled,onDecide}:{request:Pick<ResolutionReview,'id'|'status'>;target:CombatTarget;index:number;disabled:boolean;onDecide:(id:string,decision:RequestDecision,body:unknown)=>Promise<void>}) {
    if(request.status!=='pending')return null
    return target.resolution?.packets[index]?.needsCritical.map(type=><MasterDie key={`${target.id}:${index}:${type}`} label={`Dadi aggiuntivi del critico · ${target.name} · colpo ${index+1} · ${damageNames[type]}`} compactLabel={`Dadi aggiuntivi del critico · ${damageNames[type]}`} disabled={disabled} onSubmit={value=>onDecide(request.id,'roll',{targetId:target.id,kind:'critical',packet:index,type,value})}/>)
}
export function MasterSavingRolls({request,target,disabled,onDecide}:{request:ResolutionReview;target:CombatTarget;disabled:boolean;onDecide:(id:string,decision:RequestDecision,body:unknown)=>Promise<void>}) {
    const result=target.resolution
    if(!result||!request.resolution||request.status!=='pending'||request.wind)return null
    return <>{(result.save?.needsBonusDice??[]).map(d=><MasterDie key={`bonus-save:${target.id}:${d.id}`} compactLabel={`${d.label} · TS di ${target.name}`} hint="Inserisci il risultato del dado bonus." label={`${d.label} · TS di ${target.name} · 1d${d.sides}`} bonus allowZero={d.sign===1} disabled={disabled} onSubmit={value=>onDecide(request.id,'roll',{targetId:target.id,kind:'bonus-save',effectId:d.id,value})}/>)} {result.save&&!result.save.automaticFailure&&(result.save.die===undefined||result.save.needsSecondDie)?<MasterDie key={'save:'+target.id+':'+(result.save.die===undefined?'first':'second')} compactLabel={`Tiro salvezza · ${saveNames[result.save.ability]}${result.save.die!==undefined?' · secondo d20':''}`} hint="Inserisci solo il d20: il bonus del bersaglio viene aggiunto automaticamente." label={`Tiro salvezza ${saveNames[result.save.ability]} di ${target.name}${result.save.die!==undefined?' · secondo d20':''}`} die="d20" disabled={disabled} onSubmit={value=>onDecide(request.id,'roll',{targetId:target.id,kind:result.save!.die===undefined?'save':'save-second',value})}/>:null}</>
}
export function MasterResolutionRolls({request,disabled,onDecide}:{request:ResolutionReview;disabled:boolean;onDecide:(id:string,decision:RequestDecision,body:unknown)=>Promise<void>}) {
    if(!request.resolution||request.status!=='pending'||request.wind)return null
    const missed=request.resolution.kind==='attack'&&request.targets.every(t=>t.resolution?.packets.every(p=>p.hit===false))
    return <div className="combat-resolution-rolls">
        {!missed&&request.resolution.kind==='attack'&&request.resolution.magical===null&&request.targets[0]&&<MasterChoice label="Natura dell’arma" options={[['false','Non magica'],['true','Magica']]} disabled={disabled} onSubmit={value=>onDecide(request.id,'roll',{targetId:request.targets[0].id,kind:'weapon',value:value==='true'})}/>}
        {!missed&&request.resolution.damageTypes.includes('untyped')&&!request.resolution.damageTypeOverride&&request.targets[0]&&<MasterChoice label="Tipo di danno dell’attacco" options={Object.entries(damageNames).filter(([key])=>key!=='untyped')} disabled={disabled} onSubmit={value=>onDecide(request.id,'roll',{targetId:request.targets[0].id,kind:'damage-type',value})}/>}
        {request.targets.flatMap(target=>{
        const result=target.resolution
        if(!result)return []
        return [
            ...result.packets.flatMap((packet,index)=>(packet.needsBonusDice??[]).map(d=><MasterDie key={`bonus-attack:${target.id}:${index}:${d.id}`} label={`${d.label} · colpo ${index+1} a ${target.name} · 1d${d.sides}`} bonus allowZero={d.sign===1} disabled={disabled} onSubmit={value=>onDecide(request.id,'roll',{targetId:target.id,kind:'bonus-attack',packet:index,effectId:d.id,value})}/>)),
            ...result.packets.flatMap((packet,index)=>packet.needsSecondDie?[<MasterDie key={`attack:${target.id}:${index}`} label={`Secondo d20 per colpire ${target.name} · colpo ${index+1}`} die="d20" disabled={disabled} onSubmit={value=>onDecide(request.id,'roll',{targetId:target.id,kind:'attack',packet:index,value})}/>]:[])]
    })}</div>
}
function MasterChoice({label,options,disabled,onSubmit}:{label:string;options:[string,string][];disabled:boolean;onSubmit:(value:string)=>Promise<void>}) {
    const [value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),working=useRef(false)
    return <form aria-label={label} onSubmit={event=>{event.preventDefault();if(working.current)return;working.current=true;setBusy(true);setError('');void onSubmit(value).catch(e=>setError(message(e))).finally(()=>{working.current=false;setBusy(false)})}}><fieldset disabled={disabled||busy}><label>{label}<select required value={value} onChange={event=>setValue(event.target.value)}><option value="">Da verificare…</option>{options.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><button type="submit">Conferma proprietà</button></fieldset>{error&&<p role="alert">{error}</p>}</form>
}
function MasterDie({label,die,bonus=false,allowZero=false,compactLabel,hint,disabled,onSubmit}:{label:string;hint?:string;die?:'d20';bonus?:boolean;allowZero?:boolean;compactLabel?:string;disabled:boolean;onSubmit:(value:number)=>Promise<void>}) {
    const [value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),working=useRef(false)
    return <form className={compactLabel?'combat-inline-roll-form':undefined} onSubmit={event=>{event.preventDefault();if(working.current)return;working.current=true;setBusy(true);setError('');void onSubmit(Number(value)).catch(e=>setError(message(e))).finally(()=>{working.current=false;setBusy(false)})}}><fieldset disabled={disabled||busy}><label><span>{compactLabel??label}</span><input aria-label={label} type="text" inputMode="numeric" pattern={die?'([1-9]|1[0-9]|20)':bonus?allowZero?'[0-4]':'[1-4]':'[0-9]+'} required value={value} onChange={event=>{if(safeNumber(event.target.value))setValue(event.target.value)}}/></label>{compactLabel&&<p className="library-help">{hint??'Solo i dadi aggiuntivi: il danno iniziale è già conteggiato.'}</p>}<button type="submit">Registra tiro</button></fieldset>{error&&<p role="alert">{error}</p>}</form>
}
