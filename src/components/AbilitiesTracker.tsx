import { type Dispatch, type SetStateAction, type DragEvent } from 'react'
import { durationTurns, activateAbility, type Ability } from '../utils/Combat'
import { getDropIndex, getDropTargetId, reorderByDrop, reorderById } from '../utils/Reorder'
import { templateFromCatalog, type Catalog } from '../utils/Catalog'
import { CatalogSearch } from './CatalogSearch'
import { InfoButton } from './InfoButton'

type Props = {
    onAdd: () => void
    abilities: Ability[]
    setAbilities: Dispatch<SetStateAction<Ability[]>>
    participants: { id: number; description: string }[]
    catalog: Catalog
}

export function AbilitiesTracker({ abilities, setAbilities, participants, onAdd, catalog }: Props) {
    function updateAbilityName(id: number, name: string) {
        setAbilities((currentAbilities) =>
            currentAbilities.map((ability) =>
                ability.id === id ? { ...ability, name, catalogId: undefined } : ability,
            ),
        )
    }

    function updateAbilityDuration(id: number, duration: Ability['duration']) {
        setAbilities((currentAbilities) =>
            currentAbilities.map((ability) =>
                ability.id === id ? { ...ability, duration, remainingTurns: durationTurns[duration] } : ability,
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
        setAbilities((currentAbilities) =>
            currentAbilities.filter((ability) => ability.id !== id),
        )
    }

    function clearAbilities() {
        setAbilities([])
    }

    return (
        <section className="abilities-tracker" aria-labelledby="abilities-heading">
            <h2 id="abilities-heading">Abilità</h2>
            <p className="ability-help">1 turno = 1 round di 6 secondi. Solo le abilità attivate diminuiscono a fine round. L’attivazione è definitiva.</p>
            <div className="abilities-list" onDragOver={(event) => event.preventDefault()} onDrop={handleListDrop}>
                {abilities.map((ability, index) => (
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
                            value={ability.name}
                            disabled={ability.active}
                            entries={catalog.abilities}
                            onChange={(value) => updateAbilityName(ability.id, value)}
                            onSelect={(entry) => setAbilities((current) => current.map((item) => item.id === ability.id && !item.active ? { ...item, ...templateFromCatalog(entry), remainingTurns: entry.rounds ?? 0 } : item))}
                        />
                        <div className="card-info"><InfoButton name={ability.name}
                            entry={catalog.abilities.find((entry) => entry.id === ability.catalogId)}
                            fields={{ duration: ability.duration, remainingTurns: ability.remainingTurns, active: ability.active, owner: participants.find((participant) => participant.id === ability.ownerId)?.description ?? 'Nessuno' }} />
                            {ability.duration === 'Personalizzata' && <span className="library-help">{ability.remainingTurns === 0 ? 'Durata istantanea o non definita: imposta i turni per avviare il conteggio.' : 'Durata personalizzata in turni.'}</span>}
                        </div>
                        <label className="ability-duration">
                            <span>Durata</span>
                            <select
                                disabled={ability.active}
                                aria-label={`Durata abilità ${index + 1}`}
                                value={ability.duration}
                                onChange={(event) =>
                                    updateAbilityDuration(ability.id, event.target.value as Ability['duration'])
                                }
                            >
                                {(Object.keys(durationTurns) as Ability['duration'][]).map((duration) => (
                                    <option key={duration} value={duration}>{duration}</option>
                                ))}
                            </select>
                        </label>
                        <label className="ability-remaining">
                            <span>Turni rimanenti{ability.active && ability.remainingTurns === 0 ? ' · Scaduta' : ''}</span>
                            <input
                                aria-label={`Turni rimanenti di ${ability.name || `abilità ${index + 1}`}`}
                                type="number"
                                min="0"
                                step="1"
                                value={ability.remainingTurns}
                                onChange={(event) => {
                                    const remainingTurns = event.target.valueAsNumber
                                    if (!Number.isSafeInteger(remainingTurns) || remainingTurns < 0) return
                                    setAbilities((current) => current.map((item) => item.id === ability.id ? { ...item, remainingTurns } : item))
                                }}
                            />
                        </label>
                        <label className="ability-owner">
                            <span>PG / mostro</span>
                            <select
                                disabled={ability.active}
                                aria-label={`Proprietario di ${ability.name || `abilità ${index + 1}`}`}
                                value={ability.ownerId ?? ''}
                                onChange={(event) => {
                                    const ownerId = event.target.value === '' ? null : Number(event.target.value)
                                    if (ownerId !== null && !participants.some((participant) => participant.id === ownerId)) return
                                    setAbilities((current) => current.map((item) => item.id === ability.id ? { ...item, ownerId } : item))
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
                        <button
                            className="activate-ability"
                            type="button"
                            disabled={ability.active || ability.remainingTurns === 0 || !ability.name.trim() || ability.ownerId === null}
                            onClick={() => setAbilities((current) => current.map((item) => item.id === ability.id ? activateAbility(item) : item))}
                        >
                            {ability.active ? (ability.remainingTurns === 0 ? 'Scaduta' : 'Attivata') : 'Attiva'}
                        </button>
                        <button
                            aria-label={`Elimina ${ability.name || `abilità ${index + 1}`}`}
                            className="delete-ability"
                            onClick={() => removeAbility(ability.id)}
                            title="Elimina abilità"
                            type="button"
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>
                ))}
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
                    disabled={abilities.length === 0}
                >
                    Cancella tutte le abilità
                </button>
            </div>
        </section>
    )
}
