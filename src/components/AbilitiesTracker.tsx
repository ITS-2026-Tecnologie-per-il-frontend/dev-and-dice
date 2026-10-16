import { type Dispatch, type SetStateAction, type DragEvent } from 'react'
import { durationTurns, activateAbility, type Ability, type Combat } from '../utils/Combat'
import { getDropIndex, getDropTargetId, reorderByDrop, reorderById } from '../utils/Reorder'
import { templateFromCatalog, type Catalog } from '../utils/Catalog'
import { CatalogSearch } from './CatalogSearch'
import { InfoButton } from './InfoButton'
import type { CharacterSheet } from '../utils/CharacterSheets'
import type { CreationData } from '../utils/PlayerCreation'
import { combatAbilityInfo, combatAbilityStatus, combatUseOptions, selectedUseOption, type UseOption } from '../domain/dnd/CombatActions'

type Props = {
    onAdd: () => void
    abilities: Ability[]
    setAbilities: Dispatch<SetStateAction<Ability[]>>
    participants: { id: number; description: string; sheet?:CharacterSheet }[]
    catalog: Catalog
    catalogForOwner?:(ownerId:number|null)=>Catalog
    combat?:Combat|null
    onActivate?:(ability:Ability)=>void
    onEnd?:(ability:Ability)=>boolean
    onResolve?:(ability:Ability)=>void
    onCancelCast?:(ability:Ability)=>void
    creationData?:CreationData
    actionError?:{abilityId:number;message:string}|null
}

export function AbilitiesTracker({ abilities, setAbilities, participants, onAdd, catalog:baseCatalog,catalogForOwner,combat,onActivate,onEnd,onResolve,onCancelCast,creationData,actionError }: Props) {
    function patch(id:number,values:Partial<Ability>) {setAbilities(current=>current.map(ability=>ability.id===id ? {...ability,...values} : ability))}
    function updateAbilityName(id: number, name: string) {
        setAbilities((currentAbilities) =>
            currentAbilities.map((ability) =>
                ability.id === id ? { ...ability, name, catalogId: undefined,ruleId:undefined,concentration:undefined,useOption:undefined,requirementsConfirmed:false,targets:[] } : ability,
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

    function clearAbilities() {
        if (abilities.some(ability=>ability.execution)) return
        for (const ability of abilities) if (ability.active&&(ability.timed===false||ability.remainingTurns>0)&&onEnd?.(ability)===false) return
        setAbilities([])
    }

    return (
        <section className="abilities-tracker" aria-labelledby="abilities-heading">
            <h2 id="abilities-heading">Abilità</h2>
            <p className="ability-help">1 round = 6 secondi. I timer ordinari diminuiscono a fine round; le scadenze verificate seguono l’inizio o la fine del turno indicato. I TS e le condizioni richiedono risoluzione del DM.</p>
            <div className="abilities-list" onDragOver={(event) => event.preventDefault()} onDrop={handleListDrop}>
                {abilities.map((ability, index) => {
                    const catalog=catalogForOwner?.(ability.ownerId) ?? baseCatalog,owner=participants.find(participant=>participant.id===ability.ownerId)?.sheet
                    const info=combatAbilityInfo(ability,catalog),running=!!ability.execution || ability.active && (ability.timed===false || ability.remainingTurns>0)
                    let options:UseOption[]=[],option:UseOption|undefined,status='Usa',error=''
                    try {options=combatUseOptions(owner,ability,catalog,creationData);option=selectedUseOption(owner,ability,catalog,creationData);status=combatAbilityStatus(owner,ability,catalog,creationData)} catch(cause) {error=cause instanceof Error ? cause.message : 'Verifica le risorse nella scheda.'}
                    const targets=ability.targets ?? []
                    return (
                    <div
                        className="ability-row"
                        id={`ability-${ability.id}`}
                        tabIndex={-1}
                        data-reorder-item
                        data-reorder-id={ability.id}
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
                            value={catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name}
                            disabled={running}
                            entries={catalog.abilities}
                            onChange={(value) => updateAbilityName(ability.id, value)}
                            onSelect={(entry) => setAbilities((current) => current.map((item) => item.id === ability.id && !running ? { ...item,ruleId:undefined,concentration:undefined,spellLevel:undefined, ...templateFromCatalog(entry), remainingTurns: entry.rounds ?? 0, description: undefined,useOption:undefined,castingSource:undefined,resourceCost:1,damageEnabled:undefined,instantaneous:undefined,requirementsConfirmed:false,targets:[] } : item))}
                        />
                        {ability.duration === 'Personalizzata' && !info.instantaneous && <div className="card-info"><span className="library-help">{ability.remainingTurns === 0 ? 'Durata non definita: imposta i turni per avviare il conteggio.' : 'Durata personalizzata in turni.'}</span></div>}
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
                        <div className="ability-owner-controls">
                        <label className="ability-owner">
                            <span>PG / mostro</span>
                            <select
                                disabled={running}
                                aria-label={`Proprietario di ${ability.name || `abilità ${index + 1}`}`}
                                value={ability.ownerId ?? ''}
                                onChange={(event) => {
                                    const ownerId = event.target.value === '' ? null : Number(event.target.value)
                                    if (ownerId !== null && !participants.some((participant) => participant.id === ownerId)) return
                                    setAbilities((current) => current.map((item) => item.id === ability.id ? { ...item, ownerId,useOption:undefined,requirementsConfirmed:false,targets:[] } : item))
                                }}
                            >
                                <option value="">Seleziona PG / mostro</option>
                                {participants.map((participant) => (
                                    <option key={participant.id} value={participant.id}>
                                        {participant.description || `Creatura ${participant.id + 1}`}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <InfoButton name={catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name}
                            description={ability.description}
                            entry={catalog.abilities.find((entry) => entry.id === ability.catalogId)}
                            fields={{ duration: ability.duration, remainingTurns: ability.remainingTurns, active: ability.active, owner: participants.find((participant) => participant.id === ability.ownerId)?.description ?? 'Nessuno' }} />
                        </div>
                        {onResolve && <div className="ability-use-controls">
                            <p role="status">{status}{ability.active && !ability.execution && ability.timed!==false && ability.remainingTurns>0 ? ` · ${ability.remainingTurns} turni` : ''}</p>
                            {error && <p role="alert">{error}</p>}
                            {info.entry?.data.ruleStatus==='partial' && <p className="library-help">Effetti e danni di questa magia vanno risolti con il DM.</p>}
                            {!info.entry && <label><span>Tipo di utilizzo</span><select aria-label={`Tipo di ${ability.name}`} value={ability.spellLevel ?? ''} disabled={running} onChange={event=>patch(ability.id,{spellLevel:event.target.value==='' ? undefined : Number(event.target.value),useOption:undefined,resourceCost:1,requirementsConfirmed:false})}>
                                <option value="">Abilità / azione</option>{Array.from({length:10},(_,level)=><option value={level} key={level}>{level===0 ? 'Trucchetto' : `Incantesimo di ${level}º livello`}</option>)}
                            </select></label>}
                            {info.level!==undefined && <label><span>Origine del lancio</span><select aria-label={`Origine del lancio di ${ability.name}`} disabled={running} value={ability.castingSource ?? 'class'} onChange={event=>patch(ability.id,{castingSource:event.target.value as Ability['castingSource'],useOption:undefined,resourceCost:1,requirementsConfirmed:false})}>
                                <option value="class">Slot, trucchetto o rituale</option><option value="resource">Privilegio con risorsa propria · conferma DM</option><option value="free">Privilegio senza costo · conferma DM</option>
                            </select></label>}
                            {info.alternatives.length>0 && <label><span>Tempo di lancio</span><select aria-label={`Tempo di lancio di ${ability.name}`} value={ability.castingAlternative ?? 0} disabled={running} onChange={event=>patch(ability.id,{castingAlternative:Number(event.target.value),requirementsConfirmed:false})}>{info.alternatives.map((casting,index)=><option key={index} value={index}>{String(casting.quantity)} {({action:'azione',hour:'ore',minute:'minuti'} as Record<string,string>)[String(casting.unit)] ?? String(casting.unit)}</option>)}</select></label>}
                            <label><span>Modalità di utilizzo</span><select aria-label={`Modalità di ${ability.name || `abilità ${index+1}`}`} disabled={running} value={option?.id ?? ''} onChange={event=>patch(ability.id,{useOption:event.target.value,requirementsConfirmed:false})}>
                                {!options.length && <option value="">Nessuna risorsa disponibile nella scheda</option>}
                                {options.map(option=><option key={option.id} value={option.id} disabled={option.remaining!==null && option.remaining<(option.cost ?? ability.resourceCost ?? 1)}>{option.label}{option.remaining===null ? '' : ` · ${option.remaining} rimanenti`}</option>)}
                            </select></label>
                            {(info.level===undefined || ability.castingSource==='resource') && <label><span>Costo per utilizzo</span><input aria-label={`Costo di ${ability.name}`} type="number" min="1" step="1" value={option?.cost ?? ability.resourceCost ?? 1} disabled={running || option?.cost!==undefined} onChange={event=>{const cost=event.target.valueAsNumber;if(Number.isSafeInteger(cost)&&cost>0)patch(ability.id,{resourceCost:cost,requirementsConfirmed:false})}} /></label>}
                            <label className="ability-check"><input type="checkbox" checked={info.instantaneous} disabled={running} onChange={event=>patch(ability.id,{instantaneous:event.target.checked})}/>Effetto istantaneo</label>
                            <label className="ability-check"><input type="checkbox" checked={info.damage} disabled={running} onChange={event=>patch(ability.id,{damageEnabled:event.target.checked,targets:[],requirementsConfirmed:false})}/>Prevede danni</label>
                            {info.damage && <fieldset className="ability-targets"><legend>Bersagli del danno</legend>
                                <p className="library-help">Seleziona le creature coinvolte. Dopo il lancio, risolvi attacchi, TS e difese con il DM e inserisci il danno finale (0 se nessun danno).</p>
                                {participants.map(participant=>{
                                    const target=targets.find(target=>target.id===participant.id),name=participant.description || `Creatura ${participant.id+1}`
                                    return <div className="ability-target" key={participant.id}>
                                        <label className="ability-check"><input type="checkbox" aria-label={`Bersaglio ${name} di ${ability.name}`} checked={!!target} disabled={running} onChange={event=>patch(ability.id,{targets:event.target.checked ? [...targets,{id:participant.id,damage:'',resolved:false}] : targets.filter(target=>target.id!==participant.id),requirementsConfirmed:false})}/>{name}</label>
                                        {target && ability.execution?.phase==='resolving' && <>
                                            <label><span>Danno finale dopo TS e difese</span><input aria-label={`Danno finale a ${name} da ${ability.name}`} type="number" min="0" step="1" value={target.damage} onChange={event=>patch(ability.id,{targets:targets.map(item=>item.id===target.id ? {...item,damage:event.target.value,resolved:false} : item)})} /></label>
                                            <label className="ability-check"><input type="checkbox" aria-label={`Conferma esito di ${ability.name} su ${name}`} checked={target.resolved} onChange={event=>patch(ability.id,{targets:targets.map(item=>item.id===target.id ? {...item,resolved:event.target.checked} : item)})}/>Esito e danno confermati</label>
                                        </>}
                                    </div>
                                })}
                            </fieldset>}
                            {!running && (info.level!==undefined || info.damage) && <label className="ability-check"><input type="checkbox" checked={ability.requirementsConfirmed===true} onChange={event=>patch(ability.id,{requirementsConfirmed:event.target.checked})}/>Confermo requisiti, azione/reazione, gittata, bersagli e componenti disponibili, inclusi quelli costosi o consumabili, per l’edizione della scheda.</label>}
                            {ability.execution && <>
                                <p>{ability.execution.phase==='casting' ? 'Lancio prolungato: mantieni concentrazione e completa il tempo richiesto. La risorsa sarà consumata al completamento.' : 'Uso effettuato. Un attacco mancato o un TS superato non restituisce eventuali risorse consumate.'}</p>
                                <button className="sort-turns" type="button" onClick={()=>onResolve(ability)}>{ability.execution.phase==='casting' ? 'Completa lancio' : info.damage ? 'Concludi uso e applica danni' : 'Concludi uso'}</button>
                                {ability.execution.phase==='casting' && <button className="end-combat" type="button" onClick={()=>onCancelCast?.(ability)}>Interrompi lancio senza consumo</button>}
                            </>}
                            {actionError?.abilityId===ability.id && <p role="alert" id={`ability-error-${ability.id}`}>{actionError.message}</p>}
                        </div>}
                        <button
                            className="activate-ability"
                            aria-describedby={actionError?.abilityId===ability.id ? `ability-error-${ability.id}` : undefined}
                            type="button"
                            disabled={onResolve ? running || status==='Esauriti utilizzi' || !!error || !option || !ability.name.trim() || ability.ownerId===null : ability.active || (ability.remainingTurns===0 && ability.timed!==false) || !ability.name.trim() || ability.ownerId===null}
                            onClick={() => onActivate ? onActivate(ability) : setAbilities((current) => current.map((item) => item.id === ability.id ? activateAbility(item,combat,participants) : item))}
                        >
                            {onResolve ? status : ability.active ? (ability.timed !== false && ability.remainingTurns === 0 ? 'Scaduta' : 'Attivata') : 'Attiva'}
                        </button>
                        {onEnd && ability.active && (ability.timed===false || ability.remainingTurns>0) && <button type="button" onClick={()=>onEnd(ability)}>Termina effetto</button>}
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
                    </div>
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
                    disabled={abilities.length === 0 || abilities.some(ability=>!!ability.execution)}
                >
                    Cancella tutte le abilità
                </button>
            </div>
        </section>
    )
}
