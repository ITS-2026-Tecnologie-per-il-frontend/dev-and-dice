import { durationTurns } from './Combat.ts'
import { creatureAbilitySections, newCharacterSheet, type CharacterSheet, type SheetAbility } from './CharacterSheets.ts'
import { spellRowState, savedSpellGrants } from './Spellcasting.ts'
import { pdfCombatAbilities, sheetCombatAttacks } from './PlayerAbilities.ts'

export type CatalogEntry = {
    id: string
    name: string
    label: string
    type: 'creature' | 'ability'
    description: string
    sourceUrl: string
    rounds: number | null
    data: Record<string, unknown>
}
export type Catalog = { creatures: CatalogEntry[]; abilities: CatalogEntry[];language?:'it'|'en' }

function normalized(text: string) {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('it').trim()
}

export function searchCatalog(entries: CatalogEntry[], query: string): CatalogEntry[] {
    const term = normalized(query)
    return term ? entries.filter((entry) => [entry.name, ...(Array.isArray(entry.data.aliases) ? entry.data.aliases.filter((name): name is string => typeof name === 'string') : [])].some((name) => normalized(name).includes(term))) : []
}

export function catalogAbilityKind(entry?: CatalogEntry, section?: SheetAbility['section'], description = entry?.description ?? '') {
    const mechanics = entry?.data.mechanics as { kind?: unknown; activation?: unknown } | undefined
    const category = section ?? entry?.data.category
    let group = typeof category === 'string' && Object.hasOwn(creatureAbilitySections, category) ? category as SheetAbility['section'] : undefined
    // MM 2014, D&D_5_Monster_Original_Handbook.pdf, PDF 11–12: weapon attacks include natural weapons; spell attacks are distinct.
    const weaponAttack = typeof mechanics?.kind === 'string' ? mechanics.kind.includes('weapon-attack')
        : /^\s*(?:Attacco(?: con Arma\b| (?:in mischia|a distanza) con arma\b)[^:\n]*|(?:Melee|Ranged)[^:\n]*Weapon Attack)\s*:/i.test(description)
    const attack = weaponAttack || typeof mechanics?.kind === 'string' && mechanics.kind.includes('attack')
        || !!entry?.data.creatureId && /^\s*(?:Attacco[^:\n]*|(?:Melee|Ranged)[^:\n]*Attack)\s*:/i.test(description)
    if (group === 'trait') {
        // ponytail: explicit activation clauses keep active traits usable; ambiguous text stays a trait.
        // Prefer a verified activation field when richer creature metadata becomes available.
        if (mechanics?.activation === 'bonus-action' || /azione bonus|bonus action/i.test(description)) group = 'bonus'
        else if (mechanics?.activation === 'reaction' || /(?:come|con|usando) (?:una |la (?:sua|propria) )?reazione|as a reaction|use its reaction/i.test(description)) group = 'reaction'
        else if (attack || mechanics?.activation === 'action' || /as an action|(?:come|con|usando) (?:un['’]?\s*|una )azione|pu[oò] (?:usare|utilizzare|spendere) un['’]?\s*azione/i.test(description)) group = 'action'
    }
    return { section: group, attack, weaponAttack, passive: group === 'trait' }
}

export function parseCatalog(raw: unknown, language: 'it' | 'en' = 'it'): Catalog {
    if (!raw || typeof raw !== 'object') throw new Error('Database non valido.')
    const database = raw as Record<string, unknown>
    const entries = (key: string, type: CatalogEntry['type']): CatalogEntry[] => {
        const rows = database[key]
        if (!Array.isArray(rows)) throw new Error('Catalogo incompleto.')
        return rows.map((data: Record<string, unknown>) => {
            if (!data || typeof data !== 'object' || typeof data.id !== 'string' || typeof data.name !== 'string' || !data.name.trim()
                || typeof data.sourceUrl !== 'string' || !/^https:\/\//.test(data.sourceUrl)
                || (data.description !== undefined && typeof data.description !== 'string')) throw new Error('Voce del catalogo non valida.')
            const duration = data.durationInfo as { rounds?: unknown } | undefined
            const rounds = key === 'abilities' ? data.durationRounds : duration?.rounds
            if (rounds !== null && rounds !== undefined && (!Number.isSafeInteger(rounds) || Number(rounds) < 0)) throw new Error('Durata non valida.')
            return {
                id: key === 'spellIndex' || key === 'englishSpells' ? (typeof data.italianId === 'string' ? data.italianId : `wikidot:${data.id}`) : data.id,
                name: data.name, type, description: String(data.description ?? ''), sourceUrl: data.sourceUrl,
                label: key === 'creatures' ? (data.isNpc ? 'PNG' : 'Mostro') : key === 'abilities' ? 'Abilità' : key === 'spells' ? 'Incantesimo · italiano' : 'Incantesimo · inglese',
                rounds: typeof rounds === 'number' ? rounds : null, data,
            }
        })
    }
    const creatures = entries('creatures', 'creature')
    const names = new Map(creatures.map((entry) => [entry.id, entry.name]))
    const abilities = entries('abilities', 'ability').map((entry) => ({ ...entry, label: `Abilità · ${names.get(String(entry.data.creatureId)) ?? 'Creatura'}` }))
    const italian = entries('spells', 'ability')
    const english = entries('englishSpells', 'ability')
    const translations = new Map(italian.map((entry) => [entry.id, entry]))
    const translatedEnglish = new Map(english.map((entry) => [entry.id, entry]))
    const spells = (language === 'en' ? english : [...italian, ...english.filter((entry) => !translations.has(entry.id))]).map((entry) => {
        const translation = translations.get(entry.id)
        const original = translatedEnglish.get(entry.id)
        const srd = original?.data.srdData as { name?: string } | undefined
        return { ...entry, data: { ...entry.data, aliases: [entry.name, translation?.name, translation?.data.englishName, original?.name, srd?.name].filter((name): name is string => typeof name === 'string') } }
    })
    const allAbilities = [...abilities, ...spells]
    if ([creatures, allAbilities].some((rows) => new Set(rows.map((entry) => entry.id)).size !== rows.length)) throw new Error('Identificativi duplicati nel catalogo.')
    return { creatures, abilities: allAbilities }
}

export function templateFromCatalog(entry: CatalogEntry): SheetAbility {
    const kind = catalogAbilityKind(entry)
    const mechanics=entry.data.mechanics as {duration?:unknown}|undefined
    const untilDispelled=typeof mechanics?.duration==='string' && /^Until dispelled(?: or triggered)?$/i.test(mechanics.duration)
    const duration = kind.attack || kind.passive || entry.rounds === 0 || untilDispelled ? 'Senza conteggio' : (Object.keys(durationTurns) as SheetAbility['duration'][]).find((key) => durationTurns[key] === entry.rounds) ?? 'Personalizzata'
    return { name: entry.name, catalogId: entry.id, duration, remainingTurns: entry.rounds ?? 0, timed: duration !== 'Senza conteggio',
        ...(kind.section ? {section:kind.section} : {}),
        ...(typeof entry.data.level==='number' ? {spellLevel:entry.data.level} : {}),
        ...(entry.data.expiresAt==='start'||entry.data.expiresAt==='end' ? {expiresAt:entry.data.expiresAt} : {}),
        ...(typeof entry.data.repeatSave==='string' ? {repeatSave:entry.data.repeatSave} : {}),
        ...(typeof entry.data.referenceId==='string' ? {ruleId:entry.data.referenceId} : {}),
        ...(entry.data.edition==='2014' && entry.data.mechanics && typeof entry.data.mechanics==='object' && 'concentration' in entry.data.mechanics && entry.data.mechanics.concentration===true ? {concentration:true} : {}) }
}

export function removeSheetAbility(sheet:CharacterSheet,index:number,catalog:Catalog):CharacterSheet {
    const ability=sheet.abilities[index]
    if(!ability)return sheet
    const entry=catalog.abilities.find(entry=>entry.id===ability.catalogId)
    const details={...sheet.playerDetails},roots=new Set<string>()
    if(ability.spellLevel!==undefined||typeof entry?.data.level==='number') {
        const names=new Set([ability.name,entry?.name,...(Array.isArray(entry?.data.aliases)?entry.data.aliases:[])].filter((name):name is string=>typeof name==='string').map(normalized))
        const reference=typeof entry?.data.referenceId==='string'?entry.data.referenceId.split(':').at(-1):undefined
        for(const [key,value]of Object.entries(details))if(/^spell\.\d+\.\d+\.name$/.test(key)&&value.trim()&&(names.has(normalized(value))||reference&&details[key.slice(0,-5)+'.index']===reference))roots.add(key.slice(0,-5))
        for(const key of Object.keys(details))if(roots.has(/^(spell\.\d+\.\d+)\./.exec(key)?.[1]??'')||/^wizard\.(?:mastery\.[12]|signature\.[01])$/.test(key)&&roots.has(details[key]))delete details[key]
    }
    return {...sheet,abilities:sheet.abilities.filter((_,i)=>i!==index),playerDetails:details}
}

export function sheetWithCombatSpells(sheet: CharacterSheet, catalog: Catalog, availableOnly = false): CharacterSheet {
    if (sheet.kind !== 'PG') return sheet
    const abilities = [...(sheet.abilities ?? [])]
    for (const [key, value] of Object.entries(sheet.playerDetails ?? {})) {
        if (!/^spell\.\d+\.\d+\.name$/.test(key) || !value.trim()) continue
        const [, level, index] = key.split('.')
        if (availableOnly && !spellRowState(sheet, Number(level), Number(index)).available) continue
        const name = value.trim()
        const spell = catalog.abilities.find((entry) => typeof entry.data.level === 'number' &&
            (normalized(entry.name) === normalized(name) || (Array.isArray(entry.data.aliases) && entry.data.aliases.some((alias) => typeof alias === 'string' && normalized(alias) === normalized(name)))))
        if (abilities.some((ability) => normalized(ability.name) === normalized(name) || (spell && (ability.catalogId === spell.id || normalized(ability.name) === normalized(spell.name))))) continue
        const template = spell ? templateFromCatalog(spell) : { name, spellLevel:Number(level), duration: 'Personalizzata' as const, remainingTurns: 0 }
        const note = sheet.playerDetails?.[`spell.${level}.${index}.note`]
        abilities.push(note ? { ...template, description: note } : template)
    }
    for (const grant of savedSpellGrants(sheet)) {
        const spell = catalog.abilities.find((entry) => typeof entry.data.level === 'number' && (normalized(entry.name) === normalized(grant.name)
            || (Array.isArray(entry.data.aliases) && entry.data.aliases.some((alias) => typeof alias === 'string' && normalized(alias) === normalized(grant.name)))))
        const template = spell ? templateFromCatalog(spell) : { name: grant.name, spellLevel:grant.level, duration: 'Personalizzata' as const, remainingTurns: 0 }
        if (!abilities.some((ability) => (template.catalogId && ability.catalogId === template.catalogId) || normalized(ability.name) === normalized(template.name))) abilities.push({ ...template, description: grant.note })
    }
    return { ...sheet, abilities }
}

export function sheetWithCombatAbilities(sheet: CharacterSheet, catalog: Catalog): CharacterSheet {
    if (sheet.kind!=='PG') return sheet
    const result = sheetWithCombatSpells(sheet, catalog, true)
    const abilities = result.abilities.filter(ability=>!/^sheet-attack:[0-5]$/.test(ability.ruleId ?? ''))
    for (const ability of pdfCombatAbilities(sheet)) {
        if (!abilities.some((item) => normalized(item.name) === normalized(ability.name))) abilities.push(ability)
    }
    for (const attack of sheetCombatAttacks(sheet)) {
        if (!abilities.some(item=>normalized(item.name)===normalized(attack.name) && item.description===attack.description)) abilities.push(attack)
    }
    return { ...result, abilities }
}

export function refreshCombatSheetAbilities(previous: CharacterSheet, current: CharacterSheet, catalog: Catalog) {
    const latest = sheetWithCombatAbilities(current, catalog)
    const templates = [...previous.abilities], availableIndexes = new Set<number>()
    // ponytail: scansioni O(n²) e voci ritirate mantenute per preservare gli indici del combattimento.
    // Per liste molto grandi usare un indice per chiave; reinserire il personaggio ricostruisce la lista.
    for (const template of latest.abilities) {
        let index = templates.findIndex((item, i) => !availableIndexes.has(i) && item.duration === template.duration &&
            (/^sheet-attack:[0-5]$/.test(template.ruleId ?? '') ? item.ruleId===template.ruleId : item.catalogId && template.catalogId ? item.catalogId === template.catalogId : item.name.trim().toLowerCase() === template.name.trim().toLowerCase()))
        if (index < 0) { index = templates.length; templates.push(template) }
        else templates[index] = template
        availableIndexes.add(index)
    }
    return { sheet: { ...latest, abilities: templates }, availableAbilityIndexes: [...availableIndexes] }
}

export function sheetFromCatalog(entry: CatalogEntry, catalog: Catalog, base: CharacterSheet = newCharacterSheet()): CharacterSheet {
    const data = entry.data
    const scores = data.abilityScores as Record<string, { score?: unknown; modifier?: unknown }> | undefined
    const stats = data.stats as Record<string, unknown> | undefined
    const integer = (value: unknown) => Number.isSafeInteger(value) ? String(value) : ''
    const text = (value: unknown) => typeof value === 'string' ? value : ''
    const sheet: CharacterSheet = {
        ...base, catalogId: entry.id, name: entry.name, kind: data.isNpc ? 'PNG' : 'Mostro',
        race: text(stats?.type), characterClass: '', level: text(data.challengeRating),
        hitPoints: integer(data.hitPoints), armorClass: integer(data.armorClass), initiative: '',
        speed: text(stats?.speed), notes: entry.description,
        abilities: catalog.abilities.filter((ability) => ability.data.creatureId === entry.id).map(templateFromCatalog),
    }
    for (const field of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const) sheet[field] = integer(scores?.[field]?.score)
    return sheet
}
