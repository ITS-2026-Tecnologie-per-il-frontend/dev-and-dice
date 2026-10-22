import { durationTurns } from '../utils/Combat'
import { createContext, memo, useCallback, useContext, useDeferredValue, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type Ref, type SetStateAction } from 'react'
import { abilityModifier, signedBonus, creatureAbilitySections, characterFields, clampCurrentHitPointsToMaximum, characterLevel, numericCharacterFields, newCharacterSheet, parseCharacterSheets, initiativeBonus, type SheetStats, type CharacterSheet, type SheetAbility } from '../utils/CharacterSheets'
import { catalogAbilityKind, sheetFromCatalog, sheetWithCombatSpells, removeSheetAbility, templateFromCatalog, type Catalog } from '../utils/Catalog'
import { CatalogSearch } from './CatalogSearch'
import { InfoButton } from './InfoButton'
import { useDialogDismiss } from '../utils/Dialog'
import { PlayerSheet } from './PlayerSheet'
import { playerSheetLayoutKey } from '../utils/PlayerTemplates'
import { pdfAbilities } from '../utils/PlayerAbilities'
import { abilityKeys, applyCreation, patchCalculatedSheetStats, characterCalculationIssues, spellSelection, labelOf, type CreationData } from '../utils/PlayerCreation'
import { newTutorial, parseTutorialDraft, tutorialDraftKey as legacyTutorialDraftKey, tutorialIssues } from '../utils/CharacterTutorial'
import { classId } from '../utils/Spellcasting'
import { randomCharacter } from '../utils/RandomCharacter'
import { preserveSavedSheets, catalogForSheet } from '../domain/dnd/ActiveRules'

const legacyStorageKey = 'dev-and-dice.character-sheets.v1'

export type CharacterSheetsHandle = { open: (sheet: CharacterSheet) => void; patchStats: (id: string, stats: Partial<SheetStats>) => boolean;patchDetails:(id:string,details:Record<string,string>)=>boolean; patchMany:(sheets:CharacterSheet[])=>boolean }
type Props = { libraryHidden?: boolean; onAdd: (sheet: CharacterSheet) => void; onSaved: (sheet: CharacterSheet) => void; combatStarted: boolean; presentSheetIds: string[]; catalog: Catalog; creationData?: CreationData; ref?: Ref<CharacterSheetsHandle>; repository?:{sheets:CharacterSheet[];storageKey:string;write:(sheets:CharacterSheet[])=>void;canRemove:(sheet:CharacterSheet)=>boolean;remove:(sheet:CharacterSheet)=>Promise<void>} }

const DraftContext=createContext<CharacterSheet|null>(null)
const CharacterSheetInputs=memo(function CharacterSheetInputs(props:Omit<Parameters<typeof PlayerSheet>[0],'sheet'>) {
    const sheet=useContext(DraftContext)
    return sheet&&<PlayerSheet {...props} sheet={sheet}/>
})

export function CharacterSheets(props:Props) {
    const [rawDraft,setDraft]=useState<CharacterSheet|null>(null)
    const draft=useMemo(()=>rawDraft&&props.creationData ? applyCreation(rawDraft,props.creationData) : rawDraft,[rawDraft,props.creationData])
    const current=useMemo(()=>({draft,key:draft ? playerSheetLayoutKey(draft) : ''}),[draft])
    const deferred=useDeferredValue(current)
    const latest=useRef(draft)
    useLayoutEffect(()=>{latest.current=draft},[draft])
    const readDraft=useCallback(()=>latest.current,[])
    // Defer only the surrounding PG panels for prose; controls, tutorials and sheet switches stay immediate.
    const layoutDraft=draft?.kind==='PG'&&current.key===deferred.key ? deferred.draft : draft
    return <DraftContext value={draft}><MemoCharacterSheetsLayout {...props} draft={layoutDraft} setDraft={setDraft} readDraft={readDraft}/></DraftContext>
}

function CharacterSheetsLayout({ libraryHidden, onAdd, onSaved, combatStarted, presentSheetIds, catalog:baseCatalog, creationData, ref, repository, draft, setDraft, readDraft }: Props&{draft:CharacterSheet|null;setDraft:Dispatch<SetStateAction<CharacterSheet|null>>;readDraft:()=>CharacterSheet|null}) {
    const storageKey=repository?.storageKey ?? legacyStorageKey
    const tutorialDraftKey=repository ? storageKey+'.tutorial' : legacyTutorialDraftKey
    const repositorySheets=repository?.sheets, repositoryWrite=repository?.write
    const [confirmTutorialExit, setConfirmTutorialExit] = useState(false)
    const tutorialExitDialog = useRef<HTMLDialogElement>(null)
    const dismissDialog = useDialogDismiss(() => {
        const draft=readDraft()
        if (draft?.playerDetails?.['tutorial.active'] === 'true') setConfirmTutorialExit(true)
        else if (draft && JSON.stringify(draft) !== initialDraft.current) saveSheet()
        else closeDialog()
    })
    const dismissDeleteDialog = useDialogDismiss()
    const dismissTutorialExitDialog = useDialogDismiss(closeTutorialExitPrompt)
    const deleteDialog = useRef<HTMLDialogElement>(null)
    const [localSaved, setSaved] = useState(() => {
        try {
            return { sheets: repository?.sheets ?? parseCharacterSheets(localStorage.getItem(storageKey)), error: '', blocked: false }
        } catch (error) {
            return { sheets: [] as CharacterSheet[], error: `Impossibile leggere le schede: ${error instanceof Error ? error.message : String(error)}`, blocked: true }
        }
    })
    const saved=repositorySheets ? {...localSaved,sheets:repositorySheets} : localSaved
    const currentSheets=useRef(saved.sheets)
    useEffect(() => {
        if (repositorySheets) currentSheets.current=repositorySheets
    },[repositorySheets])
    const catalog=draft ? catalogForSheet(creationData,baseCatalog,draft) ?? baseCatalog : baseCatalog
    const spellWarnings=useMemo(()=>draft?.kind==='PG'&&creationData&&characterLevel(draft)!==undefined&&creationData.classes.some(x=>x.index===classId(draft))?spellSelection(draft,creationData).issues:[],[draft,creationData])
    const [error, setError] = useState('')
    const [tutorial, setTutorial] = useState(() => {
        try {
            const draft = parseTutorialDraft(localStorage.getItem(tutorialDraftKey))
            return { draft: saved.sheets.some((s) => s.id === draft?.id && s.playerDetails?.['tutorial.completed'] === 'true') ? null : draft, error: '' }
        }
        catch { return { draft: null as CharacterSheet | null, error: 'Impossibile leggere la bozza del tutorial. I dati originali sono conservati; non avviare una nuova creazione prima di recuperarli.' } }
    })
    const guided = draft?.playerDetails?.['tutorial.active'] === 'true'
    const [progressSnapshot, setProgressSnapshot] = useState<CharacterSheet | null>(null)
    const progressSaved = progressSnapshot === draft
    const dialog = useRef<HTMLDialogElement>(null)
    const initialDraft = useRef('')
    const initialSavedDraft=useRef('')
    const randomDialog=useRef<HTMLDialogElement>(null),dismissRandomDialog=useDialogDismiss()
    const [randomOrigins,setRandomOrigins]=useState({characterClass:'',race:'',level:1})
    const [randomError,setRandomError]=useState('')
    const [randomOpen,setRandomOpen]=useState(false)
    useEffect(()=>{if(randomOpen)randomDialog.current?.showModal()},[randomOpen])

    const openDraft=useCallback((sheet: CharacterSheet) => {
        initialSavedDraft.current=JSON.stringify(currentSheets.current.find(item=>item.id===sheet.id)??null)
        const updated = creationData ? applyCreation(sheet, creationData) : sheet
        initialDraft.current = JSON.stringify(updated)
        setDraft({ ...updated })
    },[creationData,setDraft])

    function generateRandom(skipReview = false) {
        if (!creationData || saved.blocked || tutorial.draft || tutorial.error) return
        try {
            const generated=randomCharacter(creationData,{...randomOrigins,skipReview})
            if (skipReview) {
                if (!writeSheets([...saved.sheets,generated])) {
                    setRandomError('Impossibile salvare il personaggio. Libera spazio nel browser e riprova.')
                    return
                }
                randomDialog.current?.close()
                setRandomError('')
                onSaved(generated)
                return
            }
            if (!saveProgress(generated)) {setRandomError('Impossibile salvare la bozza. Libera spazio nel browser e riprova.');return}
            randomDialog.current?.close()
            setRandomError('')
            openDraft(generated)
        } catch (error) {setRandomError(error instanceof Error ? error.message : 'Generazione non riuscita. Nessun personaggio è stato sovrascritto.')}
    }


    useImperativeHandle(ref, () => ({
        open: (sheet) => openDraft(saved.sheets.find((item) => item.id === sheet.id) ?? sheet),
        patchMany: (sheets) => {
            const updates=new Map(sheets.map(sheet=>[sheet.id,sheet]))
            if (!writeSheets(currentSheets.current.map(sheet=>updates.get(sheet.id) ?? sheet))) return false
            setDraft(draft=>draft && updates.has(draft.id) ? {...draft,playerDetails:{...draft.playerDetails,...updates.get(draft.id)!.playerDetails},hitPoints:updates.get(draft.id)!.hitPoints} : draft)
            return true
        },
        patchDetails:(id,details)=>{
            const sheet=currentSheets.current.find((sheet)=>sheet.id===id)
            if (!sheet) return true
            const next={...sheet,playerDetails:{...sheet.playerDetails,...details}}
            if (!writeSheets(currentSheets.current.map((sheet)=>sheet.id===id ? next : sheet))) return false
            setDraft((draft)=>draft?.id===id ? {...draft,playerDetails:{...draft.playerDetails,...details}} : draft)
            return true
        },
        patchStats: (id, stats) => {
            const sheet = currentSheets.current.find((item) => item.id === id)
            if (!sheet) return true
            const updated = patchCalculatedSheetStats(sheet, stats, creationData)
            if (!updated || !writeSheets(currentSheets.current.map((item) => item.id === id ? updated : item))) return false
            setDraft((current) => {
                return current?.id === id ? patchCalculatedSheetStats(current, stats, creationData) ?? current : current
            })
            return true
        },
    }))

    useEffect(() => {
        if (draft && !dialog.current?.open) dialog.current?.showModal()
    }, [draft])

    useEffect(() => {
        if (confirmTutorialExit && guided && !tutorialExitDialog.current?.open) tutorialExitDialog.current?.showModal()
        else if ((!confirmTutorialExit || !guided) && tutorialExitDialog.current?.open) tutorialExitDialog.current.close()
    }, [confirmTutorialExit, guided])

    const saveProgress=useCallback((sheet: CharacterSheet) => {
        try {
            if (creationData?.verified) preserveSavedSheets(localStorage,creationData.verified.candidateReleaseId)
            localStorage.setItem(tutorialDraftKey, JSON.stringify(sheet))
            setTutorial({ draft: sheet, error: '' }); setProgressSnapshot(sheet); setError('')
            return true
        } catch { setError('Impossibile salvare i progressi. La bozza resta aperta: libera spazio e riprova.'); setProgressSnapshot(null); return false }
    },[creationData,tutorialDraftKey])
    useEffect(() => {
        if (!guided || !draft) return
        const timer = setTimeout(() => saveProgress(draft), 350)
        return () => clearTimeout(timer)
    }, [guided, draft, saveProgress])

    const writeSheets = useCallback((sheets: CharacterSheet[]): boolean => {
        if (saved.blocked) { setError(saved.error); return false }
        try {
            if (creationData?.verified) preserveSavedSheets(localStorage,creationData.verified.candidateReleaseId)
            if (!repositoryWrite) localStorage.setItem(storageKey, JSON.stringify(sheets))
            repositoryWrite?.(sheets)
            currentSheets.current=sheets
            setSaved({ sheets, error: '', blocked: false })
            setError('')
            return true
        } catch {
            const message = 'Salvataggio non riuscito. Le modifiche sono ancora aperte: riprova senza chiudere la finestra.'
            setError(message)
            setSaved((current) => ({ ...current, error: message }))
            return false
        }
    }, [saved.blocked, saved.error, creationData, storageKey, repositoryWrite])

    useEffect(() => {
        if (!creationData) return
        const sheets = saved.sheets.map((sheet) => applyCreation(sheet, creationData))
        if (JSON.stringify(sheets) !== JSON.stringify(saved.sheets) && writeSheets(sheets)) {
            for (const sheet of sheets) onSaved(sheet)
        }
    }, [creationData, saved.sheets, writeSheets, onSaved])

    function closeDialog() {
        const draft=readDraft()
        if (guided && draft && !saveProgress(draft)) return
        dialog.current?.close()
        setDraft(null)
        setError('')
    }

    function closeTutorialExitPrompt() {
        tutorialExitDialog.current?.close()
        setConfirmTutorialExit(false)
    }

    function discardCreation() {
        if (!draft || !guided) return
        closeTutorialExitPrompt()
        const sheets = saved.sheets.filter((sheet) => sheet.id !== draft.id)
        if (sheets.length !== saved.sheets.length && !writeSheets(sheets)) return
        const isStoredDraft = tutorial.draft?.id === draft.id
        try {
            if (isStoredDraft) localStorage.removeItem(tutorialDraftKey)
        } catch {
            setError('Impossibile cancellare la bozza. La scheda resta aperta: riprova.')
            return
        }
        if (isStoredDraft) setTutorial({ draft: null, error: '' })
        setProgressSnapshot(null)
        setRandomOrigins({ characterClass: '', race: '', level: 1 })
        setRandomError('')
        dialog.current?.close()
        setDraft(null)
        setError('')
    }

    function saveSheet() {
        const draft=readDraft()
        if (!draft) return
        if(repository&&initialSavedDraft.current!==JSON.stringify(currentSheets.current.find(item=>item.id===draft.id)??null)) {
            setError('La scheda è cambiata sul server mentre era aperta. Ricarica prima di salvare; le tue modifiche restano aperte.')
            return
        }
        if (guided) {
            if (!creationData) { setError('Attendi il caricamento delle opzioni prima di completare il tutorial.'); return }
            const required = tutorialIssues(draft, creationData, 8)
            if (required.length) { setError(required.join(' ')); return }
        }
        const calculated = clampCurrentHitPointsToMaximum(creationData ? applyCreation(draft, creationData) : draft)
        const sheet = { ...calculated, ...(guided ? { playerDetails: { ...calculated.playerDetails, 'tutorial.active': 'false', 'tutorial.completed': 'true' } } : {}), name: calculated.name.trim(), abilities: calculated.abilities.map((ability) => ({ ...ability, name: ability.name.trim() })) }
        const issues = sheet.kind === 'PG' ? characterCalculationIssues(sheet) : []
        if (issues.length) { setError(issues.join(' ')); return }
        if (!numericCharacterFields.every((field) => sheet[field] === '' || (sheet[field].trim() !== '' && Number.isSafeInteger(Number(sheet[field]))))) {
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
        if (writeSheets(sheets)) {
            if (guided) {
                try { localStorage.removeItem(tutorialDraftKey) } catch { /* La scheda completa è già salvata; la bozza residua viene ignorata alla riapertura. */ }
                setTutorial({ draft: null, error: '' })
                dialog.current?.close(); setDraft(null); setError('')
            } else closeDialog()
            onSaved(sheet)
        }
    }

    function creatureField(key: string, label: string) {
        if (!draft) return null
        const base=Object.hasOwn(characterFields,key),value=base ? draft[key as keyof typeof characterFields] : draft.playerDetails?.[key] ?? ''
        const change=(value:string) => setDraft(base ? {...draft,[key]:value} : {...draft,playerDetails:{...draft.playerDetails,[key]:value}})
        const numeric=(numericCharacterFields as readonly string[]).includes(key),score=(abilityKeys as readonly string[]).includes(key)
        return <div key={key}><label><span>{label}</span>{key==='kind' ? <select value={value} onChange={event => change(event.target.value)}><option>Mostro</option><option>PNG</option><option>PG</option></select>
            : key==='notes' ? <textarea rows={4} value={value} onChange={event => change(event.target.value)} />
            : key==='name' ? <CatalogSearch required pattern={'.*\\S.*'} aria-label="Nome della scheda" value={value} entries={catalog.creatures} onChange={name => setDraft({...draft,name,catalogId:undefined})} onSelect={entry => setDraft(sheetFromCatalog(entry,catalog,draft))} />
            : <input type={numeric ? 'number' : 'text'} step={numeric ? '1' : undefined} value={value} onChange={event => change(event.target.value)} />}</label>
            {score && <output aria-label={`Modificatore ${label}`}>{signedBonus(abilityModifier(value)) || '—'}</output>}
            {key==='initiative' && <small>Modificatore: {initiativeBonus(draft) || '—'}</small>}
        </div>
    }

    const libraryCards=useMemo(()=>saved.sheets.map((sheet) => (
                    <article className="character-card" key={sheet.id}>
                        <button className="character-open" type="button" onClick={() => openDraft(sheet)} aria-label={`Apri scheda di ${sheet.name}`}>
                            <strong>{sheet.name}</strong>
                            <span>{sheet.kind}{sheet.characterClass ? ` · ${sheet.characterClass}` : ''}</span>
                            <span>PF {sheet.hitPoints || '—'} · CA {sheet.armorClass || '—'}</span>
                        </button>
                        <button className="character-add" type="button" disabled={combatStarted || presentSheetIds.includes(sheet.id)} onClick={() => onAdd(sheet)}>
                            {presentSheetIds.includes(sheet.id) ? 'Già in combattimento' : '+ In combattimento'}
                        </button>
                    </article>
                )),[saved.sheets,combatStarted,presentSheetIds,onAdd,openDraft])

    return (
        <aside className={`character-library${libraryHidden ? " library-shelved" : ""}`} aria-labelledby={libraryHidden ? undefined : "characters-heading"}>
            <div className="character-library-content" hidden={libraryHidden}>
            <h2 id="characters-heading">Schede</h2>
            <p className="library-help">{repository ? 'Personaggi e mostri della sessione. Le modifiche vengono sincronizzate con il server.' : 'Personaggi e mostri salvati in questo browser.'}</p>
            {saved.error && <p role="alert">{saved.error}</p>}
            <div className="character-library-actions">
            <button className="sort-turns" type="button" disabled={saved.blocked} onClick={() => openDraft(newCharacterSheet())}>+ Nuova scheda</button>
            <button className="sort-turns" type="button" disabled={saved.blocked || !creationData || !!tutorial.draft || !!tutorial.error} onClick={() => openDraft(newTutorial())}>+ Crea personaggio guidato</button>
            <button className="sort-turns" type="button" disabled={saved.blocked || !creationData || !!tutorial.draft || !!tutorial.error} onClick={() => {setRandomError('');setRandomOpen(true)}}>+ Crea personaggio casuale</button>
            </div>
            {tutorial.error && <p role="alert">{tutorial.error}</p>}
            {tutorial.draft && !saved.sheets.some((s) => s.id === tutorial.draft!.id && s.playerDetails?.['tutorial.completed'] === 'true') && <button className="character-open tutorial-resume" type="button" disabled={!creationData} onClick={() => openDraft(tutorial.draft!)}>Riprendi creazione · {tutorial.draft.name || 'Personaggio senza nome'}</button>}
            {saved.sheets.length === 0 && <p className="library-empty">Crea una scheda e aggiungila al combattimento quando serve.</p>}
            <div className="character-list">
                {libraryCards}
            </div>
            {combatStarted && <p className="library-help">Termina il combattimento per aggiungere partecipanti.</p>}
            </div>
            <dialog ref={dialog} className={`character-dialog${draft?.kind === 'PG' ? ' player-sheet-dialog' : ' info-dialog monster-sheet-dialog'}${guided ? ' tutorial-dialog' : ''}`} aria-labelledby="character-dialog-heading" {...dismissDialog} onClose={(event) => {
                if (event.target !== event.currentTarget) return
                deleteDialog.current?.close()
                setDraft(null)
                setError('')
            }}>
                {draft && (
                    <form onSubmit={(event) => { event.preventDefault(); saveSheet() }}>
                        <div className={`dialog-header${draft.kind === 'PG' && !guided ? ' player-dialog-header' : ''}`}>
                            <div className="player-dialog-title">
                            <h2 id="character-dialog-heading">{guided ? 'Creazione del personaggio' : draft.name || 'Nuova scheda'}</h2>
                            {draft.kind === 'PG' && !guided && <p>{draft.characterClass || 'Personaggio'}{draft.level && ` di livello ${draft.level}`}</p>}
                            {draft.kind!=='PG' && <p className="library-help">{draft.kind}{!draft.catalogId && ' personalizzato'}</p>}
                            </div>
                            <button className="delete-turn" type="button" aria-label="Chiudi scheda" onClick={() => guided ? setConfirmTutorialExit(true) : closeDialog()}>×</button>
                        </div>
                        {draft.kind === 'PG' ? <CharacterSheetInputs catalog={catalog} creationData={creationData} onChange={setDraft}>{guided && <><div className="tutorial-utility-buttons"><button type="button" onClick={closeDialog}>Salva e riprendi più tardi</button><button className="tutorial-discard" type="button" onClick={discardCreation} aria-label="Cancella la bozza del personaggio">Cancella</button></div><p className="tutorial-save-status" role="status">{progressSaved ? 'Progressi salvati in questo browser.' : 'Salvataggio dei progressi…'}</p>{error && <p className="tutorial-save-error" role="alert">{error}</p>}</>}</CharacterSheetInputs> : <>
                            <section className="info-section" aria-label="Dati principali"><div className="info-fields">
                                {[['name','Nome'],['kind','Tipo'],['level','Grado di sfida'],['armorClass','Classe armatura'],['hitPoints','Punti ferita'],['initiative','Iniziativa inserita']].map(([key,label]) => creatureField(key,label))}
                            </div></section>
                            <section className="info-section" aria-label="Caratteristiche"><h3>Caratteristiche</h3><div className="info-fields info-scores">
                                {abilityKeys.map(key => creatureField(key,characterFields[key]))}
                            </div></section>
                            <section className="info-section" aria-label="Statistiche"><h3>Statistiche</h3><div className="info-fields">
                                {[['monster.size','Taglia'],['race','Tipo di creatura'],['monster.alignment','Allineamento'],['speed','Velocità'],['monster.languages','Linguaggi'],['monster.senses','Sensi'],['monster.skills','Abilità e competenze'],['monster.savingThrows','Tiri salvezza'],['monster.resistances','Resistenze ai danni'],['monster.immunities','Immunità ai danni'],['monster.conditionImmunities','Immunità alle condizioni'],['monster.vulnerabilities','Vulnerabilità ai danni'],['characterClass','Classe / ruolo']].map(([key,label]) => creatureField(key,label))}
                            </div></section>
                            <section className="info-section info-prose" aria-label="Descrizione"><h3>Descrizione</h3><div className="info-fields">{creatureField('notes','Descrizione e note')}</div></section>
                        </>}
                        {!guided && <CharacterCombatPanels draft={draft} catalog={catalog} setDraft={setDraft}/>}
                        {!guided&&spellWarnings.length>0&&<aside className="sheet-rule-warnings" role="status" aria-label="Avvisi sulle regole"><strong>Avvisi sulle regole</strong><ul>{spellWarnings.map(warning=><li key={warning}>{warning}</li>)}</ul><p>Come Master puoi comunque salvare la scheda con questi avvisi.</p></aside>}
                        {!guided && <>{error && <p role="alert">{error}{repository&&error.includes('è cambiata sul server')&&<button type="button" onClick={()=>{const latest=currentSheets.current.find(sheet=>sheet.id===draft.id);if(latest&&window.confirm('Ricaricare la scheda dal server e scartare le modifiche aperte?')){openDraft(latest);setError('')}}}>Ricarica scheda</button>}</p>}
                        <p className="library-help" role="status">Le modifiche si salvano anche cliccando fuori dalla finestra.</p>
                        <div className="turn-actions">
                            <button className="sort-turns" type="submit">Salva scheda</button>
                            <button className="end-combat" type="button" onClick={closeDialog}>Annulla</button>
                            {saved.sheets.some((sheet) => sheet.id === draft.id) && (!repository||repository.canRemove(draft)) && (
                                <button className="clear-turns" type="button" onClick={() => deleteDialog.current?.showModal()}>{repository?'Rimuovi dalla sessione':'Elimina scheda'}</button>
                            )}
                        </div></>}
                    </form>
                )}
            </dialog>
            <dialog ref={deleteDialog} className="character-dialog" aria-labelledby="delete-sheet-heading" {...dismissDeleteDialog}>
                <h2 id="delete-sheet-heading">{repository?'Rimuovi dalla sessione':'Elimina scheda'}</h2>
                <p>{repository?'Rimuovere dalla sessione':'Eliminare la scheda di'} {draft?.name}? {repository&&'La scheda resterà nel tuo account.'}</p>
                <div className="turn-actions">
                    <button autoFocus className="end-combat" type="button" onClick={() => deleteDialog.current?.close()}>Annulla</button>
                    <button className="clear-turns" type="button" onClick={async () => {
                        if (!draft) return
                        if(repository){try{await repository.remove(draft);deleteDialog.current?.close();closeDialog()}catch(error){setError(error instanceof Error?error.message:'Rimozione non riuscita.')}return}
                        const success = writeSheets(saved.sheets.filter((sheet) => sheet.id !== draft.id))
                        deleteDialog.current?.close()
                        if (success) closeDialog()
                    }}>{repository?'Rimuovi dalla sessione':'Elimina scheda'}</button>
                </div>
            </dialog>
            <dialog ref={tutorialExitDialog} className="character-dialog" aria-labelledby="tutorial-exit-heading" {...dismissTutorialExitDialog} onCancel={(event) => event.preventDefault()}>
                <h2 id="tutorial-exit-heading">Uscire dalla creazione guidata?</h2>
                <div className="turn-actions">
                    <button autoFocus className="end-combat" type="button" onClick={() => { closeTutorialExitPrompt(); closeDialog() }}>Salva e riprendi più tardi</button>
                    <button className="clear-turns" type="button" onClick={discardCreation}>Cancella scheda</button>
                </div>
            </dialog>
            <dialog ref={randomDialog} className="character-dialog" aria-labelledby="random-character-heading" {...dismissRandomDialog} onClose={()=>setRandomOpen(false)}>
                {randomOpen && <form onSubmit={(event) => {event.preventDefault();generateRandom()}}>
                    <h2 id="random-character-heading">Personaggio casuale</h2>
                    <p>D&D 5e 2014. Scegli il livello e fissa classe e razza, oppure lascia queste ultime casuali. «Genera e rivedi» apre il tutorial; «Genera veloce» salva direttamente il personaggio tra le schede.</p>
                    <div className="tutorial-grid">
                        <label className="player-field"><span>Classe</span><select value={randomOrigins.characterClass} onChange={(event) => setRandomOrigins({...randomOrigins,characterClass:event.target.value})}><option value="">Casuale</option>{creationData?.classes.filter((x) => !x.editions || x.editions.includes('2014')).map((x) => <option key={x.index} value={x.index}>{labelOf(x)}</option>)}</select></label>
                        <label className="player-field"><span>Razza</span><select value={randomOrigins.race} onChange={(event) => setRandomOrigins({...randomOrigins,race:event.target.value})}><option value="">Casuale</option>{creationData?.races.filter((x) => !x.editions || x.editions.includes('2014')).map((x) => <option key={x.index} value={x.index}>{labelOf(x)}</option>)}</select></label>
                        <label className="player-field"><span>Livello</span><select value={randomOrigins.level} onChange={(event) => setRandomOrigins({...randomOrigins,level:Number(event.target.value)})}>{Array.from({length:20},(_,i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
                    </div>
                    <p className="player-hint">Caratteristiche: array standard assegnato casualmente. Competenze, lingue, dotazioni e magie usano le opzioni del catalogo. Sopra il livello 1 vanno verificati aumenti di caratteristica/talenti e avanzamenti nel tutorial. Il Ranger richiede ancora alcune scelte manuali. Per le regole 2024 usa la creazione guidata.</p>
                    {randomError && <p role="alert">{randomError}</p>}
                    <div className="turn-actions"><button className="sort-turns" type="submit">Genera e rivedi</button><button className="sort-turns" type="button" onClick={() => generateRandom(true)}>Genera veloce</button><button className="end-combat" type="button" onClick={() => randomDialog.current?.close()}>Annulla</button></div>
                </form>}
            </dialog>
        </aside>
    )
}

const MemoCharacterSheetsLayout=memo(CharacterSheetsLayout)

const CharacterCombatPanels=memo(function CharacterCombatPanels({draft,catalog,setDraft}:{draft:CharacterSheet;catalog:Catalog;setDraft:Dispatch<SetStateAction<CharacterSheet|null>>}) {
    function abilityRow(ability: SheetAbility, index: number, spell = false) {
        const entry=catalog.abilities.find(entry=>entry.id===ability.catalogId),kind=catalogAbilityKind(entry,ability.section,ability.description ?? entry?.description)
        return (<div className="sheet-ability-row" key={index}>
                                    <label>
                                        <span>{spell ? 'Nome magia' : 'Nome abilità'}</span>
                                        <CatalogSearch
                                            required
                                            pattern={'.*\\S.*'}
                                            value={catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name}
                                            aria-label={`Nome ${spell ? 'magia' : 'abilità'} ${index + 1} della scheda`}
                                            entries={catalog.abilities}
                                            onChange={(name) => setDraft(current=>current&&({ ...current, abilities: current.abilities.map((item, i) => i === index ? { ...item, name, catalogId: undefined } : item) }))}
                                            onSelect={(entry) => {const template=templateFromCatalog(entry);setDraft(current=>current&&({ ...current, abilities: current.abilities.map((item, i) => i === index ? {...template,section:template.section ?? item.section} : item) }))}}
                                        />
                                    </label>
                                    {!kind.passive && <label>
                                        <span>Durata</span>
                                        {kind.attack ? <output>Istantanea</output> : <select
                                            value={ability.duration}
                                            onChange={(event) => {const duration=event.target.value as keyof typeof durationTurns;setDraft(current=>current&&({ ...current, abilities: current.abilities.map((item, i) => i === index ? { ...item, duration, remainingTurns: undefined, timed: duration !== 'Senza conteggio' } : item) }))}}
                                        >
                                            {Object.keys(durationTurns).map((duration) => <option key={duration}>{duration}</option>)}
                                        </select>}
                                    </label>}
                                    {!kind.passive && !kind.attack && ability.duration === 'Personalizzata' && <label className="sheet-ability-turns"><span>Turni (0: senza conteggio)</span><input type="number" min="0" step="1" value={ability.remainingTurns ?? 0} onChange={(event) => {
                                        const remainingTurns = event.target.valueAsNumber
                                        if (Number.isSafeInteger(remainingTurns) && remainingTurns >= 0) setDraft(current=>current&&({ ...current, abilities: current.abilities.map((item, i) => i === index ? { ...item, remainingTurns } : item) }))
                                    }} /></label>}
                                    <InfoButton name={catalog.abilities.find((entry) => entry.id === ability.catalogId)?.name ?? ability.name} description={ability.description} entry={catalog.abilities.find((entry) => entry.id === ability.catalogId)} fields={{ duration: ability.duration, remainingTurns: ability.remainingTurns ?? durationTurns[ability.duration] }} />
                                    <button className="delete-turn" type="button" aria-label={`Elimina ${ability.name || `abilità ${index + 1}`} dalla scheda`} onClick={() => setDraft(current=>current&&removeSheetAbility(current,index,catalog))}>×</button>
                                    {kind.passive && <p className="sheet-ability-description info-description">{ability.description ?? entry?.description ?? 'Si applica nelle circostanze descritte, senza attivazione.'}</p>}
                                    {draft.kind!=='PG' && <label className="sheet-ability-section"><span>Sezione</span><select aria-label={`Sezione abilità o azione ${index+1}`} value={kind.section ?? 'trait'} onChange={event => setDraft({...draft,abilities:draft.abilities.map((item,i) => i===index ? {...item,section:event.target.value as SheetAbility['section']} : item)})}>{Object.entries(creatureAbilitySections).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
                                    {draft.kind!=='PG' && !draft.catalogId && <label className="sheet-ability-description"><span>Descrizione dell’abilità o azione</span><textarea aria-label={`Descrizione abilità o azione ${index+1}`} rows={3} value={ability.description ?? ''} onChange={event => setDraft({...draft,abilities:draft.abilities.map((item,i) => i===index ? {...item,description:event.target.value,catalogId:undefined} : item)})} /></label>}
                                </div>)
    }

    const rows = draft?.abilities.map((ability, index) => {const entry=catalog.abilities.find(entry=>entry.id===ability.catalogId);return { ability, index, section:catalogAbilityKind(entry,ability.section,ability.description ?? entry?.description).section ?? 'trait', spell: typeof entry?.data.level === 'number' }}) ?? []
    const selectedSpells = draft?.kind === 'PG' ? sheetWithCombatSpells({ ...draft, abilities: [] }, catalog).abilities.filter((spell) => !rows.some((row) => row.spell && (row.ability.name === spell.name || (spell.catalogId && row.ability.catalogId === spell.catalogId)))) : []
    const detected = draft ? pdfAbilities(draft) : []
    const activePdf = detected.filter((item) => item.activation === 'active' && !rows.some((row) => row.ability.name.trim().toLowerCase() === item.name.trim().toLowerCase()))
    const reviewPdf = detected.filter((item) => item.activation === 'review' || draft?.playerDetails?.[item.key] === 'exclude')

    function pdfSetting(key: string, value: string) {
        setDraft(current=>current&&({ ...current, playerDetails: { ...current.playerDetails, [key]: value } }))
    }

    return <>
    <details className="sheet-combat-help"><summary>Come usare abilità e magie in combattimento</summary>
        <p>Nel combattimento, clicca un nome nella card del personaggio per importarlo; clicca di nuovo per raggiungerlo.</p>
        {draft.kind === 'PG' && <p>I privilegi con un’attivazione riconoscibile compaiono qui. Per modificarli nella scheda sopra, scrivi nome e descrizione su righe separate e lascia una riga vuota tra privilegi.</p>}
    </details>
    <div className={draft.kind === 'PG' ? 'sheet-ability-columns' : 'info-ability-sections'}>
    {draft.kind!=='PG' ? ([['trait','legendary'],['action','bonus','reaction','lair']] as const).map((sections,column) => <div className="info-ability-column" key={column}>
        {sections.filter(section => section==='trait' || section==='action' || rows.some(row => row.section===section)).map(section => <section className="info-section info-panel sheet-abilities" aria-label={creatureAbilitySections[section]} key={section}>
            <h3>{creatureAbilitySections[section]}</h3>
            {!rows.some(row => row.section===section) && <p className="library-help">Nessuna voce. Aggiungine una qui sotto.</p>}
            {rows.filter(row => row.section===section).map(({ability,index}) => abilityRow(ability,index))}
            <button className="end-combat sheet-add-ability" type="button" onClick={() => setDraft({...draft,abilities:[...draft.abilities,{name:'',duration:'Senza conteggio',section}]})}>{section==='trait' ? '+ Aggiungi abilità' : section==='action' ? '+ Aggiungi azione' : '+ Aggiungi voce'}</button>
        </section>)}
    </div>) : <section className="sheet-abilities" aria-labelledby="sheet-abilities-heading">
        <header className="sheet-section-heading"><h3 id="sheet-abilities-heading">Abilità del personaggio</h3><span className="sheet-section-count" aria-label="Numero di abilità">{activePdf.length + rows.filter(row => !row.spell).length}</span></header>
        <p className="library-help sheet-section-intro">Privilegi e abilità da attivare, con la loro durata.</p>
        {!activePdf.length && !rows.some((row) => draft.kind !== 'PG' || !row.spell) && <p className="library-empty">Nessuna abilità da attivare. Aggiungine una o compila i privilegi nella scheda sopra.</p>}
        {activePdf.map((item,index) => <article className="pdf-ability-card" key={`${item.key}-${index}`}>
            <strong>{item.name}</strong><p className="library-help">{item.reason}</p>
            <div className="pdf-ability-controls">
            <label>Durata<select aria-label={`Durata di ${item.name}`} value={item.template.duration} onChange={(event) => pdfSetting(`${item.key}.duration`, event.target.value)}>{Object.keys(durationTurns).map((duration) => <option key={duration}>{duration}</option>)}</select></label>
            {item.template.duration === 'Personalizzata' && <label>Turni<input type="number" min="0" step="1" value={item.template.remainingTurns} onChange={(event) => { if (Number.isSafeInteger(event.target.valueAsNumber) && event.target.valueAsNumber >= 0) pdfSetting(`${item.key}.turns`, event.target.value) }} /></label>}
            <div className="turn-actions"><InfoButton name={item.name} description={item.description} fields={{ Attivazione: item.reason, duration: item.template.duration }} /><button className="more-info" type="button" onClick={() => pdfSetting(item.key, 'exclude')}>Escludi</button></div>
            </div>
        </article>)}

        {rows.filter((row) => draft.kind !== 'PG' || !row.spell).map(({ ability, index }) => abilityRow(ability, index))}
        <button className="end-combat sheet-add-ability" type="button" onClick={() => setDraft(current=>current&&({ ...current, abilities: [...current.abilities, { name: '', duration: '1 minuto' }] }))}>+ Aggiungi abilità</button>
        {reviewPdf.length > 0 && <details className="pdf-ability-review"><summary>Privilegi da verificare o esclusi ({reviewPdf.length})</summary>
            {reviewPdf.map((item,index) => <article className="pdf-ability-card" key={`${item.key}-${index}`}><strong>{item.name}</strong><p className="library-help">{item.reason}</p><div className="turn-actions"><InfoButton name={item.name} description={item.description} /><button className="more-info" type="button" onClick={() => pdfSetting(item.key, 'include')}>Includi tra le abilità da attivare</button></div></article>)}
        </details>}
    </section>}
    {draft.kind === 'PG' && <section className="sheet-abilities sheet-spells" aria-labelledby="sheet-spells-heading">
        <header className="sheet-section-heading"><h3 id="sheet-spells-heading">Magie del personaggio</h3><span className="sheet-section-count" aria-label="Numero di magie">{selectedSpells.length + rows.filter((row) => row.spell).length}</span></header>
        <p className="library-help sheet-section-intro">Le magie della scheda, con livello e durata. Modificale nella pagina Incantesimi sopra.</p>
        {rows.filter((row) => row.spell).map(({ ability, index }) => abilityRow(ability, index, true))}
        {selectedSpells.map((spell, index) => {
            const entry = catalog.abilities.find((item) => item.id === spell.catalogId)
            return <article className="sheet-spell-card" key={`${spell.catalogId ?? spell.name}-${index}`}>
                <div><strong>{spell.name}</strong><div className="sheet-spell-meta"><span className="sheet-spell-level">{entry?.data.level === 0 ? 'Trucchetto' : typeof entry?.data.level === 'number' ? `Livello ${entry.data.level}` : 'Magia personalizzata'}</span><span>{typeof entry?.data.duration === 'string' ? entry.data.duration : 'Durata da impostare'}</span></div></div>
                <InfoButton name={spell.name} entry={entry} fields={{ duration: spell.duration, remainingTurns: spell.remainingTurns }} />
            </article>
        })}
        {!selectedSpells.length && !rows.some((row) => row.spell) && <p className="library-empty">Nessuna magia impostata. Scegli i tuoi incantesimi nella pagina Incantesimi della scheda sopra.</p>}
    </section>}
    </div>
    <p className="library-help">Per mostri e PNG l’iniziativa nel combattimento resta vuota: il modificatore è un suggerimento, inserisci tu il risultato del tiro. Per i PG viene copiata l’iniziativa predefinita.</p>
    </>
})
