import { useRef, useState, type DragEvent } from 'react'
import { getDropIndex, getDropTargetId, reorderByDrop, reorderById } from '../utils/Reorder'

type Sheet = {
    id: number
    creature: string
    hitPoints: string
    armorClass: string
}

export function SheetsTracker() {
    const [sheets, setSheets] = useState<Sheet[]>([])
    const nextId = useRef(0)

    function addSheet() {
        const newSheet: Sheet = {
            id: nextId.current++,
            creature: '',
            hitPoints: '',
            armorClass: '',
        }
        setSheets((currentSheets) => [...currentSheets, newSheet])
    }

    function updateSheet(id: number, field: 'creature' | 'hitPoints' | 'armorClass', value: string) {
        setSheets((currentSheets) =>
            currentSheets.map((sheet) =>
                sheet.id === id ? { ...sheet, [field]: value } : sheet,
            ),
        )
    }

    function reorderSheet(sourceId: number, targetId: number) {
        setSheets((currentSheets) => reorderById(currentSheets, sourceId, targetId))
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
        setSheets((currentSheets) => reorderByDrop(currentSheets, sourceId, targetId, insertionIndex))
    }

    function removeSheet(id: number) {
        setSheets((currentSheets) => currentSheets.filter((sheet) => sheet.id !== id))
    }

    return (
        <section className="sheets-tracker" aria-labelledby="sheets-heading">
            <h2 id="sheets-heading">Schede</h2>
            <div className="sheets-list" onDragOver={(event) => event.preventDefault()} onDrop={handleListDrop}>
                {sheets.map((sheet, index) => (
                    <div
                        className="sheet-row"
                        data-reorder-item
                        data-reorder-id={sheet.id}
                        key={sheet.id}
                    >
                        <button
                            aria-label={`Trascina per riordinare la creatura ${index + 1}`}
                            className="sheet-drag-handle"
                            draggable
                            onDragStart={(event) => handleDragStart(event, sheet.id)}
                            onKeyDown={(event) => {
                                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                                event.preventDefault()
                                const targetIndex = index + (event.key === 'ArrowUp' ? -1 : 1)
                                const targetSheet = sheets[targetIndex]
                                if (targetSheet) reorderSheet(sheet.id, targetSheet.id)
                            }}
                            title="Trascina per riordinare; usa le frecce per spostare"
                            type="button"
                        >
                            <span aria-hidden="true">↕</span>
                        </button>
                        <input
                            aria-label={`Creatura ${index + 1}`}
                            className="sheet-creature"
                            type="text"
                            placeholder="Creatura"
                            value={sheet.creature}
                            onChange={(event) => updateSheet(sheet.id, 'creature', event.target.value)}
                        />
                        <label className="sheet-stat sheet-pf">
                            <span>PF</span>
                            <input
                                aria-label={`PF creatura ${index + 1}`}
                                type="number"
                                value={sheet.hitPoints}
                                onChange={(event) => updateSheet(sheet.id, 'hitPoints', event.target.value)}
                            />
                        </label>
                        <label className="sheet-stat sheet-ca">
                            <span>CA</span>
                            <input
                                aria-label={`CA creatura ${index + 1}`}
                                type="number"
                                value={sheet.armorClass}
                                onChange={(event) => updateSheet(sheet.id, 'armorClass', event.target.value)}
                            />
                        </label>
                        <button
                            aria-label={`Elimina ${sheet.creature || `creatura ${index + 1}`}`}
                            className="delete-sheet"
                            onClick={() => removeSheet(sheet.id)}
                            title="Elimina creatura"
                            type="button"
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>
                ))}
                <button
                    className="add-sheet"
                    type="button"
                    onClick={addSheet}
                    aria-label="Aggiungi creatura"
                >
                    <span aria-hidden="true">+</span>
                </button>
            </div>
            <div className="sheet-actions">
                <button
                    className="clear-sheets"
                    type="button"
                    onClick={() => setSheets([])}
                    disabled={sheets.length === 0}
                >
                    Cancella tutte le schede
                </button>
            </div>
        </section>
    )
}