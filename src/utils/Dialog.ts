import { useRef, type PointerEvent } from 'react'

export function useDialogDismiss() {
    const outsidePointer = useRef<number | null>(null)

    function isOutside(event: PointerEvent<HTMLDialogElement>) {
        if (event.target !== event.currentTarget) return false
        const bounds = event.currentTarget.getBoundingClientRect()
        return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
    }

    return {
        onPointerDown: (event: PointerEvent<HTMLDialogElement>) => {
            outsidePointer.current = event.isPrimary && event.button === 0 && isOutside(event) ? event.pointerId : null
        },
        onPointerUp: (event: PointerEvent<HTMLDialogElement>) => {
            const dismiss = outsidePointer.current === event.pointerId && isOutside(event)
            outsidePointer.current = null
            if (dismiss) event.currentTarget.close()
        },
        onPointerCancel: () => { outsidePointer.current = null },
    }
}
