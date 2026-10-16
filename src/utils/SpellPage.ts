import type { Catalog } from './Catalog.ts'
import type { CharacterSheet } from './CharacterSheets.ts'
import type { CreationData } from './PlayerCreation.ts'
import { savedSpellGrants, spellRowState, type SpellSource } from './Spellcasting.ts'

/** Preserve the first catalogue match, including when multiple sources share an alias. */
export function spellNameLookup(catalog?: Catalog) {
    const names = new Map<string,string>()
    for (const entry of catalog?.abilities ?? []) {
        if (typeof entry.data.level !== 'number' || !Array.isArray(entry.data.aliases)) continue
        for (const alias of entry.data.aliases) {
            if (typeof alias === 'string' && !names.has(alias.toLowerCase())) names.set(alias.toLowerCase(),entry.name)
        }
    }
    return (name: string) => names.get(name.toLowerCase()) ?? name
}

/** Index selected names once per sheet; rows from different sources remain independent. */
export function spellNameRoots(sheet: CharacterSheet, label: (name: string) => string) {
    const sources = new Map<SpellSource,Map<string,Set<string>>>()
    for (const [key,name] of Object.entries(sheet.playerDetails ?? {})) {
        if (!/^spell\.\d+\.\d+\.name$/.test(key)) continue
        const root=key.slice(0,-5),[,level,index]=key.split('.')
        const source=spellRowState(sheet,Number(level),Number(index)).source
        let names=sources.get(source)
        if (!names) { names=new Map();sources.set(source,names) }
        const translated=label(name)
        let roots=names.get(translated)
        if (!roots) { roots=new Set();names.set(translated,roots) }
        roots.add(root)
    }
    return sources
}

export function hasOtherSpell(roots: Set<string> | undefined, root: string) {
    return !!roots && roots.size > (roots.has(root) ? 1 : 0)
}

export const favoriteSpellCapacity = 7

export function favoriteSpellOptions(sheet: CharacterSheet, catalog?: Catalog) {
    const label = spellNameLookup(catalog)
    const seen = new Set<string>()
    const rows = Object.entries(sheet.playerDetails ?? {}).flatMap(([key, value]) => {
        const match = /^spell\.([0-9])\.(\d+)\.name$/.exec(key)
        return match ? [{root:key.slice(0,-5),name:value,level:Number(match[1]),index:sheet.playerDetails?.[key.slice(0,-5)+'.index'] ?? ''}] : []
    })
    return [...rows,...savedSpellGrants(sheet).map(grant => ({root:'grant:'+grant.index,name:grant.name,level:grant.level,index:grant.index}))]
        .map(option => ({...option,name:label(option.name.trim())})).filter(option => {
            if (!option.name || seen.has(option.name.toLowerCase())) return false
            seen.add(option.name.toLowerCase());return true
        }).sort((a,b) => a.level-b.level || a.name.localeCompare(b.name,'it'))
}

export function favoriteSpellSlots(sheet: CharacterSheet, label: (name:string) => string = name => name) {
    const d = sheet.playerDetails ?? {}, entries = Object.entries(d)
    // Partially completed manual rows also occupy a slot, so adding never overwrites their notes.
    return Array.from({length:favoriteSpellCapacity}, (_,index) => ({index,
        name:label(d[`favoriteSpell.${index}.name`]?.trim() ?? '').toLowerCase(),
        occupied:entries.some(([key,value]) => key.startsWith(`favoriteSpell.${index}.`) && value.trim() && (!/\.(ritual|concentration)$/.test(key) || value==='true')),
    }))
}

export function setFavoriteSpell(sheet: CharacterSheet, root: string, data?: CreationData, catalog?: Catalog, slot?: number): CharacterSheet {
    const label = spellNameLookup(catalog)
    const name = label(sheet.playerDetails?.[root+'.name']?.trim() ?? '')
    const options = favoriteSpellOptions(sheet,catalog)
    const choice = options.find(option => option.root===root) ?? (/^spell\.[0-9]\.\d+$/.test(root) ? options.find(option => option.name.toLowerCase() === name.toLowerCase()) : undefined)
    if (!choice) throw new Error('Scegli un incantesimo presente nella scheda.')
    const slots = favoriteSpellSlots(sheet,label)
    const existing = slots.find(slot => slot.name===choice.name.toLowerCase())?.index
    const free = slots.find(slot => !slot.occupied)?.index
    if (existing !== undefined && existing !== slot) throw new Error('Questo incantesimo è già tra i preferiti.')
    const target = slot ?? free
    if (target === undefined) throw new Error(`Tutti i ${favoriteSpellCapacity} posti dei preferiti sono occupati. Svuota un posto in prima pagina.`)
    if (!Number.isInteger(target) || target < 0 || target >= favoriteSpellCapacity) throw new Error('Posto dei preferiti non valido.')
    const d = sheet.playerDetails ?? {}
    const spell = data?.spells.find(spell => spell.index === choice.index || label(spell.name).toLowerCase() === choice.name.toLowerCase() || label(spell.nameIt ?? '').toLowerCase() === choice.name.toLowerCase())
    const entry = catalog?.abilities.find(entry => entry.data.level === choice.level && label(entry.name).toLowerCase() === choice.name.toLowerCase())
    const mechanics = entry?.data.mechanics as Record<string,unknown> | undefined
    const components = mechanics?.components ?? entry?.data.components
    const duration = entry?.data.durationInfo as {concentration?:boolean} | undefined
    const values = {
        name:choice.name, level:String(choice.level),
        castingTime:String(mechanics?.castingTime ?? entry?.data.castingTime ?? spell?.casting_time ?? ''),
        components:Array.isArray(components) ? components.join(', ') : typeof components==='string' ? components : '',
        ritual:String(mechanics?.ritual ?? entry?.data.ritual ?? spell?.ritual ?? false),
        concentration:String(mechanics?.concentration ?? entry?.data.concentration ?? duration?.concentration ?? false),
        effect:entry?.description ?? spell?.desc.join('\n\n') ?? '',
        attack:spell?.dc ? `${spell.dc.dc_type.name} CD ${d.spellDC ?? ''}`.trim() : spell?.attack_type ? d.spellAttackBonus ?? '' : '',
    }
    return {...sheet,playerDetails:{...d,...Object.fromEntries(Object.entries(values).map(([key,value]) => [`favoriteSpell.${target}.${key}`,value]))}}
}
