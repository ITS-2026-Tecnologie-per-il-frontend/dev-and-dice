import { durationTurns, type Ability } from './Combat.ts'

export const characterFields = {
    name: 'Nome', kind: 'Tipo', race: 'Razza / specie', characterClass: 'Classe',
    level: 'Livello / GS', hitPoints: 'PF', armorClass: 'CA', initiative: 'Iniziativa predefinita',
    speed: 'Velocità', strength: 'Forza', dexterity: 'Destrezza', constitution: 'Costituzione',
    intelligence: 'Intelligenza', wisdom: 'Saggezza', charisma: 'Carisma',
    notes: 'Attacchi, equipaggiamento e altre note',
} as const

export const numericCharacterFields = ['hitPoints', 'armorClass', 'initiative', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const

export type SheetAbility = { name: string; duration: keyof typeof durationTurns; catalogId?: string; remainingTurns?: number; timed?: boolean; description?: string }

export type CharacterSheet = { id: string; abilities: SheetAbility[]; catalogId?: string; playerDetails?: Record<string, string> } & Record<keyof typeof characterFields, string>

export function integerValue(value: string | undefined): number | undefined {
    if (!value?.trim()) return undefined
    const number = Number(value)
    return Number.isSafeInteger(number) ? number : undefined
}

export function characterLevel(sheet: CharacterSheet): number | undefined {
    const level = integerValue(sheet.level)
    return level !== undefined && level >= 1 && level <= 20 ? level : undefined
}

export function abilityModifier(score: string): number | undefined {
    const value = integerValue(score)
    return value !== undefined && value >= 1 && value <= 30 ? Math.floor((value - 10) / 2) : undefined
}

export const signedBonus = (value: number | undefined): string => value === undefined ? '' : `${value >= 0 ? '+' : ''}${value}`

export function newCharacterSheet(): CharacterSheet {
    return { id: crypto.randomUUID(), abilities: [], ...(Object.fromEntries(Object.keys(characterFields).map((key) => [key, key === 'kind' ? 'PG' : ''])) as Record<keyof typeof characterFields, string>) }
}

export function parseCharacterSheets(raw: string | null): CharacterSheet[] {
    if (raw === null) return []
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value) || !value.every((sheet) =>
        sheet !== null && typeof sheet === 'object' && typeof sheet.id === 'string'
        && sheet.id.length > 0 && Object.keys(characterFields).every((key) => typeof sheet[key] === 'string')
        && ['PG', 'Mostro', 'PNG'].includes(sheet.kind) && sheet.name.trim().length > 0
        && (sheet.catalogId === undefined || typeof sheet.catalogId === 'string')
        && (sheet.playerDetails === undefined || (sheet.playerDetails !== null && typeof sheet.playerDetails === 'object' && !Array.isArray(sheet.playerDetails) && Object.values(sheet.playerDetails).every((value) => typeof value === 'string')))
        && (sheet.abilities === undefined || (Array.isArray(sheet.abilities) && sheet.abilities.every((ability: unknown) =>
            ability !== null && typeof ability === 'object' && 'name' in ability && typeof ability.name === 'string'
            && ability.name.trim().length > 0 && 'duration' in ability && typeof ability.duration === 'string'
            && Object.hasOwn(durationTurns, ability.duration)
            && (!('catalogId' in ability) || ability.catalogId === undefined || typeof ability.catalogId === 'string')
            && (!('remainingTurns' in ability) || ability.remainingTurns === undefined || (Number.isSafeInteger(ability.remainingTurns) && Number(ability.remainingTurns) >= 0))
            && (!('timed' in ability) || ability.timed === undefined || typeof ability.timed === 'boolean')
            && (!('description' in ability) || ability.description === undefined || typeof ability.description === 'string')
        )))
        && numericCharacterFields.every((key) => sheet[key] === '' || (sheet[key].trim() !== '' && Number.isSafeInteger(Number(sheet[key]))))
    ) || new Set(value.map((sheet) => sheet.id)).size !== value.length) {
        throw new Error('Le schede salvate non sono valide. I dati originali non sono stati modificati.')
    }
    return value.map((sheet) => ({ ...sheet, abilities: sheet.abilities ?? [] }))
}

export function turnFromSheet(sheet: CharacterSheet, id: number) {
    const initiative = sheet.kind === 'PG' ? sheet.initiative : ''
    return { id, description: sheet.name, initiative, hitPoints: sheet.hitPoints, armorClass: sheet.armorClass, temporaryHitPoints: sheet.playerDetails?.temporaryHitPoints ?? '', sheet: { ...sheet, initiative, abilities: (sheet.abilities ?? []).map((ability) => ({ ...ability })) } }
}

export type SheetStats = Pick<CharacterSheet, 'hitPoints' | 'armorClass' | 'initiative'> & { temporaryHitPoints?: string }

export function patchSheetStats(sheet: CharacterSheet, stats: Partial<SheetStats>): CharacterSheet | null {
    if (Object.values(stats).some((value) => value !== '' && (!value.trim() || !Number.isSafeInteger(Number(value))))
        || (stats.hitPoints !== undefined && stats.hitPoints !== '' && Number(stats.hitPoints) < 0)
        || (stats.temporaryHitPoints !== undefined && stats.temporaryHitPoints !== '' && Number(stats.temporaryHitPoints) < 0)) return null
    const { temporaryHitPoints, ...baseStats } = stats
    return { ...sheet, ...baseStats, playerDetails: { ...sheet.playerDetails,
        ...(temporaryHitPoints !== undefined ? { temporaryHitPoints } : {}),
        ...(baseStats.armorClass !== undefined && baseStats.armorClass !== sheet.armorClass && sheet.playerDetails?.['creation.enabled'] === 'true' ? { 'creation.override.base.armorClass': 'true' } : {}),
    } }
}

export function clampCurrentHitPointsToMaximum(sheet: CharacterSheet): CharacterSheet {
    const maximum = sheet.playerDetails?.maxHitPoints
    if (maximum === undefined) return sheet
    const hitPoints = clampHitPointsToMaximum(sheet.hitPoints, maximum)
    return hitPoints === sheet.hitPoints ? sheet : { ...sheet, hitPoints }
}

export function clampHitPointsToMaximum(hitPoints: string, maximum: string): string {
    const current = Number(hitPoints)
    const max = Number(maximum)
    if (!hitPoints.trim() || !maximum.trim() || !Number.isSafeInteger(current) || current < 0
        || !Number.isSafeInteger(max) || max < 0 || current <= max) return hitPoints
    return maximum
}

export function normalizeHitPoints(value: string): string {
    return value.replace(/^0+(?=\d)/, '')
}

export function inventoryTotalWeight(quantity: string, weight: string): string {
    if (!weight.trim()) return ''
    const count = Number(quantity.trim() || 1)
    const unitWeight = Number(weight.trim().replace(',', '.'))
    const total = count * unitWeight
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(unitWeight) || unitWeight < 0 || !Number.isFinite(total)) return ''
    // ponytail: 15 cifre significative eliminano gli artefatti dei float; per maggiore precisione serve aritmetica decimale.
    return String(Number(total.toPrecision(15)))
}

export function syncTurnStats<T extends SheetStats & { description: string; sheet?: CharacterSheet; temporaryHitPoints?: string }>(turn: T, sheet: CharacterSheet): T {
    return { ...turn, description: sheet.name, hitPoints: sheet.hitPoints, armorClass: sheet.armorClass, initiative: sheet.initiative,
    ...(turn.temporaryHitPoints !== undefined ? { temporaryHitPoints: sheet.playerDetails?.temporaryHitPoints ?? '' } : {}),
        sheet: { ...sheet, abilities: turn.sheet?.abilities ?? sheet.abilities } }
}

export function initiativeBonus(sheet?: CharacterSheet): string {
    if (!sheet) return ''
    if (sheet.playerDetails?.['creation.enabled'] === 'true' && sheet.playerDetails.initiativeBonus !== undefined) return signedBonus(integerValue(sheet.playerDetails.initiativeBonus))
    const dex = abilityModifier(sheet.dexterity)
    const extra = integerValue(sheet.playerDetails?.['wizard.initiativeExtra']) ?? 0
    return signedBonus(dex === undefined ? undefined : dex + extra)
}

export function abilitiesFromSheet(sheet: CharacterSheet, ownerId: number, firstId: number): Ability[] {
    return sheet.abilities.map((ability, index) => ({
        ...ability, id: firstId + index, ownerId, remainingTurns: ability.remainingTurns ?? durationTurns[ability.duration], active: false,
    }))
}

export function importSheetAbility(abilities: Ability[], sheet: CharacterSheet, ownerId: number, index: number, id: number): Ability[] {
    const template = sheet.abilities[index]
    if (!template || abilities.some((ability) => ability.ownerId === ownerId && ability.sheetAbilityIndex === index)) return abilities
    return [...abilities, { ...template, id, ownerId, sheetAbilityIndex: index, remainingTurns: template.remainingTurns ?? durationTurns[template.duration], active: false }]
}
