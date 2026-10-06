import { useRef, useState, type PointerEvent } from 'react'

type Props = {
    label: string
    side: 'left' | 'right'
    minimum: number
    otherMinimum: number
    onResize: (size: string) => void
}

export function ColumnSeparator({ label, side, minimum, otherMinimum, onResize }: Props) {
    const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null)
    const [dragging, setDragging] = useState(false)
    const [percentage, setPercentage] = useState(50)

    function panelWidth(element: HTMLElement) {
        const panel = side === 'left' ? element.previousElementSibling : element.nextElementSibling
        return panel?.getBoundingClientRect().width ?? minimum
    }

    function resize(element: HTMLElement, width: number) {
        const parent = element.parentElement!
        const available = parent.clientWidth - parseFloat(getComputedStyle(parent).paddingLeft) - parseFloat(getComputedStyle(parent).paddingRight) - element.offsetWidth
        const lower = Math.min(minimum, available / 2)
        const upper = Math.max(lower, available - otherMinimum)
        const clamped = Math.min(upper, Math.max(lower, width))
        const fraction = clamped / available
        setPercentage(Math.round((side === 'left' ? fraction : 1 - fraction) * 100))
        onResize(`calc(${fraction * 100}% - ${fraction * element.offsetWidth}px)`)
    }

    function finish(event: PointerEvent<HTMLDivElement>) {
        if (drag.current?.pointerId !== event.pointerId) return
        drag.current = null
        setDragging(false)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }

    return <div
        className={`column-separator${dragging ? ' is-dragging' : ''}`}
        role="separator"
        aria-label={label}
        aria-orientation="vertical"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        title={`${label}: trascina o usa le frecce sinistra e destra`}
        onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return
            event.preventDefault()
            event.currentTarget.focus()
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { pointerId: event.pointerId, x: event.clientX, width: panelWidth(event.currentTarget) }
            setDragging(true)
        }}
        onPointerMove={(event) => {
            if (drag.current?.pointerId !== event.pointerId) return
            const delta = (event.clientX - drag.current.x) * (side === 'left' ? 1 : -1)
            resize(event.currentTarget, drag.current.width + delta)
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={() => { drag.current = null; setDragging(false) }}
        onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const delta = (event.key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 1 : -1) * (event.shiftKey ? 50 : 10)
            resize(event.currentTarget, panelWidth(event.currentTarget) + delta)
        }}
    />
}
