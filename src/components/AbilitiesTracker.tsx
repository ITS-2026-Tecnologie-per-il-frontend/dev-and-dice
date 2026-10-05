import { useRef, useState, type DragEvent } from 'react'
import { getDropIndex, getDropTargetId, reorderByDrop, reorderById } from '../utils/Reorder'

const durations = ['1 minuto', '10 minuti', '1 ora', '8 ore', '24 ore'] as const

type Ability = {
    id: number
    name: string
    duration: (typeof durations)[number]
}

export function AbilitiesTracker() {
    const [abilities, setAbilities] = useState<Ability[]>([])
    const nextId = useRef(0)

    function createAbility(): Ability {
        return { id: nextId.current++, name: '', duration: durations[0] }
    }

    function addAbility() {
        const newAbility = createAbility()
        setAbilities((currentAbilities) => [...currentAbilities, newAbility])
    }

    function updateAbilityName(id: number, name: string) {
        setAbilities((currentAbilities) =>
            currentAbilities.map((ability) =>
                ability.id === id ? { ...ability, name } : ability,
            ),
        )
    }

    function updateAbilityDuration(id: number, duration: Ability['duration']) {
        setAbilities((currentAbilities) =>
            currentAbilities.map((ability) =>
                ability.id === id ? { ...ability, duration } : ability,
            ),
        )
    }

    function reorderAbility(sourceId: number, targetId: number) {
        setAbilities((currentAbilities) => reorderById(currentAbilities, sourceId, targetId))
    }

    function handleDragStart(event: DragEvent<HTMLButtonElement>, id: number) {
        event.dataTransfer.setData('text/plain', String(id))
        event.dataTransfer.effectAllowed = 'move'
    }

    function handleListDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        const draggedId = event.dataTransfer.getData('text/plain')
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
            <div className="abilities-list" onDragOver={(event) => event.preventDefault()} onDrop={handleListDrop}>
                {abilities.map((ability, index) => (
                    <div
                        className="ability-row"
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
                        <input
                            aria-label={`Nome abilità ${index + 1}`}
                            className="ability-name"
                            type="text"
                            placeholder="Nome abilità"
                            value={ability.name}
                            onChange={(event) => updateAbilityName(ability.id, event.target.value)}
                        />
                        <label className="ability-duration">
                            <span>Durata</span>
                            <select
                                aria-label={`Durata abilità ${index + 1}`}
                                value={ability.duration}
                                onChange={(event) =>
                                    updateAbilityDuration(ability.id, event.target.value as Ability['duration'])
                                }
                            >
                                {durations.map((duration) => (
                                    <option key={duration} value={duration}>{duration}</option>
                                ))}
                            </select>
                        </label>
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
                    onClick={addAbility}
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