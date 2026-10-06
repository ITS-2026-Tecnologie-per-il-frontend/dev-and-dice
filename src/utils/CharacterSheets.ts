import { durationTurns, type Ability } from './Combat.ts'

export const characterFields = {
    name: 'Nome', kind: 'Tipo', race: 'Razza / specie', characterClass: 'Classe',
    level: 'Livello / GS', hitPoints: 'PF', armorClass: 'CA', initiative: 'Iniziativa predefinita',
    speed: 'Velocità', strength: 'Forza', dexterity: 'Destrezza', constitution: 'Costituzione',
    intelligence: 'Intelligenza', wisdom: 'Saggezza', charisma: 'Carisma',
    notes: 'Attacchi, equipaggiamento e altre note',
} as const

export const numericCharacterFields = ['hitPoints', 'armorClass', 'initiative', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const

export type SheetAbility = { name: string; duration: keyof typeof durationTurns; catalogId?: string; remainingTurns?: number }

export type CharacterSheet = { id: string; abilities: SheetAbility[]; catalogId?: string } & Record<keyof typeof characterFields, string>

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
        && (sheet.abilities === undefined || (Array.isArray(sheet.abilities) && sheet.abilities.every((ability: unknown) =>
            ability !== null && typeof ability === 'object' && 'name' in ability && typeof ability.name === 'string'
            && ability.name.trim().length > 0 && 'duration' in ability && typeof ability.duration === 'string'
            && Object.hasOwn(durationTurns, ability.duration)
            && (!('catalogId' in ability) || ability.catalogId === undefined || typeof ability.catalogId === 'string')
            && (!('remainingTurns' in ability) || ability.remainingTurns === undefined || (Number.isSafeInteger(ability.remainingTurns) && Number(ability.remainingTurns) >= 0))
        )))
        && numericCharacterFields.every((key) => sheet[key] === '' || (sheet[key].trim() !== '' && Number.isSafeInteger(Number(sheet[key]))))
    ) || new Set(value.map((sheet) => sheet.id)).size !== value.length) {
        throw new Error('Le schede salvate non sono valide. I dati originali non sono stati modificati.')
    }
    return value.map((sheet) => ({ ...sheet, abilities: sheet.abilities ?? [] }))
}

export function turnFromSheet(sheet: CharacterSheet, id: number) {
    // copia per combattimento; aggiornare la scheda base non modifica un incontro già preparato.
    return { id, description: sheet.name, initiative: sheet.kind === 'PG' ? sheet.initiative : '', hitPoints: sheet.hitPoints, armorClass: sheet.armorClass, sheet: { ...sheet, abilities: sheet.abilities.map((ability) => ({ ...ability })) } }
}

export function initiativeBonus(sheet?: CharacterSheet): string {
    if (!sheet || !sheet.dexterity.trim() || !Number.isSafeInteger(Number(sheet.dexterity))) return ''
    const modifier = Math.floor((Number(sheet.dexterity) - 10) / 2)
    return `${modifier >= 0 ? '+' : ''}${modifier}`
}

export function abilitiesFromSheet(sheet: CharacterSheet, ownerId: number, firstId: number): Ability[] {
    return sheet.abilities.map((ability, index) => ({
        ...ability, id: firstId + index, ownerId, remainingTurns: ability.remainingTurns ?? durationTurns[ability.duration], active: false,
    }))
}
