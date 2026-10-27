import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type HTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import '../HelpTooltip.css'

/** Short, non-interactive help: hover, keyboard focus or tap; never changes form state. */
export function HelpTooltip({ label, children, triggerContent, className='', triggerElement='button' }: { label: string; children: ReactNode;triggerContent?:ReactNode;className?:string;triggerElement?:'button'|'span' }) {
    const id = useId()
    const trigger = useRef<HTMLElement>(null)
    const popup = useRef<HTMLDivElement>(null)
    const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const [open, setOpen] = useState(false)
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

    function cancelClose() { clearTimeout(closeTimer.current) }
    function show() { cancelClose(); setOpen(true) }
    function closeSoon() {
        cancelClose()
        // Allow the pointer to cross the small gap and read/select the tooltip text.
        closeTimer.current = setTimeout(() => {
            if (!trigger.current?.matches(':focus-visible')) setOpen(false)
        }, 120)
    }
    useEffect(() => () => clearTimeout(closeTimer.current), [])
    useLayoutEffect(() => {
        if (!open || !trigger.current || !popup.current) return
        const element = popup.current
        // The top layer keeps help visible inside scrollable panels and native dialogs.
        element.showPopover?.()
        const place = () => {
            if (!trigger.current) return
            const anchor = trigger.current.getBoundingClientRect(), bounds = element.getBoundingClientRect()
            if (!anchor.width || !anchor.height || anchor.bottom < 0 || anchor.top > window.innerHeight) { setOpen(false); return }
            const left = Math.max(12, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 12))
            const below = anchor.bottom + 8
            const top = below + bounds.height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - bounds.height - 8)
            setPosition(previous => previous?.top === top && previous.left === left ? previous : { top, left })
        }
        place()
        const observer = new ResizeObserver(place)
        observer.observe(element)
        observer.observe(trigger.current)
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        const dismissOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !trigger.current?.contains(event.target) && !element.contains(event.target)) setOpen(false)
        }
        const dismissEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault(); event.stopPropagation(); cancelClose(); setOpen(false)
        }
        document.addEventListener('pointerdown', dismissOutside)
        document.addEventListener('keydown', dismissEscape, true)
        return () => {
            observer.disconnect()
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', place, true)
            document.removeEventListener('pointerdown', dismissOutside)
            document.removeEventListener('keydown', dismissEscape, true)
            if (element.isConnected && element.matches(':popover-open')) element.hidePopover?.()
        }
    }, [open])

    const bindings:HTMLAttributes<HTMLElement> & {ref:(element:HTMLElement|null)=>void} = {
        ref:element=>{trigger.current=element},
        className:triggerElement==='span'?`disabled-button-hint ${className}`:`help-tooltip-trigger ${className}`,
        'aria-label':label, 'aria-describedby':open?id:undefined,
        onPointerEnter:event=>{if(event.pointerType!=='touch')show()}, onPointerLeave:closeSoon,
        onFocus:event=>{if(event.currentTarget.matches(':focus-visible'))show()},
        onBlur:()=>{cancelClose();setOpen(false)},
        onClick:()=>{cancelClose();setOpen(current=>!current)},
    }
    const content=triggerContent??<span aria-hidden="true">?</span>
    return <>
        {triggerElement==='span'?<span {...bindings} role="group" tabIndex={0}>{content}</span>:<button {...bindings} type="button" aria-expanded={open}>{content}</button>}
        {open && createPortal(<div ref={popup} id={id} role="tooltip" popover="manual" className="help-tooltip-popover"
            style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
            onPointerEnter={cancelClose} onPointerLeave={closeSoon}>{children}</div>, document.body)}
    </>
}
