import { durationTurns } from '../utils/Combat'
import { useEffect, useRef, useState } from 'react'
import { characterFields, numericCharacterFields, newCharacterSheet, parseCharacterSheets, type CharacterSheet } from '../utils/CharacterSheets'

const storageKey = 'dev-and-dice.character-sheets.v1'

type Props = { onAdd: (sheet: CharacterSheet) => void; combatStarted: boolean }

export function CharacterSheets({ onAdd, combatStarted }: Props) {
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

    // esempio didattico; localStorage resta sincrono, async restituisce una Promise.
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
        if (!sheet.name || sheet.abilities.some((ability) => !ability.name || !Object.hasOwn(durationTurns, ability.duration))) {
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
                        <button className="character-add" type="button" disabled={combatStarted} onClick={() => onAdd(sheet)}>
                            + In combattimento
                        </button>
                    </article>
                ))}
            </div>
            {combatStarted && <p className="library-help">Termina il combattimento per aggiungere partecipanti.</p>}
            <dialog ref={dialog} className="character-dialog" aria-labelledby="character-dialog-heading" onClose={() => { setDraft(null); setError('') }}>
                {draft && (
                    <form onSubmit={(event) => { event.preventDefault(); saveSheet() }}>
                        <div className="dialog-header">
                            <h2 id="character-dialog-heading">{draft.name || 'Nuova scheda'}</h2>
                            <button className="delete-turn" type="button" aria-label="Chiudi scheda" onClick={closeDialog}>×</button>
                        </div>
                        <div className="character-fields">
                            {(Object.entries(characterFields) as [keyof typeof characterFields, string][]).map(([field, label]) => (
                                <label key={field} className={field === 'notes' ? 'character-notes' : undefined}>
                                    <span>{label}</span>
                                    {field === 'kind' ? (
                                        <select value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}>
                                            <option>PG</option><option>Mostro</option>
                                        </select>
                                    ) : field === 'notes' ? (
                                        <textarea rows={5} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
                                    ) : (
                                        <input
                                            autoFocus={field === 'name'}
                                            required={field === 'name'}
                                            pattern={field === 'name' ? '.*\\S.*' : undefined}
                                            type={(numericCharacterFields as readonly string[]).includes(field) ? 'number' : 'text'}
                                            step={(numericCharacterFields as readonly string[]).includes(field) ? '1' : undefined}
                                            value={draft[field]}
                                            onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                                        />
                                    )}
                                </label>
                            ))}
                        </div>
                        <section className="sheet-abilities" aria-labelledby="sheet-abilities-heading">
                            <h3 id="sheet-abilities-heading">Abilità del personaggio</h3>
                            <p className="library-help">Vengono aggiunte al combattimento come inattive, già collegate al personaggio.</p>
                            {draft.abilities.map((ability, index) => (
                                <div className="sheet-ability-row" key={index}>
                                    <label>
                                        <span>Nome abilità</span>
                                        <input
                                            required
                                            pattern={'.*\\S.*'}
                                            value={ability.name}
                                            onChange={(event) => setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })}
                                        />
                                    </label>
                                    <label>
                                        <span>Durata</span>
                                        <select
                                            value={ability.duration}
                                            onChange={(event) => setDraft({ ...draft, abilities: draft.abilities.map((item, i) => i === index ? { ...item, duration: event.target.value as keyof typeof durationTurns } : item) })}
                                        >
                                            {Object.keys(durationTurns).map((duration) => <option key={duration}>{duration}</option>)}
                                        </select>
                                    </label>
                                    <button className="delete-turn" type="button" aria-label={`Elimina ${ability.name || `abilità ${index + 1}`} dalla scheda`} onClick={() => setDraft({ ...draft, abilities: draft.abilities.filter((_, i) => i !== index) })}>×</button>
                                </div>
                            ))}
                            <button className="end-combat" type="button" onClick={() => setDraft({ ...draft, abilities: [...draft.abilities, { name: '', duration: '1 minuto' }] })}>+ Aggiungi abilità</button>
                        </section>
                        <p className="library-help">L’iniziativa predefinita viene copiata nel combattimento: puoi modificarla dopo il tiro.</p>
                        {error && <p role="alert">{error}</p>}
                        <div className="turn-actions">
                            <button className="sort-turns" type="submit">Salva scheda</button>
                            <button className="end-combat" type="button" onClick={closeDialog}>Annulla</button>
                            {saved.sheets.some((sheet) => sheet.id === draft.id) && (
                                <button className="clear-turns" type="button" onClick={() => {
                                    if (!window.confirm(`Eliminare la scheda di ${draft.name}?`)) return
                                    void persist(saved.sheets.filter((sheet) => sheet.id !== draft.id)).then((success) => {
                                        if (success) closeDialog()
                                    })
                                }}>Elimina scheda</button>
                            )}
                        </div>
                    </form>
                )}
            </dialog>
        </aside>
    )
}
