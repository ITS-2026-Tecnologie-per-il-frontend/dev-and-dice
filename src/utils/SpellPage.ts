import type { Catalog } from './Catalog.ts'
import type { CharacterSheet } from './CharacterSheets.ts'
import { spellRowState, type SpellSource } from './Spellcasting.ts'

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
