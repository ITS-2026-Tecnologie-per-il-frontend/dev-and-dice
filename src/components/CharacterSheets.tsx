import { durationTurns } from '../utils/Combat'
import { useEffect, useRef, useState } from 'react'
import { characterFields, numericCharacterFields, newCharacterSheet, parseCharacterSheets, initiativeBonus, type CharacterSheet } from '../utils/CharacterSheets'
import { sheetFromCatalog, templateFromCatalog, type Catalog } from '../utils/Catalog'
import { CatalogSearch } from './CatalogSearch'
import { InfoButton } from './InfoButton'
import { useDialogDismiss } from '../utils/Dialog'
import { PlayerSheet } from './PlayerSheet'

const storageKey = 'dev-and-dice.character-sheets.v1'

type Props = { onAdd: (sheet: CharacterSheet) => void; combatStarted: boolean; presentSheetIds: string[]; catalog: Catalog }

export function CharacterSheets({ onAdd, combatStarted, presentSheetIds, catalog }: Props) {
    const dismissDialog = useDialogDismiss()
    const dismissDeleteDialog = useDialogDismiss()
    const deleteDialog = useRef<HTMLDialogElement>(null)
    const [saved, setSaved] = useState(() => {
        try {
            return { sheets: parseCharacterSheets(localStorage.getItem(storageKey)), error: '', blocked: false }
        } catch (error) {
            return { sheets: [] as CharacterSheet[], error: `Impossibile leggere le schede: ${error instanceof Error ? error.message : String(error)}`, blocked: true }
        }
    })
    const [draft, setDraft] = useState<CharacterSheet | null>(null)
    const [error, setError] = useState('')
    const dialog = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        if (draft && !dialog.current?.open) dialog.current?.showModal()
    }, [draft])

    async function persist(sheets: CharacterSheet[]): Promise<boolean> {
        if (saved.blocked) return false
        try {
            localStorage.setItem(storageKey, JSON.stringify(sheets))
            setSaved({ sheets, error: '', blocked: false })
            setError('')
            return true
        } catch {
            setError('Salvataggio non riuscito. Le modifiche sono ancora aperte: riprova senza chiudere la finestra.')
            return false
        }
    }

    function closeDialog() {
        dialog.current?.close()
        setDraft(null)
        setError('')
    }

    function saveSheet() {
        if (!draft) return
        const sheet = { ...draft, name: draft.name.trim(), abilities: draft.abilities.map((ability) => ({ ...ability, name: ability.name.trim() })) }
        if (!numericCharacterFields.every((field) => sheet[field] === '' || Number.isSafeInteger(Number(sheet[field])))) {
            setError('Inserisci numeri interi validi nelle statistiche.')
            return
        }
        if (!sheet.name || sheet.abilities.some((ability) => !ability.name || !Object.hasOwn(durationTurns, ability.duration) || (ability.remainingTurns !== undefined && (!Number.isSafeInteger(ability.remainingTurns) || ability.remainingTurns < 0)))) {
            setError('Inserisci il nome del personaggio e di ogni abilità, con una durata valida.')
            return
        }
        const sheets = saved.sheets.some((item) => item.id === sheet.id)
            ? saved.sheets.map((item) => item.id === sheet.id ? sheet : item)
            : [...saved.sheets, sheet]
        void persist(sheets).then((success) => {
            if (success) closeDialog()
        })
    }

    return (
        <aside className="character-library" aria-labelledby="characters-heading">
            <h2 id="characters-heading">Schede</h2>
            <p className="library-help">Personaggi e mostri salvati in questo browser.</p>
            {saved.error && <p role="alert">{saved.error}</p>}
            <button className="sort-turns" type="button" disabled={saved.blocked} onClick={() => setDraft(newCharacterSheet())}>+ Nuova scheda</button>
            {saved.sheets.length === 0 && <p className="library-empty">Crea una scheda e aggiungila al combattimento quando serve.</p>}
            <div className="character-list">
                {saved.sheets.map((sheet) => (
                    <article className="character-card" key={sheet.id}>
                        <button className="character-open" type="button" onClick={() => setDraft({ ...sheet })} aria-label={`Apri scheda di ${sheet.name}`}>
                            <strong>{sheet.name}</strong>
                            <span>{sheet.kind}{sheet.characterClass ? ` · ${sheet.characterClass}` : ''}</span>
                            <span>PF {sheet.hitPoints || '—'} · CA {sheet.armorClass || '—'}</span>
                        </button>
                        <InfoButton name={sheet.name} entry={catalog.creatures.find((entry) => entry.id === sheet.catalogId)} description={sheet.notes}
                            fields={{ ...Object.fromEntries(Object.entries(characterFields).filter(([key]) => key !== 'initiative').map(([key, label]) => [label, sheet[key as keyof typeof characterFields]])), initiativeModifier: initiativeBonus(sheet) || 'Non disponibile', initiative: sheet.initiative || 'Da inserire' }} />
                        <button className="character-add" type="button" disabled={combatStarted || presentSheetIds.includes(sheet.id)} onClick={() => onAdd(sheet)}>
                            {presentSheetIds.includes(sheet.id) ? 'Già in combattimento' : '+ In combattimento'}
                        </button>
                    </article>
                ))}
            </div>
            {combatStarted && <p className="library-help">Termina il combattimento per aggiungere partecipanti.</p>}
            <dialog ref={dialog} className={`character-dialog${draft?.kind === 'PG' ? ' player-sheet-dialog' : ''}`} aria-labelledby="character-dialog-heading" {...dismissDialog} onClose={() => { deleteDialog.current?.close(); setDraft(null); setError('') }}>
                {draft && (
                    <form onSubmit={(event) => { event.preventDefault(); saveSheet() }}>
                        <div className="dialog-header">
                            <h2 id="character-dialog-heading">{draft.name || 'Nuova scheda'}</h2>
                            <button className="delete-turn" type="button" aria-label="Chiudi scheda" onClick={closeDialog}>×</button>
                        </div>
                        {draft.kind === 'PG' ? <PlayerSheet sheet={draft} onChange={setDraft} /> : <div className="character-fields">
                            {(Object.entries(characterFields) as [keyof typeof characterFields, string][]).map(([field, label]) => (
                                <label key={field} className={field === 'notes' ? 'character-notes' : undefined}>
                                    <span>{field === 'initiative' && draft.kind !== 'PG' ? 'Iniziativa inserita' : label}</span>
                                    {field === 'kind' ? (
                                        <select value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}>
                                            <option>PG</option><option>Mostro</option><option>PNG</option>
                                        </select>
                                    ) : field === 'notes' ? (
                                        <textarea rows={5} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
                                    ) : field === 'name' ? (
                                        <CatalogSearch autoFocus required pattern={'.*\\S.*'} aria-label="Nome della scheda" value={draft.name}
                                            entries={catalog.creatures} onChange={(name) => setDraft({ ...draft, name, catalogId: undefined })}
                                            onSelect={(entry) => setDraft(sheetFromCatalog(entry, catalog, draft))} />
                                    ) : (
                                        <input
                                            type={(numericCharacterFields as readonly string[]).includes(field) ? 'number' : 'text'}
                                            step={(numericCharacterFields as readonly string[]).includes(field) ? '1' : undefined}
                                            value={draft[field]}
                                            placeholder={field === 'initiative' ? initiativeBonus(draft) : undefined}
                                            onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                                        />
                                    )}
                                </label>
                            ))}
                        </div>}
                        <section className="sheet-abilities" aria-labelledby="sheet-abilities-heading">
                            <h3 id="sheet-abilities-heading">Abilità del personaggio</h3>
                            <p className="library-help">Vengono aggiunte al combattimento come inattive, già collegate al personaggio.</p>
                            {draft.abilities.map((ability, index) => (
                                <div className="sheet-ability-row" key={index}>
                                    <label>
                                        <span>Nome abilità</span>
                                        <CatalogSearch
                                            required
                                            pattern={'.*\\S.*'}
                                            value={ability.name}
                                            aria-label={`Nome abilità ${index + 1} della scheda`}
                                            entries={catalog.abilities}
                                            onChange={(name) => setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? { ...item, name, catalogId: undefined } : item) })}
                                            onSelect={(entry) => setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? templateFromCatalog(entry) : item) })}
                                        />
                                    </label>
                                    <label>
                                        <span>Durata</span>
                                        <select
                                            value={ability.duration}
                                            onChange={(event) => setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? { ...item, duration: event.target.value as keyof typeof durationTurns, remainingTurns: undefined } : item) })}
                                        >
                                            {Object.keys(durationTurns).map((duration) => <option key={duration}>{duration}</option>)}
                                        </select>
                                    </label>
                                    {ability.duration === 'Personalizzata' && <label className="sheet-ability-turns"><span>Turni (0: senza conteggio)</span><input type="number" min="0" step="1" value={ability.remainingTurns ?? 0} onChange={(event) => {
                                        const remainingTurns = event.target.valueAsNumber
                                        if (Number.isSafeInteger(remainingTurns) && remainingTurns >= 0) setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? { ...item, remainingTurns } : item) })
                                    }} /></label>}
                                    <InfoButton name={ability.name} entry={catalog.abilities.find((entry) => entry.id === ability.catalogId)} fields={{ duration: ability.duration, remainingTurns: ability.remainingTurns ?? durationTurns[ability.duration] }} />
                                    <button className="delete-turn" type="button" aria-label={`Elimina ${ability.name || `abilità ${index + 1}`} dalla scheda`} onClick={() => setDraft({ ...draft, abilities: draft.abilities.filter((_, i) => i !== index) })}>×</button>
                                </div>
                            ))}
                            <button className="end-combat" type="button" onClick={() => setDraft({ ...draft, abilities: [...draft.abilities, { name: '', duration: '1 minuto' }] })}>+ Aggiungi abilità</button>
                        </section>
                        <p className="library-help">Per mostri e PNG l’iniziativa nel combattimento resta vuota: il modificatore è un suggerimento, inserisci tu il risultato del tiro. Per i PG viene copiata l’iniziativa predefinita.</p>
                        {error && <p role="alert">{error}</p>}
                        <div className="turn-actions">
                            <button className="sort-turns" type="submit">Salva scheda</button>
                            <button className="end-combat" type="button" onClick={closeDialog}>Annulla</button>
                            {saved.sheets.some((sheet) => sheet.id === draft.id) && (
                                <button className="clear-turns" type="button" onClick={() => deleteDialog.current?.showModal()}>Elimina scheda</button>
                            )}
                        </div>
                    </form>
                )}
            </dialog>
            <dialog ref={deleteDialog} className="character-dialog" aria-labelledby="delete-sheet-heading" {...dismissDeleteDialog}>
                <h2 id="delete-sheet-heading">Elimina scheda</h2>
                <p>Eliminare la scheda di {draft?.name}?</p>
                <div className="turn-actions">
                    <button autoFocus className="end-combat" type="button" onClick={() => deleteDialog.current?.close()}>Annulla</button>
                    <button className="clear-turns" type="button" onClick={() => {
                        if (!draft) return
                        void persist(saved.sheets.filter((sheet) => sheet.id !== draft.id)).then((success) => {
                            deleteDialog.current?.close()
                            if (success) closeDialog()
                        })
                    }}>Elimina scheda</button>
                </div>
            </dialog>
        </aside>
    )
}
