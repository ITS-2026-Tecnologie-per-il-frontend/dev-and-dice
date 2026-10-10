import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import page1 from './page1.json'
import page2 from './page2.json'
import page3 from './page3.json'
import { emptyCharacter, parseCharacter, type Box, type Character, type Field, type PageLayout } from './model'
import './barbarian.css'
import type { CharacterSheet } from '../utils/CharacterSheets'
import { playerBarbarianCharacter, updatePlayerBarbarian, barbarianFieldReadOnly } from './player'

const pages = [page1, page2, page3] as PageLayout[]
const storageKey = 'dev-and-dice.barbarian.v1'
const position = ([left, top, width, height]: Box): CSSProperties => ({ left, top, width, height })

/** Source ornaments contain geometry only; lettering and character values live in HTML. */
function Ornament({ ornament }: { ornament: PageLayout['ornaments'][number] }) {
  return <svg className="barbarian-ornament" style={position(ornament.box)} viewBox={`0 0 ${ornament.viewBox.join(' ')}`} aria-hidden="true" focusable="false"><use href={`${ornament.src}#geometry`} /></svg>
}
function SourceText({ line }: { line: PageLayout['texts'][number] }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [x, y, width, height] = line.box
  const number = line.kind === 'number'
  const small = !['plain', 'brand', 'caps'].includes(line.kind ?? '') && (line.kind === 'heading' || line.kind === 'body' || (x > 200 && y > 90 && line.kind !== 'level' && line.kind !== 'base') || (x < 190 && y > 170 && y < 630 && line.kind !== 'base') || line.text === 'BARBARO')
  const title = line.text === 'BARBARO'
  let content = line.text
  if (!small && !number && line.kind !== 'base' && line.kind !== 'plain') content = content.toUpperCase()
  if (small && !number) content = line.kind === 'body' ? line.text.charAt(0) + line.text.slice(1).toLowerCase() : line.text.toLowerCase().replace(/(^|[\s’])\p{L}/gu, value => value.toUpperCase())
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const canvas = document.createElement('canvas').getContext('2d')!
    const style = getComputedStyle(element)
    canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const metrics = canvas.measureText(number ? content : small ? 'H' : content)
    const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    const scaleY = height / Math.max(1, inkHeight)
    // ponytail: scanned ink boxes replace missing font metrics; original fonts would remove this baseline approximation.
    element.style.top = `${y - (parseFloat(style.fontSize) * .85 - metrics.actualBoundingBoxAscent) * scaleY}px`
    element.style.transform = `scale(${width / element.offsetWidth}, ${scaleY})`
  }, [content, height, number, small, width, y])
  return <span ref={ref} className={`barbarian-source-text ${small ? 'smallcaps' : ''} ${number ? 'number' : ''} ${title ? 'title' : ''}`} style={{ left: x, top: y, fontSize: number ? height * 1.4 : title ? 18 : height * 1.45, fontWeight: line.kind === 'brand' ? 900 : ['plain', 'base', 'level'].includes(line.kind ?? '') || (x < 400 && y < 90 && !title && line.kind !== 'heading') ? 400 : 700 }}>{content}</span>
}
function SheetField({ field, value, onChange, readOnly = false }: { field: Field; value: string | boolean; onChange: (value: string | boolean) => void; readOnly?: boolean }) {
  const shared = { 'aria-label': field.label, 'data-field': `${field.group}.${field.key}`, readOnly, className: `barbarian-field ${field.kind}`, style: { ...position(field.box), ...(['text', 'number'].includes(field.kind) ? { fontSize: Math.min(9, field.box[3] * .8) } : {}) } }
  if (field.kind === 'checkbox') return <input {...shared} type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} />
  if (field.kind === 'textarea') return <textarea {...shared} value={String(value)} onChange={event => onChange(event.target.value)} spellCheck={false} />
  if (field.kind === 'select') return <select {...shared} value={String(value)} onChange={event => onChange(event.target.value)}>{field.options?.map(option => <option key={option}>{option}</option>)}</select>
  return <input {...shared} type={field.kind === 'number' ? 'number' : 'text'} value={String(value)} onChange={event => onChange(event.target.value)} min={field.min} max={field.max} step="any" spellCheck={false} />
}
export function DocumentPage({ layout, index, character, onChange, readOnly }: { layout: PageLayout; index: number; character: Character; onChange: (field: Field, value: string | boolean) => void; readOnly?: (field: Field) => boolean }) {
  return <article className="barbarian-page" data-page={index + 1} aria-label={`Scheda Barbaro, pagina ${index + 1}`} style={{ width: layout.width, height: layout.height }}>
    {layout.ornaments.map(ornament => <Ornament key={ornament.name} ornament={ornament} />)}
    <div className="barbarian-lettering">{layout.texts.map((line, i) => <SourceText key={i} line={line} />)}</div>
    {layout.fields.map(field => <SheetField key={`${field.group}.${field.key}`} field={field} value={character[field.group][field.key] ?? ''} readOnly={readOnly?.(field)} onChange={value => onChange(field, value)} />)}
  </article>
}
export function PlayerBarbarianSheet({ sheet, onChange, page }: { sheet: CharacterSheet; onChange: (sheet: CharacterSheet) => void; page: number }) {
  return <BarbarianSheet character={playerBarbarianCharacter(sheet,pages)} onChange={(field,value)=>onChange(updatePlayerBarbarian(sheet,field,value))} page={page} readOnly={field=>barbarianFieldReadOnly(sheet,field)} />
}
export default function BarbarianSheet({ character: suppliedCharacter, onChange, page, readOnly }: { character?: Character; onChange?: (field: Field, value: string | boolean) => void; page?: number; readOnly?: (field: Field) => boolean } = {}) {
  const [loaded] = useState(() => {
    if (suppliedCharacter) return { character: suppliedCharacter, error: '' }
    try { const raw = localStorage.getItem(storageKey); return { character: raw ? parseCharacter(raw, pages) : emptyCharacter(pages), error: '' } }
    catch (error) { return { character: emptyCharacter(pages), error: `Dati salvati non caricati. L’originale è conservato. ${error instanceof Error ? error.message : ''}` } }
  })
  const [localCharacter, setCharacter] = useState(loaded.character)
  const character = suppliedCharacter ?? localCharacter
  const [message, setMessage] = useState(loaded.error)
  const [scale, setScale] = useState(1)
  const [zoom, setZoom] = useState('fit')
  const [fontsReady, setFontsReady] = useState(() => typeof document !== 'undefined' && document.fonts.check('400 12px "Barbarian Sans"') && document.fonts.check('700 12px "Barbarian Sans"'))
  const host = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let active = true
    Promise.all([document.fonts.load('400 12px "Barbarian Sans"'), document.fonts.load('700 12px "Barbarian Sans"')]).then(() => { if (active) setFontsReady(true) }).catch(() => { if (active) { setFontsReady(true); setMessage('Font non caricati: è in uso il carattere sostitutivo del browser.') } })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const observer = new ResizeObserver(entries => setScale(Math.min(1.6, (entries[0].contentRect.width - 24) / pages[0].width)))
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  function update(field: Field, value: string | boolean) { if (onChange) onChange(field,value); else setCharacter(current => ({ ...current, [field.group]: { ...current[field.group], [field.key]: value } })) }
  function save() {
    try { parseCharacter(JSON.stringify(character), pages); localStorage.setItem(storageKey, JSON.stringify(character)); setMessage('Scheda salvata nel browser.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Salvataggio non riuscito; le modifiche restano aperte.') }
  }
  function download() {
    try {
      parseCharacter(JSON.stringify(character), pages)
      const url = URL.createObjectURL(new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'barbaro.json'; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('JSON esportato.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Esportazione non riuscita.') }
  }
  async function upload(selected: File) {
    try {
      if (selected.size > 2_000_000) throw new Error('Il JSON supera il limite di 2 MB.')
      const next = parseCharacter(await selected.text(), pages)
      setCharacter(next); setMessage('JSON caricato; usa Salva per conservarlo nel browser.')
    } catch (error) { setMessage(`${error instanceof Error ? error.message : 'Caricamento non riuscito.'} La scheda aperta non è stata modificata.`) }
  }
  function print() {
    const overflowing = [...(host.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="checkbox"]), textarea') ?? [])].find(control => control.value && (control.scrollHeight > control.clientHeight + 1 || control.scrollWidth > control.clientWidth + 1))
    if (overflowing) { setMessage(`Stampa non avviata: «${overflowing.getAttribute('aria-label')}» supera lo spazio del PDF. Accorcia il testo per stamparlo interamente; il valore completo resta nella scheda e nel JSON.`); overflowing.focus(); return }
    setMessage('Scheda pronta per la stampa.')
    window.print()
  }
  const Container = suppliedCharacter ? 'div' : 'main'
  return <Container className="barbarian-editor">
    {!suppliedCharacter && <nav className="barbarian-toolbar" aria-label="Controlli della scheda">
      <Link to="/trackers">Dev & Dice</Link><strong>Barbaro</strong>
      <label>Zoom <select aria-label="Zoom della scheda" value={zoom} onChange={event => setZoom(event.target.value)}><option value="fit">Adatta</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select></label>
      <button type="button" onClick={save}>Salva</button>
      <button type="button" onClick={download}>Esporta JSON</button>
      <button type="button" onClick={() => file.current?.click()}>Carica JSON</button>
      <button type="button" onClick={print} disabled={!fontsReady}>Stampa / PDF</button>
      <input ref={file} type="file" accept=".json,application/json" aria-label="File JSON della scheda" hidden onChange={event => { const selected = event.target.files?.[0]; if (selected) void upload(selected); event.target.value = '' }} />
      <p role="status">{message || 'Compila la scheda, poi salva o esporta i dati.'}</p>
    </nav>}
    <div className="barbarian-document" ref={host}>
      {fontsReady ? pages.map((layout, index) => page !== undefined && page !== index ? null : <div key={index} className="barbarian-page-slot" style={{ width: layout.width * (zoom === 'fit' ? scale : Number(zoom)), height: layout.height * (zoom === 'fit' ? scale : Number(zoom)) }}><div className="barbarian-scale" style={{ transform: `scale(${zoom === 'fit' ? scale : Number(zoom)})` }}><DocumentPage layout={layout} index={index} character={character} onChange={update} readOnly={readOnly} /></div></div>) : <p role="status">Preparazione della scheda…</p>}
    </div>
  </Container>
}
