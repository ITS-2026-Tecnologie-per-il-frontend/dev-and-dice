import { useRef, useState, type DragEvent } from 'react'
import { CharacterSheets } from './CharacterSheets'
import { characterFields, turnFromSheet, abilitiesFromSheet, type CharacterSheet } from '../utils/CharacterSheets'
import { AbilitiesTracker } from './AbilitiesTracker'
import { nextCombatTurn, sortByInitiative, advanceAbilityDurations, type Ability, type Combat } from '../utils/Combat'
import { getDropIndex, getDropTargetId, reorderByDrop, reorderById } from '../utils/Reorder'

type Turn = {
    id: number
    description: string
    initiative: string
    hitPoints: string
    armorClass: string
    sheet?: CharacterSheet
}

export function TurnsTracker() {
    const [turns, setTurns] = useState<Turn[]>([])
    const [abilities, setAbilities] = useState<Ability[]>([])
    const [combat, setCombat] = useState<Combat | null>(null)
    const nextId = useRef(0)
    const nextAbilityId = useRef(0)

    function createTurn(): Turn {
        return { id: nextId.current++, description: '', initiative: '', hitPoints: '', armorClass: '' }
    }

    function addTurn() {
        const newTurn = createTurn()
        setTurns((currentTurns) => [...currentTurns, newTurn])
    }

    function addCharacter(sheet: CharacterSheet) {
        if (combat) return
        const turn = turnFromSheet(sheet, nextId.current++)
        setTurns((current) => [...current, turn])
        const importedAbilities = abilitiesFromSheet(sheet, turn.id, nextAbilityId.current)
        nextAbilityId.current += importedAbilities.length
        setAbilities((current) => [...current, ...importedAbilities])
    }

    function addAbility() {
        const ability: Ability = { id: nextAbilityId.current++, name: '', duration: '1 minuto', remainingTurns: 10, ownerId: null, active: false }
        setAbilities((current) => [...current, ability])
    }

    function updateTurn(id: number, field: 'description' | 'initiative' | 'hitPoints' | 'armorClass', value: string) {
        setTurns((currentTurns) =>
            currentTurns.map((turn) =>
                turn.id === id ? { ...turn, [field]: value } : turn,
            ),
        )
    }

    function reorderTurn(sourceId: number, targetId: number) {
        setTurns((currentTurns) => reorderById(currentTurns, sourceId, targetId))
    }

    function handleDragStart(event: DragEvent<HTMLButtonElement>, id: number) {
        event.dataTransfer.setData('application/x-dnd-turn', String(id))
        event.dataTransfer.effectAllowed = 'move'
    }

    function handleListDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        if (combat) return
        const draggedId = event.dataTransfer.getData('application/x-dnd-turn')
        if (!draggedId) return

        const sourceId = Number(draggedId)
        const targetId = getDropTargetId(event.target)
        const insertionIndex = getDropIndex(event.currentTarget, event.clientY, targetId)
        setTurns((currentTurns) => reorderByDrop(currentTurns, sourceId, targetId, insertionIndex))
    }

    function sortTurns() {
        setTurns(sortByInitiative(turns))
    }

    function startCombat() {
        if (combat) return
        const orderedTurns = sortByInitiative(turns)
        if (orderedTurns.length === 0) return
        setTurns(orderedTurns)
        setCombat({ activeId: orderedTurns[0].id, round: 1 })
    }

    function advanceTurn() {
        if (!combat) return
        const next = nextCombatTurn(turns, combat)
        if (next && next.round > combat.round) setAbilities(advanceAbilityDurations)
        setCombat(next)
    }

    function removeTurn(id: number) {
        if (combat?.activeId === id) {
            if (turns.length === 1) setCombat(null)
            else advanceTurn()
        }
        setTurns((currentTurns) => currentTurns.filter((turn) => turn.id !== id))
        setAbilities((current) => current.map((ability) => ability.ownerId === id ? { ...ability, ownerId: null } : ability))
    }

    function clearTurns() {
        setTurns([])
        setAbilities((current) => current.map((ability) => ({ ...ability, ownerId: null })))
        setCombat(null)
    }

    return (
        <div className="tracker-layout">
            <CharacterSheets onAdd={addCharacter} combatStarted={combat !== null} />
            <main className="tracker-main">
                <section className="combat-tracker" aria-labelledby="turns-heading">
                    <h2 id="turns-heading">Combattimento · Turni e schede</h2>
                    <form onSubmit={(event) => { event.preventDefault(); startCombat() }}>
                        <div className="turn-actions combat-controls">
                            {combat ? (
                                <>
                                    <button className="sort-turns" type="button" onClick={advanceTurn}>
                                        Turno successivo →
                                    </button>
                                    <button className="end-combat" type="button" onClick={() => setCombat(null)}>
                                        Termina combattimento
                                    </button>
                                </>
                            ) : (
                                <button className="sort-turns" type="submit" disabled={turns.length === 0}>
                                    Inizia combattimento
                                </button>
                            )}
                        </div>
                        <p className="combat-status" role="status">
                            {combat
                                ? `Round ${combat.round} · Tocca a ${turns.find((turn) => turn.id === combat.activeId)?.description}`
                                : 'Aggiungi PG e mostri con la loro iniziativa, poi inizia il combattimento.'}
                        </p>
                        <div className="turns-list" onDragOver={(event) => event.preventDefault()} onDrop={handleListDrop}>
                            {turns.map((turn, index) => (
                                <div
                                    className={`turn-row${combat?.activeId === turn.id ? ' active-turn' : ''}`}
                                    aria-current={combat?.activeId === turn.id ? 'step' : undefined}
                                    data-reorder-item
                                    data-reorder-id={turn.id}
                                    key={turn.id}
                                >
                                    <button
                                        aria-label={`Trascina per riordinare il turno ${index + 1}`}
                                        className="turn-drag-handle"
                                        disabled={combat !== null}
                                        draggable={combat === null}
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
                                        required
                                        pattern=".*\S.*"
                                        disabled={combat !== null}
                                        className="turn-description"
                                        type="text"
                                        placeholder="PG o mostro"
                                        value={turn.description}
                                        onChange={(event) => updateTurn(turn.id, 'description', event.target.value)}
                                    />
                                    <label className="initiative-field">
                                        <span>Iniziativa</span>
                                        <input
                                            aria-label={`Iniziativa del turno ${index + 1}`}
                                            required
                                            step="1"
                                            disabled={combat !== null}
                                            type="number"
                                            value={turn.initiative}
                                            onChange={(event) => updateTurn(turn.id, 'initiative', event.target.value)}
                                        />
                                    </label>
                                    <label className="turn-stat turn-pf">
                                        <span>PF</span>
                                        <input
                                            aria-label={`PF di ${turn.description || `creatura ${index + 1}`}`}
                                            type="number"
                                            step="1"
                                            value={turn.hitPoints}
                                            onChange={(event) => updateTurn(turn.id, 'hitPoints', event.target.value)}
                                        />
                                    </label>
                                    <label className="turn-stat turn-ca">
                                        <span>CA</span>
                                        <input
                                            aria-label={`CA di ${turn.description || `creatura ${index + 1}`}`}
                                            type="number"
                                            step="1"
                                            value={turn.armorClass}
                                            onChange={(event) => updateTurn(turn.id, 'armorClass', event.target.value)}
                                        />
                                    </label>
                                    {turn.sheet && (
                                        <details className="combat-sheet-details">
                                            <summary>Dettagli della scheda</summary>
                                            <dl>
                                                {(Object.entries(characterFields) as [keyof typeof characterFields, string][])
                                                    .filter(([field]) => !['name', 'initiative', 'hitPoints', 'armorClass'].includes(field))
                                                    .map(([field, label]) => turn.sheet?.[field] && (
                                                        <div key={field}><dt>{label}</dt><dd>{turn.sheet[field]}</dd></div>
                                                    ))}
                                            </dl>
                                        </details>
                                    )}
                                    {abilities.some((ability) => ability.ownerId === turn.id) && (
                                        <div className="participant-abilities" aria-label={`Abilità di ${turn.description || 'creatura'}`}>
                                            {abilities.filter((ability) => ability.ownerId === turn.id).map((ability) => (
                                                <a key={ability.id} href={`#ability-${ability.id}`}>
                                                    {ability.name || 'Abilità senza nome'} · {!ability.active ? 'Inattiva' : ability.remainingTurns === 0 ? 'Scaduta' : `${ability.remainingTurns} turni`}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {combat?.activeId === turn.id && <strong className="active-turn-label">Turno attuale</strong>}
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
                                disabled={combat !== null}
                                onClick={addTurn}
                                aria-label="Aggiungi PG o mostro"
                            >
                                <span aria-hidden="true">+</span>
                            </button>
                        </div>
                        <div className="turn-actions">
                            <button className="sort-turns" type="button" onClick={sortTurns} disabled={combat !== null || turns.length === 0}>
                                Ordina per iniziativa ↓
                            </button>
                            <button
                                className="clear-turns"
                                type="button"
                                onClick={clearTurns}
                                disabled={turns.length === 0}
                            >
                                Cancella tutti i partecipanti
                            </button>
                        </div>
                    </form>
                </section>
                <AbilitiesTracker onAdd={addAbility} abilities={abilities} setAbilities={setAbilities} participants={turns} />
            </main>
        </div>
    )
}