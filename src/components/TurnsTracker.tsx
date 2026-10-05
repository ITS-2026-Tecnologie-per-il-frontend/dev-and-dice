import { useRef, useState, type DragEvent } from 'react'

type Turn = {
    id: number
    description: string
    initiative: string
}

export function TurnsTracker() {
    const [turns, setTurns] = useState<Turn[]>([])
    const nextId = useRef(0)

    function createTurn(): Turn {
        return { id: nextId.current++, description: '', initiative: '' }
    }

    function addTurn() {
        const newTurn = createTurn()
        setTurns((currentTurns) => [...currentTurns, newTurn])
    }

    function updateTurn(id: number, field: 'description' | 'initiative', value: string) {
        setTurns((currentTurns) =>
            currentTurns.map((turn) =>
                turn.id === id ? { ...turn, [field]: value } : turn,
            ),
        )
    }

    function reorderTurn(sourceId: number, targetId: number) {
        setTurns((currentTurns) => {
            const sourceIndex = currentTurns.findIndex((turn) => turn.id === sourceId)
            const targetIndex = currentTurns.findIndex((turn) => turn.id === targetId)
            if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return currentTurns

            const reorderedTurns = [...currentTurns]
            const [sourceTurn] = reorderedTurns.splice(sourceIndex, 1)
            const insertionIndex = reorderedTurns.findIndex((turn) => turn.id === targetId)
            reorderedTurns.splice(insertionIndex, 0, sourceTurn)
            return reorderedTurns
        })
    }

    function handleDragStart(event: DragEvent<HTMLButtonElement>, id: number) {
        event.dataTransfer.setData('text/plain', String(id))
        event.dataTransfer.effectAllowed = 'move'
    }

    function handleDrop(event: DragEvent<HTMLDivElement>, targetId: number) {
        event.preventDefault()
        const draggedId = event.dataTransfer.getData('text/plain')
        if (draggedId) reorderTurn(Number(draggedId), targetId)
    }

    function sortTurns() {
        setTurns((currentTurns) =>
            [...currentTurns].sort(
                (first, second) =>
                    Number(second.initiative) - Number(first.initiative)
                    || first.description.localeCompare(second.description, 'it', { sensitivity: 'base' }),
            ),
        )
    }

    function removeTurn(id: number) {
        setTurns((currentTurns) => currentTurns.filter((turn) => turn.id !== id))
    }

    function clearTurns() {
        setTurns([])
    }

    return (
        <section className="turns-tracker" aria-labelledby="turns-heading">
            <h2 id="turns-heading">Turni</h2>
            <div className="turns-list">
                {turns.map((turn, index) => (
                    <div
                        className="turn-row"
                        key={turn.id}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, turn.id)}
                    >
                        <button
                            aria-label={`Trascina per riordinare il turno ${index + 1}`}
                            className="turn-drag-handle"
                            draggable
                            onDragStart={(event) => handleDragStart(event, turn.id)}
                            onKeyDown={(event) => {
                                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                                event.preventDefault()
                                const targetIndex = index + (event.key === 'ArrowUp' ? -1 : 1)
                                const targetTurn = turns[targetIndex]
                                if (targetTurn) reorderTurn(turn.id, targetTurn.id)
                            }}
                            title="Trascina per riordinare; usa le frecce per spostare"
                            type="button"
                        >
                            <span aria-hidden="true">↕</span>
                        </button>
                        <input
                            aria-label={`Creatura del turno ${index + 1}`}
                            className="turn-description"
                            type="text"
                            placeholder="Creatura"
                            value={turn.description}
                            onChange={(event) => updateTurn(turn.id, 'description', event.target.value)}
                        />
                        <label className="initiative-field">
                            <span>Iniziativa</span>
                            <input
                                aria-label={`Iniziativa del turno ${index + 1}`}
                                type="number"
                                value={turn.initiative}
                                onChange={(event) => updateTurn(turn.id, 'initiative', event.target.value)}
                            />
                        </label>
                        <button
                            aria-label={`Elimina il turno ${index + 1}`}
                            className="delete-turn"
                            onClick={() => removeTurn(turn.id)}
                            title="Elimina turno"
                            type="button"
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>
                ))}
                <button
                    className="add-turn"
                    type="button"
                    onClick={addTurn}
                    aria-label="Aggiungi turno"
                >
                    <span aria-hidden="true">+</span>
                </button>
            </div>
            <div className="turn-actions">
                <button className="sort-turns" type="button" onClick={sortTurns}>
                    Ordina per iniziativa ↓
                </button>
                <button
                    className="clear-turns"
                    type="button"
                    onClick={clearTurns}
                    disabled={turns.length === 0}
                >
                    Cancella tutti i turni
                </button>
            </div>
        </section>
    )
}