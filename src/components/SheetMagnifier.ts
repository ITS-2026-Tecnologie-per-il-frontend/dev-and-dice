import { useEffect, type RefObject } from 'react'

const zoom = 2
const clickDuration = 300

/** A read-only snapshot per gesture; pointer movement never rerenders the sheet. */
export function useSheetMagnifier(viewportRef: RefObject<HTMLDivElement | null>, enabled: boolean, pageKey: string) {
    useEffect(() => {
        const viewport = viewportRef.current
        if (!enabled || !viewport) return
        let lens: HTMLDivElement | undefined, content: HTMLElement | undefined, source: HTMLElement | undefined
        let point = { x: 0, y: 0 }, frame = 0, pressedAt = 0, pinned = false

        function close() {
            cancelAnimationFrame(frame); frame = 0
            lens?.remove(); lens = undefined; content = undefined; source = undefined
            pressedAt = 0; pinned = false
        }
        function place() {
            frame = 0
            if (!lens || !content || !source) return
            const bounds = source.getBoundingClientRect(), visible = viewport!.getBoundingClientRect()
            if (!source.isConnected) { close(); return }
            if (point.x < Math.max(bounds.left, visible.left) || point.x > Math.min(bounds.right, visible.right)
                || point.y < Math.max(bounds.top, visible.top, 0) || point.y > Math.min(bounds.bottom, visible.bottom, window.innerHeight)) { if (!pinned) close(); return }
            const width = Math.min(480, window.innerWidth - 24), height = Math.min(360, window.innerHeight - 24)
            const left = point.x + 20 + width <= window.innerWidth - 12 ? point.x + 20 : point.x - width - 20
            const top = point.y + 20 + height <= window.innerHeight - 12 ? point.y + 20 : point.y - height - 20
            lens.style.width = `${width}px`; lens.style.height = `${height}px`
            lens.style.left = `${Math.max(12, Math.min(left, window.innerWidth - width - 12))}px`
            lens.style.top = `${Math.max(12, Math.min(top, window.innerHeight - height - 12))}px`
            const scaleX = bounds.width / source.offsetWidth, scaleY = bounds.height / source.offsetHeight
            content.style.transform = `translate(${width / 2 - (point.x - bounds.left) * zoom}px, ${height / 2 - (point.y - bounds.top) * zoom}px) scale(${scaleX * zoom}, ${scaleY * zoom})`
        }
        function schedule() { if (lens && !frame) frame = requestAnimationFrame(place) }
        function start(event: PointerEvent) {
            if (event.button !== 2 || event.pointerType !== 'mouse') return
            const paper = viewport!.querySelector<HTMLElement>(':scope > [role="tabpanel"]')
            if (!paper || !(event.target instanceof Node) || !paper.contains(event.target)) return
            event.preventDefault()
            if (lens && pinned) { close(); return }
            close(); pressedAt = event.timeStamp
            source = paper; point = { x: event.clientX, y: event.clientY }
            content = paper.cloneNode(true) as HTMLElement
            // Live form properties and scroll positions are not all reflected in HTML attributes.
            const originals = paper.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
            content.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((copy, index) => {
                if (!(copy instanceof HTMLInputElement && copy.type === 'file')) copy.value = originals[index].value
                if (copy instanceof HTMLInputElement && originals[index] instanceof HTMLInputElement) copy.checked = originals[index].checked
            })
            for (const node of [content, ...content.querySelectorAll<HTMLElement>('*')]) {
                for (const name of ['id', 'name', 'for', 'autofocus', 'aria-labelledby', 'aria-describedby', 'aria-controls']) node.removeAttribute(name)
            }
            const style = getComputedStyle(paper)
            for (const property of style) if (property.startsWith('--')) content.style.setProperty(property, style.getPropertyValue(property))
            Object.assign(content.style, { position: 'absolute', inset: '0 auto auto 0', width: `${paper.offsetWidth}px`, height: `${paper.offsetHeight}px`, minWidth: '0', maxWidth: 'none', margin: '0', transformOrigin: 'top left', font: style.font, color: style.color, pointerEvents: 'none' })
            content.classList.add('sheet-magnifier-content')
            lens = document.createElement('div')
            lens.className = 'sheet-magnifier'; lens.setAttribute('popover', 'manual'); lens.setAttribute('aria-hidden', 'true'); lens.inert = true
            lens.append(content)
            // A popover stays above native character dialogs without intercepting the pointer.
            ;(paper.closest('dialog') ?? document.body).append(lens)
            lens.showPopover?.()
            const originalNodes = [paper, ...paper.querySelectorAll<HTMLElement>('*')]
            const copies = [content, ...content.querySelectorAll<HTMLElement>('*')]
            originalNodes.forEach((node, index) => { if (node.scrollTop || node.scrollLeft) { copies[index].scrollTop = node.scrollTop; copies[index].scrollLeft = node.scrollLeft } })
            place()
        }
        function move(event: PointerEvent) {
            if (!lens) return
            if (!pinned && !(event.buttons & 2)) { close(); return }
            point = { x: event.clientX, y: event.clientY }; schedule()
        }
        function release(event: PointerEvent) {
            if (!lens || pinned || event.button !== 2) return
            if (event.timeStamp - pressedAt < clickDuration) pinned = true
            else close()
        }
        function contextMenu(event: MouseEvent) {
            const paper = viewport!.querySelector(':scope > [role="tabpanel"]')
            if (event.target instanceof Node && paper?.contains(event.target)) event.preventDefault()
        }
        function key(event: KeyboardEvent) { if (event.key === 'Escape' && lens) { event.preventDefault(); event.stopPropagation(); close() } }
        function visibility() { if (document.hidden) close() }
        viewport.addEventListener('pointerdown', start)
        viewport.addEventListener('contextmenu', contextMenu)
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', release)
        window.addEventListener('pointercancel', close)
        window.addEventListener('blur', close)
        window.addEventListener('keydown', key, true)
        window.addEventListener('scroll', schedule, true)
        window.addEventListener('resize', close)
        document.addEventListener('visibilitychange', visibility)
        return () => {
            close()
            viewport.removeEventListener('pointerdown', start)
            viewport.removeEventListener('contextmenu', contextMenu)
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', release)
            window.removeEventListener('pointercancel', close)
            window.removeEventListener('blur', close)
            window.removeEventListener('keydown', key, true)
            window.removeEventListener('scroll', schedule, true)
            window.removeEventListener('resize', close)
            document.removeEventListener('visibilitychange', visibility)
        }
    }, [viewportRef, enabled, pageKey])
}
