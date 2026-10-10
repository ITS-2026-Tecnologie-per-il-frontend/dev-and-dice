const printCss = `
@page { size: A4 portrait; margin: 8mm; }
:root { color-scheme: light; --text: #303236; --text-h: #202226; --bg: white; --border: #c4c4c4; }
html, body { margin: 0; padding: 0; background: white; color: #202226; }
* { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.sheet-print-page { position: relative; width: 194mm; height: 280mm; break-before: page; overflow: hidden; }
.sheet-print-page:first-child { break-before: auto; }
.sheet-print-page > .player-paper { position: absolute; margin: 0; box-shadow: none; transform-origin: top left; }
.player-paper .player-portrait-controls { display: contents; }
.sheet-print-inventory, .sheet-print-notes { width: 194mm; box-sizing: border-box; font: 10pt/1.4 system-ui, sans-serif; }
.sheet-print-inventory { break-before: page; }
.sheet-print-inventory h1, .sheet-print-notes h1 { font-size: 18pt; margin: 0 0 4mm; }
.sheet-print-inventory table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 5mm; }
.sheet-print-inventory th, .sheet-print-inventory td { padding: 2.5mm 2mm; border-bottom: 1px solid #aaa; text-align: left; overflow-wrap: anywhere; vertical-align: top; }
.sheet-print-inventory th:first-child { width: 58%; }
.sheet-print-inventory thead { display: table-header-group; }
.sheet-print-inventory tr { break-inside: avoid; }
.sheet-print-notes { break-before: page; }
.sheet-print-notes h2 { font-size: 12pt; margin: 5mm 0 2mm; }
.sheet-print-notes p { white-space: pre-wrap; overflow-wrap: anywhere; }
.barbarian-field[data-print-checked="true"] { background-color: #292929 !important; border-radius: 50%; }
`

// These are layout and drawing properties, not native input chrome or event handlers.
const valueStyles = 'display position top right bottom left width height min-width min-height max-width max-height box-sizing margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top border-right border-bottom border-left border-radius outline outline-offset background color opacity font-family font-size font-weight font-style font-variant letter-spacing line-height text-align text-transform vertical-align flex flex-shrink flex-grow align-self justify-self grid-row grid-column order transform transform-origin box-shadow'.split(' ')
const layoutStyles = 'width height min-width min-height max-width max-height box-sizing flex-basis grid-template-columns grid-template-rows font-family font-size font-weight font-style font-variant line-height letter-spacing'.split(' ')

/** A separate document owns the print layout; the live sheet and its page state stay untouched. */
export async function prepareCharacterPrint(source: HTMLElement, name: string): Promise<HTMLIFrameElement> {
    if (!source.querySelector('.player-paper, .barbarian-page')) throw new Error('Nessuna pagina della scheda da esportare')
    const frame = document.createElement('iframe')
    frame.className = 'character-print-frame'
    frame.title = 'Scheda pronta per la stampa'
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1120px;height:1600px;border:0;'
    document.body.append(frame)
    try {
        const doc = frame.contentDocument!, win = frame.contentWindow! as Window & typeof globalThis
        const base = doc.createElement('base')
        base.href = document.baseURI
        doc.head.append(base)
        doc.title = `Scheda - ${name || 'Personaggio'}`
        const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((node) => {
            const copy = node.cloneNode(true) as HTMLElement
            const ready = node instanceof HTMLLinkElement ? new Promise<void>((resolve, reject) => {
                copy.addEventListener('load', () => resolve(), { once: true })
                copy.addEventListener('error', () => reject(new Error('Foglio di stile non disponibile')), { once: true })
            }) : Promise.resolve()
            doc.head.append(copy)
            return ready
        })
        const style = doc.createElement('style')
        style.textContent = source.querySelector('.barbarian-page') ? printCss.replace('@page { size: A4 portrait; margin: 8mm; }', '') : printCss
        doc.head.append(style)
        const controlStyles = new Map<HTMLElement, { styles: string[][]; nativeCheckbox: boolean }>()
        for (const original of source.querySelectorAll('.player-paper, .barbarian-page')) {
            const page = doc.createElement('section')
            const barbarian = original.matches('.barbarian-page')
            page.className = barbarian ? 'barbarian-page-slot' : 'sheet-print-page'
            const paper = doc.importNode(original, true) as HTMLElement
            // Freeze the rendered geometry before removing controls or changing element tags.
            const sourceNodes = [original, ...original.querySelectorAll<HTMLElement>('*')]
            const printNodes = [paper, ...paper.querySelectorAll<HTMLElement>('*')]
            sourceNodes.forEach((element, index) => {
                const computed = element.ownerDocument.defaultView!.getComputedStyle(element)
                const copy = printNodes[index]
                for (const key of layoutStyles) copy.style.setProperty(key, computed.getPropertyValue(key))
                if (element.matches('input, select, textarea, button')) controlStyles.set(copy, {
                    styles: valueStyles.map((key) => [key, computed.getPropertyValue(key)]),
                    nativeCheckbox: element instanceof HTMLInputElement && element.type === 'checkbox' && computed.appearance !== 'none',
                })
            })
            if (original.lastElementChild?.matches('[data-print="exclude"]')) {
                const bounds = original.getBoundingClientRect()
                const printableChildren = [...original.children].filter((child) => !child.matches('[data-print="exclude"]'))
                const computed = original.ownerDocument.defaultView!.getComputedStyle(original)
                paper.style.height = `${Math.max(...printableChildren.map((child) => child.getBoundingClientRect().bottom - bounds.top)) + parseFloat(computed.paddingBottom) + parseFloat(computed.borderBottomWidth)}px`
            }
            paper.removeAttribute('id')
            paper.removeAttribute('aria-labelledby')
            // Cloning copies attributes, whereas unsaved edits live in control properties.
            const originals = original.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
            const copies = paper.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
            originals.forEach((control, index) => {
                const copy = copies[index]
                if (control instanceof HTMLInputElement && control.type === 'file') return
                copy.value = control.value
                if (control instanceof HTMLInputElement && copy instanceof win.HTMLInputElement) copy.checked = control.checked
            })
            paper.querySelectorAll('[data-print="exclude"], .creation-warning, [role="alert"], button:not([data-print="value"])').forEach((node) => node.remove())
            paper.querySelectorAll('details').forEach((node) => {
                const container = doc.createElement('div')
                for (const attribute of node.attributes) if (attribute.name !== 'open') container.setAttribute(attribute.name, attribute.value)
                if (!node.open && node.matches('.player-wizard-magic-combat details, .player-wizard-favorite-notes')) container.dataset.printCollapsed = 'true'
                node.querySelector(':scope > summary')?.remove()
                container.append(...node.childNodes)
                node.replaceWith(container)
            })
            paper.querySelectorAll('summary').forEach((node) => node.remove())
            if (barbarian) {
                const scale = doc.createElement('div'); scale.className = 'barbarian-scale'; scale.append(paper); page.append(scale)
            } else page.append(paper)
            doc.body.append(page)
        }
        const inventory = source.querySelector('.sheet-print-inventory')
        if (inventory) doc.body.append(inventory.cloneNode(true))
        await Promise.all(styles)
        await doc.fonts.ready
        await Promise.all([...doc.images].filter((image) => image.src).map((image) => image.decode()))

        const notes: { label: string; value: string }[] = []
        for (const paper of doc.querySelectorAll<HTMLElement>('.player-paper, .barbarian-page')) {
            const controls = [...paper.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input, select, textarea, button')]
            const values = controls.map((control) => ({ control, ...controlStyles.get(control)! }))
            for (const { control, styles: properties, nativeCheckbox } of values) {
                if (control instanceof win.HTMLInputElement && control.type === 'file') { control.closest('label')?.remove(); continue }
                const text = doc.createElement('div')
                text.dataset.print = 'value'
                for (const [key, value] of properties) text.style.setProperty(key, value)
                text.className = control.className
                text.style.appearance = 'none'
                text.style.cursor = 'default'
                text.style.overflow = 'hidden'
                text.style.whiteSpace = 'pre-wrap'
                text.style.overflowWrap = 'anywhere'
                text.style.opacity = '1'
                if (!(control instanceof win.HTMLTextAreaElement) && parseFloat(text.style.height) < 50 && parseFloat(text.style.paddingTop) <= 6) {
                    text.style.paddingTop = '0'
                    text.style.paddingBottom = '0'
                }
                if (control instanceof win.HTMLSelectElement) text.textContent = control.value ? [...control.selectedOptions].map((option) => option.textContent).join(', ') : ''
                else if (control instanceof win.HTMLInputElement && control.type === 'checkbox') {
                    text.dataset.printChecked = String(control.checked)
                    if (nativeCheckbox) { text.textContent = control.checked ? '✓' : ''; text.style.border = '1px solid #303236'; text.style.lineHeight = text.style.height; text.style.textAlign = 'center' }
                } else if (control instanceof win.HTMLButtonElement) text.textContent = control.textContent
                else text.textContent = control.value || (/^[+-]?\d+(?:[.,]\d+)?$/.test(control.getAttribute('placeholder') || '') ? control.getAttribute('placeholder') : '')
                const field = control.closest('[data-field]')?.getAttribute('data-field') || ''
                if (/^inventory\.\d+\.[13]$/.test(field) || ['carriedWeight', 'maximumWeight'].includes(field)) {
                    const weight = Number(control.value.replace(',', '.'))
                    // ponytail: quattro cifre significative nei box stretti; dati e inventario completo mantengono la precisione originale.
                    if (control.value.trim() && Number.isFinite(weight)) text.textContent = weight.toLocaleString('it-IT', { maximumSignificantDigits: 4, useGrouping: false })
                }
                const label = control.getAttribute('aria-label') || control.closest('label')?.querySelector('span')?.textContent || 'Campo della scheda'
                control.replaceWith(text)
                if (text.closest('[data-print-collapsed]')) {
                    if (text.textContent?.trim()) notes.push({ label: label.trim(), value: text.textContent })
                    continue
                }
                if (text.textContent) {
                    let size = parseFloat(win.getComputedStyle(text).fontSize)
                    while ((text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1) && size > 9) {
                        text.style.fontSize = `${--size}px`
                        text.style.lineHeight = '1.15'
                    }
                    if ((text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1) && !(inventory && text.closest('.player-wizard-inventory-row'))) notes.push({ label: label.trim(), value: text.textContent })
                }
            }
            paper.querySelectorAll('[data-print-collapsed]').forEach((node) => node.remove())
            if (paper.matches('.barbarian-page')) continue
            const page = paper.parentElement!
            const width = page.getBoundingClientRect().width, height = page.getBoundingClientRect().height
            const bounds = paper.getBoundingClientRect()
            const scale = Math.min(width / Math.max(bounds.width, paper.scrollWidth), height / Math.max(bounds.height, paper.scrollHeight))
            paper.style.transform = `scale(${scale})`
            paper.style.left = `${Math.max(0, (width - Math.max(bounds.width, paper.scrollWidth) * scale) / 2)}px`
        }
        if (notes.length) {
            const section = doc.createElement('section')
            section.className = 'sheet-print-notes'
            const title = doc.createElement('h1')
            title.textContent = 'Testi completi dei campi'
            section.append(title)
            for (const note of notes) {
                const heading = doc.createElement('h2'), text = doc.createElement('p')
                heading.textContent = note.label; text.textContent = note.value
                section.append(heading, text)
            }
            doc.body.append(section)
        }
        // Wait for both ordinary images and the frames drawn by CSS, including pseudo-elements.
        const urls = new Set<string>()
        for (const element of doc.body.querySelectorAll('*')) for (const pseudo of [null, '::before', '::after']) {
            const computed = win.getComputedStyle(element, pseudo)
            for (const value of [computed.backgroundImage, computed.borderImageSource]) for (const match of value.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)) urls.add(match[1] ?? match[2] ?? match[3].trim())
        }
        for (const image of doc.images) if (image.src) urls.add(image.src)
        await Promise.all([...urls].map((url) => new Promise<void>((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve()
            image.onerror = () => reject(new Error(`Immagine della scheda non disponibile: ${url}`))
            image.src = url
        })))
        return frame
    } catch (error) { frame.remove(); throw error }
}

export async function printCharacterSheet(source: HTMLElement, name: string) {
    document.querySelectorAll('.character-print-frame').forEach((frame) => frame.remove())
    const frame = await prepareCharacterPrint(source, name)
    if (!source.isConnected) { frame.remove(); return }
    frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true })
    try { frame.contentWindow!.focus(); frame.contentWindow!.print() }
    catch (error) { frame.remove(); throw error }
}
