import { useEffect, useRef, useState } from 'react'
import type { CharacterSheet } from '../utils/CharacterSheets'
import { characterFieldValue, updateCharacterField, labelOf, type CreationData } from '../utils/PlayerCreation'
import { addInventoryItem, inventoryEquipment, inventoryItems, inventoryReferenceKey, inventoryReferenceIds, inventoryReferenceLabel, ownedInventoryItems, referencedInventoryItems, removeInventoryItem, resolveInventoryPending, setWornInventoryReferences, setInventoryReference } from '../utils/Inventory'
import { useDialogDismiss } from '../utils/Dialog'

export type InventoryTarget = { field: string; label: string }
// ponytail: display up to three decimal places; stored weights retain their full precision.
const weightFormat = new Intl.NumberFormat('it', { maximumFractionDigits: 3 })
export function InventoryEditor({sheet,data,onChange,target,onClose}: {sheet:CharacterSheet;data:CreationData;onChange:(sheet:CharacterSheet)=>void;target?:InventoryTarget;onClose?:()=>void}) {
    const dialog=useRef<HTMLDialogElement>(null),dismiss=useDialogDismiss()
    const [catalog,setCatalog]=useState(''),[name,setName]=useState(''),[quantity,setQuantity]=useState('1')
    const [link,setLink]=useState('armor'),[pendingLinks,setPendingLinks]=useState<Record<string,string>>({})
    const d=sheet.playerDetails ?? {}, items=inventoryItems(sheet), owned=ownedInventoryItems(sheet)
    useEffect(() => {if (target && !dialog.current?.open) dialog.current?.showModal()},[target])
    function change(key:string,value:string) {onChange(updateCharacterField(sheet,key,value))}
    function select(field:string) {
        const multiple=field.startsWith('worn.'),current=d[inventoryReferenceKey(field)] ?? '',ids=inventoryReferenceIds(sheet,field)
        return <label className="player-field"><span>{inventoryReferenceLabel(field)}</span><select aria-label={`Collega ${inventoryReferenceLabel(field)}`} multiple={multiple} value={multiple ? ids : current} onChange={(e) => {onChange(multiple ? setWornInventoryReferences(sheet,field,[...e.target.selectedOptions].map((x) => x.value).filter(Boolean)) : setInventoryReference(sheet,field,e.target.value));if (target && !multiple) dialog.current?.close()}}>
            {!multiple && <option value="">Nessun oggetto collegato</option>}
            {ids.filter((id) => !owned.some((x) => x.id===id)).map((id) => <option key={id} value={id}>Oggetto rimosso o esaurito · scegli un altro</option>)}
            {owned.filter((x) => {const equipment=inventoryEquipment(x,sheet,data);return field==='armor' ? equipment?.armor_class && equipment.armor_category!=='Shield' : field==='shield' ? equipment?.armor_category==='Shield' : true}).map((x) => <option key={x.id} value={x.id}>{x.name} · quantità {x.quantity || '1'} · voce {x.row+1}</option>)}
        </select></label>
    }
    const fields=['armor','shield',...Array.from({length:6},(_,i) => `attacks.${i}.0`),...Array.from({length:3},(_,i) => `ammunition.${i}.0`),...Array.from({length:12},(_,i) => `magicItem.${i}.name`),...['Viso','Testa','Collo','Schiena','Corpo','Torso','Mani','Braccia','Vita','Piedi'].map((x) => `worn.${x}`),...Array.from({length:2},(_,i) => `worn.ring.${i}`),...Array.from({length:3},(_,i) => `worn.weapon.${i}`),...Array.from({length:4},(_,i) => `worn.other.${i}`)]
    function text(key:string,label:string,numeric=false) {return <label className="player-field"><span>{label}</span><input type={numeric ? 'number' : 'text'} min={numeric ? 0 : undefined} step={numeric ? 1 : undefined} value={d[key] ?? ''} onChange={(e) => change(key,e.target.value)} /></label>}
    function flag(key:string,label:string) {return <label className="player-check"><input type="checkbox" checked={d[key]==='true'} onChange={(e) => change(key,String(e.target.checked))} /><span>{label}</span></label>}
    return <>
        <details className="inventory-editor"><summary><span className="inventory-heading">Inventario · oggetti e collegamenti</span> <span className="inventory-count">{items.length} {items.length === 1 ? 'voce' : 'voci'}</span></summary>
            <div className="inventory-body">
            <p className="inventory-intro">Gestisci gli oggetti del personaggio e richiamali nei campi della scheda. I collegamenti non aggiungono quantità o peso.</p>
            <div className="inventory-tools">
            <details className="inventory-add"><summary>Aggiungi un oggetto</summary><div className="inventory-tool-body">
            <div className="player-three-fields"><label className="player-field"><span>Oggetto dal catalogo</span><select value={catalog} onChange={(e) => {setCatalog(e.target.value);setName(data.equipment.find((x) => x.index===e.target.value)?.nameIt ?? data.equipment.find((x) => x.index===e.target.value)?.name ?? '')}}><option value="">Oggetto personalizzato</option>{data.equipment.map((x) => <option key={x.index} value={x.index}>{labelOf(x)}</option>)}</select></label><label className="player-field"><span>Nome del nuovo oggetto</span><input value={name} onChange={(e) => setName(e.target.value)} /></label><label className="player-field"><span>Quantità da aggiungere</span><input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label></div>
            <button className="inventory-add-button" type="button" disabled={!name.trim() || !Number.isSafeInteger(Number(quantity)) || Number(quantity)<1} onClick={() => {onChange(addInventoryItem(sheet,data,name,catalog,quantity));setName('');setCatalog('');setQuantity('1')}}>Aggiungi all’inventario</button>
            </div></details>
            <details className="inventory-links"><summary>Collegamenti alla scheda</summary><div className="inventory-tool-body">
                <p className="inventory-note">Scegli il campo e l’oggetto da richiamare. Puoi aprire questo collegamento anche cliccando sul campo nella scheda.</p>
                <div className="player-two-fields"><label className="player-field"><span>Campo della scheda</span><select value={link} onChange={(e) => setLink(e.target.value)}>{fields.map((field) => <option key={field} value={field}>{inventoryReferenceLabel(field)}</option>)}</select></label>{select(link)}</div>
                {link.startsWith('worn.') && <p className="inventory-note">Puoi selezionare più oggetti con Ctrl o Cmd. I nomi compariranno insieme nel riquadro.</p>}
                {!owned.length && <p className="inventory-note">Aggiungi un oggetto con quantità maggiore di zero per collegarlo alla scheda.</p>}
            </div></details>
            </div>
            <section className="inventory-items" aria-label="Oggetti nell’inventario">
            {!items.length && <p className="inventory-empty">L’inventario è vuoto. Apri «Aggiungi un oggetto» per scegliere dal catalogo o inserire un oggetto personalizzato.</p>}
            {items.map((item) => {
                const root=`inventory.${item.row}`,equipment=inventoryEquipment(item,sheet,data),total=characterFieldValue(sheet,`${root}.3`)
                return <details className="inventory-item" key={item.id || item.row}><summary><span className="inventory-item-heading"><strong>{item.name || `Voce ${item.row+1} da completare`}</strong><span className="inventory-item-meta"><span>Quantità {item.quantity || '1'}</span><span>{total ? `${weightFormat.format(Number(total))} kg` : 'Peso da completare'}</span>{d[`${root}.equipped`]==='true' && <span className="inventory-item-status">Equipaggiato</span>}{d[`${root}.attuned`]==='true' && <span className="inventory-item-status">Sintonia attiva</span>}</span></span></summary>
                    <div className="inventory-item-body">
                    <p className="inventory-note">Provenienza: {item.origin}</p>
                    <div className="player-three-fields inventory-item-fields">{text(`${root}.0`,'Nome')}{text(`${root}.2`,'Quantità',true)}{text(`${root}.1`,'Peso unitario (kg)')}</div>
                    <label className="player-field"><span>Tipo e proprietà dal catalogo</span><select value={item.catalog} onChange={(e) => change(`${root}.catalog`,e.target.value)}><option value="">Oggetto personalizzato · proprietà manuali</option>{data.equipment.map((x) => <option key={x.index} value={x.index}>{labelOf(x)}</option>)}</select></label>
                    {equipment?.weapon_category && <div className="player-two-fields">{text(`${root}.damageDice`,'Dadi di danno (facoltativo)')}{text(`${root}.damageType`,'Tipo di danno (facoltativo)')}</div>}
                    {equipment?.armor_class && <div className="player-two-fields">{text(`${root}.armorBase`,'CA base (facoltativa)',true)}{text(`${root}.armorDexMax`,'Bonus Des massimo (facoltativo)',true)}</div>}
                    <label className="player-field"><span>Descrizione e usi</span><textarea rows={2} value={item.notes} onChange={(e) => change(`${root}.notes`,e.target.value)} /></label>
                    <div className="player-checks">{flag(`${root}.equipped`,'Equipaggiato')}{flag(`${root}.requiresAttunement`,'Richiede sintonia')}{flag(`${root}.attuned`,'Sintonia attiva')}{flag(`${root}.consumable`,'Consumabile')}</div>
                    {equipment?.properties?.length ? <p className="inventory-note">Proprietà: {equipment.properties.map(labelOf).join(', ')}</p> : null}
                    <div className="inventory-item-footer"><p>Peso totale: <strong>{total ? `${weightFormat.format(Number(total))} kg` : 'da completare'}</strong></p><button className="inventory-remove" type="button" onClick={() => onChange(removeInventoryItem(sheet,item.id))}>Rimuovi dall’inventario</button></div>
                    </div>
                </details>
            })}
            </section>
            {Object.entries(d).filter(([key]) => key.startsWith('inventory.pending.')).map(([key,value]) => <section className="inventory-pending" key={key}><h3>Dati precedenti da verificare</h3><p><strong>{value}</strong>. Se rappresentano un oggetto già elencato, collegalo; altrimenti mantienilo come oggetto distinto.</p><label className="player-field"><span>Voce esistente</span><select value={pendingLinks[key] ?? ''} onChange={(e) => setPendingLinks({...pendingLinks,[key]:e.target.value})}><option value="">Seleziona una voce…</option>{items.map((x) => <option key={x.id} value={x.id}>{x.name} · voce {x.row+1}</option>)}</select></label><div className="inventory-pending-actions"><button type="button" disabled={!pendingLinks[key]} onClick={() => onChange(resolveInventoryPending(sheet,key,pendingLinks[key],data))}>Collega alla voce scelta</button><button type="button" onClick={() => onChange(resolveInventoryPending(sheet,key,'',data))}>Mantieni come oggetto distinto</button></div></section>)}
            </div>
        </details>
        <dialog ref={dialog} className="character-dialog inventory-link-dialog" aria-label="Collegamento all’inventario" {...dismiss} onClose={(e) => {if (e.currentTarget===e.target) onClose?.()}}>
            {target && <><h3>{target.label}</h3>{select(target.field)}{target.field.startsWith('worn.') && <p>Puoi selezionare più oggetti con Ctrl o Cmd. I nomi compariranno insieme nel riquadro.</p>}{!owned.length && <p>Aggiungi gli oggetti nella pagina Inventario prima di collegarli.</p>}{referencedInventoryItems(sheet,target.field).map((item) => <p key={item.id}>{item.name} · quantità {item.quantity || '1'} · peso unitario {item.weight || 'da completare'} kg · totale {characterFieldValue(sheet,`inventory.${item.row}.3`) || 'da completare'} kg. {item.notes}</p>)}<button type="button" onClick={() => dialog.current?.close()}>Chiudi</button></>}
        </dialog>
    </>
}
