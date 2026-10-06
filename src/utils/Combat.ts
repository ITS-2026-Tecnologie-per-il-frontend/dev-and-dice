export type Combat = { activeId: number; round: number }

type Participant = { id: number; initiative: string }

export function sortByInitiative<T extends Participant>(participants: T[]): T[] {
    // le parità mantengono l'ordine manuale; nessuno spareggio automatico.
    return [...participants].sort((first, second) => Number(second.initiative) - Number(first.initiative))
}

export function nextCombatTurn(participants: Participant[], combat: Combat): Combat | null {
    if (participants.length === 0) return null
    const nextIndex = (participants.findIndex((participant) => participant.id === combat.activeId) + 1) % participants.length
    return { activeId: participants[nextIndex].id, round: combat.round + (nextIndex === 0 ? 1 : 0) }
}

export const durationTurns = {
    '1 minuto': 10,
    '10 minuti': 100,
    '1 ora': 600,
    '8 ore': 4800,
    '24 ore': 14400,
} as const

export type Ability = {
    id: number
    name: string
    duration: keyof typeof durationTurns
    remainingTurns: number
    ownerId: number | null
    active: boolean
}

export function advanceAbilityDurations(abilities: Ability[]): Ability[] {
    // il conteggio avanza a fine round; per scadenze nel singolo turno servirà un turno di attivazione.
    return abilities.map((ability) => ability.active ? { ...ability, remainingTurns: Math.max(0, ability.remainingTurns - 1) } : ability)
}

export function activateAbility(ability: Ability): Ability {
    if (ability.active || ability.remainingTurns === 0 || !ability.name.trim() || ability.ownerId === null) return ability
    return { ...ability, active: true }
}
