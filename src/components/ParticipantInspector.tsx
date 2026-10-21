import type { ComponentProps, ReactNode } from 'react'
import { integerValue, type CharacterSheet } from '../utils/CharacterSheets'

export type InspectorMode = 'participant' | 'all'

export function InspectorNavigation({ name = 'Partecipante', mode, onChange }: {name?:string; mode:InspectorMode; onChange:(mode:InspectorMode)=>void}) {
    return <div className="master-inspector-navigation" aria-label="Contenuto dei dettagli">
        <button type="button" aria-pressed={mode==='participant'} onClick={()=>onChange('participant')}>{name}</button>
        <button type="button" aria-pressed={mode==='all'} onClick={()=>onChange('all')}>Tutte le abilità</button>
    </div>
}

export function ParticipantAbilities({ entries, search, label, sheet }: {entries:{group:string;level?:number;control:ReactNode}[];search:string;label:string;sheet:CharacterSheet|undefined}) {
    const details=sheet?.playerDetails ?? {}
    return <div className="master-participant-abilities" aria-label={label}>
        {['Incantesimi','Attacchi fisici','Abilità attivabili'].map(group=>{
            const items=entries.filter(entry=>entry.group===group)
            return items.length>0&&<section className="master-ability-group" aria-label={group} key={group}>
                <h4>{group}</h4>
                {group==='Incantesimi' ? [...new Set(items.map(item=>item.level!))].sort((a,b)=>a-b).map(level=>{
                    const slots=Math.max(0,(integerValue(details[`slots.${level}.total`]) ?? 0)-(integerValue(details[`slots.${level}.used`]) ?? 0))
                    const pact=integerValue(details['rules2014.pact.level'])===level ? Math.max(0,(integerValue(details['rules2014.pact.total']) ?? 0)-(integerValue(details['rules2014.used.pact']) ?? 0)) : 0
                    return <details className="master-spell-level" key={`${level}:${!!search.trim()}`} open>
                    <summary>{level===0?'Trucchetti':<>{level}° livello <span>({slots+pact} usi rimasti)</span></>}</summary>
                    <div className="participant-abilities">{items.filter(item=>item.level===level).map(item=>item.control)}</div>
                </details>}) : <div className="participant-abilities">{items.map(item=>item.control)}</div>}
            </section>
        })}
    </div>
}

export function ParticipantInspector({ className = '', ...props }: ComponentProps<'aside'>) {
    return <aside {...props} className={`master-inspector ${className}`}/>
}

export function ParticipantStats({ hitPoints, maximum, armorClass, initiative }: {hitPoints: string; maximum?: string; armorClass: string; initiative: string}) {
    return <dl className="master-detail-stats" aria-label="Statistiche del partecipante">
        <div className="master-stat-hp"><dt><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>PF</dt><dd><strong>{hitPoints || '—'}</strong><span>/ {maximum || '—'}</span></dd></div>
        <div className="master-stat-ac"><dt><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 3v6c0 7-8 11-8 11S4 18 4 11V5Z"/></svg>CA</dt><dd><strong>{armorClass || '—'}</strong></dd></div>
        <div className="master-stat-initiative"><dt><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-10 12h9l-1 8 10-12h-9Z"/></svg>Iniziativa</dt><dd><strong>{initiative || '—'}</strong></dd></div>
    </dl>
}
