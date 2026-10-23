import { useId } from 'react'
import { damageNames, damageBonusText, saveNames, type DamageType, type ResolutionPlan } from '../domain/dnd/CombatResolution'
import { signedBonus } from '../utils/CharacterSheets'
import { HelpTooltip } from './HelpTooltip'

const validRollNumber=(value:string)=>/^\d*$/.test(value)&&Number.isSafeInteger(Number(value))

const dieShapes:Record<number,string>={
    4:'M14 2 27 27H1Z',
    6:'M5 2h18a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z',
    8:'M14 1 27 21 14 29 1 21Z',
    10:'M14 1 27 16 14 29 1 16Z',
    12:'M14 1 23 5 27 14 24 23 18 28H10L4 23 1 14 5 5Z',
    20:'M14 1 27 8V22L14 29 1 22V8Z',
}
const dieEdges:Record<number,string>={
    4:'M14 2 20 22 27 27 M20 22 1 27',
    8:'M14 1 7 21H21Z M1 21H27',
    10:'M14 1 7 14 14 19 21 14Z M1 16 7 14 M21 14 27 16 M14 19V29',
    12:'M14 6 23 12 19 23H9L5 12Z M14 1V6 M23 5V12 M27 14 23 12 M24 23H19 M18 28 14 23 M10 28 14 23 M4 23H9 M1 14 5 12 M5 5V12',
    20:'M14 1 6 9H22Z M1 8 6 9 1 22 14 23 27 22 22 9 27 8 M6 9 14 23 22 9 M14 23V29',
}
export function DieIcon({sides}:{sides:number}) {
    return <svg className="combat-die-icon" viewBox="0 0 28 30" role="img" aria-label={`d${sides}`}>
        <path d={dieShapes[sides]??dieShapes[10]} fill="currentColor" stroke="currentColor" strokeWidth=".8" strokeLinejoin="round"/>
        {sides===6 ? [8,15,22].flatMap(cy=>[8,20].map(cx=><circle key={`${cx}:${cy}`} cx={cx} cy={cy} r="2.8" fill="var(--bg, white)"/>)) : <>
            <path d={dieEdges[sides]??dieEdges[10]} fill="none" stroke="var(--bg, white)" strokeWidth=".9" strokeLinejoin="round"/>
            <text x={sides===4?12:14} y={sides===10||sides===100?12:17} textAnchor="middle" fill="var(--bg, white)" fontSize={sides===100?6:sides===10?8:9} fontWeight="700">{sides}</text>
        </>}
    </svg>
}
export function DiceResult({notation,value}:{notation:string;value?:number}) {
    // ponytail: render simple dice expressions; richer notation needs structured
    // roll metadata. Never infer a die count from the submitted total.
    const terms=notation.match(/\d+d\d+/gi)
    const known=/^\s*\d+d\d+(?:\s*[+−×*-]\s*\d+(?:d\d+)?)*\s*$/i.test(notation)&&terms?.every(term=>{const [n,sides]=term.toLowerCase().split('d').map(Number);return Number.isSafeInteger(n)&&n>0&&(Object.hasOwn(dieShapes,sides)||sides===100)})
    if(!known)return value===undefined?<span>{notation}</span>:<span>{value} <small>(dadi da verificare)</small></span>
    return <span className="combat-dice-result">{notation.split(/(\d+d\d+)/gi).map((term,i)=>/^\d+d\d+$/i.test(term)?<span className="combat-dice-term" key={i}>{Number(term.split(/d/i)[0])}<DieIcon sides={Number(term.split(/d/i)[1])}/></span>:term)}{value!==undefined&&<> = {value}</>}</span>
}

export function SpellSaveNotice({plan}:{plan:ResolutionPlan}) {
    const save=plan.deferredSave??plan.save
    if(!save)return null
    const label=`Tiro salvezza su ${saveNames[save.ability]} per il bersaglio`
    return <div className="spell-save-notice"><span>{label}</span><HelpTooltip label={`Aiuto: ${label}`}><div className="spell-save-help">
        {plan.deferredSave?<><p>Al lancio non devi inserire dadi: questo incantesimo non richiede un tiro per colpire e non infligge danni.</p><p>All’inizio del proprio turno, ogni creatura ancora nella linea deve tirare <strong>1d20 su {saveNames[save.ability]}</strong>. Si aggiunge il modificatore del tiro salvezza della creatura e si confronta il totale con la CD dell’incantatore.</p><p>Se fallisce, viene spinta di {plan.deferredSave.pushFt*0.3} m lungo la linea, lontano dall’incantatore. Il Master verifica chi si trova nell’area e gestisce questi tiri quando si verificano.</p></>:<p>Il tiro appartiene al bersaglio: lo inserirà il suo giocatore dopo l’invio dell’azione, oppure il Master per una creatura.</p>}
    </div></HelpTooltip></div>
}

export function HealingRollFields({plan,value,onChange}:{plan:ResolutionPlan;value:string;onChange:(value:string)=>void}) {
    const healing=plan.healing!,id=useId(),valid=value!==''&&Number(value)>=healing.count&&Number(value)<=healing.count*healing.sides
    return <div className="player-healing-roll">
        <div className="player-healing-heading"><label htmlFor={id}>Guarigione tirata</label><DiceResult notation={healing.dice}/></div>
        <input id={id} aria-label="Guarigione tirata" type="text" inputMode="numeric" pattern="[0-9]+" required placeholder="Solo dadi" value={value} onChange={event=>{if(validRollNumber(event.target.value))onChange(event.target.value)}}/>
        <div><div className="player-weapon-label"><span>Mod.</span><HelpTooltip label="Aiuto sul modificatore di guarigione">Inserisci solo la somma dei dadi. Il modificatore {healing.ability?`di ${saveNames[healing.ability]}`:'da incantatore'} viene aggiunto automaticamente una sola volta, anche con slot superiori.</HelpTooltip></div><output aria-label="Modificatore di guarigione">{signedBonus(healing.modifier)||'Da verificare'}</output></div>
        <div role="status" aria-label="Totale guarigione"><span>Totale</span><strong>{valid&&healing.modifier!==undefined?Math.max(0,Number(value)+healing.modifier):'—'}</strong></div>
        {value&&!valid&&<small>Inserisci la somma dei dadi, da {healing.count} a {healing.count*healing.sides}.</small>}
    </div>
}

export function TemporaryHitPointRollFields({plan,value,keep,onChange,onKeep}:{plan:ResolutionPlan;value:string;keep:''|'new'|'current';onChange:(value:string)=>void;onKeep:(value:''|'new'|'current')=>void}) {
    const benefit=plan.temporaryHitPoints!,id=useId(),valid=/^[1-4]$/.test(value)
    return <>
        <div className="player-healing-roll">
            <div className="player-healing-heading"><label htmlFor={id}>PF temporanei tirati</label><DiceResult notation={benefit.dice}/></div>
            <input id={id} aria-label="PF temporanei tirati" type="text" inputMode="numeric" pattern="[1-4]" required placeholder="Solo d4" value={value} onChange={event=>{if(validRollNumber(event.target.value))onChange(event.target.value)}}/>
            <div><span>Bonus</span><output aria-label="Bonus ai PF temporanei">+{benefit.bonus}</output></div>
            <div role="status" aria-label="Totale PF temporanei"><span>Totale</span><strong>{valid?Number(value)+benefit.bonus:'—'}</strong></div>
        </div>
        <p className="library-help">Si applica a te stesso. Inserisci solo il d4: il bonus viene aggiunto automaticamente.</p>
        {value&&!valid&&<p role="status">Inserisci il risultato del d4, da 1 a 4.</p>}
        {benefit.current>0&&<label>PF temporanei da mantenere<select aria-label="PF temporanei da mantenere" required value={keep} onChange={event=>onKeep(event.target.value as typeof keep)}><option value="">Scegli quali mantenere…</option><option value="new">Prendi i nuovi{valid?` (${Number(value)+benefit.bonus})`:''}</option><option value="current">Mantieni gli attuali ({benefit.current})</option></select><small>I PF temporanei non si sommano.</small></label>}
    </>
}

export function AttackRollFields({plan,value,onChange,weapon=true,compact=false,showTotal=true}:{plan:ResolutionPlan;value:string;onChange:(value:string)=>void;weapon?:boolean;compact?:boolean;showTotal?:boolean}) {
    const id=useId(),valid=/^([1-9]|1[0-9]|20)$/.test(value)
    const sources=plan.attackBonusSources?.length&&plan.attackBonusSources.reduce((sum,source)=>sum+source.amount,0)===plan.attackBonus?plan.attackBonusSources:plan.attackBonus===undefined?[]:[{name:'Modificatore indicato nella scheda',amount:plan.attackBonus}]
    return <div className={`player-weapon-attack${compact?' player-attack-compact':''}`}>{!compact&&<p className="ability-casting-summary">Tiro per colpire con {weapon?'arma':'incantesimo'}</p>}<div className="player-weapon-roll">
        <div className="player-weapon-die"><div className="player-weapon-label"><label htmlFor={id}>{compact?<DieIcon sides={20}/>:'Tiro per colpire (inserisci solo il numero del dado)'}</label><HelpTooltip label="Aiuto sul tiro per colpire">{plan.maximumPackets===1?'Un attacco per utilizzo. ':'Un tiro per ogni colpo. '}{plan.damageBonuses?'Inserisci solo il d20 e i risultati dei dadi di danno: i bonus vengono aggiunti automaticamente.':'Inserisci il d20 e poi il totale dei danni tirati con i modificatori.'} Il Master verifica esito, difese e danni effettivi.</HelpTooltip></div><input id={id} aria-label="Tiro per colpire (inserisci solo il numero del dado)" type="text" inputMode="numeric" pattern="([1-9]|1[0-9]|20)" required value={value} placeholder="Es. 15" onChange={event=>{if(validRollNumber(event.target.value))onChange(Number(event.target.value)>20?'20':event.target.value)}}/></div>
        <div><div className="player-weapon-label"><span>{compact?'Mod.':'Modificatore totale'}</span>{compact&&<HelpTooltip label="Aiuto sul modificatore">È il bonus per colpire letto dalla scheda {weapon?'per l’arma selezionata':'per gli attacchi con incantesimo'}. Viene aggiunto automaticamente al d20 per ottenere il totale: inserisci soltanto il numero del dado. Se il bonus manca o è errato, correggilo nella scheda.</HelpTooltip>}</div><HelpTooltip label="Modificatore al tiro per colpire dalla scheda" className="attack-modifier-trigger" triggerContent={signedBonus(plan.attackBonus)||'Da verificare'}><div className="attack-modifier-help"><strong>Composizione del modificatore</strong>{sources.length?<><dl>{sources.map((source,index)=><div key={index}><dt>{source.name}</dt><dd>{signedBonus(source.amount)||'0'}</dd></div>)}</dl><p><span>Totale</span><strong>{signedBonus(plan.attackBonus)}</strong></p></>:<p>Completa il bonus per colpire nella scheda.</p>}<small>Si aggiunge al d20. Gli eventuali dadi bonus, come quello di Benedizione, si aggiungono separatamente al tiro.</small></div></HelpTooltip></div>
    </div>{showTotal&&valid&&(compact?<div className="player-attack-total" role="status" aria-label="Totale tiro per colpire"><span>Totale: </span><strong>{plan.attackBonus===undefined?'da verificare':Number(value)+plan.attackBonus}</strong></div>:<p className="ability-casting-summary" role="status" aria-label="Totale tiro per colpire"><span>Totale: </span><strong>{plan.attackBonus===undefined?'da verificare':Number(value)+plan.attackBonus}</strong></p>)}</div>
}

export function DamageRollFields({plan,values,onChange,compact=false,label='Danni tirati'}:{plan:ResolutionPlan;values:Partial<Record<DamageType,string>>;onChange:(type:DamageType,value:string)=>void;compact?:boolean;label?:string}) {
    return plan.damageTypes.map(type=>{
        const enhanced=!!plan.weaponEnhancements?.length
        const value=values[type],bonusText=damageBonusText(plan,type),total=Number(value)+(plan.damageBonuses?.[type]??0)
        return <label key={type} className={compact?`player-damage-compact${enhanced?' player-damage-enhanced':''}`:undefined}>
            <span className="player-damage-caption">{label}{plan.damageTypes.length>1?` · ${damageNames[type]}`:''}</span>
            <span className="library-help">{damageNames[type]}{plan.magical&&plan.weaponEnhancements?.length?' · arma magica':''}{(plan.damageDice||plan.damageHint)&&<> · {compact?<DiceResult notation={plan.damageDice?plan.damageDice[type]||'dadi da verificare':plan.damageHint}/>:plan.damageDice?plan.damageDice[type]||'dadi da verificare':plan.damageHint}{plan.damageDice&&<> · solo dadi{bonusText&&(!enhanced||value===undefined||value==='')&&(plan.damageBonusSources?<> · bonus automatici: {bonusText}</>:plan.damageBonuses?.[type]?` (${signedBonus(plan.damageBonuses[type])} automatico)`:null)}</>}</>}</span>
            <input aria-label={plan.damageTypes.length>1?`${label} · ${damageNames[type]}`:label} type="text" inputMode="numeric" pattern="[0-9]+" required maxLength={16} placeholder={plan.damageDice?'Solo dadi':'Totale, es. 7'} value={value??''} onChange={event=>{if(validRollNumber(event.target.value))onChange(type,event.target.value)}}/>
            {enhanced&&value!==undefined&&value!==''&&<span className="library-help weapon-damage-breakdown">{value} {bonusText} = <strong>{Number.isSafeInteger(total)?total:'da verificare'}</strong> · prima di critico e difese</span>}
        </label>
    })
}
