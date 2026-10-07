import { durationTurns } from './Combat.ts'
import { newCharacterSheet, type CharacterSheet, type SheetAbility } from './CharacterSheets.ts'
import { pdfCombatAbilities } from './PlayerAbilities.ts'

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
export type Catalog = { creatures: CatalogEntry[]; abilities: CatalogEntry[] }

function normalized(text: string) {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('it').trim()
}

export function searchCatalog(entries: CatalogEntry[], query: string): CatalogEntry[] {
    const term = normalized(query)
    return term ? entries.filter((entry) => normalized(entry.name).includes(term)) : []
}

export function parseCatalog(raw: unknown): Catalog {
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
                id: key === 'spellIndex' ? `wikidot:${data.id}` : data.id,
                name: data.name, type, description: String(data.description ?? ''), sourceUrl: data.sourceUrl,
                label: key === 'creatures' ? (data.isNpc ? 'PNG' : 'Mostro') : key === 'abilities' ? 'Abilità' : key === 'spells' ? 'Incantesimo · italiano' : 'Incantesimo · inglese',
                rounds: typeof rounds === 'number' ? rounds : null, data,
            }
        })
    }
    const creatures = entries('creatures', 'creature')
    const names = new Map(creatures.map((entry) => [entry.id, entry.name]))
    const abilities = entries('abilities', 'ability').map((entry) => ({ ...entry, label: `Abilità · ${names.get(String(entry.data.creatureId)) ?? 'Creatura'}` }))
    const allAbilities = [...abilities, ...entries('spells', 'ability'), ...entries('spellIndex', 'ability')]
    if ([creatures, allAbilities].some((rows) => new Set(rows.map((entry) => entry.id)).size !== rows.length)) throw new Error('Identificativi duplicati nel catalogo.')
    return { creatures, abilities: allAbilities }
}

export function templateFromCatalog(entry: CatalogEntry): SheetAbility {
    const duration = entry.rounds === 0 ? 'Senza conteggio' : (Object.keys(durationTurns) as SheetAbility['duration'][]).find((key) => durationTurns[key] === entry.rounds) ?? 'Personalizzata'
    return { name: entry.name, catalogId: entry.id, duration, remainingTurns: entry.rounds ?? 0, timed: duration !== 'Senza conteggio' }
}

export function sheetWithCombatSpells(sheet: CharacterSheet, catalog: Catalog): CharacterSheet {
    if (sheet.kind !== 'PG') return sheet
    const abilities = [...(sheet.abilities ?? [])]
    for (const [key, value] of Object.entries(sheet.playerDetails ?? {})) {
        if (!/^spell\.\d+\.\d+\.name$/.test(key) || !value.trim()) continue
        const name = value.trim()
        const spell = catalog.abilities.find((entry) => typeof entry.data.level === 'number' &&
            (normalized(entry.name) === normalized(name) || (typeof entry.data.englishName === 'string' && normalized(entry.data.englishName) === normalized(name))))
        if (abilities.some((ability) => normalized(ability.name) === normalized(name) || (spell && (ability.catalogId === spell.id || normalized(ability.name) === normalized(spell.name))))) continue
        abilities.push(spell ? templateFromCatalog(spell) : { name, duration: 'Personalizzata', remainingTurns: 0 })
    }
    return { ...sheet, abilities }
}

export function sheetWithCombatAbilities(sheet: CharacterSheet, catalog: Catalog): CharacterSheet {
    const result = sheetWithCombatSpells(sheet, catalog)
    const abilities = [...result.abilities]
    for (const ability of pdfCombatAbilities(sheet)) {
        if (!abilities.some((item) => normalized(item.name) === normalized(ability.name))) abilities.push(ability)
    }
    return sheet.kind === 'PG' ? { ...result, abilities } : sheet
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
