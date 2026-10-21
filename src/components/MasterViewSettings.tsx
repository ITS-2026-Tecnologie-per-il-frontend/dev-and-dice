import { useId, useRef, type ReactNode } from 'react'
import { useDialogDismiss } from '../utils/Dialog'
import type { MasterView } from '../utils/MasterView'
import '../MasterView.css'
import { ThemeSettings } from './ThemeSettings'

export function MasterViewSettings({ view, onChange, error, children, role = 'master' }: {
    view: MasterView; onChange: (view: MasterView) => void; error: string; children?: ReactNode; role?: 'master' | 'player'
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    const id = useId()
    const dismiss = useDialogDismiss()
    return <>
        <button className="master-settings-button play-secondary" type="button" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M10 2h4l.5 2.5 1.75 1.4 2.41-.13 2 3.46L19 11v2l1.66 1.77-2 3.46-2.41-.13-1.75 1.4L14 22h-4l-.5-2.5-1.75-1.4-2.41.13-2-3.46L5 13v-2L3.34 9.23l2-3.46 2.41.13L9.5 4.5Z"/><circle cx="12" cy="12" r="3"/></svg>
            Impostazioni
        </button>
        <dialog ref={dialog} className="master-settings-dialog" aria-labelledby={`${id}-title`} {...dismiss}>
            <header><div><h2 id={`${id}-title`}>Impostazioni del {role === 'master' ? 'Master' : 'giocatore'}</h2><p>{role === 'master' ? 'Organizza il tavolo come preferisci.' : 'Organizza la tua avventura come preferisci.'}</p></div><button type="button" aria-label="Chiudi impostazioni" onClick={() => dialog.current?.close()} autoFocus>×</button></header>
            <fieldset><legend>Tipo di vista</legend>
                <label className="master-view-option"><input type="radio" name={`${id}-view`} value="original" checked={view === 'original'} onChange={() => onChange('original')}/><span><strong>Originale</strong><span>{role === 'master' ? 'La disposizione attuale: schede, turni e abilità affiancati.' : 'Scheda, appunti, azioni ed effetti nella disposizione originale.'}</span></span></label>
                <label className="master-view-option"><input type="radio" name={`${id}-view`} value="renewed" checked={view === 'renewed'} onChange={() => onChange('renewed')}/><span><strong>Rinnovata</strong><span>{role === 'master' ? 'Partecipanti compatti, dettagli laterali e strumenti divisi per attività.' : 'Scheda al centro, azioni ed effetti nel pannello del tuo personaggio.'}</span></span></label>
            </fieldset>
            <p className="master-settings-note">La scelta si applica subito ed è ricordata per questo account in questo browser.</p>
            {error && <p role="status">{error}</p>}
            <ThemeSettings/>
            {children && <div className="master-settings-extra">{children}</div>}
            <footer><button type="button" className="sort-turns" onClick={() => dialog.current?.close()}>Torna al tavolo</button></footer>
        </dialog>
    </>
}
