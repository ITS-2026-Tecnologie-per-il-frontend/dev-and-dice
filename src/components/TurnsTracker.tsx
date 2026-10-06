import { useEffect, useRef, useState, type DragEvent } from 'react'
import { CharacterSheets } from './CharacterSheets'
import { characterFields, turnFromSheet, abilitiesFromSheet, initiativeBonus, type CharacterSheet } from '../utils/CharacterSheets'
import { AbilitiesTracker } from './AbilitiesTracker'
import { nextCombatTurn, sortByInitiative, advanceAbilityDurations, removeParticipantAbilities, type Ability, type Combat } from '../utils/Combat'
import { getDropIndex, getDropTargetId, reorderByDrop, reorderById } from '../utils/Reorder'
import { parseCatalog, sheetFromCatalog, type Catalog, type CatalogEntry } from '../utils/Catalog'
import { CatalogSearch } from './CatalogSearch'
import { InfoButton } from './InfoButton'

type Turn = {
    id: number
    description: string
    initiative: string
    hitPoints: string
    armorClass: string
    sheet?: CharacterSheet
}

export function TurnsTracker() {
    const [catalog, setCatalog] = useState<Catalog>({ creatures: [], abilities: [] })
    const [catalogStatus, setCatalogStatus] = useState('Caricamento del catalogo…')
    const [turns, setTurns] = useState<Turn[]>([])
    const [abilities, setAbilities] = useState<Ability[]>([])
    const [combat, setCombat] = useState<Combat | null>(null)
    const [pendingRemoval, setPendingRemoval] = useState<number[] | null>(null)
    const removalDialog = useRef<HTMLDialogElement>(null)
    const presentSheetIds = turns.flatMap((turn) => turn.sheet ? [turn.sheet.id] : [])
    const removalAbilities = abilities.filter((ability) => ability.ownerId !== null && pendingRemoval?.includes(ability.ownerId))
    const unexpiredAbilities = removalAbilities.filter((ability) => ability.active && ability.remainingTurns > 0)

    useEffect(() => {
        if (pendingRemoval && !removalDialog.current?.open) removalDialog.current?.showModal()
    }, [pendingRemoval])

    useEffect(() => {
        const controller = new AbortController()
        fetch(`${import.meta.env.BASE_URL}data/database.json`, { signal: controller.signal })
            .then((response) => { if (!response.ok) throw new Error('Database non disponibile.'); return response.json() })
            .then((raw: unknown) => { setCatalog(parseCatalog(raw)); setCatalogStatus('') })
            .catch((error: unknown) => { if (!controller.signal.aborted) setCatalogStatus(`Catalogo non disponibile: ${error instanceof Error ? error.message : String(error)} Puoi inserire i dati manualmente.`) })
        return () => controller.abort()
    }, [])

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
        if (combat || presentSheetIds.includes(sheet.id)) return
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
                turn.id === id ? { ...turn, [field]: value, sheet: field === 'description' && turn.sheet ? { ...turn.sheet, name: value, catalogId: undefined } : turn.sheet } : turn,
            ),
        )
    }

    function selectCreature(id: number, entry: CatalogEntry) {
        if (combat) return
        const current = turns.find((turn) => turn.id === id)
        if (!current) return
        const sheet = sheetFromCatalog(entry, catalog)
        const imported = abilitiesFromSheet(sheet, id, nextAbilityId.current)
        nextAbilityId.current += imported.length
        setTurns((items) => items.map((turn) => turn.id === id ? turnFromSheet(sheet, id) : turn))
        const previousIds = current.sheet?.abilities.flatMap((ability) => ability.catalogId ? [ability.catalogId] : []) ?? []
        setAbilities((items) => [...items.filter((ability) => ability.ownerId !== id || ability.active || !ability.catalogId || !previousIds.includes(ability.catalogId)), ...imported.filter((ability) => !items.some((item) => item.ownerId === id && item.active && item.catalogId === ability.catalogId))])
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

    function finishRemoval(ids: number[], removeAbilities: boolean) {
        const remaining = turns.filter((turn) => !ids.includes(turn.id))
        if (combat && ids.includes(combat.activeId)) {
            if (remaining.length === 0) setCombat(null)
            else advanceTurn()
        }
        setTurns(remaining)
        setAbilities((current) => removeParticipantAbilities(current, ids, removeAbilities))
        removalDialog.current?.close()
        setPendingRemoval(null)
    }

    function requestRemoval(ids: number[]) {
        if (abilities.some((ability) => ability.ownerId !== null && ids.includes(ability.ownerId))) {
            setPendingRemoval(ids)
        } else {
            finishRemoval(ids, false)
        }
    }

    function removeTurn(id: number) {
        requestRemoval([id])
    }

    function clearTurns() {
        requestRemoval(turns.map((turn) => turn.id))
    }

    return (
        <div className="tracker-layout">
            <CharacterSheets onAdd={addCharacter} combatStarted={combat !== null} presentSheetIds={presentSheetIds} catalog={catalog} />
            <main className="tracker-main">
                <section className="combat-tracker" aria-labelledby="turns-heading">
                    <h2 id="turns-heading">Combattimento · Turni e schede</h2>
                    {catalogStatus && <p className="library-help" role="status">{catalogStatus}</p>}
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
                                    <CatalogSearch
                                        aria-label={`Creatura del turno ${index + 1}`}
                                        required
                                        pattern=".*\S.*"
                                        disabled={combat !== null}
                                        className="turn-description"
                                        type="text"
                                        placeholder="PG o mostro"
                                        value={turn.description}
                                        entries={catalog.creatures}
                                        onChange={(value) => updateTurn(turn.id, 'description', value)}
                                        onSelect={(entry) => selectCreature(turn.id, entry)}
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
                                            placeholder={initiativeBonus(turn.sheet)}
                                            title={initiativeBonus(turn.sheet) ? `Modificatore iniziativa: ${initiativeBonus(turn.sheet)}. Inserisci il risultato del tiro.` : 'Inserisci il risultato del tiro di iniziativa.'}
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
                                    <div className="card-info"><InfoButton name={turn.description}
                                        entry={catalog.creatures.find((entry) => entry.id === turn.sheet?.catalogId)}
                                        description={turn.sheet?.notes}
                                        fields={{ ...(turn.sheet?.catalogId ? {} : Object.fromEntries(Object.entries(characterFields).filter(([key]) => !['name', 'notes', 'hitPoints', 'armorClass', 'initiative'].includes(key)).map(([key, label]) => [label, turn.sheet?.[key as keyof typeof characterFields] ?? '']))), hitPoints: turn.hitPoints, armorClass: turn.armorClass, initiativeModifier: initiativeBonus(turn.sheet) || 'Non disponibile', initiative: turn.initiative || 'Da inserire' }} /></div>
                                    {abilities.some((ability) => ability.ownerId === turn.id) && (
                                        <div className="participant-abilities" aria-label={`Abilità di ${turn.description || 'creatura'}`}>
                                            {abilities.filter((ability) => ability.ownerId === turn.id).map((ability) => (
                                                <a key={ability.id} href={`#ability-${ability.id}`} onClick={() => {
                                                    const highlight = { boxShadow: '0 0 0 2px #b77908', backgroundColor: 'rgba(183, 121, 8, 0.14)' }
                                                    document.getElementById(`ability-${ability.id}`)?.animate([highlight, highlight], 2000)
                                                }}>
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
                <AbilitiesTracker onAdd={addAbility} abilities={abilities} setAbilities={setAbilities} participants={turns} catalog={catalog} />
                <dialog ref={removalDialog} className="character-dialog" aria-labelledby="removal-heading" onClose={() => setPendingRemoval(null)}>
                    {pendingRemoval && (
                        <>
                            <h2 id="removal-heading">Rimuovi dal combattimento</h2>
                            <p>{turns.filter((turn) => pendingRemoval.includes(turn.id)).map((turn) => turn.description || 'Creatura senza nome').join(', ')}</p>
                            <p className="library-help">Vuoi rimuovere anche le {removalAbilities.length} abilità collegate?</p>
                            {unexpiredAbilities.length > 0 && (
                                <div className="removal-warning" role="alert">
                                    <strong>Ci sono abilità attivate che devono ancora scadere:</strong>
                                    <ul>
                                        {unexpiredAbilities.map((ability) => <li key={ability.id}>{ability.name || 'Abilità senza nome'} · {ability.remainingTurns} turni rimanenti</li>)}
                                    </ul>
                                </div>
                            )}
                            <p className="library-help">Se mantieni le abilità, verranno scollegate dal personaggio e quelle attivate continueranno il conteggio.</p>
                            <div className="turn-actions">
                                <button className="clear-turns" type="button" onClick={() => finishRemoval(pendingRemoval, true)}>Rimuovi anche le abilità</button>
                                <button className="sort-turns" type="button" onClick={() => finishRemoval(pendingRemoval, false)}>Mantieni le abilità</button>
                                <button className="end-combat" type="button" autoFocus onClick={() => removalDialog.current?.close()}>Annulla</button>
                            </div>
                        </>
                    )}
                </dialog>
            </main>
        </div>
    )
}
