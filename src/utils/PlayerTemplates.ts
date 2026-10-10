import type { CharacterSheet } from './CharacterSheets.ts'
import { classId } from './Spellcasting.ts'

const wizardPages = ['Statistiche e tradizione arcana', 'Personaggio e inventario', 'Incantesimi', 'Equipaggiamento indossato'] as const

export const sheetTemplates = {
    generic: { name: 'Scheda generale', pages: ['Statistiche e combattimento', 'Personaggio e inventario', 'Incantesimi'] },
    wizard: { name: 'Mago', pages: wizardPages },
    'wizard-pdf': { name: 'Mago · stile PDF', pages: wizardPages },
    'barbarian-pdf': { name: 'Barbaro · stile PDF', pages: ['Statistiche e cammino primordiale', 'Personaggio e inventario', 'Equipaggiamento indossato'] },
} as const

export function playerTemplate(sheet: CharacterSheet): keyof typeof sheetTemplates {
    const explicit = sheet.playerDetails?.['sheet.template']
    if (explicit === 'generic' || explicit === 'wizard' || explicit === 'wizard-pdf') return explicit
    if (sheet.kind === 'PG' && classId(sheet) === 'barbarian') return 'barbarian-pdf'
    return sheet.playerDetails?.['creation.class'] === 'wizard' || /^(mago|wizard)$/i.test(sheet.characterClass.trim()) ? 'wizard' : 'generic'
}

export const wizardPrivilegeLevels = [2, 6, 10, 14, 18, 20] as const
export function featuresAtLevel(text: string, level: number) {
    return text.split(/\n\s*\n/).filter((block) => new RegExp(`\\(livello ${level}\\)\\s*$`, 'i').test(block.split('\n')[0])).join('\n\n')
}
export function updateFeaturesAtLevel(text: string, level: number, value: string) {
    const rest = text.split(/\n\s*\n/).filter((block) => block.trim() && !new RegExp(`\\(livello ${level}\\)\\s*$`, 'i').test(block.split('\n')[0]))
    // ponytail: il testo libero senza intestazione usa un unico privilegio; per più capacità si mantengono le intestazioni con il livello.
    const blocks = value.split(/\n\s*\n/).filter((block) => block.trim()).map((block) => /\(livello \d+\)\s*$/i.test(block.split('\n')[0]) ? block : `Privilegio di classe (livello ${level})\n${block}`)
    return [...rest, ...blocks].join('\n\n')
}
