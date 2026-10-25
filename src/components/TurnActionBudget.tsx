import {turnActionNames,type turnActionSlots} from '../domain/dnd/TurnEconomy'

export function TurnActionBudget({slots,inCombat}:{slots:ReturnType<typeof turnActionSlots>;inCombat:boolean}) {
    return <ul className="turn-action-budget" aria-label="Azioni del turno">{slots.map(slot=>{
        const label=turnActionNames[slot.unit],state=slot.used?'Consumata':'Disponibile'
        const description=`${label}: ${state.toLocaleLowerCase()}.${slot.source?' Concessa da '+slot.source+'.':''}${slot.restriction?' '+slot.restriction:''}${inCombat?slot.temporary?' Scade all’inizio del prossimo turno del personaggio.':' Si recupera all’inizio del prossimo turno del personaggio.':' Fuori combattimento.'}`
        return <li key={`${slot.unit}:${slot.index}`} data-used={slot.used} data-unit={slot.unit} aria-label={description} title={description}><span>{label}{slot.index>0?' +':''}</span></li>
    })}</ul>
}
