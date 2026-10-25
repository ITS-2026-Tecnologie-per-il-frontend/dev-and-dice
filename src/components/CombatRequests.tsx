import { PlayerActionRolls, WeaponEnchantmentFields, ResolutionDetails, FinalDamageField, MasterResolutionRolls, MasterCriticalRolls, MasterSavingRolls, type RequestDecision } from './CombatRolls'
import { memo, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { playApi, type ActionChoices, type CombatRequest, type CombatTarget, type Game, type PlayerGame, type WindReview as WindData } from '../utils/PlayApi'
import { NotificationPopover } from './NotificationPopover'
import { ParticipantAbilities, type InspectorMode } from './ParticipantInspector'
import { AbilityCard, AbilityMetadata, AbilityTargets, WeaponEffectSummary, SpellEffectSummary } from './AbilityCard'
import { InfoButton } from './InfoButton'
import { HelpTooltip } from './HelpTooltip'
import { damageNames, directBenefit, type WeaponChoice } from '../domain/dnd/CombatResolution'
import { integerValue, signedBonus } from '../utils/CharacterSheets'
import { sleepDice, validSleepRoll, sleepAllocation } from '../domain/dnd/Sleep'
import { SleepReview } from './SleepReview'
import { WindReview, WindSummary } from './WindReview'
import { WindDirectionForm } from './WindDirectionForm'
import { catalogForSheet, loadActiveDatabase } from '../domain/dnd/ActiveRules'
import { sheetWithCombatAbilities, type Catalog, type CatalogEntry } from '../utils/Catalog'
import type { CharacterSheet, SheetAbility } from '../utils/CharacterSheets'

const modeLabels={attack:'Tiro per colpire',save:'Tiro salvezza',automatic:'Colpo / effetto automatico',none:'Senza danni'}
const statusLabels={pending:'In attesa del Master',approved:'Approvata',rejected:'Rifiutata',stale:'Superata: turno o dati cambiati'}
const message=(error:unknown)=>error instanceof Error ? error.message : 'Operazione non riuscita.'

function RequestDescription({request,review=false}:{request:CombatRequest;review?:boolean}) {
    if(review)return <>
        <p className="combat-request-author"><strong>{request.characterName}</strong><span>Giocato da {request.actorName}</span><time dateTime={request.createdAt}>{new Date(request.createdAt).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></p>
        <p className="combat-request-mode"><span>{request.resolution?.temporaryHitPoints?'PF temporanei':request.resolution?.healing?'Guarigione':modeLabels[request.mode]}</span><span>{request.optionLabel}{request.spendsResources?` · costo ${request.cost}`:''}</span></p>
        {request.prolonged&&<p className="combat-request-notice">Tempo di lancio prolungato: approva dopo il completamento.</p>}
        {request.sleepRoll!==undefined&&!request.sleepReview&&<p className="ability-casting-summary">Riserva di Sonno: <strong>{request.sleepRoll} PF</strong> · totale dei d8, nessun danno.</p>}
    </>
    // Critical damage dice: PHB 2014 PDF 197; SRD 5.2.1 (2024) PDF 18, Colpi critici.
    return <><p>{request.characterName} · {request.actorName} · <time dateTime={request.createdAt}>{new Date(request.createdAt).toLocaleString('it-IT')}</time></p>
        <p>{request.resolution?.temporaryHitPoints?'PF temporanei':request.resolution?.healing?'Guarigione':modeLabels[request.mode]} · {request.optionLabel}{request.spendsResources?` · costo ${request.cost}`:''}</p>
        {request.sleepRoll!==undefined&&<p>Riserva di Sonno: <strong>{request.sleepRoll} PF</strong> · totale dei d8, nessun danno.</p>}
        {request.prolonged&&<p>Tempo di lancio prolungato: approvare soltanto dopo il completamento.</p>}
        <ul>{request.targets.map(target=><li key={target.id}><strong>{target.name||'Partecipante'}</strong>{target.asleep!==undefined&&<> · {target.asleep?'Addormentato':'Non addormentato'}</>}{!target.attack&&target.roll&&<> · {request.mode==='save'?'TS':'Tiro'}: {target.roll}</>}{request.mode==='attack'&&target.hit!==undefined&&<> · {target.hit?'Colpito':'Mancato'}</>}{target.attack&&<p>Confronto base: d20 {target.attack.die}, modificatore {target.attack.modifier===undefined?'da verificare':signedBonus(target.attack.modifier)}, totale {target.attack.total??'da verificare'} · CA {target.attack.armorClass??'da verificare'} · {target.attack.critical?'Colpo critico':target.attack.hit===undefined?'Esito da verificare':target.attack.hit?'Colpito':'Mancato'}</p>}{request.damageEnabled&&<> · Danni tirati: {target.damageRoll||'—'}{request.packets===undefined&&target.damageRoll!==target.damage&&<> · Danni finali: {target.damage}</>}</>}</li>)}</ul>
        {request.targets.some(target=>target.attack)&&<p>Verifica copertura, reazioni e altri effetti prima di confermare i danni finali.{request.targets.some(target=>target.attack?.critical)&&<> Per un critico si tirano due volte i dadi di danno, aggiungendo i modificatori una sola volta.</>}</p>}
        <ResolutionDetails request={request}/>
        <p role="status">{statusLabels[request.status]}</p></>
}

export function ReviewRequest({request,ability,entry,catalogStatus,disabled,onDecide}:{request:CombatRequest;ability?:SheetAbility;entry?:CatalogEntry;catalogStatus?:string;disabled:boolean;onDecide:(id:string,decision:RequestDecision,body:unknown)=>Promise<void>}) {
    const decisionId=useId()
    const [wind,setWind]=useState<Pick<WindData,'selected'|'saves'>>(()=>({selected:request.wind?.selected??[],saves:request.wind?.saves??{}}))
    const missingWind=!!request.wind&&wind.selected.some(id=>wind.saves[id]?.mode==='manual'&&wind.saves[id]?.success===undefined)
    const [weapons,setWeapons]=useState<Record<number,WeaponChoice>>({})
    const [additionalActionConfirmed,setAdditionalActionConfirmed]=useState(false)
    const [sleepArea,setSleepArea]=useState<number[]>(request.sleepReview?.area??request.targets.map(t=>t.id))
    const [sleepSelected,setSleepSelected]=useState<number[]>(()=>request.sleepReview?(request.status==='pending'?sleepAllocation(request.sleepReview.candidates,request.sleepReview.area??request.targets.map(t=>t.id),request.sleepRoll??0,request.sleepReview.selected).selected:request.sleepReview.selected):[])
    const missingSleep=!!request.sleepReview&&request.sleepReview.candidates.some(t=>sleepArea.includes(t.id)&&t.hitPoints===undefined&&!t.unavailableReason)
    const [damages,setDamages]=useState<Record<number,string>>({}),[manual,setManual]=useState(false),[effectOverrides,setEffectOverrides]=useState<Record<number,boolean>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('')
    const calculatedDamageFor=(target:CombatTarget)=>target.resolution?target.resolution.damage===null?'':String(target.resolution.damage):target.attack?.hit===false?'0':target.damage
    const damageFor=(target:CombatTarget)=>damages[target.id]??calculatedDamageFor(target)
    const effectTargets=request.targets.filter(t=>t.resolution?.packets.some(p=>p.effects.some(e=>e.kind==='condition'||e.kind==='speed'||e.kind==='roll-bonus'&&e.trigger!=='always')))

    const weaponEffect=request.resolution?.weaponEffect
    const missingWeapon=!!weaponEffect&&request.targets.some(t=>!weapons[t.id]?.itemId||!!weaponEffect.extraDamage&&!weapons[t.id]?.damageType||!!weaponEffect.damageDice&&weapons[t.id]?.useCastingAbility!==false&&weaponEffect.castingModifier===undefined)
    const working=useRef(false)
    async function decide(decision:'approve'|'reject') {
        if (working.current) return
        working.current=true;setBusy(true);setError('')
        try {await onDecide(request.id,decision,{confirmed:decision==='approve',additionalActionConfirmed,manualResolution:manual,...(request.sleepReview?{sleepArea,sleepTargets:sleepSelected}:{}),...(request.wind?{wind}:{}),...(weaponEffect?{weapons:request.targets.map(t=>({targetId:t.id,...weapons[t.id]}))}:{}),targets:request.wind?wind.selected.map(id=>({id,damage:'0'})):request.targets.map(target=>({id:target.id,damage:damageFor(target)})),...(request.resolution?{effects:effectTargets.filter(t=>effectOverrides[t.id]!==false).map(t=>t.id)}:{})})} catch(error) {setError(message(error))} finally {working.current=false;setBusy(false)}
    }
    async function refreshRequest(){
        if(working.current)return
        working.current=true;setBusy(true);setError('')
        try{await onDecide(request.id,'roll',{kind:request.wind?'wind-refresh':'refresh'})}catch(error){setError(message(error))}finally{working.current=false;setBusy(false)}
    }
    const pending=request.status==='pending',stale=request.status==='stale'
    return <article className="combat-request combat-request--review" aria-busy={busy}><header className="combat-request-heading"><div className="combat-request-title"><h3>{request.actionName}</h3><InfoButton label="Dettagli" name={request.actionName} entry={entry} description={ability?.description||catalogStatus||request.resolution?.notes.join('\n')||'Descrizione non disponibile. Consulta la scheda del personaggio.'} fields={ability?{duration:ability.duration}:{}}/></div><p className="combat-request-state" data-state={request.status} role="status">{statusLabels[request.status]}</p></header><RequestDescription request={request} review/>
        {request.sleepReview&&<SleepReview review={request.sleepReview} total={request.sleepRoll??0} area={sleepArea} selected={sleepSelected} disabled={disabled||busy||!pending} onChange={(area,selected)=>{setSleepArea(area);setSleepSelected(selected)}}/>}
        {!request.sleepReview&&<ResolutionDetails request={request} review renderSave={target=><MasterSavingRolls request={request} target={target} disabled={disabled||busy} onDecide={onDecide}/>} renderPacket={(target,index)=><MasterCriticalRolls request={request} target={target} index={index} disabled={disabled||busy} onDecide={onDecide}/>} renderTarget={target=>{
            if(!pending||!request.damageEnabled)return null
            const original=calculatedDamageFor(target),value=damageFor(target)
            const locked=disabled||busy||!request.resolution&&request.attackDie===undefined&&request.mode==='attack'&&!target.hit
            return <FinalDamageField target={target} result={target.resolution} value={value} calculated={original} disabled={locked} formId={decisionId} onChange={nextValue=>setDamages(current=>{
                const next={...current};if(original!==''&&nextValue!==''&&Number(nextValue)===Number(original))delete next[target.id];else next[target.id]=nextValue;return next
            })}/>
        }}/>}
        <MasterResolutionRolls request={request} disabled={disabled} onDecide={onDecide}/>
        {(pending||stale)&&<form id={decisionId} className="combat-request-decision" onSubmit={event=>{event.preventDefault();if(pending)void decide('approve')}}>
            <fieldset disabled={disabled||busy}><legend>{request.wind?'Bersagli e tiri salvezza':'Decisione del Master'}</legend>
                {stale&&!request.wind&&directBenefit(request.resolution)&&<p role="status">La sessione è cambiata. Aggiorna la richiesta per ricontrollare turno, bersagli e risorse prima di approvare.</p>}
                {request.wind&&!request.wind.editable&&<p className="wind-review-locked" role="status">{stale?'La sessione è cambiata. Aggiorna la richiesta per ricontrollare turno, risorse e CD e riattivare i campi. I TS precedenti saranno azzerati.':'Effetto terminato o richiesta conclusa: bersagli e tiri sono in sola lettura.'}</p>}
                {request.wind&&request.resolution&&<WindReview review={request.wind} plan={request.resolution} casterName={request.characterName} value={wind} onChange={setWind}/>}
                {pending&&weaponEffect&&<WeaponEnchantmentFields effect={weaponEffect} targets={request.targets.map(target=>({id:target.id,name:target.name,items:request.weaponChoices?.find(choice=>choice.targetId===target.id)?.items??[]}))} value={weapons} onChange={(id,choice)=>setWeapons(current=>({...current,[id]:choice}))}/>}
                {pending&&<>
                {request.additionalActionRequired&&<label className="combat-request-check"><input type="checkbox" checked={additionalActionConfirmed} onChange={event=>setAdditionalActionConfirmed(event.target.checked)}/>Confermo un’altra azione valida per lanciare un incantesimo (es. Azione Impetuosa 2014)</label>}
                {effectTargets.map(target=><label className="combat-request-check" key={target.id}><input type="checkbox" checked={effectOverrides[target.id]!==false} onChange={event=>setEffectOverrides(current=>({...current,[target.id]:event.target.checked}))}/>Applica gli effetti aggiuntivi a {target.name}</label>)}
                {request.resolution&&request.targets.some(t=>t.resolution?.damage===null)&&<label className="combat-request-check"><input type="checkbox" checked={manual} onChange={event=>setManual(event.target.checked)}/>Confermo una risoluzione manuale per i dati mancanti</label>}
                </>}
                <div className="play-actions">{stale&&(request.wind||directBenefit(request.resolution))&&<button type="button" onClick={()=>void refreshRequest()}>Aggiorna richiesta</button>}{pending&&<button disabled={!!request.additionalActionRequired&&!additionalActionConfirmed||missingWind||missingWeapon||missingSleep||!!request.resolution&&request.targets.some(t=>t.resolution?.damage===null)&&!manual} type="submit">Approva azione</button>}{(pending||stale)&&<button type="button" className="play-secondary" onClick={()=>void decide('reject')}>Rifiuta azione</button>}</div>
            </fieldset>
        </form>}{!pending&&!stale&&request.wind&&request.resolution&&<WindSummary review={request.wind} plan={request.resolution} casterName={request.characterName}/>}{error&&<p role="alert">{error}</p>}</article>
}

const ReviewRequestCard=memo(ReviewRequest)
const emptyCatalog:Catalog={creatures:[],abilities:[]}

export const MasterCombatRequests=memo(function MasterCombatRequests({game,disabled,onDecide}:{game:Game;disabled:boolean;onDecide:(id:string,decision:RequestDecision,body:unknown)=>Promise<void>}) {
    const [open,setOpen]=useState(false)
    const [database,setDatabase]=useState<Awaited<ReturnType<typeof loadActiveDatabase>>>()
    const [catalogError,setCatalogError]=useState('')
    useEffect(()=>{let active=true;loadActiveDatabase().then(value=>{if(active)setDatabase(value)}).catch(error=>{if(active)setCatalogError(`Catalogo non disponibile: ${message(error)} Ricarica la pagina per riprovare.`)});return()=>{active=false}},[])
    const characters=game.role==='master'?game.characters:undefined
    const reviews=useMemo(()=>{
        // A character's spell/attack catalog is shared by all of their requests.
        const abilitiesBySheet=new Map<CharacterSheet,Map<Catalog|undefined,SheetAbility[]>>()
        return game.combatRequests.map(request=>{
            const owners=characters?characters.filter(character=>request.characterId?character.id===request.characterId:character.sheet.name===request.characterName):[]
            const sheet=owners.length===1?owners[0].sheet:undefined
            const catalog=database&&(request.resolution?.edition==='2014'?database.catalogs.it:request.resolution?.edition==='2024'?database.creationData.legacyCatalogs?.it:sheet?catalogForSheet(database.creationData,database.catalogs.it,sheet):undefined)
            let abilities:SheetAbility[]=[]
            if(sheet){
                let byCatalog=abilitiesBySheet.get(sheet)
                if(!byCatalog){byCatalog=new Map();abilitiesBySheet.set(sheet,byCatalog)}
                const cached=byCatalog.get(catalog)
                abilities=cached??sheetWithCombatAbilities(sheet,catalog??emptyCatalog).abilities
                if(!cached)byCatalog.set(catalog,abilities)
            }
            const candidates=abilities.filter(ability=>request.resolution?.ruleId?ability.ruleId===request.resolution.ruleId:ability.name===request.actionName)
            const ability=candidates.length===1?candidates[0]:undefined
            const entries=catalog?.abilities.filter(entry=>ability?.catalogId?entry.id===ability.catalogId:request.resolution?.ruleId?entry.data.referenceId===request.resolution.ruleId:entry.name===request.actionName)??[]
            const entry=entries.length===1?entries[0]:undefined
            return {request,ability,entry}
        })
    },[game.combatRequests,characters,database])
    const pending=game.combatRequests.filter(request=>request.status==='pending').length
    return <NotificationPopover id="combat-requests" title="Azioni dei giocatori" label={`Azioni dei giocatori: ${pending} in attesa`} closeLabel="Chiudi azioni" iconPath="M14 3h7v7L10 21l-7-7L14 3ZM13 4l7 7M3 21l3-3M3 14l7 7" count={pending} newest={game.newestPendingRequest} storageKey={`dev-and-dice.notification-opened.v1.${game.id}.master.actions`} open={open} onOpenChange={setOpen}>
        <p>Ogni azione richiede approvazione esplicita. Le modifiche ordinarie alla scheda seguono le notifiche della campanella.</p>
        {!game.combatRequests.length&&<p>Nessuna azione proposta.</p>}
        <ol className="play-notification-list combat-request-feed">{reviews.map(({request,ability,entry})=>{
            return <li key={request.id} data-unread={request.status==='pending'}><ReviewRequestCard key={request.rollsRevision} request={request} ability={ability} entry={entry} catalogStatus={database?undefined:catalogError||'Caricamento dei dettagli…'} disabled={disabled} onDecide={onDecide}/></li>
        })}</ol>
        {disabled&&<p>Concludi il salvataggio della sessione prima di approvare o rifiutare un’azione.</p>}
    </NotificationPopover>
})

export function PlayerCombatActions({game,onUpdate,renewed=false,inspectorMode='participant'}:{game:PlayerGame;onUpdate:(game:Game)=>void;renewed?:boolean;inspectorMode?:InspectorMode}) {
    const [open,setOpen]=useState(renewed),[choices,setChoices]=useState<ActionChoices>(),[loading,setLoading]=useState(renewed),[retry,setRetry]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState('')
    const [panel,setPanel]=useState<'summary'|'cast'>('cast')
    const selectedIdentity=useRef('')
    const form=useRef<HTMLFormElement>(null)
    const [weaponRoll,setWeaponRoll]=useState('')
    const [sleepRoll,setSleepRoll]=useState('')
    const [key,setKey]=useState(''),[optionId,setOptionId]=useState(''),[cost,setCost]=useState(1),[mode,setMode]=useState<CombatRequest['mode']>('none'),[damageEnabled,setDamageEnabled]=useState(false),[targets,setTargets]=useState<CombatTarget[]>([])
    const working=useRef(false),attempt=useRef<{signature:string;body:unknown}>(undefined)
    const action=choices?.actions.find(action=>action.key===key),option=action?.options.find(option=>option.id===optionId)
    const weapon=renewed&&action?.group==='Attacchi fisici'
    const sleep=action?.entry?.data.edition==='2014'&&action.entry.data.referenceId==='phb2014:spell:sleep'
    const sleepCount=sleepDice(optionId),sleepTotal=Number(sleepRoll),validSleep=validSleepRoll(sleepTotal,sleepCount)
    const die=integerValue(weaponRoll),modifier=integerValue(action?.attackBonus)
    const validDie=die!==undefined&&die>=1&&die<=20
    const total=validDie&&modifier!==undefined&&Number.isSafeInteger(die+modifier)?die+modifier:undefined
    const weaponRollText=validDie ? total===undefined ? `${die} sul d20; modificatore e totale da verificare` : `${die} sul d20 ${signedBonus(modifier)} = ${total}` : ''
    const targeting=option?.targeting,tooManyTargets=targeting?.maximum!==null && targeting?.maximum!==undefined && targets.length>targeting.maximum
    const pending=game.combatRequests.some(request=>request.status==='pending'),stale=choices && choices.revision!==game.revision
    const revision=renewed ? game.revision : undefined
    useEffect(()=>{
        if (!open) return
        let active=true
        playApi<ActionChoices>('/games/'+game.id+'/actions'+(renewed?'?preview=1':'')).then(choices=>{if(active){setChoices(choices);if(renewed){const selected=choices.actions.find(item=>(item.entry?.id??item.name)===selectedIdentity.current);if(panel==='summary'&&selected&&!selected.active&&selected.duration!=='Istantanea'&&selected.lastCast?.status!=='pending'){selectedIdentity.current='';setKey('')}else setKey(selected?.key??'');setError('')}}}).catch(error=>{if(active)setError(message(error))}).finally(()=>{if(active)setLoading(false)})
        return ()=>{active=false}
    },[open,game.id,retry,renewed,revision,panel,game.requestsRevision])
    function refreshActions() {setLoading(true);setError('');setChoices(undefined);setKey('');setTargets([]);setRetry(current=>current+1)}
    function select(key:string) {
        const action=choices?.actions.find(action=>action.key===key),option=action?.options.find(option=>option.remaining===null || option.remaining>=(option.cost??action.cost)) ?? action?.options[0]
        // Attacks: PHB 2014, D&D_5_Player_Original_Handbook.pdf, PDF 195;
        // SRD 5.2.1, D&D_5.5_manuale_compatto_italiano.pdf, PDF 16, Effettuare un attacco.
        selectedIdentity.current=action?.entry?.id??action?.name??''
        const sleep=action?.entry?.data.edition==='2014'&&action.entry.data.referenceId==='phb2014:spell:sleep'
        setKey(key);setOptionId(option?.id??'');setCost(option?.cost??action?.cost??1);setMode(sleep?'none':renewed&&action?.group==='Attacchi fisici'?'attack':action?.mode??'none');setDamageEnabled(!sleep&&(action?.damageEnabled??false));setWeaponRoll('');setSleepRoll('');setTargets([]);setError('')
    }
    function patch(id:number,values:Partial<CombatTarget>) {setTargets(current=>current.map(target=>target.id===id?{...target,...values}:target))}
    function changeMode(mode:CombatRequest['mode']) {setMode(mode);setTargets([]);if(mode==='none')setDamageEnabled(false)}
    async function submit(event:FormEvent) {
        event.preventDefault()
        if (working.current||!choices||renewed&&!choices.canPropose||weapon&&!validDie||sleep&&!validSleep) return
        working.current=true;setBusy(true);setError('')
        const proposal={...(sleep?{sleepRoll:sleepTotal}:{}),...(weapon?{attackDie:die}:{}),revision:choices.revision,key,option:optionId,cost:sleep?1:option?.cost??cost,mode:sleep?'none':mode,damageEnabled:sleep?false:damageEnabled,targets:targets.map(({id,roll,hit,damageRoll,damage})=>sleep?{id,roll:'',hit:false,damageRoll:'',damage:'0'}:{id,roll:weapon?weaponRollText:roll,hit:weapon?false:hit,damageRoll,damage})}
        const signature=JSON.stringify(proposal)
        if (attempt.current?.signature!==signature) attempt.current={signature,body:{id:crypto.randomUUID(),...proposal}}
        try {onUpdate(await playApi<Game>('/games/'+game.id+'/requests','POST',attempt.current.body));attempt.current=undefined;if(renewed){setPanel('summary');setRetry(current=>current+1)}else setKey('');setTargets([])} catch(error) {setError(message(error))} finally {working.current=false;setBusy(false)}
    }
    const filtered=choices?.actions.filter(action=>action.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? []
    function choose(key:string) {
        select(key)
        const selected=choices?.actions.find(item=>item.key===key)
        setPanel(selected?.active||selected?.lastCast?.status==='pending'?'summary':'cast')
        requestAnimationFrame(()=>{form.current?.focus({preventScroll:true});form.current?.scrollIntoView({block:'nearest'})})
    }
    function actionButton(action:ActionChoices['actions'][number]) {
        return <button type="button" key={action.key} className="participant-ability" data-ability-state={action.active?'active':'available'} aria-pressed={key===action.key} aria-controls="player-action-proposal" disabled={busy} onClick={()=>choose(action.key)}>{action.displayName||action.name} · {action.lastCast?.status==='pending'?'In attesa del Master':action.active?'In esecuzione':action.error||'Usa'}</button>
    }
    function targetFields(target:CombatTarget) {
        return <>
                    {weapon&& <><div className="player-weapon-attack"><p className="ability-casting-summary">Tiro per colpire con arma</p><div className="player-weapon-roll">
                        <div className="player-weapon-die"><div className="player-weapon-label"><label htmlFor="player-attack-roll">Tiro per colpire (inserisci solo il numero del dado)</label><HelpTooltip label="Aiuto sul tiro per colpire">Un attacco per utilizzo. Inserisci solo il d20: il bonus della scheda viene aggiunto al totale. Poi inserisci il totale dei danni tirati, inclusi i modificatori; il Master verifica gittata, proprietà dell’arma, esito e danni effettivi.</HelpTooltip></div><input id="player-attack-roll" type="text" inputMode="numeric" pattern="([1-9]|1[0-9]|20)" required placeholder="Es. 15" value={weaponRoll} onChange={event=>{const value=event.target.value;if(!/^\d*$/.test(value))return;const roll=Number(value)>20?'20':value;setWeaponRoll(roll);setTargets(current=>current.map(target=>({...target,roll,hit:false,damageRoll:'',damage:'0'})))}}/></div>
                        <div><span>Modificatore della scheda</span><output aria-label="Modificatore al tiro per colpire dalla scheda">{signedBonus(integerValue(action.attackBonus))||action.attackBonus?.trim()||'Da verificare'}</output></div>
                    </div></div>{validDie&&<p className="ability-casting-summary" role="status" aria-label="Totale tiro per colpire">Totale: {total??'da verificare'}</p>}{weaponRoll&&!validDie&&<p role="status">Inserisci un numero intero da 1 a 20.</p>}</>}
                        {!weapon&&(mode==='attack'||mode==='save')&&<label>{mode==='attack'?'Tiro per colpire (totale, con modificatori)':'Tiro salvezza / esito (anche da risolvere col Master)'}<input maxLength={500} required={mode==='attack'} value={target.roll} onChange={event=>patch(target.id,{roll:event.target.value})}/></label>}
                        {!weapon&&mode==='attack'&&target.roll.trim()&&<label className={renewed?'ability-check':'combat-request-check'}><input type="checkbox" checked={target.hit} onChange={event=>patch(target.id,{hit:event.target.checked,damageRoll:'',damage:'0'})}/>Almeno un attacco ha colpito (da confermare col Master)</label>}
                        {damageEnabled&&(weapon?validDie:mode!=='attack'||target.hit)&&<label>Danni tirati<input type="text" inputMode="numeric" pattern="[0-9]+" required maxLength={16} placeholder="Totale, es. 7" value={target.damageRoll} onChange={event=>{const damage=event.target.value;if(!/^\d*$/.test(damage)||!Number.isSafeInteger(Number(damage)))return;patch(target.id,{damageRoll:damage,damage:damage||'0'})}}/></label>}</>
    }
    const legacyProposal=choices&&(!renewed||action)&&<form id="player-action-proposal" ref={form} tabIndex={renewed?-1:undefined} aria-label={renewed?`Proposta: ${action?.name}`:undefined} onSubmit={event=>void submit(event)}><fieldset disabled={busy||pending||!!stale||loading||renewed&&!!action?.error}>{!renewed&&<legend>Proposta al Master</legend>}
                {!renewed&&<label>Azione<select aria-label="Azione" value={key} required onChange={event=>select(event.target.value)}><option value="">Scegli un’azione…</option>{choices.actions.map(action=><option key={action.key} value={action.key} disabled={!!action.error}>{action.name}{action.error?' · '+action.error:''}</option>)}</select></label>}
                {!choices.actions.length&&<p>Nessuna azione disponibile: controlla attacchi, abilità e incantesimi salvati nella scheda.</p>}
                {action&&<><details className="player-action-description" open={renewed?true:undefined}><summary>Descrizione dell’azione</summary><p className="combat-request-description">{action.description||'Risoluzione da confermare con il Master.'}</p></details>
                    {!renewed&&<InfoButton label="Descrizione" entry={action.entry} name={action.name} description={action.description} fields={{duration:action.duration,remainingTurns:action.remainingTurns,active:action.active,owner:game.character.sheet.name}}/>}
                    {(!weapon||action.options.length!==1||optionId!=='free')&&<label>Risorsa<select aria-label="Risorsa" required value={optionId} onChange={event=>{const option=action.options.find(option=>option.id===event.target.value);setOptionId(event.target.value);setCost(option?.cost??action.cost);if(sleep){setSleepRoll('');setTargets([])}}}>{action.options.map(option=><option key={option.id} value={option.id} disabled={option.remaining!==null&&option.remaining<(option.cost??cost)}>{option.label}{option.remaining!==null?` · ${option.remaining} rimasti`:''}</option>)}</select></label>}
                    {!sleep&&option&&!['free','cantrip','ritual'].includes(option.id)&&<label>Costo<input type="number" min="1" step="1" required readOnly={option.cost!==undefined} value={option.cost??cost} onChange={event=>setCost(Number(event.target.value))}/></label>}
                    {!sleep&&!weapon&&<label>Risoluzione<select aria-label="Risoluzione" value={mode} onChange={event=>changeMode(event.target.value as CombatRequest['mode'])}>{Object.entries(modeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
                    {!sleep&&mode!=='none'&&!(weapon&&action.damageEnabled)&&<label className="combat-request-check"><input type="checkbox" checked={damageEnabled} onChange={event=>{setDamageEnabled(event.target.checked);setTargets(current=>current.map(target=>({...target,damage:'0',damageRoll:''})))}}/>L’azione può infliggere danni</label>}
                    {!sleep&&!weapon&&<p>Per più attacchi allo stesso bersaglio, indica tutti i tiri e somma i danni. Il Master conferma esiti, resistenze e altri effetti.</p>}
                    {sleep&&<div className="player-sleep-roll"><label htmlFor="player-sleep-total">Sonno · tira {sleepCount}d8 e inserisci la somma<input id="player-sleep-total" type="number" inputMode="numeric" min={sleepCount} max={sleepCount*8} step="1" required placeholder="Solo il totale dei dadi" value={sleepRoll} onChange={event=>{setSleepRoll(event.target.value);setTargets([])}}/></label>
                        <p className="library-help">Nessun modificatore da aggiungere. Non sono danni: il totale è la riserva di PF che puoi influenzare.</p>
                        {sleepRoll&&!validSleep&&<p role="status">Inserisci un numero intero tra {sleepCount} e {sleepCount*8}.</p>}
                        {validSleep&&<p className="ability-casting-summary" role="status">Riserva di Sonno: <strong>{sleepTotal} PF</strong></p>}
                    </div>}
                    {sleep ? <fieldset className="ability-targets" aria-label="Creature nell’area di Sonno"><legend>Creature nell’area di Sonno</legend>
                        <p className="library-help">Indica le creature che si trovano nell’area, compresi gli alleati. Il Master confermerà quali si addormentano in base al totale dei dadi.</p>
                        <div className="ability-target-list">{choices.targets.map(target=><div className="ability-target" key={target.id}><label className="ability-check"><input type="checkbox" checked={targets.some(selected=>selected.id===target.id)} onChange={event=>setTargets(current=>event.target.checked?[...current,{...target,roll:'',hit:false,damageRoll:'',damage:'0'}]:current.filter(selected=>selected.id!==target.id))}/>{target.id===choices.ownerId?`Tu (${target.name})`:target.name}</label></div>)}</div>
                    </fieldset> : renewed ? <AbilityTargets candidates={choices.targets.map(target=>({...target,name:target.name||'Partecipante'}))} ownerId={choices.ownerId} selectedIds={targets.map(target=>target.id)} maximum={targeting?.maximum??null} summary={targeting?.summary} label={mode==='none'?'Bersagli (facoltativi)':damageEnabled?'Bersagli del danno':'Bersagli'}
                        onChange={(id,checked)=>{const candidate=choices.targets.find(target=>target.id===id);if(!candidate)return;setTargets(current=>checked?[...current,{...candidate,roll:weapon?weaponRoll:'',hit:false,damageRoll:'',damage:'0'}]:current.filter(target=>target.id!==id))}}
                        renderSelected={candidate=>targetFields(targets.find(target=>target.id===candidate.id)!)}/> : <fieldset><legend>Bersagli{mode==='none'?' (facoltativi)':''}</legend>{targeting&&<p>{targeting.summary}{targeting.maximum!==null&&` Selezionati: ${targets.length}/${targeting.maximum}.`}</p>}{tooManyTargets&&<p role="alert">Troppi bersagli: correggi la selezione prima di procedere.</p>}{choices.targets.map(target=><label className="combat-request-check" key={target.id}><input type="checkbox" checked={targets.some(selected=>selected.id===target.id)} disabled={!targets.some(selected=>selected.id===target.id)&&targeting?.maximum!==null&&targeting?.maximum!==undefined&&targets.length>=targeting.maximum} onChange={event=>setTargets(current=>event.target.checked?[...current,{...target,roll:'',hit:false,damageRoll:'',damage:'0'}]:current.filter(selected=>selected.id!==target.id))}/>{target.name||'Partecipante'}</label>)}</fieldset>}
                    {!renewed&&targets.map(target=><fieldset key={target.id}><legend>{target.name||'Partecipante'}</legend>{targetFields(target)}</fieldset>)}
                    {(action.prolonged||optionId==='ritual')&&<p>Il Master potrà approvare solo dopo il completamento del lancio. Un lancio interrotto va rifiutato e non consuma risorse.</p>}
                    {sleep&&error&&<p role="alert">{error}</p>}
                    <button className="play-primary" disabled={sleep&&!validSleep||renewed&&!choices.canPropose||!option||tooManyTargets||weapon&&!validDie||!sleep&&!targets.length&&(damageEnabled||mode==='attack'||mode==='save')||option?.remaining!==null&&(option?.remaining??0)<(option?.cost??cost)}>{busy?'Invio in corso…':'Invia al Master'}</button>
                </>}
            </fieldset></form>
    const proposal=choices&&action?.resolution&&(renewed||!!action.resolution.healing||!!action.resolution.temporaryHitPoints)?<PlayerActionRolls key={action.key} game={game} choices={choices} action={action} formRef={form} onUpdate={onUpdate} onSubmitted={()=>{setPanel('summary');setTargets([]);setRetry(current=>current+1)}}/>:legacyProposal
    const remainingSeconds=Math.max(0,action?.remainingTurns??0)*6
    const remainingTime=[Math.floor(remainingSeconds/3600)?`${Math.floor(remainingSeconds/3600)} h`:'',Math.floor(remainingSeconds%3600/60)?`${Math.floor(remainingSeconds%3600/60)} min`:'',remainingSeconds%60?`${remainingSeconds%60} s`:''].filter(Boolean).join(' ')||'0 s'
    const summary=action&&<div className="player-cast-summary" aria-label={`Riepilogo: ${action.name}`}>
        {action.lastCast&&<div className="player-cast-heading"><span>{action.lastCast.optionLabel}</span><span className="combat-request-state" data-state={action.lastCast.status} role="status">{statusLabels[action.lastCast.status]}</span></div>}
        <WeaponEffectSummary effects={action.weaponEffects}/>
        <SpellEffectSummary effects={action.effects}/>
        {(action.resolution?.temporaryHitPoints||action.active)&&<dl className="player-cast-stats">
            {action.resolution?.temporaryHitPoints&&<div><dt>PF temporanei rimasti</dt><dd>{game.character.sheet.playerDetails?.temporaryHitPoints||'0'}</dd></div>}
            {action.active&&<div><dt>Durata residua</dt><dd className="player-cast-time">{action.duration==='Senza conteggio'?'Senza conteggio':remainingTime}</dd>{action.duration!=='Senza conteggio'&&<small>{action.remainingTurns} round</small>}</div>}
        </dl>}
        {action.lastCast?<details className="player-cast-details"><summary>Dettagli del lancio</summary>
            <time dateTime={action.lastCast.createdAt}>{new Date(action.lastCast.createdAt).toLocaleString('it-IT')}</time>
            {action.lastCast.sleepRoll!==undefined&&<p>Riserva di Sonno: <strong>{action.lastCast.sleepRoll} PF</strong> · totale dei d8.</p>}
            {action.lastCast.temporaryHitPoints&&<><p>Tiro originale: <strong>{action.lastCast.temporaryHitPoints.roll} sul d4 + {action.lastCast.temporaryHitPoints.bonus} = {action.lastCast.temporaryHitPoints.total} PF temporanei</strong></p>
            <p>{action.lastCast.temporaryHitPoints.keptPrevious?'PF precedenti mantenuti, con la durata originale.':'Nuovo beneficio selezionato.'}</p></>}
            {!action.lastCast.temporaryHitPoints&&action.lastCast.packets?.map((packet,index)=><p key={index}>Tiro {index+1}: {packet.die!==undefined&&<>d20 <strong>{packet.die}</strong> · </>}{packet.healingRoll!==undefined&&<>Dadi di guarigione: <strong>{packet.healingRoll}</strong></>}{packet.damage.map(damage=>`${damage.amount} ${damageNames[damage.type]}`).join(' + ')||(!packet.die&&packet.healingRoll===undefined?'Nessun dado richiesto.':'')}</p>)}
        </details>:<p>I dati del tiro originale non sono disponibili per questo effetto.</p>}
        {!action.windDirection&&action.additionalActionRequired&&<p className="player-cast-note">Hai già lanciato un incantesimo con un’azione in questo turno: il Master dovrà confermare un’altra azione valida.</p>}
        {action.windDirection&&choices?<WindDirectionForm key={`${action.windDirection.effectId}:${game.revision}`} choice={action.windDirection} candidates={choices.targets} ownerId={choices.ownerId} disabled={pending||!!stale||loading} onSubmit={async(selected,id)=>{const next=await playApi<Game>('/games/'+game.id+'/wind-direction','POST',{id,revision:choices.revision,effectId:action.windDirection!.effectId,selected});onUpdate(next);setRetry(current=>current+1)}}/>:<button type="button" className="sort-turns player-cast-recast" disabled={pending||!choices?.canPropose||!!action.error||!action.options.some(option=>option.remaining===null||option.remaining>=(option.cost??action.cost))} onClick={()=>{select(action.key);setPanel('cast')}}>Lancia di nuovo</button>}
    </div>
    const Heading=renewed?'h3':'h2'
    return <section className={`play-player-actions${renewed?' master-available-abilities':''}`} aria-labelledby="player-actions"><Heading id="player-actions" hidden={renewed&&inspectorMode==='all'}>{renewed?'Abilità e azioni disponibili':'Le tue azioni'}</Heading><p>Proponi un’azione nel tuo turno. Risorse ed effetti si applicano quando il Master approva.</p>
        {!renewed&&<button type="button" className="play-secondary" aria-expanded={open} onClick={()=>{if(!open)refreshActions();setOpen(current=>!current)}}>{open?'Chiudi scelta azione':'Scegli azione'}</button>}
        {open&&<>{loading&&<p role="status">Caricamento delle azioni…</p>}{stale&&<p role="status">La sessione è cambiata. Aggiorna le azioni prima di proporne una.</p>}{!loading&&<button type="button" className="play-secondary" disabled={busy} onClick={refreshActions}>Aggiorna azioni</button>}
            {pending&&<p role="status">Hai un’azione in attesa del Master.</p>}
            {renewed&&choices&&<div hidden={inspectorMode==='all'}>
                {!choices.canPropose&&<p role="status">{choices.blockedReason??'Puoi consultare le tue azioni. Potrai proporle quando il Master avvia il tuo turno.'}</p>}
                <input type="search" aria-label="Cerca abilità del personaggio" placeholder="Cerca un’abilità o un incantesimo…" value={search} onChange={event=>setSearch(event.target.value)}/>
                {!choices.actions.length&&<p>Nessuna azione disponibile: controlla attacchi, abilità e incantesimi salvati nella scheda.</p>}
                {!!choices.actions.length&&!filtered.length&&<p>Nessuna abilità corrisponde alla ricerca.</p>}
                <ParticipantAbilities entries={filtered.map(item=>({group:item.group,level:item.spellLevel,control:actionButton(item)}))} search={search} label={`Abilità di ${game.character.sheet.name}`} sheet={game.character.sheet}/>
            </div>}
            {!renewed&&proposal}
            {renewed&&choices&&<section className="abilities-tracker" aria-labelledby="player-abilities-heading">
                <div className="ability-section-heading"><h2 id="player-abilities-heading">{inspectorMode==='all'?'Tutte le abilità':'Abilità in uso e da configurare'}</h2></div>
                <div className="abilities-list">{choices.actions.filter(item=>inspectorMode==='all'||item.key===key||item.active||item.lastCast?.status==='pending').map(item=><AbilityCard key={item.entry?.id??item.name} id={`player-ability-${item.key}`} tabIndex={-1} data-owner-fixed="true" data-instantaneous={item.duration==='Istantanea'||undefined}>
                    {item.key===key&&<button type="button" className="delete-turn player-cast-close" aria-label={`Chiudi pannello ${item.name}`} onClick={()=>{selectedIdentity.current='';setKey('')}}>×</button>}
                    <div className="catalog-search ability-name"><input aria-label={`Nome abilità ${item.name}`} value={item.displayName||item.name} readOnly/></div>
                    <div className="ability-owner-controls"><AbilityMetadata duration={item.duration} owner={game.character.sheet.name} ownerLabel={item.spellLevel!==undefined?'Lanciatore':'Utilizzatore'}/><InfoButton label="Descrizione" entry={item.entry} name={item.name} description={item.description} fields={{duration:item.duration,remainingTurns:item.remainingTurns,active:item.active,owner:game.character.sheet.name}}/></div>
                    <div className="ability-use-controls">
                        {item.error&&!item.windDirection&&<p role="status">{item.error}</p>}
                        {item.key===key ? panel==='summary'?summary:proposal : <><p className={item.group==='Attacchi fisici'?'combat-request-description':'ability-casting-summary'}>{item.group==='Attacchi fisici' ? item.description||'Controlla bonus al tiro per colpire e danni nella scheda.' : item.active ? 'In esecuzione' : item.options.map(option=>option.label).join(' · ')||'Verifica le risorse nella scheda.'}</p><button type="button" className="sort-turns" disabled={busy} onClick={()=>choose(item.key)}>{item.active||item.lastCast?.status==='pending'?'Consulta':'Usa'}</button></>}
                    </div>
                </AbilityCard>)}</div>
                {inspectorMode==='participant'&&!key&&!choices.actions.some(item=>item.active)&&<p className="ability-help">Scegli un’abilità del personaggio per consultarne la card e proporne l’utilizzo.</p>}
            </section>}

        </>}{error&&(!sleep||panel==='summary')&&<p role="alert">{error}</p>}
        {!renewed&&<PlayerCombatHistory requests={game.combatRequests}/>}
    </section>
}

export function PlayerCombatHistory({requests}:{requests:CombatRequest[]}) {
    return <div className="combat-request-history" aria-live="polite">{requests.map(request=><article className="combat-request" key={request.id}><h3>{request.actionName}</h3><RequestDescription request={request}/></article>)}</div>
}
