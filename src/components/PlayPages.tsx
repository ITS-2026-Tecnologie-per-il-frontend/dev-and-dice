import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { characterFields, newCharacterSheet, parseCharacterSheets, clampCurrentHitPointsToMaximum, characterLevel, type CharacterSheet } from '../utils/CharacterSheets'
import { newTutorial, parseTutorialDraft, tutorialDraftKey, tutorialIssues } from '../utils/CharacterTutorial'
import { applyCreation, characterCalculationIssues, spellSelection, type CreationData } from '../utils/PlayerCreation'
import { classId } from '../utils/Spellcasting'
import { loadActiveDatabase } from '../domain/dnd/ActiveRules'
import { PlayerSheet } from './PlayerSheet'
import { TurnsTracker, type TrackerState } from './TurnsTracker'
import { MasterViewSettings } from './MasterViewSettings'
import { ThemeSettings } from './ThemeSettings'
import { useMasterView } from '../utils/MasterView'
import { MasterCombatRequests, PlayerCombatActions } from './CombatRequests'
import { NotificationPopover } from './NotificationPopover'
import { playApi, type HomeData, type Game, type MasterGame, type OwnedCharacter, type PrivateNotes, type NotificationPage, type NotificationSummary } from '../utils/PlayApi'
import '../PlayPages.css'

const message=(error:unknown)=>error instanceof Error ? error.message : 'Operazione non riuscita. Riprova.'

function changeLabel(path:string[]):string {
    if (path[0]!=='playerDetails') return ({...characterFields,abilities:'Abilità e azioni',catalogId:'Voce del catalogo'} as Record<string,string>)[path[0]] ?? path[0]
    const key=path[1],slot=/^slots\.(\d+)\.(total|used)$/.exec(key)
    if (slot) return `Slot di ${slot[1]}º livello · ${slot[2]==='used'?'usati':'totali'}`
    return ({portrait:'Ritratto',maxHitPoints:'PF massimi',temporaryHitPoints:'PF temporanei',classFeatures:'Privilegi di classe',racialTraits:'Tratti della specie',additionalTraits:'Altri tratti'} as Record<string,string>)[key] ?? `Dettaglio della scheda: ${key}`
}
function changeValue(value:unknown,portrait:boolean) {
    if (portrait && typeof value==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(value)) return <img src={value} alt="Ritratto salvato"/>
    return <pre>{value===null?'Non impostato':value===''?'Vuoto':typeof value==='string'?value:JSON.stringify(value,null,2)}</pre>
}
type SheetChangesProps={game:Game}&({history:true}|{history?:false;disabled:boolean;onRead:(id:string)=>Promise<void>;onReject:(id:string)=>Promise<void>})
function SheetChanges(props:SheetChangesProps) {
    const {game}=props,history=props.history===true,title=history?'Cronologia della scheda':'Notifiche e storico delle schede',dialogId=history?'sheet-history':'sheet-notifications'
    const [open,setOpen]=useState(false),[page,setPage]=useState<NotificationPage>(),[loading,setLoading]=useState(false),[action,setAction]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0)
    const loaded=useRef<{endpoint:string;revision:number;retry:number;page:NotificationPage}>(undefined)
    const revision=history&&game.role==='player'?game.character.revision:game.notifications.revision,endpoint='/games/'+game.id+(history?'/history':'/notifications')
    useEffect(()=>{
        if (!open) return
        if (loaded.current?.endpoint===endpoint && loaded.current.revision===revision && loaded.current.retry===retry) {setPage(loaded.current.page);setError('');return}
        let active=true
        // eslint-disable-next-line react/set-state-in-effect -- Fetch the persisted history when the session reports a new notification revision.
        setLoading(true);setError('')
        playApi<NotificationPage>(endpoint).then(value=>{if(active){loaded.current={endpoint,revision:value.revision,retry,page:value};setPage(value)}}).catch(error=>{if(active)setError(message(error))}).finally(()=>{if(active)setLoading(false)})
        return ()=>{active=false}
    },[endpoint,revision,open,retry])
    async function older() {
        if (!page?.next || loading) return
        const current=page
        setLoading(true);setError('')
        try {const next=await playApi<NotificationPage>(endpoint+'?before='+encodeURIComponent(page.next));setPage(value=>value===current && next.revision===current.revision ? {...next,items:[...current.items,...next.items]} : value)}
        catch(error){setError(message(error))}finally{setLoading(false)}
    }
    const perform=useCallback(async(id:string,operation:()=>Promise<void>)=>{setAction(id);setError('');try{await operation()}catch(error){setError(message(error))}finally{setAction('')}},[])
    // ponytail: cache one page per feed; the existing two-second revision polling invalidates it.
    const entries=useMemo(()=><ol className="play-notification-list">{page?.items.map(entry=><li key={entry.id} data-notification-id={entry.id} data-unread={!history&&!entry.read}>
            <h3>{entry.characterName} · {!history&&entry.status==='rejected'&&game.role==='player'?'Rifiuto del Master':`${entry.actorName} (${entry.actorRole==='master'?'Master':'Giocatore'})`}</h3>
            <p><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString('it-IT')}</time> · {entry.status==='rejected'?'Rifiutata dal Master':entry.actorRole==='player'?'Applicata automaticamente':'Applicata dal Master'}{!history&&!entry.read?' · Da leggere':''}</p>
            {entry.rejectedAt&&<p>Ripristinata il <time dateTime={entry.rejectedAt}>{new Date(entry.rejectedAt).toLocaleString('it-IT')}</time>.</p>}
            <details open><summary>Modifiche ({entry.changes.length})</summary><div className="play-change-table"><table><caption className="play-sr-only">Valori prima e dopo la modifica di {entry.characterName}</caption><thead><tr><th scope="col">Campo</th><th scope="col">Prima</th><th scope="col">Dopo</th></tr></thead><tbody>{entry.changes.map(change=><tr key={JSON.stringify(change.path)}><th scope="row">{changeLabel(change.path)}</th><td>{changeValue(change.before,change.path[1]==='portrait')}</td><td>{changeValue(change.after,change.path[1]==='portrait')}</td></tr>)}</tbody></table></div></details>
            {!props.history&&<div className="play-actions">{!entry.read&&<button type="button" className="play-secondary" disabled={!!action} onClick={()=>void perform(entry.id,()=>props.onRead(entry.id))}>Segna come letta</button>}{entry.canReject&&<button type="button" className="play-secondary" disabled={props.disabled||!!action||loading} onClick={()=>void perform(entry.id,()=>props.onReject(entry.id))}>{action===entry.id?'Attendi…':'Rifiuta modifica'}</button>}</div>}
        </li>)}</ol>,[page,props,action,loading,perform,history,game.role])
    return <NotificationPopover id={dialogId} title={title} label={history?title:`Notifiche: ${game.notifications.unreadCount} non lette`} closeLabel={history?'Chiudi cronologia':'Chiudi notifiche'} iconPath={history?'M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2':'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1'} count={history?undefined:game.notifications.unreadCount} open={open} onOpenChange={setOpen}>
        <p>{history?'Tutte le modifiche salvate da te e dal Master, dalla più recente. Per ogni modifica trovi autore, data e valori prima e dopo.':game.role==='master'?'Le modifiche dei giocatori sono già applicate. Puoi rifiutarle se i campi coinvolti non sono stati modificati nuovamente.':'Qui trovi gli interventi del Master sulla tua scheda e gli eventuali rifiuti delle tue modifiche.'}</p>
        {loading&&<p role="status">{history?'Caricamento della cronologia…':'Caricamento delle notifiche…'}</p>}
        {error&&<p role="alert">{error} <button type="button" className="play-secondary" onClick={()=>setRetry(value=>value+1)}>Aggiorna storico</button></p>}
        {page&&!page.items.length&&<p>{history?'Nessuna modifica alla scheda registrata.':'Nessuna notifica da mostrare.'}</p>}
        {entries}
        {page?.next&&<button type="button" className="play-secondary" disabled={loading} onClick={()=>void older()}>Mostra precedenti</button>}
        {!props.history&&props.disabled&&game.role==='master'&&<p>Concludi il salvataggio della sessione prima di rifiutare una modifica.</p>}
    </NotificationPopover>
}

export function AccountLayout({children}:{children:ReactNode}) {
    const {user,status,error,refreshUser,logout}=useAuth(),location=useLocation(),[logoutError,setLogoutError]=useState('')
    if (status==='loading') return <p className="auth-status" role="status">Verifica dell’accesso…</p>
    if (status==='error') return <main className="auth-page"><section className="auth-card"><h1>Accesso non disponibile</h1><p role="alert">{error}</p><button onClick={()=>void refreshUser()}>Riprova</button></section></main>
    if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname+location.search)}`} replace/>
    return <><header className="play-account"><Link to="/" className="play-brand">Dev &amp; Dice</Link><span>{user.username}</span><ThemeSettings compact/><button type="button" onClick={()=>void logout().catch(error=>setLogoutError(message(error)))}>Esci</button></header>{logoutError&&<p role="alert">{logoutError}</p>}{children}</>
}

function useCreationData() {
    const [data,setData]=useState<CreationData>(),[error,setError]=useState(''),[retry,setRetry]=useState(0)
    useEffect(()=>{let active=true;loadActiveDatabase().then(result=>{if(active){setData(result.creationData);setError('')}}).catch(error=>{if(active)setError(message(error))});return()=>{active=false}},[retry])
    return {data,error,retry:()=>setRetry(value=>value+1)}
}

export function CharacterEditor({record,initial,onSave,onCancel,settingsInDialog=false,historyControl}:{record?:OwnedCharacter;initial?:CharacterSheet;onSave:(sheet:CharacterSheet,revision?:number)=>Promise<void>;onCancel:()=>void;settingsInDialog?:boolean;historyControl?:ReactNode}) {
    const {data,error:rulesError,retry}=useCreationData()
    const [sheet,setSheet]=useState(()=>record?.sheet ?? initial ?? {...newCharacterSheet(),level:'1'})
    const [baseline,setBaseline]=useState(()=>({revision:record?.revision,raw:JSON.stringify(record?.sheet ?? initial ?? null)}))
    const [error,setError]=useState(''),[saving,setSaving]=useState(false)
    const dirty=baseline.raw!==JSON.stringify(sheet)
    const changed=record && record.revision!==baseline.revision
    useEffect(()=>{
        if (record && !dirty && record.revision!==baseline.revision) {
            // eslint-disable-next-line react/set-state-in-effect -- Synchronize an unchanged editor with the polled server record.
            setSheet(record.sheet);setBaseline({revision:record.revision,raw:JSON.stringify(record.sheet)})
        }
    },[record,dirty,baseline.revision])
    useEffect(()=>{
        const protect=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue=''}}
        window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect)
    },[dirty])
    async function save(event?:FormEvent) {
        event?.preventDefault();setError('');setSaving(true)
        try {
            const generated=data ? applyCreation(sheet,data) : sheet
            const guided=generated.playerDetails?.['tutorial.active']==='true'
            if (guided && !data) throw new Error('Attendi il caricamento delle regole.')
            if (!data&&classId(generated)==='wizard'&&Object.entries(generated.playerDetails??{}).some(([key,value])=>/^spell\.\d+\.\d+\.name$/.test(key)&&value.trim())) throw new Error('Attendi il caricamento delle regole per verificare gli incantesimi. Le modifiche restano aperte.')
            const issues=guided&&data ? tutorialIssues(generated,data,8) : characterCalculationIssues(generated)
            if(generated.kind==='PG'&&data&&characterLevel(generated)!==undefined&&data.classes.some(origin=>origin.index===classId(generated))) issues.push(...spellSelection(generated,data).issues)
            if (issues.length) throw new Error(issues.join(' '))
            const next=clampCurrentHitPointsToMaximum({...generated,name:generated.name.trim(),...(guided ? {playerDetails:{...generated.playerDetails,'tutorial.active':'false','tutorial.completed':'true'}} : {})})
            await onSave(next,baseline.revision)
            setSheet(next);setBaseline({revision:record?.revision,raw:JSON.stringify(next)})
        } catch(error){setError(message(error))} finally{setSaving(false)}
    }
    const saveAction=useRef(save)
    useLayoutEffect(()=>{saveAction.current=save})
    const sheetActions=useMemo(()=><><button type="button" disabled={saving} onClick={()=>void saveAction.current()}>Salva personaggio nella sessione</button>{error&&<p role="alert">{error}</p>}</>,[saving,error])
    return <section className="play-editor" aria-label="Scheda del personaggio">
        <div className="play-editor-heading"><h2>{sheet.name || 'Nuovo personaggio'}</h2>{!record&&!sheet.name&&sheet.playerDetails?.['tutorial.active']!=='true'&&<button type="button" onClick={()=>setSheet(newTutorial())}>Usa creazione guidata</button>}</div>
        {rulesError&&<p role="alert">Regole non caricate: {rulesError} <button onClick={retry}>Riprova</button></p>}
        {changed&&dirty&&<p role="alert">La scheda è stata modificata anche da un’altra schermata. Le tue modifiche restano aperte. <button type="button" onClick={()=>{if(window.confirm('Ricaricare la scheda dal server e scartare le modifiche aperte?')){setSheet(record.sheet);setBaseline({revision:record.revision,raw:JSON.stringify(record.sheet)});setError('')}}}>Ricarica scheda</button></p>}
        {sheet.kind==='PG' ? <PlayerSheet sheet={sheet} creationData={data} settingsInDialog={settingsInDialog} historyControl={historyControl} onChange={next=>setSheet(data ? applyCreation(next,data) : next)}>{sheetActions}</PlayerSheet> : <div className="play-form-grid">{Object.entries(sheet).filter(([key,value])=>typeof value==='string'&&!['id','catalogId'].includes(key)).map(([key,value])=><label key={key}>{key}<input value={String(value)} onChange={event=>setSheet({...sheet,[key]:event.target.value})}/></label>)}</div>}
        <footer className="play-editor-actions"><button type="button" disabled={saving} onClick={()=>void save()}>{saving?'Salvataggio…':'Salva personaggio'}</button><button type="button" className="play-secondary" disabled={saving} onClick={onCancel}>Annulla</button>{error&&<p role="alert">{error}</p>}</footer>
    </section>
}

function PlayerNotes({record,onSave}:{record:PrivateNotes;onSave:(notes:PrivateNotes)=>Promise<PrivateNotes>}) {
    const [text,setText]=useState(record.text),[baseline,setBaseline]=useState(record),[saving,setSaving]=useState(false),[error,setError]=useState('')
    const dirty=text!==baseline.text,changed=record.revision!==baseline.revision
    useEffect(()=>{
        if (!dirty && changed) {
            // eslint-disable-next-line react/set-state-in-effect -- Synchronize clean notes with the record polled from the server.
            setText(record.text);setBaseline(record)
        }
    },[record,dirty,changed])
    useEffect(()=>{
        const protect=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue=''}}
        window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect)
    },[dirty])
    async function save(event:FormEvent) {
        event.preventDefault();setSaving(true);setError('')
        try {setBaseline(await onSave({text,revision:baseline.revision}))}
        catch(error){setError(message(error))}finally{setSaving(false)}
    }
    return <aside className="play-player-notes" aria-labelledby="player-notes"><form onSubmit={event=>void save(event)}>
        <h2 id="player-notes">Appunti personali</h2><p id="player-notes-privacy">Visibili soltanto a te, in questa partita.</p>
        <label className="play-sr-only" htmlFor="player-notes-text">Appunti personali</label>
        <textarea id="player-notes-text" aria-describedby="player-notes-privacy" value={text} maxLength={20000} rows={14} disabled={saving} onChange={event=>{setText(event.target.value);setError('')}} placeholder="Luoghi, indizi, idee per la prossima mossa…"/>
        <button type="submit" disabled={!dirty||saving}>{saving?'Salvataggio…':'Salva appunti'}</button>
        <p role="status">{dirty?'Appunti da salvare':'Appunti salvati'}</p>
        {changed&&dirty&&<p role="alert">Gli appunti sono cambiati su un altro dispositivo. La tua bozza resta aperta. <button type="button" className="play-secondary" onClick={()=>{if(window.confirm('Ricaricare gli appunti salvati e scartare questa bozza?')){setText(record.text);setBaseline(record);setError('')}}}>Ricarica appunti</button></p>}
        {error&&<p role="alert">{error}</p>}
    </form></aside>
}

export function HomePage() {
    const [home,setHome]=useState<HomeData>(),[error,setError]=useState(''),[name,setName]=useState(''),[creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[imported,setImported]=useState('')
    const navigate=useNavigate()
    const load=useCallback(async()=>{try{setHome(await playApi<HomeData>('/home'));setError('')}catch(error){setError(message(error))}},[])
    useEffect(()=>{let active=true;playApi<HomeData>('/home').then(value=>{if(active)setHome(value)}).catch(error=>{if(active)setError(message(error))});return()=>{active=false}},[])
    async function create(event:FormEvent) {event.preventDefault();setBusy(true);try{const game=await playApi<Game>('/games','POST',{name});navigate('/games/'+game.id)}catch(error){setError(message(error))}finally{setBusy(false)}}
    async function recover() {
        setBusy(true);setError('')
        try {
            const old=parseCharacterSheets(localStorage.getItem('dev-and-dice.character-sheets.v1'))
            const barbarian=parseCharacterSheets(localStorage.getItem('dev-and-dice.barbarian.character.v1'))
            const raw=localStorage.getItem('dev-and-dice.barbarian.v1')
            if(raw) {
                const [{parseCharacter},{updatePlayerBarbarian},p1,p2,p3]=await Promise.all([import('../barbarian/model'),import('../barbarian/player'),import('../barbarian/page1.json'),import('../barbarian/page2.json'),import('../barbarian/page3.json')])
                const pages=[p1.default,p2.default,p3.default] as import('../barbarian/model').PageLayout[],values=parseCharacter(raw,pages)
                let id=localStorage.getItem('dev-and-dice.barbarian.import-id')
                if(!id){id=crypto.randomUUID();localStorage.setItem('dev-and-dice.barbarian.import-id',id)}
                let sheet={...newCharacterSheet(),id,name:'Barbaro importato',characterClass:'Barbaro',level:'1'}
                for(const field of pages.flatMap(page=>page.fields)) {const value=values[field.group][field.key];if(value!==''&&value!==false)sheet=updatePlayerBarbarian(sheet,field,value)}
                old.push(sheet)
            }
            const sheets=[...new Map([...old,...barbarian].map(sheet=>[sheet.id,sheet])).values()]
            const result=await playApi<{characters:OwnedCharacter[]}>('/import','POST',{sheets})
            setImported(`${result.characters.length} schede recuperate. Gli originali nel browser sono conservati.`);await load()
        } catch(error){setError(message(error))}finally{setBusy(false)}
    }
    function resume() {try{const sheet=parseTutorialDraft(localStorage.getItem(tutorialDraftKey));if(!sheet)throw new Error('Nessuna bozza locale da recuperare.');navigate('/characters/new',{state:{sheet}})}catch(error){setError(message(error))}}
    return <main className="play-home">
        <div className="play-home-heading"><div><h1>Il tuo tavolo</h1><p>Personaggi e partite, pronti per la prossima avventura.</p></div><div className="play-actions"><Link className="play-primary" to="/characters/new">Crea personaggio</Link><button onClick={()=>setCreating(value=>!value)}>Crea sessione</button></div></div>
        {error&&<p role="alert">{error} <button onClick={()=>void load()}>Riprova</button></p>}
        {creating&&<form className="play-create-game" onSubmit={event=>void create(event)}><label>Nome della sessione<input required maxLength={100} value={name} onChange={event=>setName(event.target.value)} autoFocus/></label><button disabled={busy}>Crea e apri come Master</button></form>}
        {!home&&!error&&<p role="status">Caricamento del tuo tavolo…</p>}
        <div className="play-home-columns"><section aria-labelledby="my-characters"><h2 id="my-characters">I tuoi personaggi</h2>{home?.characters.length===0&&<p>Crea il tuo primo personaggio o recupera le schede salvate nel browser.</p>}
            <ul className="play-list">{home?.characters.map(character=><li key={character.id}><div><Link to={'/characters/'+character.id}><strong>{character.sheet.name}</strong></Link><p>{character.sheet.characterClass || character.sheet.kind}{character.sheet.level&&` · livello ${character.sheet.level}`}</p></div><span className="play-status">{character.gameId ? <Link to={'/games/'+character.gameId}>In sessione</Link> : 'Disponibile'}</span></li>)}</ul>
        </section><section aria-labelledby="my-games"><h2 id="my-games">Le tue sessioni</h2>{home?.games.length===0&&<p>Crea una sessione come Master o apri un link di invito per giocare.</p>}<ul className="play-list">{home?.games.map(game=><li key={game.id}><div><Link to={'/games/'+game.id}><strong>{game.name}</strong></Link><p className="play-session-role">{game.role==='master'?'Master':'Giocatore'}</p></div><Link className="play-status" to={'/games/'+game.id} aria-label={`Apri ${game.name}`}>Apri</Link></li>)}</ul></section></div>
        <details className="play-recovery"><summary>Recupera le schede di questo browser</summary><p>Le vecchie schede non hanno un proprietario registrato. Importa nel tuo account soltanto quelle che ti appartengono. Il recupero conserva gli originali e non duplica le schede già importate.</p><div className="play-actions"><button disabled={busy} onClick={()=>void recover()}>Importa le schede locali</button><button disabled={busy} onClick={resume}>Riprendi bozza locale</button><Link to="/schede/barbaro/pdf">Apri il vecchio modello Barbaro</Link></div>{imported&&<p role="status">{imported}</p>}</details>
    </main>
}

export function CharacterPage() { const {id}=useParams();return <CharacterRoute key={id??'new'}/> }
function CharacterRoute() {
    const {id}=useParams(),navigate=useNavigate(),location=useLocation(),[record,setRecord]=useState<OwnedCharacter>(),[error,setError]=useState('')
    useEffect(()=>{if(id)playApi<OwnedCharacter>('/characters/'+id).then(setRecord).catch(error=>setError(message(error)))},[id])
    if(error)return <main className="play-home"><h1>Personaggio non disponibile</h1><p role="alert">{error}</p><Link to="/">Torna alla home</Link></main>
    if(id&&!record)return <p role="status">Caricamento del personaggio…</p>
    return <main className="play-character-page"><Link to="/">Torna alla home</Link><CharacterEditor key={id??'new'} record={record} initial={location.state?.sheet} onCancel={()=>navigate('/')} onSave={async(sheet,revision)=>{await playApi<OwnedCharacter>(id?'/characters/'+id:'/characters',id?'PUT':'POST',{sheet,revision});navigate('/')}}/>{record&&!record.gameId&&<button className="play-secondary" type="button" onClick={()=>{if(window.confirm('Eliminare definitivamente '+record.sheet.name+' dal tuo account?'))void playApi('/characters/'+record.id,'DELETE').then(()=>navigate('/')).catch(error=>setError(message(error)))}}>Elimina personaggio</button>}</main>
}

export function InvitePage() { const {token}=useParams();return <InviteRoute key={token}/> }
function InviteRoute() {
    const {token}=useParams(),navigate=useNavigate(),[invite,setInvite]=useState<{id:string;name:string;joined:boolean}>(),[characters,setCharacters]=useState<OwnedCharacter[]>([]),[selected,setSelected]=useState(''),[creating,setCreating]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
    useEffect(()=>{let active=true;Promise.all([playApi<{id:string;name:string;joined:boolean}>('/invites/'+token),playApi<HomeData>('/home')]).then(([invite,home])=>{if(!active)return;if(invite.joined){navigate('/games/'+invite.id,{replace:true});return}setInvite(invite);setCharacters(home.characters.filter(character=>!character.gameId&&character.sheet.kind==='PG'))}).catch(error=>{if(active)setError(message(error))});return()=>{active=false}},[token,navigate])
    async function join(sheet?:CharacterSheet){setBusy(true);setError('');try{const result=await playApi<{id:string}>('/invites/'+token+'/join','POST',sheet?{sheet}:{characterId:selected});navigate('/games/'+result.id)}catch(error){setError(message(error));if(sheet)throw error}finally{setBusy(false)}}
    return <main className="play-character-page"><Link to="/">Torna alla home</Link><h1>{invite?'Unisciti a '+invite.name:'Invito alla sessione'}</h1>{error&&<p role="alert">{error}</p>}{!invite&&!error&&<p role="status">Verifica dell’invito…</p>}{invite&&<>{!creating&&<section className="play-join"><p>Porta un tuo personaggio disponibile oppure creane uno per questa partita.</p><label>Personaggio<select aria-label="Personaggio" value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Scegli un personaggio…</option>{characters.map(character=><option key={character.id} value={character.id}>{character.sheet.name}</option>)}</select></label>{!characters.length&&<p>Non hai personaggi liberi da altre sessioni.</p>}<div className="play-actions"><button disabled={!selected||busy} onClick={()=>void join()}>Unisciti con questo personaggio</button><button className="play-secondary" onClick={()=>setCreating(true)}>Crea un personaggio per la sessione</button></div></section>}{creating&&<CharacterEditor onSave={sheet=>join(sheet)} onCancel={()=>setCreating(false)}/>}</>}</main>
}

type Draft={state:TrackerState;sheets:CharacterSheet[]}
export function GamePage() { const {id}=useParams();return <SessionPage key={id}/> }
function SessionPage() {
    const {id}=useParams(),{user}=useAuth(),navigate=useNavigate()
    const masterView = useMasterView(user?.id)
    const [game,setGame]=useState<Game>(),[error,setError]=useState(''),[draft,setDraft]=useState<Draft|null>(null),[saving,setSaving]=useState(false),[blocked,setBlocked]=useState(false),[retry,setRetry]=useState(0),[copied,setCopied]=useState(false)
    const draftRef=useRef(draft),gameRef=useRef(game),savingRef=useRef(false),initialized=useRef(false)
    const cacheKey=`dev-and-dice.game-draft.${user!.id}.${id}`
    const [language,setLanguage]=useState<'it'|'en'>('it')
    const [available,setAvailable]=useState<OwnedCharacter[]>([]),[selected,setSelected]=useState(''),[loadRetry,setLoadRetry]=useState(0)
    useEffect(()=>{
        const protect=(event:BeforeUnloadEvent)=>{if(draft||saving){event.preventDefault();event.returnValue=''}}
        window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect)
    },[draft,saving])
    useEffect(()=>{
        let active=true,inFlight=false
        async function refresh(){if(inFlight||draftRef.current||savingRef.current)return;inFlight=true;try{
            const next=await playApi<Game>('/games/'+id)
            if(!active)return
            if(!initialized.current&&next.role==='master'){
                initialized.current=true
                const raw=localStorage.getItem(cacheKey)
                if(raw){const cached=JSON.parse(raw);if(!cached.state||!Array.isArray(cached.state.turns)||!Array.isArray(cached.state.abilities)||!Array.isArray(cached.sheets))throw new Error('Bozza locale non valida; originale conservato.');parseCharacterSheets(JSON.stringify(cached.sheets));for(const turn of cached.state.turns){if(typeof turn.description!=='string'||!Number.isSafeInteger(turn.id))throw new Error('Bozza dei turni non valida; originale conservato.');if(turn.sheet)parseCharacterSheets(JSON.stringify([turn.sheet]))}const restored={state:cached.state,sheets:cached.sheets};draftRef.current=restored;setDraft(restored)
                    setGame({...next,state:restored.state,characters:restored.sheets.map((sheet:CharacterSheet)=>next.characters.find(character=>character.id===sheet.id)??{id:sheet.id,sheet,ownerId:user!.id,gameId:next.id,revision:0})});gameRef.current=next
                    if(cached.revision!==next.revision){setBlocked(true);setError('La bozza locale precede le modifiche della sessione. Ricarica i dati del server prima di continuare.')};return}
            }
            const current=gameRef.current
            if(current&&(next.revision<current.revision||next.requestsRevision<current.requestsRevision))return
            if(current?.role==='player'&&next.role==='player'&&current.notes.revision>next.notes.revision)next.notes=current.notes
            if(current?.role==='player'&&next.role==='player'&&current.character.revision>next.character.revision)next.character=current.character
            if(current && current.notifications.revision>next.notifications.revision) next.notifications=current.notifications
            if(current?.revision!==next.revision||current?.requestsRevision!==next.requestsRevision||current?.notifications.revision!==next.notifications.revision||current?.role==='player'&&next.role==='player'&&current.notes.revision!==next.notes.revision){gameRef.current=next;setGame(next)}setError('')
        }catch(error){if(active)setError(message(error))}finally{inFlight=false}}
        void refresh()
        // ponytail: polling ogni 2 secondi per questa versione; migrazione a WebSocket pianificata nel README per ridurre la latenza.
        const timer=setInterval(()=>void refresh(),2000);return()=>{active=false;clearInterval(timer)}
    },[id,cacheKey,user,loadRetry])
    const change=useCallback((state:TrackerState,sheets:CharacterSheet[])=>{
        const next={state,sheets};draftRef.current=next;setDraft(next)
        try{localStorage.setItem(cacheKey,JSON.stringify({...next,revision:gameRef.current?.revision}))}catch{setError('Bozza non salvata nel browser. Lascia aperta la pagina fino al salvataggio sul server.')}
    },[cacheKey])
    const remove=useCallback(async(sheet:CharacterSheet)=>{const current=gameRef.current;if(!current)return;const next=await playApi<MasterGame>('/games/'+id+'/characters/'+sheet.id+'/remove','POST',{revision:current.revision});gameRef.current=next;setGame(next)},[id])
    const workspace=useMemo(()=>game?.role==='master' ? {state:game.state,sheets:game.characters.map(character=>character.sheet),storageKey:cacheKey+'.library',onChange:change,remove,canRemove:(sheet:CharacterSheet)=>!draft&&!saving&&game.characters.some(character=>character.id===sheet.id&&character.ownerId===user!.id)} : undefined,[game,cacheKey,change,remove,draft,saving,user])
    useEffect(()=>{
        if(!draft||blocked||savingRef.current)return
        const timer=setTimeout(async()=>{
            const sent=draftRef.current,current=gameRef.current
            if(!sent||!current||current.role!=='master')return
            savingRef.current=true;setSaving(true)
            try{
                const next=await playApi<MasterGame>('/games/'+id+'/state','PUT',{...sent,revision:current.revision})
                gameRef.current=next
                if(draftRef.current===sent){draftRef.current=null;setDraft(null);setGame(next);localStorage.removeItem(cacheKey)}
                else{localStorage.setItem(cacheKey,JSON.stringify({...draftRef.current,revision:next.revision}))}
                setError('')
            }catch(error){setError(message(error));setBlocked(true)}finally{savingRef.current=false;setSaving(false)}
        },450)
        return()=>clearTimeout(timer)
    },[draft,blocked,saving,id,cacheKey,retry])
    async function reload(){if(!window.confirm('Ricaricare la sessione dal server e scartare la bozza locale?'))return;try{const next=await playApi<Game>('/games/'+id);localStorage.removeItem(cacheKey);draftRef.current=null;setDraft(null);gameRef.current=next;setGame(next);setBlocked(false);setError('')}catch(error){setError(message(error))}}
    async function leave(){if(!window.confirm(game?.role==='master'?'Chiudere la sessione? I personaggi resteranno ai loro proprietari.':'Uscire dalla sessione con il tuo personaggio? Gli appunti personali di questa partita verranno eliminati.'))return;try{await playApi('/games/'+id+(game?.role==='master'?'':'/leave'),game?.role==='master'?'DELETE':'POST');localStorage.removeItem(cacheKey);navigate('/')}catch(error){setError(message(error))}}
    async function addOwned(event:FormEvent){event.preventDefault();try{const next=await playApi<MasterGame>('/games/'+id+'/characters','POST',{characterId:selected,revision:gameRef.current?.revision});gameRef.current=next;setGame(next);setSelected('');setAvailable(current=>current.filter(character=>character.id!==selected));setError('')}catch(error){setError(message(error))}}
    async function readNotification(changeId:string) {
        const notifications=await playApi<NotificationSummary>('/games/'+id+'/notifications/'+changeId+'/read','POST')
        const current=gameRef.current
        if (current && notifications.revision>=current.notifications.revision) {const next={...current,notifications};gameRef.current=next;setGame(next)}
    }
    async function rejectNotification(changeId:string) {
        if (draftRef.current || savingRef.current || blocked) throw new Error('Concludi il salvataggio della sessione prima di rifiutare una modifica.')
        savingRef.current=true;setSaving(true)
        try {
            const next=await playApi<MasterGame>('/games/'+id+'/notifications/'+changeId+'/reject','POST',{revision:gameRef.current?.revision})
            gameRef.current=next
            if (draftRef.current) {setBlocked(true);setError('La modifica è stata rifiutata, ma nel frattempo hai iniziato altre modifiche. La bozza è conservata: ricarica i dati del server prima di continuare.')}
            else setGame(next)
        } finally {savingRef.current=false;setSaving(false)}
    }
    const decideAction=useCallback(async(requestId:string,decision:'approve'|'reject',body:unknown)=>{
        if (draftRef.current || savingRef.current || blocked) throw new Error('Concludi il salvataggio della sessione prima di decidere un’azione.')
        savingRef.current=true;setSaving(true)
        try {
            const next=await playApi<MasterGame>('/games/'+id+'/requests/'+requestId+'/'+decision,'POST',{...(body as object),revision:gameRef.current?.revision})
            gameRef.current=next
            if (draftRef.current) {setBlocked(true);setError('Decisione salvata. Hai iniziato altre modifiche durante l’attesa: la bozza è conservata. Ricarica i dati del server prima di continuare.')}
            else setGame(next)
        } finally {savingRef.current=false;setSaving(false)}
    },[id,blocked])
    function updatePlayerAction(next:Game) {
        const current=gameRef.current
        if (current && (next.revision<current.revision || next.requestsRevision<current.requestsRevision)) return
        if (current?.role==='player' && next.role==='player' && current.notes.revision>next.notes.revision) next.notes=current.notes
        if (current?.role==='player' && next.role==='player' && current.character.revision>next.character.revision) next.character=current.character
        if (current && current.notifications.revision>next.notifications.revision) next.notifications=current.notifications
        gameRef.current=next;setGame(next)
    }
    if(!game)return <main className="play-home"><h1>Sessione</h1>{error?<><p role="alert">{error}</p><button type="button" onClick={()=>{setError('');setLoadRetry(value=>value+1)}}>Riprova caricamento</button></>:<p role="status">Caricamento della sessione…</p>}<Link to="/">Torna alla home</Link></main>
    return <main className={game.role==='master' ? `play-master-page${masterView.view === 'renewed' ? ' master-page-renewed' : ''}` : 'play-player-page'}><header className="play-session-heading"><div><Link to="/">Le mie sessioni</Link><h1>{game.name}</h1><p>{game.role==='master'?'Sessione Master':'La tua avventura'}</p></div><div className="play-session-actions"><SheetChanges game={game} disabled={!!draft||saving||blocked} onRead={readNotification} onReject={rejectNotification}/>{game.role==='master'&&<MasterCombatRequests game={game} disabled={!!draft||saving||blocked} onDecide={decideAction}/>}{game.role==='master' && <MasterViewSettings view={masterView.view} onChange={masterView.changeView} error={masterView.error}>{masterView.view === 'renewed' && <label>Lingua dei contenuti<select aria-label="Lingua" value={language} onChange={event=>setLanguage(event.target.value as 'it'|'en')}><option value="it">Italiano</option><option value="en">English</option></select></label>}<button type="button" className="play-secondary" onClick={()=>void leave()}>Chiudi sessione</button></MasterViewSettings>}{(game.role !== 'master' || masterView.view === 'original') && <button className="play-secondary" onClick={()=>void leave()}>{game.role==='master'?'Chiudi sessione':'Esci dalla sessione'}</button>}</div></header>
        {error&&<p role="alert">{error}</p>}{blocked&&<div className="play-actions"><button onClick={()=>{setBlocked(false);setRetry(value=>value+1)}}>Riprova salvataggio</button><button className="play-secondary" onClick={()=>void reload()}>Ricarica dati del server</button></div>}
        {game.role==='master'?<>{masterView.view === 'original' ? <div className="play-master-tools"><label>Invito alla sessione<input aria-label="Link di invito" readOnly value={new URL('/join/'+game.inviteToken,window.location.origin).href}/></label><button type="button" onClick={()=>void navigator.clipboard.writeText(new URL('/join/'+game.inviteToken,window.location.origin).href).then(()=>setCopied(true)).catch(()=>setError('Copia non riuscita: seleziona e copia il link dal campo.'))}>{copied?'Link copiato':'Copia invito'}</button><label>Lingua<select aria-label="Lingua" value={language} onChange={event=>setLanguage(event.target.value as 'it'|'en')}><option value="it">Italiano</option><option value="en">English</option></select></label><p role="status">{saving?'Salvataggio della sessione…':draft?'Modifiche da salvare':'Sessione sincronizzata'}</p></div> : <div className="play-master-tools"><details className="master-invite"><summary>Invita giocatori</summary><div className="master-invite-content"><label>Link di invito<input aria-label="Link di invito" readOnly value={new URL('/join/'+game.inviteToken,window.location.origin).href}/></label><button type="button" onClick={()=>void navigator.clipboard.writeText(new URL('/join/'+game.inviteToken,window.location.origin).href).then(()=>setCopied(true)).catch(()=>setError('Copia non riuscita: seleziona e copia il link dal campo.'))}>{copied?'Link copiato':'Copia invito'}</button></div></details><p className="master-sync-status" role="status">{saving?'Salvataggio della sessione…':draft?'Modifiche da salvare':'Sessione sincronizzata'}</p></div>}{masterView.view === 'original' && <details className="play-recovery" onToggle={event=>{if(event.currentTarget.open)void playApi<HomeData>('/home').then(home=>setAvailable(home.characters.filter(character=>!character.gameId))).catch(error=>setError(message(error)))}}><summary>Aggiungi una tua scheda esistente</summary><form className="play-create-game" onSubmit={event=>void addOwned(event)}><label>Scheda disponibile<select aria-label="Scheda disponibile" value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Scegli una scheda…</option>{available.map(character=><option value={character.id} key={character.id}>{character.sheet.name}</option>)}</select></label><button disabled={!selected||!!draft||saving}>Aggiungi alla sessione</button></form></details>}<TurnsTracker language={language} workspace={workspace} view={masterView.view} libraryTools={<details className="play-recovery" onToggle={event=>{if(event.currentTarget.open)void playApi<HomeData>('/home').then(home=>setAvailable(home.characters.filter(character=>!character.gameId))).catch(error=>setError(message(error)))}}><summary>Aggiungi una tua scheda esistente</summary><form className="play-create-game" onSubmit={event=>void addOwned(event)}><label>Scheda disponibile<select aria-label="Scheda disponibile" value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Scegli una scheda…</option>{available.map(character=><option value={character.id} key={character.id}>{character.sheet.name}</option>)}</select></label><button disabled={!selected||!!draft||saving}>Aggiungi alla sessione</button></form></details>}/></>:<><nav className="play-player-navigation" aria-label="Sezioni della sessione"><a href="#player-character">Scheda</a><a href="#player-turns">Combattimento</a><a href="#player-effects">Effetti</a><a href="#player-notes">Appunti</a></nav><div className="play-player-layout">
            <div className="play-player-sheet" id="player-character"><CharacterEditor record={game.character} settingsInDialog historyControl={<SheetChanges game={game} history/>} onCancel={()=>navigate('/')} onSave={async(sheet,revision)=>{
                const character=await playApi<OwnedCharacter>('/characters/'+game.character.id,'PUT',{sheet,revision})
                const current=gameRef.current
                if(current?.role==='player'){const next={...current,character};setGame(next);gameRef.current=next}setError('')
            }}/></div>
            <PlayerNotes record={game.notes} onSave={async notes=>{
                const saved=await playApi<PrivateNotes>('/games/'+game.id+'/notes','PUT',notes)
                const current=gameRef.current
                if(current?.role==='player'){const next={...current,notes:saved};setGame(next);gameRef.current=next}return saved
            }}/>
            <aside className="play-player-sidebar" aria-label="Combattimento ed effetti">
                <PlayerCombatActions game={game} onUpdate={updatePlayerAction}/>
                <section className="play-player-turns" aria-labelledby="player-turns"><h2 id="player-turns">Ordine di combattimento</h2>{!game.turns.length&&<p>Il Master non ha ancora aggiunto partecipanti al combattimento.</p>}<ol>{game.turns.map((turn,index)=><li key={index} aria-current={turn.current?'step':undefined}><span>{turn.name||'Partecipante da nominare'}</span>{turn.current&&<strong>Turno attuale</strong>}</li>)}</ol></section>
                <section className="play-player-effects" aria-labelledby="player-effects"><h2 id="player-effects">Effetti e abilità attivi</h2>{!game.effects.length&&<p>Nessun effetto attivo sul tuo personaggio.</p>}<ul>{game.effects.map((effect,index)=><li key={index}><h3>{effect.name}</h3><p>{effect.timed?`${effect.remainingTurns} turni rimanenti · ${effect.duration}`:'Senza conteggio'}</p>{effect.concentration&&<p>Concentrazione</p>}{effect.expiresAt&&<p>Scade a {effect.expiresAt==='start'?'inizio':'fine'} turno.</p>}{effect.repeatSave&&<p>{effect.repeatSave}</p>}{effect.description&&<p>{effect.description}</p>}</li>)}</ul></section>
            </aside>
        </div></>}
    </main>
}
