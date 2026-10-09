import { integerValue, inventoryTotalWeight, type CharacterSheet } from './CharacterSheets.ts'
import type { CreationData, Equipment, Ref } from './PlayerCreation.ts'

export type InventoryGrant = { ref: Ref; count: number; source: string; origin: string }
export type InventoryItem = { row: number; id: string; name: string; quantity: string; weight: string; catalog: string; source: string; origin: string; notes: string }
const itemFields = ['0','1','2','catalog','notes','equipped','requiresAttunement','attuned','consumable','damageDice','damageType','armorBase','armorDexMax']
export const inventoryReferenceKey = (field: string) => `inventory.ref.${field}`
export const inventoryReferenceField = (field: string) => /^(armor|shield|attacks\.\d+\.0|ammunition\.\d+\.0|magicItem\.\d+\.name|worn\..+)$/.test(field)
export function inventoryItems(sheet: CharacterSheet): InventoryItem[] {
    const d = sheet.playerDetails ?? {}
    const rows = [...new Set(Object.keys(d).flatMap((key) => /^inventory\.(\d+)\./.exec(key)?.[1] ?? []))].map(Number).sort((a,b) => a-b)
    return rows.filter((row) => d[`inventory.${row}.removed`] !== 'true' && ['0','1','2','notes'].some((key) => d[`inventory.${row}.${key}`]?.trim())).map((row) => {
        const root = `inventory.${row}`
        return { row, id:d[`${root}.id`] ?? '', name:d[`${root}.0`] ?? '', quantity:d[`${root}.2`] ?? '', weight:d[`${root}.1`] ?? '', catalog:d[`${root}.catalog`] ?? '', source:d[`${root}.source`] ?? 'manual', origin:d[`${root}.origin`] ?? 'Inserito manualmente', notes:d[`${root}.notes`] ?? '' }
    })
}
export function ownedInventoryItems(sheet: CharacterSheet) {
    return inventoryItems(sheet).filter((x) => x.name.trim() && (x.quantity.trim() ? (integerValue(x.quantity) ?? 0) > 0 : true))
}
export function inventoryReferenceIds(sheet: CharacterSheet,field: string): string[] {
    const value=sheet.playerDetails?.[inventoryReferenceKey(field)]
    if (!value) return []
    if (field.startsWith('worn.') && value.startsWith('[')) {
        try {const ids:unknown=JSON.parse(value);return Array.isArray(ids) && ids.every((id) => typeof id==='string') ? ids : [value]} catch {return [value]}
    }
    return [value]
}
export function referencedInventoryItems(sheet: CharacterSheet,field: string) {
    const owned=ownedInventoryItems(sheet)
    return inventoryReferenceIds(sheet,field).flatMap((id) => {const matches=owned.filter((x) => x.id===id);return matches.length===1 ? matches : []})
}
export function referencedInventoryItem(sheet: CharacterSheet,field: string) {return referencedInventoryItems(sheet,field)[0]}
export function inventoryEquipment(item: InventoryItem | undefined, sheet: CharacterSheet, data: CreationData): Equipment | undefined {
    const equipment = item && data.equipment.find((x) => x.index === item.catalog)
    if (!equipment || !item) return undefined
    const d = sheet.playerDetails ?? {}, root = `inventory.${item.row}`
    const base = d[`${root}.armorBase`], maximum = d[`${root}.armorDexMax`]
    if ([base,maximum].some((value) => value?.trim() && (integerValue(value)===undefined || Number(value)<0))) return undefined
    return { ...equipment, name:item.name, nameIt:item.name,
        ...(equipment.armor_class ? { armor_class:{...equipment.armor_class,...(base !== undefined && base !== '' ? {base:Number(base)} : {}),...(maximum !== undefined && maximum !== '' ? {max_bonus:Number(maximum)} : {})} } : {}),
        ...(equipment.damage ? {damage:{...equipment.damage,damage_dice:d[`${root}.damageDice`] || equipment.damage.damage_dice,damage_type:{...equipment.damage.damage_type,name:d[`${root}.damageType`] || equipment.damage.damage_type.name,nameIt:d[`${root}.damageType`] || equipment.damage.damage_type.nameIt}}} : {}),
    }
}
export function inventoryFieldValue(sheet: CharacterSheet, field: string): string | undefined {
    const d = sheet.playerDetails ?? {}
    if (d['inventory.version'] !== '1') return undefined
    if (['equipment','consumables','attunedItems'].includes(field)) {
        const items = inventoryItems(sheet).filter((x) => x.name.trim() && (field === 'equipment' || d[`inventory.${x.row}.${field === 'attunedItems' ? 'attuned' : 'consumable'}`] === 'true'))
        return items.map((x) => `${x.quantity.trim() || '1'} × ${x.name}${field === 'consumables' && x.notes ? ` · ${x.notes}` : ''}`).join('\n')
    }
    const ammunition=/^ammunition\.(\d+)\.1$/.exec(field)
    if (ammunition) return inventoryItems(sheet).find((x) => x.id===sheet.playerDetails?.[inventoryReferenceKey(`ammunition.${ammunition[1]}.0`)])?.quantity ?? ''
    const magic = /^magicItem\.(\d+)\.(notes|equipped|requiresAttunement|attuned)$/.exec(field)
    const nameField = magic ? `magicItem.${magic[1]}.name` : field
    if (!inventoryReferenceField(nameField)) return undefined
    const item = referencedInventoryItem(sheet,nameField)
    return magic ? item ? d[`inventory.${item.row}.${magic[2]}`] ?? '' : '' : referencedInventoryItems(sheet,field).map((x) => x.name).join('\n')
}
function nextRow(d: Record<string,string>) {
    return Math.max(-1,...Object.keys(d).flatMap((k) => /^inventory\.(\d+)\./.exec(k)?.[1] ?? []).map(Number)) + 1
}
function assignId(sheet: CharacterSheet, d: Record<string,string>, row: number) {
    const key=`inventory.${row}.id`
    if (!d[key]) {
        let next=integerValue(d['inventory.nextId']) ?? 0
        const used=new Set(Object.entries(d).filter(([k]) => /^inventory\.\d+\.id$/.test(k)).map(([,v]) => v))
        while (used.has(`${sheet.id}:item:${next}`)) next++
        d[key]=`${sheet.id}:item:${next}`;d['inventory.nextId']=String(next+1)
    }
    return d[key]
}
function addItem(sheet: CharacterSheet,d: Record<string,string>,name: string,quantity='1',catalog='',source='manual',origin='Inserito manualmente',data?: CreationData) {
    const row=nextRow(d), root=`inventory.${row}`, equipment=data?.equipment.find((x) => x.index===catalog)
    // Il catalogo conserva libbre; le righe della scheda usano kg. Non convertire i pesi manuali già salvati.
    const weight=equipment?.weight === undefined ? '' : String(Number((equipment.weight * 0.45359237).toPrecision(15)))
    Object.assign(d,{[`${root}.0`]:name,[`${root}.1`]:weight,[`${root}.2`]:quantity,[`${root}.catalog`]:catalog,[`${root}.source`]:source,[`${root}.origin`]:origin})
    const id=assignId(sheet,d,row)
    return {row,id}
}
function removeRow(d: Record<string,string>,row: number) {
    const root=`inventory.${row}`, id=d[`${root}.id`], name=d[`${root}.0`]
    for (const key of Object.keys(d)) if (key.startsWith(root+'.')) delete d[key]
    Object.assign(d,{[`${root}.id`]:id ?? '',[`${root}.removed`]:'true',[`${root}.removedName`]:name ?? ''})
}
function snapshot(d: Record<string,string>,row: number) {
    return JSON.stringify(Object.fromEntries(itemFields.map((field) => [field,d[`inventory.${row}.${field}`] ?? ''])))
}
function equipmentMatch(name: string,data: CreationData) {
    const matches=data.equipment.filter((x) => [x.index,x.name,x.nameIt,...(x.aliases ?? [])].some((value) => value?.toLowerCase()===name.trim().toLowerCase()))
    return matches.length===1 ? matches[0] : undefined
}
function expandInventoryGrants(grants: InventoryGrant[],data: CreationData,parents: string[] = []): InventoryGrant[] {
    return grants.flatMap((grant) => {
        if (!Number.isSafeInteger(grant.count) || grant.count<=0) return []
        const item=data.equipment.find((x) => x.index===grant.ref.index)
        return item?.contents?.length && !parents.includes(item.index) ? expandInventoryGrants(item.contents.map((child,i) => ({ref:child.item,count:child.quantity*grant.count,source:`${grant.source}/contents.${i}.${child.item.index}`,origin:`${grant.origin} · ${item.nameIt ?? item.name}`})),data,[...parents,item.index]) : [grant]
    })
}
export function reconcileInventory(input: CharacterSheet,data: CreationData,grants: InventoryGrant[] = []): CharacterSheet {
    if (input.kind !== 'PG') return input
    const d={...input.playerDetails}, sheet={...input,playerDetails:d}
    const oldFields=Object.entries(d).filter(([key,value]) => value.trim() && (inventoryReferenceField(key) || ['equipment','consumables','attunedItems'].includes(key)))
    if (d['inventory.version'] !== '1' && !grants.length && !inventoryItems(sheet).length && !oldFields.length) return input
    const migrating=d['inventory.version'] !== '1'
    if (migrating) {
        d['inventory.version']='1'
        d['inventory.legacy']=JSON.stringify(Object.fromEntries(Object.entries(d).filter(([key]) => inventoryReferenceField(key) || /^(magicItem\.|ammunition\.|equipment$|consumables$|attunedItems$)/.test(key))))
        for (const x of inventoryItems(sheet)) assignId(sheet,d,x.row)
        const generatedEquipment=d.equipment && d.equipment===d['creation.auto.equipment']
        for (const field of ['equipment','consumables','attunedItems']) {
            if (!d[field]?.trim() || field==='equipment' && generatedEquipment) continue
            for (const [i,line] of d[field].split('\n').entries()) {
                if (!line.trim()) continue
                const parsed=/^\s*(\d+)\s*[×x]\s*(.+)$/.exec(line), name=(parsed?.[2] ?? line).trim()
                const match=equipmentMatch(name,data)
                const existing=inventoryItems(sheet).filter((x) => x.name.trim().toLowerCase()===name.toLowerCase())
                if (existing.length) {d[`inventory.pending.${field}.${i}`]=line;continue}
                const recovered=expandInventoryGrants([{ref:match ?? {index:'',name},count:Number(parsed?.[1] ?? 1),source:'legacy',origin:`Recuperato da ${field==='equipment' ? 'Equipaggiamento' : field==='consumables' ? 'Consumabili' : 'Oggetti armonizzati'}`}],data)
                for (const [part,grant] of recovered.entries()) {
                    const itemName=grant.ref.nameIt ?? grant.ref.name
                    if (inventoryItems(sheet).some((x) => x.name.trim().toLowerCase()===itemName.toLowerCase())) {d[`inventory.pending.${field}.${i}.${part}`]=`${grant.count} × ${itemName}`;continue}
                    const item=addItem(sheet,d,itemName,String(grant.count),grant.ref.index,'legacy',grant.origin,data)
                    if (field==='consumables') d[`inventory.${item.row}.consumable`]='true'
                    if (field==='attunedItems') d[`inventory.${item.row}.attuned`]='true'
                }
            }
        }
        // Riferimenti nominativi ambigui restano da collegare: un nome non identifica un oggetto posseduto.
        for (const [field,name] of oldFields.filter(([k]) => inventoryReferenceField(k))) {
            const generated=field.startsWith('attacks.') && name===d[`creation.auto.${field}`] || ['armor','shield'].includes(field) && name===d[`creation.auto.${field}`]
            if (generated) continue
            const existing=inventoryItems(sheet).filter((x) => x.name.trim().toLowerCase()===name.toLowerCase())
            if (existing.length) {d[`inventory.pending.${field}`]=name;continue}
            const equipment=equipmentMatch(name,data)
            const ammunition=/^ammunition\.(\d+)\.0$/.exec(field)
            const item=addItem(sheet,d,name,ammunition ? d[`ammunition.${ammunition[1]}.1`] || '1' : '1',equipment?.index,'legacy','Recuperato dalla scheda',data)
            d[inventoryReferenceKey(field)]=item.id
        }
    }
    const desired=expandInventoryGrants(grants,data)
    let ledger: Record<string,string>={},validLedger=true
    try { const parsed=JSON.parse(d['inventory.grants'] ?? '{}');if (!parsed || typeof parsed!=='object' || Array.isArray(parsed) || !Object.values(parsed).every((x) => typeof x==='string')) throw new Error('Provenienza non valida');ledger=parsed } catch {validLedger=false;d['inventory.invalidGrants']=d['inventory.grants'] ?? ''}
    for (const item of validLedger && d['creation.enabled']==='true' ? inventoryItems(sheet) : []) if (item.source.startsWith('initial:') && !desired.some((g) => g.source===item.source)) {
        if (d[`inventory.${item.row}.generated`]===snapshot(d,item.row)) {removeRow(d,item.row);delete ledger[item.source]}
        else {d[`inventory.${item.row}.source`]='manual';d[`inventory.${item.row}.origin`]='Dotazione precedente modificata: conservata'}
    }
    for (const grant of validLedger ? desired : []) {
        if (d[`inventory.pending.grant.${grant.source}`]) continue
        if (ledger[grant.source]) continue // Anche una dotazione rimossa intenzionalmente non deve ricomparire.
        const equipment=data.equipment.find((x) => x.index===grant.ref.index),name=equipment?.nameIt ?? grant.ref.nameIt ?? grant.ref.name
        const existing=migrating && inventoryItems(sheet).filter((x) => x.catalog===grant.ref.index && x.source==='legacy')
        if (existing && existing.length===1 && (existing[0].quantity.trim() || '1')===String(grant.count)) {
            ledger[grant.source]=existing[0].id;d[`inventory.${existing[0].row}.source`]=grant.source;continue
        }
        if (migrating && inventoryItems(sheet).some((x) => !x.catalog && x.name.trim().toLowerCase()===name.toLowerCase())) {d[`inventory.pending.grant.${grant.source}`]=`${grant.count} × ${name}`;continue}
        const item=addItem(sheet,d,name,String(grant.count),grant.ref.index,grant.source,grant.origin,data)
        d[`inventory.${item.row}.generated`]=snapshot(d,item.row);ledger[grant.source]=item.id
    }
    if (validLedger && (grants.length || d['inventory.grants'])) d['inventory.grants']=JSON.stringify(ledger)
    for (const item of inventoryItems(sheet)) {
        assignId(sheet,d,item.row)
        if (d[`inventory.${item.row}.unclassified`] === 'true') {
            const equipment=equipmentMatch(item.name,data)
            if (equipment) {
                d[`inventory.${item.row}.catalog`]=equipment.index
                if (!item.weight.trim() && equipment.weight !== undefined) d[`inventory.${item.row}.1`]=String(Number((equipment.weight*0.45359237).toPrecision(15)))
            }
            delete d[`inventory.${item.row}.unclassified`]
        }
    }
    for (const [field] of oldFields) if (inventoryReferenceField(field)) {
        const linked=referencedInventoryItem(sheet,field)
        if (linked && field.startsWith('magicItem.')) {
            const root=field.slice(0,-5)
            for (const prop of ['notes','equipped','requiresAttunement','attuned']) if (migrating && d[`${root}.${prop}`]!==undefined) d[`inventory.${linked.row}.${prop}`]=d[`${root}.${prop}`]
        }
    }
    const projected=projectInventory(sheet)
    if (d['creation.enabled'] !== 'true' && d['creation.override.carriedWeight'] !== 'true') {
        const previous=d['creation.auto.carriedWeight'],computed=inventoryCarriedWeight(projected)
        if (d.carriedWeight !== undefined && d.carriedWeight !== '' && d.carriedWeight !== previous) projected.playerDetails!['creation.override.carriedWeight']='true'
        else projected.playerDetails!.carriedWeight=computed
        projected.playerDetails!['creation.auto.carriedWeight']=computed
    }
    return projected
}
export function projectInventory(sheet: CharacterSheet): CharacterSheet {
    if (sheet.playerDetails?.['inventory.version'] !== '1') return sheet
    const d={...sheet.playerDetails}, next={...sheet,playerDetails:d}
    for (const field of ['equipment','consumables','attunedItems',...Object.keys(d).filter((key) => inventoryReferenceField(key)),...Object.keys(d).filter((key) => key.startsWith('inventory.ref.')).map((key) => key.slice(14))]) d[field]=inventoryFieldValue(next,field) ?? ''
    for (const key of Object.keys(d).filter((key) => /^ammunition\.\d+\.1$/.test(key))) d[key]=inventoryFieldValue(next,key) ?? ''
    for (const key of Object.keys(d).filter((key) => /^magicItem\.\d+\.(notes|equipped|requiresAttunement|attuned)$/.test(key))) d[key]=inventoryFieldValue(next,key) ?? ''
    for (const item of inventoryItems(next)) d[`inventory.${item.row}.3`]=inventoryTotalWeight(item.quantity,item.weight)
    return next
}
export function setInventoryReference(sheet: CharacterSheet,field: string,id: string): CharacterSheet {
    if (!inventoryReferenceField(field) || id && !ownedInventoryItems(sheet).some((item) => item.id===id)) return sheet
    const d: Record<string,string>={...sheet.playerDetails,[inventoryReferenceKey(field)]:id}
    if (d[`inventory.pending.${field}`] && field.startsWith('magicItem.')) {
        try {
            const legacy=JSON.parse(d['inventory.legacy'] ?? '{}'),item=ownedInventoryItems(sheet).find((x) => x.id===id),root=field.slice(0,-5)
            if (item) for (const prop of ['notes','equipped','requiresAttunement','attuned']) if (typeof legacy[`${root}.${prop}`]==='string') {
                const key=`inventory.${item.row}.${prop}`,previous=d[key],value=legacy[`${root}.${prop}`]
                if (prop==='notes') d[key]=previous && previous!==value ? `${previous}\n${value}` : value
                else if (previous===undefined) d[key]=value
            }
        } catch { /* I dati originali restano nell'archivio, anche se non leggibili. */ }
    }
    delete d[`inventory.pending.${field}`]
    d[`creation.override.${inventoryReferenceKey(field)}`]='true'
    return projectInventory({...sheet,playerDetails:d})
}
export function removeInventoryItem(sheet: CharacterSheet,id: string): CharacterSheet {
    const item=inventoryItems(sheet).find((x) => x.id===id)
    if (!item) return sheet
    const d={...sheet.playerDetails};removeRow(d,item.row)
    return projectInventory({...sheet,playerDetails:d})
}
export function updateInventoryField(sheet: CharacterSheet,field: string,value: string): CharacterSheet | undefined {
    const d={...sheet.playerDetails}
    if (inventoryReferenceField(field)) {
        if (!value.trim()) return setInventoryReference(sheet,field,'')
        const matches=ownedInventoryItems(sheet).filter((x) => x.name===value || x.catalog===value)
        if (matches.length===1) return setInventoryReference(sheet,field,matches[0].id)
        if (matches.length > 1) {d[`inventory.pending.${field}`]=value;return {...sheet,playerDetails:d}}
        const item=addItem(sheet,d,value)
        d[`inventory.${item.row}.unclassified`]='true';d['inventory.version']='1'
        return setInventoryReference({...sheet,playerDetails:d},field,item.id)
    }
    const ammunition=/^ammunition\.(\d+)\.1$/.exec(field)
    if (ammunition) {
        const item=referencedInventoryItem(sheet,`ammunition.${ammunition[1]}.0`)
        if (!item) return sheet
        d[`inventory.${item.row}.2`]=value;return projectInventory({...sheet,playerDetails:d})
    }
    const magic=/^magicItem\.(\d+)\.(notes|equipped|requiresAttunement|attuned)$/.exec(field)
    if (magic) {
        const item=referencedInventoryItem(sheet,`magicItem.${magic[1]}.name`)
        if (!item) return sheet
        d[`inventory.${item.row}.${magic[2]}`]=value
        return projectInventory({...sheet,playerDetails:d})
    }
    if (field.startsWith('inventory.ref.')) return setInventoryReference(sheet,field.slice(14),value)
    const entry=/^inventory\.(\d+)\.(.+)$/.exec(field)
    if (!entry) return undefined
    const row=Number(entry[1]),root=`inventory.${row}`
    if (entry[2]==='0' && !value.trim() && d[`${root}.0`]?.trim()) return removeInventoryItem(sheet,d[`${root}.id`])
    if (d[`${root}.removed`]==='true' && value.trim()) {delete d[`${root}.id`];delete d[`${root}.removed`];delete d[`${root}.removedName`]}
    assignId(sheet,d,row);d[field]=value;d['inventory.version']='1'
    return projectInventory({...sheet,playerDetails:d})
}
export function inventoryIssues(sheet: CharacterSheet): string[] {
    const d=sheet.playerDetails ?? {},issues:string[]=[]
    for (const [key,id] of Object.entries(d)) if (key.startsWith('inventory.ref.') && id && inventoryReferenceIds(sheet,key.slice(14)).some((id) => !ownedInventoryItems(sheet).some((x) => x.id===id))) issues.push(`${inventoryReferenceLabel(key.slice(14))}: l’oggetto collegato è stato rimosso o ha quantità zero. Scegli un altro oggetto dall’inventario.`)
    for (const [key,value] of Object.entries(d)) if (key.startsWith('inventory.pending.')) issues.push(`Da collegare o verificare: ${value}. Gli oggetti omonimi non sono stati uniti automaticamente.`)
    if (d['inventory.invalidGrants'] !== undefined) issues.push('La provenienza delle dotazioni salvate non è leggibile. I dati originali sono conservati; verifica il recupero prima di aggiungere altre dotazioni.')
    const ids=inventoryItems(sheet).map((x) => x.id).filter(Boolean)
    if (new Set(ids).size!==ids.length) issues.push('Due voci hanno lo stesso identificativo: conserva i dati e verifica i collegamenti prima di riordinarle.')
    return issues
}

export function inventoryReferenceLabel(field: string) {
    if (field==='armor') return 'Armatura'
    if (field==='shield') return 'Scudo'
    if (field.startsWith('worn.')) return `Equipaggiamento · ${field.slice(5).replace('ring.','Anello ').replace('weapon.','Arma ').replace('other.','Altro ')}`
    const row=/^(attacks|magicItem|ammunition)\.(\d+)\./.exec(field)
    return row ? `${row[1]==='attacks' ? 'Attacco' : row[1]==='ammunition' ? 'Munizioni' : 'Oggetto magico'} ${Number(row[2])+1}` : field
}
export function addInventoryItem(sheet: CharacterSheet,data: CreationData,name: string,catalog='',quantity='1'): CharacterSheet {
    if (!name.trim() || integerValue(quantity)===undefined || Number(quantity)<1) return sheet
    const d={...sheet.playerDetails,'inventory.version':'1'}
    const equipment=data.equipment.find((x) => x.index===catalog)
    if (equipment) for (const grant of expandInventoryGrants([{ref:{...equipment,name:name.trim(),nameIt:name.trim()},count:Number(quantity),source:'manual',origin:'Acquisito durante il gioco'}],data)) addItem(sheet,d,grant.ref.nameIt ?? grant.ref.name,String(grant.count),grant.ref.index,'manual',grant.origin,data)
    else addItem(sheet,d,name.trim(),quantity)
    return projectInventory({...sheet,playerDetails:d})
}
export function resolveInventoryPending(sheet: CharacterSheet,key: string,id: string,data: CreationData): CharacterSheet {
    const value=sheet.playerDetails?.[key]
    if (!key.startsWith('inventory.pending.') || !value || id && !inventoryItems(sheet).some((x) => x.id===id)) return sheet
    let next=sheet, d={...sheet.playerDetails}
    if (key.startsWith('inventory.pending.grant.')) {
        if (id) {
            let ledger: Record<string,string>={}
            try {ledger=JSON.parse(d['inventory.grants'] ?? '{}')} catch {return sheet}
            ledger[key.slice('inventory.pending.grant.'.length)]=id
            d['inventory.grants']=JSON.stringify(ledger)
        }
    } else {
        const field=key.slice('inventory.pending.'.length), parsed=/^\s*(\d+)\s*[×x]\s*(.+)$/.exec(value), name=(parsed?.[2] ?? value).trim()
        if (!id) {
            const equipment=equipmentMatch(name,data),item=addItem(sheet,d,name,parsed?.[1] ?? '1',equipment?.index,'legacy','Recuperato dalla scheda: oggetto distinto',data)
            id=item.id
        }
        const item=inventoryItems({...sheet,playerDetails:d}).find((x) => x.id===id)
        if (item && field.startsWith('consumables.')) d[`inventory.${item.row}.consumable`]='true'
        if (item && field.startsWith('attunedItems.')) d[`inventory.${item.row}.attuned`]='true'
        if (inventoryReferenceField(field)) next=setInventoryReference({...sheet,playerDetails:d},field,id)
        if (inventoryReferenceField(field)) d={...next.playerDetails}
    }
    delete d[key]
    return projectInventory({...next,playerDetails:d})
}
export function inventoryCarriedWeight(sheet: CharacterSheet): string {
    let total=0,hasWeight=false
    for (const item of inventoryItems(sheet)) {
        if (item.quantity.trim() && integerValue(item.quantity)===0) {hasWeight=true;continue}
        if (!item.weight.trim()) {if (item.name.trim()) return '';continue}
        const weight=inventoryTotalWeight(item.quantity,item.weight)
        if (weight==='') return ''
        hasWeight=true;total+=Number(weight)
    }
    for (const coin of ['MR','MA','ME','MO','MP']) {
        const value=sheet.playerDetails?.[`coins.${coin}`]
        if (!value?.trim()) continue
        const count=integerValue(value)
        if (count===undefined || count<0) return ''
        hasWeight=true;total+=count/100
    }
    return hasWeight && Number.isFinite(total) ? String(Number(total.toPrecision(15))) : ''
}
export function setWornInventoryReferences(sheet: CharacterSheet,field: string,ids: string[]): CharacterSheet {
    if (!field.startsWith('worn.') || ids.some((id) => !ownedInventoryItems(sheet).some((x) => x.id===id))) return sheet
    const d={...sheet.playerDetails,[inventoryReferenceKey(field)]:JSON.stringify([...new Set(ids)])}
    delete d[`inventory.pending.${field}`]
    return projectInventory({...sheet,playerDetails:d})
}
