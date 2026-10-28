import {useState} from 'react'
import {defaultCounterspellSettings} from '../domain/dnd/CounterspellTiming'
import {playApi,type Game,type MasterGame} from '../utils/PlayApi'

export function CounterspellSettings({game,onUpdate,disabled}:{game:MasterGame;onUpdate:(game:Game)=>void;disabled:boolean}){
    const [draft,setDraft]=useState<{mode:'event'|'timer';seconds:string;revision:number}>(),[busy,setBusy]=useState(false),[error,setError]=useState('')
    const saved=game.counterspellSettings??defaultCounterspellSettings,revision=game.counterspellSettingsRevision??0
    const value=draft??{...saved,seconds:String(saved.seconds),revision},valid=/^\d+$/.test(value.seconds)&&Number(value.seconds)>=1&&Number(value.seconds)<=3600
    return <form aria-label="Impostazioni di Controincantesimo" onSubmit={async event=>{
        event.preventDefault()
        if(!valid||busy||disabled)return
        setBusy(true);setError('')
        try{const next=await playApi<MasterGame>(`/games/${game.id}/counterspell-settings`,'PUT',{revision:value.revision,settings:{mode:value.mode,seconds:Number(value.seconds)}});onUpdate(next);setDraft(undefined)}catch(e){setError(e instanceof Error?e.message:'Salvataggio non riuscito.')}finally{setBusy(false)}
    }}><fieldset className="theme-settings counterspell-settings" disabled={disabled||busy}><legend>Controincantesimo · Sessione</legend>
        <label>Finestra per lanciare Controincantesimo<select aria-label="Finestra di Controincantesimo" value={value.mode} onChange={e=>setDraft({...value,mode:e.target.value as 'event'|'timer'})}><option value="event">Fino al prossimo evento o azione</option><option value="timer">Timer di inattività</option></select></label>
        <label>Secondi di inattività<input aria-label="Secondi per Controincantesimo" type="number" min="1" max="3600" step="1" required value={value.seconds} onChange={e=>setDraft({...value,seconds:e.target.value})}/></label>
        <p className="theme-settings-note">{value.mode==='event'?'La durata regola il popup. Dopo la sua chiusura puoi ancora reagire fino al prossimo evento indipendente.':'Il lancio resta contrastabile finché non scade il timer, anche se avvengono altri eventi. L’annullamento controlla che gli effetti da ripristinare non siano stati modificati.'} Compilare il form riavvia il timer.</p>
        <p className="theme-settings-note">Impostazioni condivise con tutta la sessione. Si applicano ai prossimi lanci.</p>
        {draft&&draft.revision!==revision&&<p role="status">Le impostazioni sono cambiate in un’altra schermata. I tuoi valori sono conservati: ripristina quelli correnti prima di modificarli.</p>}
        {error&&<p role="alert">{error}</p>}
        <button type="submit" className="sort-turns" disabled={!valid||!draft||draft.revision!==revision}>{busy?'Salvataggio…':'Salva impostazioni di Controincantesimo'}</button>
        {draft&&<button type="button" className="play-secondary" onClick={()=>{setDraft(undefined);setError('')}}>Ripristina impostazioni correnti</button>}
    </fieldset></form>
}
