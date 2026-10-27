import {useId,type ComponentProps} from 'react'
import {HelpTooltip} from './HelpTooltip'

/** Keep native disabled behavior; expose the reason on hover, focus and tap. */
export function ActionButton({disabledReason,disabled,children,...props}:ComponentProps<'button'> & {disabledReason?:string}) {
    const id=useId()
    if(!disabled)return <button {...props}>{children}</button>
    return <HelpTooltip label="Motivo del blocco" triggerElement="span" triggerContent={<>
        <button {...props} disabled aria-describedby={[props['aria-describedby'],id].filter(Boolean).join(' ')}>{children}</button>
        <span id={id} className="disabled-button-reason">{disabledReason}</span>
    </>}>{disabledReason}</HelpTooltip>
}
