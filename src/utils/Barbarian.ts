import { integerValue, type CharacterSheet } from './CharacterSheets.ts'
import { classId, spellEdition } from './Spellcasting.ts'
import { sheetClassLevels } from '../domain/dnd/ActiveRules.ts'
import type { CreationData } from './PlayerCreation.ts'

export const rageUsedKey = 'rules2014.used.phb2014:class-feature:barbarian-1-rage'
const legacyRageUsedKey = 'barbarian.combat.rageUsed'

/** 2014 PHB: D&D_5_Player_Original_Handbook.pdf, PDF 48–49, Barbarian table / Rage. */
export function barbarianRules(sheet: CharacterSheet, data?: CreationData) {
    if (sheet.kind !== 'PG' || classId(sheet) !== 'barbarian' || spellEdition(sheet) !== '2014' || !data?.verified) return undefined
    const level = sheetClassLevels(sheet).barbarian
    const row = data.verified.reviewedEntities.find(entity => entity.id === `phb2014:class-level:barbarian-${level}`)
    if (!row?.verification.complete) return undefined
    const total = row.mechanics.rages, damage = row.mechanics.rageDamageBonus
    if (!(total === 'unlimited' || typeof total === 'number' && Number.isSafeInteger(total) && total > 0) || typeof damage !== 'number') return undefined
    const rawUsed = sheet.playerDetails?.[rageUsedKey] ?? sheet.playerDetails?.[legacyRageUsedKey] ?? '0'
    const used = integerValue(rawUsed)
    const valid = used !== undefined && used >= 0 && (total === 'unlimited' || used <= total)
    return { edition: '2014' as const, level, total: total === 'unlimited' ? 'unlimited' as const : total, damage, rawUsed, used, valid, remaining: valid ? total === 'unlimited' ? 'unlimited' as const : total - used : undefined, sources: row.sources }
}

export function setBarbarianRageUsed(sheet: CharacterSheet, data: CreationData, value: string): CharacterSheet {
    const rules = barbarianRules(sheet, data), used = integerValue(value)
    if (!rules) throw new Error('Servono il livello da Barbaro e le regole verificate 2014.')
    if (used === undefined || used < 0 || rules.total !== 'unlimited' && used > rules.total) throw new Error('Gli usi di Ira devono essere un intero tra zero e il totale disponibile.')
    return { ...sheet, playerDetails: { ...sheet.playerDetails, [rageUsedKey]: String(used) } }
}
