import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes } from 'react'
import { searchCatalog, type CatalogEntry } from '../utils/Catalog'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'onSelect'> & {
    value: string
    entries: CatalogEntry[]
    onChange: (value: string) => void
    onSelect: (entry: CatalogEntry) => void
}

export function CatalogSearch({ value, entries, onChange, onSelect, className, ...input }: Props) {
    const id = useId()
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(-1)
    const list = useRef<HTMLDivElement>(null)
    const results = useMemo(() => searchCatalog(entries, value), [entries, value])
    const visible = open && !input.disabled && value.trim().length > 0
    useEffect(() => {
        if (visible && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
    }, [active, visible])
    function select(entry: CatalogEntry) {
        onSelect(entry)
        setOpen(false)
        setActive(-1)
    }
    return (
        <div className={`catalog-search ${className ?? ''}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
            <input {...input} value={value} autoComplete="off" role="combobox" aria-autocomplete="list"
                aria-expanded={visible} aria-controls={id} aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined}
                onFocus={() => setOpen(true)} onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(-1) }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && visible) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
                    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
                        event.preventDefault(); setOpen(true)
                        setActive((current) => event.key === 'ArrowDown' ? Math.min(current + 1, results.length - 1) : Math.max(current - 1, 0))
                    }
                    if (event.key === 'Enter' && visible) { event.preventDefault(); if (results[active]) select(results[active]) }
                }} />
            <div ref={list} id={id} role="listbox" aria-label="Risultati del catalogo" hidden={!visible} className="catalog-results">
                {results.map((entry, index) => (
                    <div key={entry.id} id={`${id}-${index}`} role="option" aria-selected={index === active}
                        onMouseDown={(event) => event.preventDefault()} onClick={() => select(entry)}>
                        <strong>{entry.name}</strong><span>{entry.label}</span>
                    </div>
                ))}
                {results.length === 0 && <p>Nessun risultato. Puoi inserire un nome personalizzato.</p>}
            </div>
        </div>
    )
}
