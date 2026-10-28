import {useId,type ComponentProps} from 'react'
import {HelpTooltip} from './HelpTooltip'

/** Keep native disabled behavior; expose the reason on hover, focus and tap. */
export function ActionButton({unavailableReason,disabledReason,disabled,children,...props}:ComponentProps<'button'> & {disabledReason?:string;unavailableReason?:string}) {
    const id=useId()
    if(!disabled&&!unavailableReason)return <button {...props}>{children}</button>
    return <HelpTooltip label="Motivo del blocco" triggerElement="span" triggerContent={<>
        <button {...props} disabled={disabled} aria-describedby={[props['aria-describedby'],id].filter(Boolean).join(' ')}>{children}</button>
        <span id={id} className="disabled-button-reason">{unavailableReason??disabledReason}</span>
    </>}>{unavailableReason??disabledReason}</HelpTooltip>
}
