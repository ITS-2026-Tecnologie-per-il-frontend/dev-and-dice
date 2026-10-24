import { memo, useDeferredValue, useMemo } from 'react'
import { prepareTurnAbilityChoices, type TurnAbilityChoicesProps } from './turnAbilityContent'

export const TurnAbilityChoices=memo(function TurnAbilityChoices(props:TurnAbilityChoicesProps) {
    const deferred=useDeferredValue(props)
    // Explicit searches keep their immediate expand/filter behavior.
    const displayed=deferred.search===props.search?deferred:props
    const content=useMemo(()=>prepareTurnAbilityChoices(displayed),[displayed])
    const updating=displayed!==props
    return <div style={{display:'contents'}} aria-busy={updating} inert={updating||undefined}>{content}</div>
})

