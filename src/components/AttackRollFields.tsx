import { useId } from 'react'
import { damageNames, saveNames, type DamageType, type ResolutionPlan } from '../domain/dnd/CombatResolution'
import { signedBonus } from '../utils/CharacterSheets'
import { HelpTooltip } from './HelpTooltip'

const validRollNumber=(value:string)=>/^\d*$/.test(value)&&Number.isSafeInteger(Number(value))

const dieShapes:Record<number,string>={
    4:'M14 2 27 27H1Z M14 2v17L1 27m13-8 13 8',
    6:'m14 1 13 7v14l-13 7L1 22V8Z M1 8l13 7 13-7 M14 15v14',
    8:'M14 1 27 15 14 29 1 15Z M14 1 5 20h18Z M14 29 5 20m18 0-9 9',
    10:'M14 1 27 12l-4 12-9 5-9-5-4-12Z M14 1 8 18l6 11 6-11Z M1 12l7 6m12 0 7-6',
    12:'m14 1 11 7 2 14-13 7L1 22 2 8Z M14 6l8 6-3 10H9L6 12Z M14 1v5M2 8l4 4m19-4-3 4m5 10-8 0m-18 0h8m5 7v-7',
    20:'M14 1 27 8v14l-13 7L1 22V8Z M14 1 7 10l7 13 7-13Z M1 8l6 2-6 12 13 1 13-1-6-12 6-2 M14 23v6',
}
export function DieIcon({sides}:{sides:number}) {
    return <svg className="combat-die-icon" viewBox="0 0 28 30" role="img" aria-label={`d${sides}`}><path d={dieShapes[sides]??dieShapes[10]} fill="none" stroke="currentColor" strokeWidth="1.3"/><text x="14" y={sides===6?23:17} textAnchor="middle" fill="currentColor" fontSize={sides===100?6:8} fontWeight="700">{sides}</text></svg>
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

export function AttackRollFields({plan,value,onChange,weapon=true,compact=false}:{plan:ResolutionPlan;value:string;onChange:(value:string)=>void;weapon?:boolean;compact?:boolean}) {
    const id=useId(),valid=/^([1-9]|1[0-9]|20)$/.test(value)
    return <div className={`player-weapon-attack${compact?' player-attack-compact':''}`}>{!compact&&<p className="ability-casting-summary">Tiro per colpire con {weapon?'arma':'incantesimo'}</p>}<div className="player-weapon-roll">
        <div className="player-weapon-die"><div className="player-weapon-label"><label htmlFor={id}>{compact?<DieIcon sides={20}/>:'Tiro per colpire (inserisci solo il numero del dado)'}</label><HelpTooltip label="Aiuto sul tiro per colpire">{plan.maximumPackets===1?'Un attacco per utilizzo. ':'Un tiro per ogni colpo. '}{plan.damageBonuses?'Inserisci solo il d20 e i risultati dei dadi di danno: i bonus vengono aggiunti automaticamente.':'Inserisci il d20 e poi il totale dei danni tirati con i modificatori.'} Il Master verifica esito, difese e danni effettivi.</HelpTooltip></div><input id={id} aria-label="Tiro per colpire (inserisci solo il numero del dado)" type="text" inputMode="numeric" pattern="([1-9]|1[0-9]|20)" required value={value} placeholder="Es. 15" onChange={event=>{if(validRollNumber(event.target.value))onChange(Number(event.target.value)>20?'20':event.target.value)}}/></div>
        <div><div className="player-weapon-label"><span>{compact?'Mod.':'Modificatore totale'}</span>{compact&&<HelpTooltip label="Aiuto sul modificatore">È il bonus per colpire letto dalla scheda {weapon?'per l’arma selezionata':'per gli attacchi con incantesimo'}. Viene aggiunto automaticamente al d20 per ottenere il totale: inserisci soltanto il numero del dado. Se il bonus manca o è errato, correggilo nella scheda.</HelpTooltip>}</div><output aria-label="Modificatore al tiro per colpire dalla scheda">{signedBonus(plan.attackBonus)||'Da verificare'}</output></div>
    </div>{valid&&(compact?<div className="player-attack-total" role="status" aria-label="Totale tiro per colpire"><span>Totale: </span><strong>{plan.attackBonus===undefined?'da verificare':Number(value)+plan.attackBonus}</strong></div>:<p className="ability-casting-summary" role="status" aria-label="Totale tiro per colpire"><span>Totale: </span><strong>{plan.attackBonus===undefined?'da verificare':Number(value)+plan.attackBonus}</strong></p>)}</div>
}

export function DamageRollFields({plan,values,onChange,compact=false}:{plan:ResolutionPlan;values:Partial<Record<DamageType,string>>;onChange:(type:DamageType,value:string)=>void;compact?:boolean}) {
    return plan.damageTypes.map(type=><label key={type} className={compact?'player-damage-compact':undefined}><span className="player-damage-caption">Danni tirati{plan.damageTypes.length>1?` · ${damageNames[type]}`:''}</span><span className="library-help">{damageNames[type]}{(plan.damageDice||plan.damageHint)&&<> · {compact?<DiceResult notation={plan.damageDice?plan.damageDice[type]||'dadi da verificare':plan.damageHint}/>:plan.damageDice?plan.damageDice[type]||'dadi da verificare':plan.damageHint}{plan.damageDice&&<> · solo dadi{plan.damageBonuses?.[type]?` (${signedBonus(plan.damageBonuses[type])} automatico)`:''}</>}</>}</span><input aria-label={plan.damageTypes.length>1?`Danni tirati · ${damageNames[type]}`:'Danni tirati'} type="text" inputMode="numeric" pattern="[0-9]+" required maxLength={16} placeholder="Totale, es. 7" value={values[type]??''} onChange={event=>{if(validRollNumber(event.target.value))onChange(type,event.target.value)}}/></label>)
}
