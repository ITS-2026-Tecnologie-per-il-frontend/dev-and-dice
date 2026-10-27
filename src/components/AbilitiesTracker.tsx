import {resetTurnEconomy,turnActionCapacity} from '../domain/dnd/TurnEconomy'
import { useContext, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction, type DragEvent } from 'react'
import { durationTurns, activateAbility, type Ability, type Combat } from '../utils/Combat'
import { getDropIndex, getDropTargetId, reorderByDrop, reorderById } from '../utils/Reorder'
import { templateFromCatalog, type Catalog } from '../utils/Catalog'
import { CatalogSearch } from './CatalogSearch'
import { AbilityCard, AbilityMetadata, AbilityUsage, AbilityTargets, WeaponEffectSummary, SpellEffectSummary } from './AbilityCard'
import { InfoButton } from './InfoButton'
import { HelpTooltip } from './HelpTooltip'
import { currentArmorClass, type CharacterSheet } from '../utils/CharacterSheets'
import { ReactionContext } from './ReactionContext'
import type { CreationData } from '../utils/PlayerCreation'
import { combatUseRequirements, combatAbilityInfo, combatAbilityStatus, combatUseOptions, selectedUseOption, bonusActionUsed, type UseOption } from '../domain/dnd/CombatActions'
import { combatTargeting, creatureType, targetTypeError } from '../domain/dnd/CombatTargets'
import { resolutionPlan, weaponDisplayName, weaponEffectDetails, spellEffectDetails, directBenefit } from '../domain/dnd/CombatResolution'
import { MasterSleepForm } from './MasterSleepForm'
import { MasterAttackRolls } from './MasterAttackRolls'
import { MasterSpellRolls, type ResolvedDamagePackets } from './MasterSpellRolls'
import { conditionEffectName, conditionsFor } from '../domain/dnd/CombatConditions'
import { WindDirectionForm } from './WindDirectionForm'
import { SpellSaveNotice } from './AttackRollFields'

type Props = {
    compactActive?:boolean
    configurationId?:number|null
    onConfigure?:(ability:Ability)=>void
    ownerFilter?: number | null
    heading?: string
    onAdd: () => void
    abilities: Ability[]
    setAbilities: Dispatch<SetStateAction<Ability[]>>
    participants: { id: number; description: string; sheet?:CharacterSheet;availableAbilityIndexes?:number[] }[]
    catalog: Catalog
    catalogForOwner?:(ownerId:number|null)=>Catalog
    combat?:Combat|null
    onActivate?:(ability:Ability)=>void
    onEnd?:(ability:Ability)=>boolean
    onResolve?:(ability:Ability,damagePackets?:ResolvedDamagePackets,additionalActionConfirmed?:boolean)=>boolean|void
    onWindDirection?:(ability:Ability,selected:number[],id:string)=>Promise<void>
    windDirectionPending?:number[]
    onCancelCast?:(ability:Ability)=>void
    creationData?:CreationData
    actionError?:{abilityId:number;message:string}|null
}

export function AbilitiesTracker({ compactActive=false,configurationId,onConfigure,ownerFilter, heading, abilities, setAbilities, participants, onAdd, catalog:baseCatalog,catalogForOwner,combat,onActivate,onEnd,onResolve,onCancelCast,creationData,actionError,onWindDirection,windDirectionPending }: Props) {
    const [recasting,setRecasting]=useState<number|null>(null)
    const {before:beforeReaction}=useContext(ReactionContext),[manualHits,setManualHits]=useState<Record<string,string>>({}),[manualBusy,setManualBusy]=useState<number|null>(null),[manualNotice,setManualNotice]=useState<{id:number;text:string}>()
    const latest=useRef({abilities,participants,onResolve}),working=useRef(false)
    useLayoutEffect(()=>{latest.current={abilities,participants,onResolve}})
    const hitKey=(ability:Ability,id:number)=>`${ability.execution?.id}:${id}`
    async function finishManual(ability:Ability,attack:boolean){
        if(!attack||ability.execution?.phase!=='resolving'){onResolve?.(ability);return}
        if(working.current)return
        const hitIds=(ability.targets??[]).filter(t=>manualHits[hitKey(ability,t.id)]==='hit').map(t=>t.id)
        const before=new Map(hitIds.map(id=>{const sheet=participants.find(p=>p.id===id)?.sheet;return [id,sheet?currentArmorClass(sheet):'']}))
        working.current=true;setManualBusy(ability.id);setManualNotice(undefined)
        try{
            if(hitIds.length&&!await beforeReaction({kind:'hit',label:`${ability.name}: il Master ha confermato un attacco a segno.`,targetIds:hitIds,actorId:ability.ownerId??undefined}))return
            const current=latest.current.abilities.find(a=>a.id===ability.id&&a.execution?.id===ability.execution?.id)
            if(!current)return
            const changed=hitIds.filter(id=>{const sheet=latest.current.participants.find(p=>p.id===id)?.sheet;return (sheet?currentArmorClass(sheet):'')!==before.get(id)})
            if(changed.length){
                setManualHits(hits=>({...hits,...Object.fromEntries(changed.map(id=>[hitKey(current,id),'']))}))
                setAbilities(items=>items.map(a=>a.id===current.id?{...a,targets:a.targets?.map(t=>changed.includes(t.id)?{...t,damage:'',resolved:false}:t)}:a))
                setManualNotice({id:ability.id,text:'La reazione ha modificato la CA: '+changed.map(id=>{const target=latest.current.participants.find(p=>p.id===id);return `${target?.description}: ${before.get(id)||'da verificare'} → ${target?.sheet?currentArmorClass(target.sheet):'da verificare'}`}).join('; ')+'. Ricontrolla il tiro per colpire e conferma di nuovo esito e danni; se l’attacco manca, non applicare gli effetti legati al colpo.'})
                return
            }
            // A refreshed snapshot must retain the hit/miss decision made before waiting.
            latest.current.onResolve?.({...current,targets:current.targets?.map(t=>({...t,resolved:!!manualHits[hitKey(current,t.id)]}))})
        }catch(error){setManualNotice({id:ability.id,text:error instanceof Error?error.message:'Reazione non disponibile.'})}
        finally{working.current=false;setManualBusy(null)}
    }
    function patch(id:number,values:Partial<Ability>) {setAbilities(current=>current.map(ability=>ability.id===id ? {...ability,...values} : ability))}
    function updateAbilityName(id: number, name: string) {
        setAbilities((currentAbilities) =>
            currentAbilities.map((ability) =>
                ability.id === id ? { ...ability, name, catalogId: undefined,weaponEffects:undefined,ruleId:undefined,concentration:undefined,useOption:undefined,requirementsConfirmed:false,targets:[] } : ability,
            ),
        )
    }

    function updateAbilityDuration(id: number, duration: Ability['duration']) {
        setAbilities((currentAbilities) =>
            currentAbilities.map((ability) =>
                ability.id === id ? { ...ability, duration, remainingTurns: durationTurns[duration], timed: duration !== 'Senza conteggio' } : ability,
            ),
        )
    }

    function reorderAbility(sourceId: number, targetId: number) {
        setAbilities((currentAbilities) => reorderById(currentAbilities, sourceId, targetId))
    }

    function handleDragStart(event: DragEvent<HTMLButtonElement>, id: number) {
        event.dataTransfer.setData('application/x-dnd-ability', String(id))
        event.dataTransfer.effectAllowed = 'move'
    }

    function handleListDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        const draggedId = event.dataTransfer.getData('application/x-dnd-ability')
        if (!draggedId) return

        const sourceId = Number(draggedId)
        const targetId = getDropTargetId(event.target)
        const insertionIndex = getDropIndex(event.currentTarget, event.clientY, targetId)
        setAbilities((currentAbilities) => reorderByDrop(currentAbilities, sourceId, targetId, insertionIndex))
    }

    function removeAbility(id: number) {
        const ability=abilities.find((ability)=>ability.id===id)
        if (ability?.execution) return
        if (ability?.active && (ability.timed===false||ability.remainingTurns>0) && onEnd?.(ability)===false) return
        setAbilities((currentAbilities) =>
            currentAbilities.filter((ability) => ability.id !== id),
        )
    }

    const visibleAbilities = abilities.filter(ability => (ownerFilter === undefined || ability.ownerId === ownerFilter)
        && !combatAbilityInfo(ability,catalogForOwner?.(ability.ownerId) ?? baseCatalog).passive)

    function clearAbilities() {
        if (visibleAbilities.some(ability=>ability.execution)) return
        for (const ability of visibleAbilities) if (ability.active&&(ability.timed===false||ability.remainingTurns>0)&&onEnd?.(ability)===false) return
        const ids = new Set(visibleAbilities.map(ability => ability.id))
        setAbilities(current => current.filter(ability => !ids.has(ability.id)))
    }

    return (
        <section className="abilities-tracker" aria-labelledby="abilities-heading">
            <div className="ability-section-heading"><h2 id="abilities-heading">{heading ?? "Abilità"}</h2><HelpTooltip label="Come funzionano durate ed effetti">1 round = 6 secondi. I timer ordinari diminuiscono a fine round; le scadenze verificate seguono l’inizio o la fine del turno indicato. Risolvi tiri salvezza e condizioni prima di concludere l’effetto.</HelpTooltip></div>
            <div className="abilities-list" onDragOver={(event) => event.preventDefault()} onDrop={handleListDrop}>
                {abilities.map((storedAbility, index) => {
                    if(storedAbility.readied)return null
                    const ability={...storedAbility,name:conditionEffectName(storedAbility,abilities)}
                    if (ownerFilter !== undefined && ability.ownerId !== ownerFilter) return null
                    const catalog=catalogForOwner?.(ability.ownerId) ?? baseCatalog,participant=participants.find(participant=>participant.id===ability.ownerId),owner=participant?.sheet
                    const fixedOwner=!!participant && (ability.sheetAbilityIndex!==undefined || ownerFilter===ability.ownerId)
                    if(ability.sheetAbilityIndex!==undefined&&participant?.availableAbilityIndexes&&!participant.availableAbilityIndexes.includes(ability.sheetAbilityIndex)&&!ability.execution&&(!ability.active||ability.timed!==false&&ability.remainingTurns===0))return null
                    const info=combatAbilityInfo(ability,catalog,creationData),running=!!ability.execution || ability.active && (ability.timed===false || ability.remainingTurns>0)
                    if(info.passive||compactActive&&!running&&ability.id!==configurationId)return null
                    let options:UseOption[]=[],option:UseOption|undefined,status='Usa',error=''
                    try {options=combatUseOptions(owner,ability,catalog,creationData);option=selectedUseOption(owner,ability,catalog,creationData);status=combatAbilityStatus(owner,ability,catalog,creationData)} catch(cause) {error=cause instanceof Error ? cause.message : 'Verifica le risorse nella scheda.'}
                    const requirements=combatUseRequirements(combat?owner:owner?{...owner,playerDetails:{...owner.playerDetails,...resetTurnEconomy,'rules2014.spellsThisTurn':'[]','combat.spellsThisTurn':'[]'}}:undefined,ability,catalog,creationData,ability.ownerId===null?undefined:{abilities,ownerId:ability.ownerId,combat})
                    if(!running)error=error||requirements.error||''
                    const sleepForm=ability.ruleId==='phb2014:spell:sleep'&&!!owner&&!!onResolve&&!ability.execution
                    const idleSleep=ability.ruleId==='phb2014:spell:sleep'?abilities.find(a=>a.ruleId===ability.ruleId&&a.ownerId===ability.ownerId&&!a.execution&&(!a.active||a.timed!==false&&a.remainingTurns===0)):undefined
                    if(sleepForm&&!running&&!compactActive&&idleSleep?.id!==ability.id)return null
                    const simpleCantrip=info.level===0 && options.length===1 && option?.id==='cantrip'
                    const targets=ability.targets ?? []
                    const targeting=combatTargeting(ability,catalog,owner,option?.id),tooManyTargets=targeting.maximum!==null && targets.length>targeting.maximum
                    const attackPlan=owner&&creationData&&/^sheet-attack:[0-5]$/.test(ability.ruleId??'')&&option?.id==='free'?resolutionPlan(owner,ability,catalog,'free',{data:creationData,active:abilities}):undefined
                    const simpleAttack=!!onResolve&&attackPlan?.kind==='attack'&&!!owner&&!!creationData
                    const candidatePlan=owner&&info.level!==undefined&&!info.prolonged?resolutionPlan(owner,ability,catalog,option?.id):undefined
                    const spellPlan=candidatePlan&&(info.instantaneous||ability.ruleId==='phb2014:spell:hold-person'||ability.ruleId==='phb2014:spell:false-life'||directBenefit(candidatePlan))?candidatePlan:undefined
                    const spellRolls=(recasting===ability.id||!ability.active||ability.timed!==false&&ability.remainingTurns===0)&&!!onResolve&&(spellPlan?.kind==='attack'||spellPlan?.kind==='save'||spellPlan?.kind==='automatic'||!!spellPlan?.healing||!!spellPlan?.temporaryHitPoints||directBenefit(spellPlan))&&(info.damage||!!spellPlan?.healing||!!spellPlan?.temporaryHitPoints||ability.ruleId==='phb2014:spell:hold-person'||directBenefit(spellPlan))&&!!creationData
                    const activeTemporaryEffect=running&&!ability.execution&&(!!spellPlan?.temporaryHitPoints||directBenefit(spellPlan))&&recasting!==ability.id
                    const deferredPlan=owner&&ability.ruleId==='phb2014:spell:gust-of-wind'?resolutionPlan(owner,ability,catalog,option?.id):undefined
                    const windDirectionReason=combat?.activeId!==ability.ownerId?'Puoi cambiare direzione soltanto durante il turno del lanciatore.':owner&&bonusActionUsed(owner,turnActionCapacity(owner,abilities,ability.ownerId??undefined,'bonus-action'))?'Hai già usato l’azione bonus in questo turno.':windDirectionPending?.includes(ability.id)?'Cambio direzione in attesa del Master.':conditionsFor(abilities,ability.ownerId??-1).some(c=>['Paralizzato','Incapacitato','Stordito','Privo di sensi'].includes(c))?'Il personaggio non può agire.':undefined
                    const timingControls=<>
                        <label className="ability-duration">
                            <span>Durata</span>
                            {info.instantaneous ? <output>Istantanea</output> : <select
                                disabled={running || info.instantaneous}
                                aria-label={`Durata abilità ${index + 1}`}
                                value={ability.duration}
                                onChange={(event) =>
                                    updateAbilityDuration(ability.id, event.target.value as Ability['duration'])
                                }
                            >
                                {(Object.keys(durationTurns) as Ability['duration'][]).map((duration) => (
                                    <option key={duration} value={duration}>{duration}</option>
                                ))}
                            </select>}
                        </label>
                        {!info.instantaneous && <label className="ability-remaining">
                            <span>{ability.timed === false ? 'Senza conteggio' : `Turni rimanenti${ability.active && ability.remainingTurns === 0 ? ' · Scaduta' : ''}`}</span>
                            <input
                                aria-label={`Turni rimanenti di ${ability.name || `abilità ${index + 1}`}`}
                                type="number"
                                min="0"
                                step="1"
                                disabled={!!ability.execution || ability.timed === false || info.instantaneous}
                                value={ability.remainingTurns}
                                onChange={(event) => {
                                    const remainingTurns = event.target.valueAsNumber
                                    if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0) return
                                    setAbilities((current) => current.map((item) => item.id === ability.id ? { ...item, remainingTurns } : item))
                                }}
                            />
                        </label>}
                    </>
                    if(compactActive&&running&&!ability.execution){
                        const sortable=visibleAbilities.filter(a=>!a.readied&&a.active&&(a.timed===false||a.remainingTurns>0)),position=sortable.findIndex(a=>a.id===ability.id)
                        const seconds=ability.remainingTurns*6,remaining=[Math.floor(seconds/3600)?`${Math.floor(seconds/3600)} h`:'',Math.floor(seconds%3600/60)?`${Math.floor(seconds%3600/60)} min`:'',seconds%60?`${seconds%60} s`:''].filter(Boolean).join(' ')||'0 s'
                        return <AbilityCard key={ability.id} id={`ability-${ability.id}`} tabIndex={-1} data-compact-active="true" data-reorder-item data-reorder-id={ability.id}>
                            <div className="compact-active-heading"><div className="compact-active-order"><button type="button" draggable onDragStart={event=>handleDragStart(event,ability.id)} aria-label={`Sposta ${ability.name} su`} disabled={position<=0} onClick={()=>reorderAbility(ability.id,sortable[position-1].id)}>↑</button><button type="button" aria-label={`Sposta ${ability.name} giù`} disabled={position<0||position===sortable.length-1} onClick={()=>reorderAbility(ability.id,sortable[position+1].id)}>↓</button></div><h3>{ability.name||'Effetto senza nome'}</h3><InfoButton label="Descrizione" name={ability.name} description={ability.description} entry={info.entry} fields={{duration:ability.duration,remainingTurns:ability.remainingTurns,active:true,owner:participant?.description??'Nessuno'}}/></div>
                            <AbilityMetadata duration={ability.timed===false?'Senza conteggio':`${ability.remainingTurns} round · ${remaining}`} owner={participant?.description??'Nessuno'} ownerLabel={info.level!==undefined?'Lanciatore':'Utilizzatore'}/>
                            {!info.instantaneous&&<details className="compact-active-details"><summary>Gestisci durata</summary><div className="compact-active-timing">{timingControls}</div></details>}
                            {!ability.conditionOrigin&&ability.sourceEffectId===undefined&&<AbilityUsage unit={info.unit} concentration={info.concentration||ability.concentration} prolonged={info.prolonged} requirements={requirements}/>}
                            {targets.length>0&&<p className="compact-active-targets"><span>{sleepForm?'Addormentati':'Bersagli'}:</span> {targets.map(t=>participants.find(p=>p.id===t.id)?.description??'Creatura').join(', ')}</p>}
                            <WeaponEffectSummary effects={weaponEffectDetails(ability.weaponEffects??[],participants.flatMap(p=>p.sheet?[p.sheet]:[]))}/><SpellEffectSummary effects={spellEffectDetails({...ability,resolutionEffects:ability.resolutionEffects??spellPlan?.effects},participants.map(p=>({...p,name:p.description})),abilities,creationData)}/>
                            {deferredPlan?.deferredSave&&owner&&<details className="compact-active-details"><summary>Gestisci direzione e bersagli</summary><SpellSaveNotice plan={deferredPlan}/><AbilityTargets candidates={participants.filter(p=>!!p.sheet).map(p=>({id:p.id,name:p.description}))} ownerId={ability.ownerId} selectedIds={targets.map(t=>t.id)} maximum={null} label="Creature nella linea di vento" onChange={(id,checked)=>patch(ability.id,{targets:checked?[...targets,{id,damage:'0',resolved:true}]:targets.filter(t=>t.id!==id)})}/>{onWindDirection&&<WindDirectionForm key={`${ability.id}:${combat?.round}:${combat?.activeId}`} direct choice={{effectId:ability.id,selected:targets.map(t=>t.id),canUse:!windDirectionReason,reason:windDirectionReason}} candidates={participants.filter(p=>!!p.sheet).map(p=>({id:p.id,name:p.description}))} ownerId={ability.ownerId} onSubmit={(selected,id)=>onWindDirection(ability,selected,id)}/>}</details>}
                            <div className="compact-active-actions"><button type="button" className="sort-turns" disabled={!onConfigure||ability.sourceEffectId!==undefined||!!ability.conditionOrigin||!owner} onClick={()=>onConfigure?.(ability)}>Lancia di nuovo</button><button type="button" className="end-combat" onClick={()=>onEnd?onEnd(ability):patch(ability.id,{active:false,remainingTurns:0})}>Termina effetto</button></div>
                            {actionError?.abilityId===ability.id&&<p role="alert">{actionError.message}</p>}
                        </AbilityCard>
                    }
                    return (
                    <AbilityCard
                        id={`ability-${ability.id}`}
                        tabIndex={-1}
                        data-reorder-item
                        data-reorder-id={ability.id}
                        data-owner-fixed={fixedOwner || undefined}
                        data-instantaneous={info.instantaneous || undefined}
                        key={ability.id}
                    >
                        <button
                            aria-label={`Trascina per riordinare l'abilità ${index + 1}`}
                            className="ability-drag-handle"
                            draggable
                            onDragStart={(event) => handleDragStart(event, ability.id)}
                            onKeyDown={(event) => {
                                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                                event.preventDefault()
                                const targetIndex = index + (event.key === 'ArrowUp' ? -1 : 1)
                                const targetAbility = abilities[targetIndex]
                                if (targetAbility) reorderAbility(ability.id, targetAbility.id)
                            }}
                            title="Trascina per riordinare; usa le frecce per spostare"
                            type="button"
                        >
                            <span aria-hidden="true">↕</span>
                        </button>
                        <CatalogSearch
                            aria-label={`Nome abilità ${index + 1}`}
                            className="ability-name"
                            type="text"
                            placeholder="Nome abilità"
                            value={weaponDisplayName(attackPlan,participants.map(caster=>({id:caster.id,name:caster.description})))??catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name}
                            disabled={running}
                            entries={catalog.abilities}
                            onChange={(value) => updateAbilityName(ability.id, value)}
                            onSelect={(entry) => setAbilities((current) => current.map((item) => item.id === ability.id && !running ? { ...item,ruleId:undefined,concentration:undefined,spellLevel:undefined, ...templateFromCatalog(entry),weaponEffects:undefined, remainingTurns: entry.rounds ?? 0, description: undefined,useOption:undefined,castingSource:undefined,resourceCost:1,damageEnabled:undefined,instantaneous:undefined,requirementsConfirmed:false,targets:[] } : item))}
                        />
                        {ability.duration === 'Personalizzata' && !info.instantaneous && <div className="card-info"><span className="library-help">{ability.remainingTurns === 0 ? 'Durata non definita: imposta i turni per avviare il conteggio.' : 'Durata personalizzata in turni.'}</span></div>}
                        {!fixedOwner && timingControls}
                        <div className="ability-owner-controls">
                        {fixedOwner ? <AbilityMetadata duration={info.instantaneous ? 'Istantanea' : ability.duration==='Personalizzata' ? `${ability.remainingTurns} turni` : ability.duration} owner={participant.description || `Creatura ${participant.id+1}`} ownerLabel={info.level!==undefined ? 'Lanciatore' : 'Utilizzatore'}/> : <label className="ability-owner">
                            <span>{info.repairsObject ? 'Chi lancia' : 'PG / mostro'}</span>
                            <select
                                disabled={running}
                                aria-label={`Proprietario di ${ability.name || `abilità ${index + 1}`}`}
                                value={ability.ownerId ?? ''}
                                onChange={(event) => {
                                    const ownerId = event.target.value === '' ? null : Number(event.target.value)
                                    if (ownerId !== null && !participants.some((participant) => participant.id === ownerId)) return
                                    setAbilities((current) => current.map((item) => item.id === ability.id ? { ...item, ownerId,weaponEffects:undefined,useOption:undefined,requirementsConfirmed:false,targets:[] } : item))
                                }}
                            >
                                <option value="">Seleziona PG / mostro</option>
                                {participants.map((participant) => (
                                    <option key={participant.id} value={participant.id}>
                                        {participant.description || `Creatura ${participant.id + 1}`}
                                    </option>
                                ))}
                            </select>
                        </label>}
                        <InfoButton label={fixedOwner ? 'Descrizione' : undefined} name={catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name}
                            description={ability.description}
                            entry={catalog.abilities.find((entry) => entry.id === ability.catalogId)}
                            fields={{ duration: ability.duration, remainingTurns: ability.remainingTurns, active: ability.active, owner: participants.find((participant) => participant.id === ability.ownerId)?.description ?? 'Nessuno' }} />
                        </div>
                        {fixedOwner && !info.instantaneous && <details className="ability-timing-controls"><summary>Gestisci durata</summary><div>{timingControls}</div></details>}
                        {!ability.conditionOrigin&&ability.sourceEffectId===undefined&&<AbilityUsage unit={info.unit} concentration={info.concentration||ability.concentration} prolonged={info.prolonged} requirements={requirements}/>}
                        {sleepForm ? <div className="ability-use-controls">{running?<><p role="status">In esecuzione · {ability.remainingTurns} round</p><p>Addormentati: {targets.map(t=>participants.find(p=>p.id===t.id)?.description??'Creatura').join(', ')}</p><button type="button" className="sort-turns" onClick={()=>{if(idleSleep){document.getElementById(`ability-${idleSleep.id}`)?.scrollIntoView({block:'nearest'});return}setAbilities(current=>[...current,{...ability,id:Math.max(-1,...current.map(a=>a.id))+1,active:false,remainingTurns:10,targets:[],resolutionEffects:undefined,expiresAt:undefined,expiryRound:undefined}])}}>Lancia di nuovo</button></>:<MasterSleepForm ability={ability} owner={owner!} participants={participants} abilities={abilities} data={creationData} catalog={catalog} options={options} optionId={option?.id} error={error} inCombat={!!combat} onApply={onResolve!}/>}{actionError?.abilityId===ability.id&&<p role="alert">{actionError.message}</p>}</div> : spellRolls ? <div className="ability-use-controls">{recasting===ability.id&&<button type="button" className="sort-turns" onClick={()=>setRecasting(null)}>Annulla nuovo lancio</button>}<MasterSpellRolls key={`${ability.id}:${ability.castingSource??'class'}:${ability.temporaryHitPointsSource??''}`} inCombat={!!combat} ability={ability} owner={owner!} participants={participants} abilities={abilities} catalog={catalog} catalogForOwner={catalogForOwner} data={creationData!} options={options} optionId={option?.id} error={error} onApply={(ability,packets,confirmed)=>{const result=onResolve!(ability,packets,confirmed);if(result!==false)setRecasting(null);return result}}>
                            {!simpleCantrip&&<label><span>Origine del lancio</span><select aria-label={`Origine del lancio di ${ability.name}`} disabled={!!ability.execution} value={ability.castingSource??'class'} onChange={event=>patch(ability.id,{castingSource:event.target.value as Ability['castingSource'],useOption:undefined,resourceCost:1,requirementsConfirmed:false})}><option value="class">Slot, trucchetto o rituale</option><option value="resource">Privilegio con risorsa propria</option><option value="free">Privilegio senza costo</option></select></label>}
                        </MasterSpellRolls>{actionError?.abilityId===ability.id&&<p role="alert">{actionError.message}</p>}</div> : simpleAttack ? <div className="ability-use-controls"><MasterAttackRolls ability={ability} owner={owner!} plan={attackPlan!} participants={participants} abilities={abilities} catalog={catalog} catalogForOwner={catalogForOwner} data={creationData!} onApply={targets=>onResolve!({...ability,instantaneous:true,damageEnabled:true,requirementsConfirmed:true,targets,execution:{id:ability.execution?.id??crypto.randomUUID(),phase:'resolving',option:'free',cost:1}})}/>{actionError?.abilityId===ability.id&&<p role="alert">{actionError.message}</p>}</div> : deferredPlan?.deferredSave&&running&&!ability.execution&&owner ? <div className="ability-use-controls wind-area-controls"><p role="status">In esecuzione{ability.timed!==false?` · ${ability.remainingTurns} round`:''}</p><SpellSaveNotice plan={deferredPlan}/>{onWindDirection&&<WindDirectionForm key={`${ability.id}:${combat?.round}:${combat?.activeId}`} direct choice={{effectId:ability.id,selected:targets.map(t=>t.id),canUse:!windDirectionReason,reason:windDirectionReason}} candidates={participants.filter(p=>!!p.sheet).map(p=>({id:p.id,name:p.description}))} ownerId={ability.ownerId} onSubmit={(selected,id)=>onWindDirection(ability,selected,id)}/>}<p className="library-help">Aggiorna liberamente le creature nella linea quando entrano o escono. Non consuma azioni o slot. Il TS si risolve dalla riga della creatura all’inizio del suo turno.</p><AbilityTargets candidates={participants.filter(p=>!!p.sheet).map(p=>({id:p.id,name:p.description}))} ownerId={ability.ownerId} selectedIds={targets.map(t=>t.id)} maximum={null} label="Creature nella linea di vento" onChange={(id,checked)=>patch(ability.id,{targets:checked?[...targets,{id,damage:'0',resolved:true}]:targets.filter(t=>t.id!==id)})}/></div> : deferredPlan?.deferredSave&&onActivate ? <div className="ability-use-controls"><form className="action-roll-form master-action-form" aria-label={`Lancio: ${ability.name}`} onSubmit={event=>{event.preventDefault();onActivate({...ability,requirementsConfirmed:true,damageEnabled:false,instantaneous:false})}}><fieldset aria-label={`Parametri di ${ability.name}`}>
                            <details className="player-action-description" open><summary>Descrizione dell’azione</summary><p className="combat-request-description">{ability.description??info.entry?.description}</p></details>
                            <label>Risorsa<select aria-label="Risorsa" required disabled={running} value={option?.id??''} onChange={event=>patch(ability.id,{useOption:event.target.value})}>{options.map(o=><option value={o.id} key={o.id} disabled={o.remaining!==null&&o.remaining<(o.cost??ability.resourceCost??1)}>{o.label}{o.remaining===null?'':` · ${o.remaining} rimasti`}</option>)}</select></label>
                            <SpellSaveNotice plan={deferredPlan}/>
                            <AbilityTargets candidates={participants.map(candidate=>({id:candidate.id,name:candidate.description||`Creatura ${candidate.id+1}`,unavailableReason:targetTypeError(targeting,creatureType(candidate.sheet))}))} ownerId={ability.ownerId} selectedIds={targets.map(target=>target.id)} maximum={targeting.maximum} summary={targeting.summary} label="Bersagli" disabled={!!ability.execution}
                                onChange={(id,checked)=>patch(ability.id,{targets:checked?[...targets,{id,damage:'0',resolved:false}]:targets.filter(target=>target.id!==id)})}/>
                            {!running&&<button className="sort-turns" type="submit" disabled={!option||!!error}>Lancia incantesimo</button>}
                        </fieldset></form>{error&&<p role="alert">{error}</p>}{actionError?.abilityId===ability.id&&<p role="alert">{actionError.message}</p>}</div> : activeTemporaryEffect&&onResolve ? <div className="ability-use-controls"><WeaponEffectSummary effects={weaponEffectDetails(ability.weaponEffects??[],participants.flatMap(participant=>participant.sheet?[participant.sheet]:[]))}/><SpellEffectSummary effects={spellEffectDetails({...ability,resolutionEffects:ability.resolutionEffects??spellPlan?.effects},participants.map(participant=>({...participant,name:participant.description})),abilities,creationData)}/><p role="status">In esecuzione{ability.timed!==false?` · ${ability.remainingTurns} round`:''}</p>{spellPlan?.temporaryHitPoints&&<button type="button" className="sort-turns master-active-recast" onClick={()=>setRecasting(ability.id)}>Lancia di nuovo</button>}</div> : onResolve && <div className="ability-use-controls">
                            {status!=='Usa' && <p role="status">{status}{ability.active && !ability.execution && ability.timed!==false && ability.remainingTurns>0 ? ` · ${ability.remainingTurns} turni` : ''}</p>}
                            {error && <p role="alert">{error}</p>}
                            {info.entry?.data.ruleStatus==='partial' && <div className="ability-field-help"><span>Effetti da risolvere</span><HelpTooltip label="Informazioni sugli effetti da risolvere">Questa magia ha effetti non completamente automatizzati. Verifica la descrizione e applica gli esiti prima di concludere il lancio.</HelpTooltip></div>}
                            {!info.entry && <label><span>Tipo di utilizzo</span><select aria-label={`Tipo di ${ability.name}`} value={ability.spellLevel ?? ''} disabled={running} onChange={event=>patch(ability.id,{spellLevel:event.target.value==='' ? undefined : Number(event.target.value),useOption:undefined,resourceCost:1,requirementsConfirmed:false})}>
                                <option value="">Abilità / azione</option>{Array.from({length:10},(_,level)=><option value={level} key={level}>{level===0 ? 'Trucchetto' : `Incantesimo di ${level}º livello`}</option>)}
                            </select></label>}
                            {info.level!==undefined && !simpleCantrip && <label><span>Origine del lancio</span><select aria-label={`Origine del lancio di ${ability.name}`} disabled={running} value={ability.castingSource ?? 'class'} onChange={event=>patch(ability.id,{castingSource:event.target.value as Ability['castingSource'],useOption:undefined,resourceCost:1,requirementsConfirmed:false})}>
                                <option value="class">Slot, trucchetto o rituale</option><option value="resource">Privilegio con risorsa propria</option><option value="free">Privilegio senza costo</option>
                            </select></label>}
                            {info.alternatives.length>0 && <label><span>Tempo di lancio</span><select aria-label={`Tempo di lancio di ${ability.name}`} value={ability.castingAlternative ?? 0} disabled={running} onChange={event=>patch(ability.id,{castingAlternative:Number(event.target.value),requirementsConfirmed:false})}>{info.alternatives.map((casting,index)=><option key={index} value={index}>{String(casting.quantity)} {({action:'azione',hour:'ore',minute:'minuti'} as Record<string,string>)[String(casting.unit)] ?? String(casting.unit)}</option>)}</select></label>}
                            {simpleCantrip ? <p className="ability-casting-summary">Trucchetto · senza slot</p> : <label><span>Modalità di utilizzo</span><select aria-label={`Modalità di ${ability.name || `abilità ${index+1}`}`} disabled={running} value={option?.id ?? ''} onChange={event=>patch(ability.id,{useOption:event.target.value,requirementsConfirmed:false})}>
                                {!options.length && <option value="">Nessuna risorsa disponibile nella scheda</option>}
                                {options.map(option=><option key={option.id} value={option.id} disabled={option.remaining!==null && option.remaining<(option.cost ?? ability.resourceCost ?? 1)}>{option.label.replace(' · conferma DM','')}{option.remaining===null ? '' : ` · ${option.remaining} rimanenti`}</option>)}
                            </select></label>}
                            {option && option.remaining!==null && (info.level===undefined || ability.castingSource==='resource') && <label><span>Costo per utilizzo</span><input aria-label={`Costo di ${ability.name}`} type="number" min="1" step="1" value={option.cost ?? ability.resourceCost ?? 1} disabled={running || option.cost!==undefined} onChange={event=>{const cost=event.target.valueAsNumber;if(Number.isSafeInteger(cost)&&cost>0)patch(ability.id,{resourceCost:cost,requirementsConfirmed:false})}} /></label>}
                            {info.repairsObject ? <p className="ability-target-note">Ripara un oggetto toccato, senza infliggere danni. Tempo di lancio: 1 minuto.</p> : <>
                                <label className="ability-check"><input type="checkbox" checked={info.instantaneous} disabled={running} onChange={event=>patch(ability.id,{instantaneous:event.target.checked})}/>Effetto istantaneo</label>
                                <label className="ability-check"><input type="checkbox" checked={info.damage} disabled={running} onChange={event=>patch(ability.id,{damageEnabled:event.target.checked,targets:[],requirementsConfirmed:false})}/>Prevede danni</label>
                            </>}
                            {info.damage&&<AbilityTargets candidates={participants.map(candidate=>({id:candidate.id,name:candidate.description||`Creatura ${candidate.id+1}`,unavailableReason:targetTypeError(targeting,creatureType(candidate.sheet))}))} ownerId={ability.ownerId} selectedIds={targets.map(target=>target.id)} maximum={targeting.maximum} summary={targeting.summary} disabled={running}
                                checkboxLabel={candidate=>`Bersaglio ${candidate.name} di ${ability.name}`}
                                onChange={(id,checked)=>patch(ability.id,{targets:checked?[...targets,{id,damage:'',resolved:false}]:targets.filter(target=>target.id!==id),requirementsConfirmed:false})}
                                renderSelected={candidate=>{const target=targets.find(target=>target.id===candidate.id)!;return ability.execution?.phase==='resolving'&&<>
                                    <label><span>Danno finale dopo TS e difese</span><input aria-label={`Danno finale a ${candidate.name} da ${ability.name}`} type="number" min="0" step="1" value={target.damage} disabled={manualBusy===ability.id||info.attack&&manualHits[hitKey(ability,candidate.id)]==='miss'} onChange={event=>patch(ability.id,{targets:targets.map(item=>item.id===candidate.id?{...item,damage:event.target.value,resolved:info.attack?!!manualHits[hitKey(ability,candidate.id)]:false}:item)})}/></label>
                                    {info.attack?<label>Esito dell’attacco<select aria-label={`Esito di ${ability.name} su ${candidate.name}`} disabled={manualBusy===ability.id} value={manualHits[hitKey(ability,candidate.id)]??''} onChange={event=>{
                                        const hit=event.target.value;setManualHits(hits=>({...hits,[hitKey(ability,candidate.id)]:hit}));patch(ability.id,{targets:targets.map(item=>item.id===candidate.id?{...item,damage:hit==='miss'?'0':item.damage,resolved:!!hit}:item)})
                                    }}><option value="">Da confermare…</option><option value="hit">Colpito</option><option value="miss">Mancato · 0 danni</option></select></label>:<label className="ability-check"><input type="checkbox" aria-label={`Conferma esito di ${ability.name} su ${candidate.name}`} checked={target.resolved} onChange={event=>patch(ability.id,{targets:targets.map(item=>item.id===candidate.id?{...item,resolved:event.target.checked}:item)})}/>Esito e danno confermati</label>}
                                </>}}/>}

                            {!running && (info.level!==undefined || info.damage || requirements.manualChecks.length>0) && <div className="ability-confirmation"><label className="ability-check"><input type="checkbox" checked={ability.requirementsConfirmed===true} onChange={event=>patch(ability.id,{requirementsConfirmed:event.target.checked})}/>{info.repairsObject ? 'Confermo oggetto a contatto, componenti disponibili e requisiti del lancio.' : 'Confermo requisiti e bersagli'}</label>{!info.repairsObject && <HelpTooltip label="Quali requisiti confermare">Controlla azione o reazione, gittata, bersagli e componenti disponibili, inclusi quelli costosi o consumabili, secondo l’edizione della scheda.</HelpTooltip>}</div>}
                            {ability.execution && <>
                                <div className="ability-field-help"><span>{ability.execution.phase==='casting' ? 'Lancio in corso' : 'Risoluzione dell’uso'}</span><HelpTooltip label="Aiuto sulla risoluzione dell’uso">{ability.execution.phase==='casting' ? 'Mantieni la concentrazione e completa il tempo richiesto. La risorsa sarà consumata al completamento del lancio.' : 'Concludi dopo aver applicato gli esiti. Un attacco mancato o un tiro salvezza superato non restituisce eventuali risorse già consumate.'}</HelpTooltip></div>
                                <button className="sort-turns" type="button" disabled={tooManyTargets||manualBusy===ability.id||info.attack&&ability.execution.phase==='resolving'&&targets.some(t=>!manualHits[hitKey(ability,t.id)])} onClick={()=>void finishManual(ability,info.attack)}>{ability.execution.phase==='casting' ? 'Completa lancio' : info.damage ? 'Concludi uso e applica danni' : 'Concludi uso'}</button>
                                {manualBusy===ability.id&&<p role="status">Attendo le reazioni prima di applicare l’attacco…</p>}
                                {manualNotice?.id===ability.id&&<p role="status">{manualNotice.text}</p>}
                                {ability.execution.phase==='casting' && <button className="end-combat" type="button" onClick={()=>onCancelCast?.(ability)}>Interrompi lancio senza consumo</button>}
                            </>}
                            {actionError?.abilityId===ability.id && <p role="alert" id={`ability-error-${ability.id}`}>{actionError.message}</p>}
                        </div>}
                        {!running&&!spellRolls&&!simpleAttack&&!sleepForm&&error&&<p className="ability-use-error" role="status">{error}</p>}
                        {!spellRolls&&!simpleAttack&&(!sleepForm||running)&&(!deferredPlan?.deferredSave||running)&&(onEnd && ability.active && (ability.timed===false || ability.remainingTurns>0) ? <button className="end-combat end-ability" type="button" onClick={()=>onEnd(ability)}>Termina effetto</button> : <button
                            className="activate-ability"
                            aria-describedby={actionError?.abilityId===ability.id ? `ability-error-${ability.id}` : undefined}
                            type="button"
                            disabled={onResolve ? running || tooManyTargets || status==='Esauriti utilizzi' || !!error || !option || !ability.name.trim() || ability.ownerId===null || requirements.manualChecks.length>0&&!ability.requirementsConfirmed : ability.active || (ability.remainingTurns===0 && ability.timed!==false) || !ability.name.trim() || ability.ownerId===null}
                            onClick={() => onActivate ? onActivate(ability) : setAbilities((current) => current.map((item) => item.id === ability.id ? activateAbility(item,combat,participants) : item))}
                        >
                            {onResolve ? status : ability.active ? (ability.timed !== false && ability.remainingTurns === 0 ? 'Scaduta' : 'Attivata') : 'Attiva'}
                        </button>)}
                        <button
                            aria-label={`Elimina ${ability.name || `abilità ${index + 1}`}`}
                            className="delete-ability"
                            disabled={!!ability.execution}
                            onClick={() => removeAbility(ability.id)}
                            title="Elimina abilità"
                            type="button"
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </AbilityCard>
                )})}
                <button
                    className="add-ability"
                    type="button"
                    onClick={onAdd}
                    aria-label="Aggiungi abilità"
                >
                    <span aria-hidden="true">+</span>
                </button>
            </div>
            <div className="ability-actions">
                <button
                    className="clear-abilities"
                    type="button"
                    onClick={clearAbilities}
                    disabled={visibleAbilities.length === 0 || visibleAbilities.some(ability=>!!ability.execution)}
                >
                    {ownerFilter === undefined ? "Cancella tutte le abilità" : "Cancella le abilità di questo partecipante"}
                </button>
            </div>
        </section>
    )
}
