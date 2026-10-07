import { durationTurns } from './Combat.ts'
import type { CharacterSheet, SheetAbility } from './CharacterSheets.ts'

const passiveNames = new Set([
    'unarmored defense', 'difesa senza armatura', 'darkvision', 'scurovisione', 'extra attack', 'attacco extra',
    'dwarven resilience', 'resilienza nanica', 'dwarven toughness', 'robustezza nanica', 'fey ancestry', 'retaggio fatato',
    'gnome cunning', 'astuzia gnomesca', 'brave', 'coraggioso', 'keen senses', 'sensi acuti', 'menacing', 'minaccioso',
    'hellish resistance', 'resistenza infernale', 'draconic resilience', 'resilienza draconica', 'jack of all trades',
    'expertise', 'maestria', 'fast movement', 'movimento veloce', 'primal champion', 'campione primordiale',
    'aura of protection', 'aura di protezione', 'aura of courage', 'aura di coraggio', 'superior inspiration',
    'improved divine smite', 'punizione divina migliorata', 'fighting style: defense', 'stile di combattimento: difesa',
])
// Solo durate verificate: riposi, costi e durate di altre magie nel testo non sono timer del privilegio.
const reviewedRounds: Record<string, number> = {
    rage: 10, ira: 10, 'bardic inspiration': 100, 'ispirazione bardica': 100,
    'channel divinity: turn undead': 10, 'incanalare divinita: scacciare non morti': 10,
    'holy nimbus': 10, 'aureola sacra': 10, 'draconic presence': 10, 'presenza draconica': 10,
}
const actionRules: [string, RegExp][] = [
    ['Azione bonus', /\b(?:as a|use (?:a|your|the)|take a) bonus action\b|\bazione bonus\b/i],
    ['Reazione', /\b(?:use|using|spend) your reaction\b|\b(?:puoi|puo) (?:usare|utilizzare|spendere) (?:la tua |una )?reazione\b|\b(?:come|con) (?:una |la tua )reazione\b/i],
    ['Azione', /\bas an action\b|\b(?:use|using) your action\b|\b(?:come|con|usando) (?:un['’]? ?|una )azione\b|\bpuoi (?:usare|utilizzare|spendere) (?:la tua |una )azione\b/i],
    ['Spesa volontaria di risorse', /\byou can (?:expend|spend) (?:one|\d+|a number of) (?:spell slots?|ki points?|sorcery points?|use)\b|\bpuoi (?:spendere|consumare) (?:uno |un |\d+ )?(?:slot|punti? ki|punti? stregoneria)\b/i],
    ['Scelta durante il turno', /\byou can (?:decide to attack recklessly|reroll a saving throw|take one additional action)\b/i],
]
const normalized = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const baseName = (name: string) => normalized(name).replace(/\s*\((?:livello \d+|d\d+)\)/g, '').replace(/\s+d\d+$/, '').trim()

export type PdfAbility = { key: string; name: string; description: string; activation: 'active' | 'passive' | 'review'; reason: string; template: SheetAbility }

export function pdfAbilities(sheet: CharacterSheet): PdfAbility[] {
    if (sheet.kind !== 'PG') return []
    const details = sheet.playerDetails ?? {}
    return ['classFeatures', 'racialTraits', 'additionalTraits'].flatMap((source) =>
        (details[source] ?? '').split(/\n\s*\n/).filter((block) => block.trim()).map((block) => {
            const lines = block.trim().split('\n')
            const title = lines.shift()!.trim()
            const name = title.replace(/\s*\(livello \d+\)\s*$/i, '')
            const description = lines.join('\n').trim()
            const key = `combatFeature.${encodeURIComponent(`${source}:${normalized(name)}`)}`
            const text = normalized(description).split(/(?<=[.!?])\s+/).filter((sentence) => !/\b(?:cannot|can't|non puoi|non puo)\b/.test(sentence)).join(' ')
            const rule = actionRules.find(([, pattern]) => pattern.test(text))
            const passive = passiveNames.has(baseName(name))
            const automatic = !description ? 'review' : passive ? 'passive' : rule ? 'active' : 'review'
            const override = details[key]
            const activation = override === 'include' ? 'active' : override === 'exclude' ? 'passive' : automatic
            const rounds = reviewedRounds[baseName(name)]
            const suggested = (Object.keys(durationTurns) as SheetAbility['duration'][]).find((duration) => rounds !== undefined && durationTurns[duration] === rounds) ?? 'Senza conteggio'
            const duration = Object.hasOwn(durationTurns, details[`${key}.duration`] ?? '') ? details[`${key}.duration`] as SheetAbility['duration'] : suggested
            const customTurns = Number(details[`${key}.turns`] ?? 0)
            const remainingTurns = duration === 'Personalizzata' ? (Number.isSafeInteger(customTurns) && customTurns >= 0 ? customTurns : 0) : durationTurns[duration]
            return {
                key, name, description: description || block.trim(), activation,
                reason: override === 'include' ? 'Confermato manualmente' : override === 'exclude' ? 'Escluso manualmente' : passive ? 'Privilegio passivo' : rule?.[0] ?? 'Attivazione da verificare',
                template: { name, description: description || block.trim(), duration, remainingTurns, timed: duration !== 'Senza conteggio' },
            }
        }),
    )
}

export function pdfCombatAbilities(sheet: CharacterSheet): SheetAbility[] {
    return pdfAbilities(sheet).filter((ability) => ability.activation === 'active').map((ability) => ability.template)
}
