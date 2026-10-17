import { useId, useRef, type ReactNode } from 'react'
import { useDialogDismiss } from '../utils/Dialog'
import type { MasterView } from '../utils/MasterView'
import '../MasterView.css'
import { ThemeSettings } from './ThemeSettings'

export function MasterViewSettings({ view, onChange, error, children }: {
    view: MasterView; onChange: (view: MasterView) => void; error: string; children?: ReactNode
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    const id = useId()
    const dismiss = useDialogDismiss()
    return <>
        <button className="master-settings-button play-secondary" type="button" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg>
            Impostazioni
        </button>
        <dialog ref={dialog} className="master-settings-dialog" aria-labelledby={`${id}-title`} {...dismiss}>
            <header><div><h2 id={`${id}-title`}>Impostazioni del Master</h2><p>Organizza il tavolo come preferisci.</p></div><button type="button" aria-label="Chiudi impostazioni" onClick={() => dialog.current?.close()} autoFocus>×</button></header>
            <fieldset><legend>Tipo di vista</legend>
                <label className="master-view-option"><input type="radio" name={`${id}-view`} value="original" checked={view === 'original'} onChange={() => onChange('original')}/><span><strong>Originale</strong><span>La disposizione attuale: schede, turni e abilità affiancati.</span></span></label>
                <label className="master-view-option"><input type="radio" name={`${id}-view`} value="renewed" checked={view === 'renewed'} onChange={() => onChange('renewed')}/><span><strong>Rinnovata</strong><span>Partecipanti compatti, dettagli laterali e strumenti divisi per attività.</span></span></label>
            </fieldset>
            <p className="master-settings-note">La scelta si applica subito ed è ricordata per questo account in questo browser.</p>
            {error && <p role="status">{error}</p>}
            <ThemeSettings/>
            {children && <div className="master-settings-extra">{children}</div>}
            <footer><button type="button" className="sort-turns" onClick={() => dialog.current?.close()}>Torna al tavolo</button></footer>
        </dialog>
    </>
}
